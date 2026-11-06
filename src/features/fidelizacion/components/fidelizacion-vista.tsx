"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import Link from "next/link";
import { Gift, Loader2, Search, Stamp } from "lucide-react";
import { toast } from "sonner";
import { useConfirmar } from "@/shared/components/confirmar";
import { Campo } from "@/shared/components/campo";
import { Vacio } from "@/shared/components/vacio";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { entregarPremio, guardarPrograma } from "../actions";
import { sellosVisibles, type ProgramaSellos } from "../lib/sellos";
import type { PanelSellos, TarjetaSellos } from "../types";
import { PuntosSellos } from "./tarjeta-sellos";

type Filtro = "todas" | "premio" | "uno";
const POR_PAGINA = 25;
const FECHA = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  dateStyle: "medium",
});

export function BotonEntregar({
  clienteId,
  nombre,
  premio,
}: {
  clienteId: string;
  nombre: string;
  premio: string;
}) {
  const [dialogo, confirmar] = useConfirmar();
  const [entregando, iniciar] = useTransicionRed();

  async function entregar() {
    const ok = await confirmar({
      titulo: `¿Entregar el premio a ${nombre}?`,
      texto: `${premio}. Queda anotado con la fecha de hoy.`,
      aceptar: "Entregar",
    });
    if (!ok) return;
    iniciar(async () => {
      const r = await entregarPremio(clienteId);
      if (r.ok) toast.success(`Premio entregado a ${nombre}`);
      else toast.error(r.error);
    });
  }

  return (
    <>
      <Button size="sm" onClick={entregar} disabled={entregando}>
        {entregando ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Gift className="h-4 w-4" aria-hidden="true" />
        )}
        Entregar premio
      </Button>
      {dialogo}
    </>
  );
}

