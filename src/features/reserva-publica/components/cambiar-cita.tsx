"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { buscarHorasCita, cambiarCita } from "../actions";
import { fechaLarga } from "../lib/fechas-publicas";
import type { CitaPublica, DiaLibre } from "../types";
import { SelectorHoras } from "./selector-horas";

/** "Cambiar fecha u hora": mismo profesional y misma duración; la agenda del negocio lo ve al instante. */
export function CambiarCita({ cita, hoy }: { cita: CitaPublica; hoy: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [desde, setDesde] = useState(hoy);
  const [dias, setDias] = useState<DiaLibre[]>([]);
  const [fecha, setFecha] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [cargando, iniciarCarga] = useTransicionRed();
  const [guardando, iniciarGuardado] = useTransicionRed();

  function cargar(nuevoDesde: string) {
    iniciarCarga(async () => {
      const r = await buscarHorasCita(cita.token, nuevoDesde);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setDesde(nuevoDesde);
      setDias(r.datos);
      setFecha((f) =>
        f && r.datos.some((d) => d.fecha === f)
          ? f
          : (r.datos.find((d) => d.horas.length)?.fecha ?? null),
      );
      setHora(null);
    });
  }

  function abrir() {
    setAbierto(true);
    setFecha(null);
    setHora(null);
    cargar(hoy);
  }

  function guardar() {
    if (!fecha || !hora) return;
    iniciarGuardado(async () => {
      const r = await cambiarCita(cita.token, fecha, hora);
      if (!r.ok) {
        toast.error(r.error);
        if (r.code === "OCUPADA") cargar(desde);
        return;
      }
      toast.success(
        `Listo: tu cita quedó para el ${fechaLarga(fecha).toLowerCase()} a las ${hora}`,
      );
      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" onClick={abrir}>
        <CalendarClock aria-hidden="true" />
        Cambiar fecha u hora
      </Button>
      <Dialog open={abierto} onOpenChange={(v) => !guardando && setAbierto(v)}>
        <DialogContent className="h-dvh max-h-dvh max-w-full rounded-none sm:rounded-none overflow-y-auto md:h-auto md:max-h-[92dvh] md:max-w-lg md:rounded-lg">
          <DialogHeader>
            <DialogTitle>Cambiar fecha u hora</DialogTitle>
            <DialogDescription>
              Ahora es el {fechaLarga(cita.fecha).toLowerCase()} a las{" "}
              {cita.inicio}. Sigue con {cita.profesional.nombre} y dura lo
              mismo.
            </DialogDescription>
          </DialogHeader>
          <SelectorHoras
            dias={dias}
            desde={desde}
            hoy={hoy}
            fecha={fecha}
            hora={hora}
            cargando={cargando}
            diasMax={cita.reglas.diasMax}
            onMover={cargar}
            onFecha={(f) => {
              setFecha(f);
              setHora(null);
            }}
            onHora={setHora}
          />
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setAbierto(false)}
              disabled={guardando}
            >
              Volver
            </Button>
            <Button
              onClick={guardar}
              disabled={!fecha || !hora || guardando || cargando}
            >
              {guardando ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : null}
              {fecha && hora ? `Cambiar a las ${hora}` : "Elige una hora"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
