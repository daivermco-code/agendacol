-- Semilla de la Fase 8 (marketing, paquetes y extras). Pseudoaleatorio pero estable (por fecha, hora y
-- profesional de cada cita). Se carga antes de seed.sql (config.toml → db.seed.sql_paths); demo_sembrar() la llama.

-- Recordatorios de las citas de la semilla y cómo se confirmó cada una, para que la pantalla de recordatorios y
-- el buzón tengan historia: correo 2 días antes a las 7:30 y WhatsApp 1 día antes a las 8:30 (los ajustes por
-- defecto). Uno de cada 16 se agendó tarde y no lleva recordatorio; sin correo o sin teléfono no se programa ese
-- canal; el WhatsApp no sale si la cita ya se confirmó con el correo.
create or replace function public.demo_sembrar_recordatorios(p_negocio uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  c record;
  v_h bigint;
  v_correo timestamptz;
  v_wsp timestamptz;
  v_por text;
  v_estado text;
  v_texto text;
begin
  for c in
    select ci.*, cl.nombre as c_nombre, cl.apellido as c_apellido, cl.correo as c_correo, cl.telefono as c_telefono,
           s.nombre as servicio, p.nombre as profesional, n.nombre as negocio
      from citas ci join clientes cl on cl.id = ci.cliente_id join servicios s on s.id = ci.servicio_id
      join profesionales p on p.id = ci.profesional_id join negocios n on n.id = ci.negocio_id
     where ci.negocio_id = p_negocio and ci.estado <> 'cancelado'
  loop
    v_h := abs(hashtext(c.fecha::text || c.hora_inicio::text || c.profesional_id::text));
    v_correo := ((c.fecha - 2) + time '07:30') at time zone 'America/Bogota';
    v_wsp := ((c.fecha - 1) + time '08:30') at time zone 'America/Bogota';
    v_por := null;
    if c.estado = 'confirmado'
       or (c.estado = 'asiste' and (v_h / 3) % 10 < 6)
       or (c.estado = 'no_asistio' and (v_h / 3) % 10 < 2) then
      v_por := case
        when (v_h / 7) % 100 < 45 and c.c_telefono is not null and v_h % 16 <> 0 and v_wsp <= now() then 'whatsapp'
        when (v_h / 7) % 100 < 75 and c.c_correo is not null and v_h % 16 <> 0 and v_correo <= now() then 'correo'
        else 'equipo' end;
      update citas set confirmada_por = v_por where id = c.id;
    end if;
    continue when v_h % 16 = 0;   -- se agendó después de la hora de envío

    v_texto := format('Hola %s, te recordamos tu reserva en %s: %s con %s el %s a las %s. Responde SÍ para confirmar.',
                      c.c_nombre, c.negocio, c.servicio, c.profesional, fecha_larga(c.fecha), hhmm(c.hora_inicio));
    if c.c_correo is not null and c.aviso_correo then
      insert into avisos_demo (negocio_id, cita_id, canal, tipo, destinatario, destino, asunto, cuerpo,
                               programado_para, estado, enlace, created_at)
      values (p_negocio, c.id, 'correo', 'recordatorio', c.c_nombre || ' ' || c.c_apellido, c.c_correo,
              format('Recordatorio de tu reserva en %s', c.negocio), v_texto, v_correo,
              case when v_correo <= now() then 'enviado' else 'programado' end, '/cita/' || c.token,
              case when v_correo <= now() then v_correo else now() - make_interval(hours => 2 + (v_h % 48)::int) end);
    end if;
    if c.c_telefono is not null and c.aviso_whatsapp then
      v_estado := case when v_por = 'correo' then 'omitido'
                       when v_wsp > now() and c.estado = 'confirmado' then 'omitido'
                       when v_wsp <= now() then 'enviado' else 'programado' end;
      insert into avisos_demo (negocio_id, cita_id, canal, tipo, destinatario, destino, cuerpo, programado_para,
                               estado, enlace, created_at)
      values (p_negocio, c.id, 'whatsapp', 'recordatorio', c.c_nombre || ' ' || c.c_apellido, c.c_telefono, v_texto,
              v_wsp, v_estado, '/cita/' || c.token,
              case when v_wsp <= now() then v_wsp else now() - make_interval(hours => 2 + (v_h % 48)::int) end);
      if v_por = 'whatsapp' then
        insert into avisos_demo (negocio_id, cita_id, canal, tipo, destinatario, destino, cuerpo, programado_para,
                                 estado, enlace, created_at)
        values (p_negocio, c.id, 'whatsapp', 'respuesta', c.c_nombre || ' ' || c.c_apellido, c.c_telefono,
                'SÍ, confirmo mi cita. ¡Gracias!', v_wsp + interval '25 minutes', 'recibido', '/cita/' || c.token,
                v_wsp + interval '25 minutes');
      end if;
    end if;
  end loop;
end;
$$;

revoke execute on function public.demo_sembrar_recordatorios(uuid) from public, anon, authenticated;

-- Gift cards, planes, un servicio con sesiones y un paquete, con algo ya vendido (sin venta: "cargado a mano" al
-- empezar a usar AgedaCol). Tres clientes con cita de barba próxima tienen el plan "Barba al día" y lo usan.
create or replace function public.demo_sembrar_planes(p_negocio uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_hoy date := hoy_bogota();
  v_id record;
  v_plan uuid;
  v_bono uuid;
  v_sesiones uuid;
  v_n int := 0;
  r record;
begin
  select max(id) filter (where nombre = 'Arreglo de barba') as barba,
         max(id) filter (where nombre = 'Corte de caballero') as caballero,
         max(id) filter (where nombre = 'Corte y barba') as corte_barba,
         max(id) filter (where nombre = 'Masaje relajante') as masaje,
         max(id) filter (where nombre = 'Limpieza facial') as facial,
         max(id) filter (where nombre = 'Manicure semipermanente') as mani,
         max(id) filter (where nombre = 'Manicure tradicional') as mani_t,
         max(id) filter (where nombre = 'Pedicure tradicional') as pedi
    into v_id
    from (select id::text as id, nombre from servicios where negocio_id = p_negocio) s;

  insert into gift_card_modelos (negocio_id, nombre, monto, precio, vigencia_dias, color) values
    (p_negocio, 'Gift card de $50.000', 50000, 50000, 365, 'laguna'),
    (p_negocio, 'Gift card de $100.000', 100000, 100000, 365, 'coral'),
    (p_negocio, 'Regalo de spa', 200000, 180000, 180, 'violeta');

  insert into planes (negocio_id, nombre, descripcion, precio, vigencia_dias, sesiones, servicios) values
    (p_negocio, 'Manos lindas', 'Dos manicures y un pedicure al mes.', 99000, 30, 3,
     array[v_id.mani, v_id.mani_t, v_id.pedi]::uuid[]),
    (p_negocio, 'Membresía caballero', 'Cortes y barba sin límite durante un mes.', 150000, 30, null,
     array[v_id.caballero, v_id.corte_barba, v_id.barba]::uuid[]);
  insert into planes (negocio_id, nombre, descripcion, precio, vigencia_dias, sesiones, servicios)
  values (p_negocio, 'Barba al día', 'Cuatro arreglos de barba al mes.', 64000, 30, 4, array[v_id.barba]::uuid[])
  returning id into v_plan;

  insert into servicios (negocio_id, categoria_id, nombre, precio, duracion_min, descripcion, en_linea, tipo, sesiones,
                         vigencia_dias, orden)
  select p_negocio, categoria_id, 'Masaje relajante · 4 sesiones', 320000, 60,
         'Cuatro masajes de 60 minutos para usar en cuatro meses.', false, 'sesiones', 4, 120, 10
    from servicios where id = v_id.masaje::uuid
  returning id into v_sesiones;
  insert into servicio_profesional (servicio_id, profesional_id)
  select v_sesiones, profesional_id from servicio_profesional where servicio_id = v_id.masaje::uuid;
  insert into servicios (negocio_id, categoria_id, nombre, precio, duracion_min, descripcion, en_linea, tipo, incluye,
                         vigencia_dias, orden)
  select p_negocio, categoria_id, 'Día de spa', 199000, 180,
         'Masaje relajante, limpieza facial y manicure semipermanente, a un mejor precio.', false, 'paquete',
         array[v_id.masaje, v_id.facial, v_id.mani]::uuid[], 90, 11
    from servicios where id = v_id.masaje::uuid;

  -- Gift cards ya vendidas: dos sin usar, una para otra persona y una vencida.
  insert into gift_cards (negocio_id, modelo_id, codigo, nombre, comprador_id, para, saldo_inicial, saldo, vence,
                          created_at)
  select p_negocio, m.id, nuevo_codigo_gift_card(p_negocio), m.nombre, c.id, x.para, m.monto, m.monto,
         v_hoy + x.vence, now() - make_interval(days => x.hace)
    from (values (1, 'Gift card de $100.000', null, 300, 65), (2, 'Regalo de spa', 'Mamá', 150, 30),
                 (3, 'Gift card de $50.000', null, 340, 25), (4, 'Gift card de $50.000', null, -20, 385))
         x(n, modelo, para, vence, hace)
    join gift_card_modelos m on m.negocio_id = p_negocio and m.nombre = x.modelo
    join lateral (select id from clientes where negocio_id = p_negocio order by apellido, nombre
                  offset x.n * 7 limit 1) c on true;

  -- "Barba al día" para tres clientes con barba próxima: sus citas sin cobrar entran al plan ($0).
  for r in
    select ci.cliente_id from citas ci
     where ci.negocio_id = p_negocio and ci.servicio_id = v_id.barba::uuid and ci.fecha > v_hoy
       and ci.estado <> 'cancelado'
     group by ci.cliente_id order by min(ci.fecha), ci.cliente_id limit 3
  loop
    insert into bonos (negocio_id, cliente_id, tipo, plan_id, nombre, servicios, cupo, inicio, vence, created_at)
    values (p_negocio, r.cliente_id, 'plan', v_plan, 'Barba al día', array[v_id.barba]::uuid[], 4, v_hoy - 8,
            v_hoy + 21, now() - interval '8 days')
    returning id into v_bono;
    update citas set bono_id = v_bono, precio = 0
     where id in (select id from citas where cliente_id = r.cliente_id and servicio_id = v_id.barba::uuid
                    and fecha between v_hoy - 8 and v_hoy + 21 and estado <> 'cancelado'
                    and not exists (select 1 from venta_items vi where vi.cita_id = citas.id and vi.vigente)
                  order by fecha limit 2);
    v_n := v_n + 1;
  end loop;

  insert into bonos (negocio_id, cliente_id, tipo, servicio_id, nombre, servicios, cupo, inicio, vence, created_at)
  select p_negocio, id, 'sesiones', v_sesiones, 'Masaje relajante · 4 sesiones', array[v_sesiones], 4, v_hoy - 20,
         v_hoy + 99, now() - interval '20 days'
    from clientes where negocio_id = p_negocio order by apellido, nombre offset 40 limit 1;
end;
$$;

revoke execute on function public.demo_sembrar_planes(uuid) from public, anon, authenticated;

-- Clases (T-8.3): un taller con cupo 8 que da Valentina los sábados, dos ya dadas (con asistencia) y cuatro por
-- venir (una llena, otras a medio llenar y una vacía). Cada sesión va en el primer hueco libre de la mañana.
create or replace function public.demo_sembrar_clases(p_negocio uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_hoy date := hoy_bogota();
  v_prof uuid := demo_ids('valentina');
  v_local uuid := demo_ids('local');
  v_cat uuid;
  v_serv uuid;
  v_clase uuid;
  v_dia date;
  v_hora time;
  v_n int := 0;
  v_cuantos int;
  x record;
begin
  insert into categorias (negocio_id, nombre, orden) values (p_negocio, 'Talleres', 6) returning id into v_cat;
  insert into servicios (negocio_id, categoria_id, nombre, precio, duracion_min, descripcion, en_linea, tipo, cupo,
                         orden)
  values (p_negocio, v_cat, 'Taller de automaquillaje', 90000, 120,
          'Dos horas para aprender un maquillaje de día y uno de noche con tus propios productos.', false, 'clase', 8,
          1)
  returning id into v_serv;
  insert into servicio_profesional (servicio_id, profesional_id) values (v_serv, v_prof);

  for x in select * from (values (-14, 7, true), (-7, 6, true), (7, 8, false), (14, 5, false), (21, 3, false),
                                 (28, 0, false)) t(dias, inscritos, pasada) loop
    -- El sábado de esa semana y el primer hueco de 2 horas entre 9:00 y 12:00 sin citas ni bloqueos de Valentina.
    v_dia := v_hoy + x.dias + (6 - extract(isodow from v_hoy + x.dias)::int);
    select h into v_hora
      from generate_series(timestamp '2000-01-01 09:00', timestamp '2000-01-01 12:00', interval '30 minutes') g,
           lateral (select g::time as h) t
     where not exists (select 1 from citas c where c.profesional_id = v_prof and c.estado <> 'cancelado'
                         and c.rango && tsrange(v_dia + h, v_dia + h + interval '2 hours', '[)'))
       and not exists (select 1 from bloqueos b where b.profesional_id = v_prof
                         and b.rango && tsrange(v_dia + h, v_dia + h + interval '2 hours', '[)'))
     order by h limit 1;
    continue when v_hora is null;
    insert into clases (negocio_id, local_id, servicio_id, profesional_id, fecha, hora_inicio, hora_fin, cupo, precio,
                        nota, created_at)
    values (p_negocio, v_local, v_serv, v_prof, v_dia, v_hora, v_hora + interval '2 hours', 8, 90000,
            case when x.inscritos = 8 then 'Traer brochas y base propias.' end, now() - interval '20 days')
    returning id into v_clase;
    v_cuantos := x.inscritos;
    insert into clase_inscritos (negocio_id, clase_id, cliente_id, estado, created_at)
    select p_negocio, v_clase, c.id,
           case when not x.pasada then 'inscrito' when row_number() over () = 3 then 'no_asistio' else 'asiste' end,
           now() - make_interval(days => 10 + (row_number() over ())::int)
      from (select id from clientes where negocio_id = p_negocio and correo is not null
             order by hashtext(id::text || v_n) limit v_cuantos) c;
    v_n := v_n + 1;
  end loop;
end;
$$;
revoke execute on function public.demo_sembrar_clases(uuid) from public, anon, authenticated;

-- Recursos de la Sede Chapinero, antes de las citas para que cada cita de spa, pestañas, pedicure o tinte tome el
-- primero libre (lo hace el disparador citas_recurso de 0011).
create or replace function public.demo_sembrar_recursos(p_negocio uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_local uuid := demo_ids('local');
  v_cabinas uuid[];
  v_sillon uuid;
  v_lava uuid;
begin
  with nuevos as (
    insert into recursos (negocio_id, local_id, nombre, descripcion, orden) values
      (p_negocio, v_local, 'Cabina 1', 'Camilla y luz cálida', 1),
      (p_negocio, v_local, 'Cabina 2', 'Camilla y lámpara de lupa', 2)
    returning id
  ) select array_agg(id) into v_cabinas from nuevos;
  insert into recursos (negocio_id, local_id, nombre, descripcion, orden)
  values (p_negocio, v_local, 'Sillón de pedicure', 'Con tina de hidromasaje', 3) returning id into v_sillon;
  insert into recursos (negocio_id, local_id, nombre, descripcion, orden)
  values (p_negocio, v_local, 'Lavacabezas', null, 4) returning id into v_lava;
  insert into recursos (negocio_id, local_id, nombre, descripcion, orden, activo)
  values (p_negocio, v_local, 'Cabina 3', 'En arreglo', 5, false);

  update servicios set recursos = v_cabinas
   where negocio_id = p_negocio
     and nombre in ('Masaje relajante', 'Limpieza facial', 'Masaje con piedras calientes', 'Lifting de pestañas');
  update servicios set recursos = array[v_sillon] where negocio_id = p_negocio and nombre = 'Pedicure tradicional';
  update servicios set recursos = array[v_lava] where negocio_id = p_negocio and nombre = 'Tinte completo';
end;
$$;
revoke execute on function public.demo_sembrar_recursos(uuid) from public, anon, authenticated;

-- Segunda sede, recién abierta: horario, una profesional de uñas y cejas y su mesa. Sin citas todavía (así las
-- cuentas de la Sede Chapinero no cambian).
create or replace function public.demo_sembrar_sede(p_negocio uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_local uuid;
  v_prof uuid;
  v_dia int;
begin
  -- Un minuto después de la Sede Chapinero: el sitio público toma la sede más antigua (`order by created_at`) y,
  -- creadas en la misma transacción, empataban; según dónde quedara la fila tras un update, salía Usaquén.
  insert into locales (negocio_id, nombre, direccion, telefono, acepta_whatsapp, correo, created_at)
  values (p_negocio, 'Sede Usaquén', 'Carrera 7 # 119-20, Bogotá', '+573000000099', true, 'usaquen@ejemplo.test',
          now() + interval '1 minute')
  returning id into v_local;
  for v_dia in 1..7 loop
    insert into horarios_local (local_id, dia_semana, abierto, inicio, fin)
    values (v_local, v_dia, v_dia <= 6, case when v_dia <= 6 then '10:00'::time end,
            case when v_dia <= 6 then '19:00'::time end);
  end loop;
  insert into profesionales (negocio_id, local_id, nombre, color, orden, activo)
  values (p_negocio, v_local, 'Natalia Rojas', '#6D28D9', 5, true) returning id into v_prof;
  for v_dia in 1..7 loop
    insert into horarios_profesional (profesional_id, dia_semana, trabaja, inicio, fin)
    values (v_prof, v_dia, v_dia between 2 and 6, case when v_dia between 2 and 6 then '10:00'::time end,
            case when v_dia between 2 and 6 then '19:00'::time end);
  end loop;
  insert into servicio_profesional (servicio_id, profesional_id)
  select s.id, v_prof from servicios s join categorias c on c.id = s.categoria_id
   where s.negocio_id = p_negocio and c.nombre in ('Uñas', 'Cejas y pestañas');
  insert into recursos (negocio_id, local_id, nombre, orden)
  values (p_negocio, v_local, 'Mesa de uñas', 1);
end;
$$;
revoke execute on function public.demo_sembrar_sede(uuid) from public, anon, authenticated;

-- Correo masivo, fidelización y WhatsApp: 3 correos suprimidos, tres audiencias, una campaña enviada hace 12 días
-- (sus correos quedan en el buzón) y un borrador; la tarjeta de 8 sellos con un sello por cada cita a la que ya
-- asistieron y dos premios entregados; 4 plantillas de WhatsApp (una apagada).
create or replace function public.demo_sembrar_marketing(p_negocio uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_clientas uuid;
  v_cumple uuid;
  v_campana uuid;
  v_envio timestamptz := date_trunc('day', now()) - interval '12 days' + interval '14 hours';
  v_asunto text := 'Semana de uñas: 15 % en semipermanente';
  v_cuerpo text := 'Hola {nombre}, esta semana el manicure semipermanente tiene 15 % de descuento en Salón Ceiba. '
    || 'Reserva en línea o responde este correo.';
begin
  update clientes set recibe_campanas = false
   where negocio_id = p_negocio and numero_cliente in ('0005', '0022', '0047');

  insert into audiencias (negocio_id, nombre, filtro) values
    (p_negocio, 'Clientas', '{"genero": "femenino"}') returning id into v_clientas;
  insert into audiencias (negocio_id, nombre, filtro) values
    (p_negocio, 'Cumpleaños de este mes', '{"cumpleMes": 0}') returning id into v_cumple;
  insert into audiencias (negocio_id, nombre, filtro) values
    (p_negocio, 'No vienen hace 3 semanas', '{"sinVenirDias": 21}');

  insert into campanas (negocio_id, audiencia_id, asunto, cuerpo, estado, created_at)
  values (p_negocio, v_clientas, v_asunto, v_cuerpo, 'borrador', v_envio - interval '1 day')
  returning id into v_campana;
  insert into avisos_demo (negocio_id, campana_id, canal, tipo, destinatario, destino, asunto, cuerpo,
                           programado_para, created_at)
  select p_negocio, v_campana, 'correo', 'campana', c.nombre || ' ' || c.apellido, c.correo, v_asunto,
         replace(v_cuerpo, '{nombre}', c.nombre), v_envio, v_envio
    from clientes c
   where c.id in (select audiencia_clientes(p_negocio, '{"genero": "femenino"}'))
     and c.correo is not null and c.recibe_campanas;
  update campanas set estado = 'enviada', enviada_at = v_envio,
         destinatarios = (select count(*) from avisos_demo where campana_id = v_campana)
   where id = v_campana;
  insert into campanas (negocio_id, audiencia_id, asunto, cuerpo)
  values (p_negocio, v_cumple, '¡Feliz cumpleaños, {nombre}!',
          'Hola {nombre}, en tu mes te regalamos un lavado y cepillado con cualquier servicio. Te esperamos.');

  update ajustes set sellos_activos = true, sellos_meta = 8, sellos_premio = 'Un manicure tradicional de cortesía'
   where negocio_id = p_negocio;
  insert into sellos (negocio_id, cliente_id, cita_id, created_at)
  select p_negocio, ci.cliente_id, ci.id, (ci.fecha + ci.hora_fin) at time zone 'America/Bogota'
    from citas ci where ci.negocio_id = p_negocio and ci.estado = 'asiste';
  -- Las dos clientes con más sellos ya recibieron su primer premio (el día de su octavo sello).
  insert into canjes_sellos (negocio_id, cliente_id, premio, created_at)
  select p_negocio, t.cliente_id, 'Un manicure tradicional de cortesía', t.octavo
    from (select s.cliente_id, count(*) as n,
                 (array_agg(s.created_at order by s.created_at))[8] as octavo
            from sellos s where s.negocio_id = p_negocio group by s.cliente_id) t
   where t.n >= 8
   order by t.n desc, t.cliente_id
   limit 2;

  insert into plantillas_whatsapp (negocio_id, nombre, cuerpo, orden, activo) values
    (p_negocio, 'Confirmar asistencia', 'Hola {cliente}, te escribimos de {negocio}. ¿Nos confirmas tu cita de '
       || '{servicio} el {fecha} a las {hora} con {profesional}?', 1, true),
    (p_negocio, 'Vamos con retraso', 'Hola {cliente}, {profesional} va unos minutos tarde. Tu cita de las {hora} '
       || 'empieza apenas termine. ¡Gracias por la paciencia!', 2, true),
    (p_negocio, 'Gracias por venir', 'Gracias por venir a {local}, {cliente}. Cuando quieras repetir tu {servicio}, '
       || 'reserva en línea o escríbenos por aquí.', 3, true),
    (p_negocio, 'Hora liberada', 'Hola {cliente}, se liberó una hora el {fecha} a las {hora}. ¿Te la apartamos?',
       4, false);
end;
$$;
revoke execute on function public.demo_sembrar_marketing(uuid) from public, anon, authenticated;

-- Lista de espera: dos clientes esperan la hora de una cita que ya está tomada (con ese profesional y en esa parte
-- del día) y a una tercera ya le avisaron que se liberó una hora el día que pidió.
create or replace function public.demo_sembrar_espera(p_negocio uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_clientes uuid[];
  c record;
  v_n int := 0;
begin
  select array_agg(id order by numero_cliente) into v_clientes
    from clientes where negocio_id = p_negocio and numero_cliente in ('0012', '0031', '0058');
  for c in
    select d.* from (select distinct on (ci.fecha) ci.* from citas ci
                      where ci.negocio_id = p_negocio and ci.local_id = demo_ids('local')
                        and ci.estado in ('reservado', 'confirmado') and ci.cliente_id <> all(v_clientes)
                        and ci.fecha between current_date + 2 and current_date + 12
                      order by ci.fecha, ci.hora_inicio, ci.id) d
     order by d.fecha limit 3
  loop
    v_n := v_n + 1;
    insert into lista_espera (negocio_id, local_id, cliente_id, servicios, profesional_id, fecha, franja, created_at)
    values (p_negocio, c.local_id, v_clientes[v_n], array[c.servicio_id],
            case when v_n < 3 then c.profesional_id end, c.fecha,
            case when v_n = 3 then 'dia' when c.hora_inicio < '12:00' then 'manana' else 'tarde' end,
            now() - make_interval(hours => 40 - v_n * 9));
    if v_n = 3 then
      perform avisar_lista_espera(c.local_id, c.fecha);
    end if;
  end loop;
end;
$$;
revoke execute on function public.demo_sembrar_espera(uuid) from public, anon, authenticated;
