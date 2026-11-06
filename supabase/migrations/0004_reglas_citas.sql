-- 0004_reglas_citas.sql — Reglas de las citas en la base: choques, guardar (con series), estado, cancelar y
-- avisos simulados en el buzón. Lo que debe ser atómico y valer igual en la agenda y en el sitio público vive aquí.

alter table citas add column motivo_cancelacion text check (char_length(motivo_cancelacion) <= 200);

-- Fecha en español sin depender del idioma del servidor: "sábado 31 de octubre".
create or replace function public.fecha_larga(p_fecha date) returns text
language sql immutable set search_path = public as $$
  select (array['lunes','martes','miércoles','jueves','viernes','sábado','domingo'])[extract(isodow from p_fecha)::int]
    || ' ' || extract(day from p_fecha)::int || ' de '
    || (array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre',
              'noviembre','diciembre'])[extract(month from p_fecha)::int];
$$;

create or replace function public.hhmm(p time) returns text
language sql immutable set search_path = public as $$ select to_char(p, 'HH24:MI') $$;

-- Choques --------------------------------------------------------------------------
-- Devuelve lo que choca con una cita propuesta: otras citas del profesional o del cliente, fuera del horario del
-- local o del profesional, descanso y bloqueos. No decide si se puede forzar: eso lo hace guardar_cita.
create or replace function public.choques_cita(
  p_cita uuid, p_local uuid, p_profesional uuid, p_cliente uuid, p_fecha date, p_inicio time, p_duracion int
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_negocio uuid := mi_negocio();
  v_fin time := p_inicio + make_interval(mins => p_duracion);
  v_rango tsrange;
  v_dia int := extract(isodow from p_fecha);
  v_prof text;
  v_out jsonb := '[]'::jsonb;
  hl horarios_local;
  hp horarios_profesional;
  r record;
begin
  if v_negocio is null or mi_rol() not in ('dueno', 'recepcion') then
    raise exception 'SIN_PERMISO' using errcode = '42501';
  end if;
  if v_fin <= p_inicio then
    raise exception 'La cita no puede pasar de la medianoche' using errcode = '22023';
  end if;
  v_rango := tsrange(p_fecha + p_inicio, p_fecha + v_fin, '[)');
  select nombre into v_prof from profesionales where id = p_profesional and negocio_id = v_negocio;

  for r in
    select c.id, cl.nombre || ' ' || cl.apellido as cliente, s.nombre as servicio, c.hora_inicio, c.hora_fin
      from citas c join clientes cl on cl.id = c.cliente_id join servicios s on s.id = c.servicio_id
     where c.negocio_id = v_negocio and c.profesional_id = p_profesional and c.estado <> 'cancelado'
       and c.rango && v_rango and c.id is distinct from p_cita
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
     where c.negocio_id = v_negocio and c.cliente_id = p_cliente and c.profesional_id <> p_profesional
       and c.estado <> 'cancelado' and c.rango && v_rango and c.id is distinct from p_cita
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
     where b.negocio_id = v_negocio and b.profesional_id = p_profesional and b.rango && v_rango
  loop
    v_out := v_out || jsonb_build_object('tipo', 'bloqueo',
      'resumen', format('Bloqueo "%s" de %s a %s', r.motivo, to_char(r.inicio, 'HH24:MI'), to_char(r.fin, 'HH24:MI')));
  end loop;

  return v_out;
end;
$$;

-- ¿Los ajustes dejan agendar encima de estos choques?
create or replace function public.choques_permitidos(p_choques jsonb, a ajustes) returns boolean
language sql immutable set search_path = public as $$
  select coalesce(bool_and(case x->>'tipo'
      when 'cita_profesional' then a.permitir_sobrepuestas
      when 'bloqueo' then a.permitir_sobrepuestas
      when 'cita_cliente' then a.permitir_cliente_doble
      else a.permitir_fuera_horario end), true)
  from jsonb_array_elements(p_choques) x;
$$;

-- Avisos simulados -----------------------------------------------------------------
-- Inserta el aviso inmediato de una cita (confirmación, cambio o cancelación) por cada canal activo.
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
    v_cuerpo := format('Hola %s, tu reserva en %s quedó agendada: %s con %s el %s.%s Te esperamos en %s. Si no '
      || 'puedes asistir, avísanos con tiempo.', c.c_nombre, c.negocio, c.servicio, c.profesional, v_cuando,
      p_extra, coalesce(c.direccion, 'el local'));
  elsif p_tipo = 'cambio' then
    v_asunto := format('Cambió tu reserva en %s', c.negocio);
    v_cuerpo := format('Hola %s, tu reserva en %s cambió. Ahora es: %s con %s el %s.%s', c.c_nombre, c.negocio,
      c.servicio, c.profesional, v_cuando, p_extra);
  else
    v_asunto := format('Reserva cancelada en %s', c.negocio);
    v_cuerpo := format('Hola %s, tu reserva de %s del %s en %s fue cancelada.%s Cuando quieras, puedes agendar de '
      || 'nuevo.', c.c_nombre, c.servicio, v_cuando, c.negocio, p_extra);
  end if;

  foreach v_canal in array array['correo', 'whatsapp']::canal_aviso[] loop
    continue when v_canal = 'correo' and not (a.aviso_correo and c.aviso_correo);
    continue when v_canal = 'whatsapp' and not (a.aviso_whatsapp and c.aviso_whatsapp);
    v_destino := case v_canal when 'correo' then c.c_correo else c.c_telefono end;
    insert into avisos_demo (negocio_id, cita_id, canal, tipo, destinatario, destino, asunto, cuerpo, estado)
    values (c.negocio_id, c.id, v_canal, p_tipo, c.c_nombre || ' ' || c.c_apellido, v_destino,
            case v_canal when 'correo' then v_asunto end, v_cuerpo,
            case when v_destino is null then 'sin_contacto' else 'enviado' end);
  end loop;
end;
$$;

-- Rehace los recordatorios pendientes de una cita según los ajustes (N días antes a la hora fija del local).
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
                             programado_para, estado)
    values (c.negocio_id, c.id, v_canal, 'recordatorio', c.c_nombre || ' ' || c.c_apellido, v_destino,
            case v_canal when 'correo' then format('Recordatorio de tu reserva en %s', c.negocio) end,
            format('Hola %s, te recordamos tu reserva en %s: %s con %s el %s a las %s. Responde SÍ para confirmar.',
                   c.c_nombre, c.negocio, c.servicio, c.profesional, fecha_larga(c.fecha), hhmm(c.hora_inicio)),
            v_cuando,
            -- El WhatsApp no sale si la cita ya está confirmada.
            case when v_canal = 'whatsapp' and c.estado = 'confirmado' then 'omitido' else 'programado' end);
  end loop;
