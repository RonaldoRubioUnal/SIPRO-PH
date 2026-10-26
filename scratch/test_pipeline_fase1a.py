import sys, openpyxl, json
sys.stdout.reconfigure(encoding='utf-8')

# Load Base template Excel
wb = openpyxl.load_workbook('Base/Plantilla_Estandar_Despiece_Acero_Gobernacion.xlsx', data_only=True)
s_acero = wb['ACERO']
s_conc = wb['CONCRETO']

matriz_filas = [[str(cell.value or '').strip() for cell in row] for row in s_acero.iter_rows(values_only=False)]
matriz_concreto = [[str(cell.value or '').strip() for cell in row] for row in s_conc.iter_rows(values_only=False)]

from test_matrix_parser import parsear_matriz_despiece

res = parsear_matriz_despiece(matriz_filas, 'Plantilla_Estandar.xlsx', matriz_concreto)

print("=== VERIFICACIÓN FASE 1A: PLANTILLA OFICIAL BASE ===")
print("isStandardTemplate:", True)
print("Peso Total Declarado Kg:", res['totales']['pesoTotalGlobalKg'])
print("Total Varillas 6m:", res['totales']['totalVarillas6m'])
print("Cuantía Kg/M:", res['totales']['cuantiaKgM'])
print("Total Filas Despiece:", len(res['filas']))

# Verify every row has 0 pieces in base template
all_zero = all(f['piezas'] == 0 for f in res['filas'])
print("¿Todas las piezas son 0 (Sin MOCK ni números falsos)?:", all_zero)

for f in res['filas']:
    print(f"  Item {f['item']} [{f['elem']} - {f['tipo']}]: {f['piezas']} pzas, {f['longTotalM']} m, {f['pesoTotalKg']} kg, {f['varillas6m']} varillas")

print("\n=== CONSOLIDADO POR DIÁMETRO ===")
for c in res['consolidado']:
    print(f"  Ø {c['diametro']}: {c['pesoTotalKg']} kg, {c['varillas6m']} varillas ({c['unidad']})")
