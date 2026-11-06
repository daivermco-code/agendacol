-- 0019_propinas_comprobante.sql · AgedaCol
-- Fase 12 (T-12.11, Ventas en el celular) (aprobada el 5-nov-2026):
-- 1. La propina se guarda al cobrar. Cada pago puede traer `propina` (pesos, 0 si no hay). Va aparte del monto: no
--    cuenta para el total ni para lo pagado de la venta, ni entra a la caja (es del profesional). En efectivo, lo
--    recibido tiene que cubrir el monto y la propina, y el vuelto la descuenta.
-- 2. `enviar_comprobante` recibe el canal: 'correo' o 'whatsapp' dejan un solo aviso en el buzón de la demo; sin
--    canal (null) deja los dos, como antes (la ventana de la venta y la caja desde la tableta).

-- Revisa los pagos (como en 0009) y además la propina de cada uno.
create or replace function public.revisar_pagos(p_negocio uuid, p_pagos jsonb, p_saldo int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_pago jsonb;
  v_metodo metodos_pago;
  v_monto int;
  v_propina int;
  v_recibido int;
  v_suma int := 0;
  v_vuelto int := 0;
  v_card gift_cards;
  v_usado jsonb := '{}'::jsonb;
begin
  if jsonb_typeof(p_pagos) <> 'array' or jsonb_array_length(p_pagos) > 5 then
    return error_venta('VALIDACION', 'Usa hasta 5 métodos de pago', 'pagos');
  end if;
  if p_saldo > 0 and jsonb_array_length(p_pagos) = 0 then
    return error_venta('VALIDACION', 'Elige cómo paga el cliente', 'pagos');
  end if;
  for v_pago in select * from jsonb_array_elements(p_pagos) loop
    select * into v_metodo from metodos_pago
     where id = nullif(v_pago->>'metodoId', '')::uuid and negocio_id = p_negocio and activo;
    if not found then
      return error_venta('VALIDACION', 'Ese método de pago no está disponible', 'pagos');
    end if;
    v_monto := (v_pago->>'monto')::int;
    if v_monto is null or v_monto <= 0 then
      return error_venta('VALIDACION', 'Escribe un monto mayor a cero', 'monto');
    end if;
    v_propina := coalesce((v_pago->>'propina')::int, 0);
    if v_propina < 0 or v_propina > 100000000 then
      return error_venta('VALIDACION', 'Revisa la propina', 'propina');
    end if;
    if v_propina > 0 and v_metodo.tipo = 'gift_card' then
      return error_venta('VALIDACION', 'La propina no se paga con gift card', 'propina');
    end if;
    if v_metodo.tipo = 'efectivo' then
      v_recibido := coalesce((v_pago->>'recibido')::int, v_monto + v_propina);
      if v_recibido < v_monto + v_propina then
        return error_venta('VALIDACION', 'El monto recibido no alcanza', 'recibido');
      end if;
      v_vuelto := v_vuelto + v_recibido - v_monto - v_propina;
    elsif v_metodo.tipo = 'gift_card' then
      select * into v_card from gift_cards
       where negocio_id = p_negocio and codigo = upper(trim(coalesce(v_pago->>'giftCard', '')));
      if not found then
        return error_venta('GIFT_CARD', 'No encontramos una gift card con ese código', 'giftCard');
      end if;
      if v_card.anulada then
        return error_venta('GIFT_CARD', 'Esa gift card está anulada', 'giftCard');
      end if;
      if v_card.vence < hoy_bogota() then
        return error_venta('GIFT_CARD', format('Esa gift card venció el %s', to_char(v_card.vence, 'DD/MM/YYYY')),
                           'giftCard');
      end if;
      v_usado := v_usado || jsonb_build_object(v_card.codigo,
                                               coalesce((v_usado->>v_card.codigo)::int, 0) + v_monto);
      if (v_usado->>v_card.codigo)::int > v_card.saldo then
        return error_venta('GIFT_CARD', format('A esa gift card le quedan %s', pesos_texto(v_card.saldo)), 'giftCard');
      end if;
    end if;
    v_suma := v_suma + v_monto;
  end loop;
  if v_suma > p_saldo then
    return error_venta('PAGOS_SUPERAN', 'Los pagos superan el total', 'pagos');
  end if;
  return jsonb_build_object('ok', true, 'suma', v_suma, 'vuelto', v_vuelto);
end;
$$;

-- Guarda los pagos (como en 0009) con su propina. La caja recibe solo el monto de la venta.
create or replace function public.insertar_pagos(p_venta ventas, p_pagos jsonb, p_abono boolean, p_miembro uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_pago jsonb;
  v_metodo metodos_pago;
  v_id uuid;
  v_caja boolean;
  v_card gift_cards;
  v_propina int;
begin
  select caja_activa into v_caja from ajustes where negocio_id = p_venta.negocio_id;
  for v_pago in select * from jsonb_array_elements(p_pagos) loop
    select * into v_metodo from metodos_pago where id = (v_pago->>'metodoId')::uuid;
    v_propina := coalesce((v_pago->>'propina')::int, 0);
    v_card := null;
    if v_metodo.tipo = 'gift_card' then
      select * into v_card from gift_cards
       where negocio_id = p_venta.negocio_id and codigo = upper(trim(v_pago->>'giftCard')) for update;
      if v_card.saldo < (v_pago->>'monto')::int then
        raise exception 'A esa gift card ya no le alcanza el saldo' using errcode = '22023';
      end if;
      update gift_cards set saldo = saldo - (v_pago->>'monto')::int where id = v_card.id;
    end if;
    insert into pagos (negocio_id, venta_id, metodo_id, monto, recibido, comprobante, abono, creado_por, gift_card_id,
                       propina)
    values (p_venta.negocio_id, p_venta.id, v_metodo.id, (v_pago->>'monto')::int,
            case when v_metodo.tipo = 'efectivo'
                 then coalesce((v_pago->>'recibido')::int, (v_pago->>'monto')::int + v_propina) end,
            coalesce(v_card.codigo, nullif(left(trim(v_pago->>'comprobante'), 40), '')), p_abono, p_miembro, v_card.id,
            v_propina)
    returning id into v_id;
    if v_caja and v_metodo.tipo <> 'gift_card' then
      insert into movimientos_caja (negocio_id, local_id, tipo, monto, efectivo, concepto, metodo, pago_id, venta_id,
                                    creado_por)
      values (p_venta.negocio_id, p_venta.local_id, 'ingreso', (v_pago->>'monto')::int, v_metodo.tipo = 'efectivo',
              case when p_abono then 'Abono de la venta ' else 'Venta ' end || p_venta.numero, v_metodo.nombre, v_id,
              p_venta.id, p_miembro);
    end if;
  end loop;
end;
$$;

-- Comprobante al buzón de la demo: por un canal ('correo' o 'whatsapp') o por los dos (null).
drop function public.enviar_comprobante(uuid);
create function public.enviar_comprobante(p_venta uuid, p_canal text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v record;
  v_detalle text;
  v_pagos text;
  v_cuerpo text;
  v_canal canal_aviso;
  v_canales canal_aviso[];
  v_destino text;
begin
  if mi_rol() is null or mi_rol() not in ('dueno', 'recepcion') then
    return error_venta('SIN_PERMISO', 'Tu rol no puede enviar comprobantes');
  end if;
  if p_canal is not null and p_canal not in ('correo', 'whatsapp') then
    return error_venta('VALIDACION', 'Ese canal no existe');
  end if;
  v_canales := case when p_canal is null then array['correo', 'whatsapp']::canal_aviso[]
                    else array[p_canal]::canal_aviso[] end;
  select ve.*, cl.nombre as c_nombre, cl.apellido as c_apellido, cl.correo as c_correo, cl.telefono as c_telefono,
         n.nombre as negocio
    into v
    from ventas ve join negocios n on n.id = ve.negocio_id left join clientes cl on cl.id = ve.cliente_id
   where ve.id = p_venta and ve.negocio_id = mi_negocio();
  if not found then
    return error_venta('NO_ENCONTRADA', 'La venta ya no existe');
  end if;
  if v.cliente_id is null then
    return error_venta('VALIDACION', 'La venta no tiene cliente a quien enviarla');
  end if;
  if v.estado = 'anulada' then
    return error_venta('VALIDACION', 'Una venta anulada no tiene comprobante');
  end if;
  select string_agg(format('%s%s %s', vi.descripcion, case when vi.cantidad > 1 then ' x' || vi.cantidad else '' end,
                           pesos_texto(vi.total)), '; ' order by vi.descripcion)
    into v_detalle from venta_items vi where vi.venta_id = v.id;
  select string_agg(format('%s %s', pesos_texto(pa.monto), m.nombre), ', ' order by pa.created_at)
    into v_pagos from pagos pa join metodos_pago m on m.id = pa.metodo_id where pa.venta_id = v.id;
  v_cuerpo := format('Hola %s, gracias por tu compra en %s. Venta %s del %s: %s.%s Total %s. Pagaste %s%s.',
    v.c_nombre, v.negocio, v.numero, fecha_larga((v.created_at at time zone 'America/Bogota')::date), v_detalle,
    case when v.descuento > 0 then ' Descuento ' || pesos_texto(v.descuento) || '.' else '' end,
    pesos_texto(v.total), coalesce(v_pagos, pesos_texto(0)),
    case when v.total > v.pagado then '. Saldo pendiente ' || pesos_texto(v.total - v.pagado) else '' end);

  foreach v_canal in array v_canales loop
    v_destino := case v_canal when 'correo' then v.c_correo else v.c_telefono end;
    insert into avisos_demo (negocio_id, venta_id, canal, tipo, destinatario, destino, asunto, cuerpo, estado)
    values (v.negocio_id, v.id, v_canal, 'comprobante', v.c_nombre || ' ' || v.c_apellido, v_destino,
            case v_canal when 'correo' then format('Comprobante de la venta %s en %s', v.numero, v.negocio) end,
            v_cuerpo, case when v_destino is null then 'sin_contacto' else 'enviado' end);
  end loop;
  return jsonb_build_object('ok', true, 'sinContacto',
    case p_canal when 'correo' then v.c_correo is null
                 when 'whatsapp' then v.c_telefono is null
                 else v.c_correo is null and v.c_telefono is null end);
end;
$$;

-- Permisos (como en 0006 y 0009) -------------------------------------------------------------------------------
revoke all on function public.revisar_pagos(uuid, jsonb, int), public.insertar_pagos(ventas, jsonb, boolean, uuid)
  from public, anon, authenticated;
revoke all on function public.enviar_comprobante(uuid, text) from public, anon;
grant execute on function public.enviar_comprobante(uuid, text) to authenticated;
