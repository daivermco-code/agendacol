/** Un nonce nuevo para cada pedido: sin él, ningún script en línea corre. */
export function nuevoNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

/**
 * Content-Security-Policy de cada página. Los scripts solo corren con el nonce del pedido (Next lo pone solo en los
 * suyos) y lo que esos carguen ('strict-dynamic'). Los estilos van con 'unsafe-inline': la agenda, los gráficos y
 * las insignias usan `style` en el HTML del servidor, que no lleva nonce. Supabase (datos, fotos y tiempo real) es
 * el único otro origen.
 */
export function politicaDeContenido(
  nonce: string,
  supabaseUrl: string,
  desarrollo: boolean,
): string {
  const supabase = new URL(supabaseUrl);
  const tiempoReal = `${supabase.protocol === "https:" ? "wss:" : "ws:"}//${supabase.host}`;
  const directivas = [
    "default-src 'self'",
    // En desarrollo React usa eval para reconstruir los errores del servidor.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${desarrollo ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${supabase.origin}`,
    "font-src 'self'",
    `connect-src 'self' ${supabase.origin} ${tiempoReal}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  // Con Supabase en http (la demo local) subir los pedidos a https los rompería.
  if (supabase.protocol === "https:") directivas.push("upgrade-insecure-requests");
  return directivas.join("; ");
}
