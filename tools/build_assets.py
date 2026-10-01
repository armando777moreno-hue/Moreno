"""Genera las imágenes optimizadas de la tienda a partir de assets/originals/.

Uso:
    pip install -r tools/requirements.txt
    python3 tools/build_assets.py

Salida en assets/img/:
  - shirt-back.webp / shirt-front.webp  texturas RGBA (1024x1024) del visor 3D
  - shirt-height.png                    mapa de volumen (512x512) del visor 3D
  - *.jpg                               fotos recortadas/optimizadas para la web

La vista frontal no existe como foto: se programa a partir de la trasera
(se borra el estampado, se rellena con la textura de la tela y se dibuja
el cuello y el logo del pecho).
"""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy import ndimage as nd

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "originals"
OUT = ROOT / "assets" / "img"
TEX = 1024  # lado de las texturas del visor 3D

# Silueta de la camiseta en studio-back.jpg (1215x1295), trazada a mano.
SILHOUETTE = [
    (607, 223), (560, 224), (520, 227), (494, 234), (450, 243), (410, 253), (370, 276),
    (330, 308), (295, 368), (262, 428), (222, 500), (166, 600), (118, 690), (103, 712),
    (103, 722), (150, 751), (220, 789), (300, 830), (300, 900), (299, 1000), (298, 1080),
    (300, 1115), (450, 1118), (607, 1119), (760, 1116), (898, 1112), (897, 1080),
    (898, 1000), (898, 900), (899, 826), (970, 783), (1030, 750), (1079, 720), (1080, 708),
    (1052, 670), (1028, 620), (1000, 565), (972, 510), (934, 452), (894, 400), (862, 345),
    (839, 305), (816, 282), (784, 262), (745, 246), (722, 234), (695, 227), (655, 224),
]
PRINT_BOX = (468, 296, 808, 1014)  # x0, y0, x1, y1 del estampado trasero
CHEST_X = 599
SERIF = "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"


def shirt_mask(im: Image.Image) -> np.ndarray:
    """Polígono + umbral de luminancia: quita el fondo oscuro pegado a la silueta."""
    a = np.asarray(im).astype(np.float32)
    m = Image.new("L", im.size, 0)
    ImageDraw.Draw(m).polygon(SILHOUETTE, fill=255)
    poly = np.asarray(m.filter(ImageFilter.MaxFilter(5))) > 0
    cand = (~poly) | (a.mean(2) < 95)
    lab, _ = nd.label(cand)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    shirt = ~np.isin(lab, list(border))
    # El interior del polígono siempre es prenda: las costuras oscuras del hombro
    # tocan el borde y si no se protegen abren muescas en la silueta.
    inner = np.asarray(m.filter(ImageFilter.MinFilter(61))) > 0
    shirt = nd.binary_closing(shirt | inner, iterations=4)
    shirt = nd.binary_fill_holes(nd.binary_opening(shirt, iterations=2))
    lab, n = nd.label(shirt)
    sizes = nd.sum(shirt, lab, range(1, n + 1))
    shirt = lab == (np.argmax(sizes) + 1)
    # Junto al cuello el fondo es algo más claro: limpiar la franja del borde superior.
    band = shirt & ~nd.binary_erosion(shirt, iterations=14)
    band[300:] = False
    shirt &= ~(band & (a.mean(2) < 135))
    shirt = nd.binary_fill_holes(nd.binary_closing(nd.binary_opening(shirt, iterations=2), iterations=5))
    return nd.binary_erosion(shirt, iterations=2)  # sin halo del fondo


