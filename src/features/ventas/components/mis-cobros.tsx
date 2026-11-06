"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, Wallet } from "lucide-react";
import { ESTADOS } from "@/features/agenda/lib/estados";
import { usePuede } from "@/features/auth/components/proveedor-miembro";
import { Vacio } from "@/shared/components/vacio";
import { pesos } from "@/shared/lib/formato";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { useFiltrosUrl } from "../hooks/use-filtros-url";
import type { FilaCobro, FiltrosCobros } from "../services/caja";
import { usePanelVenta } from "../store/panel-venta";
import { Encabezado, FiltroPeriodo, SELECTOR } from "./piezas-listado";

const dia = (f: string) => format(parseISO(f), "EEE d MMM", { locale: es });

function Estado({ c }: { c: FilaCobro }) {
  if (c.tipo === "saldo")
    return (
      <span className="rounded-full bg-ac-aviso-fondo px-2 py-0.5 text-xs font-medium text-ac-aviso">
        Saldo · venta {c.numero}
      </span>
    );
  const e = ESTADOS[c.estado as keyof typeof ESTADOS];
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: e?.fondo, color: e?.texto }}
    >
      {e?.nombre ?? c.estado}
    </span>
  );
}

/** Mis cobros: citas atendidas sin venta y saldos, para cobrarlos uno a uno o varios del mismo cliente (US-042). */
export function MisCobros({
  filas,
  filtros,
  porDefecto,
  profesionales,
  hoy,
}: {
  filas: FilaCobro[];
  filtros: FiltrosCobros;
  porDefecto: FiltrosCobros;
  profesionales: { id: string; nombre: string }[];
  hoy: string;
}) {
  const puedo = usePuede();
  const abrir = usePanelVenta((s) => s.abrir);
  const { ir, cargando } = useFiltrosUrl(filtros, porDefecto);
  const [elegidas, setElegidas] = useState<string[]>([]);
  const vigentes = elegidas.filter((id) => filas.some((f) => f.citaId === id));
  const clienteElegido =
    filas.find((f) => f.citaId === vigentes[0])?.clienteId ?? null;
  const montoElegido = filas
    .filter((f) => f.citaId && vigentes.includes(f.citaId))
    .reduce((s, f) => s + f.monto, 0);
  const totalPendiente = filas.reduce((s, f) => s + f.monto, 0);
  const nombrePro = (id: string | null) =>
    profesionales.find((p) => p.id === id)?.nombre ?? "—";

  function cobrar(c: FilaCobro) {
    if (c.tipo === "saldo" && c.ventaId) abrir({ ventaId: c.ventaId });
    else if (c.citaId)
      abrir({ citaIds: [c.citaId], clienteId: c.clienteId ?? undefined });
  }

  function alternar(c: FilaCobro, si: boolean) {
    if (!c.citaId) return;
    const id = c.citaId;
    setElegidas((l) =>
      si
        ? [...l.filter((x) => vigentes.includes(x)), id]
        : l.filter((x) => x !== id),
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1200px] space-y-4 px-4 py-4 lg:px-6 lg:py-6">
      <Encabezado
        titulo="Mis cobros"
        texto="Citas atendidas que nadie ha pagado y ventas con saldo."
      />
      <section
        aria-label="Cobros pendientes"
        aria-busy={cargando}
        className={cn(
          "rounded-lg border border-ac-borde bg-ac-papel p-4 shadow-quieta transition-opacity",
          cargando && "opacity-60",
        )}
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(0,280px)_minmax(0,240px)_1fr] sm:items-center">
          <FiltroPeriodo
            id="cobros-periodo"
            valor={filtros}
            hoy={hoy}
            onCambio={(p) => ir(p)}
          />
          <select
            aria-label="Profesional"
            className={SELECTOR}
            value={filtros.profesional}
            onChange={(e) => ir({ profesional: e.target.value })}
          >
            <option value="">Todos los profesionales</option>
            {profesionales.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          {filas.length ? (
            <p className="cifras text-sm text-ac-pizarra sm:text-right">
              {filas.length} pendientes ·{" "}
              <span className="font-semibold text-ac-tinta">
                {pesos(totalPendiente)}
              </span>
            </p>
          ) : null}
        </div>
        {vigentes.length > 1 ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-ac-laguna/40 bg-ac-laguna-claro p-3 text-sm">
            <span className="flex-1">
              {vigentes.length} citas de{" "}
              {filas.find((f) => f.clienteId === clienteElegido)?.cliente} ·{" "}
              <span className="cifras font-semibold">
                {pesos(montoElegido)}
              </span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => setElegidas([])}>
              Quitar selección
            </Button>
            <Button
              size="sm"
              onClick={() =>
                abrir({
                  citaIds: vigentes,
                  clienteId: clienteElegido ?? undefined,
                })
              }
            >
              Cobrar juntas
            </Button>
          </div>
        ) : null}
        <div className="mt-4">
          {filas.length === 0 ? (
            <Vacio
              icono={CheckCircle2}
              titulo="Todo cobrado"
              texto="No hay pendientes en este período."
            />
          ) : (
            <ul className="divide-y divide-ac-borde rounded-lg border border-ac-borde">
              {filas.map((c) => {
                const marcada = Boolean(
                  c.citaId && vigentes.includes(c.citaId),
                );
                const otraPersona =
                  clienteElegido !== null && c.clienteId !== clienteElegido;
                return (
                  <li
                    key={c.citaId ?? c.ventaId}
                    className={cn(
                      "flex items-start gap-3 px-3 py-3 sm:items-center",
                      marcada && "bg-ac-laguna-claro/60",
                    )}
                  >
                    {c.tipo === "cita" && puedo("cobrar") ? (
                      <Checkbox
                        className="mt-0.5 sm:mt-0"
                        checked={marcada}
                        disabled={otraPersona && !marcada}
                        onCheckedChange={(v) => alternar(c, v === true)}
                        aria-label={`Elegir la cita de ${c.cliente} del ${dia(c.fecha)}`}
                      />
                    ) : (
                      <span className="w-4 shrink-0" aria-hidden="true" />
                    )}
                    <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-3">
                      <div className="min-w-0 sm:flex-1">
                        <p className="truncate font-medium">{c.cliente}</p>
                        <p className="truncate text-sm text-ac-pizarra">
                          {c.descripcion} · {nombrePro(c.profesionalId)}
                        </p>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 sm:mt-0">
                        <span className="cifras text-sm text-ac-pizarra">
                          {dia(c.fecha)} · {c.hora}
                        </span>
                        <Estado c={c} />
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <span className="cifras font-semibold sm:w-24 sm:text-right">
                        {pesos(c.monto)}
                      </span>
                      {puedo("cobrar") ? (
                        <Button
                          size="sm"
                          variant={c.tipo === "saldo" ? "outline" : "default"}
                          onClick={() => cobrar(c)}
                        >
                          <Wallet className="h-4 w-4" aria-hidden="true" />
                          {c.tipo === "saldo" ? "Pagar saldo" : "Cobrar"}
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
