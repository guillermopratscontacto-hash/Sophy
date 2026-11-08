"""Busca la imagen principal (libre) de artículos de en.wikipedia y sus datos en Commons.
Uso: python imgs.py entrada.json salida.json
entrada: {clave: [títulos en orden de preferencia]}; salida: {clave: {imagen, autor, licencia, ancho, titulo}}"""
import json, re, sys, time, urllib.parse, urllib.request, html

AG = "SophyBot/1.0 (https://github.com/guillermopratscontacto-hash/Sophy)"
LIBRE = re.compile(r"^(public domain|pd\b|cc0|cc[ -]by(-sa)?[ -]\d|cc[ -]by(-sa)?$|no restrictions|attribution)", re.I)


def api(url):
    for i in range(6):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": AG}), timeout=60)
            d = json.loads(r.read().decode("utf-8"))
            if "error" not in d:
                time.sleep(5)
                return d
            print("error", d["error"], file=sys.stderr)
        except Exception as e:
            print("fallo", e, file=sys.stderr)
        time.sleep(30)
    raise SystemExit("API no responde")


def limpio(t):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", t or ""))).strip()


def paginas(titulos, sitio="en.wikipedia.org"):
    out = {}
    for i in range(0, len(titulos), 50):
        trozo = titulos[i:i + 50]
        d = api(f"https://{sitio}/w/api.php?action=query&format=json&redirects=1&prop=pageimages&piprop=name&pilicense=free&titles="
                + urllib.parse.quote("|".join(trozo)))
        q = d.get("query", {})
        mapa = {}
        for grupo in ("normalized", "redirects"):
            for n in q.get(grupo, []):
                mapa[n["from"]] = n["to"]
        por_titulo = {p["title"]: p.get("pageimage") for p in q.get("pages", {}).values()}
        for t in trozo:
            final = t
            while final in mapa:
                final = mapa[final]
            out[t] = por_titulo.get(final)
    return out


def info(archivos):
    out = {}
    archivos = sorted(set(archivos))
    for i in range(0, len(archivos), 50):
        trozo = archivos[i:i + 50]
        d = api("https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata|size|mime&titles="
                + urllib.parse.quote("|".join("File:" + a for a in trozo)))
        q = d.get("query", {})
        mapa = {n["to"]: n["from"] for n in q.get("normalized", [])}
        for p in q.get("pages", {}).values():
            if "imageinfo" not in p:
                continue
            ii = p["imageinfo"][0]
            meta = ii.get("extmetadata", {})
            lic = limpio(meta.get("LicenseShortName", {}).get("value", ""))
            autor = limpio(meta.get("Artist", {}).get("value", ""))[:80] or "autor desconocido"
            nombre = mapa.get(p["title"], p["title"]).split(":", 1)[1]
            out[nombre.replace("_", " ")] = {"licencia": lic, "autor": autor, "ancho": ii.get("width", 0), "alto": ii.get("height", 0), "mime": ii.get("mime")}
    return out


if __name__ == "__main__":
    entrada = json.load(open(sys.argv[1], encoding="utf-8"))
    titulos = sorted({t for ts in entrada.values() for t in ts})
    imgs = paginas(titulos)
    datos = info([v.replace("_", " ") for v in imgs.values() if v])
    salida = {}
    for clave, ts in entrada.items():
        for t in ts:
            a = imgs.get(t)
            if not a:
                continue
            a = a.replace("_", " ")
            m = datos.get(a)
            if not m or not LIBRE.match(m["licencia"]) or m["mime"] not in ("image/jpeg", "image/png"):
                continue
            lic = "dominio público" if re.match(r"public domain|pd\b|no restrictions", m["licencia"], re.I) else m["licencia"]
            salida[clave] = {"imagen": a, "autor": m["autor"], "licencia": lic, "ancho": m["ancho"], "alto": m["alto"], "titulo": t}
            break
    json.dump(salida, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    falta = [c for c in entrada if c not in salida]
    print("encontradas", len(salida), "faltan", falta)
