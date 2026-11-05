/**
 * MOTOR DE VALIDACIÓN ESTRUCTURAL Y DESPIECE DE ACERO (FASE 1A)
 * Sistema SIPRO-PH - Gobernación de Antioquia
 * Norma Técnica: Criterios Técnicos de Diseño de Pavimentos con Placa-huella
 */

const StructuralEngine = {

  /**
   * Cálculo paramétrico oficial de volúmenes de concreto y cemento
   * Estándar Técnico: Criterios Técnicos de Diseño de Pavimentos con Placa-huella
   */
  calculateConcreteVolumes(longitudM, options = {}) {
    const L = parseFloat(longitudM) || 0;
    const huellasM3 = +(2 * 0.90 * 0.15 * L).toFixed(2);
    const ciclopeoM3 = +(0.90 * 0.15 * L).toFixed(2);
    const cunetasM3 = +(2 * 0.70 * 0.09 * L).toFixed(2);
    const numRiostras = L > 0 ? (Math.floor(L / 3.0) + 1) : 0;
    const riostrasM3 = +(numRiostras * 4.30 * 0.25 * 0.20).toFixed(2);
    const sobreanchoM3 = L > 0 ? +(L * 0.03).toFixed(2) : 0;
    const transicionM3 = L > 0 ? +(2 * 1.50 * 4.30 * 0.15).toFixed(2) : 0;

    const totalConcreto21M3 = +(huellasM3 + cunetasM3 + riostrasM3 + sobreanchoM3 + transicionM3).toFixed(2);
    const totalConcretoCiclopeoM3 = ciclopeoM3;
    const totalConcretoGlobalM3 = +(totalConcreto21M3 + totalConcretoCiclopeoM3).toFixed(2);
    const sacosCemento = L > 0
      ? Math.round(totalConcreto21M3 * 7.5 + totalConcretoCiclopeoM3 * 4.5)
      : 0;
    const piedraRajonM3 = +(ciclopeoM3 * 0.40).toFixed(2);
    const aceroTotalKg = (options && options.pesoTotalKg) || (L > 0 ? Math.round(L * 26.25) : 0);

    const dosificacionGlobal = totalConcretoGlobalM3 > 0 && sacosCemento > 0
      ? +(sacosCemento / totalConcretoGlobalM3).toFixed(2)
      : 7.20;

    const dosificaciones = {
      rieles: 7.5,
      entrerriel: 4.5,
      sobreancho: 7.5,
      riostras: 7.5,
      cunetas: 7.5,
      transicion: 7.5
    };

    const elementos = {
      rieles: {
        nombre: "RIELES",
        tipo: "Concreto Simple f'c = 21 MPa (3000 PSI)",
        anchoM: 0.90,
        espesorAltoM: 0.15,
        longitudM: L,
        areaSeccionM2: 0.135,
        cantidad: "2",
        volumenSimple21M3: huellasM3,
        volumenCiclopeoM3: 0,
        volumenTotalM3: huellasM3,
        dosificacion: 7.5,
        sacos: Math.round(huellasM3 * 7.5)
      },
      entrerriel: {
        nombre: "ENTRERRIEL",
        tipo: "Concreto Ciclópeo (f'c = 21 MPa con piedra pegada)",
        anchoM: 0.90,
        espesorAltoM: 0.15,
        longitudM: L,
        areaSeccionM2: 0.135,
        cantidad: "1",
        volumenSimple21M3: 0,
        volumenCiclopeoM3: ciclopeoM3,
        volumenTotalM3: ciclopeoM3,
        dosificacion: 4.5,
        sacos: Math.round(ciclopeoM3 * 4.5)
      },
      sobreancho: {
        nombre: "SOBREANCHO (Opcional)",
        tipo: "Concreto Simple f'c = 21 MPa (3000 PSI)",
        anchoM: 0.20,
        espesorAltoM: 0.15,
        longitudM: L,
        areaSeccionM2: 0.030,
        cantidad: "Paramétrico",
        volumenSimple21M3: sobreanchoM3,
        volumenCiclopeoM3: 0,
        volumenTotalM3: sobreanchoM3,
        dosificacion: 7.5,
        sacos: Math.round(sobreanchoM3 * 7.5)
      },
      riostras: {
        nombre: "VIGAS RIOSTRAS",
        tipo: "Concreto Simple f'c = 21 MPa (3000 PSI)",
        anchoM: 0.25,
        espesorAltoM: 0.20,
        longitudM: 4.30,
        areaSeccionM2: 0.050,
        cantidad: String(numRiostras),
        volumenSimple21M3: riostrasM3,
        volumenCiclopeoM3: 0,
        volumenTotalM3: riostrasM3,
        dosificacion: 7.5,
        sacos: Math.round(riostrasM3 * 7.5)
      },
      cunetas: {
        nombre: "CUNETAS Y BORDILLOS",
        tipo: "Concreto Simple f'c = 21 MPa (3000 PSI)",
        anchoM: 0.70,
        espesorAltoM: 0.09,
        longitudM: L,
        areaSeccionM2: +(0.70 * 0.09).toFixed(4),
        cantidad: "2",
        volumenSimple21M3: cunetasM3,
        volumenCiclopeoM3: 0,
        volumenTotalM3: cunetasM3,
        dosificacion: 7.5,
        sacos: Math.round(cunetasM3 * 7.5)
      },
      transicion: {
        nombre: "LOSA DE TRANSICIÓN (Opcional)",
        tipo: "Concreto Simple f'c = 21 MPa (3000 PSI)",
        anchoM: 4.30,
        espesorAltoM: 0.15,
        longitudM: 1.50,
        areaSeccionM2: 0.645,
        cantidad: "2",
        volumenSimple21M3: transicionM3,
        volumenCiclopeoM3: 0,
        volumenTotalM3: transicionM3,
        dosificacion: 7.5,
        sacos: Math.round(transicionM3 * 7.5)
      }
    };

    return {
      longitudM: L,
      huellasM3,
      ciclopeoM3,
      cunetasM3,
      riostrasM3,
      numRiostras,
      sobreanchoM3,
      transicionM3,
      totalConcreto21M3,
      totalConcretoSimpleM3: totalConcreto21M3,
      totalConcretoCiclopeoM3,
      totalConcretoGlobalM3,
      sacosCemento,
      dosificacionGlobal,
      dosificaciones,
      aceroTotalKg,
      elementos
    };
  },

  /**
   * Helper para sanitizar texto antes de inyectar en el DOM
   */
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
   * Renderiza el Resumen Descriptivo y Dimensiones de Elementos por Separado
   * Estructura fiel a la plantilla oficial de la Gobernación de Antioquia:
   * 1. Dimensiones Generales del Tramo (Longitud, Ancho, Separación)
   * 2. Dimensiones Placa Huella (Rieles, Entrerriel, Sobreancho, Vigas Riostras)
   * 3. Dimensiones Cunetas y Bordillos (Área sección, Espesor, Ancho base/alto, Ancho superior, Cantidad)
   * 4. Dimensiones Losa de Transición (Longitud, Ancho base, Espesor, Cantidad)
   */
  renderGeometricSummaryCard(containerId, project) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    container.style.display = "none";
  },

  getNominalWeight(diam) {
    if (!diam) return 0.560;
    const str = String(diam);
    if (str.includes("1/2") || str.includes("#4")) return 0.994;
    if (str.includes("3/8") || str.includes("#3")) return 0.560;
    if (str.includes("1/4") || str.includes("#2")) return 0.250;
    if (str.includes("5/8") || str.includes("#5")) return 1.552;
    if (str.includes("3/4") || str.includes("#6")) return 2.235;
    return 0.560;
  },

  getDefaultStandardRows(longitudM = 0) {
    return [
      { item: 1, elem: "RIELES", tipo: "Refuerzo Longitudinal", diam: '3/8"', pesoLin: 0.560, corte: 0, piezas: 0, longTotalM: 0, pesoTotalKg: 0, varillas6m: 0, obs: "Empalmes escalonados" },
      { item: 2, elem: "RIELES", tipo: "Refuerzo Transversal", diam: '3/8"', pesoLin: 0.560, corte: 0, piezas: 0, longTotalM: 0, pesoTotalKg: 0, varillas6m: 0, obs: "Separación cada 0.20 m" },
      { item: 3, elem: "RIELES", tipo: "Traslapo (Opcional)", diam: '3/8"', pesoLin: 0.560, corte: 0, piezas: 0, longTotalM: 0, pesoTotalKg: 0, varillas6m: 0, obs: "Longitud empalme según norma" },
      { item: 4, elem: "VIGA RIOSTRA", tipo: "Refuerzo Long. Superior", diam: '1/2"', pesoLin: 0.994, corte: 0, piezas: 0, longTotalM: 0, pesoTotalKg: 0, varillas6m: 0, obs: "2 barras superiores corridas" },
      { item: 5, elem: "VIGA RIOSTRA", tipo: "Refuerzo Long. Inferior", diam: '1/2"', pesoLin: 0.994, corte: 0, piezas: 0, longTotalM: 0, pesoTotalKg: 0, varillas6m: 0, obs: "2 barras inferiores corridas" },
      { item: 6, elem: "VIGA RIOSTRA", tipo: "Refuerzo Transversal (Estribos)", diam: '3/8"', pesoLin: 0.560, corte: 0, piezas: 0, longTotalM: 0, pesoTotalKg: 0, varillas6m: 0, obs: "Estribos cerrados c/ 0.20 m" },
      { item: 7, elem: "CUNETAS Y BORDILLOS", tipo: "Refuerzo Longitudinal Cuneta", diam: '3/8"', pesoLin: 0.560, corte: 0, piezas: 0, longTotalM: 0, pesoTotalKg: 0, varillas6m: 0, obs: "3 barras longitudinales" },
      { item: 8, elem: "CUNETAS Y BORDILLOS", tipo: "Refuerzo Transversal Cuneta", diam: '3/8"', pesoLin: 0.560, corte: 0, piezas: 0, longTotalM: 0, pesoTotalKg: 0, varillas6m: 0, obs: "Flejes en U cada 0.25 m" },
      { item: 9, elem: "CUNETAS Y BORDILLOS", tipo: "Refuerzo Long. Bordillo", diam: '3/8"', pesoLin: 0.560, corte: 0, piezas: 0, longTotalM: 0, pesoTotalKg: 0, varillas6m: 0, obs: "1 barra superior corrida" },
      { item: 10, elem: "CUNETAS Y BORDILLOS", tipo: "Refuerzo Gancho Bordillo", diam: '1/4"', pesoLin: 0.250, corte: 0, piezas: 0, longTotalM: 0, pesoTotalKg: 0, varillas6m: 0, obs: "Ganchos de anclaje cada 0.30 m" },
      { item: 11, elem: "LOSA DE TRANSICIÓN", tipo: "Malla Longitudinal", diam: '3/8"', pesoLin: 0.560, corte: 0, piezas: 0, longTotalM: 0, pesoTotalKg: 0, varillas6m: 0, obs: "Malla de refuerzo en extremos" },
      { item: 12, elem: "LOSA DE TRANSICIÓN", tipo: "Malla Transversal", diam: '3/8"', pesoLin: 0.560, corte: 0, piezas: 0, longTotalM: 0, pesoTotalKg: 0, varillas6m: 0, obs: "Malla transversal en extremos" }
    ];
  },

  recalculateStandardTemplate(template) {
    if (!template || !template.filas) return;

    let subtotalLongM = 0;
    let subtotalPesoKg = 0;
    let subtotalVarillas = 0;

    template.filas.forEach((r) => {
      const corte = parseFloat(r.corte) || 0;
      const piezas = parseFloat(r.piezas) || 0;
      const pesoLin = parseFloat(r.pesoLin) || this.getNominalWeight(r.diam);

      r.pesoLin = pesoLin;
      r.longTotalM = +(corte * piezas).toFixed(2);
      r.pesoTotalKg = +(pesoLin * r.longTotalM).toFixed(2);
      r.varillas6m = Math.ceil(r.longTotalM / 6.0);

      subtotalLongM += r.longTotalM;
      subtotalPesoKg += r.pesoTotalKg;
      subtotalVarillas += r.varillas6m;
    });

    subtotalLongM = +subtotalLongM.toFixed(2);
    subtotalPesoKg = +subtotalPesoKg.toFixed(2);

    template.subtotal = {
      longitudTotalM: subtotalLongM,
      pesoTotalKg: subtotalPesoKg,
      varillas6m: subtotalVarillas
    };

    const sumByDiam = (match) => {
      let p = 0, v = 0;
      template.filas.filter(r => (r.diam || "").includes(match)).forEach(r => {
        p += r.pesoTotalKg || 0;
        v += r.varillas6m || 0;
      });
      return { peso: +p.toFixed(2), varillas: v };
    };

    const d12 = sumByDiam("1/2");
    const d38 = sumByDiam("3/8");
    const d14 = sumByDiam("1/4");

    template.consolidado = [
      { diametro: '1/2"', pesoNominal: 0.994, pesoTotalKg: d12.peso, varillas6m: d12.varillas, unidad: "KG" },
      { diametro: '3/8"', pesoNominal: 0.560, pesoTotalKg: d38.peso, varillas6m: d38.varillas, unidad: "KG" },
      { diametro: '1/4"', pesoNominal: 0.250, pesoTotalKg: d14.peso, varillas6m: d14.varillas, unidad: "KG" },
      { diametro: 'TOTAL', pesoNominal: null, pesoTotalKg: subtotalPesoKg, varillas6m: subtotalVarillas, unidad: "GLOBAL" }
    ];

    const L = parseFloat(template.infoGeneral.longitudM) || 0;
    const cuantia = L > 0 ? +(subtotalPesoKg / L).toFixed(2) : 0;
    const superavit = +(cuantia - 26.25).toFixed(2);

    template.totales = {
      pesoTotalGlobalKg: subtotalPesoKg,
      totalVarillas6m: subtotalVarillas,
      cuantiaKgM: cuantia,
      cuantiaSuperavitKgM: superavit
    };

    return template;
  },

  onTemplateCellChange(projectId, rowIndex, field, value) {
    projectId = projectId || App.currentProjectId;
    const rec = window.proyectosAuditados && window.proyectosAuditados[projectId];
    if (!rec) return;

    const t = rec.datos?.despieceExtraido?.standardTemplate;
    if (!t || !t.filas || !t.filas[rowIndex]) return;

    const row = t.filas[rowIndex];
    if (field === "corte" || field === "piezas") {
      row[field] = parseFloat(value) || 0;
    } else if (field === "diam") {
      row.diam = value;
      row.pesoLin = this.getNominalWeight(value);
      const spanPesoLin = document.getElementById(`row_pesoLin_${rowIndex}`);
      if (spanPesoLin) spanPesoLin.innerText = row.pesoLin.toFixed(3);
    } else if (field === "pesoLin") {
      row.pesoLin = parseFloat(value) || this.getNominalWeight(row.diam);
    } else if (field === "obs") {
      row.obs = value;
    }

    this.recalculateStandardTemplate(t);

    const cellLong = document.getElementById(`row_longTotal_${rowIndex}`);
    if (cellLong) cellLong.innerText = row.longTotalM.toLocaleString('es-CO', { minimumFractionDigits: 2 });
    const cellPeso = document.getElementById(`row_pesoTotal_${rowIndex}`);
    if (cellPeso) cellPeso.innerText = row.pesoTotalKg.toLocaleString('es-CO', { minimumFractionDigits: 2 });
    const cellVar = document.getElementById(`row_varillas_${rowIndex}`);
    if (cellVar) cellVar.innerText = row.varillas6m;

    const subLong = document.getElementById("template_subtotal_long");
    if (subLong) subLong.innerText = t.subtotal.longitudTotalM.toLocaleString('es-CO', { minimumFractionDigits: 2 }) + " m";
    const subPeso = document.getElementById("template_subtotal_peso");
    if (subPeso) subPeso.innerText = t.subtotal.pesoTotalKg.toLocaleString('es-CO', { minimumFractionDigits: 2 }) + " kg";
    const subVar = document.getElementById("template_subtotal_var");
    if (subVar) subVar.innerText = t.subtotal.varillas6m.toLocaleString('es-CO') + " und";

    const d12P = document.getElementById("cons_d12_peso");
    if (d12P) d12P.innerText = t.consolidado[0].pesoTotalKg.toLocaleString('es-CO', { minimumFractionDigits: 2 }) + " kg";
    const d12V = document.getElementById("cons_d12_var");
    if (d12V) d12V.innerText = t.consolidado[0].varillas6m;

    const d38P = document.getElementById("cons_d38_peso");
    if (d38P) d38P.innerText = t.consolidado[1].pesoTotalKg.toLocaleString('es-CO', { minimumFractionDigits: 2 }) + " kg";
    const d38V = document.getElementById("cons_d38_var");
    if (d38V) d38V.innerText = t.consolidado[1].varillas6m;

    const d14P = document.getElementById("cons_d14_peso");
    if (d14P) d14P.innerText = t.consolidado[2].pesoTotalKg.toLocaleString('es-CO', { minimumFractionDigits: 2 }) + " kg";
    const d14V = document.getElementById("cons_d14_var");
    if (d14V) d14V.innerText = t.consolidado[2].varillas6m;

    const totP = document.getElementById("cons_tot_peso");
    if (totP) totP.innerText = t.totales.pesoTotalGlobalKg.toLocaleString('es-CO', { minimumFractionDigits: 2 }) + " kg";
    const totV = document.getElementById("cons_tot_var");
    if (totV) totV.innerText = t.totales.totalVarillas6m.toLocaleString('es-CO');

    const calloutPeso = document.getElementById("template_callout_peso");
    if (calloutPeso) calloutPeso.innerText = t.totales.pesoTotalGlobalKg.toLocaleString('es-CO', { minimumFractionDigits: 1 }) + " KG";
    const calloutVar = document.getElementById("template_callout_var");
    if (calloutVar) calloutVar.innerText = t.totales.totalVarillas6m.toLocaleString('es-CO') + " VARILLAS";
    const calloutCuantia = document.getElementById("template_callout_cuantia");
    if (calloutCuantia) {
      const tag = t.totales.cuantiaSuperavitKgM >= 0 ? `(✓ +${t.totales.cuantiaSuperavitKgM} kg/m)` : `(⚠️ Déficit ${t.totales.cuantiaSuperavitKgM} kg/m)`;
      calloutCuantia.innerHTML = `${t.totales.cuantiaKgM} kg/m <span style="font-size:11px;font-weight:600;">${tag}</span>`;
    }

    if (rec.fase1A) {
      rec.fase1A.pesoTotalCalculadoKg = t.totales.pesoTotalGlobalKg;
      rec.fase1A.pesoTotalDeclaradoKg = t.totales.pesoTotalGlobalKg;
      rec.fase1A.pesoTotalKg = t.totales.pesoTotalGlobalKg;
      rec.fase1A.cuantiaRealKgM = t.totales.cuantiaKgM;
      rec.fase1A.cuantiaSuperavitKgM = t.totales.cuantiaSuperavitKgM;
      rec.fase1A.acero = {
        pesoTotalKg: t.totales.pesoTotalGlobalKg,
        pesoDeclaradoKg: t.totales.pesoTotalGlobalKg,
        pesoCalculadoKg: t.totales.pesoTotalGlobalKg,
        cuantiaRealKgM: t.totales.cuantiaKgM,
        subtotalesPorElemento: t.subtotalesPorElemento || {},
        subtotalesPorDiametro: t.subtotalesPorDiametro || {}
      };
    }
    if (rec.datos) {
      rec.datos.despieceAcero = rec.datos.despieceAcero || {};
      rec.datos.despieceAcero.pesoTotalKg = t.totales.pesoTotalGlobalKg;
      rec.datos.despieceAcero.cuantiaCalculadaKgM = t.totales.cuantiaKgM;
      rec.datos.despieceExtraido = rec.datos.despieceExtraido || {};
      rec.datos.despieceExtraido.standardTemplate = t;
    }

    const L = t.infoGeneral.longitudM || rec.datos?.longitudM || 0;
    rec.concretoVolumes = this.calculateConcreteVolumes(L, { pesoTotalKg: t.totales.pesoTotalGlobalKg });
    if (rec.fase1A) {
      rec.fase1A.concretoVolumes = rec.concretoVolumes;
      rec.fase1A.concreto = {
        totalConcreto21M3: rec.concretoVolumes.totalConcreto21M3,
        totalConcretoCiclopeoM3: rec.concretoVolumes.totalConcretoCiclopeoM3,
        totalConcretoGlobalM3: rec.concretoVolumes.totalConcretoGlobalM3,
        sacosCemento: rec.concretoVolumes.sacosCemento,
        dosificacionGlobal: rec.concretoVolumes.dosificacionGlobal,
        elementos: rec.concretoVolumes.elementos
      };
    }
    this.renderConcreteTable(rec.concretoVolumes, document.getElementById("concreteVolumesContainer"), rec.fase1A, rec.datos?.despieceExtraido);

    if (rec.modalidad === "RECURSOS" && typeof PresupuestoEngine !== "undefined") {
      PresupuestoEngine.auditarCoherencia(rec);
      const container1C = document.getElementById("presupuestoAuditContainer");
      if (container1C) PresupuestoEngine.renderPresupuestoTab(rec, container1C);
    }

    if (window.App && typeof App.actualizarKPIsEjecutivos === "function") {
      App.actualizarKPIsEjecutivos(projectId);
    }
  },

  onInfoGeneralChange(projectId, field, value) {
    projectId = projectId || App.currentProjectId;
    const rec = window.proyectosAuditados && window.proyectosAuditados[projectId];
    if (!rec) return;

    const t = rec.datos?.despieceExtraido?.standardTemplate;
    if (!t || !t.infoGeneral) return;

    if (field === "longitudM") {
      const newL = parseFloat(value) || 0;
      t.infoGeneral.longitudM = newL;
      if (rec.datos) rec.datos.longitudM = newL;
      if (rec.fase1A) rec.fase1A.longitudIntervencionM = newL;
      this.recalculateStandardTemplate(t);

      rec.concretoVolumes = this.calculateConcreteVolumes(newL, { pesoTotalKg: t.totales.pesoTotalGlobalKg });
      if (rec.fase1A) {
        rec.fase1A.concretoVolumes = rec.concretoVolumes;
        rec.fase1A.concreto = {
          totalConcreto21M3: rec.concretoVolumes.totalConcreto21M3,
          totalConcretoCiclopeoM3: rec.concretoVolumes.totalConcretoCiclopeoM3,
          totalConcretoGlobalM3: rec.concretoVolumes.totalConcretoGlobalM3,
          sacosCemento: rec.concretoVolumes.sacosCemento,
          dosificacionGlobal: rec.concretoVolumes.dosificacionGlobal,
          elementos: rec.concretoVolumes.elementos
        };
      }
      this.renderConcreteTable(rec.concretoVolumes, document.getElementById("concreteVolumesContainer"), rec.fase1A, rec.datos?.despieceExtraido);

      if (rec.modalidad === "RECURSOS" && typeof PresupuestoEngine !== "undefined") {
        PresupuestoEngine.auditarCoherencia(rec);
        const container1C = document.getElementById("presupuestoAuditContainer");
        if (container1C) PresupuestoEngine.renderPresupuestoTab(rec, container1C);
      }

      const kpiTotal = document.getElementById("kpiTotalEvaluado");
      if (kpiTotal) kpiTotal.innerText = `${newL} m`;
      if (window.App && typeof App.actualizarKPIsEjecutivos === "function") {
        App.actualizarKPIsEjecutivos(projectId);
      }
      const calloutCuantia = document.getElementById("template_callout_cuantia");
      if (calloutCuantia) {
        const tag = t.totales.cuantiaSuperavitKgM >= 0 ? `(✓ +${t.totales.cuantiaSuperavitKgM} kg/m)` : `(⚠️ Déficit ${t.totales.cuantiaSuperavitKgM} kg/m)`;
        calloutCuantia.innerHTML = `${t.totales.cuantiaKgM} kg/m <span style="font-size:11px;font-weight:600;">${tag}</span>`;
      }
    } else {
      t.infoGeneral[field] = value;
      if (field === "municipio" && rec.datos) {
        rec.municipio = value;
        rec.datos.municipio = value;
        const bannerMpio = document.getElementById("expBannerMpio");
        if (bannerMpio) bannerMpio.innerText = `MUNICIPIO: ${value.toUpperCase()}`;
      }
    }
  },

  /**
   * Filas estándar con valores iniciales limpios en CERO (sin mock ni datos falsos)
   */
  getDefaultStandardRows() {
    const defaultElements = [
      { item: 1, elem: "RIELES", tipo: "Refuerzo Longitudinal", diam: '3/8"', pesoLin: 0.560, corte: 0, obs: "Empalmes escalonados" },
      { item: 2, elem: "RIELES", tipo: "Refuerzo Transversal", diam: '3/8"', pesoLin: 0.560, corte: 0, obs: "Separación cada 0.20 m" },
      { item: 3, elem: "RIELES", tipo: "Traslapo (Opcional)", diam: '3/8"', pesoLin: 0.560, corte: 0, obs: "Longitud empalme según norma" },
      { item: 4, elem: "VIGA RIOSTRA", tipo: "Refuerzo Long. Superior", diam: '1/2"', pesoLin: 0.994, corte: 0, obs: "2 barras superiores corridas" },
      { item: 5, elem: "VIGA RIOSTRA", tipo: "Refuerzo Long. Inferior", diam: '1/2"', pesoLin: 0.994, corte: 0, obs: "2 barras inferiores corridas" },
      { item: 6, elem: "VIGA RIOSTRA", tipo: "Refuerzo Transversal (Estribos)", diam: '3/8"', pesoLin: 0.560, corte: 0, obs: "Estribos cerrados c/ 0.20 m" },
      { item: 7, elem: "CUNETAS Y BORDILLOS", tipo: "Refuerzo Longitudinal Cuneta", diam: '3/8"', pesoLin: 0.560, corte: 0, obs: "3 barras longitudinales" },
      { item: 8, elem: "CUNETAS Y BORDILLOS", tipo: "Refuerzo Transversal Cuneta", diam: '3/8"', pesoLin: 0.560, corte: 0, obs: "Flejes en U cada 0.25 m" },
      { item: 9, elem: "CUNETAS Y BORDILLOS", tipo: "Refuerzo Long. Bordillo", diam: '3/8"', pesoLin: 0.560, corte: 0, obs: "1 barra superior corrida" },
      { item: 10, elem: "CUNETAS Y BORDILLOS", tipo: "Refuerzo Gancho Bordillo", diam: '1/4"', pesoLin: 0.250, corte: 0, obs: "Ganchos de anclaje cada 0.30 m" },
      { item: 11, elem: "LOSA DE TRANSICIÓN", tipo: "Malla Longitudinal", diam: '3/8"', pesoLin: 0.560, corte: 0, obs: "Malla de refuerzo en extremos" },
      { item: 12, elem: "LOSA DE TRANSICIÓN", tipo: "Malla Transversal", diam: '3/8"', pesoLin: 0.560, corte: 0, obs: "Malla transversal en extremos" }
    ];

    return defaultElements.map(d => ({
      item: d.item,
      elem: d.elem,
      tipo: d.tipo,
      diam: d.diam,
      pesoLin: d.pesoLin,
      corte: d.corte,
      piezas: 0,
      longTotalM: 0.0,
      pesoTotalKg: 0.0,
      varillas6m: 0,
      obs: d.obs
    }));
  },

  /**
   * Recalcula totales y consolidado por diámetro matemáticamente
   */
  recalculateStandardTemplate(template) {
    if (!template || !template.filas) return;
    let subtotalLongM = 0;
    let subtotalPesoKg = 0;
    let subtotalVarillas = 0;

    template.filas.forEach(r => {
      subtotalLongM += (r.longTotalM || 0);
      subtotalPesoKg += (r.pesoTotalKg || 0);
      subtotalVarillas += (r.varillas6m || 0);
    });

    subtotalLongM = +subtotalLongM.toFixed(2);
    subtotalPesoKg = +subtotalPesoKg.toFixed(2);

    template.subtotal = {
      longitudTotalM: subtotalLongM,
      pesoTotalKg: subtotalPesoKg,
      varillas6m: subtotalVarillas
    };

    const sumByDiam = (match) => {
      let p = 0, v = 0;
      template.filas.filter(r => (r.diam || "").includes(match)).forEach(r => {
        p += r.pesoTotalKg || 0;
        v += r.varillas6m || 0;
      });
      return { peso: +p.toFixed(2), varillas: v };
    };

    const d12 = sumByDiam("1/2");
    const d38 = sumByDiam("3/8");
    const d14 = sumByDiam("1/4");

    template.consolidado = [
      { diametro: '1/2"', pesoNominal: 0.994, pesoTotalKg: d12.peso, varillas6m: d12.varillas, unidad: "KG" },
      { diametro: '3/8"', pesoNominal: 0.560, pesoTotalKg: d38.peso, varillas6m: d38.varillas, unidad: "KG" },
      { diametro: '1/4"', pesoNominal: 0.250, pesoTotalKg: d14.peso, varillas6m: d14.varillas, unidad: "KG" },
      { diametro: 'TOTAL', pesoNominal: null, pesoTotalKg: subtotalPesoKg, varillas6m: subtotalVarillas, unidad: "GLOBAL" }
    ];

    const L = (template.infoGeneral && template.infoGeneral.longitudM) || 0;
    const cuantia = L > 0 ? +(subtotalPesoKg / L).toFixed(2) : 0.0;
    const superavit = +(cuantia - 26.25).toFixed(2);

    template.totales = {
      pesoTotalGlobalKg: subtotalPesoKg,
      totalVarillas6m: subtotalVarillas,
      cuantiaKgM: cuantia,
      cuantiaSuperavitKgM: superavit
    };
  },

  renderDespieceFiel(containerId, project) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!project) {
      container.innerHTML = `
        <div class="standard-template-box" style="text-align:center;padding:48px 24px;color:var(--text-muted);">
          <div style="font-size:16px;font-weight:800;color:var(--text-main);margin-bottom:8px;">
            📋 Plantilla Estándar de Despiece de Acero (Fase 1A)
          </div>
          <p style="max-width:560px;margin:0 auto 16px;font-size:13px;">
            Cargue una carpeta municipal para visualizar el despiece bajo el formato oficial de la Gobernación de Antioquia.
          </p>
          <span class="gov-pill" style="font-size:11px;">En Espera de Expediente</span>
        </div>
      `;
      return;
    }

    const projectId = project.id || App.currentProjectId;
    const d = project.despieceExtraido || project.despieceAcero || {};

    let template = d.standardTemplate;
    if (!template) {
      const finalLength = d.longitudIntervencionM || project.longitudM || 0;
      const defFilas = this.getDefaultStandardRows(finalLength);
      template = {
        isStandardTemplate: !!d.isStandardTemplate,
        formatoNombre: d.isStandardTemplate ? "Plantilla Estándar Oficial Gobernación" : "Formato Previo / Libre",
        infoGeneral: {
          municipio: project.municipio || "",
          subregion: project.subregion || "ANTIOQUIA",
          via: project.nombreTramo || project.nombreExpediente || "",
          codigoVia: project.codigoVial || "",
          longitudM: finalLength,
          anchoM: 5.0,
          separacionVigasM: 3.0
        },
        filas: defFilas
      };
      this.recalculateStandardTemplate(template);
      d.standardTemplate = template;
    }

    const info = template.infoGeneral || {};
    const filas = template.filas || [];
    const sub = template.subtotal || { longitudTotalM: 0, pesoTotalKg: 0, varillas6m: 0 };
    const tot = template.totales || { pesoTotalGlobalKg: 0, totalVarillas6m: 0, cuantiaKgM: 0, cuantiaSuperavitKgM: 0 };

    // 1. Alerta de formato con estilo institucional del dashboard
    const tieneDoc = (d.tieneDocumento !== false && !!d.archivoNombre && (project.archivosFiles ? !!project.archivosFiles[3] : true));
    const isStd = template.isStandardTemplate;
    let statusBanner = "";

    if (!tieneDoc) {
      statusBanner = `
        <div class="template-status-banner" style="background:#FEF2F2;border:1.5px solid #EF4444;border-left:5px solid #DC2626;padding:16px 20px;border-radius:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;box-shadow:var(--shadow-sm);">
          <div style="display:flex;align-items:center;gap:14px;">
            <div style="font-size:24px;color:#DC2626;font-weight:900;">✕</div>
            <div>
              <div style="font-weight:800;color:#991B1B;font-size:14px;margin-bottom:2px;">Documento de Despiece de Acero (Ítem 3) NO APORTADO</div>
              <div style="font-size:12px;color:#7F1D1D;line-height:1.4;">
                En la carpeta municipal no se encontró ningún archivo de despiece, planilla de acero o figuración. La cuantía de acero no se puede certificar sin el documento.
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <button class="btn-primary" style="padding:6px 14px;font-size:12px;background:#DC2626;border-color:#DC2626;cursor:pointer;" onclick="App.subirSubsanacionItem(3, '${projectId}')" title="Cargar archivo de Despiece de Acero (Ítem 3)">
              📁 Aportar Despiece de Acero
            </button>
          </div>
        </div>
      `;
    } else if (isStd) {
      statusBanner = `
        <div class="template-status-banner status-standard">
          <div style="display:flex;align-items:center;gap:12px;">
            <div class="format-badge-icon standard">✓</div>
            <div>
              <div class="format-badge-title">Formato Estándar Detectado — Revisión Automatizada</div>
              <div class="format-badge-desc">El documento aportado corresponde a la Plantilla Oficial de Despiece de Acero de la Gobernación. Verificación técnica y matemática controlada de solo lectura.</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span class="format-file-tag">📄 ${this.escapeHtml(d.archivoNombre)}</span>
            <button class="btn-secondary" style="padding:4px 10px;font-size:11px;background:rgba(255,255,255,0.85);cursor:pointer;" onclick="App.subirSubsanacionItem(3, '${projectId}')" title="Seleccionar o reemplazar el archivo de Despiece de Acero (Ítem 3)">Reemplazar Archivo &#8644;</button>
          </div>
        </div>
      `;
    } else {
      statusBanner = `
        <div class="template-status-banner status-legacy">
          <div style="display:flex;align-items:center;gap:12px;">
            <div class="format-badge-icon legacy">⚠️</div>
            <div>
              <div class="format-badge-title">Documento en Formato Previo (No Estandarizado)</div>
              <div class="format-badge-desc">El municipio aportó un documento libre o previo. Extracción asistida de dimensiones y cantidades estructurada en la plantilla estándar para revisión técnica de solo lectura.</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span class="format-file-tag">📄 ${this.escapeHtml(d.archivoNombre)}</span>
            <button class="btn-secondary" style="padding:4px 10px;font-size:11px;background:rgba(255,255,255,0.85);cursor:pointer;" onclick="App.subirSubsanacionItem(3, '${projectId}')" title="Seleccionar o reemplazar el archivo de Despiece de Acero (Ítem 3)">Reemplazar Archivo &#8644;</button>
          </div>
        </div>
      `;
    }

    // 2. Parámetros clave del proyecto (Únicamente los 3 datos requeridos)
    const keyParamsHtml = `
      <div class="template-key-params-grid">
        <div class="key-param-card">
          <div class="key-param-icon-box">🛣️</div>
          <div>
            <div class="key-param-label">Código de la Vía</div>
            <div class="key-param-val font-mono">${this.escapeHtml(info.codigoVia || project.codigoVial || 'En cotejo')}</div>
          </div>
        </div>

        <div class="key-param-card">
          <div class="key-param-icon-box">📏</div>
          <div>
            <div class="key-param-label">Longitud Total a Intervenir</div>
            <div class="key-param-val font-mono">${Number(info.longitudM || project.longitudM || 0).toLocaleString('es-CO')} metros lineales</div>
          </div>
        </div>

        <div class="key-param-card">
          <div class="key-param-icon-box">📐</div>
          <div>
            <div class="key-param-label">Ancho de la Sección</div>
            <div class="key-param-val font-mono">${(parseFloat(info.anchoM) || 5.0).toFixed(1)} m</div>
          </div>
        </div>
      </div>
    `;

    // 3. Tarjetas Esquemáticas por Diámetro de Varilla
    const diamCardsHtml = (template.consolidado || [])
      .filter(c => c.diametro !== "TOTAL")
      .map(c => {
        const pct = tot.pesoTotalGlobalKg > 0 ? ((c.pesoTotalKg / tot.pesoTotalGlobalKg) * 100).toFixed(1) : 0;
        const diamColor = c.diametro.includes("1/2") ? "#0284C7" : (c.diametro.includes("3/8") ? "#059669" : "#D97706");
        return `
          <div class="steel-diam-card" style="border-top: 3px solid ${diamColor};">
            <div class="steel-diam-header">
              <span class="diam-pill font-mono" style="background:${diamColor}14; color:${diamColor}; border:1px solid ${diamColor}30;">
                Varilla Ø ${c.diametro}
              </span>
              <span class="diam-pct font-mono">${pct}%</span>
            </div>
            <div class="steel-diam-body">
              <div class="diam-weight font-mono" style="color:${diamColor};">
                ${(c.pesoTotalKg || 0).toLocaleString('es-CO', { minimumFractionDigits: 1 })} <span class="unit">kg</span>
              </div>
              <div class="diam-varillas font-mono">
                <b>${(c.varillas6m || 0).toLocaleString('es-CO')}</b> <span style="font-size:11px;color:var(--text-muted);">varillas (6 m)</span>
              </div>
            </div>
            <div class="diam-bar-track">
              <div class="diam-bar-fill" style="width: ${pct}%; background: ${diamColor};"></div>
            </div>
            <div class="diam-footer">
              <span>Peso lineal: <b>${(c.pesoNominal || 0).toFixed(3)} kg/m</b></span>
            </div>
          </div>
        `;
      }).join('');

    // Panel Resumen Esquemático y Visual de Totales
    const isCuantiaOk = tot.cuantiaSuperavitKgM >= 0;
    const steelSummaryPanelHtml = `
      <div class="steel-summary-panel">
        <div class="steel-total-card">
          <div class="steel-total-header">
            <div class="steel-total-title">
              <span style="font-size:20px;">🏗️</span>
              <span>PESO TOTAL DE ACERO REPORTADO</span>
            </div>
            <span class="cuantia-badge ${isCuantiaOk ? 'good' : 'bad'}">
              ${tot.cuantiaKgM || 0} kg/m ${isCuantiaOk ? `(✓ +${tot.cuantiaSuperavitKgM} kg/m)` : `(⚠️ Déficit ${Math.abs(tot.cuantiaSuperavitKgM)} kg/m)`}
            </span>
          </div>

          <div class="steel-total-metrics">
            <div class="steel-metric-main">
              <div class="steel-metric-number font-mono">
                ${(tot.pesoTotalGlobalKg || 0).toLocaleString('es-CO', { minimumFractionDigits: 1 })} <span class="unit">kg</span>
              </div>
              <div class="steel-metric-sub font-mono">
                ${((tot.pesoTotalGlobalKg || 0) / 1000).toFixed(2)} toneladas de acero figurado
              </div>
            </div>
            <div class="steel-metric-divider"></div>
            <div class="steel-metric-extra">
              <div class="metric-row">
                <span class="metric-lbl">Total Barras de 6m:</span>
                <span class="metric-val font-mono font-bold">${(tot.totalVarillas6m || 0).toLocaleString('es-CO')} varillas</span>
              </div>
              <div class="metric-row">
                <span class="metric-lbl">Longitud Total Varillaje:</span>
                <span class="metric-val font-mono">${(sub.longitudTotalM || 0).toLocaleString('es-CO', { minimumFractionDigits: 1 })} m</span>
              </div>
              <div class="metric-row">
                <span class="metric-lbl">Referencia Departamental:</span>
                <span class="metric-val font-bold" style="color:var(--color-primary-dark)">Mínimo 26.25 kg/m</span>
              </div>
            </div>
          </div>
        </div>

        <div class="steel-diameters-container">
          <div class="steel-diameters-header">
            <span>🔩</span> CONSOLIDADO ESQUEMÁTICO POR DIÁMETRO DE VARILLA
          </div>
          <div class="steel-diameters-grid">
            ${diamCardsHtml}
          </div>
        </div>
      </div>
    `;

    // 4. Tabla detallada con el desglose de marcas (100% Solo Lectura)
    const getRowElemHtml = (index, elem) => {
      if (index === 0) return `<td rowspan="3" class="table-elem-cell" style="vertical-align:middle;font-weight:800;background:var(--color-bg-alt);color:var(--color-primary-dark);text-align:center;">RIELES</td>`;
      if (index === 3) return `<td rowspan="3" class="table-elem-cell" style="vertical-align:middle;font-weight:800;background:var(--color-bg-alt);color:var(--color-primary-dark);text-align:center;">VIGA RIOSTRA</td>`;
      if (index === 6) return `<td rowspan="4" class="table-elem-cell" style="vertical-align:middle;font-weight:800;background:var(--color-bg-alt);color:var(--color-primary-dark);text-align:center;">CUNETAS Y BORDILLOS</td>`;
      if (index === 10) return `<td rowspan="2" class="table-elem-cell" style="vertical-align:middle;font-weight:800;background:var(--color-bg-alt);color:var(--color-primary-dark);text-align:center;">LOSA DE TRANSICIÓN</td>`;
      return "";
    };

    let filasHtml = "";
    filas.forEach((r, idx) => {
      const elemCell = getRowElemHtml(idx, r.elem);
      const diamColor = (r.diam || "").includes("1/2") ? "#0284C7" : ((r.diam || "").includes("3/8") ? "#059669" : "#D97706");
      filasHtml += `
        <tr>
          ${elemCell}
          <td style="font-size:12px;font-weight:600;">${this.escapeHtml(r.tipo)}</td>
          <td style="text-align:center;">
            <span class="diam-pill font-mono" style="background:${diamColor}14; color:${diamColor}; border:1px solid ${diamColor}30; padding:2px 7px; font-size:11px;">
              ${r.diam}
            </span>
          </td>
          <td class="font-mono" style="text-align:right;font-size:12px;">${(parseFloat(r.pesoLin) || 0.56).toFixed(3)}</td>
          <td class="font-mono" style="text-align:center;font-size:12px;">${(r.corte !== undefined && r.corte !== null && parseFloat(r.corte) > 0) ? `${parseFloat(r.corte).toFixed(2)} m` : ((r.corte === 0 || r.corte === "0") ? "0" : "-")}</td>
          <td class="font-mono font-bold" style="text-align:center;font-size:12px;">${(parseInt(r.piezas) || 0).toLocaleString('es-CO')}</td>
          <td class="font-mono" style="text-align:right;font-size:12px;">${(r.longTotalM || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })} m</td>
          <td class="font-mono font-bold" style="text-align:right;font-size:12px;color:var(--color-primary);">${(r.pesoTotalKg || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })} kg</td>
          <td class="font-mono font-bold" style="text-align:center;font-size:12px;">${r.varillas6m || 0}</td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div class="standard-template-box">
        <!-- 1. Alerta Institucional de Tipo de Formato -->
        ${statusBanner}

        <!-- 2. Parámetros Clave del Proyecto -->
        ${keyParamsHtml}

        <!-- 3. Panel de Resumen Esquemático y Visual de Totales -->
        ${steelSummaryPanelHtml}

        <!-- 4. Cuadro Detallado de Despiece por Elemento (Solo Lectura) -->
        <div class="template-section-header">
          <div style="display:flex;align-items:center;gap:8px;">
            <span>📐</span>
            <span>DESGLOSE DETALLADO DE MARCAS DE DESPIECE DE ACERO</span>
          </div>
          <span class="gov-pill" style="font-size:10px;">Solo Lectura y Revisión</span>
        </div>

        <div class="table-responsive" style="margin-bottom:0;">
          <table class="standard-despiece-table readonly-table">
            <thead>
              <tr>
                <th style="width:16%;">Elemento Estructural</th>
                <th style="width:20%;">Tipo de Refuerzo</th>
                <th style="width:10%;text-align:center;">Diámetro Nominal</th>
                <th style="width:9%;text-align:right;">Peso Lin. (kg/m)</th>
                <th style="width:11%;text-align:center;">Long. Corte</th>
                <th style="width:10%;text-align:center;">Cantidad Piezas</th>
                <th style="width:11%;text-align:right;">Long. Total (m)</th>
                <th style="width:11%;text-align:right;">Peso Total (kg)</th>
                <th style="width:9%;text-align:center;">Varillas 6m</th>
              </tr>
            </thead>
            <tbody>
              ${filasHtml}
              <!-- TOTAL CANTIDADES NOMINALES -->
              <tr class="subtotal-row">
                <td colspan="6" style="text-align:right;letter-spacing:0.3px;">TOTAL CANTIDADES NOMINALES:</td>
                <td style="text-align:right;" class="font-mono font-bold">${(sub.longitudTotalM || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })} m</td>
                <td style="text-align:right;color:#00412E;" class="font-mono font-bold">${(sub.pesoTotalKg || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })} kg</td>
                <td style="text-align:center;" class="font-mono font-bold">${(sub.varillas6m || 0).toLocaleString('es-CO')} und</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  renderConcreteTable(concretoVolumes, container, fase1A, despieceExtraido) {
    if (!container) return;
    container.innerHTML = "";

    if (!concretoVolumes || !concretoVolumes.longitudM || concretoVolumes.longitudM === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:36px 20px;color:var(--text-muted);background:var(--color-bg-alt);border-radius:8px;">
          <div style="font-weight:800;font-size:15px;margin-bottom:6px;color:var(--text-muted);">ℹ️ Memoria de Volúmenes en Espera</div>
          <div style="font-size:13px;max-width:540px;margin:0 auto;">Cargue una carpeta municipal para visualizar los volúmenes de concreto simple, concreto ciclópeo y sacos de cemento consignados en la plantilla oficial.</div>
        </div>
      `;
      const statConc = document.getElementById("statConcreteTotal");
      if (statConc) statConc.innerText = "0.00 m³";
      const statCem = document.getElementById("statCementTotal");
      if (statCem) statCem.innerText = "0 sacos";
      return;
    }

    const cv = concretoVolumes;
    const L = cv.longitudM;

    const concMem = (despieceExtraido && despieceExtraido.concretoYCemento) ? despieceExtraido.concretoYCemento : null;
    const isDeclared = concMem && concMem.consignadoEnDocumento;

    const valConc21 = isDeclared ? concMem.resumen.concreto21Mpa : `${cv.totalConcreto21M3.toLocaleString('es-CO', { minimumFractionDigits: 2 })} m³`;
    const valConcCicl = isDeclared ? concMem.resumen.concretoCiclopeo : `${cv.totalConcretoCiclopeoM3.toLocaleString('es-CO', { minimumFractionDigits: 2 })} m³`;
    const valConcTot = isDeclared ? concMem.resumen.concretoTotal : `${cv.totalConcretoGlobalM3.toLocaleString('es-CO', { minimumFractionDigits: 2 })} m³`;
    const valSacos = isDeclared ? concMem.resumen.cementoBultos : `${cv.sacosCemento.toLocaleString('es-CO')} sacos`;

    const numDosi = cv.dosificacionGlobal || (cv.totalConcretoGlobalM3 > 0 ? (cv.sacosCemento / cv.totalConcretoGlobalM3) : 7.20);
    const valDosi = (concMem && concMem.resumen && concMem.resumen.dosificacionCemento)
      ? concMem.resumen.dosificacionCemento
      : `${numDosi.toFixed(2)} sacos / m³`;

    const statConc = document.getElementById("statConcreteTotal");
    if (statConc) statConc.innerText = valConcTot;
    const statCem = document.getElementById("statCementTotal");
    if (statCem) statCem.innerText = valSacos;
    const statDosi = document.getElementById("statDosificacionTotal");
    if (statDosi) statDosi.innerText = valDosi;

    // 5 Tarjetas KPI superiores alineadas a la Plantilla Oficial de la Gobernación
    const kpisHtml = `
      <div class="concrete-kpi-grid" style="grid-template-columns: repeat(auto-fit, minmax(185px, 1fr));">
        <div class="concrete-kpi-card" style="border-top:3px solid #0284C7;">
          <div class="concrete-kpi-label">Concreto 21 MPa (Simple)</div>
          <div class="concrete-kpi-val" style="color:#0284C7">${valConc21}</div>
          <div class="concrete-kpi-sub">Rieles + Riostras + Cunetas + Transición</div>
        </div>

        <div class="concrete-kpi-card" style="border-top:3px solid #D97706;">
          <div class="concrete-kpi-label">Concreto Ciclópeo</div>
          <div class="concrete-kpi-val" style="color:#D97706">${valConcCicl}</div>
          <div class="concrete-kpi-sub">Entrerriel / Franja central</div>
        </div>

        <div class="concrete-kpi-card" style="border-top:3px solid #00412E;">
          <div class="concrete-kpi-label">Concreto Total Global</div>
          <div class="concrete-kpi-val" style="color:#00412E">${valConcTot}</div>
          <div class="concrete-kpi-sub">${isDeclared ? 'Consignado en Documento' : 'Volumen integral de obra'}</div>
        </div>

        <div class="concrete-kpi-card" style="border-top:3px solid #059669;">
          <div class="concrete-kpi-label">Sacos Cemento (50 kg)</div>
          <div class="concrete-kpi-val" style="color:#059669">${valSacos}</div>
          <div class="concrete-kpi-sub">${isDeclared ? 'Consignado en Documento' : '~7.2 sacos por metro lineal'}</div>
        </div>

        <div class="concrete-kpi-card" style="border-top:3px solid #6366F1;">
          <div class="concrete-kpi-label">Dosificación Cemento</div>
          <div class="concrete-kpi-val" style="color:#6366F1">${valDosi}</div>
          <div class="concrete-kpi-sub">7.5 sacos/m³ (21 MPa) · 4.5 sacos/m³ (Ciclópeo)</div>
        </div>
      </div>
    `;

    // Componentes estructurales 100% alineados con la Plantilla Oficial de la Gobernación
    const elemData = cv.elementos || {};
    const rows = [
      {
        componente: "RIELES",
        especificacion: "Concreto Simple f'c = 21 MPa (3000 PSI)",
        cantidad: elemData.rieles?.cantidad || "2",
        anchoM: (elemData.rieles?.anchoM || 0.90).toFixed(2),
        espesorAltoM: (elemData.rieles?.espesorAltoM || 0.15).toFixed(2),
        longitudM: (elemData.rieles?.longitudM || L).toFixed(2),
        areaSeccionM2: "0.135",
        dosificacion: "7.50 sacos / m³",
        volumen21M3: elemData.rieles?.volumenSimple21M3 !== undefined ? elemData.rieles.volumenSimple21M3 : cv.huellasM3,
        volumenCicM3: 0,
        cementoEst: Math.round((elemData.rieles?.volumenSimple21M3 !== undefined ? elemData.rieles.volumenSimple21M3 : cv.huellasM3) * 7.5)
      },
      {
        componente: "ENTRERRIEL",
        especificacion: "Concreto Ciclópeo (f'c = 21 MPa con piedra pegada)",
        cantidad: elemData.entrerriel?.cantidad || "1",
        anchoM: (elemData.entrerriel?.anchoM || 0.90).toFixed(2),
        espesorAltoM: (elemData.entrerriel?.espesorAltoM || 0.15).toFixed(2),
        longitudM: (elemData.entrerriel?.longitudM || L).toFixed(2),
        areaSeccionM2: "0.135",
        dosificacion: "4.50 sacos / m³",
        volumen21M3: 0,
        volumenCicM3: elemData.entrerriel?.volumenCiclopeoM3 !== undefined ? elemData.entrerriel.volumenCiclopeoM3 : cv.ciclopeoM3,
        cementoEst: Math.round((elemData.entrerriel?.volumenCiclopeoM3 !== undefined ? elemData.entrerriel.volumenCiclopeoM3 : cv.ciclopeoM3) * 4.5)
      },
      {
        componente: "SOBREANCHO (Opcional)",
        especificacion: "Concreto Simple f'c = 21 MPa (3000 PSI)",
        cantidad: elemData.sobreancho?.cantidad || "Paramétrico",
        anchoM: (elemData.sobreancho?.anchoM || 0.20).toFixed(2),
        espesorAltoM: (elemData.sobreancho?.espesorAltoM || 0.15).toFixed(2),
        longitudM: (elemData.sobreancho?.longitudM || L).toFixed(2),
        areaSeccionM2: "0.030",
        dosificacion: "7.50 sacos / m³",
        volumen21M3: elemData.sobreancho?.volumenSimple21M3 !== undefined ? elemData.sobreancho.volumenSimple21M3 : (cv.sobreanchoM3 || 0),
        volumenCicM3: 0,
        cementoEst: Math.round((elemData.sobreancho?.volumenSimple21M3 !== undefined ? elemData.sobreancho.volumenSimple21M3 : (cv.sobreanchoM3 || 0)) * 7.5)
      },
      {
        componente: "VIGAS RIOSTRAS",
        especificacion: "Concreto Simple f'c = 21 MPa (3000 PSI)",
        cantidad: elemData.riostras?.cantidad || `${cv.numRiostras || (L > 0 ? (Math.floor(L / 3.0) + 1) : 0)} un`,
        anchoM: (elemData.riostras?.anchoM || 0.25).toFixed(2),
        espesorAltoM: (elemData.riostras?.espesorAltoM || 0.20).toFixed(2),
        longitudM: "4.30",
        areaSeccionM2: "0.050",
        dosificacion: "7.50 sacos / m³",
        volumen21M3: elemData.riostras?.volumenSimple21M3 !== undefined ? elemData.riostras.volumenSimple21M3 : cv.riostrasM3,
        volumenCicM3: 0,
        cementoEst: Math.round((elemData.riostras?.volumenSimple21M3 !== undefined ? elemData.riostras.volumenSimple21M3 : cv.riostrasM3) * 7.5)
      },
      {
        componente: "CUNETAS Y BORDILLOS",
        especificacion: "Concreto Simple f'c = 21 MPa (3000 PSI)",
        cantidad: elemData.cunetas?.cantidad || "2",
        anchoM: (elemData.cunetas?.anchoM || 0.70).toFixed(2),
        espesorAltoM: (elemData.cunetas?.espesorAltoM || 0.09).toFixed(2),
        longitudM: (elemData.cunetas?.longitudM || L).toFixed(2),
        areaSeccionM2: ((elemData.cunetas?.areaSeccionM2 !== undefined ? elemData.cunetas.areaSeccionM2 : ((elemData.cunetas?.anchoM || 0.70) * (elemData.cunetas?.espesorAltoM || 0.09)))).toFixed(4),
        dosificacion: "7.50 sacos / m³",
        volumen21M3: elemData.cunetas?.volumenSimple21M3 !== undefined ? elemData.cunetas.volumenSimple21M3 : cv.cunetasM3,
        volumenCicM3: 0,
        cementoEst: Math.round((elemData.cunetas?.volumenSimple21M3 !== undefined ? elemData.cunetas.volumenSimple21M3 : cv.cunetasM3) * 7.5)
      },
      {
        componente: "LOSA DE TRANSICIÓN (Opcional)",
        especificacion: "Concreto Simple f'c = 21 MPa (3000 PSI)",
        cantidad: elemData.transicion?.cantidad || "2",
        anchoM: (elemData.transicion?.anchoM || 4.30).toFixed(2),
        espesorAltoM: (elemData.transicion?.espesorAltoM || 0.15).toFixed(2),
        longitudM: "1.50",
        areaSeccionM2: "0.645",
        dosificacion: "7.50 sacos / m³",
        volumen21M3: elemData.transicion?.volumenSimple21M3 !== undefined ? elemData.transicion.volumenSimple21M3 : (cv.transicionM3 || 0),
        volumenCicM3: 0,
        cementoEst: Math.round((elemData.transicion?.volumenSimple21M3 !== undefined ? elemData.transicion.volumenSimple21M3 : (cv.transicionM3 || 0)) * 7.5)
      }
    ];

    let tableHtml = `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th style="min-width:170px;">Elemento Estructural</th>
              <th style="min-width:160px;">Tipo de Concreto</th>
              <th style="text-align:center;">Cantidad</th>
              <th style="text-align:right;">Ancho (m)</th>
              <th style="text-align:right;">Espesor / Alto (m)</th>
              <th style="text-align:right;">Longitud (m)</th>
              <th style="text-align:right;">Área Sección (m²)</th>
              <th style="text-align:right;">Concreto Simple 21 MPa (m³)</th>
              <th style="text-align:right;">Concreto Ciclópeo (m³)</th>
              <th style="text-align:right;">Dosificación (sacos / m³)</th>
              <th style="text-align:right;">Total Cemento (Sacos 50kg)</th>
            </tr>
          </thead>
          <tbody>
    `;

    rows.forEach(r => {
      tableHtml += `
        <tr>
          <td><strong>${r.componente}</strong></td>
          <td><span style="font-size:12px;color:var(--text-muted)">${r.especificacion}</span></td>
          <td style="text-align:center;"><span class="dim-pill" style="font-size:11px;font-weight:700;">${r.cantidad}</span></td>
          <td class="font-mono" style="text-align:right;font-size:12px">${r.anchoM}</td>
          <td class="font-mono" style="text-align:right;font-size:12px">${r.espesorAltoM}</td>
          <td class="font-mono" style="text-align:right;font-size:12px">${r.longitudM}</td>
          <td class="font-mono" style="text-align:right;font-size:12px;color:var(--color-primary);font-weight:700;">${r.areaSeccionM2}</td>
          <td class="font-mono font-bold" style="text-align:right;color:#0284C7">${r.volumen21M3 > 0 ? r.volumen21M3.toLocaleString('es-CO', { minimumFractionDigits: 2 }) + ' m³' : '-'}</td>
          <td class="font-mono font-bold" style="text-align:right;color:#D97706">${r.volumenCicM3 > 0 ? r.volumenCicM3.toLocaleString('es-CO', { minimumFractionDigits: 2 }) + ' m³' : '-'}</td>
          <td class="font-mono font-bold" style="text-align:right;color:#6366F1;">${r.dosificacion}</td>
          <td class="font-mono" style="text-align:right;">${r.cementoEst.toLocaleString('es-CO')} sacos</td>
        </tr>
      `;
    });

    tableHtml += `
            <tr style="background:var(--color-bg-alt);font-weight:800;border-top:2px solid var(--border-color);">
              <td colspan="7">SUBTOTAL CONCRETO SIMPLE 21 MPa (RIELES + SOBREANCHO + RIOSTRAS + CUNETAS + TRANSICIÓN)</td>
              <td class="font-mono font-bold" style="text-align:right;color:#0284C7">${cv.totalConcreto21M3.toLocaleString('es-CO', { minimumFractionDigits: 2 })} m³</td>
              <td class="font-mono" style="text-align:right;color:var(--text-muted);">-</td>
              <td class="font-mono font-bold" style="text-align:right;color:#6366F1;">7.50 sacos / m³</td>
              <td class="font-mono" style="text-align:right;">${Math.round(cv.totalConcreto21M3 * 7.5).toLocaleString('es-CO')} sacos</td>
            </tr>
            <tr style="background:var(--color-bg-alt);font-weight:800;">
              <td colspan="7">SUBTOTAL CONCRETO CICLÓPEO (ENTRERRIEL)</td>
              <td class="font-mono" style="text-align:right;color:var(--text-muted);">-</td>
              <td class="font-mono font-bold" style="text-align:right;color:#D97706">${cv.totalConcretoCiclopeoM3.toLocaleString('es-CO', { minimumFractionDigits: 2 })} m³</td>
              <td class="font-mono font-bold" style="text-align:right;color:#6366F1;">4.50 sacos / m³</td>
              <td class="font-mono" style="text-align:right;">${Math.round(cv.totalConcretoCiclopeoM3 * 4.5).toLocaleString('es-CO')} sacos</td>
            </tr>
            <tr style="background:rgba(0,65,46,0.08);font-weight:900;font-size:13px;border-top:2px solid #00412E;">
              <td colspan="7" style="color:#00412E;">TOTAL GENERAL CONCRETOS Y CEMENTO (${L} m)</td>
              <td class="font-mono font-bold" style="text-align:right;color:#0284C7;font-size:13px;">${cv.totalConcreto21M3.toLocaleString('es-CO', { minimumFractionDigits: 2 })} m³</td>
              <td class="font-mono font-bold" style="text-align:right;color:#D97706;font-size:13px;">${cv.totalConcretoCiclopeoM3.toLocaleString('es-CO', { minimumFractionDigits: 2 })} m³</td>
              <td class="font-mono font-bold" style="text-align:right;color:#6366F1;font-size:13px;">${numDosi.toFixed(2)} sacos / m³</td>
              <td class="font-mono font-bold" style="text-align:right;color:#00412E;font-size:14px;">${cv.sacosCemento.toLocaleString('es-CO')} sacos</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = kpisHtml + tableHtml;
  },
  auditProject(project) {
    const standards = SIPRO_DATA.normativeStandards;
    const despiece = project.despieceExtraido || project.despieceAcero || { marcas: [], pesoTotalDeclaradoKg: 0, cuantiaKgM: 0 };
    const marcas = despiece.marcas || [];

    let alerts = [];

    // Chequeo de anomalías de hoja de cálculo detectadas en el PDF (informativo)
    if (despiece.spreadsheetErrors && despiece.spreadsheetErrors.length > 0) {
      alerts.push({
        criterio: "Anomalía de Hoja de Cálculo en Documento Original",
        observacion: `El documento de despiece contiene errores de fórmulas no resueltos: ${despiece.spreadsheetErrors.join(", ")}`,
        accion_requerida: "Corregir las fórmulas de cálculo en el archivo original del municipio."
      });
    }

    const lengthM = despiece.longitudIntervencionM || project.longitudM || 0;
    const totalCalculatedWeightKg = despiece.pesoTotalDeclaradoKg || 0;
    const realCuantiaKgM = despiece.cuantiaKgM || (lengthM > 0 ? +(totalCalculatedWeightKg / lengthM).toFixed(2) : 0);
    const minCuantia = standards.cuantiaMinimaKgM;

    const auditedMarks = marcas.map(m => ({
      ...m,
      pesoCalculadoKg: m.pesoKg || 0,
      estado: "Consignado",
      criterioIncumplido: "-"
    }));

    const concretoVolumes = (project.despieceAcero && project.despieceAcero.concretoVolumes)
      ? project.despieceAcero.concretoVolumes
      : this.calculateConcreteVolumes(lengthM, { pesoTotalKg: totalCalculatedWeightKg });
    project.concretoVolumes = concretoVolumes;

    const tieneDoc = despiece.tieneDocumento !== false && (!!despiece.archivoNombre || (project.archivosFiles && !!project.archivosFiles[3]));
    if (!tieneDoc) {
      alerts.push({
        criterio: "Documento de Despiece de Acero (Ítem 3)",
        observacion: "No se aportó el documento de despiece de acero en la carpeta municipal.",
        accion_requerida: "Aportar el documento de despiece de acero (Ítem 3) en formato Excel o PDF."
      });
    }

    const cumpleCuantia = tieneDoc && (realCuantiaKgM >= minCuantia);

    const auditPesoKg = despiece.pesoTotalDeclaradoKg || totalCalculatedWeightKg;
    return {
      fase: "1A_ACERO",
      aprobado: tieneDoc,
      cuantiaConforme: cumpleCuantia,
      cumpleCuantia: cumpleCuantia,
      normaAplicada: standards.normaBase,
      longitudTramo: lengthM,
      longitudIntervencionM: lengthM,
      pesoTotalCalculadoKg: totalCalculatedWeightKg,
      pesoTotalDeclaradoKg: auditPesoKg,
      pesoTotalKg: auditPesoKg,
      diferenciaPesoPct: 0,
      cuantiaRealKgM: realCuantiaKgM,
      cuantiaNormativaMinKgM: minCuantia,
      cuantiaSuperavitKgM: +(realCuantiaKgM - minCuantia).toFixed(2),
      marcasEvaluadas: auditedMarks,
      totalMarcas: auditedMarks.length,
      marcasCumplen: auditedMarks.length,
      marcasNoCumplen: 0,
      concretoVolumes: concretoVolumes,
      // ÚNICA FUENTE DE VERDAD (Single Source of Truth) para Fase 1C y reportes
      acero: {
        pesoTotalKg: auditPesoKg,
        pesoDeclaradoKg: auditPesoKg,
        pesoCalculadoKg: totalCalculatedWeightKg,
        cuantiaRealKgM: realCuantiaKgM,
        subtotalesPorElemento: (despiece.standardTemplate && despiece.standardTemplate.subtotalesPorElemento) || {},
        subtotalesPorDiametro: (despiece.standardTemplate && despiece.standardTemplate.subtotalesPorDiametro) || {}
      },
      concreto: {
        totalConcreto21M3: concretoVolumes.totalConcreto21M3,
        totalConcretoCiclopeoM3: concretoVolumes.totalConcretoCiclopeoM3,
        totalConcretoGlobalM3: concretoVolumes.totalConcretoGlobalM3,
        sacosCemento: concretoVolumes.sacosCemento,
        dosificacionGlobal: concretoVolumes.dosificacionGlobal,
        elementos: concretoVolumes.elementos || {}
      },
      copniaOk: true,
      hallazgosCriticos: tieneDoc ? [] : [{
        criterio: "Ítem 3: Despiece de Acero",
        observacion: "Documento de despiece de acero no aportado",
        accion_requerida: "Aportar el despiece de acero conforme a los criterios técnicos"
      }],
      alertas: alerts
    };
  },

  /**
   * Renderiza la tabla auditora (alias de compatibilidad)
   */
  renderAuditTable(auditResult, tableBody, projectId) {
    if (!tableBody) return;
    tableBody.innerHTML = "";
  }
};

if (typeof window !== "undefined") {
  window.StructuralEngine = StructuralEngine;
}
