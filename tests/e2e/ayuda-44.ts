import type { Page } from "@playwright/test";

// Medición de las áreas táctiles de 44 px del celular (DESIGN.md §5): la usan celular-44 (todas las pantallas) y
// ventas-celular (el panel de venta y sus hojas, que solo se ven tras tocar algo).

const CONTROLES = [
  "button",
  '[role="button"]',
  'input:not([type="hidden"])',
  "select",
  '[role="tab"]',
  '[role="combobox"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="radio"]',
  '[role="menuitem"]',
].join(",");

/** Controles visibles de la pantalla que se tocan con menos de 44 px de alto (o de ancho, si son solo un ícono). */
export async function chicos(page: Page, ruta: string): Promise<string[]> {
  return page.locator("body").evaluate(
    (body, { selector, ruta }) => {
      const MINIMO = 43.5;
      const malos: string[] = [];
      for (const el of Array.from(
        body.querySelectorAll<HTMLElement>(selector),
      )) {
        if (
          el.closest(
            "[data-cita], [data-bloqueo], [data-mas], [aria-hidden='true'], [inert]",
          )
        )
          continue;
        const estilo = getComputedStyle(el);
        if (
          estilo.display === "none" ||
          estilo.visibility === "hidden" ||
          estilo.pointerEvents === "none" ||
          Number(estilo.opacity) === 0
        )
          continue;
        const caja = el.getBoundingClientRect();
        if (caja.width === 0 || caja.height === 0) continue;
        const despues = getComputedStyle(el, "::after");
        const tactil =
          despues.content !== "none" && despues.position === "absolute";
        const alto = Math.max(
          caja.height,
          tactil ? parseFloat(despues.height) : 0,
        );
        const ancho = Math.max(
          caja.width,
          tactil ? parseFloat(despues.width) : 0,
        );
        const soloIcono =
          (el.textContent ?? "").trim() === "" && el.tagName !== "INPUT";
        if (alto < MINIMO || (soloIcono && ancho < MINIMO)) {
          const nombre =
            el.getAttribute("aria-label") ||
            (el.textContent ?? "").trim().slice(0, 30) ||
            el.getAttribute("name") ||
            el.getAttribute("placeholder") ||
            el.tagName.toLowerCase();
          malos.push(
            `${ruta} · ${nombre} · ${Math.round(ancho)}×${Math.round(alto)}`,
          );
        }
      }
      return malos;
    },
    { selector: CONTROLES, ruta },
  );
}
