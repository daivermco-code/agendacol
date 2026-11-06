import { z } from "zod";
import { obtenerMiembro } from "@/features/auth/services/miembro";
import { LISTADOS } from "@/features/exportar/services/listados";
import { aCsv, columnasElegidas } from "@/shared/lib/csv";
import { puede } from "@/shared/lib/permisos";

const esquemaListado = z.enum([
  "clientes",
  "ventas",
  "transacciones",
  "reservas",
]);
const esquemaColumnas = z
  .string()
  .max(400)
  .regex(/^[a-z,]*$/)
  .transform((t) => t.split(",").filter(Boolean))
  .nullable()
  .catch(null);

const texto = (mensaje: string, status: number) =>
  new Response(mensaje, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

/**
 * Descarga un listado en CSV con los filtros de su pantalla. Exige sesión y el mismo permiso de la pantalla; lee con
 * la sesión de quien pide (RLS de su negocio), nunca con la llave de servicio.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ listado: string }> },
) {
  const listado = esquemaListado.safeParse((await params).listado);
  if (!listado.success) return texto("Ese listado no existe", 404);
  const miembro = await obtenerMiembro();
  if (!miembro) return texto("Inicia sesión para descargar", 401);
  const def = LISTADOS[listado.data];
  if (!def || !puede(miembro.rol, def.permiso))
    return texto("No tienes permiso para descargar este listado", 403);

  const consulta = Object.fromEntries(new URL(request.url).searchParams);
  const columnas = columnasElegidas(
    def.columnas,
    esquemaColumnas.parse(consulta.columnas ?? null),
  );
  let filas: Record<string, unknown>[];
  try {
    filas = await def.leer(consulta);
  } catch {
    return texto("No se pudo armar el archivo. Intenta de nuevo.", 500);
  }
  const csv = aCsv(
    columnas,
    filas.map((f) =>
      columnas.map((c) => f[c.clave] as string | number | null | undefined),
    ),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${def.archivo(consulta)}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
