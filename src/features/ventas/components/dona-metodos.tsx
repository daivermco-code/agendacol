import { textoPorcentaje } from "@/features/reportes/lib/graficos";
import { pesos } from "@/shared/lib/formato";
import type { ResumenPagos } from "../services/ventas";
import type { TipoMetodo } from "../types";

/** Un color por tipo de método; la leyenda repite nombre, monto y porcentaje (no depende solo del color). */
const COLOR: Record<TipoMetodo, string> = {
  efectivo: "#0B7A70",
  transferencia: "#2479C9",
  debito: "#7C3AED",
  credito: "#C98A0B",
  billetera: "#DB2777",
  gift_card: "#4D7C0F",
  otro: "#64748B",
};

const RADIO = 42;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

/** Dona de métodos de pago con el total al centro y la leyenda con porcentajes (US-041). */
export function DonaMetodos({ metodos }: { metodos: ResumenPagos["metodos"] }) {
  const total = metodos.reduce((s, m) => s + m.monto, 0);
  let acumulado = 0;
  const porcentaje = (monto: number) =>
    total ? Math.round((monto / total) * 1000) / 10 : 0;
  return (
    <section
      aria-label="Métodos de pago"
      className="flex flex-col items-center gap-5 rounded-lg border border-ac-borde bg-ac-papel p-4 shadow-quieta sm:flex-row"
    >
      <div className="relative h-40 w-40 shrink-0">
        <svg
          viewBox="0 0 100 100"
          className="h-full w-full -rotate-90"
          role="img"
          aria-label="Dona de métodos de pago"
        >
          <circle
            cx="50"
            cy="50"
            r={RADIO}
            fill="none"
            stroke="hsl(var(--ac-niebla-oscura))"
            strokeWidth="12"
          />
          {total
            ? metodos.map((m) => {
                const largo = (m.monto / total) * CIRCUNFERENCIA;
                const tramo = (
                  <circle
                    key={m.nombre}
                    cx="50"
                    cy="50"
                    r={RADIO}
                    fill="none"
                    stroke={COLOR[m.tipo]}
                    strokeWidth="12"
                    strokeDasharray={`${Math.max(largo - 0.6, 0)} ${CIRCUNFERENCIA}`}
                    strokeDashoffset={-acumulado}
                  />
                );
                acumulado += largo;
                return tramo;
              })
            : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-ac-pizarra">Total</span>
          <span className="cifras text-base font-bold">{pesos(total)}</span>
        </div>
      </div>
      <ul className="grid w-full gap-2 text-sm">
        {metodos.length ? (
          metodos.map((m) => (
            <li key={m.nombre} className="flex items-start gap-2">
              <span
                className="mt-1 h-3 w-3 shrink-0 rounded-sm"
                style={{ background: COLOR[m.tipo] }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="flex justify-between gap-2">
                  <span className="truncate">{m.nombre}</span>
                  <span className="cifras shrink-0 text-ac-pizarra">
                    {textoPorcentaje(porcentaje(m.monto))}
                  </span>
                </p>
                <p className="cifras font-medium">{pesos(m.monto)}</p>
              </div>
            </li>
          ))
        ) : (
          <li className="text-ac-pizarra">Sin pagos en este período.</li>
        )}
      </ul>
    </section>
  );
}
