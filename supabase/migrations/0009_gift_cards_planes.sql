-- 0009_gift_cards_planes.sql — Gift cards (catálogo, venta, saldo y canje), planes y membresías, servicios con
-- sesiones y paquetes (Fase 8). Lo que se vende y queda a nombre del cliente (plan, sesiones, paquete) es un
-- "bono": tiene cupo de citas y vencimiento, y cada cita que lo usa queda en $0 con citas.bono_id. Las citas
-- usadas se cuentan (las canceladas no), así que cancelar devuelve el cupo sin llevar contadores.
-- Todo se escribe por funciones (cerrar_venta, usar_bono, …); la app solo lee (RLS). anon no tiene nada.

-- Catálogo de gift cards (Administración → Gift cards): lo que se carga y lo que paga quien la compra.
create table gift_card_modelos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 2 and 60),
  monto integer not null check (monto between 1000 and 10000000),
  precio integer not null check (precio between 0 and 10000000),
  vigencia_dias smallint not null default 365 check (vigencia_dias between 30 and 730),
  color text not null default 'laguna' check (color in ('laguna', 'coral', 'violeta', 'noche')),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (negocio_id, nombre)
);

-- Gift cards vendidas. El código se escribe en la caja para pagar con ella.
create table gift_cards (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  modelo_id uuid references gift_card_modelos(id) on delete set null,
  codigo text not null check (codigo ~ '^[A-Z2-9]{4}-[A-Z2-9]{4}$'),
  nombre text not null check (char_length(nombre) between 2 and 60),
  comprador_id uuid references clientes(id) on delete restrict,
  para text check (char_length(para) <= 80),
  saldo_inicial integer not null check (saldo_inicial > 0),
  saldo integer not null check (saldo >= 0 and saldo <= saldo_inicial),
  vence date not null,
  venta_id uuid references ventas(id) on delete cascade,
  anulada boolean not null default false,
  created_at timestamptz not null default now(),
  unique (negocio_id, codigo)
);
create index gift_cards_venta on gift_cards (venta_id) where venta_id is not null;

-- Planes y membresías que se venden (Administración → Planes). sesiones null = sin límite de citas; servicios
-- vacío = sirve para todos los servicios.
create table planes (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 2 and 60),
  descripcion text check (char_length(descripcion) <= 300),
  precio integer not null check (precio between 0 and 100000000),
  vigencia_dias smallint not null check (vigencia_dias between 7 and 730),
  sesiones smallint check (sesiones between 1 and 100),
  servicios uuid[] not null default '{}' check (cardinality(servicios) <= 30),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (negocio_id, nombre)
);

-- Variantes de servicio: con sesiones (N citas del mismo servicio), clase (con cupo; 0010) y paquete (varios
-- servicios juntos a un precio; se vende en la caja y se usa al agendar cada servicio incluido).
alter table servicios
  add column tipo text not null default 'servicio' check (tipo in ('servicio', 'sesiones', 'clase', 'paquete')),
  add column sesiones smallint check (sesiones between 2 and 50),
  add column vigencia_dias smallint check (vigencia_dias between 30 and 730),
  add column incluye uuid[] not null default '{}' check (cardinality(incluye) <= 6);
alter table servicios
  add constraint servicios_sesiones_tipo check ((tipo = 'sesiones') = (sesiones is not null)),
  add constraint servicios_paquete_tipo check ((tipo = 'paquete') = (cardinality(incluye) >= 2));

-- Lo que el cliente tiene comprado: un plan, unas sesiones o un paquete. servicios puede repetir un id (un
-- paquete con dos manicures); cupo null = sin límite.
create table bonos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete restrict,
  tipo text not null check (tipo in ('plan', 'sesiones', 'paquete')),
  plan_id uuid references planes(id) on delete set null,
  servicio_id uuid references servicios(id) on delete set null,
  nombre text not null check (char_length(nombre) between 2 and 80),
  servicios uuid[] not null default '{}',
  cupo smallint check (cupo between 1 and 100),
  inicio date not null,
  vence date not null,
  venta_id uuid references ventas(id) on delete cascade,
  anulado boolean not null default false,
  created_at timestamptz not null default now(),
  check (inicio <= vence)
);
create index bonos_cliente on bonos (cliente_id);
create index bonos_venta on bonos (venta_id) where venta_id is not null;

alter table citas add column bono_id uuid references bonos(id) on delete set null;
create index citas_bono on citas (bono_id) where bono_id is not null;

