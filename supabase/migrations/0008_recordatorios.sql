-- 0008_recordatorios.sql — Pantalla de recordatorios (Fase 8): cómo se confirmó cada cita, el cupo de WhatsApp
-- del mes y los números del período (enviados, confirmados y los que no salieron). Todo simulado en el buzón.

-- Quién confirmó la cita: el equipo desde la agenda, el cliente con el botón de su enlace (llega en el correo) o
-- respondiendo "SÍ" al WhatsApp. Lo pone el disparador; vuelve a null si la cita regresa a Reservado.
alter table citas add column confirmada_por text check (confirmada_por in ('equipo', 'correo', 'whatsapp'));

-- Mensajes de WhatsApp para recordatorios que trae el "plan" de la demo cada mes.
alter table ajustes add column whatsapp_cupo_mes integer not null default 300
  check (whatsapp_cupo_mes between 0 and 100000);

create or replace function public.citas_quien_confirma() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.estado = 'confirmado' and old.estado is distinct from 'confirmado' then
    -- responder_aviso_demo marca 'whatsapp'; sin sesión (el enlace público) es el cliente desde su correo.
    new.confirmada_por := coalesce(nullif(current_setting('agedacol.confirma', true), ''),
                                   case when auth.uid() is null then 'correo' else 'equipo' end);
  elsif new.estado in ('reservado', 'pendiente', 'en_espera') then
    new.confirmada_por := null;
  end if;
  return new;
end;
$$;
create trigger citas_quien_confirma before update of estado on citas
  for each row execute function citas_quien_confirma();

-- Igual que en 0005, y deja dicho que la confirmación llegó por WhatsApp.
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
  perform set_config('agedacol.confirma', 'whatsapp', true);
  foreach v_id in array grupo_reserva(a.cita_id) loop
    perform confirmar_cita_base(v_id);
  end loop;
  perform set_config('agedacol.confirma', '', true);
  insert into avisos_demo (negocio_id, cita_id, canal, tipo, destinatario, destino, cuerpo, estado, enlace)
  values (a.negocio_id, a.cita_id, 'whatsapp', 'respuesta', a.destinatario, a.destino, 'SÍ, confirmo mi cita. ¡Gracias!',
          'recibido', a.enlace);
  return jsonb_build_object('ok', true);
end;
$$;

-- Números de la pantalla de recordatorios para las citas del período (sin las canceladas). Un recordatorio
-- "programado" cuya hora ya pasó cuenta como enviado (la demo no tiene un proceso que lo despache).
-- language sql sin security definer: aplica RLS (dueño y recepción leen citas y avisos).
create or replace function public.estadisticas_recordatorios(p_desde date, p_hasta date) returns jsonb
language sql stable set search_path = public as $$
  with c as (
    select ci.id, ci.estado, ci.precio, ci.confirmada_por, ci.fecha, ci.hora_inicio, ci.aviso_correo,
           ci.aviso_whatsapp, ci.cliente_id, ci.servicio_id, ci.profesional_id,
           cl.correo is not null as con_correo, cl.telefono is not null as con_telefono
      from citas ci join clientes cl on cl.id = ci.cliente_id
     where ci.fecha between p_desde and p_hasta and ci.estado <> 'cancelado'
  ),
  r as (
    select a.cita_id, a.canal,
           bool_or(a.estado = 'enviado' or (a.estado = 'programado' and a.programado_para <= now())) as enviado,
           bool_or(a.estado = 'programado' and a.programado_para > now()) as pendiente,
           bool_or(a.estado = 'omitido') as omitido
      from avisos_demo a
     where a.tipo = 'recordatorio' and a.cita_id in (select id from c)
     group by a.cita_id, a.canal
  ),
  k as (
    select x.canal,
           count(*) filter (where r.enviado) as enviados,
           count(*) filter (where c.confirmada_por = x.canal::text) as confirmadas,
           coalesce(sum(c.precio) filter (where c.confirmada_por = x.canal::text), 0) as ingresos,
           count(*) filter (where not coalesce(r.enviado or r.pendiente, false)) as no_enviados,
           count(*) filter (where r.pendiente and not r.enviado) as programados
      from c cross join (values ('correo'::canal_aviso), ('whatsapp'::canal_aviso)) x(canal)
      left join r on r.cita_id = c.id and r.canal = x.canal
     group by x.canal
  ),
  sin as (
    select c.*, coalesce(bool_or(r.omitido), false) as omitido
      from c left join r on r.cita_id = c.id
     group by c.id, c.estado, c.precio, c.confirmada_por, c.fecha, c.hora_inicio, c.aviso_correo, c.aviso_whatsapp,
              c.cliente_id, c.servicio_id, c.profesional_id, c.con_correo, c.con_telefono
    having not coalesce(bool_or(r.enviado or r.pendiente), false)
  ),
  mes as (
    select date_trunc('month', (now() at time zone 'America/Bogota'))::date as inicio
  )
  select jsonb_build_object(
    'reservas', (select count(*) from c),
    'confirmadas', (select count(*) from c where confirmada_por is not null),
    'asistidas', (select count(*) from c where estado = 'asiste'),
    'ingresosConfirmados', (select coalesce(sum(precio), 0) from c where confirmada_por is not null),
    'porEquipo', (select count(*) from c where confirmada_por = 'equipo'),
    'canales', (select jsonb_object_agg(k.canal, jsonb_build_object('enviados', k.enviados,
                  'confirmadas', k.confirmadas, 'ingresos', k.ingresos, 'noEnviados', k.no_enviados,
                  'programados', k.programados)) from k),
    'sinRecordatorio', (select count(*) from sin),
    'reservasSinRecordatorio', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'fecha', s.fecha, 'hora', hhmm(s.hora_inicio),
               'cliente', cl.nombre || ' ' || cl.apellido, 'servicio', sv.nombre, 'profesional', p.nombre,
               'motivo', case when not s.con_correo and not s.con_telefono then 'Sin correo ni teléfono'
                              when not (s.aviso_correo or s.aviso_whatsapp) then 'Avisos apagados en la cita'
                              when s.omitido then 'Ya estaba confirmada'
                              else 'Se agendó después de la hora de envío' end)
             order by s.fecha desc, s.hora_inicio desc)
        from (select * from sin order by fecha desc, hora_inicio desc limit 50) s
        join clientes cl on cl.id = s.cliente_id join servicios sv on sv.id = s.servicio_id
        join profesionales p on p.id = s.profesional_id), '[]'::jsonb),
    'cupo', (select jsonb_build_object(
               'contratados', a.whatsapp_cupo_mes,
               'usados', (select count(*) from avisos_demo av
                           where av.negocio_id = a.negocio_id and av.canal = 'whatsapp' and av.tipo = 'recordatorio'
                             and (av.estado = 'enviado' or (av.estado = 'programado' and av.programado_para <= now()))
                             and av.programado_para >= (mes.inicio::timestamp at time zone 'America/Bogota')),
               'vence', ((mes.inicio + interval '1 month')::date - 1))
             from ajustes a, mes where a.negocio_id = mi_negocio())
  );
$$;

revoke all on function public.citas_quien_confirma() from public, anon, authenticated;
revoke all on function public.responder_aviso_demo(uuid) from public, anon;
revoke all on function public.estadisticas_recordatorios(date, date) from public, anon;
grant execute on function public.responder_aviso_demo(uuid) to authenticated;
grant execute on function public.estadisticas_recordatorios(date, date) to authenticated;
