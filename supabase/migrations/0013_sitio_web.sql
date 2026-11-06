-- 0013_sitio_web.sql · AgedaCol (Fase 8, T-8.6)
-- Ajustes → Sitio web: cuánto antes y hasta cuándo se reserva en línea, si el cliente cancela o cambia desde su
-- enlace (y hasta cuántas horas antes) y la política que ve. Ajustes → Avanzadas: redes sociales del sitio y
-- avisos al equipo cuando un cliente reserva, cambia o cancela en línea (simulados, al buzón).
-- Las funciones públicas se redefinen enteras (copiadas de su versión vigente) con estas reglas; horas_libres no
-- cambia porque también la usa la búsqueda de horas del equipo.

alter table ajustes
  add column web_anticipacion_min smallint not null default 30
    check (web_anticipacion_min in (30, 60, 120, 240, 720, 1440)),
  add column web_dias_max smallint not null default 60 check (web_dias_max in (14, 30, 60, 90, 180)),
  add column web_cliente_cancela boolean not null default true,
  add column web_cliente_cambia boolean not null default true,
  add column web_limite_horas smallint not null default 0 check (web_limite_horas in (0, 2, 4, 12, 24, 48)),
  add column web_politica text not null default '' check (char_length(web_politica) <= 600),
  add column red_instagram text check (red_instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  add column red_facebook text check (red_facebook ~ '^[A-Za-z0-9.]{1,50}$'),
  add column red_tiktok text check (red_tiktok ~ '^[A-Za-z0-9._]{1,24}$'),
  add column aviso_equipo_reserva boolean not null default false,
  add column aviso_equipo_cambios boolean not null default false,
  add column aviso_equipo_correo text check (aviso_equipo_correo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

alter table avisos_demo drop constraint avisos_demo_tipo_check;
alter table avisos_demo add constraint avisos_demo_tipo_check check (tipo in ('confirmacion', 'recordatorio', 'cambio',
  'cancelacion', 'comprobante', 'link_pago', 'invitacion', 'enlace', 'respuesta', 'calificacion', 'campana', 'sellos',
  'plantilla', 'equipo'));

-- Aviso al equipo (al correo de avisos o, si no hay, al del local) cuando un cliente reserva, cambia o cancela
-- desde el sitio. p_ids: las citas de la reserva; la primera es la que se cuenta.
create or replace function public.avisar_equipo(p_ids uuid[], p_que text) returns void
language plpgsql security definer set search_path = public as $$
declare
  c record;
  a ajustes;
  v_destino text;
begin
  select ci.id, ci.negocio_id, ci.fecha, ci.hora_inicio, cl.nombre || ' ' || cl.apellido as cliente,
         s.nombre as servicio, p.nombre as profesional, l.correo
    into c
    from citas ci join clientes cl on cl.id = ci.cliente_id join servicios s on s.id = ci.servicio_id
    join profesionales p on p.id = ci.profesional_id join locales l on l.id = ci.local_id
   where ci.id = p_ids[1];
  if not found then return; end if;
  select * into a from ajustes where negocio_id = c.negocio_id;
  if (p_que = 'reserva' and not a.aviso_equipo_reserva) or (p_que <> 'reserva' and not a.aviso_equipo_cambios) then
    return;
  end if;
  v_destino := coalesce(a.aviso_equipo_correo, c.correo);
  if v_destino is null then return; end if;
  insert into avisos_demo (negocio_id, cita_id, canal, tipo, destinatario, destino, asunto, cuerpo)
  values (c.negocio_id, c.id, 'correo', 'equipo', 'Equipo del negocio', v_destino,
          case p_que when 'reserva' then 'Nueva reserva en línea' when 'cambio' then 'Un cliente cambió su cita'
                     else 'Un cliente canceló su cita' end,
          format('%s %s en línea: %s el %s a las %s con %s.%s', c.cliente,
                 case p_que when 'reserva' then 'reservó' when 'cambio' then 'movió su cita' else 'canceló su cita' end,
                 c.servicio, to_char(c.fecha, 'DD/MM/YYYY'), to_char(c.hora_inicio, 'HH24:MI'), c.profesional,
                 detalle_reserva(p_ids, p_que = 'cancelacion')));
end;
$$;
revoke all on function public.avisar_equipo(uuid[], text) from public, anon, authenticated;

-- Días con horas libres del sitio: desde la anticipación mínima y hasta los días máximos del ajuste.
CREATE OR REPLACE FUNCTION public.dias_libres(p_local uuid, p_profesionales uuid[], p_duracion integer, p_desde date, p_dias integer, p_excluir uuid[] DEFAULT NULL::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_hoy date;
  v_out jsonb := '[]'::jsonb;
  v_horas jsonb;
  d date;
  a ajustes;
  v_ahora timestamp;
begin
  select (now() at time zone l.zona_horaria)::date, now() at time zone l.zona_horaria into v_hoy, v_ahora
    from locales l where l.id = p_local;
  select aj.* into a from ajustes aj join locales l on l.negocio_id = aj.negocio_id where l.id = p_local;
  for d in
    select generate_series(greatest(coalesce(p_desde, v_hoy), v_hoy),
                           least(greatest(coalesce(p_desde, v_hoy), v_hoy) + least(greatest(coalesce(p_dias, 7), 1), 14) - 1,
                                 v_hoy + a.web_dias_max),
                           interval '1 day')::date
  loop
    select coalesce(jsonb_agg(t.h order by t.h), '[]'::jsonb) into v_horas
      from (select distinct to_char(x.hora, 'HH24:MI') as h
              from horas_libres(p_local, p_profesionales, p_duracion, d, p_excluir) x
             where d + x.hora >= v_ahora + make_interval(mins => a.web_anticipacion_min)) t;
    v_out := v_out || jsonb_build_object('fecha', d,
      'abierto', exists (select 1 from horarios_local
                          where local_id = p_local and dia_semana = extract(isodow from d) and abierto),
      'horas', v_horas);
  end loop;
  return v_out;
end;
$function$;

-- Reservar: la hora respeta la anticipación y los días máximos; avisa al equipo si así está configurado.
CREATE OR REPLACE FUNCTION public.publico_reservar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_reglas ajustes;
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
  select * into v_reglas from ajustes where negocio_id = v_negocio;
  if v_fecha + v_hora < v_ahora + make_interval(mins => v_reglas.web_anticipacion_min)
     or v_fecha > v_ahora::date + v_reglas.web_dias_max then
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
  perform avisar_equipo(v_ids, 'reserva');
  return jsonb_build_object('ok', true, 'token', (select token from citas where id = v_ids[1]));
end;
$function$;

-- Cancelar desde el enlace: solo si el negocio lo permite y antes del límite de horas.
CREATE OR REPLACE FUNCTION public.publico_cancelar_cita(p_token text, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c record;
  v_ids uuid[];
  a ajustes;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then return publico_error('NO_ENCONTRADA', 'No encontramos esa cita'); end if;
  select ci.id, ci.estado, ci.negocio_id, ci.fecha + ci.hora_inicio as inicio,
         now() at time zone l.zona_horaria as ahora into c
    from citas ci join locales l on l.id = ci.local_id where ci.token = p_token for update of ci;
  if not found then return publico_error('NO_ENCONTRADA', 'No encontramos esa cita'); end if;
  if c.estado not in ('reservado', 'confirmado') or c.inicio <= c.ahora then
    return publico_error('NO_SE_PUEDE', 'Esta cita ya no se puede cancelar');
  end if;
  select * into a from ajustes where negocio_id = c.negocio_id;
  if not a.web_cliente_cancela then
    return publico_error('NO_SE_PUEDE', 'Para cancelar esta cita, comunícate con el negocio');
  end if;
  if c.inicio < c.ahora + make_interval(hours => a.web_limite_horas) then
    return publico_error('NO_SE_PUEDE',
      format('En línea se cancela hasta %s horas antes. Comunícate con el negocio', a.web_limite_horas));
  end if;
  v_ids := grupo_reserva(c.id);
  update citas set estado = 'cancelado',
         motivo_cancelacion = left('Cancelada por el cliente' || coalesce(': ' || nullif(btrim(p_motivo), ''), ''), 200)
   where id = any(v_ids);
  update avisos_demo set estado = 'omitido'
   where cita_id = any(v_ids) and tipo = 'recordatorio' and estado = 'programado';
  perform avisar_cita(v_ids[1], 'cancelacion', detalle_reserva(v_ids, true));
  perform avisar_equipo(v_ids, 'cancelacion');
  return jsonb_build_object('ok', true);
end;
$function$;

-- Cambiar desde el enlace: igual que cancelar, y la hora nueva respeta las reglas de la reserva.
CREATE OR REPLACE FUNCTION public.publico_cambiar_cita(p_token text, p_fecha date, p_hora time without time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c citas;
  v_ids uuid[];
  v_ahora timestamp;
  v_inicio timestamp;
  v_dur int;
  r record;
  a ajustes;
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
  select * into a from ajustes where negocio_id = c.negocio_id;
  if not a.web_cliente_cambia then
    return publico_error('NO_SE_PUEDE', 'Para cambiar esta cita, comunícate con el negocio');
  end if;
  if v_inicio < v_ahora + make_interval(hours => a.web_limite_horas) then
    return publico_error('NO_SE_PUEDE',
      format('En línea se cambia hasta %s horas antes. Comunícate con el negocio', a.web_limite_horas));
  end if;
  if p_fecha is null or p_hora is null or extract(minute from p_hora)::int % 30 <> 0 or extract(second from p_hora) <> 0
     or p_hora + make_interval(mins => v_dur) <= p_hora
     or p_fecha + p_hora < v_ahora + make_interval(mins => a.web_anticipacion_min)
     or p_fecha > v_ahora::date + a.web_dias_max then
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
  perform avisar_equipo(v_ids, 'cambio');
  return jsonb_build_object('ok', true);
end;
$function$;

-- El enlace de la cita: puedeCambiar y puedeCancelar ya cuentan las reglas, que van también para explicarlas.
CREATE OR REPLACE FUNCTION public.publico_cita(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c record;
  v_ids uuid[];
  v_ahora timestamp;
  v_inicio timestamp;
  v_fin timestamp;
  v_futura boolean;
  a ajustes;
  v_a_tiempo boolean;
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
  select * into a from ajustes where negocio_id = c.negocio_id;
  v_a_tiempo := v_inicio >= v_ahora + make_interval(hours => a.web_limite_horas);
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
    'puedeCambiar', v_futura and c.estado in ('reservado', 'confirmado') and a.web_cliente_cambia and v_a_tiempo,
    'puedeCancelar', v_futura and c.estado in ('reservado', 'confirmado') and a.web_cliente_cancela and v_a_tiempo,
    'activa', v_futura and c.estado in ('reservado', 'confirmado'),
    'reglas', jsonb_build_object('cancela', a.web_cliente_cancela, 'cambia', a.web_cliente_cambia,
                                 'limiteHoras', a.web_limite_horas, 'diasMax', a.web_dias_max,
                                 'politica', nullif(a.web_politica, '')),
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
$function$;

-- El sitio: además, las reglas de la reserva y las redes sociales.
CREATE OR REPLACE FUNCTION public.publico_negocio(p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  n negocios;
  l locales;
  a ajustes;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9-]{3,40}$' then return null; end if;
  select * into n from negocios where slug = p_slug;
  if not found then return null; end if;
  select * into l from locales where negocio_id = n.id and activo order by created_at limit 1;
  if not found then return null; end if;
  select * into a from ajustes where negocio_id = n.id;
  return jsonb_build_object(
    'reglas', jsonb_build_object('anticipacionMin', a.web_anticipacion_min, 'diasMax', a.web_dias_max,
      'politica', nullif(a.web_politica, ''), 'limiteHoras', a.web_limite_horas, 'cancela', a.web_cliente_cancela,
      'cambia', a.web_cliente_cambia),
    'redes', jsonb_build_object('instagram', a.red_instagram, 'facebook', a.red_facebook, 'tiktok', a.red_tiktok),
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
$function$;
