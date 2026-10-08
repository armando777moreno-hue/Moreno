# MORENO.co — Neomorfismo · Estado

Tema **sin publicar** "MORENO.co — Neomorfismo" (id `188811837685`) en `autods-user-store-52230-g0uyjwy5`.
Es un duplicado de Horizon: se reemplazaron el inicio, la página de producto, la colección y el pie con secciones propias `mn-`.

- Editor: https://admin.shopify.com/store/autods-user-store-52230-g0uyjwy5/themes/188811837685/editor
- Vista previa: https://autods-user-store-52230-g0uyjwy5.myshopify.com/?preview_theme_id=188811837685

## Qué hay

| Archivo | Qué hace |
| --- | --- |
| `assets/mn-styles.css` | Tokens, relieve y hundido (doble sombra), botones, revelados, 3D por scroll y todas las secciones. |
| `assets/mn-scripts.js` | Revelados, bucle único de scroll (`--mn-p`), inclinación con el ratón, marquesina, rueda de color, puntos de detalle, variantes del producto y barra fija en móvil. |
| `assets/mn-viewer.min.js` | El visor 3D de la camiseta (three r128), con el modo `data-scroll`: gira al deslizar. |
| `assets/moreno-lienzo-*.webp` / `-h.png` | Texturas y mapas de relieve de los 11 colores de Lienzo. |
| `assets/mn-la-perla.jpg` | Foto de La Perla para la panorámica. |
| `layout/theme.liquid` | El layout de Horizon con 4 líneas añadidas en `<head>`: preconexión y hoja de Google Fonts, y `mn-styles.css` cargado una sola vez. |
| `snippets/mn-tarjeta.liquid` | Tarjeta de producto en relieve. Si el producto no tiene foto, muestra el refrán en cursiva. |
| `sections/mn-hero.liquid` | Apertura: la tarjeta se inclina al hacer scroll y la camiseta 3D gira con el scroll. |
| `sections/mn-marquesina.liquid` | Banda hundida con frases en movimiento. |
| `sections/mn-color.liquid` | Rueda de color con los colores reales del producto: clic, arrastre circular o flechas. |
| `sections/mn-bento.liquid` | Mosaico de prendas de una colección. La primera ocupa 2×2 y la última se estira para cerrar la fila. |
| `sections/mn-frase.liquid` | Manifiesto que se ilumina palabra por palabra al deslizar. |
| `sections/mn-detalles.liquid` | Foto con puntos que se enlazan con una lista de detalles. |
| `sections/mn-panorama.liquid` | Panorámica con paralaje y tarjeta de cristal. |
| `sections/mn-cierre.liquid` | Logo gigante en relieve: las letras se voltean en 3D con el scroll. |
| `sections/mn-producto.liquid` | Página de producto: visor 3D sincronizado con el color, fotos, opciones como chips, acordeones y barra fija. |
| `sections/mn-coleccion.liquid` | Página de colección con cabecera hundida y rejilla paginada. |
| `sections/mn-footer.liquid` | Pie de página (grupo footer). |
| `templates/*.json`, `sections/footer-group.json` | Inicio, producto (`lienzo`, `mn`), colección y pie. |

## Catálogo conectado

- La colección **Todo** (`todo`) está publicada en la tienda online e incluye Lienzo y las 3 camisetas del Drop 001. CAMISETA ALGODON queda fuera a propósito.
- Lienzo usa la plantilla `lienzo`; Cría Cuervos, Ojo Por Ojo y Perro Que Ladra usan `mn`. En el tema activo, `mn` no existe, así que esas camisetas siguen usando su plantilla normal.

## Pendiente (lo haces tú en Shopify)

1. **Publicar el tema**: Tienda online → Temas → "MORENO.co — Neomorfismo" → Publicar. La API no permite publicar temas.
2. **Contraseña**: Preferencias → desactivar la contraseña de la tienda cuando quieras abrirla al público.
3. **Menús**: el pie usa el menú `footer`. Revisa sus enlaces en Contenido → Menús.
4. **Guía de tallas**: el campo está vacío porque no tenemos medidas reales. Se llena en la sección de producto, una fila por línea: `Talla | Pecho | Largo`.
5. **Fotos de las camisetas del Drop 001**: no tienen foto, así que se muestran como tarjetas tipográficas con su refrán. Al subirles fotos, aparecerán solas.
6. Las descripciones de los productos están en inglés en Shopify. El resto del tema está en español.

## Auditoría Impeccable (accesibilidad y rendimiento)

- Texto secundario `--mn-tinta-suave` #675E53 (5.0:1). El acento se divide en `--mn-acento` (#D9774E, solo decoración) y `--mn-acento-texto` (#9E4A26, para botones y texto: 6.1:1 con blanco).
- Controles de al menos 44px (`--mn-toque`). La rueda de color usa una sola parada de tabulador más las flechas, Inicio y Fin; solo el aro se arrastra (`touch-action: none`), y el arrastre se limpia en `pointercancel`.
- Títulos sin saltos: los acordeones usan `h2` y la descripción pasa de `h4` a `h3`; la colección lleva un `h2` oculto.
- Las fuentes y los estilos se cargan desde el layout, no desde cada sección. `will-change` se quitó de los estilos en reposo. La segunda foto de las tarjetas no se pinta en pantallas táctiles.
- Las plantillas de la tienda (por ejemplo `templates/index.json`) pueden tener ajustes guardados desde el editor. No se suben desde aquí, para no pisarlos.
