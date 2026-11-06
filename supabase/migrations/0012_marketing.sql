-- 0012_marketing.sql · AgedaCol (Fase 8, T-8.5)
-- Correo masivo (audiencias y campañas que llegan al buzón de la demo, con cupo mensual y correos suprimidos),
-- fidelización (un sello por cada cita con "asistió"; al llenar la tarjeta hay premio) y plantillas de WhatsApp
-- que se mandan desde una reserva. Todo lo que "se envía" es simulado: queda en avisos_demo.

-- Tablas ------------------------------------------------------------------------------------------------------
alter table clientes add column recibe_campanas boolean not null default true;

create table public.audiencias (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 2 and 60),
  filtro jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (negocio_id, nombre)
);

create table public.campanas (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  audiencia_id uuid references audiencias(id) on delete set null,
  asunto text not null check (char_length(asunto) between 2 and 120),
  cuerpo text not null check (char_length(cuerpo) between 2 and 2000),
  estado text not null default 'borrador' check (estado in ('borrador', 'enviada')),
  destinatarios int,
  enviada_at timestamptz,
  created_at timestamptz not null default now()
);
create index campanas_negocio on campanas (negocio_id, created_at desc);

alter table avisos_demo add column campana_id uuid references campanas(id) on delete cascade;
create index avisos_demo_campana on avisos_demo (campana_id) where campana_id is not null;
alter table avisos_demo drop constraint avisos_demo_tipo_check;
alter table avisos_demo add constraint avisos_demo_tipo_check check (tipo in ('confirmacion', 'recordatorio', 'cambio',
  'cancelacion', 'comprobante', 'link_pago', 'invitacion', 'enlace', 'respuesta', 'calificacion', 'campana', 'sellos',
  'plantilla'));

alter table ajustes
  add column sellos_activos boolean not null default false,
  add column sellos_meta smallint not null default 8 check (sellos_meta between 3 and 20),
  add column sellos_premio text not null default 'Un servicio de cortesía'
    check (char_length(sellos_premio) between 2 and 80);

create table public.sellos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  cita_id uuid not null unique references citas(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index sellos_cliente on sellos (cliente_id);

create table public.canjes_sellos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  premio text not null,
  created_at timestamptz not null default now()
);
create index canjes_sellos_cliente on canjes_sellos (cliente_id);

create table public.plantillas_whatsapp (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 2 and 60),
  cuerpo text not null check (char_length(cuerpo) between 2 and 600),
  activo boolean not null default true,
  orden smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (negocio_id, nombre)
);

-- RLS: el correo masivo es del dueño; las tarjetas las ven dueño y recepción (que entrega los premios); las
-- plantillas las leen los dos y las escribe el dueño. -------------------------------------------------------------
alter table audiencias enable row level security;
alter table campanas enable row level security;
alter table sellos enable row level security;
alter table canjes_sellos enable row level security;
alter table plantillas_whatsapp enable row level security;

create policy "dueno" on audiencias for all to authenticated
  using (negocio_id = mi_negocio() and mi_rol() = 'dueno')
  with check (negocio_id = mi_negocio() and mi_rol() = 'dueno');
create policy "dueno lee" on campanas for select to authenticated
  using (negocio_id = mi_negocio() and mi_rol() = 'dueno');
create policy "crea borradores" on campanas for insert to authenticated
  with check (negocio_id = mi_negocio() and mi_rol() = 'dueno' and estado = 'borrador');
create policy "edita borradores" on campanas for update to authenticated
  using (negocio_id = mi_negocio() and mi_rol() = 'dueno' and estado = 'borrador')
  with check (negocio_id = mi_negocio() and estado = 'borrador');
create policy "borra borradores" on campanas for delete to authenticated
  using (negocio_id = mi_negocio() and mi_rol() = 'dueno' and estado = 'borrador');
create policy "dueno y recepcion leen" on sellos for select to authenticated
  using (negocio_id = mi_negocio() and mi_rol() in ('dueno', 'recepcion'));
create policy "dueno y recepcion leen" on canjes_sellos for select to authenticated
  using (negocio_id = mi_negocio() and mi_rol() in ('dueno', 'recepcion'));
