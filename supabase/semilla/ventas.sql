-- Ventas de las citas atendidas, sus pagos y la caja, en orden de fecha (números 1001, 1002…). Pseudoaleatorio
-- pero estable (por fecha, hora y profesional). Deja sin cobrar la mitad de lo de hoy y ayer, y unas pocas más
-- viejas, para que "Mis cobros" tenga qué mostrar. Se carga antes de seed.sql; demo_sembrar() la llama.

create or replace function public.demo_sembrar_metodos(p_negocio uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into metodos_pago (negocio_id, nombre, tipo, orden) values
    (p_negocio, 'Efectivo', 'efectivo', 1),
    (p_negocio, 'Transferencia', 'transferencia', 2),
    (p_negocio, 'Tarjeta débito', 'debito', 3),
    (p_negocio, 'Tarjeta crédito', 'credito', 4),
    (p_negocio, 'Billetera digital', 'billetera', 5),
    (p_negocio, 'Gift card', 'gift_card', 6);
end;
$$;

-- Una venta de la semilla: venta, ítem, pagos (uno o dos) y su movimiento de caja.
create or replace function public.demo_venta(p_negocio uuid, p_cita citas, p_numero int, p_cuando timestamptz,
                                             p_h bigint, p_anulada boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_metodos metodos_pago[];
  v_metodo metodos_pago;
  v_desc int := 0;
  v_total int;
  v_primer int;
  v_venta ventas;
  v_pago uuid;
  v_abono boolean := (p_h / 11) % 100 < 6;
  v_saldo_pagado boolean := (p_h / 23) % 3 <> 0 and p_cita.fecha < (now() at time zone 'America/Bogota')::date - 3;
  v_r int := (p_h / 7) % 100;
  v_productos productos[];
  v_prod productos;
  v_cant int := case when (p_h / 43) % 5 = 0 then 2 else 1 end;
  v_sub int := p_cita.precio;
begin
  select array_agg(m order by m.orden) into v_metodos from metodos_pago m where m.negocio_id = p_negocio;
  -- Uno de cada siete cobros lleva además un producto (champú, cera, esmalte…), vendido por quien atendió.
  if not p_anulada and (p_h / 13) % 100 < 14 then
    select array_agg(pr order by pr.nombre) into v_productos from productos pr where pr.negocio_id = p_negocio;
    if v_productos is not null then
      v_prod := v_productos[1 + (p_h / 41) % array_length(v_productos, 1)];
      v_sub := v_sub + v_cant * v_prod.precio;
    end if;
  end if;
  if p_h % 100 between 4 and 9 then
    v_desc := round(p_cita.precio * 0.1 / 1000) * 1000;   -- 10 % de descuento de vez en cuando
  end if;
  v_total := v_sub - v_desc;
  v_metodo := v_metodos[case when v_r < 40 then 1 when v_r < 65 then 2 when v_r < 80 then 3 when v_r < 90 then 4
                             else 5 end];
  v_primer := case when v_abono and not p_anulada then round(v_total / 2000.0) * 1000 else v_total end;

  insert into ventas (negocio_id, local_id, correlativo, cliente_id, subtotal, descuento, total, pagado, estado,
                      created_at)
  values (p_negocio, p_cita.local_id, p_numero, p_cita.cliente_id, v_sub, v_desc, v_total, v_primer,
          case when v_primer = v_total then 'pagada' else 'parcial' end::estado_venta, p_cuando)
  returning * into v_venta;
  insert into venta_items (venta_id, servicio_id, cita_id, profesional_id, descripcion, cantidad, precio_unitario,
                           total, vigente)
  select v_venta.id, s.id, p_cita.id, p_cita.profesional_id, s.nombre, 1, p_cita.precio, p_cita.precio, not p_anulada
    from servicios s where s.id = p_cita.servicio_id;
  if v_prod.id is not null then
    insert into venta_items (venta_id, producto_id, profesional_id, descripcion, cantidad, precio_unitario, total)
    values (v_venta.id, v_prod.id, p_cita.profesional_id, v_prod.nombre, v_cant, v_prod.precio, v_cant * v_prod.precio);
    -- Las existencias las cuadra demo_cerrar_inventario al final (entrada inicial = lo que quedó + lo vendido).
    insert into movimientos_stock (negocio_id, producto_id, tipo, cantidad, venta_id, nota, created_at)
    values (p_negocio, v_prod.id, 'venta', -v_cant, v_venta.id, 'Venta ' || v_venta.numero, p_cuando);
  end if;

  -- Propina (0019): en más o menos la mitad de los pagos completos con tarjeta o billetera, del 5 al 15 %. En
  -- efectivo no, para no mover el vuelto de la semilla.
  insert into pagos (negocio_id, venta_id, metodo_id, monto, recibido, comprobante, abono, created_at, propina)
  values (p_negocio, v_venta.id, v_metodo.id, v_primer,
          case when v_metodo.tipo = 'efectivo'
               then case (p_h / 19) % 3 when 0 then v_primer else ceil(v_primer / 10000.0) * 10000 end end,
          case when v_metodo.tipo in ('debito', 'credito') then lpad(((p_h / 3) % 1000000)::text, 6, '0') end,
          v_primer < v_total, p_cuando,
          case when v_primer = v_total and v_metodo.tipo in ('debito', 'credito', 'billetera') and (p_h / 17) % 2 = 0
               then round(v_total * (5 + 5 * ((p_h / 29) % 3)) / 100000.0)::int * 1000 else 0 end)
  returning id into v_pago;
  insert into movimientos_caja (negocio_id, local_id, tipo, monto, efectivo, concepto, metodo, pago_id, venta_id,
                                created_at)
  values (p_negocio, p_cita.local_id, 'ingreso', v_primer, v_metodo.tipo = 'efectivo',
          case when v_primer < v_total then 'Abono de la venta ' else 'Venta ' end || v_venta.numero, v_metodo.nombre,
          v_pago, v_venta.id, p_cuando);

  if p_anulada then
    update ventas set estado = 'anulada', motivo_anulacion = 'Se registró con el método de pago equivocado',
                      anulada_at = p_cuando + interval '10 minutes'
     where id = v_venta.id;
    insert into movimientos_caja (negocio_id, local_id, tipo, monto, efectivo, concepto, metodo, venta_id, created_at)
    values (p_negocio, p_cita.local_id, 'egreso', -v_primer, v_metodo.tipo = 'efectivo',
            'Anulación de la venta ' || v_venta.numero, v_metodo.nombre, v_venta.id, p_cuando + interval '10 minutes');
  elsif v_primer < v_total and v_saldo_pagado then
    -- El saldo lo pagó días después, en efectivo.
    insert into pagos (negocio_id, venta_id, metodo_id, monto, recibido, abono, created_at)
    values (p_negocio, v_venta.id, v_metodos[1].id, v_total - v_primer, v_total - v_primer, true,
            p_cuando + interval '3 days')
    returning id into v_pago;
    insert into movimientos_caja (negocio_id, local_id, tipo, monto, efectivo, concepto, metodo, pago_id, venta_id,
                                  created_at)
    values (p_negocio, p_cita.local_id, 'ingreso', v_total - v_primer, true, 'Abono de la venta ' || v_venta.numero,
            v_metodos[1].nombre, v_pago, v_venta.id, p_cuando + interval '3 days');
    update ventas set pagado = total, estado = 'pagada' where id = v_venta.id;
  end if;
end;
$$;

create or replace function public.demo_sembrar_ventas(p_negocio uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_lunes date := date_trunc('week', v_hoy)::date;
  v_local uuid := demo_ids('local');
  v_numero int := 1001;
  c citas;
  v_h bigint;
  v_cuando timestamptz;
  v_dia date;
  v_saldo int;
  v_sacar int;
begin
  perform demo_sembrar_metodos(p_negocio);

  -- Base de caja del primer día.
  insert into movimientos_caja (negocio_id, local_id, tipo, monto, efectivo, concepto, created_at)
  values (p_negocio, v_local, 'ingreso', 200000, true, 'Base de caja',
          (v_lunes - 35 + time '08:30') at time zone 'America/Bogota');

  for c in
    select * from citas
     where negocio_id = p_negocio and estado = 'asiste'
       and (fecha + hora_fin) at time zone 'America/Bogota' < now()
     order by fecha, hora_fin, profesional_id
  loop
    v_h := abs(hashtext(c.fecha::text || c.profesional_id::text || c.hora_inicio::text || 'venta'));
    -- Sin cobrar: la mitad de hoy y ayer, y un 4 % de lo anterior.
    continue when (c.fecha >= v_hoy - 1 and v_h % 100 < 50) or v_h % 100 < 4;
    v_cuando := (c.fecha + c.hora_fin) at time zone 'America/Bogota' + interval '5 minutes';
    if (v_h / 17) % 100 < 2 then
      -- Cobrada con el método equivocado: se anuló y se volvió a cobrar enseguida.
      perform demo_venta(p_negocio, c, v_numero, v_cuando, v_h, true);
      v_numero := v_numero + 1;
      v_cuando := v_cuando + interval '12 minutes';
      v_h := v_h / 29;
    end if;
    perform demo_venta(p_negocio, c, v_numero, v_cuando, v_h, false);
    v_numero := v_numero + 1;
  end loop;

  -- Cada lunes, compra de insumos en efectivo; cada sábado al cierre, se consigna al banco lo que pasa de la base.
  for v_dia in select g::date from generate_series(v_lunes - 35, v_hoy - 1, interval '1 day') g loop
    if extract(isodow from v_dia) = 1 then
      insert into movimientos_caja (negocio_id, local_id, tipo, monto, efectivo, concepto, created_at)
      values (p_negocio, v_local, 'egreso', -(35000 + (abs(hashtext(v_dia::text)) % 5) * 10000), true,
              case abs(hashtext(v_dia::text || 'c')) % 3 when 0 then 'Compra de insumos de uñas'
                   when 1 then 'Compra de tintes y champú' else 'Aseo y cafetería' end,
              (v_dia + time '09:15') at time zone 'America/Bogota');
    elsif extract(isodow from v_dia) = 6 then
      select coalesce(sum(monto), 0) into v_saldo from movimientos_caja
       where local_id = v_local and efectivo and created_at <= (v_dia + time '19:30') at time zone 'America/Bogota';
      v_sacar := floor((v_saldo - 200000) / 10000.0) * 10000;
      if v_sacar > 0 then
        insert into movimientos_caja (negocio_id, local_id, tipo, monto, efectivo, concepto, created_at)
        values (p_negocio, v_local, 'traspaso', -v_sacar, true, 'Consignación al banco',
                (v_dia + time '19:30') at time zone 'America/Bogota');
      end if;
    end if;
  end loop;

  -- Un conteo con faltante de $2.000 el último sábado.
  v_dia := v_lunes - 2;
  select coalesce(sum(monto), 0) into v_saldo from movimientos_caja
   where local_id = v_local and efectivo and created_at <= (v_dia + time '19:45') at time zone 'America/Bogota';
  insert into movimientos_caja (negocio_id, local_id, tipo, monto, efectivo, concepto, contado, created_at)
  values (p_negocio, v_local, 'rectificacion', -2000, true, 'Faltante al contar el efectivo', v_saldo - 2000,
          (v_dia + time '19:45') at time zone 'America/Bogota');

  update ajustes set venta_siguiente = v_numero where negocio_id = p_negocio;
end;
$$;

revoke execute on function public.demo_sembrar_metodos(uuid), public.demo_venta(uuid, citas, int, timestamptz, bigint, boolean),
  public.demo_sembrar_ventas(uuid) from public, anon, authenticated;
