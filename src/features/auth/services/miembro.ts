import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import { puede, type Accion, type Rol } from "@/shared/lib/permisos";

export interface Miembro {
  userId: string;
  negocioId: string;
  negocioNombre: string;
  negocioSlug: string;
  nombre: string;
  correo: string;
  rol: Rol;
  profesionalId: string | null;
}

/** El miembro con sesión (una consulta por petición). `null` si no hay sesión o no pertenece a un negocio. */
export const obtenerMiembro = cache(async (): Promise<Miembro | null> => {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("miembros")
    .select(
      "negocio_id, nombre, correo, rol, profesional_id, negocios(nombre, slug)",
    )
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data || !data.negocios) return null;

  return {
    userId: user.id,
    negocioId: data.negocio_id,
    negocioNombre: data.negocios.nombre,
    negocioSlug: data.negocios.slug,
    nombre: data.nombre,
    correo: data.correo,
    rol: data.rol,
    profesionalId: data.profesional_id,
  };
});

/** Para páginas: exige sesión y permiso; si no, vuelve a la agenda con el aviso. */
export async function exigirPermiso(accion: Accion): Promise<Miembro> {
  const miembro = await obtenerMiembro();
  if (!miembro) redirect("/entrar");
  if (!puede(miembro.rol, accion)) redirect("/agenda?aviso=sin-permiso");
  return miembro;
}
