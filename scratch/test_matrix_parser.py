import sys, openpyxl, re
sys.stdout.reconfigure(encoding='utf-8')

def parsear_matriz_despiece(matriz_filas, file_name="", matriz_concreto=None):
    info_general = {
        'municipio': '',
        'subregion': 'ANTIOQUIA',
        'via': '',
        'codigoVia': '',
        'longitudM': 0,
        'anchoM': 0,
        'separacionVigasM': 3.0
    }
    
    # 1. Extraer datos generales
    for r in matriz_filas:
        for idx, cell in enumerate(r):
            c_str = str(cell or '').strip()
            c_upper = c_str.upper()
            
            # Helper to get next non-label cell
            def get_val_right(start_idx):
                for next_c in r[start_idx+1:]:
                    val = str(next_c or '').strip()
                    if val and not any(k in val.upper() for k in ['MUNICIPIO', 'SUBREGI', 'NOMBRE', 'CÓDIGO', 'CODIGO', 'LONGITUD', 'ANCHO', 'SEPARACI']):
                        return val
                return ''

            if 'MUNICIPIO:' in c_upper:
                v = get_val_right(idx).replace('[', '').replace(']', '').strip()
                if v and not 'NOMBRE DEL MUNICIPIO' in v.upper():
                    info_general['municipio'] = v
            elif 'SUBREGIÓN:' in c_upper or 'SUBREGION:' in c_upper:
                v = get_val_right(idx).replace('[', '').replace(']', '').strip()
                if v and not 'EJ:' in v.upper():
                    info_general['subregion'] = v
            elif 'NOMBRE DE LA VÍA' in c_upper or 'NOMBRE DE LA VIA' in c_upper:
                v = get_val_right(idx).replace('[', '').replace(']', '').strip()
                if v and not 'NOMBRE DE LA VÍA' in v.upper():
                    info_general['via'] = v
            elif 'CÓDIGO DE LA VÍA:' in c_upper or 'CODIGO DE LA VIA:' in c_upper or 'CODIGO VIAL' in c_upper:
                v = get_val_right(idx).replace('[', '').replace(']', '').strip()
                if v and not 'EJ:' in v.upper():
                    info_general['codigoVia'] = v
            elif 'LONGITUD' in c_upper and ('VÍA' in c_upper or 'VIA' in c_upper or 'INTERVENIR' in c_upper or '(M)' in c_upper):
                v = get_val_right(idx)
                m = re.search(r'([0-9\.\,]+)', v)
                if m:
                    try:
                        n = float(m.group(1).replace('.', '').replace(',', '.'))
                        if n > 0: info_general['longitudM'] = n
                    except: pass
            elif 'ANCHO' in c_upper and ('CALZADA' in c_upper or 'SECCI' in c_upper or 'TRAMO' in c_upper or '(M)' in c_upper):
                v = get_val_right(idx)
                m = re.search(r'([0-9\.\,]+)', v)
                if m:
                    try:
                        n = float(m.group(1).replace(',', '.'))
                        if n > 0: info_general['anchoM'] = n
                    except: pass
            elif 'SEPARACIÓN' in c_upper or 'SEPARACION' in c_upper:
                v = get_val_right(idx)
                m = re.search(r'([0-9\.\,]+)', v)
                if m:
                    try:
                        n = float(m.group(1).replace(',', '.'))
                        if n > 0: info_general['separacionVigasM'] = n
                    except: pass

    # Fallback regex for road code if still empty
    if not info_general['codigoVia']:
        for r in matriz_filas:
            line = ' '.join(str(c or '') for c in r)
            m = re.search(r'\b(05\d{3}VT\d{1,4})\b', line, re.I)
            if m:
                info_general['codigoVia'] = m.group(1).upper()
                break

    # 2. Definición estándar de 12 filas
    filas_def = [
        {'item': 1, 'elem': "RIELES", 'tipo': "Refuerzo Longitudinal", 'diam': '3/8"', 'pesoLin': 0.560, 'corte': 6.00, 'obs': "Empalmes escalonados"},
        {'item': 2, 'elem': "RIELES", 'tipo': "Refuerzo Transversal", 'diam': '3/8"', 'pesoLin': 0.560, 'corte': 0.80, 'obs': "Separación cada 0.20 m"},
        {'item': 3, 'elem': "RIELES", 'tipo': "Traslapo (Opcional)", 'diam': '3/8"', 'pesoLin': 0.560, 'corte': 0.40, 'obs': "Longitud empalme según norma"},
        {'item': 4, 'elem': "VIGA RIOSTRA", 'tipo': "Refuerzo Long. Superior", 'diam': '1/2"', 'pesoLin': 0.994, 'corte': 4.20, 'obs': "2 barras superiores corridas"},
        {'item': 5, 'elem': "VIGA RIOSTRA", 'tipo': "Refuerzo Long. Inferior", 'diam': '1/2"', 'pesoLin': 0.994, 'corte': 4.20, 'obs': "2 barras inferiores corridas"},
        {'item': 6, 'elem': "VIGA RIOSTRA", 'tipo': "Refuerzo Transversal (Estribos)", 'diam': '3/8"', 'pesoLin': 0.560, 'corte': 0.85, 'obs': "Estribos cerrados c/ 0.20 m"},
        {'item': 7, 'elem': "CUNETAS Y BORDILLOS", 'tipo': "Refuerzo Longitudinal Cuneta", 'diam': '3/8"', 'pesoLin': 0.560, 'corte': 6.00, 'obs': "3 barras longitudinales"},
        {'item': 8, 'elem': "CUNETAS Y BORDILLOS", 'tipo:': "Refuerzo Transversal Cuneta", 'diam': '3/8"', 'pesoLin': 0.560, 'corte': 0.80, 'obs': "Flejes en U cada 0.25 m"},
        {'item': 9, 'elem': "CUNETAS Y BORDILLOS", 'tipo': "Refuerzo Long. Bordillo", 'diam': '3/8"', 'pesoLin': 0.560, 'corte': 6.00, 'obs': "1 barra superior corrida"},
        {'item': 10, 'elem': "CUNETAS Y BORDILLOS", 'tipo': "Refuerzo Gancho Bordillo", 'diam': '1/4"', 'pesoLin': 0.250, 'corte': 0.45, 'obs': "Ganchos de anclaje cada 0.30 m"},
        {'item': 11, 'elem': "LOSA DE TRANSICIÓN", 'tipo': "Malla Longitudinal", 'diam': '3/8"', 'pesoLin': 0.560, 'corte': 1.40, 'obs': "Malla de refuerzo en extremos"},
        {'item': 12, 'elem': "LOSA DE TRANSICIÓN", 'tipo': "Malla Transversal", 'diam': '3/8"', 'pesoLin': 0.560, 'corte': 4.20, 'obs': "Malla transversal en extremos"}
    ]
    
    filas_resultado = []
    for d in filas_def:
        filas_resultado.append({
            'item': d['item'],
            'elem': d['elem'],
            'tipo': d.get('tipo', d.get('tipo:')),
            'diam': d['diam'],
            'pesoLin': d['pesoLin'],
            'corte': d['corte'],
            'piezas': 0,
            'longTotalM': 0.0,
            'pesoTotalKg': 0.0,
            'varillas6m': 0,
            'obs': d['obs']
        })

    # 3. Mapear filas de la tabla
    cat = None
    for r in matriz_filas:
        if not r: continue
        line = ' '.join(str(c or '') for c in r).upper()
        if 'SUBTOTAL' in line or 'CONSOLIDADO POR DI' in line or 'SOPORTES T' in line:
            cat = None
            continue
        elif 'RIELES' in line or 'HUELLAS' in line: cat = 'RIELES'
        elif 'VIGA RIOSTRA' in line or 'RIOSTAS' in line or 'VIGAS RIOSTRAS' in line: cat = 'VIGA RIOSTRA'
        elif 'CUNETAS Y BORDILLOS' in line or 'CUNETAS' in line or 'BORDILLOS' in line: cat = 'CUNETAS Y BORDILLOS'
        elif 'LOSA DE TRANSICI' in line or 'TRANSICION' in line: cat = 'LOSA DE TRANSICIÓN'
        
        full_r = ' '.join(str(c or '') for c in r).lower()
        mid = None
        if cat == 'RIELES':
            if 'longitudinal' in full_r: mid = 1
            elif 'transversal' in full_r: mid = 2
            elif 'traslapo' in full_r or 'empalme' in full_r or 'opcional' in full_r: mid = 3
        elif cat == 'VIGA RIOSTRA':
            if 'superior' in full_r: mid = 4
            elif 'inferior' in full_r: mid = 5
            elif 'estribo' in full_r or 'transversal' in full_r or 'fleje' in full_r: mid = 6
        elif cat == 'CUNETAS Y BORDILLOS':
            if 'cuneta' in full_r and 'longitudinal' in full_r: mid = 7
            elif 'cuneta' in full_r and ('transversal' in full_r or 'fleje' in full_r): mid = 8
            elif 'bordillo' in full_r and ('long' in full_r or 'superior' in full_r): mid = 9
            elif 'gancho' in full_r or ('bordillo' in full_r and 'transversal' in full_r): mid = 10
        elif cat == 'LOSA DE TRANSICIÓN':
            if 'longitudinal' in full_r: mid = 11
            elif 'transversal' in full_r: mid = 12

        if mid:
            target = filas_resultado[mid - 1]
            
            # Check diameter string in row
            for c in r:
                c_str = str(c or '').strip()
                if any(x in c_str for x in ['1/2', '#4', '½']): target['diam'] = '1/2"'
                elif any(x in c_str for x in ['3/8', '#3', '⅜']): target['diam'] = '3/8"'
                elif any(x in c_str for x in ['1/4', '#2', '¼']): target['diam'] = '1/4"'
            
            # Update nominal weight according to diameter
            if '1/2' in target['diam']: target['pesoLin'] = 0.994
            elif '1/4' in target['diam']: target['pesoLin'] = 0.250
            else: target['pesoLin'] = 0.560

            # Extract numeric cells
            nums = []
            for c in r:
                s = str(c or '').replace('$', '').strip()
                clean = s.replace('.', '').replace(',', '.')
                try:
                    val = float(clean)
                    if re.match(r'^[\d\.,]+$', s):
                        nums.append(val)
                except:
                    pass
            
            def clean_num(v):
                if v is None or v == "": return 0.0
                if isinstance(v, (int, float)): return float(v)
                s = str(v).replace('$', '').strip()
                m = re.search(r'([0-9\.,]+)', s)
                if not m: return 0.0
                s = m.group(1)
                if '.' in s and ',' in s:
                    if s.find('.') < s.find(','):
                        s = s.replace('.', '').replace(',', '.')
                    else:
                        s = s.replace(',', '')
                elif ',' in s:
                    s = s.replace(',', '.')
                elif s.count('.') > 1:
                    s = s.replace('.', '')
                try:
                    return float(s)
                except:
                    return 0.0

            if len(r) >= 6:
                corte_val = clean_num(r[4])
                if corte_val > 0: target['corte'] = corte_val

                pzas_val = clean_num(r[5])
                if pzas_val >= 0: target['piezas'] = int(round(pzas_val))

                lt_val = clean_num(r[6])
                if lt_val > 0: target['longTotalM'] = round(lt_val, 2)

                pt_val = clean_num(r[7])
                if pt_val > 0: target['pesoTotalKg'] = round(pt_val, 2)

                var_val = clean_num(r[8])
                if var_val > 0: target['varillas6m'] = int(round(var_val))

            # Recalculate if longTotalM or pesoTotalKg were formulas that evaluated to 0/empty
            if target['piezas'] > 0:
                if target['longTotalM'] == 0:
                    target['longTotalM'] = round(target['corte'] * target['piezas'], 2)
                if target['pesoTotalKg'] == 0:
                    target['pesoTotalKg'] = round(target['pesoLin'] * target['longTotalM'], 2)
                if target['varillas6m'] == 0:
                    target['varillas6m'] = int(-(-target['longTotalM'] // 6.0))
            else:
                target['piezas'] = 0
                target['longTotalM'] = 0.0
                target['pesoTotalKg'] = 0.0
                target['varillas6m'] = 0

    # 4. Totales y consolidado
    subtotal_long = round(sum(f['longTotalM'] for f in filas_resultado), 2)
    subtotal_peso = round(sum(f['pesoTotalKg'] for f in filas_resultado), 2)
    subtotal_var = sum(f['varillas6m'] for f in filas_resultado)

    def sum_by_diam(d_match):
        p = round(sum(f['pesoTotalKg'] for f in filas_resultado if d_match in f['diam']), 2)
        v = sum(f['varillas6m'] for f in filas_resultado if d_match in f['diam'])
        return p, v

    p_12, v_12 = sum_by_diam('1/2')
    p_38, v_38 = sum_by_diam('3/8')
    p_14, v_14 = sum_by_diam('1/4')

    consolidado = [
        {'diametro': '1/2"', 'pesoNominal': 0.994, 'pesoTotalKg': p_12, 'varillas6m': v_12, 'unidad': "KG"},
        {'diametro': '3/8"', 'pesoNominal': 0.560, 'pesoTotalKg': p_38, 'varillas6m': v_38, 'unidad': "KG"},
        {'diametro': '1/4"', 'pesoNominal': 0.250, 'pesoTotalKg': p_14, 'varillas6m': v_14, 'unidad': "KG"},
        {'diametro': 'TOTAL', 'pesoNominal': None, 'pesoTotalKg': subtotal_peso, 'varillas6m': subtotal_var, 'unidad': "GLOBAL"}
    ]

    L = info_general['longitudM']
    cuantia = round(subtotal_peso / L, 2) if L > 0 else 0.0
    superavit = round(cuantia - 26.25, 2)

    totales = {
        'pesoTotalGlobalKg': subtotal_peso,
        'totalVarillas6m': subtotal_var,
        'cuantiaKgM': cuantia,
        'cuantiaSuperavitKgM': superavit
    }

    return {
        'infoGeneral': info_general,
        'filas': filas_resultado,
        'subtotal': {'longitudTotalM': subtotal_long, 'pesoTotalKg': subtotal_peso, 'varillas6m': subtotal_var},
        'consolidado': consolidado,
        'totales': totales
    }

wb = openpyxl.load_workbook('Base/Plantilla_Estandar_Despiece_Acero_Gobernacion.xlsx', data_only=True)
s = wb['ACERO']
rows = [[str(s.cell(r, col).value or '').strip() for col in range(1, 15)] for r in range(1, s.max_row+1)]
res = parsear_matriz_despiece(rows, 'Plantilla_Estandar.xlsx')

print("=== RESULTADO EN PLANTILLA BASE ===")
print("Info General:", res['infoGeneral'])
print("Total Filas:", len(res['filas']))
print("Totales:", res['totales'])
print("Consolidado:", res['consolidado'])
print("Ejemplo Fila 1:", res['filas'][0])
