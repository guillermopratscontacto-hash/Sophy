#!/usr/bin/env python3
"""Herramientas de la edición diaria de Sophy. Solo usa la biblioteca estándar.

  python3 rutina/sophy.py preparar            todo lo que hace falta saber antes de escribir
  python3 rutina/sophy.py imagenes "a" "b"    busca imágenes libres en Wikimedia Commons
  python3 rutina/sophy.py leer URL URL ...    texto de varios artículos de prensa, limpio y recortado
  python3 rutina/sophy.py publicar            valida la edición, actualiza el índice y la sube
"""
import datetime, email.utils, html, io, json, os, re, subprocess, sys, time
import urllib.error, urllib.parse, urllib.request
import xml.etree.ElementTree as ET

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDICE = os.path.join(RAIZ, "contenido", "indice.json")
AGENTE = "SophyBot/1.0 (https://github.com/guillermopratscontacto-hash/Sophy)"
NEWS = ["economia", "politica-espanola", "politica-internacional", "internacional"]
CULTURA = ["arte", "historia", "literatura"]
MUSICA = "musica"
# Finanzas: dos apartados semanales (solo los sábados) y uno diario, con un concepto avanzado de una lista.
SEMANALES = ["politica-monetaria", "fusiones"]
APRENDE = "aprende-finanzas"
SABADO = 5
BANCOS = r"\b(bce|fed|reserva federal|banco central|banco de inglaterra|banco de japon|lagarde|powell|tipos de interes|bank of england)\b"
OPERACIONES = r"\b(opa|fusion|fusiones|adquisicion|adquisiciones|adquiere|absorbe|oferta publica|toma el control|participacion mayoritaria|oferta de compra|compra de la)\b"
DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
         "septiembre", "octubre", "noviembre", "diciembre"]

EP = "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/%s/portada"
FUENTES = {
    "economia": [("El País", EP % "economia"), ("El Mundo", "https://e00-elmundo.uecdn.es/elmundo/rss/economia.xml"),
                 ("Expansión", "https://e00-expansion.uecdn.es/rss/economia.xml"), ("ABC", "https://www.abc.es/rss/2.0/economia/"),
                 ("20minutos", "https://www.20minutos.es/rss/economia/"), ("Europa Press", "https://www.europapress.es/rss/rss.aspx?ch=00136")],
    "politica-espanola": [("El País", EP % "espana"), ("El Mundo", "https://e00-elmundo.uecdn.es/elmundo/rss/espana.xml"),
                          ("ABC", "https://www.abc.es/rss/2.0/espana/"), ("20minutos", "https://www.20minutos.es/rss/nacional/"),
                          ("Europa Press", "https://www.europapress.es/rss/rss.aspx?ch=00066")],
    "politica-internacional": [("El País", EP % "internacional"), ("El Mundo", "https://e00-elmundo.uecdn.es/elmundo/rss/internacional.xml"),
                               ("ABC", "https://www.abc.es/rss/2.0/internacional/"), ("France 24", "https://www.france24.com/es/rss"),
                               ("DW", "https://rss.dw.com/rdf/rss-sp-all"), ("Europa Press", "https://www.europapress.es/rss/rss.aspx?ch=00069")],
    "internacional": [("BBC Mundo", "https://feeds.bbci.co.uk/mundo/rss.xml"), ("El País", EP % "sociedad"),
                      ("El País", EP % "ciencia"), ("ABC", "https://www.abc.es/rss/2.0/sociedad/"),
                      ("Europa Press", "https://www.europapress.es/rss/rss.aspx?ch=00073")],
}


def hoy():
    for a in sys.argv:
        if a.startswith("--hoy="):
            return datetime.date.fromisoformat(a[6:])
    try:
        from zoneinfo import ZoneInfo
        return datetime.datetime.now(ZoneInfo("Europe/Madrid")).date()
    except Exception:
        return datetime.date.today()


