import sys
sys.stdout.reconfigure(encoding='utf-8')
from test_matrix_parser import parsear_matriz_despiece

# Simulate a filled matrix (as from Excel or PDF export)
filled_rows = [
    ['[LOGO / MUNICIPIO]', 'DESPIECE DE ACERO - PROYECTOS PLACA HUELLAS '],
    [],
    [],
    ['1. INFORMACIÓN GENERAL DEL PROYECTO Y CONVENIO'],
    ['MUNICIPIO:', 'SAN ROQUE', 'SUBREGIÓN:', 'NORDESTE'],
    ['NOMBRE DE LA VÍA / TRAMO:', 'VÍA EL NUSITO', 'CÓDIGO DE LA VÍA:', '05670VT01'],
    ['LONGITUD DE VÍA (m):', '500', 'ANCHO CALZADA (m):', '4.30', 'SEPARACIÓN VIGAS (m):', '3.00'],
    [],
    ['DIRECTRIZ TÉCNICA: Todos los municipios deben reportar el despiece en esta tabla oficial...'],
    [],
    [],
    ['2. CUADRO DETALLADO DE DESPIECE DE ACERO POR ELEMENTO (OBLIGATORIO)'],
    ['Elemento Estructural', 'Tipo de Refuerzo', 'Diámetro Nominal', 'Peso Lin. (kg/m)', 'Longitud Corte (m)', 'Cantidad Piezas', 'Longitud Total (m)', 'Peso Total (kg)', 'Varillas 6m Req.', 'Observaciones / Detalle'],
    ['RIELES', 'Refuerzo Longitudinal', '3/8"', '0.560', '6.00', '667', '4002.00', '2241.12', '667', 'Empalmes escalonados'],
    ['', 'Refuerzo Transversal', '3/8"', '0.560', '0.80', '5000', '4000.00', '2240.00', '667', 'Separación cada 0.20 m'],
    ['', 'Traslapo (Opcional)', '3/8"', '0.560', '0.40', '167', '66.80', '37.41', '12', 'Longitud empalme según norma'],
    ['VIGA RIOSTRA', 'Refuerzo Long. Superior', '1/2"', '0.994', '4.20', '334', '1402.80', '1394.38', '234', '2 barras superiores corridas'],
    ['', 'Refuerzo Long. Inferior', '1/2"', '0.994', '4.20', '334', '1402.80', '1394.38', '234', '2 barras inferiores corridas'],
    ['', 'Refuerzo Transversal (Estribos)', '3/8"', '0.560', '0.85', '2338', '1987.30', '1112.89', '332', 'Estribos cerrados c/ 0.20 m'],
    ['CUNETAS Y BORDILLOS', 'Refuerzo Longitudinal Cuneta', '3/8"', '0.560', '6.00', '500', '3000.00', '1680.00', '500', '3 barras longitudinales'],
    ['', 'Refuerzo Transversal Cuneta', '3/8"', '0.560', '0.80', '2500', '2000.00', '1120.00', '334', 'Flejes en U cada 0.25 m'],
    ['', 'Refuerzo Long. Bordillo', '3/8"', '0.560', '6.00', '167', '1002.00', '561.12', '167', '1 barra superior corrida'],
    ['', 'Refuerzo Gancho Bordillo', '1/4"', '0.250', '0.45', '1000', '450.00', '112.50', '75', 'Ganchos de anclaje cada 0.30 m'],
    ['LOSA DE TRANSICIÓN', 'Malla Longitudinal', '3/8"', '0.560', '1.40', '24', '33.60', '18.82', '6', 'Malla de refuerzo en extremos'],
    ['', 'Malla Transversal', '3/8"', '0.560', '4.20', '12', '50.40', '28.22', '9', 'Malla transversal en extremos'],
    ['SUBTOTAL CANTIDADES NOMINALES:', '', '', '', '', '13043', '19397.70', '11940.84', '3237'],
    [],
    ['3. CONSOLIDADO POR DIÁMETRO (PARA SUMINISTRO CONVENIO)'],
    ['Diámetro', 'Peso Nominal (kg)', 'Peso Total (kg)', 'Varillas (6m) Requeridas', 'Unidad Suministro', 'PESO TOTAL A SUMINISTRAR (KG)'],
    ['1/2"', '0.994', '2788.76', '468', 'KG', '11940.84'],
    ['3/8"', '0.560', '9039.58', '2694', 'KG', ''],
    ['1/4"', '0.250', '112.50', '75', 'KG', 'TOTAL VARILLAS DE 6 METROS'],
    ['TOTAL', '', '11940.84', '3237', 'GLOBAL', '3237']
]

res = parsear_matriz_despiece(filled_rows, 'Despiece_San_Roque_500m.xlsx')

print("=== VERIFICACIÓN: PLANTILLA DILIGENCIADA (SAN ROQUE 500m) ===")
print("Municipio:", res['infoGeneral']['municipio'])
print("Subregión:", res['infoGeneral']['subregion'])
print("Vía:", res['infoGeneral']['via'])
print("Código Vía:", res['infoGeneral']['codigoVia'])
print("Longitud:", res['infoGeneral']['longitudM'])
print("Ancho:", res['infoGeneral']['anchoM'])
print("Peso Total Declarado Kg:", res['totales']['pesoTotalGlobalKg'])
print("Total Varillas 6m:", res['totales']['totalVarillas6m'])
print("Cuantía Kg/M:", res['totales']['cuantiaKgM'], "kg/m")
print("Superávit:", res['totales']['cuantiaSuperavitKgM'], "kg/m")

print("\nConsolidado por diámetro:")
for c in res['consolidado']:
    print(f"  Ø {c['diametro']}: {c['pesoTotalKg']} kg, {c['varillas6m']} varillas")