end;
$$;

-- Guardar ------------------------------------------------------------------------------
-- Crea (con serie opcional) o edita (solo esta / esta y las siguientes) revisando choques y ajustes.
-- Con choques y sin "forzar" no guarda nada y los devuelve por fecha. soloRevisar = vista previa de la serie.
create or replace function public.guardar_cita(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_negocio uuid := mi_negocio();
  a ajustes;
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_actual citas;
  v_local uuid := (p->>'localId')::uuid;
  v_cliente uuid := (p->>'clienteId')::uuid;
  v_prof uuid := (p->>'profesionalId')::uuid;
  v_serv uuid := (p->>'servicioId')::uuid;
  v_fecha date := (p->>'fecha')::date;
  v_hora time := (p->>'horaInicio')::time;
  v_dur int := (p->>'duracionMin')::int;
  v_estado estado_cita := coalesce(p->>'estado', 'reservado')::estado_cita;
  v_fijo boolean := coalesce((p->>'profesionalFijo')::boolean, false);
  v_forzar boolean := coalesce((p->>'forzar')::boolean, false);
  v_revisar boolean := coalesce((p->>'soloRevisar')::boolean, false);
  v_alcance text := coalesce(p->>'alcance', 'solo_esta');
  v_hoy date;
  v_planes jsonb := '[]'::jsonb;  -- [{id, fecha}]
  v_revision jsonb := '[]'::jsonb;
  v_todos jsonb := '[]'::jsonb;
  v_ch jsonb;
  v_plan jsonb;
  v_serie uuid;
  v_ids uuid[] := '{}';
  v_nuevo uuid;
  v_veces int;
  v_paso interval;
  v_miembro uuid;
  v_cambio boolean;
  i int;
begin
  if v_negocio is null or mi_rol() not in ('dueno', 'recepcion') then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'SIN_PERMISO',
      'message', 'Tu rol no puede agendar citas'));
  end if;
  if v_estado = 'cancelado' then
    raise exception 'Para cancelar usa cancelar_cita' using errcode = '22023';
  end if;
  if not exists (select 1 from locales where id = v_local and negocio_id = v_negocio)
     or not exists (select 1 from clientes where id = v_cliente and negocio_id = v_negocio)
     or not exists (select 1 from profesionales where id = v_prof and negocio_id = v_negocio)
     or not exists (select 1 from servicios where id = v_serv and negocio_id = v_negocio) then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'VALIDACION',
      'message', 'Revisa el cliente, el profesional y el servicio'));
  end if;

  select * into a from ajustes where negocio_id = v_negocio;
  select (now() at time zone zona_horaria)::date into v_hoy from locales where id = v_local;

  if a.exigir_contacto and exists (select 1 from clientes where id = v_cliente and correo is null and telefono is null) then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'SIN_CONTACTO',
      'message', 'Este cliente necesita correo o teléfono', 'field', 'clienteId'));
  end if;

  if v_id is not null then
    select * into v_actual from citas where id = v_id and negocio_id = v_negocio for update;
    if not found then
      return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'NO_ENCONTRADA',
        'message', 'La cita ya no existe'));
    end if;
    if a.bloquear_pasadas and v_actual.fecha < v_hoy then
      return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'CITA_PASADA',
        'message', 'Las citas pasadas no se pueden editar'));
    end if;
    if v_actual.profesional_fijo and v_fijo and v_prof <> v_actual.profesional_id then
      return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'PROFESIONAL_FIJO',
        'message', format('Esta cita está fijada con %s', (select nombre from profesionales where id = v_actual.profesional_id))));
    end if;
    if v_alcance = 'esta_y_siguientes' and v_actual.serie_id is not null then
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'fecha', fecha + (v_fecha - v_actual.fecha)) order by fecha), '[]')
        into v_planes
        from citas where serie_id = v_actual.serie_id and fecha >= v_actual.fecha and estado <> 'cancelado';
    else
      v_planes := jsonb_build_array(jsonb_build_object('id', v_id, 'fecha', v_fecha));
    end if;
  else
    if a.bloquear_pasadas and v_fecha < v_hoy then
      return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'CITA_PASADA',
        'message', 'No se pueden agendar citas en días pasados', 'field', 'fecha'));
    end if;
    v_veces := coalesce((p->'repetir'->>'veces')::int, 1);
    if v_veces < 1 or v_veces > 12 then
      raise exception 'Repetir va de 2 a 12 veces' using errcode = '22023';
    end if;
    v_paso := case p->'repetir'->>'cada' when 'dos_semanas' then interval '14 days'
                                          when 'mes' then interval '1 month' else interval '7 days' end;
    for i in 0 .. v_veces - 1 loop
      continue when coalesce(p->'omitir', '[]'::jsonb) ? to_char(v_fecha + v_paso * i, 'YYYY-MM-DD');
      v_planes := v_planes || jsonb_build_object('id', null, 'fecha', (v_fecha + v_paso * i)::date);
    end loop;
  end if;

  for v_plan in select * from jsonb_array_elements(v_planes) loop
    v_ch := choques_cita(nullif(v_plan->>'id', '')::uuid, v_local, v_prof, v_cliente, (v_plan->>'fecha')::date, v_hora, v_dur);
    v_revision := v_revision || jsonb_build_object('fecha', v_plan->>'fecha', 'choques', v_ch);
    v_todos := v_todos || v_ch;
  end loop;

  if v_revisar then
    return jsonb_build_object('ok', true, 'revision', v_revision, 'puedeForzar', choques_permitidos(v_todos, a));
  end if;
  if jsonb_array_length(v_planes) = 0 then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'VALIDACION',
      'message', 'No quedó ninguna fecha para agendar'));
  end if;
  if jsonb_array_length(v_todos) > 0 and (not v_forzar or not choques_permitidos(v_todos, a)) then
    return jsonb_build_object('ok', false,
      'choques', (select jsonb_agg(x) from jsonb_array_elements(v_revision) x where jsonb_array_length(x->'choques') > 0),
      'puedeForzar', choques_permitidos(v_todos, a));
  end if;

  select id into v_miembro from miembros where user_id = auth.uid();
  if v_id is null and jsonb_array_length(v_planes) > 1 then v_serie := gen_random_uuid(); end if;

  for v_plan in select * from jsonb_array_elements(v_planes) loop
    if v_id is null then
      insert into citas (negocio_id, local_id, cliente_id, profesional_id, servicio_id, fecha, hora_inicio,
                         duracion_min, estado, origen, precio, profesional_fijo, nota_cliente, nota_interna,
                         aviso_correo, aviso_whatsapp, serie_id, creada_por)
      values (v_negocio, v_local, v_cliente, v_prof, v_serv, (v_plan->>'fecha')::date, v_hora, v_dur, v_estado,
              'agenda', (p->>'precio')::int, v_fijo, nullif(p->>'notaCliente', ''), nullif(p->>'notaInterna', ''),
              coalesce((p->>'avisoCorreo')::boolean, true), coalesce((p->>'avisoWhatsapp')::boolean, true),
              v_serie, v_miembro)
      returning id into v_nuevo;
    else
      v_nuevo := (v_plan->>'id')::uuid;
      update citas set local_id = v_local, cliente_id = v_cliente, profesional_id = v_prof, servicio_id = v_serv,
             fecha = (v_plan->>'fecha')::date, hora_inicio = v_hora, duracion_min = v_dur,
             estado = case when id = v_id then v_estado else estado end,
             precio = (p->>'precio')::int, profesional_fijo = v_fijo,
             nota_cliente = nullif(p->>'notaCliente', ''), nota_interna = nullif(p->>'notaInterna', ''),
             aviso_correo = coalesce((p->>'avisoCorreo')::boolean, true),
             aviso_whatsapp = coalesce((p->>'avisoWhatsapp')::boolean, true)
       where id = v_nuevo;
    end if;
    v_ids := v_ids || v_nuevo;
    perform programar_recordatorios(v_nuevo);
  end loop;

  if v_id is null then
    perform avisar_cita(v_ids[1], 'confirmacion',
      case when array_length(v_ids, 1) > 1 then format(' Se repite %s veces en total.', array_length(v_ids, 1)) else '' end);
  else
    v_cambio := v_actual.fecha <> v_fecha or v_actual.hora_inicio <> v_hora or v_actual.profesional_id <> v_prof;
    if v_cambio then perform avisar_cita(v_id, 'cambio'); end if;
  end if;

  return jsonb_build_object('ok', true, 'citaIds', to_jsonb(v_ids));
