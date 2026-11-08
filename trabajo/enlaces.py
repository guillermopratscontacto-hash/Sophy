import glob,io,json,re,sys,time,urllib.parse
sys.stdout.reconfigure(encoding="utf-8")
from imgs import api
R="C:/Users/guill/Desktop/Sophy/"
archivos=glob.glob(R+"rutina/borradores/*/*.md")+glob.glob(R+"contenido/geografia/*.md")
por={"es":{},"en":{}}
for f in archivos:
    for idi,t in re.findall(r"https://(es|en)\.wikipedia\.org/wiki/([^)\s#]+)",io.open(f,encoding="utf-8").read()):
        por[idi].setdefault(urllib.parse.unquote(t).replace("_"," "),set()).add(f.replace(R,""))
for idi,tit in por.items():
    ts=sorted(tit)
    for i in range(0,len(ts),50):
        d=api(f"https://{idi}.wikipedia.org/w/api.php?action=query&format=json&redirects=1&titles="+urllib.parse.quote("|".join(ts[i:i+50])))
        for p in d["query"]["pages"].values():
            if "missing" in p or "invalid" in p:
                print("ROTO",idi,p.get("title"),sorted(tit.get(p.get("title"),[]))[:2])
print("comprobados",sum(len(v) for v in por.values()))
