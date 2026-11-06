-- 0014_mis_citas.sql · AgedaCol (Fase 8, T-8.7)
-- "Mis citas" sin contraseña: el cliente escribe su correo o su celular, le llega (al buzón de la demo) un código de 6
-- números y con él entra 7 días a ver sus citas. Lista de espera: si no ve la hora que quiere, deja sus datos y,
-- cuando una cita de ese día se cancela o se mueve y queda una hora libre, le llega un aviso con el enlace para
-- reservarla.
-- Los códigos y los accesos no tienen políticas ni permisos: solo los tocan las funciones publico_* (security
-- definer). La base guarda el resumen (sha256) del código y del acceso, nunca el valor.

alter table avisos_demo drop constraint avisos_demo_tipo_check;
alter table avisos_demo add constraint avisos_demo_tipo_check check (tipo in ('confirmacion', 'recordatorio', 'cambio',
  'cancelacion', 'comprobante', 'link_pago', 'invitacion', 'enlace', 'respuesta', 'calificacion', 'campana', 'sellos',
  'plantilla', 'equipo', 'codigo', 'espera'));
alter table avisos_demo drop constraint avisos_demo_enlace_check;
alter table avisos_demo add constraint avisos_demo_enlace_check check (enlace ~ '^/cita/[0-9a-f]{32}$'
  or (enlace ~ '^/reservar/[a-z0-9-]{3,40}/hora\?[A-Za-z0-9=&:,_-]+$' and char_length(enlace) <= 700));

create table codigos_acceso (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  canal canal_aviso not null,
  destino text not null,
  codigo_hash text not null,
  intentos smallint not null default 0,
  vence_at timestamptz not null,
  usado_at timestamptz,
  created_at timestamptz not null default now()
);
create index codigos_acceso_destino on codigos_acceso (negocio_id, destino, created_at desc);

create table accesos_cliente (
  token_hash text primary key,
  negocio_id uuid not null references negocios(id) on delete cascade,
  canal canal_aviso not null,
  destino text not null,
  vence_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table lista_espera (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  local_id uuid not null references locales(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  servicios uuid[] not null check (cardinality(servicios) between 1 and 6),
  profesional_id uuid references profesionales(id) on delete cascade,
  fecha date not null,
  franja text not null default 'dia' check (franja in ('dia', 'manana', 'tarde')),
  estado text not null default 'esperando' check (estado in ('esperando', 'avisado', 'quitado')),
  avisado_at timestamptz,
  created_at timestamptz not null default now()
);
create index lista_espera_dia on lista_espera (local_id, fecha) where estado = 'esperando';
create index lista_espera_cliente on lista_espera (cliente_id);

alter table codigos_acceso enable row level security;
alter table accesos_cliente enable row level security;
alter table lista_espera enable row level security;
create policy "equipo lee" on lista_espera for select to authenticated
  using (negocio_id = mi_negocio() and mi_rol() in ('dueno', 'recepcion'));
revoke all on codigos_acceso, accesos_cliente, lista_espera from public, anon, authenticated;
grant select on lista_espera to authenticated;

-- Correo o celular escrito por el cliente → {canal, valor} ('correo' | 'whatsapp'); null si no es ninguno.
-- Un celular de 10 números que empieza por 3 se toma de Colombia (+57).
create or replace function public.contacto_normalizado(p_dato text) returns text[]
language sql immutable set search_path = public as $$
  select case
    when position('@' in coalesce(p_dato, '')) > 0 then
      case when lower(btrim(p_dato)) ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(btrim(p_dato)) <= 120
           then array['correo', lower(btrim(p_dato))] end
    else (select case when t ~ '^\+[0-9]{8,15}$' then array['whatsapp', t]
                      when t ~ '^3[0-9]{9}$' then array['whatsapp', '+57' || t] end
            from (select regexp_replace(coalesce(p_dato, ''), '[\s().-]', '', 'g') as t) x)
  end;
$$;

-- "an•••@ejemplo.test" o "+57 ••• ••• 1234": para decirle a dónde llegó el código sin repetir el dato entero.
create or replace function public.contacto_oculto(p_canal text, p_valor text) returns text
language sql immutable set search_path = public as $$
  select case p_canal
    when 'correo' then left(split_part(p_valor, '@', 1), 2) || '•••@' || split_part(p_valor, '@', 2)
    else left(p_valor, 3) || ' ••• ••• ' || right(p_valor, 4)
  end;
$$;

-- Los clientes del negocio con ese correo o ese celular (el más antiguo primero).
create or replace function public.clientes_de_contacto(p_negocio uuid, p_canal text, p_valor text) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id order by created_at), '{}') from clientes
   where negocio_id = p_negocio
     and case p_canal when 'correo' then lower(correo) = p_valor else telefono = p_valor end;
