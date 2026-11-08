# Trabajo en curso: contenido hasta el 31/12/2026

Rama `trabajo-contenido-2026`. **No está en `main`**: la rutina diaria sigue funcionando como siempre hasta que esto se termine y se fusione.

## Objetivo

Dejar escritos los artículos de Arte, Historia, Literatura, Música y Aprende finanzas del 9 nov al 31 dic de 2026 (53 días) en `rutina/borradores/<fecha>/`, y que la rutina solo los copie y publique (sigue escribiendo News y Finanzas de los sábados). Además, 42 países nuevos en Geografía (de 40 a 82).

Reglas de Guillermo: Literatura solo novelas y poemas; Arte solo cuadros o esculturas; Música solo rock, rock progresivo y géneros parecidos. No cambiar nombres de secciones.

## Estado (8 nov 2026)

- Hecho: planes de temas (`plan.py`, `geo_plan.py`, `conceptos_plan.py`, `musica.py`), imágenes resueltas en Commons (`cult_out.json`, `t1/t2_out.json`, `geo_final.json`), MBID y portadas de los 53 álbumes (`albumes_nuevos.json`).
- Escrito y validado: **Arte (53/53)** y **Historia (53/53)** en `textos/`.
- Falta: Literatura (53), Música (53), Aprende finanzas (53), fichas de Geografía (42); cambiar `rutina/sophy.py` (preparar/publicar usan los borradores, cogiendo la carpeta más antigua con fecha <= hoy) y `RUTINA.md`; comprobar enlaces de Wikipedia; probar `publicar --sin-subir` día a día en una copia; actualizar `CLAUDE.md`; fusionar en `main`.

## Cómo seguir

Los scripts esperan estar en el scratchpad con `R = "C:/Users/guill/Desktop/Sophy/"`: copiar esta carpeta a un directorio temporal y ejecutar desde allí `python build.py` (valida) o `python build.py --escribir` (escribe borradores y listas en el repo). Formato de `textos/<sección>-N.txt`: bloques `@@ <fecha o id de país>`, cabecera `campo: valor` (resumen, titulo, data, alt, pie, saber), línea en blanco y párrafos.
