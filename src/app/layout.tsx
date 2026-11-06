import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { Proveedores } from "@/shared/components/proveedores";
import { RegistrarApp } from "@/shared/components/registrar-app";
import pantallasIos from "@/shared/lib/arranque-ios.json";
import { Toaster } from "@/shared/ui/sonner";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "AgendaCol", template: "%s · AgendaCol" },
  description:
    "Demo personal de agenda y gestión para negocios de servicios. Datos inventados.",
  robots: { index: false, follow: false },
  applicationName: "AgendaCol",
  appleWebApp: {
    capable: true,
    title: "AgendaCol",
    statusBarStyle: "black",
    // Lo que muestra el iPhone al abrir la app instalada, antes de que llegue la página (sin esto, negro).
    // Las imágenes las hace `scripts/imagenes-arranque.mjs`.
    startupImage: pantallasIos.map(({ ancho, alto, escala }) => ({
      url: `/iconos/arranque/arranque-${ancho * escala}x${alto * escala}.png`,
      media: `(device-width: ${ancho}px) and (device-height: ${alto}px) and (-webkit-device-pixel-ratio: ${escala}) and (orientation: portrait)`,
    })),
  },
  formatDetection: { telephone: false },
  // Next 16 solo pone `mobile-web-app-capable`; sin la de Apple, el iPhone no usa las imágenes de arranque y abre
  // en negro.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  // La barra del sistema toma el color de la barra superior de cada modo (--ac-noche en globals.css).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#13233A" },
    { media: "(prefers-color-scheme: dark)", color: "#111E32" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  // Para que `env(safe-area-inset-bottom)` deje libre la barra de inicio del iPhone.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-CO" className={figtree.variable}>
      <body className="font-sans">
        <Proveedores>{children}</Proveedores>
        <Toaster />
        <RegistrarApp />
      </body>
    </html>
  );
}
