import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";

/** Fichas de la lista de Ventas del celular. */
export type VistaVentas = "hoy" | "semana" | "mes";

export interface PeriodoCelular {
  desde: string;
  hasta: string;
  /** Día que abre el período anterior. */
  anterior: string;
  /** Día que abre el siguiente; `null` si ya es el período de hoy (no hay flecha). */
  siguiente: string | null;
  etiqueta: string;
}

const iso = (d: Date) => format(d, "yyyy-MM-dd");

export function leerVista(v: unknown): VistaVentas {
  return v === "semana" || v === "mes" ? v : "hoy";
}

/** `aaaa-mm-dd` que existe en el calendario (no «2026-02-30» ni «2026-13-01»). */
export function esFecha(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    isValid(parseISO(v)) &&
    format(parseISO(v), "yyyy-MM-dd") === v
  );
}

/** Un día válido y no futuro; si no, hoy. */
export function leerDia(v: unknown, hoy: string): string {
  return esFecha(v) && v <= hoy ? v : hoy;
}

/** "2 – 8 nov", "27 oct – 2 nov" o "29 dic 2025 – 4 ene 2026" (el año solo si no es el de hoy). */
function rango(desde: Date, hasta: Date, hoy: string): string {
  const otroAnio = format(desde, "yyyy") !== format(hasta, "yyyy");
  const mismoMes = !otroAnio && format(desde, "M") === format(hasta, "M");
  const anio =
    otroAnio || format(hasta, "yyyy") !== hoy.slice(0, 4) ? " yyyy" : "";
  const inicio = mismoMes ? "d" : otroAnio ? "d MMM yyyy" : "d MMM";
  return `${format(desde, inicio, { locale: es })} – ${format(
    hasta,
    `d MMM${anio}`,
    {
      locale: es,
    },
  )}`;
}

/**
 * Período de la lista: el día, la semana de lunes a domingo o el mes completo que contiene `dia`.
 * La flecha "siguiente" no existe en el período de hoy (no se mira el futuro).
 */
export function periodoCelular(
  vista: VistaVentas,
  dia: string,
  hoy: string,
): PeriodoCelular {
  const d = parseISO(dia);
  if (vista === "semana") {
    const lunes = startOfWeek(d, { weekStartsOn: 1 });
    const proximo = addWeeks(lunes, 1);
    return {
      desde: iso(lunes),
      hasta: iso(addDays(lunes, 6)),
      anterior: iso(addWeeks(lunes, -1)),
      siguiente: iso(proximo) <= hoy ? iso(proximo) : null,
      etiqueta: rango(lunes, addDays(lunes, 6), hoy),
    };
  }
  if (vista === "mes") {
    const primero = startOfMonth(d);
    const proximo = addMonths(primero, 1);
    return {
      desde: iso(primero),
      hasta: iso(endOfMonth(d)),
      anterior: iso(addMonths(primero, -1)),
      siguiente: iso(proximo) <= hoy ? iso(proximo) : null,
      etiqueta: format(primero, "MMMM 'de' yyyy", { locale: es }),
    };
  }
  const manana = iso(addDays(d, 1));
  const ayer = iso(addDays(parseISO(hoy), -1));
  return {
    desde: dia,
    hasta: dia,
    anterior: iso(addDays(d, -1)),
    siguiente: manana <= hoy ? manana : null,
    etiqueta:
      dia === hoy
        ? "Hoy"
        : dia === ayer
          ? "Ayer"
          : format(
              d,
              `EEE d MMM${dia.slice(0, 4) !== hoy.slice(0, 4) ? " yyyy" : ""}`,
              {
                locale: es,
              },
            ),
  };
}

/** Rango libre (llegó `desde`/`hasta` en la dirección): "1 oct – 4 nov", sin flechas. */
export function etiquetaRango(
  desde: string,
  hasta: string,
  hoy: string,
): string {
  return desde === hasta
    ? format(
        parseISO(desde),
        `EEE d MMM${desde.slice(0, 4) !== hoy.slice(0, 4) ? " yyyy" : ""}`,
        { locale: es },
      )
    : rango(parseISO(desde), parseISO(hasta), hoy);
}
