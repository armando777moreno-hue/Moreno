# MORENO.co — Legal, privacidad, accesibilidad y contenido honesto

Revisión del 11 de octubre de 2026 para el tema **"MORENO.co — Neomorfismo"** y para la tienda.
No es asesoría legal: son buenas prácticas aplicadas con los datos reales de la tienda.
Antes de abrir la tienda al público, revisa las decisiones marcadas con ⚠️.

## Resumen

| Punto | Estado |
| --- | --- |
| Política de privacidad | Redactada en español (`legal/privacidad.html`). **La pegas tú** en Ajustes → Políticas: la conexión no tiene permiso para editar políticas. |
| Política de cookies | **Publicada** como página: `/pages/politica-de-cookies`. |
| Aviso de consentimiento de cookies | **Hecho** en el tema (`snippets/mn-cookies.liquid`). |
| Consentimiento en formularios y datos mínimos | **Hecho**: contacto, boletín y comentarios. |
| Términos y condiciones | Redactados (`legal/terminos.html`). **Los pegas tú**. |
| Política de reembolsos | Redactada (`legal/reembolsos.html`). **La pegas tú**. ⚠️ Confirma los plazos. |
| Política de envíos | Redactada (`legal/envios.html`). **La pegas tú**. |
| Datos del negocio visibles | **Hecho** en el pie de página, más `legal/contacto.html` para la política de contacto. |
| Integraciones y analítica | **Revisadas**; Google Fonts y cdnjs quitados del tema. |
| Accesibilidad | **Revisada** (auditoría Impeccable del 7/10 y elementos nuevos). |
| Derechos de las imágenes | Inventario abajo. ⚠️ Confirma la foto de La Perla. |
| Reseñas falsas | No hay reseñas en la tienda ni en el tema. |
| Afirmaciones sin respaldo | **Corregidas** en 3 productos y en la portada; pendientes abajo. |

## 1. Políticas: dónde pegarlas

Shopify admin → **Ajustes → Políticas**. Copia el contenido de cada archivo de `legal/` (ábrelo en el navegador, selecciona todo y pega en el editor de la política):

| Archivo | Política en Shopify |
| --- | --- |
| `legal/privacidad.html` | Política de privacidad (sustituye la automática en inglés) |
| `legal/reembolsos.html` | Política de reembolso |
| `legal/terminos.html` | Términos del servicio |
| `legal/envios.html` | Política de envío |
| `legal/contacto.html` | Información de contacto |

Si editas a mano la política de privacidad, Shopify deja de actualizarla automáticamente. Revísala si cambias de apps o de forma de vender.

### ⚠️ Decisiones de negocio que contienen (cámbialas si no son las tuyas)

- **Devoluciones:** 30 días desde la entrega. La pieza debe estar sin usar ni lavar, con etiquetas.
- **Envío de la devolución:** lo paga el cliente, salvo pieza defectuosa, dañada o equivocada.
- **Piezas sin devolución:** las hechas a pedido (Drop 001) y las tarjetas de regalo, salvo defecto.
- **Reembolsos:** en 10 días hábiles desde que se aprueba la devolución, al mismo método de pago.
- **Lavado ácido:** las variaciones de tono no son defecto (sale de la descripción de Lienzo).
- **Envíos:** si no se envía a tiempo (o en 30 días cuando no hay plazo), el cliente puede cancelar con reembolso completo. Es la regla de la FTC para ventas a distancia en EE. UU. Aranceles internacionales a cargo de quien recibe.
- **Ley aplicable:** Puerto Rico y leyes federales de EE. UU., porque la dirección de la tienda está en Corozal, PR.

## 2. Cookies y consentimiento

- **El aviso** (`snippets/mn-cookies.liquid`, cargado desde `layout/theme.liquid`):
  - Guarda la elección con la **Customer Privacy API** de Shopify, así que las analíticas de Shopify y los píxeles de apps respetan lo que elija cada visitante.
  - Ofrece «Rechazar opcionales», «Configurar» (necesarias, preferencias, analítica, marketing) y «Aceptar todas», con el mismo peso visual.
  - Se reabre con «Preferencias de cookies» al pie de cada página.
  - Es accesible con teclado, con foco visible y botones de 44 px.
- **No actives también el banner nativo de Shopify** (Ajustes → Privacidad del cliente → Banner de cookies). Si lo activas, el nuestro se aparta para no duplicar avisos.
- En Ajustes → Privacidad del cliente, revisa en qué regiones exige Shopify consentimiento previo.
- **El tema que está publicado hoy** ("Arte 360°") no tiene este aviso. Hasta publicar Neomorfismo, activa ahí el banner nativo de Shopify.

## 3. Formularios: consentimiento y datos mínimos

- **Contacto** (`blocks/contact-form.liquid`):
  - Se quitó el campo de teléfono, que no hace falta para responder.
  - Las etiquetas ahora son visibles.
  - Correo y mensaje son obligatorios.
  - Casilla de consentimiento obligatoria con enlace a la política de privacidad. El «Sí» queda escrito en el correo que recibe la tienda.
- **Boletín** (`blocks/email-signup.liquid`): aviso de para qué se usa el correo, cómo darse de baja y enlace a la privacidad.
- **Comentarios del blog** (`snippets/blog-comment-form.liquid`): qué se publica (el nombre) y qué no (el correo).

## 4. Datos del negocio

