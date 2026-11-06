"use client";

import { useEffect, useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { crearClienteNavegador } from "@/shared/lib/supabase/client";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import { Label } from "@/shared/ui/label";
import { ClienteRapido } from "@/features/clientes/components/cliente-rapido";
import type {
  ClienteResumen,
  DatosClienteRapido,
} from "@/features/clientes/schemas";
import { CLAVE_AGENDA } from "@/features/agenda/hooks/use-agenda";
import type { BaseAgenda } from "@/features/agenda/types";
import { guardarCita, revisarCita } from "../actions";
import {
  aDatosCita,
  faltante,
  horaFin,
  type FormReserva,
} from "../lib/reserva";
import { fechasSerie } from "../lib/serie";
import type { Alcance } from "../schemas";
import type { RevisionFecha } from "../types";
import { CamposReserva, type Errores } from "./campos-reserva";
import { SelectorEstado } from "./estado-cita";
import { VentanaChoques, type ChoquesPendientes } from "./ventana-choques";

/** "Ana Pérez", "ana@x.test" o "300 123 4567" escrito en el buscador → datos para el cliente nuevo. */
function clienteDesdeTexto(texto: string): DatosClienteRapido {
  const vacio = {
    nombre: "",
    apellido: "",
    documento: "",
    correo: "",
    telefono: "",
  };
  if (texto.includes("@")) return { ...vacio, correo: texto };
  if (/^[+\d\s-]{7,}$/.test(texto)) return { ...vacio, telefono: texto };
  const [nombre = "", ...resto] = texto.split(/\s+/);
  return { ...vacio, nombre, apellido: resto.join(" ") };
}

async function clienteParaEditar(
  id: string,
): Promise<DatosClienteRapido | null> {
  const { data } = await crearClienteNavegador()
    .from("clientes")
    .select("id, nombre, apellido, documento, correo, telefono")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    nombre: data.nombre,
    apellido: data.apellido,
    documento: data.documento ?? "",
    correo: data.correo ?? "",
    telefono: data.telefono ?? "",
  };
}

/** Revisa los choques de cada fecha de la serie mientras se arma (con medio segundo de espera). */
function useRevisionSerie(f: FormReserva, localId: string) {
  // La última revisión que llegó y para qué datos era; si los datos cambiaron, se está revisando.
  const [hecha, setHecha] = useState<{
    clave: string;
    revision: RevisionFecha[] | null;
  }>({ clave: "", revision: null });
  const datos =
    f.repetir && !faltante(f)
      ? aDatosCita({ ...f, omitir: [] }, localId)
      : null;
  const clave = datos
    ? JSON.stringify({ ...datos, notaCliente: "", notaInterna: "" })
    : "";
  useEffect(() => {
    if (!clave) return;
    let vigente = true;
    const id = window.setTimeout(async () => {
      const r = await revisarCita(JSON.parse(clave));
      if (vigente) setHecha({ clave, revision: r.ok ? r.revision : null });
    }, 500);
    return () => {
      vigente = false;
      window.clearTimeout(id);
    };
  }, [clave]);
  if (!clave) return { revision: null, revisando: false };
  return { revision: hecha.revision, revisando: hecha.clave !== clave };
}

