"use client";

import { useState } from "react";
import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Search, Ticket } from "lucide-react";
import { Vacio } from "@/shared/components/vacio";
import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/input";
import { ESTADO_BONO, NOMBRE_TIPO_BONO, textoUso } from "../lib/bonos";
import type { Bono, EstadoBono, TipoBono } from "../types";

const fecha = (f: string) => format(parseISO(f), "d MMM yyyy", { locale: es });

export function EstadoBonoPildora({ estado }: { estado: EstadoBono }) {
  const e = ESTADO_BONO[estado];
  return (
    <span
      className={cn(
        "inline-block shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        e.clase,
      )}
    >
      {e.nombre}
    </span>
  );
}

/** Barra de uso: citas usadas sobre el cupo (sin cupo, no hay barra). */
export function UsoBono({ bono }: { bono: Bono }) {
  return (
    <div className="min-w-0">
      <p className="cifras text-sm">{textoUso(bono)}</p>
      {bono.cupo ? (
        <div
          className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-ac-niebla-oscura"
          role="meter"
          aria-label={`Citas usadas de ${bono.nombre}`}
          aria-valuemin={0}
          aria-valuemax={bono.cupo}
          aria-valuenow={bono.usadas}
        >
          <div
            className="h-full rounded-full bg-ac-laguna"
            style={{
              width: `${Math.min((bono.usadas / bono.cupo) * 100, 100)}%`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

const TIPOS: { id: "todos" | TipoBono; nombre: string }[] = [
  { id: "todos", nombre: "Todos" },
  { id: "plan", nombre: "Planes" },
  { id: "sesiones", nombre: "Sesiones" },
  { id: "paquete", nombre: "Paquetes" },
];

/** Ventas → Planes: planes, sesiones y paquetes vendidos, su uso y su vencimiento. */
/** `hoy` (yyyy-MM-dd, Bogotá) viene del servidor para contar los que vencen esta semana. */
export function PlanesVendidos({ bonos, hoy }: { bonos: Bono[]; hoy: string }) {
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]["id"]>("todos");
  const [soloActivos, setSoloActivos] = useState(false);
  const [texto, setTexto] = useState("");
  const buscado = texto.trim().toLowerCase();
  const lista = bonos.filter(
    (b) =>
      (tipo === "todos" || b.tipo === tipo) &&
      (!soloActivos || b.estado === "activo") &&
      (!buscado || `${b.cliente} ${b.nombre}`.toLowerCase().includes(buscado)),
  );
  const activos = bonos.filter((b) => b.estado === "activo").length;
  const limite = format(addDays(parseISO(hoy), 7), "yyyy-MM-dd");
  const porVencer = bonos.filter(
    (b) => b.estado === "activo" && b.vence <= limite,
  ).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-ac-pizarra">
        <span className="cifras font-semibold text-ac-tinta">{activos}</span>{" "}
        activos ·{" "}
        <span className="cifras font-semibold text-ac-tinta">{porVencer}</span>{" "}
        vencen en los próximos 7 días
      </p>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <label className="relative block md:w-72">
          <span className="sr-only">Buscar por cliente o plan</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ac-neblina"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Cliente o plan"
            className="pl-9"
          />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo">
          {TIPOS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tipo === t.id}
              onClick={() => setTipo(t.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm min-h-11 md:min-h-0",
                tipo === t.id
                  ? "border-ac-laguna bg-ac-laguna-claro font-medium text-ac-laguna-hondo"
                  : "border-ac-borde bg-ac-papel text-ac-pizarra hover:bg-ac-niebla",
              )}
            >
              {t.nombre}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={soloActivos}
            onClick={() => setSoloActivos((v) => !v)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm min-h-11 md:min-h-0",
              soloActivos
                ? "border-ac-laguna bg-ac-laguna-claro font-medium text-ac-laguna-hondo"
                : "border-ac-borde bg-ac-papel text-ac-pizarra hover:bg-ac-niebla",
            )}
          >
            Solo activos
          </button>
        </div>
      </div>
      {lista.length === 0 ? (
        <Vacio
          icono={Ticket}
          titulo={bonos.length ? "Nada coincide" : "Aún no se venden planes"}
          texto={
            bonos.length
              ? "Prueba con otro cliente, tipo o estado."
              : "Se venden en la caja, desde la pestaña «Planes» (o un servicio con sesiones o un paquete)."
          }
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-ac-borde bg-ac-papel lg:block">
            <table className="w-full text-sm">
              <thead className="bg-ac-niebla text-left text-ac-pizarra">
                <tr>
                  {[
                    "Cliente",
                    "Plan",
                    "Uso",
                    "Vigencia",
                    "Venta",
                    "Estado",
                  ].map((t) => (
                    <th key={t} scope="col" className="px-3 py-2 font-medium">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map((b) => (
                  <tr key={b.id} className="border-t border-ac-borde">
                    <td className="px-3 py-2">
                      <Link
                        href={`/clientes/${b.clienteId}`}
                        className="area-tactil font-medium hover:underline"
                      >
                        {b.cliente}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      {b.nombre}
                      <span className="block text-xs text-ac-pizarra">
                        {NOMBRE_TIPO_BONO[b.tipo]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <UsoBono bono={b} />
                    </td>
                    <td className="cifras whitespace-nowrap px-3 py-2">
                      {fecha(b.inicio)} – {fecha(b.vence)}
                    </td>
                    <td className="cifras px-3 py-2">{b.venta ?? "—"}</td>
                    <td className="px-3 py-2">
                      <EstadoBonoPildora estado={b.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2 lg:hidden" aria-label="Planes vendidos">
            {lista.map((b) => (
              <li
                key={b.id}
                className="space-y-1 rounded-lg border border-ac-borde bg-ac-papel p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/clientes/${b.clienteId}`}
                    className="area-tactil font-medium hover:underline"
                  >
                    {b.cliente}
                  </Link>
                  <EstadoBonoPildora estado={b.estado} />
                </div>
                <p>
                  {b.nombre}{" "}
                  <span className="text-ac-pizarra">
                    · {NOMBRE_TIPO_BONO[b.tipo]}
                  </span>
                </p>
                <UsoBono bono={b} />
                <p className="cifras text-xs text-ac-pizarra">
                  Vence el {fecha(b.vence)}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
