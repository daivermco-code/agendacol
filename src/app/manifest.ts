import type { MetadataRoute } from "next";

/** Manifest de la app instalable (se sirve en /manifest.webmanifest). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "AgendaCol",
    short_name: "AgendaCol",
    description:
      "Demo personal de agenda y gestión para negocios de servicios. Datos inventados.",
    lang: "es-CO",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    // El manifiesto no admite un color por modo: la barra del sistema la cambia el `viewport` del layout. El fondo
    // es el de la pantalla de arranque (Android), igual a las imágenes de arranque del iPhone.
    background_color: "#13233A",
    theme_color: "#13233A",
    categories: ["business", "productivity"],
    icons: [
      { src: "/iconos/icono-192.png", sizes: "192x192", type: "image/png" },
      { src: "/iconos/icono-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/iconos/icono-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Agenda", url: "/agenda" },
      { name: "Clientes", url: "/clientes" },
      { name: "Caja", url: "/ventas/caja" },
    ],
  };
}
