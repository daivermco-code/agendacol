-- 0020 · Integridad de las citas (Fase 11, T-11.1;).
-- Corrige cuatro fallas que existen con red:
--   1. guardar_cita toma la llave de local y día de la reserva en línea antes de revisar choques: dos personas que
--      guardan casi al mismo tiempo ya no dejan dos citas a la misma hora (tampoco una de la agenda y una en línea).
--   2. guardar_cita, con "Bloquear citas pasadas", tampoco deja pasar una cita de hoy o de adelante a un día pasado
--      (antes solo miraba la fecha que la cita tenía).
--   3. cambiar_estado_cita rechaza una cita cancelada (CANCELADA): antes se le podía poner «Confirmado».
--   4. cancelar_cita no le avisa al cliente si no canceló nada.
-- Las tres funciones se copian de su última versión (guardar_cita de la 0011; las otras dos de la 0004) y solo
-- cambia lo marcado con «Nuevo en la 0020».

-- guardar_cita (0011) con la llave por local y día y la fecha nueva revisada.
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
  v_recurso uuid := nullif(p->>'recursoId', '')::uuid;
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
  v_dia date;
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
  if v_recurso is not null and not exists (select 1 from recursos where id = v_recurso and local_id = v_local and activo) then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'VALIDACION',
      'message', 'Ese recurso no está en este local', 'field', 'recursoId'));
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
    -- Nuevo en la 0020: tampoco se mueve una cita de hoy o de adelante a un día pasado (en una serie, la primera
    -- fecha es la de esta cita: las demás se corren lo mismo hacia adelante).
    if a.bloquear_pasadas and v_fecha < v_hoy then
      return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'CITA_PASADA',
        'message', 'No se puede pasar una cita a un día pasado', 'field', 'fecha'));
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

  -- Nuevo en la 0020: una persona a la vez por local y día, con la misma llave de publico_reservar (0013). Sin esto,
  -- dos que guardan casi al mismo tiempo ven la hora libre y quedan dos citas. En una serie, en orden de fecha, para
  -- que dos series no se esperen la una a la otra. Solo al guardar: revisar no cambia nada.
  if not v_revisar then
    for v_dia in select distinct (x->>'fecha')::date from jsonb_array_elements(v_planes) x order by 1 loop
      perform pg_advisory_xact_lock(hashtextextended(v_local::text || v_dia::text, 0));
    end loop;
  end if;

  for v_plan in select * from jsonb_array_elements(v_planes) loop
    v_ch := choques_cita(nullif(v_plan->>'id', '')::uuid, v_local, v_prof, v_cliente, (v_plan->>'fecha')::date, v_hora, v_dur)
         || choques_recurso(nullif(v_plan->>'id', '')::uuid, v_local, v_serv, v_recurso, (v_plan->>'fecha')::date,
                            v_hora, v_dur);
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
      insert into citas (negocio_id, local_id, cliente_id, profesional_id, servicio_id, recurso_id, fecha, hora_inicio,
                         duracion_min, estado, origen, precio, profesional_fijo, nota_cliente, nota_interna,
                         aviso_correo, aviso_whatsapp, serie_id, creada_por)
      values (v_negocio, v_local, v_cliente, v_prof, v_serv, v_recurso, (v_plan->>'fecha')::date, v_hora, v_dur,
              v_estado, 'agenda', (p->>'precio')::int, v_fijo, nullif(p->>'notaCliente', ''),
              nullif(p->>'notaInterna', ''), coalesce((p->>'avisoCorreo')::boolean, true),
              coalesce((p->>'avisoWhatsapp')::boolean, true), v_serie, v_miembro)
      returning id into v_nuevo;
    else
      v_nuevo := (v_plan->>'id')::uuid;
      update citas set local_id = v_local, cliente_id = v_cliente, profesional_id = v_prof, servicio_id = v_serv,
             recurso_id = v_recurso, fecha = (v_plan->>'fecha')::date, hora_inicio = v_hora, duracion_min = v_dur,
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

-- cambiar_estado_cita (0004) sin revivir canceladas.
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
  -- Nuevo en la 0020: una cita cancelada no revive con un clic (se agenda de nuevo).
  if v.estado = 'cancelado' then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'CANCELADA',
      'message', 'Esta cita está cancelada: ya no se le puede cambiar el estado'));
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

-- cancelar_cita (0004) sin avisar dos veces.
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
  -- Nuevo en la 0020: si ya estaba cancelada (otro la canceló antes, o un segundo clic), no se avisa otra vez.
  if v_ids is not null then
    perform avisar_cita(p_cita, 'cancelacion',
      case when array_length(v_ids, 1) > 1 then format(' También se cancelaron las otras %s fechas de la serie.', array_length(v_ids, 1) - 1) else '' end);
  end if;
  return jsonb_build_object('ok', true, 'citaIds', to_jsonb(coalesce(v_ids, '{}')));
end;
$$;

-- Permisos ----------------------------------------------------------------------------------------------------
revoke all on function public.guardar_cita(jsonb) from public, anon;
revoke all on function public.cambiar_estado_cita(uuid, estado_cita) from public, anon;
revoke all on function public.cancelar_cita(uuid, text, text) from public, anon;
grant execute on function public.guardar_cita(jsonb) to authenticated;
grant execute on function public.cambiar_estado_cita(uuid, estado_cita) to authenticated;
grant execute on function public.cancelar_cita(uuid, text, text) to authenticated;
