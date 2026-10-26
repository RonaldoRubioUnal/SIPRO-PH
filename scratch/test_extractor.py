import pypdf, re, json

def clean_num(s):
    if not s: return 0.0
    s = s.strip().replace(".", "").replace(",", ".")
    try:
        return float(s)
    except:
        return 0.0

def test_extract(pdf_path):
    print("="*60)
    print("TESTING:", pdf_path)
    reader = pypdf.PdfReader(pdf_path)
    full_text = ""
    for page in reader.pages:
        full_text += (page.extract_text() or "") + "\n"
    
    # 1. Spreadsheet errors
    errors = re.findall(r'(#DIV/0!|#\xa1REF!|#REF!|#\xa1VALOR!|#VALOR!|#N/A)', full_text)
    print("Spreadsheet errors:", set(errors))
    
    # 2. Length
    l_matches = re.findall(r'(?:longitud a intervenir|longitud del tramo|longitud total|longitud via|longitud|meta)[\s:]*([0-9\.,]+)\s*(km|m\b|metros)?', full_text, re.IGNORECASE)
    print("Length matches:", l_matches)
    
    # 3. Width
    w_matches = re.findall(r'(?:ancho del tramo|ancho de via|ancho banca|ancho de calzada|ancho total|ancho)[\s:]*([0-9\.,]+)\s*(m\b|metros)?', full_text, re.IGNORECASE)
    print("Width matches:", w_matches)
    
    # 4. Total steel weight
    tot_matches = re.findall(r'(?:TOTAL ACERO PLACA HUELLA|TOTAL CANTIDAD ITEM|TOTAL GENERAL|PESO TOTAL DE ACERO|TOTAL ACERO|PESO TOTAL)[\s\S]{0,30}?([0-9\.\,]{3,10})\s*(?:kg)?', full_text, re.IGNORECASE)
    print("Total steel matches:", tot_matches)

    # 5. Check itemized rows
    # Format A: e.g. 1 REFUERZO LONGITUDINAL HUELLA ...
    lines = full_text.split('\n')
    itemized = []
    for l in lines:
        l_clean = l.strip()
        # Look for e.g. "1 REFUERZO..." or "TOTAL ACERO LONG..."
        m_row = re.match(r'^(\d+)\s+([A-Z\s\(\)\=\,0-9]+?)\s+(0[,\.]\d{2})\s+([0-9\.,]+)\s+([0-9\.,]+)\s+([0-9\.,]+)\s+([0-9\.,]+)$', l_clean)
        if m_row:
            itemized.append({
                "num": m_row.group(1),
                "elemento": m_row.group(2).strip(),
                "masa": clean_num(m_row.group(3)),
                "pesoTotal": clean_num(m_row.group(7))
            })
        m_sub = re.match(r'^(TOTAL ACERO [A-Z\.\s\(\)]+)\s+([0-9\.,]+)\s*kg', l_clean, re.IGNORECASE)
        if m_sub:
            itemized.append({
                "elemento": m_sub.group(1).strip(),
                "pesoTotal": clean_num(m_sub.group(2))
            })
    print(f"Extracted {len(itemized)} rebar items:")
    for it in itemized[:10]:
        print("  ", it)

test_extract(r'..\Prueba Aceros\03.3.1 ESQUEMAS Y DESPIECE DE ACERO PLACA HUELLA JEP.pdf')
test_extract(r'..\Prueba Aceros\03.3.2 DESPIECE ACERO N_.pdf')
