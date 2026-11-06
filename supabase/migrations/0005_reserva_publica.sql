-- 0005_reserva_publica.sql — Reserva en línea y enlace personal del cliente (sin cuenta), calificación privada
-- del profesional y la respuesta simulada del cliente en el buzón.
-- Las funciones publico_* son las únicas puertas sin sesión: security definer, search_path fijo, validan todo y
-- usan la misma regla de choques que la agenda (choques_base). anon sigue sin permisos sobre las tablas.

-- Enlace personal de cada cita: token aleatorio de 32 caracteres, nunca el id.
alter table citas add column token text not null default replace(gen_random_uuid()::text, '-', '');
create unique index citas_token_key on citas (token);
-- Las citas que se reservaron juntas en línea (varios servicios seguidos) se confirman, cambian y cancelan juntas.
alter table citas add column reserva_id uuid;
create index citas_reserva on citas (reserva_id) where reserva_id is not null;

-- Calificación privada del profesional: una por reserva atendida; la ve el negocio, no es una reseña pública.
create table calificaciones (
  cita_id uuid primary key references citas(id) on delete cascade,
  negocio_id uuid not null references negocios(id) on delete cascade,
  profesional_id uuid not null references profesionales(id) on delete cascade,
  estrellas smallint not null check (estrellas between 1 and 5),
  comentario text check (char_length(comentario) <= 500),
  created_at timestamptz not null default now()
);
create index calificaciones_profesional on calificaciones (profesional_id);
alter table calificaciones enable row level security;
create policy "dueno y recepcion leen calificaciones" on calificaciones for select to authenticated
  using (negocio_id = mi_negocio() and mi_rol() in ('dueno', 'recepcion'));
create policy "el profesional lee las suyas" on calificaciones for select to authenticated
  using (negocio_id = mi_negocio() and mi_rol() = 'profesional' and profesional_id = mi_profesional());

-- Avisos: enlace de la cita, respuesta del cliente y pedido de calificación.
alter table avisos_demo add column enlace text check (enlace ~ '^/cita/[0-9a-f]{32}$');
alter table avisos_demo drop constraint avisos_demo_tipo_check, drop constraint avisos_demo_estado_check;
alter table avisos_demo add constraint avisos_demo_tipo_check check (tipo in ('confirmacion', 'recordatorio', 'cambio',
  'cancelacion', 'comprobante', 'link_pago', 'invitacion', 'enlace', 'respuesta', 'calificacion'));
alter table avisos_demo add constraint avisos_demo_estado_check
  check (estado in ('programado', 'enviado', 'sin_contacto', 'omitido', 'recibido'));