def madrid(momento):
    try:
        from zoneinfo import ZoneInfo
        return momento.astimezone(ZoneInfo("Europe/Madrid")).date()
    except Exception:
        return momento.astimezone().date()


def largo(d):
    return f"{DIAS[d.weekday()]} {d.day} de {MESES[d.month - 1]}"


def leer_json(ruta):
    with io.open(ruta, encoding="utf-8") as f:
        return json.load(f)


def bajar(url, espera=20):
    pet = urllib.request.Request(url, headers={"User-Agent": AGENTE})
    with urllib.request.urlopen(pet, timeout=espera) as r:
        return r.read(), r.headers.get("Content-Type", "")


def url_imagen(archivo, ancho=1200):
    return "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(archivo) + f"?width={ancho}"


def url_portada(mbid):
    return f"https://coverartarchive.org/release-group/{mbid}/front-500"


def clave_imagen(url):
    """Nombre del archivo de Commons de una URL, para comparar sin depender de la codificación."""
    return urllib.parse.unquote(url.split("FilePath/")[-1].split("?")[0]).replace("_", " ").strip().lower()


def usadas(indice):
    return {clave_imagen(e["imagen"]) for e in indice["entradas"] if e.get("imagen")}


REPOSO = 30  # días que tarda una imagen de archivo en poder volver a usarse


def reserva_libre(indice, dia):
    """Imágenes de archivo disponibles: las que no han salido en los últimos REPOSO días."""
    limite = (dia - datetime.timedelta(days=REPOSO)).isoformat()
    recientes = {clave_imagen(e["imagen"]) for e in indice["entradas"] if e.get("imagen") and e["fecha"] > limite}
    return [r for r in leer_json(os.path.join(RAIZ, "rutina", "reserva.json")) if clave_imagen(r["imagen"]) not in recientes]


def sin_tildes(texto):
    import unicodedata
    texto = unicodedata.normalize("NFD", texto.lower())
    return re.sub(r"[^a-z0-9 ]+", " ", "".join(c for c in texto if unicodedata.category(c) != "Mn"))


def limpio(texto):
    texto = html.unescape(re.sub(r"<[^>]+>", " ", texto or ""))
    return re.sub(r"\s+", " ", texto).strip()


# ---------- preparar ----------

def titulares(tema, dia, limite=10, patron=None):
    """Titulares de un día (o de varios) en los medios de la sección, alternando medios.
    Con `patron`, solo los que lo contienen en el titular o en el resumen."""
    dias = dia if isinstance(dia, (set, frozenset)) else {dia}
    por_medio = []
    for medio, url in FUENTES[tema]:
        try:
            raiz = ET.fromstring(bajar(url)[0])
        except Exception:
            continue
        lista = []
        for item in raiz.iter():
            if item.tag.split("}")[-1] not in ("item", "entry"):
                continue
            dato = {}
            for h in item:
                nombre = h.tag.split("}")[-1]
                if nombre == "link" and not (h.text or "").strip():
                    dato["link"] = h.get("href", "")
                elif nombre in ("title", "link", "description", "summary", "pubDate", "date", "published", "updated"):
                    dato.setdefault(nombre, (h.text or "").strip())
            fecha = dato.get("pubDate") or dato.get("date") or dato.get("published") or dato.get("updated") or ""
            try:
                momento = email.utils.parsedate_to_datetime(fecha) if "," in fecha else datetime.datetime.fromisoformat(fecha.replace("Z", "+00:00"))
                if momento.tzinfo is None:
                    momento = momento.replace(tzinfo=datetime.timezone.utc)
            except Exception:
                continue
            if madrid(momento) not in dias or not dato.get("title"):
                continue
            resumen = limpio(dato.get("description") or dato.get("summary"))
            if patron and not re.search(patron, sin_tildes(dato["title"] + " " + resumen)):
                continue
            lista.append((limpio(dato["title"]), resumen[:110], medio, dato.get("link", "").split("#")[0]))
        if lista:
            por_medio.append(lista)
    salida, vistos = [], set()
    while any(por_medio) and len(salida) < limite:
        for lista in por_medio:
            if lista and len(salida) < limite:
                t = lista.pop(0)
                marca = re.sub(r"\W+", "", t[0].lower())[:40]
                if marca not in vistos:
                    vistos.add(marca)
                    salida.append(t)
    return salida


