"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { toast } from "sonner";
import { BarraCambiosPendientes } from "@/shared/components/barra-cambios-pendientes";
import { Campo } from "@/shared/components/campo";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import { guardarAjustes } from "../actions";
import {
  BLOQUES,
  ESQUEMAS,
  type SeccionEditable,
  type ValoresAjustes,
} from "../schemas";
import { Fila, SELECT } from "./fila-ajuste";
import { SeccionAvanzadas, SeccionSitioWeb } from "./secciones-sitio";

type Interruptores = {
  [K in keyof ValoresAjustes]: ValoresAjustes[K] extends boolean ? K : never;
}[keyof ValoresAjustes];

export function FormularioAjustes({
  seccion,
  inicial,
}: {
  seccion: SeccionEditable;
  inicial: ValoresAjustes;
}) {
  const [base, setBase] = useState(inicial);
  const [v, setV] = useState(inicial);
  const [guardando, iniciar] = useTransicionRed();
  const sucio = JSON.stringify(v) !== JSON.stringify(base);
  const cambiar = (c: Partial<ValoresAjustes>) => setV((x) => ({ ...x, ...c }));
  const interruptor = (k: Interruptores) => (
    <Switch
      checked={v[k]}
      onCheckedChange={(x) => cambiar({ [k]: x })}
      aria-label={k}
    />
  );

  function guardar() {
    const p = ESQUEMAS[seccion].safeParse(v);
    if (!p.success)
      return toast.error(p.error.issues[0]?.message ?? "Revisa los datos");
    iniciar(async () => {
      const r = await guardarAjustes(seccion, p.data);
      if (r.ok) {
        setBase(v);
        toast.success("Ajustes guardados");
      } else toast.error(r.error, { duration: Infinity });
    });
  }

  return (
    <div className="rounded-lg border border-ac-borde bg-ac-papel px-4 shadow-quieta sm:px-6">
      {seccion === "mi-negocio" ? (
        <div className="grid gap-4 py-5 sm:grid-cols-2">
          <Campo id="nombre" etiqueta="Nombre del negocio" obligatorio>
            <Input
              id="nombre"
              value={v.nombre}
              onChange={(e) => cambiar({ nombre: e.target.value })}
            />
          </Campo>
          <Campo
            id="slug"
            etiqueta="Dirección del sitio de reservas"
            ayuda={`/reservar/${v.slug}`}
          >
            <Input
              id="slug"
              value={v.slug}
              onChange={(e) => cambiar({ slug: e.target.value.toLowerCase() })}
            />
          </Campo>
          <Campo
            id="descripcion"
            etiqueta="Descripción"
            className="sm:col-span-2"
          >
            <Textarea
              id="descripcion"
              rows={4}
              value={v.descripcion}
              onChange={(e) => cambiar({ descripcion: e.target.value })}
            />
          </Campo>
        </div>
      ) : null}

      {seccion === "agenda" ? (
        <>
          <Fila
            titulo="Largo del bloque"
            texto="Cada fila de la agenda equivale a este tiempo."
          >
            <select
              value={v.bloqueMin}
              onChange={(e) => cambiar({ bloqueMin: Number(e.target.value) })}
              className={SELECT}
              aria-label="Largo del bloque"
            >
              {BLOQUES.map((b) => (
                <option key={b} value={b}>
                  {b} min
                </option>
              ))}
            </select>
          </Fila>
          <Fila
            titulo="Permitir citas sobrepuestas"
            texto="Dos citas del mismo profesional a la misma hora."
          >
            {interruptor("permitirSobrepuestas")}
          </Fila>
          <Fila
            titulo="Permitir que un cliente tenga dos citas a la vez"
            texto="Útil para servicios en paralelo."
          >
            {interruptor("permitirClienteDoble")}
          </Fila>
          <Fila
            titulo="Permitir sobrecarga de recursos"
            texto="Agendar aunque la sala, silla o equipo ya esté ocupado (solo desde la agenda)."
          >
            {interruptor("permitirSobrecargaRecursos")}
          </Fila>
          <Fila
            titulo="Agendar fuera del horario"
            texto="Si está apagado, la agenda no deja reservar cuando el local o el profesional no atienden."
          >
            {interruptor("permitirFueraHorario")}
          </Fila>
          <Fila
            titulo="Exigir correo o teléfono del cliente"
            texto="Sin contacto no se pueden enviar avisos."
          >
            {interruptor("exigirContacto")}
          </Fila>
          <Fila
            titulo="Bloquear cambios en citas pasadas"
            texto="Las citas que ya pasaron solo cambian de estado."
          >
            {interruptor("bloquearPasadas")}
          </Fila>
        </>
      ) : null}

      {seccion === "recordatorios" ? (
        <>
          <Fila
            titulo="Aviso al reservar por correo"
            texto="Sale apenas se crea o cambia la cita."
          >
            {interruptor("avisoCorreo")}
          </Fila>
          <Fila titulo="Aviso al reservar por WhatsApp">
            {interruptor("avisoWhatsapp")}
          </Fila>
          {(["Correo", "Whatsapp"] as const).map((canal) => {
            const activo = `recordatorio${canal}` as const;
            const dias = `recordatorio${canal}Dias` as const;
            const hora = `recordatorio${canal}Hora` as const;
            return (
              <Fila
                key={canal}
                titulo={`Recordatorio por ${canal === "Correo" ? "correo" : "WhatsApp"}`}
                texto="No se programa si la cita ya está confirmada o si la hora de envío ya pasó."
              >
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {interruptor(activo)}
                  <select
                    value={v[dias]}
                    onChange={(e) =>
                      cambiar({ [dias]: Number(e.target.value) })
                    }
                    disabled={!v[activo]}
                    className={SELECT}
                    aria-label="Días antes"
                  >
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <option key={n} value={n}>
                        {n === 0
                          ? "El mismo día"
                          : `${n} día${n > 1 ? "s" : ""} antes`}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="time"
                    step={300}
                    value={v[hora]}
                    onChange={(e) => cambiar({ [hora]: e.target.value })}
                    disabled={!v[activo]}
                    className="w-[110px] cifras"
                    aria-label="Hora de envío"
                  />
                </div>
              </Fila>
            );
          })}
        </>
      ) : null}

      {seccion === "caja" ? (
        <>
          <Fila
            titulo="Usar la caja"
            texto="Los cobros en efectivo suman a la caja del local."
          >
            {interruptor("cajaActiva")}
          </Fila>
          <Fila
            titulo="Cliente obligatorio al cobrar"
            texto="No deja cerrar una venta sin cliente."
          >
            {interruptor("cajaClienteObligatorio")}
          </Fila>
          <Fila
            titulo="Métodos de pago"
            texto="Efectivo, transferencia, tarjetas y propios: llegan con Ventas."
          >
            <span className="rounded-full bg-ac-niebla-oscura px-3 py-1 text-[13px] text-ac-pizarra">
              Próxima oleada
            </span>
          </Fila>
        </>
      ) : null}

      {seccion === "sitio-web" ? (
        <SeccionSitioWeb v={v} cambiar={cambiar} interruptor={interruptor} />
      ) : null}
      {seccion === "avanzadas" ? (
        <SeccionAvanzadas v={v} cambiar={cambiar} interruptor={interruptor} />
      ) : null}

      <BarraCambiosPendientes
        visible={sucio}
        guardando={guardando}
        onCancelar={() => setV(base)}
        onGuardar={guardar}
      />
    </div>
  );
}
