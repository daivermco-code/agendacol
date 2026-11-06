"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { nuevoId } from "@/shared/lib/id";
import { crearClienteNavegador } from "@/shared/lib/supabase/client";

const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 3 * 1024 * 1024;
const MIN_LADO = 200;

/** Revisa tipo, peso y tamaño mínimo. Devuelve el mensaje del problema o null. */
async function validarImagen(archivo: File): Promise<string | null> {
  if (!TIPOS.includes(archivo.type))
    return "Solo se aceptan imágenes JPG, PNG o WebP";
  if (archivo.size > MAX_BYTES) return "La imagen pesa más de 3 MB";
  try {
    const bitmap = await createImageBitmap(archivo);
    const chica = bitmap.width < MIN_LADO || bitmap.height < MIN_LADO;
    bitmap.close();
    if (chica) return "La imagen debe medir al menos 200 × 200 píxeles";
  } catch {
    return "No se pudo leer la imagen";
  }
  return null;
}

interface Props {
  negocioId: string;
  valor: string[];
  onChange: (urls: string[]) => void;
  /** Error del formulario al guardar (p. ej. una imagen que no está en el Storage de este negocio). */
  errorFormulario?: string;
}

export function ImagenesServicio({
  negocioId,
  valor,
  onChange,
  errorFormulario,
}: Props) {
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function alElegir(archivos: FileList | null) {
    const archivo = archivos?.[0];
    if (!archivo) return;
    setError(null);
    const problema = await validarImagen(archivo);
    if (problema) return setError(problema);

    setSubiendo(true);
    const supabase = crearClienteNavegador();
    const extension = archivo.type.split("/")[1];
    const ruta = `${negocioId}/${nuevoId()}.${extension}`;
    const { error: e } = await supabase.storage
      .from("servicios")
      .upload(ruta, archivo, { contentType: archivo.type });
    setSubiendo(false);
    if (e) return setError("No se pudo subir la imagen");
    onChange([
      ...valor,
      supabase.storage.from("servicios").getPublicUrl(ruta).data.publicUrl,
    ]);
  }

  const aviso = error ?? errorFormulario;

  return (
    <div>
      {/* El formulario lleva el foco aquí si una imagen no pasa al guardar. */}
      <div
        id="imagenes"
        tabIndex={-1}
        className="flex flex-wrap gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ac-laguna"
      >
        {valor.map((url) => (
          <div
            key={url}
            className="relative h-20 w-20 overflow-hidden rounded-md border border-ac-borde"
          >
            <Image
              src={url}
              alt=""
              width={80}
              height={80}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => onChange(valor.filter((u) => u !== url))}
              className="absolute right-1 top-1 rounded-full bg-ac-tinta/70 p-0.5 text-ac-papel after:absolute after:-bottom-[22px] after:-left-[22px] after:-right-1 after:-top-1 after:content-[''] hover:bg-ac-tinta md:after:content-none"
              aria-label="Quitar imagen"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
        {valor.length < 3 ? (
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            disabled={subiendo}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-ac-borde-fuerte text-xs text-ac-pizarra hover:bg-ac-niebla"
          >
            {subiendo ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <ImagePlus className="h-5 w-5" aria-hidden="true" />
            )}
            {subiendo ? "Subiendo" : "Agregar"}
          </button>
        ) : null}
      </div>
      <input
        ref={entrada}
        type="file"
        accept={TIPOS.join(",")}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          void alElegir(e.target.files);
          e.target.value = "";
        }}
      />
      <p
        role={aviso ? "alert" : undefined}
        className={
          aviso
            ? "mt-1.5 text-xs text-ac-error"
            : "mt-1.5 text-xs text-ac-neblina"
        }
      >
        {aviso ??
          "Hasta 3 imágenes JPG, PNG o WebP, de al menos 200 × 200 px y hasta 3 MB."}
      </p>
    </div>
  );
}
