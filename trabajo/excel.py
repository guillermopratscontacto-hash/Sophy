import copy, datetime, json, sys
import openpyxl
sys.stdout.reconfigure(encoding="utf-8")
R = "C:/Users/guill/Desktop/Sophy/"
ruta = sys.argv[1]
wb = openpyxl.load_workbook(ruta)
ws = wb["Contenido"]
D = datetime.datetime

pal = json.load(open(R + "contenido/juegos/palabras.json", encoding="utf-8"))
n_pal = len(pal["soluciones"])
usadas_pal = (datetime.date(2026, 11, 8) - datetime.date(2026, 10, 14)).days + 1


def copiar_fila(origen, destino):
    for col in range(1, 12):
        a, b = ws.cell(origen, col), ws.cell(destino, col)
        b._style = copy.copy(a._style)


# Mover el bloque «Cómo leerlo» (A20:A25) dos filas más abajo para hacer sitio a Finanzas.
notas = [(ws.cell(r, 1).value, copy.copy(ws.cell(r, 1)._style)) for r in range(20, 26)]
for r in range(19, 30):
    for col in range(1, 12):
        ws.cell(r, col).value = None
for i, (v, st) in enumerate(notas):
    ws.cell(22 + i, 1).value = v
    ws.cell(22 + i, 1)._style = st

ws["B3"] = D(2026, 11, 8)
proximo = D(2026, 11, 9)
for fila, prep, usadas in ((10, 30, 25), (11, 30, 25), (12, 30, 25)):
    ws.cell(fila, 4).value, ws.cell(fila, 5).value, ws.cell(fila, 8).value = prep, usadas, proximo
ws["K10"] = "Solo cuadros o esculturas. En preparación: artículos ya escritos hasta el 31/12 (rama trabajo-contenido-2026, Arte terminado)."
ws["K11"] = "En preparación: artículos ya escritos hasta el 31/12 (rama trabajo-contenido-2026, Historia terminada)."
ws["K12"] = "Solo novelas y poemas. En preparación: artículos escritos hasta el 31/12 (pendiente de escribir)."
ws["D13"], ws["E13"], ws["H13"] = 54, 26, proximo
ws["K13"] = "Solo rock, rock progresivo y parecidos. En preparación: 53 álbumes de rock hasta el 31/12 (portadas listas, textos pendientes); se quitarán de la lista los 16 que no son rock."
ws["D14"], ws["E14"], ws["H14"] = 40, 0, D(2026, 10, 12)
ws["K14"] = ("La fecha es la del peor caso: alguien que empezó el 12/10 y completa uno al día. En preparación: 42 países más "
             "(fotos listas, fichas pendientes), que darían para hasta el 31/12.")
ws["D15"], ws["E15"], ws["H15"] = n_pal, usadas_pal, proximo
ws["C17"], ws["I17"] = "Mapa y banderas (contenido/geografia/mundo.json, 147 banderas)", "No caduca"
ws["K17"] = "Nada: ya está construido y no gasta contenido."
ws["D18"], ws["E18"], ws["I18"] = 305, 0, "No caduca"
ws["K18"] = "Nada: cada imagen vuelve a poder usarse a los 30 días."

# Finanzas
for fila in (19, 20):
    copiar_fila(13, fila)
ws["A19"], ws["B19"] = "Finanzas", "Aprende finanzas"
ws["C19"] = "Lista de conceptos (rutina/conceptos.json); la rutina escribe el texto"
ws["D19"], ws["E19"], ws["F19"], ws["G19"], ws["H19"] = 64, 25, "=D19-E19", 1, proximo
ws["I19"], ws["J19"] = "=H19+ROUNDUP(F19/G19,0)-1", "=I19-$D$3"
ws["K19"] = "En preparación: 53 artículos hasta el 31/12 (se quitan 5 conceptos demasiado áridos y se añaden 19 nuevos)."
ws["A20"], ws["B20"] = "Finanzas", "Política monetaria y fusiones"
ws["C20"] = "Rutina de los sábados"
for c in "DEFGHJ":
    ws[f"{c}20"] = None
ws["I20"] = "Periódicas"
ws["K20"] = "Nada: la rutina busca la actualidad cada sábado."
ws["A28"] = ("· En curso (8/11/2026): artículos de Cultura, Música y Aprende finanzas escritos de antemano hasta el 31/12 y 42 países "
             "nuevos, en la rama trabajo-contenido-2026. Hasta que se suban, las fechas de arriba son las reales.")
ws["A28"]._style = copy.copy(ws["A25"]._style)
ws["A27"] = ws["A27"].value.replace("13/10/2026", "8/11/2026") if ws["A27"].value else None

# Ampliar el formato condicional de «Días que faltan» a las filas nuevas.
cf = ws.conditional_formatting
for rango in list(cf):
    if "J" in str(rango.sqref):
        reglas = rango.rules
        for regla in reglas:
            ws.conditional_formatting.add("J19:J19", regla)
wb.save(ruta)
print("ok", ruta, n_pal, usadas_pal)
