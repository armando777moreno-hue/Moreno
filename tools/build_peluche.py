"""Peluche 3D para el visor 360° a partir de la hoja de vistas del proveedor.

Entrada: assets/originals/peluche/vistas.jpg (frente, derecha, espalda, izquierda y arriba
sobre blanco, en ese orden de izquierda a derecha).

Salida en assets/img/peluche/:
  atlas.webp   las 5 fotos recortadas en una sola textura, con el color de borde extendido
  modelo.bin   malla: posiciones Uint16 (xyz) + pesos por vista Uint8 (5) + índices Uint16
  modelo.json  cuántos vértices e índices hay, la caja de la malla y, para cada vista,
               cómo proyectar un punto 3D sobre su foto dentro del atlas

Cómo se arma el volumen: cada fila de altura toma su ancho de la foto de frente y su
fondo de la foto de lado, y se rellena con una superelipse (los peluches son redondos).
Si la foto muestra piezas separadas (piernas, brazos), cada pieza tiene su elipse.
Luego se suaviza y se extrae la superficie con marching cubes. El color sale de
proyectar las fotos reales: cada vértice mezcla las vistas que lo ven de frente y que
no tienen otra parte del peluche delante.
"""
from pathlib import Path
import json

import numpy as np
from PIL import Image
from scipy import ndimage as nd
from skimage import measure

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "originals" / "peluche" / "vistas.jpg"
OUT = ROOT / "assets" / "img" / "peluche"
NAMES = ["frente", "derecha", "espalda", "izquierda", "arriba"]
NY = 160          # resolución vertical del volumen (la altura del peluche vale 1)
EXP = 2.0         # exponente de la superelipse: 2 = elipse, más = más cuadrado
SHARP = 10        # cuánto manda la foto que mira de frente a cada punto (más = transiciones más cortas)
ATLAS = 1024


def views():
    im = Image.open(SRC).convert("RGB")
    a = np.asarray(im).astype(np.int16)
    near_white = (255 - a.min(axis=2)) < 10
    lab, _ = nd.label(near_white)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    fg = nd.binary_opening(~np.isin(lab, list(border)), iterations=1)
    lab, n = nd.label(fg)
    sizes = nd.sum(fg, lab, range(1, n + 1))
    objs = nd.find_objects(lab)
    keep = sorted([i + 1 for i, s in enumerate(sizes) if s > 30000], key=lambda k: objs[k - 1][1].start)
    assert len(keep) == 5, f"se esperaban 5 vistas, hay {len(keep)}"
    out = {}
    rgb = np.asarray(im)
    for name, k in zip(NAMES, keep):
        sl = objs[k - 1]
        mask = nd.binary_fill_holes(lab[sl] == k)
        out[name] = (rgb[sl].copy(), mask)
    return out


def bleed(rgb, mask):
    """Rellena el fondo con el color del borde más cercano (evita halos blancos al proyectar)."""
    inner = nd.binary_erosion(mask, iterations=1)
    _, (iy, ix) = nd.distance_transform_edt(~inner, return_indices=True)
    return rgb[iy, ix]


def intervals(row):
    """Tramos [a, b) donde la fila de la máscara está llena."""
    d = np.diff(np.concatenate([[0], row.astype(np.int8), [0]]))
    return list(zip(np.where(d == 1)[0], np.where(d == -1)[0]))


def pairs(fi, si, max_aspect=2.5):
    """Qué tramo de frente va con qué tramo de lado en una fila.

    El más ancho de cada foto forma el cuerpo. Cada pieza suelta (brazo, pierna, cola) se
    une a la pieza de la otra foto con proporciones más parecidas; si ninguna se parece
    (p. ej. la cola de lado contra todo el ancho del cuerpo de frente, que daría una aleta),
    la pieza se hace redonda, centrada en el cuerpo.
    """
    if not fi or not si:
        return []
    mf = max(range(len(fi)), key=lambda i: fi[i][1])
    ms = max(range(len(si)), key=lambda i: si[i][1])
    out = {(fi[mf], si[ms])}
    aspect = lambda a, b: max(a[1], b[1]) / min(a[1], b[1])
    for i, f in enumerate(fi):
        if i == mf:
            continue
        j = min(range(len(si)), key=lambda j: aspect(f, si[j]))
        out.add((f, si[j]) if aspect(f, si[j]) < max_aspect else (f, (si[ms][0], f[1])))
    for j, g in enumerate(si):
        if j == ms:
            continue
        i = min(range(len(fi)), key=lambda i: aspect(fi[i], g))
        out.add((fi[i], g) if aspect(fi[i], g) < max_aspect else ((fi[mf][0], g[1]), g))
    return out


