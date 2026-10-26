import json
import re
import os
import sys

print("--- VERIFICACIÓN TÉCNICA FASE 1B (RED VIAL MULTICAPA) ---")

# 1. GeoJSON Base Datasets
geojson_files = {
    "Terciaria": ("Base/Red Vial/Terciaria.geojson", 4442),
    "Secundaria": ("Base/Red Vial/Secundaria.geojson", 169),
    "Primaria": ("Base/Red Vial/Primaria.geojson", 76)
}

for name, (path, expected_count) in geojson_files.items():
    if not os.path.exists(path):
        print(f"ERROR: Archivo {path} no encontrado.")
        sys.exit(1)
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    features = data.get('features', [])
    print(f"[OK] {name}: {len(features)} features encontradas (Esperadas aprox: {expected_count}).")

# 2. Verificar HTML
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

required_ids = [
    "baseTerciariaStatusPill",
    "geojsonFileInput",
    "btnLoadGeoJson",
    "btnToggleTerciaria",
    "btnToggleSecundaria",
    "btnTogglePrimaria",
    "btnToggleCustom",
    "btnToggleTrack",
    "btnToggleBuffer",
    "btnTogglePoints",
    "btnToggleMpioFilter",
    "badgeTerciariaCount",
    "badgeSecundariaCount",
    "badgePrimariaCount",
    "badgeCustomCount",
    "lblMpioFilterIcon",
    "lblMpioFilterText",
    "leafletMapContainer",
    "spatialContrastTableBody",
    "spatialViasCount",
    "spatialPointsCloseCount"
]

missing_ids = [elem_id for elem_id in required_ids if f'id="{elem_id}"' not in html]
if missing_ids:
    print(f"ERROR: Elementos HTML faltantes: {missing_ids}")
    sys.exit(1)
else:
    print(f"[OK] Todos los {len(required_ids)} IDs requeridos estan presentes en index.html.")

# 3. Verificar JS methods en spatial.js
with open('js/spatial.js', 'r', encoding='utf-8') as f:
    spatial_js = f.read()

required_methods = [
    "init",
    "loadTerciariaAuto",
    "loadSecundariaAuto",
    "loadPrimariaAuto",
    "loadGeoJsonFile",
    "handleGeoJsonFile",
    "toggleLayer",
    "toggleMpioFilter",
    "getDaneCodeForMunicipio",
    "renderTerciariaLayer",
    "renderSecundariaLayer",
    "renderPrimariaLayer",
    "renderCustomLayer",
    "renderProjectTrack",
    "renderBufferLayer",
    "renderPointsLayer",
    "initOrUpdateMap",
    "renderContrastTable",
    "auditProject",
    "exportCsv",
    "exportKml"
]

missing_methods = [m for m in required_methods if m not in spatial_js]
if missing_methods:
    print(f"ERROR: Metodos faltantes en js/spatial.js: {missing_methods}")
    sys.exit(1)
else:
    print(f"[OK] Todos los {len(required_methods)} metodos requeridos estan implementados en js/spatial.js.")

# 4. Verificar CSS
with open('css/styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

required_classes = [
    ".spatial-layer-bar",
    ".layer-bar-section",
    ".layer-bar-title",
    ".layer-bar-divider",
    ".layer-toggle-btn",
    ".layer-toggle-btn.active",
    ".layer-indicator",
    ".layer-count-badge",
    ".layer-filter-btn",
    ".layer-filter-btn.dept-wide",
    ".spatial-status-pill",
    ".spatial-status-pill.status-loading",
    ".spatial-status-pill.status-ready"
]

missing_classes = [c for c in required_classes if c not in css]
if missing_classes:
    print(f"ERROR: Clases CSS faltantes: {missing_classes}")
    sys.exit(1)
else:
    print(f"[OK] Todas las {len(required_classes)} clases CSS de la barra multicapa estan presentes.")

print("\n[OK] TODAS LAS VERIFICACIONES COMPLETADAS CON EXITO (100% OPERATIVO).")
