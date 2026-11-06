-- 0011_recursos.sql · AgedaCol (Fase 8, T-8.4)
-- Recursos de cada local (salas, sillas, equipos). Un servicio puede usar alguno: al agendar se le asigna el
-- primero libre (o el que se elija a mano) y la cita lo guarda; la agenda se puede ver por recursos. Si el recurso
-- está ocupado es un choque más ("recurso"), que solo se fuerza con el ajuste de sobrecarga de recursos.
-- Varios locales no necesitan tablas nuevas: el dueño ya los crea con la RLS de 0001.

create table public.recursos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  local_id uuid not null references locales(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 2 and 60),
  descripcion text check (char_length(descripcion) <= 200),
  activo boolean not null default true,
  orden smallint not null default 0,
  created_at timestamptz not null default now()
);
create index recursos_local on recursos (local_id);
alter table recursos enable row level security;
create policy "miembros leen" on recursos for select to authenticated using (negocio_id = mi_negocio());
create policy "dueno escribe" on recursos for all to authenticated
  using (negocio_id = mi_negocio() and mi_rol() = 'dueno')
  with check (negocio_id = mi_negocio() and mi_rol() = 'dueno'
              and exists (select 1 from locales l where l.id = local_id and l.negocio_id = mi_negocio()));
revoke all on recursos from public, anon;
grant select, insert, update, delete on recursos to authenticated;

-- Los recursos que puede usar un servicio (vacío = ninguno).
alter table servicios add column recursos uuid[] not null default '{}';
alter table citas add column recurso_id uuid references recursos(id) on delete set null;
create index citas_recurso_fecha on citas (recurso_id, fecha) where recurso_id is not null;
alter table ajustes add column permitir_sobrecarga_recursos boolean not null default false;

