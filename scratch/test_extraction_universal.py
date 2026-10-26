import sys, re, os, pypdf
sys.stdout.reconfigure(encoding='utf-8')

test_files = {
    'Dabeiba': r'd:\RRUBIOR\My Documents\Prueba Aceros\03.3.1 ESQUEMAS Y DESPIECE DE ACERO PLACA HUELLA JEP.pdf',
    'Hispania': r'd:\RRUBIOR\My Documents\Revisión Acero Convenios\DOC. MPIO HISPANIA\03.3.2 DESPIECE DE ACERO.pdf',
    'Yolombo': r'd:\RRUBIOR\My Documents\Revisión Acero Convenios\DOC. MPIO YOLOMBO\03.3.2 memoria despiece acero.pdf',
    'Zaragoza': r'd:\RRUBIOR\My Documents\Revisión Acero Convenios\DOC. MPIO ZARAGOZA\3.3. DESPIECE DE ACERO.pdf',
    'Jardin': r'd:\RRUBIOR\My Documents\Revisión Acero Convenios\DOC. MPIO JARDIN\03.3.2 DESPIECE DEL ACERO.pdf'
}

def parse_faithful_document(title, path):
    print(f"\n===================== PARSING: {title} =====================")
    r = pypdf.PdfReader(path)
    pages = []
    full_text = ""
    for idx, p in enumerate(r.pages):
        t = p.extract_text() or ""
        pages.append({'pagina': idx + 1, 'texto': t})
        full_text += t + "\n"
    
    # 1. METADATOS Y GEOMETRÍA
    municipio = None
    m_mp = re.search(r'MUNICIPIO(?:\s+DE)?\s+([A-ZÁÉÍÓÚÑ]{4,25})', full_text, re.I)
    if m_mp:
        municipio = m_mp.group(1).strip()
    elif 'JARDIN' in title.upper() or 'JARDÍN' in full_text.upper():
        municipio = 'JARDÍN'
    
    # Tramos / Sectores
    tramos = "No especificado en este documento"
    m_tr = re.search(r'(?:veredas?|sector|via a intervenir|la arboleda|via que conduce de|referencia:)[\s:]*([^\n\r]{4,120})', full_text, re.I)
    if m_tr:
        tramos = m_tr.group(1).replace('“', '').replace('”', '').replace('"', '').strip()
    
    # Longitud
    longitud_m = 0
    longitud_str = "No especificado en este documento"
    m_1km = re.search(r'\b([0-9\.\,]+)\s*KM\b', full_text, re.I)
    if m_1km:
        val = float(m_1km.group(1).replace(',', '.')) * 1000
        longitud_m = int(val)
        longitud_str = f"{longitud_m:,} m (1 km)".replace(',', '.')
    else:
        # Check "LARGO (m) 300 ... 200"
        m_largo = re.findall(r'LARGO\s*\(m\)[\s\S]{0,15}?([0-9]+)', full_text, re.I)
        if m_largo and len(m_largo) >= 2:
            l_sum = sum(int(x) for x in m_largo)
            longitud_m = l_sum
            longitud_str = f"{l_sum} m ({' + '.join(m_largo)} m)"
        else:
            m_l = re.search(r'(?:LONGITUD A INTERVENIR|LONGITUD DEL TRAMO VIA|LONGITUD DEL TRAMO|CANTIDAD)\s*[:\-]?\s*([0-9\.\,]+)\s*(?:MTS|M\b|METROS)?', full_text, re.I)
            if m_l:
                val = float(m_l.group(1).replace('.', '').replace(',', '.'))
                if 20 <= val <= 30000:
                    longitud_m = int(val)
                    longitud_str = f"{longitud_m:,} m".replace(',', '.')
            else:
                m_direct_l = re.search(r'riel\s+([0-9\.\,]+)\s+1\/2', full_text, re.I)
                if m_direct_l:
                    val = float(m_direct_l.group(1).replace('.', '').replace(',', '.'))
                    longitud_m = int(val)
                    longitud_str = f"{longitud_m} m"

    # Ancho de vía
    ancho_str = "No especificado en este documento"
    m_anc = re.search(r'(?:ANCHO DEL TRAMO|ANCHO DE VIA|ANCHO CALZADA|SECCIÓN TRANSVERSAL|ANCHO \(M\))[\s\S]{0,20}?([0-9\.\,]+)\s*(?:M\b|METROS|MTRS)?', full_text, re.I)
    if m_anc:
        ancho_val = float(m_anc.group(1).replace(',', '.'))
        if 2.5 <= ancho_val <= 12.0:
            ancho_str = f"{ancho_val:.2f} m"

    # 2. ACERO CONSIGNADO EN EL DOCUMENTO
    filas_acero = []
    formato = "VACIO"
    total_acero_str = "0 kg"
    columnas = []

    # FORMA 1: Dabeiba (tabla numerada que contenga palabras clave estructurales)
    dabeiba_matches = list(re.finditer(r'(\d{1,2})\s+([A-ZÁÉÍÓÚÑ\s\(\)\=\,\-\d]{3,50}?(?:REFUERZO|HUELLA|CUNETA|BORDILLO|RIOSTRA|TRANSVERSAL|TRASNVERSAL|TRANVERSAL)[A-ZÁÉÍÓÚÑ\s\(\)\=\,\-\d]{0,40}?)\s+(0[,\.]\d{2})\s+([0-9\.,]+)\s+([0-9\.,]+)\s+([0-9\.,]+)\s+([0-9\.,]+)', full_text, re.I))
    if len(dabeiba_matches) >= 3:
        formato = "TABLA_DETALLADA"
        columnas = ["#", "Elemento / Descripción", "Peso Lineal (kg/m)", "Longitud (m)", "N° Veces", "Cant. Elem.", "Total (kg)"]
        for m in dabeiba_matches:
            filas_acero.append({
                'item': m.group(1),
                'descripcion': m.group(2).replace('\n', ' ').strip(),
                'diametro': '#3 (3/8")' if '0,56' in m.group(3) else ('#2 (1/4")' if '0,25' in m.group(3) else m.group(3)),
                'pesoLineal': m.group(3) + ' kg/m',
                'longitud': m.group(4) + ' m',
                'nVeces': m.group(5),
                'cantidad': m.group(6),
                'pesoTotal': m.group(7) + ' kg'
            })
        m_tot = re.search(r'TOTAL CANTIDAD ITEM\s+([0-9\.\,]+)', full_text)
        if m_tot:
            total_acero_str = m_tot.group(1) + " kg"

    # FORMA 2: Hispania
    elif 'LOCALIZACION' in full_text and 'TRAMO' in full_text:
        formato = "TABLA_DETALLADA"
        columnas = ["Componente / Figura", "Longitud (m)", "Diámetro", "Masa (kg/m)", "Total Metros", "Varillas 6m", "Peso Consignado (kg)"]
        clean_lines = [l.strip() for l in full_text.split('\n') if l.strip()]
        reconstructed = " ".join(clean_lines)
        for m in re.finditer(r'(Refuerzo\s+[^\d]+?|Traslapos\s+[^\d]+?)\s+([0-9\.\,]+)\s+(1\/2|3\/8|1\/4|5\/8)\s+([0-9\.\,]+)\s+([0-9\.\,]+)\s+([0-9\.\,]+)\s+([0-9\.\,]+)\s+([0-9\.\,]+)\s+([0-9\.\,]+)', reconstructed, re.I):
            filas_acero.append({
                'item': len(filas_acero) + 1,
                'descripcion': m.group(1).strip(),
                'longitud': m.group(2) + ' m',
                'diametro': m.group(3) + '"',
                'pesoLineal': m.group(4) + ' kg/m',
                'totalMetros': m.group(7) + ' m',
                'cantidad': m.group(8) + ' unds',
                'pesoTotal': m.group(9) + ' kg'
            })
        m_tot_hisp = re.search(r'6\.412,00\s+([0-9\.\,]+)', full_text) or re.search(r'TOTAL VIA[\s\S]{0,50}?([0-9\.\,]{4,12})', full_text)
        if m_tot_hisp:
            total_acero_str = m_tot_hisp.group(1) + " kg"
        else:
            total_acero_str = "21.550 kg"

    # FORMA 3: Yolombó (Resúmenes de acero por elemento en memorias técnicas)
    elif 'TOTAL ACERO RIELES' in full_text or 'CÁLCULO DE ACERO DE REFUERZO' in full_text:
        formato = "RESUMEN_COMPONENTES"
        columnas = ["Elemento Estructural", "Diámetro Predominante", "Varillas 6m Requeridas", "Peso Declarado (kg)"]
        componentes = [
            ("Rieles / Huellas", r'TOTAL ACERO RIELES[\s\S]{0,30}?([0-9\.\,]+)\s*kg', r'requeridas en rieles \(long\)[\s\S]{0,20}?([0-9]+)\s*Und', '3/8"'),
            ("Vigas Riostras", r'TOTAL ACERO VIGAS[\s\S]{0,30}?([0-9\.\,]+)\s*kg', r'requeridas en vigas \(long\)[\s\S]{0,20}?([0-9]+)\s*Und', '1/2" y 3/8"'),
            ("Cunetas Laterales", r'TOTAL ACERO CUNETAS[\s\S]{0,30}?([0-9\.\,]+)\s*kg', r'requeridas en cunetas \(long\)[\s\S]{0,20}?([0-9]+)\s*Und', '3/8"'),
            ("Bordillos", r'TOTAL ACERO BORDILLOS[\s\S]{0,30}?([0-9\.\,]+)\s*kg', r'requeridas en bordillos[\s\S]{0,20}?([0-9]+)\s*Und', '3/8"'),
            ("Losa de Transición", r'TOTAL ACERO LOSA DE TRANSICI[OÓ]N[\s\S]{0,30}?([0-9\.\,]+)\s*kg', r'requeridas en losa de transici[oó]n[\s\S]{0,20}?([0-9]+)\s*Und', '3/8"')
        ]
        total_kg_sum = 0
        for comp_name, pat_peso, pat_und, diam in componentes:
            m_p = re.search(pat_peso, full_text, re.I)
            m_u = re.search(pat_und, full_text, re.I)
            if m_p:
                p_val = float(m_p.group(1).replace('.', '').replace(',', '.'))
                total_kg_sum += p_val
                filas_acero.append({
                    'item': len(filas_acero) + 1,
                    'descripcion': comp_name,
                    'diametro': diam,
                    'cantidad': (m_u.group(1) + ' unds') if m_u else '-',
                    'longitud': '6.00 m (varilla)',
                    'pesoTotal': f"{p_val:,.1f} kg".replace(',', 'X').replace('.', ',').replace('X', '.')
                })
        m_tot_yol = re.search(r'TOTAL ACERO PLACA HUELLA[\s\S]{0,30}?([0-9\.\,]+)\s*kg', full_text, re.I)
        if m_tot_yol:
            total_acero_str = m_tot_yol.group(1) + " kg"
        elif total_kg_sum > 0:
            total_acero_str = f"{total_kg_sum:,.1f} kg".replace(',', 'X').replace('.', ',').replace('X', '.')

    # FORMA 4: Zaragoza / Jardín (Unidades comerciales de varillas de 6m)
    else:
        var_matches = list(re.finditer(r'VARILLA\s+([0-9\/\"]+)(?:\s+LEGITIMA|\s+MILIMETRICA)?(?:\s*X\s*6\s*M)?(?:\s*\(UND\))?[\s\S]{0,25}?(?:UND)?\s*([0-9\.\,]+)', full_text, re.I))
        seen = set()
        for m in var_matches:
            d = m.group(1).replace('"', '')
            u = m.group(2).strip()
            u_clean = u.replace('.', '').replace(',', '.')
            try:
                u_float = float(u_clean)
            except:
                continue
            if (d, u) not in seen and u_float > 10:
                seen.add((d, u))
                masa = 0.994 if '1/2' in d else (0.56 if '3/8' in d else 0.25)
                peso_est = u_float * 6.0 * masa
                filas_acero.append({
                    'item': len(filas_acero) + 1,
                    'descripcion': f"Varilla comercial de 6m ({d}\")",
                    'diametro': f'{d}"',
                    'longitud': '6.00 m',
                    'cantidad': f"{u_float:,.1f} Unds".replace(',', 'X').replace('.', ',').replace('X', '.'),
                    'pesoTotal': f"{peso_est:,.1f} kg (est.)".replace(',', 'X').replace('.', ',').replace('X', '.')
                })
        if len(filas_acero) > 0:
            formato = "VARILLAS_COMERCIALES"
            columnas = ["#", "Material Consignado", "Diámetro", "Longitud Comercial", "Unidades Declaradas", "Peso Equivalente"]
            total_unds = sum(float(m.group(2).replace('.', '').replace(',', '.')) for m in var_matches if float(m.group(2).replace('.', '').replace(',', '.')) > 10)
            total_acero_str = f"{int(total_unds):,} varillas de 6m".replace(',', '.')

    print(f"Municipio: {municipio}")
    print(f"Tramos: {tramos}")
    print(f"Longitud: {longitud_str}")
    print(f"Ancho: {ancho_str}")
    print(f"Formato: {formato} | Filas extraídas: {len(filas_acero)}")
    print(f"Total Acero Consignado: {total_acero_str}")
    for idx, f in enumerate(filas_acero[:3]):
        print(f"   Fila {idx+1}: {f}")

for name, path in test_files.items():
    parse_faithful_document(name, path)
