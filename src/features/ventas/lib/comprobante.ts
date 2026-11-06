import { pesos } from "@/shared/lib/formato";

/** Lo que va en el mensaje del comprobante (WhatsApp del celular). */
export interface MensajeComprobante {
  /** Primer nombre del cliente (sin cliente, saluda sin nombre). */
  nombre: string | null;
  lugar: string | null;
  numero: string;
  items: { descripcion: string; cantidad: number }[];
  total: number;
  pagado: number;
}

/** Mensaje corto: saludo, lo comprado, el total y gracias (y el saldo si fue un abono). */
export function textoComprobante(m: MensajeComprobante): string {
  const detalle = m.items
    .map((i) =>
      i.cantidad > 1 ? `${i.descripcion} x${i.cantidad}` : i.descripcion,
    )
    .join(", ");
  const saldo =
    m.total > m.pagado ? ` Saldo pendiente ${pesos(m.total - m.pagado)}.` : "";
  return [
    m.nombre ? `Hola ${m.nombre},` : "Hola,",
    `este es el comprobante de tu venta ${m.numero}${m.lugar ? ` en ${m.lugar}` : ""}:`,
    `${detalle}. Total ${pesos(m.total)}.${saldo}`,
    "¡Gracias por tu visita!",
  ].join(" ");
}

/**
 * Enlace de WhatsApp con el mensaje escrito. `+57 300…` pasa a `wa.me/57300…`;
 * sin teléfono, `wa.me/?text=` deja elegir el contacto en WhatsApp.
 */
export function enlaceWhatsapp(telefono: string | null, texto: string): string {
  const numero = (telefono ?? "").replace(/\D/g, "");
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
