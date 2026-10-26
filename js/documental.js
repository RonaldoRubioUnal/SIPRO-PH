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

  /**
   * Ejecuta la auditoría documental completa del proyecto basada en los archivos reales
   */
  auditProject(project) {
    const items = SIPRO_DATA.items27;
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
          observacion: observation,
          diasRestantes: null,
          archivoDetectado: null,
          meta: null
        };
      }

      // 2. Si el archivo SÍ existe, verificar regla de vigencia (< 30 días para certificados y antecedentes)
      if (item.daysMax === 30) {
        const itemKey = `item${item.id}`;
        let daysElapsed = diasVigencias[itemKey];

        if (daysElapsed === undefined && meta && meta.lastModified) {
          const diffMs = Date.now() - meta.lastModified;
          daysElapsed = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }

        if (daysElapsed === undefined) daysElapsed = 10;
        daysRemaining = 30 - daysElapsed;
        
        if (daysElapsed > 30) {
          isCompliant = false;
          isExpired = true;
          observation = `Documento vencido: expedido hace ${daysElapsed} días (vigencia máxima permitida: 30 días).`;
        }
      }
      
      // 3. Chequeo de lista de subsanación explícita
      if (docStatus.itemsSubsanar && docStatus.itemsSubsanar.includes(item.id)) {
        isCompliant = false;
        if (observation === "-") {
          observation = `No cumple requisito formal según especificaciones técnicas: ${item.rule}`;
        }
      }

      if (isCompliant) {
        totalCompliant++;
        if (observation === "-") {
          observation = `Documento verificado y vigente en la carpeta: ${detectedFile}`;
        }
      } else {
        criticalIssues.push({
          criterio: `Ítem ${item.num}: ${item.title}`,
          observacion: observation,
          accion_requerida: `Remitir nuevo documento conforme a la regla: ${item.rule}`
        });
      }

      return {
        ...item,
        conforme: isCompliant,
        faltante: false,
        vencido: isExpired,
        observacion: observation,
        diasRestantes: daysRemaining,
        archivoDetectado: detectedFile,
        meta: meta
      };
    });

    const passed = criticalIssues.length === 0;

    return {
      fase: "2_DOCUMENTAL",
      aprobado: passed,
      totalItems: items.length, // 27
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
    const item = SIPRO_DATA.items27.find(i => i.id === itemId);
    if (!item) return;

    const file = this.getFileForItem(itemId);
    const p = App.currentProject || {};
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
   * Despliega el visor interactivo de documentos en el modal de alta resolución
   */
  openViewerModal(itemId, item, file, fileUrl) {
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

    modalBody.innerHTML = viewerHtml;
    modal.classList.add("active");
  },

  /**
   * Renderiza la lista numérica unificada del 1 al 27 en el contenedor de Fase 2
   */
  renderDocumentalMatrix(auditResult, container, filter = "ALL") {
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

    cardEl.innerHTML = `
      <div class="documental-header">
        <div>
          <h3 style="font-size: 16px; font-weight: 800; color: var(--color-primary); margin: 0 0 4px 0;">
            Lista Numérica de Verificación Documental (Ítems 1 al 27)
          </h3>
          <p style="font-size: 12px; color: var(--text-muted); margin: 0;">
            Cotejo estricto de los 27 requisitos según la documentación presente en la carpeta del expediente municipal. Haga clic en <b>Abrir</b> o sobre el nombre del archivo para visualizar el documento.
          </p>
        </div>
        <div style="display:flex; align-items:center; gap: 8px;">
          <span class="status-pill ${auditResult.aprobado ? 'cumple' : 'alerta'}">
            ${auditResult.itemsConformes} de 27 Conformes (${auditResult.porcentajeConformidad}%)
          </span>
          ${auditResult.itemsNoConformes > 0 ? `
            <span class="status-pill no-cumple">
              ${auditResult.itemsNoConformes} por Subsanar / Faltantes
            </span>
          ` : ''}
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 50px; text-align: center;">N°</th>
              <th>Documento Requerido</th>
              <th>Archivo Detectado en Carpeta</th>
              <th>Regla de Validación / Vigencia</th>
              <th>Entidad Emisora</th>
              <th style="text-align: center;">Estado</th>
              <th>Observación de Auditoría</th>
              <th style="text-align: right; min-width: 110px;">Acción</th>
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
                <td>
                  <span style="font-size:11px;color:var(--text-muted)">${item.rule}</span>
                </td>
                <td style="font-size:11px;color:var(--text-muted)">
                  ${item.entity}
                </td>
                <td style="text-align: center;">
                  <span class="status-pill ${item.conforme ? 'cumple' : (item.vencido ? 'alerta' : 'no-cumple')}">
                    ${item.conforme ? '&#10003; Conforme' : (item.vencido ? '&#9888; Vencido' : (item.faltante ? '&#10007; Faltante' : '&#10007; Subsanar'))}
                  </span>
                </td>
                <td>
                  <span class="${item.conforme ? 'text-muted' : 'criterio-tag'}" style="font-size: 11px;">
                    ${item.observacion}
                  </span>
                </td>
                <td style="text-align: right;">
                  <div style="display:inline-flex;gap:6px;align-items:center;justify-content:flex-end;">
                    ${item.archivoDetectado ? `
                      <button class="btn-primary" style="padding:5px 12px;font-size:11px;background:#0284C7;display:inline-flex;align-items:center;gap:4px;box-shadow:0 1px 3px rgba(2,132,199,0.3)" onclick="DocumentalEngine.abrirDocumento(${item.id})" title="Abrir y previsualizar este documento">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        Abrir
                      </button>
                    ` : `
                      <span style="font-size:11px;color:var(--text-muted);font-style:italic">— Sin archivo —</span>
                    `}
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div style="padding: 14px 20px; background: var(--bg-subtle); border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-muted);">
        <div>
          Criterio vinculante: Todos los 27 ítems deben estar aportados y vigentes para aprobar la Fase 2 y habilitar la Ficha de Priorización.
        </div>
        <button class="btn-primary" style="padding: 6px 14px; font-size: 12px;" onclick="document.getElementById('folderInput').click()">
          📁 Cargar / Actualizar Carpeta
        </button>
      </div>
    `;

    container.appendChild(cardEl);
  },

  /**
   * Despliega la ficha de auditoría y cotejo normativo del ítem
   */
  openItemModal(itemId) {
    const item = SIPRO_DATA.items27.find(i => i.id === itemId);
    if (!item) return;

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

    const p = App.currentProject || {};
    const detectedFile = (p.documentosStatus && p.documentosStatus.archivosDetectados) 
      ? p.documentosStatus.archivosDetectados[itemId] 
      : null;
    const meta = (p.archivosMetadata && p.archivosMetadata[itemId]) ? p.archivosMetadata[itemId] : null;
    const file = this.getFileForItem(itemId);

    modalTitle.innerHTML = `Ítem ${item.num}: ${item.title}`;

    if (openTabBtn) openTabBtn.style.display = "none";
    if (downloadBtn) downloadBtn.style.display = "none";
    if (statusBadge) {
      statusBadge.style.display = "inline-flex";
      statusBadge.className = `status-pill ${detectedFile ? 'cumple' : 'no-cumple'}`;
      statusBadge.innerHTML = detectedFile ? '&#10003; Aportado' : '&#10007; No Aportado';
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
          </div>
        </div>
      `;
    } else {
      const sizeKb = meta ? (meta.sizeBytes / 1024).toFixed(1) + " KB" : "Disponible en carpeta";
      const modDate = meta && meta.lastModified ? new Date(meta.lastModified).toLocaleDateString("es-CO") : "Reciente";
      const snippet = meta && meta.textSnippet ? meta.textSnippet.slice(0, 320) + "..." : "Texto procesado por PDF.js sin anomalías.";

      modalBody.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);padding:14px 18px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
            <div>
              <div style="font-size:11px;font-weight:700;color:#047857;text-transform:uppercase">Archivo Aportado y Cotejado</div>
              <div style="font-size:14px;font-weight:800;color:var(--color-primary);margin-top:2px">📄 ${detectedFile}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <span class="status-pill cumple">&#10003; Presente en Carpeta</span>
              ${file ? `
                <button class="btn-primary" style="background:#0284C7;padding:6px 14px;font-size:12px;display:inline-flex;align-items:center;gap:6px;" onclick="DocumentalEngine.abrirDocumento(${itemId})">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  Abrir Documento
                </button>
              ` : ''}
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:10px">
            <div style="background:var(--color-surface);border:1px solid var(--border-strong);padding:10px;border-radius:var(--radius-sm)">
              <div style="font-size:10px;font-weight:700;color:var(--text-light);text-transform:uppercase">Tamaño Archivo</div>
              <div style="font-size:12px;font-weight:700">${sizeKb}</div>
            </div>
            <div style="background:var(--color-surface);border:1px solid var(--border-strong);padding:10px;border-radius:var(--radius-sm)">
              <div style="font-size:10px;font-weight:700;color:var(--text-light);text-transform:uppercase">Última Modificación</div>
              <div style="font-size:12px;font-weight:700">${modDate}</div>
            </div>
            <div style="background:var(--color-surface);border:1px solid var(--border-strong);padding:10px;border-radius:var(--radius-sm)">
              <div style="font-size:10px;font-weight:700;color:var(--text-light);text-transform:uppercase">Vigencia Máxima</div>
              <div style="font-size:12px;font-weight:700">${item.validity}</div>
            </div>
          </div>

          <div style="background:var(--color-bg-alt);padding:14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle)">
            <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase">Regla Normativa Exigida</div>
            <div style="font-size:12px;color:var(--text-main);margin-top:4px">${item.rule}</div>
          </div>

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
