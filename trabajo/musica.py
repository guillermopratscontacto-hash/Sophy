"""Orden de los álbumes del 9 nov al 31 dic y búsqueda de sus MBID. Uso: python musica.py"""
import json, sys, time, urllib.parse, urllib.request, urllib.error
sys.stdout.reconfigure(encoding="utf-8")
AG = "SophyBot/1.0 (https://github.com/guillermopratscontacto-hash/Sophy)"
R = "C:/Users/guill/Desktop/Sophy/"

# (álbum, artista, estilo, año) — los que ya están en albumes.json se marcan con None en el estilo
ORDEN = [
    ("London Calling", "The Clash", None, None),
    ("In the Court of the Crimson King", "King Crimson", "Rock progresivo", 1969),
    ("Led Zeppelin IV", "Led Zeppelin", "Hard rock", 1971),
    ("Senderos de traición", "Héroes del Silencio", "Rock", 1990),
    ("The Rise and Fall of Ziggy Stardust and the Spiders From Mars", "David Bowie", None, None),
    ("Close to the Edge", "Yes", "Rock progresivo", 1972),
    ("Marquee Moon", "Television", "Art punk", 1977),
    ("Paranoid", "Black Sabbath", None, None),
    ("Wish You Were Here", "Pink Floyd", "Rock progresivo", 1975),
    ("Artaud", "Pescado Rabioso", None, None),
    ("Who's Next", "The Who", "Rock", 1971),
    ("Selling England by the Pound", "Genesis", "Rock progresivo", 1973),
    ("Horses", "Patti Smith", "Punk rock", 1975),
    ("Canción animal", "Soda Stereo", "Rock", 1990),
    ("Thick as a Brick", "Jethro Tull", "Rock progresivo", 1972),
    ("Remain in Light", "Talking Heads", None, None),
    ("Are You Experienced", "The Jimi Hendrix Experience", "Rock psicodélico", 1967),
    ("Tubular Bells", "Mike Oldfield", "Rock progresivo", 1973),
    ("El patio", "Triana", None, None),
    ("The Doors", "The Doors", "Rock psicodélico", 1967),
    ("Moving Pictures", "Rush", "Rock progresivo", 1981),
    ("Exile on Main St.", "The Rolling Stones", "Rock", 1972),
    ("The Velvet Underground & Nico", "The Velvet Underground", None, None),
    ("Crime of the Century", "Supertramp", "Rock progresivo", 1974),
    ("Highway 61 Revisited", "Bob Dylan", "Folk rock", 1965),
    ("Una semana en el motor de un autobús", "Los Planetas", "Indie rock", 1998),
    ("Machine Head", "Deep Purple", "Hard rock", 1972),
    ("Storia di un minuto", "Premiata Forneria Marconi", "Rock progresivo", 1972),
    ("Re", "Café Tacvba", None, None),
    ("A Night at the Opera", "Queen", "Rock", 1975),
    ("Disintegration", "The Cure", "Rock gótico", 1989),
    ("The Snow Goose", "Camel", "Rock progresivo", 1975),
    ("Master of Puppets", "Metallica", None, None),
    ("Born to Run", "Bruce Springsteen", "Rock", 1975),
    ("Misplaced Childhood", "Marillion", "Rock progresivo", 1985),
    ("Funeral", "Arcade Fire", None, None),
    ("Abraxas", "Santana", "Rock latino", 1970),
    ("The Joshua Tree", "U2", "Rock", 1987),
    ("Agila", "Extremoduro", "Rock", 1996),
    ("Lateralus", "Tool", "Metal progresivo", 2001),
    ("Harvest", "Neil Young", "Folk rock", 1972),
    ("Omega", "Enrique Morente y Lagartija Nick", None, None),
    ("Doolittle", "Pixies", "Rock alternativo", 1989),
    ("Images and Words", "Dream Theater", "Metal progresivo", 1992),
    ("Hotel California", "Eagles", "Rock", 1976),
    ("Is This It", "The Strokes", None, None),
    ("Ten", "Pearl Jam", "Grunge", 1991),
    ("In Absentia", "Porcupine Tree", "Rock progresivo", 2002),
    ("Back in Black", "AC/DC", "Hard rock", 1980),
    ("La canción de Juan Perro", "Radio Futura", "Rock", 1987),
    ("Siamese Dream", "The Smashing Pumpkins", "Rock alternativo", 1993),
    ("Brothers in Arms", "Dire Straits", "Rock", 1985),
    ("Songs for the Deaf", "Queens of the Stone Age", "Stoner rock", 2002),
]
assert len(ORDEN) == 53


def get(url):
    for i in range(5):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": AG, "Accept": "application/json"}), timeout=40)
            return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            print("  reintento", e, file=sys.stderr)
            time.sleep(5)


def portada(mbid):
    try:
        r = urllib.request.urlopen(urllib.request.Request(f"https://coverartarchive.org/release-group/{mbid}/front-500",
                                                          headers={"User-Agent": AG, "Range": "bytes=0-1023"}), timeout=60)
        return r.headers.get("Content-Type", "").startswith("image/")
    except urllib.error.HTTPError as e:
        return False
    except Exception:
        return None


if __name__ == "__main__":
    import re, unicodedata
    def slug(t):
        t = unicodedata.normalize("NFD", t.lower())
        t = "".join(c for c in t if unicodedata.category(c) != "Mn")
        return re.sub(r"[^a-z0-9]+", "-", t).strip("-")
    existentes = {a["album"]: a for a in json.load(open(R + "rutina/albumes.json", encoding="utf-8"))}
    salida = []
    for album, artista, estilo, anio in ORDEN:
        if estilo is None:
            salida.append(existentes[album])
            continue
        q = f'releasegroup:"{album}" AND artist:"{artista}" AND primarytype:album'
        d = get("https://musicbrainz.org/ws/2/release-group/?fmt=json&limit=5&query=" + urllib.parse.quote(q))
        time.sleep(1.2)
        cands = [g for g in (d or {}).get("release-groups", []) if g.get("primary-type") == "Album" and not g.get("secondary-types")]
        mbid = None
        for g in cands:
            ok = portada(g["id"])
            time.sleep(1)
            if ok:
                mbid = g["id"]
                break
        print(f"{album} | {artista} | {mbid} | {cands[0]['title'] if cands else '-'} | {cands[0].get('first-release-date','') if cands else ''}")
        salida.append({"id": "album-" + slug(album), "album": album, "artista": artista, "estilo": estilo, "anio": anio, "mbid": mbid})
    json.dump(salida, open("albumes_nuevos.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
