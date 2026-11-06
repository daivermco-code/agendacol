import type { Metadata } from "next";
import { exigirPermiso } from "@/features/auth/services/miembro";
import { MarketingVista } from "@/features/marketing/components/marketing-vista";
import {
  listarAudiencias,
  listarCampanas,
  listarSuprimidos,
  resumenCorreo,
  serviciosParaFiltro,
} from "@/features/marketing/services/marketing";

export const metadata: Metadata = { title: "Correo masivo" };

export default async function PaginaCorreoMasivo() {
  await exigirPermiso("ver_marketing");
  const [campanas, audiencias, { todos, cupo }, suprimidos, servicios] =
    await Promise.all([
      listarCampanas(),
      listarAudiencias(),
      resumenCorreo(),
      listarSuprimidos(),
      serviciosParaFiltro(),
    ]);
  return (
    <main className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-4 lg:px-6 lg:py-6">
      <header>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-2xl">
          Correo masivo
        </h1>
        <p className="text-ac-pizarra">
          Campañas de correo para todos tus clientes o para una audiencia. En la
          demo llegan al buzón; nada sale de tu computador.
        </p>
      </header>
      <MarketingVista
        campanas={campanas}
        audiencias={audiencias}
        todos={todos}
        cupo={cupo}
        suprimidos={suprimidos}
        servicios={servicios}
      />
    </main>
  );
}