create policy "dueno y recepcion leen" on plantillas_whatsapp for select to authenticated
  using (negocio_id = mi_negocio() and mi_rol() in ('dueno', 'recepcion'));
create policy "dueno escribe" on plantillas_whatsapp for all to authenticated
  using (negocio_id = mi_negocio() and mi_rol() = 'dueno')
  with check (negocio_id = mi_negocio() and mi_rol() = 'dueno');

revoke all on audiencias, campanas, sellos, canjes_sellos, plantillas_whatsapp from public, anon;
grant select, insert, update, delete on audiencias, campanas, plantillas_whatsapp to authenticated;
grant select on sellos, canjes_sellos to authenticated;

-- Correo masivo -----------------------------------------------------------------------------------------------
-- Clientes que cumplen el filtro de una audiencia: género, mes de cumpleaños (0 = el mes en curso), un servicio
-- que ya tomaron, días sin venir (o nunca) y creados hace poco. Las claves vacías no filtran.
create or replace function public.audiencia_clientes(p_negocio uuid, p_filtro jsonb) returns setof uuid
language sql stable security definer set search_path = public as $$
  select c.id from clientes c
   where c.negocio_id = p_negocio
     and (nullif(p_filtro->>'genero', '') is null or c.genero::text = p_filtro->>'genero')
     and (nullif(p_filtro->>'cumpleMes', '') is null
          or extract(month from c.fecha_nacimiento) = coalesce(nullif((p_filtro->>'cumpleMes')::int, 0),
                                                               extract(month from hoy_bogota())::int))
     and (nullif(p_filtro->>'servicioId', '') is null
          or exists (select 1 from citas x where x.cliente_id = c.id and x.estado <> 'cancelado'
                       and x.servicio_id = (p_filtro->>'servicioId')::uuid))
     and (nullif(p_filtro->>'sinVenirDias', '') is null
          or not exists (select 1 from citas x where x.cliente_id = c.id and x.estado = 'asiste'
                           and x.fecha > hoy_bogota() - (p_filtro->>'sinVenirDias')::int))
     and (nullif(p_filtro->>'nuevosDias', '') is null
          or c.created_at >= now() - make_interval(days => (p_filtro->>'nuevosDias')::int));
$$;

-- Cupo de envíos del mes (simulado, como el de un plan de correo).
create or replace function public.cupo_campanas() returns int language sql immutable as $$ select 500 $$;

-- Cuántos clientes caben en el filtro, cuántos recibirían el correo y cuántos están suprimidos o sin correo.
create or replace function public.contar_audiencia(p_filtro jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_negocio uuid := mi_negocio();
begin
  if v_negocio is null or mi_rol() <> 'dueno' then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  return (select jsonb_build_object(
            'total', count(*),
            'reciben', count(*) filter (where c.correo is not null and c.recibe_campanas),
            'sinCorreo', count(*) filter (where c.correo is null),
            'suprimidos', count(*) filter (where c.correo is not null and not c.recibe_campanas),
            'usadosMes', (select coalesce(sum(destinatarios), 0) from campanas
                           where negocio_id = v_negocio and estado = 'enviada'
                             and date_trunc('month', enviada_at at time zone 'America/Bogota')
                                 = date_trunc('month', now() at time zone 'America/Bogota')),
            'cupoMes', cupo_campanas())
            from clientes c where c.id in (select audiencia_clientes(v_negocio, coalesce(p_filtro, '{}'::jsonb))));
end;
$$;

-- Envía (al buzón) una campaña en borrador a su audiencia, o a todos si no tiene. {nombre} se cambia por el
-- nombre de cada cliente.
create or replace function public.enviar_campana(p_campana uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_negocio uuid := mi_negocio();
  k campanas;
  v_filtro jsonb;
  v_n int;
  v_usados int;
begin
  if v_negocio is null or mi_rol() <> 'dueno' then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'SIN_PERMISO',
      'message', 'Tu rol no puede enviar campañas'));
  end if;
  select * into k from campanas where id = p_campana and negocio_id = v_negocio for update;
  if not found or k.estado <> 'borrador' then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'NO_ENCONTRADA',
      'message', 'La campaña ya no está en borrador'));
  end if;
  select coalesce((select filtro from audiencias where id = k.audiencia_id), '{}'::jsonb) into v_filtro;
  create temporary table destino on commit drop as
    select c.id, c.nombre, c.apellido, c.correo from clientes c
     where c.id in (select audiencia_clientes(v_negocio, v_filtro)) and c.correo is not null and c.recibe_campanas;
  select count(*) into v_n from destino;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'SIN_DESTINATARIOS',
      'message', 'Nadie de esta audiencia puede recibir correos'));
  end if;
  select coalesce(sum(destinatarios), 0) into v_usados from campanas
   where negocio_id = v_negocio and estado = 'enviada'
     and date_trunc('month', enviada_at at time zone 'America/Bogota')
         = date_trunc('month', now() at time zone 'America/Bogota');
  if v_usados + v_n > cupo_campanas() then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'CUPO',
      'message', format('Este mes quedan %s envíos y la campaña necesita %s', cupo_campanas() - v_usados, v_n)));
  end if;
  insert into avisos_demo (negocio_id, campana_id, canal, tipo, destinatario, destino, asunto, cuerpo)
  select v_negocio, k.id, 'correo', 'campana', d.nombre || ' ' || d.apellido, d.correo, k.asunto,
         replace(k.cuerpo, '{nombre}', d.nombre)
    from destino d;
  update campanas set estado = 'enviada', destinatarios = v_n, enviada_at = now() where id = k.id;
  return jsonb_build_object('ok', true, 'destinatarios', v_n);
