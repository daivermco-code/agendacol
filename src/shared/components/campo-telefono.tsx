"use client";

import { Input } from "@/shared/ui/input";

/** Indicativos más usados (Colombia primero). */
export const PAISES = [
  { codigo: "+57", nombre: "Colombia", sigla: "CO" },
  { codigo: "+593", nombre: "Ecuador", sigla: "EC" },
  { codigo: "+58", nombre: "Venezuela", sigla: "VE" },
  { codigo: "+51", nombre: "Perú", sigla: "PE" },
  { codigo: "+507", nombre: "Panamá", sigla: "PA" },
  { codigo: "+52", nombre: "México", sigla: "MX" },
  { codigo: "+56", nombre: "Chile", sigla: "CL" },
  { codigo: "+54", nombre: "Argentina", sigla: "AR" },
  { codigo: "+34", nombre: "España", sigla: "ES" },
  { codigo: "+1", nombre: "Estados Unidos", sigla: "US" },
] as const;

/** "+573001234567" → { pais: "+57", numero: "3001234567" } (Colombia si no reconoce el indicativo). */
export function partirTelefono(valor: string): {
  pais: string;
  numero: string;
} {
  const limpio = valor.replace(/[\s().-]/g, "");
  const pais = [...PAISES]
    .sort((a, b) => b.codigo.length - a.codigo.length)
    .find((p) => limpio.startsWith(p.codigo));
  if (pais)
    return { pais: pais.codigo, numero: limpio.slice(pais.codigo.length) };
  return { pais: "+57", numero: limpio.replace(/^\+/, "") };
}

/**
 * Teléfono con selector de país e indicativo (+57 por defecto) y el número aparte. Entrega el valor junto
 * ("+573001234567"); el esquema lo valida.
 */
export function CampoTelefono({
  id,
  valor,
  onCambio,
  invalido,
}: {
  id: string;
  valor: string;
  onCambio: (v: string) => void;
  invalido?: boolean;
}) {
  const { pais, numero } = partirTelefono(valor);
  return (
    <div className="flex gap-2">
      <select
        aria-label="Indicativo del país"
        value={pais}
        onChange={(e) => onCambio(numero ? `${e.target.value}${numero}` : "")}
        className="h-11 w-[92px] md:h-9 shrink-0 rounded-md border border-input bg-ac-papel px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {PAISES.map((p) => (
          <option key={p.codigo} value={p.codigo}>
            {p.sigla} {p.codigo}
          </option>
        ))}
      </select>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="off"
        placeholder={pais === "+57" ? "300 123 4567" : "Número"}
        aria-invalid={invalido || undefined}
        aria-describedby={invalido ? `${id}-error` : undefined}
        value={numero}
        onChange={(e) => {
          const n = e.target.value.replace(/[^\d ]/g, "");
          onCambio(n.trim() ? `${pais}${n.replace(/\s/g, "")}` : "");
        }}
      />
    </div>
  );
}
