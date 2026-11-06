-- 0001_base.sql · AgedaCol
-- Tipos, negocio, locales, horarios, equipo, servicios, clientes, miembros y ajustes, con RLS.
-- Regla: anon no toca ninguna tabla; cada miembro solo ve su negocio; administración y ajustes, solo el dueño.

create extension if not exists btree_gist;

create type rol_miembro as enum ('dueno', 'recepcion', 'profesional');
create type estado_cita as enum ('reservado','confirmado','asiste','no_asistio','pendiente','en_espera','cancelado');
create type origen_cita as enum ('agenda', 'en_linea');
create type estado_venta as enum ('pagada', 'parcial', 'anulada');
create type tipo_movimiento as enum ('ingreso', 'egreso', 'traspaso', 'rectificacion');
create type canal_aviso as enum ('correo', 'whatsapp');

-- updated_at automático ------------------------------------------------------
create or replace function public.tocar_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Tablas ----------------------------------------------------------------------
create table negocios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  descripcion text,
  logo_url text,
  moneda char(3) not null default 'COP',
  pais char(2) not null default 'CO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table locales (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 2 and 80),
  direccion text,
  telefono text,
  acepta_whatsapp boolean not null default false,
  correo text,
  zona_horaria text not null default 'America/Bogota',
  reservas_en_linea boolean not null default true,
  portada_url text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on locales (negocio_id);

-- dia_semana: 1 = lunes … 7 = domingo (ISO)
create table horarios_local (
  local_id uuid not null references locales(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 1 and 7),
  abierto boolean not null default true,
  inicio time,
  fin time,
  descanso_inicio time,
  descanso_fin time,
  primary key (local_id, dia_semana),
  check (not abierto or (inicio is not null and fin is not null and inicio < fin)),
  check ((descanso_inicio is null) = (descanso_fin is null)),
  check (descanso_inicio is null or (descanso_inicio >= inicio and descanso_fin <= fin and descanso_inicio < descanso_fin))
);

create table profesionales (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  local_id uuid not null references locales(id) on delete restrict,
  nombre text not null check (char_length(nombre) between 2 and 80),
  foto_url text,
  color text,
  activo boolean not null default true,
  orden smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on profesionales (local_id) where activo;

create table horarios_profesional (
  profesional_id uuid not null references profesionales(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 1 and 7),
  trabaja boolean not null default true,
  inicio time,
  fin time,
  descanso_inicio time,
  descanso_fin time,
  primary key (profesional_id, dia_semana),
  check (not trabaja or (inicio is not null and fin is not null and inicio < fin)),
  check ((descanso_inicio is null) = (descanso_fin is null))
);

create table categorias (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 2 and 60),
  orden smallint not null default 0,
  unique (negocio_id, nombre)
);

