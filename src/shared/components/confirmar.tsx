"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

interface Opciones {
  titulo: string;
  texto?: string;
  aceptar?: string;
  peligro?: boolean;
}

/**
 * Confirmación propia (en vez de window.confirm):
 * `const [dialogo, confirmar] = useConfirmar(); if (await confirmar({ titulo })) …` y renderizar `{dialogo}`.
 */
export function useConfirmar(): [ReactNode, (o: Opciones) => Promise<boolean>] {
  const [opciones, setOpciones] = useState<Opciones | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirmar = useCallback((o: Opciones) => {
    setOpciones(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function cerrar(valor: boolean) {
    resolver.current?.(valor);
    resolver.current = null;
    setOpciones(null);
  }

  const dialogo = (
    <Dialog open={opciones !== null} onOpenChange={(v) => !v && cerrar(false)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{opciones?.titulo}</DialogTitle>
          {opciones?.texto ? (
            <DialogDescription>{opciones.texto}</DialogDescription>
          ) : null}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => cerrar(false)}>
            Cancelar
          </Button>
          <Button
            variant={opciones?.peligro ? "destructive" : "default"}
            onClick={() => cerrar(true)}
          >
            {opciones?.aceptar ?? "Aceptar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return [dialogo, confirmar];
}
