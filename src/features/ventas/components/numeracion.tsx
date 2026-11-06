"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Campo } from "@/shared/components/campo";
import { Vacio } from "@/shared/components/vacio";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ajustarNumeracion } from "../actions";
import { leerPesos } from "../lib/venta";
import type { Numeracion } from "../services/caja";

/** Numeración de ventas: próximo número, prefijo, adelantar (nunca atrasar) e historial (US-043). */
export function NumeracionVentas({ datos }: { datos: Numeracion }) {
  const [prefijo, setPrefijo] = useState(datos.prefijo);
  const [siguiente, setSiguiente] = useState(String(datos.siguiente));
  const [errores, setErrores] = useState<{
    prefijo?: string;
    siguiente?: string;
  }>({});
  const [guardando, iniciar] = useTransicionRed();
  const numero = leerPesos(siguiente);
  const vista = `${prefijo.trim().toUpperCase()}${numero ?? ""}`;
  const cambio =
    prefijo.trim().toUpperCase() !== datos.prefijo ||
    numero !== datos.siguiente;

  function guardar() {
    setErrores({});
    iniciar(async () => {
      const r = await ajustarNumeracion({ prefijo, siguiente: numero ?? 0 });
      if (!r.ok) {
        const campo = /prefijo/i.test(r.error) ? "prefijo" : "siguiente";
        return setErrores({ [campo]: r.error });
      }
      toast.success(
        r.datos.sinCambios
          ? "No había nada que cambiar"
          : `La próxima venta será la ${vista}`,
      );
    });
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 rounded-lg border border-ac-borde bg-ac-papel p-4 shadow-quieta sm:grid-cols-2 sm:p-5">
        <div>
          <p className="text-sm text-ac-pizarra">Próxima venta</p>
          <p className="cifras text-3xl font-bold">
            {datos.prefijo}
            {datos.siguiente}
          </p>
          <p className="cifras mt-1 text-sm text-ac-pizarra">
            Última usada: {datos.ultimo ?? "ninguna todavía"}
          </p>
        </div>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <Campo
              id="numeracion-prefijo"
              etiqueta="Prefijo"
              error={errores.prefijo}
            >
              <Input
                id="numeracion-prefijo"
                value={prefijo}
                maxLength={6}
                placeholder="Sin prefijo"
                onChange={(e) => setPrefijo(e.target.value.toUpperCase())}
              />
            </Campo>
            <Campo
              id="numeracion-siguiente"
              etiqueta="Próximo número"
              obligatorio
              error={errores.siguiente}
            >
              <Input
                id="numeracion-siguiente"
                inputMode="numeric"
                value={siguiente}
                onChange={(e) => setSiguiente(e.target.value)}
                className="cifras"
              />
            </Campo>
          </div>
          <p className="text-xs text-ac-pizarra">
            El número solo se adelanta, nunca se atrasa. Un prefijo nuevo (por
            ejemplo «2027-») abre otra serie.
          </p>
          <Button
            type="submit"
            disabled={guardando || !cambio || numero === null}
          >
            {guardando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            Guardar {cambio && numero !== null ? `· próxima ${vista}` : ""}
          </Button>
        </form>
      </section>
      <section
        aria-label="Historial de cambios"
        className="rounded-lg border border-ac-borde bg-ac-papel p-4 shadow-quieta"
      >
        <p className="mb-3 font-semibold">Historial</p>
        {datos.historial.length ? (
          <ul className="divide-y divide-ac-borde text-sm">
            {datos.historial.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2"
              >
                <span className="cifras text-ac-pizarra">
                  {format(parseISO(h.fecha), "d MMM yyyy · HH:mm", {
                    locale: es,
                  })}
                </span>
                <span className="cifras flex-1">
                  {h.antes} → <span className="font-semibold">{h.despues}</span>
                </span>
                <span className="text-ac-pizarra">{h.quien ?? "—"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Vacio
            icono={History}
            titulo="Sin cambios"
            texto="Aquí queda cada cambio de prefijo o número."
          />
        )}
      </section>
    </div>
  );
}
