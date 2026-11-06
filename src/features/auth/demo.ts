import type { Rol } from "@/shared/lib/permisos";

/**
 * Usuarios de la demo (los crea `scripts/usuarios-demo.mjs`): dueña, recepción y los 4 profesionales.
 * La contraseña vive solo en DEMO_PASSWORD.
 */
export const USUARIOS_DEMO = [
  {
    clave: "dueno",
    correo: "duena@salonceiba.test",
    nombre: "Mariana Gómez",
    rol: "dueno",
    descripcion: "Ve y configura todo el negocio",
  },
  {
    clave: "recepcion",
    correo: "recepcion@salonceiba.test",
    nombre: "Laura Pinzón",
    rol: "recepcion",
    descripcion: "Agenda, clientes y cobros",
  },
  {
    clave: "profesional",
    correo: "carolina@salonceiba.test",
    nombre: "Carolina Ruiz",
    rol: "profesional",
    descripcion: "Solo su agenda y sus citas",
  },
  {
    clave: "andres",
    correo: "andres@salonceiba.test",
    nombre: "Andrés Molina",
    rol: "profesional",
    descripcion: "Solo su agenda y sus citas",
  },
  {
    clave: "valentina",
    correo: "valentina@salonceiba.test",
    nombre: "Valentina Ospina",
    rol: "profesional",
    descripcion: "Solo su agenda y sus citas",
  },
  {
    clave: "julian",
    correo: "julian@salonceiba.test",
    nombre: "Julián Herrera",
    rol: "profesional",
    descripcion: "Solo su agenda y sus citas",
  },
] as const satisfies ReadonlyArray<{
  clave: string;
  correo: string;
  nombre: string;
  rol: Rol;
  descripcion: string;
}>;

export type ClaveDemo = (typeof USUARIOS_DEMO)[number]["clave"];
