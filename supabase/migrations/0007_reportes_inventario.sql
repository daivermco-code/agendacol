-- 0007_reportes_inventario.sql — Reportes, productos con existencias y búsqueda rápida de hora (Fase 7).
-- Las existencias solo cambian por funciones de la base (cerrar_venta, anular_venta, mover_existencias): cada
-- cambio deja su movimiento y nunca quedan en negativo. Los reportes son funciones sin security definer: leen con
-- los permisos (RLS) de quien consulta. anon no tiene nada.

-- Productos ---------------------------------------------------------------------------------------------------
create table productos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 2 and 80),
  categoria text check (char_length(categoria) <= 40),
  precio integer not null check (precio between 0 and 100000000),
  existencias integer not null default 0 check (existencias between 0 and 99999),
  -- Con estas unidades o menos, el producto sale en la alerta de stock bajo (0 = sin alerta).
  stock_minimo integer not null default 0 check (stock_minimo between 0 and 9999),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (negocio_id, nombre)
);
create trigger productos_updated before update on productos for each row execute function tocar_updated_at();

-- Cada entrada, venta, anulación o ajuste de existencias (cantidad con signo).
create table movimientos_stock (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  producto_id uuid not null references productos(id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'venta', 'anulacion', 'ajuste')),
  cantidad integer not null check (cantidad <> 0 and cantidad between -99999 and 99999),
  venta_id uuid references ventas(id) on delete set null,
  nota text check (char_length(nota) <= 120),
  creado_por uuid references miembros(id) on delete set null,
  created_at timestamptz not null default now()
);
create index movimientos_stock_producto on movimientos_stock (producto_id, created_at desc);

-- Un ítem de venta es un servicio (con o sin cita), un producto o un ítem libre. Un producto vendido no se borra.
alter table venta_items add column producto_id uuid references productos(id) on delete restrict;
alter table venta_items add constraint venta_items_producto_solo
  check (producto_id is null or (servicio_id is null and cita_id is null));
create index venta_items_producto on venta_items (producto_id) where producto_id is not null;

alter table productos enable row level security;
alter table movimientos_stock enable row level security;
create policy "dueno y recepcion leen" on productos for select to authenticated
  using (negocio_id = mi_negocio() and mi_rol() in ('dueno', 'recepcion'));
create policy "dueno crea" on productos for insert to authenticated
  with check (negocio_id = mi_negocio() and mi_rol() = 'dueno');
create policy "dueno edita" on productos for update to authenticated
  using (negocio_id = mi_negocio() and mi_rol() = 'dueno')
  with check (negocio_id = mi_negocio() and mi_rol() = 'dueno');
create policy "dueno borra" on productos for delete to authenticated
  using (negocio_id = mi_negocio() and mi_rol() = 'dueno');
create policy "dueno lee" on movimientos_stock for select to authenticated
  using (negocio_id = mi_negocio() and mi_rol() = 'dueno');

-- Las existencias no se escriben directo: ni al crear ni al editar (solo por las funciones de abajo).
revoke all on productos, movimientos_stock from anon, authenticated;
grant select, delete on productos to authenticated;
grant insert (negocio_id, nombre, categoria, precio, stock_minimo, activo) on productos to authenticated;
grant update (nombre, categoria, precio, stock_minimo, activo) on productos to authenticated;
grant select on movimientos_stock to authenticated;
grant all on productos, movimientos_stock to service_role;

