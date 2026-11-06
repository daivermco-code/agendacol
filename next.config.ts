import type { NextConfig } from "next";
import { esHostLocal } from "./src/shared/lib/host-local";
import { RUTA_PUBLICA } from "./src/shared/lib/storage";

// Cabeceras de seguridad en todas las respuestas (auditoría del 1-nov-2026). La Content-Security-Policy la pone
// `src/proxy.ts`, porque lleva un nonce distinto en cada pedido.
const CABECERAS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // El enlace personal del cliente (/cita/<token>) no sale en la dirección de origen hacia otros sitios.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl)
  throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL en .env.local");
const supabase = new URL(supabaseUrl);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Fotos del Storage de Supabase. Con Supabase en esta máquina (la demo local) van directo al Storage, sin
  // optimizar: Next 16 no optimiza imágenes de IP locales. Con el Storage en un dominio pasan por `/_next/image`
  // (tamaño justo y WebP) sin tocar las pantallas. Las dos cosas quedan dentro del build: al cambiar la URL de
  // Supabase, volver a compilar.
  images: {
    unoptimized: esHostLocal(supabase.hostname),
    remotePatterns: [new URL(`${supabase.origin}${RUTA_PUBLICA}**`)],
  },
  // Activa el MCP server en /_next/mcp (Next.js 16+)
  experimental: {
    mcpServer: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: CABECERAS }];
  },
};

export default nextConfig;
