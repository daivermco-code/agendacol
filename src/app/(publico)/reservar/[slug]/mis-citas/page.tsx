import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EntrarMisCitas } from "@/features/mis-citas/components/entrar-mis-citas";
import { MisCitasVista } from "@/features/mis-citas/components/mis-citas-vista";
import { obtenerMisCitas } from "@/features/mis-citas/services/mis-citas";
import { CabeceraNegocio } from "@/features/reserva-publica/components/cabecera-negocio";
import { obtenerPortada } from "@/features/reserva-publica/services/publico";

interface Props {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = {
  title: "Mis citas",
  referrer: "no-referrer",
};

/** "Mis citas" del sitio: sin contraseña, con un código que llega al correo o al WhatsApp del cliente. */
export default async function PaginaMisCitas({ params }: Props) {
  const portada = await obtenerPortada((await params).slug);
  if (!portada) notFound();
  const slug = portada.negocio.slug;
  const mis = await obtenerMisCitas(slug);

  return (
    <>
      <CabeceraNegocio
        nombre={portada.negocio.nombre}
        logo={portada.negocio.logo}
        slug={slug}
        volver={{ href: `/reservar/${slug}`, texto: "Reservar" }}
      />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        {mis ? (
          <MisCitasVista mis={mis} />
        ) : (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-bold">Mis citas</h1>
              <p className="text-ac-pizarra">
                Mira, cambia o cancela tus citas en {portada.negocio.nombre}. No
                necesitas contraseña: te enviamos un código.
              </p>
            </div>
            <EntrarMisCitas slug={slug} />
          </div>
        )}
      </main>
    </>
  );
}
