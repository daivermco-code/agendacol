"use client";

import { Campo } from "@/shared/components/campo";
import { duracion, pesos } from "@/shared/lib/formato";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import type { DatosServicio, TipoServicio } from "../schemas";
import type { ServicioVista } from "../services/catalogo";

type Errores = Partial<Record<keyof DatosServicio, string>>;

export const NOMBRE_TIPO: Record<
  TipoServicio,
  { nuevo: string; editar: string; crear: string }
> = {
  servicio: {
    nuevo: "Nuevo servicio",
    editar: "Editar servicio",
    crear: "Crear servicio",
  },
  sesiones: {
    nuevo: "Nuevo servicio con sesiones",
    editar: "Editar servicio con sesiones",
    crear: "Crear servicio",
  },
  clase: { nuevo: "Nueva clase", editar: "Editar clase", crear: "Crear clase" },
  paquete: {
    nuevo: "Nuevo paquete",
    editar: "Editar paquete",
    crear: "Crear paquete",
  },
};

const numero = (v: string) => (v === "" ? null : Number(v));

/** Lo propio de cada tipo: sesiones y vigencia, cupo de la clase o servicios del paquete. */
export function CamposTipo({
  d,
  errores,
  servicios,
  cambiar,
}: {
  d: DatosServicio;
  errores: Errores;
  servicios: ServicioVista[];
  cambiar: (c: Partial<DatosServicio>) => void;
}) {
  const tipo = d.tipo ?? "servicio";
  if (tipo === "servicio") return null;
  const vigencia = (
    <Campo
      id="vigenciaDias"
      etiqueta="Vale por (días)"
      ayuda="Desde que se vende"
      error={errores.vigenciaDias}
    >
      <Input
        id="vigenciaDias"
        type="number"
        inputMode="numeric"
        min={30}
        max={730}
        value={d.vigenciaDias ?? ""}
        onChange={(e) => cambiar({ vigenciaDias: numero(e.target.value) })}
        className="cifras"
      />
    </Campo>
  );
  if (tipo === "sesiones")
    return (
      <section className="rounded-lg border border-ac-borde p-4">
        <h3 className="font-semibold">Sesiones</h3>
        <p className="mb-3 text-sm text-ac-pizarra">
          El precio es el de todas las sesiones. Se vende en la caja (o al
          cobrar la primera cita) y cada cita gasta una.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            id="sesiones"
            etiqueta="Número de sesiones"
            obligatorio
            error={errores.sesiones}
          >
            <Input
              id="sesiones"
              type="number"
              inputMode="numeric"
              min={2}
              max={50}
              value={d.sesiones ?? ""}
              onChange={(e) => cambiar({ sesiones: numero(e.target.value) })}
              className="cifras"
            />
          </Campo>
          {vigencia}
        </div>
      </section>
    );
  if (tipo === "clase")
    return (
      <section className="rounded-lg border border-ac-borde p-4">
        <h3 className="font-semibold">Clase</h3>
        <p className="mb-3 text-sm text-ac-pizarra">
          Se agenda desde la agenda («Nuevo» → «Clase») y varios clientes se
          inscriben hasta llenar el cupo.
        </p>
        <Campo
          id="cupo"
          etiqueta="Cupo de cada clase"
          obligatorio
          error={errores.cupo}
          className="sm:max-w-[240px]"
        >
          <Input
            id="cupo"
            type="number"
            inputMode="numeric"
            min={2}
            max={100}
            value={d.cupo ?? ""}
            onChange={(e) => cambiar({ cupo: numero(e.target.value) })}
            className="cifras"
          />
        </Campo>
      </section>
    );
  const incluye = d.incluye ?? [];
  const elegibles = servicios.filter((s) => s.tipo === "servicio" && s.activo);
  const suma = elegibles
    .filter((s) => incluye.includes(s.id))
    .reduce((t, s) => t + s.precio, 0);
  return (
    <section className="rounded-lg border border-ac-borde p-4">
      <h3 className="font-semibold">Paquete</h3>
      <p className="mb-3 text-sm text-ac-pizarra">
        Varios servicios a un precio. Se vende en la caja y cada servicio se
        agenda aparte con «Usar plan».
      </p>
      <fieldset id="incluye" tabIndex={-1} className="mb-4">
        <legend className="mb-1.5 text-sm font-medium">
          Servicios que incluye (2 a 6)
        </legend>
        <ul className="grid max-h-56 gap-1.5 overflow-y-auto rounded-md border border-ac-borde p-2 sm:grid-cols-2">
          {elegibles.map((s) => (
            <li key={s.id}>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={incluye.includes(s.id)}
                  disabled={!incluye.includes(s.id) && incluye.length >= 6}
                  onCheckedChange={(v) =>
                    cambiar({
                      incluye:
                        v === true
                          ? [...incluye, s.id]
                          : incluye.filter((x) => x !== s.id),
                    })
                  }
                />
                <span className="min-w-0 flex-1 truncate">{s.nombre}</span>
                <span className="cifras text-xs text-ac-pizarra">
                  {pesos(s.precio)}
                </span>
              </label>
            </li>
          ))}
        </ul>
        {errores.incluye ? (
          <p role="alert" className="mt-1 text-sm text-ac-error">
            {errores.incluye}
          </p>
        ) : (
          <p className="cifras mt-1 text-xs text-ac-pizarra">
            {incluye.length} elegidos · por separado suman {pesos(suma)} ·{" "}
            {duracion(
              elegibles
                .filter((s) => incluye.includes(s.id))
                .reduce((t, s) => t + s.duracionMin, 0),
            )}
          </p>
        )}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">{vigencia}</div>
    </section>
  );
}
