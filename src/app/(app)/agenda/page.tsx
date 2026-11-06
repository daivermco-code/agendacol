import type { Metadata } from "next";
import { AgendaVista } from "@/features/agenda/components/agenda-vista";
import type { Vista } from "@/features/agenda/lib/fechas";
import { obtenerBaseAgenda } from "@/features/agenda/services/base";
import { exigirPermiso } from "@/features/auth/services/miembro";
import { puede } from "@/shared/lib/permisos";
import { crearClienteServidor } from "@/shared/lib/supabase/server";

export const metadata: Metadata = { title: "Agenda" };

const VISTAS: Vista[] = ["semana", "dia", "3dias", "mes", "lista"];
const FECHA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ?reservar=<cliente> (desde la ficha del cliente): la ventana de reserva abre con ese cliente. */
async function clienteParaReservar(id: string | undefined) {
  if (!id || !UUID.test(id)) return null;
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("clientes")
    .select("id, nombre, apellido, correo, telefono, created_at")
    .eq("id", id)
    .maybeSingle();
  return data
    ? {
        id: data.id,
        nombre: `${data.nombre} ${data.apellido}`,
        correo: data.correo,
        telefono: data.telefono,
        creado: data.created_at,
      }
    : null;
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; fecha?: string; reservar?: string }>;
}) {
  const miembro = await exigirPermiso("ver_agenda");
  const { vista, fecha, reservar } = await searchParams;
  const [base, clienteInicial] = await Promise.all([
    obtenerBaseAgenda(miembro.negocioId),
    puede(miembro.rol, "crear_cita") ? clienteParaReservar(reservar) : null,
  ]);
  const vistaInicial = VISTAS.find((v) => v === vista) ?? null;
  const fechaInicial = fecha && FECHA.test(fecha) ? fecha : null;
  return (
    <AgendaVista
      base={base}
      vistaInicial={vistaInicial}
      fechaInicial={fechaInicial}
      clienteInicial={clienteInicial}
    />
  );
}