def preparar():
    d = hoy()
    ayer = d - datetime.timedelta(days=1)
    indice = leer_json(INDICE)
    print(f"HOY={d.isoformat()} ({largo(d)}) · AYER={ayer.isoformat()} ({largo(ayer)})")
    if os.path.isdir(os.path.join(RAIZ, "contenido", d.isoformat())):
        print("EDICIÓN YA PUBLICADA: termina sin cambiar nada.")
        return
    print(f"Escribe los archivos en contenido/{d.isoformat()}/ (crea la carpeta al escribir el primero).")
    ya = usadas(indice)

    print("\n== NEWS YA PUBLICADAS (no repitas el mismo hecho; si la historia sigue, cuenta solo lo nuevo) ==")
    limite = (d - datetime.timedelta(days=7)).isoformat()
    for e in indice["entradas"]:
        if e["tema"] in NEWS and e["fecha"] >= limite:
            print(f"{e['fecha']} {e['tema']} | {e['titulo']}")

    print("\n== CULTURA DE HOY (asunto e imagen ya decididos: solo hay que escribir) ==")
    temas = leer_json(os.path.join(RAIZ, "rutina", "temas.json"))
    hechos = {e.get("asunto") for e in indice["entradas"]}
    for tema in CULTURA:
        libre = next((t for t in temas.get(tema, []) if t["id"] not in hechos and clave_imagen(t["imagen"]) not in ya), None)
        if libre:
            print(f"{tema}: {libre['asunto']}  [asunto={libre['id']}]")
            print(f"  imagen: {url_imagen(libre['imagen'])}")
            print(f"  crédito: {libre['autor']}, {libre['licencia']}, vía Wikimedia Commons")
        else:
            print(f"{tema}: LISTA AGOTADA. Elige un asunto que no esté en esta lista de publicados y busca su imagen:")
            for e in indice["entradas"]:
                if e["tema"] == tema:
                    print(f"  - {e['titulo']}")

    print("\n== MÚSICA DE HOY (álbum y portada ya decididos: solo hay que escribir la recomendación) ==")
    album = next((a for a in leer_json(os.path.join(RAIZ, "rutina", "albumes.json")) if a["id"] not in hechos), None)
    if album:
        print(f"musica: «{album['album']}» ({album['anio']}), de {album['artista']} · estilo: {album['estilo']}  [asunto={album['id']}]")
        print(f"  portada: {url_portada(album['mbid'])}")
    else:
        print("musica: LISTA AGOTADA. No escribas musica.md.")

    print("\n== FINANZAS ==")
    concepto = next((c for c in leer_json(os.path.join(RAIZ, "rutina", "conceptos.json")) if c["id"] not in hechos), None)
    if concepto:
        print(f"aprende-finanzas (diario): «{concepto['concepto']}» · término: {concepto['termino']} · área: {concepto['area']}  [asunto={concepto['id']}]")
    else:
        print("aprende-finanzas: LISTA AGOTADA. No escribas aprende-finanzas.md.")
    if d.weekday() == SABADO:
        semana = {d - datetime.timedelta(days=i) for i in range(1, 8)}
        print("HOY ES SÁBADO: además, escribe politica-monetaria (3 artículos distintos en el mismo archivo) y fusiones (1 caso).")
        for etiqueta, patron in (("política monetaria", BANCOS), ("fusiones y adquisiciones", OPERACIONES)):
            print(f"-- candidatos de {etiqueta} de los últimos 7 días --")
            vistos = []
            for tema in ("economia", "politica-internacional"):
                vistos += titulares(tema, semana, 8, patron)
            for titulo, resumen, medio, enlace in vistos:
                print(f"· {titulo}. {resumen} [{medio}] {enlace}")
            if not vistos:
                print("(sin candidatos en los medios: usa la búsqueda web)")
    else:
        print("Hoy no es sábado: no escribas politica-monetaria ni fusiones.")

    print("\n== IMÁGENES DE ARCHIVO DISPONIBLES (pídelas por su nombre con `imagenes`; si ninguna encaja, pide otro término) ==")
    grupos = {}
    for r in reserva_libre(indice, d):
        grupo, _, nombre = r["tema"].rpartition(" · ")
        grupos.setdefault(grupo or "Varias", set()).add(nombre)
    for grupo, nombres in sorted(grupos.items()):
        print(f"{grupo}: " + "; ".join(sorted(nombres)))

    print(f"\n== TITULARES DEL {ayer.isoformat()} ==")
    for tema in NEWS:
        lista = titulares(tema, ayer)
        nota = ""
        if len(lista) < 4:
            lista += titulares(tema, ayer - datetime.timedelta(days=1))
            nota = " (pocos de ayer: se añaden los de anteayer)"
        print(f"-- {tema}{nota} --")
        for titulo, resumen, medio, enlace in lista:
            print(f"· {titulo}. {resumen} [{medio}] {enlace}")
        if not lista:
            print("(sin titulares: usa la búsqueda web)")


