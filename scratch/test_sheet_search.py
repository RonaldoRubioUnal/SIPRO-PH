import sys, openpyxl, re
sys.stdout.reconfigure(encoding='utf-8')

def test_excel_file(path):
    print(f"\n=================== TESTING: {path} ===================")
    wb = openpyxl.load_workbook(path, data_only=True)
    keywords = ["despiece", "acero", "placa huella", "rieles", "riostra", "refuerzo", "calculo"]
    
    # 1. Search sheet
    target_sheet = None
    target_name = None
    for name in wb.sheetnames:
        clean = name.lower()
        if any(k in clean for k in keywords):
            target_name = name
            target_sheet = wb[name]
            break
    if not target_sheet:
        target_name = wb.sheetnames[0]
        target_sheet = wb[target_name]
    
    print(f"Target Sheet selected: '{target_name}'")
    
    # Concrete sheet
    concrete_sheet = None
    for name in wb.sheetnames:
        clean = name.lower()
        if any(k in clean for k in ["concreto", "cemento", "materiales"]):
            concrete_sheet = wb[name]
            break
    print(f"Concrete Sheet selected: '{concrete_sheet.title if concrete_sheet else None}'")
    
    rows = [[str(cell.value or '').strip() for cell in row] for row in target_sheet.iter_rows(values_only=False)]
    print(f"Total Rows in matrix: {len(rows)}")

test_excel_file('Base/Plantilla_Estandar_Despiece_Acero_Gobernacion.xlsx')
test_excel_file(r'd:\RRUBIOR\My Documents\Prueba Aceros\03.3.3 Despiece.xlsx')
