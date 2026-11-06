import { puedeVerRuta, type Rol } from "@/shared/lib/permisos";

export interface OpcionMenu {
  nombre: string;
  href: string;
  /** Línea corta para la página "próxima oleada". */
  resumen: string;
}

export interface SeccionMenu {
  nombre: string;
  /** Sin opciones: enlace directo (Agenda). */
  href?: string;
  opciones: OpcionMenu[];
}

/** Menú principal: secciones y rutas en español. */
export const MENU: SeccionMenu[] = [
  { nombre: "Agenda", href: "/agenda", opciones: [] },
  {
    nombre: "Ventas",
    opciones: [
      {
        nombre: "Detalle de ventas",
        href: "/ventas/detalle",
        resumen: "Todas las ventas con sus tarjetas-resumen.",
      },
      {
        nombre: "Transacciones",
        href: "/ventas/transacciones",
        resumen: "Cada pago recibido, por método.",
      },
      {
        nombre: "Planes",
        href: "/ventas/planes",
        resumen: "Planes y membresías vendidos.",
      },
      {
        nombre: "Gift cards",
        href: "/ventas/gift-cards",
        resumen: "Tarjetas de regalo vendidas y su saldo.",
      },
      {
        nombre: "Caja de ventas",
        href: "/ventas/caja",
        resumen: "Movimientos de efectivo y cuadre de caja.",
      },
      {
        nombre: "Mis cobros",
        href: "/ventas/cobros",
        resumen: "Abonos y saldos por cobrar.",
      },
    ],
  },
  {
    nombre: "Clientes",
    opciones: [
      {
        nombre: "Base de clientes",
        href: "/clientes",
        resumen: "Buscar, filtrar y abrir la ficha de cada cliente.",
      },
      {
        nombre: "Correo masivo",
        href: "/clientes/marketing",
        resumen: "Campañas de correo simuladas en el buzón.",
      },
      {
        nombre: "Crecimiento",
        href: "/clientes/crece",
        resumen: "Cómo llegan y vuelven los clientes.",
      },
      {
        nombre: "Recordatorios",
        href: "/clientes/recordatorios",
        resumen: "Recordatorios enviados y confirmados.",
      },
      {
        nombre: "Fidelización",
        href: "/clientes/fidelizacion",
        resumen: "Tarjeta de sellos y premios.",
      },
      {
        nombre: "Lista de espera",
        href: "/clientes/lista-espera",
        resumen: "Quién espera que se libere una hora.",
      },
    ],
  },
  {
    nombre: "Reportes",
    opciones: [
      {
        nombre: "Resumen",
        href: "/",
        resumen: "Lo más importante del negocio en una pantalla.",
      },
      {
        nombre: "Reporte de reservas",
        href: "/reportes/reservas",
        resumen: "Reservas por estado, hora y origen.",
      },
      {
        nombre: "Reporte de ventas",
        href: "/reportes/ventas",
        resumen: "Ventas por tipo, categoría y servicio.",
      },
    ],
  },
  {
    nombre: "Administración",
    opciones: [
      {
        nombre: "Locales",
        href: "/administracion/locales",
        resumen: "Datos del local y su horario.",
      },
      {
        nombre: "Servicios",
        href: "/administracion/servicios",
        resumen: "Catálogo de servicios por categoría.",
      },
      {
        nombre: "Profesionales",
        href: "/administracion/profesionales",
        resumen: "Equipo, horarios y servicios.",
      },
      {
        nombre: "Productos",
        href: "/administracion/productos",
        resumen: "Inventario, existencias y stock bajo.",
      },
      {
        nombre: "WhatsApp",
        href: "/administracion/whatsapp",
        resumen: "Plantillas de mensajes simulados.",
      },
      {
        nombre: "Planes",
        href: "/administracion/planes",
        resumen: "Planes y membresías que se venden.",
      },
      {
        nombre: "Recursos",
        href: "/administracion/recursos",
        resumen: "Salas, sillas y equipos.",
      },
      {
        nombre: "Gift cards",
        href: "/administracion/gift-cards",
        resumen: "Catálogo de tarjetas de regalo.",
      },
      {
        nombre: "Precios dinámicos",
        href: "/administracion/precios",
        resumen: "Precios según día y hora.",
      },
      {
        nombre: "Numeración de ventas",
        href: "/administracion/numeracion",
        resumen: "Prefijo y próximo número.",
      },
    ],
  },
];

/** Engranaje de la barra. */
export const MENU_AJUSTES: OpcionMenu[] = [
  {
    nombre: "Ajustes de la empresa",
    href: "/ajustes/mi-negocio",
    resumen: "Negocio, agenda, recordatorios y caja.",
  },
  {
    nombre: "Usuarios",
    href: "/usuarios",
    resumen: "Quién entra a la demo y con qué rol.",
  },
  {
    nombre: "Buzón de la demo",
    href: "/demo/buzon",
    resumen: "Correos, WhatsApp y pagos simulados.",
  },
];

/** Rutas que existen aunque no estén en el menú principal. */
export const OTRAS_RUTAS: OpcionMenu[] = [
  {
    nombre: "Agenda",
    href: "/agenda",
    resumen: "Semana, día, mes y lista con las citas del local.",
  },
  {
    nombre: "Mi perfil",
    href: "/perfil",
    resumen: "Tu nombre, correo y preferencias.",
  },
  { nombre: "Ayuda", href: "/ayuda", resumen: "Guía corta de la demo." },
  {
    nombre: "Búsqueda",
    href: "/buscar",
    resumen: "Buscar clientes, citas y ventas desde cualquier lado.",
  },
  {
    nombre: "Primeros pasos",
    href: "/primeros-pasos",
    resumen: "Lo que falta para dejar listo el negocio.",
  },
];