end;
$$;

-- Estado con un clic: dueño, recepción o el profesional de la cita. Cancelar va por cancelar_cita.
create or replace function public.cambiar_estado_cita(p_cita uuid, p_estado estado_cita) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v citas;
begin
  if p_estado = 'cancelado' then
    raise exception 'Para cancelar usa cancelar_cita' using errcode = '22023';
  end if;
  select * into v from citas where id = p_cita and negocio_id = mi_negocio() for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'NO_ENCONTRADA', 'message', 'La cita ya no existe'));
  end if;
  if not (mi_rol() in ('dueno', 'recepcion') or (mi_rol() = 'profesional' and v.profesional_id = mi_profesional())) then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'SIN_PERMISO',
      'message', 'Solo puedes cambiar el estado de tus citas'));
  end if;
  update citas set estado = p_estado where id = p_cita;
  if p_estado = 'confirmado' then
    update avisos_demo set estado = 'omitido'
     where cita_id = p_cita and tipo = 'recordatorio' and canal = 'whatsapp' and estado = 'programado';
  elsif v.estado = 'confirmado' then
    update avisos_demo set estado = 'programado'
     where cita_id = p_cita and tipo = 'recordatorio' and canal = 'whatsapp' and estado = 'omitido'
       and programado_para > now();
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Cancelar con alcance de serie; deja la cita (y su historia) en el filtro "Canceladas".
create or replace function public.cancelar_cita(p_cita uuid, p_alcance text, p_motivo text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v citas;
  v_ids uuid[];
begin
  if mi_rol() not in ('dueno', 'recepcion') then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'SIN_PERMISO',
      'message', 'Tu rol no puede cancelar citas'));
  end if;
  select * into v from citas where id = p_cita and negocio_id = mi_negocio() for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'NO_ENCONTRADA', 'message', 'La cita ya no existe'));
  end if;
  select array_agg(id) into v_ids from citas
   where estado <> 'cancelado' and (
     id = p_cita
     or (v.serie_id is not null and serie_id = v.serie_id and p_alcance = 'toda_la_serie')
     or (v.serie_id is not null and serie_id = v.serie_id and p_alcance = 'esta_y_siguientes' and fecha >= v.fecha));
  update citas set estado = 'cancelado', motivo_cancelacion = nullif(left(p_motivo, 200), '') where id = any(v_ids);
  update avisos_demo set estado = 'omitido'
   where cita_id = any(v_ids) and tipo = 'recordatorio' and estado = 'programado';
  perform avisar_cita(p_cita, 'cancelacion',
    case when coalesce(array_length(v_ids, 1), 0) > 1 then format(' También se cancelaron las otras %s fechas de la serie.', array_length(v_ids, 1) - 1) else '' end);
  return jsonb_build_object('ok', true, 'citaIds', to_jsonb(coalesce(v_ids, '{}')));
