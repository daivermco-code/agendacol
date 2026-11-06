import "server-only";
import { addDays, format, parseISO } from "date-fns";
import type { Miembro } from "@/features/auth/services/miembro";
import { obtenerBaseAgenda } from "@/features/agenda/services/base";
import { aMinutos } from "@/features/agenda/lib/fechas";
import { partirPorDia } from "@/features/agenda/lib/horario";
import { conteoDe } from "@/features/marketing/services/marketing";
import {
  reservas as estadisticasReservas,
  stockBajo,
  ventas as estadisticasVentas,
} from "@/features/reportes/services/reportes";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import { puede } from "@/shared/lib/permisos";
import {
  cuandoEs,
  diasAbiertos,
  franjaLibre,
  mesesDe,
  metaDelMes,
  retencion,
  ticketPromedio,
  type FranjaLibre,
  type Ocupado,
} from "../lib/tablero";
import type { DatosTablero, Sugerencia } from "../types";

/** Estados que no ocupan la hora. */
const SIN_OCUPAR = ["cancelado", "no_asistio"];
/** Plazo de "clientes que no vuelven" (el mismo de las audiencias de marketing). */
const DIAS_SIN_VENIR = 60;

const menos = (hoy: string, dias: number) =>
  format(addDays(parseISO(hoy), -dias), "yyyy-MM-dd");

/** Inicio del celular (T-12.9): todo lo del tablero en una sola lectura. */
export async function datosTablero(
  miembro: Miembro,
  hoy: string,
): Promise<DatosTablero> {
  const { mes, anterior } = mesesDe(hoy);
  const verVentas = puede(miembro.rol, "ver_ventas");
  const [
    reservasNuevas,
    ventasSemana,
    mesActual,
    mesAnterior,
    noventaDias,
    ventasMes,
    estimado,
    sugerencia,
    stock,
  ] = await Promise.all([
    reservasCreadas(hoy),
    verVentas ? estadisticasVentas({ desde: menos(hoy, 6), hasta: hoy }) : null,
    estadisticasReservas({ desde: mes.desde, hasta: hoy }),
    estadisticasReservas(anterior),
    visitasAtendidas(menos(hoy, 89), hoy),
    verVentas ? estadisticasVentas({ desde: mes.desde, hasta: hoy }) : null,
    verVentas ? ingresoEstimado(mes.desde, mes.hasta) : null,
    sugerenciaDelDia(miembro, hoy),
    puede(miembro.rol, "administrar") ? stockBajo() : null,
  ]);

  return {
    semana: { reservasNuevas, ingresos: ventasSemana?.total ?? null },
    meta: metaDelMes(mesActual.activas, mesAnterior.activas),
    indicadores: {
      retencion: retencion(noventaDias),
      ingresoEstimado: estimado,
      clientesNuevos: mesActual.nuevosClientes,
      ticketPromedio: ventasMes
        ? ticketPromedio(ventasMes.total, ventasMes.cantidad)
        : null,
      ventas: verVentas,
    },
    origen: mesActual.porOrigen,
    sugerencia,
    stock,
  };
}

/** Reservas que entraron en los últimos 7 días (por cuándo se hicieron, no por el día de la cita). */
async function reservasCreadas(hoy: string): Promise<number> {
  const supabase = await crearClienteServidor();
  const { count, error } = await supabase
    .from("citas")
    .select("id", { count: "exact", head: true })
    .gte("created_at", `${menos(hoy, 6)}T00:00:00-05:00`)
    .neq("estado", "cancelado");
  if (error) throw new Error("No se pudo leer las reservas nuevas");
  return count ?? 0;
}

/** Cliente de cada cita atendida del plazo (para la retención). */
async function visitasAtendidas(
  desde: string,
  hasta: string,
): Promise<string[]> {
  const supabase = await crearClienteServidor();
  const out: string[] = [];
  // La API devuelve hasta 1.000 filas por pedido.
  for (let pagina = 0; pagina < 20; pagina++) {
    const { data, error } = await supabase
      .from("citas")
      .select("cliente_id")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .eq("estado", "asiste")
      .not("cliente_id", "is", null)
      .order("id")
      .range(pagina * 1000, pagina * 1000 + 999);
    if (error) throw new Error("No se pudo leer la retención");
    for (const c of data) if (c.cliente_id) out.push(c.cliente_id);
    if (data.length < 1000) break;
  }
  return out;
}

