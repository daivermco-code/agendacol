"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import type {
  Audiencia,
  Campana,
  ClienteSuprimido,
  Conteo,
  Cupo,
  ServicioFiltro,
} from "../types";
import { Audiencias } from "./audiencias";
import { Campanas } from "./campanas";
import { Suprimidos } from "./suprimidos";

const numero = new Intl.NumberFormat("es-CO");

function CupoCorreo({ cupo }: { cupo: Cupo }) {
  const quedan = Math.max(cupo.cupo - cupo.usados, 0);
  const usado = Math.min((cupo.usados / Math.max(cupo.cupo, 1)) * 100, 100);
  return (
    <section
      aria-labelledby="titulo-cupo-correo"
      className="rounded-lg bg-ac-noche p-4 text-ac-sobre-noche sm:p-5"
    >
      <h2 id="titulo-cupo-correo" className="font-semibold">
        Correos de campaña de este mes
      </h2>
      <dl className="mt-2 grid grid-cols-3 gap-x-6 gap-y-1 text-sm sm:flex sm:flex-wrap">
        {[
          ["Al mes", numero.format(cupo.cupo)],
          ["Usados", numero.format(cupo.usados)],
          ["Quedan", numero.format(quedan)],
        ].map(([n, v]) => (
          <div key={n} className="flex gap-1.5">
            <dt className="text-ac-sobre-noche-suave">{n}:</dt>
            <dd className="cifras font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-ac-noche-claro"
        role="meter"
        aria-label="Correos de campaña usados del mes"
        aria-valuemin={0}
        aria-valuemax={cupo.cupo}
        aria-valuenow={cupo.usados}
      >
        <div
          className="h-full rounded-full bg-ac-laguna"
          style={{ width: `${usado}%` }}
        />
      </div>
    </section>
  );
}

/** Clientes → Correo masivo: Campañas · Audiencias · Correos suprimidos, con el cupo del mes arriba. */
export function MarketingVista({
  campanas,
  audiencias,
  todos,
  cupo,
  suprimidos,
  servicios,
}: {
  campanas: Campana[];
  audiencias: Audiencia[];
  todos: Conteo;
  cupo: Cupo;
  suprimidos: ClienteSuprimido[];
  servicios: ServicioFiltro[];
}) {
  return (
    <div className="space-y-4">
      <CupoCorreo cupo={cupo} />
      <Tabs defaultValue="campanas">
        <TabsList className="w-full md:h-auto justify-start overflow-x-auto rounded-lg border border-ac-borde bg-ac-papel p-1">
          <TabsTrigger value="campanas">
            Campañas ({campanas.length})
          </TabsTrigger>
          <TabsTrigger value="audiencias">
            Audiencias ({audiencias.length})
          </TabsTrigger>
          <TabsTrigger value="suprimidos">
            Correos suprimidos ({suprimidos.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="campanas" className="mt-4">
          <Campanas
            campanas={campanas}
            destinos={{ audiencias, todos }}
            quedan={Math.max(cupo.cupo - cupo.usados, 0)}
          />
        </TabsContent>
        <TabsContent value="audiencias" className="mt-4">
          <Audiencias
            audiencias={audiencias}
            campanas={campanas}
            servicios={servicios}
          />
        </TabsContent>
        <TabsContent value="suprimidos" className="mt-4">
          <Suprimidos suprimidos={suprimidos} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
