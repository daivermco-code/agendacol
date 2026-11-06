import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { format, parseISO, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { obtenerMiembro } from "@/features/auth/services/miembro";
import { masNuevo } from "@/features/avisos/lib/avisos";
import { avisosDe } from "@/features/avisos/services/avisos";
import { TableroInicio } from "@/features/inicio/components/tablero-inicio";
import { datosTablero } from "@/features/inicio/services/tablero";
import { FiltroPeriodo } from "@/features/reportes/components/filtro-periodo";
import { Resumen } from "@/features/reportes/components/resumen";
import { leerPeriodo } from "@/features/reportes/lib/periodos";
import {
  avisosDelPeriodo,
  citasDeHoy,
  cumpleanosDeHoy,
  reservasComparadas,
  stockBajo,
  ventasComparadas,
} from "@/features/reportes/services/reportes";
import { hoyEnBogota } from "@/features/ventas/services/panel";
import { puede } from "@/shared/lib/permisos";

export const metadata: Metadata = { title: "Resumen" };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Resumen (pantalla de entrada): por defecto, esta semana comparada con la anterior. En el celular, el tablero
 * de tarjetas de Inicio (T-12.9).
 */
export default async function PaginaResumen({ searchParams }: Props) {
  const miembro = await obtenerMiembro();
  if (!miembro) redirect("/entrar");
  // El profesional entra directo a su agenda.
  if (!puede(miembro.rol, "ver_resumen")) redirect("/agenda");

  const hoy = hoyEnBogota();
  const lunes = format(
    startOfWeek(parseISO(hoy), { weekStartsOn: 1 }),
    "yyyy-MM-dd",
  );
  const periodo = leerPeriodo(await searchParams, { desde: lunes, hasta: hoy });
  const [reservas, ventas, citas, cumpleanos, avisos, stock, tablero, ultimo] =
    await Promise.all([
      reservasComparadas(periodo),
      puede(miembro.rol, "ver_ventas") ? ventasComparadas(periodo) : null,
      citasDeHoy(hoy),
      cumpleanosDeHoy(hoy),
      avisosDelPeriodo(periodo),
      puede(miembro.rol, "administrar") ? stockBajo() : null,
      // Un fallo del tablero no tumba la página: el celular muestra el aviso y desde la tableta no se ve.
      datosTablero(miembro, hoy).catch((e: unknown) => {
        console.error("Tablero de Inicio:", e);
        return null;
      }),
      // La campana sin punto si no se pudieron leer los avisos.
      avisosDe(miembro)
        .then(masNuevo)
        .catch(() => null),
    ]);
  const fecha = format(parseISO(hoy), "EEEE d 'de' MMMM", { locale: es });

  return (
    <>
      <TableroInicio
        nombre={miembro.nombre.split(" ")[0]}
        negocio={miembro.negocioNombre}
        fecha={fecha}
        datos={tablero}
        masNuevo={ultimo}
      />
      <main className="mx-auto hidden w-full max-w-[1400px] space-y-4 px-4 py-4 md:block lg:px-6 lg:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[13px] font-medium text-ac-pizarra first-letter:uppercase">
              {fecha}
            </p>
            <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-2xl">
              Hola, {miembro.nombre.split(" ")[0]}
            </h1>
            <p className="text-sm text-ac-pizarra">
              Así va {miembro.negocioNombre}.
            </p>
          </div>
          <div className="rounded-lg border border-ac-borde bg-ac-papel p-3 shadow-quieta lg:max-w-[560px]">
            <FiltroPeriodo periodo={periodo} hoy={hoy} />
          </div>
        </div>
        <Resumen
          datos={{
            periodo,
            reservas,
            ventas,
            hoy: citas,
            cumpleanos,
            avisos,
            stock,
          }}
        />
      </main>
    </>
  );
}