def brown(rgb, mask):
    """Píxeles café oscuro (cuernos, hocico, patas) dentro de la silueta."""
    a = rgb.astype(np.int16)
    return mask & (a.sum(2) < 330) & (a[..., 0] > a[..., 2] + 15)


def blobs_x(m, top_frac):
    """Centros horizontales de las manchas café en la franja superior (los cuernos)."""
    band = np.zeros_like(m)
    band[: int(m.shape[0] * top_frac)] = m[: int(m.shape[0] * top_frac)]
    lab, n = nd.label(band)
    if n == 0:
        return []
    sizes = nd.sum(band, lab, range(1, n + 1))
    keep = [i + 1 for i, sz in enumerate(sizes) if sz > 12]
    return sorted(nd.center_of_mass(band, lab, keep), key=lambda c: c[1])


def eyes(rgb, mask, top_frac=0.5):
    """Ojos: manchas casi negras en la mitad superior. Devuelve (fila, columna) de cada una."""
    a = rgb.astype(np.int16)
    dark = mask & (a.max(2) < 70) & (a[..., 0] - a[..., 2] < 16)   # negro, no café
    dark[int(mask.shape[0] * top_frac):] = False
    lab, n = nd.label(dark)
    if n == 0:
        return []
    sizes = nd.sum(dark, lab, range(1, n + 1))
    keep = [i + 1 for i, sz in enumerate(sizes) if sz > 8]
    return sorted(nd.center_of_mass(dark, lab, keep), key=lambda c: c[1])


