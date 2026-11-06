import type { Metadata } from "next";
import Link from "next/link";
import { exigirPermiso } from "@/features/auth/services/miembro";
import { ListaAvisos } from "@/features/avisos/components/lista-avisos";
import type { Ficha } from "@/features/avisos/lib/avisos";
import { avisosDe } from "@/features/avisos/services/avisos";
import { hoyEnBogota } from "@/features/ventas/services/panel";
import { puede } from "@/shared/lib/permisos";

export const metadata: Metadata = { title: "Avisos" };

/** Avisos del negocio (T-12.10): se abre desde la campana del Inicio. Para quien ve el Resumen. */
export default async function PaginaAvisos() {
  const miembro = await exigirPermiso("ver_resumen");
  const avisos = await avisosDe(miembro).catch((e: unknown) => {
    console.error("Avisos:", e);
    return null;
  });
  const fichas: Ficha[] = [
    "todos",
    "no_leidos",
    "reservas",
    ...(puede(miembro.rol, "ver_ventas") ? (["pagos"] as const) : []),
    "sistema",
  ];

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-4 lg:py-6">
      {avisos ? (
        <ListaAvisos
          avisos={avisos}
          hoy={hoyEnBogota()}
          ahora={new Date().toISOString()}
          fichasVisibles={fichas}
        />
      ) : (
        <>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-2xl">
            Avisos
          </h1>
          <div role="alert" className="space-y-3 py-6 text-center">
            <p className="text-[15px] text-ac-pizarra">
              No se pudieron cargar los avisos.
            </p>
            <Link
              href="/avisos"
              prefetch={false}
              className="inline-flex h-11 items-center rounded-full border border-ac-borde px-4 text-[14px] font-semibold"
            >
              Reintentar
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
