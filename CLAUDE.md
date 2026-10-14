# Sophy

Plataforma personal de aprendizaje diario. Web estática en GitHub Pages (repo `guillermopratscontacto-hash/Sophy`, rama `main`, se publica sola al hacer push). Cuentas, progreso y avisos en Supabase. Cada madrugada una rutina en la nube publica la edición del día.

## Cómo trabajar con Guillermo

- **Responde siempre en español.** Respuestas claras y no demasiado largas; si pregunta «sé breve», brevísimo. Si te pide opinión, da una recomendación, no un catálogo.
- **Verifica antes de subir.** Los cambios de diseño se comprueban con una captura (ver «Pruebas»). Di siempre qué has comprobado y qué no (móvil real, ratón real, iPhone).
- **Sé honesto con las dudas.** Textos escritos de memoria, imágenes no revisadas una a una, estimaciones de coste: dilo.
- **Cambios en la web: commit y push al terminar**, sin preguntar. Antes: `git pull --rebase origin main`. Mensaje de commit en español con la línea final `Co-Authored-By: <modelo en uso> <noreply@anthropic.com>`. Si el push falla con `fatal error in commit_refs`, reintenta.
- Lo que no se deshace con git (Supabase, el encargo de la rutina en la nube) hay que avisarlo.
- Los usuarios de la web son pocos y conocidos, pero hay una página de privacidad: no cambies qué datos se guardan sin actualizarla (`vistaTerminos` en `app.js`).

## Estructura

- `index.html`, `styles.css`, `app.js`: toda la web (sin framework; router por hash `#/seccion/…`, `#/leer/fecha/tema`). `app.js` es un único IIFE grande; evita nombres de funciones repetidos (ya hubo choques: `cajaDe`).
- `config.js`: URL y clave pública de Supabase, clave pública VAPID y correo de contacto.
- `sw.js` y `manifest.webmanifest`: app instalable en iPhone y avisos push.
- `contenido/indice.json`: temas (secciones) y todas las entradas publicadas. `contenido/AAAA-MM-DD/<tema>.md`: cada pieza.
- `contenido/geografia/`: `paises.json` (40 países), una ficha `.md` por país, `galerias.json` (6 fotos por país), `mundo.json` (mapa; también lo usa «Adivina el país»), `banderas/` (147 PNG).
- `contenido/juegos/palabras.json`: lista de la palabra del día.
- `rutina/`: lo que usa la rutina diaria (ver abajo). `RUTINA.md`: instrucciones del agente.
- `supabase/*.sql`: tablas, funciones y vistas. Se ejecutan a mano en el SQL Editor; la web no las crea. `supabase/functions/recordatorio/` es la función de los avisos de las 20:00 (desplegada con el nombre `hyper-api`).
- `DESIGN.md`: sistema de diseño (tokens de color, tipografías: Playfair Display, Source Serif 4, Inter).

## Secciones de la web

News (economía, política española, política internacional, internacional) · Finanzas (política monetaria, fusiones y adquisiciones, aprende finanzas) · Cultura (arte, historia, literatura) · Geografía (país del día, globo 3D/mapa 2D) · Música (álbum del día) · Minijuegos (la palabra del día, sudoku, adivina el país). Menú de las tres rayas: Biblioteca (todo lo publicado, con filtros), Guardados, Usuario, Historial, Friends, About Us, modo oscuro.

Una sola racha general: cuenta el día si se completa cualquier cosa (pieza, país, juego). Hay modo local (sin Supabase) que guarda en `localStorage`; sirve para pruebas.

## La rutina diaria (importante: gasta tokens)

