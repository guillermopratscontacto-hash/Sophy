"""Monta los borradores y las listas a partir de textos/*.txt. Uso: python build.py [--escribir]
Sin --escribir solo valida e informa."""
import glob, io, json, os, re, sys, urllib.parse, unicodedata, datetime
sys.stdout.reconfigure(encoding="utf-8")
import plan, conceptos_plan, geo_plan

R = "C:/Users/guill/Desktop/Sophy/"
AQUI = os.path.dirname(os.path.abspath(__file__))
ESCRIBIR = "--escribir" in sys.argv
FECHAS = [d.isoformat() for d in plan.FECHAS]
key = lambda s: urllib.parse.unquote(s).replace("_", " ").strip().lower()
leer = lambda p: json.load(io.open(p, encoding="utf-8"))
errores = []


def slug(t):
    t = unicodedata.normalize("NFD", t.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


# ---------- textos ----------
def bloques(seccion):
    out = {}
    for f in sorted(glob.glob(os.path.join(AQUI, "textos", seccion + "-*.txt"))):
        txt = io.open(f, encoding="utf-8").read().replace("\r\n", "\n")
        for trozo in re.split(r"^@@ ", txt, flags=re.M)[1:]:
            clave, _, resto = trozo.partition("\n")
            cab, _, cuerpo = resto.strip("\n").partition("\n\n")
            campos = {}
            for linea in cab.split("\n"):
                c, _, v = linea.partition(":")
                campos[c.strip()] = v.strip()
            campos["parrafos"] = [p.strip().replace("\n", " ") for p in cuerpo.strip().split("\n\n") if p.strip()]
            out[clave.strip()] = campos
    return out


def enlace(item):
    item = item.strip()
    idioma, titulo = ("en", item[3:]) if item.startswith("en:") else ("es", item)
    ruta = titulo.replace(" ", "_").replace("(", "%28").replace(")", "%29")
    return f"[Wikipedia: {titulo}](https://{idioma}.wikipedia.org/wiki/{ruta})"


def saber(campos):
    return "**Para saber más:** " + " · ".join(enlace(x) for x in campos["saber"].split("|"))


def figura(src, alt, pie):
    return (f'<figure>\n  <img src="{src}" alt="{alt}" loading="lazy">\n  <figcaption>{pie}</figcaption>\n</figure>')


def url_imagen(archivo, ancho=1200):
    return "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(archivo) + f"?width={ancho}"


def autor_limpio(a):
    a = re.sub(r"\s+", " ", a).strip()
    for prefijo, limpio in AUTORES:
        if a.startswith(prefijo):
            return limpio
    m = re.match(r"No machine-readable author provided\. (\S+) assumed", a)
    if m:
        return m.group(1)
    if re.search(r"unknown author|^no machine-readable|^unknown$|^anonymous", a, re.I):
        return "autor desconocido"
    return a


def revisar(nombre, parrafos, negr, palabras):
    cuerpo = "\n".join(parrafos)
    n = len(re.findall(r"\*\*[^*]+\*\*", cuerpo))
    w = len(re.sub(r"\]\([^)]*\)|[*\[\]]", " ", cuerpo).split())
    if not negr[0] <= n <= negr[1]:
        errores.append(f"{nombre}: {n} negritas")
    if not palabras[0] <= w <= palabras[1]:
        errores.append(f"{nombre}: {w} palabras")
    if any(p.startswith("**") for p in parrafos):
        errores.append(f"{nombre}: párrafo empieza por negrita")
    if cuerpo.count("**") % 2:
        errores.append(f"{nombre}: negrita sin cerrar")
    return w


# ---------- imágenes de Cultura ----------
temas = leer(R + "rutina/temas.json")
existentes = {t["id"]: t for g in temas.values() for t in g}
cult = leer(os.path.join(AQUI, "cult_out.json"))
ELEGIDAS = {  # alternativas buscadas a mano en Commons (clave: archivo de t1/t2_out)
    "arte/puertas-paraiso": ("t1", 3), "arte/cristo-yacente": ("t1", 1), "arte/composicion-kandinsky": ("t1", 3),
    "arte/edad-madura-claudel": ("t1", 1), "arte/portico-gloria": ("t1", 1), "arte/david-donatello": ("t1", 2),
    "arte/dioses-viento-trueno": ("t1", 0), "arte/tres-gracias-rubens": ("t1", 0), "historia/juicios-nuremberg": ("t1", 1),
    "historia/armisticio-1918": ("t1", 2), "historia/crisis-misiles": ("t1", 0), "historia/fiebre-oro-california": ("t1", 1),
    "historia/salamina": ("t1", 3), "historia/armada-invencible": ("t1", 0), "historia/particion-india": ("t1", 1),
    "historia/carlomagno": ("t1", 1), "historia/primer-viaje-colon": ("t1", 3), "historia/polo-sur": ("t1", 0),
    "historia/tregua-navidad": ("t1", 3), "historia/disolucion-urss": ("t1", 0), "literatura/garcilaso": ("t1", 1),
    "literatura/coplas-manrique": ("t1", 0), "literatura/pabellon-rojo": ("t1", 0), "literatura/tierra-baldia": ("t1", 0),
    "literatura/ulises-joyce": ("t1", 1), "literatura/busca-tiempo-perdido": ("t1", 1), "literatura/cancionero-petrarca": ("t1", 0),
    "literatura/robinson-crusoe": ("t1", 2), "historia/fenicios-alfabeto": ("t2", 0), "historia/cuneiforme": ("t2", 0),
}
alternativas = {n: leer(os.path.join(AQUI, n + "_out.json")) for n in ("t1", "t2")}
AUTORES = leer(os.path.join(AQUI, "autores.json"))


def imagen_de(seccion, id_):
    if id_ in existentes:
        t = existentes[id_]
        return {"imagen": t["imagen"], "autor": t["autor"], "licencia": t["licencia"]}
    clave = f"{seccion}/{id_}"
    if clave in ELEGIDAS:
        f, n = ELEGIDAS[clave]
        x = alternativas[f][clave][n]
    else:
        x = cult[clave]
    autor = autor_limpio(x["autor"])
    return {"imagen": x["imagen"], "autor": autor, "licencia": x["licencia"]}


indice = leer(R + "contenido/indice.json")
usadas = {key(u.split("FilePath/")[-1].split("?")[0]) for e in indice["entradas"] if e.get("imagen") for u in [e["imagen"]]}
salida = {}  # ruta relativa -> texto
nuevos_temas = {s: [] for s in ("arte", "historia", "literatura")}
vistas = set()
for seccion, lista in (("arte", plan.ARTE), ("historia", plan.HISTORIA), ("literatura", plan.LITERATURA)):
    textos = bloques(seccion)
    for fecha, (id_, asunto, _) in zip(FECHAS, lista):
        img = imagen_de(seccion, id_)
        k = key(img["imagen"])
        if k in usadas or k in vistas:
            errores.append(f"{seccion}/{id_}: imagen repetida {img['imagen']}")
        vistas.add(k)
        nuevos_temas[seccion].append({"id": id_, "asunto": asunto, **img})
        c = textos.get(fecha)
        if not c:
            continue
        nombre = f"{seccion} {fecha}"
        for campo in ("resumen", "titulo", "data", "alt", "pie", "saber"):
            if not c.get(campo):
                errores.append(f"{nombre}: falta {campo}")
        if len(c.get("resumen", "")) > 160:
            errores.append(f"{nombre}: resumen de {len(c['resumen'])} caracteres")
        revisar(nombre, c["parrafos"], (4, 6), (332, 475))
        pie = c["pie"].rstrip(".") + f". Imagen: {img['autor']}, {img['licencia']}, vía Wikimedia Commons."
        partes = [f"<!-- resumen: {c['resumen']} -->", f"## {c['titulo']}", f"*{c['data']}*",
                  figura(url_imagen(img["imagen"]), c["alt"], pie)] + c["parrafos"] + [saber(c)]
        salida[f"rutina/borradores/{fecha}/{seccion}.md"] = "\n\n".join(partes) + "\n"

# ---------- Música ----------
albumes = leer(os.path.join(AQUI, "albumes_nuevos.json"))
textos = bloques("musica")
for fecha, a in zip(FECHAS, albumes):
    c = textos.get(fecha)
    if not c:
        continue
    nombre = f"musica {fecha} ({a['album']})"
    revisar(nombre, c["parrafos"], (2, 4), (140, 250))
    if len(c.get("resumen", "")) > 160 or not c.get("resumen"):
        errores.append(f"{nombre}: resumen")
    portada = f"https://coverartarchive.org/release-group/{a['mbid']}/front-500"
    partes = [f"<!-- resumen: {c['resumen']} -->", f"## {a['album']}", f"### {a['artista']}", f"*{a['estilo']} · {a['anio']}*",
              figura(portada, f"Portada de «{a['album']}»", f"Portada de «{a['album']}» ({a['anio']}), de {a['artista']}. Imagen: Cover Art Archive.")] \
        + c["parrafos"] + [saber(c)]
    salida[f"rutina/borradores/{fecha}/musica.md"] = "\n\n".join(partes) + "\n"

# ---------- Aprende finanzas ----------
viejos = leer(R + "rutina/conceptos.json")
por_nombre = {c["concepto"]: c for c in viejos}
orden_c = []
for x in conceptos_plan.ORDEN:
    if isinstance(x, str):
        orden_c.append(por_nombre[x])
    else:
        orden_c.append({"id": "fin-" + slug(x[0]), "concepto": x[0], "termino": x[1], "area": x[2]})
textos = bloques("aprende")
for fecha, cpt in zip(FECHAS, orden_c):
    c = textos.get(fecha)
    if not c:
        continue
    nombre = f"aprende {fecha} ({cpt['concepto']})"
    revisar(nombre, c["parrafos"], (3, 6), (340, 510))
    if "ilustrativo" not in " ".join(c["parrafos"]).lower():
        errores.append(f"{nombre}: falta «ejemplo ilustrativo»")
    if len(c.get("resumen", "")) > 160 or not c.get("resumen"):
        errores.append(f"{nombre}: resumen")
    partes = [f"<!-- resumen: {c['resumen']} -->", f"## {cpt['concepto']}", f"### {cpt['termino']}", f"*{cpt['area']}*"] + c["parrafos"] + [saber(c)]
    salida[f"rutina/borradores/{fecha}/aprende-finanzas.md"] = "\n\n".join(partes) + "\n"

# ---------- Geografía ----------
geo = leer(os.path.join(AQUI, "geo_final.json"))
textos = bloques("geo")
paises_nuevos, galerias_nuevas = [], {}
for p in geo_plan.PAISES:
    id_, iso, nombre_p, capital, bandera, _ = p
    fotos = geo[id_]
    for f in fotos:
        f["autor"] = autor_limpio(f["autor"])
    paises_nuevos.append({"id": id_, "iso": iso, "nombre": nombre_p, "capital": capital,
                          "bandera": "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(bandera) + "?width=640",
                          "archivo": f"contenido/geografia/{id_}.md"})
    galerias_nuevas[id_] = [{"imagen": f["imagen"], "autor": f["autor"], "licencia": f["licencia"]} for f in fotos[1:]]
    c = textos.get(id_)
    if not c:
        continue
    revisar(f"geo {id_}", c["parrafos"], (4, 6), (260, 430))
    principal = fotos[0]
    pie = c["pie"].rstrip(".") + f". Foto: {principal['autor']}, {principal['licencia']}, vía Wikimedia Commons."
    partes = [figura(url_imagen(principal["imagen"]), c["alt"], pie)] + c["parrafos"] + [saber(c)]
    salida[f"contenido/geografia/{id_}.md"] = "\n\n".join(partes) + "\n"

# ---------- informe ----------
hechos = sorted({r.split("/")[2] for r in salida if r.startswith("rutina/borradores")})
print("borradores:", sum(r.startswith("rutina/borradores") for r in salida), "· geografía:", sum(r.startswith("contenido/geografia") for r in salida))
raros = sorted({x["autor"] for g in nuevos_temas.values() for x in g} | {f["autor"] for v in geo.values() for f in v})
raros = [a for a in raros if len(a) > 45 or re.search(r"uploader|machine|template|photo credits|http|©|attributions|see above|wikipedia", a, re.I)]
if raros:
    print("AUTORES RAROS:", *raros, sep="\n  ")
print("ERRORES:" if errores else "Sin errores.", *errores, sep="\n  ")

if ESCRIBIR:
    if errores:
        sys.exit("No se escribe nada con errores.")
    for ruta, texto in salida.items():
        os.makedirs(os.path.dirname(R + ruta), exist_ok=True)
        io.open(R + ruta, "w", encoding="utf-8", newline="\n").write(texto)
    # temas.json: los publicados que quedan + los nuevos en orden; fuera los que no cumplen las reglas nuevas
    publicados = {e.get("asunto") for e in indice["entradas"]}
    plan_ids = {t["id"] for g in nuevos_temas.values() for t in g}
    for s in nuevos_temas:
        viejos_s = [t for t in temas[s] if t["id"] in publicados and t["id"] not in plan_ids]
        temas[s] = viejos_s + nuevos_temas[s]
    io.open(R + "rutina/temas.json", "w", encoding="utf-8", newline="\n").write(json.dumps(temas, ensure_ascii=False, indent=1) + "\n")
    viejos_a = [a for a in leer(R + "rutina/albumes.json") if a["id"] in publicados]
    nuevos_ids = {a["id"] for a in albumes}
    io.open(R + "rutina/albumes.json", "w", encoding="utf-8", newline="\n").write(
        json.dumps([a for a in viejos_a if a["id"] not in nuevos_ids] + albumes, ensure_ascii=False, indent=1) + "\n")
    viejos_c = [c for c in viejos if c["id"] in publicados]
    io.open(R + "rutina/conceptos.json", "w", encoding="utf-8", newline="\n").write(json.dumps(viejos_c + orden_c, ensure_ascii=False, indent=1) + "\n")
    pj = leer(R + "contenido/geografia/paises.json")
    ya = {x["id"] for x in pj["paises"]}
    con_ficha = {r.split("/")[-1][:-3] for r in salida if r.startswith("contenido/geografia/")}
    pj["paises"] += [x for x in paises_nuevos if x["id"] not in ya and x["id"] in con_ficha]
    io.open(R + "contenido/geografia/paises.json", "w", encoding="utf-8", newline="\n").write(json.dumps(pj, ensure_ascii=False, indent=2) + "\n")
    gal = leer(R + "contenido/geografia/galerias.json")
    gal.update({k: v for k, v in galerias_nuevas.items() if k in con_ficha})
    io.open(R + "contenido/geografia/galerias.json", "w", encoding="utf-8", newline="\n").write(json.dumps(gal, ensure_ascii=False, indent=1) + "\n")
    print("Escrito.")
