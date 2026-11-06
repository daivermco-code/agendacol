import { Suspense } from "react";
import { ProveedorMiembro } from "@/features/auth/components/proveedor-miembro";
import { salir } from "@/features/auth/actions";
import { obtenerMiembro } from "@/features/auth/services/miembro";
import { AvisoConexion } from "@/features/marco/aviso-conexion";
import { AvisoPorParametro } from "@/features/marco/aviso-por-parametro";
import { BarraPestanas } from "@/features/marco/barra-pestanas";
import { BarraSuperior } from "@/features/marco/barra-superior";
import { CabeceraMovil } from "@/features/marco/cabecera-movil";
import { FranjaDemo } from "@/features/marco/franja-demo";
import { ajustesPara, menuPara, pestanasPara } from "@/features/marco/menu";
import { BarraPrimerosPasos } from "@/features/marco/primeros-pasos";
import { GuiaPrimerosPasos } from "@/features/primeros-pasos/components/guia-primeros-pasos";
import { contarPasosHechos } from "@/features/primeros-pasos/services/pasos";
import { PanelVenta } from "@/features/ventas/components/panel-venta";
import { puede } from "@/shared/lib/permisos";
import { Button } from "@/shared/ui/button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const miembro = await obtenerMiembro();

  // Sesión válida pero sin negocio: no redirigir (el proxy devolvería aquí) y dejar salir.
  if (!miembro) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <div className="max-w-sm rounded-lg border border-ac-borde bg-ac-papel p-6 text-center shadow-quieta">
          <h1 className="text-lg font-bold">Tu usuario no tiene un negocio</h1>
          <p className="mt-1 text-ac-pizarra">
            Entra con uno de los usuarios de la demo.
          </p>
          <form action={salir} className="mt-4">
            <Button type="submit">Volver a entrar</Button>
          </form>
        </div>
      </main>
    );
  }

  const verReservas = puede(miembro.rol, "editar_ajustes");
  const pasosHechos = verReservas ? await contarPasosHechos() : 0;

  return (
    <ProveedorMiembro miembro={miembro}>
      <a
        href="#contenido"
        className="sr-only z-[60] rounded-md bg-ac-papel px-3 py-2 font-semibold text-ac-laguna-hondo shadow-flota focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Saltar al contenido
      </a>
      <div className="flex min-h-dvh flex-col has-[[data-agenda]]:h-dvh print:h-auto">
        <div className="contents print:hidden">
          <FranjaDemo puedeReiniciar={puede(miembro.rol, "reiniciar_demo")} />
          <header>
            <BarraSuperior
              secciones={menuPara(miembro.rol)}
              ajustes={ajustesPara(miembro.rol)}
              pasosHechos={pasosHechos}
              verReservas={verReservas}
            />
            {verReservas ? <BarraPrimerosPasos hechos={pasosHechos} /> : null}
            <CabeceraMovil />
          </header>
          <AvisoConexion />
        </div>
        <div
          id="contenido"
          tabIndex={-1}
          className="flex min-h-0 flex-1 flex-col pb-[var(--alto-pestanas)] outline-none"
        >
          {children}
        </div>
      </div>
      <BarraPestanas pestanas={pestanasPara(miembro.rol)} />
      <Suspense>
        <AvisoPorParametro />
      </Suspense>
      {verReservas ? (
        <Suspense>
          <GuiaPrimerosPasos />
        </Suspense>
      ) : null}
      {puede(miembro.rol, "cobrar") || puede(miembro.rol, "ver_ventas") ? (
        <PanelVenta />
      ) : null}
    </ProveedorMiembro>
  );
}
