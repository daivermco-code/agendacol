import type { CitaAgenda } from "../types";

/** Minúsculas y sin tildes, para que "monica" encuentre a "Mónica". */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Búsqueda de la agenda del celular (T-12.6): cada palabra del texto tiene que aparecer en `donde` (sin tildes) o,
 * si trae 3 cifras o más, en el teléfono. Un teléfono escrito o pegado con espacios o indicativo
 * ("+57 300 000 0012") se busca entero. Sin texto, todo coincide.
 */
export function coincideTexto(
  donde: string,
  texto: string,
  telefono = "",
): boolean {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return true;
  const cifras = telefono.replace(/\D/g, "");
  const soloCifras = texto.replace(/[\s+().-]/g, "");
  if (cifras && /^\d{3,}$/.test(soloCifras) && cifras.includes(soloCifras))
    return true;
  const lugar = normalizar(donde);
  return palabras.every((p) => {
    const digitos = p.replace(/\D/g, "");
    return (
      lugar.includes(p) || (digitos.length >= 3 && cifras.includes(digitos))
    );
  });
}

/** Una cita coincide por cliente, servicio o teléfono del cliente. */
export function coincideBusqueda(
  cita: Pick<
    CitaAgenda,
    "clienteNombre" | "servicioNombre" | "clienteTelefono"
  >,
  texto: string,
): boolean {
  return coincideTexto(
    `${cita.clienteNombre} ${cita.servicioNombre}`,
    texto,
    cita.clienteTelefono ?? "",
  );
}