end;
$$;

-- Fidelización ------------------------------------------------------------------------------------------------
-- Un sello por cada cita que pasa a "asistió" (si el programa está activo); si deja de estarlo, el sello se
-- quita. Al llenar la tarjeta, el cliente recibe un aviso con su premio.
create or replace function public.citas_sello() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  a ajustes;
  cl clientes;
  v_total int;
begin
  if tg_op = 'UPDATE' and old.estado = 'asiste' and new.estado <> 'asiste' then
    delete from sellos where cita_id = new.id;
    return new;
  end if;
  if new.estado <> 'asiste' or (tg_op = 'UPDATE' and old.estado = 'asiste') then return new; end if;
  select * into a from ajustes where negocio_id = new.negocio_id;
  if not coalesce(a.sellos_activos, false) then return new; end if;
  insert into sellos (negocio_id, cliente_id, cita_id) values (new.negocio_id, new.cliente_id, new.id)
  on conflict (cita_id) do nothing;
  if not found then return new; end if;
  select count(*) into v_total from sellos where cliente_id = new.cliente_id;
  if v_total % a.sellos_meta = 0 then
    select * into cl from clientes where id = new.cliente_id;
    if cl.correo is not null or cl.telefono is not null then
      insert into avisos_demo (negocio_id, cita_id, canal, tipo, destinatario, destino, asunto, cuerpo)
      values (new.negocio_id, new.id, case when cl.correo is not null then 'correo' else 'whatsapp' end::canal_aviso,
              'sellos', cl.nombre || ' ' || cl.apellido, coalesce(cl.correo, cl.telefono), '¡Completaste tu tarjeta!',
              format('Hola %s, con esta visita completaste tu tarjeta de %s sellos. Tu premio: %s. Pídelo en tu próxima cita.',
                     cl.nombre, a.sellos_meta, a.sellos_premio));
    end if;
  end if;
  return new;
end;
$$;
create trigger citas_sello after insert or update of estado on citas
  for each row execute function citas_sello();

-- Tarjeta de cada cliente con sellos: total, premios canjeados y último sello.
create or replace function public.tarjetas_sellos()
returns table (cliente_id uuid, cliente text, telefono text, sellos int, canjes int, ultimo timestamptz)
language sql stable set search_path = public as $$
  select c.id, c.nombre || ' ' || c.apellido, c.telefono, count(s.id)::int,
         (select count(*)::int from canjes_sellos k where k.cliente_id = c.id), max(s.created_at)
    from sellos s join clientes c on c.id = s.cliente_id
   group by c.id
   order by max(s.created_at) desc;
$$;

