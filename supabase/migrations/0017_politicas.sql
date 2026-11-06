-- 0017_politicas.sql · AgedaCol
-- Auditoría del 1-nov-2026 (AUDIT-2026-11-01.md, top fix 4): una sola política permisiva por acción (advisor
-- `multiple_permissive_policies`, 17 tablas). Postgres evalúa todas las permisivas de una acción en cada fila.
--
-- En 16 tablas, la política de escritura era `for all` y por eso también contaba para leer, junto a la política de
-- lectura. Se cambia por tres (crear, cambiar y borrar) con las mismas expresiones, copiadas tal cual de la
-- política anterior. Leer no cambia: en las 16, quien puede escribir ya entraba por la política de lectura (el dueño
-- o la recepción también son miembros del negocio, y "leen citas" ya incluye a dueño y recepción).
-- En `calificaciones` eran dos políticas de lectura; quedan en una con las dos reglas unidas por `or`.

do $$
declare
  p record;
  v_roles text;
  v_n int := 0;
begin
  for p in
    select tablename, policyname, roles, qual, coalesce(with_check, qual) as chequeo
      from pg_policies
     where schemaname = 'public'
       and cmd = 'ALL'
       and permissive = 'PERMISSIVE'
       and tablename = any (array[
             'bloqueos', 'categorias', 'citas', 'clientes', 'gift_card_modelos', 'horarios_local',
             'horarios_profesional', 'locales', 'metodos_pago', 'miembros', 'planes', 'plantillas_whatsapp',
             'profesionales', 'recursos', 'servicio_profesional', 'servicios'])
  loop
    select string_agg(quote_ident(r), ', ') into v_roles from unnest(p.roles) r;
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    execute format('create policy %I on public.%I for insert to %s with check (%s)',
                   p.policyname || ' (crear)', p.tablename, v_roles, p.chequeo);
    execute format('create policy %I on public.%I for update to %s using (%s) with check (%s)',
                   p.policyname || ' (cambiar)', p.tablename, v_roles, p.qual, p.chequeo);
    execute format('create policy %I on public.%I for delete to %s using (%s)',
                   p.policyname || ' (borrar)', p.tablename, v_roles, p.qual);
    v_n := v_n + 1;
  end loop;
  if v_n <> 16 then
    raise exception 'Se esperaban 16 políticas de escritura "for all" y hay %', v_n;
  end if;
end;
$$;

drop policy "dueno y recepcion leen calificaciones" on public.calificaciones;
drop policy "el profesional lee las suyas" on public.calificaciones;
create policy "leen calificaciones" on public.calificaciones for select to authenticated
  using (negocio_id = mi_negocio()
         and (mi_rol() in ('dueno', 'recepcion')
              or (mi_rol() = 'profesional' and profesional_id = mi_profesional())));