def warp_rows(rgb, mask, eye, target, nose_left, reach):
    """Desplaza en horizontal el ojo de una foto de lado hasta la columna `target`.

    Cada fila se estira por tramos: el borde de la nariz y el de la nuca no se mueven y el
    ojo va a su sitio. El efecto se apaga suavemente al alejarse del ojo (`reach` filas).
    """
    out_rgb, out_mask = rgb.copy(), mask.copy()
    h, w = mask.shape
    er, ec = eye
    cols = np.arange(w, dtype=np.float32)
    for r in range(max(0, int(er - reach)), min(h, int(er + reach) + 1)):
        xs = np.where(mask[r])[0]
        if len(xs) < 4:
            continue
        f = 0.5 * (1 + np.cos(np.pi * min(1.0, abs(r - er) / reach)))
        a, b = (xs.min(), xs.max()) if nose_left else (xs.max(), xs.min())
        # Mapa salida -> origen: borde nariz fijo, target -> ojo, borde nuca fijo.
        src = np.interp(cols, sorted([a, target, b]), [a, ec, b] if a < b else [b, ec, a])
        src = cols + f * (src - cols)
        si = np.clip(np.round(src).astype(int), 0, w - 1)
        out_rgb[r] = rgb[r, si]
        out_mask[r] = mask[r, si]
    return out_rgb, out_mask


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    v = views()
    sil = {name: nd.binary_erosion(m, iterations=3) for name, (_, m) in v.items()}

    # --- Escala común: cada foto de lado mide 1 de alto (de la punta de los cuernos al suelo) ---
    fr_rgb, fr = v["frente"]
    sd_rgb, sd = v["derecha"]
    H = NY
    # Re-muestrea las siluetas a NY filas manteniendo la proporción.
    def resample(mask):
        h, w = mask.shape
        W = max(1, round(w * H / h))
        return np.asarray(Image.fromarray(mask.astype(np.uint8) * 255).resize((W, H), Image.BILINEAR)) > 127
    F = resample(fr)            # filas = altura (arriba -> abajo), columnas = x
    S = resample(sd)            # columnas = z, con la nariz a la izquierda (cámara en +x)
    NX, NZ = F.shape[1], S.shape[1]
    pad = 4
    occ = np.zeros((NX + 2 * pad, H + 2 * pad, NZ + 2 * pad), np.float32)   # [x, y, z], y hacia arriba
    xs = np.arange(NX)[:, None] + 0.5
    zs = np.arange(NZ)[None, :] + 0.5
    for r in range(H):
        y = H - 1 - r
        # Tramos como (centro, radio). La foto de lado tiene la nariz a la izquierda: su
        # columna 0 es el frente (+z).
        fi = [((a + b) / 2, max((b - a) / 2, 0.5)) for a, b in intervals(F[r])]
        si = [(NZ - (c + d) / 2, max((d - c) / 2, 0.5)) for c, d in intervals(S[r])]
        slab = np.zeros((NX, NZ), bool)
        for (cx, rx), (cz, rz) in pairs(fi, si):
            slab |= (np.abs((xs - cx) / rx) ** EXP + np.abs((zs - cz) / rz) ** EXP) <= 1
        occ[pad:pad + NX, pad + y, pad:pad + NZ] = slab
    field = nd.gaussian_filter(occ, 1.0)
    verts, faces, normals, _ = measure.marching_cubes(field, 0.5, step_size=2, allow_degenerate=False)
    print("vértices", len(verts), "triángulos", len(faces))
    solid = field > 0.5

    # --- Ojos de las fotos de lado alineados con los de frente sobre el volumen ---
    sf = H / fr.shape[0]
    fe = eyes(fr_rgb, fr)
    assert len(fe) == 2, fe
    for name, nose_left, eye_x in (("derecha", True, fe[1]), ("izquierda", False, fe[0])):
        rgb, mask = v[name]
        se = eyes(rgb, mask)
        if len(se) != 1:
            print("sin ojo claro en", name, se); continue
        xi = int(round(pad + eye_x[1] * sf)); yi = int(round(pad + H - 1 - eye_x[0] * sf))
        zf = np.where(solid[xi, yi])[0].max()           # punto del frente donde cae el ojo
        k = mask.shape[0] / H
        czv = pad + NZ / 2
        target = mask.shape[1] / 2 + (k * (czv - zf) if nose_left else k * (zf - czv))
        reach = 0.16 * mask.shape[0]
        v[name] = warp_rows(rgb, mask, se[0], target, nose_left, reach)
        print("ojo", name, "columna", round(se[0][1], 1), "->", round(target, 1))

    # --- Atlas: las 5 fotos (sin escalar) con el color de borde extendido ---
    atlas = Image.new("RGB", (ATLAS, ATLAS), (214, 199, 178))
    rects, x, y, rowh = {}, 8, 8, 0
    for name in NAMES:
        rgb, mask = v[name]
        h, w = mask.shape
        if x + w + 8 > ATLAS:
            x, y, rowh = 8, y + rowh + 16, 0
        tile = np.zeros((h + 16, w + 16, 3), np.uint8)
        m = np.pad(mask, 8)
        tile[8:8 + h, 8:8 + w] = rgb
        atlas.paste(Image.fromarray(bleed(tile, m)), (x - 8, y - 8))
        rects[name] = (x, y, w, h)
        x, rowh = x + w + 16, max(rowh, h)
    atlas.save(OUT / "atlas.webp", quality=88, method=6)
    # Recortes con transparencia para el respaldo sin WebGL (tarjeta que voltea).
    for name in ("frente", "espalda"):
        rgb, mask = v[name]
        side = max(mask.shape) + 24
        sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        cut = Image.fromarray(np.dstack([rgb, (nd.binary_erosion(mask) * 255).astype(np.uint8)]))
        sq.paste(cut, ((side - mask.shape[1]) // 2, side - mask.shape[0] - 12))
        sq.save(OUT / f"{name}.webp", quality=88, method=6)

    # --- Proyección de cada vista: punto del volumen (x, y, z en celdas) -> uv del atlas ---
    # Cada foto se escala para medir lo mismo que el volumen: alto NY (vistas de lado) y,
    # para la de arriba, el mismo ancho que la de frente; se centra por su caja.
    proj = {}
    cxv, czv = pad + NX / 2, pad + NZ / 2
    # Cuernos: en la foto de frente (x), en la de lado (z) y en la de arriba (x y z).
    hf = blobs_x(brown(fr_rgb, fr), 0.2)
    hs = blobs_x(brown(sd_rgb, sd), 0.15)
    ht = blobs_x(brown(*v["arriba"]), 1.0)
    assert len(hf) == 2 and len(hs) >= 1 and len(ht) == 2, (hf, hs, ht)
    sf = H / fr.shape[0]                                 # celdas por píxel de la foto de frente
    horn_x = pad + ((hf[0][1] + hf[1][1]) / 2) * sf      # centro x de los cuernos, en celdas
    horn_z = pad + NZ - np.mean([c[1] for c in hs]) * (H / sd.shape[0])
    sep_cells = abs(hf[1][1] - hf[0][1]) * sf
    k_top = abs(ht[1][1] - ht[0][1]) / sep_cells           # píxeles de la foto de arriba por celda
    top_fit = (k_top, ((ht[0][1] + ht[1][1]) / 2, (ht[0][0] + ht[1][0]) / 2))
    print("cuernos frente", hf, "lado", hs, "arriba", ht, "escala arriba", round(k_top, 3))
    for name in NAMES:
        rx, ry, w, h = rects[name]
        if name == "arriba":
            # Se alinea con los cuernos: su separación da la escala y su centro la posición.
            # Cámara arriba con el frente hacia el borde superior de la foto: derecha = -x, abajo = -z.
            k, (hu, hv) = top_fit
            U = (-k, 0, 0, rx + hu + k * horn_x)
            V = (0, 0, -k, ry + hv + k * horn_z)
        else:
            k = h / H
            V = (0, -k, 0, ry + k * (pad + H))          # y = pad+H (arriba) -> fila ry
            if name == "frente":
                U = (k, 0, 0, rx + w / 2 - k * cxv)
            elif name == "espalda":
                U = (-k, 0, 0, rx + w / 2 + k * cxv)
            elif name == "derecha":                     # cámara en +x: derecha de la foto = -z
                U = (0, 0, -k, rx + w / 2 + k * czv)
            else:                                       # cámara en -x: derecha de la foto = +z
                U = (0, 0, k, rx + w / 2 - k * czv)
        proj[name] = [[c / ATLAS for c in U], [c / ATLAS for c in V]]

    # --- Visibilidad y pesos por vista ---
    # Direcciones hacia la cámara de cada foto, en coordenadas del volumen [x, y, z].
    dirs = {"frente": (0, 0, 1), "espalda": (0, 0, -1), "derecha": (1, 0, 0), "izquierda": (-1, 0, 0), "arriba": (0, 1, 0)}
    # Normal hacia fuera = contra el gradiente del campo (que vale 1 dentro y 0 fuera).
    grad = np.stack([nd.map_coordinates(g, verts.T, order=1) for g in np.gradient(field)], 1)
    nrm = -grad / np.maximum(np.linalg.norm(grad, axis=1, keepdims=True), 1e-9)
    shape = np.array(solid.shape)
    weights = np.zeros((len(verts), 5), np.float32)
    for i, name in enumerate(NAMES):
        d = np.array(dirs[name], np.float32)
        facing = np.clip(nrm @ d, 0, None)
        seen = np.ones(len(verts), bool)
        for t in np.arange(2.5, shape.max(), 1.0):
            p = np.round(verts + d * t).astype(int)
            inside = np.all((p >= 0) & (p < shape), axis=1)
            hit = np.zeros(len(verts), bool)
            q = p[inside]
            hit[inside] = solid[q[:, 0], q[:, 1], q[:, 2]]
            seen &= ~hit
        # Solo pinta lo que cae dentro de la silueta de su foto (las poses no coinciden del
        # todo: de frente está sentado y de lado/espalda de pie).
        U, V = np.array(proj[name][0]) * ATLAS, np.array(proj[name][1]) * ATLAS
        pu = verts @ U[:3] + U[3]
        pv = verts @ V[:3] + V[3]
        rx, ry, w, h = rects[name]
        ok = (pu >= rx) & (pu < rx + w) & (pv >= ry) & (pv < ry + h)
        within = np.zeros(len(verts), bool)
        within[ok] = sil[name][(pv[ok] - ry).astype(int), (pu[ok] - rx).astype(int)]
        weights[:, i] = facing ** SHARP * seen * within
    lost = weights.sum(1) < 1e-4       # nadie lo ve (debajo, entre piernas): la vista más de frente
    for i, name in enumerate(NAMES):
        weights[lost, i] = np.clip(nrm[lost] @ np.array(dirs[name], np.float32), 0, None) ** 4
    lost = weights.sum(1) < 1e-4       # mira hacia el suelo: mezcla las cuatro de lado
    weights[lost, :4] = 1
    weights = weights / weights.sum(1, keepdims=True)

    # --- Binario: posiciones Uint16 normalizadas a la caja, pesos Uint8, índices Uint16 ---
    lo, hi = verts.min(0), verts.max(0)
    q = np.round((verts - lo) / (hi - lo) * 65535).astype("<u2")
    wq = np.round(weights * 255).astype(np.uint8)
    assert len(verts) < 65536, "demasiados vértices para índices de 16 bits"
    # Orden de los vértices de cada triángulo: que su normal geométrica apunte hacia fuera.
    tri = verts[faces]
    fn = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    if (fn * nrm[faces].mean(1)).sum() < 0:
        faces = faces[:, ::-1]
    idx = faces.astype("<u2")
    with open(OUT / "modelo.bin", "wb") as f:
        f.write(q.tobytes()); f.write(wq.tobytes())
        if wq.size % 2: f.write(b"\0")                  # los índices Uint16 empiezan en byte par
        f.write(idx.tobytes())
    meta = {
        "vertices": int(len(verts)), "indices": int(idx.size),
        "min": lo.round(4).tolist(), "max": hi.round(4).tolist(),
        "altura": H, "base": pad, "centro": [cxv, czv],
        "vistas": NAMES, "proyeccion": proj,
    }
    (OUT / "modelo.json").write_text(json.dumps(meta, indent=1))
    print("atlas", rects)
    print("bin", (OUT / "modelo.bin").stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
