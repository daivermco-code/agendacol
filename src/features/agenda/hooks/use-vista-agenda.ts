"use client";

import { useEffect, useMemo, useState } from "react";
import { useMiembro } from "@/features/auth/components/proveedor-miembro";
import { useEsCelular } from "@/shared/hooks/use-es-celular";
import { coincideBusqueda, coincideTexto } from "../lib/busqueda";
import { columnasDia, columnasRecursos, columnasSemana } from "../lib/columnas";
import { rangoDeVista, ZONA_LOCAL, type Vista } from "../lib/fechas";
import { escalaVisible } from "../lib/geometria";
import { abiertosDelDia } from "../lib/horario";
import { TODOS, useAgendaStore } from "../store/agenda";
import type { BaseAgenda } from "../types";
import { useAgenda, useEnVivo } from "./use-agenda";
import { useAhora } from "./use-ahora";

/** Todo lo que la pantalla de agenda calcula a partir de la base, los filtros y los datos del rango. */
export function useVistaAgenda(
  base: BaseAgenda,
  vistaInicial: Vista | null,
  fechaInicial: string | null = null,
  /** Texto de la búsqueda del celular: filtra las citas en el sitio. */
  busqueda = "",
) {
  const miembro = useMiembro();
  const guardadas = useAgendaStore();
  const esCelular = useEsCelular();
  // "3 días" es solo del celular: si quedó guardada y se abre desde la tableta, se ve la semana.
  const prefs = useMemo(
    () =>
      guardadas.vista === "3dias" && !esCelular
        ? { ...guardadas, vista: "semana" as Vista }
        : guardadas,
    [guardadas, esCelular],
  );
  const [listo, setListo] = useState(false);

  useEffect(() => {
    void Promise.resolve(useAgendaStore.persist.rehydrate()).then(() => {
      if (vistaInicial)
        useAgendaStore.getState().poner({ vista: vistaInicial });
      setListo(true);
    });
  }, [vistaInicial]);

  const fijo = miembro.rol === "profesional" ? miembro.profesionalId : null;
  // El profesional ve su local; los demás, el elegido (o el primero).
  const localId =
    base.profesionales.find((p) => p.id === fijo)?.localId ?? prefs.localId;
  const local =
    base.locales.find((l) => l.id === localId) ?? base.locales[0] ?? null;
  const recursos = useMemo(
    () => base.recursos.filter((r) => r.localId === local?.id),
    [base.recursos, local?.id],
  );
  const porRecursos =
    prefs.porRecursos && prefs.vista === "dia" && !fijo && recursos.length > 0;
  const ahora = useAhora(local?.zona ?? ZONA_LOCAL);
  const [ancla, setAncla] = useState(fechaInicial ?? ahora.fecha);
  const activos = useMemo(
    () => base.profesionales.filter((p) => p.activo && p.localId === local?.id),
    [base.profesionales, local?.id],
  );
  const elegido =
    fijo ??
    prefs.profesionalId ??
    (prefs.vista === "semana" || prefs.vista === "3dias"
      ? activos[0]?.id
      : TODOS);
  const profesional = activos.find((p) => p.id === elegido) ?? null;
  const bloque = prefs.bloqueMin ?? base.bloqueMin;
  const rango = rangoDeVista(prefs.vista, ancla);
  const consulta = useAgenda(local?.id ?? "", prefs.vista, ancla);
  const enVivo = useEnVivo(base.negocioId);

  const filtradas = useMemo(
    () =>
      (consulta.data?.citas ?? []).filter(
        (c) =>
          prefs.estados.includes(c.estado) &&
          (!profesional || c.profesionalId === profesional.id),
      ),
    [consulta.data, prefs.estados, profesional],
  );
  const delProfesional = useMemo(
    () =>
      (consulta.data?.clases ?? []).filter(
        (k) => !profesional || k.profesionalId === profesional.id,
      ),
    [consulta.data, profesional],
  );
  const citas = useMemo(
    () => filtradas.filter((c) => coincideBusqueda(c, busqueda)),
    [filtradas, busqueda],
  );
  const clases = useMemo(
    () =>
      delProfesional.filter((k) => coincideTexto(k.servicioNombre, busqueda)),
    [delProfesional, busqueda],
  );
  // La cuadrícula recibe todo (lo que no coincide sigue ocupando su hora) y este filtro de lo que se ve.
  const filtro = useMemo(
    () =>
      busqueda.trim()
        ? {
            citas: new Set(citas.map((c) => c.id)),
            clases: new Set(clases.map((k) => k.id)),
          }
        : null,
    [busqueda, citas, clases],
  );

  // La escala sale de todo lo filtrado sin la búsqueda: así las horas no saltan mientras se escribe.
  const escala = useMemo(() => {
    const horarios = [local?.horario ?? [], ...activos.map((p) => p.horario)];
    const tramos = horarios.flatMap((h) => h.flatMap((d) => abiertosDelDia(d)));
    return escalaVisible([...tramos, ...filtradas, ...delProfesional], bloque);
  }, [local, activos, filtradas, delProfesional, bloque]);

  const columnas = useMemo(() => {
    const bloqueos = consulta.data?.bloqueos ?? [];
    if (porRecursos && local)
      return columnasRecursos({
        fecha: ancla,
        local,
        recursos,
        citas: filtradas,
        escala,
      });
    if (prefs.vista === "dia") {
      const lista = profesional ? [profesional] : activos;
      return columnasDia({
        fecha: ancla,
        profesionales: lista,
        citas: filtradas,
        bloqueos,
        clases: delProfesional,
        escala,
      });
    }
    if (!local) return [];
    return columnasSemana({
      dias: rango.dias,
      local,
      profesional,
      profesionales: activos,
      citas: filtradas,
      bloqueos,
      clases: delProfesional,
      escala,
    });
    // rango.dias depende de vista y ancla
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    prefs.vista,
    ancla,
    consulta.data,
    filtradas,
    delProfesional,
    escala,
    profesional,
    activos,
    porRecursos,
    recursos,
    local,
  ]);

  return {
    listo,
    prefs,
    local,
    ahora,
    ancla,
    setAncla,
    activos,
    fijo,
    profesional,
    bloque,
    rango,
    consulta,
    enVivo,
    citas,
    clases,
    escala,
    columnas,
    filtro,
    recursos,
    porRecursos,
  };
}
