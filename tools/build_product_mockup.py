"""Supplier photo -> MORENO.co neumorphic product mockup.

Usage:
  python3 -I tools/build_product_mockup.py <in.jpg|png> <out.jpg> [--fill 0.78] [--contact] [--cut cut.png]

1. Removes the background with rembg (isnet-general-use), unless the input PNG already has alpha.
2. Trims to the product, scales it to the same footprint on every photo (`--fill` of the
   2000x2500 frame's limiting side) and centres it a little above the middle.
3. Places it on the theme sand (#E9E4DC) with the same neumorphic light/shadow pair and grain
   as the Drop 001 mockups (tools/build_mockups.py). --contact adds a soft floor shadow
   for objects that stand (shoes, caps); flat-lay garments don't get one.

The product pixels are never repainted: only the background is replaced, so colour, logo and
details stay exactly as the supplier photographed them.
"""
import argparse
import numpy as np
from PIL import Image, ImageFilter

W, H = 2000, 2500
BG = np.array([233, 228, 220], float)       # --mn-fondo #E9E4DC
SHADOW = np.array([196, 188, 176], float)
LIGHT = np.array([251, 249, 245], float)


def cutout(path):
    im = Image.open(path)
    if im.mode == 'RGBA' and np.asarray(im)[..., 3].min() < 250:
        return im
    from rembg import remove, new_session
    return remove(im.convert('RGB'), session=new_session('isnet-general-use'))


def blur(a, r):
    return np.asarray(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)), float) / 255


def shift(a, dx, dy):
    out = np.zeros_like(a)
    ys = slice(max(dy, 0), H + min(dy, 0)); yd = slice(max(-dy, 0), H + min(-dy, 0))
    xs = slice(max(dx, 0), W + min(dx, 0)); xd = slice(max(-dx, 0), W + min(-dx, 0))
    out[ys, xs] = a[yd, xd]
    return out


def compose(rgba, fill=0.78, seed=7, contact=False):
    a = np.asarray(rgba, float)
    alpha = a[..., 3] / 255
    ys, xs = np.where(alpha > 0.05)
    if not len(xs):
        raise SystemExit('no product found in the cut-out')
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    prod = rgba.crop(box)
    pw, ph = prod.size
    k = min(W * fill / pw, H * fill / ph)
    prod = prod.resize((max(1, round(pw * k)), max(1, round(ph * k))), Image.LANCZOS)
    pw, ph = prod.size
    x0, y0 = (W - pw) // 2, int((H - ph) * 0.44)

    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    layer.paste(prod, (x0, y0), prod)
    L = np.asarray(layer, float)
    m = L[..., 3] / 255

    rng = np.random.default_rng(seed)
    img = np.ones((H, W, 3)) * BG + rng.normal(0, 1.4, (H, W))[..., None]
    s = max(pw, ph) / 1600                       # shadows scale with the product
    dark = blur(shift(m, int(34 * s), int(44 * s)), 44 * s) * 0.9
    light = blur(shift(m, int(-28 * s), int(-28 * s)), 38 * s) * 0.85
    img = img * (1 - dark[..., None]) + SHADOW * dark[..., None]
    img = img * (1 - light[..., None]) + LIGHT * light[..., None]
    # contact shadow: a flattened, blurred band right under the lowest product pixels
    rows = np.where(m.max(1) > 0.5)[0]
    if contact and len(rows):
        bottom = rows.max()
        band = np.zeros((H, W))
        cols = np.where(m[max(bottom - int(40 * s), 0):bottom + 1].max(0) > 0.5)[0]
        if len(cols):
            # elliptical, centred and narrower than the footprint: reads as an object resting on the floor
            cx, half = (cols.min() + cols.max()) / 2, (cols.max() - cols.min()) * 0.42
            yy, xx = np.mgrid[0:H, 0:W]
            band = np.clip(1 - ((xx - cx) / max(half, 1)) ** 2 - ((yy - bottom - 8 * s) / (14 * s)) ** 2, 0, 1)
            shade = blur(band, 16 * s) * 0.32
            img = img * (1 - shade[..., None]) + np.array([150, 140, 126], float) * shade[..., None]
    img = img * (1 - m[..., None]) + L[..., :3] * m[..., None]
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('out')
    ap.add_argument('--fill', type=float, default=0.78)
    ap.add_argument('--cut', help='also save the transparent cut-out here (PNG)')
    ap.add_argument('--contact', action='store_true', help='floor contact shadow (shoes, caps, standing objects)')
    a = ap.parse_args()
    rgba = cutout(a.src)
    if a.cut:
        rgba.save(a.cut)
    compose(rgba, a.fill, contact=a.contact).save(a.out, quality=88, optimize=True, progressive=True)
    print('ok', a.out)