/** Lo que suman las citas del mes que siguen en pie (atendidas y por venir), a su precio. */
async function ingresoEstimado(desde: string, hasta: string): Promise<number> {
  const supabase = await crearClienteServidor();
  let total = 0;
  // La API devuelve hasta 1.000 filas por pedido.
  for (let pagina = 0; pagina < 20; pagina++) {
    const { data, error } = await supabase
      .from("citas")
      .select("precio")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .not("estado", "in", `(${SIN_OCUPAR.join(",")})`)
      .order("id")
      .range(pagina * 1000, pagina * 1000 + 999);
    if (error) throw new Error("No se pudo leer el ingreso estimado");
    total += data.reduce((s, c) => s + Number(c.precio), 0);
    if (data.length < 1000) break;
  }
  return total;
}

/**
 * Sugerencia del día: las horas libres del primer día que abre con una hora libre o más (abre el generador de
 * historia) o, si no hay, los clientes que no vuelven (solo el Dueño, que es quien hace campañas).
 */
async function sugerenciaDelDia(
  miembro: Miembro,
  hoy: string,
): Promise<Sugerencia | null> {
  const horas = await horasLibres(miembro.negocioId, hoy);
  if (horas) return horas;
  if (!puede(miembro.rol, "ver_marketing")) return null;
  const { total } = await conteoDe({ sinVenirDias: DIAS_SIN_VENIR });
  return total > 0
    ? { tipo: "clientes", cantidad: total, dias: DIAS_SIN_VENIR }
    : null;
}

type BaseAgenda = Awaited<ReturnType<typeof obtenerBaseAgenda>>;

/** De todas las sedes, la franja del día más cercano; si empatan en el día, la de más horas libres. */
async function horasLibres(
  negocioId: string,
  hoy: string,
): Promise<Sugerencia | null> {
  const base = await obtenerBaseAgenda(negocioId);
  const porSede = await Promise.all(
    base.locales.map((local) => horasDeSede(base, local, hoy)),
  );
  const mejor = porSede
    .filter((x) => x !== null)
    .sort(
      (a, b) =>
        a.fecha.localeCompare(b.fecha) ||
        b.franja.minutosDelDia - a.franja.minutosDelDia,
    )[0];
  if (!mejor) return null;
  return {
    tipo: "horas",
    fecha: mejor.fecha,
    cuando: cuandoEs(hoy, mejor.fecha),
    franja: mejor.franja,
    slug: base.slug,
    sede: base.locales.length > 1 ? mejor.sede : null,
  };
}

async function horasDeSede(
  base: BaseAgenda,
  local: BaseAgenda["locales"][number],
  hoy: string,
): Promise<{ fecha: string; franja: FranjaLibre; sede: string } | null> {
  const dias = diasAbiertos(hoy, local.horario);
  if (dias.length === 0) return null;
  const desde = dias[0];
  const hasta = dias[dias.length - 1];

  const supabase = await crearClienteServidor();
  const [citas, clases, bloqueos] = await Promise.all([
    supabase.rpc("agenda_citas", {
      p_local: local.id,
      p_desde: desde,
      p_hasta: hasta,
    }),
    supabase.rpc("agenda_clases", {
      p_local: local.id,
      p_desde: desde,
      p_hasta: hasta,
    }),
    supabase
      .from("bloqueos")
      .select("profesional_id, inicio, fin")
      .lt(
        "inicio",
        `${format(addDays(parseISO(hasta), 1), "yyyy-MM-dd")}T00:00:00`,
      )
      .gt("fin", `${desde}T00:00:00`),
  ]);
  if (citas.error || clases.error || bloqueos.error)
    throw new Error("No se pudo leer la agenda de la sugerencia");

  const profesionales = base.profesionales.filter(
    (p) => p.activo && p.localId === local.id,
  );
  // El primer día con una hora libre o más (menos no vale una historia).
  for (const fecha of dias) {
    const ocupado: Ocupado[] = [
      ...(citas.data ?? [])
        .filter((c) => c.fecha === fecha && !SIN_OCUPAR.includes(c.estado))
        .map((c) => ({
          profesionalId: c.profesional_id,
          inicio: aMinutos(c.hora_inicio),
          fin: aMinutos(c.hora_fin),
        })),
      ...(clases.data ?? [])
        .filter((k) => k.fecha === fecha && !k.cancelada)
        .map((k) => ({
          profesionalId: k.profesional_id,
          inicio: aMinutos(k.hora_inicio),
          fin: aMinutos(k.hora_fin),
        })),
      ...(bloqueos.data ?? []).flatMap((b) =>
        partirPorDia(b.inicio, b.fin, [fecha]).map((r) => ({
          profesionalId: b.profesional_id,
          inicio: r.inicio,
          fin: r.fin,
        })),
      ),
    ];
    const franja = franjaLibre({
      fecha,
      local: local.horario,
      profesionales,
      ocupado,
    });
    if (franja && franja.minutosDelDia >= 60)
      return { fecha, franja, sede: local.nombre };
  }
  return null;
}
