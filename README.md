# SIPRO-PH: Sistema de Revisión y Priorización Técnico-Documental de Placa Huellas

**Entidad Receptora:** Gobernación de Antioquia - Secretaría de Infraestructura Física - Dirección de Infraestructura Física y Apoyo Territorial  
**Objetivo:** Automatizar y estructurar la revisión técnica, documental, estructural y espacial de proyectos de placa huella en la Red Terciaria Departamental.

---

## 🎨 Referencias Visuales e Identidad Institucional
El diseño de la aplicación integra fielmente las referencias solicitadas:
- **Logo Institucional (`Logo.png`):** Integrado en el encabezado de la barra lateral, la cabecera superior y la plantilla de reportes imprimibles.
- **Paleta de Colores (`colores.jpg`):**
  - Verde Bosque Institucional: `#00412E`
  - Verde Salvia / Acento: `#96BF8A`
  - Fondo Cálido Neutro: `#E8EAE5`
  - Superficie Blanca / Tarjetas: `#FFFFFF`
- **Estructura y Maquetación (`Figma Dashboard Template`):**
  - Barra lateral de navegación tipo *Rail* con enlaces funcionales directos y botón de **Carga de Carpeta Municipal**.
  - Tarjetas redondeadas (`border-radius: 18px-24px`), sombras suaves y bordes de alta definición.
  - Indicadores KPI ejecutivos superiores.
