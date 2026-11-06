-- Productos de la demo (champús, ceras, esmaltes…) y su inventario. demo_sembrar_productos los crea con las
-- existencias que deben quedar hoy; demo_venta (semilla/ventas.sql) vende algunos junto con las citas; y
-- demo_cerrar_inventario registra la entrada inicial que cuadra todo (lo que quedó + lo vendido) y una reposición.
-- Dos quedan con stock bajo y uno agotado, para que se vea la alerta. Se carga antes de ventas.sql y seed.sql.

create or replace function public.demo_sembrar_productos(p_negocio uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into productos (negocio_id, nombre, categoria, precio, existencias, stock_minimo) values
    (p_negocio, 'Champú hidratante 300 ml', 'Cuidado del cabello', 38000, 14, 5),
    (p_negocio, 'Acondicionador reparador 300 ml', 'Cuidado del cabello', 36000, 3, 5),
    (p_negocio, 'Protector térmico en spray', 'Cuidado del cabello', 42000, 9, 4),
    (p_negocio, 'Cera mate para peinar', 'Barbería', 28000, 11, 4),
    (p_negocio, 'Aceite para barba 30 ml', 'Barbería', 32000, 2, 4),
    (p_negocio, 'Esmalte semipermanente', 'Uñas', 25000, 18, 6),
    (p_negocio, 'Crema de manos con karité', 'Uñas', 18000, 0, 3),
    (p_negocio, 'Kit de limas y pulidor', 'Uñas', 12000, 7, 3);
end;
$$;

create or replace function public.demo_cerrar_inventario(p_negocio uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_lunes date := date_trunc('week', (now() at time zone 'America/Bogota')::date)::date;
  pr record;
  v_repone int;
begin
  for pr in
    select p.id, p.existencias, coalesce(-sum(m.cantidad), 0)::int as vendidas,
           coalesce(-sum(m.cantidad) filter (where m.created_at >= (v_lunes - 14 + time '09:00')
                                                                  at time zone 'America/Bogota'), 0)::int as despues
      from productos p left join movimientos_stock m on m.producto_id = p.id and m.tipo = 'venta'
     where p.negocio_id = p_negocio
     group by p.id
  loop
    -- Los que más se mueven tuvieron una reposición hace dos semanas (sin que el saldo de antes quede negativo).
    v_repone := case when pr.vendidas >= 8 and pr.existencias + pr.despues >= 6 then 6 else 0 end;
    if pr.existencias + pr.vendidas - v_repone > 0 then
      insert into movimientos_stock (negocio_id, producto_id, tipo, cantidad, nota, created_at)
      values (p_negocio, pr.id, 'entrada', pr.existencias + pr.vendidas - v_repone, 'Inventario inicial',
              (v_lunes - 36 + time '08:00') at time zone 'America/Bogota');
    end if;
    if v_repone > 0 then
      insert into movimientos_stock (negocio_id, producto_id, tipo, cantidad, nota, created_at)
      values (p_negocio, pr.id, 'entrada', v_repone, 'Pedido al distribuidor',
              (v_lunes - 14 + time '09:00') at time zone 'America/Bogota');
    end if;
  end loop;
end;
$$;

revoke execute on function public.demo_sembrar_productos(uuid), public.demo_cerrar_inventario(uuid)
  from public, anon, authenticated;
