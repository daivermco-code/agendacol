import "server-only";
import { format, parseISO, subDays } from "date-fns";
import { ESTADOS } from "@/features/agenda/lib/estados";
import { COLUMNAS_CLIENTES } from "@/features/clientes/lib/columnas";
import {
  esquemaFiltrosClientes,
  listarClientes,
} from "@/features/clientes/services/clientes";
import { leerPeriodo } from "@/features/reportes/lib/periodos";
import { ESTADO_VENTA } from "@/features/ventas/components/pildora-venta";
import {
  COLUMNAS_PAGOS,
  COLUMNAS_VENTAS,
} from "@/features/ventas/lib/columnas";
import { hoyEnBogota } from "@/features/ventas/services/panel";
import {
  conPeriodo,
  esquemaFiltrosPagos,
  esquemaFiltrosVentas,
  listarPagos,
  listarVentas,
} from "@/features/ventas/services/ventas";
import type { Celda, ColumnaListado } from "@/shared/lib/csv";
import { telefono } from "@/shared/lib/formato";
import type { Accion } from "@/shared/lib/permisos";
import { crearClienteServidor } from "@/shared/lib/supabase/server";

/** Tope de filas por archivo: lo que pasa de aquí se pide con un período o filtro más corto. */
export const MAXIMO_FILAS = 5000;
const POR_PAGINA = 100;

type Parametros = Record<string, string>;
type Fila = Record<string, Celda>;

export interface Listado {
  permiso: Accion;
  columnas: readonly ColumnaListado[];
  archivo: (p: Parametros) => string;
  leer: (p: Parametros) => Promise<Fila[]>;
}

const COLUMNAS_RESERVAS = [
  { clave: "fecha", nombre: "Fecha" },
  { clave: "hora", nombre: "Hora" },
  { clave: "cliente", nombre: "Cliente", fija: true },
  { clave: "servicio", nombre: "Servicio" },
  { clave: "profesional", nombre: "Profesional" },
  { clave: "local", nombre: "Local" },
  { clave: "estado", nombre: "Estado" },
  { clave: "origen", nombre: "Origen" },
  { clave: "precio", nombre: "Precio" },
] as const satisfies readonly ColumnaListado[];

const fechaHora = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
/** "2026-10-31 15:05" en la hora de Colombia (Excel la reconoce como fecha). */
const enBogota = (iso: string) => fechaHora.format(new Date(iso));

/** Lee página tras página (de a 100) hasta que no haya más o se llegue al tope. */
async function enPaginas<T>(
  leerPagina: (pagina: number) => Promise<T[]>,
): Promise<T[]> {
  const todas: T[] = [];
  for (let pagina = 1; todas.length < MAXIMO_FILAS; pagina++) {
    const filas = await leerPagina(pagina);
    todas.push(...filas);
    if (filas.length < POR_PAGINA) break;
  }
  return todas.slice(0, MAXIMO_FILAS);
}

async function leerReservas(p: Parametros): Promise<Fila[]> {
  const hoy = hoyEnBogota();
  const periodo = leerPeriodo(p, {
    desde: format(subDays(parseISO(hoy), 29), "yyyy-MM-dd"),
    hasta: hoy,
  });
  const supabase = await crearClienteServidor();
  const citas = await enPaginas(async (pagina) => {
    const desde = (pagina - 1) * POR_PAGINA;
    const { data, error } = await supabase
      .from("citas")
      .select(
        "fecha, hora_inicio, estado, origen, precio, clientes(nombre, apellido), servicios(nombre), profesionales(nombre), locales(nombre)",
      )
      .gte("fecha", periodo.desde)
      .lte("fecha", periodo.hasta)
      .order("fecha")
      .order("hora_inicio")
      .order("id")
      .range(desde, desde + POR_PAGINA - 1);
    if (error) throw new Error(error.message);
    return data;
  });
  return citas.map((c) => ({
    fecha: c.fecha,
    hora: c.hora_inicio.slice(0, 5),
    cliente: c.clientes ? `${c.clientes.nombre} ${c.clientes.apellido}` : "",
    servicio: c.servicios?.nombre,
    profesional: c.profesionales?.nombre,
    local: c.locales?.nombre,
    estado: ESTADOS[c.estado].nombre,
    origen: c.origen === "en_linea" ? "En línea" : "Agenda",
    precio: c.precio,
  }));
}

/** Los listados que se pueden descargar, con el permiso que exige cada uno (el mismo de su pantalla). */
export const LISTADOS: Record<string, Listado> = {
  clientes: {
    permiso: "ver_clientes",
    columnas: COLUMNAS_CLIENTES,
    archivo: () => `clientes-${hoyEnBogota()}.csv`,
    leer: async (p) => {
      const f = esquemaFiltrosClientes.parse(p);
      const filas = await enPaginas(
        async (pagina) =>
          (await listarClientes({ ...f, por: POR_PAGINA, pagina })).filas,
      );
      return filas.map((c) => ({ ...c, telefono: telefono(c.telefono) }));
    },
  },
  ventas: {
    permiso: "ver_ventas",
    columnas: COLUMNAS_VENTAS,
    archivo: (p) => {
      const f = conPeriodo(esquemaFiltrosVentas.parse(p));
      return `ventas-${f.desde}-a-${f.hasta}.csv`;
    },
    leer: async (p) => {
      const f = conPeriodo(esquemaFiltrosVentas.parse(p));
      const filas = await enPaginas(
        async (pagina) =>
          (await listarVentas({ ...f, por: POR_PAGINA, pagina })).filas,
      );
      return filas.map((v) => ({
        numero: v.numero,
        fecha: enBogota(v.fecha),
        total: v.total,
        pagado: v.pagado,
        saldo: v.estado === "anulada" ? 0 : v.total - v.pagado,
        cliente: v.cliente,
        metodos: v.metodos,
        estado: ESTADO_VENTA[v.estado].nombre,
      }));
    },
  },
  transacciones: {
    permiso: "ver_ventas",
    columnas: COLUMNAS_PAGOS,
    archivo: (p) => {
      const f = conPeriodo(esquemaFiltrosPagos.parse(p));
      return `transacciones-${f.desde}-a-${f.hasta}.csv`;
    },
    leer: async (p) => {
      const f = conPeriodo(esquemaFiltrosPagos.parse(p));
      const filas = await enPaginas(
        async (pagina) =>
          (await listarPagos({ ...f, por: POR_PAGINA, pagina })).filas,
      );
      return filas.map((x) => ({
        fecha: enBogota(x.fecha),
        venta: x.venta,
        cliente: x.cliente,
        metodo: x.metodo,
        comprobante: x.comprobante,
        tipo: x.abono ? "Abono" : "Pago",
        monto: x.monto,
        propina: x.propina,
        estado: ESTADO_VENTA[x.ventaEstado].nombre,
      }));
    },
  },
  reservas: {
    permiso: "ver_reportes_reservas",
    columnas: COLUMNAS_RESERVAS,
    archivo: (p) => {
      const hoy = hoyEnBogota();
      const r = leerPeriodo(p, {
        desde: format(subDays(parseISO(hoy), 29), "yyyy-MM-dd"),
        hasta: hoy,
      });
      return `reservas-${r.desde}-a-${r.hasta}.csv`;
    },
    leer: leerReservas,
  },
};