- **Auditoría Técnica y Tabla Semafórica (`Modelo.jpg`):**
  - Parámetros de diseño ($f'_c$, $f_y$, Criterio Técnico Departamental de Pavimentos con Placa Huella).
  - Indicador circular radial (*Radial Donut Gauge*) para el porcentaje de Conformidad General.
  - **Tabla Auditora con Semáforos** con pastillas verdes/rojas (*Cumple* / *No Cumple*).
  - **Alternancia de Modo Oscuro Técnico**: Botón en la barra lateral para pasar al tema oscuro de auditoría.

---

## 🚪 Arquitectura del Sistema: Compuertas Secuenciales ("Gatekeepers")

El flujo opera bajo compuertas estrictas:
```
[Carga de Carpeta Municipal (PDFs, KMZ, Excel) / Botón Ejemplo]
                  │
                  ▼
[FASE 1A: Control Estructural de Acero Mínimo y Esquema Placa Huella] ──(No cumple)──► [Alerta Subsanación 1A]
                  │ (Aprobado >= 26.25 kg/m, Criterio Técnico Departamental)
                  ▼
[FASE 1B: Verificación Espacial en Google Satelital vs. Red Terciaria] ──(Fuera de red)──► [Alerta Subsanación 1B]
                  │ (Cruce automático con GeoJSON y tabla de contraste espacial)
                  ▼
[FASE 2: Lista Numérica Continua de 27 Requisitos Documentales] ──(Incompleto / Vencido)──► [Reporte Subsanación F2]
                  │ (100% de los 27 ítems conformes)
                  ▼
[FASE 3: Emisión Ficha de Priorización Aprobada y Concepto Técnico]
```

---

## 📁 Módulos y Mejoras Implementadas

1. **Gestor de Expedientes Municipales y Auditoría 100% Dinámica (`folderReader.js` & `app.js`):**
   - **Eliminación del Simulador de Casos Preconfigurados:** El sistema evalúa exclusivamente los expedientes reales con los archivos físicamente aportados en la carpeta del municipio.
   - **Evaluación Dinámica Cruzada:** Cada fase se recalcula y ajusta según los documentos reales presentes:
     - **Fase 1A:** Si falta el despiece (Ítem 3), se alerta de inmediato como documento faltante, cuantía en 0 kg/m y la compuerta 1A se bloquea. Si está presente, se auditan sus marcas reales contra el mínimo de 26.25 kg/m del criterio técnico departamental.
     - **Fase 1B:** Si falta el archivo KMZ/KML (Ítem 24), se alerta como no georreferenciado, sin trazado ni puntos y la compuerta 1B se bloquea. Si está presente, se extraen los tramos y se ejecuta el contraste espacial contra la red vial terciaria.
     - **Fase 2:** Si faltan archivos entre los 27 ítems, se marcan en rojo como **"⚠️ FALTANTE"** (no conforme), calculando el porcentaje real de completitud y listando las observaciones para subsanación.
   - **Lectura en Primera Instancia de la Ficha de Priorización:** Identificación automática del municipio cotejando el texto de la ficha contra los **125 municipios oficiales de Antioquia** (DANE / Gobernación), con extracción de códigos viales, presupuestos y vías.
   - **Gestor Multi-Expediente:** Permite auditar varios municipios en paralelo en la misma sesión, cambiando entre ellos con 1 clic sin perder el estado individual.
   - **Modal de Identificación y Ajuste de Nombre:** Botón `✏️ Nombrar Expediente` para personalizar el rótulo del proyecto o resolver ambigüedades.

2. **Fase 1A: Control Estructural y Esquema Gráfico de Placa Huella:**
   - **Criterio Técnico Estructural:** Criterios Técnicos de Pavimentos con Placa-huella (26.25 kg/m).
   - **Esquema Gráfico Interactivo:** Corte transversal detallado en SVG con rieles de concreto ($0.90\text{ m}$), franja central en concreto ciclópeo ($0.90\text{ m}$), riostras de confinamiento ($2.80-3.00\text{ m}$), cunetas y cordones ($0.15\text{ m} \times 0.20\text{ m}$), con iluminación interactiva por marcas de despiece.
   - Consistencia matemática: $\sum (\text{Longitud} \times \text{Masa Lineal Nominal}) == \text{Peso Total Declarado}$.
   - Umbral normativo: Cuantía mínima de **26.25 kg/m**.
   - Verificación de traslapos mínimos ($0.54\text{ m}$ para varilla #3) y ganchos a 135° ($0.16\text{ m}$).

3. **Fase 1B: Control Espacial en Mapa Google Satelital y Red Vial Terciaria:**
   - Capa base de **Google Satelital Híbrido** con alta resolución.
   - Capa de **Red Vial Terciaria** en líneas cian/azul cargable vía GeoJSON.
   - **Panel de Contraste Espacial (Puntos vs. Red Vial Terciaria)** según referencia visual:
     - Cálculo y visualización de ID, Sector Informe, Código de Informe, `CODIGO_VIA (GeoJSON)`, `NOMBRE_VIA (GeoJSON)`, distancia al eje y estado (`✓ SOBRE 05425VT...` o `! A X m DE ...`).
     - Botones de exportación a CSV/Excel y KML con códigos viales.

4. **Fase 2: Verificación Numérica Continua y Modal de Inspección Real (Ítems 1 al 27):**
   - Lista secuencial numerada del 1 al 27 con estados 100% dinámicos: `✓ Conforme` (si el archivo existe y está vigente en la carpeta cargada), `⚠️ Vencido` (si supera los 30 días) o `✗ Faltante` (si no se aportó el archivo).
   - Modal de inspección detallada que muestra el nombre del archivo real, su tamaño en KB, fecha de última modificación y extracto digital de texto leído mediante PDF.js.
   - Si se abre cualquier carpeta con documentos faltantes, la compuerta de Fase 2 se bloquea automáticamente y lista los ítems no aportados.

5. **Fase 1A & 1B Dinámicas:**
   - **Fase 1A (Estructural):** Si no se aporta el Ítem 3 (`Despiece de acero`), la compuerta se detiene con cuantía 0 kg/m y tabla de marcas vacía con alerta. Si se aporta, lee la longitud, calcula los pesos y evalúa la cuantía frente al mínimo normativo de 26.25 kg/m.
   - **Fase 1B (Espacial):** Si no se aporta el Ítem 24 (`KMZ / KML`), la compuerta se detiene con 0% de cobertura y tabla vacía con alerta. Si se aporta, descomprime el KMZ con JSZip, extrae los Placemarks, nombres de veredas/sectores y coordenadas geográficas reales, y centra el mapa de Google Satélite en los tracks del proyecto.

6. **Reportes y Concepto Favorable:**
   - Hoja técnica institucional con el logo, dictamen vinculante, matriz de observaciones y descarga de informe en formato imprimible o informe técnico formal.

---

## 🚀 Cómo Ejecutar la Aplicación

1. Hacer doble clic en el archivo `abrir_sistema.bat`.
2. O desde la terminal ejecutar:
   ```bash
   python -m http.server 8085
   ```
   Y abrir en cualquier navegador web:
   ```
   http://localhost:8085/index.html
   ```
