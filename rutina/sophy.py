#!/usr/bin/env python3
"""Herramientas de la edición diaria de Sophy. Solo usa la biblioteca estándar.

  python3 rutina/sophy.py preparar            todo lo que hace falta saber antes de escribir
  python3 rutina/sophy.py imagenes "a" "b"    busca imágenes libres en Wikimedia Commons
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


def clave_imagen(url):
    """Nombre del archivo de Commons de una URL, para comparar sin depender de la codificación."""
    return urllib.parse.unquote(url.split("FilePath/")[-1].split("?")[0]).replace("_", " ").strip().lower()


def usadas(indice):
    return {clave_imagen(e["imagen"]) for e in indice["entradas"] if e.get("imagen")}


def limpio(texto):
    texto = html.unescape(re.sub(r"<[^>]+>", " ", texto or ""))
    return re.sub(r"\s+", " ", texto).strip()


# ---------- preparar ----------

def titulares(tema, dia):
    """Titulares de un día en los medios de la sección, alternando medios."""
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
            if madrid(momento) != dia or not dato.get("title"):
                continue
            resumen = limpio(dato.get("description") or dato.get("summary"))
            lista.append((limpio(dato["title"]), resumen[:150], medio, dato.get("link", "").split("#")[0]))
        if lista:
            por_medio.append(lista)
    salida, vistos = [], set()
    while any(por_medio) and len(salida) < 12:
        for lista in por_medio:
            if lista and len(salida) < 12:
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

    print("\n== IMÁGENES DE ARCHIVO YA COMPROBADAS (úsalas en News si encajan; si no, `imagenes`) ==")
    for r in leer_json(os.path.join(RAIZ, "rutina", "reserva.json")):
        if clave_imagen(r["imagen"]) not in ya:
            print(f"{r['tema']} | {url_imagen(r['imagen'])} | {r['autor']}, {r['licencia']}")

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
    for n, termino in enumerate(terminos):
        if n:
            time.sleep(6)
        print(f"== {termino}")
        lista = buscar(termino, 3, excluir)
        if lista is None:
            print("  Wikimedia no responde: usa una de las imágenes ya comprobadas de `preparar`.")
        elif not lista:
            print("  sin resultados libres: prueba un término más general (el lugar, la institución, el tema).")
        for archivo, ancho, autor, licencia in lista or []:
            print(f"  {url_imagen(archivo)}\n    {archivo} · {ancho}px · {autor}, {licencia}")


# ---------- publicar ----------

def git(*orden):
    r = subprocess.run(["git", *orden], cwd=RAIZ, capture_output=True, text=True, encoding="utf-8", errors="replace")
    return r.returncode, (r.stdout + r.stderr).strip()


def wikipedia_rotos(texto):
    """Títulos enlazados a es.wikipedia.org que no existen (una sola consulta)."""
    titulos = sorted({urllib.parse.unquote(t).replace("_", " ") for t in re.findall(r"https://es\.wikipedia\.org/wiki/([^)\s#]+)", texto)})
    if not titulos:
        return []
    url = "https://es.wikipedia.org/w/api.php?action=query&format=json&redirects=1&titles=" + urllib.parse.quote("|".join(titulos))
    try:
        paginas = json.loads(bajar(url, 30)[0].decode("utf-8"))["query"]["pages"].values()
    except Exception:
        return []
    return [p["title"] for p in paginas if "missing" in p or "invalid" in p]


def publicar():
    d = hoy().isoformat()
    carpeta = os.path.join(RAIZ, "contenido", d)
    indice = leer_json(INDICE)
    if any(e["fecha"] == d for e in indice["entradas"]):
        sys.exit("La edición de hoy ya está en el índice.")
    ya = usadas(indice)
    temas = leer_json(os.path.join(RAIZ, "rutina", "temas.json"))
    asuntos = {clave_imagen(t["imagen"]): t["id"] for grupo in temas.values() for t in grupo}
    errores, nuevas, faltan, textos = [], [], [], {}

    for tema in NEWS + CULTURA:
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
        if len(resumen) > 160:
            errores.append(f"{tema}: el resumen tiene {len(resumen)} caracteres (máximo 160)")
        final = "**Para saber más:**" if tema in CULTURA else "**Fuentes:**"
        for n, articulo in enumerate(re.split(r"\n---\n", texto)):
            aqui = f"{tema}" + (f" (artículo {n + 1})" if n else "")
            parrafos = [p.strip() for p in articulo.strip().split("\n\n") if p.strip()]
            if len(parrafos) < 7 or not parrafos[0].startswith("## "):
                errores.append(f"{aqui}: estructura incompleta (titular, data, figura, párrafos y línea final)")
                continue
            if not re.fullmatch(r"\*[^*].*\*", parrafos[1]):
                errores.append(f"{aqui}: la segunda línea debe ser la data en cursiva")
            if not parrafos[2].startswith("<figure>") or "<figcaption>" not in parrafos[2]:
                errores.append(f"{aqui}: falta la <figure> con su pie tras la data")
            if not parrafos[-1].startswith(final) or "](http" not in parrafos[-1]:
                errores.append(f"{aqui}: la última línea debe ser {final} con enlaces")
            cuerpo = parrafos[3:-1]
            if any(p.startswith("**") for p in cuerpo):
                errores.append(f"{aqui}: un párrafo empieza por negrita")
            negritas = len(re.findall(r"\*\*[^*]+\*\*", "\n".join(cuerpo)))
            if not 4 <= negritas <= 6:
                errores.append(f"{aqui}: {negritas} negritas (deben ser entre 4 y 6)")
            palabras = len(re.sub(r"\]\([^)]*\)|[*\[\]]", " ", "\n".join(cuerpo)).split())
            minimo, maximo = (330, 480) if tema in CULTURA else (230, 400)
            if not minimo <= palabras <= maximo:
                errores.append(f"{aqui}: {palabras} palabras (entre {minimo} y {maximo})")
        titulo = re.search(r"^## (.+)$", texto, re.M)
        imagen = re.search(r'<img src="([^"]+)"', texto)
        if not titulo or not imagen:
            continue
        clave = clave_imagen(imagen.group(1))
        if clave in ya:
            errores.append(f"{tema}: la imagen ya se usó en otra edición")
        ya.add(clave)
        entrada = {"fecha": d, "tema": tema, "titulo": titulo.group(1).strip(), "resumen": resumen,
                   "imagen": imagen.group(1), "archivo": f"contenido/{d}/{tema}.md"}
        if tema in CULTURA and clave in asuntos:
            entrada["asunto"] = asuntos[clave]
        nuevas.append(entrada)
        textos[ruta] = texto + "\n"

    if not errores:
        errores += [f"enlace de Wikipedia que no existe: {t}" for t in wikipedia_rotos("\n".join(textos.values()))]
    if not errores:
        fiables = set(asuntos) | {clave_imagen(r["imagen"]) for r in leer_json(os.path.join(RAIZ, "rutina", "reserva.json"))}
        for e in nuevas:
            if clave_imagen(e["imagen"]) in fiables:
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
    elif orden == "publicar":
        publicar()
    else:
        print(__doc__)
