-- 0003_agenda.sql — Citas y bloqueos con "hora de reloj" del local, índices para choques, RLS y Realtime.

create table citas (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  local_id uuid not null references locales(id) on delete restrict,
  cliente_id uuid not null references clientes(id) on delete restrict,
  profesional_id uuid not null references profesionales(id) on delete restrict,
  servicio_id uuid not null references servicios(id) on delete restrict,
  fecha date not null,
  hora_inicio time not null,
  duracion_min smallint not null check (duracion_min between 5 and 720),
  hora_fin time not null,             -- lo calcula el disparador (inicio + duración)
  rango tsrange generated always as (tsrange(fecha + hora_inicio, fecha + hora_fin, '[)')) stored,
  estado estado_cita not null default 'reservado',
  origen origen_cita not null default 'agenda',
  precio integer not null check (precio >= 0),
  profesional_fijo boolean not null default false,
  nota_cliente text check (char_length(nota_cliente) <= 500),
  nota_interna text check (char_length(nota_interna) <= 500),
  aviso_correo boolean not null default true,
  aviso_whatsapp boolean not null default true,
  serie_id uuid,
  creada_por uuid references miembros(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (hora_inicio < hora_fin)      -- AgedaCol no cruza medianoche
);
create index citas_local_fecha on citas (local_id, fecha);
create index citas_profesional_rango on citas using gist (profesional_id, rango) where estado <> 'cancelado';
create index citas_cliente_rango on citas using gist (cliente_id, rango) where estado <> 'cancelado';
create index citas_serie on citas (serie_id) where serie_id is not null;
create index citas_cliente on citas (cliente_id);

create or replace function public.calcular_fin_cita() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.hora_inicio + make_interval(mins => new.duracion_min) <= new.hora_inicio then
    raise exception 'La cita no puede pasar de la medianoche' using errcode = '22023';
  end if;
  new.hora_fin := new.hora_inicio + make_interval(mins => new.duracion_min);
  return new;
end;
$$;
create trigger citas_fin before insert or update of hora_inicio, duracion_min on citas
  for each row execute function calcular_fin_cita();
create trigger citas_updated_at before update on citas
  for each row execute function tocar_updated_at();

create table bloqueos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  profesional_id uuid not null references profesionales(id) on delete cascade,
  motivo text not null default 'Bloqueo' check (char_length(motivo) between 1 and 80),
  inicio timestamp not null,          -- hora de reloj del local
  fin timestamp not null,
  rango tsrange generated always as (tsrange(inicio, fin, '[)')) stored,
  serie_id uuid,
  created_at timestamptz not null default now(),
  check (inicio < fin)
);
create index bloqueos_profesional_rango on bloqueos using gist (profesional_id, rango);

-- El buzón ya existía: ahora sí apunta a las citas.
alter table avisos_demo
  add constraint avisos_demo_cita_id_fkey foreign key (cita_id) references citas(id) on delete cascade;

-- RLS ---------------------------------------------------------------------------
alter table citas enable row level security;
alter table bloqueos enable row level security;

-- Dueño y recepción ven todo el negocio; el profesional, solo sus citas.
create policy "leen citas" on citas for select to authenticated
  using (negocio_id = mi_negocio() and (mi_rol() in ('dueno','recepcion') or profesional_id = mi_profesional()));
create policy "dueno y recepcion escriben citas" on citas for all to authenticated
  using (negocio_id = mi_negocio() and mi_rol() in ('dueno','recepcion'))
  with check (negocio_id = mi_negocio() and mi_rol() in ('dueno','recepcion'));

create policy "miembros leen bloqueos" on bloqueos for select to authenticated using (negocio_id = mi_negocio());
create policy "dueno y recepcion escriben bloqueos" on bloqueos for all to authenticated
  using (negocio_id = mi_negocio() and mi_rol() in ('dueno','recepcion'))
  with check (negocio_id = mi_negocio() and mi_rol() in ('dueno','recepcion'));

grant select, insert, update, delete on citas, bloqueos to authenticated;
grant all on citas, bloqueos to service_role;

-- Lectura de la agenda por rango: trae el nombre del cliente aunque el profesional no pueda leer la
-- tabla de clientes, y oculta teléfono y correo a ese rol.
create or replace function public.agenda_citas(p_local uuid, p_desde date, p_hasta date)
returns table (
  id uuid, profesional_id uuid, servicio_id uuid, cliente_id uuid,
  cliente_nombre text, cliente_telefono text, cliente_correo text, servicio_nombre text,
  fecha date, hora_inicio time, hora_fin time, duracion_min smallint,
  estado estado_cita, origen origen_cita, precio integer,
  nota_cliente text, nota_interna text, serie_id uuid, profesional_fijo boolean,
  aviso_correo boolean, aviso_whatsapp boolean
)
language sql stable security definer set search_path = public as $$
  select c.id, c.profesional_id, c.servicio_id, c.cliente_id,
         cl.nombre || ' ' || cl.apellido,
         case when mi_rol() = 'profesional' then null else cl.telefono end,
         case when mi_rol() = 'profesional' then null else cl.correo end,
         s.nombre,
         c.fecha, c.hora_inicio, c.hora_fin, c.duracion_min, c.estado, c.origen, c.precio,
         c.nota_cliente, case when mi_rol() = 'profesional' then null else c.nota_interna end,
         c.serie_id, c.profesional_fijo, c.aviso_correo, c.aviso_whatsapp
    from citas c
    join clientes cl on cl.id = c.cliente_id
    join servicios s on s.id = c.servicio_id
   where c.negocio_id = mi_negocio()
     and c.local_id = p_local
     and c.fecha between p_desde and p_hasta
     and (mi_rol() in ('dueno','recepcion') or c.profesional_id = mi_profesional())
   order by c.fecha, c.hora_inicio;
$$;
revoke execute on function public.agenda_citas(uuid, date, date) from public, anon;
grant execute on function public.agenda_citas(uuid, date, date) to authenticated;

-- Realtime: la agenda se actualiza sola entre pestañas.
alter publication supabase_realtime add table citas, bloqueos;
