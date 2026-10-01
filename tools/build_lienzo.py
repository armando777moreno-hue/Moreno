"""Texturas del visor 3D para "Lienzo — Acid Wash Oversized Tee" (producto de AutoDS en Shopify).

Uso:
    python3 tools/build_lienzo.py

Entrada: fotos del proveedor por color en assets/originals/lienzo/<color>.jpg
(camiseta de frente sobre fondo blanco, descargadas del producto en Shopify).
Salida en assets/img/lienzo/:
  - <color>.webp   textura RGBA 1024x1024 (recorte sobre transparente, centrado)
  - <color>-h.png  mapa de volumen 256x256 del visor
  - colors.json     color medio de cada foto (para los selectores de color)
El visor usa la misma foto, espejada, para la espalda.
"""
from pathlib import Path

import json

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "originals" / "lienzo"
OUT = ROOT / "assets" / "img" / "lienzo"
COLORS = ["onyx", "ink", "bone", "stone", "ash", "sand", "espresso", "oxblood", "midnight", "dusty-rose", "rose"]
TEX = 1024
FILL = 0.86  # ancho de la camiseta respecto al lienzo de la textura


def cutout(im: Image.Image) -> np.ndarray:
    """Máscara de la prenda: todo lo conectado al borde y casi blanco es fondo."""
    a = np.asarray(im.convert("RGB")).astype(np.int16)
    # Diferencia con el blanco del fondo; el umbral bajo permite separar camisetas claras.
    diff = 255 - a.min(axis=2)
    near_white = diff < 7
    lab, _ = nd.label(near_white)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    shirt = ~np.isin(lab, list(border))
    shirt = nd.binary_fill_holes(nd.binary_opening(shirt, iterations=2))
    lab, n = nd.label(shirt)
    sizes = nd.sum(shirt, lab, range(1, n + 1))
    shirt = lab == (np.argmax(sizes) + 1)
    return nd.binary_erosion(shirt, iterations=2)


def height_map(alpha: Image.Image) -> Image.Image:
    a = np.asarray(alpha.resize((256, 256), Image.BILINEAR)) > 127
    dist = nd.distance_transform_edt(nd.binary_erosion(a, iterations=2))
    t = np.clip(dist / 22.0, 0, 1)
    return Image.fromarray(((1 - (1 - t) ** 2) * 255).astype(np.uint8))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    swatches = {}
    for c in COLORS:
        im = Image.open(SRC / f"{c}.jpg").convert("RGB")
        m = cutout(im)
        ys, xs = np.where(m)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        alpha = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
        rgba = im.copy()
        rgba.putalpha(alpha)
        rgba = rgba.crop((x0, y0, x1, y1))
        w = round(TEX * FILL)
        h = round(rgba.height * w / rgba.width)
        if h > TEX * 0.94:  # camisetas más altas que anchas: limitar por alto
            h = round(TEX * 0.94)
            w = round(rgba.width * h / rgba.height)
        rgba = rgba.resize((w, h), Image.LANCZOS)
        canvas = Image.new("RGBA", (TEX, TEX), (0, 0, 0, 0))
        canvas.paste(rgba, ((TEX - w) // 2, (TEX - h) // 2))
        canvas.save(OUT / f"{c}.webp", quality=88, method=6)
        height_map(canvas.split()[3]).save(OUT / f"{c}-h.png", optimize=True)
        rgb = np.asarray(im)[nd.binary_erosion(m, iterations=20)].mean(axis=0)
        swatches[c] = '#%02x%02x%02x' % tuple(int(v) for v in rgb)
        print(c, (w, h), swatches[c])
    (OUT / "colors.json").write_text(json.dumps(swatches, indent=2) + "\n")


if __name__ == "__main__":
    main()
