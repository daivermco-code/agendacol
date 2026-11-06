// Service worker de AgendaCol (sin push y sin manejar `fetch`).
// No intercepta pedidos a propósito: un manejador de `fetch` rompe la app instalada en Safari de iPhone, y la demo
// necesita la base en línea para todo. Solo limpia cachés viejas y toma el control al activarse.
const VERSION = "agedacol-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nombres) =>
        Promise.all(
          nombres.filter((n) => n !== VERSION).map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
