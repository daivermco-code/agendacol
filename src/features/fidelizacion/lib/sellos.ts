/** Programa de la tarjeta de sellos (vive en ajustes). */
export interface ProgramaSellos {
  activo: boolean;
  meta: number;
  premio: string;
}

export interface CuentaSellos {
  /** Premios ganados: una tarjeta llena por cada `meta` sellos. */
  ganados: number;
  porEntregar: number;
  /** Sellos de la tarjeta en curso (0..meta-1). */
  enTarjeta: number;
}

/** Con 19 sellos, meta 8 y 1 canje: 2 ganados, 1 por entregar y 3 sellos en la tarjeta nueva. */
export function contarSellos(
  sellos: number,
  canjes: number,
  meta: number,
): CuentaSellos {
  const ganados = Math.floor(sellos / meta);
  return {
    ganados,
    porEntregar: Math.max(ganados - canjes, 0),
    enTarjeta: sellos % meta,
  };
}

/** Sellos a pintar: la tarjeta recién llena (premio sin entregar y la nueva vacía) se muestra llena, no en 0. */
export function sellosVisibles(c: CuentaSellos, meta: number): number {
  return c.enTarjeta === 0 && c.porEntregar > 0 ? meta : c.enTarjeta;
}
