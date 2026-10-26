/**
 * CONTROLADOR MAESTRO DE LA APLICACIÓN (SIPRO-PH)
 * Gobernación de Antioquia - Secretaría de Infraestructura Física - Dirección de Infraestructura Física y Apoyo Territorial
 * Estándar Único: Criterio Técnico Departamental de Pavimentos con Placa Huella
 * 
 * ARQUITECTURA DE AUDITORÍA MULTI-PROYECTO AISLADA:
 * 1. Estructura de Estado Centralizada e Indexada (window.proyectosAuditados[proyectoId])
 *    Cada expediente encapsula: { id, slug, municipio, codMunicipio, subregion, datos, archivos,
 *                                 archivosFileMap, fase1A, concretoVolumes, fase1B, fase2, kpis, auditGlobal, timestamp }
 * 2. Procesamiento Aislado por Carpeta: Métricas pre-calculadas en la ingesta sin colisión global
 * 3. Selector y Renderizado Reactivo: cargarProyecto(proyectoId) repinta la interfaz completa
 *    exclusivamente desde la memoria del proyecto seleccionado en O(1), sin recalcular desde cero.
 * 4. Visor de Documentos Fase 2: Apertura in-app y pestaña completa para los 27 ítems normativos.
 */

window.proyectosAuditados = window.proyectosAuditados || {};

