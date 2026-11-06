"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { useRouter } from "next/navigation";
import {
  CalendarPlus,
  CheckCircle2,
  Loader2,
  Navigation,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Campo } from "@/shared/components/campo";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Textarea } from "@/shared/ui/textarea";
import { cancelarCita, confirmarCita } from "../actions";
import { crearIcs, enlaceMapa } from "../lib/calendario";
import { fechaLarga } from "../lib/fechas-publicas";
import type { CitaPublica } from "../types";
import { CambiarCita } from "./cambiar-cita";
import { PoliticaNegocio } from "./politica-negocio";

/** Baja el .ics de la cita (lo abre el calendario del celular o del computador). */
function bajarCalendario(cita: CitaPublica) {
  const ics = crearIcs({
    uid: `${cita.token}@agedacol.demo`,
    fecha: cita.fecha,
    inicio: cita.inicio,
    fin: cita.fin,
    zona: cita.local.zona,
    titulo: `${cita.servicios.map((s) => s.nombre).join(" + ")} · ${cita.negocio.nombre}`,
    lugar: cita.local.direccion,
    descripcion: `Con ${cita.profesional.nombre}. Ver, cambiar o cancelar: ${window.location.origin}/cita/${cita.token}`,
  });
  const url = URL.createObjectURL(
    new Blob([ics], { type: "text/calendar;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `cita-${cita.fecha}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Lo que el cliente puede hacer con su cita según el estado y la hora. */
export function AccionesCitaPublica({
  cita,
  hoy,
}: {
  cita: CitaPublica;
  hoy: string;
}) {
  const router = useRouter();
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pendiente, iniciar] = useTransicionRed();

  function confirmar() {
    iniciar(async () => {
      const r = await confirmarCita(cita.token);
      if (!r.ok) return void toast.error(r.error);
      toast.success("¡Gracias! Tu cita quedó confirmada");
      router.refresh();
    });
  }

  function cancelar() {
    iniciar(async () => {
      const r = await cancelarCita(cita.token, motivo);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Tu cita quedó cancelada");
      setCancelando(false);
      router.refresh();
    });
  }

  if (!cita.activa && !cita.local.direccion) return null;

  return (
    <section aria-label="Qué puedes hacer" className="space-y-3">
      {cita.puedeConfirmar ? (
        <div className="flex flex-col gap-3 rounded-lg border border-ac-info/30 bg-ac-info-fondo p-4 sm:flex-row sm:items-center">
          <p className="flex-1">
            <span className="font-semibold">¿Vas a venir?</span> Confírmalo y el
            negocio sabrá que te espera.
          </p>
          <Button onClick={confirmar} disabled={pendiente} className="shrink-0">
            {pendiente ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 aria-hidden="true" />
            )}
            Confirmar asistencia
          </Button>
        </div>
      ) : null}
      <div className="grid gap-2 sm:flex sm:flex-wrap">
        {cita.puedeCambiar ? <CambiarCita cita={cita} hoy={hoy} /> : null}
        {cita.activa ? (
          <Button variant="outline" onClick={() => bajarCalendario(cita)}>
            <CalendarPlus aria-hidden="true" />
            Agregar a mi calendario
          </Button>
        ) : null}
        {cita.local.direccion ? (
          <Button variant="outline" asChild>
            <a
              href={enlaceMapa(cita.local.direccion)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Navigation aria-hidden="true" />
              Cómo llegar
            </a>
          </Button>
        ) : null}
        {cita.puedeCancelar ? (
          <Button
            variant="ghost"
            className="text-ac-error hover:bg-ac-error-fondo hover:text-ac-error"
            onClick={() => setCancelando(true)}
          >
            <XCircle aria-hidden="true" />
            Cancelar cita
          </Button>
        ) : null}
      </div>
      {cita.activa ? <PoliticaNegocio reglas={cita.reglas} /> : null}

      <Dialog
        open={cancelando}
        onOpenChange={(v) => !pendiente && setCancelando(v)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Cancelar tu cita?</DialogTitle>
            <DialogDescription>
              La del {fechaLarga(cita.fecha).toLowerCase()} a las {cita.inicio}{" "}
              con {cita.profesional.nombre}. La hora queda libre para otra
              persona.
            </DialogDescription>
          </DialogHeader>
          <Campo
            id="cancelar-motivo"
            etiqueta="¿Por qué cancelas?"
            ayuda="Opcional; lo ve el negocio"
          >
            <Textarea
              id="cancelar-motivo"
              rows={2}
              maxLength={150}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={pendiente}
            />
          </Campo>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCancelando(false)}
              disabled={pendiente}
            >
              Volver
            </Button>
            <Button
              variant="destructive"
              onClick={cancelar}
              disabled={pendiente}
            >
              {pendiente ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : null}
              Sí, cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
