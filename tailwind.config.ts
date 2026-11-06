import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// Colores de AgedaCol: variables --ac-* en globals.css (HSL), para poder usar /opacidad.
const NOMBRES_AC = [
  "noche",
  "noche-claro",
  "niebla",
  "niebla-oscura",
  "papel",
  "laguna",
  "laguna-hondo",
  "laguna-claro",
  "foco",
  "tinta",
  "pizarra",
  "neblina",
  "borde",
  "borde-fuerte",
  "sobre-noche",
  "sobre-noche-suave",
  "demo-fondo",
  "demo-texto",
  "exito",
  "error",
  "aviso",
  "info",
  "info-fondo",
  "exito-fondo",
  "error-fondo",
  "aviso-fondo",
] as const;

const coloresAc = Object.fromEntries(
  NOMBRES_AC.map((nombre) => [
    nombre,
    `hsl(var(--ac-${nombre}) / <alpha-value>)`,
  ]),
);

const config: Config = {
  darkMode: "media",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-figtree)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      colors: {
        ac: coloresAc,
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: { sm: "6px", md: "8px", lg: "12px" },
      boxShadow: {
        quieta: "0 1px 2px hsl(var(--ac-sombra) / 0.06)",
        flota: "0 8px 24px hsl(var(--ac-sombra) / 0.12)",
        modal: "0 16px 48px hsl(var(--ac-sombra) / 0.20)",
      },
      height: { franja: "30px", barra: "52px" },
      keyframes: {
        "entra-abajo": {
          from: { transform: "translateY(4px)", opacity: "0" },
          to: { transform: "none", opacity: "1" },
        },
        // Antes de hidratar, Radix aún no midió el alto y la variable no existe: así las dos puntas quedan en
        // "auto" y lo que viene abierto del servidor no se dibuja en 0 para saltar después (CLS).
        "accordion-down": {
          from: { height: "calc(var(--radix-accordion-content-height) * 0)" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "entra-abajo": "entra-abajo 160ms cubic-bezier(0.25, 1, 0.5, 1)",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [animate],
};

export default config;