function Tarjetas({
  tarjetas,
  programa,
}: {
  tarjetas: TarjetaSellos[];
  programa: ProgramaSellos;
}) {
  const [texto, setTexto] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [visibles, setVisibles] = useState(POR_PAGINA);
  const t = texto.trim().toLocaleLowerCase("es");
  const lista = tarjetas.filter(
    (x) =>
      (!t || x.cliente.toLocaleLowerCase("es").includes(t)) &&
      (filtro === "todas" ||
        (filtro === "premio"
          ? x.porEntregar > 0
          : x.enTarjeta === programa.meta - 1)),
  );
  const chips: [Filtro, string][] = [
    ["todas", `Todas (${tarjetas.length})`],
    [
      "premio",
      `Premio por entregar (${tarjetas.filter((x) => x.porEntregar > 0).length})`,
    ],
    [
      "uno",
      `A un sello (${tarjetas.filter((x) => x.enTarjeta === programa.meta - 1).length})`,
    ],
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-56 flex-1 sm:max-w-xs">
          <span className="sr-only">Buscar cliente</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ac-neblina"
            aria-hidden="true"
          />
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar cliente"
            className="pl-9"
          />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Mostrar">
          {chips.map(([f, nombre]) => (
            <button
              key={f}
              type="button"
              aria-pressed={filtro === f}
              onClick={() => {
                setFiltro(f);
                setVisibles(POR_PAGINA);
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-sm min-h-11 md:min-h-0",
                filtro === f
                  ? "border-ac-laguna bg-ac-laguna-claro font-medium text-ac-laguna-hondo"
                  : "border-ac-borde bg-ac-papel text-ac-pizarra hover:bg-ac-niebla",
              )}
            >
              {nombre}
            </button>
          ))}
        </div>
      </div>
      {lista.length === 0 ? (
        <Vacio
          icono={Stamp}
          titulo={
            tarjetas.length ? "Nadie cumple el filtro" : "Aún no hay sellos"
          }
          texto="Cada cita marcada como «Asistió» le pone un sello al cliente."
        />
      ) : (
        <ul className="overflow-hidden rounded-lg border border-ac-borde bg-ac-papel shadow-quieta">
          {lista.slice(0, visibles).map((x) => (
            <li
              key={x.clienteId}
              className="grid gap-x-4 gap-y-2 border-b border-ac-borde px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_auto_19rem] md:items-center"
            >
              <div className="min-w-0 flex-1 text-sm">
                <Link
                  href={`/clientes/${x.clienteId}`}
                  className="area-tactil font-semibold hover:underline"
                >
                  {x.cliente}
                </Link>
                <p className="cifras text-xs text-ac-pizarra">
                  {x.sellos} {x.sellos === 1 ? "sello" : "sellos"} en total ·{" "}
                  {x.canjes}{" "}
                  {x.canjes === 1 ? "premio entregado" : "premios entregados"} ·
                  último el {FECHA.format(new Date(x.ultimo))}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <PuntosSellos
                  enTarjeta={sellosVisibles(x, programa.meta)}
                  meta={programa.meta}
                />
                <span className="cifras w-10 text-right text-sm font-medium">
                  {sellosVisibles(x, programa.meta)}/{programa.meta}
                </span>
              </div>
              {x.porEntregar > 0 ? (
                <div className="flex items-center gap-2 md:justify-end">
                  <span className="whitespace-nowrap rounded-full bg-ac-aviso-fondo px-2 py-0.5 text-xs font-medium text-ac-aviso">
                    {x.porEntregar === 1
                      ? "1 premio"
                      : `${x.porEntregar} premios`}{" "}
                    por entregar
                  </span>
                  <BotonEntregar
                    clienteId={x.clienteId}
                    nombre={x.cliente}
                    premio={programa.premio}
                  />
                </div>
              ) : (
                <span className="hidden md:block" />
              )}
            </li>
          ))}
        </ul>
      )}
      {lista.length > visibles ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setVisibles((v) => v + POR_PAGINA)}
          >
            Ver {Math.min(POR_PAGINA, lista.length - visibles)} más de{" "}
            {lista.length}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Panel({
  panel,
  programa,
}: {
  panel: PanelSellos;
  programa: ProgramaSellos;
}) {
  const cifras: [string, number][] = [
    ["Clientes con tarjeta", panel.clientes],
    ["Sellos este mes", panel.sellosMes],
    ["Premios por entregar", panel.porEntregar],
    ["Premios entregados", panel.entregados],
    ["A un sello del premio", panel.aUnSello],
  ];
  return (
    <div className="space-y-4">
      <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cifras.map(([n, v]) => (
          <div
            key={n}
            className="rounded-lg border border-ac-borde bg-ac-papel p-4 shadow-quieta"
          >
            <dt className="text-sm text-ac-pizarra">{n}</dt>
            <dd className="cifras mt-1 text-2xl font-bold">{v}</dd>
          </div>
        ))}
      </dl>
      <section className="rounded-lg border border-ac-borde bg-ac-papel p-4 text-sm shadow-quieta">
        <h2 className="font-semibold">Cómo funciona</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ac-pizarra">
          <li>
            Cada cita que pasa a «Asistió» le pone un sello al cliente; si se
            corrige, el sello se quita.
          </li>
          <li>
            Con {programa.meta} sellos se llena la tarjeta y el cliente gana:{" "}
            {programa.premio}. Le llega un aviso al buzón.
          </li>
          <li>
            Al entregar el premio en el local, márcalo aquí o en la ficha del
            cliente.
          </li>
        </ul>
      </section>
    </div>
  );
}

function Configuracion({ programa }: { programa: ProgramaSellos }) {
  const [activo, setActivo] = useState(programa.activo);
  const [meta, setMeta] = useState(String(programa.meta));
  const [premio, setPremio] = useState(programa.premio);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransicionRed();

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await guardarPrograma({ activo, meta: Number(meta), premio });
      if (!r.ok) return setError(r.error);
      toast.success("Tarjeta de sellos guardada");
    });
  }

  return (
    <form
      className="max-w-lg space-y-4 rounded-lg border border-ac-borde bg-ac-papel p-4 shadow-quieta"
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
    >
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>
          <span className="block font-medium">Tarjeta de sellos activa</span>
          <span className="text-ac-pizarra">
            Apagada, las citas nuevas no suman sellos.
          </span>
        </span>
        <Switch
          checked={activo}
          onCheckedChange={setActivo}
          aria-label="Tarjeta de sellos activa"
        />
      </label>
      <Campo
        id="sellos-meta"
        etiqueta="Sellos para llenar la tarjeta"
        obligatorio
        ayuda="Entre 3 y 20."
      >
        <Input
          id="sellos-meta"
          type="number"
          inputMode="numeric"
          min={3}
          max={20}
          value={meta}
          onChange={(e) => setMeta(e.target.value)}
          className="w-28"
        />
      </Campo>
      <Campo id="sellos-premio" etiqueta="Premio" obligatorio>
        <Input
          id="sellos-premio"
          value={premio}
          maxLength={80}
          onChange={(e) => setPremio(e.target.value)}
        />
      </Campo>
      {error ? (
        <p role="alert" className="text-sm text-ac-error">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={guardando}>
        {guardando ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : null}
        Guardar
      </Button>
    </form>
  );
}

/** Clientes → Fidelización: Tarjetas · Panel · Configuración. */
export function FidelizacionVista({
  programa,
  tarjetas,
  panel,
  puedeConfigurar,
}: {
  programa: ProgramaSellos;
  tarjetas: TarjetaSellos[];
  panel: PanelSellos;
  puedeConfigurar: boolean;
}) {
  return (
    <div className="space-y-4">
      {!programa.activo ? (
        <p
          role="status"
          className="rounded-md bg-ac-aviso-fondo px-4 py-3 text-sm text-ac-aviso"
        >
          La tarjeta de sellos está apagada: las citas nuevas no suman sellos.
        </p>
      ) : null}
      <Tabs defaultValue="tarjetas">
        <TabsList className="w-full md:h-auto justify-start overflow-x-auto rounded-lg border border-ac-borde bg-ac-papel p-1">
          <TabsTrigger value="tarjetas">Tarjetas</TabsTrigger>
          <TabsTrigger value="panel">Panel</TabsTrigger>
          {puedeConfigurar ? (
            <TabsTrigger value="configuracion">Configuración</TabsTrigger>
          ) : null}
        </TabsList>
        <TabsContent value="tarjetas" className="mt-4">
          <Tarjetas tarjetas={tarjetas} programa={programa} />
        </TabsContent>
        <TabsContent value="panel" className="mt-4">
          <Panel panel={panel} programa={programa} />
        </TabsContent>
        {puedeConfigurar ? (
          <TabsContent value="configuracion" className="mt-4">
            <Configuracion programa={programa} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
