"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { differenceInYears, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, CalendarPlus, Hammer, Pencil } from "lucide-react";
import { usePuede } from "@/features/auth/components/proveedor-miembro";
import { SellosCliente } from "@/features/fidelizacion/components/sellos-cliente";
import type { ProgramaSellos } from "@/features/fidelizacion/lib/sellos";
import { telefono } from "@/shared/lib/formato";
import { iniciales } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import type { FichaCliente as DatosFicha } from "../services/clientes";
import type { DatosCliente } from "../schemas";
import { ModalCliente } from "./modal-cliente";
import { Actividad, Asistencia, PagosDeudas } from "./pestanas-cliente";

const GENERO: Record<string, string> = {
  femenino: "Femenino",
  masculino: "Masculino",
  otro: "Otro",
};

function Dato({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string | null | undefined;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ac-pizarra">{titulo}</dt>
      <dd
        className={
          valor ? "truncate text-sm font-medium" : "text-sm text-ac-neblina"
        }
      >
        {valor || "Sin dato"}
      </dd>
    </div>
  );
}

export function aFormulario(c: DatosFicha["cliente"]): DatosCliente {
  return {
    id: c.id,
    nombre: c.nombre,
    apellido: c.apellido,
    documento: c.documento ?? "",
    correo: c.correo ?? "",
    telefono: c.telefono ?? "",
    fechaNacimiento: c.fecha_nacimiento ?? "",
    genero: (c.genero ?? "") as DatosCliente["genero"],
    numeroCliente: c.numero_cliente ?? "",
    direccion: c.direccion ?? "",
    barrio: c.barrio ?? "",
    municipio: c.municipio ?? "",
  };
}

function ProximaOleadaCorta({ que }: { que: string }) {
  return (
    <p className="flex items-center gap-2 rounded-lg border border-dashed border-ac-borde-fuerte bg-ac-papel p-6 text-ac-pizarra">
      <Hammer className="h-5 w-5 text-ac-laguna" aria-hidden="true" />
      {que} llega en una próxima oleada.
    </p>
  );
}

/** Ficha del cliente: cabecera, datos clave (Ver más / Editar) y pestañas (US-037). */
export function FichaCliente({
  ficha,
  hoy,
  sellos,
}: {
  ficha: DatosFicha;
  hoy: string;
  sellos: { programa: ProgramaSellos; sellos: number; canjes: number };
}) {
  const { cliente, citas, ventas } = ficha;
  const router = useRouter();
  const puedo = usePuede();
  const [masDatos, setMasDatos] = useState(false);
  const [editar, setEditar] = useState(false);
  const nacimiento = cliente.fecha_nacimiento
    ? `${format(parseISO(cliente.fecha_nacimiento), "d 'de' MMMM", { locale: es })} · ${differenceInYears(new Date(), parseISO(cliente.fecha_nacimiento))} años`
    : null;

  return (
    <main className="mx-auto w-full max-w-[1200px] space-y-4 px-4 py-4 lg:px-6 lg:py-6">
      <Link
        href="/clientes"
        className="inline-flex items-center gap-1 text-sm text-ac-pizarra hover:text-ac-tinta min-h-11 md:min-h-0"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Base de clientes
      </Link>
      <section className="rounded-lg border border-ac-borde bg-ac-papel p-4 shadow-quieta sm:p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ac-laguna-claro text-lg font-bold text-ac-laguna-hondo">
            {iniciales(cliente.nombre, cliente.apellido)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[28px] font-bold leading-tight tracking-tight md:text-2xl">
              {cliente.nombre} {cliente.apellido}
            </h1>
            <p className="text-sm text-ac-pizarra">
              Cliente desde{" "}
              {format(parseISO(cliente.created_at), "MMMM 'de' yyyy", {
                locale: es,
              })}
            </p>
          </div>
          {puedo("crear_cita") ? (
            <Button asChild>
              <Link href={`/agenda?reservar=${cliente.id}`}>
                <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Nueva
                reserva
              </Link>
            </Button>
          ) : null}
        </div>
        <dl className="mt-4 grid gap-3 border-t border-ac-borde pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <Dato titulo="Correo" valor={cliente.correo} />
          <Dato titulo="Teléfono" valor={telefono(cliente.telefono)} />
          <Dato titulo="Documento" valor={cliente.documento} />
          <Dato titulo="Cumpleaños" valor={nacimiento} />
          {masDatos ? (
            <>
              <Dato
                titulo="Género"
                valor={cliente.genero ? GENERO[cliente.genero] : null}
              />
              <Dato titulo="Número de cliente" valor={cliente.numero_cliente} />
              <Dato
                titulo="Campañas de correo"
                valor={cliente.recibe_campanas ? "Las recibe" : "No las recibe"}
              />
              <Dato titulo="Dirección" valor={cliente.direccion} />
              <Dato
                titulo="Barrio y municipio"
                valor={[cliente.barrio, cliente.municipio]
                  .filter(Boolean)
                  .join(", ")}
              />
            </>
          ) : null}
        </dl>
        <div className="mt-3 flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMasDatos((v) => !v)}
          >
            {masDatos ? "Ver menos" : "Ver más"}
          </Button>
          {puedo("editar_clientes") ? (
            <Button variant="outline" size="sm" onClick={() => setEditar(true)}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Editar
            </Button>
          ) : null}
        </div>
      </section>

      <Tabs defaultValue="actividad">
        <TabsList className="w-full md:h-auto justify-start overflow-x-auto rounded-lg border border-ac-borde bg-ac-papel p-1">
          <TabsTrigger value="actividad">Actividad</TabsTrigger>
          <TabsTrigger value="asistencia">Asistencia</TabsTrigger>
          <TabsTrigger value="pagos">Pagos y deudas</TabsTrigger>
          <TabsTrigger value="fichas">Fichas</TabsTrigger>
          <TabsTrigger value="fidelizacion">Fidelización</TabsTrigger>
        </TabsList>
        <TabsContent value="actividad" className="mt-4">
          <Actividad citas={citas} />
        </TabsContent>
        <TabsContent value="asistencia" className="mt-4">
          <Asistencia citas={citas} hoy={hoy} />
        </TabsContent>
        <TabsContent value="pagos" className="mt-4">
          <PagosDeudas
            clienteId={cliente.id}
            citas={citas}
            ventas={ventas}
            puedeCobrar={puedo("cobrar")}
          />
        </TabsContent>
        <TabsContent value="fichas" className="mt-4">
          <ProximaOleadaCorta que="La ficha técnica (fórmulas, alergias, fotos)" />
        </TabsContent>
        <TabsContent value="fidelizacion" className="mt-4">
          <SellosCliente
            clienteId={cliente.id}
            nombre={`${cliente.nombre} ${cliente.apellido}`}
            puedeEntregar={puedo("cobrar")}
            {...sellos}
          />
        </TabsContent>
      </Tabs>
      {editar ? (
        <ModalCliente
          inicial={aFormulario(cliente)}
          onCerrar={() => setEditar(false)}
          onGuardado={() => router.refresh()}
        />
      ) : null}
    </main>
  );
}
