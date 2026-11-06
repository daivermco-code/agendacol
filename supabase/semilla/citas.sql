-- Citas y bloqueos de 10 semanas alrededor de hoy (5 atrás, la actual y 4 adelante), siempre relativas a la
-- fecha del día en Bogotá: así la agenda "de esta semana" nunca queda vacía. Pseudoaleatorio pero estable.
-- Se carga antes de seed.sql (config.toml → db.seed.sql_paths); demo_sembrar() la llama.

create or replace function public.demo_sembrar_citas(p_negocio uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_ahora time := (now() at time zone 'America/Bogota')::time;
  v_lunes date := date_trunc('week', v_hoy)::date;
  v_local uuid := demo_ids('local');
  v_dia date;
  v_pr record;
  v_sv record;
  v_t time;
  v_fin time;
  v_h bigint;
  v_n int;
  v_estado estado_cita;
  v_clientes uuid[];
begin
  select array_agg(id order by id) into v_clientes from clientes where negocio_id = p_negocio;

  -- Almuerzo de Andrés: bloqueo de 14:00 a 15:00 de lunes a sábado.
  insert into bloqueos (negocio_id, profesional_id, motivo, inicio, fin)
  select p_negocio, demo_ids('andres'), 'Almuerzo', d::date + time '14:00', d::date + time '15:00'
    from generate_series(v_lunes - 35, v_lunes + 34, interval '1 day') g(d)
   where extract(isodow from d) between 1 and 6;

  for v_dia in select g::date from generate_series(v_lunes - 35, v_lunes + 34, interval '1 day') g loop
    for v_pr in
      select pr.id, hp.inicio, hp.fin, hp.descanso_inicio, hp.descanso_fin
        from profesionales pr
        join horarios_profesional hp on hp.profesional_id = pr.id
         and hp.dia_semana = extract(isodow from v_dia) and hp.trabaja
       where pr.negocio_id = p_negocio and pr.activo
    loop
      select count(*) into v_n
        from servicio_profesional sp join servicios s on s.id = sp.servicio_id
       where sp.profesional_id = v_pr.id and s.activo and s.duracion_min <= 120;
      continue when v_n = 0;

      v_t := v_pr.inicio;
      while v_t < v_pr.fin loop
        if v_pr.descanso_inicio is not null and v_t >= v_pr.descanso_inicio and v_t < v_pr.descanso_fin then
          v_t := v_pr.descanso_fin;
          continue;
        end if;

        v_h := abs(hashtext(v_dia::text || v_pr.id::text || v_t::text));
        if v_h % 100 >= 26 then            -- ~25 % de ocupación por profesional
          v_t := v_t + interval '30 minutes';
          continue;
        end if;

        select s.id, s.duracion_min, s.precio into v_sv
          from servicio_profesional sp join servicios s on s.id = sp.servicio_id
         where sp.profesional_id = v_pr.id and s.activo and s.duracion_min <= 120
         order by s.nombre offset (v_h / 7) % v_n limit 1;
        v_fin := v_t + make_interval(mins => v_sv.duracion_min);

        if v_fin > v_pr.fin or v_fin <= v_t
           or (v_pr.descanso_inicio is not null and v_t < v_pr.descanso_fin and v_fin > v_pr.descanso_inicio)
           or exists (select 1 from bloqueos b
                       where b.profesional_id = v_pr.id and b.rango && tsrange(v_dia + v_t, v_dia + v_fin))
        then
          v_t := v_t + interval '30 minutes';
          continue;
        end if;

        if v_dia < v_hoy or (v_dia = v_hoy and v_fin <= v_ahora) then
          -- Pasadas: estado final (asiste la mayoría, algunas no asistió o canceladas).
          v_estado := case when (v_h / 13) % 100 < 80 then 'asiste'
                           when (v_h / 13) % 100 < 90 then 'no_asistio'
                           else 'cancelado' end;
        else
          v_estado := case when (v_h / 13) % 100 < 38 then 'confirmado'
                           when (v_h / 13) % 100 < 44 then 'pendiente'
                           else 'reservado' end;
        end if;

        insert into citas (negocio_id, local_id, cliente_id, profesional_id, servicio_id, fecha, hora_inicio,
                           duracion_min, estado, origen, precio)
        values (p_negocio, v_local, v_clientes[1 + ((v_h / 11) % array_length(v_clientes, 1))], v_pr.id, v_sv.id,
                v_dia, v_t, v_sv.duracion_min, v_estado,
                case when (v_h / 3) % 10 < 3 then 'en_linea'::origen_cita else 'agenda'::origen_cita end,
                v_sv.precio);
        v_t := v_fin;
      end loop;
    end loop;
  end loop;

  -- Un cruce a propósito cada miércoles: Valentina con otra clienta a las 11:00.
  insert into citas (negocio_id, local_id, cliente_id, profesional_id, servicio_id, fecha, hora_inicio,
                     duracion_min, estado, precio)
  select p_negocio, v_local, v_clientes[5], demo_ids('valentina'), s.id, d::date, time '11:00', s.duracion_min,
         case when d::date < v_hoy then 'asiste'::estado_cita else 'reservado'::estado_cita end, s.precio
    from generate_series(v_lunes - 35, v_lunes + 34, interval '1 day') g(d)
    join servicios s on s.negocio_id = p_negocio and s.nombre = 'Manicure tradicional'
   where extract(isodow from d) = 3;

  -- Calificaciones de las últimas semanas: una de cada tres citas atendidas, casi todas de 4 o 5 estrellas.
  insert into calificaciones (cita_id, negocio_id, profesional_id, estrellas, comentario, created_at)
  -- El comentario va con las estrellas (y a veces no hay).
  select c.id, c.negocio_id, c.profesional_id, y.e,
         case y.e
           when 5 then case x.h % 7 when 0 then 'Muy puntual y amable.' when 1 then 'Quedé feliz con el resultado.'
                                    when 2 then 'Me explicó todo con paciencia.' end
           when 4 then case x.h % 5 when 0 then 'Buen servicio, aunque tuve que esperar un poco.'
                                    when 1 then 'Muy bien, volveré.' end
           when 3 then case x.h % 2 when 0 then 'Bien, pero empezó tarde.' end
           else 'No quedé conforme con el resultado.' end,
         (c.fecha + c.hora_fin) at time zone 'America/Bogota' + interval '3 hours'
    from citas c cross join lateral (select abs(hashtext(c.id::text)) as h) x
    cross join lateral (select case when x.h % 100 < 55 then 5 when x.h % 100 < 85 then 4
                                    when x.h % 100 < 95 then 3 else 2 end as e) y
   where c.negocio_id = p_negocio and c.estado = 'asiste' and c.fecha >= v_hoy - 21 and x.h % 3 = 0;

  -- Cuándo se hizo cada reserva: de 1 a 14 días antes de la cita o de hoy (lo que llegue primero), así nunca
  -- queda en el futuro. Sin esto todas serían "de hoy" y las reservas nuevas de la semana del Inicio (T-12.9)
  -- contarían la semilla entera.
  update citas c
     set created_at = ((least(c.fecha, v_hoy) - (1 + abs(hashtext(c.fecha::text || c.hora_inicio::text
                         || c.profesional_id::text)) % 14)) + time '10:00') at time zone 'America/Bogota'
   where c.negocio_id = p_negocio;
end;
$$;

revoke execute on function public.demo_sembrar_citas(uuid) from public, anon;
