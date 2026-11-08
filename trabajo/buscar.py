"""Busca en Commons varias candidatas libres por término. Uso: python buscar.py terminos.json salida.json
terminos: {clave: "término"}; imprime 5 candidatas por término."""
import json, re, sys, time, urllib.parse
sys.path.insert(0, __file__.rsplit("\\", 1)[0] if "\\" in __file__ else ".")
from imgs import api, limpio, LIBRE

sys.stdout.reconfigure(encoding="utf-8")
terminos = json.load(open(sys.argv[1], encoding="utf-8"))
salida = {}
for clave, termino in terminos.items():
    d = api("https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=20"
            "&gsrsearch=" + urllib.parse.quote("filetype:bitmap " + termino) + "&prop=imageinfo&iiprop=extmetadata|size|mime")
    pags = sorted(d.get("query", {}).get("pages", {}).values(), key=lambda p: p.get("index", 0))
    lista = []
    for p in pags:
        ii = (p.get("imageinfo") or [{}])[0]
        meta = ii.get("extmetadata", {})
        lic = limpio(meta.get("LicenseShortName", {}).get("value", ""))
        if ii.get("mime") not in ("image/jpeg", "image/png") or ii.get("width", 0) < 900 or not LIBRE.match(lic):
            continue
        lic = "dominio público" if re.match(r"public domain|pd\b|no restrictions", lic, re.I) else lic
        lista.append({"imagen": p["title"].split(":", 1)[1], "autor": limpio(meta.get("Artist", {}).get("value", ""))[:80] or "autor desconocido",
                      "licencia": lic, "ancho": ii["width"], "alto": ii["height"]})
        if len(lista) == 5:
            break
    salida[clave] = lista
    print("==", clave, "|", termino)
    for n, c in enumerate(lista):
        print(f"  {n} {c['imagen']} | {c['ancho']}x{c['alto']} | {c['autor'][:35]} | {c['licencia']}")
json.dump(salida, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