-- Choques ----------------------------------------------------------------------------
-- Núcleo sin permisos (el cuerpo de choques_cita de 0004 con el negocio como parámetro y varias citas que no
-- cuentan, las de la misma reserva). Solo lo llaman choques_cita (equipo) y las funciones públicas.
create or replace function public.choques_base(
  p_negocio uuid, p_excluir uuid[], p_local uuid, p_profesional uuid, p_cliente uuid, p_fecha date, p_inicio time,
  p_duracion int
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_excluir uuid[] := array_remove(coalesce(p_excluir, '{}'), null);
  v_fin time := p_inicio + make_interval(mins => p_duracion);
  v_rango tsrange;
  v_dia int := extract(isodow from p_fecha);
  v_prof text;
  v_out jsonb := '[]'::jsonb;
  hl horarios_local;
  hp horarios_profesional;
  r record;
begin
  if v_fin <= p_inicio then
    raise exception 'La cita no puede pasar de la medianoche' using errcode = '22023';
  end if;
  v_rango := tsrange(p_fecha + p_inicio, p_fecha + v_fin, '[)');
  select nombre into v_prof from profesionales where id = p_profesional and negocio_id = p_negocio;

  for r in
    select c.id, cl.nombre || ' ' || cl.apellido as cliente, s.nombre as servicio, c.hora_inicio, c.hora_fin
      from citas c join clientes cl on cl.id = c.cliente_id join servicios s on s.id = c.servicio_id
     where c.negocio_id = p_negocio and c.profesional_id = p_profesional and c.estado <> 'cancelado'
       and c.rango && v_rango and c.id <> all(v_excluir)
  loop
    v_out := v_out || jsonb_build_object('tipo', 'cita_profesional', 'citaId', r.id,
      'resumen', format('%s ya atiende a %s (%s) de %s a %s', v_prof, r.cliente, r.servicio,
                        hhmm(r.hora_inicio), hhmm(r.hora_fin)));
  end loop;

  for r in
    select c.id, cl.nombre || ' ' || cl.apellido as cliente, s.nombre as servicio, p.nombre as profesional,
           c.hora_inicio, c.hora_fin
      from citas c join clientes cl on cl.id = c.cliente_id join servicios s on s.id = c.servicio_id
      join profesionales p on p.id = c.profesional_id
     where c.negocio_id = p_negocio and c.cliente_id = p_cliente and c.profesional_id <> p_profesional
       and c.estado <> 'cancelado' and c.rango && v_rango and c.id <> all(v_excluir)
  loop
    v_out := v_out || jsonb_build_object('tipo', 'cita_cliente', 'citaId', r.id,
      'resumen', format('%s ya tiene %s con %s de %s a %s', r.cliente, r.servicio, r.profesional,
                        hhmm(r.hora_inicio), hhmm(r.hora_fin)));
  end loop;

  select * into hl from horarios_local where local_id = p_local and dia_semana = v_dia;
  if not found or not hl.abierto then
    v_out := v_out || jsonb_build_object('tipo', 'fuera_horario', 'resumen', 'El local está cerrado ese día');
  elsif p_inicio < hl.inicio or v_fin > hl.fin then
    v_out := v_out || jsonb_build_object('tipo', 'fuera_horario',
      'resumen', format('Fuera del horario del local (%s a %s)', hhmm(hl.inicio), hhmm(hl.fin)));
  end if;

  select * into hp from horarios_profesional where profesional_id = p_profesional and dia_semana = v_dia;
  if not found or not hp.trabaja then
    v_out := v_out || jsonb_build_object('tipo', 'fuera_horario', 'resumen', format('%s no trabaja ese día', v_prof));
  elsif p_inicio < hp.inicio or v_fin > hp.fin then
    v_out := v_out || jsonb_build_object('tipo', 'fuera_horario',
      'resumen', format('Fuera del horario de %s (%s a %s)', v_prof, hhmm(hp.inicio), hhmm(hp.fin)));
  elsif hp.descanso_inicio is not null and p_inicio < hp.descanso_fin and v_fin > hp.descanso_inicio then
    v_out := v_out || jsonb_build_object('tipo', 'descanso',
      'resumen', format('Cae en el descanso de %s (%s a %s)', v_prof, hhmm(hp.descanso_inicio), hhmm(hp.descanso_fin)));
  end if;

  for r in
    select b.motivo, b.inicio, b.fin from bloqueos b
     where b.negocio_id = p_negocio and b.profesional_id = p_profesional and b.rango && v_rango
  loop
    v_out := v_out || jsonb_build_object('tipo', 'bloqueo',
      'resumen', format('Bloqueo "%s" de %s a %s', r.motivo, to_char(r.inicio, 'HH24:MI'), to_char(r.fin, 'HH24:MI')));
  end loop;

  return v_out;
end;
$$;

-- La del equipo queda igual por fuera: exige dueño o recepción y delega en el núcleo.
create or replace function public.choques_cita(
  p_cita uuid, p_local uuid, p_profesional uuid, p_cliente uuid, p_fecha date, p_inicio time, p_duracion int
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if mi_negocio() is null or mi_rol() not in ('dueno', 'recepcion') then
    raise exception 'SIN_PERMISO' using errcode = '42501';
  end if;
  return choques_base(mi_negocio(), array[p_cita], p_local, p_profesional, p_cliente, p_fecha, p_inicio, p_duracion);
end;
$$;

-- Reservas ----------------------------------------------------------------------------
-- La cita y las que se reservaron con ella (mismo reserva_id y misma suerte: canceladas o no), por hora.
create or replace function public.grupo_reserva(p_cita uuid) returns uuid[]
language sql stable security definer set search_path = public as $$
  select array_agg(x.id order by x.fecha, x.hora_inicio)
    from citas c
    join citas x on x.id = c.id
      or (c.reserva_id is not null and x.reserva_id = c.reserva_id
          and (x.estado = 'cancelado') = (c.estado = 'cancelado'))
   where c.id = p_cita;
$$;

-- Lo que se agrega al aviso de una reserva de varios servicios: " Luego Barba a las 10:30." o, al cancelarla,
-- " También se canceló: Barba.".
create or replace function public.detalle_reserva(p_ids uuid[], p_cancelada boolean default false) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(case when p_cancelada
           then ' También se canceló: ' || string_agg(s.nombre, ', ' order by u.n) || '.'
           else string_agg(format(' Luego %s a las %s.', s.nombre, hhmm(c.hora_inicio)), '' order by u.n) end, '')
    from unnest(p_ids) with ordinality u(id, n) join citas c on c.id = u.id join servicios s on s.id = c.servicio_id
   where u.n > 1;
$$;

-- Horas libres ---------------------------------------------------------------------------
-- Horas de inicio (cada 30 min) en que alguno de los profesionales puede atender p_duracion minutos ese día,
-- desde 30 minutos después de ahora. p_excluir: las citas que se están cambiando (no chocan consigo mismas).
create or replace function public.horas_libres(
  p_local uuid, p_profesionales uuid[], p_duracion int, p_fecha date, p_excluir uuid[] default null
) returns table (hora time, profesional_id uuid)
language plpgsql stable security definer set search_path = public as $$
declare
  v_negocio uuid;
  v_ahora timestamp;
  v_dia int := extract(isodow from p_fecha);
  hl horarios_local;
  hp horarios_profesional;
  v_prof uuid;
  v_t time;
  m int;
begin
  select l.negocio_id, now() at time zone l.zona_horaria into v_negocio, v_ahora from locales l where l.id = p_local;
  select * into hl from horarios_local h where h.local_id = p_local and h.dia_semana = v_dia;
  if not found or not hl.abierto then return; end if;
  foreach v_prof in array coalesce(p_profesionales, '{}') loop
    select * into hp from horarios_profesional h where h.profesional_id = v_prof and h.dia_semana = v_dia;
    continue when not found or not hp.trabaja;
    for m in
      select generate_series(
        ceil(extract(epoch from greatest(hl.inicio, hp.inicio)) / 1800)::int * 30,
        (extract(epoch from least(hl.fin, hp.fin)) / 60)::int - p_duracion, 30)
    loop
      v_t := time '00:00' + make_interval(mins => m);
      continue when p_fecha + v_t < v_ahora + interval '30 minutes';
      if jsonb_array_length(choques_base(v_negocio, p_excluir, p_local, v_prof, null, p_fecha, v_t, p_duracion)) = 0 then
        hora := v_t;
        profesional_id := v_prof;
        return next;
      end if;
    end loop;
  end loop;
end;
$$;

-- Días con sus horas libres para el paso "Fecha y hora": [{fecha, abierto, horas: ["09:00", …]}], hasta 14 días
-- y nunca más de 60 días adelante.
create or replace function public.dias_libres(
  p_local uuid, p_profesionales uuid[], p_duracion int, p_desde date, p_dias int, p_excluir uuid[] default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_hoy date;
  v_out jsonb := '[]'::jsonb;
  v_horas jsonb;
  d date;
begin
  select (now() at time zone zona_horaria)::date into v_hoy from locales where id = p_local;
  for d in
    select generate_series(greatest(coalesce(p_desde, v_hoy), v_hoy),
                           least(greatest(coalesce(p_desde, v_hoy), v_hoy) + least(greatest(coalesce(p_dias, 7), 1), 14) - 1,
                                 v_hoy + 60),
                           interval '1 day')::date
  loop
    select coalesce(jsonb_agg(t.h order by t.h), '[]'::jsonb) into v_horas
      from (select distinct to_char(x.hora, 'HH24:MI') as h
              from horas_libres(p_local, p_profesionales, p_duracion, d, p_excluir) x) t;
    v_out := v_out || jsonb_build_object('fecha', d,
      'abierto', exists (select 1 from horarios_local
                          where local_id = p_local and dia_semana = extract(isodow from d) and abierto),
      'horas', v_horas);
  end loop;
  return v_out;
end;
$$;

-- Lo que hace falta para reservar unos servicios en un negocio: local, duración total y profesionales que hacen
-- todos esos servicios (o solo el pedido). Null si el negocio no existe, no recibe reservas o un servicio no vale.
create or replace function public.plan_reserva(p_slug text, p_servicios uuid[], p_profesional uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_local locales;
  v_dur int;
  v_n int;
  v_profs uuid[];
begin
  if coalesce(array_length(p_servicios, 1), 0) not between 1 and 6 then return null; end if;
  select l.* into v_local from locales l join negocios n on n.id = l.negocio_id
   where n.slug = p_slug and l.activo order by l.created_at limit 1;
  if not found or not v_local.reservas_en_linea then return null; end if;
  select sum(s.duracion_min), count(*) into v_dur, v_n
    from unnest(p_servicios) u(id) join servicios s on s.id = u.id
   where s.negocio_id = v_local.negocio_id and s.activo and s.en_linea;
  if v_n <> array_length(p_servicios, 1) or v_dur > 480 then return null; end if;
  select array_agg(p.id order by p.orden, p.nombre) into v_profs
    from profesionales p
   where p.local_id = v_local.id and p.activo and (p_profesional is null or p.id = p_profesional)
     and not exists (select 1 from unnest(p_servicios) u(id)
                      where not exists (select 1 from servicio_profesional sp
                                         where sp.servicio_id = u.id and sp.profesional_id = p.id));
  return jsonb_build_object('negocioId', v_local.negocio_id, 'localId', v_local.id, 'zona', v_local.zona_horaria,
    'duracion', v_dur, 'profesionales', to_jsonb(coalesce(v_profs, '{}')));
end;
$$;

-- Avisos ----------------------------------------------------------------------------------
-- Igual que en 0004, ahora con el enlace de la cita y el pedido de calificación.
create or replace function public.avisar_cita(p_cita uuid, p_tipo text, p_extra text default '') returns void
language plpgsql security definer set search_path = public as $$
declare
  c record;
  a ajustes;
  v_canal canal_aviso;
  v_destino text;
  v_cuerpo text;
  v_asunto text;
  v_cuando text;
begin
  select ci.*, cl.nombre as c_nombre, cl.apellido as c_apellido, cl.correo as c_correo, cl.telefono as c_telefono,
         s.nombre as servicio, p.nombre as profesional, l.direccion, n.nombre as negocio
    into c
    from citas ci join clientes cl on cl.id = ci.cliente_id join servicios s on s.id = ci.servicio_id
    join profesionales p on p.id = ci.profesional_id join locales l on l.id = ci.local_id
    join negocios n on n.id = ci.negocio_id
   where ci.id = p_cita;
  if not found then return; end if;
  select * into a from ajustes where negocio_id = c.negocio_id;
  v_cuando := format('%s a las %s', fecha_larga(c.fecha), hhmm(c.hora_inicio));

  if p_tipo = 'confirmacion' then
    v_asunto := format('Tu reserva en %s', c.negocio);
    v_cuerpo := format('Hola %s, tu reserva en %s quedó agendada: %s con %s el %s.%s Te esperamos en %s. Desde tu '
      || 'enlace puedes confirmarla, cambiar la hora o cancelarla.', c.c_nombre, c.negocio, c.servicio, c.profesional,
      v_cuando, p_extra, coalesce(c.direccion, 'el local'));
  elsif p_tipo = 'cambio' then
    v_asunto := format('Cambió tu reserva en %s', c.negocio);
    v_cuerpo := format('Hola %s, tu reserva en %s cambió. Ahora es: %s con %s el %s.%s', c.c_nombre, c.negocio,
      c.servicio, c.profesional, v_cuando, p_extra);
  elsif p_tipo = 'calificacion' then
    v_asunto := format('¿Cómo te atendió %s?', c.profesional);
    v_cuerpo := format('Hola %s, gracias por venir a %s. ¿Cómo te atendió %s? Califícalo de 1 a 5 estrellas desde '
      || 'tu enlace; solo lo ve el negocio.', c.c_nombre, c.negocio, c.profesional);
  else
    v_asunto := format('Reserva cancelada en %s', c.negocio);
    v_cuerpo := format('Hola %s, tu reserva de %s del %s en %s fue cancelada.%s Cuando quieras, puedes agendar de '
      || 'nuevo.', c.c_nombre, c.servicio, v_cuando, c.negocio, p_extra);
  end if;

  foreach v_canal in array array['correo', 'whatsapp']::canal_aviso[] loop
    continue when v_canal = 'correo' and not (a.aviso_correo and c.aviso_correo);
    continue when v_canal = 'whatsapp' and not (a.aviso_whatsapp and c.aviso_whatsapp);
    v_destino := case v_canal when 'correo' then c.c_correo else c.c_telefono end;
    insert into avisos_demo (negocio_id, cita_id, canal, tipo, destinatario, destino, asunto, cuerpo, estado, enlace)
    values (c.negocio_id, c.id, v_canal, p_tipo, c.c_nombre || ' ' || c.c_apellido, v_destino,
            case v_canal when 'correo' then v_asunto end, v_cuerpo,
            case when v_destino is null then 'sin_contacto' else 'enviado' end, '/cita/' || c.token);
  end loop;
end;
$$;

create or replace function public.programar_recordatorios(p_cita uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  c record;
  a ajustes;
  v_canal canal_aviso;
  v_destino text;
  v_cuando timestamptz;
begin
  delete from avisos_demo where cita_id = p_cita and tipo = 'recordatorio' and estado in ('programado', 'omitido');
  select ci.*, cl.nombre as c_nombre, cl.apellido as c_apellido, cl.correo as c_correo, cl.telefono as c_telefono,
         s.nombre as servicio, p.nombre as profesional, n.nombre as negocio, l.zona_horaria
    into c
    from citas ci join clientes cl on cl.id = ci.cliente_id join servicios s on s.id = ci.servicio_id
    join profesionales p on p.id = ci.profesional_id join locales l on l.id = ci.local_id
    join negocios n on n.id = ci.negocio_id
   where ci.id = p_cita;
  if not found or c.estado = 'cancelado' then return; end if;
  select * into a from ajustes where negocio_id = c.negocio_id;

  foreach v_canal in array array['correo', 'whatsapp']::canal_aviso[] loop
    continue when v_canal = 'correo' and not (a.recordatorio_correo and c.aviso_correo);
    continue when v_canal = 'whatsapp' and not (a.recordatorio_whatsapp and c.aviso_whatsapp);
    v_destino := case v_canal when 'correo' then c.c_correo else c.c_telefono end;
    continue when v_destino is null; -- sin contacto no se programa nada
    v_cuando := case v_canal
      when 'correo' then ((c.fecha - a.recordatorio_correo_dias) + a.recordatorio_correo_hora) at time zone c.zona_horaria
      else ((c.fecha - a.recordatorio_whatsapp_dias) + a.recordatorio_whatsapp_hora) at time zone c.zona_horaria end;
    continue when v_cuando <= now(); -- se agendó después de la hora de envío
    insert into avisos_demo (negocio_id, cita_id, canal, tipo, destinatario, destino, asunto, cuerpo,
                             programado_para, estado, enlace)
    values (c.negocio_id, c.id, v_canal, 'recordatorio', c.c_nombre || ' ' || c.c_apellido, v_destino,
            case v_canal when 'correo' then format('Recordatorio de tu reserva en %s', c.negocio) end,
            format('Hola %s, te recordamos tu reserva en %s: %s con %s el %s a las %s. Responde SÍ para confirmar.',
                   c.c_nombre, c.negocio, c.servicio, c.profesional, fecha_larga(c.fecha), hhmm(c.hora_inicio)),
            v_cuando,
            -- El WhatsApp no sale si la cita ya está confirmada.
            case when v_canal = 'whatsapp' and c.estado = 'confirmado' then 'omitido' else 'programado' end,
            '/cita/' || c.token);
  end loop;
end;
$$;

-- Al quedar en "Asiste", se le pide al cliente que califique (una sola vez por reserva).
create or replace function public.citas_pedir_calificacion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'asiste' and old.estado is distinct from 'asiste'
     and not exists (select 1 from avisos_demo
                      where tipo = 'calificacion' and cita_id = any(grupo_reserva(new.id))) then
    perform avisar_cita(new.id, 'calificacion');
  end if;
  return null;
end;
$$;
create trigger citas_calificacion after update of estado on citas
  for each row execute function citas_pedir_calificacion();

-- Confirmar: pasa a Confirmado y el recordatorio de WhatsApp ya no sale (como cambiar_estado_cita).
create or replace function public.confirmar_cita_base(p_cita uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update citas set estado = 'confirmado' where id = p_cita and estado = 'reservado';
  update avisos_demo set estado = 'omitido'
   where cita_id = p_cita and tipo = 'recordatorio' and canal = 'whatsapp' and estado = 'programado';
end;
$$;

-- Funciones públicas -------------------------------------------------------------------------
create or replace function public.publico_error(p_code text, p_message text, p_field text default null)
returns jsonb
language sql immutable set search_path = public as $$
  select jsonb_build_object('ok', false, 'error',
    jsonb_strip_nulls(jsonb_build_object('code', p_code, 'message', p_message, 'field', p_field)));
$$;

-- Portada: negocio, local, horario, servicios en línea por categoría y profesionales con lo que hacen.
create or replace function public.publico_negocio(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  n negocios;
  l locales;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9-]{3,40}$' then return null; end if;
  select * into n from negocios where slug = p_slug;
  if not found then return null; end if;
  select * into l from locales where negocio_id = n.id and activo order by created_at limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'negocio', jsonb_build_object('nombre', n.nombre, 'descripcion', n.descripcion, 'logo', n.logo_url, 'slug', n.slug),
    'local', jsonb_build_object('nombre', l.nombre, 'direccion', l.direccion, 'telefono', l.telefono,
      'whatsapp', l.acepta_whatsapp, 'portada', l.portada_url, 'zona', l.zona_horaria,
      'recibeReservas', l.reservas_en_linea),
    'horario', (select coalesce(jsonb_agg(jsonb_build_object('dia', h.dia_semana, 'abierto', h.abierto,
                  'inicio', hhmm(h.inicio), 'fin', hhmm(h.fin)) order by h.dia_semana), '[]'::jsonb)
                  from horarios_local h where h.local_id = l.id),
    'servicios', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'nombre', s.nombre,
                    'descripcion', s.descripcion, 'categoria', c.nombre, 'duracion', s.duracion_min,
                    'mostrarDuracion', s.mostrar_duracion, 'precio', case when s.mostrar_precio then s.precio end,
                    'imagen', s.imagenes[1]) order by c.orden, c.nombre, s.orden, s.nombre), '[]'::jsonb)
                    from servicios s join categorias c on c.id = s.categoria_id
                   where s.negocio_id = n.id and s.activo and s.en_linea
                     and exists (select 1 from servicio_profesional sp join profesionales p on p.id = sp.profesional_id
                                  where sp.servicio_id = s.id and p.activo and p.local_id = l.id)),
    'profesionales', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre,
                        'foto', p.foto_url, 'color', p.color,
                        'servicios', (select coalesce(jsonb_agg(sp.servicio_id), '[]'::jsonb)
                                        from servicio_profesional sp where sp.profesional_id = p.id))
                        order by p.orden, p.nombre), '[]'::jsonb)
                        from profesionales p where p.local_id = l.id and p.activo));
