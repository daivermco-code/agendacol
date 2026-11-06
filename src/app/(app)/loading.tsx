/**
 * Pantalla de carga de toda la app. Sin ella, Next espera a que el servidor termine la página nueva antes de
 * cambiar: al tocar una pestaña la pantalla anterior se queda quieta y parece congelada. Con ella, la pestaña
 * cambia al instante y los datos llegan dentro de la sección.
 */
export default function Cargando() {
  return (
    <main
      className="mx-auto w-full max-w-[1400px] flex-1 space-y-4 px-4 py-4 lg:px-6 lg:py-6"
      role="status"
      aria-label="Cargando"
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="space-y-2">
          <div className="h-3 w-32 rounded bg-ac-borde" />
          <div className="h-7 w-48 rounded bg-ac-borde" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-lg border border-ac-borde bg-ac-papel"
            />
          ))}
        </div>
        <div className="h-64 rounded-lg border border-ac-borde bg-ac-papel" />
      </div>
      <span className="sr-only">Cargando…</span>
    </main>
  );
}
