-- 0006_ventas.sql — Ventas, pagos, caja y numeración (Fase 6).
-- Todo cobro pasa por funciones de la base (cerrar_venta, pagar_saldo, anular_venta, …): el número correlativo
-- se toma en la misma transacción que crea la venta (sin saltos ni repetidos), una cita se cobra una sola vez y
-- el movimiento de caja nace junto al pago. La app solo LEE estas tablas (RLS); nadie escribe en ellas directo.
-- anon no tiene nada: ni tablas ni funciones.

create table metodos_pago (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 2 and 40),
  tipo text not null check (tipo in ('efectivo', 'transferencia', 'debito', 'credito', 'billetera', 'otro')),
  activo boolean not null default true,
  orden smallint not null default 0,
  unique (negocio_id, nombre)
);

create table ventas (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  local_id uuid not null references locales(id) on delete restrict,
  prefijo text not null default '',
  correlativo integer not null check (correlativo > 0),
  numero text generated always as (prefijo || correlativo::text) stored,
  cliente_id uuid references clientes(id) on delete restrict,   -- un cliente con ventas no se borra
  subtotal integer not null check (subtotal >= 0),
  descuento integer not null default 0 check (descuento >= 0 and descuento <= subtotal),
  total integer not null check (total = subtotal - descuento),
  pagado integer not null default 0 check (pagado >= 0 and pagado <= total),
  estado estado_venta not null,
  motivo_anulacion text check (char_length(motivo_anulacion) <= 200),
  anulada_at timestamptz,
  anulada_por uuid references miembros(id) on delete set null,
  creada_por uuid references miembros(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (negocio_id, numero),
  check (estado <> 'pagada' or pagado = total),
  check (estado <> 'parcial' or pagado < total)
);
create index ventas_negocio_fecha on ventas (negocio_id, created_at desc);
create index ventas_cliente on ventas (cliente_id) where cliente_id is not null;

create table venta_items (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references ventas(id) on delete cascade,
  servicio_id uuid references servicios(id) on delete set null,
  cita_id uuid references citas(id) on delete set null,
  profesional_id uuid references profesionales(id) on delete set null,
  descripcion text not null check (char_length(descripcion) between 1 and 120),
  cantidad smallint not null default 1 check (cantidad between 1 and 99),
  precio_unitario integer not null check (precio_unitario between 0 and 100000000),
  total integer not null check (total = cantidad * precio_unitario),
  -- Al anular la venta deja de contar: la cita se puede cobrar otra vez y la venta anulada guarda su historia.
  vigente boolean not null default true
);
create index venta_items_venta on venta_items (venta_id);
create unique index venta_items_cita_vigente on venta_items (cita_id) where vigente and cita_id is not null;

create table pagos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  venta_id uuid not null references ventas(id) on delete cascade,
  metodo_id uuid not null references metodos_pago(id) on delete restrict,
  monto integer not null check (monto > 0),
  recibido integer check (recibido is null or recibido >= monto),  -- efectivo entregado (para el vuelto)
  propina integer not null default 0 check (propina >= 0),
  comprobante text check (char_length(comprobante) <= 40),          -- número del datáfono o de la transferencia
  abono boolean not null default false,                             -- pago parcial o pago del saldo
  creado_por uuid references miembros(id) on delete set null,
  created_at timestamptz not null default now()
);
create index pagos_venta on pagos (venta_id);
create index pagos_negocio_fecha on pagos (negocio_id, created_at desc);