/** Ventana "Nueva reserva" / "Editar reserva" con choques, series y "Agregar otra reserva". */
export function VentanaReserva({
  base,
  localId,
  inicial,
  onCerrar,
}: {
  base: BaseAgenda;
  localId: string;
  inicial: FormReserva;
  onCerrar: () => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState<FormReserva>(inicial);
  const [errores, setErrores] = useState<Errores>({});
  const [choques, setChoques] = useState<ChoquesPendientes | null>(null);
  const [clienteForm, setClienteForm] = useState<DatosClienteRapido | null>(
    null,
  );
  const [alcance, setAlcance] = useState<Alcance>("solo_esta");
  const [guardando, iniciar] = useTransicionRed();
  const { revision, revisando } = useRevisionSerie(f, localId);
  const falta = faltante(f);
  const cambiar = (c: Partial<FormReserva>) => {
    setF((x) => ({ ...x, ...c }));
    setErrores({});
  };

  function guardar(
    opciones: { forzar?: boolean; saltar?: string[]; otra?: boolean } = {},
  ) {
    if (falta) return;
    const omitir = [...f.omitir, ...(opciones.saltar ?? [])];
    iniciar(async () => {
      const r = await guardarCita(aDatosCita({ ...f, omitir }, localId), {
        forzar: opciones.forzar,
        alcance,
      });
      if (r.ok) {
        void qc.invalidateQueries({ queryKey: [CLAVE_AGENDA] });
        void qc.invalidateQueries({ queryKey: ["citas-recientes"] });
        const n = r.citaIds.length;
        toast.success(
          f.id
            ? "Reserva guardada"
            : n > 1
              ? `Se crearon ${n} reservas`
              : "Reserva creada",
        );
        setChoques(null);
        if (!opciones.otra) return onCerrar();
        const siguiente = horaFin(f.hora, f.duracionMin) || f.hora;
        return setF({
          ...f,
          hora: siguiente,
          servicioId: "",
          duracionMin: 0,
          precio: 0,
          repetir: null,
          omitir: [],
          notaCliente: "",
          notaInterna: "",
        });
      }
      if ("choques" in r) {
        const total = fechasSerie(f.fecha, f.id ? null : f.repetir).filter(
          (x) => !omitir.includes(x),
        ).length;
        return setChoques({
          choques: r.choques,
          puedeForzar: r.puedeForzar,
          libres: total - r.choques.length,
        });
      }
      setChoques(null);
      if (r.campo) setErrores({ [r.campo]: r.error });
      else toast.error(r.error, { duration: Infinity });
    });
  }

  async function editarCliente() {
    if (!f.cliente) return;
    const datos = await clienteParaEditar(f.cliente.id);
    if (datos) setClienteForm(datos);
  }
  function clienteListo(c: ClienteResumen) {
    setClienteForm(null);
    cambiar({
      cliente: {
        id: c.id,
        nombre: `${c.nombre} ${c.apellido}`,
        correo: c.correo,
        telefono: c.telefono,
        creado: c.creado,
      },
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !guardando && onCerrar()}>
      <DialogContent
        className="flex h-dvh max-h-dvh max-w-full rounded-none sm:rounded-none flex-col gap-0 p-0 md:h-auto md:max-h-[92dvh] md:max-w-2xl md:rounded-lg"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-ac-borde px-5 py-3 pr-12">
          <DialogTitle>{f.id ? "Editar reserva" : "Nueva reserva"}</DialogTitle>
          <SelectorEstado
            valor={f.estado}
            onCambio={(estado) => cambiar({ estado })}
          />
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <CamposReserva
            f={f}
            cambiar={cambiar}
            base={base}
            localId={localId}
            errores={errores}
            revision={revision}
            revisando={revisando}
            onNuevoCliente={(texto) => setClienteForm(clienteDesdeTexto(texto))}
            onEditarCliente={() => void editarCliente()}
          />
        </div>
        <PieReserva
          editando={Boolean(f.id)}
          enSerie={Boolean(f.id && f.serieId)}
          alcance={alcance}
          onAlcance={setAlcance}
          falta={falta}
          guardando={guardando}
          onCancelar={onCerrar}
          onOtra={() => guardar({ otra: true })}
          onGuardar={() => guardar()}
        />
      </DialogContent>
      {clienteForm ? (
        <ClienteRapido
          inicial={clienteForm}
          onListo={clienteListo}
          onCerrar={() => setClienteForm(null)}
        />
      ) : null}
      <VentanaChoques
        pendientes={choques}
        guardando={guardando}
        onVolver={() => setChoques(null)}
        onForzar={() => guardar({ forzar: true })}
        onSinChoques={
          f.id
            ? undefined
            : () => guardar({ saltar: choques?.choques.map((c) => c.fecha) })
        }
      />
    </Dialog>
  );
}

function PieReserva(p: {
  editando: boolean;
  enSerie: boolean;
  alcance: Alcance;
  onAlcance: (a: Alcance) => void;
  falta: string | null;
  guardando: boolean;
  onCancelar: () => void;
  onOtra: () => void;
  onGuardar: () => void;
}) {
  return (
    <div className="space-y-3 border-t border-ac-borde px-5 py-3">
      {p.enSerie ? (
        <RadioGroup
          value={p.alcance}
          onValueChange={(v) => p.onAlcance(v as Alcance)}
          className="flex flex-wrap gap-4 text-sm"
          aria-label="Aplicar los cambios a"
        >
          <span className="text-ac-pizarra">Aplicar a:</span>
          <span className="flex items-center gap-2">
            <RadioGroupItem id="alcance-esta" value="solo_esta" />
            <Label htmlFor="alcance-esta" className="font-normal">
              Solo esta
            </Label>
          </span>
          <span className="flex items-center gap-2">
            <RadioGroupItem id="alcance-siguientes" value="esta_y_siguientes" />
            <Label htmlFor="alcance-siguientes" className="font-normal">
              Esta y las siguientes
            </Label>
          </span>
        </RadioGroup>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {p.falta ? (
          <p className="mr-auto text-[13px] text-ac-neblina">{p.falta}</p>
        ) : null}
        <Button variant="outline" onClick={p.onCancelar} disabled={p.guardando}>
          Cancelar
        </Button>
        {p.editando ? null : (
          <Button
            variant="outline"
            onClick={p.onOtra}
            disabled={p.guardando || p.falta !== null}
          >
            Agregar otra reserva
          </Button>
        )}
        <Button
          onClick={p.onGuardar}
          disabled={p.guardando || p.falta !== null}
        >
          {p.guardando ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : null}
          Guardar reserva
        </Button>
      </div>
    </div>
  );
}
