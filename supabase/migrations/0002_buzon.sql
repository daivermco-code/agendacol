-- 0002_buzon.sql — Buzón de la demo (avisos y pagos simulados) e imágenes de servicios.
-- La llave avisos_demo.cita_id → citas llega en 0003_agenda.sql, cuando exista la tabla.

create table avisos_demo (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  cita_id uuid,
  venta_id uuid,
  canal canal_aviso not null,
  tipo text not null check (tipo in (
    'confirmacion','recordatorio','cambio','cancelacion','comprobante','link_pago','invitacion','enlace'
  )),
  destinatario text,                 -- nombre de quien lo recibe
  destino text,                      -- correo o teléfono inventado; null = no se habría enviado
  asunto text,
  cuerpo text not null check (char_length(cuerpo) <= 4000),
  programado_para timestamptz not null default now(),
  estado text not null default 'enviado' check (estado in ('programado','enviado','sin_contacto','omitido')),
  created_at timestamptz not null default now()
);
create index avisos_demo_negocio_fecha on avisos_demo (negocio_id, programado_para desc);
create index avisos_demo_cita on avisos_demo (cita_id) where cita_id is not null;

alter table avisos_demo enable row level security;
create policy "dueno y recepcion leen" on avisos_demo for select to authenticated
  using (negocio_id = mi_negocio() and mi_rol() in ('dueno','recepcion'));
create policy "dueno y recepcion escriben" on avisos_demo for insert to authenticated
  with check (negocio_id = mi_negocio() and mi_rol() in ('dueno','recepcion'));
grant select, insert on avisos_demo to authenticated;
grant all on avisos_demo to service_role;

-- Imágenes de servicios: lectura pública (el sitio de reservas las muestra); escribe solo el dueño,
-- dentro de la carpeta de su negocio (<negocio_id>/<archivo>).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('servicios', 'servicios', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "servicios: dueno sube" on storage.objects for insert to authenticated
  with check (bucket_id = 'servicios' and (storage.foldername(name))[1] = mi_negocio()::text and mi_rol() = 'dueno');
create policy "servicios: dueno borra" on storage.objects for delete to authenticated
  using (bucket_id = 'servicios' and (storage.foldername(name))[1] = mi_negocio()::text and mi_rol() = 'dueno');