end;
$$;

-- Paso "Fecha y hora": días con horas libres para esos servicios con ese profesional (o cualquiera).
create or replace function public.publico_disponibilidad(
  p_slug text, p_servicios uuid[], p_profesional uuid, p_desde date, p_dias int
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb := plan_reserva(p_slug, p_servicios, p_profesional);
begin
  if v is null then return null; end if;
  return dias_libres((v->>'localId')::uuid, array(select jsonb_array_elements_text(v->'profesionales')::uuid),
                     (v->>'duracion')::int, p_desde, p_dias);
end;
$$;

-- Reservar: revalida la hora con un candado por local y día (dos personas, la misma hora: solo una queda),
-- reutiliza al cliente por correo o teléfono y deja las citas seguidas, con origen "en línea", y sus avisos.
create or replace function public.publico_reservar(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_nombre text := btrim(coalesce(p->>'nombre', ''));
  v_apellido text := btrim(coalesce(p->>'apellido', ''));
  v_correo text := lower(btrim(coalesce(p->>'correo', '')));
  v_tel text := btrim(coalesce(p->>'telefono', ''));
  v_nota text := nullif(btrim(coalesce(p->>'nota', '')), '');
  v_servicios uuid[];
  v_pedido uuid;
  v_fecha date;
  v_hora time;
  v_plan jsonb;
  v_negocio uuid;
  v_local uuid;
  v_dur int;
  v_ahora timestamp;
  v_prof uuid;
  v_cliente uuid;
  v_reserva uuid := gen_random_uuid();
  v_t time;
  v_ids uuid[] := '{}';
  v_nuevo uuid;
  s record;
begin
  if p->'autoriza' is distinct from 'true'::jsonb then
    return publico_error('VALIDACION', 'Debes autorizar el uso de tus datos', 'autoriza');
  end if;
  if char_length(v_nombre) not between 1 and 60 then return publico_error('VALIDACION', 'Escribe tu nombre', 'nombre'); end if;
  if char_length(v_apellido) not between 1 and 60 then
    return publico_error('VALIDACION', 'Escribe tu apellido', 'apellido');
  end if;
  if char_length(v_correo) > 120 or v_correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return publico_error('VALIDACION', 'El correo no es válido', 'correo');
  end if;
  if v_tel !~ '^\+[0-9]{8,15}$' then return publico_error('VALIDACION', 'El teléfono no es válido', 'telefono'); end if;
  if char_length(coalesce(v_nota, '')) > 500 then return publico_error('VALIDACION', 'Máximo 500 letras', 'nota'); end if;
  begin
    v_fecha := (p->>'fecha')::date;
    v_hora := (p->>'hora')::time;
    v_pedido := nullif(p->>'profesionalId', '')::uuid;
    v_servicios := array(select jsonb_array_elements_text(p->'servicios')::uuid);
  exception when others then
    return publico_error('VALIDACION', 'Elige los servicios, el día y la hora');
  end;
  if v_fecha is null or v_hora is null or extract(minute from v_hora)::int % 30 <> 0 or extract(second from v_hora) <> 0
  then
    return publico_error('VALIDACION', 'Elige los servicios, el día y la hora');
  end if;

  v_plan := plan_reserva(p->>'slug', v_servicios, v_pedido);
  if v_plan is null or jsonb_array_length(v_plan->'profesionales') = 0 then
    return publico_error('NO_DISPONIBLE', 'Este negocio no recibe esa reserva en línea');
  end if;
  v_negocio := (v_plan->>'negocioId')::uuid;
  v_local := (v_plan->>'localId')::uuid;
  v_dur := (v_plan->>'duracion')::int;
  v_ahora := now() at time zone (v_plan->>'zona');
  if v_fecha + v_hora < v_ahora + interval '30 minutes' or v_fecha > v_ahora::date + 60 then
    return publico_error('OCUPADA', 'Esa hora ya no está disponible. Elige otra');
  end if;
  -- Freno contra reservas en masa (la acción del servidor tiene otro por navegador).
  if (select count(distinct reserva_id) from citas where negocio_id = v_negocio and reserva_id is not null
         and created_at > now() - interval '10 minutes') >= 40 then
    return publico_error('LIMITE', 'Hay muchas reservas en este momento. Intenta en unos minutos');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_local::text || v_fecha::text, 0));

  -- El que esté libre; con "cualquiera", el que tenga menos citas ese día.
  for s in
    select x.id from jsonb_array_elements_text(v_plan->'profesionales') with ordinality x(id, n)
     order by (select count(*) from citas c
                where c.profesional_id = x.id::uuid and c.fecha = v_fecha and c.estado <> 'cancelado'), x.n
  loop
    if jsonb_array_length(choques_base(v_negocio, null, v_local, s.id::uuid, null, v_fecha, v_hora, v_dur)) = 0 then
      v_prof := s.id::uuid;
      exit;
    end if;
  end loop;
  if v_prof is null then
    return publico_error('OCUPADA', 'Esa hora acaba de ocuparse. Elige otra');
  end if;

  -- Solo es el mismo cliente si coinciden correo y teléfono: con uno solo, cualquiera que lo conozca vería en su
  -- enlace las próximas citas de otra persona. Si no, queda como cliente nuevo (el equipo une duplicados).
  select id into v_cliente from clientes
   where negocio_id = v_negocio and lower(correo) = v_correo and telefono = v_tel
   order by created_at limit 1;
  if v_cliente is null then
    insert into clientes (negocio_id, nombre, apellido, correo, telefono)
    values (v_negocio, v_nombre, v_apellido, v_correo, v_tel) returning id into v_cliente;
  else
    if (select count(distinct reserva_id) from citas
         where cliente_id = v_cliente and reserva_id is not null and estado in ('reservado', 'confirmado')
           and fecha >= v_ahora::date) >= 5 then
      return publico_error('LIMITE', 'Ya tienes 5 reservas pendientes. Cancela una o comunícate con el negocio');
    end if;
    if exists (select 1 from jsonb_array_elements(
                 choques_base(v_negocio, null, v_local, v_prof, v_cliente, v_fecha, v_hora, v_dur)) x
                where x->>'tipo' = 'cita_cliente') then
      return publico_error('CLIENTE_OCUPADO', 'Ya tienes una cita a esa hora. Elige otra');
    end if;
  end if;

  v_t := v_hora;
  for s in
    select sv.id, sv.duracion_min, sv.precio, u.n
      from unnest(v_servicios) with ordinality u(id, n) join servicios sv on sv.id = u.id order by u.n
  loop
    insert into citas (negocio_id, local_id, cliente_id, profesional_id, servicio_id, fecha, hora_inicio,
                       duracion_min, estado, origen, precio, profesional_fijo, nota_cliente, reserva_id)
    values (v_negocio, v_local, v_cliente, v_prof, s.id, v_fecha, v_t, s.duracion_min, 'reservado', 'en_linea',
            s.precio, v_pedido is not null, case when s.n = 1 then v_nota end, v_reserva)
    returning id into v_nuevo;
    v_ids := v_ids || v_nuevo;
    v_t := v_t + make_interval(mins => s.duracion_min);
    perform programar_recordatorios(v_nuevo);
  end loop;
  perform avisar_cita(v_ids[1], 'confirmacion', detalle_reserva(v_ids));
  return jsonb_build_object('ok', true, 'token', (select token from citas where id = v_ids[1]));
