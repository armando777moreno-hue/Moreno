# MORENO.co

Tienda web de **MORENO.co — Luxury Essentials**. Página estática con estética tipo Apple y un visor 3D para girar la ropa en 360°.

```bash
python3 -m http.server 8000   # abrir http://localhost:8000
```

- `index.html`, `css/`, `js/`: la tienda.
- `assets/originals/`: fotos fuente. `assets/img/lienzo/`: texturas 3D de Lienzo por color (`python3 tools/build_lienzo.py`).
- `data/lienzo.json`: colores, sets, tallas, precios e IDs de variante de Lienzo en Shopify.

## Shopify

- Tienda: https://autods-user-store-52230-g0uyjwy5.myshopify.com. El botón "Pagar" de la web envía la bolsa al checkout de Shopify.
- `shopify/`: secciones y plantilla del visor 360° de Lienzo para el tema de Shopify (subidas a la copia sin publicar "MORENO CO. — Arte 360° (borrador)").
