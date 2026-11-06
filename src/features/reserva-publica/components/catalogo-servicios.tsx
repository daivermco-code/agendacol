"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Store } from "lucide-react";
import { Vacio } from "@/shared/components/vacio";
import { duracion, pesos } from "@/shared/lib/formato";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/ui/accordion";
import { Button } from "@/shared/ui/button";
import {
  enlacePaso,
  MAX_MINUTOS,
  MAX_UNIDADES,
  totales,
  type Linea,
} from "../lib/seleccion";
import type { Portada, ServicioPublico } from "../types";
import { TarjetaServicio } from "./tarjeta-servicio";

/** Servicios por categoría con su cantidad elegida y la barra flotante "Agendar ahora". */
export function CatalogoServicios({
  portada,
  inicial,
}: {
  portada: Portada;
  inicial: Linea[];
}) {
  const router = useRouter();
  const [lineas, setLineas] = useState<Linea[]>(inicial);
  const recibe = portada.local.recibeReservas;
  const t = totales(lineas, portada.servicios);

  const categorias = useMemo(() => {
    const grupos = new Map<string, ServicioPublico[]>();
    for (const s of portada.servicios)
      grupos.set(s.categoria, [...(grupos.get(s.categoria) ?? []), s]);
    return [...grupos.entries()];
  }, [portada.servicios]);

  function cambiar(s: ServicioPublico, cantidad: number) {
    setLineas((actual) => {
      if (cantidad <= 0) return actual.filter((l) => l.id !== s.id);
      if (actual.some((l) => l.id === s.id))
        return actual.map((l) => (l.id === s.id ? { ...l, cantidad } : l));
      return [...actual, { id: s.id, cantidad }];
    });
  }

  if (!portada.servicios.length) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <Vacio
          icono={Store}
          titulo="Aún no hay servicios para reservar en línea"
          texto="Comunícate con el negocio para agendar tu cita."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-32 pt-6">
      {!recibe ? (
        <p
          role="status"
          className="mb-4 rounded-lg border border-amber-200 dark:border-ac-aviso/30 bg-ac-aviso-fondo px-4 py-3 text-ac-demo-texto"
        >
          Este negocio no recibe reservas en línea por ahora. Puedes ver sus
          servicios y llamar para agendar.
        </p>
      ) : null}
      <h2 className="mb-1 text-lg font-bold">Servicios</h2>
      <p className="mb-4 text-ac-pizarra">
        Elige uno o varios; después escoges el profesional, el día y la hora.
      </p>
      <Accordion
        type="multiple"
        defaultValue={categorias.map(([c]) => c)}
        className="space-y-3"
      >
        {categorias.map(([categoria, servicios]) => (
          <AccordionItem
            key={categoria}
            value={categoria}
            className="border-none"
          >
            <AccordionTrigger className="rounded-md bg-ac-niebla-oscura/70 px-4 py-3 text-[15px] font-semibold hover:no-underline">
              {categoria}
            </AccordionTrigger>
            <AccordionContent className="pt-3">
              <div className="grid gap-3 md:grid-cols-2">
                {servicios.map((s) => {
                  const cantidad =
                    lineas.find((l) => l.id === s.id)?.cantidad ?? 0;
                  return (
                    <TarjetaServicio
                      key={s.id}
                      servicio={s}
                      cantidad={cantidad}
                      apagado={!recibe}
                      lleno={
                        t.unidades >= MAX_UNIDADES ||
                        t.minutos + s.duracion > MAX_MINUTOS
                      }
                      onCambiar={(n) => cambiar(s, n)}
                    />
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {t.unidades > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 animate-entra-abajo border-t border-ac-borde bg-ac-papel/95 shadow-flota backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0 text-sm">
              <p className="font-semibold">
                {t.unidades} {t.unidades === 1 ? "servicio" : "servicios"} ·{" "}
                {duracion(t.minutos)}
              </p>
              <p className="text-ac-pizarra">
                {t.precioCompleto
                  ? pesos(t.precio)
                  : t.precio
                    ? `${pesos(t.precio)} + precio en el local`
                    : "Precio en el local"}
              </p>
            </div>
            <Button
              size="lg"
              className="shrink-0 px-5"
              onClick={() =>
                router.push(
                  enlacePaso(portada.negocio.slug, "hora", { lineas }),
                )
              }
            >
              <CalendarClock aria-hidden="true" />
              Agendar ahora
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
