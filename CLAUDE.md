# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Storefront for **MORENO.co** ("LUXURY ESSENTIALS"), a luxury apparel brand. It is a static, single-page site (no build step, no framework, no package manifest). The visual language deliberately mimics apple.com: a translucent dark global nav, a product sub-nav that appears after the hero, huge tight headlines, scroll-driven sections, a horizontal "highlights" rail, a bento grid, and pill buttons. All customer-facing copy is in **Spanish**.

## Commands

```bash
# Run locally (any static server works; file:// breaks texture loading in the 3D viewer)
python3 -m http.server 8000        # → http://localhost:8000

# Regenerate optimized images / 3D textures from assets/originals/
pip install -r tools/requirements.txt
python3 tools/build_assets.py
```

There is no test suite or linter. Verify changes in a browser. For headless checks, Playwright's Chromium needs `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` for WebGL. `#viewerStage[data-ready]` becomes `webgl` or `fallback` once the viewer has initialized.

## Architecture

- `index.html` holds all sections in order: hero → `#viewer` (360°) → `#arte` (sticky scroll) → `#campana` (rail) → `#detalles` (bento) → `#inspiracion` + palette → `#comprar` → footer, plus the bag drawer. Scripts load with `defer` in this order: `js/vendor/three.min.js`, `js/viewer.js`, `js/main.js`.
- `js/main.js` is a single IIFE with no dependencies. At the top, `PRODUCT` (name, price, sizes, currency) and `ISLAND` (palette colors) are the data to edit. It also contains:
  - scroll effects: hero shrink, art-section progress (`artProgress`), inspiration parallax
  - "programmed images" drawn in code: hero film grain, the animated sunset canvas (`#sky`), the fabric texture canvas (`#fabric`), and the generated SVG skyline of colored houses (`#skyline`)
  - the rail, the buy gallery, size selection, and the bag (persisted in `localStorage` under `moreno.bag`)
  - Checkout is intentionally **not** wired up; the pay button is disabled.
- `js/viewer.js` is the rotatable 3D garment (three.js **r128** UMD, vendored in `js/vendor/`; newer three versions no longer ship `build/three.min.js`). It works like this:
  - The shirt is two subdivided planes (front and back) cut out via `alphaTest` on their RGBA textures.
  - Each plane is displaced along z by `shirt-height.png`, so the edges meet and form a closed "pillow" volume.
  - The back plane is rotated π. Because `shirt-front.webp` is the **horizontally mirrored** version of the back, the two silhouettes coincide, and the front samples the height map with `u → 1-u`.
  - Interaction: drag (with inertia), auto-spin when idle, and segmented buttons (Frente/Perfil/Espalda).
  - Without WebGL, it falls back to a CSS flip card.
- `tools/build_assets.py` is the image pipeline: originals in `assets/originals/` produce the outputs in `assets/img/`.
  - The shirt cutout uses a hand-traced `SILHOUETTE` polygon (coordinates in `studio-back.jpg`) refined by luminance.
  - The **front view is generated**, since no front photo exists: the back print is inpainted away, fabric texture is synthesized, then the neckline and chest logo are drawn. The logo is pre-mirrored because the texture is flipped afterwards.
  - The height map reaches 0 slightly inside the alpha edge so the faces don't leave a gap when rotated.
  - It also erases the baked-in logo and 360° icon from the campaign photos, and crops the collage into gallery images.
  - If you change the silhouette or mask logic, re-render and inspect all four viewer angles; the edges are where it breaks.
- `css/styles.css` uses design tokens in `:root` (ink/mist/sand palette, `--sun-*` accents, `--radius`, `--nav-h`). Breakpoints are 833px and 560px. `prefers-reduced-motion` disables the animations.

## Brand

- Serif wordmark "MORENO" + smaller ".co" (Cormorant Garamond, falling back to Times/Georgia).
- Warm neutrals (cream garment, taupe studio backgrounds); saturated color comes only from the sunset artwork and the Caribbean palette.
- Product: "Camiseta Atardecer". It is a cream oversize boxy tee with dropped shoulders, a thick ribbed collar, and a woven neck label and side-hem tag. The back print is an easel painting of a sunset over the sea with a coffee cup and hands. The front has a small chest wordmark.