-- Reglas ------------------------------------------------------------------------------------------------------
-- La primera cita (no cancelada) que ocupa el recurso en ese rango, sin contar la que se edita.
create or replace function public.recurso_ocupado(p_recurso uuid, p_fecha date, p_hora time, p_dur int,
                                                  p_excluir uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select c.id from citas c
   where c.recurso_id = p_recurso and c.fecha = p_fecha and c.estado <> 'cancelado'
     and c.id is distinct from p_excluir
     and c.hora_inicio < p_hora + make_interval(mins => p_dur) and c.hora_fin > p_hora
   order by c.hora_inicio
   limit 1;
$$;

-- El primer recurso libre de los que usa el servicio en ese local (null si no usa ninguno o no queda libre).
create or replace function public.recurso_libre(p_local uuid, p_servicio uuid, p_fecha date, p_hora time, p_dur int,
                                                p_excluir uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select r.id from servicios s join recursos r on r.id = any(s.recursos)
   where s.id = p_servicio and r.local_id = p_local and r.activo
     and recurso_ocupado(r.id, p_fecha, p_hora, p_dur, p_excluir) is null
   order by r.orden, r.nombre
   limit 1;
$$;

-- Choques de recurso para la revisión de guardar_cita: el elegido está ocupado, o el servicio usa recursos y no
-- queda ninguno libre.
create or replace function public.choques_recurso(p_cita uuid, p_local uuid, p_servicio uuid, p_recurso uuid,
                                                  p_fecha date, p_hora time, p_dur int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_otra uuid;
  v_nombres text;
begin
  if p_recurso is not null then
    v_otra := recurso_ocupado(p_recurso, p_fecha, p_hora, p_dur, p_cita);
    if v_otra is null then return '[]'::jsonb; end if;
    return (select jsonb_build_array(jsonb_build_object('tipo', 'recurso', 'citaId', c.id,
              'resumen', format('%s está ocupado con %s (%s) de %s a %s', r.nombre, cl.nombre || ' ' || cl.apellido,
                                s.nombre, to_char(c.hora_inicio, 'HH24:MI'), to_char(c.hora_fin, 'HH24:MI'))))
              from citas c join clientes cl on cl.id = c.cliente_id join servicios s on s.id = c.servicio_id
              join recursos r on r.id = p_recurso
             where c.id = v_otra);
  end if;
  select string_agg(r.nombre, ', ' order by r.orden, r.nombre) into v_nombres
    from servicios s join recursos r on r.id = any(s.recursos)
   where s.id = p_servicio and r.local_id = p_local and r.activo;
  if v_nombres is null or recurso_libre(p_local, p_servicio, p_fecha, p_hora, p_dur, p_cita) is not null then
    return '[]'::jsonb;
  end if;
  return jsonb_build_array(jsonb_build_object('tipo', 'recurso',
    'resumen', format('No queda libre ningún recurso para este servicio (%s)', v_nombres)));
end;
$$;

create or replace function public.choques_permitidos(p_choques jsonb, a ajustes) returns boolean
language sql immutable set search_path = public as $$
  select coalesce(bool_and(case x->>'tipo'
      when 'cita_profesional' then a.permitir_sobrepuestas
      when 'bloqueo' then a.permitir_sobrepuestas
      when 'cita_cliente' then a.permitir_cliente_doble
      when 'recurso' then a.permitir_sobrecarga_recursos
      else a.permitir_fuera_horario end), true)
  from jsonb_array_elements(p_choques) x;
$$;

-- Asigna el recurso de la cita: un recurso de otro local o inactivo se quita; si el servicio usa recursos y la cita
-- no tiene, toma el primero libre (la reserva en línea también pasa por aquí). Si la cita se mueve y su recurso
-- queda ocupado, cambia a otro libre si hay.
create or replace function public.citas_recurso() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_usa uuid[];
begin
  if new.recurso_id is not null
     and not exists (select 1 from recursos where id = new.recurso_id and local_id = new.local_id and activo) then
    new.recurso_id := null;
  end if;
  select recursos into v_usa from servicios where id = new.servicio_id;
  if new.estado = 'cancelado' or cardinality(v_usa) = 0 then return new; end if;
  if new.recurso_id is null then
    new.recurso_id := recurso_libre(new.local_id, new.servicio_id, new.fecha, new.hora_inicio, new.duracion_min, new.id);
  elsif tg_op = 'UPDATE' and old.recurso_id is not distinct from new.recurso_id
        and recurso_ocupado(new.recurso_id, new.fecha, new.hora_inicio, new.duracion_min, new.id) is not null then
    new.recurso_id := coalesce(
      recurso_libre(new.local_id, new.servicio_id, new.fecha, new.hora_inicio, new.duracion_min, new.id),
      new.recurso_id);
  end if;
  return new;
end;
$$;
create trigger citas_recurso before insert or update of servicio_id, local_id, fecha, hora_inicio, duracion_min,
  recurso_id on citas for each row execute function citas_recurso();

-- guardar_cita (0004) con el recurso: lo valida, revisa sus choques y lo guarda.
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

-- agenda_citas (0009) con el recurso de cada cita.
drop function public.agenda_citas(uuid, date, date);
create function public.agenda_citas(p_local uuid, p_desde date, p_hasta date)
returns table (
  id uuid, profesional_id uuid, servicio_id uuid, cliente_id uuid,
  cliente_nombre text, cliente_telefono text, cliente_correo text, servicio_nombre text,
  fecha date, hora_inicio time, hora_fin time, duracion_min smallint,
  estado estado_cita, origen origen_cita, precio integer,
  nota_cliente text, nota_interna text, serie_id uuid, profesional_fijo boolean,
  aviso_correo boolean, aviso_whatsapp boolean, cliente_desde timestamptz, motivo_cancelacion text,
  venta_id uuid, venta_estado text, bono_id uuid, bono_nombre text, recurso_id uuid
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
         cl.created_at, c.motivo_cancelacion, vt.id, vt.estado::text, c.bono_id, b.nombre, c.recurso_id
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

-- Permisos ----------------------------------------------------------------------------------------------------
revoke all on function public.recurso_ocupado(uuid, date, time, int, uuid) from public, anon, authenticated;
revoke all on function public.recurso_libre(uuid, uuid, date, time, int, uuid) from public, anon, authenticated;
revoke all on function public.choques_recurso(uuid, uuid, uuid, uuid, date, time, int) from public, anon, authenticated;
revoke all on function public.citas_recurso() from public, anon, authenticated;
revoke all on function public.agenda_citas(uuid, date, date) from public, anon;
grant execute on function public.agenda_citas(uuid, date, date) to authenticated;
