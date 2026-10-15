"""Neumorphic flat-lay tee mockups for MORENO.co Drop 001.

Usage: python3 -I tools/build_mockups.py assets/img/drop-001 tienda-neomorfismo/mockups/drop-001 [design-colour ...]
Reads the transparent artwork from tools/extract_drop_art.py and produces, per design and colour,
espalda (back, big print), frente (front, chest print) and detalle (close-up of the back print),
2000x2500 on the theme background (#E9E4DC) with neumorphic shadows.
"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ART, OUT = sys.argv[1], sys.argv[2]
W, H = 2000, 2500
BG = np.array([233, 228, 220], float)          # theme --bg #e9e4dc
SHADOW = np.array([196, 188, 176], float)
LIGHT = np.array([251, 249, 245], float)
SHIRT = {'black': np.array([31, 30, 29], float), 'cream': np.array([232, 225, 208], float)}
rng = np.random.default_rng(7)


def smooth_mask(poly, blur=10, ss=2):
    """Polygon -> anti-aliased mask with rounded corners."""
    im = Image.new('L', (W * ss, H * ss), 0)
    ImageDraw.Draw(im).polygon([(x * ss, y * ss) for x, y in poly], fill=255)
    im = im.filter(ImageFilter.GaussianBlur(blur * ss))
    a = np.asarray(im, float) / 255
    a = np.clip((a - 0.5) * 6 + 0.5, 0, 1)        # re-threshold: rounded, crisp edge
    return np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize((W, H), Image.LANCZOS), float) / 255


def blur(a, r):
    return np.asarray(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)), float) / 255


def shift(a, dx, dy):
    return np.roll(np.roll(a, dy, 0), dx, 1)


def bezier(p0, p1, p2, n=40):
    t = np.linspace(0, 1, n)[:, None]
    return list(map(tuple, (1 - t) ** 2 * np.array(p0) + 2 * (1 - t) * t * np.array(p1) + t ** 2 * np.array(p2)))


def tee_outline(cx, top, s):
    """Oversized drop-shoulder tee, symmetric, scale s (1.0 = 2000px canvas)."""
    def P(x, y):
        return (cx + x * s, top + y * s)
    neck = 175
    right = [P(neck, 0), P(560, 85), P(905, 405), P(700, 640), P(565, 545), P(575, 1520)]
    hem = bezier(P(575, 1520), P(0, 1548), P(-575, 1520), 30)
    left = [(2 * cx - x, y) for x, y in reversed(right)]
    back_neck = bezier(P(-neck, 0), P(0, 22), P(neck, 0), 20)
    pts = np.array(back_neck + right + hem[1:-1] + left, float)
    dense = []
    for a, b in zip(pts, np.roll(pts, -1, 0)):
        n = max(2, int(np.hypot(*(b - a)) / 6))
        for t in np.linspace(0, 1, n, endpoint=False):
            dense.append(a + (b - a) * t)
    dense = np.array(dense)
    k = len(dense)
    ph = np.random.default_rng(3).uniform(0, 6.28, 3)
    i = np.arange(k) / k * 6.2832
    wob = (np.sin(i * 9 + ph[0]) * 2.2 + np.sin(i * 23 + ph[1]) * 1.2 + np.sin(i * 51 + ph[2]) * 0.6) * s
    tang = np.roll(dense, -1, 0) - np.roll(dense, 1, 0)
    nrm = np.stack([tang[:, 1], -tang[:, 0]], 1)
    nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-6)
    dense = dense + nrm * wob[:, None]
    return list(map(tuple, dense))


def line_layer(points, width, s=1):
    im = Image.new('L', (W, H), 0)
    ImageDraw.Draw(im).line(points, fill=255, width=width, joint='curve')
    return np.asarray(im, float) / 255


def dashed(points, width, dash=14, gap=10):
    im = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(im)
    pts = np.array(points, float)
    seg = np.sqrt((np.diff(pts, axis=0) ** 2).sum(1))
    dist = np.concatenate([[0], np.cumsum(seg)])
    total, pos = dist[-1], 0.0
    while pos < total:
        a, b = pos, min(pos + dash, total)
        pa = [np.interp(a, dist, pts[:, k]) for k in range(2)]
        pb = [np.interp(b, dist, pts[:, k]) for k in range(2)]
        d.line([tuple(pa), tuple(pb)], fill=255, width=width)
        pos += dash + gap
    return np.asarray(im, float) / 255


def fabric_noise():
    n = rng.normal(0, 1, (H, W))
    fine = blur((n * 0.12 + 0.5), 0.6) - 0.5
    weave = (np.sin(np.arange(W)[None, :] * 1.9) * np.sin(np.arange(H)[:, None] * 1.9)) * 0.012
    coarse = blur(rng.normal(0.5, 0.25, (H, W)), 18) - 0.5
    return fine * 0.55 + weave + coarse * 0.35


def render(design, colour, view, zoom=1.0, focus=None):
    s = 1.02 * zoom
    cx, top = W / 2, 470
    if zoom != 1.0:
        fx, fy = focus
        cx = W / 2 + (W / 2 - fx) * zoom
        top = H / 2 + (470 - fy) * zoom
    outline = tee_outline(cx, top, s)
    m = smooth_mask(outline, blur=9 * zoom)

    # background with grain
    img = np.ones((H, W, 3)) * BG
    img += (rng.normal(0, 1.4, (H, W)))[..., None]
    # neumorphic shadows (dark bottom-right, light top-left)
    dark = blur(shift(m, int(38 * zoom), int(48 * zoom)), 46 * zoom) * 0.95
    light = blur(shift(m, int(-30 * zoom), int(-30 * zoom)), 40 * zoom) * 0.9
    img = img * (1 - dark[..., None]) + SHADOW * dark[..., None]
    img = img * (1 - light[..., None] * 0.85) + LIGHT * (light[..., None] * 0.85)

    base = SHIRT[colour]
    dk = colour == 'black'
    # volume: inner highlight top-left, inner shade bottom-right
    inner_hi = np.clip(m - shift(blur(m, 26 * zoom), int(22 * zoom), int(22 * zoom)), 0, 1)
    inner_sh = np.clip(m - shift(blur(m, 34 * zoom), int(-26 * zoom), int(-26 * zoom)), 0, 1)
    yy, xx = np.mgrid[0:H, 0:W]
    light_grad = 1 + 0.05 * (1 - (xx / W + yy / H))   # brighter top-left
    shade = light_grad + (inner_hi * (0.22 if dk else 0.05)) - (inner_sh * (0.10 if dk else 0.13))

    # soft folds
    folds = np.zeros((H, W))
    fold_lines = [
        ((cx - 330 * s, top + 700 * s), (cx - 160 * s, top + 1150 * s), (cx - 260 * s, top + 1500 * s), 1),
        ((cx + 300 * s, top + 640 * s), (cx + 380 * s, top + 1100 * s), (cx + 250 * s, top + 1480 * s), -1),
        ((cx - 620 * s, top + 330 * s), (cx - 600 * s, top + 470 * s), (cx - 690 * s, top + 600 * s), -1),
        ((cx + 640 * s, top + 330 * s), (cx + 640 * s, top + 460 * s), (cx + 720 * s, top + 590 * s), 1),
        ((cx - 60 * s, top + 1250 * s), (cx + 120 * s, top + 1380 * s), (cx + 60 * s, top + 1520 * s), 1),
    ]
    for p0, p1, p2, sign in fold_lines:
        l = line_layer(bezier(p0, p1, p2), int(30 * s))
        folds += sign * blur(l, 34 * s) * 0.9
        folds -= sign * blur(shift(l, int(26 * s), int(10 * s)), 34 * s) * 0.6
    shade = shade + folds * (0.18 if dk else 0.11)

    tex = fabric_noise()
    fabric = base[None, None, :] * shade[..., None] + tex[..., None] * (34 if dk else 26)

    # collar
    neck = 175 * s
    if view == 'frente':
        front_curve = bezier((cx - neck, top), (cx, top + 240 * s), (cx + neck, top), 60)
        back_curve = bezier((cx - neck, top), (cx, top + 22 * s), (cx + neck, top), 40)
        opening = smooth_mask(back_curve + list(reversed(front_curve)), blur=3)
        inside = (base * np.array([0.80, 0.77, 0.72])) if not dk else base * 0.72
        fabric = fabric * (1 - opening[..., None]) + (inside + tex[..., None] * 12) * opening[..., None]
        rib = line_layer(front_curve, int(44 * s))
        rib_edge = line_layer(bezier((cx - neck, top), (cx, top + 262 * s), (cx + neck, top), 60), int(4 * s))
    else:
        back_curve = bezier((cx - neck, top + 2), (cx, top + 58 * s), (cx + neck, top + 2), 50)
        rib = line_layer(back_curve, int(36 * s))
        rib_edge = line_layer(bezier((cx - neck, top + 20 * s), (cx, top + 78 * s), (cx + neck, top + 20 * s), 50), int(4 * s))
    rib = blur(rib, 1.2) * m
    rib_lines = (np.sin((xx - cx) * 0.9 / max(s, 0.5)) > 0.6) * 0.04
    rib_col = base * (1.06 if dk else 0.97) * (1 - rib_lines[..., None])
    fabric = fabric * (1 - rib[..., None]) + (rib_col + tex[..., None] * 18) * rib[..., None]
    re = (blur(rib_edge, 1.5) * m)[..., None]
    fabric = fabric + re * (-30 if not dk else 18)

    # seams + stitching
    seam_col = -0.18 if not dk else 0.35
    for side in (-1, 1):
        sx = lambda x: cx + side * x * s
        seam = bezier((sx(560), top + 85 * s), (sx(548), top + 330 * s), (sx(565), top + 545 * s), 40)
        fabric += (blur(line_layer(seam, int(3 * s)), 1.2) * seam_col * 40)[..., None]
        cuff = bezier((sx(868), top + 448 * s), (sx(790), top + 540 * s), (sx(700), top + 600 * s), 30)
        fabric += (dashed(cuff, int(3 * s), int(12 * s), int(9 * s)) * seam_col * 45)[..., None]
    hem_st = bezier((cx - 560 * s, top + 1468 * s), (cx, top + 1496 * s), (cx + 560 * s, top + 1468 * s), 80)
    fabric += (dashed(hem_st, int(3 * s), int(12 * s), int(9 * s)) * seam_col * 45)[..., None]

    # print
    art = Image.open(f'{ART}/art-{design}-{colour}.png')
    if view == 'espalda':
        pw = 500 * s
        pc = (cx, top + 250 * s)
    else:
        pw = 165 * s
        pc = (cx + 250 * s, top + 330 * s)
    ph = pw * art.height / art.width
    art = art.resize((int(pw), int(ph)), Image.LANCZOS)
    a = np.asarray(art, float)
    layer = np.zeros((H, W, 4))
    x0, y0 = int(pc[0] - pw / 2), int(pc[1])
    x1, y1 = x0 + a.shape[1], y0 + a.shape[0]
    cx0, cy0, cx1, cy1 = max(x0, 0), max(y0, 0), min(x1, W), min(y1, H)
    if cx1 > cx0 and cy1 > cy0:
        layer[cy0:cy1, cx0:cx1] = a[cy0 - y0:cy1 - y0, cx0 - x0:cx1 - x0]
    alpha = layer[..., 3] / 255 * m
    ink = 0.93 + 0.07 * blur(rng.normal(0.5, 0.35, (H, W)), 0.8)   # slight cracked-ink texture
    alpha = alpha * ink
    print_col = layer[..., :3] * np.clip(shade, 0.75, 1.2)[..., None] + tex[..., None] * 16
    fabric = fabric * (1 - alpha[..., None]) + print_col * alpha[..., None]

    img = img * (1 - m[..., None]) + fabric * m[..., None]
    img = np.clip(img, 0, 255).astype(np.uint8)
    return Image.fromarray(img, 'RGB')


if __name__ == '__main__':
    only = sys.argv[3:] if len(sys.argv) > 3 else None
    for design in ['perro-que-ladra', 'ojo-por-ojo', 'cria-cuervos']:
        for colour in ['black', 'cream']:
            if only and f'{design}-{colour}' not in only:
                continue
            for view in ['espalda', 'frente']:
                im = render(design, colour, view)
                im.save(f'{OUT}/{design}-{colour}-{view}.jpg', quality=88, optimize=True, progressive=True)
            det = render(design, colour, 'espalda', zoom=2.0, focus=(W / 2, 470 + 250 * 1.02 + 300))
            det.save(f'{OUT}/{design}-{colour}-detalle.jpg', quality=88, optimize=True, progressive=True)
            print('ok', design, colour)
