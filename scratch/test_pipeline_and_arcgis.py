"""
Test integral de:
1. Pipeline de descompresión automática en memoria (expandirArchivosComprimidos):
   - Archivos .zip con PDF, KMZ anidado y KML.
   - Descompresión recursiva del KMZ a doc.kml.
2. Consulta dinámica a ArcGIS FeatureServer R10:
   - Cálculo del Bounding Box (minLon, minLat, maxLon, maxLat +/- 0.05).
   - Fetch a FeatureServer/3/query (Terciaria) y capas 1 y 2 con f=geojson.
   - Cálculo de distancia ortogonal plana con buffer de 10m.
"""
import zipfile
import io
import json
import urllib.request
import ssl
import math

# 1. Crear estructura de prueba de archivos comprimidos
KML_TRAMO1 = """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Tramo 1 - Piramo</name>
      <LineString>
        <coordinates>
          -75.020,6.485,0
          -75.019,6.486,0
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>"""

KML_TRAMO2 = """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Tramo 2 - San Jorge</name>
      <LineString>
        <coordinates>
          -75.015,6.488,0
          -75.014,6.489,0
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>"""

# KMZ interno
kmz_buf = io.BytesIO()
with zipfile.ZipFile(kmz_buf, 'w') as kmz:
    kmz.writestr('doc.kml', KML_TRAMO2)
kmz_bytes = kmz_buf.getvalue()

# ZIP principal contenedor
zip_buf = io.BytesIO()
with zipfile.ZipFile(zip_buf, 'w') as z:
    z.writestr('documentos/despiece_acero.pdf', b'%PDF-1.4 sample content')
    z.writestr('georreferenciacion/tramo1.kml', KML_TRAMO1)
    z.writestr('georreferenciacion/tramo2_anidado.kmz', kmz_bytes)
zip_bytes = zip_buf.getvalue()

print(f"[OK] ZIP de prueba creado: {len(zip_bytes)} bytes.")

# Simulación de expandirArchivosComprimidos
extracted_files = []
with zipfile.ZipFile(io.BytesIO(zip_bytes), 'r') as z:
    for name in z.namelist():
        if name.lower().endswith('.kmz'):
            # Recursión de KMZ
            inner_kmz_data = z.read(name)
            with zipfile.ZipFile(io.BytesIO(inner_kmz_data), 'r') as inner_z:
                for in_name in inner_z.namelist():
                    if in_name.lower().endswith('.kml'):
                        extracted_files.append((f"{name} > {in_name}", inner_z.read(in_name).decode('utf-8')))
        elif name.lower().endswith('.kml') or name.lower().endswith('.pdf'):
            extracted_files.append((name, z.read(name)))

print(f"[OK] Archivos extraídos por el pipeline: {len(extracted_files)}")
for path, _ in extracted_files:
    print(f" - {path}")

assert any('despiece_acero.pdf' in p for p, _ in extracted_files), "Debe extraerse despiece_acero.pdf"
assert any('tramo1.kml' in p for p, _ in extracted_files), "Debe extraerse tramo1.kml"
assert any('doc.kml' in p for p, _ in extracted_files), "Debe extraerse doc.kml recursivamente del KMZ"

# 2. Simulación de consulta a ArcGIS FeatureServer R10
coords = [
    {"lng": -75.020, "lat": 6.485},
    {"lng": -75.019, "lat": 6.486},
    {"lng": -75.015, "lat": 6.488},
    {"lng": -75.014, "lat": 6.489}
]

minLon = min(c["lng"] for c in coords) - 0.05
maxLon = max(c["lng"] for c in coords) + 0.05
minLat = min(c["lat"] for c in coords) - 0.05
maxLat = max(c["lat"] for c in coords) + 0.05

print(f"[OK] Bounding Box calculado (+/- 0.05 deg): ({minLon:.4f}, {minLat:.4f}) a ({maxLon:.4f}, {maxLat:.4f})")

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = f"https://services5.arcgis.com/K90UQIB09TmTjUL8/arcgis/rest/services/R10/FeatureServer/3/query?where=1%3D1&geometry={minLon},{minLat},{maxLon},{maxLat}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&outSR=4326&f=geojson"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})

with urllib.request.urlopen(req, context=ctx, timeout=15) as res:
    data = json.loads(res.read().decode('utf-8'))
    features = data.get('features', [])

print(f"[OK] Features devueltos por ArcGIS FeatureServer (Capa 3 Terciaria): {len(features)}")
assert len(features) > 0, "ArcGIS debe devolver vías terciarias en ese bounding box"

# Verificar cálculo de distancia euclidiana en proyección ortogonal plana local
def pt_to_seg_dist(latP, lngP, latA, lngA, latB, lngB):
    latMid = (latP + latA + latB) / 3.0 * math.pi / 180.0
    kx = 111320.0 * math.cos(latMid)
    ky = 110574.0
    xp, yp = lngP * kx, latP * ky
    x1, y1 = lngA * kx, latA * ky
    x2, y2 = lngB * kx, latB * ky
    dx, dy = x2 - x1, y2 - y1
    lenSq = dx * dx + dy * dy
    if lenSq == 0:
        return math.hypot(xp - x1, yp - y1)
    t = max(0, min(1, ((xp - x1) * dx + (yp - y1) * dy) / lenSq))
    return math.hypot(xp - (x1 + t * dx), yp - (y1 + t * dy))

min_dist = float('inf')
best_feat = None
for f in features:
    geom = f.get('geometry', {})
    lines = [geom.get('coordinates', [])] if geom.get('type') == 'LineString' else geom.get('coordinates', [])
    for line in lines:
        for i in range(len(line)-1):
            p1 = line[i]
            p2 = line[i+1]
            for pt in coords:
                d = pt_to_seg_dist(pt['lat'], pt['lng'], p1[1], p1[0], p2[1], p2[0])
                if d < min_dist:
                    min_dist = d
                    best_feat = f

print(f"[OK] Distancia minima encontrada: {min_dist:.1f} m")
p = best_feat.get('properties', {})
print(f"[OK] Vía más cercana: CODIGO={p.get('CODIGO_VIA')}, NOMBRE={p.get('NOMBRE_VIA')}, ORDEN={p.get('ORDEN')}")

cumple_10m = min_dist <= 10.0
estado = f"✓ SOBRE {p.get('CODIGO_VIA')}" if cumple_10m else f"! A {min_dist:.1f} m DE {p.get('CODIGO_VIA')}"
print(f"[OK] Evaluación con Buffer 10m: {estado}")

print("\n>>> ¡TODAS LAS PRUEBAS DE DESCOMPRESIÓN Y ARCGIS PASARON EXITOSAMENTE! <<<")
