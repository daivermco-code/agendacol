-- Fase 8 · Clases con cupo (T-8.3)
-- Una clase es un servicio de tipo 'clase' con cupo. Cada sesión (tabla clases) tiene día, hora, profesional y
-- cupo propio, y la ocupan varios clientes (clase_inscritos). La sesión ocupa al profesional como una cita: las
-- citas y la reserva en línea la ven como bloqueo (choques_base), y la agenda la pinta aparte, en naranja.
-- Un inscrito puede pagar con un plan (bono): cuenta en el cupo del plan igual que una cita.

-- Servicios: el cupo de las clases ------------------------------------------------------------------------------
alter table servicios add column cupo smallint check (cupo between 2 and 100);
alter table servicios add constraint servicios_cupo_clase check ((tipo = 'clase') = (cupo is not null));

-- Sesiones de clase e inscritos -------------------------------------------------------------------------------
create table clases (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  local_id uuid not null references locales(id) on delete cascade,
  servicio_id uuid not null references servicios(id) on delete restrict,
  profesional_id uuid not null references profesionales(id) on delete restrict,
  fecha date not null,
  hora_inicio time not null,
  hora_fin time not null,
  cupo smallint not null check (cupo between 1 and 100),
  precio integer not null check (precio >= 0),
  nota text check (char_length(nota) <= 300),
  cancelada boolean not null default false,
  motivo_cancelacion text check (char_length(motivo_cancelacion) <= 200),
  rango tsrange generated always as (tsrange(fecha + hora_inicio, fecha + hora_fin, '[)')) stored,
  created_at timestamptz not null default now(),
  check (hora_fin > hora_inicio)
);
create index clases_local_fecha on clases (local_id, fecha);
create index clases_profesional_rango on clases using gist (profesional_id, rango) where not cancelada;