# ---------- imagenes ----------

LIBRE = re.compile(r"^(public domain|pd\b|cc0|cc[ -]by(-sa)?[ -]\d|cc[ -]by(-sa)?$|no restrictions|attribution)", re.I)


def buscar(termino, cuantas=3, excluir=()):
    """Candidatas libres de Commons para un término: (archivo, ancho, autor, licencia)."""
    url = ("https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=15"
           "&gsrsearch=" + urllib.parse.quote("filetype:bitmap " + termino) + "&prop=imageinfo&iiprop=extmetadata|size|mime")
    for intento in range(6):
        try:
            datos = json.loads(bajar(url, 30)[0].decode("utf-8"))
            if "error" not in datos:
                break
        except Exception:
            pass
        time.sleep(60)
    else:
        return None
    paginas = sorted(datos.get("query", {}).get("pages", {}).values(), key=lambda p: p.get("index", 0))
    salida = []
    for p in paginas:
        info = (p.get("imageinfo") or [{}])[0]
        meta = info.get("extmetadata", {})
        licencia = limpio(meta.get("LicenseShortName", {}).get("value", ""))
        archivo = p["title"].split(":", 1)[1]
        if info.get("mime") not in ("image/jpeg", "image/png") or info.get("width", 0) < 1000:
            continue
        if not LIBRE.match(licencia) or archivo.lower() in excluir:
            continue
        autor = limpio(meta.get("Artist", {}).get("value", ""))[:60] or "autor desconocido"
        licencia = "dominio público" if re.match(r"public domain|pd\b|no restrictions", licencia, re.I) else licencia
        salida.append((archivo, info["width"], autor, licencia))
        if len(salida) == cuantas:
            break
    return salida


def comprobar(url):
    """True si la URL devuelve una imagen, False si no, None si Wikimedia no deja comprobarlo."""
    for intento in range(4):
        try:
            pet = urllib.request.Request(url, headers={"User-Agent": AGENTE, "Range": "bytes=0-2047"})
            with urllib.request.urlopen(pet, timeout=40) as r:
                return r.headers.get("Content-Type", "").startswith("image/")
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503):
                return False
        except Exception:
            pass
        time.sleep(30)
    return None


