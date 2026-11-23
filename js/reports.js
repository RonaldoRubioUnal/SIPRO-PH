/**
 * GENERADOR DE INFORMES Y FICHA DE RESULTADOS DE REVISIÓN Y SUBSANACIÓN (FASE 3)
 * Sistema SIPRO-PH - Gobernación de Antioquia
 * Secretaría de Infraestructura Física - Dirección de Infraestructura Física y Apoyo Territorial
 * Formato Oficial conforme a los Criterios Técnicos Departamentales con Campos Editables y Persistencia por Proyecto
 */

const ReportsEngine = {
  compliantCollapsed: true,

  /**
   * Obtiene o inicializa el estado editable de la Fase 3 aislado por proyecto
   */
  /**
   * Genera o normaliza la clave única estable por requisito (itemKey)
   * Garantiza que cualquier variante (item_1, item_01, FASE_2_ITEM_1, doc_item_1, 1) resuelva a la misma clave canónica
   */
  toItemKey(id) {
    if (!id) return "";
    const s = String(id).trim();
    const lower = s.toLowerCase();
    if (lower === "fase_1a_acero" || lower === "fase_1a_diseno" || s === "FASE_1A_ACERO") return "FASE_1A_ACERO";
    if (lower === "fase_1b_espacial" || lower === "fase_1b_geo" || s === "FASE_1B_GEO") return "FASE_1B_GEO";
    if (lower === "fase_1c_presupuesto" || lower === "fase_1c_pto" || s === "FASE_1C_PTO") return "FASE_1C_PTO";
    if (lower === "ficha_priorizacion" || lower === "fase_2_ficha_priorizacion" || s === "FICHA_PRIORIZACION") return "FICHA_PRIORIZACION";
    const m = lower.match(/^(?:fase_2_item_|item_|doc_item_)(\d+)$/i);
    if (m) {
      const n = parseInt(m[1], 10);
      return `FASE_2_ITEM_${String(n).padStart(2, "0")}`;
    }
    const mNum = lower.match(/^(\d+)$/);
    if (mNum) {
      const n = parseInt(mNum[1], 10);
      return `FASE_2_ITEM_${String(n).padStart(2, "0")}`;
    }
    return s;
  },

  /**
   * Obtiene la edición realizada por el usuario para un requisito buscando bajo clave canónica, legacy o variantes de padding
   */
  getUserEdit(fase3State, id) {
    if (!fase3State) return null;
    const itemKey = this.toItemKey(id);
    const mObs = fase3State.matrizObservaciones;
    const oEdit = fase3State.observacionesEditadas;
    if (mObs && mObs[itemKey]) return mObs[itemKey];
    if (oEdit && oEdit[itemKey]) return oEdit[itemKey];
    if (id && mObs && mObs[id]) return mObs[id];
    if (id && oEdit && oEdit[id]) return oEdit[id];

    // Chequear variantes numéricas con y sin cero inicial
    const m = String(itemKey).match(/^FASE_2_ITEM_(\d+)$/);
    if (m) {
      const pad = m[1];
      const raw = String(parseInt(pad, 10));
      const variations = [
        `FASE_2_ITEM_${raw}`,
        `item_${pad}`,
        `item_${raw}`,
        `doc_item_${pad}`,
        `doc_item_${raw}`,
        `ITEM_${pad}`,
        `ITEM_${raw}`,
        pad,
        raw
      ];
      for (const k of variations) {
        if (mObs && mObs[k]) return mObs[k];
        if (oEdit && oEdit[k]) return oEdit[k];
      }
    }
    return null;
  },

  /**
   * Elimina completamente cualquier observación previa o residuo de no conformidad para un ítem en Fase 3
   */
  cleanFinding(projectId, id) {
    if (!id) return;
    projectId = projectId || (window.App && App.currentProjectId);
    const state = this.getFase3State(projectId);
    if (!state) return;

    state.matrizObservaciones = state.matrizObservaciones || {};
    state.observacionesEditadas = state.observacionesEditadas || {};

    const itemKey = this.toItemKey(id);
    const keysToDelete = new Set([id, itemKey]);

    const numMatch = String(id).match(/^(?:FASE_2_ITEM_|item_|doc_item_)?(\d+)$/i);
    if (numMatch) {
      const n = parseInt(numMatch[1], 10);
      const pad = String(n).padStart(2, "0");
      const raw = String(n);
      keysToDelete.add(`FASE_2_ITEM_${pad}`);
      keysToDelete.add(`FASE_2_ITEM_${raw}`);
      keysToDelete.add(`item_${pad}`);
      keysToDelete.add(`item_${raw}`);
      keysToDelete.add(`doc_item_${pad}`);
      keysToDelete.add(`doc_item_${raw}`);
      keysToDelete.add(`ITEM_${pad}`);
      keysToDelete.add(`ITEM_${raw}`);
      keysToDelete.add(pad);
      keysToDelete.add(raw);

      if (n === 3) {
        keysToDelete.add("FASE_1A_ACERO");
        keysToDelete.add("fase_1a_acero");
        keysToDelete.add("FASE_1A_DISENO");
        keysToDelete.add("fase_1a_diseno");
      }
      if (n === 24 || n === 2) {
        keysToDelete.add("FASE_1B_GEO");
        keysToDelete.add("fase_1b_espacial");
        keysToDelete.add("FASE_1B_ESPACIAL");
        keysToDelete.add("fase_1b_geo");
      }
      if (n === 28 || n === 14) {
        keysToDelete.add("FASE_1C_PTO");
        keysToDelete.add("fase_1c_presupuesto");
        keysToDelete.add("FASE_1C_PRESUPUESTO");
        keysToDelete.add("fase_1c_pto");
      }
    }

    if (String(id).toUpperCase().includes("FICHA")) {
      keysToDelete.add("FICHA_PRIORIZACION");
      keysToDelete.add("ficha_priorizacion");
      keysToDelete.add("FASE_2_FICHA_PRIORIZACION");
    }

    keysToDelete.forEach(k => {
      delete state.matrizObservaciones[k];
      delete state.observacionesEditadas[k];
    });

    const expedientesMap = (window.SIPRO_DATA && SIPRO_DATA.expedientesMap) || window.proyectosAuditados || {};
    if (expedientesMap[projectId] && expedientesMap[projectId].fase3) {
      keysToDelete.forEach(k => {
        if (expedientesMap[projectId].fase3.matrizObservaciones) delete expedientesMap[projectId].fase3.matrizObservaciones[k];
        if (expedientesMap[projectId].fase3.observacionesEditadas) delete expedientesMap[projectId].fase3.observacionesEditadas[k];
      });
    }
  },

  getFase3State(projectId) {
    if (!projectId) {
      projectId = App.currentProjectId || (App.currentProject && App.currentProject.id);
    }
    if (!projectId || !window.proyectosAuditados || !window.proyectosAuditados[projectId]) {
      return { observacionesEditadas: {}, hallazgosManuales: [], conclusionesConcepto: "" };
    }

    const rec = window.proyectosAuditados[projectId];
    rec.fase3 = rec.fase3 || {
      matrizObservaciones: {},
      observacionesEditadas: {},
      observacionesOmitidas: {},
      hallazgosManuales: [],
      conclusionesConcepto: ""
    };
    rec.fase3.matrizObservaciones = rec.fase3.matrizObservaciones || rec.fase3.observacionesEditadas || {};
    rec.fase3.observacionesOmitidas = rec.fase3.observacionesOmitidas || {};

    // Sincronizar espejo en SIPRO_DATA.expedientesMap y rec.datos
    if (window.SIPRO_DATA && SIPRO_DATA.expedientesMap && SIPRO_DATA.expedientesMap[projectId]) {
      SIPRO_DATA.expedientesMap[projectId].fase3 = rec.fase3;
    }
    if (rec.datos) {
      rec.datos.fase3 = rec.fase3;
    }

    return rec.fase3;
  },

  /**
   * Recopila la totalidad de hallazgos (Fase 1A, Fase 1B, Fase 2 y Manuales)
   * integrando las ediciones en tiempo real del usuario
   */
  collectAllFindings(project, auditGlobal) {
    const projectId = (project && project.id) || App.currentProjectId;
    const fase3State = this.getFase3State(projectId);
    const findings = [];
    const compliantItems = [];

    const rec = (window.proyectosAuditados && projectId) ? window.proyectosAuditados[projectId] : null;
    const audit1A = (rec && rec.fase1A) || (auditGlobal && auditGlobal.audit1A);
    const audit1B = (rec && rec.fase1B) || (auditGlobal && auditGlobal.audit1B);
    const audit2 = (rec && rec.fase2) || (auditGlobal && auditGlobal.audit2);
    const processMode = (project && project.procesoEspecial) || (rec && rec.procesoEspecial) || (rec && rec.datos && rec.datos.procesoEspecial) || (window.App && window.App.currentProcessMode) || (window.SIPRO_PROCESS_MODE) || "ORDINARIO";
    const is2026_2 = processMode === "2026_2" || processMode === "CONVENIOS_2026_2";

    // 0. DOCUMENTO BASE: FICHA DE PRIORIZACIÓN MUNICIPAL (Omitido en proceso especial Convenios 2026 - II)
    if (!is2026_2) {
      const fichaP = (rec && rec.fichaPriorizacion) || (project && project.fichaPriorizacion) || (rec && rec.datos && rec.datos.fichaPriorizacion);
      const hasFicha = fichaP ? (fichaP.existe === true && fichaP.detected === true) : false;
      const fidFicha = "FICHA_PRIORIZACION";

      if (!hasFicha) {
        const userEditFicha = this.getUserEdit(fase3State, fidFicha) || this.getUserEdit(fase3State, "ficha_priorizacion");
        const statusFicha = userEditFicha?.estado || "Faltante";
        const defaultMotivoFicha = "Ficha de Priorización: Documento faltante en el expediente";
        const motivoFicha = userEditFicha?.motivo !== undefined ? userEditFicha.motivo : defaultMotivoFicha;

        const objFicha = {
          id: fidFicha,
          itemKey: fidFicha,
          itemNum: "Ficha",
          itemBadge: "Ficha Priorización",
          fase: "Documento Base",
          titulo: "Ficha de Priorización Municipal y Cierre",
          norma: "Documento Maestro de Priorización",
          archivo: null,
          estado: statusFicha,
          motivo: motivoFicha,
          isManual: false
        };

        if (statusFicha === "Conforme") {
          compliantItems.push(objFicha);
        } else {
          findings.push(objFicha);
        }
      } else {
        const userEditFicha = this.getUserEdit(fase3State, fidFicha) || this.getUserEdit(fase3State, "ficha_priorizacion");
        const statusFicha = userEditFicha?.estado || "Conforme";
        const defaultMotivoFicha = `✓ Ficha de Priorización aportada (${fichaP.fileName || "documento detectado"}).`;
        const motivoFicha = userEditFicha?.motivo !== undefined ? userEditFicha.motivo : defaultMotivoFicha;

        const objFicha = {
          id: fidFicha,
          itemKey: fidFicha,
          itemNum: "Ficha",
          itemBadge: "Ficha Priorización",
          fase: "Documento Base",
          titulo: "Ficha de Priorización Municipal y Cierre",
          norma: "Documento Maestro de Priorización",
          archivo: fichaP.fileName,
          estado: statusFicha,
          motivo: motivoFicha,
          isManual: false
        };

        if (statusFicha === "Conforme") {
          compliantItems.push(objFicha);
        } else {
          findings.push(objFicha);
        }
      }
    }

    // 1. COMPUERTA 1A: CONTROL ESTRUCTURAL DE ACERO
    if (audit1A) {
      const fid = "FASE_1A_ACERO";
      const hasDoc = audit1A.tieneDoc !== false && (
        (audit1A.pesoTotalKg && audit1A.pesoTotalKg > 0) ||
        (audit1A.pesoTotalDeclaradoKg && audit1A.pesoTotalDeclaradoKg > 0) ||
        (audit1A.pesoTotalCalculadoKg && audit1A.pesoTotalCalculadoKg > 0) ||
        (audit1A.archivoNombre && String(audit1A.archivoNombre).trim().length > 0) ||
        (rec && rec.archivosFileMap && (rec.archivosFileMap[3] || rec.archivosFileMap["3"])) ||
        (project && project.archivosFiles && (project.archivosFiles[3] || project.archivosFiles["3"]))
      );
      const isApproved = Boolean(hasDoc && audit1A.cuantiaConforme);
      const defaultStatus = isApproved ? "Conforme" : (!hasDoc ? "Faltante" : "No Aceptado / Por Subsanar");
      let defaultMotivo = "";

      if (!hasDoc) {
        defaultMotivo = "• Documento faltante: No se aportó archivo de despiece de acero y memoria de concreto.";
      } else if (isApproved) {
        const subItem3 = (rec && rec.historialSubsanaciones && rec.historialSubsanaciones.find(h => h.itemId === 3 || h.itemId === "3")) ||
                         (audit1A.subsanado && { fileName: audit1A.archivoNombre });
        const fileName = (subItem3 && subItem3.fileName) || audit1A.archivoNombre || (rec && rec.archivosFileMap && rec.archivosFileMap[3] && rec.archivosFileMap[3].name) || "";
        if (fileName && (subItem3 || audit1A.subsanado)) {
          defaultMotivo = `✓ SUBSANADO: Cuantía actualizada a ${Number(audit1A.cuantiaRealKgM || 0).toFixed(2)} kg/m (${fileName}).`;
        } else {
          defaultMotivo = `Cuantía de acero ${Number(audit1A.cuantiaRealKgM || 0).toFixed(2)} kg/m cumple el estándar técnico departamental mínimo de 26.25 kg/m.`;
        }
      } else {
        const header = "Ajustar despiece y memorias de cálculo (Fase 1A):";
        const cReal = Number(audit1A.cuantiaRealKgM || 0).toFixed(2);
        const diffNum = 26.25 - (audit1A.cuantiaRealKgM || 0);
        const cFaltante = Math.abs(Number(audit1A.cuantiaSuperavitKgM !== undefined ? audit1A.cuantiaSuperavitKgM : diffNum)).toFixed(2);
        const pTotal = Number(audit1A.pesoTotalKg || audit1A.pesoTotalDeclaradoKg || audit1A.pesoTotalCalculadoKg || 0).toLocaleString('es-CO');
        const lTramo = Number(audit1A.longitudTramo || audit1A.longitudIntervencionM || (project && project.longitudM) || 0).toLocaleString('es-CO');

        const lineaCuantia = `• Cuantía de Acero: ⚠️ DÉFICIT: ${cReal} kg/m reportados vs. 26.25 kg/m exigidos (Faltante: -${cFaltante} kg/m | Peso total: ${pTotal} kg en ${lTramo} m).`;

        const numDosi = (audit1A.concreto && audit1A.concreto.dosificacionGlobal) ||
                        (rec && rec.concretoVolumes && rec.concretoVolumes.dosificacionGlobal) ||
                        (audit1A.concretoVolumes && audit1A.concretoVolumes.dosificacionGlobal) ||
                        7.20;
        const lineaCemento = `• Dosificación Cemento: ⚠️ ${Number(numDosi).toFixed(2)} sacos/m³ reportados (Verificar contra estándar de plantilla).`;

        const lineas1A = [lineaCuantia, lineaCemento];
        defaultMotivo = header + "\n" + [...new Set(lineas1A)].join("\n");
      }

      const userEdit = this.getUserEdit(fase3State, fid) || this.getUserEdit(fase3State, "fase_1a_acero");
      let status = defaultStatus;
      let motivo = defaultMotivo;

      if (isApproved) {
        if (userEdit && (userEdit.estado === "Faltante" || userEdit.estado === "No Aceptado / Por Subsanar")) {
          userEdit.estado = "Conforme";
          userEdit.motivo = defaultMotivo;
        }
        status = userEdit?.estado || "Conforme";
        motivo = (userEdit?.motivo !== undefined && !userEdit.motivo.includes("DÉFICIT")) ? userEdit.motivo : defaultMotivo;
      } else {
        status = userEdit?.estado || defaultStatus;
        motivo = userEdit?.motivo !== undefined ? userEdit.motivo : defaultMotivo;
      }

      // Si el motivo almacenado previamente contiene el texto antiguo o líneas duplicadas, migrar
      if (typeof motivo === "string") {
        if (motivo.includes("inferior al mínimo de 26.25 kg/m exigido por el criterio técnico departamental") || motivo.includes("Marcas conformes:")) {
          motivo = defaultMotivo;
          if (userEdit && typeof userEdit === "object") {
            userEdit.motivo = defaultMotivo;
          }
        } else {
          const rawLines = motivo.split("\n");
          const dedupedLines = [...new Set(rawLines)];
          if (dedupedLines.length < rawLines.length) {
            motivo = dedupedLines.join("\n");
            if (userEdit && typeof userEdit === "object") {
              userEdit.motivo = motivo;
            }
          }
        }
      }

      const num1A = "03";
      const obj = {
        id: fid,
        itemKey: fid,
        itemNum: num1A,
        itemBadge: `Ítem ${num1A} (1A - Acero)`,
        fase: "Fase 1A - Control Estructural",
        titulo: "Control Estructural de Acero Mínimo",
        norma: "Criterio Técnico Departamental (26.25 kg/m)",
        archivo: audit1A.archivoNombre || (rec && rec.archivosFileMap && (rec.archivosFileMap[3] || rec.archivosFileMap["3"]) && (rec.archivosFileMap[3] || rec.archivosFileMap["3"]).name) || null,
        estado: status,
        motivo: motivo,
        isManual: false
      };

      if (status === "Conforme") {
        compliantItems.push(obj);
      } else {
        findings.push(obj);
      }
    }

    // 2. COMPUERTA 1B: CONTRASTE ESPACIAL Y ALINEACIÓN VIAL (Cifras exactas calculadas)
    if (audit1B) {
      const fid = "FASE_1B_GEO";
      const isApproved = audit1B.aprobado;
      const defaultStatus = isApproved ? "Conforme" : "No Aceptado / Por Subsanar";
      let defaultMotivo = "";

      if (isApproved) {
        defaultMotivo = `Trazados georreferenciados conformes con 100% de coincidencia y alineación con la red vial departamental (tolerancia de 10 m).`;
      } else if (audit1B.tieneKMZ === false || audit1B.tieneGeorreferenciacionValida === false) {
        defaultMotivo = `Georreferenciación / Archivo KMZ-KML (Fase 1B - Ítem ${is2026_2 ? '02' : '24'}): Documento faltante. No se aportó archivo de georreferenciación del proyecto para verificar su alineación con la red vial.`;
      } else if (audit1B.alertaComprimido) {
        defaultMotivo = audit1B.alertaComprimido;
      } else {
        const fallas = [];
        const header = "Ajustar georreferenciación a la Red Vial oficial (tolerancia máx. 10 m):";

        // Detalle exacto por Tramos / Trazados (sin agrupar ni omitir ninguno)
        const tramos = audit1B.tramos || [];
        const tramosFallidos = tramos.filter(t => {
          return t.cumple === false || 
                 t.cumpleParcial === true || 
                 (t.distanciaEjeM !== undefined && t.distanciaEjeM > 10) || 
                 (t.pctFueraVia !== undefined && t.pctFueraVia > 0) ||
                 (t.longitudFueraViaM !== undefined && t.longitudFueraViaM > 0);
        });

        if (tramosFallidos.length > 0) {
          tramosFallidos.forEach((t, idx) => {
            const nom = (t.nombrePlacemark && String(t.nombrePlacemark).trim()) || 
                        (t.idTramo && String(t.idTramo).trim()) || 
                        `Tramo ${idx + 1}`;
            const totM = Number(t.totalTrackLengthM || t.longitudM || 0);
            const fueraNum = Number(t.longitudFueraViaM !== undefined ? t.longitudFueraViaM : (t.subAnalysis?.longitudFueraViaM !== undefined ? t.subAnalysis.longitudFueraViaM : (t.cumple ? 0 : totM)));
            const enViaNum = Number(t.longitudEnViaM !== undefined ? t.longitudEnViaM : (t.subAnalysis?.longitudEnViaM !== undefined ? t.subAnalysis.longitudEnViaM : Math.max(0, totM - fueraNum)));
            const pctEnViaNum = Number(t.pctEnVia !== undefined ? t.pctEnVia : (t.subAnalysis?.pctEnVia !== undefined ? t.subAnalysis.pctEnVia : (totM > 0 ? (enViaNum / totM) * 100 : 0)));
            const maxDev = Number(t.distanciaEjeM !== undefined ? t.distanciaEjeM : (t.distanciaMetros !== undefined ? t.distanciaMetros : (t.distM || 0)));
            const codVia = t.codigoViaGeoJSON || t.codigoViaDeclarado || "la red vial";

            const isParcial = t.cumpleParcial === true || (enViaNum > 0.5 && fueraNum > 0.5 && pctEnViaNum > 0.5 && pctEnViaNum < 99.5);

            if (isParcial) {
              fallas.push(`• ${nom}: ⚠️ PARCIAL: ${enViaNum.toFixed(1)} m en vía (${pctEnViaNum.toFixed(1)}%) / ${fueraNum.toFixed(1)} m fuera (Vía ${codVia}).`);
            } else {
              const fueraFinal = (fueraNum > 0 ? fueraNum : totM).toFixed(1);
              fallas.push(`• ${nom}: ✕ FUERA DE VÍA: ${fueraFinal} m fuera del corredor (desfase máx. ${maxDev.toFixed(1)} m de ${codVia}).`);
            }
          });
        }

        // Detalle exacto por Puntos de referencia (excluyendo puntosContraste para no duplicar tramos)
        const puntos = (audit1B.puntos && audit1B.puntos !== audit1B.puntosContraste)
          ? audit1B.puntos
          : (audit1B.puntosInspeccion || []);
        const puntosFallidos = puntos.filter(p => {
          const dist = p.distanciaEjeM !== undefined ? p.distanciaEjeM : (p.distanciaMetros !== undefined ? p.distanciaMetros : (p.distM !== undefined ? p.distM : 0));
          return dist > 10 || p.cumple === false;
        });

        if (puntosFallidos.length > 0) {
          puntosFallidos.forEach((p, pIdx) => {
            const nom = (p.nombrePlacemark && String(p.nombrePlacemark).trim()) || 
                        (p.sector && String(p.sector).trim()) || 
                        (p.idPunto && String(p.idPunto).trim()) || 
                        `Punto ${pIdx + 1}`;
            const dist = Number(p.distanciaEjeM !== undefined ? p.distanciaEjeM : (p.distanciaMetros !== undefined ? p.distanciaMetros : (p.distM || 0))).toFixed(1);
            const codVia = p.codigoViaGeoJSON || p.codGeoJSON || p.codigoViaDeclarado || "la red vial";
            fallas.push(`• ${nom}: ✕ FUERA DE VÍA: Desfasado a ${dist} m del eje vial (${codVia}).`);
          });
        }

        // 3. Deduplicación de líneas idénticas al construir el texto de la Fase 3
        const lineasUnicas = [...new Set(fallas)];

        if (lineasUnicas.length > 0) {
          defaultMotivo = `${header}\n${lineasUnicas.join("\n")}`;
        } else {
          defaultMotivo = `${header}\n• Desfase espacial: Coincidencia (${audit1B.coberturaBufferPct || 0}%) fuera del corredor vial terciario autorizado (tolerancia de 10 m).`;
        }
      }

      const userEdit = this.getUserEdit(fase3State, fid) || this.getUserEdit(fase3State, "fase_1b_espacial");
      let status = defaultStatus;
      let motivo = defaultMotivo;

      if (isApproved) {
        if (userEdit && (userEdit.estado === "Faltante" || userEdit.estado === "No Aceptado / Por Subsanar")) {
          userEdit.estado = "Conforme";
          userEdit.motivo = defaultMotivo;
        }
        status = userEdit?.estado || "Conforme";
        motivo = (userEdit?.motivo !== undefined && !userEdit.motivo.includes("FUERA DE VÍA")) ? userEdit.motivo : defaultMotivo;
      } else {
        status = userEdit?.estado || defaultStatus;
        motivo = userEdit?.motivo !== undefined ? userEdit.motivo : (typeof userEdit === "string" ? userEdit : defaultMotivo);
      }

      // Si el motivo almacenado previamente contiene el texto antiguo o líneas duplicadas, deduplicar
      if (typeof motivo === "string") {
        if (motivo.includes("Desfase en trazado [") || motivo.includes("Desfase en puntos de referencia:")) {
          motivo = defaultMotivo;
          if (userEdit && typeof userEdit === "object") {
            userEdit.motivo = defaultMotivo;
          }
        } else {
          const rawLines = motivo.split("\n");
          const dedupedLines = [...new Set(rawLines)];
          if (dedupedLines.length < rawLines.length) {
            motivo = dedupedLines.join("\n");
            if (userEdit && typeof userEdit === "object") {
              userEdit.motivo = motivo;
            }
          }
        }
      }

      const num1B = is2026_2 ? "02" : "24";
      const obj = {
        id: fid,
        itemKey: fid,
        itemNum: num1B,
        itemBadge: `Ítem ${num1B} (1B - Geo)`,
        fase: "Fase 1B - Alineación Vial",
        titulo: "Georreferenciación y Contraste Espacial de Trazados (Alineación con la Red Vial)",
        norma: "Red Terciaria Departamental (Tolerancia 10 m)",
        archivo: (audit1B && (audit1B.archivoKMZ || audit1B.archivoNombre)) || null,
        estado: status,
        motivo: motivo,
        isManual: false
      };

      if (status === "Conforme") {
        compliantItems.push(obj);
      } else {
        findings.push(obj);
      }
    }

    // 2.5 COMPUERTA 1C: COHERENCIA PRESUPUESTO (si modalidad === 'RECURSOS')
    if (rec && rec.modalidad === "RECURSOS") {
      const fid = "FASE_1C_PTO";
      const f1c = rec.fase1C;
      const isApproved = f1c ? f1c.aprobado === true : false;
      const defaultStatus = isApproved ? "Conforme" : "No Aceptado / Por Subsanar";
      let defaultMotivo = "";

      if (isApproved) {
        defaultMotivo = `Presupuesto oficial coherente con el despiece y especificaciones dentro de la tolerancia de ±${(f1c && f1c.toleranciaPct) || 5}%.`;
      } else {
        const header = "Corregir discrepancias entre Presupuesto y Despiece (Fase 1C):";
        const lineas = [];

        if (!f1c || !f1c.presupuestoData) {
          lineas.push("• Documento faltante: Archivo de Presupuesto Oficial no aportado en formato de hoja de cálculo válido (.xlsx / .xls) o sin partidas evaluables.");
        } else {
          if (f1c.presupuestoData.hojaPresupuestoEncontrada === false) {
            lineas.push("• Hoja no encontrada: El archivo Excel de presupuesto no contiene la pestaña obligatoria 'PRESUPUESTO'.");
          }

          // Objeto del proyecto (si no coincide)
          if (f1c.presupuestoData.esPlacaHuella === false) {
            const textoObj = f1c.presupuestoData.objetoProyecto || "No identificado o sin mención a Placa Huella";
            lineas.push(`• Objeto del Presupuesto: ✕ NO CORRESPONDE A PLACA HUELLA (Registrado: \"${textoObj}\").`);
          }

          if (f1c.comparacion && f1c.comparacion.length > 0) {
            const discrepantes = f1c.comparacion.filter(c => !c.coherente);
            discrepantes.forEach(c => {
              const vDesp = Number(c.cantDespiece) || 0;
              const vPres = Number(c.cantPresupuesto) || 0;
              const deltaVal = c.delta !== undefined ? c.delta : (vPres - vDesp);
              const sign = deltaVal > 0 ? "+" : (deltaVal < 0 ? "-" : "");
              const deltaFmt = `${sign}${Math.abs(deltaVal).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              const vDespFmt = vDesp.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              const vPresFmt = vPres.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              const pctFmt = Number(c.pct || 0).toFixed(2);

              if (c.id === "longitud_placa_huella") {
                lineas.push(`• Longitud Placa Huella: ⚠️ DISCREPANCIA: Despiece = ${vDespFmt} m vs. Presupuesto = ${vPresFmt} m (Diferencia: ${deltaFmt} m / ${pctFmt}%).`);
              } else if (c.id === "acero_refuerzo") {
                lineas.push(`• Acero de Refuerzo: ⚠️ DISCREPANCIA: Despiece = ${vDespFmt} kg vs. Presupuesto = ${vPresFmt} kg (Diferencia: ${deltaFmt} kg / ${pctFmt}%).`);
              } else if (c.id === "concreto_simple") {
                lineas.push(`• Concreto 21 MPa: ⚠️ DISCREPANCIA: Despiece = ${vDespFmt} m³ vs. Presupuesto = ${vPresFmt} m³ (Diferencia: ${deltaFmt} m³ / ${pctFmt}%).`);
              } else if (c.id === "concreto_ciclopeo") {
                lineas.push(`• Concreto Ciclópeo: ⚠️ DISCREPANCIA: Despiece = ${vDespFmt} m³ vs. Presupuesto = ${vPresFmt} m³ (Diferencia: ${deltaFmt} m³ / ${pctFmt}%).`);
              } else {
                lineas.push(`• ${c.item}: ⚠️ DISCREPANCIA: Despiece = ${vDespFmt} ${c.unidad} vs. Presupuesto = ${vPresFmt} ${c.unidad} (Diferencia: ${deltaFmt} ${c.unidad} / ${pctFmt}%).`);
              }
            });
          } else if (f1c.hallazgos && f1c.hallazgos.length > 0) {
            f1c.hallazgos.forEach(h => {
              if (h.id === "objeto_no_placa_huella") {
                // Ya cubierto arriba si existía
              } else {
                lineas.push(`• ${h.item || 'Partida'}: ⚠️ DISCREPANCIA: ${h.motivo}`);
              }
            });
          }
        }

        const lineasDedup = [...new Set(lineas)];
        if (lineasDedup.length > 0) {
          defaultMotivo = header + "\n" + lineasDedup.join("\n");
        } else {
          defaultMotivo = header + "\n• Incoherencia detectada entre las cantidades del Presupuesto Oficial y las Memorias/Despiece de obra.";
        }
      }

      const userEdit = this.getUserEdit(fase3State, fid) || this.getUserEdit(fase3State, "fase_1c_presupuesto");
      let status = defaultStatus;
      let motivo = defaultMotivo;

      if (isApproved) {
        if (userEdit && (userEdit.estado === "Faltante" || userEdit.estado === "No Aceptado / Por Subsanar")) {
          userEdit.estado = "Conforme";
          userEdit.motivo = defaultMotivo;
        }
        status = userEdit?.estado || "Conforme";
        motivo = (userEdit?.motivo !== undefined && !userEdit.motivo.includes("DISCREPANCIA")) ? userEdit.motivo : defaultMotivo;
      } else {
        status = userEdit?.estado || defaultStatus;
        motivo = userEdit?.motivo !== undefined ? userEdit.motivo : defaultMotivo;
      }

      // Si el motivo guardado previamente contiene el texto antiguo sin viñetas, migrar al nuevo formato estructurado
      if (typeof motivo === "string") {
        if (motivo.includes("Incoherencia Presupuestal (Fase 1C):") || motivo.includes("en presupuesto =") || motivo.includes("Incoherencia entre cantidades del Presupuesto Oficial")) {
          motivo = defaultMotivo;
          if (userEdit && typeof userEdit === "object") {
            userEdit.motivo = defaultMotivo;
          }
        } else {
          const rawLines = motivo.split("\n");
          const dedupedLines = [...new Set(rawLines)];
          if (dedupedLines.length < rawLines.length) {
            motivo = dedupedLines.join("\n");
            if (userEdit && typeof userEdit === "object") {
              userEdit.motivo = motivo;
            }
          }
        }
      }

      const num1C = is2026_2 ? "14" : "28";
      const obj = {
        id: fid,
        itemKey: fid,
        itemNum: num1C,
        itemBadge: `Ítem ${num1C} (1C - Presupuesto)`,
        fase: "Fase 1C - Coherencia Presupuestal",
        titulo: "Coherencia de Cantidades en Presupuesto Oficial",
        norma: `Cruce Presupuesto vs. Despiece (Tolerancia ±${(f1c && f1c.toleranciaPct) || 5}%)`,
        archivo: (f1c && f1c.presupuestoData && f1c.presupuestoData.nombreArchivo) || null,
        estado: status,
        motivo: motivo,
        isManual: false
      };

      if (status === "Conforme") {
        compliantItems.push(obj);
      } else {
        findings.push(obj);
      }
    }

    // 3. COMPUERTA 2: LISTA DE REQUISITOS DOCUMENTALES
    const items27 = (audit2 && audit2.items) || (rec && rec.fase2 && rec.fase2.items) || (is2026_2 ? SIPRO_DATA.items41_2026_2 : SIPRO_DATA.items27) || [];
    items27.forEach((it) => {
      const rawNum = it.num || it.id;
      const numPadded = String(rawNum).padStart(2, "0");
      const fid = `FASE_2_ITEM_${numPadded}`;
      const legacyFid = `item_${numPadded}`;
      const defaultStatus = it.conforme ? "Conforme" : (it.vencido ? "Vencido" : (it.faltante ? "Faltante" : "No Aceptado / Por Subsanar"));
      let defaultMotivo = "";
      if (it.conforme) {
        if (it.subsanado && it.archivoDetectado) {
          defaultMotivo = `✓ Subsanado con archivo ${it.archivoDetectado}${it.fechaSubsanacion ? ` el ${it.fechaSubsanacion}` : ''}. Cumple con la regla normativa.`;
        } else if (it.archivoDetectado) {
          defaultMotivo = `✓ Documento aportado (${it.archivoDetectado}) y conforme con la regla normativa.`;
        } else {
          defaultMotivo = "✓ Documento aportado y conforme con la regla normativa.";
        }
      } else if (it.faltante || !it.archivoDetectado) {
        if (numPadded === "24" || it.id === 24 || (!is2026_2 && Number(it.id) === 24)) {
          defaultMotivo = "Georreferenciación / Archivo KMZ-KML (Fase 1B - Ítem 24): Documento faltante. No se aportó archivo de georreferenciación del proyecto para verificar su alineación con la red vial.";
        } else if (is2026_2 && (numPadded === "02" || Number(it.id) === 2)) {
          defaultMotivo = "Georreferenciación / Archivo KMZ-KML (Fase 1B - Ítem 02): Documento faltante. No se aportó archivo de georreferenciación del proyecto para verificar su alineación con la red vial.";
        } else if (numPadded === "03" || Number(it.id) === 3) {
          defaultMotivo = "• Documento faltante: No se aportó archivo de despiece de acero y memoria de concreto.";
        } else {
          defaultMotivo = "Documento no aportado en la carpeta del expediente municipal.";
        }
      } else if (it.vencido) {
        const shortTitle = (typeof DocumentalEngine !== "undefined" && DocumentalEngine.SHORT_TITLES_VIGENCIA && DocumentalEngine.SHORT_TITLES_VIGENCIA[Number(it.id)])
          || it.shortTitle
          || (it.title ? it.title.split("(")[0].trim() : `Ítem ${numPadded}`);
        const fechaStr = it.fechaDocStr || (it.meta && it.meta.fechaDocStr) || (it.fechaDoc ? `${String(it.fechaDoc.getDate()).padStart(2, '0')}/${String(it.fechaDoc.getMonth() + 1).padStart(2, '0')}/${it.fechaDoc.getFullYear()}` : "Fecha no detectada");
        const ahora = new Date();
        const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const mesActualNombre = meses[ahora.getMonth()];
        const anioActual = ahora.getFullYear();
        defaultMotivo = `• Ítem ${numPadded} (${shortTitle}): ⚠️ VIGENCIA VENCIDA — Expedido el ${fechaStr}. Debe corresponder al mes de revisión en curso (${mesActualNombre} de ${anioActual}).`;
      } else {
        defaultMotivo = it.observacion || "Documento no aceptado conforme a las especificaciones.";
      }

      const userEdit = this.getUserEdit(fase3State, fid) || this.getUserEdit(fase3State, legacyFid);
      let status = defaultStatus;
      let motivo = defaultMotivo;

      if (it.conforme) {
        // Si el ítem es conforme en Fase 2 (o subsanado), limpiar cualquier edición previa que lo marcaba como faltante o no conforme
        if (userEdit && (userEdit.estado === "Faltante" || userEdit.estado === "No Aceptado / Por Subsanar" || userEdit.estado === "Vencido" || (typeof userEdit.motivo === "string" && (userEdit.motivo.includes("no aportado") || userEdit.motivo.includes("faltante"))))) {
          userEdit.estado = "Conforme";
          userEdit.motivo = defaultMotivo;
        }
        status = userEdit?.estado || "Conforme";
        motivo = (userEdit?.motivo !== undefined && !userEdit.motivo.includes("no aportado") && !userEdit.motivo.includes("Documento Faltante")) ? userEdit.motivo : defaultMotivo;
      } else {
        status = userEdit?.estado || defaultStatus;
        motivo = userEdit?.motivo !== undefined ? userEdit.motivo : defaultMotivo;
      }

      const itemBadge = `Ítem ${numPadded}`;
      const obj = {
        id: fid,
        itemKey: fid,
        itemNum: numPadded,
        itemBadge: itemBadge,
        fase: `Fase 2 - Ítem ${numPadded}`,
        titulo: `${it.title}`,
        norma: it.rule || "Requisito Documental",
        entidad: it.entity,
        archivo: it.archivoDetectado,
        estado: status,
        motivo: motivo,
        isManual: false
      };

      if (status === "Conforme") {
        compliantItems.push(obj);
      } else {
        findings.push(obj);
      }
    });

    // 4. HALLAZGOS MANUALES ADICIONALES INGRESADOS POR EL REVISOR
    (fase3State.hallazgosManuales || []).forEach((m) => {
      const itemBadge = "Obs. Manual";
      const obj = {
        id: m.id,
        itemKey: m.id,
        itemNum: "Manual",
        itemBadge: itemBadge,
        fase: "Revisión Manual",
        titulo: m.titulo || "Observación / Requisito Adicional",
        norma: "Criterio Técnico del Revisor",
        estado: m.estado || "No Aceptado / Por Subsanar",
        motivo: m.motivo || "",
        isManual: true
      };
      if (obj.estado === "Conforme") {
        compliantItems.push(obj);
      } else {
        findings.push(obj);
      }
    });

    // Aplicar indicador de omisión para la impresión (a consideración del revisor, sin eliminar del sistema)
    findings.forEach(f => {
      const itemKey = this.toItemKey(f.id);
      const userEdit = this.getUserEdit(fase3State, f.id);
      f.omitido = Boolean(
        (fase3State.observacionesOmitidas && (fase3State.observacionesOmitidas[f.id] || fase3State.observacionesOmitidas[itemKey])) ||
        (userEdit && userEdit.omitido === true)
      );
    });

    return { findings, compliantItems };
  },

  /**
   * Actualiza el estado de un hallazgo y persiste en el proyecto activo
   */
  updateFindingStatus(id, newStatus) {
    const projectId = App.currentProjectId;
    const state = this.getFase3State(projectId);
    const itemKey = this.toItemKey(id);

    state.matrizObservaciones = state.matrizObservaciones || {};
    state.observacionesEditadas = state.observacionesEditadas || {};

    // Si es manual
    const manual = (state.hallazgosManuales || []).find(m => m.id === id);
    if (manual) {
      manual.estado = newStatus;
    } else {
      state.matrizObservaciones[itemKey] = state.matrizObservaciones[itemKey] || {};
      state.matrizObservaciones[itemKey].estado = newStatus;

      state.observacionesEditadas[itemKey] = state.matrizObservaciones[itemKey];
      state.observacionesEditadas[id] = state.matrizObservaciones[itemKey];
    }

    // Actualizar en tiempo real expedientesMap[proyectoId].fase3.matrizObservaciones
    const expedientesMap = (window.SIPRO_DATA && SIPRO_DATA.expedientesMap) || window.proyectosAuditados || {};
    if (expedientesMap[projectId]) {
      expedientesMap[projectId].fase3 = expedientesMap[projectId].fase3 || {};
      expedientesMap[projectId].fase3.matrizObservaciones = state.matrizObservaciones;
      expedientesMap[projectId].fase3.observacionesEditadas = state.observacionesEditadas;
    }

    // Sincronizar hacia project.revisionSupervisor si corresponde a un ítem documental o ficha
    try {
      const matchItem = id.match(/^(?:FASE_2_ITEM_|item_)(\d+)$/i);
      const isFicha = id.toUpperCase() === "FICHA_PRIORIZACION" || id.toUpperCase() === "FASE_2_FICHA_PRIORIZACION";
      const targetProject = (window.proyectosAuditados && window.proyectosAuditados[projectId]) || (window.SIPRO_DATA && SIPRO_DATA.expedientesMap && SIPRO_DATA.expedientesMap[projectId]) || App.currentProject;
      if (targetProject) {
        const pObj = targetProject.datos || targetProject;
        pObj.revisionSupervisor = pObj.revisionSupervisor || {};
        if (matchItem) {
          const numId = parseInt(matchItem[1], 10);
          pObj.revisionSupervisor[numId] = {
            estado: newStatus === "Conforme" ? "CONFORME" : "NO_CONFORME",
            observacion: (state.matrizObservaciones[itemKey] && state.matrizObservaciones[itemKey].motivo) || "",
            fecha: new Date().toISOString(),
            supervisor: window.SUPERVISOR_NAME || "Supervisor Técnico"
          };
          if (typeof DocumentalEngine !== "undefined" && typeof DocumentalEngine.auditProject === "function") {
            DocumentalEngine.auditProject(pObj);
            const container = document.getElementById("documentalMatrixContainer");
            if (container && pObj.auditResult) {
              DocumentalEngine.renderDocumentalMatrix(pObj.auditResult, container, DocumentalEngine.currentFilter || "ALL", projectId);
            }
          }
        } else if (isFicha) {
          pObj.revisionSupervisor["ficha_priorizacion"] = {
            estado: newStatus === "Conforme" ? "CONFORME" : "NO_CONFORME",
            observacion: (state.matrizObservaciones[itemKey] && state.matrizObservaciones[itemKey].motivo) || "",
            fecha: new Date().toISOString(),
            supervisor: window.SUPERVISOR_NAME || "Supervisor Técnico"
          };
        }
      }
    } catch (eSync) {
      console.warn("Error sincronizando estado con revisionSupervisor:", eSync);
    }

    if (window.App && typeof App.saveAuditProgress === "function") {
      App.saveAuditProgress(true);
    }

    this.renderOfficialReport(App.currentProject, App.auditGlobal, document.getElementById("officialReportContainer"));
    if (window.App && typeof App.actualizarKPIsEjecutivos === "function") {
      App.actualizarKPIsEjecutivos(projectId);
    }
    if (window.App && typeof App.actualizarBarraCompuertas === "function") {
      App.actualizarBarraCompuertas(projectId);
    }
  },

  /**
   * Auto-ajusta la altura del textarea dinámicamente y sincroniza el contenedor de impresión
   */
  autoResizeTextarea(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(el.scrollHeight, 38) + "px";
    if (el.id && el.id.startsWith("motivo_")) {
      const findingId = el.id.replace("motivo_", "");
      const printEl = document.getElementById("print_motivo_" + findingId);
      if (printEl) {
        printEl.textContent = el.value || "";
      }
    }
  },

  /**
   * Actualiza el motivo/detalle editable de un hallazgo (sin re-render para no perder el foco)
   */
  updateFindingMotivo(id, newMotivo) {
    const printEl = document.getElementById("print_motivo_" + id);
    if (printEl) printEl.textContent = newMotivo;
    const projectId = App.currentProjectId;
    const state = this.getFase3State(projectId);
    const itemKey = this.toItemKey(id);

    state.matrizObservaciones = state.matrizObservaciones || {};
    state.observacionesEditadas = state.observacionesEditadas || {};

    const manual = (state.hallazgosManuales || []).find(m => m.id === id);
    if (manual) {
      manual.motivo = newMotivo;
    } else {
      state.matrizObservaciones[itemKey] = state.matrizObservaciones[itemKey] || {};
      state.matrizObservaciones[itemKey].motivo = newMotivo;

      state.observacionesEditadas[itemKey] = state.matrizObservaciones[itemKey];
      state.observacionesEditadas[id] = state.matrizObservaciones[itemKey];
    }

    // Actualizar en tiempo real expedientesMap[proyectoId].fase3.matrizObservaciones
    const expedientesMap = (window.SIPRO_DATA && SIPRO_DATA.expedientesMap) || window.proyectosAuditados || {};
    if (expedientesMap[projectId]) {
      expedientesMap[projectId].fase3 = expedientesMap[projectId].fase3 || {};
      expedientesMap[projectId].fase3.matrizObservaciones = state.matrizObservaciones;
      expedientesMap[projectId].fase3.observacionesEditadas = state.observacionesEditadas;
    }

    // Sincronizar observación hacia project.revisionSupervisor si corresponde
    try {
      const matchItem = id.match(/^(?:FASE_2_ITEM_|item_)(\d+)$/i);
      const isFicha = id.toUpperCase() === "FICHA_PRIORIZACION" || id.toUpperCase() === "FASE_2_FICHA_PRIORIZACION";
      const targetProject = (window.proyectosAuditados && window.proyectosAuditados[projectId]) || (window.SIPRO_DATA && SIPRO_DATA.expedientesMap && SIPRO_DATA.expedientesMap[projectId]) || App.currentProject;
      if (targetProject) {
        const pObj = targetProject.datos || targetProject;
        if (pObj.revisionSupervisor) {
          if (matchItem) {
            const numId = parseInt(matchItem[1], 10);
            if (pObj.revisionSupervisor[numId]) {
              pObj.revisionSupervisor[numId].observacion = newMotivo;
            }
          } else if (isFicha && pObj.revisionSupervisor["ficha_priorizacion"]) {
            pObj.revisionSupervisor["ficha_priorizacion"].observacion = newMotivo;
          }
        }
      }
    } catch (eSyncMot) {
      console.warn("Error sincronizando motivo con revisionSupervisor:", eSyncMot);
    }

    // Debounce save to localStorage/json
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      if (window.App && typeof App.saveAuditProgress === "function") {
        App.saveAuditProgress(true);
      }
    }, 600);
  },

  /**
   * Conmuta la omisión de una observación para que no aparezca en la impresión ni PDF, sin eliminarla del sistema
   */
  toggleOmitFinding(id) {
    const projectId = App.currentProjectId;
    const state = this.getFase3State(projectId);
    const itemKey = this.toItemKey(id);

    state.observacionesOmitidas = state.observacionesOmitidas || {};
    const isCurrentlyOmitted = Boolean(state.observacionesOmitidas[id] || state.observacionesOmitidas[itemKey]);
    const nextState = !isCurrentlyOmitted;

    state.observacionesOmitidas[id] = nextState;
    state.observacionesOmitidas[itemKey] = nextState;

    state.matrizObservaciones = state.matrizObservaciones || {};
    state.observacionesEditadas = state.observacionesEditadas || {};

    state.matrizObservaciones[itemKey] = state.matrizObservaciones[itemKey] || {};
    state.matrizObservaciones[itemKey].omitido = nextState;

    state.observacionesEditadas[itemKey] = state.matrizObservaciones[itemKey];
    state.observacionesEditadas[id] = state.matrizObservaciones[itemKey];

    const manual = (state.hallazgosManuales || []).find(m => m.id === id);
    if (manual) {
      manual.omitido = nextState;
    }

    const expedientesMap = (window.SIPRO_DATA && SIPRO_DATA.expedientesMap) || window.proyectosAuditados || {};
    if (expedientesMap[projectId]) {
      expedientesMap[projectId].fase3 = expedientesMap[projectId].fase3 || {};
      expedientesMap[projectId].fase3.observacionesOmitidas = state.observacionesOmitidas;
      expedientesMap[projectId].fase3.matrizObservaciones = state.matrizObservaciones;
      expedientesMap[projectId].fase3.observacionesEditadas = state.observacionesEditadas;
    }

    if (window.App && typeof App.saveAuditProgress === "function") {
      App.saveAuditProgress(true);
    }

    this.renderOfficialReport(App.currentProject, App.auditGlobal, document.getElementById("officialReportContainer"));

    const toastMsg = nextState
      ? "🚫 Observación omitida para la impresión (se conserva guardada en el sistema)."
      : "👁️ Observación restaurada e incluida para la impresión.";
    if (typeof FolderReader !== "undefined" && FolderReader.showToast) {
      FolderReader.showToast(toastMsg);
    }
  },

  /**
   * Actualiza el título de un requisito manual
   */
  updateManualTitle(id, newTitle) {
    const projectId = App.currentProjectId;
    const state = this.getFase3State(projectId);
    const manual = (state.hallazgosManuales || []).find(m => m.id === id);
    if (manual) {
      manual.titulo = newTitle;
    }
  },

  /**
   * Agrega un nuevo requisito u observación manual a la tabla
   */
  addManualFinding() {
    const projectId = App.currentProjectId;
    if (!projectId) {
      alert("Por favor cargue un proyecto antes de añadir observaciones.");
      return;
    }
    const state = this.getFase3State(projectId);
    state.hallazgosManuales = state.hallazgosManuales || [];

    const newId = `manual_${Date.now()}`;
    state.hallazgosManuales.push({
      id: newId,
      titulo: `Observación Técnica Adicional ${state.hallazgosManuales.length + 1}`,
      estado: "No Aceptado / Por Subsanar",
      motivo: ""
    });

    this.renderOfficialReport(App.currentProject, App.auditGlobal, document.getElementById("officialReportContainer"));
    if (window.App && typeof App.actualizarKPIsEjecutivos === "function") {
      App.actualizarKPIsEjecutivos(projectId);
    }
    if (window.App && typeof App.actualizarBarraCompuertas === "function") {
      App.actualizarBarraCompuertas(projectId);
    }

    setTimeout(() => {
      const textarea = document.getElementById(`motivo_${newId}`);
      if (textarea) textarea.focus();
    }, 100);
  },

  /**
   * Elimina un hallazgo manual
   */
  removeManualFinding(id) {
    const projectId = App.currentProjectId;
    const state = this.getFase3State(projectId);
    state.hallazgosManuales = (state.hallazgosManuales || []).filter(m => m.id !== id);
    this.renderOfficialReport(App.currentProject, App.auditGlobal, document.getElementById("officialReportContainer"));
    if (window.App && typeof App.actualizarKPIsEjecutivos === "function") {
      App.actualizarKPIsEjecutivos(projectId);
    }
    if (window.App && typeof App.actualizarBarraCompuertas === "function") {
      App.actualizarBarraCompuertas(projectId);
    }
  },

  /**
   * Actualiza el concepto técnico editable
   */
  updateConcepto(newConcepto) {
    const projectId = App.currentProjectId;
    const state = this.getFase3State(projectId);
    state.conclusionesConcepto = newConcepto;
  },

  /**
   * Alterna la visualización del acordeón de ítems conformes
   */
  toggleCompliantList() {
    this.compliantCollapsed = !this.compliantCollapsed;
    const el = document.getElementById("reportCompliantGrid");
    const icon = document.getElementById("reportCompliantIcon");
    if (el) el.style.display = this.compliantCollapsed ? "none" : "grid";
    if (icon) icon.innerText = this.compliantCollapsed ? "▶ Ver lista" : "▼ Ocultar";
  },

  /**
   * Genera el JSON estructurado oficial integrando las observaciones editadas
   */
  generateStructuredOutput(project, auditGlobal) {
    const projectId = (project && project.id) || App.currentProjectId;
    const fase3State = this.getFase3State(projectId);
    const { findings, compliantItems } = this.collectAllFindings(project, auditGlobal);

    // Conteo estricto y real de la Fase 2 (requisitos documentales de expedientesMap)
    const recF2 = (window.proyectosAuditados && projectId) ? window.proyectosAuditados[projectId] : null;
    const audit2Data = (recF2 && recF2.fase2) || (auditGlobal && auditGlobal.audit2) || {};
    const reportProcessMode = (project && project.procesoEspecial) || (recF2 && recF2.procesoEspecial) || (window.App && window.App.currentProcessMode) || (window.SIPRO_PROCESS_MODE) || "ORDINARIO";
    const isReport2026_2 = reportProcessMode === "2026_2" || reportProcessMode === "CONVENIOS_2026_2";
    const items27List = (audit2Data && audit2Data.items) || (isReport2026_2 ? SIPRO_DATA.items41_2026_2 : SIPRO_DATA.items27) || [];
    let f2Conformes = 0;
    let f2Pendientes = 0;
    items27List.forEach((it) => {
      const fid = `item_${it.num || it.id}`;
      const userEdit = fase3State.observacionesEditadas[fid];
      const status = userEdit?.estado || (it.conforme ? "Conforme" : (it.vencido ? "Vencido" : (it.faltante ? "Faltante" : "No Aceptado / Por Subsanar")));
      if (status === "Conforme") {
        f2Conformes++;
      } else {
        f2Pendientes++;
      }
    });

    const isFavorable = findings.length === 0;

    return {
      entidad: "Gobernación de Antioquia - Secretaría de Infraestructura Física - Dirección de Infraestructura Física y Apoyo Territorial",
      sistema: "SIPRO-PH (Sistema de Revisión y Priorización Técnico-Documental)",
      norma_evaluada: "Criterios Técnicos de Diseño de Pavimentos con Placa-huella",
      codigo_proyecto: (project && project.codigo) || "EXP-PH",
      municipio: (project && project.municipio) || "Antioquia",
      subregion: (project && project.subregion) || "Antioquia",
      tramo_intervencion: (project && project.nombreTramo) || "Sector Veredal",
      codigo_vial: (project && project.codigoVial) || "Terciaria",
      longitud_m: (project && project.longitudM) || 0,
      fecha_evaluacion: new Date().toLocaleDateString("es-CO"),
      dictamen_general: isFavorable ? "CONCEPTO_TECNICO_FAVORABLE" : "REQUIERE_SUBSANACION_TECNICA",
      total_requerimientos_subsanar: findings.length,
      total_requerimientos_conformes: compliantItems.length,
      matriz_subsanacion: findings.map(f => ({
        requisito: f.titulo,
        fase: f.fase,
        estado: f.estado,
        motivo_no_aceptacion: f.motivo
      })),
      conclusiones_concepto_territorial: fase3State.conclusionesConcepto || (
        isFavorable
          ? "Se emite CONCEPTO TÉCNICO FAVORABLE para la suscripción del Convenio Interadministrativo de Cofinanciación entre el Departamento de Antioquia y el Municipio evaluado."
          : "Se emite REQUERIMIENTO DE SUBSANACIÓN TÉCNICA. El municipio debe atender las observaciones y documentos pendientes para viabilizar la suscripción del convenio."
      )
    };
  },

  /**
   * Renderiza el Informe Técnico-Documental de Resultados de Revisión y Subsanación
   */
  renderOfficialReport(project, auditGlobal, container) {
    if (!container) return;
    if (!project) {
      container.innerHTML = `
        <div style="text-align:center;padding:48px;color:var(--text-muted)">
          <div style="font-size:16px;font-weight:700;color:var(--text-main);margin-bottom:6px;">Informe de Resultados de Revisión y Subsanación</div>
          <div>Cargue o seleccione un expediente municipal para visualizar la matriz técnica.</div>
        </div>
      `;
      return;
    }

    const projectId = project.id || App.currentProjectId;
    const fase3State = this.getFase3State(projectId);
    const { findings, compliantItems } = this.collectAllFindings(project, auditGlobal);

    // Conteo estricto y real de la Fase 2 (requisitos documentales de expedientesMap)
    const recF2 = (window.proyectosAuditados && projectId) ? window.proyectosAuditados[projectId] : null;
    const audit2Data = (recF2 && recF2.fase2) || (auditGlobal && auditGlobal.audit2) || {};
    const reportProcessMode = (project && project.procesoEspecial) || (recF2 && recF2.procesoEspecial) || (window.App && window.App.currentProcessMode) || (window.SIPRO_PROCESS_MODE) || "ORDINARIO";
    const isReport2026_2 = reportProcessMode === "2026_2" || reportProcessMode === "CONVENIOS_2026_2";
    const items27List = (audit2Data && audit2Data.items) || (isReport2026_2 ? SIPRO_DATA.items41_2026_2 : SIPRO_DATA.items27) || [];
    let f2Conformes = 0;
    let f2Pendientes = 0;
    items27List.forEach((it) => {
      const fid = `item_${it.num || it.id}`;
      const userEdit = fase3State.observacionesEditadas[fid];
      const status = userEdit?.estado || (it.conforme ? "Conforme" : (it.vencido ? "Vencido" : (it.faltante ? "Faltante" : "No Aceptado / Por Subsanar")));
      if (status === "Conforme") {
        f2Conformes++;
      } else {
        f2Pendientes++;
      }
    });

    const isFavorable = (findings.length === 0);

    // Texto de concepto técnico pre-llenado si aún no ha sido editado
    if (fase3State.conclusionesConcepto === undefined || fase3State.conclusionesConcepto === "") {
      fase3State.conclusionesConcepto = isFavorable
        ? `Con base en la revisión integral de las compuertas técnicas y documentales bajo los Criterios Técnicos de Pavimentos con Placa-huella, la Dirección de Infraestructura Física y Apoyo Territorial emite CONCEPTO TÉCNICO FAVORABLE para la priorización y viabilidad de suscripción del Convenio Interadministrativo de Cofinanciación con el Municipio de ${project.municipio}.`
        : `Con base en la revisión técnico-documental efectuada bajo los Criterios Técnicos Departamentales de Pavimentos con Placa-huella, la Dirección de Infraestructura Física y Apoyo Territorial emite REQUERIMIENTO DE SUBSANACIÓN TÉCNICA. El municipio de ${project.municipio} deberá subsanar las observaciones y aportar los requisitos no conformes detallados en el presente informe previo a la emisión del concepto favorable de priorización.`;
    }

    const isRecursos = project.modalidad === "RECURSOS" || (recF2 && recF2.modalidad === "RECURSOS");
    const getAlcaldeNombre = (p) => {
      if (!p) return "";
      if (typeof p.alcalde === "string") return p.alcalde;
      if (p.alcalde && p.alcalde.nombre) return p.alcalde.nombre;
      return "";
    };
    const getSecretarioNombre = (p) => {
      if (!p) return "";
      if (typeof p.secretarioPlaneacion === "string") return p.secretarioPlaneacion;
      if (p.secretarioPlaneacion && p.secretarioPlaneacion.nombre) return p.secretarioPlaneacion.nombre;
      return "";
    };

    const getAlcaldeOrigen = (p) => {
      if (!p) return "";
      if (p.alcalde && p.alcalde.origen) return p.alcalde.origen;
      return "";
    };
    const getSecretarioOrigen = (p) => {
      if (!p) return "";
      if (p.secretarioPlaneacion && p.secretarioPlaneacion.origen) return p.secretarioPlaneacion.origen;
      return "";
    };

    const alcaldeNombre = getAlcaldeNombre(project) ||
      getAlcaldeNombre(recF2 && recF2.datos) ||
      getAlcaldeNombre(recF2) ||
      (fase3State && fase3State.datosIdentificacion && fase3State.datosIdentificacion.alcalde && fase3State.datosIdentificacion.alcalde.nombre) ||
      `Alcalde Municipal de ${project.municipio || 'Municipio'}`;

    const alcaldeOrigen = getAlcaldeOrigen(project) ||
      getAlcaldeOrigen(recF2 && recF2.datos) ||
      getAlcaldeOrigen(recF2) ||
      (fase3State && fase3State.datosIdentificacion && fase3State.datosIdentificacion.alcalde && fase3State.datosIdentificacion.alcalde.origen) ||
      "";

    const secretarioNombre = getSecretarioNombre(project) ||
      getSecretarioNombre(recF2 && recF2.datos) ||
      getSecretarioNombre(recF2) ||
      (fase3State && fase3State.datosIdentificacion && fase3State.datosIdentificacion.secretarioPlaneacion && fase3State.datosIdentificacion.secretarioPlaneacion.nombre) ||
      "Secretaría de Planeación y Obras Públicas";

    const secretarioOrigen = getSecretarioOrigen(project) ||
      getSecretarioOrigen(recF2 && recF2.datos) ||
      getSecretarioOrigen(recF2) ||
      (fase3State && fase3State.datosIdentificacion && fase3State.datosIdentificacion.secretarioPlaneacion && fase3State.datosIdentificacion.secretarioPlaneacion.origen) ||
      "";

    const fichaData = (project && project.fichaPriorizacion) || (recF2 && recF2.fichaPriorizacion) || (recF2 && recF2.datos && recF2.datos.fichaPriorizacion) || {};
    const fichaExiste = Boolean(fichaData && fichaData.existe);
    const fichaFileName = (fichaData && fichaData.fileName) || "Sin archivo";

    const html = `
      <div class="formal-sheet">
        
        <!-- BLOQUE 1 — CABECERA INSTITUCIONAL OFICIAL (NO IMPRIMIR) -->
        <div class="sheet-header no-print">
          <div class="gov-official-logo">
            <img src="assets/Logo.png" alt="Gobernación de Antioquia" style="height:78px;max-height:85px;width:auto;object-fit:contain">
            <div class="gov-official-title" style="margin-left:12px">
              <span class="gov-name" style="font-size:16px;font-weight:900;letter-spacing:0.5px;">GOBERNACIÓN DE ANTIOQUIA</span>
              <span class="gov-dept" style="font-size:12.5px;font-weight:800;color:var(--color-primary-dark);line-height:1.3;margin-top:2px;">Secretaría de Infraestructura Física - Dirección de Infraestructura Física y Apoyo Territorial</span>
              <span style="font-size:11px;color:var(--text-muted);margin-top:2px;">Sistema de Revisión y Priorización Técnico-Documental (SIPRO-PH)</span>
            </div>
          </div>
          <div class="sheet-id-badge">
            <div class="sheet-code" style="font-size:16px;font-weight:900;color:${isFavorable ? 'var(--status-success)' : 'var(--status-danger)'}">${project.codigo || 'EXP-PH'}</div>
            <div class="sheet-date" style="margin-top:3px;">Fecha de Emisión: <b>${new Date().toLocaleDateString("es-CO")}</b></div>
            <div style="font-size:11px;font-weight:800;margin-top:4px;color:${isFavorable ? 'var(--status-success)' : 'var(--status-danger)'}">
              ${isFavorable ? '&#10003; EVALUACIÓN CONFORME' : `&#9888; ${findings.length} OBSERVACIONES POR SUBSANAR`}
            </div>
          </div>
        </div>

        <!-- TÍTULO DE LA FICHA TÉCNICA DE OBSERVACIONES (NO IMPRIMIR) -->
        <div class="sheet-title-intro no-print" style="text-align: center; margin-bottom: 20px;">
          <div class="official-seal-stamp ${isFavorable ? 'seal-favorable' : 'seal-subsanacion'}" style="font-size:13.5px;">
            ${isFavorable 
              ? '&#10003; FICHA OFICIAL DE REVISIÓN: CONCEPTO TÉCNICO FAVORABLE' 
              : '&#9888; FICHA OFICIAL DE OBSERVACIONES Y REQUERIMIENTO DE SUBSANACIÓN'}
          </div>
          <p style="font-size:12px;color:var(--text-muted);max-width:780px;margin:0 auto;line-height:1.45;">
            Evaluación técnica integral del proyecto bajo los <b>Criterios Técnicos de Pavimentos con Placa-huella</b>. 
            Consolida los hallazgos de compuertas estructurales, trazados espaciales, coherencia presupuestal y requisitos documentales.
          </p>
        </div>

        <!-- BLOQUE 1 — TARJETA LIMPIA DE IDENTIFICACIÓN TERRITORIAL DEL PROYECTO -->
        <div class="sheet-territorial-card" style="background:var(--color-bg-alt);padding:18px 22px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);margin-bottom:24px;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
            <h5 style="font-size:12px;font-weight:800;color:var(--color-primary);text-transform:uppercase;margin:0;letter-spacing:0.5px;display:flex;align-items:center;gap:6px;">
              <span>📍</span> Identificación Territorial del Proyecto
            </h5>
            ${isReport2026_2 ? '' : `
              <button type="button" class="btn-primary" style="font-size:11.5px;padding:5px 14px;background:#0284C7;border-color:#0284C7;color:#fff;display:inline-flex;align-items:center;gap:6px;border-radius:6px;cursor:pointer;font-weight:700;box-shadow:0 1px 3px rgba(0,0,0,0.12);" onclick="DocumentalEngine.abrirFichaPriorizacion('${projectId}')" title="Abrir y verificar la Ficha de Priorización en el visor modal de Fase 2">
                <span>👁️ Ver Ficha de Priorización</span>
              </button>
            `}
          </div>

          <!-- BARRA DE ESTADO DE LA FICHA DE PRIORIZACIÓN / PROCESO 2026 - II -->
          ${isReport2026_2 ? `
            <div class="ficha-territorial-status-bar no-print" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:8px 14px;background:var(--color-bg);border:1px solid #0284c7;border-left:4px solid #0284c7;border-radius:6px;margin-bottom:14px;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span style="font-weight:700;font-size:11.5px;color:var(--color-primary);">⚡ Proceso Especial Convenios "2026 - II":</span>
                <span class="status-pill cumple" style="font-size:11px;padding:3px 9px;">
                  ✓ Lista de Viabilidad Técnica (41 Requisitos - Sin Ficha de Priorización)
                </span>
              </div>
            </div>
          ` : `
            <div class="ficha-territorial-status-bar no-print" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:8px 14px;background:var(--color-bg);border:1px solid var(--border-subtle);border-radius:6px;margin-bottom:14px;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span style="font-weight:700;font-size:11.5px;color:var(--text-main);">Documento Base:</span>
                ${fichaExiste ? `
                  <span class="status-pill cumple" style="font-size:11px;padding:3px 9px;">
                    ✓ Ficha detectada: <strong>${fichaFileName}</strong>
                  </span>
                ` : `
                  <span class="status-pill no-cumple" style="font-size:11px;padding:3px 9px;background:#fee2e2;color:#991b1b;border:1px solid #f87171;">
                    ✗ Ficha de Priorización: Documento faltante en el expediente
                  </span>
                `}
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <button type="button" class="btn-secondary" style="font-size:11px;padding:4px 10px;display:inline-flex;align-items:center;gap:4px;" onclick="DocumentalEngine.abrirFichaPriorizacion('${projectId}')" title="Ver documento en el visor modal">
                  <span>👁️ Ver Ficha</span>
                </button>
                ${fichaExiste ? `
                  <button type="button" class="btn-secondary" style="font-size:11px;padding:4px 10px;display:inline-flex;align-items:center;gap:4px;" onclick="App.subirFichaPriorizacion('${projectId}')" title="Subir o reemplazar la Ficha de Priorización">
                    <span>📤 Cambiar / Subir Ficha</span>
                  </button>
                ` : `
                  <button type="button" class="btn-primary" style="font-size:11px;padding:4px 12px;background:#dc2626;border-color:#b91c1c;display:inline-flex;align-items:center;gap:4px;" onclick="App.subirFichaPriorizacion('${projectId}')" title="Cargar archivo de Ficha de Priorización">
                    <span>📤 Subir Ficha de Priorización</span>
                  </button>
                `}
              </div>
            </div>
          `}
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:14px 24px;font-size:12.5px;">
            <div>
              <span style="color:var(--text-muted);display:block;font-size:11px;font-weight:700;">Municipio y Subregión:</span>
              <input type="text" class="print-input-text form-input" value="${project.municipio || 'Municipio'} (${project.subregion || 'Antioquia'})" onchange="ReportsEngine.updateProjectField('municipioSubregion', this.value)" style="font-weight:800;padding:4px 8px;font-size:12px;margin-top:2px;">
            </div>
            <div>
              <span style="color:var(--text-muted);display:block;font-size:11px;font-weight:700;">Nombre del Proyecto y Modalidad:</span>
              <div style="display:flex;align-items:center;gap:8px;margin-top:2px;">
                <input type="text" class="print-input-text form-input" value="${project.nombreExpediente || project.nombreTramo || 'Proyecto Placa Huella'}" onchange="ReportsEngine.updateProjectField('nombreExpediente', this.value)" style="font-weight:800;flex:1;padding:4px 8px;font-size:12px;">
                <span class="badge-modalidad ${isRecursos ? 'recursos' : ''}" style="flex-shrink:0;">
                  ${isRecursos ? '💰 RECURSOS' : '🧱 MATERIALES'}
                </span>
              </div>
            </div>
            <div>
              <span style="color:var(--text-muted);display:block;font-size:11px;font-weight:700;">Código Vial y Longitud:</span>
              <input type="text" class="print-input-text form-input" value="Vía: ${project.codigoVial || 'Terciaria'} — Longitud: ${project.longitudM || 0} metros lineales" onchange="ReportsEngine.updateProjectField('codigoVialLongitud', this.value)" style="font-weight:700;padding:4px 8px;font-size:12px;margin-top:2px;">
            </div>
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:2px;">
                <span style="color:var(--text-muted);font-size:11px;font-weight:700;">Alcalde(sa) Municipal:</span>
                ${alcaldeOrigen ? `
                  <span class="source-tooltip-badge" title="${this.escapeHtml(alcaldeOrigen)}" style="font-size:10px;font-weight:600;color:var(--color-primary);background:rgba(2,132,199,0.08);padding:1px 6px;border-radius:4px;border:1px solid rgba(2,132,199,0.2);cursor:help;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                    ℹ️ ${this.escapeHtml(alcaldeOrigen)}
                  </span>
                ` : ''}
              </div>
              <input type="text" class="print-input-text form-input" value="${alcaldeNombre}" title="${this.escapeHtml(alcaldeOrigen || 'Alcalde(sa) Municipal')}" placeholder="Nombre del Alcalde(sa) Municipal" onchange="ReportsEngine.updateProjectField('alcalde', this.value)" onblur="ReportsEngine.updateProjectField('alcalde', this.value)" style="font-weight:700;padding:4px 8px;font-size:12px;">
            </div>
            <div style="grid-column: 1 / -1;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:2px;">
                <span style="color:var(--text-muted);font-size:11px;font-weight:700;">Secretario(a) de Planeación / Obras Públicas Municipal:</span>
                ${secretarioOrigen ? `
                  <span class="source-tooltip-badge" title="${this.escapeHtml(secretarioOrigen)}" style="font-size:10px;font-weight:600;color:var(--color-primary);background:rgba(2,132,199,0.08);padding:1px 6px;border-radius:4px;border:1px solid rgba(2,132,199,0.2);cursor:help;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                    ℹ️ ${this.escapeHtml(secretarioOrigen)}
                  </span>
                ` : ''}
              </div>
              <input type="text" class="print-input-text form-input" value="${secretarioNombre}" title="${this.escapeHtml(secretarioOrigen || 'Secretario(a) de Planeación / Obras Públicas')}" placeholder="Nombre del Secretario(a) de Planeación / Obras Públicas" onchange="ReportsEngine.updateProjectField('secretario', this.value)" onblur="ReportsEngine.updateProjectField('secretario', this.value)" style="font-weight:700;padding:4px 8px;font-size:12px;">
            </div>
          </div>
        </div>

        <!-- SECCIÓN 1 (PRIORITARIA): MATRIZ DE DOCUMENTOS Y REQUISITOS FALTANTES / NO ACEPTADOS -->
        <div class="sheet-matriz-faltantes" style="margin-bottom: 28px;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
            <div>
              <h4 style="font-size:14px;font-weight:900;color:var(--status-danger);display:flex;align-items:center;gap:8px;">
                <span>📋</span> Sección 1: Matriz de Requisitos y Documentos Faltantes / No Aceptados (${findings.length}${findings.some(f => f.omitido) ? ` • ${findings.filter(f => !f.omitido).length} en impresión, ${findings.filter(f => f.omitido).length} omitidas` : ''})
              </h4>
              <p style="font-size:11.5px;color:var(--text-muted);margin-top:2px;">
                Listado prioritario de no conformidades. Edite el estado o amplíe la observación técnica de subsanación para cada ítem:
              </p>
            </div>
            <button type="button" class="report-btn-add" onclick="ReportsEngine.addManualFinding()" title="Añadir una observación o requisito técnico no contemplado">
              ➕ Agregar Observación / Requisito Manual
            </button>
          </div>

          ${findings.length === 0 ? `
            <div style="background:rgba(16,185,129,0.08);border:1px dashed #10B981;padding:16px 20px;border-radius:var(--radius-md);text-align:center;color:#065F46;font-size:13px;font-weight:700;">
              &#10003; ¡Excelente! No se registran requisitos faltantes ni observaciones pendientes de subsanación. Todos los ítems se encuentran en estado Conforme.
            </div>
          ` : `
            <div class="table-responsive" style="border:1px solid var(--border-subtle);border-radius:var(--radius-md);overflow:hidden;">
              <table class="report-editable-table">
                <thead>
                  <tr>
                    <th style="width:26%;">Ítem / Fase / Requisito</th>
                    <th style="width:18%;">Estado Actual</th>
                    <th style="width:40%;">Detalle / Motivo de No Aceptación (Editable por el Revisor)</th>
                    <th style="width:16%;text-align:center;">Impresión / Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${findings.map((f) => `
                    <tr class="${f.omitido ? 'row-omitted-finding' : ''}" style="${f.omitido ? 'background:rgba(241, 245, 249, 0.75);opacity:0.8;' : ''}">
                      <td>
                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
                          <span class="badge-item-checklist" style="display:inline-flex;align-items:center;background:#0284c7;color:#ffffff;font-weight:900;font-size:11.5px;padding:3px 9px;border-radius:5px;font-family:var(--font-mono);letter-spacing:0.4px;box-shadow:0 1px 3px rgba(2,132,199,0.3);">
                            ${f.itemBadge || (f.itemNum ? `Ítem ${f.itemNum}` : f.fase)}
                          </span>
                          <span style="background:rgba(15,23,42,0.06);color:var(--text-muted);font-weight:700;font-size:10px;padding:2px 7px;border-radius:4px;font-family:var(--font-mono);">
                            ${f.fase}
                          </span>
                        </div>
                        <div style="font-weight:800;color:var(--text-main);font-size:12.5px;line-height:1.4;${f.omitido ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">${f.titulo}</div>
                        ${f.norma ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">• ${f.norma}</div>` : ''}
                        ${f.archivo ? `
                          <div style="font-size:11px;color:#0284c7;font-weight:600;margin-top:4px;display:flex;align-items:center;gap:4px;font-family:var(--font-mono);">
                            <span>📄</span> <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px;" title="${this.escapeHtml(f.archivo)}">${this.escapeHtml(f.archivo)}</span>
                          </div>
                        ` : ''}
                        ${f.omitido ? `
                          <div style="display:inline-flex;align-items:center;gap:4px;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;margin-top:5px;">
                            🚫 Omitida de impresión
                          </div>
                        ` : ''}
                        ${f.isManual ? `
                          <div style="margin-top:4px;">
                            <input type="text" value="${f.titulo.replace(/"/g, '&quot;')}" onchange="ReportsEngine.updateManualTitle('${f.id}', this.value)" style="font-size:11px;padding:3px 6px;border:1px dashed var(--border-strong);border-radius:4px;width:95%;background:var(--color-bg);" placeholder="Editar título de requisito...">
                          </div>
                        ` : ''}
                      </td>
                      <td>
                        <select class="report-status-select ${f.estado === 'Faltante' ? 'status-faltante' : (f.estado === 'Vencido' ? 'status-vencido' : (f.estado === 'Conforme' ? 'status-conforme' : 'status-subsanar'))}" onchange="ReportsEngine.updateFindingStatus('${f.id}', this.value)">
                          <option value="Faltante" ${f.estado === 'Faltante' ? 'selected' : ''}>⚠️ Faltante</option>
                          <option value="No Aceptado / Por Subsanar" ${f.estado === 'No Aceptado / Por Subsanar' ? 'selected' : ''}>❌ No Aceptado / Por Subsanar</option>
                          <option value="Vencido" ${f.estado === 'Vencido' ? 'selected' : ''}>⏳ Vencido</option>
                          <option value="Conforme" ${f.estado === 'Conforme' ? 'selected' : ''}>&#10003; Conforme</option>
                        </select>
                      </td>
                      <td>
                        <textarea id="motivo_${f.id}" class="report-textarea" rows="2" placeholder="Escriba el motivo técnico detallado de no aceptación o la acción requerida para subsanar..." oninput="ReportsEngine.autoResizeTextarea(this); ReportsEngine.updateFindingMotivo('${f.id}', this.value);" style="${f.omitido ? 'background:#f8fafc;color:#64748b;' : ''}">${this.escapeHtml(f.motivo || '')}</textarea>
                        <div class="print-observation-text" id="print_motivo_${f.id}">${this.escapeHtml(f.motivo || '')}</div>
                      </td>
                      <td style="text-align:center;vertical-align:middle;">
                        <div style="display:flex;flex-direction:column;gap:5px;align-items:center;justify-content:center;">
                          ${f.omitido ? `
                            <button type="button" class="btn-omit-finding" onclick="ReportsEngine.toggleOmitFinding('${f.id}')" title="Esta observación está excluida de la impresión. Haga clic para incluirla de nuevo." style="padding:4px 9px;font-size:11px;font-weight:700;background:#fee2e2;color:#991b1b;border:1px solid #f87171;border-radius:4px;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;">
                              <span>👁️ Restaurar</span>
                            </button>
                          ` : `
                            <button type="button" class="btn-omit-finding" onclick="ReportsEngine.toggleOmitFinding('${f.id}')" title="Omitir esta observación en la impresión (se conserva guardada en el sistema pero no saldrá en el reporte impreso ni PDF)" style="padding:4px 9px;font-size:11px;font-weight:600;background:var(--color-bg);color:var(--text-muted);border:1px solid var(--border-subtle);border-radius:4px;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;">
                              <span>🚫 Omitir</span>
                            </button>
                          `}
                          ${f.isManual ? `
                            <button type="button" class="report-del-btn" onclick="ReportsEngine.removeManualFinding('${f.id}')" title="Eliminar este requisito manual" style="margin-top:2px;">✕ Eliminar</button>
                          ` : ''}
                        </div>
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <!-- SECCIÓN 2: RESUMEN DE ÍTEMS CONFORMES Y CONCEPTO TÉCNICO EDITABLE (NO IMPRIMIR EN FICHA DE OBSERVACIONES) -->
        <div class="report-section-conformes no-print" style="margin-bottom: 24px;">
          <div style="margin-bottom: 12px;">
            <h4 style="font-size:14px;font-weight:900;color:var(--color-primary);display:flex;align-items:center;gap:8px;">
              <span>✅</span> Sección 2: Requisitos Conformes y Concepto Departamental
            </h4>
          </div>

          <!-- BLOQUE COLAPSABLE DE ÍTEMS CONFORMES -->
          <div class="report-compliant-box">
            <div class="report-compliant-toggle" onclick="ReportsEngine.toggleCompliantList()">
              <span style="font-size:12.5px;font-weight:700;color:var(--text-main);display:flex;align-items:center;gap:8px;">
                <span style="color:#10B981;font-weight:900;">&#10003;</span> Requisitos y Documentos Conformes (${compliantItems.length} de ${compliantItems.length + findings.length})
              </span>
              <span id="reportCompliantIcon" class="report-compliant-badge-btn" style="font-size:11.5px;font-weight:700;">
                ${this.compliantCollapsed ? '▶ Ver lista' : '▼ Ocultar'}
              </span>
            </div>
            <div id="reportCompliantGrid" class="report-compliant-grid" style="display:${this.compliantCollapsed ? 'none' : 'grid'};">
              ${compliantItems.map((c) => `
                <div class="report-compliant-pill" style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--color-bg-card);border:1px solid var(--border-subtle);border-radius:6px;">
                  <span style="color:#10B981;font-weight:900;font-size:14px;flex-shrink:0;">&#10003;</span>
                  <span style="display:inline-block;background:rgba(16,185,129,0.12);color:#065f46;border:1px solid rgba(16,185,129,0.3);font-weight:900;font-size:10.5px;padding:1px 6px;border-radius:4px;font-family:var(--font-mono);flex-shrink:0;">
                    ${c.itemBadge || (c.itemNum ? `Ítem ${c.itemNum}` : c.fase)}
                  </span>
                  <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;font-size:12px;font-weight:600;color:var(--text-main);" title="${c.titulo}">${c.titulo}</span>
                  ${c.archivo ? `
                    <span style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0;" title="${c.archivo}">📄 ${this.escapeHtml(c.archivo)}</span>
                  ` : ''}
                </div>
              `).join("")}
            </div>
          </div>

          <!-- CAMPO EDITABLE DE CONCLUSIONES Y CONCEPTO TÉCNICO -->
          <div style="margin-top: 18px;">
            <label style="display:block;font-size:12.5px;font-weight:800;color:var(--color-primary-dark);margin-bottom:6px;">
              Conclusiones y Concepto Técnico de la Dirección de Infraestructura Física y Apoyo Territorial (Campo Editable):
            </label>
            <textarea class="report-concept-textarea" rows="4" oninput="ReportsEngine.updateConcepto(this.value)" placeholder="Redacte el concepto oficial departamental sobre la viabilidad o condiciones de subsanación técnica...">${fase3State.conclusionesConcepto || ''}</textarea>
          </div>
        </div>

        <!-- FIRMAS OFICIALES -->
        <div class="no-print signatures-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:32px;margin-top:40px;padding-top:28px;border-top:1px solid var(--border-subtle);">
          <div style="text-align:center;">
            <div style="border-bottom:1px solid #777;height:40px;margin-bottom:8px;"></div>
            <div style="font-size:12px;font-weight:800;color:var(--text-main);">Profesional de Apoyo a la Supervisión</div>
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);">Revisión Técnico-Documental</div>
            <div style="font-size:11px;color:var(--text-muted);">Dirección de Infraestructura Física y Apoyo Territorial</div>
          </div>
          <div style="text-align:center;">
            <div style="border-bottom:1px solid #777;height:40px;margin-bottom:8px;"></div>
            <div style="font-size:12px;font-weight:800;color:var(--text-main);">Supervisor Designado</div>
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);">Supervisión de Proyectos</div>
            <div style="font-size:11px;color:var(--text-muted);">Secretaría de Infraestructura Física</div>
          </div>
        </div>

      </div>
    `;

    container.innerHTML = html;

    // Auto-ajustar alturas y espejos de impresión para observaciones
    setTimeout(() => {
      const tas = container.querySelectorAll(".report-textarea");
      tas.forEach(t => this.autoResizeTextarea(t));
    }, 50);
  },

  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },

  /**
   * Genera el documento HTML para la ventana de impresión o exportación a PDF en Fase 3.
   * Contiene ÚNICAMENTE dos elementos en el body:
   * 1. El recuadro de Identificación Territorial del Proyecto.
   * 2. La tabla de la Matriz de Requisitos y Documentos Faltantes / No Aceptados.
   * Se omiten y borran por completo <header>, <footer>, banner superior, logos,
   * títulos institucionales, fechas de generación, notas al pie, firmas o créditos.
   */
  generatePrintableReportHtml(project, auditGlobal) {
    project = project || (window.App && App.currentProject) || {};
    auditGlobal = auditGlobal || (window.App && App.auditGlobal) || {};

    const projectId = project.id || (window.App && App.currentProjectId);
    const recF2 = (window.proyectosAuditados && projectId) ? window.proyectosAuditados[projectId] : null;
    const fase3State = this.getFase3State(projectId);
    const { findings } = this.collectAllFindings(project, auditGlobal);

    const isRecursos = project.modalidad === "RECURSOS" || (project.datos && project.datos.modalidad === "RECURSOS");
    const municipio = project.municipio || "Municipio";
    const subregion = project.subregion || "Antioquia";
    const municipioSubregion = `${municipio} (${subregion})`;

    const nombreProyecto = (project.nombreExpediente || project.nombreTramo || "Proyecto Placa Huella");
    const modalidadLabel = isRecursos ? "💰 RECURSOS" : "🧱 MATERIALES";
    const codigoVial = project.codigoVial || "Terciaria";
    const longitudM = (project.longitudM || 0).toLocaleString("es-CO");
    const codigoVialLongitud = `Vía: ${codigoVial} — Longitud: ${longitudM} metros lineales`;

    const getAlcaldeNombre = (p) => {
      if (!p) return "";
      if (typeof p.alcalde === "string") return p.alcalde;
      if (p.alcalde && p.alcalde.nombre) return p.alcalde.nombre;
      return "";
    };
    const getSecretarioNombre = (p) => {
      if (!p) return "";
      if (typeof p.secretarioPlaneacion === "string") return p.secretarioPlaneacion;
      if (p.secretarioPlaneacion && p.secretarioPlaneacion.nombre) return p.secretarioPlaneacion.nombre;
      return "";
    };

    let alcaldeNombre = getAlcaldeNombre(project) ||
      getAlcaldeNombre(recF2 && recF2.datos) ||
      getAlcaldeNombre(recF2) ||
      (fase3State && fase3State.datosIdentificacion && fase3State.datosIdentificacion.alcalde && fase3State.datosIdentificacion.alcalde.nombre) ||
      `Alcalde Municipal de ${municipio}`;

    let secretarioNombre = getSecretarioNombre(project) ||
      getSecretarioNombre(recF2 && recF2.datos) ||
      getSecretarioNombre(recF2) ||
      (fase3State && fase3State.datosIdentificacion && fase3State.datosIdentificacion.secretarioPlaneacion && fase3State.datosIdentificacion.secretarioPlaneacion.nombre) ||
      "Secretario(a) de Planeación / Obras Públicas";

    // Si el usuario editó en vivo los campos de texto en pantalla, tomar el valor actual del DOM
    if (typeof document !== "undefined") {
      const elAlc = document.querySelector('input[onchange*="updateProjectField(\'alcalde\'"]');
      if (elAlc && elAlc.value && elAlc.value.trim()) alcaldeNombre = elAlc.value.trim();
      const elSec = document.querySelector('input[onchange*="updateProjectField(\'secretario\'"]');
      if (elSec && elSec.value && elSec.value.trim()) secretarioNombre = elSec.value.trim();
    }

    // Sincronizar observaciones con valores editados en vivo si están presentes en la pantalla
    const processedFindings = findings.map(f => {
      let estado = f.estado;
      let motivo = f.motivo;
      const userEdit = fase3State.observacionesEditadas && fase3State.observacionesEditadas[f.id];
      if (userEdit) {
        if (userEdit.estado) estado = userEdit.estado;
        if (userEdit.motivo !== undefined) motivo = userEdit.motivo;
      }
      const domTa = typeof document !== "undefined" ? document.getElementById("motivo_" + f.id) : null;
      if (domTa && domTa.value) motivo = domTa.value;
      return {
        ...f,
        estado: estado || "No Aceptado / Por Subsanar",
        motivo: motivo || ""
      };
    });

    // Filtrar las observaciones omitidas a consideración del revisor para que NO salgan en la impresión
    const nonOmittedFindings = processedFindings.filter(f => !f.omitido);

    const rowsHtml = nonOmittedFindings.length === 0 ? `
      <tr>
        <td colspan="3" style="text-align:center;padding:16px;color:#15803d;font-weight:700;border:1px solid #cbd5e1;">
          ✓ No se registran requisitos faltantes ni observaciones pendientes de subsanación. El expediente cumple satisfactoriamente la totalidad de compuertas técnicas.
        </td>
      </tr>
    ` : nonOmittedFindings.map(f => `
      <tr>
        <td style="padding:8px 10px;border:1px solid #cbd5e1;vertical-align:top;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap;">
            <span style="display:inline-block;background:#e0f2fe;color:#0369a1;border:1px solid #7dd3fc;font-weight:800;font-size:10.5px;padding:1px 6px;border-radius:3px;font-family:monospace;">
              ${f.itemBadge || (f.itemNum ? `Ítem ${f.itemNum}` : f.fase)}
            </span>
            <span style="background:rgba(0,0,0,0.05);padding:1px 5px;border-radius:3px;font-family:monospace;font-size:9.5px;color:#64748b;">${this.escapeHtml(f.fase)}</span>
          </div>
          <div style="font-weight:800;color:#0f172a;font-size:11.5px;">${this.escapeHtml(f.titulo)}</div>
          ${f.norma ? `<div style="font-size:9.5px;color:#64748b;margin-top:1px;">• ${this.escapeHtml(f.norma)}</div>` : ''}
          ${f.archivo ? `<div style="font-size:9.5px;color:#0284c7;font-family:monospace;margin-top:2px;">📄 Archivo: ${this.escapeHtml(f.archivo)}</div>` : ''}
        </td>
        <td style="padding:8px 10px;border:1px solid #cbd5e1;vertical-align:top;">
          <span class="${f.estado === 'Conforme' ? 'badge-conforme' : (f.estado === 'Vencido' ? 'badge-vencido' : 'badge-subsanar')}">${this.escapeHtml(f.estado)}</span>
        </td>
        <td style="padding:8px 10px;border:1px solid #cbd5e1;vertical-align:top;">
          <div class="print-observation-text">${this.escapeHtml(f.motivo || 'Requisito pendiente de subsanación')}</div>
        </td>
      </tr>
    `).join("");

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Ficha de Observaciones - ${this.escapeHtml(project.codigo || 'EXP-PH')} - ${this.escapeHtml(project.municipio || 'Antioquia')}</title>
  <style>
    @page {
      size: letter;
      margin: 0mm !important; /* Suprime encabezados y pies nativos del navegador */
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      margin: 0 !important;
      padding: 12mm 14mm !important; /* Margen limpio interno en la hoja */
      background: #FFFFFF !important;
      color: #1e293b;
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
      font-size: 11px;
      line-height: 1.45;
    }
    @media print {
      html, body {
        margin: 0 !important;
        padding: 12mm 14mm !important;
        background: #FFFFFF !important;
      }
      header, footer, .app-header, .app-footer, .sidebar, .no-print, .print-header, .print-footer, .row-omitted-finding {
        display: none !important;
      }
      tr {
        page-break-inside: avoid;
      }
      .data-table {
        page-break-inside: auto;
      }
    }
    .sheet-territorial-card {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 20px;
    }
    .sheet-territorial-title {
      font-size: 12px;
      font-weight: 800;
      color: #166534;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .territorial-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 20px;
      font-size: 11px;
    }
    .territorial-item-lbl {
      color: #64748b;
      display: block;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .territorial-item-val {
      font-weight: 800;
      color: #0f172a;
    }
    .badge-modalidad {
      display: inline-block;
      font-size: 9.5px;
      font-weight: 800;
      padding: 1px 6px;
      border-radius: 4px;
      background: #e2e8f0;
      color: #334155;
    }
    .sheet-matriz-faltantes {
      margin-bottom: 20px;
    }
    .sheet-matriz-title {
      font-size: 13px;
      font-weight: 900;
      color: #be123c;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }
    .sheet-matriz-subtitle {
      font-size: 11px;
      color: #64748b;
      margin-bottom: 10px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
    }
    .data-table th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 800;
      text-align: left;
      padding: 7px 9px;
      border: 1px solid #cbd5e1;
    }
    .data-table td {
      padding: 7px 9px;
      border: 1px solid #cbd5e1;
      vertical-align: top;
    }
    .badge-subsanar {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 9.5px;
      font-weight: 800;
      background: #ffe4e6;
      color: #be123c;
      border: 1px solid #fecdd3;
      white-space: nowrap;
    }
    .badge-vencido {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 9.5px;
      font-weight: 800;
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #f59e0b;
      white-space: nowrap;
    }
    .badge-conforme {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 9.5px;
      font-weight: 800;
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #bbf7d0;
      white-space: nowrap;
    }
    .print-observation-text {
      white-space: pre-line !important;
      word-wrap: break-word !important;
      overflow-wrap: break-word !important;
      line-height: 1.45;
      color: #1e293b;
    }
  </style>
</head>
<body>
  <!-- 1. EL RECUADRO DE IDENTIFICACIÓN TERRITORIAL DEL PROYECTO -->
  <div class="sheet-territorial-card">
    <div class="sheet-territorial-title">
      <span>📍</span> Identificación Territorial del Proyecto
    </div>
    <div class="territorial-grid">
      <div>
        <span class="territorial-item-lbl">Municipio y Subregión:</span>
        <div class="territorial-item-val">${this.escapeHtml(municipioSubregion)}</div>
      </div>
      <div>
        <span class="territorial-item-lbl">Nombre del Proyecto y Modalidad:</span>
        <div class="territorial-item-val">${this.escapeHtml(nombreProyecto)} <span class="badge-modalidad">${modalidadLabel}</span></div>
      </div>
      <div>
        <span class="territorial-item-lbl">Código Vial y Longitud:</span>
        <div class="territorial-item-val">${this.escapeHtml(codigoVialLongitud)}</div>
      </div>
      <div>
        <span class="territorial-item-lbl">Alcalde(sa) Municipal:</span>
        <div class="territorial-item-val">${this.escapeHtml(alcaldeNombre)}</div>
      </div>
      <div style="grid-column: 1 / -1;">
        <span class="territorial-item-lbl">Secretario(a) de Planeación / Obras Públicas Municipal:</span>
        <div class="territorial-item-val">${this.escapeHtml(secretarioNombre)}</div>
      </div>
    </div>
  </div>

  <!-- 2. LA TABLA DE LA MATRIZ DE REQUISITOS Y DOCUMENTOS FALTANTES / NO ACEPTADOS -->
  <div class="sheet-matriz-faltantes">
    <div class="sheet-matriz-title">
      <span>📋</span> Matriz de Requisitos y Documentos Faltantes / No Aceptados (${nonOmittedFindings.length})
    </div>
    <div class="sheet-matriz-subtitle">
      Listado prioritario de observaciones técnicas y requisitos pendientes de subsanación:
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width:28%;">Ítem / Fase / Requisito</th>
          <th style="width:20%;">Estado Actual</th>
          <th style="width:52%;">Detalle / Motivo de No Aceptación</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </div>
</body>
</html>`;
  },

  /**
   * Ejecuta la generación y apertura en ventana dedicada para impresión limpia
   */
  imprimirInformeTecnico() {
    this.imprimirFichaObservacionesPDF();
  },


  /**
   * Genera y descarga el Informe Técnico Oficial como archivo editable en Word (.docx)
   * Integra la librería docx (OpenXML nativo) con fallback automático a formato Word compatible.
   * Nombre dinámico: Informe_Revision_[Municipio]_[Proyecto].docx
   * Incluye encabezado institucional, resultados 1A, 1B, conteo real de Fase 2,
   * observaciones editadas en Fase 3 y firmas oficiales sin Director.
   */
  async descargarInformeWord() {
    const project = App.currentProject;
    if (!project) {
      alert("Por favor cargue o seleccione un expediente municipal antes de descargar el informe en Word.");
      return;
    }

    const projectId = project.id || App.currentProjectId;
    const auditGlobal = App.auditGlobal || {};
    const fase3State = this.getFase3State(projectId);
    const { findings, compliantItems } = this.collectAllFindings(project, auditGlobal);
    const nonOmittedFindings = findings.filter(f => !f.omitido);
    const isFavorable = nonOmittedFindings.length === 0;

    // Conteo estricto y real de Fase 2 (requisitos documentales de expedientesMap)
    const recF2 = (window.proyectosAuditados && projectId) ? window.proyectosAuditados[projectId] : null;
    const audit2Data = (recF2 && recF2.fase2) || (auditGlobal && auditGlobal.audit2) || {};
    const reportProcMode = (project && project.procesoEspecial) || (recF2 && recF2.procesoEspecial) || (window.App && window.App.currentProcessMode) || (window.SIPRO_PROCESS_MODE) || "ORDINARIO";
    const isReport2026_2 = reportProcMode === "2026_2" || reportProcMode === "CONVENIOS_2026_2";
    const items27List = (audit2Data && audit2Data.items) || (isReport2026_2 ? SIPRO_DATA.items41_2026_2 : SIPRO_DATA.items27) || [];
    let f2Conformes = 0;
    let f2Pendientes = 0;
    items27List.forEach((it) => {
      const fid = `item_${it.num || it.id}`;
      const userEdit = fase3State.observacionesEditadas[fid];
      const status = userEdit?.estado || (it.conforme ? "Conforme" : (it.vencido ? "Vencido" : (it.faltante ? "Faltante" : "No Aceptado / Por Subsanar")));
      if (status === "Conforme") {
        f2Conformes++;
      } else {
        f2Pendientes++;
      }
    });

    const audit1A = (recF2 && recF2.fase1A) || (auditGlobal && auditGlobal.audit1A) || {};
    const audit1B = (recF2 && recF2.fase1B) || (auditGlobal && auditGlobal.audit1B) || {};

    const cuantiaReal = audit1A.cuantiaRealKgM || (audit1A.pesoTotalCalculadoKg && project.longitudM ? (audit1A.pesoTotalCalculadoKg / project.longitudM).toFixed(2) : 0);
    const pesoAceroTotal = (audit1A.pesoTotalCalculadoKg || 0).toLocaleString('es-CO');
    const marcasOk = `${audit1A.marcasCumplen || 0} de ${audit1A.totalMarcas || 0}`;
    const coberturaGIS = audit1B.coberturaBufferPct !== undefined ? audit1B.coberturaBufferPct : 0;
    const longKml = (audit1B.longitudKmlTotalM || 0).toLocaleString('es-CO');
    const totalTramos = (audit1B.tramos && audit1B.tramos.length) || 1;
    const totalPuntos = audit1B.totalPuntosEvaluados || 0;

    const alcalde = project.alcalde || { nombre: `Alcalde Municipal de ${project.municipio || 'Municipio'}`, cedula: "S/N" };
    const ing = project.ingenieroProyectista || { nombre: "Ingeniero Civil Proyectista", matricula: "COPNIA" };
    const conceptoTexto = (fase3State.conclusionesConcepto || "").trim() || (isFavorable
      ? "El proyecto CUMPLE a cabalidad con la totalidad de los criterios técnicos departamentales de cuantía mínima de acero (≥ 26.25 kg/m), alineación con la red vial departamental y requisitos documentales de la convocatoria."
      : "El proyecto presenta observaciones técnicas y requisitos pendientes que deben ser subsanados por la administración municipal antes de continuar con la viabilidad y suscripción del convenio.");

    const mpioClean = (project.municipio || 'Municipio').trim().replace(/[^a-zA-Z0-9_\-áéíóúÁÉÍÓÚñÑ]/g, '_');
    const projClean = (project.nombreTramo || project.nombreExpediente || project.id || 'Proyecto').trim().replace(/[^a-zA-Z0-9_\-áéíóúÁÉÍÓÚñÑ]/g, '_');
    const filename = `Informe_Revision_${mpioClean}_${projClean}.docx`;

    // Intentar generación nativa mediante docx (OpenXML binario .docx)
    let generatedBlob = null;
    if (typeof docx !== "undefined" && docx.Document && docx.Packer) {
      try {
        generatedBlob = await this._buildDocxWithDocxJs({
          project, alcalde, ing, cuantiaReal, pesoAceroTotal, marcasOk,
          coberturaGIS, longKml, totalTramos, totalPuntos, f2Conformes, f2Pendientes,
          findings: nonOmittedFindings, compliantItems, conceptoTexto, isFavorable
        });
      } catch (err) {
        console.warn("Docx.js encontró un error al serializar documento, recurriendo a exportador Word compatible:", err);
        generatedBlob = null;
      }
    }

    // Fallback a documento Word compatible (HTML/XML nativo reconocido por Word sin pérdida)
    if (!generatedBlob) {
      const wordHtml = this._buildWordCompatibleHtml({
        project, alcalde, ing, cuantiaReal, pesoAceroTotal, marcasOk,
        coberturaGIS, longKml, totalTramos, totalPuntos, f2Conformes, f2Pendientes,
        findings: nonOmittedFindings, compliantItems, conceptoTexto, isFavorable
      });
      generatedBlob = new Blob(['\ufeff' + wordHtml], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document;charset=utf-8'
      });
    }

    // Descarga directa del archivo
    const blobUrl = URL.createObjectURL(generatedBlob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
  },

  /**
   * Genera documento Word binario (.docx) utilizando docx.js (OpenXML nativo)
   */
  async _buildDocxWithDocxJs(data) {
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, WidthType, BorderStyle } = docx;

    const cellBorders = {
      top: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" }
    };

    const noBorders = {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
    };

    const children = [];

    // ENCABEZADO INSTITUCIONAL
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [new TextRun({ text: "GOBERNACIÓN DE ANTIOQUIA", bold: true, size: 28, color: "002855", font: "Calibri" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [new TextRun({ text: "Secretaría de Infraestructura Física", bold: true, size: 22, color: "0F172A", font: "Calibri" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text: "Dirección de Infraestructura Física y Apoyo Territorial", size: 20, color: "475569", font: "Calibri" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [new TextRun({ text: "INFORME TÉCNICO-DOCUMENTAL DE REVISIÓN Y EVALUACIÓN DE PROYECTO", bold: true, size: 24, color: "002855", font: "Calibri" })]
      })
    );

    // SECCIÓN 1: IDENTIFICACIÓN GENERAL
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: "1. IDENTIFICACIÓN GENERAL DEL EXPEDIENTE", bold: true, size: 22, color: "002855" })]
      })
    );

    const makeMetaCell = (lbl, val, widthPct) => new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      borders: cellBorders,
      children: [
        new Paragraph({
          children: [
            new TextRun({ text: lbl + ": ", bold: true, size: 18, color: "334155" }),
            new TextRun({ text: String(val || ""), size: 18, color: "0F172A" })
          ]
        })
      ]
    });

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              makeMetaCell("Municipio", `${data.project.municipio || "Municipio"} (${data.project.subregion || "Antioquia"})`, 50),
              makeMetaCell("Vereda / Sector", data.project.nombreTramo || data.project.nombreExpediente || "No especificado", 50)
            ]
          }),
          new TableRow({
            children: [
              makeMetaCell("Código Vía Terciaria", data.project.codigoVial || "En cotejo", 50),
              makeMetaCell("Longitud a Intervenir", `${data.project.longitudM || 0} metros lineales`, 50)
            ]
          }),
          new TableRow({
            children: [
              makeMetaCell("Alcalde(sa) Municipal", `${data.alcalde.nombre} (C.C. ${data.alcalde.cedula})`, 50),
              makeMetaCell("Ing. Proyectista", `${data.ing.nombre} (Mat. ${data.ing.matricula})`, 50)
            ]
          }),
          new TableRow({
            children: [
              makeMetaCell("Presupuesto Total", `$ ${Number(data.project.presupuestoTotal || 0).toLocaleString("es-CO")} COP`, 50),
              makeMetaCell("Aporte Departamento", `$ ${Number(data.project.aporteDepto || 0).toLocaleString("es-CO")} COP`, 50)
            ]
          })
        ]
      })
    );

    // SECCIÓN 2: RESUMEN EJECUTIVO
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 100 },
        children: [new TextRun({ text: "2. RESUMEN EJECUTIVO DE LA EVALUACIÓN TÉCNICA", bold: true, size: 22, color: "002855" })]
      })
    );

    const makeKpiRow = (c1, c2, c3, c4) => new TableRow({
      children: [
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          borders: cellBorders,
          shading: { fill: "F8FAFC" },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: c1, bold: true, size: 17, color: "475569" })] })]
        }),
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          borders: cellBorders,
          shading: { fill: "F8FAFC" },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: c2, bold: true, size: 17, color: "475569" })] })]
        }),
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          borders: cellBorders,
          shading: { fill: "F8FAFC" },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: c3, bold: true, size: 17, color: "475569" })] })]
        }),
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          borders: cellBorders,
          shading: { fill: "F8FAFC" },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: c4, bold: true, size: 17, color: "475569" })] })]
        })
      ]
    });

    const makeKpiValRow = (v1, v2, v3, v4, isFav) => new TableRow({
      children: [
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          borders: cellBorders,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: v1, bold: true, size: 20, color: isFav ? "15803D" : "BE123C" })] })]
        }),
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          borders: cellBorders,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: v2, bold: true, size: 19, color: "0F172A" })] })]
        }),
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          borders: cellBorders,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: v3, bold: true, size: 19, color: "0F172A" })] })]
        }),
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          borders: cellBorders,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: v4, bold: true, size: 19, color: "0F172A" })] })]
        })
      ]
    });

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          makeKpiRow("DICTAMEN GENERAL", "FASE 1A (CUANTÍA)", "FASE 1B (ALINEACIÓN VIAL)", "FASE 2 (DOCUMENTAL)"),
          makeKpiValRow(
            data.isFavorable ? "FAVORABLE" : "SUBSANACIÓN",
            `${data.cuantiaReal} kg/m`,
            `${data.coberturaGIS}%`,
            `${data.f2Conformes} / 27`,
            data.isFavorable
          )
        ]
      }),
      new Paragraph({ spacing: { before: 120, after: 60 }, children: [new TextRun({ text: `Control Fase 1A (Estructural): Cuantía calculada en ${data.cuantiaReal} kg/m (mínimo técnico: 26.25 kg/m) | Peso de acero total: ${data.pesoAceroTotal} kg | Marcas conformes: ${data.marcasOk}.`, size: 18, color: "334155" })] }),
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: `Control Fase 1B (Espacial): Coincidencia con red vial del ${data.coberturaGIS}% (Tolerancia 10 m) | Longitud KML evaluada: ${data.longKml} m | Tramos: ${data.totalTramos}.`, size: 18, color: "334155" })] }),
      new Paragraph({ spacing: { after: 140 }, children: [new TextRun({ text: `Control Fase 2 (Documental): ${data.f2Conformes} requisitos aprobados de conformidad • ${data.f2Pendientes} requisitos pendientes por subsanar frente a los 27 exigidos.`, size: 18, color: "334155" })] })
    );

    // SECCIÓN 3: REQUISITOS PENDIENTES POR SUBSANAR
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: `3. MATRIZ DE REQUISITOS Y DOCUMENTOS PENDIENTES POR SUBSANAR (${data.findings.length})`, bold: true, size: 22, color: "002855" })]
      })
    );

    const makeHeaderCell = (txt, widthPct) => new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      borders: cellBorders,
      shading: { fill: "0F172A" },
      children: [new Paragraph({ children: [new TextRun({ text: txt, bold: true, size: 17, color: "FFFFFF" })] })]
    });

    const findingRows = [
      new TableRow({
        children: [
          makeHeaderCell("Compuerta / Requisito", 28),
          makeHeaderCell("Fase / Entidad", 17),
          makeHeaderCell("Estado", 15),
          makeHeaderCell("Observación Técnica / Motivo de Subsanación", 40)
        ]
      })
    ];

    if (data.findings.length === 0) {
      findingRows.push(
        new TableRow({
          children: [
            new TableCell({
              columnSpan: 4,
              borders: cellBorders,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: "✓ No se registran observaciones ni documentos pendientes por subsanar. El expediente cumple satisfactoriamente la totalidad de compuertas técnicas.", bold: true, size: 18, color: "15803D" })]
                })
              ]
            })
          ]
        })
      );
    } else {
      data.findings.forEach(f => {
        findingRows.push(
          new TableRow({
            children: [
              new TableCell({
                width: { size: 28, type: WidthType.PERCENTAGE },
                borders: cellBorders,
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: `[${f.itemBadge || (f.itemNum ? `Ítem ${f.itemNum}` : f.fase)}] `, bold: true, size: 17, color: "0284C7" }),
                      new TextRun({ text: f.titulo || "", bold: true, size: 17, color: "0F172A" })
                    ]
                  }),
                  ...(f.archivo ? [
                    new Paragraph({
                      children: [
                        new TextRun({ text: `Archivo: ${f.archivo}`, size: 14, color: "64748B", italics: true })
                      ]
                    })
                  ] : [])
                ]
              }),
              new TableCell({
                width: { size: 17, type: WidthType.PERCENTAGE },
                borders: cellBorders,
                children: [new Paragraph({ children: [new TextRun({ text: f.entidad || f.fase || "", size: 16, color: "475569" })] })]
              }),
              new TableCell({
                width: { size: 15, type: WidthType.PERCENTAGE },
                borders: cellBorders,
                children: [new Paragraph({ children: [new TextRun({ text: f.estado || "Por Subsanar", bold: true, size: 16, color: "BE123C" })] })]
              }),
              new TableCell({
                width: { size: 40, type: WidthType.PERCENTAGE },
                borders: cellBorders,
                children: [new Paragraph({ children: [new TextRun({ text: f.motivo || "", size: 16, color: "334155" })] })]
              })
            ]
          })
        );
      });
    }

    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: findingRows }));

    // SECCIÓN 4: REQUISITOS CONFORMES
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 100 },
        children: [new TextRun({ text: `4. MATRIZ DE REQUISITOS Y DOCUMENTOS CONFORMES (${data.compliantItems.length})`, bold: true, size: 22, color: "002855" })]
      })
    );

    const compliantRows = [
      new TableRow({
        children: [
          makeHeaderCell("Requisito / Documento Conforme", 40),
          makeHeaderCell("Fase / Entidad", 20),
          makeHeaderCell("Soporte Verificado", 25),
          makeHeaderCell("Estado", 15)
        ]
      })
    ];

    data.compliantItems.forEach(c => {
      compliantRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 40, type: WidthType.PERCENTAGE },
              borders: cellBorders,
              children: [new Paragraph({ children: [new TextRun({ text: c.titulo || "", bold: true, size: 16, color: "0F172A" })] })]
            }),
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              borders: cellBorders,
              children: [new Paragraph({ children: [new TextRun({ text: c.entidad || c.fase || "", size: 16, color: "475569" })] })]
            }),
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              borders: cellBorders,
              children: [new Paragraph({ children: [new TextRun({ text: c.archivo || "Soporte documental validado", size: 15, color: "475569" })] })]
            }),
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              borders: cellBorders,
              children: [new Paragraph({ children: [new TextRun({ text: "✓ CONFORME", bold: true, size: 16, color: "15803D" })] })]
            })
          ]
        })
      );
    });

    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: compliantRows }));

    // SECCIÓN 5: CONCEPTO TÉCNICO
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 100 },
        children: [new TextRun({ text: "5. CONCEPTO TÉCNICO DEPARTAMENTAL", bold: true, size: 22, color: "002855" })]
      }),
      new Paragraph({
        spacing: { after: 280 },
        children: [new TextRun({ text: data.conceptoTexto, size: 19, color: "0F172A" })]
      })
    );

    // SECCIÓN 6: CONSTANCIA Y FIRMAS (SIN DIRECTOR)
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 180 },
        children: [new TextRun({ text: "6. CONSTANCIA Y FIRMAS DE REVISIÓN", bold: true, size: 22, color: "002855" })]
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: noBorders,
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "____________________________________________", size: 18, color: "64748B" })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60 }, children: [new TextRun({ text: "Profesional de Apoyo a la Supervisión", bold: true, size: 19, color: "0F172A" })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Revisión Técnico-Documental", bold: true, size: 17, color: "334155" })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Dirección de Infraestructura Física y Apoyo Territorial", size: 16, color: "64748B" })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Secretaría de Infraestructura Física", size: 16, color: "64748B" })] })
                ]
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: noBorders,
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "____________________________________________", size: 18, color: "64748B" })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60 }, children: [new TextRun({ text: "Supervisor Designado", bold: true, size: 19, color: "0F172A" })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Supervisión de Proyectos", bold: true, size: 17, color: "334155" })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Secretaría de Infraestructura Física", size: 16, color: "64748B" })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Gobernación de Antioquia", size: 16, color: "64748B" })] })
                ]
              })
            ]
          })
        ]
      })
    );

    const doc = new Document({
      title: "Informe Técnico de Revisión y Subsanación",
      description: "Gobernación de Antioquia - Secretaría de Infraestructura Física",
      sections: [{
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }
          }
        },
        children
      }]
    });

    return await Packer.toBlob(doc);
  },

  /**
   * Genera documento Word compatible en formato HTML/WordprocessingML
   * Reconocido de forma nativa por Microsoft Word como documento editable con tablas y estilos completos.
   */
  _buildWordCompatibleHtml(data) {
    const isFav = data.isFavorable;

    return `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset="utf-8">
<title>Informe de Revisión - ${data.project.municipio || "Antioquia"}</title>
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
  @page Section1 {
    size: 215.9mm 279.4mm; /* Letter */
    margin: 25.4mm 25.4mm 25.4mm 25.4mm;
    mso-header-margin: 12.7mm;
    mso-footer-margin: 12.7mm;
    mso-paper-source: 0;
  }
  div.Section1 { page: Section1; }
  body { font-family: "Calibri", "Segoe UI", Arial, sans-serif; font-size: 10.5pt; color: #1e293b; line-height: 1.35; }
  h1 { font-size: 15pt; font-weight: bold; color: #002855; text-align: center; margin: 0 0 4pt 0; text-transform: uppercase; }
  h2 { font-size: 12pt; font-weight: bold; color: #002855; text-align: center; margin: 0 0 4pt 0; }
  h3 { font-size: 10.5pt; font-weight: bold; color: #475569; text-align: center; margin: 0 0 14pt 0; text-transform: uppercase; }
  .sec-title { font-size: 11pt; font-weight: bold; color: #002855; border-bottom: 2pt solid #002855; padding-bottom: 3pt; margin-top: 18pt; margin-bottom: 8pt; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12pt; }
  th { background-color: #0F172A; color: #FFFFFF; font-weight: bold; padding: 6pt; font-size: 9pt; border: 1pt solid #cbd5e1; text-align: left; }
  td { padding: 5pt; font-size: 9pt; border: 1pt solid #cbd5e1; vertical-align: top; }
  .lbl { background-color: #F8FAFC; font-weight: bold; width: 25%; color: #334155; }
  .kpi-table td { text-align: center; border: 1pt solid #cbd5e1; padding: 7pt; }
  .badge-favorable { color: #15803d; font-weight: bold; font-size: 12pt; }
  .badge-subsanar { color: #be123c; font-weight: bold; font-size: 12pt; }
  .sig-table { width: 100%; border: none; margin-top: 36pt; }
  .sig-table td { border: none; text-align: center; width: 50%; padding: 12pt; vertical-align: bottom; }
  .sig-line { border-top: 1pt solid #475569; width: 80%; margin: 0 auto 6pt auto; }
</style>
</head>
<body>
<div class="Section1">

  <!-- ENCABEZADO INSTITUCIONAL OFICIAL -->
  <h1>GOBERNACIÓN DE ANTIOQUIA</h1>
  <h2>Secretaría de Infraestructura Física</h2>
  <h3>Dirección de Infraestructura Física y Apoyo Territorial</h3>

  <div style="background-color: #002855; color: #ffffff; text-align: center; padding: 6pt; font-weight: bold; font-size: 11.5pt; margin-bottom: 16pt;">
    INFORME TÉCNICO-DOCUMENTAL DE REVISIÓN Y EVALUACIÓN DE PROYECTO
  </div>

  <!-- 1. IDENTIFICACIÓN GENERAL -->
  <div class="sec-title">1. Identificación General del Expediente</div>
  <table>
    <tr>
      <td class="lbl">Municipio:</td>
      <td><b>${data.project.municipio || 'Municipio'}</b> (${data.project.subregion || 'Antioquia'})</td>
      <td class="lbl">Nombre del Proyecto:</td>
      <td><b>${data.project.nombreTramo || data.project.nombreExpediente || 'Proyecto Placa Huella'}</b></td>
    </tr>
    <tr>
      <td class="lbl">Código Vía Terciaria:</td>
      <td><b>${data.project.codigoVial || 'En cotejo'}</b></td>
      <td class="lbl">Longitud a Intervenir:</td>
      <td><b>${data.project.longitudM || 0} metros lineales</b></td>
    </tr>
    <tr>
      <td class="lbl">Alcalde(sa) Municipal:</td>
      <td>${data.alcalde.nombre} (C.C. ${data.alcalde.cedula})</td>
      <td class="lbl">Ing. Proyectista:</td>
      <td>${data.ing.nombre} (Mat. ${data.ing.matricula})</td>
    </tr>
    <tr>
      <td class="lbl">Presupuesto Estimado:</td>
      <td>$ ${Number(data.project.presupuestoTotal || 0).toLocaleString('es-CO')} COP</td>
      <td class="lbl">Aporte Departamento:</td>
      <td>$ ${Number(data.project.aporteDepto || 0).toLocaleString('es-CO')} COP</td>
    </tr>
  </table>

  <!-- 2. RESUMEN EJECUTIVO -->
  <div class="sec-title">2. Resumen Ejecutivo de la Evaluación Técnica</div>
  <table class="kpi-table">
    <tr style="background-color: #f1f5f9; font-weight: bold;">
      <td style="width:25%;">DICTAMEN GENERAL</td>
      <td style="width:25%;">FASE 1A (CUANTÍA ACERO)</td>
      <td style="width:25%;">FASE 1B (ALINEACIÓN VIAL)</td>
      <td style="width:25%;">FASE 2 (DOCUMENTAL)</td>
    </tr>
    <tr>
      <td><span class="${isFav ? 'badge-favorable' : 'badge-subsanar'}">${isFav ? 'FAVORABLE' : 'SUBSANACIÓN'}</span></td>
      <td><b>${data.cuantiaReal} kg/m</b><br><span style="font-size:8pt;color:#64748b">(Mínimo: 26.25 kg/m)</span></td>
      <td><b>${data.coberturaGIS}%</b><br><span style="font-size:8pt;color:#64748b">(Tolerancia 10 m)</span></td>
      <td><b>${data.f2Conformes} de 27 conformes</b></td>
    </tr>
  </table>

  <table>
    <tr>
      <td class="lbl">Control Fase 1A (Estructural):</td>
      <td>Cuantía calculada en <b>${data.cuantiaReal} kg/m</b> | Peso total de acero: <b>${data.pesoAceroTotal} kg</b> | Marcas conformes: <b>${data.marcasOk}</b>.</td>
    </tr>
    <tr>
      <td class="lbl">Control Fase 1B (Espacial):</td>
      <td>Longitud KML evaluada: <b>${data.longKml} m</b> | Tramos independientes: <b>${data.totalTramos}</b> | Coincidencia en red vial: <b>${data.coberturaGIS}%</b> (Tolerancia 10 m).</td>
    </tr>
    <tr>
      <td class="lbl">Control Fase 2 (Documental):</td>
      <td><b>${data.f2Conformes}</b> de 27 requisitos aprobados de conformidad &bull; <b>${data.f2Pendientes}</b> pendientes por subsanar.</td>
    </tr>
  </table>

  <!-- 3. MATRIZ DE REQUISITOS PENDIENTES POR SUBSANAR -->
  <div class="sec-title">3. Tabla de Observaciones y Requisitos Pendientes por Subsanar (${data.findings.length})</div>
  <table>
    <thead>
      <tr>
        <th style="width:28%;">Compuerta / Requisito</th>
        <th style="width:16%;">Fase / Entidad</th>
        <th style="width:14%;">Estado</th>
        <th style="width:42%;">Observación Técnica / Motivo de Subsanación</th>
      </tr>
    </thead>
    <tbody>
      ${data.findings.length === 0 ? `
        <tr>
          <td colspan="4" style="text-align:center;padding:12pt;color:#15803d;font-weight:bold;">
            ✓ No se registran observaciones ni documentos pendientes por subsanar. El expediente cumple satisfactoriamente la totalidad de compuertas técnicas.
          </td>
        </tr>
      ` : data.findings.map(f => `
        <tr>
          <td><b>${f.titulo}</b></td>
          <td style="color:#64748b;">${f.entidad || f.fase}</td>
          <td><b style="color:${f.estado === 'Vencido' ? '#b45309' : '#be123c'};">${this.escapeHtml(f.estado || 'Por Subsanar')}</b></td>
          <td>${f.motivo}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- 4. MATRIZ DE REQUISITOS CONFORMES -->
  <div class="sec-title">4. Matriz de Requisitos y Documentos Conformes (${data.compliantItems.length})</div>
  <table>
    <thead>
      <tr>
        <th style="width:40%;">Requisito / Documento Conforme</th>
        <th style="width:20%;">Fase / Entidad</th>
        <th style="width:25%;">Soporte Verificado</th>
        <th style="width:15%;">Estado</th>
      </tr>
    </thead>
    <tbody>
      ${data.compliantItems.map(c => `
        <tr>
          <td><b>${c.titulo}</b></td>
          <td style="color:#64748b;">${c.entidad || c.fase}</td>
          <td style="color:#475569;">${c.archivo || 'Documento soporte verificado'}</td>
          <td><b style="color:#15803d;">✓ CONFORME</b></td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- 5. CONCEPTO TÉCNICO -->
  <div class="sec-title">5. Concepto Técnico Departamental</div>
  <div style="background-color: #f8fafc; border: 1pt solid #cbd5e1; padding: 10pt; font-size: 9.5pt; margin-bottom: 20pt; line-height: 1.5;">
    ${data.conceptoTexto}
  </div>

  <!-- 6. FIRMAS OFICIALES (SIN DIRECTOR) -->
  <div class="sec-title">6. Constancia y Firmas de Revisión</div>
  <table class="sig-table">
    <tr>
      <td>
        <div class="sig-line"></div>
        <b>Profesional de Apoyo a la Supervisión</b><br>
        <span style="font-size:8.5pt;font-weight:bold;color:#334155;">Revisión Técnico-Documental</span><br>
        <span style="font-size:8pt;color:#64748b;">Dirección de Infraestructura Física y Apoyo Territorial</span><br>
        <span style="font-size:8pt;color:#64748b;">Secretaría de Infraestructura Física</span>
      </td>
      <td>
        <div class="sig-line"></div>
        <b>Supervisor Designado</b><br>
        <span style="font-size:8.5pt;font-weight:bold;color:#334155;">Supervisión de Proyectos</span><br>
        <span style="font-size:8pt;color:#64748b;">Secretaría de Infraestructura Física</span><br>
        <span style="font-size:8pt;color:#64748b;">Gobernación de Antioquia</span>
      </td>
    </tr>
  </table>

</div>
</body>
</html>`;
  },

  printReport() {
    this.imprimirFichaObservacionesPDF();
  },

  imprimirInformeTecnico() {
    this.imprimirFichaObservacionesPDF();
  },

  /**
   * Exporta o imprime exclusivamente Bloque 1 (Identificación Territorial) y Bloque 2 (Matriz de Faltantes/No Aceptados)
   * Suprime encabezados y pies de página mediante ventana dedicada y @page con margin 0
   */
  imprimirFichaObservacionesPDF() {
    const project = (window.App && App.currentProject) ||
                    (window.SIPRO_DATA && SIPRO_DATA.expedientesMap && SIPRO_DATA.expedientesMap[App.currentProjectId]?.datos) ||
                    (window.proyectosAuditados && window.proyectosAuditados[App.currentProjectId]?.datos);
    if (!project) {
      alert("Por favor cargue o seleccione un expediente municipal antes de imprimir o exportar la Ficha de Observaciones.");
      return;
    }

    // 1. Sincronizar espejos de impresión y auto-ajustar alturas en tab-3 si está en el DOM
    const textareas = document.querySelectorAll(".report-textarea");
    textareas.forEach(t => {
      this.autoResizeTextarea(t);
    });

    // 2. Construir el HTML limpio (únicamente los dos elementos requeridos)
    const htmlContent = this.generatePrintableReportHtml(project, (window.App && App.auditGlobal));

    // 3. Abrir ventana de impresión dedicada sin menús ni barras
    const printWin = window.open("", "_blank", "width=920,height=800,menubar=no,toolbar=no,location=no,status=no");

    if (printWin) {
      printWin.document.open();
      printWin.document.write(htmlContent);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        try {
          printWin.print();
        } catch (e) {
          console.warn("Impresión automática bloqueada por el navegador:", e);
        }
      }, 350);
    } else {
      // Fallback con iframe oculto si el navegador bloquea las ventanas emergentes
      let iframe = document.getElementById("printTechnicalReportIframe");
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "printTechnicalReportIframe";
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "none";
        document.body.appendChild(iframe);
      }
      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(htmlContent);
      iframe.contentWindow.document.close();
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }, 350);
    }
  },

  /**
   * Exportación directa a PDF con html2pdf si está disponible, pasando únicamente el contenedor limpio
   */
  exportarFichaPDFDirecta(filename) {
    const project = (window.App && App.currentProject) ||
                    (window.SIPRO_DATA && SIPRO_DATA.expedientesMap && SIPRO_DATA.expedientesMap[App.currentProjectId]?.datos) ||
                    (window.proyectosAuditados && window.proyectosAuditados[App.currentProjectId]?.datos);
    if (!project) return;

    const cleanHtml = this.generatePrintableReportHtml(project, window.App && App.auditGlobal);
    const container = document.createElement("div");
    container.id = "cleanPdfRootContainer";
    const bodyMatch = cleanHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    container.innerHTML = bodyMatch ? bodyMatch[1] : cleanHtml;

    const fn = filename || `Ficha_Observaciones_${(project.municipio || 'Municipio').replace(/\s+/g, '_')}.pdf`;

    if (typeof html2pdf !== "undefined") {
      const opt = {
        margin: [0, 0, 0, 0], // Sin márgenes superiores ni inferiores de encabezado/pie
        filename: fn,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
      };
      return html2pdf().set(opt).from(container).save();
    }

    this.imprimirFichaObservacionesPDF();
  },

  /**
   * Actualiza campos editables de la identificación territorial en memoria y en sipro_auditoria.json
   */
  updateProjectField(field, val) {
    const projectId = App.currentProjectId;
    const exp = (window.proyectosAuditados && window.proyectosAuditados[projectId]) ||
                (window.SIPRO_DATA && SIPRO_DATA.expedientesMap && SIPRO_DATA.expedientesMap[projectId]);
    if (!exp) return;
    exp.datos = exp.datos || {};

    if (field === "alcalde") {
      exp.datos.alcalde = exp.datos.alcalde || {};
      exp.datos.alcalde.nombre = val;
      exp.datos.alcalde.origen = "Editado manualmente";
      exp.alcalde = exp.datos.alcalde;
      if (window.App && window.App.currentProject) {
        window.App.currentProject.alcalde = exp.datos.alcalde;
      }
      if (exp.fase3) {
        exp.fase3.datosIdentificacion = exp.fase3.datosIdentificacion || {};
        exp.fase3.datosIdentificacion.alcalde = exp.datos.alcalde;
      }
    } else if (field === "secretario") {
      exp.datos.secretarioPlaneacion = exp.datos.secretarioPlaneacion || {};
      exp.datos.secretarioPlaneacion.nombre = val;
      exp.datos.secretarioPlaneacion.origen = "Editado manualmente";
      exp.secretarioPlaneacion = exp.datos.secretarioPlaneacion;
      if (window.App && window.App.currentProject) {
        window.App.currentProject.secretarioPlaneacion = exp.datos.secretarioPlaneacion;
      }
      if (exp.fase3) {
        exp.fase3.datosIdentificacion = exp.fase3.datosIdentificacion || {};
        exp.fase3.datosIdentificacion.secretarioPlaneacion = exp.datos.secretarioPlaneacion;
      }
    } else if (field === "nombreExpediente") {
      exp.datos.nombreExpediente = val;
      exp.nombreExpediente = val;
      if (window.App && window.App.currentProject) {
        window.App.currentProject.nombreExpediente = val;
      }
    }

    // Guardado silencioso de respaldo
    if (window.App && typeof App.saveAuditProgress === "function") {
      App.saveAuditProgress(true);
    }
  }
};

if (typeof window !== "undefined") {
  window.ReportsEngine = ReportsEngine;
}
