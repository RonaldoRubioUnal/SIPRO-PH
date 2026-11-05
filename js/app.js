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
      const p = rec.datos || {};
      const opt = document.createElement("option");
      opt.value = rec.id;
      const isApp = rec.auditGlobal ? rec.auditGlobal.isApproved : (p.estadoSimulacion === "APROBADO_CONFORME");
      const statusTag = isApp ? " [✓ Conforme]" : " [En Auditoría]";
      const lenTag = p.longitudM ? ` [${p.longitudM} m]` : "";
      const folderLabel = rec.rawFolderName || p.nombreExpediente || p.codigo || rec.id;
      opt.textContent = `${idx + 1}. 📍 ${rec.municipio} (${rec.subregion || 'Antioquia'}) - ${folderLabel}${lenTag}${statusTag}`;
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
      const name = rec.rawFolderName || p.nombreExpediente || p.codigo || rec.id;
      const mpio = rec.municipio || "Municipio";

      const safeId = String(rec.id).replace(/'/g, "\\'");
      const safeMpio = String(mpio).replace(/"/g, "&quot;").replace(/</g, "&lt;");
      const safeName = String(name).replace(/"/g, "&quot;").replace(/</g, "&lt;");

      return `
        <div class="project-chip ${isCurrent ? 'active' : ''}" onclick="App.cargarProyecto('${safeId}')" title="Clic para alternar al expediente de ${safeMpio}">
          <span class="chip-status-dot ${dotClass}" title="${dotTitle}"></span>
          <span>📍 <strong>${safeMpio}</strong> <span style="opacity:0.85;font-weight:normal;font-size:11px;">(${safeName})</span></span>
          <button type="button" class="chip-close-btn" title="Quitar este expediente" onclick="event.stopPropagation(); App.deleteExpedienteById('${safeId}', event)">&times;</button>
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
    this.actualizarKPIsEjecutivos(record.id);

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

    // G. Fase 2: Lista de 27 o 28 ítems y estados documentales (con botones de Abrir Documento)
    DocumentalEngine.renderDocumentalMatrix(record.fase2, document.getElementById("documentalMatrixContainer"), this.currentFilterCluster || "ALL");

    // G2. Fase 1C (Solo si modalidad es RECURSOS): Coherencia Presupuestal
    const container1C = document.getElementById("presupuestoAuditContainer");
    if (container1C && typeof PresupuestoEngine !== "undefined" && record.modalidad === "RECURSOS") {
      PresupuestoEngine.renderPresupuestoTab(record, container1C);
    }

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
   * Procesa la georreferenciación reiniciando siempre los arreglos desde cero
   */
  async procesarGeorreferenciacion(proyectoId, files, fichaData) {
    return FolderReader.procesarGeorreferenciacion(proyectoId, files, fichaData);
  },

  async evaluarFase1B(proyectoId, files, fichaData) {
    return FolderReader.evaluarFase1B(proyectoId, files, fichaData);
  },

  /**
   * Actualiza KPIs y estados de compuerta del proyecto activo
   */
  updateKpis() {
    if (!this.currentProjectId) return;
    this.actualizarKPIsEjecutivos(this.currentProjectId);
    const rec = (window.proyectosAuditados && window.proyectosAuditados[this.currentProjectId]) || this.currentAuditRecord;
    if (rec && rec.auditGlobal) {
      this.renderPipelineBanner(rec.auditGlobal);
    }
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

    // Sincronizar botones de modalidad en cabecera y tarjeta activa
    const mod = record.modalidad || (project && project.modalidad) || "MATERIALES";
    const btnMat = document.getElementById("btnModMateriales");
    const btnRec = document.getElementById("btnModRecursos");
    if (btnMat && btnRec) {
      if (mod === "RECURSOS") {
        btnRec.classList.add("active");
        btnMat.classList.remove("active");
      } else {
        btnMat.classList.add("active");
        btnRec.classList.remove("active");
      }
    }

    const badgeCard = document.getElementById("badgeModalidadCard");
    if (badgeCard) {
      badgeCard.textContent = mod === "RECURSOS" ? "💰 RECURSOS" : "🧱 MATERIALES";
      badgeCard.className = `badge-modalidad ${mod === "RECURSOS" ? "badge-modalidad-recursos" : "badge-modalidad-materiales"}`;
    }

    const isRecursos = mod === "RECURSOS";
    const tabBtn1C = document.getElementById("tabBtn1C");
    const stepGate1C = document.getElementById("stepGate1C");
    const navItem1C = document.getElementById("navItem1C");
    if (tabBtn1C) tabBtn1C.style.display = isRecursos ? "inline-flex" : "none";
    if (stepGate1C) stepGate1C.style.display = isRecursos ? "inline-flex" : "none";
    if (navItem1C) navItem1C.style.display = isRecursos ? "block" : "none";
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
        const ak = g.activeGatekeeper;
        const hasKmzCheck = Boolean(g.audit1B && g.audit1B.tieneKMZ === true && g.audit1B.tieneGeorreferenciacionValida !== false);
        const gateName = (ak === "1A" || ak === "1A_DISENO") ? "FASE 1A (CONTROL ESTRUCTURAL DE ACERO)"
          : ((ak === "1B" || ak === "1B_ESPACIAL") ? (!hasKmzCheck ? "FASE 1B (✕ DETENIDO / SIN KMZ)" : "FASE 1B (CONTRASTE ESPACIAL Y ALINEACIÓN VIAL)")
            : ((ak === "1C" || ak === "1C_PRESUPUESTO") ? "FASE 1C (COHERENCIA PRESUPUESTAL)"
              : "FASE 2 (DOCUMENTAL)"));
        bannerStatusPill.innerHTML = `&#9888; DETENIDO EN COMPUERTA: ${gateName}`;
      }
    }

    const step1A = document.getElementById("stepGate1A");
    const step1B = document.getElementById("stepGate1B");
    const step1C = document.getElementById("stepGate1C");
    const step2 = document.getElementById("stepGate2");
    const step3 = document.getElementById("stepGate3");

    [step1A, step1B, step1C, step2, step3].forEach(s => {
      if (s) s.className = "gate-step";
    });

    const isRecursos = (this.currentAuditRecord && this.currentAuditRecord.modalidad === "RECURSOS") ||
      (this.currentProject && this.currentProject.modalidad === "RECURSOS");

    if (step1C) step1C.style.display = isRecursos ? "inline-flex" : "none";

    const tag1A = step1A ? step1A.querySelector(".gate-step-tag") : null;
    if (g.audit1A && g.audit1A.aprobado) {
      if (step1A) step1A.classList.add("gate-passed");
      if (tag1A) tag1A.innerHTML = `&#10003; Acero Conforme`;
    } else if (step1A) {
      step1A.classList.add("gate-failed", "gate-active");
      if (tag1A) tag1A.innerHTML = `&#10007; Detenido / Sin Despiece`;
    }

    const hasKmz1B = Boolean(g.audit1B && g.audit1B.tieneKMZ === true && g.audit1B.tieneGeorreferenciacionValida !== false);
    const tag1B = step1B ? step1B.querySelector(".gate-step-tag") : null;
    if (g.audit1B && g.audit1B.aprobado && hasKmz1B) {
      if (step1B) step1B.classList.add("gate-passed");
      if (tag1B) tag1B.innerHTML = `&#10003; Alineación Conforme`;
    } else if (step1B) {
      step1B.classList.add("gate-failed", "gate-active");
      if (tag1B) {
        tag1B.innerHTML = !hasKmz1B ? `&#10007; Detenido / Sin KMZ` : `&#10007; Desfase Espacial`;
      }
    }

    const f1C = this.currentAuditRecord && this.currentAuditRecord.fase1C;
    const f1CPassed = !isRecursos || (f1C && f1C.aprobado);

    if (isRecursos && step1C) {
      if (f1C && f1C.aprobado) {
        step1C.classList.add("gate-passed");
      } else if (f1C && !f1C.aprobado) {
        step1C.classList.add("gate-failed", "gate-active");
      }
    }

    if (g.audit1A && g.audit1A.aprobado && g.audit1B && g.audit1B.aprobado && f1CPassed) {
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
   * Sincronización Reactiva Centralizada de los 6 KPIs Ejecutivos Superiores
   */
  actualizarKPIsEjecutivos(proyectoId) {
    proyectoId = proyectoId || this.currentProjectId;
    if (!proyectoId) return;

    const expedientesMap = (window.SIPRO_DATA && SIPRO_DATA.expedientesMap) || window.proyectosAuditados || {};
    let exp = expedientesMap[proyectoId];
    if (!exp) {
      exp = Object.values(expedientesMap).find(r => r.id === proyectoId || r.slug === proyectoId || (r.datos && r.datos.id === proyectoId));
    }
    if (!exp) return;

    const isRecursos = exp.modalidad === "RECURSOS" || (exp.datos && exp.datos.modalidad === "RECURSOS");
    const totalItemsRequeridos = isRecursos ? 28 : 27;

    const f1A = exp.fase1A || (exp.auditGlobal && exp.auditGlobal.audit1A) || {};
    const f1B = exp.fase1B || (exp.datos && exp.datos.georreferenciacion) || (exp.auditGlobal && exp.auditGlobal.audit1B) || {};
    const f1C = exp.fase1C || {};
    const f2 = exp.fase2 || (exp.auditGlobal && exp.auditGlobal.audit2) || {};
    const f3 = exp.fase3 || {};

    // -------------------------------------------------------------------------
    // 1. TARJETA 4 — CUANTÍA ACERO (1A): Eliminar undefined kg/m y Calcular Dinámicamente
    // -------------------------------------------------------------------------
    const pesoTotalKg = Number(
      f1A.pesoTotalKg !== undefined ? f1A.pesoTotalKg :
        (f1A.pesoTotalDeclaradoKg !== undefined ? f1A.pesoTotalDeclaradoKg :
          (f1A.acero && f1A.acero.pesoTotalKg !== undefined ? f1A.acero.pesoTotalKg : 0))
    ) || 0;

    const longitudTramo = Number(
      f1A.longitudTramo !== undefined ? f1A.longitudTramo :
        (f1A.longitudIntervencionM !== undefined ? f1A.longitudIntervencionM :
          (exp.datos && exp.datos.longitudM !== undefined ? exp.datos.longitudM : 0))
    ) || 0;

    const item3 = (f2.items && Array.isArray(f2.items)) ? f2.items.find(it => it.id === 3 || it.num === 3) : null;
    const hasItem3Doc = item3 ? (!!item3.archivoDetectado && !item3.faltante) : false;
    const hasDespieceDoc = (f1A.tieneDoc !== false && f1A.hasDespieceDoc !== false && (pesoTotalKg > 0 || hasItem3Doc));

    let cuantiaReal = 0;
    let score1A = 0;

    const kpiCuantia = document.getElementById("kpiCuantiaVal");
    const kpiCuantiaSub = document.getElementById("kpiCuantiaSub");
    const kpiCuantiaIcon = document.getElementById("kpiCuantiaIcon");

    if (!hasDespieceDoc || pesoTotalKg === 0 || longitudTramo === 0) {
      cuantiaReal = 0;
      score1A = 0;
      if (kpiCuantia) {
        kpiCuantia.innerText = "0.00 kg/m";
        kpiCuantia.style.color = "var(--status-danger)";
      }
      if (kpiCuantiaSub) {
        kpiCuantiaSub.innerHTML = '<span class="kpi-tag-bad">⚠️ Sin documento de despiece aportado</span>';
      }
      if (kpiCuantiaIcon) {
        kpiCuantiaIcon.className = "kpi-icon-pill icon-danger";
      }
    } else {
      cuantiaReal = Number(f1A.cuantiaRealKgM || (pesoTotalKg / longitudTramo).toFixed(2)) || 0;
      if (kpiCuantia) {
        kpiCuantia.innerText = `${cuantiaReal.toFixed(2)} kg/m`;
      }
      if (cuantiaReal >= 26.25) {
        score1A = 100;
        if (kpiCuantia) kpiCuantia.style.color = "var(--status-success)";
        if (kpiCuantiaSub) {
          kpiCuantiaSub.innerHTML = '<span class="kpi-tag-good">&#10003; Cumple criterio técnico (&ge; 26.25 kg/m)</span>';
        }
        if (kpiCuantiaIcon) {
          kpiCuantiaIcon.className = "kpi-icon-pill icon-success";
        }
      } else {
        score1A = Math.min(100, Math.round((cuantiaReal / 26.25) * 100));
        const deficit = (26.25 - cuantiaReal).toFixed(2);
        if (kpiCuantia) kpiCuantia.style.color = "var(--status-danger)";
        if (kpiCuantiaSub) {
          kpiCuantiaSub.innerHTML = `<span class="kpi-tag-bad">&#9660; -${deficit} kg/m DÉFICIT ESTRUCTURAL</span>`;
        }
        if (kpiCuantiaIcon) {
          kpiCuantiaIcon.className = "kpi-icon-pill icon-danger";
        }
      }
    }

    // -------------------------------------------------------------------------
    // 2. TARJETA 5 — ALINEACIÓN RED VIAL (1B)
    // -------------------------------------------------------------------------
    const item24 = (f2.items && Array.isArray(f2.items)) ? f2.items.find(it => it.id === 24 || it.num === 24) : null;
    const hasGeom1B = Boolean(
      (f1B.tramos && f1B.tramos.length > 0) ||
      (f1B.puntos && f1B.puntos.length > 0) ||
      (f1B.puntosInspeccion && f1B.puntosInspeccion.length > 0)
    );
    const hasKMZ = Boolean(
      (f1B.tieneKMZ !== undefined ? f1B.tieneKMZ === true : f1B.tieneGeorreferenciacionValida === true) &&
      f1B.tieneGeorreferenciacionValida !== false &&
      hasGeom1B &&
      (item24 ? !item24.faltante && (item24.conforme || item24.subsanado || !!item24.archivoDetectado) : true)
    );

    let score1B = 0;
    const rawCob = f1B.porcentajeAlineacion !== undefined ? f1B.porcentajeAlineacion :
      (f1B.coberturaBufferPct !== undefined ? f1B.coberturaBufferPct : (f1B.porcentajeEnVia !== undefined ? f1B.porcentajeEnVia : 0));
    const coberturaVal = hasKMZ ? (Number(rawCob) || 0) : 0;

    const kpiCob = document.getElementById("kpiCoberturaVal");
    const kpiCobSub = document.getElementById("kpiCoberturaSub");
    const kpiCobIcon = document.getElementById("kpiCobIcon");

    if (!hasKMZ) {
      score1B = 0;
      if (kpiCob) {
        kpiCob.innerText = "0%";
        kpiCob.style.color = "var(--status-danger)";
      }
      if (kpiCobSub) {
        kpiCobSub.innerHTML = '<span class="kpi-tag-bad">✗ Documento KMZ/KML Faltante</span>';
      }
      if (kpiCobIcon) {
        kpiCobIcon.className = "kpi-icon-pill icon-danger";
      }
    } else {
      const dispCob = Number.isInteger(coberturaVal) ? `${coberturaVal}%` : `${coberturaVal.toFixed(1)}%`;
      if (kpiCob) kpiCob.innerText = dispCob;

      if (coberturaVal >= 95.0) {
        score1B = 100;
        if (kpiCob) kpiCob.style.color = "var(--status-success)";
        if (kpiCobSub) {
          kpiCobSub.innerHTML = '<span class="kpi-tag-good">&#10003; Alineado con red vial (10 m)</span>';
        }
        if (kpiCobIcon) {
          kpiCobIcon.className = "kpi-icon-pill icon-success";
        }
      } else if (coberturaVal > 0) {
        score1B = Math.max(0, Math.min(100, Math.round(coberturaVal)));
        if (kpiCob) kpiCob.style.color = "var(--status-warning)";
        if (kpiCobSub) {
          kpiCobSub.innerHTML = `<span class="kpi-tag-warning">&#9888; Cumplimiento parcial (${dispCob})</span>`;
        }
        if (kpiCobIcon) {
          kpiCobIcon.className = "kpi-icon-pill icon-warning";
        }
      } else {
        score1B = 0;
        if (kpiCob) kpiCob.style.color = "var(--status-danger)";
        if (kpiCobSub) {
          kpiCobSub.innerHTML = '<span class="kpi-tag-bad">&#10007; Fuera de corredor</span>';
        }
        if (kpiCobIcon) {
          kpiCobIcon.className = "kpi-icon-pill icon-danger";
        }
      }
    }

    // -------------------------------------------------------------------------
    // 3. TARJETA 6 — LISTA DE ÍTEMS (F2)
    // -------------------------------------------------------------------------
    const f2Items = (f2 && Array.isArray(f2.items)) ? f2.items : [];
    const itemsConformes = f2Items.filter(it => it.conforme || it.estado === "Conforme" || it.subsanado === true).length;
    const faltantes = Math.max(0, totalItemsRequeridos - itemsConformes);
    const scoreF2 = totalItemsRequeridos > 0 ? (itemsConformes / totalItemsRequeridos) * 100 : 0;

    const kpiDocLabel = document.getElementById("kpiDocLabel");
    if (kpiDocLabel) {
      kpiDocLabel.innerText = isRecursos ? "Lista 28 Ítems (F2)" : "Lista 27 Ítems (F2)";
    }

    const kpiDoc = document.getElementById("kpiDocVal");
    const kpiDocSub = document.getElementById("kpiDocSub");
    const kpiDocIcon = document.getElementById("kpiDocIcon");

    if (kpiDoc) {
      kpiDoc.innerText = `${itemsConformes} / ${totalItemsRequeridos}`;
    }
    if (faltantes === 0 && itemsConformes === totalItemsRequeridos) {
      if (kpiDoc) kpiDoc.style.color = "var(--status-success)";
      if (kpiDocSub) {
        kpiDocSub.innerHTML = '<span class="kpi-tag-good">&#10003; Documentación completa</span>';
      }
      if (kpiDocIcon) {
        kpiDocIcon.className = "kpi-icon-pill icon-success";
      }
    } else {
      if (kpiDoc) kpiDoc.style.color = "var(--status-danger)";
      if (kpiDocSub) {
        kpiDocSub.innerHTML = `<span class="kpi-tag-bad">&#9888; ${faltantes} ${faltantes === 1 ? 'ítem' : 'ítems'} por subsanar</span>`;
      }
      if (kpiDocIcon) {
        kpiDocIcon.className = "kpi-icon-pill icon-danger";
      }
    }

    // -------------------------------------------------------------------------
    // 4. PUNTAJE FASE 1C (Solo RECURSOS) Y CONFORMIDAD GENERAL (TARJETA 1)
    // -------------------------------------------------------------------------
    let score1C = 0;
    if (isRecursos) {
      const pData = f1C.presupuestoData || {};
      const hasPresupuestoDoc = !!pData.archivoOrigen && pData.hojaPresupuestoEncontrada !== false;
      if (!hasPresupuestoDoc) {
        score1C = 0;
      } else {
        const comp = f1C.comparacion || [];
        const objOk = pData.esPlacaHuella !== false;
        const coherentCount = comp.filter(c => c.coherente).length + (objOk ? 1 : 0);
        const totalChecks = comp.length + 1;
        score1C = totalChecks > 0 ? (coherentCount / totalChecks) * 100 : (f1C.aprobado ? 100 : 0);
      }
    }

    let conformidadGeneral = 0;
    if (isRecursos) {
      conformidadGeneral = (0.20 * (Number(score1A) || 0)) +
        (0.20 * (Number(score1B) || 0)) +
        (0.20 * (Number(score1C) || 0)) +
        (0.40 * (Number(scoreF2) || 0));
    } else {
      conformidadGeneral = (0.25 * (Number(score1A) || 0)) +
        (0.25 * (Number(score1B) || 0)) +
        (0.50 * (Number(scoreF2) || 0));
    }
    conformidadGeneral = Math.max(0, Math.min(100, Math.round(conformidadGeneral)));

    const valRadial = document.getElementById("kpiConformidadVal");
    if (valRadial) valRadial.innerText = `${conformidadGeneral}%`;
    const gaugeFill = document.getElementById("kpiGaugeCircle");
    if (gaugeFill) {
      const offset = 219.9 * (1 - conformidadGeneral / 100);
      gaugeFill.style.strokeDashoffset = offset;
      gaugeFill.style.stroke = conformidadGeneral >= 90
        ? "var(--color-accent)"
        : (conformidadGeneral >= 70 ? "var(--status-warning)" : "var(--status-danger)");
    }

    // -------------------------------------------------------------------------
    // 5. TARJETA 2 — LONGITUD INTERVENCIÓN
    // -------------------------------------------------------------------------
    const longitud = (f1A && (f1A.longitudTramo || f1A.longitudIntervencionM)) ||
      (exp.datos && exp.datos.longitudM) ||
      (f1B && f1B.longitudKmlM) || 0;
    const kpiTotal = document.getElementById("kpiTotalEvaluado");
    if (kpiTotal) kpiTotal.innerText = `${longitud} m`;

    let marcasCount = 0;
    if (hasDespieceDoc) {
      if (f1A.marcasEvaluadas && Array.isArray(f1A.marcasEvaluadas) && f1A.marcasEvaluadas.length > 0) {
        marcasCount = f1A.marcasEvaluadas.length;
      } else if (f1A.elementos && Array.isArray(f1A.elementos) && f1A.elementos.length > 0) {
        marcasCount = f1A.elementos.length;
      } else if (f1A.totalMarcas) {
        marcasCount = f1A.totalMarcas;
      } else if (exp.datos && exp.datos.despieceExtraido && Array.isArray(exp.datos.despieceExtraido.marcas)) {
        marcasCount = exp.datos.despieceExtraido.marcas.length;
      }
    }
    const kpiTotalSub = document.getElementById("kpiTotalEvaluadoSub");
    if (kpiTotalSub) {
      kpiTotalSub.innerText = `${marcasCount} marcas de acero | ${totalItemsRequeridos} ítems`;
    }

    // -------------------------------------------------------------------------
    // 6. TARJETA 3 — HALLAZGOS CRÍTICOS
    // -------------------------------------------------------------------------
    let findings = [];
    if (typeof ReportsEngine !== "undefined" && typeof ReportsEngine.collectAllFindings === "function") {
      const resFindings = ReportsEngine.collectAllFindings(exp.datos || exp, exp.auditGlobal);
      if (resFindings && Array.isArray(resFindings.findings)) {
        findings = resFindings.findings;
      }
    }

    const totalHallazgos = findings.length;
    let compuertasConAlerta = 0;
    if (findings.some(f => f.fase === "Fase 1A")) compuertasConAlerta++;
    if (findings.some(f => f.fase === "Fase 1B")) compuertasConAlerta++;
    if (isRecursos && findings.some(f => f.fase === "Fase 1C")) compuertasConAlerta++;
    if (findings.some(f => f.fase && f.fase.startsWith("Fase 2"))) compuertasConAlerta++;
    if (findings.some(f => f.fase === "Revisión Manual")) compuertasConAlerta++;

    const kpiCrit = document.getElementById("kpiCriticas");
    const kpiCritUnit = document.getElementById("kpiCriticasUnit");
    const kpiCritSub = document.getElementById("kpiCriticasSub");
    const kpiCritIcon = document.getElementById("kpiCriticasIcon");

    if (totalHallazgos > 0) {
      if (kpiCrit) {
        kpiCrit.innerText = totalHallazgos;
        kpiCrit.style.color = "var(--status-danger)";
      }
      if (kpiCritUnit) {
        kpiCritUnit.innerText = totalHallazgos === 1 ? "hallazgo" : "hallazgos";
      }
      if (kpiCritSub) {
        const compText = compuertasConAlerta === 1 ? "1 compuerta con alerta" : `${compuertasConAlerta} compuertas con alerta`;
        kpiCritSub.innerHTML = `<span class="kpi-tag-bad">Subsanación requerida (${compText})</span>`;
      }
      if (kpiCritIcon) {
        kpiCritIcon.className = "kpi-icon-pill icon-danger";
      }
    } else {
      if (kpiCrit) {
        kpiCrit.innerText = "0";
        kpiCrit.style.color = "var(--status-success)";
      }
      if (kpiCritUnit) {
        kpiCritUnit.innerText = "hallazgos";
      }
      if (kpiCritSub) {
        kpiCritSub.innerHTML = '<span class="kpi-tag-good">&#10003; Expediente 100% conforme</span>';
      }
      if (kpiCritIcon) {
        kpiCritIcon.className = "kpi-icon-pill icon-success";
      }
    }

    // Guardar los valores calculados en exp.kpis para persistencia y trazabilidad
    exp.kpis = exp.kpis || {};
    exp.kpis.cuantiaKgM = cuantiaReal;
    exp.kpis.cuantiaActualKgM = cuantiaReal;
    exp.kpis.cuantiaConforme = cuantiaReal >= 26.25;
    exp.kpis.scoreConformidad = conformidadGeneral;
    exp.kpis.score1A = score1A;
    exp.kpis.score1B = score1B;
    exp.kpis.score1C = score1C;
    exp.kpis.scoreF2 = scoreF2;
    exp.kpis.totalMarcas = marcasCount;
    exp.kpis.totalCriticas = totalHallazgos;
    exp.kpis.itemsConformes = itemsConformes;
    exp.kpis.itemsNoConformes = faltantes;
    exp.kpis.itemsTotal = totalItemsRequeridos;
    exp.kpis.coberturaBufferPct = coberturaVal;
  },

  /**
   * Renderiza las tarjetas KPI de la parte superior (delegado a actualizarKPIsEjecutivos)
   */
  renderKPIs(kpis, p) {
    const projId = (p && p.id) || this.currentProjectId;
    return this.actualizarKPIsEjecutivos(projId);
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
    if (spanConc21) spanConc21.innerText = `${(cv.totalConcreto21M3 || 0).toLocaleString("es-CO", { minimumFractionDigits: 1 })} m³`;

    const spanConcCicl = document.getElementById("statSidebarConcCicl");
    if (spanConcCicl) spanConcCicl.innerText = `${(cv.totalConcretoCiclopeoM3 || 0).toLocaleString("es-CO", { minimumFractionDigits: 1 })} m³`;

    const spanSacos = document.getElementById("statSidebarSacos");
    if (spanSacos) spanSacos.innerText = `${(cv.sacosCemento || 0).toLocaleString("es-CO")} sacos`;

    const spanConcTot = document.getElementById("statConcreteTotal");
    if (spanConcTot) spanConcTot.innerText = `${(cv.totalConcretoGlobalM3 || 0).toLocaleString("es-CO", { minimumFractionDigits: 2 })} m³`;

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
    if (kpiCuantia) { kpiCuantia.innerText = "0.00 kg/m"; kpiCuantia.style.color = "var(--status-danger)"; }
    const kpiCuantiaSub = document.getElementById("kpiCuantiaSub");
    if (kpiCuantiaSub) kpiCuantiaSub.innerHTML = '<span class="kpi-tag-bad">⚠️ Sin documento de despiece aportado</span>';
    const kpiCuantiaIcon = document.getElementById("kpiCuantiaIcon");
    if (kpiCuantiaIcon) kpiCuantiaIcon.className = "kpi-icon-pill icon-danger";
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
      subregs[sub].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')).forEach(m => {
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
    const selMod = document.getElementById("expModalSelectModalidad");
    const inputAlcalde = document.getElementById("expModalInputAlcalde");
    const inputSec = document.getElementById("expModalInputSecretario");
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
    if (selMod) selMod.value = (this.currentAuditRecord && this.currentAuditRecord.modalidad) || p.modalidad || "MATERIALES";
    if (inputAlcalde) inputAlcalde.value = (p.alcalde && p.alcalde.nombre) ? p.alcalde.nombre : "";
    if (inputSec) inputSec.value = (p.secretarioPlaneacion && p.secretarioPlaneacion.nombre) ? p.secretarioPlaneacion.nombre : "";

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
    const selMod = document.getElementById("expModalSelectModalidad");
    const inputAlcalde = document.getElementById("expModalInputAlcalde");
    const inputSec = document.getElementById("expModalInputSecretario");

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
    if (inputAlcalde && inputAlcalde.value.trim()) {
      p.alcalde = p.alcalde || {};
      p.alcalde.nombre = inputAlcalde.value.trim();
    }
    if (inputSec && inputSec.value.trim()) {
      p.secretarioPlaneacion = p.secretarioPlaneacion || {};
      p.secretarioPlaneacion.nombre = inputSec.value.trim();
    }
    const newMod = selMod ? selMod.value : (p.modalidad || "MATERIALES");
    p.modalidad = newMod;

    // Actualizar registro en window.proyectosAuditados
    if (this.currentProjectId && window.proyectosAuditados[this.currentProjectId]) {
      const rec = window.proyectosAuditados[this.currentProjectId];
      rec.municipio = p.municipio;
      rec.codMunicipio = p.codMunicipio;
      rec.subregion = p.subregion;
      rec.modalidad = newMod;
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
    // 0. Auto-ajuste dinámico de textareas de observaciones en Fase 3
    document.addEventListener("input", (e) => {
      if (e.target && e.target.classList && e.target.classList.contains("report-textarea")) {
        e.target.style.height = "auto";
        e.target.style.height = Math.max(e.target.scrollHeight, 44) + "px";
        const mirror = document.getElementById("print_" + e.target.id);
        if (mirror) mirror.textContent = e.target.value;
      }
    });

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

    if (tabId === "tab-1c" && typeof PresupuestoEngine !== "undefined" && this.currentAuditRecord) {
      const container1C = document.getElementById("presupuestoAuditContainer");
      if (container1C) PresupuestoEngine.renderPresupuestoTab(this.currentAuditRecord, container1C);
    }

    if (tabId === "tab-3") {
      setTimeout(() => {
        document.querySelectorAll(".report-textarea, .fase3-obs-textarea").forEach(el => {
          if (typeof ReportsEngine !== "undefined" && typeof ReportsEngine.autoResizeTextarea === "function") {
            ReportsEngine.autoResizeTextarea(el);
          } else {
            el.style.height = 'auto';
            el.style.height = Math.max(el.scrollHeight, 44) + 'px';
            const mirror = document.getElementById("print_" + el.id);
            if (mirror) mirror.textContent = el.value;
          }
        });
      }, 60);
      setTimeout(() => {
        document.querySelectorAll(".report-textarea, .fase3-obs-textarea").forEach(el => {
          if (typeof ReportsEngine !== "undefined" && typeof ReportsEngine.autoResizeTextarea === "function") {
            ReportsEngine.autoResizeTextarea(el);
          }
        });
      }, 180);
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
      if (longInput) m.longRealM = parseFloat(longInput.value) || 0;
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
    const isRecursosMod = (record.modalidad === "RECURSOS") || (project && project.modalidad === "RECURSOS");
    const f1COk = !isRecursosMod || (record.fase1C ? record.fase1C.aprobado : true);
    const isApproved = newAudit1A.aprobado && (audit1B ? audit1B.aprobado : true) && f1COk && (audit2 ? audit2.aprobado : true);
    const activeGatekeeper = !newAudit1A.aprobado ? "1A" : ((audit1B && !audit1B.aprobado) ? "1B" : (!f1COk ? "1C" : ((audit2 && !audit2.aprobado) ? "2" : "3")));

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
    this.actualizarKPIsEjecutivos(record.id);
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
  },

  /**
   * Cambia la modalidad del proyecto activo (MATERIALES vs RECURSOS)
   */
  setProjectModalidad(mod, projectId) {
    projectId = projectId || this.currentProjectId;
    const expedientesMap = (window.SIPRO_DATA && SIPRO_DATA.expedientesMap) || window.proyectosAuditados || {};
    const exp = expedientesMap[projectId];
    if (!exp) return;

    exp.modalidad = mod;
    if (exp.datos) exp.datos.modalidad = mod;

    // Actualizar botones de modalidad
    const btnMat = document.getElementById("btnModMateriales");
    const btnRec = document.getElementById("btnModRecursos");
    if (btnMat && btnRec) {
      if (mod === "RECURSOS") {
        btnRec.classList.add("active");
        btnMat.classList.remove("active");
      } else {
        btnMat.classList.add("active");
        btnRec.classList.remove("active");
      }
    }

    // Actualizar badge de la tarjeta activa
    const badgeCard = document.getElementById("badgeModalidadCard");
    if (badgeCard) {
      badgeCard.textContent = mod === "RECURSOS" ? "💰 RECURSOS" : "🧱 MATERIALES";
      badgeCard.className = `badge-modalidad ${mod === "RECURSOS" ? "badge-modalidad-recursos" : "badge-modalidad-materiales"}`;
    }

    // Mostrar u ocultar pestaña 1C y compuerta 1C
    const isRecursos = mod === "RECURSOS";
    const tabBtn1C = document.getElementById("tabBtn1C");
    const stepGate1C = document.getElementById("stepGate1C");
    const navItem1C = document.getElementById("navItem1C");

    if (tabBtn1C) tabBtn1C.style.display = isRecursos ? "inline-flex" : "none";
    if (stepGate1C) stepGate1C.style.display = isRecursos ? "inline-flex" : "none";
    if (navItem1C) navItem1C.style.display = isRecursos ? "block" : "none";

    // Re-auditar Fase 2 con 27 o 28 ítems
    if (exp.datos) {
      exp.fase2 = DocumentalEngine.auditProject(exp.datos);
      if (exp.kpis) {
        exp.kpis.itemsTotal = isRecursos ? 28 : 27;
        exp.kpis.itemsConformes = exp.fase2.itemsConformes;
        exp.kpis.itemsNoConformes = exp.fase2.itemsNoConformes;
      }
    }

    // Si pasa a RECURSOS, auditar Fase 1C si no se ha auditado
    if (isRecursos && typeof PresupuestoEngine !== "undefined") {
      PresupuestoEngine.auditarCoherencia(exp);
      const container1C = document.getElementById("presupuestoAuditContainer");
      if (container1C) PresupuestoEngine.renderPresupuestoTab(exp, container1C);
    }

    // Actualizar KPIs y vistas
    this.updateKpis();
    const docContainer = document.getElementById("documentalMatrixContainer");
    if (docContainer && exp.fase2) DocumentalEngine.renderDocumentalMatrix(exp.fase2, docContainer, this.currentFilterCluster || "ALL");
    const repContainer = document.getElementById("officialReportContainer");
    if (repContainer && exp.datos) ReportsEngine.renderOfficialReport(exp.datos, exp.auditGlobal, repContainer);

    // Auto-guardar cambio en sipro_auditoria.json
    this.saveAuditProgress(true);

    if (typeof FolderReader !== "undefined" && FolderReader.showToast) {
      FolderReader.showToast(`Modalidad actualizada: ${isRecursos ? '💰 RECURSOS (28 Ítems + Fase 1C)' : '🧱 MATERIALES (27 Ítems)'}`);
    }
  },

  /**
   * Alterna entre MATERIALES y RECURSOS para el proyecto activo
   */
  toggleProjectModalidad() {
    const projectId = this.currentProjectId;
    const expedientesMap = (window.SIPRO_DATA && SIPRO_DATA.expedientesMap) || window.proyectosAuditados || {};
    const exp = expedientesMap[projectId];
    if (!exp) return;
    const nextMod = exp.modalidad === "RECURSOS" ? "MATERIALES" : "RECURSOS";
    this.setProjectModalidad(nextMod, projectId);
  },

  /**
   * Guarda el avance de auditoría en sipro_auditoria.json (en disco si dirHandle, o descarga + localStorage)
   */
  async saveAuditProgress(silent = false) {
    const projectId = this.currentProjectId;
    const expedientesMap = (window.SIPRO_DATA && SIPRO_DATA.expedientesMap) || window.proyectosAuditados || {};
    const exp = expedientesMap[projectId];
    if (!exp) {
      if (!silent) alert("No hay un expediente activo para guardar.");
      return false;
    }

    const payload = {
      sistema: "SIPRO-PH",
      version: "2026.1",
      timestamp: Date.now(),
      fechaEdicion: new Date().toLocaleString("es-CO"),
      proyectoId: exp.id,
      slug: exp.slug,
      modalidad: exp.modalidad || "MATERIALES",
      datosIdentificacion: {
        municipio: exp.municipio,
        codMunicipio: exp.codMunicipio,
        subregion: exp.subregion,
        nombreExpediente: exp.datos ? exp.datos.nombreExpediente : "",
        codigoVial: exp.datos ? exp.datos.codigoVial : "",
        longitudM: exp.datos ? exp.datos.longitudM : 0,
        alcalde: exp.datos ? exp.datos.alcalde : null,
        secretarioPlaneacion: exp.datos ? exp.datos.secretarioPlaneacion : null
      },
      fase3: {
        matrizObservaciones: (exp.fase3 && (exp.fase3.matrizObservaciones || exp.fase3.observacionesEditadas)) || {},
        observaciones: (exp.fase3 && (exp.fase3.matrizObservaciones || exp.fase3.observacionesEditadas)) || {},
        hallazgosManuales: (exp.fase3 && exp.fase3.hallazgosManuales) || [],
        conceptoGeneral: (exp.fase3 && exp.fase3.conceptoGeneral) || ""
      },
      fase1C: {
        toleranciaPct: (exp.fase1C && exp.fase1C.toleranciaPct) || 5,
        presupuestoData: (exp.fase1C && exp.fase1C.presupuestoData) || null
      },
      historialSubsanaciones: exp.historialSubsanaciones || []
    };

    const jsonStr = JSON.stringify(payload, null, 2);

    // 1. Guardar en localStorage
    try {
      localStorage.setItem(`sipro_auditoria_${exp.slug}`, jsonStr);
      localStorage.setItem(`sipro_auditoria_${exp.id}`, jsonStr);
    } catch (e) {
      console.warn("Error guardando en localStorage:", e);
    }

    // 2. Si hay dirHandle de File System Access API, escribir físicamente en la carpeta
    if (exp.dirHandle && typeof exp.dirHandle.getFileHandle === "function") {
      try {
        const fileHandle = await exp.dirHandle.getFileHandle("sipro_auditoria.json", { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(jsonStr);
        await writable.close();
        if (!silent) {
          if (typeof FolderReader !== "undefined" && FolderReader.showToast) {
            FolderReader.showToast("💾 Avance guardado físicamente en la carpeta del proyecto (sipro_auditoria.json)");
          } else {
            alert("✓ Avance guardado exitosamente en sipro_auditoria.json dentro de la carpeta.");
          }
        }
        return true;
      } catch (fsErr) {
        console.warn("Fallo escritura directa en dirHandle:", fsErr);
      }
    }

    // 3. Fallback: descarga manual
    if (!silent) {
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sipro_auditoria.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (typeof FolderReader !== "undefined" && FolderReader.showToast) {
        FolderReader.showToast("💾 Archivo sipro_auditoria.json descargado. Cópialo en la carpeta del proyecto.");
      }
    }
    return true;
  },

  /**
   * Carga una subsanación física o en memoria para un ítem específico de Fase 2
   */
  /**
   * Redibuja la pestaña de Fase 1C (Coherencia Presupuestal) para el expediente activo
   */
  renderizarFase1C(proyectoId) {
    proyectoId = proyectoId || this.currentProjectId;
    const expedientesMap = (window.SIPRO_DATA && SIPRO_DATA.expedientesMap) || window.proyectosAuditados || {};
    let exp = expedientesMap[proyectoId];
    if (!exp) {
      exp = Object.values(expedientesMap).find(r => r.id === proyectoId || r.slug === proyectoId || (r.datos && r.datos.id === proyectoId));
    }
    if (!exp && this.currentAuditRecord) {
      exp = this.currentAuditRecord;
    }
    if (!exp) return;

    const container1C = document.getElementById("presupuestoAuditContainer");
    if (container1C && typeof PresupuestoEngine !== "undefined") {
      PresupuestoEngine.renderPresupuestoTab(exp, container1C);
    }
  },

  /**
   * Dispara el input file y procesa la subsanación para un ítem documental (1-28)
   */
  async subirSubsanacionItem(arg1, arg2, arg3) {
    let itemId, projectId, directFile = null;

    if (typeof arg1 === "string" && isNaN(Number(arg1)) && arg1.length > 2 && (typeof arg2 === "number" || !isNaN(Number(arg2)))) {
      // Firma: (projectId, itemId, directFile)
      projectId = arg1;
      itemId = Number(arg2);
      directFile = arg3 || null;
    } else {
      // Firma: (itemId, projectId, directFile)
      itemId = Number(arg1);
      if (arg2 && typeof arg2 === "object" && (arg2 instanceof File || (arg2.name && arg2.size !== undefined))) {
        directFile = arg2;
        projectId = arg3 || this.currentProjectId;
      } else {
        projectId = arg2 || this.currentProjectId;
        directFile = (arg3 && typeof arg3 === "object" && (arg3 instanceof File || (arg3.name && arg3.size !== undefined))) ? arg3 : null;
      }
    }

    projectId = projectId || this.currentProjectId;
    const expedientesMap = (window.SIPRO_DATA && SIPRO_DATA.expedientesMap) || window.proyectosAuditados || {};
    let exp = expedientesMap[projectId];
    if (!exp) {
      exp = Object.values(expedientesMap).find(r => r.id === projectId || r.slug === projectId || (r.datos && r.datos.id === projectId));
    }
    if (!exp && this.currentAuditRecord) {
      exp = this.currentAuditRecord;
    }
    if (!exp) {
      alert("No hay un expediente activo para cargar subsanación.");
      return;
    }

    const numItemId = Number(itemId);

    const processFile = async (file) => {
      if (!file) return;

      try {
        // 1. Guardar físicamente en carpeta si disponemos de dirHandle
        if (exp.dirHandle && typeof exp.dirHandle.getFileHandle === "function") {
          try {
            const itemPadded = String(numItemId).padStart(2, "0");
            const targetName = file.name.toUpperCase().includes(`ITEM_${itemPadded}`) || file.name.toUpperCase().includes(`ITEM ${itemPadded}`)
              ? file.name
              : `ITEM_${itemPadded}_${file.name}`;

            const fileHandle = await exp.dirHandle.getFileHandle(targetName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(file);
            await writable.close();
            console.log(`Archivo físico de subsanación guardado en disco: ${targetName}`);
          } catch (diskErr) {
            console.warn("No se pudo escribir directamente en el disco:", diskErr);
          }
        }

        // 2. Inyectar archivo en la estructura en memoria del proyecto
        exp.archivosFileMap = exp.archivosFileMap || {};
        exp.archivosFileMap[numItemId] = file;
        exp.archivosFileMap[String(numItemId)] = file;
        exp.archivos = exp.archivos || [];
        if (!exp.archivos.includes(file)) exp.archivos.push(file);

        if (exp.datos) {
          exp.datos.archivosFiles = exp.datos.archivosFiles || {};
          exp.datos.archivosFiles[numItemId] = file;
          exp.datos.archivosFiles[String(numItemId)] = file;
          exp.datos.documentosStatus = exp.datos.documentosStatus || { archivosDetectados: {} };
          exp.datos.documentosStatus.archivosDetectados[numItemId] = file.name;
          exp.datos.documentosStatus.archivosDetectados[String(numItemId)] = file.name;
          exp.datos.archivosMetadata = exp.datos.archivosMetadata || {};
          exp.datos.archivosMetadata[numItemId] = {
            fileName: file.name,
            sizeBytes: file.size,
            lastModified: file.lastModified,
            textSnippet: `Documento de subsanación aportado: ${file.name}`
          };
          exp.datos.archivosMetadata[String(numItemId)] = exp.datos.archivosMetadata[numItemId];
        }

        // 3. Registrar en historial de subsanaciones
        exp.historialSubsanaciones = exp.historialSubsanaciones || [];
        exp.historialSubsanaciones.push({
          itemId: numItemId,
          fileName: file.name,
          fecha: new Date().toLocaleString("es-CO"),
          timestamp: Date.now()
        });

        // 4. Identificar ítem en la lista documental de Fase 2
        let itemObj = null;
        if (exp.fase2 && exp.fase2.items) {
          itemObj = exp.fase2.items.find(i => Number(i.id) === numItemId || i.id === itemId);
          if (itemObj) {
            itemObj.conforme = true;
            itemObj.faltante = false;
            itemObj.vencido = false;
            itemObj.estado = "Conforme (Subsanado)";
            itemObj.archivoDetectado = file.name;
            itemObj.subsanado = true;
            itemObj.fechaSubsanacion = new Date().toLocaleDateString("es-CO");
            itemObj.motivo = `Subsanado con archivo ${file.name} el ${new Date().toLocaleDateString("es-CO")}`;
          }
        }

        const isItem3 = (numItemId === 3 || (itemObj && /despiece|acero|memorias/i.test(itemObj.nombre || itemObj.requisito || itemObj.title || "")));
        const isItem24 = (numItemId === 24 || (itemObj && /georreferenc|kml|kmz/i.test(itemObj.nombre || itemObj.requisito || itemObj.title || "")));
        const isItem28 = (
          numItemId === 28 ||
          (itemObj && /presupuesto/i.test(itemObj.nombre || itemObj.requisito || itemObj.title || itemObj.descripcion || "")) ||
          (/\.(xlsx|xlsm|xls|xlsb)$/i.test(file.name) && /presupuesto|pto/i.test(file.name))
        );

        // 5. Re-evaluaciones especializadas según el ítem
        if (isItem3) {
          if (typeof FolderReader !== "undefined" && FolderReader.reprocessItem3File) {
            await FolderReader.reprocessItem3File(file, projectId);
          }
          // Recálculo Cruzado de Fase 1C si es modalidad RECURSOS
          if (exp.modalidad === "RECURSOS" && typeof PresupuestoEngine !== "undefined") {
            const state1C = PresupuestoEngine.auditarCoherencia(exp);
            exp.fase1C = state1C;
            if (expedientesMap[projectId]) expedientesMap[projectId].fase1C = state1C;
            if (window.proyectosAuditados && window.proyectosAuditados[projectId]) {
              window.proyectosAuditados[projectId].fase1C = state1C;
            }
          }
        } else if (isItem24) {
          if (typeof SpatialEngine !== "undefined" && typeof FolderReader !== "undefined") {
            const fichaData = (exp.datos && exp.datos.fichaPriorizacion) || {
              id: projectId,
              municipio: exp.municipio,
              codMunicipio: exp.codMunicipio,
              subregion: exp.subregion,
              longitudTotalM: (exp.datos && exp.datos.longitudM) || 0,
              codigosViales: exp.datos && exp.datos.codigoVial ? [exp.datos.codigoVial] : []
            };

            // 1. Reiniciar completamente los arreglos de georreferenciación antes de procesar el archivo
            if (exp.fase1B) {
              exp.fase1B.tramos = [];
              exp.fase1B.puntos = [];
              exp.fase1B.puntosInspeccion = [];
              exp.fase1B.puntosContraste = [];
              exp.fase1B.alertas = [];
              exp.fase1B.alertasArchivos = [];
            }
            if (exp.datos && exp.datos.georreferenciacion) {
              exp.datos.georreferenciacion.tramos = [];
              exp.datos.georreferenciacion.puntos = [];
              exp.datos.georreferenciacion.puntosInspeccion = [];
              exp.datos.georreferenciacion.puntosContraste = [];
            }
            if (expedientesMap[projectId] && expedientesMap[projectId].fase1B) {
              expedientesMap[projectId].fase1B.tramos = [];
              expedientesMap[projectId].fase1B.puntos = [];
              expedientesMap[projectId].fase1B.puntosInspeccion = [];
              expedientesMap[projectId].fase1B.puntosContraste = [];
              expedientesMap[projectId].fase1B.alertas = [];
              expedientesMap[projectId].fase1B.alertasArchivos = [];
            }

            const geoConfig = await FolderReader.procesarGeorreferenciacion(projectId, [file], fichaData);
            if (geoConfig) {
              const hasGeoms = (geoConfig.tramos && geoConfig.tramos.length > 0) || (geoConfig.puntos && geoConfig.puntos.length > 0) || (geoConfig.puntosInspeccion && geoConfig.puntosInspeccion.length > 0);
              const validKmz = Boolean(geoConfig.tieneKMZ && hasGeoms);
              exp.fase1B = {
                ...geoConfig,
                tieneKMZ: validKmz,
                tieneGeorreferenciacionValida: validKmz,
                puntos: geoConfig.puntos || geoConfig.puntosInspeccion || []
              };
              exp.datos.georreferenciacion = exp.fase1B;
              if (expedientesMap[projectId]) expedientesMap[projectId].fase1B = exp.fase1B;
              if (window.proyectosAuditados && window.proyectosAuditados[projectId]) {
                window.proyectosAuditados[projectId].fase1B = exp.fase1B;
              }
              if (typeof SpatialEngine.recalculateProjectProximity === "function") {
                SpatialEngine.recalculateProjectProximity(exp.datos);
              } else if (typeof SpatialEngine.calculateOverallRoadAlignment === "function") {
                SpatialEngine.calculateOverallRoadAlignment(exp.datos);
              }
              if (typeof SpatialEngine.auditProject === "function") {
                const audit1B = SpatialEngine.auditProject(exp.datos);
                exp.fase1B = { ...exp.fase1B, ...audit1B };
                if (exp.auditGlobal) exp.auditGlobal.audit1B = exp.fase1B;
              }
              if (typeof SpatialEngine.initOrUpdateMap === "function") {
                SpatialEngine.initOrUpdateMap("leafletMapContainer", exp.datos);
              }
              if (typeof SpatialEngine.renderContrastTable === "function") {
                SpatialEngine.renderContrastTable(exp.datos);
              }
              if (typeof SpatialEngine.zoomToProjectTracks === "function") {
                SpatialEngine.zoomToProjectTracks(exp.datos);
              }
            }
          }
        } else if (isItem28) {
          // Asignar al slot 28 en todos los mapas
          exp.archivosFileMap[28] = file;
          exp.archivosFileMap["28"] = file;
          if (exp.datos) {
            exp.datos.archivosFiles = exp.datos.archivosFiles || {};
            exp.datos.archivosFiles[28] = file;
            exp.datos.archivosFiles["28"] = file;
            exp.datos.documentosStatus = exp.datos.documentosStatus || { archivosDetectados: {} };
            exp.datos.documentosStatus.archivosDetectados[28] = file.name;
            exp.datos.documentosStatus.archivosDetectados["28"] = file.name;
            exp.datos.archivosMetadata = exp.datos.archivosMetadata || {};
            exp.datos.archivosMetadata[28] = {
              fileName: file.name,
              sizeBytes: file.size,
              lastModified: file.lastModified,
              textSnippet: `Documento de presupuesto aportado: ${file.name}`
            };
            exp.datos.archivosMetadata["28"] = exp.datos.archivosMetadata[28];
          }

          if (typeof PresupuestoEngine !== "undefined") {
            const state1C = await PresupuestoEngine.reprocessBudgetFile(file, projectId);
            exp.fase1C = state1C;
            if (expedientesMap[projectId]) expedientesMap[projectId].fase1C = state1C;
            if (window.proyectosAuditados && window.proyectosAuditados[projectId]) {
              window.proyectosAuditados[projectId].fase1C = state1C;
            }
          }
        }

        // 6. Re-auditar Fase 2 preservando ítems subsanados
        if (exp.datos) {
          exp.fase2 = DocumentalEngine.auditProject(exp.datos);
          if (exp.fase2 && exp.fase2.items && exp.historialSubsanaciones) {
            exp.historialSubsanaciones.forEach(sub => {
              const it = exp.fase2.items.find(i => Number(i.id) === Number(sub.itemId));
              if (it) {
                it.conforme = true;
                it.faltante = false;
                it.vencido = false;
                it.estado = "Conforme (Subsanado)";
                it.subsanado = true;
                it.archivoDetectado = sub.fileName;
                it.motivo = `Subsanado con archivo ${sub.fileName}`;
              }
            });
            exp.fase2.itemsConformes = exp.fase2.items.filter(it => it.conforme || it.subsanado).length;
            exp.fase2.itemsNoConformes = exp.fase2.items.length - exp.fase2.itemsConformes;
          }
          if (exp.kpis) {
            const tot = exp.modalidad === "RECURSOS" ? 28 : 27;
            exp.kpis.itemsTotal = tot;
            exp.kpis.itemsConformes = exp.fase2.itemsConformes;
            exp.kpis.itemsNoConformes = exp.fase2.itemsNoConformes;
          }
        }

        // 7. Actualizar Gatekeepers globales
        if (!exp.auditGlobal) exp.auditGlobal = {};
        const a1A = exp.fase1A ? exp.fase1A.aprobado : true;
        const hasKmz1B = exp.fase1B ? (exp.fase1B.tieneKMZ === true && exp.fase1B.tieneGeorreferenciacionValida !== false) : false;
        const a1B = exp.fase1B ? (exp.fase1B.aprobado && hasKmz1B) : false;
        const a2 = exp.fase2 ? (exp.fase2.aprobado || (exp.fase2.itemsConformes >= (exp.modalidad === "RECURSOS" ? 28 : 27))) : true;
        const a1C = exp.modalidad !== "RECURSOS" || (exp.fase1C ? exp.fase1C.aprobado : true);

        exp.auditGlobal.audit1A = exp.fase1A;
        exp.auditGlobal.audit1B = exp.fase1B;
        exp.auditGlobal.audit2 = exp.fase2;
        exp.auditGlobal.isApproved = a1A && a1B && a2 && a1C;

        if (!a1A) {
          exp.auditGlobal.activeGatekeeper = "1A_DISENO";
        } else if (!a1B) {
          exp.auditGlobal.activeGatekeeper = "1B_ESPACIAL";
        } else if (!a1C) {
          exp.auditGlobal.activeGatekeeper = "1C_PRESUPUESTO";
        } else if (!a2) {
          exp.auditGlobal.activeGatekeeper = "2_DOCUMENTAL";
        } else {
          exp.auditGlobal.activeGatekeeper = "3_APROBADO";
        }

        // 8. Actualizar Fase 3: limpiar alertas de documentos faltantes y reflejar coherencia presupuestal
        if (exp.fase3) {
          exp.fase3.observacionesEditadas = exp.fase3.observacionesEditadas || {};
          exp.fase3.matrizObservaciones = exp.fase3.matrizObservaciones || {};

          const cleanKeys = [`doc_item_${numItemId}`, `FASE_2_ITEM_${numItemId}`, `item_${numItemId}`];
          if (isItem28) {
            cleanKeys.push("doc_item_28", "FASE_2_ITEM_28", "item_28", "FASE_1C_PTO", "fase_1c_presupuesto");
          }
          if (isItem3) {
            cleanKeys.push("doc_item_3", "FASE_2_ITEM_3", "item_3", "FASE_1A_DISENO", "FASE_1A_ACERO", "fase_1a_acero");
          }
          if (isItem24) {
            cleanKeys.push("doc_item_24", "FASE_2_ITEM_24", "item_24", "FASE_1B_GEO", "fase_1b_espacial");
          }
          cleanKeys.forEach(k => {
            delete exp.fase3.observacionesEditadas[k];
            delete exp.fase3.matrizObservaciones[k];
          });
        }

        // 9. Auto-guardar avance en sipro_auditoria.json
        await this.saveAuditProgress(true);

        // 10. Refrescar interfaz y referencias activas
        if (this.currentProjectId === projectId || !this.currentProjectId) {
          this.currentProjectId = projectId;
          this.currentAuditRecord = exp;
          this.currentProject = exp.datos;
          this.auditGlobal = exp.auditGlobal;
        }

        this.actualizarKPIsEjecutivos(projectId);
        this.renderPipelineBanner(exp.auditGlobal);

        if (exp.modalidad === "RECURSOS") {
          this.renderizarFase1C(projectId);
        }

        const docCont = document.getElementById("documentalMatrixContainer");
        if (docCont && exp.fase2) {
          DocumentalEngine.renderDocumentalMatrix(exp.fase2, docCont, this.currentFilterCluster || "ALL");
        }

        const repCont = document.getElementById("officialReportContainer");
        if (repCont && exp.datos) {
          ReportsEngine.renderOfficialReport(exp.datos, exp.auditGlobal, repCont);
        }

        if (isItem3 && (this.currentProjectId === projectId)) {
          this.renderStructuralSidebar(exp.datos, exp.fase1A, exp.concretoVolumes);
          if (typeof StructuralEngine !== "undefined") {
            StructuralEngine.renderGeometricSummaryCard("geometricSummaryContainer", exp.datos);
            StructuralEngine.renderDespieceFiel("despieceExtraidoContainer", exp.datos);
            StructuralEngine.renderConcreteTable(exp.concretoVolumes, document.getElementById("concreteVolumesContainer"), exp.fase1A, exp.datos ? exp.datos.despieceExtraido : null);
          }
        }

        if (typeof FolderReader !== "undefined" && FolderReader.showToast) {
          FolderReader.showToast(`✓ Subsanación cargada para Ítem ${numItemId}: ${file.name}`);
        } else {
          alert(`✓ Subsanación cargada con éxito para el Ítem ${numItemId}`);
        }
      } catch (err) {
        console.error("Error al procesar subsanación:", err);
        alert("Error al cargar la subsanación: " + err.message);
      }
    };

    if (directFile) {
      await processFile(directFile);
    } else {
      const fileInput = document.createElement("input");
      fileInput.type = "file";

      if (numItemId === 3) {
        fileInput.accept = ".xlsx,.xls,.xlsm,.xlsb,.pdf";
      } else if (numItemId === 24) {
        fileInput.accept = ".kml,.kmz,.zip,.7z,.rar";
      } else if (numItemId === 28) {
        fileInput.accept = ".xlsx,.xls,.xlsm,.xlsb,.pdf";
      } else {
        fileInput.accept = ".pdf,.docx,.doc,.xlsx,.xls,.xlsm,.xlsb,.zip,.rar,image/*";
      }

      fileInput.onchange = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          await processFile(file);
        }
      };

      fileInput.click();
    }
  },

  generatePrintableReportHtml(project, auditGlobal) {
    if (typeof ReportsEngine !== "undefined" && typeof ReportsEngine.generatePrintableReportHtml === "function") {
      return ReportsEngine.generatePrintableReportHtml(project, auditGlobal);
    }
    return "";
  },

  /**
   * Exporta o imprime la Ficha de Observaciones Oficial en PDF con ventana limpia
   */
  imprimirFichaObservacionesPDF() {
    if (typeof ReportsEngine !== "undefined" && typeof ReportsEngine.imprimirFichaObservacionesPDF === "function") {
      return ReportsEngine.imprimirFichaObservacionesPDF();
    }
    window.print();
  },

  /**
   * Descarga o exporta directamente la Ficha de Observaciones en PDF si html2pdf está disponible
   */
  descargarFichaPDF(filename) {
    if (typeof ReportsEngine !== "undefined" && typeof ReportsEngine.exportarFichaPDFDirecta === "function") {
      return ReportsEngine.exportarFichaPDFDirecta(filename);
    }
    this.imprimirFichaObservacionesPDF();
  }
};

// Exponer funciones globales
window.renderizarFase1C = function (proyectoId) {
  return App.renderizarFase1C(proyectoId);
};
window.cargarProyecto = function (proyectoId) {
  return App.cargarProyecto(proyectoId);
};
window.setProjectModalidad = function (mod, projectId) {
  return App.setProjectModalidad(mod, projectId);
};
window.toggleProjectModalidad = function () {
  return App.toggleProjectModalidad();
};
window.saveAuditProgress = function (silent) {
  return App.saveAuditProgress(silent);
};
window.actualizarKPIsEjecutivos = function (proyectoId) {
  return App.actualizarKPIsEjecutivos(proyectoId);
};

window.subirSubsanacionItem = function (arg1, arg2, arg3) {
  return App.subirSubsanacionItem(arg1, arg2, arg3);
};

window.imprimirFichaObservacionesPDF = function () {
  return App.imprimirFichaObservacionesPDF();
};
window.generatePrintableReportHtml = function (project, auditGlobal) {
  return App.generatePrintableReportHtml(project, auditGlobal);
};
window.descargarFichaPDF = function (filename) {
  return App.descargarFichaPDF(filename);
};

App.clasificarPartidaConcreto = function (desc) {
  return typeof PresupuestoEngine !== "undefined" && typeof PresupuestoEngine.clasificarPartidaConcreto === "function"
    ? PresupuestoEngine.clasificarPartidaConcreto(desc)
    : { esConcreto: false };
};
App.extraerDimensionesItem = function (desc, f1A) {
  return typeof PresupuestoEngine !== "undefined" && typeof PresupuestoEngine.extraerDimensionesItem === "function"
    ? PresupuestoEngine.extraerDimensionesItem(desc, f1A)
    : { converted: false, motivo: "Motor no disponible" };
};
window.App = App;

window.addEventListener("DOMContentLoaded", () => {
  App.init();
});
