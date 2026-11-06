import type { Metadata } from "next";
import { exigirPermiso } from "@/features/auth/services/miembro";
import { UsuariosVista } from "@/features/usuarios/components/usuarios-vista";
import { crearClienteServidor } from "@/shared/lib/supabase/server";

export const metadata: Metadata = { title: "Usuarios" };

const ROLES = [
  {
    nombre: "Dueño",
    texto:
      "Ve y cambia todo: agenda, ventas, caja, reportes, administración, ajustes y usuarios.",
  },
  {
    nombre: "Recepción",
    texto:
      "Agenda, clientes y cobros del local. No entra a administración, ajustes, usuarios ni caja.",
  },
  {
    nombre: "Profesional",
    texto:
      "Ve solo su agenda y cambia el estado de sus citas. No ve los contactos de los clientes.",
  },
];

export default async function PaginaUsuarios() {
  const yo = await exigirPermiso("gestionar_usuarios");
  const supabase = await crearClienteServidor();
  const [{ data: miembros }, { data: profesionales }] = await Promise.all([
    supabase
      .from("miembros")
      .select("id, user_id, nombre, correo, rol, profesionales(nombre)")
      .order("created_at"),
    supabase
      .from("profesionales")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre"),
  ]);
  const usuarios = (miembros ?? []).map((m) => ({
    id: m.id,
    nombre: m.nombre,
    correo: m.correo,
    rol: m.rol,
    profesional: m.profesionales?.nombre ?? null,
    soyYo: m.user_id === yo.userId,
  }));

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-6 lg:px-6">
      <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-2xl">
        Usuarios
      </h1>
      <p className="text-ac-pizarra">
        Quién entra a la agenda de {yo.negocioNombre} y qué puede hacer.
      </p>
      <div className="mt-2">
        <UsuariosVista
          usuarios={usuarios}
          profesionales={profesionales ?? []}
        />
      </div>
      <section className="mt-6 grid gap-3 md:grid-cols-3" aria-label="Roles">
        {ROLES.map((r) => (
          <div
            key={r.nombre}
            className="rounded-lg border border-ac-borde bg-ac-papel p-4"
          >
            <p className="font-semibold">{r.nombre}</p>
            <p className="mt-1 text-sm text-ac-pizarra">{r.texto}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