-- Ingresos y egresos de la caja de cada local: positivo entra, negativo sale. Los pagos de ventas entran aquí
-- (efectivo o no) para que la caja muestre la cuenta del período; "Efectivo en caja" suma solo los de efectivo.
create table movimientos_caja (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  local_id uuid not null references locales(id) on delete restrict,
  tipo tipo_movimiento not null,
  monto integer not null,
  efectivo boolean not null default true,
  concepto text not null check (char_length(concepto) between 2 and 120),
  metodo text,                         -- nombre del método de pago cuando viene de una venta
  contado integer check (contado >= 0), -- rectificación: el efectivo que se contó
  pago_id uuid references pagos(id) on delete cascade,
  venta_id uuid references ventas(id) on delete cascade,
  creado_por uuid references miembros(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((tipo = 'ingreso' and monto > 0) or (tipo in ('egreso', 'traspaso') and monto < 0)
         or (tipo = 'rectificacion' and contado is not null))
);
create index movimientos_caja_local_fecha on movimientos_caja (local_id, created_at desc);
create index movimientos_caja_venta on movimientos_caja (venta_id) where venta_id is not null;

-- Historial de la numeración de ventas (Administración → Numeración).
create table numeracion_cambios (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  prefijo_antes text not null,
  siguiente_antes integer not null,
  prefijo text not null,
  siguiente integer not null,
  creado_por uuid references miembros(id) on delete set null,
  created_at timestamptz not null default now()
);
create index numeracion_cambios_negocio on numeracion_cambios (negocio_id, created_at desc);

-- El buzón ya guardaba venta_id (comprobantes): ahora apunta a la venta.
alter table avisos_demo
  add constraint avisos_demo_venta_id_fkey foreign key (venta_id) references ventas(id) on delete cascade;
create index avisos_demo_venta on avisos_demo (venta_id) where venta_id is not null;

-- RLS ---------------------------------------------------------------------------------------------------------
alter table metodos_pago enable row level security;
alter table ventas enable row level security;
alter table venta_items enable row level security;
alter table pagos enable row level security;
alter table movimientos_caja enable row level security;
alter table numeracion_cambios enable row level security;

create policy "dueno y recepcion leen" on metodos_pago for select to authenticated
  using (negocio_id = mi_negocio() and mi_rol() in ('dueno', 'recepcion'));
create policy "dueno escribe" on metodos_pago for all to authenticated
  using (negocio_id = mi_negocio() and mi_rol() = 'dueno')
  with check (negocio_id = mi_negocio() and mi_rol() = 'dueno');

-- Ventas y pagos: los ven dueño y recepción (el profesional no cobra ni ve ventas). Se escriben solo por funciones.
create policy "dueno y recepcion leen" on ventas for select to authenticated
  using (negocio_id = mi_negocio() and mi_rol() in ('dueno', 'recepcion'));
create policy "dueno y recepcion leen" on venta_items for select to authenticated
  using (exists (select 1 from ventas v where v.id = venta_id and v.negocio_id = mi_negocio())
         and mi_rol() in ('dueno', 'recepcion'));
create policy "dueno y recepcion leen" on pagos for select to authenticated
  using (negocio_id = mi_negocio() and mi_rol() in ('dueno', 'recepcion'));

-- Caja y numeración: solo el dueño (TECH-SPEC §6.2).
create policy "dueno lee" on movimientos_caja for select to authenticated
  using (negocio_id = mi_negocio() and mi_rol() = 'dueno');
create policy "dueno lee" on numeracion_cambios for select to authenticated
  using (negocio_id = mi_negocio() and mi_rol() = 'dueno');

revoke all on metodos_pago, ventas, venta_items, pagos, movimientos_caja, numeracion_cambios from anon, authenticated;
grant select on ventas, venta_items, pagos, movimientos_caja, numeracion_cambios to authenticated;
grant select, insert, update on metodos_pago to authenticated;
grant all on metodos_pago, ventas, venta_items, pagos, movimientos_caja, numeracion_cambios to service_role;

-- Funciones internas ------------------------------------------------------------------------------------------
create or replace function public.error_venta(p_code text, p_message text, p_field text default null)
returns jsonb
language sql immutable set search_path = public as $$
  select jsonb_build_object('ok', false, 'error',
    jsonb_strip_nulls(jsonb_build_object('code', p_code, 'message', p_message, 'field', p_field)));
$$;

-- Revisa los pagos contra lo que falta por pagar. Devuelve {ok, suma, vuelto} o el error para mostrar.
-- Cada pago: {metodoId, monto, recibido?, comprobante?}; el efectivo necesita recibido ≥ monto.
create or replace function public.revisar_pagos(p_negocio uuid, p_pagos jsonb, p_saldo int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_pago jsonb;
  v_metodo metodos_pago;
  v_monto int;
  v_recibido int;
  v_suma int := 0;
  v_vuelto int := 0;
begin
  if jsonb_typeof(p_pagos) <> 'array' or jsonb_array_length(p_pagos) > 5 then
    return error_venta('VALIDACION', 'Usa hasta 5 métodos de pago', 'pagos');
  end if;
  if p_saldo > 0 and jsonb_array_length(p_pagos) = 0 then
    return error_venta('VALIDACION', 'Elige cómo paga el cliente', 'pagos');
  end if;
  for v_pago in select * from jsonb_array_elements(p_pagos) loop
    select * into v_metodo from metodos_pago
     where id = nullif(v_pago->>'metodoId', '')::uuid and negocio_id = p_negocio and activo;
    if not found then
      return error_venta('VALIDACION', 'Ese método de pago no está disponible', 'pagos');
    end if;
    v_monto := (v_pago->>'monto')::int;
    if v_monto is null or v_monto <= 0 then
      return error_venta('VALIDACION', 'Escribe un monto mayor a cero', 'monto');
    end if;
    if v_metodo.tipo = 'efectivo' then
      v_recibido := coalesce((v_pago->>'recibido')::int, v_monto);
      if v_recibido < v_monto then
        return error_venta('VALIDACION', 'El monto recibido no alcanza', 'recibido');
      end if;
      v_vuelto := v_vuelto + v_recibido - v_monto;
    end if;
    v_suma := v_suma + v_monto;
  end loop;
  if v_suma > p_saldo then
    return error_venta('PAGOS_SUPERAN', 'Los pagos superan el total', 'pagos');
  end if;
  return jsonb_build_object('ok', true, 'suma', v_suma, 'vuelto', v_vuelto);
end;
$$;

-- Guarda los pagos ya revisados y su movimiento de caja (si la caja está activa).
create or replace function public.insertar_pagos(p_venta ventas, p_pagos jsonb, p_abono boolean, p_miembro uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_pago jsonb;
  v_metodo metodos_pago;
  v_id uuid;
  v_caja boolean;
begin
  select caja_activa into v_caja from ajustes where negocio_id = p_venta.negocio_id;
  for v_pago in select * from jsonb_array_elements(p_pagos) loop
    select * into v_metodo from metodos_pago where id = (v_pago->>'metodoId')::uuid;
    insert into pagos (negocio_id, venta_id, metodo_id, monto, recibido, comprobante, abono, creado_por)
    values (p_venta.negocio_id, p_venta.id, v_metodo.id, (v_pago->>'monto')::int,
            case when v_metodo.tipo = 'efectivo'
                 then coalesce((v_pago->>'recibido')::int, (v_pago->>'monto')::int) end,
            nullif(left(trim(v_pago->>'comprobante'), 40), ''), p_abono, p_miembro)
    returning id into v_id;
    if v_caja then
      insert into movimientos_caja (negocio_id, local_id, tipo, monto, efectivo, concepto, metodo, pago_id, venta_id,
                                    creado_por)
      values (p_venta.negocio_id, p_venta.local_id, 'ingreso', (v_pago->>'monto')::int, v_metodo.tipo = 'efectivo',
              case when p_abono then 'Abono de la venta ' else 'Venta ' end || p_venta.numero, v_metodo.nombre, v_id,
              p_venta.id, p_miembro);
    end if;
  end loop;
end;
$$;

-- Funciones de la app -----------------------------------------------------------------------------------------
-- Cerrar venta (TECH-SPEC §5.2 CerrarVentaInput): toma el número siguiente, crea venta, ítems y pagos, y el
-- movimiento de caja, todo o nada. Un pago menor al total deja la venta en "parcial" (abono).
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
      v_desc_item := nullif(trim(v_item->>'descripcion'), '');
      if v_desc_item is null then
        select nombre into v_desc_item from servicios where id = nullif(v_item->>'servicioId', '')::uuid;
      end if;
      insert into venta_items (venta_id, servicio_id, cita_id, profesional_id, descripcion, cantidad,
                               precio_unitario, total)
      values (v_venta.id, nullif(v_item->>'servicioId', '')::uuid, nullif(v_item->>'citaId', '')::uuid,
              nullif(v_item->>'profesionalId', '')::uuid, left(coalesce(v_desc_item, 'Ítem'), 120),
              coalesce((v_item->>'cantidad')::int, 1), (v_item->>'precioUnitario')::int,
              coalesce((v_item->>'cantidad')::int, 1) * (v_item->>'precioUnitario')::int);
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

-- Pagar el saldo de una venta en "Pago parcial": completa la misma venta, no crea otra.
create or replace function public.pagar_saldo(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_negocio uuid := mi_negocio();
  v_venta ventas;
  v_pagos jsonb := coalesce(p->'pagos', '[]'::jsonb);
  v_rev jsonb;
  v_miembro uuid;
begin
  if mi_rol() is null or mi_rol() not in ('dueno', 'recepcion') then
    return error_venta('SIN_PERMISO', 'Tu rol no puede cobrar');
  end if;
  select * into v_venta from ventas where id = nullif(p->>'ventaId', '')::uuid and negocio_id = v_negocio for update;
  if not found then
    return error_venta('NO_ENCONTRADA', 'La venta ya no existe');
  end if;
  if v_venta.estado = 'anulada' then
    return error_venta('VALIDACION', 'Esta venta está anulada');
  end if;
  if v_venta.estado = 'pagada' then
    return error_venta('VALIDACION', 'Esta venta ya está pagada');
  end if;
  v_rev := revisar_pagos(v_negocio, v_pagos, v_venta.total - v_venta.pagado);
  if not (v_rev->>'ok')::boolean then return v_rev; end if;

  select id into v_miembro from miembros where user_id = auth.uid();
  perform insertar_pagos(v_venta, v_pagos, true, v_miembro);
  update ventas set pagado = pagado + (v_rev->>'suma')::int,
                    estado = case when pagado + (v_rev->>'suma')::int = total then 'pagada' else 'parcial' end::estado_venta
   where id = v_venta.id
   returning * into v_venta;
  update citas set updated_at = now()
   where id in (select cita_id from venta_items where venta_id = v_venta.id and cita_id is not null);
  return jsonb_build_object('ok', true, 'ventaId', v_venta.id, 'numero', v_venta.numero,
    'vuelto', (v_rev->>'vuelto')::int, 'estado', v_venta.estado, 'total', v_venta.total, 'pagado', v_venta.pagado);
end;
$$;

-- Anular: la venta queda con su historia, la cita vuelve a Mis cobros y la caja registra la devolución.
create or replace function public.anular_venta(p_venta uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_negocio uuid := mi_negocio();
  v_venta ventas;
  v_miembro uuid;
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

-- Comprobante al buzón de la demo (correo y WhatsApp del cliente).
create or replace function public.enviar_comprobante(p_venta uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v record;
  v_detalle text;
  v_pagos text;
  v_cuerpo text;
  v_canal canal_aviso;
  v_destino text;
begin
  if mi_rol() is null or mi_rol() not in ('dueno', 'recepcion') then
    return error_venta('SIN_PERMISO', 'Tu rol no puede enviar comprobantes');
  end if;
  select ve.*, cl.nombre as c_nombre, cl.apellido as c_apellido, cl.correo as c_correo, cl.telefono as c_telefono,
         n.nombre as negocio
    into v
    from ventas ve join negocios n on n.id = ve.negocio_id left join clientes cl on cl.id = ve.cliente_id
   where ve.id = p_venta and ve.negocio_id = mi_negocio();
  if not found then
    return error_venta('NO_ENCONTRADA', 'La venta ya no existe');
  end if;
  if v.cliente_id is null then
    return error_venta('VALIDACION', 'La venta no tiene cliente a quien enviarla');
  end if;
  if v.estado = 'anulada' then
    return error_venta('VALIDACION', 'Una venta anulada no tiene comprobante');
  end if;
  select string_agg(format('%s%s %s', vi.descripcion, case when vi.cantidad > 1 then ' x' || vi.cantidad else '' end,
                           pesos_texto(vi.total)), '; ' order by vi.descripcion)
    into v_detalle from venta_items vi where vi.venta_id = v.id;
  select string_agg(format('%s %s', pesos_texto(pa.monto), m.nombre), ', ' order by pa.created_at)
    into v_pagos from pagos pa join metodos_pago m on m.id = pa.metodo_id where pa.venta_id = v.id;
  v_cuerpo := format('Hola %s, gracias por tu compra en %s. Venta %s del %s: %s.%s Total %s. Pagaste %s%s.',
    v.c_nombre, v.negocio, v.numero, fecha_larga((v.created_at at time zone 'America/Bogota')::date), v_detalle,
    case when v.descuento > 0 then ' Descuento ' || pesos_texto(v.descuento) || '.' else '' end,
    pesos_texto(v.total), coalesce(v_pagos, pesos_texto(0)),
    case when v.total > v.pagado then '. Saldo pendiente ' || pesos_texto(v.total - v.pagado) else '' end);

  foreach v_canal in array array['correo', 'whatsapp']::canal_aviso[] loop
    v_destino := case v_canal when 'correo' then v.c_correo else v.c_telefono end;
    insert into avisos_demo (negocio_id, venta_id, canal, tipo, destinatario, destino, asunto, cuerpo, estado)
    values (v.negocio_id, v.id, v_canal, 'comprobante', v.c_nombre || ' ' || v.c_apellido, v_destino,
            case v_canal when 'correo' then format('Comprobante de la venta %s en %s', v.numero, v.negocio) end,
            v_cuerpo, case when v_destino is null then 'sin_contacto' else 'enviado' end);
  end loop;
  return jsonb_build_object('ok', true, 'sinContacto', v.c_correo is null and v.c_telefono is null);
end;
$$;

-- $45.000 (pesos sin decimales, con punto de miles).
create or replace function public.pesos_texto(p int) returns text
language sql immutable set search_path = public as $$
  select '$' || replace(to_char(p, 'FM999,999,999,990'), ',', '.');
$$;

-- Caja: ingreso, egreso o traspaso (el traspaso saca efectivo de la caja hacia el banco).
create or replace function public.registrar_movimiento(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_negocio uuid := mi_negocio();
  v_local uuid := nullif(p->>'localId', '')::uuid;
  v_tipo text := p->>'tipo';
  v_monto int := (p->>'monto')::int;
  v_concepto text := trim(coalesce(p->>'concepto', ''));
  v_efectivo boolean := coalesce((p->>'efectivo')::boolean, true);
  v_miembro uuid;
begin
  if mi_rol() is distinct from 'dueno' then
    return error_venta('SIN_PERMISO', 'Solo el dueño mueve la caja');
  end if;
  if not exists (select 1 from locales where id = v_local and negocio_id = v_negocio) then
    return error_venta('VALIDACION', 'Elige el local', 'localId');
  end if;
  if v_tipo is null or v_tipo not in ('ingreso', 'egreso', 'traspaso') then
    return error_venta('VALIDACION', 'Elige el tipo de movimiento', 'tipo');
  end if;
  if v_monto is null or v_monto <= 0 or v_monto > 100000000 then
    return error_venta('VALIDACION', 'Escribe un monto mayor a cero', 'monto');
  end if;
  if char_length(v_concepto) not between 2 and 120 then
    return error_venta('VALIDACION', 'Escribe el concepto', 'concepto');
  end if;
  select id into v_miembro from miembros where user_id = auth.uid();
  insert into movimientos_caja (negocio_id, local_id, tipo, monto, efectivo, concepto, creado_por)
  values (v_negocio, v_local, v_tipo::tipo_movimiento, case when v_tipo = 'ingreso' then v_monto else -v_monto end,
          v_tipo = 'traspaso' or v_efectivo, v_concepto, v_miembro);
  return jsonb_build_object('ok', true);
end;
$$;

-- Rectificar: se cuenta el efectivo y se registra la diferencia con su signo (sobrante + / faltante −).
create or replace function public.rectificar_caja(p_local uuid, p_contado int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_negocio uuid := mi_negocio();
  v_esperado int;
  v_diferencia int;
  v_miembro uuid;
begin
  if mi_rol() is distinct from 'dueno' then
    return error_venta('SIN_PERMISO', 'Solo el dueño rectifica la caja');
  end if;
  if not exists (select 1 from locales where id = p_local and negocio_id = v_negocio) then
    return error_venta('VALIDACION', 'Elige el local', 'localId');
  end if;
  if p_contado is null or p_contado < 0 or p_contado > 100000000 then
    return error_venta('VALIDACION', 'Escribe el efectivo que contaste', 'contado');
  end if;
  -- En fila con los cobros (mismo candado que cerrar_venta), para que la cuenta no cambie mientras se registra.
  perform 1 from ajustes where negocio_id = v_negocio for update;
  select coalesce(sum(monto), 0) into v_esperado from movimientos_caja where local_id = p_local and efectivo;
  v_diferencia := p_contado - v_esperado;
  select id into v_miembro from miembros where user_id = auth.uid();
  insert into movimientos_caja (negocio_id, local_id, tipo, monto, efectivo, concepto, contado, creado_por)
  values (v_negocio, p_local, 'rectificacion', v_diferencia, true,
          case when v_diferencia > 0 then 'Sobrante al contar el efectivo'
               when v_diferencia < 0 then 'Faltante al contar el efectivo'
               else 'Caja cuadrada: sin diferencia' end,
          p_contado, v_miembro);
  return jsonb_build_object('ok', true, 'esperado', v_esperado, 'contado', p_contado, 'diferencia', v_diferencia);
end;
$$;

-- Numeración: prefijo opcional (letras o guion al final, para que "F1"+"1" no choque con "F"+"11") y el número
-- siguiente, que nunca baja de lo ya usado con ese prefijo.
create or replace function public.ajustar_numeracion(p_prefijo text, p_siguiente int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_negocio uuid := mi_negocio();
  a ajustes;
  v_prefijo text := upper(trim(coalesce(p_prefijo, '')));
  v_ultimo int;
  v_miembro uuid;
begin
  if mi_rol() is distinct from 'dueno' then
    return error_venta('SIN_PERMISO', 'Solo el dueño cambia la numeración');
  end if;
  if char_length(v_prefijo) > 6 or v_prefijo !~ '^([A-Z0-9-]*[A-Z-])?$' then
    return error_venta('VALIDACION', 'El prefijo lleva hasta 6 letras, números o guion, y termina en letra o guion',
                       'prefijo');
  end if;
  if p_siguiente is null or p_siguiente < 1 or p_siguiente > 99999999 then
    return error_venta('VALIDACION', 'Escribe un número entre 1 y 99.999.999', 'siguiente');
  end if;
  select * into a from ajustes where negocio_id = v_negocio for update;
  select max(correlativo) into v_ultimo from ventas where negocio_id = v_negocio and prefijo = v_prefijo;
  if (v_prefijo = a.venta_prefijo and p_siguiente < a.venta_siguiente) or p_siguiente <= coalesce(v_ultimo, 0) then
    return error_venta('VALIDACION', format('El número debe ser mayor al último usado (%s)',
                       v_prefijo || greatest(coalesce(v_ultimo, 0),
                         case when v_prefijo = a.venta_prefijo then a.venta_siguiente - 1 else 0 end)), 'siguiente');
  end if;
  if v_prefijo = a.venta_prefijo and p_siguiente = a.venta_siguiente then
    return jsonb_build_object('ok', true, 'sinCambios', true);
  end if;
  select id into v_miembro from miembros where user_id = auth.uid();
  insert into numeracion_cambios (negocio_id, prefijo_antes, siguiente_antes, prefijo, siguiente, creado_por)
  values (v_negocio, a.venta_prefijo, a.venta_siguiente, v_prefijo, p_siguiente, v_miembro);
  update ajustes set venta_prefijo = v_prefijo, venta_siguiente = p_siguiente where negocio_id = v_negocio;
  return jsonb_build_object('ok', true);
end;
$$;

-- Mis cobros: citas atendidas (o no asistidas) sin venta y ventas con saldo, en un período. Respeta RLS.
create or replace function public.cobros_pendientes(p_desde date, p_hasta date, p_profesional uuid default null)
returns table (
  tipo text, cita_id uuid, venta_id uuid, numero text, fecha date, hora time, cliente_id uuid, cliente_nombre text,
  descripcion text, profesional_id uuid, estado text, monto integer, total integer
)
language sql stable set search_path = public as $$
  select 'cita', c.id, null::uuid, null::text, c.fecha, c.hora_inicio, c.cliente_id, cl.nombre || ' ' || cl.apellido,
         s.nombre, c.profesional_id, c.estado::text, c.precio, c.precio
    from citas c join clientes cl on cl.id = c.cliente_id join servicios s on s.id = c.servicio_id
   where c.negocio_id = mi_negocio() and mi_rol() in ('dueno', 'recepcion')
     and c.estado in ('asiste', 'no_asistio') and c.fecha between p_desde and p_hasta
     and (p_profesional is null or c.profesional_id = p_profesional)
     and not exists (select 1 from venta_items vi where vi.cita_id = c.id and vi.vigente)
  union all
  select 'saldo', null, v.id, v.numero, (v.created_at at time zone 'America/Bogota')::date,
         (v.created_at at time zone 'America/Bogota')::time, v.cliente_id,
         coalesce(cl.nombre || ' ' || cl.apellido, 'Sin cliente'),
         (select string_agg(vi.descripcion, ', ' order by vi.descripcion) from venta_items vi where vi.venta_id = v.id),
         (select vi.profesional_id from venta_items vi where vi.venta_id = v.id and vi.profesional_id is not null limit 1),
         'parcial', v.total - v.pagado, v.total
    from ventas v left join clientes cl on cl.id = v.cliente_id
   where v.negocio_id = mi_negocio() and mi_rol() in ('dueno', 'recepcion') and v.estado = 'parcial'
     and (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta
     and (p_profesional is null
          or exists (select 1 from venta_items vi where vi.venta_id = v.id and vi.profesional_id = p_profesional))
  order by 5 desc, 6 desc;
$$;

-- Base de clientes con filtros avanzados, orden y página (respeta RLS: solo dueño y recepción ven clientes).
-- p: {texto, profesionalId, servicioId, estado, genero, cumpleDesde, cumpleHasta, creadoDesde, creadoHasta,
--     haReservado, orden, dir, limite, pagina}
create or replace function public.listar_clientes(p jsonb)
returns table (id uuid, nombre text, apellido text, correo text, telefono text, documento text, total bigint)
language sql stable set search_path = public as $$
  with f as (
    select nullif(trim(p->>'texto'), '') as texto,
           nullif(regexp_replace(coalesce(p->>'texto', ''), '\D', '', 'g'), '') as digitos,
           nullif(p->>'profesionalId', '')::uuid as profesional,
           nullif(p->>'servicioId', '')::uuid as servicio,
           nullif(p->>'estado', '')::estado_cita as estado,
           nullif(p->>'genero', '') as genero,
           to_char(nullif(p->>'cumpleDesde', '')::date, 'MM-DD') as cumple_desde,
           to_char(nullif(p->>'cumpleHasta', '')::date, 'MM-DD') as cumple_hasta,
           nullif(p->>'creadoDesde', '')::date as creado_desde,
           nullif(p->>'creadoHasta', '')::date as creado_hasta,
           nullif(p->>'haReservado', '')::boolean as ha_reservado,
           coalesce(nullif(p->>'orden', ''), 'apellido') as orden,
           coalesce(nullif(p->>'dir', ''), 'asc') as dir,
           least(greatest(coalesce((p->>'limite')::int, 25), 1), 100) as limite,
           greatest(coalesce((p->>'pagina')::int, 1), 1) as pagina
  )
  select c.id, c.nombre, c.apellido, c.correo, c.telefono, c.documento, count(*) over ()
    from clientes c, f
   where c.negocio_id = mi_negocio()
     and (f.texto is null
          or (c.nombre || ' ' || c.apellido) ilike '%' || f.texto || '%'
          or (c.apellido || ' ' || c.nombre) ilike '%' || f.texto || '%'
          or c.documento ilike f.texto || '%'
          or c.correo ilike '%' || f.texto || '%'
          or (length(f.digitos) >= 4 and c.telefono like '%' || f.digitos || '%'))
     and (f.genero is null or c.genero = f.genero)
     and (f.creado_desde is null or (c.created_at at time zone 'America/Bogota')::date >= f.creado_desde)
     and (f.creado_hasta is null or (c.created_at at time zone 'America/Bogota')::date <= f.creado_hasta)
     and (f.cumple_desde is null or f.cumple_hasta is null or (c.fecha_nacimiento is not null and (
            case when f.cumple_desde <= f.cumple_hasta
                 then to_char(c.fecha_nacimiento, 'MM-DD') between f.cumple_desde and f.cumple_hasta
                 else to_char(c.fecha_nacimiento, 'MM-DD') >= f.cumple_desde
                   or to_char(c.fecha_nacimiento, 'MM-DD') <= f.cumple_hasta end)))
     and (f.profesional is null and f.servicio is null and f.estado is null
          or exists (select 1 from citas ci
                      where ci.cliente_id = c.id
                        and (f.profesional is null or ci.profesional_id = f.profesional)
                        and (f.servicio is null or ci.servicio_id = f.servicio)
                        and (f.estado is null or ci.estado = f.estado)))
     and (f.ha_reservado is null
          or f.ha_reservado = exists (select 1 from citas ci where ci.cliente_id = c.id and ci.estado <> 'cancelado'))
   order by
     case when f.dir = 'asc' then case f.orden when 'nombre' then lower(c.nombre) when 'correo' then lower(c.correo)
          when 'telefono' then c.telefono when 'documento' then c.documento else lower(c.apellido) end end asc nulls last,
     case when f.dir = 'desc' then case f.orden when 'nombre' then lower(c.nombre) when 'correo' then lower(c.correo)
          when 'telefono' then c.telefono when 'documento' then c.documento else lower(c.apellido) end end desc nulls last,
     lower(c.apellido), lower(c.nombre), c.id
   limit (select limite from f) offset (select (pagina - 1) * limite from f);
$$;

-- Listados de Ventas y Caja (respetan RLS: dueño y recepción ven ventas y pagos; solo el dueño ve la caja) ----------
-- p: {desde, hasta (fechas de Bogotá), metodoId, texto (número o cliente), estado, tipo, limite, pagina}
-- El estado (o el tipo) se aplica después para que las tarjetas de arriba cuenten todo el período.
create or replace function public.ventas_filtradas(p jsonb) returns setof ventas
language sql stable set search_path = public as $$
  select v.* from ventas v left join clientes cl on cl.id = v.cliente_id
   where v.negocio_id = mi_negocio()
     and (nullif(p->>'desde', '') is null
          or (v.created_at at time zone 'America/Bogota')::date >= (p->>'desde')::date)
     and (nullif(p->>'hasta', '') is null
          or (v.created_at at time zone 'America/Bogota')::date <= (p->>'hasta')::date)
     and (nullif(p->>'metodoId', '') is null
          or exists (select 1 from pagos pa where pa.venta_id = v.id and pa.metodo_id = (p->>'metodoId')::uuid))
     and (nullif(trim(p->>'texto'), '') is null
          or v.numero ilike trim(p->>'texto') || '%'
          or (cl.nombre || ' ' || cl.apellido) ilike '%' || trim(p->>'texto') || '%');
$$;

create or replace function public.listar_ventas(p jsonb)
returns table (id uuid, numero text, created_at timestamptz, total integer, pagado integer, estado estado_venta,
               cliente_id uuid, cliente_nombre text, metodos text, filas bigint)
language sql stable set search_path = public as $$
  with f as (select least(greatest(coalesce((p->>'limite')::int, 25), 1), 100) as limite,
                    greatest(coalesce((p->>'pagina')::int, 1), 1) as pagina)
  select v.id, v.numero, v.created_at, v.total, v.pagado, v.estado, v.cliente_id,
         coalesce(cl.nombre || ' ' || cl.apellido, 'Sin cliente'),
         (select string_agg(distinct m.nombre, ', ') from pagos pa join metodos_pago m on m.id = pa.metodo_id
           where pa.venta_id = v.id),
         count(*) over ()
    from ventas_filtradas(p) v left join clientes cl on cl.id = v.cliente_id
   where nullif(p->>'estado', '') is null or v.estado::text = p->>'estado'
   order by v.created_at desc, v.correlativo desc
   limit (select limite from f) offset (select (pagina - 1) * limite from f);
$$;

-- Tarjetas de Detalle de ventas: todas (lo vendido, sin anuladas), pagos parciales (lo que falta) y anuladas.
create or replace function public.resumen_ventas(p jsonb) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'todas', jsonb_build_object('n', count(*), 'monto', coalesce(sum(total) filter (where estado <> 'anulada'), 0)),
    'parciales', jsonb_build_object('n', count(*) filter (where estado = 'parcial'),
                                    'monto', coalesce(sum(total - pagado) filter (where estado = 'parcial'), 0)),
    'anuladas', jsonb_build_object('n', count(*) filter (where estado = 'anulada'),
                                   'monto', coalesce(sum(total) filter (where estado = 'anulada'), 0)))
    from ventas_filtradas(p);
$$;

-- Transacciones: cada pago recibido. tipo: '' (todas), 'abonos' o 'anuladas' (pagos de ventas anuladas).
create or replace function public.pagos_filtrados(p jsonb)
returns table (id uuid, created_at timestamptz, comprobante text, monto integer, propina integer, metodo text,
               metodo_tipo text, venta_id uuid, venta_numero text, venta_estado estado_venta, abono boolean,
               cliente_nombre text)
language sql stable set search_path = public as $$
  select pa.id, pa.created_at, pa.comprobante, pa.monto, pa.propina, m.nombre, m.tipo, v.id, v.numero, v.estado,
         pa.abono, coalesce(cl.nombre || ' ' || cl.apellido, 'Sin cliente')
    from pagos pa join ventas v on v.id = pa.venta_id join metodos_pago m on m.id = pa.metodo_id
    left join clientes cl on cl.id = v.cliente_id
   where pa.negocio_id = mi_negocio()
     and (nullif(p->>'desde', '') is null
          or (pa.created_at at time zone 'America/Bogota')::date >= (p->>'desde')::date)
     and (nullif(p->>'hasta', '') is null
          or (pa.created_at at time zone 'America/Bogota')::date <= (p->>'hasta')::date)
     and (nullif(p->>'metodoId', '') is null or pa.metodo_id = (p->>'metodoId')::uuid)
     and (nullif(trim(p->>'texto'), '') is null
          or v.numero ilike trim(p->>'texto') || '%'
          or pa.comprobante ilike trim(p->>'texto') || '%'
          or (cl.nombre || ' ' || cl.apellido) ilike '%' || trim(p->>'texto') || '%');
$$;

create or replace function public.listar_pagos(p jsonb)
returns table (id uuid, created_at timestamptz, comprobante text, monto integer, propina integer, metodo text,
               venta_id uuid, venta_numero text, venta_estado estado_venta, abono boolean, cliente_nombre text,
               filas bigint)
language sql stable set search_path = public as $$
  with f as (select least(greatest(coalesce((p->>'limite')::int, 25), 1), 100) as limite,
                    greatest(coalesce((p->>'pagina')::int, 1), 1) as pagina)
  select x.id, x.created_at, x.comprobante, x.monto, x.propina, x.metodo, x.venta_id, x.venta_numero,
         x.venta_estado, x.abono, x.cliente_nombre, count(*) over ()
    from pagos_filtrados(p) x
   where nullif(p->>'tipo', '') is null
      or (p->>'tipo' = 'abonos' and x.abono)
      or (p->>'tipo' = 'anuladas' and x.venta_estado = 'anulada')
   order by x.created_at desc
   limit (select limite from f) offset (select (pagina - 1) * limite from f);
$$;

-- Tarjetas y dona de Transacciones (la dona no cuenta los pagos de ventas anuladas).
create or replace function public.resumen_pagos(p jsonb) returns jsonb
language sql stable set search_path = public as $$
  with x as (select * from pagos_filtrados(p))
  select jsonb_build_object(
    'todas', jsonb_build_object('n', (select count(*) from x), 'monto', (select coalesce(sum(monto), 0) from x)),
    'abonos', jsonb_build_object('n', (select count(*) from x where abono),
                                 'monto', (select coalesce(sum(monto), 0) from x where abono)),
    'anuladas', jsonb_build_object('n', (select count(*) from x where venta_estado = 'anulada'),
                                   'monto', (select coalesce(sum(monto), 0) from x where venta_estado = 'anulada')),
    'metodos', coalesce((select jsonb_agg(jsonb_build_object('nombre', metodo, 'tipo', metodo_tipo, 'monto', s, 'n', n)
                                          order by s desc)
                           from (select metodo, metodo_tipo, sum(monto) s, count(*) n from x
                                  where venta_estado <> 'anulada' group by metodo, metodo_tipo) t), '[]'::jsonb));
$$;

-- Caja: efectivo en caja (desde siempre) y la cuenta del período por tipo de movimiento.
create or replace function public.resumen_caja(p_local uuid, p_desde date, p_hasta date) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'efectivoEnCaja', (select coalesce(sum(monto), 0) from movimientos_caja where local_id = p_local and efectivo),
    'ventas', coalesce(sum(m.monto) filter (where m.tipo = 'ingreso' and m.pago_id is not null and not pa.abono), 0),
    'abonos', coalesce(sum(m.monto) filter (where m.tipo = 'ingreso' and pa.abono), 0),
    'ingresos', coalesce(sum(m.monto) filter (where m.tipo = 'ingreso' and m.pago_id is null), 0),
    'egresos', coalesce(sum(m.monto) filter (where m.tipo = 'egreso'), 0),
    'traspasos', coalesce(sum(m.monto) filter (where m.tipo = 'traspaso'), 0),
    'rectificaciones', coalesce(sum(m.monto) filter (where m.tipo = 'rectificacion'), 0),
    'resultado', coalesce(sum(m.monto), 0),
    'efectivoPeriodo', coalesce(sum(m.monto) filter (where m.efectivo), 0))
    from movimientos_caja m left join pagos pa on pa.id = m.pago_id
   where m.local_id = p_local
     and (m.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta;
$$;

-- La agenda trae si la cita ya se cobró ("$" verde) o tiene saldo. Cambia el tipo de salida: se borra y se crea.
drop function public.agenda_citas(uuid, date, date);
create function public.agenda_citas(p_local uuid, p_desde date, p_hasta date)
returns table (
  id uuid, profesional_id uuid, servicio_id uuid, cliente_id uuid,
  cliente_nombre text, cliente_telefono text, cliente_correo text, servicio_nombre text,
  fecha date, hora_inicio time, hora_fin time, duracion_min smallint,
  estado estado_cita, origen origen_cita, precio integer,
  nota_cliente text, nota_interna text, serie_id uuid, profesional_fijo boolean,
  aviso_correo boolean, aviso_whatsapp boolean, cliente_desde timestamptz, motivo_cancelacion text,
  venta_id uuid, venta_estado text
)
language sql stable security definer set search_path = public as $$
  select c.id, c.profesional_id, c.servicio_id, c.cliente_id,
         cl.nombre || ' ' || cl.apellido,
         case when mi_rol() = 'profesional' then null else cl.telefono end,
         case when mi_rol() = 'profesional' then null else cl.correo end,
         s.nombre,
         c.fecha, c.hora_inicio, c.hora_fin, c.duracion_min, c.estado, c.origen, c.precio,
         c.nota_cliente, case when mi_rol() = 'profesional' then null else c.nota_interna end,
         c.serie_id, c.profesional_fijo, c.aviso_correo, c.aviso_whatsapp,
         cl.created_at, c.motivo_cancelacion, vt.id, vt.estado::text
    from citas c
    join clientes cl on cl.id = c.cliente_id
    join servicios s on s.id = c.servicio_id
    left join lateral (select v.id, v.estado from venta_items vi join ventas v on v.id = vi.venta_id
                        where vi.cita_id = c.id and vi.vigente limit 1) vt on true
   where c.negocio_id = mi_negocio()
     and c.local_id = p_local
     and c.fecha between p_desde and p_hasta
     and (mi_rol() in ('dueno','recepcion') or c.profesional_id = mi_profesional())
   order by c.fecha, c.hora_inicio;
$$;

-- Permisos de ejecución ---------------------------------------------------------------------------------------
revoke all on function public.error_venta(text, text, text), public.revisar_pagos(uuid, jsonb, int),
  public.insertar_pagos(ventas, jsonb, boolean, uuid), public.pesos_texto(int)
  from public, anon, authenticated;
revoke all on function public.cerrar_venta(jsonb), public.pagar_saldo(jsonb), public.anular_venta(uuid, text),
  public.enviar_comprobante(uuid), public.registrar_movimiento(jsonb), public.rectificar_caja(uuid, int),
  public.ajustar_numeracion(text, int), public.cobros_pendientes(date, date, uuid), public.listar_clientes(jsonb),
  public.agenda_citas(uuid, date, date), public.ventas_filtradas(jsonb), public.listar_ventas(jsonb),
  public.resumen_ventas(jsonb), public.pagos_filtrados(jsonb), public.listar_pagos(jsonb),
  public.resumen_pagos(jsonb), public.resumen_caja(uuid, date, date)
  from public, anon;
grant execute on function public.cerrar_venta(jsonb), public.pagar_saldo(jsonb), public.anular_venta(uuid, text),
  public.enviar_comprobante(uuid), public.registrar_movimiento(jsonb), public.rectificar_caja(uuid, int),
  public.ajustar_numeracion(text, int), public.cobros_pendientes(date, date, uuid), public.listar_clientes(jsonb),
  public.agenda_citas(uuid, date, date), public.ventas_filtradas(jsonb), public.listar_ventas(jsonb),
  public.resumen_ventas(jsonb), public.pagos_filtrados(jsonb), public.listar_pagos(jsonb),
  public.resumen_pagos(jsonb), public.resumen_caja(uuid, date, date)
  to authenticated;
