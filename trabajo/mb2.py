import json,sys,time,urllib.parse
sys.stdout.reconfigure(encoding="utf-8")
from musica import get, portada
for album,artista in [("Who's Next","The Who"),("The Snow Goose","Camel"),("Back in Black","AC/DC"),("Siamese Dream","The Smashing Pumpkins")]:
    q=f'releasegroup:"{album}" AND artist:"{artista}"'
    d=get("https://musicbrainz.org/ws/2/release-group/?fmt=json&limit=8&query="+urllib.parse.quote(q)); time.sleep(1.5)
    print("==",album)
    for g in (d or {}).get("release-groups",[]):
        c=portada(g["id"]); time.sleep(1)
        print("  ",g["id"],g["title"],g.get("first-release-date"),g.get("primary-type"),g.get("secondary-types"),[a["name"] for a in g.get("artist-credit",[])],"portada" if c else c)
