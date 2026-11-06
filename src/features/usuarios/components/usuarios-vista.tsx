"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Campo } from "@/shared/components/campo";
import { useConfirmar } from "@/shared/components/confirmar";
import { NOMBRE_ROL, type Rol } from "@/shared/lib/permisos";
import { iniciales } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { invitarUsuario, quitarUsuario } from "../actions";
import { esquemaInvitar, type DatosInvitar } from "../schemas";

export interface FilaUsuario {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol;
  profesional: string | null;
  soyYo: boolean;
}

const SELECT =
  "h-11 w-full rounded-md border border-ac-borde bg-ac-papel px-3 md:h-9";

function ModalInvitar({
  profesionales,
  onCerrar,
}: {
  profesionales: { id: string; nombre: string }[];
  onCerrar: () => void;
}) {
  const [d, setD] = useState<DatosInvitar>({
    nombre: "",
    correo: "",
    rol: "recepcion",
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransicionRed();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const p = esquemaInvitar.safeParse(d);
    if (!p.success)
      return setError(p.error.issues[0]?.message ?? "Revisa los datos");
    setError(null);
    iniciar(async () => {
      const r = await invitarUsuario(p.data);
      if (r.ok) {
        toast.success(
          "Usuario creado. La invitación quedó en el buzón de la demo.",
        );
        onCerrar();
      } else setError(r.error);
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !guardando && onCerrar()}>
      <DialogContent className="max-w-md">
        <form onSubmit={enviar} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Invitar usuario</DialogTitle>
          </DialogHeader>
          <Campo id="nombre" etiqueta="Nombre" obligatorio>
            <Input
              id="nombre"
              value={d.nombre}
              onChange={(e) => setD({ ...d, nombre: e.target.value })}
              autoFocus
            />
          </Campo>
          <Campo
            id="correo"
            etiqueta="Correo"
            obligatorio
            ayuda="Inventado y terminado en .test (por ejemplo, ana@salonceiba.test)."
          >
            <Input
              id="correo"
              type="email"
              value={d.correo}
              onChange={(e) => setD({ ...d, correo: e.target.value })}
            />
          </Campo>
          <Campo id="rol" etiqueta="Rol" obligatorio>
            <select
              id="rol"
              value={d.rol}
              onChange={(e) => setD({ ...d, rol: e.target.value as Rol })}
              className={SELECT}
            >
              <option value="recepcion">Recepción</option>
              <option value="profesional">Profesional</option>
              <option value="dueno">Dueño</option>
            </select>
          </Campo>
          {d.rol === "profesional" ? (
            <Campo id="profesional" etiqueta="Profesional" obligatorio>
              <select
                id="profesional"
                value={d.profesionalId ?? ""}
                onChange={(e) =>
                  setD({ ...d, profesionalId: e.target.value || undefined })
                }
                className={SELECT}
              >
                <option value="">Elige un profesional</option>
                {profesionales.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          ) : null}
          {error ? <p className="text-sm text-ac-error">{error}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onCerrar}
              disabled={guardando}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              Invitar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UsuariosVista({
  usuarios,
  profesionales,
}: {
  usuarios: FilaUsuario[];
  profesionales: { id: string; nombre: string }[];
}) {
  const [invitando, setInvitando] = useState(false);
  const [dialogo, confirmar] = useConfirmar();
  const [, iniciar] = useTransicionRed();

  async function quitar(u: FilaUsuario) {
    if (
      !(await confirmar({
        titulo: `¿Quitar el acceso de ${u.nombre}?`,
        texto: "Ya no podrá entrar a la demo.",
        aceptar: "Quitar acceso",
        peligro: true,
      }))
    )
      return;
    iniciar(async () => {
      const r = await quitarUsuario(u.id);
      if (r.ok) toast.success("Acceso quitado");
      else toast.error(r.error, { duration: Infinity });
    });
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setInvitando(true)}>
          <UserPlus className="h-4 w-4" aria-hidden="true" /> Invitar usuario
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-ac-borde bg-ac-papel shadow-quieta">
        <table className="w-full text-left">
          <thead className="bg-ac-niebla text-[13px] text-ac-pizarra">
            <tr>
              <th className="px-4 py-2.5 font-medium">Nombre</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">
                Correo
              </th>
              <th className="px-4 py-2.5 font-medium">Rol</th>
              <th className="w-12 px-4 py-2.5">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-t border-ac-borde">
                <td className="px-4 py-3">
                  <span className="flex items-center gap-3">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ac-laguna-claro text-xs font-bold text-ac-laguna-hondo">
                      {iniciales(u.nombre)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {u.nombre}{" "}
                        {u.soyYo ? (
                          <span className="text-ac-neblina">(tú)</span>
                        ) : null}
                      </span>
                      <span className="block truncate text-[13px] text-ac-pizarra md:hidden">
                        {u.correo}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-ac-pizarra md:table-cell">
                  {u.correo}
                </td>
                <td className="px-4 py-3">
                  {NOMBRE_ROL[u.rol]}
                  {u.profesional ? (
                    <span className="block text-[13px] text-ac-pizarra">
                      {u.profesional}
                    </span>
                  ) : null}
                </td>
                <td className="px-2 py-3 text-right">
                  {!u.soyYo ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => quitar(u)}
                      aria-label={`Quitar a ${u.nombre}`}
                    >
                      <Trash2
                        className="h-4 w-4 text-ac-error"
                        aria-hidden="true"
                      />
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {invitando ? (
        <ModalInvitar
          profesionales={profesionales}
          onCerrar={() => setInvitando(false)}
        />
      ) : null}
      {dialogo}
    </>
  );
}