create table servicios (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  categoria_id uuid not null references categorias(id) on delete restrict,
  nombre text not null check (char_length(nombre) between 2 and 80),
  precio integer not null check (precio >= 0),
  duracion_min smallint not null check (duracion_min between 5 and 720),
  descripcion text,
  en_linea boolean not null default true,
  mostrar_precio boolean not null default true,
  mostrar_duracion boolean not null default true,
  imagenes text[] not null default '{}' check (cardinality(imagenes) <= 3),
  activo boolean not null default true,
  orden smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on servicios (categoria_id);

create table servicio_profesional (
  servicio_id uuid not null references servicios(id) on delete cascade,
  profesional_id uuid not null references profesionales(id) on delete cascade,
  primary key (servicio_id, profesional_id)
);

create table clientes (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 60),
  apellido text not null check (char_length(apellido) between 1 and 60),
  documento text,
  fecha_nacimiento date,
  genero text check (genero in ('femenino','masculino','otro')),
  numero_cliente text,
  correo text check (correo is null or correo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefono text check (telefono is null or telefono ~ '^\+[0-9]{8,15}$'),
  direccion text,
  barrio text,
  municipio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on clientes (negocio_id, apellido, nombre);
create index clientes_busqueda on clientes using gin (
  to_tsvector('spanish', coalesce(nombre,'') || ' ' || coalesce(apellido,'') || ' ' || coalesce(documento,'') || ' ' || coalesce(correo,''))
);

-- Un usuario pertenece a un negocio. Si se borra su profesional, se borra el acceso (lo usa "Reiniciar demo").
create table miembros (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  nombre text not null,
  correo text not null,
  rol rol_miembro not null,
  profesional_id uuid references profesionales(id) on delete cascade,
  locales uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  check (rol <> 'profesional' or profesional_id is not null)
);

create table ajustes (
  negocio_id uuid primary key references negocios(id) on delete cascade,
  bloque_min smallint not null default 60 check (bloque_min in (5,10,15,20,30,40,45,60)),
  permitir_sobrepuestas boolean not null default false,
  permitir_cliente_doble boolean not null default false,
  exigir_contacto boolean not null default false,
  bloquear_pasadas boolean not null default false,
  permitir_fuera_horario boolean not null default true,
  aviso_correo boolean not null default true,
  aviso_whatsapp boolean not null default true,
  recordatorio_correo boolean not null default true,
  recordatorio_whatsapp boolean not null default true,
  recordatorio_correo_dias smallint not null default 2 check (recordatorio_correo_dias between 0 and 7),
  recordatorio_correo_hora time not null default '07:30',
  recordatorio_whatsapp_dias smallint not null default 1 check (recordatorio_whatsapp_dias between 0 and 7),
  recordatorio_whatsapp_hora time not null default '08:30',
  caja_activa boolean not null default true,
  caja_cliente_obligatorio boolean not null default false,
  venta_prefijo text not null default '' check (char_length(venta_prefijo) <= 6),
  venta_siguiente integer not null default 1001 check (venta_siguiente > 0)
);

create trigger negocios_updated before update on negocios for each row execute function tocar_updated_at();
create trigger locales_updated before update on locales for each row execute function tocar_updated_at();
create trigger profesionales_updated before update on profesionales for each row execute function tocar_updated_at();
create trigger servicios_updated before update on servicios for each row execute function tocar_updated_at();
create trigger clientes_updated before update on clientes for each row execute function tocar_updated_at();

-- Quién soy ---------------------------------------------------------------------
create or replace function public.mi_negocio() returns uuid
language sql stable security definer set search_path = public as $$
  select negocio_id from miembros where user_id = auth.uid()
$$;

create or replace function public.mi_rol() returns rol_miembro
language sql stable security definer set search_path = public as $$
  select rol from miembros where user_id = auth.uid()
$$;

create or replace function public.mi_profesional() returns uuid
language sql stable security definer set search_path = public as $$
  select profesional_id from miembros where user_id = auth.uid()
$$;

-- RLS ---------------------------------------------------------------------------
alter table negocios enable row level security;
alter table locales enable row level security;
alter table horarios_local enable row level security;
alter table profesionales enable row level security;
alter table horarios_profesional enable row level security;
alter table categorias enable row level security;
alter table servicios enable row level security;
alter table servicio_profesional enable row level security;
alter table clientes enable row level security;
alter table miembros enable row level security;
alter table ajustes enable row level security;

create policy "miembros leen su negocio" on negocios
  for select to authenticated using (id = mi_negocio());
create policy "dueno edita su negocio" on negocios
  for update to authenticated using (id = mi_negocio() and mi_rol() = 'dueno')
  with check (id = mi_negocio() and mi_rol() = 'dueno');

-- Catálogo: todos los miembros leen; solo el dueño escribe.
create policy "miembros leen" on locales for select to authenticated using (negocio_id = mi_negocio());
create policy "dueno escribe" on locales for all to authenticated
  using (negocio_id = mi_negocio() and mi_rol() = 'dueno')
  with check (negocio_id = mi_negocio() and mi_rol() = 'dueno');

create policy "miembros leen" on profesionales for select to authenticated using (negocio_id = mi_negocio());
create policy "dueno escribe" on profesionales for all to authenticated
  using (negocio_id = mi_negocio() and mi_rol() = 'dueno')
  with check (negocio_id = mi_negocio() and mi_rol() = 'dueno');

create policy "miembros leen" on categorias for select to authenticated using (negocio_id = mi_negocio());
create policy "dueno escribe" on categorias for all to authenticated
  using (negocio_id = mi_negocio() and mi_rol() = 'dueno')
  with check (negocio_id = mi_negocio() and mi_rol() = 'dueno');

create policy "miembros leen" on servicios for select to authenticated using (negocio_id = mi_negocio());
create policy "dueno escribe" on servicios for all to authenticated
  using (negocio_id = mi_negocio() and mi_rol() = 'dueno')
  with check (negocio_id = mi_negocio() and mi_rol() = 'dueno');

create policy "miembros leen" on horarios_local for select to authenticated
  using (exists (select 1 from locales l where l.id = local_id and l.negocio_id = mi_negocio()));
create policy "dueno escribe" on horarios_local for all to authenticated
  using (mi_rol() = 'dueno' and exists (select 1 from locales l where l.id = local_id and l.negocio_id = mi_negocio()))
  with check (mi_rol() = 'dueno' and exists (select 1 from locales l where l.id = local_id and l.negocio_id = mi_negocio()));

create policy "miembros leen" on horarios_profesional for select to authenticated
  using (exists (select 1 from profesionales p where p.id = profesional_id and p.negocio_id = mi_negocio()));
create policy "dueno escribe" on horarios_profesional for all to authenticated
  using (mi_rol() = 'dueno' and exists (select 1 from profesionales p where p.id = profesional_id and p.negocio_id = mi_negocio()))
  with check (mi_rol() = 'dueno' and exists (select 1 from profesionales p where p.id = profesional_id and p.negocio_id = mi_negocio()));

create policy "miembros leen" on servicio_profesional for select to authenticated
  using (exists (select 1 from servicios s where s.id = servicio_id and s.negocio_id = mi_negocio()));
create policy "dueno escribe" on servicio_profesional for all to authenticated
  using (mi_rol() = 'dueno' and exists (select 1 from servicios s where s.id = servicio_id and s.negocio_id = mi_negocio()))
  with check (mi_rol() = 'dueno' and exists (select 1 from servicios s where s.id = servicio_id and s.negocio_id = mi_negocio()));

-- Clientes: el profesional no ve la base de clientes (ni sus contactos).
create policy "dueno y recepcion leen" on clientes for select to authenticated
  using (negocio_id = mi_negocio() and mi_rol() in ('dueno','recepcion'));
create policy "dueno y recepcion escriben" on clientes for all to authenticated
  using (negocio_id = mi_negocio() and mi_rol() in ('dueno','recepcion'))
  with check (negocio_id = mi_negocio() and mi_rol() in ('dueno','recepcion'));

create policy "miembros leen" on miembros for select to authenticated using (negocio_id = mi_negocio());
create policy "dueno escribe" on miembros for all to authenticated
  using (negocio_id = mi_negocio() and mi_rol() = 'dueno')
  with check (negocio_id = mi_negocio() and mi_rol() = 'dueno');

create policy "miembros leen" on ajustes for select to authenticated using (negocio_id = mi_negocio());
create policy "dueno escribe" on ajustes for update to authenticated
  using (negocio_id = mi_negocio() and mi_rol() = 'dueno')
  with check (negocio_id = mi_negocio() and mi_rol() = 'dueno');

-- anon no tiene nada: la página pública usará solo funciones publico_* (fase 5).
revoke all on all tables in schema public from anon;
revoke execute on function public.mi_negocio(), public.mi_rol(), public.mi_profesional() from public, anon;
grant execute on function public.mi_negocio(), public.mi_rol(), public.mi_profesional() to authenticated, service_role;