-- Entrega un premio ganado y no canjeado.
create or replace function public.canjear_premio(p_cliente uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_negocio uuid := mi_negocio();
  a ajustes;
  v_ganados int;
  v_canjes int;
begin
  if v_negocio is null or mi_rol() not in ('dueno', 'recepcion') then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'SIN_PERMISO',
      'message', 'Tu rol no puede entregar premios'));
  end if;
  perform 1 from clientes where id = p_cliente and negocio_id = v_negocio for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'NO_ENCONTRADO',
      'message', 'Ese cliente ya no existe'));
  end if;
  select * into a from ajustes where negocio_id = v_negocio;
  select count(*) / a.sellos_meta into v_ganados from sellos where cliente_id = p_cliente;
  select count(*) into v_canjes from canjes_sellos where cliente_id = p_cliente;
  if v_ganados <= v_canjes then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'SIN_PREMIO',
      'message', 'Este cliente no tiene premios por entregar'));
  end if;
  insert into canjes_sellos (negocio_id, cliente_id, premio) values (v_negocio, p_cliente, a.sellos_premio);
  return jsonb_build_object('ok', true);
end;
$$;

-- Plantillas de WhatsApp --------------------------------------------------------------------------------------
-- Manda (al buzón) una plantilla a la cliente de una cita, con sus datos puestos.
create or replace function public.enviar_plantilla(p_cita uuid, p_plantilla uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_negocio uuid := mi_negocio();
  t plantillas_whatsapp;
  r record;
begin
  if v_negocio is null or mi_rol() not in ('dueno', 'recepcion') then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'SIN_PERMISO',
      'message', 'Tu rol no puede mandar mensajes'));
  end if;
  select * into t from plantillas_whatsapp where id = p_plantilla and negocio_id = v_negocio and activo;
  if not found then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'NO_ENCONTRADA',
      'message', 'Esa plantilla ya no está activa'));
  end if;
  select ci.id, ci.fecha, ci.hora_inicio, cl.nombre, cl.apellido, cl.telefono, s.nombre as servicio,
         p.nombre as profesional, l.nombre as local, n.nombre as negocio
    into r
    from citas ci join clientes cl on cl.id = ci.cliente_id join servicios s on s.id = ci.servicio_id
    join profesionales p on p.id = ci.profesional_id join locales l on l.id = ci.local_id
    join negocios n on n.id = ci.negocio_id
   where ci.id = p_cita and ci.negocio_id = v_negocio;
  if not found then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'NO_ENCONTRADA',
      'message', 'La cita ya no existe'));
  end if;
  if r.telefono is null then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'SIN_TELEFONO',
      'message', 'Esta cliente no tiene teléfono'));
  end if;
  insert into avisos_demo (negocio_id, cita_id, canal, tipo, destinatario, destino, cuerpo)
  values (v_negocio, r.id, 'whatsapp', 'plantilla', r.nombre || ' ' || r.apellido, r.telefono,
          replace(replace(replace(replace(replace(replace(replace(t.cuerpo,
            '{cliente}', r.nombre), '{servicio}', r.servicio), '{fecha}', to_char(r.fecha, 'DD/MM/YYYY')),
            '{hora}', to_char(r.hora_inicio, 'HH24:MI')), '{profesional}', r.profesional), '{local}', r.local),
            '{negocio}', r.negocio));
  return jsonb_build_object('ok', true);
end;
$$;

-- Permisos ----------------------------------------------------------------------------------------------------
revoke all on function public.audiencia_clientes(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.cupo_campanas() from public, anon;
revoke all on function public.contar_audiencia(jsonb) from public, anon;
revoke all on function public.enviar_campana(uuid) from public, anon;
revoke all on function public.citas_sello() from public, anon, authenticated;
revoke all on function public.tarjetas_sellos() from public, anon;
revoke all on function public.canjear_premio(uuid) from public, anon;
revoke all on function public.enviar_plantilla(uuid, uuid) from public, anon;
grant execute on function public.cupo_campanas() to authenticated;
grant execute on function public.contar_audiencia(jsonb) to authenticated;
grant execute on function public.enviar_campana(uuid) to authenticated;
grant execute on function public.tarjetas_sellos() to authenticated;
grant execute on function public.canjear_premio(uuid) to authenticated;
grant execute on function public.enviar_plantilla(uuid, uuid) to authenticated;
