import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Iniciales para los círculos de usuario, cliente y profesional. */
export function iniciales(nombre: string, apellido?: string | null): string {
  const partes = [nombre, apellido ?? ""]
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (partes.length === 0) return "?";
  const primera = partes[0][0] ?? "";
  const ultima = partes.length > 1 ? (partes[partes.length - 1][0] ?? "") : "";
  return (primera + ultima).toUpperCase();
}
