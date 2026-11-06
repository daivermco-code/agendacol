/** Algo que ocupa un tramo de tiempo en un día (minutos desde medianoche, fin exclusivo). */
export interface Tramo {
  id: string;
  inicio: number;
  fin: number;
}

export interface Ubicacion {
  /** Columna dentro del grupo (0…columnas-1). */
  columna: number;
  /** Columnas del grupo de cruces al que pertenece. */
  columnas: number;
}

interface Grupo {
  miembros: { id: string; columna: number; inicio: number; fin: number }[];
  columnas: number;
}

/** Arma los grupos de tramos que se cruzan en cadena, con la columna de cada uno. */
function agrupar(tramos: Tramo[]): Grupo[] {
  const orden = [...tramos].sort(
    (a, b) => a.inicio - b.inicio || b.fin - a.fin || a.id.localeCompare(b.id),
  );
  const grupos: Grupo[] = [];
  let miembros: Grupo["miembros"] = [];
  let finesColumnas: number[] = [];
  let finGrupo = -Infinity;

  const cerrarGrupo = () => {
    if (miembros.length > 0)
      grupos.push({ miembros, columnas: Math.max(1, finesColumnas.length) });
    miembros = [];
    finesColumnas = [];
  };

  for (const t of orden) {
    if (t.inicio >= finGrupo) cerrarGrupo();
    let columna = finesColumnas.findIndex((fin) => fin <= t.inicio);
    if (columna === -1) {
      columna = finesColumnas.length;
      finesColumnas.push(t.fin);
    } else {
      finesColumnas[columna] = t.fin;
    }
    miembros.push({ id: t.id, columna, inicio: t.inicio, fin: t.fin });
    finGrupo = Math.max(finGrupo, t.fin);
  }
  cerrarGrupo();
  return grupos;
}

/**
 * Reparte tramos que se cruzan en columnas, como un calendario:
 * - un grupo es un conjunto conectado de tramos que se cruzan (en cadena);
 * - cada tramo toma la primera columna libre del grupo;
 * - todos los del grupo comparten el mismo número de columnas.
 * Los que solo se tocan (uno termina cuando empieza el otro) no se cruzan.
 */
export function repartir(tramos: Tramo[]): Map<string, Ubicacion> {
  const resultado = new Map<string, Ubicacion>();
  for (const g of agrupar(tramos))
    for (const m of g.miembros)
      resultado.set(m.id, { columna: m.columna, columnas: g.columnas });
  return resultado;
}

/** Botón "+N más" de un grupo con más carriles de los que caben. */
export interface Mas extends Ubicacion {
  inicio: number;
  fin: number;
  ids: string[];
}

/**
 * Como `repartir`, pero con un tope de carriles (celular, T-12.6). Si un grupo necesita más de `max`, los primeros
 * `max - 1` carriles se ven igual y el último junta lo demás:
 * - lo que en esos carriles de más no se cruza con nada de ellos, se ve en el último carril;
 * - lo que sí se cruza va en un "+N más" por cada tramo encadenado, que cubre solo ese tramo.
 */
export function repartirConTope(
  tramos: Tramo[],
  max: number,
): { lugares: Map<string, Ubicacion>; mas: Mas[] } {
  const lugares = new Map<string, Ubicacion>();
  const mas: Mas[] = [];
  for (const g of agrupar(tramos)) {
    if (g.columnas <= max) {
      for (const m of g.miembros)
        lugares.set(m.id, { columna: m.columna, columnas: g.columnas });
      continue;
    }
    const ultimo = max - 1;
    const extra = g.miembros.filter((m) => m.columna >= ultimo);
    const cruza = (a: Grupo["miembros"][number]) =>
      extra.some((b) => b !== a && b.inicio < a.fin && a.inicio < b.fin);
    const escondidos: Grupo["miembros"] = [];
    for (const m of g.miembros) {
      if (m.columna < ultimo)
        lugares.set(m.id, { columna: m.columna, columnas: max });
      else if (!cruza(m)) lugares.set(m.id, { columna: ultimo, columnas: max });
      else escondidos.push(m);
    }
    // Ya vienen por hora de inicio: se cortan donde un tramo empieza después de que acabó todo lo anterior.
    let actual: Mas | null = null;
    for (const m of escondidos) {
      if (actual && m.inicio < actual.fin) {
        actual.fin = Math.max(actual.fin, m.fin);
        actual.ids.push(m.id);
      } else {
        actual = {
          columna: ultimo,
          columnas: max,
          inicio: m.inicio,
          fin: m.fin,
          ids: [m.id],
        };
        mas.push(actual);
      }
    }
  }
  return { lugares, mas };
}