create table clase_inscritos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  clase_id uuid not null references clases(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete restrict,
  estado text not null default 'inscrito' check (estado in ('inscrito', 'asiste', 'no_asistio', 'cancelado')),
  bono_id uuid references bonos(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (clase_id, cliente_id)
);
create index clase_inscritos_cliente on clase_inscritos (cliente_id);
create index clase_inscritos_bono on clase_inscritos (bono_id) where bono_id is not null;

alter table clases enable row level security;
alter table clase_inscritos enable row level security;
-- Dueño y recepción ven todas; el profesional, las suyas. Se escriben solo por funciones.
create policy "leen clases" on clases for select to authenticated
  using (negocio_id = mi_negocio() and (mi_rol() in ('dueno', 'recepcion') or profesional_id = mi_profesional()));
create policy "leen inscritos" on clase_inscritos for select to authenticated
  using (negocio_id = mi_negocio() and (mi_rol() in ('dueno', 'recepcion')
         or exists (select 1 from clases k where k.id = clase_id and k.profesional_id = mi_profesional())));
revoke all on clases, clase_inscritos from public, anon, authenticated;
grant select on clases, clase_inscritos to authenticated;
alter publication supabase_realtime add table clases, clase_inscritos;

-- Choques: la clase ocupa al profesional (como bloqueo, para que los ajustes de sobrepuestas valgan igual) -----
-- Cuerpo de 0005 con un recorrido más; p_excluir también deja fuera la propia clase al editarla.
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

  for r in
    select s.nombre, k.hora_inicio, k.hora_fin from clases k join servicios s on s.id = k.servicio_id
     where k.negocio_id = p_negocio and k.profesional_id = p_profesional and not k.cancelada
       and k.rango && v_rango and k.id <> all(v_excluir)
  loop
    v_out := v_out || jsonb_build_object('tipo', 'bloqueo',
      'resumen', format('%s da la clase "%s" de %s a %s', v_prof, r.nombre, hhmm(r.hora_inicio), hhmm(r.hora_fin)));
  end loop;

  return v_out;
end;
$$;

-- Planes: los inscritos de una clase también gastan cupo del plan ---------------------------------------------
create or replace function public.bono_usadas(p_bono uuid, p_servicio uuid default null) returns int
language sql stable security definer set search_path = public as $$
  select (select count(*)::int from citas
           where bono_id = p_bono and estado <> 'cancelado' and (p_servicio is null or servicio_id = p_servicio))
       + (select count(*)::int from clase_inscritos i join clases k on k.id = i.clase_id
           where i.bono_id = p_bono and i.estado <> 'cancelado' and not k.cancelada
             and (p_servicio is null or k.servicio_id = p_servicio));
$$;

create or replace function public.listar_bonos(p_cliente uuid default null)
returns table (id uuid, tipo text, nombre text, cliente_id uuid, cliente text, servicios uuid[], cupo smallint,
               usadas int, inicio date, vence date, anulado boolean, venta text, created_at timestamptz)
language sql stable set search_path = public as $$
  select b.id, b.tipo, b.nombre, b.cliente_id, cl.nombre || ' ' || cl.apellido, b.servicios, b.cupo,
         (select count(*)::int from citas c where c.bono_id = b.id and c.estado <> 'cancelado')
         + (select count(*)::int from clase_inscritos i join clases k on k.id = i.clase_id
             where i.bono_id = b.id and i.estado <> 'cancelado' and not k.cancelada),
         b.inicio, b.vence, b.anulado, v.numero, b.created_at
    from bonos b join clientes cl on cl.id = b.cliente_id left join ventas v on v.id = b.venta_id
   where p_cliente is null or b.cliente_id = p_cliente
   order by b.created_at desc;
$$;

-- Funciones de la app -----------------------------------------------------------------------------------------
create or replace function public.error_clase(p_code text, p_message text, p_field text default null) returns jsonb
language sql immutable as $$
  select jsonb_build_object('ok', false, 'error', jsonb_build_object('code', p_code, 'message', p_message, 'field', p_field));
$$;

-- Crea una clase (y la repite cada semana hasta 12 veces) o edita una sesión. Revisa los choques del profesional:
-- si los ajustes no dejan agendar encima, no guarda y dice el primero.
create or replace function public.guardar_clase(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_negocio uuid := mi_negocio();
  a ajustes;
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_actual clases;
  s servicios;
  v_local uuid := (p->>'localId')::uuid;
  v_prof uuid := (p->>'profesionalId')::uuid;
  v_fecha date := (p->>'fecha')::date;
  v_hora time := (p->>'horaInicio')::time;
  v_cupo int := nullif(p->>'cupo', '')::int;
  v_nota text := nullif(trim(coalesce(p->>'nota', '')), '');
  v_veces int := coalesce(nullif(p->>'veces', '')::int, 1);
  v_hoy date := hoy_bogota();
  v_dia date;
  v_ch jsonb;
  v_ids uuid[] := '{}';
  v_nuevo uuid;
  i int;
begin
  if v_negocio is null or mi_rol() not in ('dueno', 'recepcion') then
    return error_clase('SIN_PERMISO', 'Tu rol no puede crear clases');
  end if;
  if v_id is not null then
    select * into v_actual from clases where id = v_id and negocio_id = v_negocio for update;
    if not found then return error_clase('NO_ENCONTRADA', 'La clase ya no existe'); end if;
    if v_actual.cancelada then return error_clase('CANCELADA', 'La clase está cancelada'); end if;
    v_veces := 1;
  end if;
  select * into s from servicios where id = coalesce(v_actual.servicio_id, (p->>'servicioId')::uuid)
     and negocio_id = v_negocio and tipo = 'clase';
  if not found then return error_clase('VALIDACION', 'Elige una clase del catálogo', 'servicioId'); end if;
  if not exists (select 1 from locales where id = v_local and negocio_id = v_negocio)
     or not exists (select 1 from profesionales where id = v_prof and negocio_id = v_negocio and activo) then
    return error_clase('VALIDACION', 'Revisa el local y el profesional', 'profesionalId');
  end if;
  v_cupo := coalesce(v_cupo, s.cupo);
  if v_cupo < 1 or v_cupo > 100 then return error_clase('VALIDACION', 'El cupo va de 1 a 100', 'cupo'); end if;
  if v_veces < 1 or v_veces > 12 then return error_clase('VALIDACION', 'Se repite de 1 a 12 semanas', 'veces'); end if;
  if v_id is not null and v_cupo < (select count(*) from clase_inscritos where clase_id = v_id and estado <> 'cancelado') then
    return error_clase('VALIDACION', 'El cupo no puede quedar por debajo de los inscritos', 'cupo');
  end if;
  if v_fecha < v_hoy then return error_clase('PASADA', 'No se crean clases en días pasados', 'fecha'); end if;

  select * into a from ajustes where negocio_id = v_negocio;
  for i in 0 .. v_veces - 1 loop
    v_dia := v_fecha + 7 * i;
    v_ch := choques_base(v_negocio, array[v_id], v_local, v_prof, null, v_dia, v_hora, s.duracion_min);
    if jsonb_array_length(v_ch) > 0 and not choques_permitidos(v_ch, a) then
      return error_clase('CHOQUE', format('%s: %s', to_char(v_dia, 'DD/MM'), v_ch->0->>'resumen'), 'horaInicio');
    end if;
  end loop;

  if v_id is not null then
    update clases set local_id = v_local, profesional_id = v_prof, fecha = v_fecha, hora_inicio = v_hora,
                      hora_fin = v_hora + make_interval(mins => s.duracion_min), cupo = v_cupo, nota = v_nota
     where id = v_id;
    return jsonb_build_object('ok', true, 'ids', jsonb_build_array(v_id));
  end if;
  for i in 0 .. v_veces - 1 loop
    insert into clases (negocio_id, local_id, servicio_id, profesional_id, fecha, hora_inicio, hora_fin, cupo, precio,
                        nota)
    values (v_negocio, v_local, s.id, v_prof, v_fecha + 7 * i, v_hora, v_hora + make_interval(mins => s.duracion_min),
            v_cupo, s.precio, v_nota)
    returning id into v_nuevo;
    v_ids := v_ids || v_nuevo;
  end loop;
  return jsonb_build_object('ok', true, 'ids', to_jsonb(v_ids));
end;
$$;

-- Cancela una sesión: los inscritos quedan cancelados y sus planes recuperan la cita.
create or replace function public.cancelar_clase(p_clase uuid, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if mi_rol() is null or mi_rol() not in ('dueno', 'recepcion') then
    return error_clase('SIN_PERMISO', 'Tu rol no puede cancelar clases');
  end if;
  update clases set cancelada = true, motivo_cancelacion = left(nullif(trim(coalesce(p_motivo, '')), ''), 200)
   where id = p_clase and negocio_id = mi_negocio() and not cancelada;
  if not found then return error_clase('NO_ENCONTRADA', 'La clase ya no existe o ya estaba cancelada'); end if;
  update clase_inscritos set estado = 'cancelado' where clase_id = p_clase and estado = 'inscrito';
  return jsonb_build_object('ok', true);
end;
$$;

-- Inscribe a un cliente si hay cupo (o vuelve a inscribir a uno que había cancelado). Con p_bono, lo paga su plan.
create or replace function public.inscribir_clase(p_clase uuid, p_cliente uuid, p_bono uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  k clases;
  b bonos;
  v_cita citas;
  v_previo clase_inscritos;
  v_ocupados int;
  v_motivo text;
begin
  if mi_rol() is null or mi_rol() not in ('dueno', 'recepcion') then
    return error_clase('SIN_PERMISO', 'Tu rol no puede inscribir clientes');
  end if;
  select * into k from clases where id = p_clase and negocio_id = mi_negocio() for update;
  if not found then return error_clase('NO_ENCONTRADA', 'La clase ya no existe'); end if;
  if k.cancelada then return error_clase('CANCELADA', 'La clase está cancelada'); end if;
  if not exists (select 1 from clientes where id = p_cliente and negocio_id = k.negocio_id) then
    return error_clase('VALIDACION', 'Elige un cliente', 'clienteId');
  end if;
  select * into v_previo from clase_inscritos where clase_id = k.id and cliente_id = p_cliente;
  if found and v_previo.estado <> 'cancelado' then
    return error_clase('YA_INSCRITO', 'Ese cliente ya está inscrito', 'clienteId');
  end if;
  select count(*) into v_ocupados from clase_inscritos where clase_id = k.id and estado <> 'cancelado';
  if v_ocupados >= k.cupo then
    return error_clase('CUPO_LLENO', format('La clase está llena (%s de %s)', v_ocupados, k.cupo));
  end if;
  if p_bono is not null then
    select * into b from bonos where id = p_bono and negocio_id = k.negocio_id for update;
    if not found then return error_clase('NO_ENCONTRADA', 'Ese plan ya no existe'); end if;
    v_cita.cliente_id := p_cliente;
    v_cita.fecha := k.fecha;
    v_cita.servicio_id := k.servicio_id;
    v_motivo := bono_no_sirve(b, v_cita);
    if v_motivo is not null then return error_clase('NO_SIRVE', v_motivo, 'bonoId'); end if;
  end if;
  if v_previo.id is not null then
    update clase_inscritos set estado = 'inscrito', bono_id = p_bono, created_at = now() where id = v_previo.id;
  else
    insert into clase_inscritos (negocio_id, clase_id, cliente_id, bono_id) values (k.negocio_id, k.id, p_cliente, p_bono);
  end if;
  return jsonb_build_object('ok', true, 'inscritos', v_ocupados + 1, 'cupo', k.cupo);
end;
$$;

-- Asistencia o cancelación de un inscrito. El profesional marca la asistencia en sus clases.
create or replace function public.estado_inscrito(p_inscrito uuid, p_estado text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  i clase_inscritos;
  k clases;
begin
  select * into i from clase_inscritos where id = p_inscrito and negocio_id = mi_negocio() for update;
  if not found then return error_clase('NO_ENCONTRADA', 'Ese inscrito ya no está'); end if;
  select * into k from clases where id = i.clase_id;
  if not (mi_rol() in ('dueno', 'recepcion')
          or (k.profesional_id = mi_profesional() and p_estado in ('inscrito', 'asiste', 'no_asistio'))) then
    return error_clase('SIN_PERMISO', 'Tu rol no puede cambiar esto');
  end if;
  if p_estado not in ('inscrito', 'asiste', 'no_asistio', 'cancelado') then
    return error_clase('VALIDACION', 'Estado no válido');
  end if;
  if k.cancelada then return error_clase('CANCELADA', 'La clase está cancelada'); end if;
  if i.estado = 'cancelado' and p_estado <> 'cancelado' then
    return inscribir_clase(k.id, i.cliente_id, i.bono_id);
  end if;
  update clase_inscritos set estado = p_estado where id = i.id;
  return jsonb_build_object('ok', true);
end;
$$;

-- Lecturas ----------------------------------------------------------------------------------------------------
-- Sesiones del rango para la agenda, con cuántos inscritos llevan (RLS: el profesional ve las suyas).
create or replace function public.agenda_clases(p_local uuid, p_desde date, p_hasta date)
returns table (id uuid, servicio_id uuid, profesional_id uuid, servicio_nombre text, fecha date, hora_inicio time,
               hora_fin time, cupo smallint, precio int, nota text, cancelada boolean, inscritos int)
language sql stable set search_path = public as $$
  select k.id, k.servicio_id, k.profesional_id, s.nombre, k.fecha, k.hora_inicio, k.hora_fin, k.cupo, k.precio, k.nota,
         k.cancelada,
         (select count(*)::int from clase_inscritos i where i.clase_id = k.id and i.estado <> 'cancelado')
    from clases k join servicios s on s.id = k.servicio_id
   where k.local_id = p_local and k.fecha between p_desde and p_hasta
   order by k.fecha, k.hora_inicio;
$$;

-- Lista de la clase: nombre y estado; el contacto solo para dueño y recepción.
create or replace function public.inscritos_clase(p_clase uuid)
returns table (id uuid, cliente_id uuid, cliente text, telefono text, estado text, bono_id uuid, bono_nombre text)
language sql stable security definer set search_path = public as $$
  select i.id, i.cliente_id, cl.nombre || ' ' || cl.apellido,
         case when mi_rol() in ('dueno', 'recepcion') then cl.telefono end, i.estado, i.bono_id, b.nombre
    from clase_inscritos i
    join clases k on k.id = i.clase_id
    join clientes cl on cl.id = i.cliente_id
    left join bonos b on b.id = i.bono_id
   where i.clase_id = p_clase and k.negocio_id = mi_negocio()
     and (mi_rol() in ('dueno', 'recepcion') or k.profesional_id = mi_profesional())
   order by i.estado = 'cancelado', i.created_at;
$$;

-- Permisos ----------------------------------------------------------------------------------------------------
revoke all on function public.error_clase(text, text, text) from public, anon, authenticated;
revoke all on function public.guardar_clase(jsonb), public.cancelar_clase(uuid, text),
  public.inscribir_clase(uuid, uuid, uuid), public.estado_inscrito(uuid, text), public.agenda_clases(uuid, date, date),
  public.inscritos_clase(uuid), public.listar_bonos(uuid) from public, anon;
grant execute on function public.guardar_clase(jsonb), public.cancelar_clase(uuid, text),
  public.inscribir_clase(uuid, uuid, uuid), public.estado_inscrito(uuid, text), public.agenda_clases(uuid, date, date),
  public.inscritos_clase(uuid), public.listar_bonos(uuid) to authenticated;