def programmed_front(im: Image.Image, shirt: np.ndarray) -> Image.Image:
    img = np.asarray(im).astype(np.float32)
    h, w = shirt.shape
    x0, y0, x1, y1 = PRINT_BOX
    hole = np.zeros((h, w), np.float32)
    hole[y0:y1, x0:x1] = 1
    hole[840:915, 425:470] = 1  # sombra del caballete
    hole = np.clip(cv2.GaussianBlur(hole, (0, 0), 16) * 2.2, 0, 1)
    eroded = cv2.erode(shirt.astype(np.uint8), np.ones((9, 9))) > 0
    known = ((hole < 0.02) & eroded).astype(np.float32)

    # Sombreado de baja frecuencia: convolución normalizada a varias escalas.
    num, den = 0, 0
    for sigma in (12, 30, 70, 150):
        num = num + cv2.GaussianBlur(img * known[..., None], (0, 0), sigma, borderType=cv2.BORDER_REFLECT)
        den = den + cv2.GaussianBlur(known, (0, 0), sigma, borderType=cv2.BORDER_REFLECT)[..., None]
    low = num / np.maximum(den, 1e-6)

    # Textura de la tela: parches de alta frecuencia mezclados con ventanas Hann.
    patch = img[850:1090, 310:465]
    hp = patch - cv2.GaussianBlur(patch, (0, 0), 6)
    ph, pw = hp.shape[:2]
    win = (np.hanning(ph)[:, None] * np.hanning(pw)[None, :]).astype(np.float32)[..., None]
    acc = np.zeros_like(img)
    w2 = np.zeros((h, w, 1), np.float32)
    rng = np.random.default_rng(3)
    for _ in range(900):
        y = int(rng.integers(-ph // 2, h - ph // 2))
        x = int(rng.integers(-pw // 2, w - pw // 2))
        t = hp[:, ::-1] if rng.random() < 0.5 else hp
        t = t[::-1] if rng.random() < 0.5 else t
        ya, xa, yb, xb = max(y, 0), max(x, 0), min(y + ph, h), min(x + pw, w)
        acc[ya:yb, xa:xb] += (t * win)[ya - y:yb - y, xa - x:xb - x]
        w2[ya:yb, xa:xb] += win[ya - y:yb - y, xa - x:xb - x] ** 2
    tex = acc / np.sqrt(np.maximum(w2, 1e-6)) * 0.85

    out = img * (1 - hole[..., None]) + (low + tex) * hole[..., None]
    front = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))

    # Escote delantero bajo el cuello trasero.
    cx = CHEST_X
    shade = Image.new("RGBA", front.size, (0, 0, 0, 0))
    ImageDraw.Draw(shade).chord([cx - 104, 196, cx + 104, 296], 0, 180, fill=(150, 136, 120, 150))
    shade = shade.filter(ImageFilter.GaussianBlur(3))
    front.paste(shade, (0, 0), shade)
    d = ImageDraw.Draw(front, "RGBA")
    d.arc([cx - 112, 188, cx + 112, 306], 8, 172, fill=(214, 199, 183, 255), width=15)
    d.arc([cx - 112, 188, cx + 112, 306], 8, 172, fill=(190, 175, 158, 200), width=2)
    d.arc([cx - 98, 202, cx + 98, 292], 10, 170, fill=(178, 163, 146, 180), width=2)

    # Logo del pecho. La textura se espeja después (to_texture), así que el logo se
    # dibuja en una capa espejada respecto al mismo eje para que se lea bien.
    ys, xs = np.where(shirt)
    axis = (xs.min() + xs.max()) / 2
    layer = Image.new("RGBA", front.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    f1, f2 = ImageFont.truetype(SERIF, 34), ImageFont.truetype(SERIF, 24)
    w1, w2_ = ld.textlength("MORENO", font=f1), ld.textlength(".co", font=f2)
    tx, ty = axis - (w1 + w2_) / 2, 380
    ld.text((tx, ty), "MORENO", font=f1, fill=(28, 24, 22, 235))
    ld.text((tx + w1 + 1, ty + 9), ".co", font=f2, fill=(28, 24, 22, 235))
    ld.line([axis - 26, ty + 48, axis + 26, ty + 48], fill=(28, 24, 22, 200), width=2)
    flipped = layer.transpose(Image.FLIP_LEFT_RIGHT)
    shift = int(round(2 * axis - (front.width - 1)))
    mirrored = Image.new("RGBA", front.size, (0, 0, 0, 0))
    mirrored.paste(flipped, (shift, 0))
    front.paste(mirrored, (0, 0), mirrored)
    return front


def to_texture(rgb: Image.Image, shirt: np.ndarray, mirror: bool) -> Image.Image:
    """Recorta a la silueta y centra en un lienzo cuadrado transparente."""
    ys, xs = np.where(shirt)
    cx = (xs.min() + xs.max()) / 2
    half = max(cx - xs.min(), xs.max() - cx, (ys.max() - ys.min()) / 2) + 8
    cy = (ys.min() + ys.max()) / 2
    box = tuple(int(round(v)) for v in (cx - half, cy - half, cx + half, cy + half))
    alpha = Image.fromarray((shirt * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))
    rgba = rgb.copy()
    rgba.putalpha(alpha)
    rgba = rgba.crop(box).resize((TEX, TEX), Image.LANCZOS)
    return rgba.transpose(Image.FLIP_LEFT_RIGHT) if mirror else rgba


def height_map(tex: Image.Image) -> Image.Image:
    """Volumen: 0 en el borde, sube suave hacia dentro (efecto 'almohada')."""
    a = np.asarray(tex.split()[3].resize((512, 512), Image.BILINEAR)) > 127
    # La altura llega a 0 un poco antes del borde de la transparencia: así frente y
    # espalda coinciden en el canto y no queda una rendija al girar.
    dist = nd.distance_transform_edt(nd.binary_erosion(a, iterations=4))
    r = 44.0  # px (a 512) hasta alcanzar el grosor máximo
    t = np.clip(dist / r, 0, 1)
    hgt = 1 - (1 - t) ** 2
    return Image.fromarray((hgt * 255).astype(np.uint8))


def remove_marks(im: Image.Image, boxes) -> Image.Image:
    """Borra los logos/iconos impresos en las fotos de campaña (la web ya tiene los suyos)."""
    a = np.asarray(im.convert("RGB")).copy()
    mask = np.zeros(a.shape[:2], np.uint8)
    for x0, y0, x1, y1 in boxes:
        mask[y0:y1, x0:x1] = 255
    return Image.fromarray(cv2.inpaint(a, mask, 9, cv2.INPAINT_TELEA))


def save_jpg(im: Image.Image, name: str, max_w: int = 1400) -> None:
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    im.convert("RGB").save(OUT / name, quality=84, optimize=True, progressive=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    studio = Image.open(SRC / "studio-back.jpg").convert("RGB")
    shirt = shirt_mask(studio)

    back = to_texture(studio, shirt, mirror=False)
    # El frente se espeja para que su silueta coincida con la trasera al girar 180°.
    front = to_texture(programmed_front(studio, shirt), shirt, mirror=True)
    back.save(OUT / "shirt-back.webp", quality=90, method=6)
    front.save(OUT / "shirt-front.webp", quality=90, method=6)
    height_map(back).save(OUT / "shirt-height.png", optimize=True)

    save_jpg(remove_marks(studio, [(55, 70, 335, 152), (1045, 70, 1170, 142)]), "studio-back.jpg")
    save_jpg(studio.crop((470, 290, 800, 1010)), "print-art.jpg", 900)
    save_jpg(remove_marks(Image.open(SRC / "model-back.jpg"), [(60, 85, 340, 165)]), "model-back.jpg")

    collage = Image.open(SRC / "collage.jpg").convert("RGB")
    for name, box in {
        "model-back-2.jpg": (0, 0, 682, 835),
        "flatlay-back.jpg": (686, 0, 1254, 835),
        "model-side.jpg": (0, 840, 310, 1254),
        "print-detail.jpg": (313, 840, 702, 1254),
        "collar-label.jpg": (705, 840, 1001, 1254),
        "side-tag.jpg": (1004, 840, 1254, 1254),
    }.items():
        save_jpg(collage.crop(box), name)

    save_jpg(Image.open(SRC / "la-perla-dusk.jpg"), "la-perla-dusk.jpg", 1200)
    save_jpg(Image.open(SRC / "la-perla-night.jpg"), "la-perla-night.jpg", 1200)
    print("OK ->", OUT)


if __name__ == "__main__":
    main()
