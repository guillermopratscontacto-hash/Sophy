import json, re, sys, glob, io, urllib.parse
sys.stdout.reconfigure(encoding="utf-8")
import geo_plan
R = "C:/Users/guill/Desktop/Sophy/"
k = lambda s: urllib.parse.unquote(s).replace("_", " ").strip().lower()
usadas = set()
for f in glob.glob(R + "contenido/**/*.md", recursive=True):
    for u in re.findall(r"FilePath/([^?\"]+)", io.open(f, encoding="utf-8").read()):
        usadas.add(k(u))
for v in json.load(open(R + "contenido/geografia/galerias.json", encoding="utf-8")).values():
    usadas |= {k(x["imagen"]) for x in v}
for g in json.load(open(R + "rutina/temas.json", encoding="utf-8")).values():
    usadas |= {k(x["imagen"]) for x in g}
usadas |= {k(x["imagen"]) for x in json.load(open(R + "rutina/reserva.json", encoding="utf-8"))}
d = json.load(open("geo_out.json", encoding="utf-8"))
sel = {}
for p in geo_plan.PAISES:
    fotos = []
    for n, lugar in enumerate(p[5]):
        x = d.get(f"{p[0]}/{n}")
        if not x or not x["imagen"].lower().endswith((".jpg", ".jpeg")) or x["ancho"] < 1000 or k(x["imagen"]) in usadas:
            continue
        if any(k(x["imagen"]) == k(f["imagen"]) for f in fotos):
            continue
        x["lugar"] = lugar
        fotos.append(x)
    sel[p[0]] = fotos[:7]
    print(f"== {p[0]} ({len(fotos)})")
    for f in fotos[:7]:
        print(f"   {f['lugar']} | {f['imagen'][:70]} | {f['ancho']}x{f['alto']} | {f['autor'][:30]} | {f['licencia']}")
json.dump(sel, open("geo_sel.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump(sorted(usadas), open("usadas.json", "w", encoding="utf-8"), ensure_ascii=False)
