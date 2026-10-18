"""Supplier photo -> MORENO.co neumorphic product mockup.

Usage:
  python3 tools/build_product_mockup.py <in.jpg|png> <out.jpg> [--fill 0.78] [--contact] [--cut cut.png]
  python3 tools/build_product_mockup.py <in.jpg> <out.jpg> --studio [--bands]
  (not -I: rembg lives in the user site-packages)

1. Removes the background with rembg (isnet-general-use), unless the input PNG already has alpha.
2. Trims to the product, scales it to the same footprint on every photo (`--fill` of the
   2000x2500 frame's limiting side) and centres it a little above the middle.
3. Places it on the theme sand (#E9E4DC) with the same neumorphic light/shadow pair and grain
   as the Drop 001 mockups (tools/build_mockups.py). --contact adds a soft floor shadow
   for objects that stand (shoes, caps); flat-lay garments don't get one.

The product pixels are never repainted: only the background is replaced, so colour, logo and
details stay exactly as the supplier photographed them.

--studio is for photos the frame crops (a model cut at the head or hips, a close-up of a shoe): a floating
cut-out of those reads as a torn fragment, so the framing is kept and only the backdrop becomes sand.
The matte is the union of rembg's u2net_human_seg and isnet-general-use; on a plain backdrop (white
or light grey seamless) a colour key from the frame edge also fills garments the nets half-erase, and
the nets only decide a thin band along the outline. Edges the subject touches stay on the frame edge
(scaled to the 2000x2500 height, or width), so the crop lands on the card's edge. --bands first crops
a flat padding band the supplier left under a product that is cut straight against it.
"""
import argparse
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

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


def matte(im):
    """Studio matte: (foreground colours with the backdrop removed from soft edges, alpha 0..1)."""
    from rembg import remove, new_session
    a = np.maximum(*(np.asarray(remove(im, session=new_session(m), only_mask=True), float) / 255
                     for m in ('u2net_human_seg', 'isnet-general-use')))
    rgb = np.asarray(im, float)
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    # backdrop = the light cluster on the frame edge (in close-ups most of the edge is the product itself)
    lum = border.mean(1)
    bgc = np.median(border[lum > np.percentile(lum, 97) - 30], 0)
    d = np.abs(border - bgc).max(1)
    frac = (d < 30).mean()
    noise = np.percentile(d[d < 30], 95) if frac > 0 else 99
    if frac > 0.05 and noise < 18 and bgc.mean() > 170:
        # plain backdrop: colour key = connected to the frame and close to the backdrop colour.
        # A clean white backdrop gets a tight key, so pale garments (a light blue polo) survive.
        tol = float(np.clip(noise * 2 + 4, 6, 22))
        lab, _ = ndimage.label(np.abs(rgb - bgc).max(2) < tol)
        edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
        bgmask = np.isin(lab, edge[edge > 0])
        key = 1 - ndimage.gaussian_filter(bgmask.astype(float), 1.2)
        # the key fills what the nets half-erase inside the subject; along the outline (where the JPEG
        # fringe lives) the nets decide
        inside = ndimage.binary_erosion(~bgmask, iterations=max(4, round(max(a.shape) * 0.012)))
        a = np.where(inside, np.maximum(a, key), np.minimum(a, key))
    a = np.clip(a, 0, 1)
    # loose fragments away from the figure (floor reflections, wall specks) are dropped
    lab, n = ndimage.label(a > 0.5)
    if n > 1:
        sizes = ndimage.sum(np.ones_like(a), lab, range(1, n + 1))
        a = a * ndimage.binary_dilation(np.isin(lab, 1 + np.flatnonzero(sizes >= sizes.max() * 0.02)), iterations=4)
    # take the backdrop colour out of semi-transparent edge pixels (no white halo on sand)
    aa = np.maximum(a, 0.08)[..., None]
    fg = np.where(a[..., None] > 0.97, rgb, np.clip((rgb - (1 - aa) * bgc) / aa, 0, 255))
    return fg, a


