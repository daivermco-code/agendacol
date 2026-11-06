"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Campo } from "@/shared/components/campo";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { guardarCategoria } from "../actions";
import { esquemaCategoria } from "../schemas";

export function ModalCategoria({
  inicial,
  onCerrar,
}: {
  inicial: { id?: string; nombre: string };
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(inicial.nombre);
  const [error, setError] = useState<string | undefined>();
  const [guardando, iniciar] = useTransicionRed();

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    const p = esquemaCategoria.safeParse({ id: inicial.id, nombre });
    if (!p.success) return setError(p.error.issues[0]?.message);
    iniciar(async () => {
      const r = await guardarCategoria(p.data);
      if (r.ok) {
        toast.success(inicial.id ? "Categoría renombrada" : "Categoría creada");
        onCerrar();
      } else setError(r.error);
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !guardando && onCerrar()}>
      <DialogContent className="max-w-md">
        <form onSubmit={guardar} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {inicial.id ? "Renombrar categoría" : "Nueva categoría"}
            </DialogTitle>
          </DialogHeader>
          <Campo id="categoria" etiqueta="Nombre" obligatorio error={error}>
            <Input
              id="categoria"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
            />
          </Campo>
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
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