def imagenes(terminos):
    indice = leer_json(INDICE)
    excluir = usadas(indice)
    for nombre in ("temas.json", "reserva.json"):
        datos = leer_json(os.path.join(RAIZ, "rutina", nombre))
        grupos = datos.values() if isinstance(datos, dict) else [datos]
        excluir |= {g["imagen"].lower() for grupo in grupos for g in grupo}
    libres = reserva_libre(indice, hoy())
    buscado = False
    for termino in terminos:
        print(f"== {termino}")
        # Primero, la reserva: el nombre exacto o, si no, los que contienen todas las palabras.
        llano = sin_tildes(termino).split()
        exactas = [r for r in libres if sin_tildes(r["tema"]).split() == llano]
        propias = exactas or [r for r in libres if llano and all(p in sin_tildes(r["tema"]).split() for p in llano)]
        for r in propias[:3]:
            print(f"  {url_imagen(r['imagen'])}\n    reserva: {r['tema']} · {r['autor']}, {r['licencia']}")
        if propias:
            continue
        if buscado:
            time.sleep(6)
        buscado = True
        lista = buscar(termino, 3, excluir)
        if lista is None:
            print("  Wikimedia no responde: pide por su nombre una imagen de archivo de la lista de `preparar`.")
        elif not lista:
            print("  sin resultados libres: prueba un término más general (el lugar, la institución, el tema).")
        for archivo, ancho, autor, licencia in lista or []:
            print(f"  {url_imagen(archivo)}\n    {archivo} · {ancho}px · {autor}, {licencia}")


# ---------- leer ----------

def leer(urls):
    """Texto principal de cada artículo: los párrafos largos, sin menús ni publicidad."""
    for n, url in enumerate(urls):
        print(f"== {url}")
        try:
            pagina = bajar(url, 30)[0].decode("utf-8", errors="ignore")
        except Exception as e:
            print(f"  no se ha podido abrir ({str(e)[:60]}): usa otra fuente o la búsqueda web")
            continue
        pagina = re.sub(r"(?is)<(script|style|nav|header|footer|aside|figure)[^>]*>.*?</\1>", " ", pagina)
        titulo = re.search(r"(?is)<h1[^>]*>(.*?)</h1>", pagina)
        if titulo:
            print("  " + limpio(titulo.group(1)))
        parrafos = [limpio(p) for p in re.findall(r"(?is)<p[^>]*>(.*?)</p>", pagina)]
        texto = "\n".join(p for p in parrafos if len(p) > 80)
        print(texto[:3000] or "  sin texto legible: usa otra fuente")


# ---------- publicar ----------

IMAGENES_OK = ("https://commons.wikimedia.org/", "https://coverartarchive.org/")


def html_peligroso(texto):
    """Fallos de seguridad en una pieza: solo se admite <figure>, <figcaption> e <img> (con src, alt y loading)
    y enlaces http(s). La web también sanea con DOMPurify; esto evita que llegue ahí nada raro."""
    fallos = []
    for m in re.finditer(r"<\s*/?\s*([a-zA-Z][\w:-]*)([^>]*)>", texto):
        etiqueta, resto = m.group(1).lower(), m.group(2)
        if etiqueta not in ("figure", "figcaption", "img"):
            fallos.append(f"etiqueta HTML no permitida: <{etiqueta}>")
        elif etiqueta == "img":
            for atributo in re.findall(r"([\w:-]+)\s*=", re.sub(r'"[^"]*"|\'[^\']*\'', '""', resto)):
                if atributo.lower() not in ("src", "alt", "loading"):
                    fallos.append(f"atributo no permitido en <img>: {atributo}")
            origen = re.search(r'src="([^"]*)"', resto)
            if not origen or not origen.group(1).startswith(IMAGENES_OK):
                fallos.append("<img> con un src que no es de Wikimedia Commons ni de Cover Art Archive")
        elif resto.strip(" /"):
            fallos.append(f"atributos no permitidos en <{etiqueta}>")
    for destino in re.findall(r"\]\(\s*<?([^)\s>]*)", texto):
        if not re.match(r"https?://", destino, re.I):
            fallos.append(f"enlace que no es http(s): {destino[:40]}")
    return sorted(set(fallos))