-- Qué se vendió en cada ítem (para el reporte y para anular).
alter table venta_items
  add column plan_id uuid references planes(id) on delete set null,
  add column gift_card_modelo_id uuid references gift_card_modelos(id) on delete set null;

-- Pagar con gift card: un método más; el pago dice qué tarjeta se usó.
alter table metodos_pago drop constraint metodos_pago_tipo_check;
alter table metodos_pago add constraint metodos_pago_tipo_check
  check (tipo in ('efectivo', 'transferencia', 'debito', 'credito', 'billetera', 'gift_card', 'otro'));
alter table pagos add column gift_card_id uuid references gift_cards(id) on delete restrict;
create index pagos_gift_card on pagos (gift_card_id) where gift_card_id is not null;

-- RLS ---------------------------------------------------------------------------------------------------------
alter table gift_card_modelos enable row level security;
alter table gift_cards enable row level security;
alter table planes enable row level security;
alter table bonos enable row level security;

-- Catálogos: los leen dueño y recepción (para vender); solo el dueño los cambia.
create policy "dueno y recepcion leen" on gift_card_modelos for select to authenticated
  using (negocio_id = mi_negocio() and mi_rol() in ('dueno', 'recepcion'));
create policy "dueno escribe" on gift_card_modelos for all to authenticated
  using (negocio_id = mi_negocio() and mi_rol() = 'dueno')
  with check (negocio_id = mi_negocio() and mi_rol() = 'dueno');
create policy "dueno y recepcion leen" on planes for select to authenticated
  using (negocio_id = mi_negocio() and mi_rol() in ('dueno', 'recepcion'));
create policy "dueno escribe" on planes for all to authenticated
  using (negocio_id = mi_negocio() and mi_rol() = 'dueno')
  with check (negocio_id = mi_negocio() and mi_rol() = 'dueno');
-- Lo vendido: lo leen dueño y recepción; se escribe solo por funciones.
create policy "dueno y recepcion leen" on gift_cards for select to authenticated
  using (negocio_id = mi_negocio() and mi_rol() in ('dueno', 'recepcion'));
create policy "dueno y recepcion leen" on bonos for select to authenticated
  using (negocio_id = mi_negocio() and mi_rol() in ('dueno', 'recepcion'));

revoke all on gift_card_modelos, gift_cards, planes, bonos from anon, authenticated;
grant select, insert, update, delete on gift_card_modelos, planes to authenticated;
grant select on gift_cards, bonos to authenticated;
grant all on gift_card_modelos, gift_cards, planes, bonos to service_role;

-- Funciones internas ------------------------------------------------------------------------------------------
create or replace function public.hoy_bogota() returns date
language sql stable set search_path = public as $$
  select (now() at time zone 'America/Bogota')::date;
$$;

-- Código de 8 caracteres sin letras que se confunden (sin I, O, 0, 1), único en el negocio.
create or replace function public.nuevo_codigo_gift_card(p_negocio uuid) returns text
language plpgsql volatile set search_path = public as $$
declare
  v_letras text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_codigo text;
begin
  loop
    select string_agg(substr(v_letras, 1 + floor(random() * 32)::int, 1), '') into v_codigo
      from generate_series(1, 8);
    v_codigo := substr(v_codigo, 1, 4) || '-' || substr(v_codigo, 5, 4);
    exit when not exists (select 1 from gift_cards where negocio_id = p_negocio and codigo = v_codigo);
  end loop;
  return v_codigo;
end;
$$;

-- Citas que ya usaron un bono (las canceladas devuelven el cupo).
create or replace function public.bono_usadas(p_bono uuid, p_servicio uuid default null) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from citas
   where bono_id = p_bono and estado <> 'cancelado' and (p_servicio is null or servicio_id = p_servicio);
$$;