const App = {
  currentProjectId: null,
  currentProject: null,
  currentAuditRecord: null,
  currentTab: "tab-1a",
  currentFilterCluster: "ALL",
  auditGlobal: null,

  init() {
    window.proyectosAuditados = window.proyectosAuditados || {};
    window.expedientesMap = window.proyectosAuditados;

    // Sincronizar catálogo con SIPRO_DATA si existen expedientes
    if (SIPRO_DATA.expedientesMap && Object.keys(SIPRO_DATA.expedientesMap).length > 0) {
      Object.assign(window.proyectosAuditados, SIPRO_DATA.expedientesMap);
    }
    SIPRO_DATA.expedientesMap = window.proyectosAuditados;

    this.populateProjectSelect();
    this.setupEventListeners();
    this.setupResponsiveHandlers();
    
    // Inicializar submódulos
    if (window.FolderReader) FolderReader.init();
    if (window.SpatialEngine) SpatialEngine.init();

    // Carga inicial: Si hay expedientes activos, cargar el primero; si no, presentar estado en blanco listo para subir carpetas
    const auditKeys = Object.keys(window.proyectosAuditados);
    if (auditKeys.length > 0) {
      this.cargarProyecto(auditKeys[0]);
    } else {
      this.renderEmptyState();
    }

    // Inicializar tema guardado
    const savedTheme = localStorage.getItem("sipro_theme") || "light";
    this.setTheme(savedTheme);
  },

  /**
   * Llena el selector de proyectos exclusivamente desde window.proyectosAuditados
   */
  populateProjectSelect() {
    const select = document.getElementById("projectSelect");
    if (!select) return;

    select.innerHTML = "";

    const records = Object.values(window.proyectosAuditados || {});

    if (records.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "-- Sin expedientes cargados (Cargue una carpeta) --";
      select.appendChild(opt);
      this.renderProjectChips();
      return;
    }

    records.forEach((rec, idx) => {
      const p = rec.datos;
      const opt = document.createElement("option");
      opt.value = rec.id;
      const isApp = rec.auditGlobal ? rec.auditGlobal.isApproved : (p.estadoSimulacion === "APROBADO_CONFORME");
      const statusTag = isApp ? " [✓ Conforme]" : " [En Auditoría]";
      const lenTag = p.longitudM ? ` [${p.longitudM} m]` : "";
      opt.textContent = `${idx + 1}. 📍 ${rec.municipio} (${rec.subregion || 'Antioquia'}) - ${p.nombreExpediente || p.codigo}${lenTag}${statusTag}`;
      select.appendChild(opt);
    });

    if (this.currentProjectId && window.proyectosAuditados[this.currentProjectId]) {
      select.value = this.currentProjectId;
    } else if (records.length > 0) {
      select.value = records[0].id;
    }

    this.renderProjectChips();
  },

  /**
   * Renderiza la barra de chips/pestañas de expedientes cargados con acceso y eliminación directa en un solo clic
   */
  renderProjectChips() {
    const container = document.getElementById("projectChipsContainer");
    if (!container) return;

    const records = Object.values(window.proyectosAuditados || {});
    if (records.length === 0) {
      container.style.display = "none";
      container.innerHTML = "";
      return;
    }

    container.style.display = "flex";
    let html = records.map((rec) => {
      const isCurrent = (rec.id === this.currentProjectId);
      const p = rec.datos || {};
      const isApp = rec.auditGlobal ? rec.auditGlobal.isApproved : (p.estadoSimulacion === "APROBADO_CONFORME");
      const dotClass = isApp ? "conforme" : "eval";
      const dotTitle = isApp ? "Conforme (Aprobado)" : "En Auditoría / Por Subsanar";
      const name = p.nombreExpediente || p.codigo || rec.id;
      const mpio = rec.municipio || "Municipio";

      return `
        <div class="project-chip ${isCurrent ? 'active' : ''}" onclick="App.cargarProyecto('${rec.id}')" title="Clic para alternar al expediente de ${mpio}">
          <span class="chip-status-dot ${dotClass}" title="${dotTitle}"></span>
          <span>📍 <strong>${mpio}</strong> <span style="opacity:0.85;font-weight:normal;font-size:11px;">(${name})</span></span>
          <button type="button" class="chip-close-btn" title="Quitar este expediente" onclick="event.stopPropagation(); App.deleteExpedienteById('${rec.id}', event)">&times;</button>
        </div>
      `;
    }).join("");

    if (records.length >= 2) {
      html += `
        <button type="button" class="btn-chips-clear" onclick="App.deleteAllExpedientes()" title="Retirar todos los expedientes cargados de la sesión">
          🗑️ Limpiar todos
        </button>
      `;
    }

    container.innerHTML = html;
  },

  /**
   * CARGA Y RENDERIZADO REACTIVO DE UN PROYECTO AUDITADO (REQUISITO 3)
   * Repinta toda la interfaz exclusivamente con los datos y métricas pre-calculadas en memoria
   * Sin recalcular desde cero si ya fue procesado.
   */
  cargarProyecto(proyectoId) {
    if (!proyectoId) {
      this.renderEmptyState();
      return;
    }

    window.proyectosAuditados = window.proyectosAuditados || {};
    let record = window.proyectosAuditados[proyectoId];

    // Búsqueda flexible por ID, slug o ID de datos
    if (!record) {
      const found = Object.values(window.proyectosAuditados).find(
        r => r.id === proyectoId || r.slug === proyectoId || (r.datos && r.datos.id === proyectoId)
      );
      if (found) record = found;
    }

    if (!record) {
      this.renderEmptyState();
      return;
    }

    // 1. Establecer proyecto activo en el controlador
    this.currentProjectId = record.id;
    this.currentProject = record.datos;
    this.currentAuditRecord = record;
    this.auditGlobal = record.auditGlobal;

    // 2. Limpieza y aislamiento estricto de cualquier alerta de comprimido previa en el DOM
    const alertaEl = document.getElementById("spatialAlertContainer");
    if (alertaEl) {
      alertaEl.style.display = 'none';
      alertaEl.innerHTML = '';
    }

    // Verificar únicamente expedientesMap[proyectoId].fase1B del proyecto activo
    const expedientesMap = (window.SIPRO_DATA && SIPRO_DATA.expedientesMap) || window.proyectosAuditados || {};
    const expItem = expedientesMap[record.id] || record;
    const fase1BData = expItem.fase1B || (record.datos && record.datos.georreferenciacion);

    if (fase1BData) {
      const tieneGeoValida = fase1BData.tieneGeorreferenciacionValida === true ||
        (fase1BData.tramos && fase1BData.tramos.length > 0) ||
        (record.datos && record.datos.georreferenciacion && record.datos.georreferenciacion.tramos && record.datos.georreferenciacion.tramos.length > 0);

      if (!tieneGeoValida && fase1BData.alertaComprimido) {
        if (alertaEl) {
          alertaEl.style.display = 'flex';
          alertaEl.innerHTML = `
            <div style="display:flex;align-items:flex-start;gap:10px;width:100%;">
              <span style="font-size:18px;line-height:1;">⚠️</span>
              <div>
                <div style="font-weight:700;margin-bottom:2px;">Alerta de Descompresión en Expediente: ${record.municipio || ''}</div>
                <div>${fase1BData.alertaComprimido}</div>
              </div>
            </div>
          `;
        }
      }
    }

    // 3. Sincronizar dropdown selector y barra de chips
    const select = document.getElementById("projectSelect");
    if (select && select.value !== record.id) {
      select.value = record.id;
    }
    this.renderProjectChips();

    // 4. RENDERIZADO REACTIVO DESDE MEMORIA (O(1), sin recálculos)
    // A. Rótulos, municipio y banners
    this.renderBanners(record);

    // B. Semáforos generales y pipeline secuencial
    this.renderPipelineBanner(record.auditGlobal);

    // C. Tarjetas KPI
    this.renderKPIs(record.kpis, record.datos);

    // D. Barra lateral de parámetros (acero, volúmenes de concreto y cemento)
    this.renderStructuralSidebar(record.datos, record.fase1A, record.concretoVolumes);

    // E. Fase 1A (Refactorizada en 3 Bloques Fieles):
    // Bloque 1: Resumen de Datos Generales y Geometría Declarada
    StructuralEngine.renderGeometricSummaryCard("geometricSummaryContainer", record.datos);
    // Bloque 2: Información de Despiece Consignada en el Documento (Ítem 3)
    StructuralEngine.renderDespieceFiel("despieceExtraidoContainer", record.datos);
    // Bloque 3: Memoria de Volúmenes de Concreto y Cemento (Full Width)
    StructuralEngine.renderConcreteTable(record.concretoVolumes, document.getElementById("concreteVolumesContainer"), record.fase1A, record.datos ? record.datos.despieceExtraido : null);

    // F. Fase 1B: Mapa, trazados y tabla de contraste espacial (Modo Municipio activo por defecto)
    SpatialEngine.filterByActiveMunicipio = true;
    SpatialEngine.syncToggleButtonsUI();
    SpatialEngine.initOrUpdateMap("leafletMapContainer", record.datos);
    this.updateSpatialSidebar();
    SpatialEngine.zoomToProjectTracks(record.datos);

    // G. Fase 2: Lista de 27 ítems y estados documentales (con botones de Abrir Documento)
    DocumentalEngine.renderDocumentalMatrix(record.fase2, document.getElementById("documentalMatrixContainer"), this.currentFilterCluster || "ALL");

    // H. Fase 3: Ficha oficial o reporte de subsanación
    ReportsEngine.renderOfficialReport(record.datos, record.auditGlobal, document.getElementById("officialReportContainer"));
  },

  /**
   * Alias de compatibilidad hacia cargarProyecto
   */
  loadProject(projectId) {
    return this.cargarProyecto(projectId);
  },

  /**
   * Renderiza los banners y rótulos del expediente activo
   */
  renderBanners(record) {
    const project = record.datos;
    const bannerMpio = document.getElementById("expBannerMpio");
    if (bannerMpio) bannerMpio.innerText = `MUNICIPIO: ${project.municipio}`;

    const bannerSubreg = document.getElementById("expBannerSubreg");
    if (bannerSubreg) bannerSubreg.innerText = `SUBREGIÓN: ${project.subregion}`;

    const bannerCode = document.getElementById("expBannerCode");
    if (bannerCode) bannerCode.innerText = project.codigo;

    const bannerCount = document.getElementById("expBannerFilesCount");
    if (bannerCount) {
      const fileCount = project.totalArchivosCargados || (record.archivos ? record.archivos.length : 0);
      bannerCount.innerText = `${fileCount} Archivos Detectados`;
    }

    const bannerName = document.getElementById("expBannerName");
    if (bannerName) bannerName.innerText = project.nombreExpediente || project.nombreTramo;

    const bannerFicha = document.getElementById("expBannerFichaDoc");
    if (bannerFicha) {
      const fName = (project.fichaPriorizacion && project.fichaPriorizacion.fileName) 
        ? project.fichaPriorizacion.fileName 
        : "Ficha leída ✓";
      bannerFicha.innerText = `📄 Ficha de Priorización: ${fName} (Leída ✓)`;
    }

    const bannerTramo = document.getElementById("expBannerTramoInfo");
    if (bannerTramo) bannerTramo.innerText = `• Longitud: ${project.longitudM} m | ${project.vereda}`;
  },

  /**
   * Renderiza el banner del pipeline de compuertas secuenciales
   */
  renderPipelineBanner(g) {
    if (!g) return;

    const bannerStatusPill = document.getElementById("gatekeeperStatusPill");
    if (bannerStatusPill) {
      if (g.isApproved) {
        bannerStatusPill.className = "gatekeeper-status-pill status-approved";
        bannerStatusPill.innerHTML = `&#10003; 100% CONFORME - VIABLE PARA CONVENIO`;
      } else {
        bannerStatusPill.className = "gatekeeper-status-pill status-rejected";
        const gateName = g.activeGatekeeper === "1A" ? "FASE 1A (CONTROL ESTRUCTURAL DE ACERO)" 
                       : (g.activeGatekeeper === "1B" ? "FASE 1B (CONTRASTE ESPACIAL Y ALINEACIÓN VIAL)" 
                       : "FASE 2 (DOCUMENTAL)");
        bannerStatusPill.innerHTML = `&#9888; DETENIDO EN COMPUERTA: ${gateName}`;
      }
    }

    const step1A = document.getElementById("stepGate1A");
    const step1B = document.getElementById("stepGate1B");
    const step2 = document.getElementById("stepGate2");
    const step3 = document.getElementById("stepGate3");

    [step1A, step1B, step2, step3].forEach(s => {
      if (s) s.className = "gate-step";
    });

    if (g.audit1A && g.audit1A.aprobado) {
      if (step1A) step1A.classList.add("gate-passed");
    } else if (step1A) {
      step1A.classList.add("gate-failed", "gate-active");
    }

    if (g.audit1A && g.audit1A.aprobado) {
      if (g.audit1B && g.audit1B.aprobado) {
        if (step1B) step1B.classList.add("gate-passed");
      } else if (step1B) {
        step1B.classList.add("gate-failed", "gate-active");
      }
    }

    if (g.audit1A && g.audit1A.aprobado && g.audit1B && g.audit1B.aprobado) {
      if (g.audit2 && g.audit2.aprobado) {
        if (step2) step2.classList.add("gate-passed");
      } else if (step2) {
        step2.classList.add("gate-failed", "gate-active");
      }
    }

    if (g.isApproved && step3) {
      step3.classList.add("gate-passed", "gate-active");
    }
  },

  /**
   * Renderiza las tarjetas KPI de la parte superior
   */
  renderKPIs(kpis, p) {
    if (!kpis || !p) return;

    const score = kpis.scoreConformidad || 0;
    const valRadial = document.getElementById("kpiConformidadVal");
    const gaugeFill = document.getElementById("kpiGaugeCircle");
    if (valRadial) valRadial.innerText = `${score}%`;
    if (gaugeFill) {
      const offset = 219.9 * (1 - score / 100);
      gaugeFill.style.strokeDashoffset = offset;
      gaugeFill.style.stroke = score >= 90 ? "var(--color-accent)" : (score >= 70 ? "var(--status-warning)" : "var(--status-danger)");
    }

    const kpiTotal = document.getElementById("kpiTotalEvaluado");
    if (kpiTotal) kpiTotal.innerText = `${p.longitudM} m`;
    const kpiTotalSub = document.getElementById("kpiTotalEvaluadoSub");
    if (kpiTotalSub) kpiTotalSub.innerText = `${kpis.totalMarcas || 0} marcas de acero | 27 ítems`;

    const kpiCrit = document.getElementById("kpiCriticas");
    if (kpiCrit) kpiCrit.innerText = kpis.totalCriticas || 0;

    const kpiCuantia = document.getElementById("kpiCuantiaVal");
    if (kpiCuantia) kpiCuantia.innerText = `${kpis.cuantiaKgM} kg/m`;
    const kpiCuantiaSub = document.getElementById("kpiCuantiaSub");
    if (kpiCuantiaSub) {
      const diff = kpis.cuantiaSuperavitKgM;
      if (diff >= 0) {
        kpiCuantiaSub.innerHTML = `<span class="kpi-tag-good">&#9650; +${diff} kg/m vs Referencia Técnica (26.25)</span>`;
      } else {
        kpiCuantiaSub.innerHTML = `<span class="kpi-tag-bad">&#9660; ${diff} kg/m DÉFICIT ESTRUCTURAL</span>`;
      }
    }

    const kpiCob = document.getElementById("kpiCoberturaVal");
    if (kpiCob) kpiCob.innerText = `${kpis.coberturaBufferPct}%`;
    const kpiCobSub = document.getElementById("kpiCoberturaSub");
    if (kpiCobSub) {
      kpiCobSub.innerHTML = kpis.coberturaConforme 
        ? `<span class="kpi-tag-good">&#10003; Alineado con red vial (10 m)</span>`
        : `<span class="kpi-tag-bad">&#10007; Desviación fuera de vía</span>`;
    }

    const kpiDoc = document.getElementById("kpiDocVal");
    if (kpiDoc) kpiDoc.innerText = `${kpis.itemsConformes} / 27`;
    const kpiDocSub = document.getElementById("kpiDocSub");
    if (kpiDocSub) {
      kpiDocSub.innerHTML = (kpis.itemsNoConformes === 0)
        ? `<span class="kpi-tag-good">&#10003; 100% Conforme y Vigente</span>`
        : `<span class="kpi-tag-bad">&#9888; ${kpis.itemsNoConformes} ítems por subsanar</span>`;
    }
  },

  /**
   * Renderiza los parámetros estructurales de la barra lateral (Acero, Concreto y Cemento)
   */
  renderStructuralSidebar(p, fase1A, cv) {
    p = p || {};
    const d = p.despieceAcero || { pesoTotalDeclaradoKg: 0 };
    cv = cv || p.concretoVolumes || (fase1A && fase1A.concretoVolumes) || {
      longitudM: p.longitudM || 0,
      huellasM3: 0,
      ciclopeoM3: 0,
      cunetasM3: 0,
      riostrasM3: 0,
      totalConcreto21M3: 0,
      totalConcretoCiclopeoM3: 0,
      totalConcretoGlobalM3: 0,
      sacosCemento: 0
    };
    const ing = p.ingenieroProyectista || { nombre: "Sin registrar", matricula: "Sin matrícula" };

    const spanProy = document.getElementById("paramProjectName");
    if (spanProy) spanProy.innerText = `${p.municipio || "Municipio"} (${p.subregion || "Antioquia"})`;

    const spanTramo = document.getElementById("paramTramoName");
    if (spanTramo) spanTramo.innerText = p.nombreExpediente || p.nombreTramo || "Tramo no especificado";

    const spanIng = document.getElementById("paramIngenieroName");
    if (spanIng) spanIng.innerText = `${ing.nombre} (${ing.matricula})`;

    const pesoDeclarado = (fase1A && fase1A.pesoTotalDeclaradoKg !== undefined) ? fase1A.pesoTotalDeclaradoKg : (d.pesoTotalDeclaradoKg || 0);
    const spanWeight = document.getElementById("statWeightTotal");
    if (spanWeight) spanWeight.innerText = `${pesoDeclarado.toLocaleString("es-CO")} kg`;

    const spanCuantia = document.getElementById("statCuantiaPill");
    if (spanCuantia && fase1A) {
      const cuantiaVal = fase1A.cuantiaRealKgM || 0;
      if (pesoDeclarado === 0) {
        spanCuantia.className = "status-pill";
        spanCuantia.innerText = "- (Sin acero reportado)";
      } else {
        const isOk = cuantiaVal >= 26.25;
        spanCuantia.className = `status-pill ${isOk ? 'cumple' : 'no-cumple'}`;
        spanCuantia.innerText = `${cuantiaVal} kg/m (Mínimo Requerido: 26.25)`;
      }
    } else if (spanCuantia) {
      spanCuantia.className = "status-pill";
      spanCuantia.innerText = "26.25 kg/m (Estándar de Referencia)";
    }

    const spanLong = document.getElementById("statSidebarLongitud");
    const longVal = (fase1A && fase1A.longitudIntervencionM !== undefined) ? fase1A.longitudIntervencionM : (p.longitudM || cv.longitudM || 0);
    if (spanLong) spanLong.innerText = longVal > 0 ? `${longVal.toLocaleString("es-CO")} m` : "-";

    const spanConc21 = document.getElementById("statSidebarConc21");
    if (spanConc21) spanConc21.innerText = `${(cv.totalConcreto21M3 || 0).toLocaleString("es-CO", {minimumFractionDigits: 1})} m³`;

    const spanConcCicl = document.getElementById("statSidebarConcCicl");
    if (spanConcCicl) spanConcCicl.innerText = `${(cv.totalConcretoCiclopeoM3 || 0).toLocaleString("es-CO", {minimumFractionDigits: 1})} m³`;

    const spanSacos = document.getElementById("statSidebarSacos");
    if (spanSacos) spanSacos.innerText = `${(cv.sacosCemento || 0).toLocaleString("es-CO")} sacos`;

    const spanConcTot = document.getElementById("statConcreteTotal");
    if (spanConcTot) spanConcTot.innerText = `${(cv.totalConcretoGlobalM3 || 0).toLocaleString("es-CO", {minimumFractionDigits: 2})} m³`;

    const spanCemTot = document.getElementById("statCementTotal");
    if (spanCemTot) spanCemTot.innerText = `${(cv.sacosCemento || 0).toLocaleString("es-CO")} sacos`;
  },

  updateSpatialSidebar() {
    // Las actualizaciones espaciales se renderizan directamente en SpatialEngine.initOrUpdateMap
  },

  /**
   * Renderiza el estado inicial cuando no hay expedientes activos
   * Muestra la estructura de la placa huella y los 27 ítems normativos para cotejo
   */
  renderEmptyState() {
    this.currentProjectId = null;
    this.currentProject = null;
    this.currentAuditRecord = null;
    this.auditGlobal = null;

    const bannerMpio = document.getElementById("expBannerMpio");
    if (bannerMpio) bannerMpio.innerText = "MUNICIPIO: PENDIENTE DE CARGA";

    const bannerSubreg = document.getElementById("expBannerSubreg");
    if (bannerSubreg) bannerSubreg.innerText = "SUBREGIÓN: ANTIOQUIA";

    const bannerCode = document.getElementById("expBannerCode");
    if (bannerCode) bannerCode.innerText = "EXP-PH";

    const bannerCount = document.getElementById("expBannerFilesCount");
    if (bannerCount) bannerCount.innerText = "0 Archivos";

    const bannerName = document.getElementById("expBannerName");
    if (bannerName) bannerName.innerText = "Expedientes Municipales en Evaluación";

    const bannerFicha = document.getElementById("expBannerFichaDoc");
    if (bannerFicha) bannerFicha.innerText = "📄 Ninguna ficha cargada";

    const bannerTramo = document.getElementById("expBannerTramoInfo");
    if (bannerTramo) bannerTramo.innerText = "• Cargue una carpeta municipal para iniciar la auditoría técnica y documental.";

    const bannerStatusPill = document.getElementById("gatekeeperStatusPill");
    if (bannerStatusPill) {
      bannerStatusPill.className = "gatekeeper-status-pill";
      bannerStatusPill.style.background = "var(--color-bg-alt)";
      bannerStatusPill.style.color = "var(--text-muted)";
      bannerStatusPill.innerHTML = "⏳ ESPERANDO CARGA DE EXPEDIENTE MUNICIPAL";
    }

    // Limpiar KPIs
    const kpiVal = document.getElementById("kpiConformidadVal");
    if (kpiVal) kpiVal.innerText = "0%";
    const gaugeFill = document.getElementById("kpiGaugeCircle");
    if (gaugeFill) gaugeFill.style.strokeDashoffset = 219.9;
    const kpiTotal = document.getElementById("kpiTotalEvaluado");
    if (kpiTotal) kpiTotal.innerText = "0 m";
    const kpiTotalSub = document.getElementById("kpiTotalEvaluadoSub");
    if (kpiTotalSub) kpiTotalSub.innerText = "0 marcas | 27 ítems";
    const kpiCrit = document.getElementById("kpiCriticas");
    if (kpiCrit) kpiCrit.innerText = "0";
    const kpiCuantia = document.getElementById("kpiCuantiaVal");
    if (kpiCuantia) kpiCuantia.innerText = "0.0 kg/m";
    const kpiCob = document.getElementById("kpiCoberturaVal");
    if (kpiCob) kpiCob.innerText = "0%";
    const kpiDoc = document.getElementById("kpiDocVal");
    if (kpiDoc) kpiDoc.innerText = "0 / 27";

    // Sidebar de parámetros inicial: todo en blanco esperando carpeta
    this.renderStructuralSidebar({
      municipio: "Esperando Carpeta",
      subregion: "Antioquia",
      nombreExpediente: "Cargue un expediente municipal",
      longitudM: 0
    }, null, {
      longitudM: 0,
      huellasM3: 0,
      ciclopeoM3: 0,
      cunetasM3: 0,
      riostrasM3: 0,
      totalConcreto21M3: 0,
      totalConcretoCiclopeoM3: 0,
      totalConcretoGlobalM3: 0,
      sacosCemento: 0
    });

    const spanProy = document.getElementById("paramProjectName");
    if (spanProy) spanProy.innerText = "Esperando carga de carpeta...";
    const spanTramo = document.getElementById("paramTramoName");
    if (spanTramo) spanTramo.innerText = "Ningún tramo cargado";
    const spanIng = document.getElementById("paramIngenieroName");
    if (spanIng) spanIng.innerText = "Esperando carga de carpeta...";

    // 1. Fase 1A: Resumen descriptivo de geometría y elementos (estado en blanco)
    StructuralEngine.renderGeometricSummaryCard("geometricSummaryContainer", null);

    // 2. Fase 1A: Información de despiece consignada en blanco
    StructuralEngine.renderDespieceFiel("despieceExtraidoContainer", null);

    // 3. Fase 1A: Memoria de cálculo de volúmenes de concreto y sacos en blanco
    StructuralEngine.renderConcreteTable(null, document.getElementById("concreteVolumesContainer"));

    // 4. Fase 1B: Mapa satelital centrado en Antioquia sin líneas artificiales
    SpatialEngine.initOrUpdateMap("leafletMapContainer", { municipio: "ANTIOQUIA", longitudM: 0, georreferenciacion: { puntosContraste: [] } });

    // 5. Fase 2: RENDERIZAR LA LISTA DE LOS 27 ÍTEMS NORMATIVOS EN ESTADO PENDIENTE
    const initialItems = SIPRO_DATA.items27.map(item => ({
      ...item,
      conforme: false,
      faltante: true,
      vencido: false,
      observacion: "Documento pendiente de cotejo. Cargue la carpeta municipal para cotejar y abrir el archivo.",
      diasRestantes: null,
      archivoDetectado: null,
      meta: null
    }));

    const emptyAudit2 = {
      fase: "2_DOCUMENTAL",
      aprobado: false,
      totalItems: 27,
      itemsConformes: 0,
      itemsNoConformes: 27,
      porcentajeConformidad: 0,
      items: initialItems,
      hallazgosCriticos: [],
      alertas: []
    };
    DocumentalEngine.renderDocumentalMatrix(emptyAudit2, document.getElementById("documentalMatrixContainer"), this.currentFilterCluster || "ALL");

    // 6. Fase 3: Dictamen de espera
    const repContainer = document.getElementById("officialReportContainer");
    if (repContainer) {
      repContainer.innerHTML = `
        <div style="text-align:center;padding:48px;color:var(--text-muted);">
          <div style="font-size:16px;font-weight:700;color:var(--text-main);margin-bottom:6px;">Dictamen Oficial de Viabilidad Técnica</div>
          <div style="font-size:13px;max-width:540px;margin:0 auto 16px;">El dictamen técnico favorable y la ficha de priorización se emitirán automáticamente cuando cargue la carpeta del municipio y se superen las compuertas 1A, 1B y 2.</div>
          <div style="display:flex;gap:12px;justify-content:center;">
            <button class="btn-primary" style="background:#0284C7;padding:8px 18px;" onclick="document.getElementById('folderInput').click()">
              📁 Cargar Carpeta Municipio
            </button>
          </div>
        </div>
      `;
    }
  },

  populateMunicipiosSelect() {
    const sel = document.getElementById("expModalSelectMpio");
    const mList = SIPRO_DATA.municipiosAntioquia || SIPRO_DATA.municipios || [];
    if (!sel || mList.length === 0) return;
    sel.innerHTML = "";

    const subregs = {};
    mList.forEach(m => {
      if (!m || !m.nombre) return;
      const s = m.subregion || "ANTIOQUIA";
      if (!subregs[s]) subregs[s] = [];
      subregs[s].push(m);
    });

    Object.keys(subregs).sort().forEach(sub => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = `SUBREGIÓN ${sub}`;
      subregs[sub].sort((a,b) => (a.nombre || '').localeCompare(b.nombre || '')).forEach(m => {
        const opt = document.createElement("option");
        opt.value = m.nombre;
        opt.textContent = `${m.nombre} (Cód. ${m.codigo || ''})`;
        opt.setAttribute("data-codigo", m.codigo || '');
        opt.setAttribute("data-subregion", m.subregion || '');
        optgroup.appendChild(opt);
      });
      sel.appendChild(optgroup);
    });
  },

  openExpedienteModal() {
    this.populateMunicipiosSelect();
    const modal = document.getElementById("expedienteModal");
    if (!modal) return;

    const p = this.currentProject || {
      nombreExpediente: "Nuevo Expediente Municipal",
      municipio: "MEDELLÍN",
      codMunicipio: "05001",
      subregion: "VALLE DE ABURRÁ",
      vereda: "Tramos a intervenir",
      codigo: "EXP-05001-PH"
    };

    const inputName = document.getElementById("expModalInputName");
    const selMpio = document.getElementById("expModalSelectMpio");
    const inputCode = document.getElementById("expModalInputCode");
    const inputSubreg = document.getElementById("expModalInputSubreg");
    const inputTramo = document.getElementById("expModalInputTramo");
    const fichaStatus = document.getElementById("expModalFichaStatus");
    const btnDelete = document.getElementById("btnExpModalDelete");

    if (inputName) inputName.value = p.nombreExpediente || `${p.municipio} - Proyecto Placa Huella`;
    if (selMpio) {
      selMpio.value = p.municipio;
      if (!selMpio.value && selMpio.options.length > 0) selMpio.selectedIndex = 0;
    }
    if (inputCode) inputCode.value = p.codigo || `EXP-${p.codMunicipio || '05000'}-PH`;
    if (inputSubreg) inputSubreg.value = p.subregion || "ANTIOQUIA";
    if (inputTramo) inputTramo.value = p.vereda || "Tramos según expediente";

    if (fichaStatus) {
      if (p.fichaPriorizacion && p.fichaPriorizacion.fileName) {
        fichaStatus.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span style="font-weight:700;color:#047857">Ficha de Priorización vinculada:</span>
          <span style="font-family:monospace">${p.fichaPriorizacion.fileName}</span>
        `;
      } else {
        fichaStatus.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <span style="color:#B45309">Ficha no nombrada explícitamente en carpeta. Asignada a este municipio.</span>
        `;
      }
    }

    if (btnDelete) {
      const keys = Object.keys(window.proyectosAuditados);
      btnDelete.style.display = keys.length > 1 ? "block" : "none";
    }

    modal.classList.add("active");
  },

  closeExpedienteModal() {
    const modal = document.getElementById("expedienteModal");
    if (!modal) return;
    modal.classList.remove("active");
  },

  onExpModalMpioChange() {
    const sel = document.getElementById("expModalSelectMpio");
    if (!sel) return;
    const opt = sel.options[sel.selectedIndex];
    if (opt) {
      const code = opt.getAttribute("data-codigo");
      const subreg = opt.getAttribute("data-subregion");
      const subInput = document.getElementById("expModalInputSubreg");
      const codeInput = document.getElementById("expModalInputCode");
      const nameInput = document.getElementById("expModalInputName");

      if (subInput) subInput.value = subreg || "ANTIOQUIA";
      if (codeInput && code) codeInput.value = `EXP-${code}-PH`;
      if (nameInput && (!nameInput.value || nameInput.value.includes("Proyecto Placa Huella"))) {
        nameInput.value = `${opt.value} - Proyecto Placa Huella 2024`;
      }
    }
  },

  saveExpedienteModal() {
    const p = this.currentProject;
    if (!p) return;

    const inputName = document.getElementById("expModalInputName");
    const selMpio = document.getElementById("expModalSelectMpio");
    const inputCode = document.getElementById("expModalInputCode");
    const inputSubreg = document.getElementById("expModalInputSubreg");
    const inputTramo = document.getElementById("expModalInputTramo");

    if (inputName && inputName.value.trim()) p.nombreExpediente = inputName.value.trim();
    if (selMpio && selMpio.value) {
      p.municipio = selMpio.value;
      const opt = selMpio.options[selMpio.selectedIndex];
      if (opt) {
        p.codMunicipio = opt.getAttribute("data-codigo") || p.codMunicipio;
        p.subregion = opt.getAttribute("data-subregion") || p.subregion;
      }
    }
    if (inputCode && inputCode.value.trim()) p.codigo = inputCode.value.trim();
    if (inputSubreg && inputSubreg.value.trim()) p.subregion = inputSubreg.value.trim();
    if (inputTramo && inputTramo.value.trim()) p.vereda = inputTramo.value.trim();

    // Actualizar registro en window.proyectosAuditados
    if (this.currentProjectId && window.proyectosAuditados[this.currentProjectId]) {
      const rec = window.proyectosAuditados[this.currentProjectId];
      rec.municipio = p.municipio;
      rec.codMunicipio = p.codMunicipio;
      rec.subregion = p.subregion;
      rec.datos = p;
    }

    // Sincronizar catálogo global
    SIPRO_DATA.expedientesMap = window.proyectosAuditados;
    SIPRO_DATA.proyectos = Object.values(window.proyectosAuditados).map(r => r.datos);

    this.closeExpedienteModal();
    this.populateProjectSelect();
    this.cargarProyecto(p.id);

    if (window.FolderReader) {
      FolderReader.showToast(`✓ Expediente guardado: ${p.municipio} (${p.subregion}) - ${p.nombreExpediente}`);
    }
  },

  deleteCurrentExpediente() {
    const delId = this.currentProjectId || (this.currentProject && this.currentProject.id);
    if (!delId) {
      alert("No hay ningún expediente activo seleccionado para retirar.");
      return;
    }
    this.closeExpedienteModal();
    this.deleteExpedienteById(delId);
  },

  /**
   * Elimina un proyecto específico por su ID (usado desde los chips rápidos o botones directos)
   */
  deleteExpedienteById(proyectoId, event) {
    if (event) event.stopPropagation();
    if (!proyectoId || !window.proyectosAuditados || !window.proyectosAuditados[proyectoId]) return;

    const rec = window.proyectosAuditados[proyectoId];
    const mpio = rec.municipio || (rec.datos && rec.datos.municipio) || "este proyecto";

    if (!confirm(`¿Confirma que desea retirar el expediente de ${mpio}?`)) return;

    delete window.proyectosAuditados[proyectoId];
    if (window.SIPRO_DATA) {
      if (SIPRO_DATA.expedientesMap) delete SIPRO_DATA.expedientesMap[proyectoId];
      SIPRO_DATA.proyectos = Object.values(window.proyectosAuditados).map(r => r.datos);
    }

    this.closeExpedienteModal();
    this.populateProjectSelect();
    this.renderProjectChips();

    const remainingKeys = Object.keys(window.proyectosAuditados);
    if (remainingKeys.length === 0) {
      this.renderEmptyState();
      if (window.FolderReader) FolderReader.showToast("✓ Sesión limpia: sin expedientes.");
    } else if (this.currentProjectId === proyectoId) {
      this.cargarProyecto(remainingKeys[0]);
      if (window.FolderReader) FolderReader.showToast(`✓ Expediente de ${mpio} retirado.`);
    } else {
      if (window.FolderReader) FolderReader.showToast(`✓ Expediente de ${mpio} retirado.`);
    }
  },

  /**
   * Retira todos los proyectos de la sesión
   */
  deleteAllExpedientes() {
    const total = Object.keys(window.proyectosAuditados || {}).length;
    if (total === 0) return;

    if (!confirm(`¿Confirma que desea retirar la totalidad de los ${total} expedientes cargados?`)) return;

    window.proyectosAuditados = {};
    if (window.SIPRO_DATA) {
      SIPRO_DATA.expedientesMap = {};
      SIPRO_DATA.proyectos = [];
    }

    this.closeExpedienteModal();
    this.populateProjectSelect();
    this.renderProjectChips();
    this.renderEmptyState();

    if (window.FolderReader) {
      FolderReader.showToast("✓ Todos los expedientes han sido retirados de la sesión.");
    }
  },

  setupEventListeners() {
    // 1. Selector reactivo de proyecto / expediente activo
    const select = document.getElementById("projectSelect");
    if (select) {
      select.addEventListener("change", (e) => {
        if (e.target.value) {
          this.cargarProyecto(e.target.value);
        }
      });
    }

    // 2. Botones para nombrar / editar expediente
    const btnEditHeader = document.getElementById("btnEditExpediente");
    if (btnEditHeader) {
      btnEditHeader.addEventListener("click", () => this.openExpedienteModal());
    }

    const btnEditBanner = document.getElementById("btnBannerEditExpediente");
    if (btnEditBanner) {
      btnEditBanner.addEventListener("click", () => this.openExpedienteModal());
    }

    // 3. Botones de navegación en la barra lateral izquierda (Sidebar Rail)
    const sidebarNavLinks = document.querySelectorAll(".sidebar-rail .nav-link");
    sidebarNavLinks.forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const tabTarget = link.getAttribute("data-tab");
        if (tabTarget) {
          this.switchTab(tabTarget);
        }
      });
    });

    // 4. Botones de pestañas superiores
    const tabButtons = document.querySelectorAll(".tab-btn");
    tabButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const tabTarget = btn.getAttribute("data-tab");
        if (tabTarget) {
          this.switchTab(tabTarget);
        }
      });
    });

    // 5. Filtros de la Fase 2 (ALL, CONFORMES, SUBSANAR)
    const docFilterBtns = document.querySelectorAll(".doc-filter-btn");
    docFilterBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        docFilterBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const filter = btn.getAttribute("data-filter") || "ALL";
        this.currentFilterCluster = filter;
        if (this.currentAuditRecord && this.currentAuditRecord.fase2) {
          DocumentalEngine.renderDocumentalMatrix(this.currentAuditRecord.fase2, document.getElementById("documentalMatrixContainer"), filter);
        } else {
          const initialItems = SIPRO_DATA.items27.map(item => ({
            ...item,
            conforme: false,
            faltante: true,
            vencido: false,
            observacion: "Documento pendiente de cotejo.",
            diasRestantes: null,
            archivoDetectado: null,
            meta: null
          }));
          DocumentalEngine.renderDocumentalMatrix({
            fase: "2_DOCUMENTAL", aprobado: false, totalItems: 27, itemsConformes: 0, itemsNoConformes: 27, porcentajeConformidad: 0, items: initialItems, hallazgosCriticos: [], alertas: []
          }, document.getElementById("documentalMatrixContainer"), filter);
        }
      });
    });

    // 6. Pasos del Gatekeeper Pipeline
    const gateSteps = document.querySelectorAll(".gate-step");
    gateSteps.forEach(step => {
      step.addEventListener("click", () => {
        const target = step.getAttribute("data-target-tab");
        if (target) this.switchTab(target);
      });
    });

    // 7. Modal de nombrar expediente
    const btnModalClose = document.getElementById("btnExpModalClose");
    if (btnModalClose) btnModalClose.addEventListener("click", () => this.closeExpedienteModal());

    const btnModalCancel = document.getElementById("btnExpModalCancel");
    if (btnModalCancel) btnModalCancel.addEventListener("click", () => this.closeExpedienteModal());

    const btnModalSave = document.getElementById("btnExpModalSave");
    if (btnModalSave) btnModalSave.addEventListener("click", () => this.saveExpedienteModal());

    const btnModalDelete = document.getElementById("btnExpModalDelete");
    if (btnModalDelete) btnModalDelete.addEventListener("click", () => this.deleteCurrentExpediente());

    const selModalMpio = document.getElementById("expModalSelectMpio");
    if (selModalMpio) selModalMpio.addEventListener("change", () => this.onExpModalMpioChange());

    // 8. Theme toggle
    const themeBtn = document.getElementById("themeToggleBtn");
    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
        this.setTheme(currentTheme === "dark" ? "light" : "dark");
      });
    }

    // 9. Botón Cargar GeoJSON Base
    const btnLoadBaseGeo = document.getElementById("btnLoadBaseGeoJson");
    if (btnLoadBaseGeo) {
      btnLoadBaseGeo.addEventListener("click", () => {
        if (window.SpatialEngine) SpatialEngine.loadBaseGeoJsonLayer();
      });
    }

    // 10. Input archivo GeoJSON
    const geoInput = document.getElementById("geojsonFileInput") || document.getElementById("geoJsonFileInput");
    if (geoInput) {
      geoInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file && window.SpatialEngine) {
          SpatialEngine.handleGeoJsonFile(file);
        }
      });
    }

    const btnLoadGeo = document.getElementById("btnLoadGeoJson");
    if (btnLoadGeo && geoInput) {
      btnLoadGeo.addEventListener("click", () => {
        geoInput.click();
      });
    }
  },

  /**
   * REAJUSTE AUTOMÁTICO RESPONSIVE DEL MAPA SATELITAL (REQUISITO 5)
   * Monitorea el redimensionamiento de ventana (Windows Snap 50/50, zoom de pantalla, monitores y portátiles)
   * y reajusta automáticamente el lienzo del mapa Leaflet (invalidateSize) evitando franjas grises o desfases.
   */
  setupResponsiveHandlers() {
    let resizeTimer = null;
    const triggerMapResize = () => {
      if (window.SpatialEngine && SpatialEngine.leafletMap) {
        try {
          SpatialEngine.leafletMap.invalidateSize();
        } catch (e) {
          console.warn("Aviso al reajustar dimensiones del mapa:", e);
        }
      }
    };

    // 1. ResizeObserver sobre el contenedor del mapa y la grilla de contraste espacial
    const mapContainer = document.getElementById("leafletMapContainer") || document.querySelector(".spatial-map-container");
    if (mapContainer && typeof window.ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(triggerMapResize, 60);
      });
      ro.observe(mapContainer);

      const splitGrid = document.querySelector(".spatial-contrast-grid");
      if (splitGrid) ro.observe(splitGrid);

      const mainWrapper = document.querySelector(".main-wrapper");
      if (mainWrapper) ro.observe(mainWrapper);
    }

    // 2. Listener en window.resize para cambios de ventana en Windows (Snap 50/50, ventanas flotantes, DPI scaling)
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(triggerMapResize, 80);
    }, { passive: true });
  },

  setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("sipro_theme", theme);
    const themeBtn = document.getElementById("themeToggleBtn");
    if (themeBtn) {
      themeBtn.innerHTML = theme === "dark" 
        ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
    }
  },

  switchTab(tabId) {
    this.currentTab = tabId;

    document.querySelectorAll(".sidebar-rail .nav-link").forEach(link => {
      link.classList.toggle("active", link.getAttribute("data-tab") === tabId);
    });

    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === tabId);
    });

    document.querySelectorAll(".tab-content").forEach(content => {
      content.classList.toggle("active", content.id === tabId);
    });

    if (tabId === "tab-1b" && SpatialEngine.leafletMap) {
      setTimeout(() => {
        SpatialEngine.leafletMap.invalidateSize();
        SpatialEngine.zoomToProjectTracks(this.currentProject);
      }, 150);
    }
  },

  /**
   * Revalida manualmente el despiece y volúmenes de concreto de un proyecto específico
   * Permite al auditor modificar valores en pantalla y recalcula instantáneamente
   */
  revalidarDespieceManual(projectId) {
    projectId = projectId || this.currentProjectId;
    if (!projectId || !window.proyectosAuditados || !window.proyectosAuditados[projectId]) {
      alert("Por favor cargue o seleccione un expediente municipal primero.");
      return;
    }

    const record = window.proyectosAuditados[projectId];
    const project = record.datos;
    const despiece = project.despieceAcero = project.despieceAcero || {};
    const marcas = despiece.marcas || [];

    // 1. Leer valores actualizados de las filas en la tabla
    let totalWeightCalculated = 0;
    marcas.forEach((m) => {
      const elInput = document.getElementById(`inputElem-${m.marca}`);
      const barraInput = document.getElementById(`inputBarra-${m.marca}`);
      const cantInput = document.getElementById(`inputCant-${m.marca}`);
      const longInput = document.getElementById(`inputLong-${m.marca}`);
      const pesoInput = document.getElementById(`inputPeso-${m.marca}`);

      if (elInput) m.elemento = elInput.value.trim();
      if (barraInput) {
        m.barra = parseInt(barraInput.value) || 3;
        m.diametro = m.barra === 2 ? '#2 (1/4")' : (m.barra === 4 ? '#4 (1/2")' : (m.barra === 5 ? '#5 (5/8")' : (m.barra === 6 ? '#6 (3/4")' : '#3 (3/8")')));
      }
      if (cantInput) m.cantidad = parseFloat(cantInput.value) || 1;
      if (longInput) m.longRealM = parseFloat(longInput.value) || 6.0;
      if (pesoInput) {
        m.pesoKg = parseFloat(pesoInput.value) || +(m.cantidad * m.longRealM * (m.barra === 2 ? 0.25 : (m.barra === 4 ? 0.994 : 0.56))).toFixed(1);
      }
      totalWeightCalculated += (m.pesoKg || 0);
    });

    totalWeightCalculated = +totalWeightCalculated.toFixed(1);
    despiece.pesoTotalDeclaradoKg = totalWeightCalculated;
    const L = project.longitudM || 1;
    despiece.cuantiaKgM = L > 0 ? +(totalWeightCalculated / L).toFixed(2) : 0;

    // 2. Re-auditar Fase 1A bajo el Estándar Técnico Departamental
    const newAudit1A = StructuralEngine.auditProject(project);
    record.fase1A = newAudit1A;

    // 3. Recalcular volúmenes de concreto y sacos de cemento
    const newConcrete = StructuralEngine.calculateConcreteVolumes(project.longitudM, {
      pesoTotalKg: totalWeightCalculated
    });
    record.concretoVolumes = newConcrete;
    project.concretoVolumes = newConcrete;

    // 4. Recalcular KPIs y compuertas del proyecto
    const audit1B = record.fase1B;
    const audit2 = record.fase2;
    const isApproved = newAudit1A.aprobado && (audit1B ? audit1B.aprobado : true) && (audit2 ? audit2.aprobado : true);
    const activeGatekeeper = !newAudit1A.aprobado ? "1A" : ((audit1B && !audit1B.aprobado) ? "1B" : ((audit2 && !audit2.aprobado) ? "2" : "3"));

    let score = 0;
    if (newAudit1A.aprobado) score += 35;
    else score += (newAudit1A.marcasCumplen / (newAudit1A.totalMarcas || 1)) * 35;
    if (audit1B && audit1B.aprobado) score += 30;
    else if (audit1B) score += (audit1B.coberturaBufferPct / 100) * 30;
    if (audit2) score += (audit2.itemsConformes / 27) * 35;
    score = +score.toFixed(1);

    const totalCrit = newAudit1A.hallazgosCriticos.length + (audit1B ? audit1B.hallazgosCriticos.length : 0) + (audit2 ? audit2.hallazgosCriticos.length : 0);

    record.kpis.scoreConformidad = score;
    record.kpis.cuantiaKgM = newAudit1A.cuantiaRealKgM;
    record.kpis.cuantiaSuperavitKgM = newAudit1A.cuantiaSuperavitKgM;
    record.kpis.totalMarcas = newAudit1A.totalMarcas;
    record.kpis.totalCriticas = totalCrit;

    record.auditGlobal = {
      audit1A: newAudit1A,
      audit1B: audit1B,
      audit2: audit2,
      isApproved: isApproved,
      activeGatekeeper: activeGatekeeper
    };

    // 5. Re-renderizar todos los componentes de la interfaz de forma reactiva
    this.renderKPIs(record.kpis, record.datos);
    this.renderPipelineBanner(record.auditGlobal);
    this.renderStructuralSidebar(record.datos, record.fase1A, record.concretoVolumes);
    StructuralEngine.renderGeometricSummaryCard("geometricSummaryContainer", record.datos);
    StructuralEngine.renderDespieceFiel("despieceExtraidoContainer", record.datos);
    StructuralEngine.renderConcreteTable(record.concretoVolumes, document.getElementById("concreteVolumesContainer"), record.fase1A, record.datos ? record.datos.despieceExtraido : null);
    ReportsEngine.renderOfficialReport(record.datos, record.auditGlobal, document.getElementById("officialReportContainer"));

    const cuantiaOk = newAudit1A.cuantiaRealKgM >= 26.25;
    const msg = cuantiaOk 
      ? `✅ Despiece revalidado con éxito: Cuantía = ${newAudit1A.cuantiaRealKgM} kg/m (Cumple >= 26.25 kg/m Estándar de Referencia). Volúmenes de concreto y sacos recalculados.`
      : `⚠️ Despiece revalidado: Cuantía = ${newAudit1A.cuantiaRealKgM} kg/m (Déficit frente a 26.25 kg/m de referencia técnica).`;
    
    alert(msg);
  }
};

// Exponer funciones globales
window.cargarProyecto = function(proyectoId) {
  return App.cargarProyecto(proyectoId);
};

window.App = App;

window.addEventListener("DOMContentLoaded", () => {
  App.init();
});
