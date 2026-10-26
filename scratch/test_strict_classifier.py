import os, sys, unicodedata, re

def normalize_text(text):
    if not text: return ""
    text = text.lower()
    text = unicodedata.normalize('NFD', text)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    text = re.sub(r'[^a-z0-9]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

# Define the strict rules for the 27 items
ITEM_RULES = {
    1: {
        "must": ["solicitud", "carta de intencion", "carta intencion", "oficio solicitud", "oficio alcalde", "solicitud formal"],
        "exclude": ["especificac", "despiece", "socializacion", "presupuesto", "apu", "cedula", "rut", "contraloria", "procuraduria", "policia", "rnmc"]
    },
    2: {
        "must": ["especificac", "esquema tecnico", "especif", "esquema act"],
        "exclude": ["despiece", "presupuesto", "apu", "socializacion", "cedula", "rut", "contraloria", "procuraduria", "policia", "cronograma", "fotograf", "kml", "kmz"],
        "allow_exclude_if_has": "especificac"
    },
    3: {
        "must": ["despiece", "acero", "figuracion", "planilla acero", "cantidades acero", "hierro"],
        "exclude": ["especificac", "solicitud", "socializacion", "fotograf", "fotos", "cedula", "rut", "contraloria", "procuraduria", "policia", "redam", "cronograma", "kml", "kmz"]
    },
    4: {
        "must": [
            ("certificado", "via"), ("certificado", "vias"), ("certificado", "terciaria"), ("certificado", "terciarias"),
            ("certificacion", "via"), ("certificacion", "vias"), ("certificacion", "terciaria"), ("certificacion", "terciarias"),
            "vias terciarias", "via terciaria", "certificacion vial", "certificado vial", "vias a intervenir", "vias a inter"
        ],
        "exclude": ["especificac", "despiece", "posesion", "concejo", "rut", "contraloria", "policia", "procuraduria", "parafiscales", "redam", "delitos", "sexuales", "banco", "paco", "fotos"]
    },
    5: {
        "must": ["socializacion", "socializar", "acta comunidad", "reunion comunidad", "participacion ciudadana"],
        "exclude": ["posesion", "concejo", "especificac", "despiece", "cedula", "rut", "contraloria", "procuraduria", "policia"]
    },
    6: {
        "must": ["fotograf", "foto", "fotos", "panel fotografico", "evidencia fotografica", "registro fotografico"],
        "exclude": ["especificac", "despiece", "socializacion", "cedula", "posesion", "rut", "contraloria", "procuraduria", "policia"]
    },
    7: {
        "must": ["cedula", "cc alcalde", "c c alcalde", "documento identidad", "identificacion alcalde"],
        "exclude": ["especificac", "despiece", "fotos", "fotograf", "posesion", "socializacion", "rut"]
    },
    8: {
        "must": ["posesion", "acta posesion", "posesion alcalde"],
        "exclude": ["socializacion", "concejo", "especificac", "despiece", "cedula"]
    },
    9: {
        "must": ["concejo", "facultades", "acuerdo concejo", "acuerdo municipal", "facultad contratar"],
        "exclude": ["socializacion", "posesion", "especificac", "despiece", "cedula"]
    },
    10: {
        "must": ["rut", "registro unico tributario"],
        "exclude": ["especificac", "despiece", "socializacion", "posesion", "cedula", "contraloria"]
    },
    11: {
        "must": ["contraloria", "responsabilidad fiscal", "responsables fiscales", "sirec", "boletin fiscal"],
        "exclude": ["procuraduria", "policia", "delitos", "redam", "parafiscales"]
    },
    12: {
        "must": ["medidas correctivas", "rnmc", "correctivas"],
        "exclude": ["contraloria", "procuraduria", "delitos sexuales", "judiciales"]
    },
    13: {
        "must": [
            "antecedentes judiciales", "judiciales", "judicial",
            ("antecedentes", "policia"), ("policia", "alcalde"),
            "policia nacional de colombia", "certificado judicial"
        ],
        "exclude": ["medidas correctivas", "rnmc", "delitos sexuales", "contraloria", "procuraduria", "sirec"]
    },
    14: {
        "must": ["procuraduria", "disciplinario", "disciplinarios", "siri"],
        "exclude": ["contraloria", "policia", "judiciales", "fiscales", "rnmc"]
    },
    15: {
        "must": ["parafiscales", "parafiscale", "seguridad social", "paz y salvo parafiscales", "aportes parafiscales", "paz y salvo seguridad"],
        "exclude": ["especificac", "despiece", "socializacion"]
    },
    16: {
        "must": ["redam", "deudores alimentarios", "deudor alimentario", "alimentos"],
        "exclude": ["contraloria", "procuraduria", "policia", "judiciales"]
    },
    17: {
        "must": ["anticorrupcion", "compromiso anticorrupcion", "pacto anticorrupcion"],
        "exclude": ["paco", "portal anticorrupcion", "cic", "lavado"]
    },
    18: {
        "must": ["lavado", "activos", "sarlaft", "terrorismo", "financiacion terrorismo", "la ft"],
        "exclude": ["anticorrupcion", "paco", "delitos"]
    },
    19: {
        "must": ["inhabilidades", "incompatibilidades", "conflictos de interes", "conflicto interes"],
        "exclude": ["delitos sexuales", "sexuales", "menores", "lavado", "anticorrupcion", "paco"]
    },
    20: {
        "must": ["no multas", "sanciones", "multas", "incumplimiento", "no sanciones", "declaratoria incumplimiento"],
        "exclude": ["rnmc", "medidas correctivas", "contraloria", "procuraduria"]
    },
    21: {
        "must": ["paco", "portal anticorrupcion", "cic", "certificados cic", "portal transparencia"],
        "exclude": ["compromiso anticorrupcion", "pacto anticorrupcion", "declaracion"]
    },
    22: {
        "must": ["delitos sexuales", "sexuales", "menores", "ley 1918", "delito sexual"],
        "exclude": ["sarlaft", "lavado", "paco", "anticorrupcion"]
    },
    23: {
        "must": [
            "banco de proyectos", "banco proyectos", "banco de proyecto", "banco proyecto",
            "bpin", "banco de programas", ("banco", "infraestructura"), "radicacion banco"
        ],
        "exclude": ["especificac", "despiece", "kml", "kmz", "cronograma", "plan desarrollo", "plan dllo"]
    },
    24: {
        "must": [
            ".kmz", ".kml", ".gpx", "georreferenciacion", "georref", "trazado", "tracks", "tramos kml", "tramos kmz",
            ("tramos", "via"), ("trazado", "via")
        ],
        "exclude": ["especificac", "despiece", "socializacion", "fotos", "presupuesto"]
    },
    25: {
        "must": ["cronograma", "plan de trabajo", "cronograma actividades", "cronograma obra"],
        "exclude": ["especificac", "despiece", "presupuesto", "apu"]
    },
    26: {
        "must": ["plan desarrollo", "plan de desarrollo", "plan dllo", "proyecto y plan"],
        "exclude": ["especificac", "despiece", "presupuesto"]
    },
    27: {
        "must": [
            "cofinanciacion", "recursos municipio", "cierre financiero", "certificado recursos",
            "financiacion municipio", "contrapartida", "certificado de aportes", "cdp",
            "disponibilidad presupuestal", "compromiso ejecucion", "certificado compromiso",
            "financiacion"
        ],
        "exclude": ["especificac", "despiece", "parafiscales"]
    }
}

def match_file_to_item(filename, item_id):
    rule = ITEM_RULES[item_id]
    norm = normalize_text(filename)
    
    # Check must include
    must_ok = False
    for m in rule["must"]:
        if isinstance(m, tuple):
            if all(part in norm for part in m):
                must_ok = True
                break
        else:
            if m.startswith("."):
                if filename.lower().endswith(m):
                    must_ok = True
                    break
            elif m in norm:
                must_ok = True
                break
                
    if not must_ok:
        return False, 0
        
    # Check exclude
    allow_exclude = rule.get("allow_exclude_if_has")
    if allow_exclude and allow_exclude in norm:
        pass # Override exclude
    else:
        for exc in rule.get("exclude", []):
            if exc in norm:
                return False, 0
                
    score = 10
    # Bonus for exact prefix match
    num_str = f"{item_id:02d}"
    if norm.startswith(num_str) or norm.startswith(f"{item_id} "):
        score += 5
    return True, score

def classify_folder(folder_path):
    files = [f for f in os.listdir(folder_path) if not f.startswith(".")]
    assigned = {}
    used_files = set()
    
    # Sort items so more specific items match first
    for item_id in range(1, 28):
        best_file = None
        best_score = -1
        for f in files:
            if f in used_files:
                continue
            matched, score = match_file_to_item(f, item_id)
            if matched and score > best_score:
                best_score = score
                best_file = f
                
        if best_file:
            assigned[item_id] = best_file
            used_files.add(best_file)
            
    return assigned

# Test across all folders
sys.stdout.reconfigure(encoding='utf-8')
base_dir = r"..\Revisión Acero Convenios"
for d in sorted(os.listdir(base_dir)):
    full_p = os.path.join(base_dir, d)
    if os.path.isdir(full_p):
        print(f"\n==========================================")
        print(f"MUNICIPIO: {d}")
        print(f"==========================================")
        matched = classify_folder(full_p)
        for i in range(1, 28):
            if i in matched:
                print(f"  Ítem {i:02d}: ✓ {matched[i]}")
            else:
                print(f"  Ítem {i:02d}: ⚠️ No aportado / Faltante")