end;
$$;

-- Permisos de ejecución: las funciones internas no se llaman desde la app.
revoke all on function public.choques_cita(uuid, uuid, uuid, uuid, date, time, int) from public, anon;
revoke all on function public.guardar_cita(jsonb) from public, anon;
revoke all on function public.cambiar_estado_cita(uuid, estado_cita) from public, anon;
revoke all on function public.cancelar_cita(uuid, text, text) from public, anon;
revoke all on function public.avisar_cita(uuid, text, text) from public, anon, authenticated;
revoke all on function public.programar_recordatorios(uuid) from public, anon, authenticated;
grant execute on function public.choques_cita(uuid, uuid, uuid, uuid, date, time, int) to authenticated;
grant execute on function public.guardar_cita(jsonb) to authenticated;
grant execute on function public.cambiar_estado_cita(uuid, estado_cita) to authenticated;
grant execute on function public.cancelar_cita(uuid, text, text) to authenticated;

-- Búsqueda de clientes para la ventana de reserva (respeta RLS: solo dueño y recepción ven clientes).
create or replace function public.buscar_clientes(p_texto text) returns setof clientes
language sql stable set search_path = public as $$
  select * from clientes
   where negocio_id = mi_negocio()
     and length(trim(p_texto)) >= 2
     and ((nombre || ' ' || apellido) ilike '%' || trim(p_texto) || '%'
          or documento ilike trim(p_texto) || '%'
          or correo ilike '%' || trim(p_texto) || '%'
          or (length(regexp_replace(p_texto, '\D', '', 'g')) >= 4
              and telefono like '%' || regexp_replace(p_texto, '\D', '', 'g') || '%'))
   order by apellido, nombre
   limit 8;
