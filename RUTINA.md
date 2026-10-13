# Edición diaria de Sophy

Instrucciones para el agente que publica la edición de cada mañana: ocho piezas, una por sección. Lo mecánico (fechas, temas de Cultura, álbum de Música, imágenes, índice, validación y push) lo hace `rutina/sophy.py`; tu trabajo es elegir las cuatro noticias, contrastarlas y escribir.

## Trabaja en pocos pasos

Cada paso relee toda la conversación, así que el coste depende del número de pasos. Sigue este orden y no añadas otros:

1. `python3 rutina/sophy.py preparar` — una sola vez. Devuelve la fecha, las noticias ya publicadas, los tres temas de Cultura con su imagen, el álbum de Música con su portada, las imágenes de archivo disponibles y los titulares de ayer por sección. Si dice que la edición ya está publicada, termina.
2. Elige las cuatro noticias y abre **en un mismo paso, en paralelo**, dos fuentes de cada una (los enlaces vienen en los titulares). Usa la búsqueda web solo si un enlace falla o falta una segunda fuente.
3. Si alguna noticia no encaja con ninguna imagen de archivo de la lista, pide todas las que falten en una única orden: `python3 rutina/sophy.py imagenes "término 1" "término 2"` (con un `timeout` de 10 minutos; el script ya espera y reintenta solo, no lo repitas ni consultes Wikimedia por tu cuenta).
4. Escribe los ocho archivos en uno o dos pasos, con varias llamadas en paralelo.
5. `python3 rutina/sophy.py publicar` — valida, comprueba imágenes y enlaces, actualiza el índice, hace el commit y el push. Si devuelve errores, corrige solo eso y vuelve a ejecutarlo.

No releas los archivos que acabas de escribir, no hagas comprobaciones que ya hace `publicar`, no edites `contenido/indice.json` a mano, no uses git directamente y no narres lo que vas haciendo. Al terminar, resume en una línea qué has publicado.

## Qué publicar

| id (nombre de archivo) | Contenido |
|---|---|
| `economia` | La noticia económica más relevante de ayer: mercados, bancos centrales, empresas, energía, empleo. |
| `politica-espanola` | La noticia más relevante de ayer en la política de España. |
| `politica-internacional` | La noticia política más relevante de ayer fuera de España: gobiernos, elecciones, diplomacia, conflictos. |
| `internacional` | Sucesos generales de ayer en el mundo: catástrofes, accidentes, ciencia, sociedad. |
| `arte`, `historia`, `literatura` | Un reportaje atemporal, al estilo de National Geographic, sobre el asunto que indica `preparar`. |
| `musica` | La recomendación del álbum que indica `preparar`. |

- La noticia más relevante suele ser la que aparece en varios medios a la vez.
- Cada noticia cuenta un hecho distinto de los ya publicados. Si una historia continúa, cuenta solo lo nuevo, con otro titular.
- Ninguna sección queda vacía: si ayer no hubo noticia relevante (pasa en `economia` los fines de semana), cubre la más relevante de los últimos tres días que no esté publicada y pon en la data la fecha real del hecho.
- En Cultura, el asunto y la imagen vienen dados y no se cambian: así nunca se repiten. Tú eliges el ángulo y el titular. Solo si `preparar` dice `LISTA AGOTADA` eliges tú un asunto que no esté entre los publicados (otra época, otra región y otro autor que los recientes) y buscas su imagen con `imagenes`.

## Cómo investigar

- Contrasta cada noticia en dos fuentes fiables y comprueba que el hecho ocurrió ayer.
- Si las fuentes dan cifras distintas, dilo y atribuye cada una. Distingue hechos de declaraciones («según…»).
- En política, tono neutral: sin adjetivos valorativos y con la posición de las partes enfrentadas.
- Los reportajes de Cultura se escriben sin buscar en la web: limítate a hechos bien establecidos y señala lo que sigue en debate.
- No inventes datos, citas ni enlaces. Si no puedes verificar algo, déjalo fuera.

## Cómo escribir

- En español de España, con tus propias palabras; nunca copies párrafos de un medio.
- Noticias: 4 o 5 párrafos (250–350 palabras). Reportajes: 5 o 6 párrafos (350–450 palabras). Música: 3 párrafos (150–220 palabras).
- El primer párrafo cuenta lo esencial; los siguientes, el contexto y lo que queda abierto.
- Titular informativo de una frase, sin punto final.
- Entre 4 y 6 fragmentos en **negrita** por artículo, de 3 a 12 palabras, repartidos por los párrafos: el hecho esencial, las cifras clave, los nombres decisivos y la consecuencia. Ningún párrafo empieza por negrita.
- Sin `#` de nivel 1 ni emojis.

## Formato de cada archivo

Ruta: `contenido/HOY/<id>.md`. Estructura exacta:

```markdown
<!-- resumen: Una o dos frases para la portada, máximo 160 caracteres. -->
## Titular de la noticia

*Ciudad, sábado 10 de octubre*

<figure>
  <img src="URL DE LA IMAGEN" alt="Descripción de la imagen" loading="lazy">
  <figcaption>Imagen de archivo: qué muestra. Foto: Autor, licencia, vía Wikimedia Commons.</figcaption>
</figure>

Primer párrafo.

Más párrafos.

**Fuentes:** [Medio](https://…) · [Medio](https://…)
```

- La línea en cursiva es la data: lugar y fecha del hecho en las noticias; época o ámbito en los reportajes (`*Grecia, siglo II a. C.*`).
- La URL de la imagen y su crédito (autor y licencia) se copian tal cual de la salida de `preparar` o de `imagenes`. No repitas una imagen dentro de la edición.
- En las noticias la imagen es de archivo: el pie empieza por «Imagen de archivo:» y no da a entender que la foto es del suceso.
- En los reportajes y en Música, la última línea es `**Para saber más:**` con enlaces a artículos de `https://es.wikipedia.org/wiki/…` que existan (dos o tres en los reportajes; uno o dos en Música).
- La línea `<!-- resumen: … -->` la retira `publicar` y la lleva al índice.

## Música

Una recomendación breve del álbum que indica `preparar` (no lo cambies): por qué merece escucharse, en qué momento y contexto se grabó y dos o tres canciones por las que empezar. Se escribe sin buscar en la web, con hechos bien establecidos, y lleva entre 2 y 4 negritas. El archivo `contenido/HOY/musica.md` tiene una línea más que los demás, el artista como subtítulo:

```markdown
<!-- resumen: Una frase que invite a escucharlo, máximo 160 caracteres. -->
## Nombre del álbum

### Artista o grupo

*Estilo · año*

<figure>
  <img src="URL DE LA PORTADA" alt="Portada de «Nombre del álbum»" loading="lazy">
  <figcaption>Portada de «Nombre del álbum» (año), de Artista. Imagen: Cover Art Archive.</figcaption>
</figure>

Tres párrafos.

**Para saber más:** [Wikipedia: Nombre del álbum](https://es.wikipedia.org/wiki/…)
```

El título, el artista, el estilo, el año y la URL de la portada se copian tal cual de `preparar`.

## Reglas

- Solo creas archivos en `contenido/HOY/`. No toques ediciones anteriores, la carpeta `rutina/` ni el código de la web.
- Si una sección no puede completarse con garantías, no escribas su archivo y publica con `python3 rutina/sophy.py publicar --falta="motivo"`. Es preferible una sección menos que una noticia sin verificar.
