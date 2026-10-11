# Sophy — Design System

## 1. Visual Theme & Atmosphere

Una revista de lujo que se comporta como un producto de Apple. De The New Yorker toma la voz editorial: titulares en serif de alto contraste, antetítulos pequeños en mayúsculas, filetes finos y el rojo como única nota de color. De Apple toma el espacio en blanco, la cabecera translúcida y el movimiento suave y continuo.

Palabras clave: editorial, sereno, preciso, cálido, con un solo acento vibrante.

Una frase: *papel blanco, tinta negra y un rojo que solo aparece cuando algo importa.*

## 2. Color Palette & Roles

```css
:root {
  --blanco: #FFFFFF;   /* fondo principal */
  --tinta: #111111;    /* texto, botones, menú */
  --rojo: #C62828;     /* acento: hover, activo, progreso, racha */
  --papel: #F3F1EE;    /* fondos secundarios, tarjetas, pie */

  --tinta-rgb: 17, 17, 17;
  --rojo-rgb: 198, 40, 40;
  --blanco-rgb: 255, 255, 255;

  --suave: rgba(var(--tinta-rgb), 0.62);  /* texto secundario */
  --linea: rgba(var(--tinta-rgb), 0.12);  /* filetes y bordes */

  /* Solo para el confeti: el naranja del icono y un tono arena del papel */
  --buho: #D4532B;
  --arena: #D9D3C7;
}
```

El rojo nunca se usa como fondo de grandes superficies: es color de estado (hover, activo, completado). No hay modo oscuro; la paleta es la marca.

## 3. Typography Rules

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet">
```

| Rol | Familia | Tamaño | Peso | Detalle |
|---|---|---|---|---|
| Titular de portada | Playfair Display | clamp(2.6rem, 7vw, 4.6rem) | 600 | interlineado 1.05, tracking -0.02em |
| Título de página | Playfair Display | clamp(2.1rem, 5vw, 3.2rem) | 600 | interlineado 1.1 |
| Título de pieza | Playfair Display | 1.45rem (destacada: hasta 2.4rem) | 600 | interlineado 1.2 |
| Cuerpo de lectura | Source Serif 4 | 1.16rem | 400 | interlineado 1.75, ancho máx. 680px |
| Interfaz y metadatos | Inter | 0.95rem | 400–500 | |
| Antetítulo / navegación | Inter | 0.74–0.8rem | 500–600 | mayúsculas, tracking 0.12–0.16em |

Fallbacks: `Georgia, serif` para las serif; `system-ui, -apple-system, "Segoe UI", sans-serif` para Inter. Prohibido: fuentes redondeadas o de fantasía, y más de estas tres familias.

## 4. Component Stylings

- **Navegación de secciones**: Inter en mayúsculas. Hover: el texto pasa de tinta a rojo, crece un 8 % y un subrayado rojo se abre desde el centro. Activa: rojo con subrayado fijo. Focus: contorno rojo de 2px.
- **Hamburguesa**: tres líneas de 22px en un objetivo de 44px. Hover: líneas rojas y la central se acorta. Abierta: se transforma en aspa.
- **Menú**: panel derecho en tinta con enlaces en Playfair blanco; hover en rojo con desplazamiento de 8px; entrada escalonada.
- **Botón primario**: fondo tinta, texto blanco, radio 999px. Hover: fondo rojo. Active: escala 0.97. Disabled: opacidad 0.45. Focus: contorno rojo.
- **Botón secundario**: borde tinta, fondo transparente. Hover: borde y texto rojos.
- **Pieza (tarjeta editorial)**: imagen con radio 14px, antetítulo rojo, título serif. Hover: sube 4px, el título pasa a rojo y la imagen hace zoom al 104 %.
- **Campo de texto**: borde de 1px en línea, radio 12px. Focus: borde tinta y halo rojo tenue.
- **Racha**: llama en línea y número; gris si hoy no cuenta todavía, roja cuando sí.
- **Calendario**: celdas cuadradas en papel; día completado en rojo con número blanco; hoy con anillo tinta.

## 5. Layout Principles

- Contenedor general de 1120px; lectura de 680px; formularios de 420px.
- Margen lateral de 20px en móvil y 40px en escritorio.
- Escala de espaciado: 4, 8, 12, 16, 24, 40, 64, 96px.
- Cabecera fija: en escritorio una fila (marca, secciones centradas, acciones); en móvil dos filas, con las secciones en una banda deslizable.
- Los bloques se separan con filetes de 1px y espacio, no con cajas.

## 6. Depth & Elevation

Casi plano. Tres niveles:

1. Filete de 1px (`--linea`) para separar.
2. `0 1px 0 var(--linea)` bajo la cabecera al desplazarse.
3. `0 18px 40px rgba(var(--tinta-rgb), 0.10)` solo en hover de piezas y en el panel del menú.

## 7. Animation & Interaction

Nivel L2 (interacción fluida), solo con CSS e IntersectionObserver, sin librerías.

- Curvas: `--ease: cubic-bezier(0.22, 0.61, 0.36, 1)` y `--ease-salida: cubic-bezier(0.16, 1, 0.3, 1)`.
- Cambio de vista: la vista saliente se desvanece 180ms; la entrante sube 14px y aparece en 520ms.
- Aparición al desplazarse: opacidad y 18px de recorrido, escalonado de 70ms.
- Cabecera: gana filete inferior al desplazarse; barra roja de progreso de lectura en las secciones.
- Día completado: el icono rebota, sale confeti desde él y aparece un aviso con la racha.
- `prefers-reduced-motion`: sin transiciones de vista, sin apariciones escalonadas y sin confeti (se mantiene el aviso).

## 8. Do's and Don'ts

Do:
- Usar el rojo solo para estados y acentos.
- Dejar que los titulares respiren: mucho blanco alrededor.
- Animar únicamente `opacity` y `transform`.
- Mantener todos los colores como variables CSS.

Don't:
- No usar degradados, sombras duras ni brillos.
- No usar emojis como iconos; solo SVG en línea.
- No usar el rojo como fondo de secciones enteras.
- No añadir una cuarta familia tipográfica.
- No animar `filter: blur()` ni propiedades de maquetación.
- No usar esquinas rectas en imágenes ni radios distintos de 12–14px y 999px.
- No centrar párrafos de lectura.

## 9. Responsive Behavior

- Puntos de corte: 600px y 900px.
- Móvil: secciones en banda horizontal deslizable, piezas en una columna, menú a ancho completo.
- Objetivos táctiles de al menos 44px.
- Sin desplazamiento horizontal de página a ningún ancho.