end;
$$;

-- Enlace personal: la reserva, qué puede hacer el cliente y sus próximas citas (solo las suyas).
create or replace function public.publico_cita(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c record;
  v_ids uuid[];
  v_ahora timestamp;
  v_inicio timestamp;
  v_fin timestamp;
  v_futura boolean;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then return null; end if;
  select ci.*, cl.nombre as c_nombre, p.nombre as profesional, p.foto_url, p.color, n.nombre as negocio, n.slug,
         n.logo_url, l.nombre as local, l.direccion, l.telefono as l_telefono, l.zona_horaria
    into c
    from citas ci join clientes cl on cl.id = ci.cliente_id join profesionales p on p.id = ci.profesional_id
    join locales l on l.id = ci.local_id join negocios n on n.id = ci.negocio_id
   where ci.token = p_token;
  if not found then return null; end if;
  v_ids := grupo_reserva(c.id);
  select min(fecha + hora_inicio), max(fecha + hora_fin) into v_inicio, v_fin from citas where id = any(v_ids);
  v_ahora := now() at time zone c.zona_horaria;
  v_futura := v_inicio > v_ahora;
  return jsonb_build_object(
    'token', c.token, 'estado', c.estado, 'fecha', v_inicio::date, 'inicio', to_char(v_inicio, 'HH24:MI'),
    'fin', to_char(v_fin, 'HH24:MI'), 'duracion', (extract(epoch from v_fin - v_inicio) / 60)::int,
    'cliente', c.c_nombre,
    -- Al cliente solo le llega su propio motivo; la nota del equipo al cancelar es interna.
    'avisoCancelacion', case when c.estado <> 'cancelado' then null
                             when c.motivo_cancelacion like 'Cancelada por el cliente%'
                               then 'La cancelaste' || coalesce(nullif(substr(c.motivo_cancelacion, 25), ''), '.')
                             else 'El negocio canceló esta cita. Si quieres, agenda otra hora.' end,
    'servicios', (select jsonb_agg(jsonb_build_object('nombre', s.nombre, 'inicio', hhmm(x.hora_inicio),
                    'fin', hhmm(x.hora_fin), 'precio', case when s.mostrar_precio then x.precio end)
                    order by x.fecha, x.hora_inicio)
                    from citas x join servicios s on s.id = x.servicio_id where x.id = any(v_ids)),
    'profesional', jsonb_build_object('nombre', c.profesional, 'foto', c.foto_url, 'color', c.color),
    'negocio', jsonb_build_object('nombre', c.negocio, 'slug', c.slug, 'logo', c.logo_url),
    'local', jsonb_build_object('nombre', c.local, 'direccion', c.direccion, 'telefono', c.l_telefono,
                                'zona', c.zona_horaria),
    'puedeConfirmar', v_futura and c.estado = 'reservado',
    'puedeCambiar', v_futura and c.estado in ('reservado', 'confirmado'),
    'puedeCancelar', v_futura and c.estado in ('reservado', 'confirmado'),
    'puedeCalificar', c.estado = 'asiste' and c.fecha >= v_ahora::date - 30
                      and not exists (select 1 from calificaciones where cita_id = any(v_ids)),
    'calificacion', (select jsonb_build_object('estrellas', k.estrellas, 'comentario', k.comentario)
                       from calificaciones k where k.cita_id = any(v_ids) limit 1),
    'proximas', (select coalesce(jsonb_agg(jsonb_build_object('token', o.token, 'fecha', o.fecha,
                   'inicio', hhmm(o.hora_inicio), 'servicio', sv.nombre, 'profesional', pr.nombre, 'estado', o.estado)
                   order by o.fecha, o.hora_inicio), '[]'::jsonb)
                   -- Una fila por reserva (la primera cita de cada una), las 5 más cercanas.
                   from (select d.* from (select distinct on (coalesce(x.reserva_id, x.id)) x.*
                                            from citas x
                                           where x.cliente_id = c.cliente_id and x.id <> all(v_ids)
                                             and x.estado <> 'cancelado' and x.fecha + x.hora_inicio > v_ahora
                                           order by coalesce(x.reserva_id, x.id), x.fecha, x.hora_inicio) d
                          order by d.fecha, d.hora_inicio limit 5) o
                   join servicios sv on sv.id = o.servicio_id join profesionales pr on pr.id = o.profesional_id));
end;
$$;

create or replace function public.publico_confirmar_cita(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c record;
  v_id uuid;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then return publico_error('NO_ENCONTRADA', 'No encontramos esa cita'); end if;
  select ci.id, ci.estado, ci.fecha + ci.hora_inicio > now() at time zone l.zona_horaria as futura into c
    from citas ci join locales l on l.id = ci.local_id where ci.token = p_token for update of ci;
  if not found then return publico_error('NO_ENCONTRADA', 'No encontramos esa cita'); end if;
  if c.estado = 'confirmado' then return jsonb_build_object('ok', true); end if;
  if c.estado <> 'reservado' or not c.futura then
    return publico_error('NO_SE_PUEDE', 'Esta cita ya no se puede confirmar');
  end if;
  foreach v_id in array grupo_reserva(c.id) loop
    perform confirmar_cita_base(v_id);
  end loop;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.publico_cancelar_cita(p_token text, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c record;
  v_ids uuid[];
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then return publico_error('NO_ENCONTRADA', 'No encontramos esa cita'); end if;
  select ci.id, ci.estado, ci.fecha + ci.hora_inicio > now() at time zone l.zona_horaria as futura into c
    from citas ci join locales l on l.id = ci.local_id where ci.token = p_token for update of ci;
  if not found then return publico_error('NO_ENCONTRADA', 'No encontramos esa cita'); end if;
  if c.estado not in ('reservado', 'confirmado') or not c.futura then
    return publico_error('NO_SE_PUEDE', 'Esta cita ya no se puede cancelar');
  end if;
  v_ids := grupo_reserva(c.id);
  update citas set estado = 'cancelado',
         motivo_cancelacion = left('Cancelada por el cliente' || coalesce(': ' || nullif(btrim(p_motivo), ''), ''), 200)
   where id = any(v_ids);
  update avisos_demo set estado = 'omitido'
   where cita_id = any(v_ids) and tipo = 'recordatorio' and estado = 'programado';
  perform avisar_cita(v_ids[1], 'cancelacion', detalle_reserva(v_ids, true));
  return jsonb_build_object('ok', true);
end;
$$;

-- Cambiar fecha u hora: el mismo profesional y la misma duración; la reserva entera se mueve junta.
create or replace function public.publico_horas_cita(p_token text, p_desde date, p_dias int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c citas;
  v_ids uuid[];
  v_dur int;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then return null; end if;
  select * into c from citas where token = p_token and estado in ('reservado', 'confirmado');
  if not found then return null; end if;
  v_ids := grupo_reserva(c.id);
  select (extract(epoch from max(fecha + hora_fin) - min(fecha + hora_inicio)) / 60)::int into v_dur
    from citas where id = any(v_ids);
  return dias_libres(c.local_id, array[c.profesional_id], v_dur, p_desde, p_dias, v_ids);
end;
$$;

create or replace function public.publico_cambiar_cita(p_token text, p_fecha date, p_hora time) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c citas;
  v_ids uuid[];
  v_ahora timestamp;
  v_inicio timestamp;
  v_dur int;
  r record;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then return publico_error('NO_ENCONTRADA', 'No encontramos esa cita'); end if;
  select * into c from citas where token = p_token for update;
  if not found then return publico_error('NO_ENCONTRADA', 'No encontramos esa cita'); end if;
  v_ids := grupo_reserva(c.id);
  select min(fecha + hora_inicio), (extract(epoch from max(fecha + hora_fin) - min(fecha + hora_inicio)) / 60)::int
    into v_inicio, v_dur from citas where id = any(v_ids);
  select now() at time zone zona_horaria into v_ahora from locales where id = c.local_id;
  if c.estado not in ('reservado', 'confirmado') or v_inicio <= v_ahora then
    return publico_error('NO_SE_PUEDE', 'Esta cita ya no se puede cambiar');
  end if;
  if p_fecha is null or p_hora is null or extract(minute from p_hora)::int % 30 <> 0 or extract(second from p_hora) <> 0
     or p_hora + make_interval(mins => v_dur) <= p_hora
     or p_fecha + p_hora < v_ahora + interval '30 minutes' or p_fecha > v_ahora::date + 60 then
    return publico_error('OCUPADA', 'Esa hora ya no está disponible. Elige otra');
  end if;
  if p_fecha + p_hora = v_inicio then return jsonb_build_object('ok', true); end if;

  perform pg_advisory_xact_lock(hashtextextended(c.local_id::text || p_fecha::text, 0));
  for r in
    select x.profesional_id, x.cliente_id, x.duracion_min, (x.fecha + x.hora_inicio) - v_inicio as desfase
      from citas x where x.id = any(v_ids)
  loop
    if jsonb_array_length(choques_base(c.negocio_id, v_ids, c.local_id, r.profesional_id, r.cliente_id, p_fecha,
                                       p_hora + r.desfase, r.duracion_min)) > 0 then
      return publico_error('OCUPADA', 'Esa hora acaba de ocuparse. Elige otra');
    end if;
  end loop;
  update citas x set fecha = p_fecha, hora_inicio = p_hora + ((x.fecha + x.hora_inicio) - v_inicio)
   where x.id = any(v_ids);
  perform programar_recordatorios(u.id) from unnest(v_ids) u(id);
  perform avisar_cita(v_ids[1], 'cambio', detalle_reserva(v_ids));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.publico_calificar(p_token text, p_estrellas int, p_comentario text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c record;
  v_comentario text := nullif(btrim(coalesce(p_comentario, '')), '');
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then return publico_error('NO_ENCONTRADA', 'No encontramos esa cita'); end if;
  if p_estrellas is null or p_estrellas not between 1 and 5 then
    return publico_error('VALIDACION', 'Elige de 1 a 5 estrellas', 'estrellas');
  end if;
  if char_length(coalesce(v_comentario, '')) > 500 then
    return publico_error('VALIDACION', 'Máximo 500 letras', 'comentario');
  end if;
  select ci.id, ci.negocio_id, ci.profesional_id, ci.estado, ci.fecha, (now() at time zone l.zona_horaria)::date as hoy
    into c from citas ci join locales l on l.id = ci.local_id where ci.token = p_token for update of ci;
  if not found then return publico_error('NO_ENCONTRADA', 'No encontramos esa cita'); end if;
  if c.estado <> 'asiste' or c.fecha < c.hoy - 30 then
    return publico_error('NO_SE_PUEDE', 'Esta cita no se puede calificar');
  end if;
  if exists (select 1 from calificaciones where cita_id = any(grupo_reserva(c.id))) then
    return publico_error('YA_CALIFICADA', 'Ya calificaste esta cita');
  end if;
  insert into calificaciones (cita_id, negocio_id, profesional_id, estrellas, comentario)
  values (c.id, c.negocio_id, c.profesional_id, p_estrellas, v_comentario);
  return jsonb_build_object('ok', true);
end;
$$;

-- Buzón de la demo: el equipo simula que el cliente respondió "SÍ" al WhatsApp (confirma y deja la respuesta).
create or replace function public.responder_aviso_demo(p_aviso uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a avisos_demo;
  v_estado estado_cita;
  v_id uuid;
begin
  if mi_negocio() is null or mi_rol() not in ('dueno', 'recepcion') then
    return publico_error('SIN_PERMISO', 'Tu rol no puede usar el buzón');
  end if;
  select * into a from avisos_demo where id = p_aviso and negocio_id = mi_negocio();
  if not found or a.canal <> 'whatsapp' or a.tipo not in ('confirmacion', 'recordatorio') or a.estado <> 'enviado'
     or a.cita_id is null then
    return publico_error('NO_SE_PUEDE', 'A este aviso no se puede responder');
  end if;
  select estado into v_estado from citas where id = a.cita_id for update;
  if v_estado is distinct from 'reservado' then
    return publico_error('NO_SE_PUEDE', 'Esa cita ya no está esperando confirmación');
  end if;
  foreach v_id in array grupo_reserva(a.cita_id) loop
    perform confirmar_cita_base(v_id);
  end loop;
  insert into avisos_demo (negocio_id, cita_id, canal, tipo, destinatario, destino, cuerpo, estado, enlace)
  values (a.negocio_id, a.cita_id, 'whatsapp', 'respuesta', a.destinatario, a.destino, 'SÍ, confirmo mi cita. ¡Gracias!',
          'recibido', a.enlace);
  return jsonb_build_object('ok', true);
end;
$$;

-- Permisos ------------------------------------------------------------------------------------
-- Supabase da por defecto todo a anon en cada tabla y función nueva de public (0001 solo quitó lo que había
-- entonces): se quita lo de las tablas creadas después y el valor por defecto, para que no vuelva a pasar.
grant select on calificaciones to authenticated;
grant all on calificaciones to service_role;
revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate, references, trigger on calificaciones from authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
revoke all on function public.responder_aviso_demo(uuid) from anon;
revoke all on function public.choques_base(uuid, uuid[], uuid, uuid, uuid, date, time, int),
  public.grupo_reserva(uuid), public.detalle_reserva(uuid[], boolean),
  public.horas_libres(uuid, uuid[], int, date, uuid[]), public.dias_libres(uuid, uuid[], int, date, int, uuid[]),
  public.plan_reserva(text, uuid[], uuid), public.confirmar_cita_base(uuid), public.citas_pedir_calificacion()
  from public, anon, authenticated;
revoke all on function public.publico_negocio(text), public.publico_disponibilidad(text, uuid[], uuid, date, int),
  public.publico_reservar(jsonb), public.publico_cita(text), public.publico_confirmar_cita(text),
  public.publico_cancelar_cita(text, text), public.publico_horas_cita(text, date, int),
  public.publico_cambiar_cita(text, date, time), public.publico_calificar(text, int, text),
  public.responder_aviso_demo(uuid) from public;
grant execute on function public.publico_negocio(text), public.publico_disponibilidad(text, uuid[], uuid, date, int),
  public.publico_reservar(jsonb), public.publico_cita(text), public.publico_confirmar_cita(text),
  public.publico_cancelar_cita(text, text), public.publico_horas_cita(text, date, int),
  public.publico_cambiar_cita(text, date, time), public.publico_calificar(text, int, text) to anon, authenticated;
grant execute on function public.responder_aviso_demo(uuid) to authenticated;
