"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { useRouter } from "next/navigation";
import { ArrowRight, Users } from "lucide-react";
import { toast } from "sonner";
import { cn, iniciales } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { buscarDias } from "../actions";
import { fechaLarga } from "../lib/fechas-publicas";
import { enlacePaso, expandir, type Seleccion } from "../lib/seleccion";
import type { DiaLibre, Portada, ProfesionalPublico } from "../types";
import { ListaEsperaPublica } from "./lista-espera-publica";
import { Pasos } from "./pasos";
import { ResumenReserva } from "./resumen-reserva";
import { SelectorHoras } from "./selector-horas";

interface Props {
  portada: Portada;
  seleccion: Seleccion;
  candidatos: ProfesionalPublico[];
  hoy: string;
  desdeInicial: string;
  diasIniciales: DiaLibre[];
}

/** El día elegido si sigue en la tira; si no, el primero con horas. */
function fechaInicial(dias: DiaLibre[], fecha: string | null): string | null {
  if (fecha && dias.some((d) => d.fecha === fecha)) return fecha;
  return dias.find((d) => d.horas.length)?.fecha ?? null;
}

/** Paso 2: profesional (o cualquiera), día y hora; "Siguiente" lleva a los datos con todo en la dirección. */
export function PasoHora({
  portada,
  seleccion,
  candidatos,
  hoy,
  desdeInicial,
  diasIniciales,
}: Props) {
  const router = useRouter();
  const slug = portada.negocio.slug;
  const [profesionalId, setProfesionalId] = useState(seleccion.profesionalId);
  const [desde, setDesde] = useState(desdeInicial);
  const [dias, setDias] = useState(diasIniciales);
  const [fecha, setFecha] = useState(() =>
    fechaInicial(diasIniciales, seleccion.fecha),
  );
  const [hora, setHora] = useState(() =>
    seleccion.hora &&
    diasIniciales
      .find((d) => d.fecha === seleccion.fecha)
      ?.horas.includes(seleccion.hora)
      ? seleccion.hora
      : null,
  );
  const [cargando, iniciar] = useTransicionRed();
  const profesional = candidatos.find((p) => p.id === profesionalId) ?? null;

  function cargar(nuevoDesde: string, nuevoProfesional: string | null) {
    iniciar(async () => {
      const r = await buscarDias({
        slug,
        servicios: expandir(seleccion.lineas),
        profesionalId: nuevoProfesional,
        desde: nuevoDesde,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setDesde(nuevoDesde);
      setDias(r.datos);
      setFecha((f) => fechaInicial(r.datos, f));
      setHora(null);
    });
  }

  function siguiente() {
    if (!fecha || !hora) return;
    router.push(
      enlacePaso(slug, "datos", {
        lineas: seleccion.lineas,
        profesionalId,
        fecha,
        hora,
      }),
    );
  }

  if (!candidatos.length) {
    return (
      <div className="rounded-lg border border-dashed border-ac-borde-fuerte bg-ac-papel p-6">
        <p className="font-semibold">
          Ningún profesional hace todos estos servicios en la misma cita
        </p>
        <p className="mt-1 text-ac-pizarra">Quita alguno y resérvalo aparte.</p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => router.push(enlacePaso(slug, "", seleccion))}
        >
          Cambiar los servicios
        </Button>
      </div>
    );
  }

  const opciones: {
    id: string | null;
    nombre: string;
    color: string | null;
  }[] = [
    { id: null, nombre: "Cualquiera", color: null },
    ...candidatos.map((p) => ({ id: p.id, nombre: p.nombre, color: p.color })),
  ];

  return (
    <div className="grid gap-6 pb-28 lg:grid-cols-[1fr_340px] lg:pb-0">
      <div className="min-w-0">
        <Pasos actual={2} />
        <h1 className="text-xl font-bold">Elige fecha y hora</h1>

        <h2 className="mb-2 mt-5 text-sm font-semibold text-ac-pizarra">
          Profesional
        </h2>
        <div
          className="flex flex-wrap gap-2"
          role="radiogroup"
          aria-label="Profesional"
        >
          {opciones.map((o) => {
            const activo = o.id === profesionalId;
            return (
              <button
                key={o.id ?? "cualquiera"}
                type="button"
                role="radio"
                aria-checked={activo}
                disabled={cargando}
                onClick={() => {
                  setProfesionalId(o.id);
                  cargar(desde, o.id);
                }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-sm font-medium transition-colors min-h-11 md:min-h-0",
                  activo
                    ? "border-ac-laguna bg-ac-laguna-claro text-ac-laguna-hondo ring-1 ring-ac-laguna"
                    : "border-ac-borde bg-ac-papel hover:border-ac-laguna",
                )}
              >
                <span
                  aria-hidden="true"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{
                    backgroundColor: o.color ?? "#64748B",
                  }}
                >
                  {o.id ? (
                    iniciales(o.nombre)
                  ) : (
                    <Users className="h-3.5 w-3.5" />
                  )}
                </span>
                {o.nombre}
              </button>
            );
          })}
        </div>

        <div className="mt-6 rounded-lg border border-ac-borde bg-ac-papel p-4">
          <SelectorHoras
            dias={dias}
            desde={desde}
            hoy={hoy}
            fecha={fecha}
            hora={hora}
            cargando={cargando}
            diasMax={portada.reglas.diasMax}
            onMover={(d) => cargar(d, profesionalId)}
            onFecha={(f) => {
              setFecha(f);
              setHora(null);
            }}
            onHora={setHora}
          />
          {fecha && !cargando ? (
            <ListaEsperaPublica
              key={`${fecha}-${profesionalId ?? ""}`}
              slug={slug}
              servicios={expandir(seleccion.lineas)}
              profesional={profesional}
              fecha={fecha}
              sinHoras={!dias.find((d) => d.fecha === fecha)?.horas.length}
            />
          ) : null}
        </div>
      </div>

      <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
        <ResumenReserva
          portada={portada}
          lineas={seleccion.lineas}
          profesional={profesional?.nombre ?? null}
          fecha={fecha}
          hora={hora}
        />
        <Button
          className="hidden w-full lg:inline-flex"
          size="lg"
          disabled={!fecha || !hora}
          onClick={siguiente}
        >
          Siguiente
          <ArrowRight aria-hidden="true" />
        </Button>
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ac-borde bg-ac-papel/95 shadow-flota backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <p className="min-w-0 truncate text-sm">
            {fecha && hora ? (
              <>
                <span className="font-semibold">{hora}</span> ·{" "}
                {fechaLarga(fecha)}
              </>
            ) : (
              <span className="text-ac-pizarra">Elige un día y una hora</span>
            )}
          </p>
          <Button
            size="lg"
            className="shrink-0"
            disabled={!fecha || !hora}
            onClick={siguiente}
          >
            Siguiente
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
