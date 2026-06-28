from PIL import Image, ImageDraw, ImageFont
import pandas as pd
import os
import sys

# =======================================
# CONFIGURACIÓN
# =======================================

if len(sys.argv) > 1:
    LOTE_DIR = sys.argv[1]
else:
    LOTE_DIR = "Lote425"

MAPA_PATH = os.path.join(LOTE_DIR, "altimetria.png")
TABLA_PATH = os.path.join(LOTE_DIR, "Altimetria_Lote425_Tabla.csv")

os.makedirs("output", exist_ok=True)
OUTPUT_PATH = os.path.join("output", f"ficha_{os.path.basename(LOTE_DIR)}.jpg")

FONDO = "white"
VERDE_LP = (44, 95, 45)
GRIS_TEXTO = (60, 60, 60)
GRIS_LINEA = (200, 200, 200)

MARGEN = 30
ESPACIO_MEDIO = 40

# =======================================
# CARGAR DATOS
# =======================================

df = pd.read_csv(TABLA_PATH)
mapa = Image.open(MAPA_PATH)

# =======================================
# FUENTES
# =======================================

try:
    font_seccion = ImageFont.truetype("arialbd.ttf", 22)
    font_tabla_header = ImageFont.truetype("arialbd.ttf", 16)
    font_tabla = ImageFont.truetype("arial.ttf", 15)
    font_pie = ImageFont.truetype("arial.ttf", 12)
except OSError:
    try:
        font_seccion = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 22)
        font_tabla_header = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
        font_tabla = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 15)
        font_pie = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 12)
    except OSError:
        font_seccion = ImageFont.load_default()
        font_tabla_header = ImageFont.load_default()
        font_tabla = ImageFont.load_default()
        font_pie = ImageFont.load_default()

# =======================================
# CALCULAR DIMENSIONES
# =======================================

columnas = [
    ("Color", None, 70),
    ("Ambiente", "Nombre", 220),
    ("Altura (m)", "Altura_m", 180),
    ("Superficie (ha)", "Superficie_ha", 160),
    ("% del lote", "Porcentaje", 130),
]
tabla_ancho = sum(c[2] for c in columnas)
tabla_alto_titulo = 30
tabla_alto_header = 35
tabla_alto_filas = len(df) * 36
tabla_alto_total = tabla_alto_titulo + tabla_alto_header + tabla_alto_filas + 10

mapa_max_alto = max(tabla_alto_total, 500)
mapa_ratio = mapa_max_alto / mapa.height
mapa_ancho = int(mapa.width * mapa_ratio)
mapa_alto = int(mapa.height * mapa_ratio)

ANCHO = MARGEN + mapa_ancho + ESPACIO_MEDIO + tabla_ancho + MARGEN
ALTO = MARGEN + max(mapa_alto, tabla_alto_total) + 40 + MARGEN

# =======================================
# CREAR FICHA
# =======================================

ficha = Image.new("RGB", (ANCHO, ALTO), FONDO)
draw = ImageDraw.Draw(ficha)

# --- MAPA (izquierda) ---
mapa_redim = mapa.resize((mapa_ancho, mapa_alto), Image.LANCZOS)
ficha.paste(mapa_redim, (MARGEN, MARGEN))
draw.rectangle(
    [(MARGEN - 2, MARGEN - 2), (MARGEN + mapa_ancho + 2, MARGEN + mapa_alto + 2)],
    outline=GRIS_LINEA, width=2
)

# --- TABLA (derecha) ---
tabla_x = MARGEN + mapa_ancho + ESPACIO_MEDIO
tabla_y = MARGEN

draw.text((tabla_x, tabla_y), "Distribución Altimétrica",
          fill=VERDE_LP, font=font_seccion)
tabla_y += tabla_alto_titulo

# Header
draw.rectangle(
    [(tabla_x, tabla_y), (tabla_x + tabla_ancho, tabla_y + tabla_alto_header)],
    fill=(240, 240, 240)
)
x = tabla_x
for header, _, ancho in columnas:
    draw.text((x + 10, tabla_y + 8), header,
              fill=GRIS_TEXTO, font=font_tabla_header)
    x += ancho

# Filas
y = tabla_y + tabla_alto_header
for _, row in df.iterrows():
    x = tabla_x
    draw.line([(tabla_x, y), (tabla_x + tabla_ancho, y)],
              fill=GRIS_LINEA, width=1)

    color_hex = row["Color_HEX"].lstrip("#")
    rgb = tuple(int(color_hex[i:i+2], 16) for i in (0, 2, 4))
    draw.rectangle([(x + 10, y + 8), (x + 55, y + 28)],
                   fill=rgb, outline=GRIS_LINEA)
    x += columnas[0][2]

    for header, key, ancho in columnas[1:]:
        valor = str(row[key])
        if key == "Porcentaje":
            valor = f"{valor}%"
        draw.text((x + 10, y + 10), valor, fill=GRIS_TEXTO, font=font_tabla)
        x += ancho
    y += 36

draw.line([(tabla_x, y), (tabla_x + tabla_ancho, y)],
          fill=GRIS_LINEA, width=1)

# --- PIE DE PÁGINA ---
draw.text(
    (MARGEN, ALTO - 25),
    "Generado con LotePerfecto - Datos: ALOS AW3D30 V3.2 (12.5m) - Procesado en Google Earth Engine",
    fill=(150, 150, 150), font=font_pie
)

# =======================================
# GUARDAR
# =======================================
ficha.save(OUTPUT_PATH, "JPEG", quality=95)
print(f"✓ Ficha generada: {OUTPUT_PATH}")
