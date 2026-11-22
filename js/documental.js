/**
 * MOTOR DE VALIDACIÓN DOCUMENTAL Y VISUALIZADOR DE EXPEDIENTES (FASE 2)
 * Sistema SIPRO-PH - Gobernación de Antioquia
 * Lista Numérica Unificada Estricta del 1 al 27
 * 
 * Funcionalidad:
 * - Cotejo documental 100% dinámico de los 27 requisitos según los archivos aportados.
 * - Visualizador interactivo de documentos (PDF, imágenes, planos, textos) en modal de alta resolución.
 * - Enlace directo para abrir documentos en pestaña completa del navegador o descargarlos.
 */

const DocumentalEngine = {
  currentFilter: "ALL",
  activeObjectUrls: [],

  NOMBRES_MESES: [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ],

  MESES_MAP: {
    "enero": 0, "ene": 0,
    "febrero": 1, "feb": 1,
    "marzo": 2, "mar": 2,
    "abril": 3, "abr": 3,
    "mayo": 4, "may": 4,
    "junio": 5, "jun": 5,
    "julio": 6, "jul": 6,
    "agosto": 7, "ago": 7,
    "septiembre": 8, "setiembre": 8, "sep": 8, "set": 8,
    "octubre": 9, "oct": 9,
    "noviembre": 10, "nov": 10,
    "diciembre": 11, "dic": 11
  },

  ITEMS_VIGENCIA_MENSUAL: [9, 10, 11, 12, 13, 14, 15, 16, 21, 22],
  ITEMS_VIGENCIA_MENSUAL_2026_2: [27, 28, 29, 30, 31, 32, 33, 34, 39, 40],

  SHORT_TITLES_VIGENCIA: {
    9: "Acuerdo del Concejo",
    10: "Copia del RUT",
    11: "Certificado Contraloría (Responsables Fiscales)",
    12: "Certificado Medidas Correctivas (RNMC)",
    13: "Certificado Antecedentes Judiciales",
    14: "Certificado Antecedentes Disciplinarios",
    15: "Certificado Seguridad Social y Parafiscales",
    16: "Certificado REDAM",
    21: "Constancia Consulta PACO",
    22: "Certificado Inhabilidades Delitos Sexuales"
  },

  SHORT_TITLES_VIGENCIA_2026_2: {
    27: "Acuerdo del Concejo",
    28: "Copia del RUT",
    29: "Certificado Contraloría (Responsables Fiscales)",
    30: "Certificado Medidas Correctivas (RNMC)",
    31: "Certificado Antecedentes Judiciales",
    32: "Certificado Antecedentes Disciplinarios",
    33: "Certificado Seguridad Social y Parafiscales",
    34: "Certificado REDAM",
    39: "Constancia Consulta PACO",
    40: "Certificado Inhabilidades Delitos Sexuales"
  },

  getItemsVigencia(processMode) {
    if (processMode === "2026_2" || processMode === "CONVENIOS_2026_2") {
      return this.ITEMS_VIGENCIA_MENSUAL_2026_2;
    }
    return this.ITEMS_VIGENCIA_MENSUAL;
  },

  isVigenciaMensual(itemId, processMode) {
    const list = this.getItemsVigencia(processMode);
    return list.includes(Number(itemId));
  },

  /**
   * Extrae la fecha de expedición/generación de un documento a partir de su texto,
   * nombre de archivo o metadatos de archivo (File.lastModified).
   * Retorna { fecha: Date, fechaStr: string } o null.
   */
  extraerFechaDocumento(file, textSnippet = "") {
    let fullText = (textSnippet || "") + " " + (file && file.name ? file.name : "");
    if (!fullText.trim() && file && file.lastModified) {
      const d = new Date(file.lastModified);
      return {
        fecha: d,
        fechaStr: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`,
        fuente: "lastModified"
      };
    }

    const cleanText = fullText.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    // 1. Búsqueda contextual cerca de términos de expedición/generación/consulta
    const contextRegex = /(?:fecha(?:\s+y\s+hora)?(?:\s+de)?(?:\s+expedicion|\s+generacion|\s+emision|\s+consulta)?|expedid[oa]|generad[oa]|emitid[oa]|consultad[oa]|suscrit[oa]|dado\s+en[a-z\s]{0,25}a\s+los|valido\s+hasta|mes\s+de)[\s:\._-]*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{4}|[0-9]{4}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{1,2}|(?:(?:a\s+los\s+)?([0-9]{1,2})\s+dias\s+del\s+mes\s+de|([0-9]{1,2})\s+de|mes\s+de)\s+([a-z]{3,12})\s+(?:de|del)?\s+([0-9]{4}))/i;
    const mCtx = cleanText.match(contextRegex);

    if (mCtx) {
      const parsedCtx = this.parsearFechaString(mCtx[1] || mCtx[0]);
      if (parsedCtx) return parsedCtx;
    }

    // 2. Fechas textuales en español: "15 de noviembre de 2026", "a los 15 dias del mes de noviembre del 2026"
    const textDateRegex = /(?:(?:a\s+los\s+)?([0-9]{1,2})\s+dias\s+del\s+mes\s+de|([0-9]{1,2})\s+de|mes\s+de)\s+([a-z]{3,12})\s+(?:de|del)?\s+([0-9]{4})/i;
    const mText = cleanText.match(textDateRegex);
    if (mText) {
      const day = parseInt(mText[1] || mText[2] || "1", 10);
      const monthName = mText[3].toLowerCase();
      const year = parseInt(mText[4], 10);
      if (this.MESES_MAP[monthName] !== undefined && year >= 2020 && year <= 2035) {
        const d = new Date(year, this.MESES_MAP[monthName], day, 12, 0, 0);
        return {
          fecha: d,
          fechaStr: `${String(day).padStart(2, '0')}/${String(this.MESES_MAP[monthName] + 1).padStart(2, '0')}/${year}`,
          fuente: "texto_espanol"
        };
      }
    }

    // 2.5 Fechas estilo DD-MES-AAAA o DD/MES/AAAA (e.g., 28-oct-2026, 28-octubre-2026, 28/nov/2026)
    const alphaDateRegex = /\b([0-2]?[0-9]|3[01])[\s\/\-\.]([a-z]{3,12})[\s\/\-\.](202[0-9]|203[0-9])\b/i;
    const mAlpha = cleanText.match(alphaDateRegex);
    if (mAlpha) {
      const day = parseInt(mAlpha[1], 10);
      const monthName = mAlpha[2].toLowerCase();
      const year = parseInt(mAlpha[3], 10);
      if (this.MESES_MAP[monthName] !== undefined && year >= 2020 && year <= 2035) {
        const d = new Date(year, this.MESES_MAP[monthName], day, 12, 0, 0);
        return {
          fecha: d,
          fechaStr: `${String(day).padStart(2, '0')}/${String(this.MESES_MAP[monthName] + 1).padStart(2, '0')}/${year}`,
          fuente: "texto_dd_mes_aaaa"
        };
      }
    }

    // 3. Fechas numéricas estándar: DD/MM/AAAA o DD-MM-AAAA
    const stdDateRegex = /\b([0-2]?[0-9]|3[01])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](202[0-9]|203[0-9])\b/;
    const mStd = fullText.match(stdDateRegex);
    if (mStd) {
      const day = parseInt(mStd[1], 10);
      const month = parseInt(mStd[2], 10) - 1;
      const year = parseInt(mStd[3], 10);
      const d = new Date(year, month, day, 12, 0, 0);
      return {
        fecha: d,
        fechaStr: `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`,
        fuente: "numerica_dd_mm_aaaa"
      };
    }

    // 4. Fechas ISO: AAAA-MM-DD o AAAA/MM/DD
    const isoDateRegex = /\b(202[0-9]|203[0-9])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.]([0-2]?[0-9]|3[01])\b/;
    const mIso = fullText.match(isoDateRegex);
    if (mIso) {
      const year = parseInt(mIso[1], 10);
      const month = parseInt(mIso[2], 10) - 1;
      const day = parseInt(mIso[3], 10);
      const d = new Date(year, month, day, 12, 0, 0);
      return {
        fecha: d,
        fechaStr: `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`,
        fuente: "numerica_iso"
      };
    }

    // 5. Fechas compactas en nombre de archivo (e.g., 20261115)
    if (file && file.name) {
      const mComp = file.name.match(/(202[0-9]|203[0-9])(0[1-9]|1[0-2])([0-2][0-9]|3[01])/);
      if (mComp) {
        const year = parseInt(mComp[1], 10);
        const month = parseInt(mComp[2], 10) - 1;
        const day = parseInt(mComp[3], 10);
        const d = new Date(year, month, day, 12, 0, 0);
        return {
          fecha: d,
          fechaStr: `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`,
          fuente: "nombre_compacto"
        };
      }
    }

    // 6. Fallback final a fecha de modificación del archivo
    if (file && file.lastModified && file.lastModified > 0) {
      const d = new Date(file.lastModified);
      return {
        fecha: d,
        fechaStr: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`,
        fuente: "lastModified"
      };
    }

    return null;
  },

  parsearFechaString(str) {
    if (!str) return null;
    const clean = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

    // Textual
    const textM = clean.match(/(?:(?:a\s+los\s+)?([0-9]{1,2})\s+dias\s+del\s+mes\s+de|([0-9]{1,2})\s+de|mes\s+de)\s+([a-z]{3,12})\s+(?:de|del)?\s+([0-9]{4})/i);
    if (textM) {
      const day = parseInt(textM[1] || textM[2] || "1", 10);
      const mName = textM[3].toLowerCase();
      const year = parseInt(textM[4], 10);
      if (this.MESES_MAP[mName] !== undefined) {
        const d = new Date(year, this.MESES_MAP[mName], day, 12, 0, 0);
        return {
          fecha: d,
          fechaStr: `${String(day).padStart(2, '0')}/${String(this.MESES_MAP[mName] + 1).padStart(2, '0')}/${year}`,
          fuente: "contextual_texto"
        };
      }
    }

    // DD-MES-AAAA o DD/MES/AAAA (e.g. 28-oct-2026, 28-octubre-2026)
    const alphaM = clean.match(/([0-2]?[0-9]|3[01])[\s\/\-\.]([a-z]{3,12})[\s\/\-\.](202[0-9]|203[0-9])/i);
    if (alphaM) {
      const day = parseInt(alphaM[1], 10);
      const mName = alphaM[2].toLowerCase();
      const year = parseInt(alphaM[3], 10);
      if (this.MESES_MAP[mName] !== undefined) {
        const d = new Date(year, this.MESES_MAP[mName], day, 12, 0, 0);
        return {
          fecha: d,
          fechaStr: `${String(day).padStart(2, '0')}/${String(this.MESES_MAP[mName] + 1).padStart(2, '0')}/${year}`,
          fuente: "contextual_alpha"
        };
      }
    }

    // DD/MM/AAAA
    const stdM = clean.match(/([0-2]?[0-9]|3[01])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](202[0-9]|203[0-9])/);
    if (stdM) {
      const day = parseInt(stdM[1], 10);
      const month = parseInt(stdM[2], 10) - 1;
      const year = parseInt(stdM[3], 10);
      const d = new Date(year, month, day, 12, 0, 0);
      return {
        fecha: d,
        fechaStr: `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`,
        fuente: "contextual_std"
      };
    }

    // ISO AAAA-MM-DD
    const isoM = clean.match(/(202[0-9]|203[0-9])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.]([0-2]?[0-9]|3[01])/);
    if (isoM) {
      const year = parseInt(isoM[1], 10);
      const month = parseInt(isoM[2], 10) - 1;
      const day = parseInt(isoM[3], 10);
      const d = new Date(year, month, day, 12, 0, 0);
      return {
        fecha: d,
        fechaStr: `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`,
        fuente: "contextual_iso"
      };
    }

    return null;
  },

  /**
   * Ejecuta la auditoría documental completa del proyecto basada en los archivos reales
   */
  auditProject(project) {
    const processMode = (project && project.procesoEspecial) || (project && project.datos && project.datos.procesoEspecial) || (window.App && window.App.currentProcessMode) || (window.SIPRO_PROCESS_MODE) || "ORDINARIO";
    const is2026_2 = processMode === "2026_2" || processMode === "CONVENIOS_2026_2";
    const isRecursos = !is2026_2 && project && (project.modalidad === "RECURSOS" || (project.datos && project.datos.modalidad === "RECURSOS"));
    
    let items;
    if (is2026_2) {
      items = (SIPRO_DATA.items41_2026_2 && SIPRO_DATA.items41_2026_2.length > 0) ? SIPRO_DATA.items41_2026_2 : SIPRO_DATA.items27;
    } else {
      items = isRecursos ? SIPRO_DATA.items27 : SIPRO_DATA.items27.filter(i => !i.soloRecursos);
    }

    const docStatus = project.documentosStatus || { itemsCumplidos: [], itemsSubsanar: [], diasVigencias: {}, archivosDetectados: {} };
    const diasVigencias = docStatus.diasVigencias || {};
    const archivosDetectados = docStatus.archivosDetectados || {};
    const archivosMeta = project.archivosMetadata || {};
    
    let totalCompliant = 0;
    let criticalIssues = [];
    let alerts = [];
    
    const auditedItems = items.map(item => {
      let isCompliant = true;
      let isMissing = false;
      let isExpired = false;
      let daysRemaining = null;
      let observation = "-";

      const detectedFile = archivosDetectados[item.id] || null;
      const meta = archivosMeta[item.id] || null;

      // 1. REGLA PRIMARIA: Si no se encontró archivo en la carpeta, es FALTANTE OBLIGATORIO
      if (!detectedFile) {
        isCompliant = false;
        isMissing = true;
        observation = `Documento Faltante: No se aportó archivo en la carpeta del expediente para el Ítem ${item.num}.`;
        criticalIssues.push({
          criterio: `Ítem ${item.num}: ${item.title}`,
          observacion: observation,
          accion_requerida: `Aportar el documento en formato PDF/Digital conforme a la regla: ${item.rule}`
        });

        return {
          ...item,
          conforme: false,
          faltante: true,
          vencido: false,
          esVigente: false,
          fechaDoc: null,
          fechaDocStr: null,
          observacion: observation,
          diasRestantes: null,
          archivoDetectado: null,
          meta: null
        };
      }

      // 2. Si el archivo SÍ existe, verificar regla de vigencia estricta por Mes Calendario en Curso
      let fechaDoc = null;
      let fechaDocStr = null;
      let esVigente = true;
      const isVigenciaItem = this.isVigenciaMensual(item.id, processMode);

      if (isVigenciaItem) {
        if (meta && meta.fechaDoc instanceof Date) {
          fechaDoc = meta.fechaDoc;
          fechaDocStr = meta.fechaDocStr || `${String(fechaDoc.getDate()).padStart(2, '0')}/${String(fechaDoc.getMonth() + 1).padStart(2, '0')}/${fechaDoc.getFullYear()}`;
        } else if (meta && meta.fechaDoc) {
          const dParsed = new Date(meta.fechaDoc);
          if (!isNaN(dParsed.getTime())) {
            fechaDoc = dParsed;
            fechaDocStr = meta.fechaDocStr || `${String(dParsed.getDate()).padStart(2, '0')}/${String(dParsed.getMonth() + 1).padStart(2, '0')}/${dParsed.getFullYear()}`;
          }
        } else if (meta && meta.fechaDocStr) {
          const parsedMeta = this.parsearFechaString(meta.fechaDocStr);
          if (parsedMeta) {
            fechaDoc = parsedMeta.fecha;
            fechaDocStr = parsedMeta.fechaStr;
          }
        }

        if (!fechaDoc) {
          const realFile = this.getFileForItem(item.id);
          const snippet = (meta && meta.textSnippet) || (project.itemTextsMap && project.itemTextsMap[item.id]) || "";
          const extRes = this.extraerFechaDocumento(realFile, snippet);
          if (extRes) {
            fechaDoc = extRes.fecha;
            fechaDocStr = extRes.fechaStr;
            if (meta) {
              meta.fechaDoc = fechaDoc;
              meta.fechaDocStr = fechaDocStr;
            }
          }
        }

        // Lógica estricta de validación por mes y año calendario en curso (eliminando cualquier cálculo por 30 días corridos)
        const ahora = new Date();
        const mesActual = ahora.getMonth(); // 0 a 11
        const anioActual = ahora.getFullYear();

        esVigente = Boolean(fechaDoc && fechaDoc.getFullYear() === anioActual && fechaDoc.getMonth() === mesActual);

        const shortTitle = (is2026_2 ? this.SHORT_TITLES_VIGENCIA_2026_2[item.id] : this.SHORT_TITLES_VIGENCIA[item.id]) || item.title.split("(")[0].trim();
        const nombreMesActual = this.NOMBRES_MESES[mesActual];

        if (!esVigente) {
          isCompliant = false;
          isExpired = true;
          const displayFecha = fechaDocStr || "Fecha no detectada";
          observation = `Documento con vigencia vencida: expedido el ${displayFecha}. Debe corresponder al mes de revisión en curso (${nombreMesActual} de ${anioActual}).`;
          criticalIssues.push({
            criterio: `Ítem ${item.num}: ${item.title}`,
            observacion: `• Ítem ${item.num} (${shortTitle}): ⚠️ VIGENCIA VENCIDA — Expedido el ${displayFecha}. Debe corresponder al mes de revisión en curso (${nombreMesActual} de ${anioActual}).`,
            accion_requerida: `Aportar nuevo certificado expedido en el mes de ${nombreMesActual} de ${anioActual}.`
          });
        } else {
          observation = `Documento verificado y vigente: expedido el ${fechaDocStr} (mes en curso: ${nombreMesActual} de ${anioActual}).`;
        }
      }
      
      // 3. Chequeo de lista de subsanación explícita
      if (docStatus.itemsSubsanar && docStatus.itemsSubsanar.includes(item.id)) {
        isCompliant = false;
        if (observation === "-") {
          observation = `No cumple requisito formal según especificaciones técnicas: ${item.rule}`;
        }
      }

      // 3.5 CALIFICACIÓN MANUAL VINCULANTE DE LA SUPERVISIÓN
      const revSup = (project.revisionSupervisor && (project.revisionSupervisor[item.id] || project.revisionSupervisor[String(item.id)]))
                  || (docStatus.revisionSupervisor && (docStatus.revisionSupervisor[item.id] || docStatus.revisionSupervisor[String(item.id)]))
                  || null;

      let marcadoSupervisor = false;
      let estadoSupervisor = null;
      let observacionSupervisor = null;
      let fechaRevisionSupervisor = null;

      if (revSup) {
        marcadoSupervisor = true;
        estadoSupervisor = revSup.estado;
        observacionSupervisor = revSup.observacion || "";
        fechaRevisionSupervisor = revSup.fecha || "";

        if (estadoSupervisor === "NO_CONFORME" || estadoSupervisor === "INCONFORME") {
          isCompliant = false;
          observation = observacionSupervisor
            ? `⚠️ NO CONFORME (Supervisor): ${observacionSupervisor}`
            : `⚠️ Documento marcado como No Conforme tras la inspección técnica del supervisor.`;
          
          criticalIssues.push({
            criterio: `Ítem ${item.num}: ${item.title}`,
            observacion: `• Ítem ${item.num}: ⚠️ NO CONFORME (Supervisor) — ${observacionSupervisor || 'No cumple requisitos técnicos tras inspección'}`,
            accion_requerida: `Subsanar las no conformidades técnicas señaladas por el supervisor: ${observacionSupervisor || 'Ajustar documento según especificaciones'}`
          });
        } else if (estadoSupervisor === "CONFORME") {
          isCompliant = true;
          isExpired = false;
          observation = observacionSupervisor
            ? `✓ Aprobado por el Supervisor: ${observacionSupervisor}`
            : `Documento verificado y aprobado de conformidad por el supervisor (${detectedFile || 'Conforme'}).`;
          
          // Remover de criticalIssues si se había agregado por vigencia o falta previa
          criticalIssues = criticalIssues.filter(ci => !ci.criterio.startsWith(`Ítem ${item.num}:`));
        }
      }

      if (isCompliant) {
        totalCompliant++;
        if (observation === "-") {
          observation = `Documento verificado y vigente en la carpeta: ${detectedFile}`;
        }
      } else if (!isExpired && !marcadoSupervisor) {
        criticalIssues.push({
          criterio: `Ítem ${item.num}: ${item.title}`,
          observacion: observation,
          accion_requerida: `Remitir nuevo documento conforme a la regla: ${item.rule}`
        });
      }

      return {
        ...item,
        conforme: isCompliant,
        faltante: isMissing,
        vencido: isExpired,
        esVigente: isExpired ? false : (isVigenciaItem ? true : null),
        fechaDoc: fechaDoc,
        fechaDocStr: fechaDocStr,
        observacion: observation,
        diasRestantes: null,
        archivoDetectado: detectedFile,
        meta: meta,
        marcadoSupervisor: marcadoSupervisor,
        estadoSupervisor: estadoSupervisor,
        observacionSupervisor: observacionSupervisor,
        fechaRevisionSupervisor: fechaRevisionSupervisor
      };
    });

    // 4. Verificación de Ficha de Priorización (Documento Base)
    // En el proceso especial Convenios "2026 - II" no se exige Ficha de Priorización
    if (!is2026_2) {
      const fichaP = project.fichaPriorizacion || (project.datos && project.datos.fichaPriorizacion);
      const revFicha = (project.revisionSupervisor && project.revisionSupervisor["FICHA_PRIORIZACION"])
                    || (docStatus.revisionSupervisor && docStatus.revisionSupervisor["FICHA_PRIORIZACION"])
                    || null;

      if (revFicha && (revFicha.estado === "NO_CONFORME" || revFicha.estado === "INCONFORME")) {
        criticalIssues.unshift({
          criterio: "Ficha de Priorización (Documento Base)",
          observacion: `Ficha de Priorización: ⚠️ NO CONFORME (Supervisor) — ${revFicha.observacion || 'Observación técnica en Ficha de Priorización'}`,
          accion_requerida: `Corregir las observaciones en la Ficha de Priorización: ${revFicha.observacion || 'Aportar Ficha debidamente corregida'}`
        });
      } else if (!fichaP || fichaP.existe === false || fichaP.detected === false) {
        if (!revFicha || revFicha.estado !== "CONFORME") {
          criticalIssues.unshift({
            criterio: "Ficha de Priorización (Documento Base)",
            observacion: "Ficha de Priorización: Documento faltante en el expediente",
            accion_requerida: "Aportar la Ficha de Priorización oficial suscrita por el Alcalde y el Secretario."
          });
        }
      }
    }

    const passed = criticalIssues.length === 0;

    return {
      fase: "2_DOCUMENTAL",
      aprobado: passed,
      totalItems: items.length,
      itemsConformes: totalCompliant,
      itemsNoConformes: items.length - totalCompliant,
      porcentajeConformidad: +((totalCompliant / items.length) * 100).toFixed(1),
      items: auditedItems,
      hallazgosCriticos: criticalIssues,
      alertas: alerts
    };
  },

  /**
   * Obtiene la instancia File real asociada al ítem para el expediente activo
   */
  getFileForItem(itemId) {
    const p = App.currentProject || {};
    const rec = App.currentAuditRecord || (window.proyectosAuditados && window.proyectosAuditados[App.currentProjectId]);
    
    // 1. Buscar en mapa de archivos del registro indexado
    if (rec && rec.archivosFileMap && rec.archivosFileMap[itemId]) {
      return rec.archivosFileMap[itemId];
    }
    // 2. Buscar en datos del proyecto
    if (p && p.archivosFiles && p.archivosFiles[itemId]) {
      return p.archivosFiles[itemId];
    }
    // 3. Buscar por coincidencia de nombre en la lista de archivos de la carpeta
    const detectedName = (p.documentosStatus && p.documentosStatus.archivosDetectados && p.documentosStatus.archivosDetectados[itemId])
                      || (p.archivosMetadata && p.archivosMetadata[itemId] && p.archivosMetadata[itemId].fileName);
    if (detectedName) {
      const fileList = (rec && rec.archivos) || (p && p.archivos) || [];
      const found = fileList.find(f => f.name === detectedName || f.name.toLowerCase() === detectedName.toLowerCase());
      if (found) return found;
    }
    return null;
  },

  /**
   * ABRE Y VISUALIZA EL DOCUMENTO ASOCIADO AL ÍTEM (REQUISITO FASE 2)
   * Permite previsualización in-app en modal o apertura directa en pestaña completa
   */
  abrirDocumento(itemId, openInNewTab = false) {
    const p = App.currentProject || {};
    const rec = App.currentAuditRecord || (window.proyectosAuditados && window.proyectosAuditados[App.currentProjectId]);
    const processMode = (p && p.procesoEspecial) || (rec && rec.procesoEspecial) || (App && App.currentProcessMode) || window.SIPRO_PROCESS_MODE || "ORDINARIO";
    const is2026_2 = processMode === "2026_2" || processMode === "CONVENIOS_2026_2" || itemId > 28;
    const item = is2026_2
      ? ((SIPRO_DATA.items41_2026_2 && SIPRO_DATA.items41_2026_2.find(i => Number(i.id) === Number(itemId))) || SIPRO_DATA.items27.find(i => Number(i.id) === Number(itemId)))
      : (SIPRO_DATA.items27.find(i => Number(i.id) === Number(itemId)) || (SIPRO_DATA.items41_2026_2 && SIPRO_DATA.items41_2026_2.find(i => Number(i.id) === Number(itemId))));
    if (!item) return;

    const file = this.getFileForItem(itemId);
    const detectedName = (p.documentosStatus && p.documentosStatus.archivosDetectados && p.documentosStatus.archivosDetectados[itemId])
                      || (p.archivosMetadata && p.archivosMetadata[itemId] && p.archivosMetadata[itemId].fileName);

    if (!file) {
      if (!detectedName) {
        // Documento no aportado en la carpeta
        this.openItemModal(itemId);
        if (window.FolderReader) {
          FolderReader.showToast(`⚠️ Ítem ${item.num}: Documento no aportado en la carpeta del municipio.`);
        }
        return;
      }
      // Tenemos el nombre y metadatos pero no la instancia File en memoria
      this.openItemModal(itemId);
      return;
    }

    // Crear Object URL seguro en memoria del navegador
    const fileUrl = URL.createObjectURL(file);
    this.activeObjectUrls = this.activeObjectUrls || [];
    this.activeObjectUrls.push(fileUrl);

    if (openInNewTab) {
      window.open(fileUrl, "_blank");
      return;
    }

    this.openViewerModal(itemId, item, file, fileUrl);
  },

  /**
   * ABRE Y VISUALIZA LA FICHA DE PRIORIZACIÓN EN EL VISOR MODAL
   */
  abrirFichaPriorizacion(proyectoId, openInNewTab = false) {
    if (!proyectoId) proyectoId = App.currentProjectId;
    const exp = (window.proyectosAuditados && window.proyectosAuditados[proyectoId]) ||
                (window.SIPRO_DATA && SIPRO_DATA.expedientesMap && SIPRO_DATA.expedientesMap[proyectoId]) ||
                App.currentAuditRecord;
    const ficha = (exp && exp.fichaPriorizacion) || (exp && exp.datos && exp.datos.fichaPriorizacion);
    if (!ficha || !ficha.existe) {
      if (typeof FolderReader !== "undefined" && FolderReader.showToast) {
        FolderReader.showToast("⚠️ No se ha detectado el archivo de Ficha de Priorización en el expediente.");
      } else {
        alert("⚠️ No se ha detectado el archivo de Ficha de Priorización en el expediente.");
      }
      return;
    }

    const file = ficha.archivoVisualizacion || ficha.archivoPdf || ficha.archivoExcel;
    if (!file) {
      alert("⚠️ Archivo físico de la Ficha no disponible en memoria. Puede volver a cargarlo usando 'Subir Ficha'.");
      return;
    }

    const itemFicha = {
      id: "FICHA_PRIORIZACION",
      num: "FP",
      title: "Ficha de Priorización y Cierre de Proyecto",
      entity: "Alcaldía Municipal - Secretaría de Infraestructura Física",
      rule: "Documento oficial debidamente suscrito con anexos"
    };

    const fileUrl = URL.createObjectURL(file);
    this.activeObjectUrls = this.activeObjectUrls || [];
    this.activeObjectUrls.push(fileUrl);

    if (openInNewTab) {
      window.open(fileUrl, "_blank");
      return;
    }

    this.openViewerModal("FICHA_PRIORIZACION", itemFicha, file, fileUrl);
  },

  /**
   * Despliega el visor interactivo de documentos en el modal de alta resolución
   */
  openViewerModal(itemId, item, file, fileUrl) {
    if (!item || !file) {
      if (String(itemId).toUpperCase().includes("FICHA")) {
        return this.abrirFichaPriorizacion(App.currentProjectId, false);
      }
      return this.abrirDocumento(itemId, false);
    }

    const modal = document.getElementById("documentModal");
    const modalWin = document.getElementById("documentModalWindow") || (modal ? modal.querySelector(".modal-window") : null);
    const modalTitle = document.getElementById("modalDocTitle");
    const modalBody = document.getElementById("modalDocBody");
    const openTabBtn = document.getElementById("modalDocOpenTabBtn");
    const downloadBtn = document.getElementById("modalDocDownloadBtn");
    const statusBadge = document.getElementById("modalDocStatusBadge");
    const footerMeta = document.getElementById("modalDocFooterMeta");

    if (!modal || !modalBody) return;

    // Maximizar ventana modal para lectura de planos y documentos
    if (modalWin) modalWin.classList.add("modal-xl");

    const fileName = file.name;
    const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
    const sizeKb = (file.size / 1024).toFixed(1) + " KB";
    const modDate = file.lastModified ? new Date(file.lastModified).toLocaleDateString("es-CO") : "Reciente";
    const p = App.currentProject || {};
    const rec = App.currentAuditRecord || (window.proyectosAuditados && window.proyectosAuditados[App.currentProjectId]);

    // Consultar estado de calificación de la supervisión
    const revSup = (p.revisionSupervisor && (p.revisionSupervisor[itemId] || p.revisionSupervisor[String(itemId)]))
                || (rec && rec.revisionSupervisor && (rec.revisionSupervisor[itemId] || rec.revisionSupervisor[String(itemId)]))
                || null;
    const auditedItem = (rec && rec.fase2 && rec.fase2.items) ? rec.fase2.items.find(i => String(i.id) === String(itemId)) : null;
    const isConforme = revSup ? (revSup.estado === "CONFORME") : (auditedItem ? auditedItem.conforme : true);
    const observacionSup = (revSup && revSup.observacion) || (auditedItem && auditedItem.observacionSupervisor) || "";

    const supervisorDecisionBarHtml = `
      <div id="modalSupervisorDecisionBar" class="supervisor-decision-bar" style="background:var(--color-bg-alt);border:1px solid var(--border-subtle);border-radius:8px;padding:8px 14px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <span style="font-size:12px;font-weight:800;color:var(--text-main);display:flex;align-items:center;gap:5px;">
            <span>🛡️</span> <span>Revisión de Supervisión:</span>
          </span>
          <span id="modalSupStatusBadge" class="status-pill ${isConforme ? 'cumple' : 'no-cumple'}" style="font-size:11px;padding:3px 10px;font-weight:700;">
            ${isConforme ? '&#10003; CONFORME' : '&#10007; NO CONFORME'}
          </span>
          <span id="modalSupObsDisplay" style="font-size:11.5px;color:${isConforme ? '#15803d' : '#be123c'};font-weight:600;max-width:380px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${observacionSup || ''}">
            ${observacionSup ? `(${observacionSup})` : ''}
          </span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <button type="button" class="btn-supervisor-action btn-supervisor-conforme"
                  style="padding:5px 12px;font-size:11.5px;"
                  onclick="DocumentalEngine.marcarConformeDesdeModal('${itemId}')"
                  title="Aprobar y marcar este documento como Conforme">
            <span>✓</span> <span>Marcar Conforme</span>
          </button>
          <button type="button" class="btn-supervisor-action btn-supervisor-inconforme"
                  style="padding:5px 12px;font-size:11.5px;"
                  onclick="DocumentalEngine.solicitarInconformidad('${itemId}', true)"
                  title="Marcar este documento como Inconforme y registrar observación">
            <span>⚠️</span> <span>Marcar Inconforme</span>
          </button>
          <button type="button" class="btn-secondary"
                  id="btnModalEditObs"
                  style="padding:5px 8px;font-size:11.5px;border-radius:4px;display:${isConforme ? 'none' : 'inline-flex'};align-items:center;gap:3px;"
                  onclick="DocumentalEngine.solicitarInconformidad('${itemId}', true)"
                  title="Editar observación del supervisor">
            <span>✏️ Motivo</span>
          </button>
        </div>
      </div>
    `;

    if (modalTitle) {
      modalTitle.innerHTML = `<span style="color:var(--color-primary);font-weight:800;margin-right:6px">Ítem ${item.num}:</span> ${item.title}`;
    }

    if (statusBadge) {
      statusBadge.style.display = "inline-flex";
      statusBadge.className = "status-pill cumple";
      statusBadge.innerHTML = `&#10003; Aportado en ${p.municipio || 'Expediente'}`;
    }

    if (openTabBtn) {
      openTabBtn.style.display = "inline-flex";
      openTabBtn.href = fileUrl;
    }

    if (downloadBtn) {
      downloadBtn.style.display = "inline-flex";
      downloadBtn.href = fileUrl;
      downloadBtn.download = fileName;
    }

    if (footerMeta) {
      footerMeta.innerHTML = `
        <span style="font-weight:700;color:var(--text-main)">Archivo:</span> ${fileName} &bull; 
        <span style="font-weight:700;color:var(--text-main)">Tamaño:</span> ${sizeKb} &bull; 
        <span style="font-weight:700;color:var(--text-main)">Actualizado:</span> ${modDate}
      `;
    }

    // Construir contenido según el tipo de archivo
    let viewerHtml = "";

    if (ext === ".pdf") {
      viewerHtml = `
        <div style="display:flex;flex-direction:column;gap:12px;height:100%;">
          <div style="background:var(--color-bg-alt);padding:10px 16px;border-radius:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;border:1px solid var(--border-subtle);">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:18px;">📄</span>
              <div>
                <div style="font-size:13px;font-weight:800;color:var(--color-primary);">${fileName}</div>
                <div style="font-size:11px;color:var(--text-muted);">Documento PDF oficial del expediente &bull; ${sizeKb} &bull; ${item.entity}</div>
              </div>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="btn-secondary" style="padding:4px 10px;font-size:11px;" onclick="window.open('${fileUrl}', '_blank')">
                Pestaña Completa &#8599;
              </button>
              <button class="btn-secondary" style="padding:4px 10px;font-size:11px;" onclick="DocumentalEngine.openItemModal(${itemId})">
                Ver Reglas de Auditoría
              </button>
            </div>
          </div>
          <iframe src="${fileUrl}#toolbar=1&navpanes=1" class="doc-viewer-frame" title="Visor de Documento - ${fileName}"></iframe>
        </div>
      `;
    } else if (ext === ".png" || ext === ".jpg" || ext === ".jpeg" || ext === ".webp" || ext === ".bmp") {
      viewerHtml = `
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="background:var(--color-bg-alt);padding:10px 16px;border-radius:8px;display:flex;align-items:center;justify-content:space-between;border:1px solid var(--border-subtle);">
            <div style="font-size:13px;font-weight:700;color:var(--color-primary);">🖼️ Registro Gráfico / Fotográfico: ${fileName}</div>
            <button class="btn-secondary" style="padding:4px 10px;font-size:11px;" onclick="window.open('${fileUrl}', '_blank')">Pestaña Completa &#8599;</button>
          </div>
          <div style="background:#0f172a;border-radius:8px;padding:16px;text-align:center;max-height:70vh;overflow:auto;">
            <img src="${fileUrl}" alt="${fileName}" style="max-width:100%;max-height:65vh;object-fit:contain;border-radius:4px;box-shadow:0 4px 12px rgba(0,0,0,0.5);">
          </div>
        </div>
      `;
    } else if (ext === ".kmz" || ext === ".kml") {
      viewerHtml = `
        <div style="padding:32px 24px;text-align:center;background:rgba(2,132,199,0.05);border:1px solid rgba(2,132,199,0.25);border-radius:10px;">
          <div style="font-size:40px;margin-bottom:12px;">🗺️</div>
          <h3 style="font-size:17px;font-weight:800;color:var(--color-primary);margin:0 0 6px 0;">Archivo Georreferenciado: ${fileName}</h3>
          <p style="font-size:13px;color:var(--text-muted);max-width:580px;margin:0 auto 20px;line-height:1.5;">
            Este archivo contiene los tracks de coordenadas y trazados espaciales del proyecto. El sistema los ha extraído y contrastado contra la Red Vial Terciaria en la <b>Fase 1B</b>.
          </p>
          <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
            <button class="btn-primary" style="background:#0284C7;padding:8px 18px;" onclick="DocumentalEngine.closeModal(); App.switchTab('tab-1b');">
              Ver Trazado en el Mapa Satelital (Fase 1B)
            </button>
            <a href="${fileUrl}" download="${fileName}" class="btn-secondary" style="padding:8px 18px;text-decoration:none;">
              Descargar Archivo KMZ/KML
            </a>
          </div>
        </div>
      `;
    } else if (ext === ".xlsx" || ext === ".xls" || ext === ".xlsm" || ext === ".xlsb") {
      viewerHtml = `
        <div style="display:flex;flex-direction:column;gap:12px;height:100%;">
          <div style="background:var(--color-bg-alt);padding:10px 16px;border-radius:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;border:1px solid var(--border-subtle);">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:18px;">📊</span>
              <div>
                <div style="font-size:13px;font-weight:800;color:var(--color-primary);">${fileName}</div>
                <div style="font-size:11px;color:var(--text-muted);">Hoja de cálculo Excel oficial &bull; ${sizeKb}</div>
              </div>
            </div>
            <div style="display:flex;gap:8px;">
              <a href="${fileUrl}" download="${fileName}" class="btn-primary" style="padding:4px 12px;font-size:11px;text-decoration:none;">
                📥 Descargar Excel
              </a>
            </div>
          </div>
          <div id="modalExcelPreviewContainer" style="flex:1;overflow:auto;background:#fff;border:1px solid var(--border-subtle);border-radius:6px;padding:12px;min-height:350px;">
            <div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px;">Cargando vista previa de la hoja de cálculo...</div>
          </div>
        </div>
      `;

      setTimeout(async () => {
        try {
          if (typeof XLSX !== "undefined") {
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array" });
            const previewEl = document.getElementById("modalExcelPreviewContainer");
            if (previewEl && wb && wb.SheetNames && wb.SheetNames.length > 0) {
              const firstSheetName = wb.SheetNames[0];
              const htmlTable = XLSX.utils.sheet_to_html(wb.Sheets[firstSheetName]);
              previewEl.innerHTML = `
                <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;font-weight:700;">
                  Hoja activa: <strong>${firstSheetName}</strong> (${wb.SheetNames.length} hojas en el libro)
                </div>
                <div style="max-height:55vh;overflow:auto;font-size:11.5px;">
                  ${htmlTable}
                </div>
              `;
            }
          }
        } catch (eXlsx) {
          const previewEl = document.getElementById("modalExcelPreviewContainer");
          if (previewEl) {
            previewEl.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);">Vista previa no disponible para este archivo. Puede descargarlo directamente usando el botón superior.</div>`;
          }
        }
      }, 50);
    } else {
      // Documento de texto u otros formatos
      viewerHtml = `
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="background:var(--color-bg-alt);padding:10px 16px;border-radius:8px;display:flex;align-items:center;justify-content:space-between;border:1px solid var(--border-subtle);">
            <div style="font-size:13px;font-weight:700;color:var(--color-primary);">📄 Archivo: ${fileName} (${sizeKb})</div>
            <a href="${fileUrl}" download="${fileName}" class="btn-secondary" style="padding:4px 10px;font-size:11px;text-decoration:none;">Descargar Archivo</a>
          </div>
          <iframe src="${fileUrl}" class="doc-viewer-frame" title="${fileName}"></iframe>
        </div>
      `;
    }

    modalBody.innerHTML = supervisorDecisionBarHtml + viewerHtml;
    modal.classList.add("active");
  },

  /**
   * Renderiza la lista numérica unificada del 1 al 27 en el contenedor de Fase 2
   */
  renderDocumentalMatrix(auditResult, container, filter = "ALL", projectId = null) {
    if (!container) return;
    this.currentFilter = filter;
    container.innerHTML = "";

    const items = auditResult.items || [];
    let filteredItems = items;
    if (filter === "CONFORMES") {
      filteredItems = items.filter(i => i.conforme);
    } else if (filter === "SUBSANAR") {
      filteredItems = items.filter(i => !i.conforme);
    }

    const cardEl = document.createElement("div");
    cardEl.className = "documental-matrix-card";

    const totalItems = (auditResult && auditResult.totalItems) || 27;
    const isRecursos = totalItems === 28;

    const pId = projectId || (typeof App !== "undefined" && App.currentProjectId);
    const exp = (window.proyectosAuditados && window.proyectosAuditados[pId]) ||
                (window.SIPRO_DATA && SIPRO_DATA.expedientesMap && SIPRO_DATA.expedientesMap[pId]) ||
                App.currentAuditRecord;
    const processMode = (exp && exp.procesoEspecial) || (exp && exp.datos && exp.datos.procesoEspecial) || (window.App && window.App.currentProcessMode) || (window.SIPRO_PROCESS_MODE) || "ORDINARIO";
    const is2026_2 = processMode === "2026_2" || processMode === "CONVENIOS_2026_2" || totalItems === 41;
    const fichaData = (exp && exp.fichaPriorizacion) || (exp && exp.datos && exp.datos.fichaPriorizacion) || {};
    const fichaExiste = Boolean(fichaData && fichaData.existe);
    const fichaFileName = (fichaData && fichaData.fileName) || "Sin archivo";
    const pCurrent = (window.App && App.currentProject) || (exp && exp.datos) || {};
    const revFicha = (pCurrent.revisionSupervisor && pCurrent.revisionSupervisor["FICHA_PRIORIZACION"])
                  || (exp && exp.revisionSupervisor && exp.revisionSupervisor["FICHA_PRIORIZACION"])
                  || null;
    const fichaInconforme = revFicha && (revFicha.estado === "NO_CONFORME" || revFicha.estado === "INCONFORME");

    const headerTitle = is2026_2
      ? `Lista de Chequeo de Viabilidad Técnica - Convenios "2026 - II" (Ítems 1 al ${totalItems})`
      : `Lista Numérica de Verificación Documental (Ítems 1 al ${totalItems})`;

    const headerSubtitle = is2026_2
      ? `Cotejo estricto de los 41 requisitos de Viabilidad Técnica según la Dirección de Estructuración de Proyectos. En este proceso especial no se exige Ficha de Priorización. Haga clic en <b>Abrir</b> para ver o en <b>Subsanar</b> para cargar un documento de reemplazo.`
      : `Cotejo estricto de los ${totalItems} requisitos ${isRecursos ? '(incluye Presupuesto Oficial en Modalidad RECURSOS)' : ''} según la documentación del expediente. Haga clic en <b>Abrir</b> para ver o en <b>Subsanar</b> para cargar un documento de reemplazo.`;

    const bannerHtml = is2026_2 ? `
      <!-- BARRA INFORMATIVA PROCESO ESPECIAL CONVENIOS 2026 - II (SIN FICHA DE PRIORIZACIÓN) -->
      <div class="ficha-priorizacion-banner" style="background:var(--color-bg-alt);border:1px solid #0284c7;border-left:5px solid #0284c7;border-radius:8px;padding:12px 18px;margin:14px 0 16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <span style="font-size:22px;">⚡</span>
          <div>
            <div style="font-size:13.5px;font-weight:800;color:var(--color-primary);">Proceso Especial Transitorio: Convenios "2026 - II"</div>
            <div style="font-size:11.5px;color:var(--text-muted);">Lista oficial de 41 requisitos de Viabilidad Técnica (Dirección de Estructuración). En este proceso no se exige Ficha de Priorización territorial.</div>
          </div>
          <span class="status-pill cumple" style="font-size:11.5px;padding:3px 10px;">
            ✓ 41 Requisitos Normativos
          </span>
        </div>
      </div>
    ` : `
      <!-- BARRA DE ESTADO DEL DOCUMENTO BASE (FICHA DE PRIORIZACIÓN) -->
      <div class="ficha-priorizacion-banner" style="background:var(--color-bg-alt);border:1px solid var(--border-subtle);border-radius:8px;padding:12px 18px;margin:14px 0 16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <span style="font-size:20px;">📋</span>
          <div>
            <div style="font-size:13px;font-weight:800;color:var(--color-primary);">Ficha de Priorización (Documento Maestro del Expediente)</div>
            <div style="font-size:11px;color:var(--text-muted);">Documento base suscrito por las autoridades territoriales con el acta de cierre y 27 anexos.</div>
          </div>
          ${fichaExiste ? `
            <span class="status-pill ${fichaInconforme ? 'no-cumple' : 'cumple'}" style="font-size:11.5px;padding:3px 10px;${fichaInconforme ? 'background:#fee2e2;color:#991b1b;border:1px solid #ef4444;' : ''}">
              ${fichaInconforme ? '✗ Ficha Marcada No Conforme (Supervisor)' : `✓ Ficha detectada: <strong>${fichaFileName}</strong>`}
            </span>
          ` : `
            <span class="status-pill no-cumple" style="font-size:11.5px;padding:3px 10px;background:#fee2e2;color:#991b1b;border:1px solid #f87171;">
              ✗ Ficha de Priorización No Encontrada
            </span>
          `}
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          ${fichaExiste ? `
            <button class="btn-primary" style="padding:4px 12px;font-size:11px;background:#0284C7;display:inline-flex;align-items:center;gap:4px;" onclick="DocumentalEngine.abrirFichaPriorizacion()" title="Abrir y visualizar la Ficha de Priorización en visor modal">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              <span>👁️ Ver Ficha</span>
            </button>
            <button class="btn-subsanar" style="font-size:11px;padding:4px 10px;" onclick="App.subirFichaPriorizacion()" title="Reemplazar o volver a cargar la Ficha de Priorización">
              <span>📤 Cambiar Ficha</span>
            </button>
            <button type="button" class="btn-supervisor-action ${fichaInconforme ? 'btn-supervisor-conforme' : 'btn-supervisor-inconforme'}"
                    style="font-size:11px;padding:4px 10px;"
                    onclick="${fichaInconforme ? 'DocumentalEngine.marcarConformeSupervisor(\'FICHA_PRIORIZACION\')' : 'DocumentalEngine.solicitarInconformidad(\'FICHA_PRIORIZACION\')'}"
                    title="${fichaInconforme ? 'Revalidar Ficha de Priorización como Conforme' : 'Marcar Ficha de Priorización como Inconforme tras revisión del supervisor'}">
              <span>${fichaInconforme ? '✓ Marcar Ficha Conforme' : '⚠️ Marcar Ficha Inconforme'}</span>
            </button>
          ` : `
            <button class="btn-subsanar" style="font-size:11px;padding:5px 14px;background:#dc2626;color:#fff;border-color:#b91c1c;" onclick="App.subirFichaPriorizacion()" title="Cargar archivo de la Ficha de Priorización">
              <span>📤 Subir Ficha de Priorización</span>
            </button>
          `}
        </div>
      </div>
    `;

    cardEl.innerHTML = `
      <div class="documental-header">
        <div>
          <h3 style="font-size: 16px; font-weight: 800; color: var(--color-primary); margin: 0 0 4px 0;">
            ${headerTitle}
          </h3>
          <p style="font-size: 12px; color: var(--text-muted); margin: 0;">
            ${headerSubtitle}
          </p>
        </div>
        <div style="display:flex; align-items:center; gap: 8px;">
          <span class="status-pill ${auditResult.aprobado ? 'cumple' : 'alerta'}">
            ${auditResult.itemsConformes} de ${totalItems} Conformes (${auditResult.porcentajeConformidad}%)
          </span>
          ${auditResult.itemsNoConformes > 0 ? `
            <span class="status-pill no-cumple">
              ${auditResult.itemsNoConformes} por Subsanar / Faltantes
            </span>
          ` : ''}
        </div>
      </div>

      ${bannerHtml}

      <div class="table-responsive">
        <table class="data-table documental-table" style="table-layout: auto; width: 100%;">
          <thead>
            <tr>
              <th style="width: 45px; text-align: center;">N°</th>
              <th>Documento Requerido</th>
              <th style="text-align: center; width: 125px; white-space: nowrap;">Estado</th>
              <th>Archivo Detectado en Carpeta</th>
              <th style="text-align: center; width: 160px; white-space: nowrap;">Acciones</th>
              <th>Regla de Validación / Vigencia</th>
              <th>Entidad Emisora</th>
              <th>Observación de Auditoría</th>
            </tr>
          </thead>
          <tbody>
            ${filteredItems.map(item => `
              <tr class="${item.conforme ? '' : 'row-danger'}">
                <td class="font-mono font-bold" style="text-align: center; color: var(--color-primary); font-size: 13px;">
                  ${item.num}
                </td>
                <td>
                  <strong style="color: var(--text-main); font-size: 13px;">${item.title}</strong>
                  ${item.soloRecursos ? '<span style="margin-left:6px;font-size:10px;background:rgba(217,119,6,0.15);color:#D97706;padding:1px 5px;border-radius:4px;font-weight:800;">RECURSOS</span>' : ''}
                </td>
                <td style="text-align: center; white-space: nowrap;">
                  ${item.estadoSupervisor === "NO_CONFORME" ? `
                    <span class="status-pill no-cumple" style="white-space: nowrap; background:#fee2e2; color:#991b1b; border:1px solid #ef4444; font-weight:700;" title="${item.observacionSupervisor || 'Documento no conforme por decisión del supervisor'}">
                      &#10007; Inconforme (Sup)
                    </span>
                  ` : (item.estadoSupervisor === "CONFORME" ? `
                    <span class="status-pill cumple" style="white-space: nowrap; background:#dcfce7; color:#166534; border:1px solid #22c55e; font-weight:700;" title="${item.observacionSupervisor || 'Verificado y aprobado por el supervisor'}">
                      &#10003; Conforme (Sup)
                    </span>
                  ` : `
                    <span class="status-pill ${item.conforme ? 'cumple' : (item.vencido ? 'alerta' : 'no-cumple')}" style="white-space: nowrap; ${item.vencido ? 'background:#fef3c7;color:#92400e;border:1px solid #f59e0b;font-weight:700;' : ''}">
                      ${item.conforme ? '&#10003; Conforme' : (item.vencido ? '&#9888; Vigencia Vencida' : (item.faltante ? '&#10007; Faltante' : '&#10007; Subsanar'))}
                    </span>
                  `)}
                  ${item.fechaDocStr ? `
                    <div style="font-size:10.5px;color:${item.vencido ? '#b45309' : '#059669'};font-weight:700;margin-top:3px;" title="Fecha de expedición detectada">
                      Exp: ${item.fechaDocStr}
                    </div>
                  ` : (DocumentalEngine.isVigenciaMensual(item.id, processMode) && item.archivoDetectado ? `
                    <div style="font-size:10px;color:#dc2626;font-weight:600;margin-top:3px;" title="No se detectó fecha en el texto ni metadatos">
                      Fecha no detectada
                    </div>
                  ` : '')}
                </td>
                <td>
                  ${item.archivoDetectado ? `
                    <span class="file-tag-badge" style="cursor:pointer;" title="Clic para abrir y ver este documento" onclick="DocumentalEngine.abrirDocumento(${item.id})">
                      📄 ${item.archivoDetectado.length > 28 ? item.archivoDetectado.slice(0, 26) + '...' : item.archivoDetectado}
                      <span style="font-size:10px;opacity:0.8;margin-left:2px">👁️</span>
                    </span>
                  ` : `
                    <span style="font-size:11px;color:#DC2626;font-weight:700;display:inline-flex;align-items:center;gap:4px">
                      ⚠️ No aportado
                    </span>
                  `}
                </td>
                <td style="text-align: center; white-space: nowrap;">
                  <div class="doc-actions-wrap" style="display: inline-flex; flex-direction: row; flex-wrap: nowrap; align-items: center; justify-content: center; gap: 6px; white-space: nowrap;">
                    ${item.archivoDetectado ? `
                      <button class="btn-primary" style="padding:4px 10px;font-size:11px;background:#0284C7;display:inline-flex;align-items:center;gap:4px;box-shadow:0 1px 3px rgba(2,132,199,0.3);white-space:nowrap;flex-shrink:0;" onclick="DocumentalEngine.abrirDocumento(${item.id})" title="Abrir y previsualizar este documento">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        <span style="white-space:nowrap;">Abrir</span>
                      </button>
                    ` : ''}
                    <button class="btn-subsanar" style="white-space:nowrap;flex-shrink:0;" onclick="App.subirSubsanacionItem(${item.id})" title="Cargar documento enviado por el municipio para subsanar o actualizar este ítem">
                      <span style="white-space:nowrap;">📤 Subsanar</span>
                    </button>
                    <button type="button" class="btn-secondary" style="white-space:nowrap;flex-shrink:0;padding:4px 8px;font-size:11px;font-weight:700;background:rgba(2,132,199,0.08);color:#0284c7;border:1px solid rgba(2,132,199,0.3);border-radius:4px;cursor:pointer;display:inline-flex;align-items:center;gap:3px;" onclick="DocumentalEngine.abrirModalAsignarArchivo(${item.id})" title="Asignar un archivo que ya se encuentra en la carpeta del proyecto (subcarpetas o documento compartido)">
                      <span>📁 Asignar</span>
                    </button>
                    ${item.conforme ? `
                      <button type="button" class="btn-supervisor-action btn-supervisor-inconforme"
                              onclick="DocumentalEngine.solicitarInconformidad('${item.id}')"
                              title="Marcar este documento como Inconforme tras la inspección del supervisor">
                        <span style="font-size:11px;">⚠️</span>
                        <span>Inconforme</span>
                      </button>
                    ` : `
                      <button type="button" class="btn-supervisor-action btn-supervisor-conforme"
                              onclick="DocumentalEngine.marcarConformeSupervisor('${item.id}')"
                              title="Aprobar o revalidar este documento como Conforme">
                        <span style="font-size:11px;">✓</span>
                        <span>Conforme</span>
                      </button>
                      ${item.estadoSupervisor === "NO_CONFORME" ? `
                        <button type="button" class="btn-secondary"
                                style="padding:4px 6px;font-size:11px;border-radius:4px;flex-shrink:0;"
                                onclick="DocumentalEngine.solicitarInconformidad('${item.id}')"
                                title="Editar observación técnica del supervisor">
                          <span>✏️</span>
                        </button>
                      ` : ''}
                    `}
                  </div>
                </td>
                <td>
                  ${DocumentalEngine.isVigenciaMensual(item.id, processMode) ? `
                    <div style="font-size:11px;font-weight:700;color:var(--color-primary);margin-bottom:3px;display:flex;align-items:center;gap:4px;">
                      <span>📅</span> Mes en curso (${DocumentalEngine.NOMBRES_MESES[new Date().getMonth()]} de ${new Date().getFullYear()})
                    </div>
                    <div style="font-size:10px;color:var(--text-muted);line-height:1.35;">${item.rule}</div>
                  ` : `
                    <span style="font-size:11px;color:var(--text-muted);line-height:1.35;">${item.rule}</span>
                  `}
                </td>
                <td style="font-size:11px;color:var(--text-muted)">
                  ${item.entity}
                </td>
                <td>
                  ${item.estadoSupervisor === "NO_CONFORME" ? `
                    <div style="font-size: 11px; line-height: 1.35;">
                      <div style="background: rgba(239, 68, 68, 0.08); border-left: 3px solid #dc2626; padding: 4px 8px; border-radius: 4px; color: #991b1b; font-weight: 600; margin-bottom: 2px;">
                        <span style="font-weight: 800;">⚠️ Observación del Supervisor:</span>
                        ${item.observacionSupervisor || 'No cumple con las especificaciones técnicas requeridas.'}
                      </div>
                      ${item.fechaRevisionSupervisor ? `
                        <div style="font-size: 9.5px; color: var(--text-muted);">
                          Revisado: ${item.fechaRevisionSupervisor}
                        </div>
                      ` : ''}
                    </div>
                  ` : (item.estadoSupervisor === "CONFORME" ? `
                    <div style="font-size: 11px; color: #166534; line-height: 1.35;">
                      <span style="background: rgba(34, 197, 94, 0.12); border-left: 3px solid #16a34a; padding: 2px 6px; border-radius: 3px; font-weight: 600; display: inline-block;">
                        ✓ Aprobado por el Supervisor
                      </span>
                      ${item.observacionSupervisor ? `<div style="font-size: 10.5px; margin-top: 2px;">${item.observacionSupervisor}</div>` : ''}
                    </div>
                  ` : `
                    <span class="${item.conforme ? 'text-muted' : 'criterio-tag'}" style="font-size: 11px;">
                      ${item.observacion}
                    </span>
                  `)}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div style="padding: 14px 20px; background: var(--bg-subtle); border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-muted); flex-wrap:wrap; gap:10px;">
        <div>
          Criterio vinculante: Todos los ${totalItems} ítems deben estar aportados y vigentes para aprobar la Fase 2${is2026_2 ? ' y emitir el Concepto Técnico de Viabilidad.' : ' y viabilizar la Ficha de Priorización.'}
        </div>
      </div>
    `;

    container.appendChild(cardEl);
  },

  /**
   * Despliega la ficha de auditoría y cotejo normativo del ítem
   */
  openItemModal(itemId) {
    const pId = App.currentProjectId;
    const exp = (window.proyectosAuditados && window.proyectosAuditados[pId]) ||
                (window.SIPRO_DATA && SIPRO_DATA.expedientesMap && SIPRO_DATA.expedientesMap[pId]) ||
                App.currentAuditRecord;
    const processMode = (exp && exp.procesoEspecial) || (exp && exp.datos && exp.datos.procesoEspecial) || (App && App.currentProcessMode) || window.SIPRO_PROCESS_MODE || "ORDINARIO";
    const is2026_2 = processMode === "2026_2" || processMode === "CONVENIOS_2026_2" || itemId > 28;
    const baseItem = is2026_2
      ? ((SIPRO_DATA.items41_2026_2 && SIPRO_DATA.items41_2026_2.find(i => Number(i.id) === Number(itemId))) || SIPRO_DATA.items27.find(i => Number(i.id) === Number(itemId)))
      : (SIPRO_DATA.items27.find(i => Number(i.id) === Number(itemId)) || (SIPRO_DATA.items41_2026_2 && SIPRO_DATA.items41_2026_2.find(i => Number(i.id) === Number(itemId))));
    if (!baseItem) return;

    const auditedItem = (exp && exp.fase2 && exp.fase2.items) ? exp.fase2.items.find(i => Number(i.id) === Number(itemId)) : null;
    const item = { ...baseItem, ...(auditedItem || {}) };

    const modal = document.getElementById("documentModal");
    const modalWin = document.getElementById("documentModalWindow") || (modal ? modal.querySelector(".modal-window") : null);
    const modalTitle = document.getElementById("modalDocTitle");
    const modalBody = document.getElementById("modalDocBody");
    const openTabBtn = document.getElementById("modalDocOpenTabBtn");
    const downloadBtn = document.getElementById("modalDocDownloadBtn");
    const statusBadge = document.getElementById("modalDocStatusBadge");
    const footerMeta = document.getElementById("modalDocFooterMeta");

    if (!modal || !modalTitle || !modalBody) return;

    // Resetear a tamaño estándar si estaba en visor grande
    if (modalWin) modalWin.classList.remove("modal-xl");

    const p = App.currentProject || (exp && exp.datos) || {};
    const detectedFile = (item && item.archivoDetectado)
      || (p.documentosStatus && p.documentosStatus.archivosDetectados && (p.documentosStatus.archivosDetectados[itemId] || p.documentosStatus.archivosDetectados[String(itemId)]))
      || null;
    const meta = (item && item.meta) || (p.archivosMetadata && (p.archivosMetadata[itemId] || p.archivosMetadata[String(itemId)])) || null;
    const file = this.getFileForItem(itemId);

    modalTitle.innerHTML = `Ítem ${item.num}: ${item.title}`;

    if (openTabBtn) openTabBtn.style.display = "none";
    if (downloadBtn) downloadBtn.style.display = "none";
    if (statusBadge) {
      statusBadge.style.display = "inline-flex";
      if (!detectedFile) {
        statusBadge.className = "status-pill no-cumple";
        statusBadge.innerHTML = "&#10007; No Aportado";
      } else if (item.vencido) {
        statusBadge.className = "status-pill alerta";
        statusBadge.style.cssText = "display:inline-flex;background:#fef3c7;color:#92400e;border:1px solid #f59e0b;font-weight:700;";
        statusBadge.innerHTML = "&#9888; Vigencia Vencida";
      } else {
        statusBadge.className = "status-pill cumple";
        statusBadge.innerHTML = "&#10003; Aportado y Vigente";
      }
    }
    if (footerMeta) {
      footerMeta.innerHTML = `<span style="font-weight:700">Municipio:</span> ${p.municipio || 'Expediente'}`;
    }

    if (!detectedFile) {
      modalBody.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div style="background:rgba(239, 68, 68, 0.08);border:1px solid rgba(239, 68, 68, 0.3);padding:16px;border-radius:var(--radius-md);">
            <div style="color:#DC2626;font-weight:800;font-size:14px;display:flex;align-items:center;gap:8px;">
              ⚠️ DOCUMENTO FALTANTE EN EL EXPEDIENTE
            </div>
            <p style="font-size:13px;color:var(--text-main);margin:8px 0 0 0;line-height:1.5;">
              La carpeta del expediente municipal actualmente evaluada (<b>${p.municipio}</b>) no contiene ningún archivo correspondiente al <b>Ítem ${item.num}</b>.
            </p>
          </div>

          <div style="background:var(--color-bg-alt);padding:16px;border-radius:var(--radius-md);border:1px solid var(--border-subtle)">
            <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase">Regla de Validación Normativa</div>
            <div style="font-size:13px;color:var(--text-main);font-weight:600;margin-top:4px">${item.rule}</div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px">
            <div style="background:var(--color-surface);border:1px solid var(--border-strong);padding:12px;border-radius:var(--radius-sm)">
              <div style="font-size:10px;font-weight:700;color:var(--text-light);text-transform:uppercase">Entidad Emisora</div>
              <div style="font-size:13px;font-weight:700">${item.entity}</div>
            </div>
            <div style="background:var(--color-surface);border:1px solid var(--border-strong);padding:12px;border-radius:var(--radius-sm)">
              <div style="font-size:10px;font-weight:700;color:var(--text-light);text-transform:uppercase">Vigencia Exigida</div>
              <div style="font-size:13px;font-weight:700">${item.validity}</div>
            </div>
          </div>

          <div style="background:rgba(2,132,199,0.06);border:1px solid rgba(2,132,199,0.2);padding:14px;border-radius:var(--radius-sm);font-size:12px;color:var(--text-main);">
            <b>Acción de Subsanación Requerida:</b> Debe solicitarse al municipio de <b>${p.municipio}</b> que anexe este documento a la carpeta del proyecto para superar la compuerta de Fase 2.
            <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
              <button type="button" class="btn-primary" style="padding:6px 14px;font-size:12px;background:#0284c7;border-color:#0284c7;display:inline-flex;align-items:center;gap:6px;" onclick="DocumentalEngine.closeModal(); DocumentalEngine.abrirModalAsignarArchivo(${itemId})">
                📁 Asignar archivo existente de la carpeta
              </button>
              <button type="button" class="btn-secondary" style="padding:6px 14px;font-size:12px;" onclick="DocumentalEngine.closeModal(); App.subirSubsanacionItem(${itemId})">
                📤 Cargar archivo nuevo
              </button>
            </div>
          </div>
        </div>
      `;
    } else {
      const sizeKb = meta ? (meta.sizeBytes / 1024).toFixed(1) + " KB" : "Disponible en carpeta";
      const modDate = meta && meta.lastModified ? new Date(meta.lastModified).toLocaleDateString("es-CO") : "Reciente";
      const snippet = meta && meta.textSnippet ? meta.textSnippet.slice(0, 320) + "..." : "Texto procesado por PDF.js sin anomalías.";

      modalBody.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div style="${item.vencido ? 'background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);' : 'background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);'}padding:14px 18px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
            <div>
              <div style="font-size:11px;font-weight:700;color:${item.vencido ? '#b45309' : '#047857'};text-transform:uppercase">${item.vencido ? '⚠️ Vigencia Vencida' : 'Archivo Aportado y Cotejado'}</div>
              <div style="font-size:14px;font-weight:800;color:var(--color-primary);margin-top:2px">📄 ${detectedFile}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <span class="status-pill ${item.conforme ? 'cumple' : (item.vencido ? 'alerta' : 'no-cumple')}" style="${item.vencido ? 'background:#fef3c7;color:#92400e;border:1px solid #f59e0b;font-weight:700;' : ''}">
                ${item.conforme ? '&#10003; Conforme' : (item.vencido ? '⚠️ Vigencia Vencida' : '&#10007; Subsanar')}
              </span>
              ${file ? `
                <button class="btn-primary" style="background:#0284C7;padding:6px 14px;font-size:12px;display:inline-flex;align-items:center;gap:6px;" onclick="DocumentalEngine.abrirDocumento(${itemId})">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  Abrir Documento
                </button>
              ` : ''}
              <button type="button" class="btn-secondary" style="padding:6px 12px;font-size:12px;display:inline-flex;align-items:center;gap:4px;" onclick="DocumentalEngine.closeModal(); DocumentalEngine.abrirModalAsignarArchivo(${itemId})" title="Cambiar o reasignar a otro archivo de la carpeta">
                📁 Reasignar
              </button>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:10px">
            <div style="background:var(--color-surface);border:1px solid var(--border-strong);padding:10px;border-radius:var(--radius-sm)">
              <div style="font-size:10px;font-weight:700;color:var(--text-light);text-transform:uppercase">Tamaño Archivo</div>
              <div style="font-size:12px;font-weight:700">${sizeKb}</div>
            </div>
            <div style="background:var(--color-surface);border:1px solid var(--border-strong);padding:10px;border-radius:var(--radius-sm)">
              <div style="font-size:10px;font-weight:700;color:var(--text-light);text-transform:uppercase">Fecha Expedición</div>
              <div style="font-size:12px;font-weight:700;${item.vencido ? 'color:#b45309;' : 'color:#059669;'}">${item.fechaDocStr || (DocumentalEngine.ITEMS_VIGENCIA_MENSUAL.includes(Number(itemId)) ? 'Fecha no detectada' : modDate)}</div>
            </div>
            <div style="background:var(--color-surface);border:1px solid var(--border-strong);padding:10px;border-radius:var(--radius-sm)">
              <div style="font-size:10px;font-weight:700;color:var(--text-light);text-transform:uppercase">Vigencia Exigida</div>
              <div style="font-size:12px;font-weight:700;color:var(--color-primary);">${DocumentalEngine.ITEMS_VIGENCIA_MENSUAL.includes(Number(itemId)) ? `Mes en curso (${DocumentalEngine.NOMBRES_MESES[new Date().getMonth()]} ${new Date().getFullYear()})` : item.validity}</div>
            </div>
          </div>

          <div style="background:var(--color-bg-alt);padding:14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle)">
            <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase">Regla Normativa Exigida</div>
            <div style="font-size:12px;color:var(--text-main);margin-top:4px">${item.rule}</div>
          </div>

          ${item.vencido ? `
            <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);padding:12px 16px;border-radius:var(--radius-sm);font-size:12px;color:#991b1b;">
              <b>⚠️ Criterio de Rechazo:</b> Este documento fue expedido el <b>${item.fechaDocStr || 'fecha no detectada'}</b> y no corresponde al mes de revisión en curso (<b>${DocumentalEngine.NOMBRES_MESES[new Date().getMonth()]} de ${new Date().getFullYear()}</b>). Para subsanar, adjunte un certificado expedido durante el mes en curso.
            </div>
          ` : (DocumentalEngine.ITEMS_VIGENCIA_MENSUAL.includes(Number(itemId)) && item.conforme ? `
            <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.3);padding:12px 16px;border-radius:var(--radius-sm);font-size:12px;color:#065f46;">
              <b>✓ Criterio de Vigencia Superado:</b> Expedido el <b>${item.fechaDocStr}</b> dentro del mes de revisión en curso (<b>${DocumentalEngine.NOMBRES_MESES[new Date().getMonth()]} de ${new Date().getFullYear()}</b>).
            </div>
          ` : '')}

          ${(itemId === 1 && (p.alcalde && (p.alcalde.nombre || typeof p.alcalde === 'string'))) ? `
            <div style="background:rgba(5, 150, 105, 0.08);border:1px solid rgba(5, 150, 105, 0.25);padding:10px 14px;border-radius:var(--radius-sm);font-size:12px;color:var(--text-main);display:flex;align-items:center;gap:8px;">
              <span>🏛️</span>
              <div>
                <b>Alcalde(sa) Municipal Identificado(a):</b> ${typeof p.alcalde === 'string' ? p.alcalde : p.alcalde.nombre} ${(p.alcalde && p.alcalde.cargo) ? `(${p.alcalde.cargo})` : ''} ${(p.alcalde && p.alcalde.origen) ? `<span style="font-size:10px;color:var(--color-primary);margin-left:6px;background:rgba(2,132,199,0.08);padding:1px 6px;border-radius:4px;border:1px solid rgba(2,132,199,0.2);" title="${p.alcalde.origen}">ℹ️ ${p.alcalde.origen}</span>` : ''}
              </div>
            </div>
          ` : ''}

          ${((itemId === 1 || itemId === 2) && (p.secretarioPlaneacion && (p.secretarioPlaneacion.nombre || typeof p.secretarioPlaneacion === 'string'))) ? `
            <div style="background:rgba(2, 132, 199, 0.08);border:1px solid rgba(2, 132, 199, 0.25);padding:10px 14px;border-radius:var(--radius-sm);font-size:12px;color:var(--text-main);display:flex;align-items:center;gap:8px;">
              <span>📐</span>
              <div>
                <b>Secretario(a) de Planeación / Obras Públicas:</b> ${typeof p.secretarioPlaneacion === 'string' ? p.secretarioPlaneacion : p.secretarioPlaneacion.nombre} ${(p.secretarioPlaneacion && p.secretarioPlaneacion.cargo) ? `(${p.secretarioPlaneacion.cargo})` : ''} ${(p.secretarioPlaneacion && p.secretarioPlaneacion.origen) ? `<span style="font-size:10px;color:var(--color-primary);margin-left:6px;background:rgba(2,132,199,0.08);padding:1px 6px;border-radius:4px;border:1px solid rgba(2,132,199,0.2);" title="${p.secretarioPlaneacion.origen}">ℹ️ ${p.secretarioPlaneacion.origen}</span>` : ''}
              </div>
            </div>
          ` : ''}

          <div style="border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:14px;background:var(--color-surface)">
            <div style="font-size:11px;font-weight:800;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase">Extracto Digital de Contenido (PDF.js):</div>
            <div style="font-family:var(--font-mono);font-size:11px;background:var(--color-bg-alt);padding:10px;border-radius:var(--radius-sm);color:var(--text-main);line-height:1.5;max-height:120px;overflow-y:auto">
              ${snippet}
            </div>
          </div>
        </div>
      `;
    }

    modal.classList.add("active");
  },

  /**
   * Asegura la existencia del modal de observación del supervisor en el DOM
   */
  ensureSupervisorModal() {
    let modal = document.getElementById("supervisorObservationModal");
    if (modal) return modal;

    const modalHtml = `
      <div id="supervisorObservationModal" class="modal-overlay">
        <div class="modal-window" style="max-width: 620px;">
          <div class="modal-header" style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-bottom: 1px solid #fecaca;">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="width:36px; height:36px; border-radius:50%; background:#dc2626; color:#fff; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:bold; box-shadow:0 2px 6px rgba(220,38,38,0.25);">
                ⚠️
              </div>
              <div>
                <h4 class="modal-title" style="color:#991b1b; font-size:16px; margin:0;">Declarar Inconformidad Documental / Técnica</h4>
                <p style="font-size:12px; color:#b91c1c; margin:2px 0 0 0;">Criterio y observación directa del supervisor para el informe de subsanación</p>
              </div>
            </div>
            <button type="button" class="btn-viewer-close-circle" title="Cerrar ventana" onclick="DocumentalEngine.closeSupervisorModal()">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="modal-body" style="padding:20px; display:flex; flex-direction:column; gap:14px;">
            <input type="hidden" id="supObsItemId" value="">
            <input type="hidden" id="supObsFromViewer" value="false">

            <div style="background:var(--color-bg-alt); padding:12px 14px; border-radius:8px; border:1px solid var(--border-subtle); display:flex; flex-direction:column; gap:4px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span id="supObsItemNum" style="font-size:12px; font-weight:800; color:var(--color-primary); text-transform:uppercase;">Ítem --</span>
                <span id="supObsDocBadge" class="status-pill alerta" style="font-size:11px;">Documento Analizado</span>
              </div>
              <div id="supObsItemTitle" style="font-size:13px; font-weight:700; color:var(--text-main); line-height:1.4;">--</div>
              <div id="supObsDetectedFile" style="font-size:11.5px; color:var(--text-muted); font-family:var(--font-mono); margin-top:2px;">📄 Archivo: --</div>
            </div>

            <div>
              <label class="form-label" style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px; display:block;">
                ⚡ Causales frecuentes de no conformidad (clic para aplicar):
              </label>
              <div style="display:flex; flex-wrap:wrap; gap:6px;">
                <button type="button" class="btn-preset-cause" onclick="DocumentalEngine.aplicarCausalRapida('Documento sin firma legible o sin matrícula profesional vigente del profesional responsable.')">
                  ✍️ Falta firma / matrícula
                </button>
                <button type="button" class="btn-preset-cause" onclick="DocumentalEngine.aplicarCausalRapida('No corresponde a la localización, tramo veredal o abscisado del proyecto viabilizado.')">
                  📍 Tramo / Vereda incorrecto
                </button>
                <button type="button" class="btn-preset-cause" onclick="DocumentalEngine.aplicarCausalRapida('Incompleto: carece de anexos técnicos, memorias de soporte o firmas requeridas.')">
                  📑 Documento incompleto
                </button>
                <button type="button" class="btn-preset-cause" onclick="DocumentalEngine.aplicarCausalRapida('Discrepancia en cantidades o especificaciones frente al presupuesto y despiece oficial.')">
                  ⚖️ Discrepancia de cantidades
                </button>
                <button type="button" class="btn-preset-cause" onclick="DocumentalEngine.aplicarCausalRapida('Certificado o documento expedido fuera de la vigencia exigida (no corresponde al mes en curso).')">
                  📅 Vigencia vencida
                </button>
                <button type="button" class="btn-preset-cause" onclick="DocumentalEngine.aplicarCausalRapida('El contenido del archivo no corresponde al objeto técnico del requisito documental solicitado.')">
                  🔍 Contenido no coincide
                </button>
              </div>
            </div>

            <div class="form-group" style="margin:0;">
              <label class="form-label" for="supObsTextarea" style="font-weight:700; font-size:12.5px;">
                Observación / Hallazgo del Supervisor (se reflejará en el Informe Oficial de Subsanación): <span style="color:#dc2626;">*</span>
              </label>
              <textarea id="supObsTextarea" class="form-input" rows="4" style="resize:vertical; min-height:85px; font-size:12.5px; line-height:1.45;" placeholder="Describa puntualmente por qué el documento no se acepta o qué ajuste se requiere para subsanar..."></textarea>
            </div>
          </div>

          <div class="modal-footer" style="padding:14px 20px; border-top:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center; background:#fafafa;">
            <button type="button" class="btn-secondary" onclick="DocumentalEngine.closeSupervisorModal()">Cancelar</button>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn-primary" style="background:#dc2626; border-color:#b91c1c;" onclick="DocumentalEngine.guardarInconformidadModal()">
                ⚠️ Confirmar y Marcar No Conforme
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHtml);
    return document.getElementById("supervisorObservationModal");
  },

  /**
   * Abre el modal para capturar la observación e inconformidad de un ítem
   */
  solicitarInconformidad(itemId, fromViewerModal = false) {
    this.ensureSupervisorModal();
    const modal = document.getElementById("supervisorObservationModal");
    if (!modal) return;

    const pId = App.currentProjectId;
    const exp = (window.proyectosAuditados && window.proyectosAuditados[pId]) ||
                (window.SIPRO_DATA && SIPRO_DATA.expedientesMap && SIPRO_DATA.expedientesMap[pId]) ||
                App.currentAuditRecord;
    const p = App.currentProject || (exp && exp.datos) || {};

    const isFicha = String(itemId) === "ficha_priorizacion" || String(itemId) === "0";
    let numStr = "";
    let titleStr = "";
    let fileStr = "";

    if (isFicha) {
      numStr = "Ficha de Priorización Municipal";
      titleStr = "Ficha de Priorización Municipal y Cierre (Documento Base)";
      const fichaObj = p.fichaPriorizacion || (exp && exp.fichaPriorizacion);
      fileStr = (fichaObj && fichaObj.fileName) ? fichaObj.fileName : "Documento de priorización";
    } else {
      const processMode = (exp && exp.procesoEspecial) || (p && p.procesoEspecial) || (App && App.currentProcessMode) || window.SIPRO_PROCESS_MODE || "ORDINARIO";
      const is2026_2 = processMode === "2026_2" || processMode === "CONVENIOS_2026_2" || Number(itemId) > 28;
      const baseItem = is2026_2
        ? ((SIPRO_DATA.items41_2026_2 && SIPRO_DATA.items41_2026_2.find(i => Number(i.id) === Number(itemId))) || (SIPRO_DATA.items27 && SIPRO_DATA.items27.find(i => Number(i.id) === Number(itemId))))
        : ((SIPRO_DATA.items27 && SIPRO_DATA.items27.find(i => Number(i.id) === Number(itemId))) || (SIPRO_DATA.items41_2026_2 && SIPRO_DATA.items41_2026_2.find(i => Number(i.id) === Number(itemId))));

      const auditedItem = (exp && exp.fase2 && exp.fase2.items) ? exp.fase2.items.find(i => Number(i.id) === Number(itemId)) : null;
      numStr = `Ítem ${baseItem ? (baseItem.num || baseItem.id) : itemId}`;
      titleStr = baseItem ? baseItem.title : `Requisito ${itemId}`;

      const detectedFile = (auditedItem && auditedItem.archivoDetectado)
        || (p.documentosStatus && p.documentosStatus.archivosDetectados && (p.documentosStatus.archivosDetectados[itemId] || p.documentosStatus.archivosDetectados[String(itemId)]))
        || null;
      fileStr = detectedFile ? `Archivo: ${detectedFile}` : "Archivo: No aportado / Pendiente";
    }

    // Setear campos
    const inputItemId = document.getElementById("supObsItemId");
    const inputFromViewer = document.getElementById("supObsFromViewer");
    const elItemNum = document.getElementById("supObsItemNum");
    const elItemTitle = document.getElementById("supObsItemTitle");
    const elDetectedFile = document.getElementById("supObsDetectedFile");
    const textarea = document.getElementById("supObsTextarea");

    if (inputItemId) inputItemId.value = String(itemId);
    if (inputFromViewer) inputFromViewer.value = fromViewerModal ? "true" : "false";
    if (elItemNum) elItemNum.textContent = numStr;
    if (elItemTitle) elItemTitle.textContent = titleStr;
    if (elDetectedFile) elDetectedFile.textContent = `📄 ${fileStr}`;

    // Obtener observación previa si existía
    let prevObs = "";
    if (p.revisionSupervisor && p.revisionSupervisor[itemId] && p.revisionSupervisor[itemId].observacion) {
      prevObs = p.revisionSupervisor[itemId].observacion;
    } else if (p.fase3State && p.fase3State.matrizObservaciones) {
      const key = isFicha ? "FASE_2_FICHA_PRIORIZACION" : `FASE_2_ITEM_${itemId}`;
      if (p.fase3State.matrizObservaciones[key] && p.fase3State.matrizObservaciones[key].motivo) {
        prevObs = p.fase3State.matrizObservaciones[key].motivo;
      }
    }
    if (textarea) {
      textarea.value = prevObs;
      setTimeout(() => textarea.focus(), 100);
    }

    modal.classList.add("active");
  },

  /**
   * Cierra el modal de observación del supervisor
   */
  closeSupervisorModal() {
    const modal = document.getElementById("supervisorObservationModal");
    if (modal) modal.classList.remove("active");
  },

  /**
   * Aplica un texto predefinido al textarea de observación
   */
  aplicarCausalRapida(texto) {
    const textarea = document.getElementById("supObsTextarea");
    if (!textarea) return;
    const current = textarea.value.trim();
    if (current && !current.includes(texto)) {
      textarea.value = current + " " + texto;
    } else {
      textarea.value = texto;
    }
    textarea.focus();
  },

  /**
   * Guarda la inconformidad declarada desde el modal
   */
  guardarInconformidadModal() {
    const inputItemId = document.getElementById("supObsItemId");
    const inputFromViewer = document.getElementById("supObsFromViewer");
    const textarea = document.getElementById("supObsTextarea");

    if (!inputItemId) return;
    const itemId = inputItemId.value;
    const fromViewer = inputFromViewer && inputFromViewer.value === "true";
    const motivo = textarea ? textarea.value.trim() : "";

    if (!motivo) {
      alert("Por favor ingrese o seleccione el motivo de la inconformidad técnica/documental.");
      if (textarea) textarea.focus();
      return;
    }

    this.actualizarEstadoSupervisor(itemId, "NO_CONFORME", motivo, fromViewer);
    this.closeSupervisorModal();
  },

  /**
   * Marca como Conforme un ítem directamente
   */
  marcarConformeSupervisor(itemId, observacion = "") {
    this.actualizarEstadoSupervisor(itemId, "CONFORME", observacion, false);
  },

  /**
   * Marca como Conforme desde el visor de documentos
   */
  marcarConformeDesdeModal(itemId) {
    this.actualizarEstadoSupervisor(itemId, "CONFORME", "", true);
  },

  /**
   * Actualiza el estado de supervisión de un ítem, persistiendo y sincronizando bidireccionalmente
   */
  actualizarEstadoSupervisor(itemId, nuevoEstado, observacion = "", fromModal = false) {
    const pId = App.currentProjectId;
    const exp = (window.proyectosAuditados && window.proyectosAuditados[pId]) ||
                (window.SIPRO_DATA && SIPRO_DATA.expedientesMap && SIPRO_DATA.expedientesMap[pId]) ||
                App.currentAuditRecord;
    const p = App.currentProject || (exp && exp.datos) || {};

    if (!p) {
      console.warn("No hay proyecto activo para calificar por supervisor.");
      return;
    }

    const isFicha = String(itemId) === "ficha_priorizacion" || String(itemId) === "0";
    const rawKey = isFicha ? "ficha_priorizacion" : (typeof itemId === "number" ? itemId : (isNaN(Number(itemId)) ? itemId : Number(itemId)));

    p.revisionSupervisor = p.revisionSupervisor || {};
    p.revisionSupervisor[rawKey] = {
      estado: nuevoEstado,
      observacion: observacion || "",
      fecha: new Date().toISOString(),
      supervisor: window.SUPERVISOR_NAME || "Supervisor Técnico"
    };

    // Sincronizar en exp.revisionSupervisor y SIPRO_DATA si existen
    if (exp) {
      exp.revisionSupervisor = exp.revisionSupervisor || {};
      exp.revisionSupervisor[rawKey] = p.revisionSupervisor[rawKey];
    }
    if (window.SIPRO_DATA && SIPRO_DATA.expedientesMap && SIPRO_DATA.expedientesMap[pId]) {
      SIPRO_DATA.expedientesMap[pId].revisionSupervisor = SIPRO_DATA.expedientesMap[pId].revisionSupervisor || {};
      SIPRO_DATA.expedientesMap[pId].revisionSupervisor[rawKey] = p.revisionSupervisor[rawKey];
    }

    // Sincronizar hacia fase3State.matrizObservaciones
    const obsKey = isFicha ? "FASE_2_FICHA_PRIORIZACION" : `FASE_2_ITEM_${rawKey}`;
    const f3State = (typeof ReportsEngine !== "undefined" && typeof ReportsEngine.getFase3State === "function")
      ? ReportsEngine.getFase3State(pId)
      : (p.fase3State || (p.fase3State = {}));

    if (f3State) {
      f3State.matrizObservaciones = f3State.matrizObservaciones || {};
      f3State.observacionesEditadas = f3State.observacionesEditadas || {};

      const findingObj = {
        estado: nuevoEstado === "CONFORME" ? "Conforme" : "No Aceptado / Por Subsanar",
        motivo: observacion || (nuevoEstado === "CONFORME" ? "Documento verificado y conforme por supervisor." : "Documento no conforme según revisión del supervisor.")
      };

      f3State.matrizObservaciones[obsKey] = findingObj;
      f3State.observacionesEditadas[obsKey] = findingObj;
      if (isFicha) {
        f3State.matrizObservaciones["FICHA_PRIORIZACION"] = findingObj;
        f3State.observacionesEditadas["FICHA_PRIORIZACION"] = findingObj;
      }
    }

    // Re-ejecutar auditoría documental de Fase 2
    if (typeof DocumentalEngine.auditProject === "function") {
      const auditResult = DocumentalEngine.auditProject(p);
      p.auditResult = auditResult;
      if (exp) {
        exp.fase2 = auditResult;
        exp.datos = p;
      }
    }

    // Refrescar KPIs y Compuertas
    if (window.App && typeof window.App.refreshGatesAndKpis === "function") {
      window.App.refreshGatesAndKpis(p);
    }
    if (window.App && typeof window.App.actualizarKPIsEjecutivos === "function") {
      window.App.actualizarKPIsEjecutivos(pId);
    }
    if (window.App && typeof window.App.actualizarBarraCompuertas === "function") {
      window.App.actualizarBarraCompuertas(pId);
    }

    // Re-renderizar la matriz documental
    const container = document.getElementById("documentalMatrixContainer");
    if (container && p.auditResult) {
      DocumentalEngine.renderDocumentalMatrix(p.auditResult, container, DocumentalEngine.currentFilter || "ALL", pId);
    }

    // Si viene desde el visor modal abierto, refrescar el visor para mostrar la barra y estado actualizados
    if (fromModal) {
      const docModal = document.getElementById("documentModal");
      if (docModal && docModal.classList.contains("active")) {
        if (isFicha) {
          DocumentalEngine.abrirFichaPriorizacion(pId, false);
        } else {
          DocumentalEngine.openViewerModal(itemId);
        }
      }
    }

    // Persistir progreso en localStorage / JSON
    if (window.App && typeof window.App.saveAuditProgress === "function") {
      window.App.saveAuditProgress(true);
    }

    // Si el reporte de Fase 3 está en pantalla, actualizarlo
    const reportContainer = document.getElementById("officialReportContainer");
    if (reportContainer && typeof ReportsEngine !== "undefined" && typeof ReportsEngine.renderOfficialReport === "function") {
      ReportsEngine.renderOfficialReport(p, App.auditGlobal, reportContainer);
    }

    // Mensaje toast
    const mensaje = nuevoEstado === "CONFORME"
      ? `Ítem ${isFicha ? 'Ficha' : itemId}: marcado como CONFORME por supervisor.`
      : `Ítem ${isFicha ? 'Ficha' : itemId}: marcado como NO CONFORME. Se incluyó en el informe de subsanación.`;
    if (window.App && typeof window.App.showToast === "function") {
      window.App.showToast(mensaje, nuevoEstado === "CONFORME" ? "success" : "warning");
    }
  },

  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  /**
   * Abre el modal para asignar manualmente un archivo ya presente en la carpeta del proyecto
   */
  abrirModalAsignarArchivo(itemId) {
    const pId = (window.App && App.currentProjectId);
    const exp = (window.proyectosAuditados && window.proyectosAuditados[pId]) ||
                (window.SIPRO_DATA && SIPRO_DATA.expedientesMap && SIPRO_DATA.expedientesMap[pId]) ||
                (window.App && App.currentAuditRecord);

    if (!exp) {
      alert("Por favor cargue o seleccione un expediente municipal primero.");
      return;
    }

    const processMode = (exp && exp.procesoEspecial) || (exp && exp.datos && exp.datos.procesoEspecial) || (App && App.currentProcessMode) || window.SIPRO_PROCESS_MODE || "ORDINARIO";
    const is2026_2 = processMode === "2026_2" || processMode === "CONVENIOS_2026_2" || itemId > 28;
    const baseItems = is2026_2 ? SIPRO_DATA.items41_2026_2 : SIPRO_DATA.items27;
    const item = (baseItems && baseItems.find(i => Number(i.id) === Number(itemId))) || { id: itemId, num: itemId, title: `Ítem ${itemId}` };

    this._assignTargetItemId = Number(itemId);

    // Obtener todos los archivos disponibles en el expediente
    const filePool = [];
    const seenNames = new Set();

    // 1. De exp.archivos (todos los archivos leídos recursivamente de la carpeta)
    if (Array.isArray(exp.archivos)) {
      exp.archivos.forEach(f => {
        if (f && f.name && !seenNames.has(f.name + '|' + (f.size || 0))) {
          seenNames.add(f.name + '|' + (f.size || 0));
          filePool.push(f);
        }
      });
    }

    // 2. De exp.archivosFileMap y exp.datos.archivosFiles
    const fMap = { ...(exp.archivosFileMap || {}), ...((exp.datos && exp.datos.archivosFiles) || {}) };
    Object.values(fMap).forEach(f => {
      if (f && f.name && !seenNames.has(f.name + '|' + (f.size || 0))) {
        seenNames.add(f.name + '|' + (f.size || 0));
        filePool.push(f);
      }
    });

    if (filePool.length === 0) {
      if (confirm(`No se encontraron archivos en la memoria de la carpeta cargada.\n\n¿Desea cargar un archivo desde su equipo para el Ítem ${item.num || item.id}?`)) {
        App.subirSubsanacionItem(itemId);
      }
      return;
    }

    this._assignableFiles = filePool;

    // Abrir modal
    const modal = document.getElementById("assignDocModal");
    if (!modal) {
      console.warn("Elemento #assignDocModal no encontrado en el DOM.");
      return;
    }

    const titleEl = document.getElementById("assignDocModalTitle");
    const subEl = document.getElementById("assignDocModalSubtitle");
    const searchInput = document.getElementById("assignDocSearchInput");

    if (titleEl) titleEl.textContent = `Asignar Documento de Carpeta — Ítem ${item.num || item.id}`;
    if (subEl) subEl.textContent = `${item.title || item.nombre || 'Requisito documental'}`;
    if (searchInput) searchInput.value = "";

    this.renderListaArchivosAsignar("");
    modal.classList.add("active");
  },

  /**
   * Renderiza la lista filtrada de archivos en el modal de asignación
   */
  renderListaArchivosAsignar(filterText = "") {
    const listCont = document.getElementById("assignDocFilesList");
    const countEl = document.getElementById("assignDocFilesCount");
    if (!listCont) return;

    const pId = (window.App && App.currentProjectId);
    const exp = (window.proyectosAuditados && window.proyectosAuditados[pId]) || (window.App && App.currentAuditRecord) || {};
    const files = this._assignableFiles || [];
    const targetItemId = this._assignTargetItemId;

    const q = (filterText || "").trim().toLowerCase();
    const filtered = files.filter(f => {
      if (!q) return true;
      const n = (f.name || "").toLowerCase();
      const p = (f.webkitRelativePath || "").toLowerCase();
      return n.includes(q) || p.includes(q);
    });

    if (countEl) {
      countEl.textContent = `Mostrando ${filtered.length} de ${files.length} archivo(s) disponibles en la carpeta`;
    }

    if (filtered.length === 0) {
      listCont.innerHTML = `
        <div style="text-align:center;padding:24px;color:var(--text-muted);font-size:12.5px;">
          🔍 No se encontraron archivos que coincidan con "<b>${this.escapeHtml(filterText)}</b>".
        </div>
      `;
      return;
    }

    // Mapa inverso para ver en qué ítems está asignado cada archivo
    const assignedMap = {};
    if (exp.archivosFileMap) {
      Object.entries(exp.archivosFileMap).forEach(([k, f]) => {
        if (f && f.name) {
          assignedMap[f.name] = assignedMap[f.name] || [];
          if (!assignedMap[f.name].includes(k)) assignedMap[f.name].push(k);
        }
      });
    }

    listCont.innerHTML = filtered.map((file) => {
      const origIndex = this._assignableFiles.indexOf(file);
      const ext = (file.name.slice(file.name.lastIndexOf('.') + 1) || "").toLowerCase();
      let icon = "📄";
      if (["xlsx", "xls", "xlsm", "xlsb", "csv"].includes(ext)) icon = "📊";
      else if (["pdf"].includes(ext)) icon = "📑";
      else if (["kml", "kmz"].includes(ext)) icon = "🗺️";
      else if (["docx", "doc"].includes(ext)) icon = "📝";
      else if (["jpg", "jpeg", "png"].includes(ext)) icon = "🖼️";
      else if (["zip", "rar", "7z"].includes(ext)) icon = "📦";

      const sizeStr = file.size ? (file.size > 1048576 ? `${(file.size / 1048576).toFixed(2)} MB` : `${(file.size / 1024).toFixed(1)} KB`) : "Tamaño desconocido";
      const relPath = file.webkitRelativePath || "";
      const pathParts = relPath ? relPath.split('/') : [];
      const folderDisplay = pathParts.length > 1 ? pathParts.slice(0, -1).join(' / ') : "Raíz de carpeta";

      const usedItems = assignedMap[file.name] || [];
      const isAlreadyOnThisItem = usedItems.includes(String(targetItemId)) || usedItems.includes(Number(targetItemId));

      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--color-bg-card);border:1px solid ${isAlreadyOnThisItem ? 'var(--color-primary)' : 'var(--border-subtle)'};border-radius:6px;gap:10px;transition:background 0.15s ease;">
          <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1;">
            <span style="font-size:20px;flex-shrink:0;">${icon}</span>
            <div style="min-width:0;flex:1;">
              <div style="font-size:12.5px;font-weight:700;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${this.escapeHtml(file.name)}">
                ${this.escapeHtml(file.name)}
              </div>
              <div style="font-size:10.5px;color:var(--text-muted);display:flex;align-items:center;gap:8px;margin-top:2px;flex-wrap:wrap;">
                <span>📁 ${this.escapeHtml(folderDisplay)}</span>
                <span>• ${sizeStr}</span>
                ${usedItems.length > 0 ? `
                  <span style="background:rgba(2,132,199,0.1);color:#0284c7;padding:1px 6px;border-radius:3px;font-weight:600;">
                    ${isAlreadyOnThisItem ? '✓ Ya asignado a este ítem' : `Compartido en Ítem: ${usedItems.join(', ')}`}
                  </span>
                ` : ''}
              </div>
            </div>
          </div>
          <button type="button" class="btn-primary"
                  style="padding:5px 12px;font-size:11.5px;white-space:nowrap;flex-shrink:0;${isAlreadyOnThisItem ? 'background:#10b981;border-color:#059669;' : 'background:#0284c7;border-color:#0284c7;'}"
                  onclick="DocumentalEngine.confirmarAsignacionArchivo(${origIndex})">
            ${isAlreadyOnThisItem ? '✓ Reasignar' : '✓ Asignar a este Ítem'}
          </button>
        </div>
      `;
    }).join("");
  },

  filtrarArchivosAsignar(val) {
    this.renderListaArchivosAsignar(val);
  },

  cerrarModalAsignarArchivo() {
    const modal = document.getElementById("assignDocModal");
    if (modal) modal.classList.remove("active");
  },

  async confirmarAsignacionArchivo(fileIndex) {
    const file = this._assignableFiles && this._assignableFiles[fileIndex];
    const itemId = this._assignTargetItemId;
    if (!file || !itemId) return;

    this.cerrarModalAsignarArchivo();

    // Asignar mediante App.subirSubsanacionItem indicando que es existente para no duplicar en disco
    await App.subirSubsanacionItem(itemId, null, file, { esExistente: true });
  },

  subirArchivoNuevoDesdeAsignar() {
    const itemId = this._assignTargetItemId;
    this.cerrarModalAsignarArchivo();
    if (itemId) {
      App.subirSubsanacionItem(itemId);
    }
  },

  /**
   * Cierra el modal de documentos y libera recursos
   */
  closeModal() {
    const modal = document.getElementById("documentModal");
    if (modal) modal.classList.remove("active");
    
    const win = document.getElementById("documentModalWindow") || (modal ? modal.querySelector(".modal-window") : null);
    if (win) win.classList.remove("modal-xl");

    const body = document.getElementById("modalDocBody");
    if (body) {
      const iframe = body.querySelector("iframe");
      if (iframe) iframe.src = "about:blank";
    }

    const openTabBtn = document.getElementById("modalDocOpenTabBtn");
    if (openTabBtn) openTabBtn.style.display = "none";
    const downloadBtn = document.getElementById("modalDocDownloadBtn");
    if (downloadBtn) downloadBtn.style.display = "none";
  }
};

if (typeof window !== "undefined") {
  window.DocumentalEngine = DocumentalEngine;
}
