import type { Metadata } from "next";
import { exigirPermiso } from "@/features/auth/services/miembro";
import { PlantillasVista } from "@/features/whatsapp/components/plantillas-vista";
import { listarPlantillas } from "@/features/whatsapp/services/plantillas";

export const metadata: Metadata = { title: "WhatsApp" };

export default async function PaginaWhatsapp() {
  await exigirPermiso("administrar");
  const plantillas = await listarPlantillas();
  return (
    <main>
      <header className="mb-4">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-2xl">
          WhatsApp
        </h1>
        <p className="text-ac-pizarra">
          Plantillas de mensajes que mandas desde la ficha de una reserva, con
          el nombre del cliente, la hora y el servicio puestos.
        </p>
      </header>
      <PlantillasVista plantillas={plantillas} />
    </main>
  );
}
