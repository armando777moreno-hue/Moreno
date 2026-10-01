# MORENO.co

Tienda web de **MORENO.co — Luxury Essentials**. Página estática con estética tipo Apple y un visor 3D para girar la ropa en 360°.

```bash
python3 -m http.server 8000   # abrir http://localhost:8000
```

- `index.html`, `css/`, `js/`: la tienda.
- `assets/originals/`: fotos fuente. `assets/img/`: imágenes optimizadas y texturas 3D (se generan con `python3 tools/build_assets.py`).

Precio, tallas y nombre del producto se editan en `PRODUCT` al inicio de `js/main.js`.
