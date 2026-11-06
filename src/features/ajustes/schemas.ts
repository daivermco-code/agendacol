import { z } from "zod";

const HORA = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida");

export const BLOQUES = [5, 10, 15, 20, 30, 40, 45, 60] as const;

export const esquemaMiNegocio = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "Escribe el nombre del negocio")
    .max(80, "Máximo 80 letras"),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{3,40}$/, "Solo minúsculas, números y guiones (3 a 40)"),
  descripcion: z.string().trim().max(400, "Máximo 400 letras"),
});

export const esquemaAgenda = z.object({
  bloqueMin: z
    .number()
    .refine(
      (n) => (BLOQUES as readonly number[]).includes(n),
      "Elige un largo de bloque",
    ),
  permitirSobrepuestas: z.boolean(),
  permitirClienteDoble: z.boolean(),
  permitirSobrecargaRecursos: z.boolean(),
  exigirContacto: z.boolean(),
  bloquearPasadas: z.boolean(),
  permitirFueraHorario: z.boolean(),
});

export const esquemaRecordatorios = z.object({
  avisoCorreo: z.boolean(),
  avisoWhatsapp: z.boolean(),
  recordatorioCorreo: z.boolean(),
  recordatorioCorreoDias: z.number().int().min(0).max(7),
  recordatorioCorreoHora: HORA,
  recordatorioWhatsapp: z.boolean(),
  recordatorioWhatsappDias: z.number().int().min(0).max(7),
  recordatorioWhatsappHora: HORA,
});

export const esquemaCaja = z.object({
  cajaActiva: z.boolean(),
  cajaClienteObligatorio: z.boolean(),
});

export const ANTICIPACION = [30, 60, 120, 240, 720, 1440] as const;
export const DIAS_MAX = [14, 30, 60, 90, 180] as const;
export const LIMITE_HORAS = [0, 2, 4, 12, 24, 48] as const;

const deLista = (lista: readonly number[], mensaje: string) =>
  z.number().refine((n) => lista.includes(n), mensaje);

export const esquemaSitioWeb = z.object({
  webAnticipacionMin: deLista(ANTICIPACION, "Elige la anticipación"),
  webDiasMax: deLista(DIAS_MAX, "Elige hasta cuándo se reserva"),
  webClienteCancela: z.boolean(),
  webClienteCambia: z.boolean(),
  webLimiteHoras: deLista(LIMITE_HORAS, "Elige el límite"),
  webPolitica: z.string().trim().max(600, "La política: máximo 600 letras"),
});

/** Usuario de una red: "@" opcional al inicio; vacío = no se muestra. */
const usuarioRed = (letras: RegExp, red: string) =>
  z
    .string()
    .trim()
    .transform((s) => s.replace(/^@/, ""))
    .refine((s) => s === "" || letras.test(s), `Usuario de ${red} no válido`);

export const esquemaAvanzadas = z.object({
  redInstagram: usuarioRed(/^[A-Za-z0-9._]{1,30}$/, "Instagram"),
  redFacebook: usuarioRed(/^[A-Za-z0-9.]{1,50}$/, "Facebook"),
  redTiktok: usuarioRed(/^[A-Za-z0-9._]{1,24}$/, "TikTok"),
  avisoEquipoReserva: z.boolean(),
  avisoEquipoCambios: z.boolean(),
  avisoEquipoCorreo: z.union([
    z.literal(""),
    z.string().trim().email("El correo de avisos no es válido"),
  ]),
});

export const ESQUEMAS = {
  "mi-negocio": esquemaMiNegocio,
  agenda: esquemaAgenda,
  recordatorios: esquemaRecordatorios,
  caja: esquemaCaja,
  "sitio-web": esquemaSitioWeb,
  avanzadas: esquemaAvanzadas,
} as const;

export type SeccionEditable = keyof typeof ESQUEMAS;
export type ValoresAjustes = z.infer<typeof esquemaMiNegocio> &
  z.infer<typeof esquemaAgenda> &
  z.infer<typeof esquemaRecordatorios> &
  z.infer<typeof esquemaCaja> &
  z.infer<typeof esquemaSitioWeb> &
  z.input<typeof esquemaAvanzadas>;

export const SECCIONES_AJUSTES: {
  slug: string;
  nombre: string;
  lista: boolean;
}[] = [
  { slug: "mi-negocio", nombre: "Mi negocio", lista: true },
  { slug: "agenda", nombre: "Agenda", lista: true },
  { slug: "recordatorios", nombre: "Recordatorios y avisos", lista: true },
  { slug: "caja", nombre: "Caja", lista: true },
  { slug: "sitio-web", nombre: "Sitio web", lista: true },
  { slug: "ficha-clientes", nombre: "Ficha de clientes", lista: false },
  { slug: "pagos-en-linea", nombre: "Pagos en línea", lista: false },
  { slug: "integraciones", nombre: "Integraciones", lista: false },
  { slug: "avanzadas", nombre: "Avanzadas", lista: true },
];
