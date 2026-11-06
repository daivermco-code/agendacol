// Solo para `next.config.ts` (usa la regla interna de Next; no va en pantallas).
import { isPrivateIp } from "next/dist/server/is-private-ip";

/**
 * El host es esta máquina o una red privada. Next 16 no optimiza imágenes de ahí (`/_next/image` responde 400 sin
 * `images.dangerouslyAllowLocalIP`, que su documentación desaconseja). Usa la misma regla que Next para las IP
 * (todo lo que no sea "unicast" público, también CGNAT y las IPv4 dentro de IPv6). Un dominio que resuelva a una IP
 * privada no se ve aquí: ese caso también daría 400.
 */
export function esHostLocal(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" || host.endsWith(".localhost") || isPrivateIp(host)
  );
}