$$;
revoke all on function public.buscar_clientes(text) from public, anon;
grant execute on function public.buscar_clientes(text) to authenticated;

-- La agenda también trae desde cuándo es cliente (etiqueta "Nuevo cliente" en la ficha) y el motivo de
-- cancelación. Cambia el tipo de salida, por eso se borra y se vuelve a crear.
drop function public.agenda_citas(uuid, date, date);
create function public.agenda_citas(p_local uuid, p_desde date, p_hasta date)
returns table (
  id uuid, profesional_id uuid, servicio_id uuid, cliente_id uuid,
  cliente_nombre text, cliente_telefono text, cliente_correo text, servicio_nombre text,
  fecha date, hora_inicio time, hora_fin time, duracion_min smallint,
  estado estado_cita, origen origen_cita, precio integer,
  nota_cliente text, nota_interna text, serie_id uuid, profesional_fijo boolean,
  aviso_correo boolean, aviso_whatsapp boolean, cliente_desde timestamptz, motivo_cancelacion text
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
         cl.created_at, c.motivo_cancelacion
    from citas c
    join clientes cl on cl.id = c.cliente_id
    join servicios s on s.id = c.servicio_id
   where c.negocio_id = mi_negocio()
     and c.local_id = p_local
     and c.fecha between p_desde and p_hasta
     and (mi_rol() in ('dueno','recepcion') or c.profesional_id = mi_profesional())
   order by c.fecha, c.hora_inicio;
$$;
revoke execute on function public.agenda_citas(uuid, date, date) from public, anon;
grant execute on function public.agenda_citas(uuid, date, date) to authenticated;
