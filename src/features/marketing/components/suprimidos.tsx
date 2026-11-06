"use client";

import { useEffect, useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { MailX, Search } from "lucide-react";
import { toast } from "sonner";
import { Vacio } from "@/shared/components/vacio";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { buscarClientes } from "@/features/clientes/actions";
import type { ClienteResumen } from "@/features/clientes/schemas";
import { cambiarSuscripcion } from "../actions";
import type { ClienteSuprimido } from "../types";

/** Buscador para suprimir a alguien más: solo muestra clientes con correo que todavía reciben campañas. */
function Agregar({ suprimidos }: { suprimidos: ClienteSuprimido[] }) {
  const [texto, setTexto] = useState("");
  const [encontrados, setEncontrados] = useState<ClienteResumen[]>([]);
  const [, iniciar] = useTransicionRed();

  useEffect(() => {
    let vigente = true;
    const t = setTimeout(async () => {
      const r = texto.trim().length >= 2 ? await buscarClientes(texto) : [];
      if (vigente) setEncontrados(r);
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [texto]);

  const opciones = encontrados.filter(
    (c) => c.correo && !suprimidos.some((s) => s.id === c.id),
  );

  function suprimir(c: ClienteResumen) {
    iniciar(async () => {
      const r = await cambiarSuscripcion({ clienteId: c.id, recibe: false });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${c.nombre} ya no recibe campañas`);
      setTexto("");
    });
  }

  return (
    <div className="space-y-2">
      <label className="relative block">
        <span className="sr-only">Buscar un cliente para suprimir</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ac-neblina"
          aria-hidden="true"
        />
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por nombre o correo para suprimir"
          className="pl-9"
        />
      </label>
      {texto.trim().length >= 2 ? (
        <ul className="overflow-hidden rounded-lg border border-ac-borde bg-ac-papel">
          {opciones.length === 0 ? (
            <li className="px-4 py-3 text-sm text-ac-pizarra">
              Nadie con correo que todavía reciba campañas.
            </li>
          ) : (
            opciones.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 border-b border-ac-borde px-4 py-2 text-sm last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="font-medium">
                    {c.nombre} {c.apellido}
                  </span>
                  <span className="block truncate text-xs text-ac-pizarra">
                    {c.correo}
                  </span>
                </span>
                <Button variant="outline" size="sm" onClick={() => suprimir(c)}>
                  Suprimir
                </Button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

/** Pestaña Correos suprimidos: clientes que pidieron no recibir campañas (sus avisos de citas sí llegan). */
export function Suprimidos({ suprimidos }: { suprimidos: ClienteSuprimido[] }) {
  const [, iniciar] = useTransicionRed();

  function reactivar(c: ClienteSuprimido) {
    iniciar(async () => {
      const r = await cambiarSuscripcion({ clienteId: c.id, recibe: true });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${c.nombre} vuelve a recibir campañas`);
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ac-pizarra">
        Las campañas no les llegan. Los avisos y recordatorios de sus citas sí.
      </p>
      <Agregar suprimidos={suprimidos} />
      {suprimidos.length === 0 ? (
        <Vacio
          icono={MailX}
          titulo="Nadie ha pedido salir"
          texto="Cuando un cliente no quiera recibir campañas, búscalo arriba y suprímelo."
        />
      ) : (
        <ul className="overflow-hidden rounded-lg border border-ac-borde bg-ac-papel shadow-quieta">
          {suprimidos.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 border-b border-ac-borde px-4 py-3 text-sm last:border-b-0"
            >
              <MailX
                className="h-4 w-4 shrink-0 text-ac-pizarra"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{c.nombre}</span>
                <span className="block truncate text-xs text-ac-pizarra">
                  {c.correo}
                </span>
              </span>
              <Button variant="outline" size="sm" onClick={() => reactivar(c)}>
                Volver a enviarle
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
