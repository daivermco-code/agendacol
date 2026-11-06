import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obtenerMiembro } from "@/features/auth/services/miembro";
import { CentroAjustes } from "@/features/marco/centro-ajustes";
import { IrAMiNegocio } from "@/features/marco/ir-a-mi-negocio";
import { centroPara } from "@/features/marco/menu";
import { puede } from "@/shared/lib/permisos";

export const metadata: Metadata = { title: "Ajustes" };

/**
 * Centro de Ajustes del celular (T-12.3). Solo pide sesión: cada rol ve lo que ya puede abrir y cada
 * pantalla de adentro revisa su propio permiso. El dueño, desde la tableta, sigue yendo a Mi negocio.
 */
export default async function PaginaAjustes() {
  const miembro = await obtenerMiembro();
  if (!miembro) redirect("/entrar");
  const dueno = puede(miembro.rol, "editar_ajustes");

  return (
    <>
      {dueno ? <IrAMiNegocio /> : null}
      <CentroAjustes
        miembro={miembro}
        grupos={centroPara(miembro.rol)}
        verReservas={dueno}
        className={dueno ? "md:hidden" : undefined}
      />
    </>
  );
}