- Encargo en la nube: `trig_01QGLkaZ6fi6dSS4iUq91dof` («Sophy: edición diaria», cron `30 1 * * *` UTC, modelo Sonnet). Lee `RUTINA.md`, que le manda usar `python3 rutina/sophy.py` en cinco pasos: `preparar`, `leer`, `imagenes`, escribir, `publicar`. Se gestiona con la herramienta `RemoteTrigger` (`get`, `update`, `list_runs`, `get_run_log`).
- **El objetivo es que dé pocos pasos**: cada paso relee toda la conversación. Primera ejecución sin optimizar: 57 pasos; con el sistema nuevo, 32. Mira el registro de cada ejecución para ver qué le hace perder pasos.
- Listas ya preparadas para que la rutina no busque: `rutina/temas.json` (90 temas de Cultura con imagen), `albumes.json` (54 álbumes, portadas de Cover Art Archive), `conceptos.json` (64 conceptos de Aprende finanzas), `reserva.json` (305 imágenes de archivo para News; vuelven a poder usarse a los 30 días). Cultura, Música y conceptos **no se repiten nunca**.
- Los sábados la rutina escribe además Finanzas: `politica-monetaria` (exactamente 3 artículos en un archivo, separados por `---`) y `fusiones` (1 caso). `publicar` valida formato, negritas, palabras, imágenes y enlaces, y rechaza lo que no cumple.
- Cuidado: `publicar --sin-subir` **sí escribe** en `contenido/` y en el índice (solo omite el commit). Pruébalo en una copia, no en el repo real.
- Wikimedia limita las peticiones: siempre con el User-Agent `SophyBot/1.0 (https://github.com/guillermopratscontacto-hash/Sophy)` y 5 s entre consultas. Imágenes: solo Wikimedia Commons con licencia libre (y portadas de álbum de Cover Art Archive).

## Pruebas

- Para ver cambios de diseño: copia el repo a una carpeta temporal, deja `config.js` con las claves vacías (modo local), sirve con `python -m http.server <puerto>` y haz capturas con Edge sin ventana: `"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --disable-gpu --hide-scrollbars --user-data-dir=<carpeta nueva> --window-size=ANCHO,ALTO --virtual-time-budget=10000 --screenshot=<ruta.png> "http://localhost:<puerto>/index.html#/…"`. Edge no baja de unos 500 px de ancho, y las animaciones no avanzan del todo en las capturas. Para simular pulsaciones, usa una página con un `<iframe>` y `setTimeout`.
- Para parar los servidores de prueba en Windows: buscar procesos `python.exe` con `http.server` en la línea de comandos y detenerlos.
- **Scripts de parche**: no uses heredocs de bash con Python que lleve comillas (falla con «unexpected EOF»). Escribe el script con la herramienta Write en el scratchpad y ejecútalo. Los archivos `.js`/`.css`/`.md` del repo se escriben con LF; respeta el salto de línea que tenga cada archivo al reemplazar texto.
- Los textos de las piezas que escribe la rutina no pasan por revisión humana: revisa formato con `rutina/sophy.py publicar` en una copia.

## Secretos

- La clave privada VAPID **no** está en el repo ni debe mostrarse, copiarse ni subirse: vive solo como secreto `VAPID_PRIVATE_KEY` de la función de Supabase.
- Nunca pongas claves de servicio (`service_role`) en la web. La clave publicable de Supabase de `config.js` es pública por diseño; lo que protege los datos son las políticas RLS de `supabase/*.sql`.
- El correo de Guillermo (`guillermoprats.contacto@gmail.com`) solo se usa como contacto en la página de privacidad; no lo mandes a servicios ajenos.
- Los me gusta / no me gusta y la actividad por correo solo los ve él, desde el panel de Supabase (esquema `privado`).

## Pendiente (a fecha 14 de octubre de 2026)

- Mirar el registro de la rutina del 15 de octubre (¿cuántos pasos? ¿falló algo?) y el del sábado 17 (primera con Finanzas).
- Revisar si algunos conceptos de `conceptos.json` son demasiado áridos para el nivel pedido (intermedio-avanzado, bien explicado).
- Actualizar el Excel de fechas límite (`Sophy - fechas limite de contenido.xlsx`, fuera de git): Geografía son 40 países y faltan Finanzas y Adivina el país.
- Reponer listas cuando se agoten: Cultura (≈ 30 días), Música (≈ 54), conceptos (≈ 64), palabras (≈ 1 año), países de Geografía (faltan 153 de 193).
- Términos y condiciones: la página `#/terminos` es un borrador; conviene una revisión profesional si hay usuarios desconocidos.
- Sin probar en dispositivos reales: móvil/iPhone (cabecera, carrusel de fotos, minijuegos), ratón y deslizar con el dedo.
- La rutina se lanza en hora UTC: a las 3:30 en horario de verano y a las 2:30 en invierno.
