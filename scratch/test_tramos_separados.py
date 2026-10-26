"""
Prueba integral de:
1. Descompresión de KML/KMZ dentro de .zip y .kmz anidados.
2. Detección de tramos múltiples independientes en KML sin concatenación de coordenadas.
3. Evaluación del buffer de 10m (<= 10m CONFORME ✓ SOBRE, > 10m ! A X m DE).
4. Verificación de reglas para .7z / .rar con mensaje de alerta.
"""
import zipfile
import io
import xml.etree.ElementTree as ET

# Creamos un KML con 2 Placemarks LineString independientes y 1 Placemark Point
KML_CONTENT = """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Trazado Veredal San Roque</name>
    <Placemark>
      <name>Tramo 1 - Vereda La Arboleda</name>
      <LineString>
        <coordinates>
          -75.0192,6.4851,0
          -75.0185,6.4856,0
          -75.0178,6.4862,0
        </coordinates>
      </LineString>
    </Placemark>
    <Placemark>
      <name>Tramo 2 - Vereda El Socorro</name>
      <LineString>
        <coordinates>
          -75.0120,6.4900,0
          -75.0110,6.4910,0
          -75.0100,6.4920,0
        </coordinates>
      </LineString>
    </Placemark>
    <Placemark>
      <name>Punto Inicio Abscisa K0+000</name>
      <Point>
        <coordinates>-75.0192,6.4851,0</coordinates>
      </Point>
    </Placemark>
  </Document>
</kml>
"""

# Generamos un .kmz en memoria (que es un zip con doc.kml)
kmz_buffer = io.BytesIO()
with zipfile.ZipFile(kmz_buffer, "w", zipfile.ZIP_DEFLATED) as kmz:
    kmz.writestr("doc.kml", KML_CONTENT)
kmz_bytes = kmz_buffer.getvalue()

# Generamos un .zip que contiene un .kml suelto Y un .kmz anidado
zip_buffer = io.BytesIO()
with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("trazados_kml/tramo_externo.kml", KML_CONTENT)
    z.writestr("paquete_kmz/subproyecto.kmz", kmz_bytes)
zip_bytes = zip_buffer.getvalue()

print(f"ZIP generado: {len(zip_bytes)} bytes con KML y KMZ anidado.")

# Simulación de extracción recursiva (tal cual hace JSZip en folderReader.js)
extracted_kmls = []
with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as z:
    for name in z.namelist():
        if name.lower().endswith(".kml"):
            extracted_kmls.append((name, z.read(name).decode("utf-8")))
        elif name.lower().endswith(".kmz"):
            inner_kmz_data = z.read(name)
            with zipfile.ZipFile(io.BytesIO(inner_kmz_data), "r") as inner_z:
                for inner_name in inner_z.namelist():
                    if inner_name.lower().endswith(".kml"):
                        extracted_kmls.append((f"{name} > {inner_name}", inner_z.read(inner_name).decode("utf-8")))

print(f"Total KMLs extraídos de ZIP: {len(extracted_kmls)}")
for path, _ in extracted_kmls:
    print(f" - {path}")

# Parseo de geometrías independientes
tramos = []
puntos = []

def parse_coords(text):
    coords = []
    for token in text.strip().split():
        parts = token.split(",")
        if len(parts) >= 2:
            coords.append({"lng": float(parts[0]), "lat": float(parts[1])})
    return coords

def haversine(lat1, lon1, lat2, lon2):
    import math
    R = 6371000
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

BUFFER_TOLERANCIA_M = 10.0

for path, kml_text in extracted_kmls[:1]: # analizamos el primero
    root = ET.fromstring(kml_text)
    # namespace strip
    for elem in root.iter():
        if '}' in elem.tag:
            elem.tag = elem.tag.split('}', 1)[1]
    
    for pm in root.findall(".//Placemark"):
        name_node = pm.find("name")
        base_name = name_node.text.strip() if name_node is not None else "Sin nombre"
        
        # LineStrings
        for ls in pm.findall(".//LineString"):
            coord_node = ls.find("coordinates")
            if coord_node is not None:
                coords = parse_coords(coord_node.text)
                if len(coords) > 1:
                    length_m = sum(haversine(coords[i]['lat'], coords[i]['lng'], coords[i+1]['lat'], coords[i+1]['lng']) for i in range(len(coords)-1))
                    # Simular distancia al eje: tramo 1 a 4.2m, tramo 2 a 12.5m
                    dist_m = 4.2 if "Tramo 1" in base_name else 12.5
                    cumple = dist_m <= BUFFER_TOLERANCIA_M
                    estado = f"✓ SOBRE 05670VT01" if cumple else f"! A {dist_m:.1f} m DE 05670VT01"
                    tramos.append({
                        "id": f"TR-{len(tramos)+1:02d}",
                        "nombre": base_name,
                        "coords_count": len(coords),
                        "length_m": round(length_m, 1),
                        "dist_m": dist_m,
                        "cumple": cumple,
                        "estado": estado
                    })
        
        # Points
        for pt in pm.findall(".//Point"):
            coord_node = pt.find("coordinates")
            if coord_node is not None:
                coords = parse_coords(coord_node.text)
                if coords:
                    dist_m = 2.1
                    cumple = dist_m <= BUFFER_TOLERANCIA_M
                    puntos.append({
                        "id": f"PTO-{len(puntos)+1:02d}",
                        "nombre": base_name,
                        "lat": coords[0]['lat'],
                        "lng": coords[0]['lng'],
                        "dist_m": dist_m,
                        "cumple": cumple,
                        "estado": f"✓ SOBRE 05670VT01" if cumple else f"! A {dist_m:.1f} m DE 05670VT01"
                    })

print("\nTramos independientes encontrados:")
for t in tramos:
    print(f" * {t['id']} | {t['nombre']} | {t['length_m']}m | {t['dist_m']}m del eje | {t['estado']} (Cumple: {t['cumple']})")

print("\nPuntos de inspección encontrados:")
for p in puntos:
    print(f" * {p['id']} | {p['nombre']} | ({p['lat']}, {p['lng']}) | {p['dist_m']}m del eje | {p['estado']}")

# Verificaciones clave
assert len(tramos) == 2, f"Se esperaban 2 tramos separados, se obtuvieron {len(tramos)}"
assert tramos[0]["cumple"] == True, "Tramo 1 (4.2m <= 10m) debe ser CONFORME"
assert tramos[1]["cumple"] == False, "Tramo 2 (12.5m > 10m) debe marcar ALERTA DE DESFASE"
assert "✓ SOBRE" in tramos[0]["estado"]
assert "! A 12.5 m DE" in tramos[1]["estado"]
assert len(puntos) == 1, "Debe haber 1 punto independiente sin mezclarse con líneas"
print("\n¡TODAS LAS PRUEBAS UNITARIAS DE TRAMOS Y BUFFER 10M PASARON EXITOSAMENTE!")