export function menuPara(rol: Rol): SeccionMenu[] {
  return MENU.map((s) => ({
    ...s,
    opciones: s.opciones.filter((o) => puedeVerRuta(rol, o.href)),
  })).filter((s) =>
    s.href ? puedeVerRuta(rol, s.href) : s.opciones.length > 0,
  );
}

export function ajustesPara(rol: Rol): OpcionMenu[] {
  return MENU_AJUSTES.filter((o) => puedeVerRuta(rol, o.href));
}

function coincide(ruta: string, href: string): boolean {
  if (href === "/") return ruta === "/";
  return ruta === href || ruta.startsWith(`${href}/`);
}

/** Nombre de la sección que se marca como pastilla. */
export function seccionActiva(ruta: string): string | null {
  for (const s of MENU) {
    if (s.href && coincide(ruta, s.href)) return s.nombre;
    if (s.opciones.some((o) => coincide(ruta, o.href))) return s.nombre;
  }
  return null;
}

/** Busca una ruta conocida (menú, engranaje u otras) para la página "próxima oleada". */
export function buscarRuta(ruta: string): OpcionMenu | null {
  const todas = [
    ...MENU.flatMap((s) => s.opciones),
    ...MENU_AJUSTES,
    ...OTRAS_RUTAS,
  ];
  const exacta = todas.find((o) => o.href === ruta);
  if (exacta) return exacta;
  if (ruta.startsWith("/ajustes/")) return MENU_AJUSTES[0];
  return null;
}

/* ---------- App de celular (Fase 12): pestañas de abajo y centro de Ajustes ---------- */

export type ClavePestana =
  "inicio" | "agenda" | "clientes" | "ventas" | "ajustes";

export interface Pestana {
  clave: ClavePestana;
  nombre: string;
  href: string;
}

/** Las 5 pestañas del celular, en su orden. Sin íconos: este archivo es solo datos. */
export const PESTANAS: Pestana[] = [
  { clave: "inicio", nombre: "Inicio", href: "/" },
  { clave: "agenda", nombre: "Agenda", href: "/agenda" },
  { clave: "clientes", nombre: "Clientes", href: "/clientes" },
  { clave: "ventas", nombre: "Ventas", href: "/ventas/detalle" },
  { clave: "ajustes", nombre: "Ajustes", href: "/ajustes" },
];

export function pestanasPara(rol: Rol): Pestana[] {
  return PESTANAS.filter((p) => puedeVerRuta(rol, p.href));
}

const FICHA_CLIENTE = /^\/clientes\/[0-9a-f-]{36}$/;

/** Pestaña que se marca. Lo que se abre desde el centro de Ajustes se queda en Ajustes. */
export function pestanaActiva(ruta: string): ClavePestana {
  if (ruta === "/" || ruta === "/avisos") return "inicio";
  if (coincide(ruta, "/agenda")) return "agenda";
  if (ruta === "/clientes" || FICHA_CLIENTE.test(ruta)) return "clientes";
  if (coincide(ruta, "/ventas/detalle")) return "ventas";
  return "ajustes";
}

export interface GrupoCentro {
  nombre: string;
  opciones: OpcionMenu[];
}

function opcionesDe(seccion: string, sin: string[] = []): OpcionMenu[] {
  const s = MENU.find((m) => m.nombre === seccion);
  return (s?.opciones ?? []).filter((o) => !sin.includes(o.href));
}

function rutaConocida(href: string): OpcionMenu {
  const o = [...MENU_AJUSTES, ...OTRAS_RUTAS].find((r) => r.href === href);
  if (!o) throw new Error(`Ruta sin datos en el menú: ${href}`);
  return o;
}

/**
 * Grupos del centro de Ajustes del celular. Salen de las mismas listas del menú, sin las pantallas que ya
 * son pestaña, así ninguna pantalla queda sin camino. Cada rol ve solo lo que puede abrir.
 */
export function centroPara(rol: Rol): GrupoCentro[] {
  const grupos: GrupoCentro[] = [
    {
      nombre: "Mi negocio",
      opciones: [
        rutaConocida("/ajustes/mi-negocio"),
        ...opcionesDe("Administración"),
      ],
    },
    { nombre: "Clientes", opciones: opcionesDe("Clientes", ["/clientes"]) },
    {
      nombre: "Ventas",
      opciones: opcionesDe("Ventas", ["/ventas/detalle"]),
    },
    { nombre: "Reportes", opciones: opcionesDe("Reportes", ["/"]) },
    { nombre: "Equipo", opciones: [rutaConocida("/usuarios")] },
    {
      nombre: "Ayuda",
      opciones: [
        rutaConocida("/primeros-pasos"),
        rutaConocida("/demo/buzon"),
        rutaConocida("/buscar"),
        rutaConocida("/ayuda"),
        rutaConocida("/perfil"),
      ],
    },
  ];
  return grupos
    .map((g) => ({
      ...g,
      opciones: g.opciones.filter((o) => puedeVerRuta(rol, o.href)),
    }))
    .filter((g) => g.opciones.length > 0);
}
