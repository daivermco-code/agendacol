"use client";

import {
  useId,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { differenceInYears, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, CalendarPlus, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { usePuede } from "@/features/auth/components/proveedor-miembro";
import { SellosCliente } from "@/features/fidelizacion/components/sellos-cliente";
import type { ProgramaSellos } from "@/features/fidelizacion/lib/sellos";
import { useConfirmar } from "@/shared/components/confirmar";
import { telefono } from "@/shared/lib/formato";
import { cn, iniciales } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { borrarCliente, guardarCliente } from "../actions";
import { clienteDesde, colorDe } from "../lib/lista-celular";
import type { DatosCliente } from "../schemas";
import type { FichaCliente as DatosFicha } from "../services/clientes";
import { CampoFicha, type TipoCampo } from "./campo-ficha";
import { aFormulario } from "./ficha-cliente";
import { Actividad, PagosDeudas } from "./pestanas-cliente";

type Clave = keyof Omit<DatosCliente, "id">;

interface DefCampo {
  clave: Clave;
  etiqueta: string;
  tipo?: TipoCampo;
  maximo?: number;
}

/** Los cuatro de siempre. */
const PRINCIPALES: DefCampo[] = [
  { clave: "nombre", etiqueta: "Nombre", maximo: 60 },
  { clave: "apellido", etiqueta: "Apellido", maximo: 60 },
  { clave: "telefono", etiqueta: "Teléfono", tipo: "telefono" },
  { clave: "correo", etiqueta: "Correo", tipo: "correo" },
];

/** "Información adicional", plegada al abrir. */
const ADICIONALES: DefCampo[] = [
  { clave: "documento", etiqueta: "Documento", maximo: 20 },
  { clave: "fechaNacimiento", etiqueta: "Fecha de nacimiento", tipo: "fecha" },
  { clave: "genero", etiqueta: "Género", tipo: "genero" },
  { clave: "numeroCliente", etiqueta: "Número de cliente", maximo: 20 },
  { clave: "direccion", etiqueta: "Dirección", maximo: 120 },
  { clave: "barrio", etiqueta: "Barrio", maximo: 60 },
  { clave: "municipio", etiqueta: "Municipio", maximo: 60 },
];

const GENERO: Record<string, string> = {
  femenino: "Femenino",
  masculino: "Masculino",
  otro: "Otro",
};

const ETIQUETAS = Object.fromEntries(
  [...PRINCIPALES, ...ADICIONALES].map((d) => [d.clave, d.etiqueta]),
) as Record<Clave, string>;

/** Como lo guarda la base (`esquemaCliente`): sin espacios a los lados y el correo en minúsculas. */
function normal(clave: Clave, valor: string): string {
  const v = valor.trim();
  return clave === "correo" ? v.toLowerCase() : v;
}

/** Cómo se lee cada dato (el valor guardado se edita tal cual); la edad, con el día de Bogotá (`hoy`). */
function mostrar(clave: Clave, valor: string, hoy: string): string {
  if (!valor) return "";
  if (clave === "telefono") return telefono(valor);
  if (clave === "genero") return GENERO[valor] ?? valor;
  if (clave === "fechaNacimiento") {
    const f = parseISO(valor);
    return `${format(f, "d 'de' MMMM 'de' yyyy", { locale: es })} · ${differenceInYears(parseISO(hoy), f)} años`;
  }
  return valor;
}

function Plegable({
  titulo,
  nivel,
  children,
}: {
  titulo: string;
  /** `h2` bajo el `h1` de la página; `h3` bajo el título (oculto) de la hoja. */
  nivel: "h2" | "h3";
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const id = useId();
  const Encabezado = nivel;
  return (
    <section className="overflow-hidden rounded-2xl border border-ac-borde bg-ac-papel">
      <Encabezado>
        <button
          type="button"
          aria-expanded={abierto}
          aria-controls={id}
          onClick={() => setAbierto((a) => !a)}
          className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left text-[16px] font-semibold hover:bg-ac-niebla"
        >
          {titulo}
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 text-ac-pizarra transition-transform",
              abierto && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
      </Encabezado>
      <div id={id} hidden={!abierto} className="border-t border-ac-borde">
        {children}
      </div>
    </section>
  );
}

interface Props {
  ficha: DatosFicha;
  hoy: string;
  sellos: { programa: ProgramaSellos; sellos: number; canjes: number };
  /** En la hoja el nombre ya es el título (oculto) de la hoja; en la página es el `h1`. */
  comoPagina?: boolean;
  /** Campo abierto para editar (uno a la vez); la hoja lo usa para que Escape cancele en vez de cerrar. */
  editando: Clave | null;
  onEditando: Dispatch<SetStateAction<Clave | null>>;
  onCambio: () => void | Promise<void>;
  onBorrado: () => void;
}

/**
 * Ficha del cliente en el celular (T-12.12): iniciales grandes, nombre y "cliente desde"; los datos con lápiz para
 * editarlos uno por uno; "Información adicional" plegable; lo propio de AgendaCol (reservas, pagos y sellos) y
 * "Eliminar cliente" al final.
 */
export function FichaClienteCelular(p: Props) {
  const { cliente, citas, ventas } = p.ficha;
  const puedo = usePuede();
  const editable = puedo("editar_clientes");
  const [dialogo, confirmar] = useConfirmar();
  const [borrando, iniciar] = useTransicionRed();
  const idNota = useId();
  // Lo recién guardado se ve de una vez, mientras llegan los datos nuevos.
  const [cambios, setCambios] = useState<Partial<DatosCliente>>({});
  const [base, setBase] = useState(cliente);
  if (base !== cliente) {
    setBase(cliente);
    setCambios({});
  }
  const datos: DatosCliente = { ...aFormulario(cliente), ...cambios };
  const nombre = `${datos.nombre} ${datos.apellido}`;
  const color = colorDe(cliente.id);
  const conHistoria = citas.length > 0 || ventas.length > 0;
  // Se guarda la ficha entera: un dato a la vez, para que un envío no lleve lo viejo de otro que sigue en camino.
  const enCurso = useRef(false);

  async function guardar(clave: Clave, valor: string): Promise<string | null> {
    if (enCurso.current) return "Espera a que se guarde el otro dato";
    enCurso.current = true;
    try {
      const r = await guardarCliente({ ...datos, [clave]: valor });
      if (!r.ok) {
        if (!("error" in r)) return "Ya hay otro cliente con estos datos";
        // El error es de otro dato ya guardado (por ejemplo, un teléfono de la reserva en línea): se dice cuál.
        const otro = r.campo && r.campo !== clave ? (r.campo as Clave) : null;
        return otro && ETIQUETAS[otro]
          ? `Revisa ${ETIQUETAS[otro]}: ${r.error}`
          : r.error;
      }
      setCambios((c) => ({ ...c, [clave]: normal(clave, valor) }));
      toast.success("Cambio guardado");
      void p.onCambio();
      return null;
    } finally {
      enCurso.current = false;
    }
  }

  // La pregunta va fuera de la transición: dentro, React no la dibuja hasta que la acción termine.
  async function eliminar() {
    const si = await confirmar({
      titulo: `¿Eliminar a ${nombre}?`,
      texto: "Se borra su ficha. No se puede deshacer.",
      aceptar: "Eliminar",
      peligro: true,
    });
    if (!si) return;
    iniciar(async () => {
      const r = await borrarCliente(cliente.id);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Cliente eliminado");
      p.onBorrado();
    });
  }

  const campo = (d: DefCampo) => (
    <CampoFicha
      key={d.clave}
      id={`ficha-${d.clave}`}
      etiqueta={d.etiqueta}
      valor={String(datos[d.clave] ?? "")}
      mostrar={mostrar(d.clave, String(datos[d.clave] ?? ""), p.hoy)}
      tipo={d.tipo}
      maximo={d.maximo}
      hoy={p.hoy}
      editable={editable}
      editando={p.editando === d.clave}
      // Al cerrar, solo si sigue abierto este: un guardado que termina no cierra otro dato que se abrió después.
      onEditando={(si) =>
        p.onEditando((actual) =>
          si ? d.clave : actual === d.clave ? null : actual,
        )
      }
      onGuardar={(v) => guardar(d.clave, v)}
    />
  );

  const Titulo = p.comoPagina ? "h1" : "p";
  const nivel = p.comoPagina ? "h2" : "h3";
  return (
    <div className="space-y-4 pb-4">
      <header className="flex flex-col items-center pt-1 text-center">
        <span
          aria-hidden="true"
          className="inline-flex h-[72px] w-[72px] items-center justify-center rounded-full text-[24px] font-bold"
          style={{ background: color.fondo, color: color.texto }}
        >
          {iniciales(datos.nombre, datos.apellido)}
        </span>
        <Titulo
          aria-hidden={p.comoPagina ? undefined : true}
          className="mt-3 text-[22px] font-bold leading-tight"
        >
          {nombre}
        </Titulo>
        <p className="text-sm text-ac-pizarra">
          {clienteDesde(cliente.created_at)}
        </p>
        {puedo("crear_cita") ? (
          <Button asChild variant="outline" className="mt-3 rounded-full">
            <Link href={`/agenda?reservar=${cliente.id}`}>
              <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Nueva
              reserva
            </Link>
          </Button>
        ) : null}
      </header>

      <ul
        aria-label="Datos del cliente"
        className="divide-y divide-ac-borde overflow-hidden rounded-2xl border border-ac-borde bg-ac-papel"
      >
        {PRINCIPALES.map(campo)}
      </ul>

      <Plegable nivel={nivel} titulo="Información adicional">
        <ul
          aria-label="Información adicional"
          className="divide-y divide-ac-borde"
        >
          {ADICIONALES.map(campo)}
        </ul>
      </Plegable>

      <Plegable nivel={nivel} titulo={`Reservas (${citas.length})`}>
        <div className="p-3">
          <Actividad citas={citas} />
        </div>
      </Plegable>
      <Plegable nivel={nivel} titulo={`Pagos y ventas (${ventas.length})`}>
        <div className="p-3">
          <PagosDeudas
            clienteId={cliente.id}
            citas={citas}
            ventas={ventas}
            puedeCobrar={puedo("cobrar")}
          />
        </div>
      </Plegable>
      <Plegable nivel={nivel} titulo="Sellos">
        <div className="p-3">
          <SellosCliente
            clienteId={cliente.id}
            nombre={nombre}
            puedeEntregar={puedo("cobrar")}
            {...p.sellos}
          />
        </div>
      </Plegable>

      {editable ? (
        <div className="pt-2">
          <Button
            variant="outline"
            size="lg"
            // aria-disabled y no disabled: con teclado o lector se llega al botón y se oye por qué no se puede.
            aria-disabled={conHistoria || borrando}
            aria-describedby={conHistoria ? idNota : undefined}
            onClick={() => {
              if (!conHistoria && !borrando) void eliminar();
            }}
            className="w-full rounded-full border-ac-error text-ac-error hover:bg-ac-error/5 hover:text-ac-error aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent"
          >
            Eliminar cliente
          </Button>
          {conHistoria ? (
            <p id={idNota} className="mt-2 text-center text-xs text-ac-pizarra">
              Tiene reservas o ventas: su ficha se conserva.
            </p>
          ) : null}
        </div>
      ) : null}
      {dialogo}
    </div>
  );
}

/** La misma ficha como página (`/clientes/[id]` en el celular), con la vuelta a la lista. */
export function FichaClientePaginaCelular(
  p: Pick<Props, "ficha" | "hoy" | "sellos">,
) {
  const router = useRouter();
  const [editando, setEditando] = useState<Clave | null>(null);
  return (
    <main className="px-4 pb-24 pt-1 md:hidden">
      <Link
        href="/clientes"
        className="-ml-1 inline-flex min-h-11 items-center gap-1 text-sm text-ac-pizarra"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Clientes
      </Link>
      <FichaClienteCelular
        {...p}
        comoPagina
        editando={editando}
        onEditando={setEditando}
        onCambio={() => router.refresh()}
        onBorrado={() => router.push("/clientes")}
      />
    </main>
  );
}
