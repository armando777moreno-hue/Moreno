# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Storefront for **MORENO.co** ("LUXURY ESSENTIALS"), a luxury apparel brand. It is a static, single-page site (no build step, no framework, no package manifest). The visual language deliberately mimics apple.com: a translucent dark global nav, a product sub-nav that appears after the hero, huge tight headlines, scroll-driven sections, a horizontal "highlights" rail, a bento grid, and pill buttons. All customer-facing copy is in **Spanish**.

## Commands

```bash
# Run locally (any static server works; file:// breaks fetch() of data/lienzo.json and texture loading)
python3 -m http.server 8000        # → http://localhost:8000

pip install -r tools/requirements.txt
python3 tools/build_lienzo.py      # viewer textures for Lienzo, from assets/originals/lienzo/
python3 tools/build_assets.py      # La Perla photos (+ the unused Atardecer assets, see below)

# After changing js/viewer.js, regenerate the theme copy
npx terser@5 js/viewer.js -c -m --comments false -o shopify/assets/moreno-viewer.min.js
cp shopify/assets/moreno-viewer.min.js tienda-neomorfismo/assets/mn-viewer.min.js
```

There is no test suite or linter. Verify changes in a browser. For headless checks, Playwright's Chromium needs `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` for WebGL. `[data-moreno-360][data-ready]` becomes `webgl` or `fallback` once the viewer has initialized. The sandbox can't reach `cdn.shopify.com` or the store domain, so Shopify-hosted images don't load in local screenshots.

## Architecture

The product sold on the site is **Lienzo — Acid Wash Oversized Tee** (handle `lienzo-acid-wash-oversized-tee`). It is the AutoDS-imported product already in the Shopify store, with 11 single colors and 12 two-piece sets, sizes S–3XL, and prices of $58 ($62 for 2XL/3XL) and $98 ($102) for sets.

- `data/lienzo.json` is the source of truth for colors, sets, sizes, prices and the 138 numeric Shopify variant IDs, in size order. `ids[i]` matches `sizes[i]`; the second price applies from `2XL` on. If the product changes in Shopify, refresh this file and re-verify the IDs against the Admin API (variant title must equal `"<name> / <size>"`).
- `index.html` holds all sections in order: hero (crossfades between colors) → `#viewer` (360° + color swatches) → `#arte` (sticky scroll) → `#colores` (rail of the 11 colors) → `#detalles` (bento) → `#inspiracion` + palette → `#coleccion` → `#comprar` → footer, plus the bag drawer. Scripts load with `defer`: `js/vendor/three.min.js`, `js/viewer.js`, `js/main.js`.
  - The viewer's swatch buttons are static HTML (`[data-c]` with `--sw` from `assets/img/lienzo/colors.json`) because `viewer.js` reads them when it mounts, before `main.js` runs.
- `js/main.js` is a single IIFE with no dependencies.
  - `SHOP`, `COLLECTION` (the other Shopify products) and `ISLAND` (palette colors) are at the top.
  - The purchase logic lives in `shop(P)`, which runs after fetching `data/lienzo.json`. It handles color/set/size selection, the bag (`localStorage` key `moreno.bag.v2`, items `{opt, size, qty}`), and checkout.
  - Checkout: "Pagar" redirects to the cart permalink `SHOP/cart/<variantId>:<qty>,...`. It only works while the products are ACTIVE and published to the Online Store sales channel.
  - The viewer and the buy panel share the color selection: the viewer emits `moreno:color`, and `main.js` calls `root.morenoSetColor(key)`.
  - It also draws the "programmed images" in code: the hero grain, the sunset canvas (`#sky`), the fabric canvas (`#fabric`), and the SVG skyline (`#skyline`).
- `js/viewer.js` is the rotatable 3D garment (three.js **r128** UMD, vendored in `js/vendor/`; newer three versions no longer ship `build/three.min.js`). The **same file** powers the site and the Shopify section (minified copy in `shopify/assets/`).
  - It mounts every `[data-moreno-360]` element. `data-tex` and `data-height` are URL templates containing `{c}`, and `data-color` is the initial color key.
  - The shirt is two subdivided planes cut out with `alphaTest` on the RGBA photo and displaced along z by the height map, so their edges meet and form a closed volume.
  - The back is the same photo, horizontally mirrored, on a plane rotated π. The mirroring is done via texture `repeat.x = -1`, plus the height map sampled at `1-u`, so both silhouettes coincide.
  - Switching color reloads the texture and the height map, and re-displaces both geometries.
  - Without WebGL, it falls back to a CSS flip card.
- `tools/build_lienzo.py` turns the supplier photos (`assets/originals/lienzo/<color>.jpg`, front view on white) into `assets/img/lienzo/<color>.webp` (1024² RGBA cutout via flood-fill from the white border), `<color>-h.png` (256² height map) and `colors.json` (mean color of each photo). It also writes the bento detail crops.
  - The photos came from the Shopify product media. Because the sandbox can't reach the CDN, they were downloaded by upserting `cdn.shopify.com/...&width=1000` URLs into the unpublished theme and reading the files back as base64.
  - The supplier photos don't always match the color names (e.g. "Oxblood" is bright red, "Bone" is white). The site shows the real photos.
