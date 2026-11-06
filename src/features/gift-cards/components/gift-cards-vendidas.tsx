"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Gift, Search } from "lucide-react";
import { Vacio } from "@/shared/components/vacio";
import { pesos } from "@/shared/lib/formato";
import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/input";
import { ESTADO_GIFT_CARD } from "../lib/gift-cards";
import type { EstadoGiftCard, GiftCardVendida } from "../types";

const fecha = (f: string) => format(parseISO(f), "d MMM yyyy", { locale: es });

function Cifra({
  titulo,
  valor,
  ayuda,
}: {
  titulo: string;
  valor: number;
  ayuda: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-ac-borde bg-ac-papel p-3 shadow-quieta sm:p-4">
      <p className="text-sm text-ac-pizarra">{titulo}</p>
      <p className="cifras mt-1 text-xl font-bold tracking-tight sm:text-2xl">
        {pesos(valor)}
      </p>
      <p className="mt-0.5 text-xs text-ac-pizarra">{ayuda}</p>
    </div>
  );
}

function Estado({ estado }: { estado: EstadoGiftCard }) {
  const e = ESTADO_GIFT_CARD[estado];
  return (
    <span
      className={cn(
        "inline-block shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        e.clase,
      )}
    >
      {e.nombre}
    </span>
  );
}

const FILTROS: { id: "todas" | EstadoGiftCard; nombre: string }[] = [
  { id: "todas", nombre: "Todas" },
  { id: "sin_usar", nombre: "Sin usar" },
  { id: "en_uso", nombre: "Con saldo" },
  { id: "usada", nombre: "Usadas" },
  { id: "vencida", nombre: "Vencidas" },
];

/** Ventas → Gift cards: lo vendido, lo canjeado y lo que queda por canjear, con cada tarjeta y su saldo. */
export function GiftCardsVendidas({
  tarjetas,
}: {
  tarjetas: GiftCardVendida[];
}) {
  const [texto, setTexto] = useState("");
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["id"]>("todas");
  const validas = tarjetas.filter((t) => t.estado !== "anulada");
  const vendido = validas.reduce((s, t) => s + t.saldoInicial, 0);
  const canjeado = validas.reduce((s, t) => s + t.saldoInicial - t.saldo, 0);
  const porCanjear = validas
    .filter((t) => t.estado === "sin_usar" || t.estado === "en_uso")
    .reduce((s, t) => s + t.saldo, 0);
  const vencido = validas
    .filter((t) => t.estado === "vencida")
    .reduce((s, t) => s + t.saldo, 0);
  const buscado = texto.trim().toLowerCase();
  const lista = tarjetas.filter(
    (t) =>
      (filtro === "todas" || t.estado === filtro) &&
      (!buscado ||
        `${t.codigo} ${t.comprador ?? ""} ${t.para ?? ""} ${t.nombre}`
          .toLowerCase()
          .includes(buscado)),
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cifra
          titulo="Vendido"
          valor={vendido}
          ayuda={`${validas.length} gift cards`}
        />
        <Cifra
          titulo="Canjeado"
          valor={canjeado}
          ayuda="Pagado con gift card"
        />
        <Cifra
          titulo="Por canjear"
          valor={porCanjear}
          ayuda="Saldo de las vigentes"
        />
        <Cifra
          titulo="Vencido sin usar"
          valor={vencido}
          ayuda="Saldo que ya no se usa"
        />
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <label className="relative block md:w-80">
          <span className="sr-only">Buscar gift cards</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ac-neblina"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Código, cliente o para quién"
            className="pl-9"
          />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Estado">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filtro === f.id}
              onClick={() => setFiltro(f.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm min-h-11 md:min-h-0",
                filtro === f.id
                  ? "border-ac-laguna bg-ac-laguna-claro font-medium text-ac-laguna-hondo"
                  : "border-ac-borde bg-ac-papel text-ac-pizarra hover:bg-ac-niebla",
              )}
            >
              {f.nombre}
            </button>
          ))}
        </div>
      </div>
      {lista.length === 0 ? (
        <Vacio
          icono={Gift}
          titulo={
            tarjetas.length ? "Ninguna coincide" : "Aún no se venden gift cards"
          }
          texto={
            tarjetas.length
              ? "Prueba con otro código, cliente o estado."
              : "Se venden en la caja, desde la pestaña «Gift cards» de una venta nueva."
          }
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-ac-borde bg-ac-papel lg:block">
            <table className="w-full text-sm">
              <thead className="bg-ac-niebla text-left text-ac-pizarra">
                <tr>
                  {[
                    "Código",
                    "Gift card",
                    "Compró",
                    "Saldo",
                    "Vence",
                    "Venta",
                    "Estado",
                  ].map((t) => (
                    <th key={t} scope="col" className="px-3 py-2 font-medium">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map((t) => (
                  <tr key={t.id} className="border-t border-ac-borde">
                    <td className="cifras px-3 py-2 font-semibold tracking-wide">
                      {t.codigo}
                    </td>
                    <td className="px-3 py-2">{t.nombre}</td>
                    <td className="px-3 py-2">
                      {t.comprador ?? "—"}
                      {t.para ? (
                        <span className="block text-xs text-ac-pizarra">
                          Para {t.para}
                        </span>
                      ) : null}
                    </td>
                    <td className="cifras whitespace-nowrap px-3 py-2">
                      {pesos(t.saldo)}{" "}
                      <span className="text-xs text-ac-pizarra">
                        de {pesos(t.saldoInicial)}
                      </span>
                    </td>
                    <td className="cifras whitespace-nowrap px-3 py-2">
                      {fecha(t.vence)}
                    </td>
                    <td className="cifras px-3 py-2">{t.venta ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Estado estado={t.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2 lg:hidden" aria-label="Gift cards vendidas">
            {lista.map((t) => (
              <li
                key={t.id}
                className="rounded-lg border border-ac-borde bg-ac-papel p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="cifras font-semibold tracking-wide">
                    {t.codigo}
                  </p>
                  <Estado estado={t.estado} />
                </div>
                <p>
                  {t.nombre}
                  {t.comprador ? ` · ${t.comprador}` : ""}
                  {t.para ? ` · para ${t.para}` : ""}
                </p>
                <p className="cifras text-ac-pizarra">
                  Saldo {pesos(t.saldo)} de {pesos(t.saldoInicial)} · vence{" "}
                  {fecha(t.vence)}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
