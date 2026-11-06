// Fotos del Storage de Supabase. Sin nada de servidor: lo usan `next.config.ts`, los esquemas y las pantallas.

/** Ruta pública de los buckets del Storage (`<origen>/storage/v1/object/public/<bucket>/<archivo>`). */
export const RUTA_PUBLICA = "/storage/v1/object/public/";

/**
 * La URL es una foto pública del bucket `bucket` en el Storage de `supabaseUrl`, sin parámetros (el patrón de
 * `images.remotePatterns` no acepta otro host ni un `?`).
 */
export function esFotoDelStorage(
  url: string,
  supabaseUrl: string | undefined,
  bucket: string,
): boolean {
  if (!supabaseUrl) return false;
  try {
    const foto = new URL(url);
    return (
      foto.origin === new URL(supabaseUrl).origin &&
      foto.pathname.startsWith(`${RUTA_PUBLICA}${bucket}/`) &&
      foto.search === "" &&
      foto.hash === ""
    );
  } catch {
    return false;
  }
}