-- Entrada de mercancía o conteo físico: el conteo deja las existencias en lo contado y registra la diferencia.
create or replace function public.mover_existencias(p_producto uuid, p_tipo text, p_cantidad int, p_nota text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_negocio uuid := mi_negocio();
  v_producto productos;
  v_cambio int;
  v_miembro uuid;
begin
  if mi_rol() is distinct from 'dueno' then
    return error_venta('SIN_PERMISO', 'Solo el dueño mueve el inventario');
  end if;
  select * into v_producto from productos where id = p_producto and negocio_id = v_negocio for update;
  if not found then
    return error_venta('NO_ENCONTRADA', 'Ese producto ya no existe');
  end if;
  if p_tipo = 'entrada' then
    if coalesce(p_cantidad, 0) not between 1 and 9999 then
      return error_venta('VALIDACION', 'Escribe cuántas unidades entraron (1 a 9.999)', 'cantidad');
    end if;
    v_cambio := p_cantidad;
  elsif p_tipo = 'conteo' then
    if p_cantidad is null or p_cantidad not between 0 and 99999 then
      return error_venta('VALIDACION', 'Escribe cuántas unidades contaste', 'cantidad');
    end if;
    v_cambio := p_cantidad - v_producto.existencias;
  else
    return error_venta('VALIDACION', 'Elige si es una entrada o un conteo', 'tipo');
  end if;
  if v_producto.existencias + v_cambio > 99999 then
    return error_venta('VALIDACION', 'Las existencias llegan hasta 99.999 unidades', 'cantidad');
  end if;
  if v_cambio = 0 then
    return jsonb_build_object('ok', true, 'existencias', v_producto.existencias, 'cambio', 0);
  end if;

  select id into v_miembro from miembros where user_id = auth.uid();
  update productos set existencias = existencias + v_cambio where id = v_producto.id
  returning * into v_producto;
  insert into movimientos_stock (negocio_id, producto_id, tipo, cantidad, nota, creado_por)
  values (v_negocio, v_producto.id, case when p_tipo = 'entrada' then 'entrada' else 'ajuste' end, v_cambio,
          left(nullif(trim(coalesce(p_nota, '')), ''), 120), v_miembro);
  return jsonb_build_object('ok', true, 'existencias', v_producto.existencias, 'cambio', v_cambio);
end;
$$;

-- Cerrar venta (igual que en 0006) ahora con productos: revisa y descuenta existencias en la misma transacción.
create or replace function public.cerrar_venta(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_negocio uuid := mi_negocio();
  a ajustes;
  v_local uuid := nullif(p->>'localId', '')::uuid;
  v_cliente uuid := nullif(p->>'clienteId', '')::uuid;
  v_desc int := coalesce((p->>'descuento')::int, 0);
  v_items jsonb := coalesce(p->'items', '[]'::jsonb);
  v_pagos jsonb := coalesce(p->'pagos', '[]'::jsonb);
  v_item jsonb;
  v_cita citas;
  v_citas uuid[] := '{}';
  v_cobrada text;
  v_cant int;
  v_precio int;
  v_sub int := 0;
  v_rev jsonb;
  v_venta ventas;
  v_miembro uuid;
  v_desc_item text;
  v_pedidos jsonb := '{}'::jsonb;   -- producto → unidades pedidas en toda la venta
  v_clave text;
  v_producto productos;
begin
  if mi_rol() is null or mi_rol() not in ('dueno', 'recepcion') then
    return error_venta('SIN_PERMISO', 'Tu rol no puede cobrar');
  end if;
  -- El candado de los ajustes del negocio pone en fila a quien cobra al mismo tiempo (numeración sin repetidos).
  select * into a from ajustes where negocio_id = v_negocio for update;
  if not exists (select 1 from locales where id = v_local and negocio_id = v_negocio) then
    return error_venta('VALIDACION', 'Elige el local de la venta', 'localId');
  end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    return error_venta('VALIDACION', 'Agrega al menos un ítem', 'items');
  end if;
  if jsonb_array_length(v_items) > 30 then
    return error_venta('VALIDACION', 'Una venta lleva hasta 30 ítems', 'items');
  end if;

  for v_item in select * from jsonb_array_elements(v_items) loop
    v_cant := coalesce((v_item->>'cantidad')::int, 1);
    v_precio := (v_item->>'precioUnitario')::int;
    if v_cant not between 1 and 99 then
      return error_venta('VALIDACION', 'La cantidad va de 1 a 99', 'items');
    end if;
    if v_precio is null or v_precio not between 0 and 100000000 then
      return error_venta('VALIDACION', 'Revisa el precio de los ítems', 'items');
    end if;
    if nullif(v_item->>'servicioId', '') is not null and not exists (
         select 1 from servicios where id = (v_item->>'servicioId')::uuid and negocio_id = v_negocio) then
      return error_venta('VALIDACION', 'Ese servicio ya no existe', 'items');
    end if;
    if nullif(v_item->>'profesionalId', '') is not null and not exists (
         select 1 from profesionales where id = (v_item->>'profesionalId')::uuid and negocio_id = v_negocio) then
      return error_venta('VALIDACION', 'Ese profesional ya no existe', 'items');
    end if;
    if nullif(v_item->>'productoId', '') is not null then
      if nullif(v_item->>'servicioId', '') is not null or nullif(v_item->>'citaId', '') is not null then
        return error_venta('VALIDACION', 'Un ítem es un servicio o un producto, no los dos', 'items');
      end if;
      v_clave := v_item->>'productoId';
      v_pedidos := v_pedidos || jsonb_build_object(v_clave, coalesce((v_pedidos->>v_clave)::int, 0) + v_cant);
    end if;
    if nullif(v_item->>'citaId', '') is not null then
      select * into v_cita from citas where id = (v_item->>'citaId')::uuid and negocio_id = v_negocio for update;
      if not found then
        return error_venta('NO_ENCONTRADA', 'La cita ya no existe', 'items');
      end if;
      if v_cita.estado = 'cancelado' then
        return error_venta('VALIDACION', 'Una cita cancelada no se cobra', 'items');
      end if;
      select v.numero into v_cobrada from venta_items vi join ventas v on v.id = vi.venta_id
       where vi.cita_id = v_cita.id and vi.vigente;
      if found or v_cita.id = any(v_citas) then
        return error_venta('YA_COBRADA', format('Esta cita ya se cobró (venta %s)', coalesce(v_cobrada, 'en curso')),
                           'items');
      end if;
      v_citas := v_citas || v_cita.id;
      v_cliente := coalesce(v_cliente, v_cita.cliente_id);
    end if;
    v_sub := v_sub + v_cant * v_precio;
  end loop;

  -- Existencias: se bloquean los productos (en orden, para no cruzarse con otra venta) y se revisa que alcancen.
  for v_clave in select k from jsonb_object_keys(v_pedidos) k order by k loop
    select * into v_producto from productos where id = v_clave::uuid and negocio_id = v_negocio for update;
    if not found or not v_producto.activo then
      return error_venta('VALIDACION', 'Ese producto ya no está a la venta', 'items');
    end if;
    if v_producto.existencias < (v_pedidos->>v_clave)::int then
      return error_venta('SIN_EXISTENCIAS',
        case when v_producto.existencias = 0 then format('%s está agotado', v_producto.nombre)
             else format('Solo quedan %s de %s', v_producto.existencias, v_producto.nombre) end, 'items');
    end if;
  end loop;

  if v_cliente is not null and not exists (select 1 from clientes where id = v_cliente and negocio_id = v_negocio) then
    return error_venta('VALIDACION', 'Ese cliente ya no existe', 'clienteId');
  end if;
  if v_cliente is null and a.caja_cliente_obligatorio then
    return error_venta('VALIDACION', 'Elige el cliente de esta venta', 'clienteId');
  end if;
  if v_desc < 0 or v_desc > v_sub then
    return error_venta('VALIDACION', 'El descuento no puede ser mayor al subtotal', 'descuento');
  end if;
  v_rev := revisar_pagos(v_negocio, v_pagos, v_sub - v_desc);
  if not (v_rev->>'ok')::boolean then return v_rev; end if;

  select id into v_miembro from miembros where user_id = auth.uid();
  begin
    update ajustes set venta_siguiente = venta_siguiente + 1 where negocio_id = v_negocio;
    insert into ventas (negocio_id, local_id, prefijo, correlativo, cliente_id, subtotal, descuento, total, pagado,
                        estado, creada_por)
    values (v_negocio, v_local, a.venta_prefijo, a.venta_siguiente, v_cliente, v_sub, v_desc, v_sub - v_desc,
            (v_rev->>'suma')::int,
            case when (v_rev->>'suma')::int = v_sub - v_desc then 'pagada' else 'parcial' end::estado_venta, v_miembro)
    returning * into v_venta;

    for v_item in select * from jsonb_array_elements(v_items) loop
      v_cant := coalesce((v_item->>'cantidad')::int, 1);
      v_desc_item := nullif(trim(v_item->>'descripcion'), '');
      if v_desc_item is null then
        select nombre into v_desc_item from servicios where id = nullif(v_item->>'servicioId', '')::uuid;
      end if;
      if v_desc_item is null then
        select nombre into v_desc_item from productos where id = nullif(v_item->>'productoId', '')::uuid;
      end if;
      insert into venta_items (venta_id, servicio_id, cita_id, profesional_id, producto_id, descripcion, cantidad,
                               precio_unitario, total)
      values (v_venta.id, nullif(v_item->>'servicioId', '')::uuid, nullif(v_item->>'citaId', '')::uuid,
              nullif(v_item->>'profesionalId', '')::uuid, nullif(v_item->>'productoId', '')::uuid,
              left(coalesce(v_desc_item, 'Ítem'), 120), v_cant, (v_item->>'precioUnitario')::int,
              v_cant * (v_item->>'precioUnitario')::int);
      if nullif(v_item->>'productoId', '') is not null then
        update productos set existencias = existencias - v_cant where id = (v_item->>'productoId')::uuid;
        insert into movimientos_stock (negocio_id, producto_id, tipo, cantidad, venta_id, nota, creado_por)
        values (v_negocio, (v_item->>'productoId')::uuid, 'venta', -v_cant, v_venta.id,
                'Venta ' || v_venta.numero, v_miembro);
      end if;
    end loop;

    perform insertar_pagos(v_venta, v_pagos, (v_rev->>'suma')::int < v_venta.total, v_miembro);
  exception when unique_violation then
    -- Otra pestaña cobró la misma cita, o el número ya existe: no queda nada a medias.
    get stacked diagnostics v_cobrada = constraint_name;
    if v_cobrada = 'venta_items_cita_vigente' then
      return error_venta('YA_COBRADA', 'Esta cita ya se cobró en otra pestaña', 'items');
    end if;
    return error_venta('NUMERACION', 'El número de venta ya existe. Revisa la numeración en Administración');
  end;

  -- Toca las citas cobradas para que la agenda (Realtime) pinte el "$" en todas las pestañas.
  update citas set updated_at = now() where id = any(v_citas);
  return jsonb_build_object('ok', true, 'ventaId', v_venta.id, 'numero', v_venta.numero,
    'vuelto', (v_rev->>'vuelto')::int, 'estado', v_venta.estado, 'total', v_venta.total, 'pagado', v_venta.pagado);
end;
$$;

-- Anular (igual que en 0006) ahora devuelve al inventario los productos de la venta.
create or replace function public.anular_venta(p_venta uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_negocio uuid := mi_negocio();
  v_venta ventas;
  v_miembro uuid;
  v_linea record;
begin
  if mi_rol() is distinct from 'dueno' then
    return error_venta('SIN_PERMISO', 'Solo el dueño puede anular ventas');
  end if;
  if char_length(trim(coalesce(p_motivo, ''))) < 3 then
    return error_venta('VALIDACION', 'Escribe el motivo de la anulación', 'motivo');
  end if;
  select * into v_venta from ventas where id = p_venta and negocio_id = v_negocio for update;
  if not found then
    return error_venta('NO_ENCONTRADA', 'La venta ya no existe');
  end if;
  if v_venta.estado = 'anulada' then
    return error_venta('VALIDACION', 'Esta venta ya estaba anulada');
  end if;

  select id into v_miembro from miembros where user_id = auth.uid();
  for v_linea in
    select vi.producto_id, sum(vi.cantidad)::int as cantidad from venta_items vi
     where vi.venta_id = v_venta.id and vi.vigente and vi.producto_id is not null
     group by vi.producto_id order by vi.producto_id
  loop
    update productos set existencias = least(existencias + v_linea.cantidad, 99999) where id = v_linea.producto_id;
    insert into movimientos_stock (negocio_id, producto_id, tipo, cantidad, venta_id, nota, creado_por)
    values (v_negocio, v_linea.producto_id, 'anulacion', v_linea.cantidad, v_venta.id,
            'Anulación de la venta ' || v_venta.numero, v_miembro);
  end loop;
  update ventas set estado = 'anulada', motivo_anulacion = left(trim(p_motivo), 200), anulada_at = now(),
                    anulada_por = v_miembro
   where id = v_venta.id;
  update venta_items set vigente = false where venta_id = v_venta.id;
  insert into movimientos_caja (negocio_id, local_id, tipo, monto, efectivo, concepto, metodo, venta_id, creado_por)
  select m.negocio_id, m.local_id, 'egreso', -m.monto, m.efectivo, 'Anulación de la venta ' || v_venta.numero,
         m.metodo, v_venta.id, v_miembro
    from movimientos_caja m
   where m.venta_id = v_venta.id and m.tipo = 'ingreso';
  update citas set updated_at = now()
   where id in (select cita_id from venta_items where venta_id = v_venta.id and cita_id is not null);
  return jsonb_build_object('ok', true, 'numero', v_venta.numero);
end;
$$;

-- Reportes ----------------------------------------------------------------------------------------------------
-- Minutos que cada profesional activo podía atender cada día del período: su horario dentro del horario del local,
-- sin su descanso. Es la base del factor de ocupación (los bloqueos no se descuentan).
create or replace function public.turnos_periodo(p_desde date, p_hasta date)
returns table (fecha date, dia int, profesional_id uuid, minutos int)
language sql stable set search_path = public as $$
  select d::date, extract(isodow from d)::int, p.id,
         greatest(0, (extract(epoch from least(hl.fin, hp.fin) - greatest(hl.inicio, hp.inicio)) / 60
           - case when hp.descanso_inicio is not null and hp.descanso_fin is not null
                  then extract(epoch from hp.descanso_fin - hp.descanso_inicio) / 60 else 0 end)::int)
    from generate_series(p_desde, p_hasta, interval '1 day') d
    join profesionales p on p.negocio_id = mi_negocio() and p.activo
    join horarios_local hl on hl.local_id = p.local_id and hl.dia_semana = extract(isodow from d) and hl.abierto
    join horarios_profesional hp on hp.profesional_id = p.id and hp.dia_semana = extract(isodow from d)
                                and hp.trabaja;
$$;

-- Reservas de un período (fechas de la cita): totales, estados, origen, ocupación, horas, días, clientes,
-- servicios y profesionales. Las canceladas cuentan en el total y en los estados, no en la ocupación.
create or replace function public.estadisticas_reservas(p_desde date, p_hasta date) returns jsonb
language sql stable set search_path = public as $$
  with c as (
    select c.*, extract(isodow from c.fecha)::int as dia
      from citas c
     where c.negocio_id = mi_negocio() and c.fecha between p_desde and p_hasta
  ),
  a as (select * from c where estado <> 'cancelado'),
  t as (select * from turnos_periodo(p_desde, p_hasta)),
  quien as (select distinct cliente_id from a)
  select jsonb_build_object(
    'total', (select count(*) from c),
    'activas', (select count(*) from a),
    'porEstado', (select coalesce(jsonb_object_agg(x.estado, x.n), '{}'::jsonb)
                    from (select estado, count(*) as n from c group by estado) x),
    'porOrigen', jsonb_build_object('agenda', (select count(*) from a where origen = 'agenda'),
                                    'enLinea', (select count(*) from a where origen = 'en_linea')),
    'minutosReservados', (select coalesce(sum(duracion_min), 0) from a),
    'minutosDisponibles', (select coalesce(sum(minutos), 0) from t),
    'asistencias', (select count(*) from c where estado = 'asiste'),
    'inasistencias', (select count(*) from c where estado = 'no_asistio'),
    'atendido', (select coalesce(sum(precio), 0) from c where estado = 'asiste'),
    'nuevosClientes', (select count(*) from clientes cl
                        where cl.negocio_id = mi_negocio()
                          and (cl.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta),
    'clientesPrimeraVez', (select count(*) from quien q
                            where not exists (select 1 from citas o
                                               where o.cliente_id = q.cliente_id and o.estado <> 'cancelado'
                                                 and o.fecha < p_desde)),
    'clientesRecurrentes', (select count(*) from quien q
                             where exists (select 1 from citas o
                                            where o.cliente_id = q.cliente_id and o.estado <> 'cancelado'
                                              and o.fecha < p_desde)),
    'porDia', (select jsonb_agg(jsonb_build_object(
                 'dia', g,
                 'reservas', (select count(*) from a where a.dia = g),
                 'minutosReservados', (select coalesce(sum(duracion_min), 0) from a where a.dia = g),
                 'minutosDisponibles', (select coalesce(sum(minutos), 0) from t where t.dia = g)) order by g)
                 from generate_series(1, 7) g),
    'porHora', (select coalesce(jsonb_agg(jsonb_build_object('dia', x.dia, 'hora', x.hora, 'reservas', x.n)
                                          order by x.dia, x.hora), '[]'::jsonb)
                  from (select dia, extract(hour from hora_inicio)::int as hora, count(*) as n
                          from a group by 1, 2) x),
    'porFecha', (select jsonb_agg(jsonb_build_object(
                   'fecha', d::date,
                   'reservas', (select count(*) from a where a.fecha = d::date),
                   'atendido', (select coalesce(sum(precio), 0) from c where c.fecha = d::date and estado = 'asiste'))
                   order by d)
                   from generate_series(p_desde, p_hasta, interval '1 day') d),
    'servicios', (select coalesce(jsonb_agg(x order by x.reservas desc, x.nombre), '[]'::jsonb)
                    from (select s.nombre, count(*) as reservas,
                                 coalesce(sum(a.precio) filter (where a.estado = 'asiste'), 0) as atendido
                            from a join servicios s on s.id = a.servicio_id
                           group by s.id, s.nombre order by count(*) desc, s.nombre limit 8) x),
    'clientes', (select coalesce(jsonb_agg(x order by x.reservas desc, x.nombre), '[]'::jsonb)
                   from (select cl.id, cl.nombre || ' ' || cl.apellido as nombre, count(*) as reservas,
                                coalesce(sum(a.precio) filter (where a.estado = 'asiste'), 0) as atendido
                           from a join clientes cl on cl.id = a.cliente_id
                          group by cl.id order by count(*) desc, 2 limit 8) x),
    'profesionales', (select coalesce(jsonb_agg(jsonb_build_object(
                        'id', p.id, 'nombre', p.nombre, 'color', p.color,
                        'reservas', (select count(*) from a where a.profesional_id = p.id),
                        'asistencias', (select count(*) from c where c.profesional_id = p.id and estado = 'asiste'),
                        'inasistencias', (select count(*) from c
                                           where c.profesional_id = p.id and estado = 'no_asistio'),
                        'canceladas', (select count(*) from c where c.profesional_id = p.id and estado = 'cancelado'),
                        'minutosReservados', (select coalesce(sum(duracion_min), 0) from a
                                               where a.profesional_id = p.id),
                        'minutosDisponibles', (select coalesce(sum(minutos), 0) from t where t.profesional_id = p.id),
                        'atendido', (select coalesce(sum(precio), 0) from c
                                      where c.profesional_id = p.id and estado = 'asiste'))
                        order by p.orden, p.nombre), '[]'::jsonb)
                        from profesionales p
                       where p.negocio_id = mi_negocio()
                         and (p.activo or exists (select 1 from c where c.profesional_id = p.id)))
  );
$$;

-- Ventas de un período (fecha de la venta, sin las anuladas): totales, por tipo de ítem, por día, por categoría,
-- servicios, productos y profesionales. Los ítems suman antes del descuento; el total, después.
create or replace function public.estadisticas_ventas(p_desde date, p_hasta date) returns jsonb
language sql stable set search_path = public as $$
  with r as (
    select (p_desde::timestamp at time zone 'America/Bogota') as ini,
           ((p_hasta + 1)::timestamp at time zone 'America/Bogota') as fin
  ),
  todas as (
    select v.*, (v.created_at at time zone 'America/Bogota')::date as fecha
      from ventas v, r
     where v.negocio_id = mi_negocio() and v.created_at >= r.ini and v.created_at < r.fin
  ),
  v as (select * from todas where estado <> 'anulada'),
  i as (
    select vi.*, case when vi.producto_id is not null then 'productos'
                      when vi.servicio_id is not null then 'servicios' else 'otros' end as tipo
      from venta_items vi join v on v.id = vi.venta_id
     where vi.vigente
  )
  select jsonb_build_object(
    'total', (select coalesce(sum(total), 0) from v),
    'cantidad', (select count(*) from v),
    'descuentos', (select coalesce(sum(descuento), 0) from v),
    'porCobrar', (select coalesce(sum(total - pagado), 0) from v),
    'anuladas', (select count(*) from todas where estado = 'anulada'),
    'porTipo', jsonb_build_object(
      'servicios', (select coalesce(sum(total), 0) from i where tipo = 'servicios'),
      'productos', (select coalesce(sum(total), 0) from i where tipo = 'productos'),
      'otros', (select coalesce(sum(total), 0) from i where tipo = 'otros')),
    'porDia', (select jsonb_agg(jsonb_build_object(
                 'dia', g,
                 'total', (select coalesce(sum(total), 0) from v where extract(isodow from v.fecha) = g),
                 'cantidad', (select count(*) from v where extract(isodow from v.fecha) = g)) order by g)
                 from generate_series(1, 7) g),
    'porFecha', (select jsonb_agg(jsonb_build_object(
                   'fecha', d::date,
                   'total', (select coalesce(sum(total), 0) from v where v.fecha = d::date),
                   'cantidad', (select count(*) from v where v.fecha = d::date)) order by d)
                   from generate_series(p_desde, p_hasta, interval '1 day') d),
    'categorias', (select coalesce(jsonb_agg(x order by x.total desc, x.nombre), '[]'::jsonb)
                     from (select coalesce(cat.nombre, case i.tipo when 'productos' then 'Productos' else 'Otros' end)
                                    as nombre,
                                  sum(i.total) as total, sum(i.cantidad) as cantidad
                             from i left join servicios s on s.id = i.servicio_id
                                    left join categorias cat on cat.id = s.categoria_id
                            group by 1) x),
    'servicios', (select coalesce(jsonb_agg(x order by x.total desc, x.nombre), '[]'::jsonb)
                    from (select s.nombre, sum(i.cantidad) as cantidad, sum(i.total) as total
                            from i join servicios s on s.id = i.servicio_id
                           group by s.id, s.nombre order by sum(i.total) desc, s.nombre limit 10) x),
    'productos', (select coalesce(jsonb_agg(x order by x.total desc, x.nombre), '[]'::jsonb)
                    from (select pr.nombre, sum(i.cantidad) as cantidad, sum(i.total) as total
                            from i join productos pr on pr.id = i.producto_id
                           group by pr.id, pr.nombre order by sum(i.total) desc, pr.nombre limit 10) x),
    'profesionales', (select coalesce(jsonb_agg(x order by x.total desc, x.nombre), '[]'::jsonb)
                        from (select p.nombre, p.color, sum(i.cantidad) as cantidad, sum(i.total) as total
                                from i join profesionales p on p.id = i.profesional_id
                               group by p.id, p.nombre, p.color) x)
  );
$$;

-- Búsqueda rápida de hora -------------------------------------------------------------------------------------
-- Las primeras horas libres para un servicio (con un profesional o con cualquiera que lo haga), desde un día y
-- hasta 30 días después; una por hora, con el primer profesional libre. Reusa horas_libres de la reserva en línea.
create or replace function public.buscar_horas_libres(
  p_local uuid, p_servicio uuid, p_desde date, p_profesional uuid default null, p_cantidad int default 6
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_negocio uuid := mi_negocio();
  v_dur int;
  v_pros uuid[];
  v_hoy date;
  v_inicio date;
  v_max int := least(greatest(coalesce(p_cantidad, 6), 1), 12);
  v_out jsonb := '[]'::jsonb;
  d date;
  h record;
begin
  if mi_rol() is null or mi_rol() not in ('dueno', 'recepcion') then
    return error_venta('SIN_PERMISO', 'Tu rol no puede reservar');
  end if;
  select (now() at time zone zona_horaria)::date into v_hoy from locales where id = p_local and negocio_id = v_negocio;
  if not found then
    return error_venta('VALIDACION', 'Elige el local', 'localId');
  end if;
  select duracion_min into v_dur from servicios where id = p_servicio and negocio_id = v_negocio and activo;
  if not found then
    return error_venta('VALIDACION', 'Ese servicio ya no existe', 'servicioId');
  end if;
  select array_agg(p.id order by p.orden, p.nombre) into v_pros
    from profesionales p join servicio_profesional sp on sp.profesional_id = p.id and sp.servicio_id = p_servicio
   where p.local_id = p_local and p.activo and (p_profesional is null or p.id = p_profesional);
  if v_pros is null then
    return jsonb_build_object('ok', true, 'horas', v_out, 'duracion', v_dur,
      'aviso', case when p_profesional is null then 'Nadie del equipo de este local hace ese servicio'
                    else 'Ese profesional no hace ese servicio' end);
  end if;
  v_inicio := greatest(coalesce(p_desde, v_hoy), v_hoy);
  for d in select generate_series(v_inicio, least(v_inicio + 30, v_hoy + 90), interval '1 day')::date loop
    for h in
      select distinct on (x.hora) x.hora, x.profesional_id, p.nombre
        from horas_libres(p_local, v_pros, v_dur, d) x join profesionales p on p.id = x.profesional_id
       order by x.hora, array_position(v_pros, x.profesional_id)
    loop
      v_out := v_out || jsonb_build_object('fecha', d, 'hora', to_char(h.hora, 'HH24:MI'),
                                           'profesionalId', h.profesional_id, 'profesional', h.nombre);
      exit when jsonb_array_length(v_out) >= v_max;
    end loop;
    exit when jsonb_array_length(v_out) >= v_max;
  end loop;
  return jsonb_build_object('ok', true, 'horas', v_out, 'duracion', v_dur);
end;
$$;

revoke all on function public.mover_existencias(uuid, text, int, text), public.turnos_periodo(date, date),
  public.estadisticas_reservas(date, date), public.estadisticas_ventas(date, date),
  public.buscar_horas_libres(uuid, uuid, date, uuid, int) from public, anon;
grant execute on function public.mover_existencias(uuid, text, int, text), public.turnos_periodo(date, date),
  public.estadisticas_reservas(date, date), public.estadisticas_ventas(date, date),
  public.buscar_horas_libres(uuid, uuid, date, uuid, int) to authenticated;
