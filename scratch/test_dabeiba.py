import pypdf, re

def clean_num(s):
    if not s: return 0.0
    s = s.strip().replace(".", "").replace(",", ".")
    try:
        return float(s)
    except:
        return 0.0

reader = pypdf.PdfReader(r'..\Prueba Aceros\03.3.1 ESQUEMAS Y DESPIECE DE ACERO PLACA HUELLA JEP.pdf')
full_text = ""
for page in reader.pages:
    full_text += (page.extract_text() or "") + "\n"

# In PDF extraction, text often wraps lines. Let's merge lines that continue an item:
# A line starting with a number 1..20 followed by text and numbers
# We can search for pattern: (\d+)\s+([A-Z\s\(\)\=\,0-9]+?)(0[,\.]\d{2})\s+([0-9\.,]+)\s+([0-9\.,]+)\s+([0-9\.,]+)\s+([0-9\.,]+)
# with re.DOTALL or whitespace including newlines!
matches = re.findall(r'(\b\d{1,2})\s+([A-Z\s\(\)\=\,\-\d]+?)\s+(0[,\.]\d{2})\s+([0-9\.,]+)\s+([0-9\.,]+)\s+([0-9\.,]+)\s+([0-9\.,]+)', full_text)
print(f"Matched {len(matches)} items:")
for m in matches:
    num, desc, masa, l, nv, cant, tot = m
    # Clean description newlines
    clean_desc = re.sub(r'\s+', ' ', desc).strip()
    print(f"Item {num}: {clean_desc} | Masa: {clean_num(masa)} kg/m | L={clean_num(l)}m | Peso={clean_num(tot)} kg")