def unletterbox(im):
    """Crop a flat padding band the product is cut straight against (a floating product only meets it with a tip)."""
    rgb = np.asarray(im, float)
    box = [0, 0, rgb.shape[1], rgb.shape[0]]
    for side, i in (('top', 1), ('bottom', 3), ('left', 0), ('right', 2)):
        lines = {'top': rgb, 'bottom': rgb[::-1], 'left': rgb.transpose(1, 0, 2), 'right': rgb.transpose(1, 0, 2)[::-1]}[side]
        c = np.median(lines[0], 0)
        k = 0
        while k < len(lines) // 4 and np.abs(lines[k] - c).max(1).max() < 16:     # JPEG noise in the band
            k += 1
        cut = next((j for j in range(k, min(k + 8, len(lines))) if (np.abs(lines[j] - c).max(1) > 30).mean() > 0.3), None)
        if 0 < k < len(lines) // 4 and cut is not None:
            box[i] += cut if side in ('top', 'left') else -cut
    return im.crop(tuple(box))


def studio(im, bands=False):
    im = im.convert('RGB')
    if bands:
        im = unletterbox(im)
    fg, a = matte(im)
    h, w = a.shape
    t = {k: (line > 0.5).mean() > 0.005 for k, line in {'top': a[0], 'bottom': a[-1], 'left': a[:, 0], 'right': a[:, -1]}.items()}
    ys, xs = np.where(a > 0.3)
    if t['top'] or t['bottom']:
        s = H / h
    elif t['left'] or t['right']:
        s = W / w
    else:
        s = min(W * 0.8 / (np.ptp(xs) + 1), H * 0.82 / (np.ptp(ys) + 1))
    nw, nh = round(w * s), round(h * s)
    x0 = 0 if t['left'] else W - nw if t['right'] else round(W / 2 - (xs.min() + xs.max()) / 2 * s)
    y0 = 0 if t['top'] else H - nh if t['bottom'] else round(H * 0.47 - (ys.min() + ys.max()) / 2 * s)
    F = np.asarray(Image.fromarray(fg.astype(np.uint8)).resize((nw, nh), Image.LANCZOS), float)
    A = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize((nw, nh), Image.LANCZOS), float) / 255
    layerF, layerA = np.zeros((H, W, 3)), np.zeros((H, W))
    sx, sy, dx, dy = max(0, -x0), max(0, -y0), max(0, x0), max(0, y0)
    cw, ch = min(nw - sx, W - dx), min(nh - sy, H - dy)
    layerF[dy:dy + ch, dx:dx + cw] = F[sy:sy + ch, sx:sx + cw]
    layerA[dy:dy + ch, dx:dx + cw] = A[sy:sy + ch, sx:sx + cw]
    rng = np.random.default_rng(7)
    img = np.ones((H, W, 3)) * BG + rng.normal(0, 1.4, (H, W))[..., None]
    # a softer light/shadow pair than the floating mockups: the figure stands against the backdrop
    dark = blur(shift(layerA, 34, 30), 40) * 0.55
    light = blur(shift(layerA, -24, -24), 34) * 0.6
    img = img * (1 - dark[..., None]) + SHADOW * dark[..., None]
    img = img * (1 - light[..., None]) + LIGHT * light[..., None]
    img = img * (1 - layerA[..., None]) + layerF * layerA[..., None]
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('out')
    ap.add_argument('--fill', type=float, default=0.78)
    ap.add_argument('--cut', help='also save the transparent cut-out here (PNG)')
    ap.add_argument('--contact', action='store_true', help='floor contact shadow (shoes, caps, standing objects)')
    ap.add_argument('--studio', action='store_true', help='keep the framing, replace only the backdrop (cropped model shots, close-ups)')
    ap.add_argument('--bands', action='store_true', help='with --studio: crop a flat padding band the product is cut against')
    a = ap.parse_args()
    if a.studio:
        studio(Image.open(a.src), a.bands).save(a.out, quality=88, optimize=True, progressive=True)
        print('ok', a.out)
        raise SystemExit
    rgba = cutout(a.src)
    if a.cut:
        rgba.save(a.cut)
    compose(rgba, a.fill, contact=a.contact).save(a.out, quality=88, optimize=True, progressive=True)
    print('ok', a.out)
