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
      totalConcretoCiclopeoM3,
      totalConcretoGlobalM3,
      sacosCemento,
      piedraRajonM3,
      aceroTotalKg
    };
  },

  /**
   * Renderiza el Resumen Descriptivo de Geometría y Elementos Identificados en el Documento
   * Reemplazo limpio y transparente del esquema SVG
   */
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
   * Renderiza el Resumen Descriptivo (Unificado en la Seccion 1 de la Plantilla Estandar)
   */
  renderGeometricSummaryCard(containerId, project) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
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
      { item: 1, elem: "RIELES", tipo: "Refuerzo Longitudinal", diam: '3/8"', pesoLin: 0.560, corte: 6.00, piezas: 0, longTotalM: 0, pesoTotalKg: 0, varillas6m: 0, obs: "Empalmes escalonados" },
      { item: 2, elem: "RIELES", tipo: "Refuerzo Transversal", diam: '3/8"', pesoLin: 0.560, corte: 0.80, piezas: 0, longTotalM: 0, pesoTotalKg: 0, varillas6m: 0, obs: "Separación cada 0.20 m" },
      { item: 3, elem: "RIELES", tipo: "Traslapo (Opcional)", diam: '3/8"', pesoLin: 0.560, corte: 0.40, piezas: 0, longTotalM: 0, pesoTotalKg: 0, varillas6m: 0, obs: "Longitud empalme según norma" },
      { item: 4, elem: "VIGA RIOSTRA", tipo: "Refuerzo Long. Superior", diam: '1/2"', pesoLin: 0.994, corte: 4.20, piezas: 0, longTotalM: 0, pesoTotalKg: 0, varillas6m: 0, obs: "2 barras superiores corridas" },
      { item: 5, elem: "VIGA RIOSTRA", tipo: "Refuerzo Long. Inferior", diam: '1/2"', pesoLin: 0.994, corte: 4.20, piezas: 0, longTotalM: 0, pesoTotalKg: 0, varillas6m: 0, obs: "2 barras inferiores corridas" },
      { item: 6, elem: "VIGA RIOSTRA", tipo: "Refuerzo Transversal (Estribos)", diam: '3/8"', pesoLin: 0.560, corte: 0.85, piezas: 0, longTotalM: 0, pesoTotalKg: 0, varillas6m: 0, obs: "Estribos cerrados c/ 0.20 m" },
      { item: 7, elem: "CUNETAS Y BORDILLOS", tipo: "Refuerzo Longitudinal Cuneta", diam: '3/8"', pesoLin: 0.560, corte: 6.00, piezas: 0, longTotalM: 0, pesoTotalKg: 0, varillas6m: 0, obs: "3 barras longitudinales" },
      { item: 8, elem: "CUNETAS Y BORDILLOS", tipo: "Refuerzo Transversal Cuneta", diam: '3/8"', pesoLin: 0.560, corte: 0.80, piezas: 0, longTotalM: 0, pesoTotalKg: 0, varillas6m: 0, obs: "Flejes en U cada 0.25 m" },
      { item: 9, elem: "CUNETAS Y BORDILLOS", tipo: "Refuerzo Long. Bordillo", diam: '3/8"', pesoLin: 0.560, corte: 6.00, piezas: 0, longTotalM: 0, pesoTotalKg: 0, varillas6m: 0, obs: "1 barra superior corrida" },
      { item: 10, elem: "CUNETAS Y BORDILLOS", tipo: "Refuerzo Gancho Bordillo", diam: '1/4"', pesoLin: 0.250, corte: 0.45, piezas: 0, longTotalM: 0, pesoTotalKg: 0, varillas6m: 0, obs: "Ganchos de anclaje cada 0.30 m" },
      { item: 11, elem: "LOSA DE TRANSICIÓN", tipo: "Malla Longitudinal", diam: '3/8"', pesoLin: 0.560, corte: 1.40, piezas: 0, longTotalM: 0, pesoTotalKg: 0, varillas6m: 0, obs: "Malla de refuerzo en extremos" },
      { item: 12, elem: "LOSA DE TRANSICIÓN", tipo: "Malla Transversal", diam: '3/8"', pesoLin: 0.560, corte: 4.20, piezas: 0, longTotalM: 0, pesoTotalKg: 0, varillas6m: 0, obs: "Malla transversal en extremos" }
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
      rec.fase1A.cuantiaRealKgM = t.totales.cuantiaKgM;
      rec.fase1A.cuantiaSuperavitKgM = t.totales.cuantiaSuperavitKgM;
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
    this.renderConcreteTable(rec.concretoVolumes, document.getElementById("concreteVolumesContainer"), rec.fase1A, rec.datos?.despieceExtraido);

    const kpiCuantia = document.getElementById("kpiCuantiaVal");
    if (kpiCuantia) kpiCuantia.innerText = `${t.totales.cuantiaKgM} kg/m`;
    const kpiCuantiaSub = document.getElementById("kpiCuantiaSub");
    if (kpiCuantiaSub) {
      kpiCuantiaSub.innerHTML = t.totales.cuantiaSuperavitKgM >= 0 
        ? `<span class="kpi-tag-good">&#9650; +${t.totales.cuantiaSuperavitKgM} kg/m vs Referencia Técnica (26.25)</span>`
        : `<span style="color:var(--status-danger)">&#9660; Déficit de ${Math.abs(t.totales.cuantiaSuperavitKgM)} kg/m</span>`;
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
      this.renderConcreteTable(rec.concretoVolumes, document.getElementById("concreteVolumesContainer"), rec.fase1A, rec.datos?.despieceExtraido);

      const kpiTotal = document.getElementById("kpiTotalEvaluado");
      if (kpiTotal) kpiTotal.innerText = `${newL} m`;
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
      { item: 1, elem: "RIELES", tipo: "Refuerzo Longitudinal", diam: '3/8"', pesoLin: 0.560, corte: 6.00, obs: "Empalmes escalonados" },
      { item: 2, elem: "RIELES", tipo: "Refuerzo Transversal", diam: '3/8"', pesoLin: 0.560, corte: 0.80, obs: "Separación cada 0.20 m" },
      { item: 3, elem: "RIELES", tipo: "Traslapo (Opcional)", diam: '3/8"', pesoLin: 0.560, corte: 0.40, obs: "Longitud empalme según norma" },
      { item: 4, elem: "VIGA RIOSTRA", tipo: "Refuerzo Long. Superior", diam: '1/2"', pesoLin: 0.994, corte: 4.20, obs: "2 barras superiores corridas" },
      { item: 5, elem: "VIGA RIOSTRA", tipo: "Refuerzo Long. Inferior", diam: '1/2"', pesoLin: 0.994, corte: 4.20, obs: "2 barras inferiores corridas" },
      { item: 6, elem: "VIGA RIOSTRA", tipo: "Refuerzo Transversal (Estribos)", diam: '3/8"', pesoLin: 0.560, corte: 0.85, obs: "Estribos cerrados c/ 0.20 m" },
      { item: 7, elem: "CUNETAS Y BORDILLOS", tipo: "Refuerzo Longitudinal Cuneta", diam: '3/8"', pesoLin: 0.560, corte: 6.00, obs: "3 barras longitudinales" },
      { item: 8, elem: "CUNETAS Y BORDILLOS", tipo: "Refuerzo Transversal Cuneta", diam: '3/8"', pesoLin: 0.560, corte: 0.80, obs: "Flejes en U cada 0.25 m" },
      { item: 9, elem: "CUNETAS Y BORDILLOS", tipo: "Refuerzo Long. Bordillo", diam: '3/8"', pesoLin: 0.560, corte: 6.00, obs: "1 barra superior corrida" },
      { item: 10, elem: "CUNETAS Y BORDILLOS", tipo: "Refuerzo Gancho Bordillo", diam: '1/4"', pesoLin: 0.250, corte: 0.45, obs: "Ganchos de anclaje cada 0.30 m" },
      { item: 11, elem: "LOSA DE TRANSICIÓN", tipo: "Malla Longitudinal", diam: '3/8"', pesoLin: 0.560, corte: 1.40, obs: "Malla de refuerzo en extremos" },
      { item: 12, elem: "LOSA DE TRANSICIÓN", tipo: "Malla Transversal", diam: '3/8"', pesoLin: 0.560, corte: 4.20, obs: "Malla transversal en extremos" }
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
    const isStd = template.isStandardTemplate;
    const statusBanner = isStd
      ? `<div class="template-status-banner status-standard">
          <div style="display:flex;align-items:center;gap:12px;">
            <div class="format-badge-icon standard">✓</div>
            <div>
              <div class="format-badge-title">Formato Estándar Detectado — Revisión Automatizada</div>
              <div class="format-badge-desc">El documento aportado corresponde a la Plantilla Oficial de Despiece de Acero de la Gobernación. Verificación técnica y matemática controlada de solo lectura.</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span class="format-file-tag">📄 ${this.escapeHtml(d.archivoNombre || 'Plantilla_Estandar.xlsx')}</span>
            <button class="btn-secondary" style="padding:4px 10px;font-size:11px;background:rgba(255,255,255,0.85);cursor:pointer;" onclick="document.getElementById('item3FileInput').click()" title="Seleccionar o reemplazar el archivo de Despiece de Acero (Ítem 3)">Reemplazar Archivo &#8644;</button>
          </div>
        </div>`
      : `<div class="template-status-banner status-legacy">
          <div style="display:flex;align-items:center;gap:12px;">
            <div class="format-badge-icon legacy">⚠️</div>
            <div>
              <div class="format-badge-title">Documento en Formato Previo (No Estandarizado)</div>
              <div class="format-badge-desc">El municipio aportó un documento libre o previo. Extracción asistida de dimensiones y cantidades estructurada en la plantilla estándar para revisión técnica de solo lectura.</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span class="format-file-tag">📄 ${this.escapeHtml(d.archivoNombre || 'Despiece_Acero.pdf')}</span>
            <button class="btn-secondary" style="padding:4px 10px;font-size:11px;background:rgba(255,255,255,0.85);cursor:pointer;" onclick="document.getElementById('item3FileInput').click()" title="Seleccionar o reemplazar el archivo de Despiece de Acero (Ítem 3)">Reemplazar Archivo &#8644;</button>
          </div>
        </div>`;

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
                ${(c.pesoTotalKg || 0).toLocaleString('es-CO', {minimumFractionDigits: 1})} <span class="unit">kg</span>
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
                ${(tot.pesoTotalGlobalKg || 0).toLocaleString('es-CO', {minimumFractionDigits: 1})} <span class="unit">kg</span>
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
                <span class="metric-val font-mono">${(sub.longitudTotalM || 0).toLocaleString('es-CO', {minimumFractionDigits: 1})} m</span>
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
          <td class="font-mono" style="text-align:center;font-size:12px;">${(parseFloat(r.corte) || 0).toFixed(2)} m</td>
          <td class="font-mono font-bold" style="text-align:center;font-size:12px;">${(parseInt(r.piezas) || 0).toLocaleString('es-CO')}</td>
          <td class="font-mono" style="text-align:right;font-size:12px;">${(r.longTotalM || 0).toLocaleString('es-CO', {minimumFractionDigits: 2})} m</td>
          <td class="font-mono font-bold" style="text-align:right;font-size:12px;color:var(--color-primary);">${(r.pesoTotalKg || 0).toLocaleString('es-CO', {minimumFractionDigits: 2})} kg</td>
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
                <td style="text-align:right;" class="font-mono font-bold">${(sub.longitudTotalM || 0).toLocaleString('es-CO', {minimumFractionDigits: 2})} m</td>
                <td style="text-align:right;color:#00412E;" class="font-mono font-bold">${(sub.pesoTotalKg || 0).toLocaleString('es-CO', {minimumFractionDigits: 2})} kg</td>
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
          <div style="font-size:13px;max-width:540px;margin:0 auto;">Cargue una carpeta municipal para visualizar los volúmenes de concreto simple, concreto ciclópeo y sacos de cemento consignados en el documento o calculados para la longitud de la vía.</div>
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

    const valConc21 = isDeclared ? concMem.resumen.concreto21Mpa : `${cv.totalConcreto21M3.toLocaleString('es-CO', {minimumFractionDigits: 2})} m³`;
    const valConcCicl = isDeclared ? concMem.resumen.concretoCiclopeo : `${cv.totalConcretoCiclopeoM3.toLocaleString('es-CO', {minimumFractionDigits: 2})} m³`;
    const valConcTot = isDeclared ? concMem.resumen.concretoTotal : `${cv.totalConcretoGlobalM3.toLocaleString('es-CO', {minimumFractionDigits: 2})} m³`;
    const valSacos = isDeclared ? concMem.resumen.cementoBultos : `${cv.sacosCemento.toLocaleString('es-CO')} sacos`;

    const statConc = document.getElementById("statConcreteTotal");
    if (statConc) statConc.innerText = valConcTot;
    const statCem = document.getElementById("statCementTotal");
    if (statCem) statCem.innerText = valSacos;

    // 4 Tarjetas KPI superiores (Sin proporciones obsoletas, sin piedra rajón y sin acero de refuerzo)
    const kpisHtml = `
      <div class="concrete-kpi-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
        <div class="concrete-kpi-card" style="border-top:3px solid #0284C7;">
          <div class="concrete-kpi-label">Concreto 21 MPa (Simple)</div>
          <div class="concrete-kpi-val" style="color:#0284C7">${valConc21}</div>
          <div class="concrete-kpi-sub">Huellas + Cunetas + Riostras + Transición</div>
        </div>

        <div class="concrete-kpi-card" style="border-top:3px solid #D97706;">
          <div class="concrete-kpi-label">Concreto Ciclópeo</div>
          <div class="concrete-kpi-val" style="color:#D97706">${valConcCicl}</div>
          <div class="concrete-kpi-sub">Franja central / Piedra pegada</div>
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
      </div>
    `;

    // 6 detailed element rows (Sin proporciones obsoletas, sin piedra rajón y sin acero de refuerzo)
    const rows = [
      {
        componente: "Losa de Rieles / Huellas (2 rieles)",
        especificacion: "Concreto f'c = 21 MPa (210 kg/cm²)",
        dimensiones: `2 × 0.90 m × 0.15 m × ${L} m`,
        volumenM3: cv.huellasM3,
        cementoEst: Math.round(cv.huellasM3 * 7.5)
      },
      {
        componente: "Franja Central (Piedra Pegada / Ciclópeo)",
        especificacion: "Concreto Ciclópeo (f'c = 21 MPa con piedra)",
        dimensiones: `0.90 m × 0.15 m × ${L} m`,
        volumenM3: cv.ciclopeoM3,
        cementoEst: Math.round(cv.ciclopeoM3 * 4.5)
      },
      {
        componente: "Bermas - Cunetas Laterales (2 bermas)",
        especificacion: "Concreto f'c = 21 MPa (210 kg/cm²)",
        dimensiones: `2 × 0.70 m × 0.09 m × ${L} m`,
        volumenM3: cv.cunetasM3,
        cementoEst: Math.round(cv.cunetasM3 * 7.5)
      },
      {
        componente: `Vigas Riostras Transversales (${cv.numRiostras} unidades c/ 3m)`,
        especificacion: "Concreto f'c = 21 MPa (210 kg/cm²)",
        dimensiones: `${cv.numRiostras} un × (4.30 m × 0.25 m × 0.20 m)`,
        volumenM3: cv.riostrasM3,
        cementoEst: Math.round(cv.riostrasM3 * 7.5)
      },
      {
        componente: "Sobreancho en Curvas y Bordillos",
        especificacion: "Concreto f'c = 21 MPa (210 kg/cm²)",
        dimensiones: `Estimación paramétrica (${L} m × 0.03 m³/m)`,
        volumenM3: cv.sobreanchoM3 || 0,
        cementoEst: Math.round((cv.sobreanchoM3 || 0) * 7.5)
      },
      {
        componente: "Losa de Transición (2 losas en extremos)",
        especificacion: "Concreto f'c = 21 MPa reforzado",
        dimensiones: `2 losas × (1.50 m × 4.30 m × 0.15 m)`,
        volumenM3: cv.transicionM3 || 0,
        cementoEst: Math.round((cv.transicionM3 || 0) * 7.5)
      }
    ];

    let tableHtml = `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Componente Estructural</th>
              <th>Especificación de Mezcla</th>
              <th>Dimensiones / Parámetro Estructural</th>
              <th>Volumen Estimado (m³)</th>
              <th>Sacos Cemento (50kg)</th>
            </tr>
          </thead>
          <tbody>
    `;

    rows.forEach(r => {
      tableHtml += `
        <tr>
          <td><strong>${r.componente}</strong></td>
          <td><span style="font-size:12px;color:var(--text-muted)">${r.especificacion}</span></td>
          <td class="font-mono" style="font-size:12px">${r.dimensiones}</td>
          <td class="font-mono font-bold" style="color:var(--color-primary)">${r.volumenM3.toLocaleString('es-CO', {minimumFractionDigits: 2})} m³</td>
          <td class="font-mono">${r.cementoEst.toLocaleString('es-CO')} sacos</td>
        </tr>
      `;
    });

    tableHtml += `
            <tr style="background:var(--color-bg-alt);font-weight:800;border-top:2px solid var(--border-color);">
              <td colspan="3">SUBTOTAL CONCRETO ESTRUCTURAL 21 MPa (Huellas + Cunetas + Riostras + Transición)</td>
              <td class="font-mono font-bold" style="color:#0284C7">${cv.totalConcreto21M3.toLocaleString('es-CO', {minimumFractionDigits: 2})} m³</td>
              <td class="font-mono">${Math.round(cv.totalConcreto21M3 * 7.5).toLocaleString('es-CO')} sacos</td>
            </tr>
            <tr style="background:var(--color-bg-alt);font-weight:800;">
              <td colspan="3">SUBTOTAL CONCRETO CICLÓPEO CENTRAL (Piedra Pegada f'c 21 MPa)</td>
              <td class="font-mono font-bold" style="color:#D97706">${cv.totalConcretoCiclopeoM3.toLocaleString('es-CO', {minimumFractionDigits: 2})} m³</td>
              <td class="font-mono">${Math.round(cv.ciclopeoM3 * 4.5).toLocaleString('es-CO')} sacos</td>
            </tr>
            <tr style="background:rgba(0,65,46,0.08);font-weight:900;font-size:13px;border-top:2px solid #00412E;">
              <td colspan="3" style="color:#00412E;">TOTAL GLOBAL CONCRETOS PROYECTO (${L} m)</td>
              <td class="font-mono font-bold" style="color:#00412E;font-size:15px;">${cv.totalConcretoGlobalM3.toLocaleString('es-CO', {minimumFractionDigits: 2})} m³</td>
              <td class="font-mono font-bold" style="color:#00412E;font-size:15px;">${cv.sacosCemento.toLocaleString('es-CO')} sacos</td>
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

    // En esta fase de extracción pura, Fase 1A es no bloqueante
    return {
      fase: "1A_ACERO",
      aprobado: true,
      normaAplicada: standards.normaBase,
      longitudIntervencionM: lengthM,
      pesoTotalCalculadoKg: totalCalculatedWeightKg,
      pesoTotalDeclaradoKg: despiece.pesoTotalDeclaradoKg || totalCalculatedWeightKg,
      diferenciaPesoPct: 0,
      cuantiaRealKgM: realCuantiaKgM,
      cuantiaNormativaMinKgM: minCuantia,
      cuantiaSuperavitKgM: +(realCuantiaKgM - minCuantia).toFixed(2),
      marcasEvaluadas: auditedMarks,
      totalMarcas: auditedMarks.length,
      marcasCumplen: auditedMarks.length,
      marcasNoCumplen: 0,
      concretoVolumes: concretoVolumes,
      copniaOk: true,
      hallazgosCriticos: [],
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
