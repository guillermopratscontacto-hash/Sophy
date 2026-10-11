# Edición diaria de Sophy

Instrucciones para el agente que publica la edición de cada mañana. Sophy es una web estática (GitHub Pages) que lee `contenido/indice.json` y los archivos Markdown que ese índice enumera. Tu trabajo es añadir la edición de hoy: seis piezas, una por sección. No toques nada más.

## Qué publicar

Usa la fecha de hoy en la zona horaria Europe/Madrid (`HOY`, formato `AAAA-MM-DD`). Las cuatro secciones de actualidad cubren lo ocurrido **ayer**.

| id (nombre de archivo y `tema`) | Contenido |
|---|---|
| `economia` | La noticia económica más relevante de ayer: mercados, bancos centrales, empresas, energía, empleo. |
| `politica-espanola` | La noticia más relevante de ayer en la política de España. |
| `politica-internacional` | La noticia política más relevante de ayer fuera de España: gobiernos, elecciones, diplomacia, conflictos. |
| `internacional` | Sucesos generales de ayer en el mundo: catástrofes, accidentes, ciencia, sociedad. Puede llevar dos noticias. |
| `arte` | Un reportaje atemporal sobre una obra, un artista, un movimiento o una técnica, al estilo de National Geographic. |
| `historia` | Un reportaje atemporal sobre un episodio, un objeto, un personaje o una civilización, al estilo de National Geographic. |

Antes de elegir tema para `arte` e `historia`, lee los títulos ya publicados de esa sección en `contenido/indice.json` y no repitas ninguno. Varía de época, región y disciplina respecto a las últimas ediciones. En las secciones de actualidad, si una historia continúa de un día anterior, cuenta solo lo nuevo.

Si ya existe la carpeta `contenido/HOY/`, la edición está publicada: no hagas nada.

## Cómo investigar

- Busca en la web las noticias de ayer y contrasta cada una en al menos dos fuentes fiables. Abre los artículos; no escribas solo a partir de titulares.
- Comprueba que el hecho ocurrió ayer y no días antes.
- Si las fuentes dan cifras distintas, dilo en el texto y atribuye cada cifra; no elijas una en silencio.
- Distingue hechos de declaraciones: lo que afirma un partido o un gobierno se atribuye («según…»).
- En política, tono neutral: sin adjetivos valorativos y con la posición de las partes enfrentadas.
- Para `arte` e `historia`, limítate a hechos bien establecidos y señala lo que sigue en debate.
- No inventes datos, citas ni enlaces. Si no puedes verificar algo, déjalo fuera.

## Cómo escribir

- En español de España, con tus propias palabras. Nunca copies párrafos de un medio: resume, ordena y enlaza las fuentes.
- Noticias: 4 o 5 párrafos (250–350 palabras). Reportajes de arte e historia: 5 o 6 párrafos (350–450 palabras).
- El primer párrafo cuenta lo esencial; los siguientes, el contexto y lo que queda abierto.
- Titular informativo de una frase, sin punto final ni dos puntos de adorno.

## Formato de cada archivo

Ruta: `contenido/HOY/<id>.md`. Cada artículo sigue exactamente esta estructura; la web depende de ella para maquetar:

```markdown
## Titular de la noticia

*Ciudad, sábado 10 de octubre*

<figure>
  <img src="https://commons.wikimedia.org/wiki/Special:FilePath/NOMBRE%20CODIFICADO.jpg?width=1200" alt="Descripción de la imagen" loading="lazy">
  <figcaption>Imagen de archivo: qué muestra y de cuándo es. Foto: Autor, licencia, vía Wikimedia Commons.</figcaption>
</figure>

Primer párrafo.

Más párrafos.

**Fuentes:** [Medio](https://…) · [Medio](https://…)
```

- La línea en cursiva es la data: lugar y fecha del hecho en las noticias; época o ámbito en los reportajes (por ejemplo, `*Grecia, siglo II a. C.*`).
- Si un archivo lleva dos artículos, sepáralos con una línea `---`.
- En los reportajes, la última línea es `**Para saber más:**` en lugar de `**Fuentes:**`.
- No uses `#` (título de nivel 1) ni emojis.

## Imágenes

- Solo imágenes de Wikimedia Commons con licencia libre (dominio público, CC0, CC BY, CC BY-SA). Nunca fotos de agencias o de medios.
- Búscalas con la API: `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=filetype:bitmap+TÉRMINOS&prop=imageinfo&iiprop=extmetadata|size|mime`.
- La URL de la imagen es `https://commons.wikimedia.org/wiki/Special:FilePath/` + el nombre del archivo codificado como URL (sin el prefijo `File:`) + `?width=1200`.
- En las noticias casi nunca habrá foto libre del suceso: usa una imagen de archivo relacionada y dilo en el pie («Imagen de archivo: …»). El pie no debe dar a entender que la foto es del suceso.
- El pie siempre incluye autor y licencia.
- Comprueba cada URL con `curl -L` y confirma que devuelve 200 y una imagen. Si no encuentras una imagen adecuada, publica el artículo sin `<figure>`.

## Índice

Añade seis objetos al **principio** de `entradas` en `contenido/indice.json`, en el orden de la tabla:

```json
{
  "fecha": "HOY",
  "tema": "economia",
  "titulo": "El mismo titular que el primer artículo del archivo",
  "resumen": "Una o dos frases, máximo 160 caracteres.",
  "imagen": "La misma URL de la imagen del artículo (omite el campo si no hay imagen)",
  "archivo": "contenido/HOY/economia.md"
}
```

No modifiques `temas` ni las entradas anteriores.

## Reglas

- Solo puedes crear archivos en `contenido/HOY/` y añadir entradas a `contenido/indice.json`. No edites ni borres ediciones anteriores, ni el código de la web (`index.html`, `app.js`, `styles.css`, `config.js`, `supabase/`).
- Antes de publicar, comprueba que `contenido/indice.json` es JSON válido, que los seis archivos existen y que cada `archivo` del índice apunta a uno real.
- Publica con un único commit en la rama `main`, con el mensaje `Edición del HOY`, y haz push. GitHub Pages actualiza la web solo.
- Si una sección no puede completarse con garantías, publica las demás y explica en el mensaje del commit cuál falta y por qué. Es preferible una sección menos que una noticia sin verificar.
