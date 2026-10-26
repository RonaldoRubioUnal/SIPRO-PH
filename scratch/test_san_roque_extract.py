import pypdf, re

def clean_num(s):
    if not s: return 0.0
    s = s.strip().replace(".", "").replace(",", ".")
    try:
        return float(s)
    except:
        return 0.0

reader = pypdf.PdfReader(r'..\Prueba Aceros\03.3.2 DESPIECE ACERO N_.pdf')
full_text = ""
for page in reader.pages:
    full_text += (page.extract_text() or "") + "\n"

# In San Roque, check component totals:
# e.g. "TOTAL ACERO RIELES (kg) 5320 kg"
# or "TOTAL ACERO PLACA HUELLA 15060 kg"
# or by varillas de 6m:
# "# de Varillas de 6m requeridas en vigas (long) 316 Und"
# "TOTAL ACERO LONG. VIGAS (kg) 1885 kg"
matches_comp = re.findall(r'TOTAL ACERO\s+([A-Z\.\s\(\)]+?)\s+([0-9\.,]+)\s*kg', full_text, re.IGNORECASE)
print(f"Matched {len(matches_comp)} component totals:")
for elem, kg in matches_comp:
    print(f"  {elem.strip()}: {clean_num(kg)} kg")

# Check rebar 6m counts:
matches_var = re.findall(r'#\s*(?:de\s+)?Varillas(?:\s+de\s+6m)?\s+requeridas\s+en\s+([^\n\r]+?)\s+([0-9\.,]+)\s*Und', full_text, re.IGNORECASE)
print(f"Matched {len(matches_var)} rebar unit counts:")
for elem, und in matches_var:
    print(f"  {elem.strip()}: {clean_num(und)} Und")
