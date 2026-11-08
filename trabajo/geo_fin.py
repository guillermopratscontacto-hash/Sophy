import json, sys, urllib.parse
sys.stdout.reconfigure(encoding="utf-8")
import geo_plan
from imgs import api

FUERA = ["Lake Geneva by Sentinel", "Danube Delta ESA", "ISS067", "Namib desert MODIS", "Lake Titicaca ESA", "seen from orbit",
         "Panama Papers", "Drottningholm kollage", "Cultural Landscape Montage", "Nessebar lead collage", "FACHADA ASAMBLEA",
         "Niger, Niamey", "Roundabout in Segou", "nordfriesisches", "PALACIO LEGISLATIVO 01", "Map of Tassili"]
EXTRA = {"suiza": [("a", 1), ("b", 1)], "polonia": [("a", 2)], "corea-del-sur": [("a", 0)], "senegal": [("a", 0)],
         "ghana": [("a", 0)], "mali": [("a", 2), ("b", 0), ("c", 1)], "botsuana": [("a", 2), ("b", 0)],
         "ruanda": [("a", 0), ("b", 3), ("c", 0)], "ecuador": [("a", 0), ("b", 0), ("c", 2)], "uruguay": [("a", 3), ("b", 2)],
         "oman": [("a", 2), ("b", 0)], "rumania": [("a", 0)], "chequia": [("a", 1)], "guatemala": [("a", 3)], "panama": [("a", 1)]}
sel = json.load(open("geo_sel.json", encoding="utf-8"))
t3 = json.load(open("t3_out.json", encoding="utf-8"))
final = {}
for p in geo_plan.PAISES:
    fotos = [f for f in sel[p[0]] if not any(x in f["imagen"] for x in FUERA)]
    for clave, n in EXTRA.get(p[0], []):
        c = dict(t3[f"{p[0]}/{clave}"][n]); c["lugar"] = ""
        fotos.append(c)
    final[p[0]] = [{"imagen": f["imagen"], "autor": f["autor"], "licencia": f["licencia"], "lugar": f.get("lugar", "")} for f in fotos[:7]]
    print(p[0], len(final[p[0]]))
json.dump(final, open("geo_final.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
banderas = [p[4] for p in geo_plan.PAISES]
d = api("https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&titles=" + urllib.parse.quote("|".join("File:" + b for b in banderas)))
faltan = [p["title"] for p in d["query"]["pages"].values() if "imageinfo" not in p]
print("banderas que no existen:", faltan)
