-- 0016_funciones.sql · AgedaCol
-- Auditoría del 1-nov-2026 (AUDIT-2026-11-01.md, top fixes 3 y 5).
-- 1. `search_path` fijo en las funciones que no lo tenían (advisor `function_search_path_mutable`). Solo usan
--    funciones de pg_catalog, que siempre se encuentran. `demo_ids` se arregla en seed.sql, donde se crea.
-- 2. Las funciones internas dejan de estar abiertas a `anon` (regla de la 0005: el público solo entra por las
--    funciones `publico_*`). El equipo (`authenticated`) ya tenía su permiso propio y lo conserva; los disparadores
--    no revisan este permiso al correr, y las funciones públicas que las llaman corren como su dueño.
-- 3. `audiencias_con_conteo()`: las audiencias con sus cifras en una sola llamada, en vez de una consulta por
--    audiencia. Mismo control que `contar_audiencia` (solo el dueño) y las mismas cuentas.

alter function public.tocar_updated_at() set search_path = '';
alter function public.error_clase(text, text, text) set search_path = '';
alter function public.cupo_campanas() set search_path = '';

revoke execute on function public.calcular_fin_cita() from public, anon;
revoke execute on function public.choques_permitidos(jsonb, public.ajustes) from public, anon;
revoke execute on function public.fecha_larga(date) from public, anon;
revoke execute on function public.hhmm(time) from public, anon;
revoke execute on function public.tocar_updated_at() from public, anon;

create or replace function public.audiencias_con_conteo() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_negocio uuid := mi_negocio();
begin
  if v_negocio is null or mi_rol() <> 'dueno' then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', a.id,
             'nombre', a.nombre,
             'filtro', a.filtro,
             'total', n.total,
             'reciben', n.reciben,
             'sinCorreo', n.sin_correo,
             'suprimidos', n.suprimidos) order by a.nombre)
      from audiencias a
      cross join lateral (
        select count(*) as total,
               count(*) filter (where c.correo is not null and c.recibe_campanas) as reciben,
               count(*) filter (where c.correo is null) as sin_correo,
               count(*) filter (where c.correo is not null and not c.recibe_campanas) as suprimidos
          from clientes c
         where c.id in (select audiencia_clientes(v_negocio, coalesce(a.filtro, '{}'::jsonb)))
      ) n
     where a.negocio_id = v_negocio), '[]'::jsonb);
end;
$$;

revoke all on function public.audiencias_con_conteo() from public, anon;
grant execute on function public.audiencias_con_conteo() to authenticated;
