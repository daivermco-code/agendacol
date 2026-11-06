import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigirPermiso } from "@/features/auth/services/miembro";
import { BarraLateral } from "@/features/administracion/components/barra-lateral";
import { FormularioAjustes } from "@/features/ajustes/components/formulario-ajustes";
import {
  ESQUEMAS,
  SECCIONES_AJUSTES,
  type SeccionEditable,
} from "@/features/ajustes/schemas";
import { obtenerAjustes } from "@/features/ajustes/services/ajustes";
import { ProximaOleada } from "@/shared/components/proxima-oleada";

interface Props {
  params: Promise<{ seccion: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { seccion } = await params;
  return {
    title:
      SECCIONES_AJUSTES.find((s) => s.slug === seccion)?.nombre ?? "Ajustes",
  };
}

const GRUPOS = [
  {
    nombre: "Ajustes de la empresa",
    opciones: SECCIONES_AJUSTES.map((s) => ({
      nombre: s.nombre,
      href: `/ajustes/${s.slug}`,
    })),
  },
];

export default async function PaginaAjustes({ params }: Props) {
  await exigirPermiso("editar_ajustes");
  const { seccion } = await params;
  const info = SECCIONES_AJUSTES.find((s) => s.slug === seccion);
  if (!info) notFound();
  const valores = info.lista ? await obtenerAjustes() : null;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-4 pb-24 md:flex-row md:gap-6 lg:px-6 lg:py-6">
      <BarraLateral titulo="Ajustes" grupos={GRUPOS} />
      <main className="min-w-0 flex-1">
        <h1 className="mb-1 text-[28px] font-bold leading-tight tracking-tight md:text-2xl">
          {info.nombre}
        </h1>
        {info.lista && valores && seccion in ESQUEMAS ? (
          <>
            <p className="mb-4 text-ac-pizarra">
              Los cambios se aplican apenas los guardas.
            </p>
            <FormularioAjustes
              seccion={seccion as SeccionEditable}
              inicial={valores}
            />
          </>
        ) : (
          <ProximaOleada
            titulo={info.nombre}
            resumen="Esta sección de ajustes llega con su módulo."
          />
        )}
      </main>
    </div>
  );
}
