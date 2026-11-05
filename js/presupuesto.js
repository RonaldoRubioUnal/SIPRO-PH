/**
 * MÓDULO DE AUDITORÍA Y COHERENCIA DE PRESUPUESTO (FASE 1C - MODALIDAD RECURSOS)
 * Sistema SIPRO-PH - Gobernación de Antioquia
 * Secretaría de Infraestructura Física - Dirección de Infraestructura Física y Apoyo Territorial
 * Cruce Tripartito de Cantidades: Despiece/Memoria vs. Especificaciones vs. Presupuesto Oficial
 */

const PresupuestoEngine = {
  toleranciaDefault: 5,
  /**
   * Validador y clasificador estricto de partidas de concreto en la hoja PRESUPUESTO (Fase 1C)
   * 1. Regla de Exclusión Prioritaria (Lista Negra Absoluta de preliminares, tierras, transporte, etc.)
   * 2. Condición Obligatoria: DEBE contener la palabra 'concreto'
   * 3. Clasificación Limpia: 'ciclopeo' vs 'simple_21', excluyendo concreto pobre / solados
   */
  clasificarPartidaConcreto(desc) {
    if (!desc || typeof desc !== "string") return { esConcreto: false, motivo: "Sin descripción" };
    const normDesc = desc.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Regla 1: Regla de Exclusión Prioritaria (Lista Negra Absoluta)
    const EXCLUSION_ROOTS = [
      "excavac",
      "explanac", "desmonte", "limpieza", "descapote", "roceria",
      "demolic",
      "relleno", "terraplen", "conformac", "compactac",
      "subbase", "base granular", "afirmado", "material granular", "recebo",
      "cargue", "retiro", "botadero", "disposicion", "escombro",
      "localizacion", "trazado", "topograf",
      "acero", "figurado", "varilla", "malla",
      "tuberia", "alcantarilla", "senal"
    ];

    if (EXCLUSION_ROOTS.some(root => normDesc.includes(root))) {
      return { esConcreto: false, motivo: "Excluido por lista negra de preliminares/tierras/transporte" };
    }

    // Regla 2: Condición Obligatoria -> DEBE contener la palabra 'concreto'
    if (!normDesc.includes("concreto")) {
      return { esConcreto: false, motivo: "No contiene la palabra 'concreto'" };
    }

    // Regla 3: Clasificación Limpia entre Concreto Ciclópeo y Concreto Simple (21 MPa)
    if (normDesc.includes("ciclopeo") || normDesc.includes("ciclo")) {
      return { esConcreto: true, tipo: "ciclopeo" };
    }

    // Excluir concreto pobre / solado de limpieza (10.5 MPa, 14 MPa, 1500 PSI, 2000 PSI)
    const esConcretoPobre = normDesc.includes("pobre") || 
                            normDesc.includes("solado") || 
                            normDesc.includes("limpieza") || 
                            normDesc.includes("10.5 mpa") || 
                            normDesc.includes("10,5 mpa") || 
                            normDesc.includes("14 mpa") || 
                            normDesc.includes("1500 psi") || 
                            normDesc.includes("2000 psi");
    if (esConcretoPobre) {
      return { esConcreto: false, motivo: "Concreto pobre / solado de limpieza" };
    }

    return { esConcreto: true, tipo: "simple_21" };
  },

  /**
   * Extrae dinámicamente las dimensiones y el área de la sección transversal de un ítem lineal de concreto.
   * Prohíbe valores inventados o quemados (como 0.063 m²).
   * 1. Analiza la descripción buscando:
   *    - Área directa: area = X m2, seccion X m2, sección X m2
   *    - Pares dimensionales: 0.15 x 0.20 m, (0.10x0.75), 10 x 75 cm
   *    - Dimensiones individuales: espesor/altura (e, h, alto, espesor, calibre) y ancho/base/desarrollo (a, b, ancho, base, desarrollo)
   * 2. Si no tiene dimensiones en la descripción, recurre a expedientesMap[proyectoId].fase1A como Fuente Única de Verdad.
   * 3. Si tampoco en Fase 1A tiene sección/dimensiones, retorna { converted: false }.
   */
  extraerDimensionesItem(desc, f1A = null) {
    if (!desc || typeof desc !== "string") {
      return {
        converted: false,
        areaSeccionM2: 0,
        motivo: "Descripción no válida o vacía"
      };
    }

    const rawDesc = desc.trim();
    const normDesc = rawDesc.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    // 1. Detección directa de área declarada explícitamente: "area = X m2", "seccion X m2", "sección X m2"
    const directAreaMatch = normDesc.match(/(?:(?:area|seccion)\s*[:=]?\s*(\d+(?:[\.,]\d+)?)\s*(?:m2|m²))/i);
    if (directAreaMatch) {
      const val = parseFloat(directAreaMatch[1].replace(",", "."));
      if (!isNaN(val) && val > 0 && val < 5) {
        const areaSeccion = +val.toFixed(4);
        return {
          converted: true,
          areaSeccionM2: areaSeccion,
          formula: `(sección = ${areaSeccion} m²)`,
          fuente: "descripcion_directa"
        };
      }
    }

    // 2. Detección de par dimensional: ej. "0.15 x 0.20 m", "(0.10x0.75)", "0.10*0.75 m", "15x20 cm"
    const pairMatch = normDesc.match(/(?:(?:\(|\[|\b)(?:seccion|dim(?:ensiones)?)?\s*(\d+(?:[\.,]\d+)?)\s*(cm|m|ml|mts)?\s*(?:[xX*×])\s*(\d+(?:[\.,]\d+)?)\s*(cm|m|ml|mts)?(?:\)|\]|\b))/i);
    if (pairMatch) {
      let num1 = parseFloat(pairMatch[1].replace(",", "."));
      let unit1 = (pairMatch[2] || "").toLowerCase();
      let num2 = parseFloat(pairMatch[3].replace(",", "."));
      let unit2 = (pairMatch[4] || "").toLowerCase();

      if (unit2 === "cm" && !unit1) unit1 = "cm";
      if (unit1 === "cm" && !unit2) unit2 = "cm";

      // Si no tienen unidad pero ambos >= 5 y <= 200, se interpretan como centímetros
      if (!unit1 && !unit2 && num1 >= 5 && num2 >= 5 && num1 <= 200 && num2 <= 200) {
        unit1 = "cm";
        unit2 = "cm";
      }

      if (unit1 === "cm") num1 = num1 / 100.0;
      if (unit2 === "cm") num2 = num2 / 100.0;

      if (!isNaN(num1) && !isNaN(num2) && num1 > 0 && num2 > 0 && num1 < 5 && num2 < 5) {
        const espesor = Math.min(num1, num2);
        const ancho = Math.max(num1, num2);
        const areaSeccion = +(espesor * ancho).toFixed(4);
        return {
          converted: true,
          areaSeccionM2: areaSeccion,
          espesorM: espesor,
          anchoM: ancho,
          formula: `(e=${espesor} m × ancho=${ancho} m → ${areaSeccion} m²)`,
          fuente: "descripcion_par"
        };
      }
    }

    // 3. Detección individual de Espesor/Altura (e, h, alto, espesor, calibre) y Ancho/Base/Desarrollo (a, b, ancho, base, desarrollo)
    let espesorVal = null;
    let anchoVal = null;

    // Espesor / Altura
    const espMatch = normDesc.match(/(?:(?:espesor|altura|alto|calibre|\be|\bh)\s*[:=]?\s*(\d+(?:[\.,]\d+)?)\s*(cm|m|ml|mts)?\b)/i);
    if (espMatch) {
      let val = parseFloat(espMatch[1].replace(",", "."));
      const unit = (espMatch[2] || "").toLowerCase();
      if (unit === "cm" || (val >= 5 && val <= 100 && !unit)) {
        val = val / 100.0;
      }
      if (!isNaN(val) && val > 0 && val < 5) {
        espesorVal = val;
      }
    }

    // Ancho / Base / Desarrollo
    const ancMatch = normDesc.match(/(?:(?:ancho(?:\s+promedio)?|base|desarrollo|\ba|\bb)\s*[:=]?\s*(\d+(?:[\.,]\d+)?)\s*(cm|m|ml|mts)?\b)/i);
    if (ancMatch) {
      let val = parseFloat(ancMatch[1].replace(",", "."));
      const unit = (ancMatch[2] || "").toLowerCase();
      if (unit === "cm" || (val >= 5 && val <= 300 && !unit)) {
        val = val / 100.0;
      }
      if (!isNaN(val) && val > 0 && val < 10) {
        anchoVal = val;
      }
    }

    if (espesorVal !== null && anchoVal !== null) {
      const areaSeccion = +(espesorVal * anchoVal).toFixed(4);
      return {
        converted: true,
        areaSeccionM2: areaSeccion,
        espesorM: espesorVal,
        anchoM: anchoVal,
        formula: `(e=${espesorVal} m × ancho=${anchoVal} m → ${areaSeccion} m²)`,
        fuente: "descripcion_dimensiones"
      };
    }

    // Resolver elemento de Fase 1A (Fuente Única de Verdad)
    const resolverElementoF1A = () => {
      let f1Target = f1A;
      if (!f1Target && typeof window !== "undefined") {
        const pId = window.selectedProject;
        if (pId) {
          f1Target = (window.expedientesMap && window.expedientesMap[pId] && window.expedientesMap[pId].fase1A) ||
                     (window.proyectosAuditados && window.proyectosAuditados[pId] && window.proyectosAuditados[pId].fase1A) || null;
        }
      }
      if (!f1Target) return null;

      const elementos = (f1Target.concreto && f1Target.concreto.elementos) ||
                        (f1Target.concretoVolumes && f1Target.concretoVolumes.elementos) || null;
      const dimDet = f1Target.dimensionesDetalle ||
                     (f1Target.concreto && f1Target.concreto.dimensionesDetalle) ||
                     (f1Target.concretoVolumes && f1Target.concretoVolumes.dimensionesDetalle) || null;

      let key = "";
      if (normDesc.includes("cuneta") || normDesc.includes("bordillo") || normDesc.includes("cordon") || normDesc.includes("berma")) {
        key = "cunetas";
      } else if (normDesc.includes("riel") || normDesc.includes("huella")) {
        key = "rieles";
      } else if (normDesc.includes("riostra") || normDesc.includes("viga")) {
        key = "riostras";
      } else if (normDesc.includes("sobreancho")) {
        key = "sobreancho";
      } else if (normDesc.includes("transicion")) {
        key = "transicion";
      }

      if (key) {
        let elem = elementos && elementos[key] ? { ...elementos[key] } : null;
        if (dimDet && dimDet[key]) {
          elem = elem || {};
          elem.anchoM = elem.anchoM || dimDet[key].anchoM;
          elem.espesorAltoM = elem.espesorAltoM || dimDet[key].espesorM || dimDet[key].espesorAltoM;
          if (dimDet[key].areaSeccionM2) {
            elem.areaSeccionM2 = dimDet[key].areaSeccionM2;
          }
        }
        return elem;
      }
      return null;
    };

    const f1aElem = resolverElementoF1A();

    // 4. Complemento híbrido: una dimensión en descripción y otra en Fase 1A
    if (f1aElem) {
      const eEsp = Number(f1aElem.espesorAltoM || f1aElem.espesorM || 0);
      const eAnc = Number(f1aElem.anchoM || 0);

      if (espesorVal !== null && eAnc > 0) {
        const areaSeccion = +(espesorVal * eAnc).toFixed(4);
        return {
          converted: true,
          areaSeccionM2: areaSeccion,
          espesorM: espesorVal,
          anchoM: eAnc,
          formula: `(e=${espesorVal} m × ancho=${eAnc} m [Fase 1A] → ${areaSeccion} m²)`,
          fuente: "hibrido_desc_fase1a"
        };
      }
      if (anchoVal !== null && eEsp > 0) {
        const areaSeccion = +(eEsp * anchoVal).toFixed(4);
        return {
          converted: true,
          areaSeccionM2: areaSeccion,
          espesorM: eEsp,
          anchoM: anchoVal,
          formula: `(e=${eEsp} m [Fase 1A] × ancho=${anchoVal} m → ${areaSeccion} m²)`,
          fuente: "hibrido_desc_fase1a"
        };
      }
    }

    // 5. Fallback estricto a Fase 1A (Fuente Única de Verdad)
    if (f1aElem) {
      const eEsp = Number(f1aElem.espesorAltoM || f1aElem.espesorM || 0);
      const eAnc = Number(f1aElem.anchoM || 0);
      let area = Number(f1aElem.areaSeccionM2 || 0);
      if (area <= 0 && eEsp > 0 && eAnc > 0) {
        area = +(eEsp * eAnc).toFixed(4);
      }
      if (area > 0) {
        const formStr = (eEsp > 0 && eAnc > 0)
          ? `(Fase 1A: e=${eEsp} m × ancho=${eAnc} m → ${area} m²)`
          : `(Fase 1A: sección = ${area} m²)`;
        return {
          converted: true,
          areaSeccionM2: area,
          espesorM: eEsp,
          anchoM: eAnc,
          formula: formStr,
          fuente: "fase1A"
        };
      }
    }

    // 6. Sin dimensiones en descripción ni en Fase 1A: NO inventar ningún número
    return {
      converted: false,
      areaSeccionM2: 0,
      motivo: "No fue posible convertir a m³ por falta de dimensiones de sección transversal en la descripción del ítem ni en la Fase 1A."
    };
  },

  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }, // 5% de tolerancia por defecto

  /**
   * Inicializa o devuelve el estado de presupuesto para el expediente
   */
  getPresupuestoState(expediente) {
    if (!expediente) return null;
    if (!expediente.fase1C) {
      expediente.fase1C = {
        toleranciaPct: this.toleranciaDefault,
        presupuestoData: {
          aceroKg: 0,
          concretoSimpleM3: 0,
          concretoCiclopeoM3: 0,
          longitudM: expediente.datos ? (expediente.datos.longitudM || 0) : 0,
          valorTotalPresupuesto: expediente.datos ? (expediente.datos.presupuestoTotal || 0) : 0,
          archivoOrigen: null,
          objetoProyecto: "",
          esPlacaHuella: false,
          otroPavimentoDetectado: null
        },
        comparacion: [],
        hallazgos: [],
        aprobado: false,
        evaluado: false
      };
    }
    return expediente.fase1C;
  },

  /**
   * Extrae cantidades de obra desde un archivo Excel (.xlsx / .xls) buscando estrictamente la hoja "PRESUPUESTO"
   */
  async parseExcelBudget(file, f1A = null) {
    if (!f1A && typeof window !== "undefined") {
      const pId = window.selectedProject;
      if (pId) {
        f1A = (window.expedientesMap && window.expedientesMap[pId] && window.expedientesMap[pId].fase1A) ||
              (window.proyectosAuditados && window.proyectosAuditados[pId] && window.proyectosAuditados[pId].fase1A) || null;
      }
    }

    const data = {
      aceroKg: 0,
      concretoSimpleM3: 0,
      concretoCiclopeoM3: 0,
      longitudM: 0,
      cordonBordilloM: 0,
      valorTotalPresupuesto: 0,
      hojaPresupuestoEncontrada: false,
      nombreHojaPresupuesto: "",
      archivoOrigen: file.name,
      objetoProyecto: "",
      esPlacaHuella: false,
      otroPavimentoDetectado: null,
      partidasSinConversion: []
    };

    if (typeof XLSX === "undefined") {
      console.warn("SheetJS (XLSX) no disponible.");
      return data;
    }

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      
      // 1. Búsqueda estricta de la hoja PRESUPUESTO (insensible a mayúsculas/minúsculas y espacios laterales)
      let targetSheetName = workbook.SheetNames.find(s => s.trim().toUpperCase().includes("PRESUPUESTO"));
      if (!targetSheetName) {
        targetSheetName = workbook.SheetNames.find(s => {
          const up = s.trim().toUpperCase();
          return up.includes("PTO") || up.includes("PRESUP");
        });
      }

      if (!targetSheetName) {
        console.warn(`Hoja 'PRESUPUESTO' no encontrada en archivo: ${file.name}. Hojas disponibles:`, workbook.SheetNames);
        data.hojaPresupuestoEncontrada = false;
        return data;
      }

      data.hojaPresupuestoEncontrada = true;
      data.nombreHojaPresupuesto = targetSheetName;
      const sheet = workbook.Sheets[targetSheetName];
      if (!sheet) return data;

      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

      // =========================================================================
      // VALIDACIÓN OBLIGATORIA DE OBJETO "PLACA HUELLA" EN EL PRESUPUESTO
      // =========================================================================
      let extractedTitle = "";
      const labelRegex = /^(?:PROYECTO|OBJETO|NOMBRE\s+DEL\s+PROYECTO|OBRA|TITULO)[\s:\._-]*(.*)$/i;

      // 1. Escanear las primeras 20 filas buscando celda con etiqueta explícita
      for (let rIdx = 0; rIdx < Math.min(rows.length, 20); rIdx++) {
        const r = rows[rIdx];
        if (!Array.isArray(r)) continue;
        for (let cIdx = 0; cIdx < r.length; cIdx++) {
          const cellStr = String(r[cIdx] || "").trim();
          const m = cellStr.match(labelRegex);
          if (m) {
            let val = m[1].trim();
            if (val.length > 5) {
              extractedTitle = val;
              break;
            } else if (cIdx + 1 < r.length) {
              const nextVal = String(r[cIdx + 1] || "").trim();
              if (nextVal.length > 5) {
                extractedTitle = nextVal;
                break;
              }
            }
          }
        }
        if (extractedTitle) break;
      }

      // 2. Si no hubo etiqueta explícita, buscar textos largos explicativos en primeras 10 filas
      if (!extractedTitle) {
        for (let rIdx = 0; rIdx < Math.min(rows.length, 10); rIdx++) {
          const r = rows[rIdx];
          if (!Array.isArray(r)) continue;
          for (let cIdx = 0; cIdx < r.length; cIdx++) {
            const cellStr = String(r[cIdx] || "").trim();
            if (cellStr.length > 20) {
              const normC = cellStr.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
              if (normC.includes("CONSTRUCCION") || normC.includes("MEJORAMIENTO") || normC.includes("PAVIMENT") || normC.includes("VIAS") || normC.includes("PLACA")) {
                extractedTitle = cellStr;
                break;
              }
            }
          }
          if (extractedTitle) break;
        }
      }

      const normTitle = (extractedTitle || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

      // Recopilar el texto completo de las filas para validación global
      let fullSheetText = "";
      rows.forEach(r => {
        if (Array.isArray(r)) {
          fullSheetText += " " + r.map(c => String(c || "")).join(" ");
        }
      });
      const normFullSheet = fullSheetText.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

      let hasPlacaHuella = normTitle.includes("PLACA HUELLA") || normTitle.includes("PLACAHUELLA");
      const forbiddenDetected = [];

      if (normTitle.includes("PAVIMENTO RIGIDO") || normTitle.includes("PAVIMENTO EN CONCRETO RIGIDO")) {
        forbiddenDetected.push("PAVIMENTO RÍGIDO");
      }
      if (normTitle.includes("PAVIMENTO FLEXIBLE") || normTitle.includes("ASFALTO") || normTitle.includes("MEZCLA ASFALTICA") || normTitle.includes("CARPETA ASFALTICA")) {
        forbiddenDetected.push("ASFALTO / PAVIMENTO FLEXIBLE");
      }
      if (normTitle.includes("ADOQUIN") || normTitle.includes("PAVIMENTO ARTICULADO")) {
        forbiddenDetected.push("ADOQUÍN");
      }

      if (!hasPlacaHuella) {
        if (normFullSheet.includes("PLACA HUELLA") || normFullSheet.includes("PLACAHUELLA")) {
          if (forbiddenDetected.length === 0) {
            hasPlacaHuella = true;
          }
        } else {
          if (normFullSheet.includes("PAVIMENTO RIGIDO") && !forbiddenDetected.includes("PAVIMENTO RÍGIDO")) {
            forbiddenDetected.push("PAVIMENTO RÍGIDO");
          }
          if ((normFullSheet.includes("ASFALTO") || normFullSheet.includes("CARPETA ASFALTICA") || normFullSheet.includes("PAVIMENTO FLEXIBLE")) && !forbiddenDetected.includes("ASFALTO / PAVIMENTO FLEXIBLE")) {
            forbiddenDetected.push("ASFALTO / PAVIMENTO FLEXIBLE");
          }
          if ((normFullSheet.includes("ADOQUIN") || normFullSheet.includes("PAVIMENTO ARTICULADO")) && !forbiddenDetected.includes("ADOQUÍN")) {
            forbiddenDetected.push("ADOQUÍN");
          }
        }
      }

      data.objetoProyecto = extractedTitle || "Proyecto de Obras Viales";
      data.esPlacaHuella = hasPlacaHuella && (forbiddenDetected.length === 0 || normTitle.includes("PLACA HUELLA") || normTitle.includes("PLACAHUELLA"));
      data.otroPavimentoDetectado = forbiddenDetected.length > 0 && !data.esPlacaHuella ? forbiddenDetected.join(", ") : null;

      const itemsPresupuesto = [];
      const partidasConc21 = [];
      const partidasCiclopeo = [];
      const partidasSinConversion = [];
      let totalSteelKg = 0;
      let totalConc21M3 = 0;
      let totalCicM3 = 0;
      let totalCunetaM = 0;
      let totalCunetaM3 = 0;
      let totalLongM = 0;
      let totalPtoVal = 0;

      rows.forEach((row, rIdx) => {
        if (!Array.isArray(row) || row.length === 0) return;
        const rowText = row.map(c => String(c || "")).join(" ").toLowerCase();

        // 1. Buscar si esta fila representa una partida con unidad de medida
        let foundUnit = null;
        let unitCol = -1;
        for (let cIdx = 0; cIdx < row.length; cIdx++) {
          const valStr = String(row[cIdx] || "").trim().toLowerCase();
          if (["kg", "kilos", "ton", "m3", "m³", "m", "ml", "m2", "m²", "und", "gl"].includes(valStr)) {
            foundUnit = valStr;
            unitCol = cIdx;
            break;
          }
        }

        if (foundUnit && unitCol >= 0) {
          // Extraer número o código de ítem
          let itemNum = "";
          for (let cIdx = 0; cIdx < Math.min(unitCol, 4); cIdx++) {
            const v = String(row[cIdx] || "").trim();
            if (v && (/^[0-9]+(\.[0-9]+)*$/.test(v) || /^[A-Z0-9\.\,\-]+$/i.test(v)) && v.length <= 12) {
              itemNum = v;
            }
          }

          // Extraer descripción (texto más largo antes de la columna de unidad)
          let desc = "";
          for (let cIdx = 0; cIdx < unitCol; cIdx++) {
            const v = String(row[cIdx] || "").trim();
            if (v.length > desc.length && !/^[0-9\.\,\-]+$/.test(v)) {
              desc = v;
            }
          }

          // Extraer cantidad
          let cant = 0;
          for (let cIdx = unitCol + 1; cIdx < Math.min(row.length, unitCol + 4); cIdx++) {
            const val = row[cIdx];
            const num = (typeof val === "number") ? val : parseFloat(String(val || "").replace(/\./g, "").replace(",", "."));
            if (!isNaN(num) && num > 0) {
              cant = num;
              break;
            }
          }

          const normDesc = desc.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          let categoria = "otro";

          // A. Acero de refuerzo
          if ((normDesc.includes("acero") || normDesc.includes("refuerzo") || normDesc.includes("figurado") || normDesc.includes("malla") || normDesc.includes("varilla")) &&
              !normDesc.includes("concreto") &&
              (foundUnit.includes("kg") || foundUnit.includes("kilo") || foundUnit === "ton")) {
            const kgCant = foundUnit === "ton" ? cant * 1000 : cant;
            totalSteelKg += kgCant;
            categoria = "acero";
          }
          // B. Localización, Trazado, Topografía de Ejes y Replanteo
          else if ((normDesc.includes("replanteo") || normDesc.includes("localizacion") || normDesc.includes("topograf") || 
                    normDesc.includes("trazado") || normDesc.includes("ejes") || normDesc.includes("demarcacion")) &&
                   (foundUnit === "m" || foundUnit === "ml")) {
            totalLongM = Math.max(totalLongM, Math.round(cant));
            categoria = "replanteo_longitud";
          }
          // C. Evaluación Estricta de Concreto (Reglas 1, 2 y 3)
          else {
            const clasif = this.clasificarPartidaConcreto(desc);

            if (clasif.esConcreto) {
              if (clasif.tipo === "ciclopeo") {
                if (foundUnit === "m3" || foundUnit === "m³" || foundUnit === "m2" || foundUnit === "m²") {
                  totalCicM3 += cant;
                  categoria = "concreto_ciclopeo";
                  partidasCiclopeo.push({
                    itemNum: itemNum || `Fila ${rIdx + 1}`,
                    desc: desc,
                    cantOrig: cant,
                    unitOrig: foundUnit,
                    cantM3: cant,
                    isLinearConv: false
                  });
                }
              } else if (clasif.tipo === "simple_21") {
                // Cunetas, bordillos u otras partidas de concreto simple expresadas en unidades lineales (m o ml)
                if (foundUnit === "m" || foundUnit === "ml") {
                  if (normDesc.includes("cuneta") || normDesc.includes("bordillo") || normDesc.includes("cordon") || normDesc.includes("berma")) {
                    totalCunetaM += cant;
                  }

                  // Extracción Dinámica de Dimensiones: Prohibido valor quemado de 0.063 m²
                  const dimRes = this.extraerDimensionesItem(desc, f1A);
                  if (dimRes.converted) {
                    const m3Conv = +(cant * dimRes.areaSeccionM2).toFixed(2);
                    totalConc21M3 += m3Conv;
                    categoria = "concreto_21";
                    partidasConc21.push({
                      itemNum: itemNum || `Fila ${rIdx + 1}`,
                      desc: desc,
                      cantOrig: cant,
                      unitOrig: foundUnit,
                      cantM3: m3Conv,
                      isLinearConv: true,
                      formulaDimensiones: dimRes.formula,
                      areaSeccionM2: dimRes.areaSeccionM2,
                      fuenteDimensiones: dimRes.fuente
                    });
                  } else {
                    categoria = "concreto_21_lineal_sin_conversion";
                    const sinConvItem = {
                      itemNum: itemNum || `Fila ${rIdx + 1}`,
                      desc: desc,
                      cantOrig: cant,
                      unitOrig: foundUnit,
                      cantM3: 0,
                      isLinearConv: true,
                      sinConversion: true,
                      motivoSinConversion: dimRes.motivo || "No fue posible convertir a m³ por falta de dimensiones de sección transversal en la descripción del ítem ni en la Fase 1A."
                    };
                    partidasConc21.push(sinConvItem);
                    partidasSinConversion.push(sinConvItem);
                  }
                } else if (foundUnit === "m3" || foundUnit === "m³") {
                  totalConc21M3 += cant;
                  categoria = "concreto_21";
                  if (normDesc.includes("cuneta") || normDesc.includes("bordillo")) {
                    totalCunetaM3 += cant;
                  }
                  partidasConc21.push({
                    itemNum: itemNum || `Fila ${rIdx + 1}`,
                    desc: desc,
                    cantOrig: cant,
                    unitOrig: foundUnit,
                    cantM3: cant,
                    isLinearConv: false
                  });
                }
              }
            } else if (normDesc.includes("cuneta") || normDesc.includes("bordillo") || normDesc.includes("cordon") || normDesc.includes("berma")) {
              if (foundUnit === "m" || foundUnit === "ml") {
                totalCunetaM += cant;
              }
              categoria = "cuneta_bordillo";
            }
          }

          itemsPresupuesto.push({
            fila: rIdx + 1,
            numItem: itemNum || `Ítem ${itemsPresupuesto.length + 1}`,
            descripcion: desc || "Actividad constructiva",
            unidad: foundUnit,
            cantidad: Math.round(cant * 100) / 100,
            categoria: categoria
          });
        }

        // Respaldo por búsqueda de candidatos numéricos
        const nums = row.filter(c => typeof c === "number" || (!isNaN(parseFloat(c)) && isFinite(c)))
                        .map(c => parseFloat(c));

        if (totalSteelKg === 0 && (rowText.includes("acero") || rowText.includes("refuerzo") || rowText.includes("figurado")) &&
            (rowText.includes("kg") || rowText.includes("kilo") || rowText.includes("60000") || rowText.includes("420") || rowText.includes("fy"))) {
          const kgCandidate = nums.find(n => n >= 50 && n <= 100000);
          if (kgCandidate) totalSteelKg = kgCandidate;
        }

        const normRowText = rowText.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const rowClasif = this.clasificarPartidaConcreto(normRowText);

        if (totalConc21M3 === 0 && rowClasif.esConcreto && rowClasif.tipo === "simple_21") {
          const m3Candidate = nums.find(n => n >= 2 && n <= 5000);
          if (m3Candidate) totalConc21M3 = m3Candidate;
        }

        if (totalCicM3 === 0 && rowClasif.esConcreto && rowClasif.tipo === "ciclopeo") {
          const cicCandidate = nums.find(n => n >= 2 && n <= 5000);
          if (cicCandidate) totalCicM3 = cicCandidate;
        }

        if (totalLongM === 0 && (rowText.includes("replanteo") || rowText.includes("longitud") || rowText.includes("demarcacion") || rowText.includes("pavimento"))) {
          const mCandidate = nums.find(n => n >= 20 && n <= 10000);
          if (mCandidate) totalLongM = Math.round(mCandidate);
        }

        if (totalCunetaM === 0 && (rowText.includes("cordon") || rowText.includes("cordón") || rowText.includes("bordillo") || rowText.includes("berma") || rowText.includes("cuneta")) && !rowText.includes("excavac")) {
          const borCandidate = nums.find(n => n >= 10 && n <= 10000);
          if (borCandidate) totalCunetaM = borCandidate;
        }

        if (totalPtoVal === 0 && (rowText.includes("costo directo") || rowText.includes("total presupuesto") || rowText.includes("gran total") || rowText.includes("valor total"))) {
          const totCandidate = nums.find(n => n >= 5000000);
          if (totCandidate) totalPtoVal = totCandidate;
        }
      });

      // Respaldo de longitud de proyecto desde encabezado o cunetas divididas en 2 laterales
      if (totalLongM === 0) {
        const mTitleLen = normTitle.match(/(?:LONGITUD|DISTANCIA|TRAMO|ALCANCE|META)?[\s:\._-]*(\d+(?:[\.,]\d+)?)\s*(?:METROS|MTS|M|ML)/i);
        if (mTitleLen) {
          const num = parseFloat(mTitleLen[1].replace(",", "."));
          if (!isNaN(num) && num >= 10 && num <= 50000) totalLongM = Math.round(num);
        }
      }
      if (totalLongM === 0 && totalCunetaM > 0) {
        totalLongM = Math.round(totalCunetaM / 2.0);
      }

      // Detalle desglosado de ítems y cantidades sumadas por clase de concreto
      const formatDetalle = (partidas, totalVal) => {
        if (!partidas || partidas.length === 0) return "";
        if (partidas.length === 1) {
          const p = partidas[0];
          const itLbl = p.itemNum ? (/^(ítem|item)/i.test(p.itemNum) ? p.itemNum : `Ítem ${p.itemNum}`) : p.desc;
          if (p.isLinearConv) {
            if (p.sinConversion) {
              return `${itLbl} (${p.cantOrig.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${p.unitOrig} - No convertido a m³ por falta de sección)`;
            }
            const formStr = p.formulaDimensiones || `sección ${p.areaSeccionM2 || 0} m²`;
            return `${itLbl}: ${p.cantOrig.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} m × ${formStr} = ${totalVal.toLocaleString('es-CO', { minimumFractionDigits: 2 })} m³`;
          }
          return `${itLbl} (${p.cantM3.toLocaleString('es-CO', { minimumFractionDigits: 2 })} m³) = ${totalVal.toLocaleString('es-CO', { minimumFractionDigits: 2 })} m³`;
        }
        const partes = partidas.map(p => {
          const itLbl = p.itemNum ? (/^(ítem|item)/i.test(p.itemNum) ? p.itemNum : `Ítem ${p.itemNum}`) : (p.desc.length > 20 ? p.desc.substring(0, 18) + '...' : p.desc);
          if (p.isLinearConv) {
            if (p.sinConversion) {
              return `${itLbl} (${p.cantOrig.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${p.unitOrig} [Sin sección])`;
            }
            const formStr = p.formulaDimensiones || `sección ${p.areaSeccionM2 || 0} m²`;
            return `${itLbl} (${p.cantOrig.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} m × ${formStr} = ${p.cantM3.toLocaleString('es-CO', { minimumFractionDigits: 2 })} m³)`;
          }
          return `${itLbl} (${p.cantM3.toLocaleString('es-CO', { minimumFractionDigits: 2 })} m³)`;
        });
        return `Suma de: ${partes.join(" + ")} = ${totalVal.toLocaleString('es-CO', { minimumFractionDigits: 2 })} m³`;
      };

      const finalConcSimple = Math.round(totalConc21M3 * 100) / 100;
      const finalConcCic = Math.round(totalCicM3 * 100) / 100;

      data.aceroKg = Math.round(totalSteelKg * 100) / 100;
      data.concretoSimpleM3 = finalConcSimple;
      data.concretoCiclopeoM3 = finalConcCic;
      data.detalleSumaConcretoSimple = formatDetalle(partidasConc21, finalConcSimple);
      data.detalleSumaConcretoCiclopeo = formatDetalle(partidasCiclopeo, finalConcCic);
      data.partidasConcretoSimple = partidasConc21;
      data.partidasConcretoCiclopeo = partidasCiclopeo;
      data.partidasSinConversion = partidasSinConversion;
      data.longitudM = totalLongM;
      data.cordonBordilloM = Math.round(totalCunetaM * 100) / 100;
      data.cunetaM3 = Math.round(totalCunetaM3 * 100) / 100;
      data.valorTotalPresupuesto = totalPtoVal;
      data.itemsPresupuesto = itemsPresupuesto;
    } catch (e) {
      console.warn("Error analizando presupuesto Excel:", e);
    }

    return data;
  },

  /**
   * Extrae cantidades de obra desde un archivo PDF
   */
  async parsePdfBudget(file) {
    const data = {
      aceroKg: 0,
      concretoSimpleM3: 0,
      concretoCiclopeoM3: 0,
      longitudM: 0,
      valorTotalPresupuesto: 0,
      archivoOrigen: file.name,
      objetoProyecto: "",
      esPlacaHuella: false,
      otroPavimentoDetectado: null
    };

    if (typeof pdfjsLib === "undefined") return data;

    try {
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      let fullText = "";

      for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(it => it.str).join(" ");
        fullText += " " + pageText;
      }

      // Regex para acero
      const aceroMatch = fullText.match(/(?:acero(?:.*?)(?:kg|kilos)[\s\:\-]+|acero[\s\w\(\)]*?)([\d\.\,]{2,10})\s*(?:kg|kilos)/i);
      if (aceroMatch) {
        const val = parseFloat(aceroMatch[1].replace(/\./g, "").replace(",", "."));
        if (!isNaN(val) && val > 0) data.aceroKg = val;
      }

      // Regex para concreto 21 MPa / simple
      const concMatch = fullText.match(/(?:concreto(?:.*?)21\s*mpa[\s\w]*?)([\d\.\,]{2,8})\s*(?:m3|m³)/i);
      if (concMatch) {
        const val = parseFloat(concMatch[1].replace(/\./g, "").replace(",", "."));
        if (!isNaN(val) && val > 0) data.concretoSimpleM3 = val;
      }

      // Regex para concreto ciclópeo
      const cicMatch = fullText.match(/(?:cicl[oó]peo[\s\w]*?)([\d\.\,]{2,8})\s*(?:m3|m³)/i);
      if (cicMatch) {
        const val = parseFloat(cicMatch[1].replace(/\./g, "").replace(",", "."));
        if (!isNaN(val) && val > 0) data.concretoCiclopeoM3 = val;
      }

      // Detección de objeto Placa Huella en PDF
      const normPdf = fullText.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      let extractedTitle = "";
      const pdfTitleMatch = fullText.match(/(?:PROYECTO|OBJETO|OBRA)[\s:\._-]*([^\r\n]{10,120})/i);
      if (pdfTitleMatch) {
        extractedTitle = pdfTitleMatch[1].trim();
      }
      const normPdfTitle = (extractedTitle || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      let hasPlacaHuella = normPdfTitle.includes("PLACA HUELLA") || normPdfTitle.includes("PLACAHUELLA") || normPdf.includes("PLACA HUELLA") || normPdf.includes("PLACAHUELLA");
      const forbiddenDetected = [];
      if (normPdf.includes("PAVIMENTO RIGIDO") && !hasPlacaHuella) forbiddenDetected.push("PAVIMENTO RÍGIDO");
      if ((normPdf.includes("ASFALTO") || normPdf.includes("CARPETA ASFALTICA") || normPdf.includes("PAVIMENTO FLEXIBLE")) && !hasPlacaHuella) forbiddenDetected.push("ASFALTO / PAVIMENTO FLEXIBLE");
      if ((normPdf.includes("ADOQUIN") || normPdf.includes("PAVIMENTO ARTICULADO")) && !hasPlacaHuella) forbiddenDetected.push("ADOQUÍN");

      data.objetoProyecto = extractedTitle || "Proyecto de Obras Viales";
      data.esPlacaHuella = hasPlacaHuella && forbiddenDetected.length === 0;
      data.otroPavimentoDetectado = forbiddenDetected.length > 0 && !data.esPlacaHuella ? forbiddenDetected.join(", ") : null;
    } catch (e) {
      console.warn("Error leyendo presupuesto PDF:", e);
    }

    return data;
  },

  /**
   * Realiza la auditoría de coherencia tripartita entre Fase 1A, Especificaciones y Presupuesto
   */
  auditarCoherencia(expediente, presupuestoData, toleranciaOverride) {
    const state = this.getPresupuestoState(expediente);
    const tol = toleranciaOverride !== undefined ? toleranciaOverride : (state.toleranciaPct || this.toleranciaDefault);
    state.toleranciaPct = tol;

    if (presupuestoData) {
      state.presupuestoData = { ...state.presupuestoData, ...presupuestoData };
    }
    const pData = state.presupuestoData;

    // =========================================================================
    // ÚNICA FUENTE DE VERDAD (Single Source of Truth) conectada a expedientesMap[proyectoId].fase1A
    // =========================================================================
    const f1A = (expediente && expediente.fase1A) || (expediente && expediente.auditGlobal && expediente.auditGlobal.audit1A) || {};
    const acero1A = (f1A.acero && f1A.acero.pesoTotalKg !== undefined) 
      ? f1A.acero.pesoTotalKg 
      : (f1A.pesoTotalDeclaradoKg || f1A.pesoTotalCalculadoKg || (expediente.despieceExtraido && expediente.despieceExtraido.pesoTotalDeclaradoKg) || 0);

    const conc21_1A = (f1A.concreto && f1A.concreto.totalConcreto21M3 !== undefined)
      ? f1A.concreto.totalConcreto21M3
      : ((f1A.concretoVolumes && f1A.concretoVolumes.totalConcreto21M3) || 0);

    const concCic_1A = (f1A.concreto && f1A.concreto.totalConcretoCiclopeoM3 !== undefined)
      ? f1A.concreto.totalConcretoCiclopeoM3
      : ((f1A.concretoVolumes && f1A.concretoVolumes.totalConcretoCiclopeoM3) || 0);

    const geomLongM = (f1A.longitudIntervencionM !== undefined)
      ? f1A.longitudIntervencionM
      : (expediente.datos ? (expediente.datos.longitudM || 0) : 0);

    const cuantia1A = (f1A.cuantiaRealKgM !== undefined)
      ? f1A.cuantiaRealKgM
      : (geomLongM > 0 ? +(acero1A / geomLongM).toFixed(2) : "26.25");

    const elem1A = (f1A.concreto && f1A.concreto.elementos) || (f1A.concretoVolumes && f1A.concretoVolumes.elementos) || {};

    // Valores reales del Presupuesto
    pData.aceroKg = Number(pData.aceroKg) || 0;
    pData.concretoSimpleM3 = Number(pData.concretoSimpleM3) || 0;
    pData.concretoCiclopeoM3 = Number(pData.concretoCiclopeoM3) || 0;
    pData.longitudM = Number(pData.longitudM) || 0;

    // =========================================================================
    // COMPARACIÓN DE TOTALES PRINCIPALES (Fase 1A vs. Presupuesto)
    // Incluye Longitud Total de Placa Huella (m), Acero de Refuerzo y Concretos
    // =========================================================================
    const longDespiece = (f1A.longitudTramo !== undefined && f1A.longitudTramo > 0)
      ? f1A.longitudTramo
      : ((f1A.longitudIntervencionM !== undefined && f1A.longitudIntervencionM > 0)
          ? f1A.longitudIntervencionM
          : ((expediente.datos && expediente.datos.longitudM) || 0));

    const longPresupuesto = Number(pData.longitudM) || 0;

    const comparacion = [
      {
        id: "longitud_placa_huella",
        item: "Longitud / Distancia de Placa Huella (m)",
        unidad: "m",
        cantDespiece: longDespiece,
        especificaciones: `Longitud proyectada según Despiece y Especificaciones Técnicas`,
        cantPresupuesto: longPresupuesto,
        destacado: true
      },
      {
        id: "acero_refuerzo",
        item: "Acero de Refuerzo Total (kg)",
        unidad: "kg",
        cantDespiece: acero1A,
        especificaciones: `Cuantía: ${cuantia1A} kg/m (mín. 26.25 kg/m) | fy=420 MPa (60.000 PSI)`,
        cantPresupuesto: pData.aceroKg
      },
      {
        id: "concreto_simple",
        item: "Concreto Simple 21 MPa Total (m³)",
        unidad: "m³",
        cantDespiece: conc21_1A,
        especificaciones: `f'c=21 MPa (3000 PSI) | Rieles, Riostras, Cunetas, Sobreancho y Transición`,
        cantPresupuesto: pData.concretoSimpleM3,
        detallePresupuesto: pData.detalleSumaConcretoSimple || ""
      },
      {
        id: "concreto_ciclopeo",
        item: "Concreto Ciclópeo Total (m³)",
        unidad: "m³",
        cantDespiece: concCic_1A,
        especificaciones: `f'c=21 MPa con piedra pegada | Franja Central Entrerriel`,
        cantPresupuesto: pData.concretoCiclopeoM3,
        detallePresupuesto: pData.detalleSumaConcretoCiclopeo || ""
      }
    ];

    const hallazgos = [];
    let todosCoherentes = true;

    if (pData.hojaPresupuestoEncontrada === false) {
      todosCoherentes = false;
      hallazgos.push({
        id: "hoja_presupuesto_faltante",
        item: "Hoja 'PRESUPUESTO'",
        delta: 0,
        pct: 100,
        motivo: "El archivo de presupuesto aportado no contiene la hoja obligatoria 'PRESUPUESTO'. No se pueden contrastar las cantidades oficiales."
      });
    }

    // Validación obligatoria de objeto "Placa Huella"
    if (pData.archivoOrigen && pData.hojaPresupuestoEncontrada !== false) {
      if (pData.esPlacaHuella === false) {
        todosCoherentes = false;
        const textoLeido = pData.objetoProyecto || "No identificado o sin mención a Placa Huella";
        const extraPav = pData.otroPavimentoDetectado ? ` (Se detectó tipología no admisible: ${pData.otroPavimentoDetectado})` : "";
        const motivoObj = `El presupuesto aportado no corresponde a un proyecto de Placa Huella (en el encabezado del presupuesto se registra: '${textoLeido}'${extraPav}). Debe ajustarse al objeto de Placa Huella.`;
        hallazgos.unshift({
          id: "objeto_no_placa_huella",
          item: "Objeto del Proyecto en Presupuesto",
          delta: 0,
          pct: 100,
          critico: true,
          motivo: motivoObj
        });
      }
    }

    comparacion.forEach(c => {
      const vDesp = Number(c.cantDespiece) || 0;
      const vPres = Number(c.cantPresupuesto) || 0;
      const delta = vPres - vDesp;
      const pct = vDesp > 0 ? (Math.abs(delta) / vDesp) * 100 : (vPres > 0 ? 100 : 0);
      const esCoherente = pct <= tol;

      c.delta = +delta.toFixed(2);
      c.pct = +pct.toFixed(2);
      c.coherente = esCoherente;

      if (!esCoherente) {
        todosCoherentes = false;
        const msg = c.id === "longitud_placa_huella"
          ? `Discrepancia de Longitud de Placa Huella: Presupuesto registra ${vPres.toLocaleString('es-CO')} m vs. ${vDesp.toLocaleString('es-CO')} m en Despiece (Diferencia: ${delta > 0 ? '+' : ''}${c.delta.toLocaleString('es-CO')} m, ${c.pct}% > tolerancia ±${tol}%).`
          : `Discrepancia en ${c.item}: Presupuesto registra ${vPres.toLocaleString('es-CO')} ${c.unidad} vs. ${vDesp.toLocaleString('es-CO')} ${c.unidad} en Despiece/Memoria (Diferencia: ${delta > 0 ? '+' : ''}${c.delta.toLocaleString('es-CO')} ${c.unidad}, ${c.pct}% > tolerancia ±${tol}%).`;
        hallazgos.push({
          id: `hallazgo_presupuesto_${c.id}`,
          item: c.item,
          delta: c.delta,
          pct: c.pct,
          cantPresupuesto: vPres,
          cantDespiece: vDesp,
          unidad: c.unidad,
          motivo: msg
        });
      }
    });

    // Alerta de partidas lineales de concreto sin dimensiones de sección transversal
    if (pData.partidasSinConversion && pData.partidasSinConversion.length > 0) {
      todosCoherentes = false;
      pData.partidasSinConversion.forEach(sc => {
        const itLbl = sc.itemNum ? (/^(ítem|item)/i.test(sc.itemNum) ? sc.itemNum : `Ítem ${sc.itemNum}`) : sc.desc;
        hallazgos.push({
          id: `hallazgo_sin_conversion_${sc.itemNum || 'lineal'}`,
          item: `Conversión de ${itLbl} a m³`,
          delta: 0,
          pct: 0,
          motivo: `El ítem ${itLbl} ("${sc.desc}") viene expresado en ${sc.cantOrig.toLocaleString('es-CO')} ${sc.unitOrig}. No fue posible convertir a m³ por falta de dimensiones de sección transversal en la descripción del ítem ni en la Fase 1A. No se incluye en la sumatoria de m³ de concreto.`
        });
      });
    }

    state.comparacion = comparacion;
    state.desgloseComponentes = [];
    state.hallazgos = hallazgos;
    state.aprobado = todosCoherentes;
    state.evaluado = true;

    // Actualizar compuerta global del expediente si existe auditGlobal
    if (expediente.auditGlobal && expediente.modalidad === "RECURSOS") {
      const a1A = expediente.fase1A ? expediente.fase1A.aprobado : true;
      const a1B = expediente.fase1B ? expediente.fase1B.aprobado : true;
      const a2 = expediente.fase2 ? expediente.fase2.aprobado : true;
      const a1C = todosCoherentes;

      expediente.auditGlobal.isApproved = a1A && a1B && a2 && a1C;
      if (!a1A) {
        expediente.auditGlobal.activeGatekeeper = "1A_DISENO";
      } else if (!a1B) {
        expediente.auditGlobal.activeGatekeeper = "1B_ESPACIAL";
      } else if (!a1C) {
        expediente.auditGlobal.activeGatekeeper = "1C_PRESUPUESTO";
      } else if (!a2) {
        expediente.auditGlobal.activeGatekeeper = "2_DOCUMENTAL";
      } else {
        expediente.auditGlobal.activeGatekeeper = "3_APROBADO";
      }
    }

    // Sincronizar en Fase 3 bajo claves estables
    if (expediente.fase3 && expediente.modalidad === "RECURSOS") {
      const fid = "FASE_1C_PTO";
      const fidLegacy = "fase_1c_presupuesto";
      if (!todosCoherentes) {
        const descMsg = hallazgos.map(h => h.motivo).join(" ");
        const itemObj = {
          estado: "No Aceptado / Por Subsanar",
          motivo: descMsg
        };
        expediente.fase3.observacionesEditadas = expediente.fase3.observacionesEditadas || {};
        expediente.fase3.observacionesEditadas[fid] = itemObj;
        expediente.fase3.observacionesEditadas[fidLegacy] = itemObj;
        if (expediente.fase3.matrizObservaciones) {
          expediente.fase3.matrizObservaciones[fid] = itemObj;
          expediente.fase3.matrizObservaciones[fidLegacy] = itemObj;
        }
      } else {
        const cleanMsg = (obj) => {
          if (!obj) return;
          delete obj[fid];
          delete obj[fidLegacy];
        };
        cleanMsg(expediente.fase3.observacionesEditadas);
        cleanMsg(expediente.fase3.matrizObservaciones);
      }

      // Si se aportó documento físico de presupuesto, limpiar cualquier alerta de "Presupuesto faltante" en Ítem 28
      if (pData.archivoOrigen) {
        ["doc_item_28", "FASE_2_ITEM_28", "item_28"].forEach(k => {
          if (expediente.fase3.observacionesEditadas) delete expediente.fase3.observacionesEditadas[k];
          if (expediente.fase3.matrizObservaciones) delete expediente.fase3.matrizObservaciones[k];
        });
      }
    }

    return state;
  },

  async reprocessBudgetFile(file, projectId) {
    const expedientesMap = (window.SIPRO_DATA && SIPRO_DATA.expedientesMap) || window.proyectosAuditados || {};
    let exp = expedientesMap[projectId];
    if (!exp) {
      exp = Object.values(expedientesMap).find(r => r.id === projectId || r.slug === projectId || (r.datos && r.datos.id === projectId));
    }
    if (!exp && window.App && window.App.currentAuditRecord) {
      exp = window.App.currentAuditRecord;
    }
    if (!exp) return null;

    // 1. Asegurar referencias del archivo físico al Ítem 28
    const numId = 28;
    exp.archivosFileMap = exp.archivosFileMap || {};
    exp.archivosFileMap[numId] = file;
    exp.archivosFileMap[String(numId)] = file;
    exp.archivos = exp.archivos || [];
    if (!exp.archivos.includes(file)) exp.archivos.push(file);

    if (exp.datos) {
      exp.datos.archivosFiles = exp.datos.archivosFiles || {};
      exp.datos.archivosFiles[numId] = file;
      exp.datos.archivosFiles[String(numId)] = file;
      exp.datos.documentosStatus = exp.datos.documentosStatus || { archivosDetectados: {} };
      exp.datos.documentosStatus.archivosDetectados[numId] = file.name;
      exp.datos.documentosStatus.archivosDetectados[String(numId)] = file.name;
      exp.datos.archivosMetadata = exp.datos.archivosMetadata || {};
      exp.datos.archivosMetadata[numId] = {
        fileName: file.name,
        sizeBytes: file.size,
        lastModified: file.lastModified,
        textSnippet: `Documento de presupuesto aportado: ${file.name}`
      };
      exp.datos.archivosMetadata[String(numId)] = exp.datos.archivosMetadata[numId];
    }

    // 2. Extraer cantidades de obra desde el archivo (.xlsx, .xlsm, .xls, .xlsb o .pdf)
    let pData = null;
    const lower = file.name.toLowerCase();
    if (/\.(xlsx|xlsm|xls|xlsb|ods)$/i.test(lower)) {
      pData = await this.parseExcelBudget(file, exp?.fase1A);
    } else if (lower.endsWith(".pdf")) {
      pData = await this.parsePdfBudget(file);
    } else {
      pData = { archivoOrigen: file.name };
    }

    if (pData) {
      pData.archivoOrigen = file.name;
    }

    // 3. Ejecutar comparación tripartita contra Fase 1A
    const state = this.auditarCoherencia(exp, pData);
    exp.fase1C = state;
    if (expedientesMap[projectId]) {
      expedientesMap[projectId].fase1C = state;
    }
    if (window.proyectosAuditados && window.proyectosAuditados[projectId]) {
      window.proyectosAuditados[projectId].fase1C = state;
    }

    // 4. Redibujar contenedor de Fase 1C si existe en el DOM
    const container1C = document.getElementById("presupuestoAuditContainer");
    if (container1C) {
      this.renderPresupuestoTab(exp, container1C);
    }

    if (window.App && typeof App.updateKpis === "function") {
      App.updateKpis();
    }

    return state;
  },

  /**
   * Actualiza un valor puntual del presupuesto editado por el usuario
   */
  updateValue(key, val, projectId) {
    const exp = (window.proyectosAuditados && window.proyectosAuditados[projectId]) ||
                (window.SIPRO_DATA && SIPRO_DATA.expedientesMap && SIPRO_DATA.expedientesMap[projectId]);
    if (!exp) return;

    const state = this.getPresupuestoState(exp);
    const num = parseFloat(val);
    state.presupuestoData[key] = isNaN(num) ? 0 : num;

    this.auditarCoherencia(exp, state.presupuestoData);
    this.renderPresupuestoTab(exp, document.getElementById("presupuestoAuditContainer"));
    if (window.App && typeof App.updateKpis === "function") {
      App.updateKpis();
    }
  },

  /**
   * Cambia la tolerancia porcentual (ej. 3%, 5%, 10%)
   */
  setTolerancia(tol, projectId) {
    const exp = (window.proyectosAuditados && window.proyectosAuditados[projectId]) ||
                (window.SIPRO_DATA && SIPRO_DATA.expedientesMap && SIPRO_DATA.expedientesMap[projectId]);
    if (!exp) return;

    this.auditarCoherencia(exp, null, tol);
    this.renderPresupuestoTab(exp, document.getElementById("presupuestoAuditContainer"));
    if (window.App && typeof App.updateKpis === "function") {
      App.updateKpis();
    }
  },

  /**
   * Renderiza la vista completa de la Fase 1C
   */
  renderPresupuestoTab(expediente, container) {
    if (!container) return;

    if (!expediente) {
      container.innerHTML = `
        <div style="text-align:center;padding:48px;color:var(--text-muted)">
          <div style="font-size:16px;font-weight:700;color:var(--text-main);margin-bottom:6px;">Fase 1C: Coherencia Presupuesto vs. Despiece y Especificaciones</div>
          <div>Cargue un expediente municipal configurado en modalidad <b>RECURSOS</b> para auditar el cruce presupuestal.</div>
        </div>
      `;
      return;
    }

    if (expediente.modalidad !== "RECURSOS") {
      container.innerHTML = `
        <div style="background:var(--color-bg-card);border:1px solid var(--border-subtle);border-radius:16px;padding:32px;text-align:center;max-width:700px;margin:24px auto;">
          <div style="font-size:36px;margin-bottom:12px;">🧱</div>
          <h3 style="font-size:16px;font-weight:800;color:var(--color-primary);margin-bottom:8px;">Proyecto en Modalidad "MATERIALES"</h3>
          <p style="font-size:13px;color:var(--text-muted);line-height:1.6;margin-bottom:18px;">
            Este expediente se encuentra auditado bajo la modalidad estándar de cofinanciación en <b>MATERIALES</b> (cemento y acero), la cual no exige presupuesto de obra civil detallado ni compuerta 1C.
          </p>
          <button class="btn-primary" style="background:#D97706;border-color:#D97706;" onclick="App.setProjectModalidad('RECURSOS')">
            💰 Conmutar este Expediente a Modalidad RECURSOS
          </button>
        </div>
      `;
      return;
    }

    const state = this.getPresupuestoState(expediente);
    if (!state.evaluado) {
      this.auditarCoherencia(expediente);
    }

    const tol = state.toleranciaPct || 5;
    const isOk = state.aprobado;
    const pData = state.presupuestoData || {};
    const comp = state.comparacion || [];

    const html = `
      <div style="display:flex;flex-direction:column;gap:20px;">
        
        <!-- ENCABEZADO DE FASE 1C -->
        <div style="background:var(--color-bg-card);border:1px solid var(--border-subtle);border-radius:16px;padding:20px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;box-shadow:var(--shadow-sm);">
          <div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;flex-wrap:wrap;">
              <span class="badge-modalidad" style="background:rgba(217,119,6,0.15);color:#D97706;border:1px solid rgba(217,119,6,0.3);font-size:11px;font-weight:800;padding:2px 10px;border-radius:999px;">
                💰 MODALIDAD RECURSOS ACTIVA
              </span>
              <span class="status-pill ${isOk ? 'cumple' : 'no-cumple'}" style="font-size:11.5px;">
                ${isOk ? '✓ Presupuesto Coherente' : `⚠️ ${state.hallazgos.length} Discrepancia(s) Presupuestales`}
              </span>
            </div>
            <h3 style="font-size:17px;font-weight:800;color:var(--color-primary);margin:0 0 4px 0;">
              Fase 1C: Coherencia Presupuesto vs. Despiece y Especificaciones Técnicas
            </h3>
            <p style="font-size:12px;color:var(--text-muted);margin:0;line-height:1.4;">
              Auditoría técnica cruzada entre los cálculos estructurales de la Gobernación (Fase 1A) y las cantidades de obra extraídas de la hoja <b>PRESUPUESTO</b>.
            </p>
          </div>

          <!-- SELECTOR DE TOLERANCIA DEPARTAMENTAL -->
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <div style="background:var(--color-bg-alt);padding:6px 14px;border-radius:999px;border:1px solid var(--border-subtle);display:flex;align-items:center;gap:8px;">
              <span style="font-size:11px;font-weight:700;color:var(--text-muted);">Tolerancia de Cotejo:</span>
              <button class="layer-chip ${tol === 3 ? 'active' : ''}" style="padding:2px 10px;font-size:11px;" onclick="PresupuestoEngine.setTolerancia(3, '${expediente.id}')">±3%</button>
              <button class="layer-chip ${tol === 5 ? 'active' : ''}" style="padding:2px 10px;font-size:11px;" onclick="PresupuestoEngine.setTolerancia(5, '${expediente.id}')">±5%</button>
              <button class="layer-chip ${tol === 10 ? 'active' : ''}" style="padding:2px 10px;font-size:11px;" onclick="PresupuestoEngine.setTolerancia(10, '${expediente.id}')">±10%</button>
            </div>
          </div>
        </div>

        <!-- BANNER DE ARCHIVO Y HOJA ORIGEN -->
        ${pData.archivoOrigen && pData.hojaPresupuestoEncontrada !== false ? `
          <div style="background:rgba(0,65,46,0.06);border:1px solid rgba(0,65,46,0.2);padding:12px 18px;border-radius:12px;display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--text-main);flex-wrap:wrap;gap:8px;">
            <div>
              <b>Documento Fuente:</b> 📄 ${pData.archivoOrigen} &bull; <b>Hoja Extraída:</b> <span class="badge-modalidad" style="font-size:11px;padding:1px 8px;border-radius:999px;">${pData.nombreHojaPresupuesto || 'PRESUPUESTO'}</span>
            </div>
            <div style="font-size:11.5px;color:var(--text-muted);">
              Tolerancia Aplicada: <b>±${tol}%</b> &bull; Estado: <b>${isOk ? '✓ CONFORME' : '⚠️ DISCREPANCIAS / NO CONFORME'}</b>
            </div>
          </div>
        ` : (pData.archivoOrigen && pData.hojaPresupuestoEncontrada === false ? `
          <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);padding:12px 18px;border-radius:12px;display:flex;align-items:center;justify-content:space-between;font-size:12px;color:#991B1B;flex-wrap:wrap;gap:8px;">
            <div>
              <b>⚠️ Archivo Detectado:</b> 📄 ${pData.archivoOrigen} &bull; <b>Alerta:</b> No se encontró la hoja obligatoria <b>PRESUPUESTO</b> en el archivo Excel.
            </div>
            <div style="font-size:11px;font-weight:700;">
              Requiere pestaña titulada 'PRESUPUESTO' para cotejo.
            </div>
          </div>
        ` : `
          <div style="background:rgba(217,119,6,0.08);border:1px solid rgba(217,119,6,0.3);padding:12px 18px;border-radius:12px;display:flex;align-items:center;justify-content:space-between;font-size:12px;color:#B45309;flex-wrap:wrap;gap:8px;">
            <div>
              <b>⚠️ Archivo de Presupuesto no detectado:</b> En modalidad RECURSOS es obligatorio aportar el archivo Excel (.xlsx) con la hoja <b>PRESUPUESTO</b>.
            </div>
          </div>
        `)}

        <!-- TARJETA DESTACADA: VALIDACIÓN DE OBJETO "PLACA HUELLA" -->
        ${pData.archivoOrigen && pData.hojaPresupuestoEncontrada !== false ? (
          pData.esPlacaHuella ? `
            <div style="background:rgba(16,185,129,0.08);border:1px solid #10B981;border-radius:14px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;box-shadow:var(--shadow-sm);">
              <div style="display:flex;align-items:center;gap:12px;">
                <div style="width:36px;height:36px;border-radius:50%;background:#10B981;color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;">✓</div>
                <div>
                  <div style="font-size:11px;font-weight:800;color:#047857;text-transform:uppercase;letter-spacing:0.5px;">Validación de Objeto de Infraestructura</div>
                  <div style="font-size:13.5px;font-weight:800;color:var(--text-main);margin-top:2px;">
                    Objeto / Proyecto leído en Presupuesto: <span style="font-weight:600;color:var(--color-primary);">"${this.escapeHtml(pData.objetoProyecto || 'Construcción de Placa Huella')}"</span>
                  </div>
                </div>
              </div>
              <span class="status-pill cumple" style="font-size:12px;padding:5px 14px;font-weight:800;letter-spacing:0.3px;">
                ✓ Corresponde a Placa Huella
              </span>
            </div>
          ` : `
            <div style="background:rgba(239,68,68,0.08);border:2px solid #EF4444;border-radius:14px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;box-shadow:var(--shadow-sm);">
              <div style="display:flex;align-items:center;gap:12px;">
                <div style="width:36px;height:36px;border-radius:50%;background:#EF4444;color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;">✕</div>
                <div>
                  <div style="font-size:11px;font-weight:800;color:#B91C1C;text-transform:uppercase;letter-spacing:0.5px;">Compuerta 1C: Incompatibilidad Crítica de Objeto</div>
                  <div style="font-size:13.5px;font-weight:800;color:#991B1B;margin-top:2px;">
                    Objeto / Proyecto leído en Presupuesto: <span style="font-weight:700;color:#7F1D1D;">"${this.escapeHtml(pData.objetoProyecto || 'No especificado / Sin mención a Placa Huella')}"</span>
                  </div>
                  ${pData.otroPavimentoDetectado ? `<div style="font-size:12px;color:#991B1B;margin-top:4px;">Tipología no admisible detectada: <b style="background:rgba(239,68,68,0.2);padding:2px 8px;border-radius:4px;">${this.escapeHtml(pData.otroPavimentoDetectado)}</b></div>` : ''}
                </div>
              </div>
              <span class="status-pill no-cumple" style="font-size:12px;padding:5px 14px;font-weight:800;letter-spacing:0.3px;">
                ✕ No Corresponde a Placa Huella (Se detectó: ${this.escapeHtml(pData.objetoProyecto || pData.otroPavimentoDetectado || 'Objeto incompatible')})
              </span>
            </div>
          `
        ) : ''}

        <!-- TABLA PRINCIPAL RESUMIDA: COMPARACIÓN DE TOTALES PRINCIPALES (Fase 1A vs. Presupuesto) -->
        <div class="audit-card" style="box-shadow:var(--shadow-sm);border-radius:16px;">
          <div class="audit-card-header">
            <div>
              <div class="audit-title" style="display:flex;align-items:center;gap:8px;">
                <span>📊 Comparación de Totales Principales (Fase 1A vs. Presupuesto)</span>
                <span class="badge-modalidad" style="font-size:10px;padding:1px 6px;">Single Source of Truth: Fase 1A</span>
              </div>
              <div class="audit-subtitle">Contraste directo entre los totales consolidados de la Fase 1A y la sumatoria de partidas en la hoja PRESUPUESTO</div>
            </div>
            <span class="status-pill ${isOk ? 'cumple' : 'no-cumple'}" style="font-size:11px;">
              ${isOk ? '✓ Totales Coherentes' : `⚠️ Discrepancias Detectadas`}
            </span>
          </div>

          <div class="table-responsive">
            <table class="data-table" style="font-size:12.5px;">
              <thead>
                <tr>
                  <th style="width:25%;">Ítem / Partida Principal</th>
                  <th style="width:18%;text-align:right;">1. Despiece / Memoria (Fase 1A)</th>
                  <th style="width:24%;">2. Parámetros en Especificaciones</th>
                  <th style="width:16%;text-align:right;">3. Presupuesto Oficial</th>
                  <th style="width:9%;text-align:right;">Diferencia (Δ)</th>
                  <th style="width:8%;text-align:center;">Estado</th>
                </tr>
              </thead>
              <tbody>
                ${comp.map(row => {
                  const isLong = row.id === "longitud_placa_huella";
                  const rowBg = isLong
                    ? (row.coherente ? 'background:rgba(0,65,46,0.05);border-left:4px solid var(--color-primary);' : 'background:rgba(239,68,68,0.08);border-left:4px solid #EF4444;')
                    : (row.coherente ? '' : 'background:rgba(239,68,68,0.04);');
                  const statusLabel = isLong
                    ? (row.coherente ? '✓ Coherente' : '⚠️ Discrepancia de Longitud')
                    : (row.coherente ? '✓ Coherente' : '⚠️ Discrepancia');
                  return `
                    <tr style="${rowBg}">
                      <td>
                        ${isLong ? '📏 ' : ''}<b style="color:var(--color-primary);font-size:${isLong ? '13px' : '12.5px'};">${row.item}</b>
                        ${isLong ? '<div style="font-size:10.5px;color:var(--text-muted);font-weight:500;">Distancia lineal continua de diseño proyectada</div>' : ''}
                      </td>
                      <td style="text-align:right;font-family:var(--font-mono);font-weight:700;">
                        ${Number(row.cantDespiece).toLocaleString('es-CO', { minimumFractionDigits: row.unidad === 'm' ? 0 : 2, maximumFractionDigits: 2 })} ${row.unidad}
                      </td>
                      <td style="font-size:11.5px;color:var(--text-muted);">
                        ${row.especificaciones}
                      </td>
                      <td style="text-align:right;">
                        <span class="font-mono font-bold" style="font-size:13px;color:var(--text-main);">
                          ${Number(row.cantPresupuesto || 0).toLocaleString('es-CO', { minimumFractionDigits: row.unidad === 'm' ? 0 : 2, maximumFractionDigits: 2 })}
                        </span>
                        <span style="font-size:11px;color:var(--text-muted);">${row.unidad}</span>
                        ${row.detallePresupuesto ? `<div style="font-size:10px;color:var(--color-primary);font-weight:600;margin-top:3px;line-height:1.25;text-align:right;" title="${row.detallePresupuesto}">${row.detallePresupuesto}</div>` : ''}
                      </td>
                      <td style="text-align:right;font-family:var(--font-mono);font-weight:800;color:${row.coherente ? 'var(--status-success)' : 'var(--status-danger)'};">
                        ${row.delta > 0 ? '+' : ''}${Number(row.delta).toLocaleString('es-CO', { minimumFractionDigits: row.unidad === 'm' ? 0 : 2, maximumFractionDigits: 2 })}
                        <div style="font-size:10px;opacity:0.8;">(${row.pct}%)</div>
                      </td>
                      <td style="text-align:center;">
                        <span class="status-pill ${row.coherente ? 'cumple' : 'no-cumple'}" style="font-size:10.5px;padding:3px 8px;white-space:nowrap;">
                          ${statusLabel}
                        </span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- RESUMEN DE HALLAZGOS O APROBACIÓN -->
        ${state.hallazgos.length > 0 ? `
          <div style="background:rgba(239,68,68,0.06);border:1px solid #EF4444;border-radius:12px;padding:16px 20px;">
            <div style="font-weight:800;color:#DC2626;font-size:13px;display:flex;align-items:center;gap:6px;margin-bottom:6px;">
              <span>⚠️</span> Hallazgo Presupuestal Registrado Automáticamente en Fase 3:
            </div>
            <ul style="margin:0;padding-left:20px;font-size:12px;color:var(--text-main);line-height:1.6;">
              ${state.hallazgos.map(h => `<li>${h.motivo}</li>`).join('')}
            </ul>
          </div>
        ` : `
          <div style="background:rgba(16,185,129,0.08);border:1px solid #10B981;border-radius:12px;padding:14px 20px;display:flex;align-items:center;gap:12px;font-size:12.5px;color:#065F46;">
            <span style="font-size:20px;">✓</span>
            <div>
              <b>Coherencia Presupuestal Verificada:</b> Todas las cantidades consignadas en la hoja <b>PRESUPUESTO</b> se encuentran dentro de la tolerancia departamental (±${tol}%) respecto a los cálculos de diseño (Fase 1A).
            </div>
          </div>
        `}

      </div>
    `;

    container.innerHTML = html;
  }
};
window.PresupuestoEngine = PresupuestoEngine;
window.extraerDimensionesItem = PresupuestoEngine.extraerDimensionesItem.bind(PresupuestoEngine);