- **Unused Atardecer assets**: "Atardecer — Oversized Art Tee" was a mockup-based product that is no longer sold; it was deleted from Shopify along with its uploaded files.
  - `tools/build_assets.py` still generates its images (`shirt-*.webp`, campaign crops) plus the La Perla photos that the site does use.
  - Don't reintroduce the Atardecer images as a sellable product.
- `shopify/` holds the Shopify theme files, kept in sync by hand with the store. They live in the **unpublished** theme "MORENO CO. — Arte 360° (borrador)", a duplicate of the live Horizon-based theme "MORENO CO. — Arte".
  - `sections/moreno-360.liquid` is the viewer section. It loads three r128 from cdnjs plus `assets/moreno-viewer.min.js`.
    - Its color list is a section setting (`key:Name:#hex`), and the textures are theme assets `moreno-lienzo-<key>.webp` / `-h.png`.
    - It picks the initial color from the product's selected variant and follows the theme's variant picker by listening for `change` events. "Set I · Onyx" maps to `onyx`.
  - `sections/moreno-arte.liquid` is the sticky sunset story section.
  - `templates/product.lienzo.json` is a copy of the theme's `product.json` with both sections added. The Lienzo product uses `templateSuffix: lienzo`.
  - Upload gotchas:
    - `themeFilesUpsert` with `TEXT` works.
    - `URL` bodies work from raw.githubusercontent.com (public repo, pin a commit SHA) and keep the exact bytes; verify with `checksumMd5`.
    - `URL` bodies pointing to Shopify Files get re-encoded, and text from there silently fails.
    - The Admin API can't write to the live (MAIN) theme.
- `tienda-neomorfismo/` is a second, complete Shopify theme layer in a neumorphism style: the **unpublished** theme "MORENO.co — Neomorfismo" (id 188811837685), a Horizon duplicate whose home, product, collection and footer are replaced by custom `mn-` sections. `ESTADO.md` there lists every file and what is still pending.
  - Everything is prefixed `mn-`. `assets/mn-styles.css` holds the tokens (`--mn-fondo` #E9E4DC sand, raised/inset dual shadows, `--mn-acento` sunset orange). `assets/mn-scripts.js` is one guarded IIFE that re-inits on `shopify:section:load`.
  - Scroll effects run in one rAF loop: `track(el, fn)` gets `p` (-1 below … 1 above the viewport center) only while the element is near the screen. `[data-mn-3d]` gets `--mn-p` for CSS 3D tilt. `[data-mn-hero]`, `[data-mn-parallax]`, `[data-mn-cierre]` and the word-by-word `.mn-frase` have their own handlers.
  - The hero uses the same viewer with `data-scroll="<turns>"`, which turns the garment with scroll progress, starting from the front wherever it sits on load.
  - `mn-producto` builds option chips from `options_with_values`, matches the selection against the `product.variants | json` script, and reuses the server-rendered `money` text as the price format. It syncs the viewer through `morenoSetColor`.
  - The templates are `index.json`, `product.lienzo.json` (Lienzo), `product.mn.json` (the three Drop 001 art tees, `templateSuffix: mn`) and `collection(.mn).json`. `sections/footer-group.json` replaces the footer with `mn-footer`. The bento and the color wheel read the collection `todo` and the Lienzo product.
  - Liquid loops use an explicit index variable rather than `forloop.parentloop`.
  - `layout/theme.liquid` is Horizon's layout plus 4 head lines (Google Fonts preconnect + stylesheet, `mn-styles.css` once); sections no longer include the stylesheet themselves. Colors that carry text use `--mn-acento-texto`; `--mn-acento` is decoration only.
  - The merchant edits templates in the theme editor (`templates/index.json` was re-saved there), so upload sections/assets/layout but don't overwrite templates without diffing against the store first.
  - The Lienzo textures are uploaded to this theme too, as `moreno-lienzo-<key>.webp` / `-h.png`.
  - Headless preview: render the templates with liquidjs and mocked `product`/`collection` objects (Shopify can't be reached from the sandbox), map `asset_url` to the local files, then screenshot with Playwright.
- `printful/` holds the embroidered "Firma" line for Printful: `logo/` (MORENO.co wordmark and "M." monogram in Cormorant Garamond Bold, outlined SVG + transparent PNG, dark `tinta` and light `arena` versions) and `PRINTFUL.md` (product line, suggested prices, Spanish copy, merchant steps). There is no Printful connector: the merchant creates products in Printful and syncs them to Shopify as drafts, then they get finished via the Admin API.
- `css/styles.css` uses design tokens in `:root` (ink/mist/sand palette, `--sun-*` accents, `--radius`, `--nav-h`). Breakpoints are 833px and 560px. `prefers-reduced-motion` disables the animations.

## Brand

- Serif wordmark "MORENO" + smaller ".co" (Cormorant Garamond, falling back to Times/Georgia).
- Warm neutrals (taupe studio backgrounds, sand/mist surfaces); saturated color comes only from the sunset canvas, the Caribbean palette and the garment colors.
- Product copy comes from the Shopify description of Lienzo ("El lienzo, antes del primer trazo", heavyweight cotton, acid wash so no two are alike, oversized drop shoulder). Don't invent specs beyond it.
