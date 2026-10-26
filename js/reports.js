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
  getFase3State(projectId) {
    if (!projectId) {
      projectId = App.currentProjectId || (App.currentProject && App.currentProject.id);
    }
    if (!projectId || !window.proyectosAuditados || !window.proyectosAuditados[projectId]) {
      return { observacionesEditadas: {}, hallazgosManuales: [], conclusionesConcepto: "" };
    }

    const rec = window.proyectosAuditados[projectId];
    rec.fase3 = rec.fase3 || {
      observacionesEditadas: {},
      hallazgosManuales: [],
      conclusionesConcepto: ""
    };

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

    // 1. COMPUERTA 1A: CONTROL ESTRUCTURAL DE ACERO
    if (audit1A) {
      const fid = "fase_1a_acero";
      const isApproved = audit1A.aprobado;
      const defaultStatus = isApproved ? "Conforme" : "No Aceptado / Por Subsanar";
      const defaultMotivo = isApproved
        ? `Cuantía de acero ${audit1A.cuantiaRealKgM} kg/m cumple el estándar técnico departamental mínimo de 26.25 kg/m.`
        : `Cuantía calculada (${audit1A.cuantiaRealKgM || 0} kg/m) inferior al mínimo de 26.25 kg/m exigido por el criterio técnico departamental (Déficit de ${audit1A.cuantiaSuperavitKgM || 0} kg/m). Marcas conformes: ${audit1A.marcasCumplen || 0}/${audit1A.totalMarcas || 0}.`;

      const userEdit = fase3State.observacionesEditadas[fid];
      const status = userEdit?.estado || defaultStatus;
      const motivo = userEdit?.motivo !== undefined ? userEdit.motivo : defaultMotivo;

      const obj = {
        id: fid,
        fase: "Fase 1A",
        titulo: "Control Estructural de Acero Mínimo",
        norma: "Criterio Técnico Departamental (26.25 kg/m)",
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

    // 2. COMPUERTA 1B: CONTRASTE ESPACIAL Y ALINEACIÓN VIAL
    if (audit1B) {
      const fid = "fase_1b_espacial";
      const isApproved = audit1B.aprobado;
      const defaultStatus = isApproved ? "Conforme" : "No Aceptado / Por Subsanar";
      let defaultMotivo = isApproved
        ? `Trazados georreferenciados conformes con 100% de coincidencia y alineación con la red vial departamental (tolerancia de 10 m).`
        : `Desfase espacial o coincidencia (${audit1B.coberturaBufferPct || 0}%) fuera del corredor vial terciario autorizado (tolerancia de 10 m).`;

      if (audit1B.alertaComprimido) {
        defaultMotivo = audit1B.alertaComprimido;
      }

      const userEdit = fase3State.observacionesEditadas[fid];
      const status = userEdit?.estado || defaultStatus;
      const motivo = userEdit?.motivo !== undefined ? userEdit.motivo : defaultMotivo;

      const obj = {
        id: fid,
        fase: "Fase 1B",
        titulo: "Georreferenciación y Contraste Espacial de Trazados (Alineación con la Red Vial)",
        norma: "Red Terciaria Departamental (Tolerancia 10 m)",
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

    // 3. COMPUERTA 2: LISTA DE 27 ÍTEMS DOCUMENTALES
    const items27 = (audit2 && audit2.items) || (window.SIPRO_DATA && SIPRO_DATA.items27) || [];
    items27.forEach((it) => {
      const fid = `item_${it.num || it.id}`;
      const defaultStatus = it.conforme ? "Conforme" : (it.vencido ? "Vencido" : (it.faltante ? "Faltante" : "No Aceptado / Por Subsanar"));
      let defaultMotivo = "";
      if (it.conforme) {
        defaultMotivo = `Documento aportado (${it.archivoDetectado || "vigente"}) y conforme con la regla normativa.`;
      } else if (it.faltante || !it.archivoDetectado) {
        defaultMotivo = "Documento no aportado en la carpeta del expediente municipal.";
      } else if (it.vencido) {
        defaultMotivo = "Documento detectado pero con fecha vencida o fuera de vigencia legal.";
      } else {
        defaultMotivo = it.observacion || "Documento no aceptado conforme a las especificaciones.";
      }

      const userEdit = fase3State.observacionesEditadas[fid];
      const status = userEdit?.estado || defaultStatus;
      const motivo = userEdit?.motivo !== undefined ? userEdit.motivo : defaultMotivo;

      const obj = {
        id: fid,
        fase: `Fase 2 - Ítem ${it.num}`,
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
      const obj = {
        id: m.id,
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

    return { findings, compliantItems };
  },

  /**
   * Actualiza el estado de un hallazgo y persiste en el proyecto activo
   */
  updateFindingStatus(id, newStatus) {
    const projectId = App.currentProjectId;
    const state = this.getFase3State(projectId);

    // Si es manual
    const manual = (state.hallazgosManuales || []).find(m => m.id === id);
    if (manual) {
      manual.estado = newStatus;
    } else {
      state.observacionesEditadas[id] = state.observacionesEditadas[id] || {};
      state.observacionesEditadas[id].estado = newStatus;
    }

    this.renderOfficialReport(App.currentProject, App.auditGlobal, document.getElementById("officialReportContainer"));
  },

  /**
   * Actualiza el motivo/detalle editable de un hallazgo (sin re-render para no perder el foco)
   */
  updateFindingMotivo(id, newMotivo) {
    const projectId = App.currentProjectId;
    const state = this.getFase3State(projectId);

    const manual = (state.hallazgosManuales || []).find(m => m.id === id);
    if (manual) {
      manual.motivo = newMotivo;
    } else {
      state.observacionesEditadas[id] = state.observacionesEditadas[id] || {};
      state.observacionesEditadas[id].motivo = newMotivo;
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

    // Conteo estricto y real de la Fase 2 (27 requisitos documentales de expedientesMap)
    const recF2 = (window.proyectosAuditados && projectId) ? window.proyectosAuditados[projectId] : null;
    const audit2Data = (recF2 && recF2.fase2) || (auditGlobal && auditGlobal.audit2) || {};
    const items27List = (audit2Data && audit2Data.items) || (window.SIPRO_DATA && SIPRO_DATA.items27) || [];
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

    // Conteo estricto y real de la Fase 2 (27 requisitos documentales de expedientesMap)
    const recF2 = (window.proyectosAuditados && projectId) ? window.proyectosAuditados[projectId] : null;
    const audit2Data = (recF2 && recF2.fase2) || (auditGlobal && auditGlobal.audit2) || {};
    const items27List = (audit2Data && audit2Data.items) || (window.SIPRO_DATA && SIPRO_DATA.items27) || [];
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

    const alcalde = project.alcalde || { nombre: `Alcalde Municipal de ${project.municipio || 'Municipio'}`, cedula: "S/N" };
    const ing = project.ingenieroProyectista || { nombre: "Ingeniero Civil Proyectista", matricula: "COPNIA" };

    const html = `
      <div class="formal-sheet">
        
        <!-- ENCABEZADO INSTITUCIONAL OFICIAL -->
        <div class="sheet-header">
          <div class="gov-official-logo">
            <img src="Inspo/Logo.png" alt="Gobernación de Antioquia" style="height:78px;max-height:85px;width:auto;object-fit:contain" onerror="this.src='assets/Logo.png'">
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

        <!-- TÍTULO DEL INFORME TÉCNICO -->
        <div style="text-align: center; margin-bottom: 22px;">
          <div class="official-seal-stamp ${isFavorable ? 'seal-favorable' : 'seal-subsanacion'}" style="font-size:14px;">
            ${isFavorable 
              ? '&#10003; INFORME TÉCNICO DE RESULTADOS DE REVISIÓN: CONCEPTO FAVORABLE' 
              : '&#9888; INFORME TÉCNICO-DOCUMENTAL DE RESULTADOS DE REVISIÓN Y SUBSANACIÓN'}
          </div>
          <p style="font-size:12.5px;color:var(--text-muted);max-width:780px;margin:0 auto;line-height:1.5;">
            Evaluación técnica integral del proyecto bajo los <b>Criterios Técnicos de Pavimentos con Placa-huella</b>. 
            Este documento consolida los hallazgos de compuertas estructurales, geográficas y documentales con carácter vinculante.
          </p>
        </div>

        <!-- TABLA DE IDENTIFICACIÓN GENERAL DEL EXPEDIENTE -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:18px;margin-bottom:26px">
          <div style="background:var(--color-bg-alt);padding:16px;border-radius:var(--radius-md);border:1px solid var(--border-subtle)">
            <h5 style="font-size:11.5px;font-weight:800;color:var(--color-primary);text-transform:uppercase;margin-bottom:8px">Identificación Territorial del Proyecto</h5>
            <table style="width:100%;font-size:12px;line-height:1.75">
              <tr><td style="color:var(--text-muted);width:35%">Municipio:</td><td><b>${project.municipio}</b> (${project.subregion || 'Antioquia'})</td></tr>
              <tr><td style="color:var(--text-muted)">Vereda / Sector:</td><td>${project.nombreTramo || project.nombreExpediente || 'No especificado'}</td></tr>
              <tr><td style="color:var(--text-muted)">Código Vía Terciaria:</td><td><b class="font-mono">${project.codigoVial || 'En cotejo'}</b></td></tr>
              <tr><td style="color:var(--text-muted)">Alcalde(sa):</td><td>${alcalde.nombre || 'Alcalde Municipal'} (C.C. ${alcalde.cedula || 'S/N'})</td></tr>
              <tr><td style="color:var(--text-muted)">Ing. Proyectista:</td><td>${ing.nombre || 'Ingeniero Proyectista'} (Mat. ${ing.matricula || 'COPNIA'})</td></tr>
            </table>
          </div>

          <div style="background:var(--color-bg-alt);padding:16px;border-radius:var(--radius-md);border:1px solid var(--border-subtle)">
            <h5 style="font-size:11.5px;font-weight:800;color:var(--color-primary);text-transform:uppercase;margin-bottom:8px">Métricas Técnicas Consolidadas</h5>
            <table style="width:100%;font-size:12px;line-height:1.75">
              <tr><td style="color:var(--text-muted);width:45%">Longitud Proyectada:</td><td><b>${project.longitudM || 0} metros lineales</b></td></tr>
              <tr><td style="color:var(--text-muted)">Cuantía Acero Real:</td><td><b>${(auditGlobal && auditGlobal.audit1A && auditGlobal.audit1A.cuantiaRealKgM) || 0} kg/m</b> (Mín. Técnico: 26.25 kg/m)</td></tr>
              <tr><td style="color:var(--text-muted)">Alineación con la Red Vial:</td><td><b>${(auditGlobal && auditGlobal.audit1B && auditGlobal.audit1B.coberturaBufferPct) || 0}%</b> (Tolerancia 10 m)</td></tr>
              <tr><td style="color:var(--text-muted)">Presupuesto Total:</td><td><b>$ ${Number(project.presupuestoTotal || 0).toLocaleString("es-CO")} COP</b></td></tr>
              <tr><td style="color:var(--text-muted)">Aporte Departamento:</td><td>$ ${Number(project.aporteDepto || 0).toLocaleString("es-CO")} COP</td></tr>
            </table>
          </div>
        </div>

        <!-- SECCIÓN 1 (PRIORITARIA): MATRIZ DE DOCUMENTOS Y REQUISITOS FALTANTES / NO ACEPTADOS -->
        <div style="margin-bottom: 28px;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
            <div>
              <h4 style="font-size:14px;font-weight:900;color:var(--status-danger);display:flex;align-items:center;gap:8px;">
                <span>📋</span> Sección 1: Matriz de Requisitos y Documentos Faltantes / No Aceptados (${findings.length})
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
                    <th style="width:28%;">Ítem / Fase / Requisito</th>
                    <th style="width:22%;">Estado Actual</th>
                    <th style="width:45%;">Detalle / Motivo de No Aceptación (Editable por el Revisor)</th>
                    <th style="width:5%;text-align:center;"></th>
                  </tr>
                </thead>
                <tbody>
                  ${findings.map((f) => `
                    <tr>
                      <td>
                        <div style="font-weight:800;color:var(--text-main);font-size:12.5px;">${f.titulo}</div>
                        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
                          <span style="background:rgba(0,0,0,0.05);padding:2px 6px;border-radius:4px;font-family:var(--font-mono);font-size:10px;">${f.fase}</span>
                          ${f.norma ? `<span style="margin-left:4px;">• ${f.norma}</span>` : ''}
                        </div>
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
                        <textarea id="motivo_${f.id}" class="report-textarea" rows="2" placeholder="Escriba el motivo técnico detallado de no aceptación o la acción requerida para subsanar..." oninput="ReportsEngine.updateFindingMotivo('${f.id}', this.value)">${f.motivo || ''}</textarea>
                      </td>
                      <td style="text-align:center;">
                        ${f.isManual ? `
                          <button type="button" class="report-del-btn" onclick="ReportsEngine.removeManualFinding('${f.id}')" title="Eliminar este requisito manual">✕</button>
                        ` : ''}
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <!-- SECCIÓN 2: RESUMEN DE ÍTEMS CONFORMES Y CONCEPTO TÉCNICO EDITABLE -->
        <div style="margin-bottom: 24px;">
          <div style="margin-bottom: 12px;">
            <h4 style="font-size:14px;font-weight:900;color:var(--color-primary);display:flex;align-items:center;gap:8px;">
              <span>✅</span> Sección 2: Requisitos Conformes y Concepto Departamental
            </h4>
          </div>

          <!-- BLOQUE COLAPSABLE DE ÍTEMS CONFORMES -->
          <div class="report-compliant-box">
            <div class="report-compliant-toggle" onclick="ReportsEngine.toggleCompliantList()">
              <span style="font-size:12.5px;font-weight:700;color:var(--text-main);">
                &#10003; Requisitos y Documentos Conformes (${compliantItems.length} de ${compliantItems.length + findings.length})
              </span>
              <span id="reportCompliantIcon" style="font-size:11.5px;font-weight:700;color:var(--color-primary);">
                ${this.compliantCollapsed ? '▶ Ver lista' : '▼ Ocultar'}
              </span>
            </div>
            <div id="reportCompliantGrid" class="report-compliant-grid" style="display:${this.compliantCollapsed ? 'none' : 'grid'};">
              ${compliantItems.map((c) => `
                <div class="report-compliant-pill">
                  <span style="color:#10B981;font-weight:800;">&#10003;</span>
                  <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${c.titulo}">${c.titulo}</span>
                  <span style="margin-left:auto;font-size:10px;opacity:0.6;font-family:var(--font-mono);">${c.fase}</span>
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
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:32px;margin-top:40px;padding-top:28px;border-top:1px solid var(--border-subtle);">
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
  },

  /**
   * Genera el documento HTML completo e independiente del Informe Técnico
   * con las 5 secciones obligatorias y diseño institucional formal limpio
   */
  generatePrintableReportHtml(project, auditGlobal) {
    project = project || App.currentProject || {};
    auditGlobal = auditGlobal || App.auditGlobal || {};

    const projectId = project.id || App.currentProjectId;
    const fase3State = this.getFase3State(projectId);
    const { findings, compliantItems } = this.collectAllFindings(project, auditGlobal);

    // Conteo estricto y real de la Fase 2 (27 requisitos documentales de expedientesMap)
    const recF2 = (window.proyectosAuditados && projectId) ? window.proyectosAuditados[projectId] : null;
    const audit2Data = (recF2 && recF2.fase2) || (auditGlobal && auditGlobal.audit2) || {};
    const items27List = (audit2Data && audit2Data.items) || (window.SIPRO_DATA && SIPRO_DATA.items27) || [];
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

    const alcalde = project.alcalde || { nombre: `Alcalde Municipal de ${project.municipio || 'Municipio'}`, cedula: "S/N" };
    const ing = project.ingenieroProyectista || { nombre: "Ingeniero Civil Proyectista", matricula: "COPNIA" };
    const fechaHoy = new Date().toLocaleDateString("es-CO", { year: 'numeric', month: 'long', day: 'numeric' });

    const audit1A = (auditGlobal && auditGlobal.audit1A) || {};
    const audit1B = (auditGlobal && auditGlobal.audit1B) || {};
    const audit2 = (auditGlobal && auditGlobal.audit2) || {};

    const cuantiaReal = audit1A.cuantiaRealKgM || (project.despieceAcero && project.despieceAcero.cuantiaCalculadaKgM) || 0;
    const pesoAceroTotal = (audit1A.pesoTotalCalculadoKg || (project.despieceAcero && project.despieceAcero.pesoTotalKg) || 0).toLocaleString('es-CO');
    const marcasOk = `${audit1A.marcasCumplen || 0}/${audit1A.totalMarcas || 0}`;

    const geo = project.georreferenciacion || audit1B || {};
    const totalTramos = (geo.tramos || []).length;
    const totalPuntos = (geo.puntos || geo.puntosInspeccion || []).length;
    const coberturaGIS = audit1B.coberturaBufferPct !== undefined ? audit1B.coberturaBufferPct : (geo.coberturaBufferPct || 0);
    const longKml = (geo.longitudKmlM || project.longitudM || 0).toLocaleString('es-CO');

    const conceptoTexto = fase3State.conclusionesConcepto || (
      isFavorable
        ? `Con base en la revisión integral de las compuertas técnicas y documentales bajo los Criterios Técnicos de Pavimentos con Placa-huella, la Dirección de Infraestructura Física y Apoyo Territorial emite CONCEPTO TÉCNICO FAVORABLE para la priorización y viabilidad de suscripción del Convenio Interadministrativo de Cofinanciación con el Municipio de ${project.municipio || 'Municipio'}.`
        : `Con base en la revisión técnico-documental efectuada bajo los Criterios Técnicos Departamentales de Pavimentos con Placa-huella, la Dirección de Infraestructura Física y Apoyo Territorial emite REQUERIMIENTO DE SUBSANACIÓN TÉCNICA. El municipio de ${project.municipio || 'Municipio'} deberá subsanar las observaciones y aportar los requisitos no conformes detallados en el presente informe previo a la emisión del concepto favorable de priorización.`
    );

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Informe Técnico - ${project.codigo || 'EXP-PH'} - ${project.municipio || 'Antioquia'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
      color: #1e293b;
      background: #ffffff;
      line-height: 1.45;
      padding: 32px 42px;
      font-size: 11.5px;
    }
    @media print {
      body { padding: 0; font-size: 10.5px; }
      @page { size: letter portrait; margin: 15mm 12mm 15mm 12mm; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
      tr { page-break-inside: avoid; }
    }
    .header-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2.5px solid #166534;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .header-logo-group {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .logo-img {
      height: 68px;
      width: auto;
      object-fit: contain;
    }
    .gov-name {
      font-size: 15px;
      font-weight: 900;
      color: #166534;
      letter-spacing: 0.5px;
    }
    .gov-dept {
      font-size: 11.5px;
      font-weight: 700;
      color: #334155;
      margin-top: 2px;
    }
    .gov-prog {
      font-size: 10.5px;
      color: #64748b;
      margin-top: 1px;
    }
    .header-badge-group {
      text-align: right;
    }
    .doc-code {
      font-family: monospace;
      font-size: 14px;
      font-weight: 900;
      color: ${isFavorable ? '#15803d' : '#be123c'};
    }
    .status-badge {
      display: inline-block;
      margin-top: 4px;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 10.5px;
      font-weight: 800;
      background: ${isFavorable ? '#dcfce7' : '#ffe4e6'};
      color: ${isFavorable ? '#166534' : '#be123c'};
      border: 1px solid ${isFavorable ? '#bbf7d0' : '#fecdd3'};
    }
    .report-main-title {
      text-align: center;
      margin: 14px 0 16px 0;
      padding: 8px 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
    }
    .report-main-title h1 {
      font-size: 13.5px;
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 11px;
    }
    .meta-table td {
      padding: 5px 8px;
      border: 1px solid #cbd5e1;
    }
    .meta-table .lbl {
      background: #f1f5f9;
      font-weight: 700;
      color: #475569;
      width: 22%;
    }
    .section-title {
      font-size: 12px;
      font-weight: 800;
      color: #166534;
      text-transform: uppercase;
      border-left: 4px solid #166534;
      padding-left: 8px;
      margin: 16px 0 8px 0;
      letter-spacing: 0.3px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .kpi-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 10px;
      text-align: center;
    }
    .kpi-val {
      font-size: 13px;
      font-weight: 900;
      color: #0f172a;
      margin-top: 2px;
    }
    .kpi-lbl {
      font-size: 10px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 700;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 10.5px;
    }
    .data-table th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 800;
      text-align: left;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
    }
    .data-table td {
      padding: 6px 8px;
      border: 1px solid #e2e8f0;
      vertical-align: top;
    }
    .badge-subsanar {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 9.5px;
      font-weight: 800;
      background: #ffe4e6;
      color: #be123c;
      border: 1px solid #fecdd3;
      white-space: nowrap;
    }
    .badge-conforme {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 9.5px;
      font-weight: 800;
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #bbf7d0;
      white-space: nowrap;
    }
    .concept-box {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 12px 14px;
      margin-bottom: 24px;
      font-size: 11px;
      line-height: 1.6;
      color: #0f172a;
    }
    .signatures-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 36px;
      padding-top: 10px;
      page-break-inside: avoid;
    }
    .signature-box {
      text-align: center;
    }
    .signature-line {
      border-bottom: 1px solid #475569;
      height: 40px;
      margin-bottom: 6px;
    }
    .signature-name {
      font-size: 11px;
      font-weight: 800;
      color: #1e293b;
    }
    .signature-role {
      font-size: 10px;
      color: #64748b;
    }
    .toolbar-print {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #19370D;
      color: #fff;
      padding: 10px 16px;
      border-radius: 6px;
      margin-bottom: 20px;
    }
    .btn-print-action {
      background: #BED66F;
      color: #19370D;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: 800;
      cursor: pointer;
      font-size: 12px;
    }
  </style>
</head>
<body>

  <!-- Barra de utilidades visible en pantalla, excluida de la impresión -->
  <div class="toolbar-print no-print">
    <div>
      <strong>Informe Técnico Oficial SIPRO-PH</strong> &bull; Proyecto: ${project.codigo || 'EXP-PH'} (${project.municipio || 'Antioquia'})
    </div>
    <div style="display:flex;gap:10px;">
      <button class="btn-print-action" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
      <button style="background:transparent;border:1px solid #BED66F;color:#BED66F;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;" onclick="window.close()">Cerrar</button>
    </div>
  </div>

  <!-- 1. ENCABEZADO INSTITUCIONAL -->
  <header class="header-bar">
    <div class="header-logo-group">
      <img src="Inspo/Logo.png" alt="Gobernación de Antioquia" class="logo-img" onerror="this.src='assets/Logo.png'">
      <div>
        <div class="gov-name">GOBERNACIÓN DE ANTIOQUIA</div>
        <div class="gov-dept">Secretaría de Infraestructura Física &bull; Dirección de Infraestructura Física y Apoyo Territorial</div>
        <div class="gov-prog">Sistema de Revisión y Priorización Técnico-Documental de Proyectos de Placa Huella (SIPRO-PH)</div>
      </div>
    </div>
    <div class="header-badge-group">
      <div class="doc-code">${project.codigo || 'EXP-PH'}</div>
      <div class="status-badge">
        ${isFavorable ? '✓ CONCEPTO FAVORABLE' : '⚠ REQUIERE SUBSANACIÓN'}
      </div>
      <div style="font-size:10px;color:#64748b;margin-top:3px;">Emisión: <b>${fechaHoy}</b></div>
    </div>
  </header>

  <div class="report-main-title">
    <h1>INFORME TÉCNICO DE REVISIÓN Y SUBSANACIÓN DOCUMENTAL - PROYECTO PLACA HUELLA</h1>
  </div>

  <!-- DATOS GENERALES DEL EXPEDIENTE ACTIVO -->
  <table class="meta-table">
    <tr>
      <td class="lbl">Municipio:</td>
      <td><b>${project.municipio || 'Municipio'}</b> (${project.subregion || 'Antioquia'})</td>
      <td class="lbl">Nombre del Proyecto:</td>
      <td><b>${project.nombreTramo || project.nombreExpediente || 'Proyecto Placa Huella'}</b></td>
    </tr>
    <tr>
      <td class="lbl">Código Vial:</td>
      <td><b style="font-family:monospace;">${project.codigoVial || '05000VT01'}</b></td>
      <td class="lbl">Longitud a Intervenir:</td>
      <td><b>${(project.longitudM || 0).toLocaleString('es-CO')} metros lineales</b></td>
    </tr>
    <tr>
      <td class="lbl">Alcalde(sa) Municipal:</td>
      <td>${alcalde.nombre || 'Alcalde Municipal'} (C.C. ${alcalde.cedula || 'S/N'})</td>
      <td class="lbl">Ing. Proyectista:</td>
      <td>${ing.nombre || 'Ingeniero Proyectista'} (Mat. ${ing.matricula || 'COPNIA'})</td>
    </tr>
    <tr>
      <td class="lbl">Presupuesto Estimado:</td>
      <td>$ ${Number(project.presupuestoTotal || 0).toLocaleString('es-CO')} COP</td>
      <td class="lbl">Aporte Departamento:</td>
      <td>$ ${Number(project.aporteDepto || 0).toLocaleString('es-CO')} COP (Aporte Mpal: $ ${Number(project.aporteMpio || 0).toLocaleString('es-CO')} COP)</td>
    </tr>
  </table>

  <!-- 2. RESUMEN EJECUTIVO DE LA REVISIÓN -->
  <div class="section-title">1. Resumen Ejecutivo de la Evaluación Técnica</div>
  <div class="kpi-grid">
    <div class="kpi-box">
      <div class="kpi-lbl">Dictamen General</div>
      <div class="kpi-val" style="color:${isFavorable ? '#15803d' : '#be123c'}">${isFavorable ? 'FAVORABLE' : 'SUBSANACIÓN'}</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-lbl">Fase 1A - Cuantía Acero</div>
      <div class="kpi-val">${cuantiaReal} kg/m <span style="font-size:10px;color:#64748b">(Mín: 26.25)</span></div>
    </div>
    <div class="kpi-box">
      <div class="kpi-lbl">Fase 1B - Alineación Vial</div>
      <div class="kpi-val">${coberturaGIS}% <span style="font-size:10px;color:#64748b">(Tolerancia 10m)</span></div>
    </div>
    <div class="kpi-box">
      <div class="kpi-lbl">Fase 2 - Documentos</div>
      <div class="kpi-val">${f2Conformes} de 27 conformes</div>
    </div>
  </div>

  <table class="meta-table" style="margin-bottom:18px;">
    <tr>
      <td class="lbl" style="width:25%;">Control Fase 1A (Estructural):</td>
      <td>Cuantía calculada en <b>${cuantiaReal} kg/m</b> | Peso total de acero: <b>${pesoAceroTotal} kg</b> | Marcas de despiece conformes: <b>${marcasOk}</b>.</td>
    </tr>
    <tr>
      <td class="lbl">Control Fase 1B (Espacial):</td>
      <td>Longitud KML evaluada: <b>${longKml} m</b> | Tramos independientes: <b>${totalTramos}</b> | Puntos de referencia extraídos: <b>${totalPuntos}</b> | Coincidencia con red vial: <b>${coberturaGIS}%</b> (Tolerancia 10 m).</td>
    </tr>
    <tr>
      <td class="lbl">Control Fase 2 (Documental):</td>
      <td><b>${f2Conformes}</b> de 27 requisitos aprobados de conformidad &bull; <b>${f2Pendientes}</b> pendientes por subsanar.</td>
    </tr>
  </table>

  <!-- 3. TABLA PRINCIPAL DE OBSERVACIONES Y REQUISITOS POR SUBSANAR -->
  <div class="section-title">2. Tabla Principal de Observaciones y Requisitos por Subsanar (${findings.length})</div>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width:22%;">Compuerta / Requisito</th>
        <th style="width:14%;">Entidad / Fase</th>
        <th style="width:14%;">Estado</th>
        <th style="width:50%;">Observación Técnica / Motivo de Subsanación</th>
      </tr>
    </thead>
    <tbody>
      ${findings.length === 0 ? `
        <tr>
          <td colspan="4" style="text-align:center;padding:14px;color:#15803d;font-weight:700;">
            ✓ No se registran observaciones ni documentos pendientes por subsanar. El expediente cumple satisfactoriamente la totalidad de compuertas técnicas.
          </td>
        </tr>
      ` : findings.map(f => `
        <tr>
          <td><b>${f.titulo}</b></td>
          <td style="color:#64748b;">${f.entidad || f.fase}</td>
          <td><span class="badge-subsanar">${f.estado}</span></td>
          <td>${f.motivo}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- 4. LISTADO DE DOCUMENTOS CONFORMES (VERIFICADOS) -->
  <div class="section-title">3. Listado de Documentos Conformes Verificados (${compliantItems.length})</div>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width:10%;">Ítem / Fase</th>
        <th style="width:40%;">Requisito Conforme</th>
        <th style="width:30%;">Archivo Aportado / Soporte</th>
        <th style="width:20%;">Dictamen</th>
      </tr>
    </thead>
    <tbody>
      ${compliantItems.length === 0 ? `
        <tr>
          <td colspan="4" style="text-align:center;padding:12px;color:#64748b;">
            No se han registrado requisitos conformes en la evaluación actual.
          </td>
        </tr>
      ` : compliantItems.map(c => `
        <tr>
          <td><b style="font-family:monospace;">${c.fase}</b></td>
          <td>${c.titulo}</td>
          <td style="font-size:10px;color:#475569;">${c.archivo || 'Documento soporte verificado'}</td>
          <td><span class="badge-conforme">✓ CONFORME</span></td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- 5. CONCEPTO TÉCNICO Y ESPACIO DE FIRMAS -->
  <div class="section-title">4. Concepto Técnico Departamental</div>
  <div class="concept-box">
    ${conceptoTexto}
  </div>

  <div class="signatures-grid">
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-name">Profesional de Apoyo a la Supervisión</div>
      <div class="signature-role">Revisión Técnico-Documental</div>
      <div class="signature-role">Dirección de Infraestructura Física y Apoyo Territorial</div>
      <div class="signature-role">Secretaría de Infraestructura Física</div>
    </div>
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-name">Supervisor Designado</div>
      <div class="signature-role">Supervisión de Proyectos</div>
      <div class="signature-role">Secretaría de Infraestructura Física</div>
      <div class="signature-role">Gobernación de Antioquia</div>
    </div>
  </div>

</body>
</html>`;
  },

  /**
   * Ejecuta la generación y apertura en ventana dedicada para impresión limpia
   */
  imprimirInformeTecnico() {
    const project = App.currentProject;
    if (!project) {
      alert("Por favor cargue o seleccione un expediente municipal antes de generar el informe técnico.");
      return;
    }

    const htmlContent = this.generatePrintableReportHtml(project, App.auditGlobal);
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
          console.warn("Impresión automática bloqueada por el navegador, use el botón de la barra superior:", e);
        }
      }, 500);
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
      }, 500);
    }
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
    const isFavorable = findings.length === 0;

    // Conteo estricto y real de Fase 2 (27 requisitos documentales de expedientesMap)
    const recF2 = (window.proyectosAuditados && projectId) ? window.proyectosAuditados[projectId] : null;
    const audit2Data = (recF2 && recF2.fase2) || (auditGlobal && auditGlobal.audit2) || {};
    const items27List = (audit2Data && audit2Data.items) || (window.SIPRO_DATA && SIPRO_DATA.items27) || [];
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
          findings, compliantItems, conceptoTexto, isFavorable
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
        findings, compliantItems, conceptoTexto, isFavorable
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
                children: [new Paragraph({ children: [new TextRun({ text: f.titulo || "", bold: true, size: 17, color: "0F172A" })] })]
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
          <td><b style="color:#be123c;">${f.estado || 'Por Subsanar'}</b></td>
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
    this.imprimirInformeTecnico();
  }
};

if (typeof window !== "undefined") {
  window.ReportsEngine = ReportsEngine;
}
