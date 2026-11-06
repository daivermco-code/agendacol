"use client";

import { Toaster as Sonner } from "sonner";
import { useEsCelular } from "@/shared/hooks/use-es-celular";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/** Avisos abajo en celular y arriba a la derecha desde la tableta (UI-agedacol §4). Celular primero. Siguen el
 * modo claro u oscuro del sistema, como el resto de la app. */
const Toaster = ({ ...props }: ToasterProps) => {
  const celular = useEsCelular();

  return (
    <Sonner
      theme="system"
      position={celular ? "bottom-center" : "top-right"}
      offset={{ bottom: "calc(var(--alto-pestanas, 0px) + 24px)" }}
      mobileOffset={{ bottom: "calc(var(--alto-pestanas, 0px) + 16px)" }}
      duration={4000}
      richColors
      closeButton
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:font-sans group-[.toaster]:shadow-flota group-[.toaster]:rounded-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
