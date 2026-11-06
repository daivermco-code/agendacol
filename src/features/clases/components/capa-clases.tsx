"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePuede } from "@/features/auth/components/proveedor-miembro";
import { CLAVE_AGENDA } from "@/features/agenda/hooks/use-agenda";
import type {
  BaseAgenda,
  DatosAgenda,
  LocalAgenda,
} from "@/features/agenda/types";
import { Flotante } from "@/features/citas/components/ficha-cita";
import { useConfirmar } from "@/shared/components/confirmar";
import { cancelarClase } from "../actions";
import { claseDe } from "../lib/clases";
import { useClases } from "../store/clases";
import { FichaClase } from "./ficha-clase";
import { VentanaClase } from "./ventana-clase";

/** Lo que se abre sobre la agenda para las clases: la ficha con la lista, crear o editar, y cancelar. */
export function CapaClases({
  base,
  local,
  datos,
  esCelular,
}: {
  base: BaseAgenda;
  local: LocalAgenda | null;
  datos: DatosAgenda | undefined;
  esCelular: boolean;
}) {
  const puedo = usePuede();
  const qc = useQueryClient();
  const { ficha, formulario, cerrar, editar, cerrarFormulario } = useClases();
  const [dialogo, confirmar] = useConfirmar();
  const clase = ficha
    ? datos?.clases.find((k) => k.id === ficha.id)
    : undefined;
  const activos = base.profesionales.filter(
    (p) => p.activo && (!local || p.localId === local.id),
  );

  async function cancelar() {
    if (!clase) return;
    cerrar();
    const ok = await confirmar({
      titulo: `¿Cancelar la clase "${clase.servicioNombre}"?`,
      texto:
        clase.inscritos === 0
          ? "Se quita de la agenda."
          : clase.inscritos === 1
            ? "La persona inscrita sale de la lista y, si pagó con un plan, lo recupera."
            : `Las ${clase.inscritos} personas inscritas salen de la lista y, si pagaron con un plan, lo recuperan.`,
      aceptar: "Cancelar clase",
      peligro: true,
    });
    if (!ok) return;
    const r = await cancelarClase(clase.id, null);
    if (!r.ok) return void toast.error(r.error);
    toast.success("Clase cancelada");
    void qc.invalidateQueries({ queryKey: [CLAVE_AGENDA] });
  }

  return (
    <>
      {ficha && clase ? (
        <Flotante
          rect={ficha.rect}
          esCelular={esCelular}
          titulo={`Clase ${clase.servicioNombre}`}
          descripcion="Cupo e inscritos de la clase"
          onCerrar={cerrar}
        >
          <FichaClase
            clase={clase}
            profesional={base.profesionales.find(
              (p) => p.id === clase.profesionalId,
            )}
            puedeEditar={puedo("crear_cita")}
            onEditar={() => local && editar(claseDe(clase, local.id))}
            onCancelar={() => void cancelar()}
            onCerrar={cerrar}
          />
        </Flotante>
      ) : null}
      {formulario ? (
        <VentanaClase
          inicial={formulario}
          clases={base.clases}
          profesionales={activos}
          onCerrar={cerrarFormulario}
        />
      ) : null}
      {dialogo}
    </>
  );
}