-- Revisa si una cita puede usar un bono. Devuelve null si puede, o el mensaje de por qué no.
create or replace function public.bono_no_sirve(b bonos, c citas) returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if b.anulado then return 'Ese plan se anuló'; end if;
  if b.cliente_id <> c.cliente_id then return 'Ese plan es de otro cliente'; end if;
  if c.fecha < b.inicio or c.fecha > b.vence then
    return format('El plan vale del %s al %s', to_char(b.inicio, 'DD/MM/YYYY'), to_char(b.vence, 'DD/MM/YYYY'));
  end if;
  if cardinality(b.servicios) > 0 and not (c.servicio_id = any(b.servicios)) then
    return 'Ese servicio no está incluido en el plan';
  end if;
  if b.tipo = 'paquete' then
    if bono_usadas(b.id, c.servicio_id) >= (select count(*) from unnest(b.servicios) s where s = c.servicio_id) then
      return 'Ese servicio del paquete ya se usó';
    end if;
  elsif b.cupo is not null and bono_usadas(b.id) >= b.cupo then
    return format('El plan ya usó sus %s citas', b.cupo);
  end if;
  return null;
end;
$$;

-- Revisa los pagos (como en 0006) y además las gift cards: código válido, vigente y con saldo para lo que se
-- paga con ella (sumando si se usa dos veces en la misma venta).
create or replace function public.revisar_pagos(p_negocio uuid, p_pagos jsonb, p_saldo int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_pago jsonb;
  v_metodo metodos_pago;
  v_monto int;
  v_recibido int;
  v_suma int := 0;
  v_vuelto int := 0;
  v_card gift_cards;
  v_usado jsonb := '{}'::jsonb;
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
    elsif v_metodo.tipo = 'gift_card' then
      select * into v_card from gift_cards
       where negocio_id = p_negocio and codigo = upper(trim(coalesce(v_pago->>'giftCard', '')));
      if not found then
        return error_venta('GIFT_CARD', 'No encontramos una gift card con ese código', 'giftCard');
      end if;
      if v_card.anulada then
        return error_venta('GIFT_CARD', 'Esa gift card está anulada', 'giftCard');
      end if;
      if v_card.vence < hoy_bogota() then
        return error_venta('GIFT_CARD', format('Esa gift card venció el %s', to_char(v_card.vence, 'DD/MM/YYYY')),
                           'giftCard');
      end if;
      v_usado := v_usado || jsonb_build_object(v_card.codigo,
                                               coalesce((v_usado->>v_card.codigo)::int, 0) + v_monto);
      if (v_usado->>v_card.codigo)::int > v_card.saldo then
        return error_venta('GIFT_CARD', format('A esa gift card le quedan %s', pesos_texto(v_card.saldo)), 'giftCard');
      end if;
    end if;
    v_suma := v_suma + v_monto;
  end loop;
  if v_suma > p_saldo then
    return error_venta('PAGOS_SUPERAN', 'Los pagos superan el total', 'pagos');
  end if;
  return jsonb_build_object('ok', true, 'suma', v_suma, 'vuelto', v_vuelto);
end;
$$;

-- Guarda los pagos (como en 0006). La gift card descuenta su saldo con la fila bloqueada y no mueve la caja: esa
-- plata entró cuando se vendió la tarjeta.
create or replace function public.insertar_pagos(p_venta ventas, p_pagos jsonb, p_abono boolean, p_miembro uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_pago jsonb;
  v_metodo metodos_pago;
  v_id uuid;
  v_caja boolean;
  v_card gift_cards;
begin
  select caja_activa into v_caja from ajustes where negocio_id = p_venta.negocio_id;
  for v_pago in select * from jsonb_array_elements(p_pagos) loop
    select * into v_metodo from metodos_pago where id = (v_pago->>'metodoId')::uuid;
    v_card := null;
    if v_metodo.tipo = 'gift_card' then
      select * into v_card from gift_cards
       where negocio_id = p_venta.negocio_id and codigo = upper(trim(v_pago->>'giftCard')) for update;
      if v_card.saldo < (v_pago->>'monto')::int then
        raise exception 'A esa gift card ya no le alcanza el saldo' using errcode = '22023';
      end if;
      update gift_cards set saldo = saldo - (v_pago->>'monto')::int where id = v_card.id;
    end if;
    insert into pagos (negocio_id, venta_id, metodo_id, monto, recibido, comprobante, abono, creado_por, gift_card_id)
    values (p_venta.negocio_id, p_venta.id, v_metodo.id, (v_pago->>'monto')::int,
            case when v_metodo.tipo = 'efectivo'
                 then coalesce((v_pago->>'recibido')::int, (v_pago->>'monto')::int) end,
            coalesce(v_card.codigo, nullif(left(trim(v_pago->>'comprobante'), 40), '')), p_abono, p_miembro, v_card.id)
    returning id into v_id;
    if v_caja and v_metodo.tipo <> 'gift_card' then
      insert into movimientos_caja (negocio_id, local_id, tipo, monto, efectivo, concepto, metodo, pago_id, venta_id,
                                    creado_por)
      values (p_venta.negocio_id, p_venta.local_id, 'ingreso', (v_pago->>'monto')::int, v_metodo.tipo = 'efectivo',
              case when p_abono then 'Abono de la venta ' else 'Venta ' end || p_venta.numero, v_metodo.nombre, v_id,
              p_venta.id, p_miembro);
    end if;
  end loop;
end;
$$;

-- Revisa un ítem de gift card, plan o servicio con sesiones/paquete. Devuelve el error o null; en p_cliente
-- dice si el ítem necesita cliente (todo menos la gift card queda a su nombre).
create or replace function public.revisar_item_extra(p_negocio uuid, p_item jsonb, out p_error jsonb,
                                                     out p_cliente boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  v_tipo text;
  v_cant int := coalesce((p_item->>'cantidad')::int, 1);
begin
  p_cliente := false;
  if nullif(p_item->>'giftCardModeloId', '') is not null then
    if nullif(p_item->>'servicioId', '') is not null or nullif(p_item->>'productoId', '') is not null
       or nullif(p_item->>'planId', '') is not null then
      p_error := error_venta('VALIDACION', 'Una gift card va sola en su ítem', 'items'); return;
    end if;
    if not exists (select 1 from gift_card_modelos where id = (p_item->>'giftCardModeloId')::uuid
                    and negocio_id = p_negocio and activo) then
      p_error := error_venta('VALIDACION', 'Esa gift card ya no está a la venta', 'items'); return;
    end if;
    if v_cant <> 1 then
      p_error := error_venta('VALIDACION', 'Las gift cards se venden de a una', 'items'); return;
    end if;
  elsif nullif(p_item->>'planId', '') is not null then
    if nullif(p_item->>'servicioId', '') is not null or nullif(p_item->>'productoId', '') is not null then
      p_error := error_venta('VALIDACION', 'Un plan va solo en su ítem', 'items'); return;
    end if;
    if not exists (select 1 from planes where id = (p_item->>'planId')::uuid and negocio_id = p_negocio and activo) then
      p_error := error_venta('VALIDACION', 'Ese plan ya no está a la venta', 'items'); return;
    end if;
    if v_cant <> 1 then
      p_error := error_venta('VALIDACION', 'Los planes se venden de a uno', 'items'); return;
    end if;
    p_cliente := true;
  elsif nullif(p_item->>'servicioId', '') is not null and nullif(p_item->>'citaId', '') is null then
    select tipo into v_tipo from servicios where id = (p_item->>'servicioId')::uuid;
    if v_tipo in ('sesiones', 'paquete') then
      if v_cant <> 1 then
        p_error := error_venta('VALIDACION', 'Las sesiones y los paquetes se venden de a uno', 'items'); return;
      end if;
      p_cliente := true;
    end if;
  end if;
end;
$$;

-- Crea lo que deja un ítem ya guardado: la gift card (con su código en la descripción) o el bono del cliente.
create or replace function public.crear_lo_vendido(p_venta ventas, p_item venta_items) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m gift_card_modelos;
  p planes;
  s servicios;
  v_hoy date := hoy_bogota();
  v_codigo text;
  v_bono uuid;
begin
  if p_item.gift_card_modelo_id is not null then
    select * into m from gift_card_modelos where id = p_item.gift_card_modelo_id;
    v_codigo := nuevo_codigo_gift_card(p_venta.negocio_id);
    insert into gift_cards (negocio_id, modelo_id, codigo, nombre, comprador_id, saldo_inicial, saldo, vence, venta_id)
    values (p_venta.negocio_id, m.id, v_codigo, m.nombre, p_venta.cliente_id, m.monto, m.monto,
            v_hoy + m.vigencia_dias, p_venta.id);
    update venta_items set descripcion = left(descripcion || ' · ' || v_codigo, 120) where id = p_item.id;
    return jsonb_build_object('codigo', v_codigo, 'saldo', m.monto, 'vence', v_hoy + m.vigencia_dias,
                              'nombre', m.nombre);
  elsif p_item.plan_id is not null then
    select * into p from planes where id = p_item.plan_id;
    insert into bonos (negocio_id, cliente_id, tipo, plan_id, nombre, servicios, cupo, inicio, vence, venta_id)
    values (p_venta.negocio_id, p_venta.cliente_id, 'plan', p.id, p.nombre, p.servicios, p.sesiones, v_hoy,
            v_hoy + p.vigencia_dias - 1, p_venta.id);
  elsif p_item.servicio_id is not null then
    -- Un servicio con sesiones cobrado en su primera cita también crea el bono, y esa cita es la sesión 1 (si la
    -- cita ya usaba un bono, no se crea otro).
    select * into s from servicios where id = p_item.servicio_id;
    if (p_item.cita_id is null and s.tipo in ('sesiones', 'paquete'))
       or (p_item.cita_id is not null and s.tipo = 'sesiones'
           and not exists (select 1 from citas where id = p_item.cita_id and bono_id is not null)) then
      insert into bonos (negocio_id, cliente_id, tipo, servicio_id, nombre, servicios, cupo, inicio, vence, venta_id)
      values (p_venta.negocio_id,
              coalesce(p_venta.cliente_id, (select cliente_id from citas where id = p_item.cita_id)), s.tipo, s.id,
              s.nombre, case when s.tipo = 'paquete' then s.incluye else array[s.id] end,
              case when s.tipo = 'paquete' then cardinality(s.incluye) else s.sesiones end,
              v_hoy, v_hoy + coalesce(s.vigencia_dias, 180) - 1, p_venta.id)
      returning id into v_bono;
      if p_item.cita_id is not null then
        update citas set bono_id = v_bono where id = p_item.cita_id;
      end if;
    end if;
  end if;
  return null;
end;
$$;

-- Funciones de la app -----------------------------------------------------------------------------------------
-- Cerrar venta (como en 0007) con gift cards, planes, sesiones y paquetes: se revisan en el mismo recorrido de los
-- ítems y se crean después de guardar cada uno. Devuelve también las gift cards creadas (código y saldo).
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
  v_extra record;
  v_a_nombre boolean := false;      -- algún ítem queda a nombre del cliente (plan, sesiones, paquete)
  v_fila venta_items;
  v_creado jsonb;
  v_cards jsonb := '[]'::jsonb;
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
    select * into v_extra from revisar_item_extra(v_negocio, v_item);
    if v_extra.p_error is not null then return v_extra.p_error; end if;
    v_a_nombre := v_a_nombre or v_extra.p_cliente;
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
  if v_cliente is null and v_a_nombre then
    return error_venta('VALIDACION', 'Elige el cliente: los planes, sesiones y paquetes quedan a su nombre',
                       'clienteId');
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
      insert into venta_items (venta_id, servicio_id, cita_id, profesional_id, producto_id, plan_id,
                               gift_card_modelo_id, descripcion, cantidad, precio_unitario, total)
      values (v_venta.id, nullif(v_item->>'servicioId', '')::uuid, nullif(v_item->>'citaId', '')::uuid,
              nullif(v_item->>'profesionalId', '')::uuid, nullif(v_item->>'productoId', '')::uuid,
              nullif(v_item->>'planId', '')::uuid, nullif(v_item->>'giftCardModeloId', '')::uuid,
              left(coalesce(v_desc_item, 'Ítem'), 120), v_cant, (v_item->>'precioUnitario')::int,
              v_cant * (v_item->>'precioUnitario')::int)
      returning * into v_fila;
      v_creado := crear_lo_vendido(v_venta, v_fila);
      if v_creado is not null then v_cards := v_cards || v_creado; end if;
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
    'vuelto', (v_rev->>'vuelto')::int, 'estado', v_venta.estado, 'total', v_venta.total, 'pagado', v_venta.pagado,
    'giftCards', v_cards);
end;
$$;

-- Anular (como en 0007) con lo nuevo: no se anula si la gift card vendida ya se usó o si el plan ya tiene citas;
-- si no, quedan anulados. Lo pagado con gift card vuelve a su saldo.
create or replace function public.anular_venta(p_venta uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_negocio uuid := mi_negocio();
  v_venta ventas;
  v_miembro uuid;
  v_linea record;
  v_usada text;
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
  select codigo into v_usada from gift_cards where venta_id = v_venta.id and saldo < saldo_inicial limit 1;
  if found then
    return error_venta('GIFT_CARD_USADA', format('La gift card %s ya se usó: no se puede anular la venta', v_usada));
  end if;
  select b.nombre into v_usada from bonos b
   where b.venta_id = v_venta.id and bono_usadas(b.id) > 0
   limit 1;
  if found then
    return error_venta('PLAN_EN_USO', format('«%s» ya tiene citas: quítalas del plan antes de anular', v_usada));
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
  update gift_cards set anulada = true where venta_id = v_venta.id;
  update bonos set anulado = true where venta_id = v_venta.id;
  for v_linea in
    select gift_card_id, sum(monto)::int as monto from pagos
     where venta_id = v_venta.id and gift_card_id is not null group by gift_card_id order by gift_card_id
  loop
    update gift_cards set saldo = least(saldo + v_linea.monto, saldo_inicial) where id = v_linea.gift_card_id;
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

-- Usar un bono en una cita: queda en $0 ("incluida en el plan"). Dueño o recepción; no si ya se cobró.
create or replace function public.usar_bono(p_cita uuid, p_bono uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c citas;
  b bonos;
  v_motivo text;
begin
  if mi_rol() is null or mi_rol() not in ('dueno', 'recepcion') then
    return error_venta('SIN_PERMISO', 'Tu rol no puede usar planes');
  end if;
  select * into c from citas where id = p_cita and negocio_id = mi_negocio() for update;
  if not found then return error_venta('NO_ENCONTRADA', 'La cita ya no existe'); end if;
  select * into b from bonos where id = p_bono and negocio_id = mi_negocio() for update;
  if not found then return error_venta('NO_ENCONTRADA', 'Ese plan ya no existe'); end if;
  if c.estado = 'cancelado' then return error_venta('VALIDACION', 'La cita está cancelada'); end if;
  if c.bono_id is not null then return error_venta('VALIDACION', 'Esta cita ya usa un plan'); end if;
  if exists (select 1 from venta_items where cita_id = c.id and vigente) then
    return error_venta('YA_COBRADA', 'Esta cita ya se cobró');
  end if;
  v_motivo := bono_no_sirve(b, c);
  if v_motivo is not null then return error_venta('NO_SIRVE', v_motivo); end if;
  update citas set bono_id = b.id, precio = 0 where id = c.id;
  return jsonb_build_object('ok', true, 'usadas', bono_usadas(b.id), 'cupo', b.cupo);
end;
$$;

-- Quitar el plan de una cita: vuelve al precio del servicio y el cupo queda libre.
create or replace function public.soltar_bono(p_cita uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c citas;
begin
  if mi_rol() is null or mi_rol() not in ('dueno', 'recepcion') then
    return error_venta('SIN_PERMISO', 'Tu rol no puede usar planes');
  end if;
  select * into c from citas where id = p_cita and negocio_id = mi_negocio() for update;
  if not found then return error_venta('NO_ENCONTRADA', 'La cita ya no existe'); end if;
  if c.bono_id is null then return error_venta('VALIDACION', 'Esta cita no usa un plan'); end if;
  if exists (select 1 from venta_items where cita_id = c.id and vigente) then
    return error_venta('YA_COBRADA', 'Esta cita ya se cobró');
  end if;
  update citas set bono_id = null, precio = (select precio from servicios where id = c.servicio_id) where id = c.id;
  return jsonb_build_object('ok', true);
end;
$$;

-- Lecturas (language sql sin security definer: aplica RLS) ------------------------------------------------------
-- Planes, sesiones y paquetes vendidos con las citas usadas; p_cliente filtra los de un cliente.
create or replace function public.listar_bonos(p_cliente uuid default null)
returns table (id uuid, tipo text, nombre text, cliente_id uuid, cliente text, servicios uuid[], cupo smallint,
               usadas int, inicio date, vence date, anulado boolean, venta text, created_at timestamptz)
language sql stable set search_path = public as $$
  select b.id, b.tipo, b.nombre, b.cliente_id, cl.nombre || ' ' || cl.apellido, b.servicios, b.cupo,
         (select count(*)::int from citas c where c.bono_id = b.id and c.estado <> 'cancelado'),
         b.inicio, b.vence, b.anulado, v.numero, b.created_at
    from bonos b join clientes cl on cl.id = b.cliente_id left join ventas v on v.id = b.venta_id
   where p_cliente is null or b.cliente_id = p_cliente
   order by b.created_at desc;
$$;

-- Gift cards vendidas con quién la compró, la venta y cuántas veces se usó.
create or replace function public.listar_gift_cards()
returns table (id uuid, codigo text, nombre text, comprador text, para text, saldo_inicial int, saldo int,
               vence date, anulada boolean, venta text, usos int, created_at timestamptz)
language sql stable set search_path = public as $$
  select g.id, g.codigo, g.nombre, cl.nombre || ' ' || cl.apellido, g.para, g.saldo_inicial, g.saldo, g.vence,
         g.anulada, v.numero,
         (select count(*)::int from pagos pg join ventas pv on pv.id = pg.venta_id
           where pg.gift_card_id = g.id and pv.estado <> 'anulada'),
         g.created_at
    from gift_cards g left join clientes cl on cl.id = g.comprador_id left join ventas v on v.id = g.venta_id
   order by g.created_at desc;
$$;

-- Permisos ----------------------------------------------------------------------------------------------------
revoke all on function public.hoy_bogota(), public.nuevo_codigo_gift_card(uuid), public.bono_usadas(uuid, uuid),
  public.bono_no_sirve(bonos, citas), public.revisar_item_extra(uuid, jsonb), public.crear_lo_vendido(ventas, venta_items),
  public.revisar_pagos(uuid, jsonb, int), public.insertar_pagos(ventas, jsonb, boolean, uuid)
  from public, anon, authenticated;
revoke all on function public.cerrar_venta(jsonb), public.anular_venta(uuid, text), public.usar_bono(uuid, uuid),
  public.soltar_bono(uuid), public.listar_bonos(uuid), public.listar_gift_cards() from public, anon;
grant execute on function public.cerrar_venta(jsonb), public.anular_venta(uuid, text), public.usar_bono(uuid, uuid),
  public.soltar_bono(uuid), public.listar_bonos(uuid), public.listar_gift_cards() to authenticated;

-- La agenda dice qué plan usa cada cita (la ficha ofrece «Usar plan» o «Quitar») -------------------------------
drop function public.agenda_citas(uuid, date, date);
create function public.agenda_citas(p_local uuid, p_desde date, p_hasta date)
returns table (
  id uuid, profesional_id uuid, servicio_id uuid, cliente_id uuid,
  cliente_nombre text, cliente_telefono text, cliente_correo text, servicio_nombre text,
  fecha date, hora_inicio time, hora_fin time, duracion_min smallint,
  estado estado_cita, origen origen_cita, precio integer,
  nota_cliente text, nota_interna text, serie_id uuid, profesional_fijo boolean,
  aviso_correo boolean, aviso_whatsapp boolean, cliente_desde timestamptz, motivo_cancelacion text,
  venta_id uuid, venta_estado text, bono_id uuid, bono_nombre text
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
         cl.created_at, c.motivo_cancelacion, vt.id, vt.estado::text, c.bono_id, b.nombre
    from citas c
    join clientes cl on cl.id = c.cliente_id
    join servicios s on s.id = c.servicio_id
    left join bonos b on b.id = c.bono_id
    left join lateral (select v.id, v.estado from venta_items vi join ventas v on v.id = vi.venta_id
                        where vi.cita_id = c.id and vi.vigente limit 1) vt on true
   where c.negocio_id = mi_negocio()
     and c.local_id = p_local
     and c.fecha between p_desde and p_hasta
     and (mi_rol() in ('dueno','recepcion') or c.profesional_id = mi_profesional())
   order by c.fecha, c.hora_inicio;
$$;
revoke all on function public.agenda_citas(uuid, date, date) from public, anon;
grant execute on function public.agenda_citas(uuid, date, date) to authenticated;

-- Si se edita una cita con plan (otro servicio, día o cliente) y el plan ya no la cubre, sale del plan y vuelve
-- al precio del servicio; si la sigue cubriendo, sigue en $0.
create or replace function public.citas_bono_sigue() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  b bonos;
begin
  select * into b from bonos where id = new.bono_id;
  if not found or b.anulado or b.cliente_id <> new.cliente_id or new.fecha not between b.inicio and b.vence
     or (cardinality(b.servicios) > 0 and not (new.servicio_id = any(b.servicios))) then
    new.bono_id := null;
    new.precio := (select precio from servicios where id = new.servicio_id);
  else
    new.precio := 0;
  end if;
  return new;
end;
$$;
create trigger citas_bono_sigue before update of servicio_id, fecha, cliente_id, precio on citas
  for each row when (new.bono_id is not null and old.bono_id is not distinct from new.bono_id)
  execute function public.citas_bono_sigue();
revoke all on function public.citas_bono_sigue() from public, anon, authenticated;
