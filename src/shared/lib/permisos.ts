import type { Database } from "@/types/database";

export type Rol = Database["public"]["Enums"]["rol_miembro"];

/** Lo que se puede hacer en la app. La interfaz oculta lo que no se puede; cada Server Action lo vuelve a revisar. */
export type Accion =
  | "ver_resumen"
  | "ver_agenda"
  | "ver_agenda_completa"
  | "crear_cita"
  | "cambiar_estado_cita"
  | "bloquear_horario"
  | "ver_clientes"
  | "ver_contactos"
  | "editar_clientes"
  | "cobrar"
  | "ver_ventas"
  | "ver_caja"
  | "anular_venta"
  | "ver_reportes_reservas"
  | "ver_reportes_ventas"
  | "ver_marketing"
  | "administrar"
  | "editar_ajustes"
  | "gestionar_usuarios"
  | "reiniciar_demo"
  | "ver_buzon";

const RECEPCION: ReadonlySet<Accion> = new Set<Accion>([
  "ver_resumen",
  "ver_agenda",
  "ver_agenda_completa",
  "crear_cita",
  "cambiar_estado_cita",
  "bloquear_horario",
  "ver_clientes",
  "ver_contactos",
  "editar_clientes",
  "cobrar",
  "ver_ventas",
  "ver_reportes_reservas",
  "ver_buzon",
]);

const PROFESIONAL: ReadonlySet<Accion> = new Set<Accion>([
  "ver_agenda",
  "cambiar_estado_cita",
]);

/** Tabla de roles de TECH-SPEC §6.2. El dueño puede todo. */
export function puede(rol: Rol | null | undefined, accion: Accion): boolean {
  if (!rol) return false;
  if (rol === "dueno") return true;
  if (rol === "recepcion") return RECEPCION.has(accion);
  return PROFESIONAL.has(accion);
}

/**
 * Permiso que pide cada sección por su ruta. La más específica gana (se revisan en orden).
 * Lo que no aparece aquí solo pide sesión.
 */
const PERMISO_POR_RUTA: ReadonlyArray<readonly [string, Accion]> = [
  ["/ventas/caja", "ver_caja"],
  ["/ventas", "ver_ventas"],
  ["/clientes/marketing", "ver_marketing"],
  ["/clientes/crece", "ver_marketing"],
  ["/clientes/fidelizacion", "ver_marketing"],
  ["/clientes/recordatorios", "ver_marketing"],
  ["/clientes", "ver_clientes"],
  ["/reportes/reservas", "ver_reportes_reservas"],
  ["/reportes", "ver_reportes_ventas"],
  ["/administracion", "administrar"],
  ["/ajustes", "editar_ajustes"],
  ["/primeros-pasos", "editar_ajustes"],
  ["/usuarios", "gestionar_usuarios"],
  ["/demo/buzon", "ver_buzon"],
  ["/agenda", "ver_agenda"],
];

export function permisoDeRuta(ruta: string): Accion | null {
  if (ruta === "/") return "ver_resumen";
  // El centro de Ajustes del celular solo pide sesión: muestra a cada rol lo que ya puede abrir
  //. Cada `/ajustes/<sección>` sigue pidiendo `editar_ajustes`.
  if (ruta === "/ajustes") return null;
  const encontrado = PERMISO_POR_RUTA.find(
    ([prefijo]) => ruta === prefijo || ruta.startsWith(`${prefijo}/`),
  );
  return encontrado ? encontrado[1] : null;
}

export function puedeVerRuta(
  rol: Rol | null | undefined,
  ruta: string,
): boolean {
  const accion = permisoDeRuta(ruta);
  return accion === null ? Boolean(rol) : puede(rol, accion);
}

export const NOMBRE_ROL: Record<Rol, string> = {
  dueno: "Dueño",
  recepcion: "Recepción",
  profesional: "Profesional",
};