$$;

-- Acceso vigente por el valor que guarda la cookie del cliente.
create or replace function public.acceso_de(p_token text) returns accesos_cliente
language sql stable security definer set search_path = public as $$
  select * from accesos_cliente
   where coalesce(p_token, '') ~ '^[0-9a-f]{64}$'
     and token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and vence_at > now();
$$;

-- Paso 1 de "Mis citas": manda un código de 6 números (vence en 10 minutos; solo vale el último). Responde igual
-- aunque el dato no sea de ningún cliente, para no revelar quién tiene citas; en ese caso no se envía nada.
create or replace function public.publico_pedir_codigo(p_slug text, p_dato text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  n negocios;
  v_c text[] := contacto_normalizado(p_dato);
  v_id uuid := gen_random_uuid();
  v_codigo text;
  cl record;
begin
  select * into n from negocios where slug = p_slug;
  if not found then return publico_error('NO_ENCONTRADA', 'No encontramos ese negocio'); end if;
  if v_c is null then return publico_error('VALIDACION', 'Escribe tu correo o tu celular', 'dato'); end if;
  if (select count(*) from codigos_acceso where negocio_id = n.id and destino = v_c[2]
        and created_at > now() - interval '1 hour') >= 5 then
    return publico_error('LIMITE', 'Ya pediste 5 códigos en la última hora. Intenta más tarde', 'dato');
  end if;
  if (select count(*) from codigos_acceso where negocio_id = n.id and created_at > now() - interval '10 minutes') >= 100
  then
    return publico_error('LIMITE', 'Hay muchas solicitudes en este momento. Intenta en unos minutos', 'dato');
  end if;

  delete from codigos_acceso where created_at < now() - interval '1 day';
  update codigos_acceso set usado_at = now() where negocio_id = n.id and destino = v_c[2] and usado_at is null;
  v_codigo := lpad((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000)::text, 6, '0');
  insert into codigos_acceso (id, negocio_id, canal, destino, codigo_hash, vence_at)
  values (v_id, n.id, v_c[1]::canal_aviso, v_c[2],
          encode(extensions.digest(v_id::text || v_codigo, 'sha256'), 'hex'), now() + interval '10 minutes');

  select c.nombre, c.apellido into cl from clientes c where c.id = (clientes_de_contacto(n.id, v_c[1], v_c[2]))[1];
  if found then
    insert into avisos_demo (negocio_id, canal, tipo, destinatario, destino, asunto, cuerpo, estado)
    values (n.id, v_c[1]::canal_aviso, 'codigo', cl.nombre || ' ' || cl.apellido, v_c[2],
            case when v_c[1] = 'correo' then format('Tu código de %s', n.nombre) end,
            format('Tu código para ver tus citas en %s es %s. Vence en 10 minutos. Si no lo pediste, ignora este '
              || 'mensaje.', n.nombre, v_codigo), 'enviado');
  end if;
  return jsonb_build_object('ok', true, 'canal', v_c[1], 'destino', contacto_oculto(v_c[1], v_c[2]));
end;
$$;

-- Paso 2: con el código correcto devuelve el valor del acceso (7 días) que la acción guarda en una cookie. Cinco
-- intentos fallidos anulan el código.
create or replace function public.publico_entrar_codigo(p_slug text, p_dato text, p_codigo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  n negocios;
  v_c text[] := contacto_normalizado(p_dato);
  k codigos_acceso;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  select * into n from negocios where slug = p_slug;
  if not found then return publico_error('NO_ENCONTRADA', 'No encontramos ese negocio'); end if;
  if v_c is null then return publico_error('VALIDACION', 'Escribe tu correo o tu celular', 'dato'); end if;
  if coalesce(p_codigo, '') !~ '^[0-9]{6}$' then
    return publico_error('VALIDACION', 'El código tiene 6 números', 'codigo');
  end if;
  select * into k from codigos_acceso
   where negocio_id = n.id and destino = v_c[2] and usado_at is null and vence_at > now()
   order by created_at desc limit 1 for update;
  if not found then
    return publico_error('CODIGO', 'El código ya venció o no es de este correo o celular. Pide uno nuevo', 'codigo');
  end if;
  if k.codigo_hash <> encode(extensions.digest(k.id::text || p_codigo, 'sha256'), 'hex') then
    update codigos_acceso set intentos = intentos + 1, usado_at = case when intentos + 1 >= 5 then now() end
     where id = k.id;
    return publico_error('CODIGO', case when k.intentos + 1 >= 5 then 'Fallaste 5 veces. Pide un código nuevo'
                                        else 'El código no es correcto' end, 'codigo');
  end if;
  update codigos_acceso set usado_at = now() where id = k.id;
  if cardinality(clientes_de_contacto(n.id, v_c[1], v_c[2])) = 0 then
    return publico_error('CODIGO', 'El código ya venció o no es de este correo o celular. Pide uno nuevo', 'codigo');
  end if;
  delete from accesos_cliente where vence_at < now();
  insert into accesos_cliente (token_hash, negocio_id, canal, destino, vence_at)
  values (encode(extensions.digest(v_token, 'sha256'), 'hex'), n.id, v_c[1]::canal_aviso, v_c[2],
          now() + interval '7 days');
  return jsonb_build_object('ok', true, 'token', v_token);
end;
$$;

create or replace function public.publico_salir(p_token text) returns void
language sql security definer set search_path = public as $$
  delete from accesos_cliente where token_hash = (acceso_de(p_token)).token_hash;
$$;

-- Dirección del paso de hora con los servicios (id:cantidad), el profesional y el día de la lista de espera.
create or replace function public.enlace_espera(p_slug text, p_servicios uuid[], p_profesional uuid, p_fecha date)
returns text
language sql immutable set search_path = public as $$
  select format('/reservar/%s/hora?s=%s%s&f=%s', p_slug,
    (select string_agg(x.id::text || ':' || x.n, ',' order by x.primero)
       from (select u.id, count(*) as n, min(u.ord) as primero
               from unnest(p_servicios) with ordinality u(id, ord) group by u.id) x),
    case when p_profesional is not null then '&p=' || p_profesional end, p_fecha);
$$;

-- "Mis citas": próximas (una fila por reserva), historial (las últimas 10) y listas de espera vigentes.
create or replace function public.publico_mis_citas(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  a accesos_cliente := acceso_de(p_token);
  n negocios;
  v_ids uuid[];
  v_ahora timestamp;
begin
  if a.token_hash is null then return null; end if;
  select * into n from negocios where id = a.negocio_id;
  select now() at time zone l.zona_horaria into v_ahora from locales l
   where l.negocio_id = n.id order by l.created_at limit 1;
  v_ids := clientes_de_contacto(n.id, a.canal::text, a.destino);
  return jsonb_build_object(
    'negocio', jsonb_build_object('nombre', n.nombre, 'slug', n.slug, 'logo', n.logo_url),
    'cliente', (select nombre from clientes where id = v_ids[1]),
    'destino', contacto_oculto(a.canal::text, a.destino),
    'proximas', (select coalesce(jsonb_agg(jsonb_build_object('token', o.token, 'fecha', o.fecha,
                   'inicio', hhmm(o.hora_inicio), 'servicio', sv.nombre, 'profesional', pr.nombre, 'estado', o.estado)
                   order by o.fecha, o.hora_inicio), '[]'::jsonb)
                   from (select distinct on (coalesce(x.reserva_id, x.id)) x.* from citas x
                          where x.cliente_id = any(v_ids) and x.estado <> 'cancelado'
                            and x.fecha + x.hora_inicio > v_ahora
                          order by coalesce(x.reserva_id, x.id), x.fecha, x.hora_inicio) o
                   join servicios sv on sv.id = o.servicio_id join profesionales pr on pr.id = o.profesional_id),
    'historial', (select coalesce(jsonb_agg(jsonb_build_object('token', o.token, 'fecha', o.fecha,
                   'inicio', hhmm(o.hora_inicio), 'servicio', sv.nombre, 'profesional', pr.nombre, 'estado', o.estado)
                   order by o.fecha desc, o.hora_inicio desc), '[]'::jsonb)
                   from (select d.* from (select distinct on (coalesce(x.reserva_id, x.id)) x.* from citas x
                                           where x.cliente_id = any(v_ids)
                                             and (x.estado = 'cancelado' or x.fecha + x.hora_inicio <= v_ahora)
                                           order by coalesce(x.reserva_id, x.id), x.fecha, x.hora_inicio) d
                          order by d.fecha desc, d.hora_inicio desc limit 10) o
                   join servicios sv on sv.id = o.servicio_id join profesionales pr on pr.id = o.profesional_id),
    'esperas', (select coalesce(jsonb_agg(jsonb_build_object('id', le.id, 'fecha', le.fecha, 'franja', le.franja,
                  'estado', le.estado, 'profesional', pr.nombre,
                  'servicios', (select string_agg(s.nombre, ' + ' order by u.ord)
                                  from unnest(le.servicios) with ordinality u(id, ord) join servicios s on s.id = u.id),
                  'enlace', enlace_espera(n.slug, le.servicios, le.profesional_id, le.fecha))
                  order by le.fecha, le.created_at), '[]'::jsonb)
                  from lista_espera le left join profesionales pr on pr.id = le.profesional_id
                 where le.cliente_id = any(v_ids) and le.estado in ('esperando', 'avisado')
                   and le.fecha >= v_ahora::date));
end;
$$;

-- Lista de espera desde el sitio: mismos datos y reglas de cliente que la reserva (mismo cliente solo si coinciden
-- correo y celular). Hasta 3 listas por cliente; repetir la misma no crea otra.
create or replace function public.publico_lista_espera(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_nombre text := btrim(coalesce(p->>'nombre', ''));
  v_apellido text := btrim(coalesce(p->>'apellido', ''));
  v_correo text := lower(btrim(coalesce(p->>'correo', '')));
  v_tel text := btrim(coalesce(p->>'telefono', ''));
  v_franja text := coalesce(p->>'franja', '');
  v_servicios uuid[];
  v_pedido uuid;
  v_fecha date;
  v_plan jsonb;
  v_negocio uuid;
  v_hoy date;
  v_cliente uuid;
  a ajustes;
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
  if v_franja not in ('dia', 'manana', 'tarde') then
    return publico_error('VALIDACION', 'Elige en qué parte del día', 'franja');
  end if;
  begin
    v_fecha := (p->>'fecha')::date;
    v_pedido := nullif(p->>'profesionalId', '')::uuid;
    v_servicios := array(select jsonb_array_elements_text(p->'servicios')::uuid);
  exception when others then
    return publico_error('VALIDACION', 'Elige los servicios y el día');
  end;
  if v_fecha is null then return publico_error('VALIDACION', 'Elige los servicios y el día'); end if;

  v_plan := plan_reserva(p->>'slug', v_servicios, v_pedido);
  if v_plan is null or jsonb_array_length(v_plan->'profesionales') = 0 then
    return publico_error('NO_DISPONIBLE', 'Este negocio no recibe esa reserva en línea');
  end if;
  v_negocio := (v_plan->>'negocioId')::uuid;
  v_hoy := (now() at time zone (v_plan->>'zona'))::date;
  select * into a from ajustes where negocio_id = v_negocio;
  if v_fecha < v_hoy or v_fecha > v_hoy + a.web_dias_max then
    return publico_error('VALIDACION', format('Elige un día entre hoy y los próximos %s días', a.web_dias_max));
  end if;
  if (select count(*) from lista_espera where negocio_id = v_negocio and created_at > now() - interval '10 minutes')
     >= 40 then
    return publico_error('LIMITE', 'Hay muchas solicitudes en este momento. Intenta en unos minutos');
  end if;

  select id into v_cliente from clientes
   where negocio_id = v_negocio and lower(correo) = v_correo and telefono = v_tel
   order by created_at limit 1;
  if v_cliente is null then
    insert into clientes (negocio_id, nombre, apellido, correo, telefono)
    values (v_negocio, v_nombre, v_apellido, v_correo, v_tel) returning id into v_cliente;
  else
    if exists (select 1 from lista_espera where cliente_id = v_cliente and fecha = v_fecha and estado = 'esperando'
                 and servicios = v_servicios and profesional_id is not distinct from v_pedido) then
      return jsonb_build_object('ok', true);
    end if;
    if (select count(*) from lista_espera where cliente_id = v_cliente and estado = 'esperando' and fecha >= v_hoy)
       >= 3 then
      return publico_error('LIMITE', 'Ya estás en 3 listas de espera. Quita una desde Mis citas');
    end if;
  end if;
  insert into lista_espera (negocio_id, local_id, cliente_id, servicios, profesional_id, fecha, franja)
  values (v_negocio, (v_plan->>'localId')::uuid, v_cliente, v_servicios, v_pedido, v_fecha, v_franja);
  return jsonb_build_object('ok', true);
end;
$$;

-- El cliente se quita de una lista de espera desde "Mis citas".
create or replace function public.publico_quitar_espera(p_token text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a accesos_cliente := acceso_de(p_token);
begin
  if a.token_hash is null then
    return publico_error('SIN_ACCESO', 'Tu acceso venció. Entra de nuevo con un código');
  end if;
  update lista_espera set estado = 'quitado'
   where id = p_id and estado in ('esperando', 'avisado')
     and cliente_id = any(clientes_de_contacto(a.negocio_id, a.canal::text, a.destino));
  if not found then return publico_error('NO_ENCONTRADA', 'Ya no estás en esa lista de espera'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Cuando queda libre una hora de ese día, avisa (correo y WhatsApp, según los ajustes del negocio) a quienes
-- esperan algo que ya cabe, en el orden en que se anotaron, y los marca como avisados.
create or replace function public.avisar_lista_espera(p_local uuid, p_fecha date) returns void
language plpgsql security definer set search_path = public as $$
declare
  e record;
  a ajustes;
  v_dur int;
  v_nombres text;
  v_profs uuid[];
  v_horas text[];
  v_cuerpo text;
  v_canal canal_aviso;
  v_destino text;
begin
  if not exists (select 1 from lista_espera where local_id = p_local and fecha = p_fecha and estado = 'esperando') then
    return;
  end if;
  for e in
    select le.*, cl.nombre, cl.apellido, cl.correo, cl.telefono, n.nombre as negocio, n.slug
      from lista_espera le join clientes cl on cl.id = le.cliente_id join negocios n on n.id = le.negocio_id
     where le.local_id = p_local and le.fecha = p_fecha and le.estado = 'esperando'
     order by le.created_at
  loop
    select sum(s.duracion_min), string_agg(s.nombre, ' + ' order by u.ord) into v_dur, v_nombres
      from unnest(e.servicios) with ordinality u(id, ord) join servicios s on s.id = u.id and s.activo;
    continue when v_dur is null;
    select array_agg(p.id) into v_profs from profesionales p
     where p.local_id = p_local and p.activo and (e.profesional_id is null or p.id = e.profesional_id)
       and not exists (select 1 from unnest(e.servicios) u(id)
                        where not exists (select 1 from servicio_profesional sp
                                           where sp.servicio_id = u.id and sp.profesional_id = p.id));
    continue when v_profs is null;
    select array_agg(h order by h) into v_horas
      from jsonb_array_elements_text(dias_libres(p_local, v_profs, v_dur, p_fecha, 1)->0->'horas') h
     where e.franja = 'dia' or (e.franja = 'manana' and h < '12:00') or (e.franja = 'tarde' and h >= '12:00');
    continue when v_horas is null;

    update lista_espera set estado = 'avisado', avisado_at = now() where id = e.id;
    select * into a from ajustes where negocio_id = e.negocio_id;
    v_cuerpo := format('Hola %s, se liberó una hora en %s para %s el %s a las %s%s. Resérvala desde el enlace antes '
      || 'de que alguien más la tome.', e.nombre, e.negocio, v_nombres, fecha_larga(p_fecha),
      array_to_string(v_horas[1:3], ', '), case when cardinality(v_horas) > 3 then ' y otras horas' else '' end);
    foreach v_canal in array array['correo', 'whatsapp']::canal_aviso[] loop
      continue when v_canal = 'correo' and not a.aviso_correo;
      continue when v_canal = 'whatsapp' and not a.aviso_whatsapp;
      v_destino := case v_canal when 'correo' then e.correo else e.telefono end;
      insert into avisos_demo (negocio_id, canal, tipo, destinatario, destino, asunto, cuerpo, estado, enlace)
      values (e.negocio_id, v_canal, 'espera', e.nombre || ' ' || e.apellido, v_destino,
              case v_canal when 'correo' then format('Se liberó una hora en %s', e.negocio) end, v_cuerpo,
              case when v_destino is null then 'sin_contacto' else 'enviado' end,
              enlace_espera(e.slug, e.servicios, e.profesional_id, p_fecha));
    end loop;
  end loop;
end;
$$;

-- Una cita de hoy en adelante que se cancela, se mueve o se borra deja su hora libre: se revisa la lista de espera
-- de ese día.
create or replace function public.citas_libera_hora() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.estado = 'cancelado' then return null; end if;
  if tg_op = 'UPDATE' and new.estado <> 'cancelado' and new.fecha = old.fecha and new.hora_inicio = old.hora_inicio
     and new.duracion_min = old.duracion_min and new.profesional_id = old.profesional_id then
    return null;
  end if;
  if old.fecha < (select (now() at time zone zona_horaria)::date from locales where id = old.local_id) then
    return null;
  end if;
  perform avisar_lista_espera(old.local_id, old.fecha);
  return null;
end;
$$;
create trigger citas_libera_hora after update of estado, fecha, hora_inicio, duracion_min, profesional_id or delete
  on citas for each row execute function citas_libera_hora();

-- Lista de espera para el equipo (RLS: dueño y recepción).
create or replace function public.lista_espera_equipo()
returns table (id uuid, fecha date, franja text, estado text, avisado_at timestamptz, created_at timestamptz,
               cliente_id uuid, cliente text, telefono text, servicios text, profesional text)
language sql stable set search_path = public as $$
  select le.id, le.fecha, le.franja, le.estado, le.avisado_at, le.created_at, cl.id, cl.nombre || ' ' || cl.apellido,
         cl.telefono,
         (select string_agg(s.nombre, ' + ' order by u.ord)
            from unnest(le.servicios) with ordinality u(id, ord) join servicios s on s.id = u.id),
         p.nombre
    from lista_espera le join clientes cl on cl.id = le.cliente_id left join profesionales p on p.id = le.profesional_id
   order by le.fecha, le.created_at;
$$;

create or replace function public.quitar_de_espera(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if mi_negocio() is null or mi_rol() not in ('dueno', 'recepcion') then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'SIN_PERMISO',
      'message', 'Tu rol no puede cambiar la lista de espera'));
  end if;
  update lista_espera set estado = 'quitado'
   where id = p_id and negocio_id = mi_negocio() and estado in ('esperando', 'avisado');
  if not found then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'NO_ENCONTRADA',
      'message', 'Esa persona ya no está en la lista de espera'));
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.contacto_normalizado(text), public.contacto_oculto(text, text),
  public.clientes_de_contacto(uuid, text, text), public.acceso_de(text), public.enlace_espera(text, uuid[], uuid, date),
  public.avisar_lista_espera(uuid, date), public.citas_libera_hora() from public, anon, authenticated;
revoke all on function public.publico_pedir_codigo(text, text), public.publico_entrar_codigo(text, text, text),
  public.publico_salir(text), public.publico_mis_citas(text), public.publico_lista_espera(jsonb),
  public.publico_quitar_espera(text, uuid), public.lista_espera_equipo(), public.quitar_de_espera(uuid)
  from public, anon;
grant execute on function public.publico_pedir_codigo(text, text), public.publico_entrar_codigo(text, text, text),
  public.publico_salir(text), public.publico_mis_citas(text), public.publico_lista_espera(jsonb),
  public.publico_quitar_espera(text, uuid) to anon, authenticated;
grant execute on function public.lista_espera_equipo(), public.quitar_de_espera(uuid) to authenticated;