- **El pie de página** (`sections/mn-footer.liquid`) muestra nombre, dirección, correo y teléfono, tomados de **Ajustes → Tienda**. Además lleva enlaces a todas las políticas, a la política de cookies, a «Tus opciones de privacidad» y a «Preferencias de cookies».
- **⚠️ Arregla la dirección en Ajustes → Tienda:** la línea 1 dice «Hc 03 12345 Corozal Puerto Rico» y repite la ciudad. Debería ser «HC 03 12345». Pon el teléfono con formato: +1 787-207-3308.
- **Si el negocio tiene un nombre legal** distinto de «MORENO.co» (por ejemplo, una LLC), escríbelo en la sección del pie → «Nombre legal del negocio».

## 5. Terceros y analítica

| Servicio | Qué recibe | Estado |
| --- | --- | --- |
| Shopify | Todo lo de la tienda: alojamiento, pago, analítica | Necesario; la analítica respeta el consentimiento |
| AutoDS y sus proveedores (Lienzo) | Nombre, dirección, teléfono y artículos del pedido | Declarado en la privacidad |
| Shopify Collective: Loran, EasyOptionXY | Lo mismo, para los productos de Collective | Declarado en la privacidad |
| Printful (si se usa) | Lo mismo | Declarado («proveedores que fabrican o envían») |
| Shopify Inbox (chat) | Mensajes del chat | El tema lo trae preparado, pero no hace nada si la app no está instalada |
| ~~Google Fonts~~ | IP del visitante, antes del consentimiento | **Quitado**: las fuentes se sirven desde el tema (`assets/mn-*.woff2`, licencia OFL en `licencias/`) |
| ~~cdnjs (three.js)~~ | IP del visitante | **Quitado**: `assets/mn-three.min.js` |

El tema no tiene apps incrustadas ni píxeles de terceros. Revisa también **Ajustes → Eventos de cliente** (píxeles personalizados) y las apps instaladas: la conexión no puede listarlas.

## 6. Accesibilidad

- Ya se aplicó la auditoría Impeccable (7/10):
  - contraste de textos y botones;
  - controles de 44 px;
  - teclado en la rueda de color;
  - jerarquía de títulos;
  - movimiento reducido.
- Lo nuevo de hoy:
  - etiquetas visibles en el formulario de contacto;
  - casillas reales con su etiqueta;
  - aviso de cookies navegable con teclado y sin depender del color.
- El detector no encuentra problemas nuevos. Las únicas alertas son el logo en relieve (los logotipos están exentos de la regla de contraste) y las imágenes del respaldo sin WebGL, que se rellenan solas.

## 7. Contenido honesto

### Imágenes

| Imagen | Origen | Estado |
| --- | --- | --- |
| Fotos y texturas de Lienzo | Fotos del proveedor del producto (AutoDS) | Uso habitual para revender ese producto |
| Fotos de los productos de Collective | Proveedor de Shopify Collective | Licenciadas por Collective para venderlos |
| `mn-la-perla.jpg` (panorámica) | La enviaste tú | ⚠️ Confirma que la foto es tuya o que tienes permiso |
| Peluche 3D (tema Arte 360° + Peluche) | Fotos del anuncio de AliExpress | ⚠️ Úsalas solo si vendes ese producto de ese proveedor |
| Logo y textos | Propios | Correcto |

### Reseñas

No hay apps de reseñas, ni bloques de opiniones en las plantillas, ni reseñas en las descripciones. Los Términos prohíben publicar opiniones falsas o pagadas sin indicarlo.

### Afirmaciones corregidas (antes → ahora)

| Producto | Antes | Ahora | Motivo |
| --- | --- | --- | --- |
| Sudadera (EasyOptionXY) | «Adenorah Mens Hoodies Pullover Womens Oversized Y2K… Green Large», con «ultimate comfort» | «Sudadera con capucha de lavado ácido», solo con la ficha del proveedor | Superlativos y relleno de palabras clave |
| Jersey (Loran) | «Luxurious Pure Cashmere Turtleneck Sweater», con «unmatched warmth and softness» | «Jersey de cuello alto de punto»; «cachemira, según la ficha del proveedor» | «Pura cachemira» no está verificada, y la ley textil de EE. UU. sanciona etiquetar mal la lana y la cachemira |
| Jersey oversize (Loran) | «Oversized Cashmere Blend Pullover Sweater for Winter» | «Jersey oversize de cuello alto» | La ficha no indica material: no se puede decir «cachemira» |
| Portada (panorámica) | «Nacida entre colores del Caribe.» | «Inspirada en los colores del Caribe.» | No consta dónde nace la marca |

Si alguno de estos productos de Collective sincroniza el contenido del proveedor, los textos originales podrían volver. Desactiva esa sincronización en la app de Collective.

### ⚠️ Pendiente (necesita datos que solo tú o el proveedor tienen)

- **Composición y país de origen** de cada prenda (por ejemplo, «100 % algodón · Importado»). En EE. UU. la ley textil pide mostrarlos también en la venta online. Pídeselos a cada proveedor y añádelos a las descripciones.
- **Cachemira de Loran:** pide la etiqueta de composición antes de volver a poner «cachemira» en el título.
- **«CAMISETA ALGODON»:** está activa con la descripción «...». Complétala o archívala.
- **Páginas «El Taller», «Cuidado y Tallas» y «Contact»** están en inglés y sus afirmaciones son sobre tu propio proceso. Confirma que siguen siendo ciertas.
