import { exigirPermiso } from "@/features/auth/services/miembro";
import { BarraLateral, type GrupoLateral } from "@/features/administracion/components/barra-lateral";
import { MENU } from "@/features/marco/menu";

const BASICAS = ["/administracion/locales", "/administracion/servicios", "/administracion/profesionales", "/administracion/productos"];
const opciones = MENU.find((s) => s.nombre === "Administración")?.opciones ?? [];

const GRUPOS: GrupoLateral[] = [
  { nombre: "Información básica", opciones: opciones.filter((o) => BASICAS.includes(o.href)) },
  { nombre: "Opciones avanzadas", plegable: true, opciones: opciones.filter((o) => !BASICAS.includes(o.href)) },
];

export default async function AdministracionLayout({ children }: { children: React.ReactNode }) {
  await exigirPermiso("administrar");
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-4 md:flex-row md:gap-6 lg:px-6 lg:py-6">
      <BarraLateral titulo="Administración" grupos={GRUPOS} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
