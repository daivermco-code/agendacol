/** Variables de una plantilla de WhatsApp; enviar_plantilla las cambia igual en la base. */
export const VARIABLES = [
  { clave: "cliente", nombre: "Nombre del cliente" },
  { clave: "servicio", nombre: "Servicio" },
  { clave: "fecha", nombre: "Fecha" },
  { clave: "hora", nombre: "Hora" },
  { clave: "profesional", nombre: "Profesional" },
  { clave: "local", nombre: "Local" },
  { clave: "negocio", nombre: "Negocio" },
] as const;

export type DatosPlantilla = Record<
  (typeof VARIABLES)[number]["clave"],
  string
>;

/** Datos inventados para la vista previa del formulario. */
export const EJEMPLO: DatosPlantilla = {
  cliente: "Ana",
  servicio: "Corte de dama",
  fecha: "14/11/2026",
  hora: "10:30",
  profesional: "Carolina Ruiz",
  local: "Sede Chapinero",
  negocio: "Salón Ceiba",
};

export function llenarPlantilla(cuerpo: string, datos: DatosPlantilla): string {
  return cuerpo.replace(
    /\{(cliente|servicio|fecha|hora|profesional|local|negocio)\}/g,
    (_, clave: keyof DatosPlantilla) => datos[clave],
  );
}
