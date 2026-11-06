-- seed.sql · AgendaCol
-- Negocio de demostración con datos inventados. Los usuarios de demo los crea `scripts/usuarios-demo.mjs`
-- (la contraseña vive en .env.local, nunca aquí). "Reiniciar demo" llama a reiniciar_demo(), que vacía y
-- vuelve a sembrar solo este negocio sin tocar los usuarios.

-- Identificadores fijos para que reiniciar conserve los accesos de los usuarios de demo.
create or replace function public.demo_ids(clave text) returns uuid
language sql immutable set search_path = '' as $$
  select case clave
    when 'negocio'   then 'a0000000-0000-4000-8000-000000000001'::uuid
    when 'local'     then 'a1000000-0000-4000-8000-000000000001'::uuid
    when 'carolina'  then 'b0000000-0000-4000-8000-000000000001'::uuid
    when 'andres'    then 'b0000000-0000-4000-8000-000000000002'::uuid
    when 'valentina' then 'b0000000-0000-4000-8000-000000000003'::uuid
    when 'julian'    then 'b0000000-0000-4000-8000-000000000004'::uuid
  end
$$;
revoke execute on function public.demo_ids(text) from public, anon;
grant execute on function public.demo_ids(text) to authenticated;

-- Borra los datos del negocio que se vuelven a sembrar. Las tablas de fases siguientes se agregan aquí.
create or replace function public.demo_vaciar(p_negocio uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update ajustes set sellos_activos = false where negocio_id = p_negocio;
  delete from lista_espera where negocio_id = p_negocio;
  delete from accesos_cliente where negocio_id = p_negocio;
  delete from codigos_acceso where negocio_id = p_negocio;
  delete from canjes_sellos where negocio_id = p_negocio;
  delete from sellos where negocio_id = p_negocio;
  delete from plantillas_whatsapp where negocio_id = p_negocio;
  delete from clase_inscritos where negocio_id = p_negocio;
  delete from clases where negocio_id = p_negocio;
  delete from movimientos_caja where negocio_id = p_negocio;
  delete from ventas where negocio_id = p_negocio;
  delete from productos where negocio_id = p_negocio;
  delete from metodos_pago where negocio_id = p_negocio;
  delete from numeracion_cambios where negocio_id = p_negocio;
  delete from avisos_demo where negocio_id = p_negocio;
  delete from campanas where negocio_id = p_negocio;
  delete from audiencias where negocio_id = p_negocio;
  delete from bloqueos where negocio_id = p_negocio;
  delete from citas where negocio_id = p_negocio;
  delete from recursos where negocio_id = p_negocio;
  delete from bonos where negocio_id = p_negocio;
  delete from gift_cards where negocio_id = p_negocio;
  delete from planes where negocio_id = p_negocio;
  delete from gift_card_modelos where negocio_id = p_negocio;
  delete from miembros where negocio_id = p_negocio
     and correo not in ('duena@salonceiba.test', 'recepcion@salonceiba.test', 'carolina@salonceiba.test',
                        'andres@salonceiba.test', 'valentina@salonceiba.test', 'julian@salonceiba.test');
  delete from clientes where negocio_id = p_negocio;
  delete from servicios where negocio_id = p_negocio;
  delete from categorias where negocio_id = p_negocio;
  delete from profesionales
   where negocio_id = p_negocio
     and id not in (demo_ids('carolina'), demo_ids('andres'), demo_ids('valentina'), demo_ids('julian'));
  delete from locales where negocio_id = p_negocio and id <> demo_ids('local');
end;
$$;

create or replace function public.demo_sembrar_catalogo(p_negocio uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_local uuid := demo_ids('local');
  v_cat uuid;
  v_dia smallint;
begin
  insert into negocios (id, nombre, slug, descripcion)
  values (p_negocio, 'Salón Ceiba', 'salon-ceiba',
          'Peluquería, barbería, uñas y spa en Chapinero. Negocio inventado para la demo de AgendaCol.')
  on conflict (id) do update set nombre = excluded.nombre, slug = excluded.slug,
    descripcion = excluded.descripcion, logo_url = null;

  insert into locales (id, negocio_id, nombre, direccion, telefono, acepta_whatsapp, correo)
  values (v_local, p_negocio, 'Sede Chapinero', 'Calle 63 # 9-45, Bogotá', '+573000000000', true,
          'hola@salonceiba.test')
  on conflict (id) do update set nombre = excluded.nombre, direccion = excluded.direccion,
    telefono = excluded.telefono, acepta_whatsapp = true, correo = excluded.correo,
    reservas_en_linea = true, activo = true, portada_url = null;

  -- Lunes a sábado 9:00–19:00; domingo cerrado.
  delete from horarios_local where local_id = v_local;
  for v_dia in 1..7 loop
    insert into horarios_local (local_id, dia_semana, abierto, inicio, fin)
    values (v_local, v_dia, v_dia <= 6, case when v_dia <= 6 then '09:00'::time end,
            case when v_dia <= 6 then '19:00'::time end);
  end loop;

  insert into profesionales (id, negocio_id, local_id, nombre, color, orden, activo) values
    (demo_ids('carolina'),  p_negocio, v_local, 'Carolina Ruiz',    '#0E7490', 1, true),
    (demo_ids('andres'),    p_negocio, v_local, 'Andrés Molina',    '#B45309', 2, true),
    (demo_ids('valentina'), p_negocio, v_local, 'Valentina Ospina', '#BE185D', 3, true),
    (demo_ids('julian'),    p_negocio, v_local, 'Julián Herrera',   '#4D7C0F', 4, true)
  on conflict (id) do update set nombre = excluded.nombre, color = excluded.color, orden = excluded.orden,
    activo = true, local_id = excluded.local_id, foto_url = null;

  delete from horarios_profesional
   where profesional_id in (demo_ids('carolina'), demo_ids('andres'), demo_ids('valentina'), demo_ids('julian'));
  for v_dia in 1..7 loop
    insert into horarios_profesional (profesional_id, dia_semana, trabaja, inicio, fin, descanso_inicio, descanso_fin) values
      (demo_ids('carolina'), v_dia, v_dia <= 6, case when v_dia <= 6 then '09:00'::time end,
         case when v_dia <= 6 then '19:00'::time end, case when v_dia <= 6 then '13:00'::time end,
         case when v_dia <= 6 then '14:00'::time end),
      (demo_ids('andres'), v_dia, v_dia <= 6, case when v_dia <= 6 then '10:00'::time end,
         case when v_dia <= 6 then '19:00'::time end, null, null),
      (demo_ids('valentina'), v_dia, v_dia <= 6, case when v_dia <= 6 then '09:00'::time end,
         case when v_dia = 6 then '14:00'::time when v_dia < 6 then '18:00'::time end, null, null),
      (demo_ids('julian'), v_dia, v_dia between 2 and 6, case when v_dia between 2 and 6 then '11:00'::time end,
         case when v_dia between 2 and 6 then '19:00'::time end, null, null);
  end loop;

  insert into ajustes (negocio_id) values (p_negocio)
  on conflict (negocio_id) do update set
    bloque_min = 60, permitir_sobrepuestas = false, permitir_cliente_doble = false, exigir_contacto = false,
    bloquear_pasadas = false, permitir_fuera_horario = true, aviso_correo = true, aviso_whatsapp = true,
    recordatorio_correo = true, recordatorio_whatsapp = true, recordatorio_correo_dias = 2,
    recordatorio_correo_hora = '07:30', recordatorio_whatsapp_dias = 1, recordatorio_whatsapp_hora = '08:30',
    caja_activa = true, caja_cliente_obligatorio = false, venta_prefijo = '', venta_siguiente = 1001;
  -- Sitio web y avisos al equipo: aparte del upsert, porque en una base nueva la fila nace con los valores por
  -- defecto y el "do update" no corre.
  update ajustes set
    web_anticipacion_min = 30, web_dias_max = 60, web_cliente_cancela = true, web_cliente_cambia = true,
    web_limite_horas = 0, red_instagram = null, red_facebook = null, red_tiktok = null,
    web_politica = 'Si llegas más de 15 minutos tarde, puede que tengamos que mover tu hora. Si no puedes venir, '
      || 'avísanos con tiempo para darle el espacio a otra persona.',
    aviso_equipo_reserva = true, aviso_equipo_cambios = true, aviso_equipo_correo = null
  where negocio_id = p_negocio;

  -- Catálogo: 5 categorías, 20 servicios.
  insert into categorias (negocio_id, nombre, orden) values (p_negocio, 'Cabello', 1) returning id into v_cat;
  insert into servicios (negocio_id, categoria_id, nombre, precio, duracion_min, orden, descripcion) values
    (p_negocio, v_cat, 'Corte de dama',        45000,  45, 1, 'Lavado, corte y secado.'),
    (p_negocio, v_cat, 'Corte de caballero',   30000,  30, 2, null),
    (p_negocio, v_cat, 'Corte infantil',       25000,  30, 3, 'Para menores de 12 años.'),
    (p_negocio, v_cat, 'Cepillado',            35000,  45, 4, null),
    (p_negocio, v_cat, 'Tinte completo',      140000, 120, 5, 'Incluye diagnóstico de color.'),
    (p_negocio, v_cat, 'Mechas balayage',     260000, 180, 6, null),
    (p_negocio, v_cat, 'Keratina',            220000, 150, 7, null);
  insert into categorias (negocio_id, nombre, orden) values (p_negocio, 'Barbería', 2) returning id into v_cat;
  insert into servicios (negocio_id, categoria_id, nombre, precio, duracion_min, orden) values
    (p_negocio, v_cat, 'Arreglo de barba',     20000,  20, 1),
    (p_negocio, v_cat, 'Corte y barba',        45000,  50, 2),
    (p_negocio, v_cat, 'Afeitado clásico',     28000,  30, 3);
  insert into categorias (negocio_id, nombre, orden) values (p_negocio, 'Uñas', 3) returning id into v_cat;
  insert into servicios (negocio_id, categoria_id, nombre, precio, duracion_min, orden) values
    (p_negocio, v_cat, 'Manicure tradicional',      25000,  45, 1),
    (p_negocio, v_cat, 'Pedicure tradicional',      32000,  60, 2),
    (p_negocio, v_cat, 'Manicure semipermanente',   45000,  60, 3),
    (p_negocio, v_cat, 'Uñas acrílicas',            95000, 120, 4);
  insert into categorias (negocio_id, nombre, orden) values (p_negocio, 'Spa', 4) returning id into v_cat;
  insert into servicios (negocio_id, categoria_id, nombre, precio, duracion_min, orden) values
    (p_negocio, v_cat, 'Masaje relajante',              90000,  60, 1),
    (p_negocio, v_cat, 'Limpieza facial',               85000,  60, 2),
    (p_negocio, v_cat, 'Masaje con piedras calientes', 130000,  90, 3);
  insert into categorias (negocio_id, nombre, orden) values (p_negocio, 'Cejas y pestañas', 5) returning id into v_cat;
  insert into servicios (negocio_id, categoria_id, nombre, precio, duracion_min, orden) values
    (p_negocio, v_cat, 'Diseño de cejas',      25000,  30, 1),
    (p_negocio, v_cat, 'Lifting de pestañas',  70000,  60, 2),
    (p_negocio, v_cat, 'Laminado de cejas',    60000,  45, 3);

  -- Quién hace qué.
  insert into servicio_profesional (servicio_id, profesional_id)
  select s.id, demo_ids('carolina') from servicios s join categorias c on c.id = s.categoria_id
   where s.negocio_id = p_negocio and (c.nombre = 'Cabello' and s.nombre <> 'Corte de caballero'
      or s.nombre = 'Diseño de cejas');
  insert into servicio_profesional (servicio_id, profesional_id)
  select s.id, demo_ids('andres') from servicios s join categorias c on c.id = s.categoria_id
   where s.negocio_id = p_negocio and (c.nombre = 'Barbería' or s.nombre in ('Corte de caballero', 'Corte infantil'));
  insert into servicio_profesional (servicio_id, profesional_id)
  select s.id, demo_ids('valentina') from servicios s join categorias c on c.id = s.categoria_id
   where s.negocio_id = p_negocio and c.nombre in ('Uñas', 'Cejas y pestañas');
  insert into servicio_profesional (servicio_id, profesional_id)
  select s.id, demo_ids('julian') from servicios s join categorias c on c.id = s.categoria_id
   where s.negocio_id = p_negocio and (c.nombre = 'Spa' or s.nombre in ('Arreglo de barba', 'Afeitado clásico'));
end;
$$;

-- 80 clientes inventados: correos @ejemplo.test y teléfonos +57 300 000 xxxx (no existen).
create or replace function public.demo_sembrar_clientes(p_negocio uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_nombres text[] := array['Ana','Camila','Daniela','Valeria','Sofía','Mariana','Isabella','Laura','Natalia',
    'Paula','Juliana','Catalina','Gabriela','Manuela','Sara','Luisa','Carolina','Andrea','Diana','Lorena',
    'Santiago','Sebastián','Mateo','Nicolás','Alejandro','Samuel','Daniel','Juan','Felipe','Tomás',
    'Esteban','David','Miguel','Andrés','Camilo','Diego','Simón','Martín','Emilio','Óscar'];
  v_apellidos text[] := array['García','Rodríguez','Martínez','López','González','Hernández','Pérez','Sánchez',
    'Ramírez','Torres','Flórez','Rivera','Gómez','Díaz','Moreno','Jiménez','Rojas','Vargas','Castro','Ortiz',
    'Rubio','Suárez','Cárdenas','Mejía','Restrepo','Salazar','Quintero','Zapata','Arango','Patiño',
    'Ospina','Bermúdez','Cifuentes','Velásquez','Londoño','Gutiérrez','Aguilar','Parra','Muñoz','Acosta'];
  v_barrios text[] := array['Chapinero','Teusaquillo','Usaquén','Cedritos','La Soledad','Galerías','Chicó',
    'Palermo','Rosales','Quinta Camacho'];
  i int;
  v_nombre text;
  v_apellido text;
  v_base text;
begin
  for i in 1..80 loop
    v_nombre := v_nombres[1 + ((i - 1) % 40)];
    -- Del 41 en adelante el apellido se corre 3 lugares: nadie repite nombre completo.
    v_apellido := v_apellidos[1 + ((i * 7 + case when i > 40 then 3 else 0 end) % 40)];
    v_base := lower(translate(v_nombre || '.' || v_apellido, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'));
    insert into clientes (negocio_id, nombre, apellido, documento, fecha_nacimiento, genero, numero_cliente,
                          correo, telefono, barrio, municipio, created_at)
    values (
      p_negocio, v_nombre, v_apellido,
      case when i % 4 <> 0 then (10000000 + i * 7919)::text end,
      case when i % 3 <> 0 then (date '1975-01-15' + (i * 211) % 12000) end,
      case when i <= 20 or i between 41 and 60 then 'femenino' else 'masculino' end,
      lpad(i::text, 4, '0'),
      case when i % 9 <> 0 then v_base || i || '@ejemplo.test' end,
      case when i % 13 <> 0 then '+57300000' || lpad(i::text, 4, '0') end,
      v_barrios[1 + (i % 10)], 'Bogotá',
      case when i > 76 then now() - make_interval(days => 80 - i) else now() - make_interval(days => 30 + i * 5) end
    );
  end loop;
end;
$$;

create or replace function public.demo_sembrar(p_negocio uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform demo_sembrar_catalogo(p_negocio);
  perform demo_sembrar_clientes(p_negocio);
  perform demo_sembrar_recursos(p_negocio);
  perform demo_sembrar_citas(p_negocio);
  perform demo_sembrar_recordatorios(p_negocio);
  perform demo_sembrar_productos(p_negocio);
  perform demo_sembrar_ventas(p_negocio);
  perform demo_cerrar_inventario(p_negocio);
  perform demo_sembrar_planes(p_negocio);
  perform demo_sembrar_clases(p_negocio);
  perform demo_sembrar_sede(p_negocio);
  perform demo_sembrar_marketing(p_negocio);
  perform demo_sembrar_espera(p_negocio);
end;
$$;

-- Botón "Reiniciar demo": solo el dueño del negocio de demo puede dejarlo como nuevo.
create or replace function public.reiniciar_demo() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_negocio uuid := mi_negocio();
begin
  if v_negocio is null or v_negocio <> demo_ids('negocio') or mi_rol() <> 'dueno' then
    raise exception 'Solo el negocio de demostración se puede reiniciar' using errcode = '42501';
  end if;
  perform demo_vaciar(v_negocio);
  perform demo_sembrar(v_negocio);
end;
$$;

revoke execute on function public.demo_vaciar(uuid), public.demo_sembrar_catalogo(uuid),
  public.demo_sembrar_clientes(uuid), public.demo_sembrar(uuid), public.reiniciar_demo() from public, anon;
grant execute on function public.reiniciar_demo() to authenticated;

select public.demo_sembrar(public.demo_ids('negocio'));