def git(*orden):
    r = subprocess.run(["git", *orden], cwd=RAIZ, capture_output=True, text=True, encoding="utf-8", errors="replace")
    return r.returncode, (r.stdout + r.stderr).strip()


def wikipedia_rotos(texto):
    """Títulos enlazados a es.wikipedia.org o en.wikipedia.org que no existen (una consulta por idioma)."""
    rotos = []
    for idioma in ("es", "en"):
        titulos = sorted({urllib.parse.unquote(t).replace("_", " ") for t in re.findall(rf"https://{idioma}\.wikipedia\.org/wiki/([^)\s#]+)", texto)})
        if not titulos:
            continue
        url = f"https://{idioma}.wikipedia.org/w/api.php?action=query&format=json&redirects=1&titles=" + urllib.parse.quote("|".join(titulos))
        try:
            paginas = json.loads(bajar(url, 30)[0].decode("utf-8"))["query"]["pages"].values()
        except Exception:
            continue
        rotos += [f"{idioma}:{p['title']}" for p in paginas if "missing" in p or "invalid" in p]
    return rotos


def publicar():
    d = hoy().isoformat()
    carpeta = os.path.join(RAIZ, "contenido", d)
    # Por si los archivos se escribieron en contenido/HOY/ en lugar de en la carpeta con la fecha.
    literal = os.path.join(RAIZ, "contenido", "HOY")
    if os.path.isdir(literal) and not os.path.isdir(carpeta):
        os.rename(literal, carpeta)
    indice = leer_json(INDICE)
    if any(e["fecha"] == d for e in indice["entradas"]):
        sys.exit("La edición de hoy ya está en el índice.")
    ya = usadas(indice)
    temas = leer_json(os.path.join(RAIZ, "rutina", "temas.json"))
    asuntos = {clave_imagen(t["imagen"]): t["id"] for grupo in temas.values() for t in grupo}
    albumes = {clave_imagen(url_portada(a["mbid"])): a for a in leer_json(os.path.join(RAIZ, "rutina", "albumes.json"))}
    # Las imágenes de archivo pueden repetirse pasados REPOSO días; las demás, nunca.
    descansadas = {clave_imagen(r["imagen"]) for r in reserva_libre(indice, hoy())}
    errores, nuevas, faltan, textos = [], [], [], {}
    conceptos = {sin_tildes(c["concepto"]): c for c in leer_json(os.path.join(RAIZ, "rutina", "conceptos.json"))}
    es_sabado = hoy().weekday() == SABADO

    for tema in NEWS + (SEMANALES if es_sabado else []) + CULTURA + [MUSICA, APRENDE]:
        ruta = os.path.join(carpeta, tema + ".md")
        if not os.path.exists(ruta):
            faltan.append(tema)
            continue
        texto = io.open(ruta, encoding="utf-8").read().replace("\r\n", "\n").strip()
        m = re.match(r"<!--\s*resumen:\s*(.*?)\s*-->\n+", texto, re.S)
        if not m:
            errores.append(f"{tema}: falta la primera línea `<!-- resumen: … -->`")
            continue
        resumen, texto = limpio(m.group(1)), texto[m.end():]
        errores += [f"{tema}: {f}" for f in html_peligroso(texto)]
        if len(resumen) > 160:
            errores.append(f"{tema}: el resumen tiene {len(resumen)} caracteres (máximo 160)")
        final = "**Fuentes:**" if tema in NEWS + SEMANALES else "**Para saber más:**"
        articulos = re.split(r"\n---\n", texto)
        if tema == "politica-monetaria" and len(articulos) != 3:
            errores.append(f"{tema}: debe llevar 3 artículos separados por una línea `---` (lleva {len(articulos)})")
        if tema == "fusiones" and len(articulos) != 1:
            errores.append(f"{tema}: debe tratar un solo caso (un único artículo)")
        for n, articulo in enumerate(articulos):
            aqui = f"{tema}" + (f" (artículo {n + 1})" if n else "")
            parrafos = [p.strip() for p in articulo.strip().split("\n\n") if p.strip()]
            if tema in (MUSICA, APRENDE):
                # Bajo el título va un subtítulo (artista o término en inglés); el resto se valida igual.
                if len(parrafos) < 2 or not parrafos[1].startswith("### "):
                    errores.append(f"{tema}: la segunda línea debe ser `### subtítulo`")
                    continue
                del parrafos[1]
            sin_figura = tema == APRENDE
            if len(parrafos) < (5 if sin_figura else 6 if tema == MUSICA else 7) or not parrafos[0].startswith("## "):
                errores.append(f"{aqui}: estructura incompleta (titular, data, figura, párrafos y línea final)")
                continue
            if not re.fullmatch(r"\*[^*].*\*", parrafos[1]):
                errores.append(f"{aqui}: la segunda línea debe ser la data en cursiva")
            if not sin_figura and (not parrafos[2].startswith("<figure>") or "<figcaption>" not in parrafos[2]):
                errores.append(f"{aqui}: falta la <figure> con su pie tras la data")
            if not parrafos[-1].startswith(final) or "](http" not in parrafos[-1]:
                errores.append(f"{aqui}: la última línea debe ser {final} con enlaces")
            cuerpo = parrafos[2:-1] if sin_figura else parrafos[3:-1]
            if any(p.startswith("**") for p in cuerpo):
                errores.append(f"{aqui}: un párrafo empieza por negrita")
            negritas = len(re.findall(r"\*\*[^*]+\*\*", "\n".join(cuerpo)))
            menos, mas = (2, 4) if tema == MUSICA else (3, 6) if tema == APRENDE else (4, 6)
            if not menos <= negritas <= mas:
                errores.append(f"{aqui}: {negritas} negritas (deben ser entre {menos} y {mas})")
            palabras = len(re.sub(r"\]\([^)]*\)|[*\[\]]", " ", "\n".join(cuerpo)).split())
            minimo, maximo = ((330, 480) if tema in CULTURA else (130, 260) if tema == MUSICA else (330, 520) if tema == APRENDE
                              else (260, 460) if tema == "fusiones" else (230, 400))
            if not minimo <= palabras <= maximo:
                errores.append(f"{aqui}: {palabras} palabras (entre {minimo} y {maximo})")
        titulo = re.search(r"^## (.+)$", texto, re.M)
        imagenes_pieza = re.findall(r'<img src="([^"]+)"', texto)
        if tema == APRENDE:
            c = conceptos.get(sin_tildes(titulo.group(1))) if titulo else None
            if not c:
                errores.append("aprende-finanzas: el titular debe ser exactamente el concepto que indica `preparar`")
            elif c["id"] in {e.get("asunto") for e in indice["entradas"]}:
                errores.append("aprende-finanzas: ese concepto ya se publicó")
            else:
                nuevas.append({"fecha": d, "tema": tema, "titulo": c["concepto"], "subtitulo": c["termino"], "estilo": c["area"],
                               "resumen": resumen, "asunto": c["id"], "archivo": f"contenido/{d}/{tema}.md"})
                textos[ruta] = texto + "\n"
            continue
        if not titulo or not imagenes_pieza:
            continue
        for otra in imagenes_pieza:
            if clave_imagen(otra) in ya and clave_imagen(otra) not in descansadas:
                errores.append(f"{tema}: la imagen ya se usó en otra edición")
            ya.add(clave_imagen(otra))
        imagen = imagenes_pieza[0]
        clave = clave_imagen(imagen)
        entrada = {"fecha": d, "tema": tema, "titulo": titulo.group(1).strip(), "resumen": resumen,
                   "imagen": imagen, "archivo": f"contenido/{d}/{tema}.md"}
        if tema in CULTURA and clave in asuntos:
            entrada["asunto"] = asuntos[clave]
        if tema == MUSICA:
            album = albumes.get(clave)
            if not album:
                errores.append("musica: la portada no es la del álbum que indica `preparar`")
                continue
            # En Música el titular es el álbum; el artista y el estilo van aparte.
            entrada.update(titulo=album["album"], subtitulo=album["artista"], estilo=album["estilo"], asunto=album["id"])
        nuevas.append(entrada)
        textos[ruta] = texto + "\n"

    if not errores:
        errores += [f"enlace de Wikipedia que no existe: {t}" for t in wikipedia_rotos("\n".join(textos.values()))]
    if not errores:
        fiables = set(asuntos) | set(albumes) | {clave_imagen(r["imagen"]) for r in leer_json(os.path.join(RAIZ, "rutina", "reserva.json"))}
        for e in nuevas:
            if not e.get("imagen") or clave_imagen(e["imagen"]) in fiables:
                continue
            time.sleep(3)
            if comprobar(e["imagen"]) is False:
                errores.append(f"{e['tema']}: la URL de la imagen no devuelve una imagen")
    if errores or not nuevas:
        print("NO PUBLICADO. Corrige y vuelve a ejecutar:")
        print("\n".join("- " + e for e in errores) or "- no hay ninguna pieza escrita")
        sys.exit(1)

    for ruta, texto in textos.items():
        io.open(ruta, "w", encoding="utf-8", newline="\n").write(texto)
    indice["entradas"] = nuevas + indice["entradas"]
    io.open(INDICE, "w", encoding="utf-8", newline="\n").write(json.dumps(indice, ensure_ascii=False, indent=2) + "\n")
    leer_json(INDICE)

    mensaje = f"Edición del {d}"
    motivo = next((a[8:] for a in sys.argv if a.startswith("--falta=")), "")
    publicados = {e.get("asunto") for e in indice["entradas"]}
    if MUSICA in faltan and all(a["id"] in publicados for a in albumes.values()):
        faltan.remove(MUSICA)  # lista de álbumes agotada: no es una sección que falte
    if APRENDE in faltan and all(c["id"] in publicados for c in conceptos.values()):
        faltan.remove(APRENDE)
    if faltan:
        mensaje += f"\n\nFaltan: {', '.join(faltan)}. {motivo}".rstrip()
    if "--sin-subir" in sys.argv:
        print(f"Validado ({len(nuevas)} piezas). No se ha hecho commit por --sin-subir.")
        return
    git("add", f"contenido/{d}", "contenido/indice.json")
    codigo, salida = git("commit", "-m", mensaje)
    if codigo:
        sys.exit("Falló el commit:\n" + salida)
    for intento in range(3):
        git("fetch", "origin", "main")
        codigo, salida = git("rebase", "origin/main")
        if codigo:
            sys.exit("Falló el rebase:\n" + salida)
        codigo, salida = git("push", "origin", "HEAD:main")
        if not codigo:
            print(f"PUBLICADO: {mensaje.splitlines()[0]} ({len(nuevas)} piezas)" + (f". Faltan: {', '.join(faltan)}" if faltan else ""))
            return
        time.sleep(10)
    sys.exit("Falló el push:\n" + salida)


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    orden = sys.argv[1] if len(sys.argv) > 1 else ""
    if orden == "preparar":
        preparar()
    elif orden == "imagenes":
        imagenes([a for a in sys.argv[2:] if not a.startswith("--")])
    elif orden == "leer":
        leer([a for a in sys.argv[2:] if a.startswith("http")])
    elif orden == "publicar":
        publicar()
    else:
        print(__doc__)
