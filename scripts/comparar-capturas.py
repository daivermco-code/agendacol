"""Compara dos carpetas de capturas de scripts/capturas.mjs (antes y después) y dice qué cambió.

Uso: python scripts/comparar-capturas.py <antes> <después> [--salida <carpeta de diferencias>]

Por cada pareja imprime el porcentaje de píxeles que cambian (más de 16 en algún canal) y si cambió el tamaño de la
página. Las capturas que están solo de un lado salen primero, como "falta en …".
En la carpeta de diferencias deja, para las que cambiaron, una imagen con lo distinto en rojo sobre la de antes.
"""

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageChops

UMBRAL = 16


def comparar(a: Path, b: Path, salida: Path | None) -> tuple[float, str]:
    ia = Image.open(a).convert("RGB")
    ib = Image.open(b).convert("RGB")
    nota = "" if ia.size == ib.size else f"{ia.width}×{ia.height} → {ib.width}×{ib.height}"
    ancho = max(ia.width, ib.width)
    alto = max(ia.height, ib.height)
    lienzo_a = Image.new("RGB", (ancho, alto), "white")
    lienzo_b = Image.new("RGB", (ancho, alto), "white")
    lienzo_a.paste(ia)
    lienzo_b.paste(ib)
    # El canal que más cambia (no la luminancia, que esconde cambios de azul o de rojo).
    r, g, b = ImageChops.difference(lienzo_a, lienzo_b).split()
    dif = ImageChops.lighter(ImageChops.lighter(r, g), b).point(lambda v: 255 if v > UMBRAL else 0)
    cambiados = dif.histogram()[255]
    pct = 100 * cambiados / (ancho * alto)
    if salida and cambiados:
        marca = Image.new("RGB", (ancho, alto), (220, 30, 30))
        tenue = Image.blend(lienzo_a, Image.new("RGB", (ancho, alto), "white"), 0.6)
        tenue.paste(marca, mask=dif)
        destino = salida / a.parent.name / a.name
        destino.parent.mkdir(parents=True, exist_ok=True)
        tenue.save(destino)
    return pct, nota


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("antes", type=Path)
    p.add_argument("despues", type=Path)
    p.add_argument("--salida", type=Path)
    args = p.parse_args()

    filas = []
    for a in sorted(args.antes.rglob("*.png")):
        rel = a.relative_to(args.antes)
        b = args.despues / rel
        if not b.exists():
            filas.append((str(rel), None, "falta en después"))
            continue
        pct, nota = comparar(a, b, args.salida)
        filas.append((str(rel), pct, nota))
    for b in sorted(args.despues.rglob("*.png")):
        rel = b.relative_to(args.despues)
        if not (args.antes / rel).exists():
            filas.append((str(rel), None, "falta en antes"))

    # De más cambio a menos; las que faltan en "después", primero.
    for rel, pct, nota in sorted(filas, key=lambda f: -(101 if f[1] is None else f[1])):
        cifra = "  —  " if pct is None else f"{pct:6.2f} %"
        print(f"{cifra}  {rel}  {nota}".rstrip())
    iguales = sum(1 for _, pct, nota in filas if pct == 0 and not nota)
    print(f"\n{len(filas)} parejas, {iguales} idénticas")
    return 0


if __name__ == "__main__":
    sys.exit(main())
