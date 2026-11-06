"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Campo } from "@/shared/components/campo";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import { guardarServicio } from "../actions";
import { esquemaServicio, type DatosServicio } from "../schemas";
import type { Catalogo } from "../services/catalogo";
import { CamposTipo, NOMBRE_TIPO } from "./campos-tipo";
import { ImagenesServicio } from "./imagenes-servicio";

type Errores = Partial<Record<keyof DatosServicio, string>>;

const CREADO = {
  servicio: "Servicio creado",
  sesiones: "Servicio creado",
  clase: "Clase creada",
  paquete: "Paquete creado",
} as const;

interface Props {
  catalogo: Catalogo;
  negocioId: string;
  inicial: DatosServicio;
  onCerrar: () => void;
}

function Bloque({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-ac-borde p-4">
      <h3 className="mb-3 font-semibold">{titulo}</h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** Formulario de servicio en tres bloques: datos básicos, mi sitio web y opciones avanzadas. */
export function FormularioServicio({
  catalogo,
  negocioId,
  inicial,
  onCerrar,
}: Props) {
  const [d, setD] = useState<DatosServicio>(inicial);
  const [errores, setErrores] = useState<Errores>({});
  const [guardando, iniciar] = useTransicionRed();
  const cambiar = (c: Partial<DatosServicio>) => setD((x) => ({ ...x, ...c }));
  const activos = catalogo.profesionales.filter((p) => p.activo);
  const todos = activos.every((p) => d.profesionales.includes(p.id));
  const tipo = d.tipo ?? "servicio";
  const textos = NOMBRE_TIPO[tipo];

  /** Un paquete dura lo que suman sus servicios (no se agenda entero, pero la base pide una duración). */
  function duracionPaquete() {
    const total = catalogo.servicios
      .filter((s) => d.incluye?.includes(s.id))
      .reduce((t, s) => t + s.duracionMin, 0);
    return Math.min(Math.max(total, 5), 720);
  }

  function guardar() {
    const p = esquemaServicio.safeParse(
      tipo === "paquete" ? { ...d, duracionMin: duracionPaquete() } : d,
    );
    if (!p.success) {
      const e: Errores = {};
      for (const i of p.error.issues)
        e[i.path[0] as keyof DatosServicio] ??= i.message;
      setErrores(e);
      document.getElementById(String(p.error.issues[0]?.path[0]))?.focus();
      return;
    }
    setErrores({});
    iniciar(async () => {
      const r = await guardarServicio(p.data);
      if (r.ok) {
        toast.success(d.id ? "Cambios guardados" : CREADO[tipo]);
        onCerrar();
      } else toast.error(r.error, { duration: Infinity });
    });
  }

  const numero = (v: string) => (v === "" ? Number.NaN : Number(v));

  return (
    <Dialog open onOpenChange={(v) => !v && !guardando && onCerrar()}>
      <DialogContent className="h-dvh max-h-dvh max-w-full rounded-none sm:rounded-none overflow-y-auto md:h-auto md:max-h-[92dvh] md:max-w-2xl md:rounded-lg">
        <DialogHeader>
          <DialogTitle>{d.id ? textos.editar : textos.nuevo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Bloque titulo="Datos básicos">
            <Campo
              id="nombre"
              etiqueta="Nombre"
              obligatorio
              error={errores.nombre}
              className="sm:col-span-2"
            >
              <Input
                id="nombre"
                value={d.nombre}
                onChange={(e) => cambiar({ nombre: e.target.value })}
              />
            </Campo>
            <Campo
              id="categoriaId"
              etiqueta="Categoría"
              obligatorio
              error={errores.categoriaId}
            >
              <select
                id="categoriaId"
                value={d.categoriaId}
                onChange={(e) => cambiar({ categoriaId: e.target.value })}
                className="h-11 w-full rounded-md border border-ac-borde bg-ac-papel px-3 md:h-9"
              >
                <option value="">Elige una categoría</option>
                {catalogo.categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo
              id="precio"
              etiqueta="Precio (COP)"
              obligatorio
              error={errores.precio}
            >
              <Input
                id="precio"
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                value={Number.isNaN(d.precio) ? "" : d.precio}
                onChange={(e) => cambiar({ precio: numero(e.target.value) })}
                className="cifras"
              />
            </Campo>
            {tipo === "paquete" ? null : (
              <Campo
                id="duracionMin"
                etiqueta={
                  tipo === "sesiones"
                    ? "Duración de cada sesión (minutos)"
                    : "Duración (minutos)"
                }
                obligatorio
                error={errores.duracionMin}
              >
                <Input
                  id="duracionMin"
                  type="number"
                  inputMode="numeric"
                  min={5}
                  max={720}
                  step={5}
                  value={Number.isNaN(d.duracionMin) ? "" : d.duracionMin}
                  onChange={(e) =>
                    cambiar({ duracionMin: numero(e.target.value) })
                  }
                  className="cifras"
                />
              </Campo>
            )}
            <Campo
              id="descripcion"
              etiqueta="Descripción"
              error={errores.descripcion}
              className="sm:col-span-2"
            >
              <Textarea
                id="descripcion"
                rows={3}
                value={d.descripcion}
                onChange={(e) => cambiar({ descripcion: e.target.value })}
              />
            </Campo>
          </Bloque>

          <CamposTipo
            d={d}
            errores={errores}
            servicios={catalogo.servicios}
            cambiar={cambiar}
          />

          {tipo === "clase" || tipo === "paquete" ? null : (
            <Bloque titulo="Mi sitio web">
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <Switch
                  checked={d.enLinea}
                  onCheckedChange={(v) => cambiar({ enLinea: v })}
                />{" "}
                Se puede reservar en línea
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={d.mostrarPrecio}
                  onCheckedChange={(v) => cambiar({ mostrarPrecio: v })}
                />{" "}
                Mostrar el precio
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={d.mostrarDuracion}
                  onCheckedChange={(v) => cambiar({ mostrarDuracion: v })}
                />{" "}
                Mostrar la duración
              </label>
              <div className="sm:col-span-2">
                <p className="mb-1.5 text-sm font-medium">Imágenes</p>
                <ImagenesServicio
                  negocioId={negocioId}
                  valor={d.imagenes}
                  onChange={(imagenes) => {
                    cambiar({ imagenes });
                    setErrores((e) => ({ ...e, imagenes: undefined }));
                  }}
                  errorFormulario={errores.imagenes}
                />
              </div>
            </Bloque>
          )}

          <Bloque titulo="Opciones avanzadas">
            {tipo === "paquete" ? null : (
              <div className="sm:col-span-2">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Profesionales que lo hacen
                  </p>
                  <label className="flex items-center gap-2 text-sm text-ac-pizarra">
                    <Checkbox
                      checked={todos}
                      onCheckedChange={(v) =>
                        cambiar({
                          profesionales:
                            v === true ? activos.map((p) => p.id) : [],
                        })
                      }
                    />
                    Todos
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {activos.map((p) => (
                    <label
                      key={p.id}
                      className="flex min-h-11 items-center gap-2 rounded-md border border-ac-borde px-3 py-2 text-sm md:min-h-0"
                    >
                      <Checkbox
                        checked={d.profesionales.includes(p.id)}
                        onCheckedChange={(v) =>
                          cambiar({
                            profesionales:
                              v === true
                                ? [...d.profesionales, p.id]
                                : d.profesionales.filter((x) => x !== p.id),
                          })
                        }
                      />
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: p.color ?? undefined }}
                        aria-hidden="true"
                      />
                      {p.nombre}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Switch
                checked={d.activo}
                onCheckedChange={(v) => cambiar({ activo: v })}
              />{" "}
              Activo
            </label>
          </Bloque>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {d.id ? "Guardar cambios" : textos.crear}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
