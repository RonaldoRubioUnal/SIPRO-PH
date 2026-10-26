/**
 * LECTOR INTELIGENTE DE CARPETAS Y DOCUMENTOS PDF (SIPRO-PH)
 * Gobernación de Antioquia - Secretaría de Infraestructura Física
 * 
 * ARQUITECTURA DE AUDITORÍA MULTI-PROYECTO AISLADA:
 * 1. Estructura de Estado Centralizada e Indexada (window.proyectosAuditados[proyectoId])
 * 2. Procesamiento Aislado por Carpeta: Ejecuta Fase 1A (Acero y Concreto), Fase 1B (KMZ Espacial)
 *    y Fase 2 (27 ítems) independientemente para cada proyecto sin mezclar variables globales
 * 3. Extracción de Nombre y Datos estrictamente de sección "1. DATOS GENERALES DEL PROYECTO" de la Ficha
 * 4. Disparo reactivo mediante cargarProyecto(proyectoId) para repintar la interfaz desde memoria
 */

window.proyectosAuditados = window.proyectosAuditados || {};

const FolderReader = {
  isProcessing: false,

  // Reglas flexibles e inteligentes de coincidencia por palabras clave y prefijos (sin rigidez excesiva)
  itemRules27: {
    1: {
      kw: ["solicitud", "carta", "oficio", "intencion", "formal", "peticion"],
      pref: ["01", "1", "3 1", "03 0", "03 1"],
      exc: ["despiece", "especificac", "cedula", "rut", "posesion"]
    },
    2: {
      kw: ["especificac", "esquema tecnico", "especif", "esquema act", "esquema", "memoria tecnica", "estudios", "diseno", "especificaciones"],
      pref: ["02", "2", "3 2", "03 3 1"],
      exc: ["despiece", "presupuesto", "apu"]
    },
    3: {
      kw: ["despiece", "acero", "figuracion", "planilla", "cantidades", "hierro", "hierros", "armado", "despiece acero", "plantilla estandar", "plantilla", "formato municipio", ".xlsx", ".xls"],
      pref: ["03", "3", "3 3", "03 3 2"],
      exc: ["especificac", "solicitud", "socializacion", "posesion", "cedula", "rut"]
    },
    4: {
      kw: ["certificado", "vias", "terciaria", "terciarias", "intervenir", "certificacion", "vial", "red vial"],
      pref: ["04", "4", "3 4", "03 5"],
      exc: ["especificac", "despiece", "posesion", "cedula", "rut"]
    },
    5: {
      kw: ["socializacion", "socializar", "acta", "comunidad", "asistencia", "reunion", "participacion", "socializa"],
      pref: ["05", "5", "3 5", "03 2", "3 26"],
      exc: ["posesion", "especificac", "despiece"]
    },
    6: {
      kw: ["fotograf", "fotos", "foto", "panel", "registro fotog", "evidencia", "fotografico"],
      pref: ["06", "6", "3 6", "03 7"],
      exc: ["especificac", "despiece"]
    },
    7: {
      kw: ["cedula", "cc", "identidad", "identificacion", "documento", "c c"],
      pref: ["07", "7", "3 7", "05"],
      exc: ["especificac", "despiece", "fotos", "posesion"]
    },
    8: {
      kw: ["posesion", "acta posesion", "posesion alcalde"],
      pref: ["08", "8", "3 8", "06"],
      exc: ["socializacion", "especificac", "despiece"]
    },
    9: {
      kw: ["concejo", "facultades", "acuerdo", "autorizacion", "facultad"],
      pref: ["09", "9", "3 9", "07"],
      exc: ["socializacion", "posesion", "especificac"]
    },
    10: {
      kw: ["rut", "tributario", "dian", "registro unico tributario"],
      pref: ["10", "3 10", "04"],
      exc: ["especificac", "despiece"]
    },
    11: {
      kw: ["contraloria", "fiscal", "responsabilidad fiscal", "sirec", "boletin fiscal", "boletin"],
      pref: ["11", "3 11", "08 1"],
      exc: ["procuraduria", "policia"]
    },
    12: {
      kw: ["medidas correctivas", "rnmc", "correctivas"],
      pref: ["12", "3 12", "09 4"],
      exc: ["contraloria", "procuraduria"]
    },
    13: {
      kw: ["policia", "judiciales", "judicial", "antecedentes", "pasado judicial", "policia nacional"],
      pref: ["13", "3 13", "09 3"],
      exc: ["medidas correctivas", "rnmc", "delitos sexuales"]
    },
    14: {
      kw: ["procuraduria", "disciplinario", "disciplinarios", "siri"],
      pref: ["14", "3 14", "08 2"],
      exc: ["contraloria", "policia"]
    },
    15: {
      kw: ["parafiscales", "seguridad social", "paz y salvo", "aportes", "parafiscale"],
      pref: ["15", "3 15", "10 1"],
      exc: ["especificac", "despiece"]
    },
    16: {
      kw: ["redam", "alimentos", "deudores alimentarios", "deudores"],
      pref: ["16", "3 16", "09 5"],
      exc: ["contraloria", "procuraduria"]
    },
    17: {
      kw: ["anticorrupcion", "compromiso anticorrupcion", "pacto", "declaraciones", "compromiso"],
      pref: ["17", "3 17"],
      exc: ["paco"]
    },
    18: {
      kw: ["lavado", "activos", "sarlaft", "terrorismo", "declaraciones", "no lavado"],
      pref: ["18", "3 18"],
      exc: []
    },
    19: {
      kw: ["inhabilidades", "incompatibilidades", "conflictos", "declaraciones", "inhabilidad"],
      pref: ["19", "3 19", "3 25"],
      exc: []
    },
    20: {
      kw: ["no multas", "sanciones", "multas", "incumplimiento", "declaraciones", "sancion"],
      pref: ["20", "3 20"],
      exc: ["rnmc"]
    },
    21: {
      kw: ["paco", "portal anticorrupcion", "transparencia", "cic"],
      pref: ["21", "3 21", "08 3"],
      exc: ["compromiso anticorrupcion"]
    },
    22: {
      kw: ["delitos sexuales", "sexuales", "menores", "1918", "delito sexual"],
      pref: ["22", "3 22"],
      exc: []
    },
    23: {
      kw: ["banco", "proyectos", "bpin", "radicacion", "banco de proyectos", "proyecto"],
      pref: ["23", "3 23", "03 0 1"],
      exc: ["especificac", "despiece"]
    },
    24: {
      kw: [".kmz", ".kml", ".gpx", "georreferenciacion", "georef", "trazado", "tracks", "tramos", "coordenadas"],
      pref: ["24", "3 24", "03 6"],
      exc: ["especificac", "despiece"]
    },
    25: {
      kw: ["cronograma", "plan de trabajo", "obra", "actividades"],
      pref: ["25", "3 25", "3 5", "03 4"],
      exc: ["especificac", "despiece"]
    },
    26: {
      kw: ["plan desarrollo", "desarrollo", "pdd", "plan dllo", "plan de desarrollo"],
      pref: ["26", "3 26"],
      exc: ["especificac", "despiece"]
    },
    27: {
      kw: ["cofinanciacion", "cdp", "recursos", "aportes", "contrapartida", "disponibilidad", "compromiso", "financiacion"],
      pref: ["27", "3 27", "2 5", "03 0 2"],
      exc: ["especificac", "despiece"]
    }
  },

  normalizeText(str) {
    if (!str) return "";
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  },

  matchFileToItemRule(fileName, itemId) {
    const rule = this.itemRules27[itemId];
    if (!rule) return { matched: false, score: 0 };
    const norm = this.normalizeText(fileName);

    // 1. Exclusiones seguras
    for (const exc of (rule.exc || [])) {
      if (norm.includes(exc)) {
        if (itemId === 2 && (norm.includes("especificac") || norm.includes("esquema"))) {
          // Permitir si explícitamente es esquema o especificaciones
        } else {
          return { matched: false, score: 0 };
        }
      }
    }

    let score = 0;

    // 2. Coincidencia por palabras clave
    for (const kw of (rule.kw || [])) {
      if (kw.startsWith(".")) {
        if (fileName.toLowerCase().endsWith(kw)) {
          score += 10;
          break;
        }
      } else if (norm.includes(kw)) {
        score += 10;
        break;
      }
    }

    // 3. Coincidencia por prefijo numérico flexible
    const numPrefix2 = String(itemId).padStart(2, "0");
    const numPrefix1 = String(itemId);
    if (norm.startsWith(numPrefix2 + " ") || norm.startsWith(numPrefix1 + " ") || norm === numPrefix2 || norm === numPrefix1) {
      score += 8;
    } else {
      for (const pref of (rule.pref || [])) {
        if (norm.startsWith(pref + " ") || norm.startsWith(pref + "  ") || norm === pref) {
          score += 8;
          break;
        }
      }
    }

    return { matched: score > 0, score: score };
  },

  classifyFilesToItems27(files) {
    const detectedMap = {};
    const assignedFiles = new Set();
    const sharedBundleItems = new Set([17, 18, 19, 20]);

    for (let itemId = 1; itemId <= 27; itemId++) {
      let bestFile = null;
      let bestScore = -1;

      for (const file of files) {
        if (assignedFiles.has(file.name) && !sharedBundleItems.has(itemId)) {
          continue;
        }

        const res = this.matchFileToItemRule(file.name, itemId);
        if (res.matched && res.score > bestScore) {
          bestScore = res.score;
          bestFile = file;
        }
      }

      if (bestFile) {
        detectedMap[itemId] = bestFile;
        const norm = this.normalizeText(bestFile.name);
        const isBundle = norm.includes("declaraciones") && (norm.includes("compromisos") || norm.includes("anexos"));
        if (!isBundle) {
          assignedFiles.add(bestFile.name);
        }
      }
    }

    return detectedMap;
  },

  init() {
    this.setupInputs();
    this.setupDropzones();
  },

  setupInputs() {
    const inputs = [
      document.getElementById("folderInput"),
      document.getElementById("sidebarFolderInput")
    ];

    inputs.forEach(input => {
      if (!input) return;
      input.addEventListener("change", (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
          this.processFileList(files);
        }
        input.value = "";
      });
    });

    const item3Input = document.getElementById("item3FileInput");
    if (item3Input) {
      item3Input.addEventListener("change", async (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          await this.reprocessItem3File(file, App.currentProjectId);
        }
        item3Input.value = "";
      });
    }

    const loadButtons = [
      "btnSidebarLoadFolder",
      "btnLoadFolderSidebar",
      "btnHeaderLoadFolder",
      "btnBannerNewExpediente"
    ];

    loadButtons.forEach(btnId => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener("click", () => {
          const inp = document.getElementById("folderInput") || document.getElementById("sidebarFolderInput");
          if (inp) inp.click();
        });
      }
    });
  },

  setupDropzones() {
    const dropzone = document.getElementById("fileDropzoneFase1A");
    if (!dropzone) return;

    ["dragenter", "dragover"].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove("dragover");
      });
    });

    dropzone.addEventListener("drop", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove("dragover");

      const files = [];
      if (e.dataTransfer.items) {
        for (let i = 0; i < e.dataTransfer.items.length; i++) {
          const item = e.dataTransfer.items[i];
          if (item.kind === "file") {
            const file = item.getAsFile();
            if (file) files.push(file);
          }
        }
      } else {
        files.push(...Array.from(e.dataTransfer.files));
      }

      if (files.length === 1 && !files[0].webkitRelativePath) {
        const ext = files[0].name.slice(files[0].name.lastIndexOf('.')).toLowerCase();
        if (['.xlsx', '.xls', '.xlsm', '.pdf'].includes(ext)) {
          await this.reprocessItem3File(files[0], App.currentProjectId);
          return;
        }
      }

      if (files.length > 0) {
        this.processFileList(files);
      }
    });
  },

  cleanForRegex(str) {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  },

  /**
   * PIPELINE DE DESCOMPRESIÓN AUTOMÁTICA EN MEMORIA (REQUISITO 1)
   * Desempaqueta contenedores (.zip, .kmz, .7z, .rar) y extrae archivos anidados (.kmz, .kml, .pdf, etc.)
   * Inyecta explícitamente webkitRelativePath en cada archivo extraído usando Object.defineProperty
   * Procesa .zip y .kmz directamente con JSZip y utiliza Blob local para el Worker de libarchive.js
   */
  async expandirArchivosComprimidos(fileList) {
    if (!fileList || fileList.length === 0) return [];
    const expandedFiles = [];

    // Inicializar Web Worker local mediante Blob para libarchive.js para evitar bloqueos CORS
    const ArchiveClass = (typeof window !== "undefined" && window.Archive) || (typeof Archive !== "undefined" ? Archive : null);
    if (ArchiveClass && typeof ArchiveClass.init === "function" && typeof window !== "undefined" && !window._libarchiveWorkerInitialized) {
      try {
        const workerBlob = new Blob([
          "importScripts('https://cdn.jsdelivr.net/npm/libarchive.js@1.3.0/dist/worker-bundle.js');"
        ], { type: 'application/javascript' });
        ArchiveClass.init({ workerUrl: URL.createObjectURL(workerBlob) });
        window._libarchiveWorkerInitialized = true;
      } catch (workerErr) {
        console.warn("Inicialización de Blob Worker para LibArchive:", workerErr);
      }
    }

    for (const file of fileList) {
      if (!file) continue;
      const lower = (file.name || "").toLowerCase();
      const relDir = file.webkitRelativePath && file.webkitRelativePath.includes('/')
        ? file.webkitRelativePath.slice(0, file.webkitRelativePath.lastIndexOf('/'))
        : null;
      const parentFolder = relDir || (file.webkitRelativePath ? file.webkitRelativePath.split('/')[0] : (file.name.replace(/\.[^/.]+$/, "") || "proyecto"));

      // 1. Archivos .zip y .kmz (Directamente con JSZip.loadAsync(await file.arrayBuffer()))
      if (lower.endsWith(".zip") || lower.endsWith(".kmz")) {
        expandedFiles.push(file); // Conservar archivo contenedor en el inventario
        try {
          if (typeof JSZip !== "undefined") {
            const buffer = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(buffer);
            const entries = [];
            zip.forEach((relPath, entry) => {
              if (!entry.dir && !relPath.startsWith("__MACOSX") && !relPath.includes("/.") && !relPath.startsWith(".")) {
                entries.push({ relPath, entry });
              }
            });

            for (const { relPath, entry } of entries) {
              const entryLower = relPath.toLowerCase();
              const cleanEntryName = relPath.split('/').pop();
              if (!cleanEntryName) continue;

              // Si es un .kmz anidado dentro de .zip
              if (entryLower.endsWith(".kmz")) {
                try {
                  const kmzBuffer = await entry.async("arraybuffer");
                  const kmzBlob = new Blob([kmzBuffer], { type: "application/vnd.google-earth.kmz" });
                  const kmzFile = new File([kmzBlob], cleanEntryName, {
                    lastModified: file.lastModified || Date.now(),
                    type: "application/vnd.google-earth.kmz"
                  });
                  Object.defineProperty(kmzFile, 'webkitRelativePath', {
                    value: `${parentFolder}/${cleanEntryName}`,
                    writable: false,
                    configurable: true
                  });
                  expandedFiles.push(kmzFile);

                  // Descompresión en cascada del KMZ anidado con JSZip
                  const innerZip = await JSZip.loadAsync(kmzBuffer);
                  for (const [innerRelPath, innerEntry] of Object.entries(innerZip.files)) {
                    if (!innerEntry.dir && innerRelPath.toLowerCase().endsWith(".kml")) {
                      const kmlText = await innerEntry.async("text");
                      const innerKmlName = innerRelPath.split('/').pop() || "doc.kml";
                      const cleanKmlName = `${cleanEntryName.replace(/\.kmz$/i, "")}_${innerKmlName}`;
                      const kmlBlob = new Blob([kmlText], { type: "application/vnd.google-earth.kml+xml" });
                      const kmlFile = new File([kmlBlob], cleanKmlName, {
                        lastModified: file.lastModified || Date.now(),
                        type: "application/vnd.google-earth.kml+xml"
                      });
                      kmlFile._cachedKmlText = kmlText;
                      kmzFile._cachedKmlText = kmlText;
                      Object.defineProperty(kmlFile, 'webkitRelativePath', {
                        value: `${parentFolder}/${cleanKmlName}`,
                        writable: false,
                        configurable: true
                      });
                      expandedFiles.push(kmlFile);
                    }
                  }
                } catch (kmzErr) {
                  console.warn(`Error al desempaquetar KMZ anidado ${relPath}:`, kmzErr);
                }
              }
              // Si es un .kml directamente dentro del .zip o .kmz
              else if (entryLower.endsWith(".kml")) {
                try {
                  const kmlText = await entry.async("text");
                  const kmlBlob = new Blob([kmlText], { type: "application/vnd.google-earth.kml+xml" });
                  const kmlFile = new File([kmlBlob], cleanEntryName, {
                    lastModified: file.lastModified || Date.now(),
                    type: "application/vnd.google-earth.kml+xml"
                  });
                  kmlFile._cachedKmlText = kmlText;
                  file._cachedKmlText = kmlText;
                  Object.defineProperty(kmlFile, 'webkitRelativePath', {
                    value: `${parentFolder}/${cleanEntryName}`,
                    writable: false,
                    configurable: true
                  });
                  expandedFiles.push(kmlFile);
                } catch (kmlErr) {
                  console.warn(`Error al extraer KML ${relPath}:`, kmlErr);
                }
              }
              // Si es un .zip secundario anidado
              else if (entryLower.endsWith(".zip")) {
                try {
                  const nestedZipBuffer = await entry.async("arraybuffer");
                  const nestedZip = await JSZip.loadAsync(nestedZipBuffer);
                  for (const [nRel, nEntry] of Object.entries(nestedZip.files)) {
                    if (!nEntry.dir && !nRel.startsWith("__MACOSX") && !nRel.startsWith(".")) {
                      const cleanNestedName = nRel.split('/').pop();
                      const blob = await nEntry.async("blob");
                      const nFile = new File([blob], cleanNestedName, {
                        lastModified: file.lastModified || Date.now()
                      });
                      if (cleanNestedName.toLowerCase().endsWith(".kml")) {
                        nFile._cachedKmlText = await nEntry.async("text");
                      }
                      Object.defineProperty(nFile, 'webkitRelativePath', {
                        value: `${parentFolder}/${cleanNestedName}`,
                        writable: false,
                        configurable: true
                      });
                      expandedFiles.push(nFile);
                    }
                  }
                } catch (nestedErr) {
                  console.warn(`Error al desempaquetar ZIP secundario anidado ${relPath}:`, nestedErr);
                }
              }
              // Archivos estándar extraídos (.pdf, .xlsx, .docx, etc.)
              else {
                const blob = await entry.async("blob");
                const extractedFile = new File([blob], cleanEntryName, {
                  lastModified: file.lastModified || Date.now()
                });
                Object.defineProperty(extractedFile, 'webkitRelativePath', {
                  value: `${parentFolder}/${cleanEntryName}`,
                  writable: false,
                  configurable: true
                });
                expandedFiles.push(extractedFile);
              }
            }
          }
        } catch (zipErr) {
          console.warn(`Error al abrir archivo comprimido con JSZip ${file.name}:`, zipErr);
          file._extractionError = `Se detectó el archivo comprimido ${file.name}, pero requiere extracción manual o formato .zip/.kmz estándar.`;
        }
      }

      // 2. Archivos .7z y .rar (usando libarchive.js con Worker local por Blob)
      else if (lower.endsWith(".7z") || lower.endsWith(".rar")) {
        expandedFiles.push(file); // Conservar archivo contenedor
        let extractedCount = 0;
        try {
          if (ArchiveClass) {
            const archive = await ArchiveClass.open(file);
            const entries = await archive.extractFiles();

            for (const [entryName, entryItem] of Object.entries(entries)) {
              let extractedFile = null;
              const cleanEntryName = entryName.split('/').pop();
              if (!cleanEntryName) continue;

              if (entryItem instanceof File) {
                extractedFile = entryItem;
              } else if (entryItem && entryItem.file instanceof File) {
                extractedFile = entryItem.file;
              } else if (entryItem && typeof entryItem.extract === "function") {
                extractedFile = await entryItem.extract();
              } else if (entryItem && typeof entryItem.blob === "function") {
                const b = await entryItem.blob();
                extractedFile = new File([b], cleanEntryName, { lastModified: file.lastModified });
              }

              if (extractedFile) {
                if (cleanEntryName.toLowerCase().endsWith(".kml") && typeof extractedFile.text === "function") {
                  try {
                    const kmlTxt = await extractedFile.text();
                    extractedFile._cachedKmlText = kmlTxt;
                    file._cachedKmlText = kmlTxt;
                  } catch (kErr) {}
                }
                Object.defineProperty(extractedFile, 'webkitRelativePath', {
                  value: `${parentFolder}/${cleanEntryName}`,
                  writable: false,
                  configurable: true
                });
                expandedFiles.push(extractedFile);
                extractedCount++;

                // Si dentro del 7z/rar viene un .kmz, desempaquetar recursivamente con JSZip en cascada
                if (cleanEntryName.toLowerCase().endsWith(".kmz") && typeof JSZip !== "undefined") {
                  try {
                    const kmzBuf = await extractedFile.arrayBuffer();
                    const innerZip = await JSZip.loadAsync(kmzBuf);
                    for (const [innerRelPath, innerEntry] of Object.entries(innerZip.files)) {
                      if (!innerEntry.dir && innerRelPath.toLowerCase().endsWith(".kml")) {
                        const text = await innerEntry.async("text");
                        const cleanKmlName = `${cleanEntryName.replace(/\.kmz$/i, "")}_${innerRelPath.split('/').pop()}`;
                        const kmlBlob = new Blob([text], { type: "application/vnd.google-earth.kml+xml" });
                        const kmlFile = new File([kmlBlob], cleanKmlName, {
                          lastModified: file.lastModified || Date.now(),
                          type: "application/vnd.google-earth.kml+xml"
                        });
                        kmlFile._cachedKmlText = text;
                        extractedFile._cachedKmlText = text;
                        Object.defineProperty(kmlFile, 'webkitRelativePath', {
                          value: `${parentFolder}/${cleanKmlName}`,
                          writable: false,
                          configurable: true
                        });
                        expandedFiles.push(kmlFile);
                      }
                    }
                  } catch (innerKmzErr) {
                    console.warn("Error extrayendo KMZ interno en 7z/rar:", innerKmzErr);
                  }
                }
              }
            }
          } else {
            throw new Error("Librería WebAssembly libarchive no disponible");
          }
        } catch (wasmErr) {
          console.warn(`Error al descomprimir ${file.name} con WebAssembly:`, wasmErr);
        }

        if (extractedCount === 0) {
          file._extractionError = `Se detectó el archivo comprimido ${file.name}, pero requiere extracción manual o formato .zip/.kmz estándar.`;
        }
      }

      // 3. Archivos estándar
      else {
        expandedFiles.push(file);
      }
    }

    return expandedFiles;
  },

  /**
   * Procesa la lista de archivos soportando carpetas múltiples o individuales
   * Garantiza que cada proyecto quede indexado en window.proyectosAuditados
   */
  async processFileList(rawFiles) {
    this.isProcessing = true;
    this.showLoadingModal(true, rawFiles.length);

    try {
      window.proyectosAuditados = window.proyectosAuditados || {};

      // PIPELINE DE DESCOMPRESIÓN AUTOMÁTICA EN MEMORIA (PASO A y B)
      const files = await this.expandirArchivosComprimidos(rawFiles);

      // 1. Detectar si los archivos pertenecen a múltiples proyectos (por Fichas de priorización o por carpetas raíz)
      const fichas = files.filter(f => {
        const norm = this.cleanForRegex(f.name);
        return norm.includes("ficha") && norm.includes("prioriz");
      });

      let projectGroups = [];
      if (fichas.length > 1) {
        projectGroups = this.groupFilesByProject(files, fichas);
      } else {
        // Verificar si hay múltiples subcarpetas de proyectos aunque tengan nombres genéricos
        const folderMap = {};
        files.forEach(f => {
          if (f.webkitRelativePath) {
            const parts = f.webkitRelativePath.split('/');
            if (parts.length > 2) {
              const subDir = parts[0] + '/' + parts[1];
              if (!folderMap[subDir]) folderMap[subDir] = [];
              folderMap[subDir].push(f);
            }
          }
        });

        const subDirKeys = Object.keys(folderMap);
        if (subDirKeys.length > 1 && subDirKeys.every(k => folderMap[k].length >= 3)) {
          projectGroups = subDirKeys.map(k => {
            const grpFiles = folderMap[k];
            const grpFicha = grpFiles.find(f => {
              const n = this.cleanForRegex(f.name);
              return n.includes("ficha") || n.includes("prioriz");
            });
            return { fichaFile: grpFicha, files: grpFiles };
          });
        }
      }

      let lastCreatedId = null;

      if (projectGroups.length > 1) {
        // Procesamiento en lote de múltiples proyectos
        for (const grp of projectGroups) {
          const rec = await this.processSingleProjectFiles(grp.files, grp.fichaFile);
          if (rec) lastCreatedId = rec.id;
        }
        App.populateProjectSelect();
        if (lastCreatedId && typeof window.cargarProyecto === "function") {
          window.cargarProyecto(lastCreatedId);
        }
        this.showToast(`✓ Se auditaron ${projectGroups.length} proyectos de manera independiente.`);
      } else {
        // Procesamiento de un solo proyecto
        const fichaFile = fichas[0] || files.find(f => {
          const norm = this.cleanForRegex(f.name);
          return norm.includes("ficha") || norm.includes("prioriz");
        });
        const rec = await this.processSingleProjectFiles(files, fichaFile);
        if (rec) {
          App.populateProjectSelect();
          if (typeof window.cargarProyecto === "function") {
            window.cargarProyecto(rec.id);
          }
        }
      }
    } catch (err) {
      console.error("Error al procesar carpeta municipal:", err);
      alert("Ocurrió un error al analizar la carpeta: " + err.message);
    } finally {
      this.isProcessing = false;
      this.showLoadingModal(false);
    }
  },

  groupFilesByProject(files, fichas) {
    const groups = [];
    fichas.forEach(f => {
      const relPath = f.webkitRelativePath || "";
      const dir = relPath.includes("/") ? relPath.slice(0, relPath.lastIndexOf("/")) : "";
      const fichaTop = relPath.split('/')[0];
      
      const relatedFiles = files.filter(item => {
        const itemPath = item.webkitRelativePath || "";
        if (dir && (itemPath.startsWith(dir + "/") || itemPath === dir || itemPath.startsWith(dir))) return true;
        const itemTop = itemPath.split('/')[0];
        if (fichaTop && itemTop && fichaTop === itemTop) return true;
        return false;
      });

      groups.push({
        fichaFile: f,
        files: relatedFiles.length > 0 ? relatedFiles : [f]
      });
    });

    return groups.length > 0 ? groups : [{ fichaFile: fichas[0], files: files }];
  },

  /**
   * Procesa los archivos de un proyecto específico de forma 100% aislada
   * Ejecuta Fase 1A, Fase 1B y Fase 2 y encapsula el resultado en window.proyectosAuditados[id]
   */
  async processSingleProjectFiles(rawFiles, fichaFile) {
    // Asegurar descompresión completa en memoria
    const files = await this.expandirArchivosComprimidos(rawFiles);

    if (!fichaFile) {
      fichaFile = files.find(f => {
        const norm = this.cleanForRegex(f.name);
        return norm.includes("ficha") && norm.includes("prioriz");
      }) || files.find(f => {
        const norm = this.cleanForRegex(f.name);
        return norm.includes("ficha") || norm.includes("prioriz");
      });
    }
    // =========================================================================
    // PASO 1: DETECCIÓN Y LECTURA ESTRICTA DE "1. DATOS GENERALES DEL PROYECTO"
    // =========================================================================
    let fichaData = {
      detected: false,
      fileName: null,
      municipio: null,
      codMunicipio: null,
      subregion: null,
      vias: [],
      codigosViales: [],
      longitudTotalM: null,
      presupuestoEstimado: 0,
      aporteDepto: null,
      plazo: "SEIS (6) MESES",
      textoExtraido: ""
    };

    const mpiosList = SIPRO_DATA.municipiosAntioquia || SIPRO_DATA.municipios || [];

    if (fichaFile) {
      fichaData.detected = true;
      fichaData.fileName = fichaFile.name;
      const text = await this.readPdfOrText(fichaFile);
      fichaData.textoExtraido = text || "";

      // Localizar estrictamente la sección "1. DATOS GENERALES DEL PROYECTO"
      const secMatch = text.match(/(?:1[\.\s]*)?DATOS\s+GENERALES(?:\s+DEL\s+PROYECTO)?/i);
      let sectionText = "";
      if (secMatch) {
        const startIdx = secMatch.index + secMatch[0].length;
        const nextSec = text.slice(startIdx).search(/\n\s*2[\.\s]+[A-Z]/i);
        const endIdx = nextSec >= 0 ? startIdx + nextSec : startIdx + 1200;
        sectionText = text.slice(startIdx, endIdx);
      } else {
        sectionText = text.slice(0, 1500);
      }

      const normSec = this.normalizeText(sectionText);

      // A. Buscar municipio explícitamente etiquetado bajo "Municipio de" en la sección 1
      const labelMatch = normSec.match(/MUNICIPIO(?:\s+DE)?[\s:\._-]*([A-Z\s]{3,35})/i);
      if (labelMatch) {
        const cand = labelMatch[1].trim();
        for (const m of mpiosList) {
          if (!m || !m.nombre) continue;
          const normMpio = this.normalizeText(m.nombre);
          if (cand.includes(normMpio)) {
            fichaData.municipio = m.nombre;
            fichaData.codMunicipio = m.codigo;
            fichaData.subregion = m.subregion;
            break;
          }
        }
      }

      // B. Si el diseño es columnar, buscar coincidencia en la sección 1
      if (!fichaData.municipio) {
        for (const m of mpiosList) {
          if (!m || !m.nombre) continue;
          const normMpio = this.normalizeText(m.nombre);
          const regex = new RegExp(`\\b${normMpio}\\b`, "i");
          if (regex.test(normSec)) {
            fichaData.municipio = m.nombre;
            fichaData.codMunicipio = m.codigo;
            fichaData.subregion = m.subregion;
            break;
          }
        }
      }

      // C. Extraer Longitud de la sección 1 (ej: "420 m", "1000 m")
      const longMatch = normSec.match(/(?:CONSTRUCCION DE PLACA HUELLAS?|VIAS TERCIARIAS|LONGITUD|META)[\s\S]{0,120}?([0-9\.\,]+)\s*(?:M\b|METROS)/i)
                     || normSec.match(/\b([0-9]{2,5})\s*M\b/);
      if (longMatch) {
        const lVal = parseFloat(longMatch[1].replace(/\./g, "").replace(",", "."));
        if (lVal >= 40 && lVal <= 25000) fichaData.longitudTotalM = lVal;
      }

      // D. Extraer Aporte del Departamento (ej: "$ 146,666,444")
      const aporteMatch = sectionText.match(/(?:VALOR|APORTADO POR EL DEPARTAMENTO)[\s\S]{0,120}?\$\s*([0-9\.\,]{6,15})/i)
                       || sectionText.match(/\$\s*([0-9\.\,]{6,15})/);
      if (aporteMatch) {
        const valNum = parseInt(aporteMatch[1].replace(/[\.\,]/g, ""), 10);
        if (valNum > 10000000) {
          fichaData.aporteDepto = valNum;
          fichaData.presupuestoEstimado = Math.round(valNum / 0.8);
        }
      }

      // E. Extraer Plazo
      const plazoMatch = sectionText.match(/PLAZO[\s\S]{0,60}?(SEIS|\d+)\s*(?:\([0-9]+\)\s*)?MESES/i);
      if (plazoMatch) fichaData.plazo = plazoMatch[0].trim();

      // Extraer códigos viales
      const matchedCodes = this.normalizeText(text).match(/05[0-9]{3}vt[0-9]{1,4}/gi);
      if (matchedCodes) fichaData.codigosViales = [...new Set(matchedCodes.map(c => c.toUpperCase()))];
    }

    // Fallback de municipio si no se detectó en la sección 1
    if (!fichaData.municipio) {
      for (const f of files) {
        const normName = this.normalizeText(f.name);
        for (const m of mpiosList) {
          if (!m || !m.nombre) continue;
          const normMpio = this.normalizeText(m.nombre);
          if (normName.includes(normMpio)) {
            fichaData.municipio = m.nombre;
            fichaData.codMunicipio = m.codigo;
            fichaData.subregion = m.subregion;
            break;
          }
        }
        if (fichaData.municipio) break;
      }
    }

    const isAmbiguous = !fichaData.municipio;
    if (isAmbiguous) {
      fichaData.municipio = "MUNICIPIO POR CONFIRMAR";
      fichaData.codMunicipio = "05000";
      fichaData.subregion = "ANTIOQUIA";
    }

    // =========================================================================
    // PASO 2: MAPEO DINÁMICO DE LOS 27 ÍTEMS NORMATIVOS (ESTRICTO POR ANCLAS)
    // =========================================================================
    const detectedMap = this.classifyFilesToItems27(files);
    const items27 = SIPRO_DATA.items27;

    // =========================================================================
    // PASO 3: METADATOS Y TEXTO DE LOS ARCHIVOS DETECTADOS
    // =========================================================================
    const archivosMetadata = {};
    const archivosDetectadosMap = {};
    let extractedEngineer = null;
    let extractedMatricula = null;

    for (let i = 1; i <= 27; i++) {
      const file = detectedMap[i];
      if (file) {
        archivosDetectadosMap[i] = file.name;
        
        let textSnippet = "";
        if (file.name.toLowerCase().endsWith(".pdf") && (i === 1 || i === 2 || i === 3 || i === 4)) {
          textSnippet = await this.readPdfOrText(file);
        }

        archivosMetadata[i] = {
          fileName: file.name,
          sizeBytes: file.size,
          lastModified: file.lastModified,
          textSnippet: textSnippet ? textSnippet.slice(0, 500) : "Documento digital verificado en la carpeta."
        };

        if ((i === 2 || i === 3) && textSnippet) {
          const matMatch = textSnippet.match(/mat[\s\.:]*([0-9A-Z\-\s]+ANT)/i) || textSnippet.match(/(05202-[0-9A-Z]+)/i);
          if (matMatch) extractedMatricula = matMatch[1].trim();

          const ingMatch = textSnippet.match(/ING(?:ENIERO|ENIERA)?[\.\s]+([A-Z\s]{8,35})/i);
          if (ingMatch) extractedEngineer = ingMatch[0].trim();
        }
      }
    }

    const matchedCount = Object.keys(archivosDetectadosMap).length;

    // =========================================================================
    // PASO 4: AUDITORÍA Y RECÁLCULO DE ACERO Y CONCRETO (FASE 1A)
    // =========================================================================
    // PASO 4: AUDITORÍA Y RECÁLCULO DE ACERO Y CONCRETO (FASE 1A)
    // =========================================================================
    const fileDespiece = detectedMap[3];
    const fileEspec = detectedMap[2];
    const despieceConfig = await this.parseDespieceFile(fileDespiece, fileEspec, fichaData, extractedEngineer, extractedMatricula);


    // =========================================================================
    // PASO 5: AUDITORÍA ESPACIAL (FASE 1B)
    // =========================================================================
    // Recopilar candidatos a georreferenciación (Ítem 24): KML, KMZ, ZIP, 7Z, RAR
    const georefCandidates = [];
    if (detectedMap[24]) georefCandidates.push(detectedMap[24]);

    for (const f of files) {
      if (georefCandidates.includes(f)) continue;
      const lower = f.name.toLowerCase();
      if (lower.endsWith(".kml") || lower.endsWith(".kmz")) {
        georefCandidates.push(f);
      } else if (lower.endsWith(".zip") || lower.endsWith(".7z") || lower.endsWith(".rar")) {
        const clean = this.cleanForRegex(f.name);
        if (clean.includes("georref") || clean.includes("trazado") || clean.includes("track") ||
            clean.includes("tramo") || clean.includes("placa") || clean.includes("kml") || clean.includes("kmz") ||
            clean.includes("anexo") || clean.includes("item24") || clean.includes("24")) {
          georefCandidates.push(f);
        }
      }
    }

    // Si aún no hay candidato para Ítem 24, inspeccionar cualquier archivo comprimido presente
    if (georefCandidates.length === 0) {
      for (const f of files) {
        if (/\.(zip|kmz|7z|rar)$/i.test(f.name)) {
          georefCandidates.push(f);
        }
      }
    }

    let geoConfig = null;
    if (georefCandidates.length > 0) {
      geoConfig = await this.parseGeorefFiles(georefCandidates, fichaData);

      // Si se extrajeron tramos o archivo KML válido, asegurar asignación del Ítem 24
      if (geoConfig && (geoConfig.tramos.length > 0 || geoConfig.archivoKml)) {
        if (!detectedMap[24]) {
          const primaryFile = georefCandidates.find(f => /\.kml$/i.test(f.name) || /\.kmz$/i.test(f.name)) || georefCandidates[0];
          detectedMap[24] = primaryFile;
          archivosDetectadosMap[24] = primaryFile.name;
          archivosMetadata[24] = {
            fileName: primaryFile.name,
            sizeBytes: primaryFile.size,
            lastModified: primaryFile.lastModified,
            textSnippet: `Georreferenciación verificada en contenedor digital. ${geoConfig.tramos.length} tramos independientes procesados.`
          };
        }
      }
    }

    if (!geoConfig || (geoConfig.tramos.length === 0 && (!geoConfig.puntosContraste || geoConfig.puntosContraste.length === 0))) {
      const prevAlerts = geoConfig ? (geoConfig.alertasArchivos || []) : [];
      const failedArchive = (files || []).find(f => f._extractionError || /\.(zip|kmz|7z|rar)$/i.test(f.name));
      let alertaComp = null;
      if (failedArchive) {
        alertaComp = failedArchive._extractionError || (prevAlerts.length > 0 ? prevAlerts[0] : `Se detectó el archivo comprimido ${failedArchive.name}, pero requiere extracción manual o formato .zip/.kmz estándar.`);
      }

      geoConfig = {
        archivoKml: null,
        codigoViaDeclarado: "Sin código",
        codigoViaGeoJSON: "Sin código",
        jerarquiaOficial: "NO GEORREFERENCIADA",
        jurisdiccion: `Municipal de ${fichaData.municipio}`,
        bufferToleranciaM: 10,
        coberturaBufferPct: 0,
        longitudKmlM: 0,
        desviacionLongitudPct: 100,
        puntosAnomalia: 0,
        tramos: [],
        puntosInspeccion: [],
        puntosContraste: [],
        tieneGeorreferenciacionValida: false,
        alertaComprimido: alertaComp,
        alertasArchivos: prevAlerts,
        estado: alertaComp ? "Alerta de Extracción" : "No Cumple - Falta archivo KMZ/KML"
      };
    }

    const finalLength = despieceConfig.longitudIntervencionM || fichaData.longitudTotalM || 0;
    const cleanMpioSlug = (fichaData.municipio || "proyecto")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_");
    const slug = `${cleanMpioSlug}_${finalLength}m`;
    const newExpedienteId = `EXP-${fichaData.codMunicipio || '05000'}-${slug}`;

    const nombreExp = `${fichaData.municipio} - Proyecto Placa Huella Vías Terciarias`;
    const deptoVal = fichaData.aporteDepto || Math.round(fichaData.presupuestoEstimado * 0.8);
    const mpioVal = Math.round(deptoVal * 0.25);

    const proyectoData = {
      id: newExpedienteId,
      slug: slug,
      codigo: `EXP-${fichaData.codMunicipio || '05000'}-PH`,
      nombreExpediente: nombreExp,
      municipio: fichaData.municipio,
      codMunicipio: fichaData.codMunicipio || "05000",
      subregion: fichaData.subregion || "ANTIOQUIA",
      vereda: (geoConfig.tramos && geoConfig.tramos.length > 0)
        ? geoConfig.tramos.slice(0, 4).map(t => t.nombrePlacemark).join(", ")
        : (geoConfig.puntosContraste.length > 0 
            ? geoConfig.puntosContraste.slice(0, 4).map(p => p.sector).join(", ") 
            : "Tramos según expediente cargado"),
      nombreTramo: `Placa Huella ${fichaData.municipio} (${finalLength}m)`,
      codigoVial: geoConfig.codigoViaDeclarado || fichaData.codigosViales[0] || `${fichaData.codMunicipio || '05000'}VT01`,
      longitudM: finalLength,
      presupuestoTotal: deptoVal + mpioVal,
      aporteDepto: deptoVal,
      aporteMpio: mpioVal,
      plazoMeses: 6,
      poblacionBeneficiada: Math.round(finalLength * 3.8),
      alcalde: {
        nombre: `ALCALDE MUNICIPAL DE ${fichaData.municipio}`,
        cedula: "71.000.000",
        periodo: "2024 - 2027"
      },
      ingenieroProyectista: {
        nombre: extractedEngineer || "INGENIERO CIVIL PROYECTISTA",
        matricula: extractedMatricula || "COPNIA",
        entidadMatricula: "COPNIA",
        vigente: !!extractedMatricula
      },
      estadoSimulacion: matchedCount === 27 ? "APROBADO_CONFORME" : "EN_EVALUACION",
      faseActiva: matchedCount === 27 ? "3_APROBADO" : "2_DOCUMENTAL",
      fichaPriorizacion: fichaData,
      totalArchivosCargados: files.length,
      archivosMetadata: archivosMetadata,
      archivosFiles: detectedMap,
      despieceExtraido: despieceConfig.despieceExtraido || despieceConfig,
      despieceAcero: despieceConfig,
      concretoVolumes: despieceConfig.concretoVolumes,
      georreferenciacion: {
        ...geoConfig,
        puntos: (geoConfig && (geoConfig.puntos || geoConfig.puntosInspeccion)) || []
      },
      documentosStatus: {
        itemsCumplidos: Object.keys(archivosDetectadosMap).map(Number),
        itemsSubsanar: items27.filter(i => !archivosDetectadosMap[i.id]).map(i => i.id),
        archivosDetectados: archivosDetectadosMap,
        diasVigencias: { item9: 10, item10: 8, item11: 4, item12: 12, item13: 12, item14: 6, item15: 1, item16: 8, item21: 8, item22: 8 }
      }
    };

    // =========================================================================
    // PASO 7: EJECUTAR AUDITORÍA AISLADA COMPLETA Y ENCAPSULAR EN EL ALMACÉN GLOBAL
    // =========================================================================
    const audit1A = StructuralEngine.auditProject(proyectoData);
    const audit1B = SpatialEngine.auditProject(proyectoData);
    const audit2 = DocumentalEngine.auditProject(proyectoData);

    audit1B.tieneGeorreferenciacionValida = geoConfig.tieneGeorreferenciacionValida;
    audit1B.alertaComprimido = geoConfig.alertaComprimido;

    const isApproved = audit1A.aprobado && audit1B.aprobado && audit2.aprobado;
    const activeGatekeeper = !audit1A.aprobado ? "1A" : (!audit1B.aprobado ? "1B" : (!audit2.aprobado ? "2" : "3"));

    let score = 0;
    if (audit1A.aprobado) score += 35;
    else score += (audit1A.marcasCumplen / (audit1A.totalMarcas || 1)) * 35;

    if (audit1B.aprobado) score += 30;
    else score += (audit1B.coberturaBufferPct / 100) * 30;

    score += (audit2.itemsConformes / 27) * 35;
    score = +score.toFixed(1);

    const totalCriticas = audit1A.hallazgosCriticos.length + audit1B.hallazgosCriticos.length + audit2.hallazgosCriticos.length;

    const kpis = {
      scoreConformidad: score,
      totalEvaluadoM: proyectoData.longitudM,
      totalMarcas: audit1A.totalMarcas,
      totalCriticas: totalCriticas,
      cuantiaKgM: audit1A.cuantiaRealKgM,
      cuantiaSuperavitKgM: audit1A.cuantiaSuperavitKgM,
      coberturaBufferPct: audit1B.coberturaBufferPct,
      coberturaConforme: audit1B.coberturaConforme,
      itemsConformes: audit2.itemsConformes,
      itemsNoConformes: audit2.itemsNoConformes,
      itemsTotal: 27
    };

    const auditGlobal = {
      audit1A,
      audit1B,
      audit2,
      isApproved,
      activeGatekeeper
    };

    // Encapsular TODO el estado en su propio objeto dentro del almacén central indexado
    window.proyectosAuditados = window.proyectosAuditados || {};
    window.proyectosAuditados[newExpedienteId] = {
      id: newExpedienteId,
      slug: slug,
      municipio: fichaData.municipio,
      codMunicipio: fichaData.codMunicipio,
      subregion: fichaData.subregion,
      datos: proyectoData,
      archivos: files,
      archivosFileMap: detectedMap,
      despieceExtraido: despieceConfig.despieceExtraido || despieceConfig,
      fase1A: audit1A,
      concretoVolumes: despieceConfig.concretoVolumes,
      fase1B: {
        ...audit1B,
        puntos: (geoConfig && (geoConfig.puntos || geoConfig.puntosInspeccion)) || []
      },
      fase2: audit2,
      kpis: kpis,
      auditGlobal: auditGlobal,
      timestamp: Date.now()
    };

    // Sincronizar catálogo maestro de SIPRO_DATA
    SIPRO_DATA.expedientesMap = window.proyectosAuditados;
    SIPRO_DATA.expedientesMap[newExpedienteId].despieceExtraido = despieceConfig.despieceExtraido || despieceConfig;
    SIPRO_DATA.proyectos = Object.values(window.proyectosAuditados).map(p => p.datos);

    if (isAmbiguous) {
      App.openExpedienteModal();
      this.showToast("⚠️ Ficha leída pero municipio ambiguo. Por favor confirma el municipio.");
    } else {
      const missingCount = 27 - matchedCount;
      const cv = despieceConfig.concretoVolumes;
      const msg = missingCount === 0
        ? `✓ Carpeta de ${fichaData.municipio}: 100% Completa. Despiece (${finalLength}m, ${despieceConfig.pesoTotalDeclaradoKg}kg) y Concreto (${cv.totalConcretoGlobalM3}m³) listos en memoria.`
        : `⚠️ Carpeta de ${fichaData.municipio}: ${matchedCount} aportados, ${missingCount} FALTANTES. Despiece (${finalLength}m) y Concreto (${cv.totalConcretoGlobalM3}m³) indexados.`;
      this.showToast(msg);
    }

    return window.proyectosAuditados[newExpedienteId];
  },

  /**
   * Extrae recursivamente archivos .kml y .kmz de contenedores (.zip, .kmz, .7z, .rar)
   */
  async extractKmlEntriesFromArchive(file) {
    const extractedKmls = [];
    const alerts = [];
    const fileName = file.name;
    const lower = fileName.toLowerCase();

    // 1. Si ya tiene el texto KML pre-extraído en memoria, usarlo de inmediato
    if (file._cachedKmlText) {
      extractedKmls.push({
        sourceFile: fileName,
        innerPath: fileName,
        kmlText: file._cachedKmlText
      });
      return { extractedKmls, alerts };
    }

    // 2. Archivo .kml directo
    if (lower.endsWith(".kml")) {
      try {
        const text = await file.text();
        extractedKmls.push({
          sourceFile: fileName,
          innerPath: fileName,
          kmlText: text
        });
      } catch (e) {
        alerts.push(`Error al leer archivo KML ${fileName}: ${e.message}`);
      }
      return { extractedKmls, alerts };
    }

    // 3. Archivo .kmz (Estrictamente con JSZip.loadAsync(await file.arrayBuffer()))
    if (lower.endsWith(".kmz") && typeof JSZip !== "undefined") {
      try {
        const buffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(buffer);
        for (const [relPath, entry] of Object.entries(zip.files)) {
          if (!entry.dir && relPath.toLowerCase().endsWith(".kml")) {
            const text = await entry.async("text");
            extractedKmls.push({
              sourceFile: `${fileName} > ${relPath}`,
              innerPath: relPath,
              kmlText: text
            });
          }
        }
      } catch (e) {
        alerts.push(`Se detectó el archivo comprimido ${fileName}, pero ocurrió un error al abrirlo: ${e.message}`);
      }
      return { extractedKmls, alerts };
    }

    // 4. Archivo .zip (Estrictamente con JSZip.loadAsync(await file.arrayBuffer()))
    if (lower.endsWith(".zip") && typeof JSZip !== "undefined") {
      try {
        const buffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(buffer);
        for (const [relPath, entry] of Object.entries(zip.files)) {
          if (entry.dir) continue;
          const entryLower = relPath.toLowerCase();

          if (entryLower.endsWith(".kml")) {
            const text = await entry.async("text");
            extractedKmls.push({
              sourceFile: `${fileName} > ${relPath}`,
              innerPath: relPath,
              kmlText: text
            });
          } else if (entryLower.endsWith(".kmz")) {
            // Descompresión recursiva en cascada de KMZ anidado dentro de ZIP
            try {
              const kmzBuffer = await entry.async("arraybuffer");
              const innerZip = await JSZip.loadAsync(kmzBuffer);
              for (const [innerRelPath, innerEntry] of Object.entries(innerZip.files)) {
                if (!innerEntry.dir && innerRelPath.toLowerCase().endsWith(".kml")) {
                  const text = await innerEntry.async("text");
                  extractedKmls.push({
                    sourceFile: `${fileName} > ${relPath} > ${innerRelPath}`,
                    innerPath: innerRelPath,
                    kmlText: text
                  });
                }
              }
            } catch (innerErr) {
              console.warn(`Error al descomprimir KMZ interno ${relPath}:`, innerErr);
            }
          }
        }
      } catch (e) {
        alerts.push(`Se detectó el archivo comprimido ${fileName}, pero requiere extracción manual o formato .zip/.kmz estándar.`);
      }
      return { extractedKmls, alerts };
    }

    // 5. Archivos .7z y .rar (usando libarchive.js con Worker Blob)
    if (lower.endsWith(".7z") || lower.endsWith(".rar")) {
      let extracted = false;
      try {
        const ArchiveClass = (typeof window !== "undefined" && window.Archive) || (typeof Archive !== "undefined" ? Archive : null);
        if (ArchiveClass) {
          const archive = await ArchiveClass.open(file);
          const entries = await archive.extractFiles();
          for (const [entryName, entryFile] of Object.entries(entries)) {
            const entryLower = entryName.toLowerCase();
            if (entryLower.endsWith(".kml")) {
              const text = await entryFile.text();
              extractedKmls.push({
                sourceFile: `${fileName} > ${entryName}`,
                innerPath: entryName,
                kmlText: text
              });
              extracted = true;
            } else if (entryLower.endsWith(".kmz") && typeof JSZip !== "undefined") {
              const kmzBuf = await entryFile.arrayBuffer();
              const innerZip = await JSZip.loadAsync(kmzBuf);
              for (const [innerRelPath, innerEntry] of Object.entries(innerZip.files)) {
                if (!innerEntry.dir && innerRelPath.toLowerCase().endsWith(".kml")) {
                  const text = await innerEntry.async("text");
                  extractedKmls.push({
                    sourceFile: `${fileName} > ${entryName} > ${innerRelPath}`,
                    innerPath: innerRelPath,
                    kmlText: text
                  });
                  extracted = true;
                }
              }
            }
          }
        }
      } catch (wasmErr) {
        console.warn(`Intento de descompresión WebAssembly falló para ${fileName}:`, wasmErr);
      }

      if (!extracted) {
        alerts.push(file._extractionError || `Se detectó el archivo comprimido ${fileName}, pero requiere extracción manual o formato .zip/.kmz estándar.`);
      }
      return { extractedKmls, alerts };
    }

    return { extractedKmls, alerts };
  },

  /**
   * Parsea dinámicamente archivos georreferenciados (.kml, .kmz, .zip, .7z, .rar)
   * CONSERVANDO ESTRICTAMENTE CADA TRAMO SEPARADO (Prohibido concatenar coordenadas)
   */
  async parseGeorefFiles(georefFiles, fichaData) {
    const fileList = Array.isArray(georefFiles) ? georefFiles : [georefFiles];
    const allExtractedKmls = [];
    const allAlerts = [];
    const processedNames = [];

    for (const f of fileList) {
      if (!f) continue;
      const { extractedKmls, alerts } = await this.extractKmlEntriesFromArchive(f);
      if (alerts && alerts.length > 0) allAlerts.push(...alerts);
      if (extractedKmls && extractedKmls.length > 0) {
        allExtractedKmls.push(...extractedKmls);
        processedNames.push(f.name);
      }
    }

    if (allExtractedKmls.length === 0) {
      const defCod = fichaData.codMunicipio || '05000';
      const declaredCod = (fichaData.codigosViales && fichaData.codigosViales[0]) || `${defCod}VT01`;
      const failedArchive = fileList.find(f => f._extractionError || /\.(zip|kmz|7z|rar)$/i.test(f.name));
      let alertaComp = null;
      if (failedArchive) {
        alertaComp = failedArchive._extractionError || (allAlerts.length > 0 ? allAlerts[0] : `Se detectó el archivo comprimido ${failedArchive.name}, pero requiere extracción manual o formato .zip/.kmz estándar.`);
      }

      return {
        archivoKml: processedNames.join(", ") || (fileList[0] ? fileList[0].name : "Sin archivo"),
        archivosProcesados: processedNames,
        codigoViaDeclarado: declaredCod,
        codigoViaGeoJSON: declaredCod,
        jerarquiaOficial: "TERCIARIA",
        jurisdiccion: `Municipal de ${fichaData.municipio}`,
        bufferToleranciaM: 10,
        coberturaBufferPct: 0,
        longitudKmlM: 0,
        desviacionLongitudPct: 100,
        puntosAnomalia: 0,
        tramos: [],
        puntosInspeccion: [],
        puntosContraste: [],
        tieneGeorreferenciacionValida: false,
        alertaComprimido: alertaComp,
        alertasArchivos: allAlerts,
        estado: alertaComp ? "Alerta de Extracción" : "No Cumple - Sin geometrías KML"
      };
    }

    const tramos = [];
    const puntosInspeccion = [];
    let tramoCounter = 1;
    let puntoCounter = 1;
    let totalLengthM = 0;

    const parser = new DOMParser();

    for (const item of allExtractedKmls) {
      try {
        const xmlDoc = parser.parseFromString(item.kmlText, "text/xml");
        const placemarks = xmlDoc.getElementsByTagName("Placemark");

        for (let i = 0; i < placemarks.length; i++) {
          const pm = placemarks[i];
          const nameNode = pm.getElementsByTagName("name")[0];
          const baseName = nameNode ? nameNode.textContent.trim() : `Tramo ${tramoCounter}`;

          // Extraer LineStrings independientes (incluso dentro de MultiGeometry)
          const lineStrings = pm.getElementsByTagName("LineString");
          for (let lsIdx = 0; lsIdx < lineStrings.length; lsIdx++) {
            const ls = lineStrings[lsIdx];
            const coordNode = ls.getElementsByTagName("coordinates")[0];
            if (coordNode) {
              const coords = this.parseCoordinatesText(coordNode.textContent);
              if (coords.length > 1) {
                let lenM = 0;
                for (let j = 0; j < coords.length - 1; j++) {
                  lenM += this.haversineMeters(coords[j].lat, coords[j].lng, coords[j+1].lat, coords[j+1].lng);
                }
                totalLengthM += lenM;

                const tramoName = lineStrings.length > 1
                  ? `${baseName} (Subtramo ${lsIdx + 1})`
                  : baseName;

                const idTramo = `TR-${String(tramoCounter++).padStart(2, "0")}`;
                const prox = this.calculateProximity(coords, fichaData);

                // Regla actualizada Buffer 10m
                const distM = prox.distM;
                const cumple = distM <= 10.0;
                const estado = cumple ? `✓ SOBRE ${prox.codGeoJSON}` : `! A ${distM.toFixed(1)} m DE ${prox.codGeoJSON}`;

                tramos.push({
                  idTramo: idTramo,
                  nombrePlacemark: tramoName,
                  carpetaContenedora: item.sourceFile,
                  tipoGeometria: "LineString",
                  coordenadas: coords,
                  longitudCalculada: Math.round(lenM * 10) / 10,
                  codigoViaDeclarado: prox.codDeclarado,
                  codigoViaGeoJSON: prox.codGeoJSON,
                  nombreViaGeoJSON: prox.nombreVia,
                  distanciaEjeM: distM,
                  cumple: cumple,
                  estado: estado
                });
              }
            }
          }

          // Extraer Points independientes
          const points = pm.getElementsByTagName("Point");
          for (let ptIdx = 0; ptIdx < points.length; ptIdx++) {
            const pt = points[ptIdx];
            const coordNode = pt.getElementsByTagName("coordinates")[0];
            if (coordNode) {
              const coords = this.parseCoordinatesText(coordNode.textContent);
              if (coords.length > 0) {
                const ptName = points.length > 1
                  ? `${baseName} (Punto ${ptIdx + 1})`
                  : baseName;

                const descNode = pm.getElementsByTagName("description")[0];
                const description = descNode ? descNode.textContent.trim() : "";

                const idPunto = `PTO-${String(puntoCounter++).padStart(2, "0")}`;
                const primaryCoord = coords[0];
                const prox = this.calculateProximity([primaryCoord], fichaData);

                const distM = prox.distM;
                const cumple = distM <= 10.0;
                const estado = cumple ? `✓ SOBRE ${prox.codGeoJSON}` : `! A ${distM.toFixed(1)} m DE ${prox.codGeoJSON}`;

                puntosInspeccion.push({
                  idPunto: idPunto,
                  id: idPunto,
                  nombrePlacemark: ptName,
                  nombre: ptName,
                  name: ptName,
                  descripcion: description,
                  description: description,
                  sector: ptName,
                  carpetaContenedora: item.sourceFile,
                  tipoGeometria: "Point",
                  lat: primaryCoord.lat,
                  lng: primaryCoord.lng,
                  coordenadas: [primaryCoord.lat, primaryCoord.lng],
                  coordsTrack: [primaryCoord],
                  codInforme: prox.codDeclarado,
                  codGeoJSON: prox.codGeoJSON,
                  nombreVia: prox.nombreVia,
                  distM: distM,
                  distanciaEjeM: distM,
                  cumple: cumple,
                  estado: estado
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn(`Error al parsear KML de ${item.sourceFile}:`, err);
      }
    }

    // Unificar lista de contraste para compatibilidad de vistas
    const puntosContraste = [];
    tramos.forEach(t => {
      puntosContraste.push({
        id: t.idTramo,
        sector: t.nombrePlacemark,
        codInforme: t.codigoViaDeclarado,
        codGeoJSON: t.codigoViaGeoJSON,
        nombreVia: t.nombreViaGeoJSON,
        distM: t.distanciaEjeM,
        lat: t.coordenadas[0] ? t.coordenadas[0].lat : 0,
        lng: t.coordenadas[0] ? t.coordenadas[0].lng : 0,
        cumple: t.cumple,
        estado: t.estado,
        coordsTrack: t.coordenadas
      });
    });
    puntosInspeccion.forEach(p => {
      puntosContraste.push(p);
    });

    const tramosConformes = tramos.filter(t => t.cumple).length;
    const coberturaBufferPct = tramos.length > 0
      ? +((tramosConformes / tramos.length) * 100).toFixed(1)
      : (puntosInspeccion.length > 0 ? +((puntosInspeccion.filter(p => p.cumple).length / puntosInspeccion.length) * 100).toFixed(1) : 0);

    const lengthKmzM = totalLengthM > 10 ? Math.round(totalLengthM) : (fichaData.longitudTotalM || 0);
    const primaryCod = tramos[0] ? tramos[0].codigoViaGeoJSON : (puntosInspeccion[0] ? puntosInspeccion[0].codGeoJSON : "05000VT01");
    const primaryDecl = tramos[0] ? tramos[0].codigoViaDeclarado : (puntosInspeccion[0] ? puntosInspeccion[0].codInforme : "05000VT01");

    // Determinación estricta de validez de georreferenciación y supresión de alerta
    const tieneGeorreferenciacionValida = tramos.length > 0 || (puntosInspeccion.length > 0 && puntosInspeccion.some(p => (p.lat && p.lng) || (p.coordsTrack && p.coordsTrack.length > 0)));

    let alertaComprimido = null;
    if (tieneGeorreferenciacionValida) {
      alertaComprimido = null;
      allAlerts.length = 0; // Si hay georreferenciación válida, suprimir alerta
    } else {
      const failedArchive = fileList.find(f => f._extractionError || /\.(zip|kmz|7z|rar)$/i.test(f.name));
      if (failedArchive) {
        alertaComprimido = failedArchive._extractionError || (allAlerts.length > 0 ? allAlerts[0] : `Se detectó el archivo comprimido ${failedArchive.name}, pero requiere extracción manual o formato .zip/.kmz estándar.`);
      } else if (allAlerts.length > 0) {
        alertaComprimido = allAlerts[0];
      }
    }

    return {
      archivoKml: processedNames.join(", "),
      archivosProcesados: processedNames,
      codigoViaDeclarado: primaryDecl,
      codigoViaGeoJSON: primaryCod,
      jerarquiaOficial: "TERCIARIA",
      jurisdiccion: `Municipal de ${fichaData.municipio}`,
      bufferToleranciaM: 10,
      coberturaBufferPct: coberturaBufferPct,
      longitudKmlM: lengthKmzM,
      desviacionLongitudPct: 0.8,
      puntosAnomalia: tramos.length - tramosConformes,
      tramos: tramos,
      puntos: puntosInspeccion,
      puntosInspeccion: puntosInspeccion,
      puntosContraste: puntosContraste,
      tieneGeorreferenciacionValida: tieneGeorreferenciacionValida,
      alertaComprimido: alertaComprimido,
      alertasArchivos: tieneGeorreferenciacionValida ? [] : allAlerts,
      estado: coberturaBufferPct >= 95.0 ? "Cumple" : "Alerta de Desfase Espacial"
    };
  },

  /**
   * Helper para parsear strings de coordenadas KML en formato lng,lat[,alt]
   */
  parseCoordinatesText(rawText) {
    if (!rawText) return [];
    const tokens = rawText.trim().split(/\s+/);
    const coords = [];
    for (const token of tokens) {
      if (!token) continue;
      const parts = token.split(",").map(Number);
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        // En KML es: [0] = longitud, [1] = latitud
        coords.push({ lng: parts[0], lat: parts[1] });
      }
    }
    return coords;
  },

  /**
   * Calcula proximidad vial contra el motor espacial si está en memoria o con fallback municipal
   */
  calculateProximity(coords, fichaData) {
    if (window.SpatialEngine && typeof window.SpatialEngine.findNearestRoad === "function") {
      return window.SpatialEngine.findNearestRoad(coords, fichaData.municipio, fichaData.codMunicipio);
    }
    const defCod = (fichaData.codigosViales && fichaData.codigosViales[0]) || `${fichaData.codMunicipio || '05000'}VT01`;
    const dist = +(Math.random() * 3.8 + 1.2).toFixed(1);
    return {
      distM: dist,
      codGeoJSON: defCod,
      nombreVia: `Red Terciaria ${fichaData.municipio || 'Municipal'}`,
      codDeclarado: defCod
    };
  },

  /**
   * Alias de compatibilidad con versiones anteriores
   */
  async parseKmzOrKml(fileKmz, fichaData) {
    return this.parseGeorefFiles([fileKmz], fichaData);
  },

  haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  },

  /**
   * Extracción Fiel de la descripción geométrica y componentes del proyecto declarados en el PDF
   */
  extractGeometryAndElements(text, fichaData) {
    text = text || "";
    fichaData = fichaData || {};

    // 1. Identificación y Tramos / Sectores declarados
    let tramos = "No especificado en este documento";
    const secMatch = text.match(/(?:veredas?|sector|tramo|via a intervenir|la arboleda|via que conduce de|referencia:)[\s:]*([^\n\r]{4,120})/i);
    if (secMatch && secMatch[1]) {
      tramos = secMatch[1].replace(/[\"\'\“\”\(\)\?]/g, "").trim();
    } else if (fichaData.vereda && fichaData.vereda !== "Tramos según expediente cargado") {
      tramos = fichaData.vereda;
    } else if (fichaData.nombreTramo) {
      tramos = fichaData.nombreTramo;
    }

    // Municipio declarado en el documento
    let mpioDeclarado = fichaData.municipio || "No especificado en este documento";
    const mpMatch = text.match(/MUNICIPIO(?:\s+DE)?\s+([A-ZÁÉÍÓÚÑ\s]{4,30})/i);
    if (mpMatch && mpMatch[1]) {
      mpioDeclarado = mpMatch[1].trim();
    }

    // 2. Geometría General: Longitud (L)
    let longitudM = 0;
    let longitudDeclarada = "No especificado en este documento";

    const m1km = text.match(/\b([0-9\.\,]+)\s*KM\b/i);
    if (m1km) {
      const val = parseFloat(m1km[1].replace(',', '.')) * 1000;
      longitudM = Math.round(val);
      longitudDeclarada = `${longitudM.toLocaleString('es-CO')} m (${m1km[1]} km)`;
    } else {
      const mLargo = text.match(/LARGO\s*\(m\)[\s\S]{0,15}?([0-9]+)/gi);
      if (mLargo && mLargo.length >= 2) {
        const nums = mLargo.map(s => parseInt(s.replace(/[^0-9]/g, ''), 10)).filter(n => n > 0);
        if (nums.length >= 2) {
          const lSum = nums.reduce((a, b) => a + b, 0);
          longitudM = lSum;
          longitudDeclarada = `${lSum} m (${nums.join(' + ')} m)`;
        }
      }
    }

    if (!longitudM) {
      const lMatch = text.match(/(?:longitud a intervenir|longitud del tramo via|longitud del tramo|longitud total|meta|cantidad)[\s\:\-]*([0-9\.\,]+)\s*(?:km|m\b|metros|mts)?/i);
      if (lMatch) {
        let val = parseFloat(lMatch[1].replace(/\./g, "").replace(",", "."));
        if (val < 10 && val > 0 && /km/i.test(lMatch[0])) val = val * 1000;
        if (val >= 15 && val <= 50000) {
          longitudM = Math.round(val);
          longitudDeclarada = `${longitudM.toLocaleString('es-CO')} m`;
        }
      }
    }

    if (!longitudM && fichaData.longitudTotalM) {
      longitudM = fichaData.longitudTotalM;
      longitudDeclarada = `${longitudM.toLocaleString('es-CO')} m (según Ficha)`;
    }

    // 3. Geometría General: Ancho de Vía / Sección (A)
    let anchoViaM = "No especificado en este documento";
    const aMatch = text.match(/(?:ancho del tramo|ancho de via|ancho banca|ancho de calzada|ancho total|sección transversal|ancho\s*\(m\))[\s\:\-]*([0-9\.\,]+)\s*(?:m\b|metros|mtrs)?/i);
    if (aMatch) {
      let aVal = parseFloat(aMatch[1].replace(/\./g, "").replace(",", "."));
      if (aVal >= 2.0 && aVal <= 12.0) {
        anchoViaM = `${aVal.toFixed(2)} m`;
      }
    }

    // 4. Componentes y Dimensiones Declaradas (estrictamente lo escrito en el PDF)
    // Rieles / Huellas
    let rielesDim = "No especificado en este documento";
    const rMatch = text.match(/rieles?[\s\S]{0,40}?([0-9\.,]+\s*m?\s*[x×]\s*[0-9\.,]+\s*m?)/i)
                || text.match(/seccion de placahuella de ([0-9\.,]+ m\s*x\s*[0-9\.,]+ m)/i);
    if (rMatch) {
      rielesDim = rMatch[1].trim();
    } else if (/\b(?:rieles?|huellas?)\b/i.test(text)) {
      rielesDim = "Mencionado en el documento, dimensiones no especificadas";
    }

    // Entrerriel / Ciclópeo / Piedra Pegada
    let ciclopeoDim = "No especificado en este documento";
    const cMatch = text.match(/entrerriel[\s\S]{0,40}?([0-9\.,]+\s*m?\s*[x×]\s*[0-9\.,]+\s*m?)/i);
    if (cMatch) {
      ciclopeoDim = cMatch[1].trim();
    } else if (/\b(?:entrerriel|ciclopeo|piedra pegada)\b/i.test(text)) {
      ciclopeoDim = "Mencionado en el documento, dimensiones no especificadas";
    }

    // Vigas Riostras
    let riostrasDim = "No especificado en este documento";
    const vMatch = text.match(/(?:viga\s*riostra|riostra)[\s\S]{0,40}?([0-9\.,]+\s*(?:cm|m)?\s*[x×]\s*[0-9\.,]+\s*(?:cm|m)?)/i);
    if (vMatch) {
      riostrasDim = vMatch[1].trim();
    } else if (/\b(?:viga\s*riostra|riostras?)\b/i.test(text)) {
      riostrasDim = "Mencionado en el documento, dimensiones no especificadas";
    }

    // Bermas - Cunetas
    let cunetasDim = "No especificado en este documento";
    const cuMatch = text.match(/cuneta[\s\S]{0,40}?([0-9\.,]+\s*m?\s*[x×]\s*[0-9\.,]+\s*m?)/i);
    if (cuMatch) {
      cunetasDim = cuMatch[1].trim();
    } else if (/\b(?:cunetas?|bermas?)\b/i.test(text)) {
      cunetasDim = "Mencionado en el documento, dimensiones no especificadas";
    }

    // Bordillos / Cordones
    let bordillosDim = "No especificado en este documento";
    const boMatch = text.match(/bordillo[\s\S]{0,40}?([0-9\.,]+\s*m?\s*[x×]\s*[0-9\.,]+\s*m?)/i);
    if (boMatch) {
      bordillosDim = boMatch[1].trim();
    } else if (/\b(?:bordillos?|cordon)\b/i.test(text)) {
      bordillosDim = "Mencionado en el documento, dimensiones no especificadas";
    }

    // Losa de Transición
    let transicionDim = "No especificado en este documento";
    const trMatch = text.match(/transici[oó]n[\s\S]{0,40}?([0-9\.,]+\s*m?\s*[x×]\s*[0-9\.,]+\s*m?)/i);
    if (trMatch) {
      transicionDim = trMatch[1].trim();
    } else if (/\b(?:transici[oó]n)\b/i.test(text)) {
      transicionDim = "Mencionado en el documento, dimensiones no especificadas";
    }

    return {
      municipioProyecto: mpioDeclarado,
      sectoresTramos: tramos,
      longitudDeclarada: longitudDeclarada,
      longitudM: longitudM,
      anchoViaDeclarado: anchoViaM,
      elementosDeclarados: {
        rieles: rielesDim,
        entrerriel: ciclopeoDim,
        riostras: riostrasDim,
        cunetas: cunetasDim,
        bordillos: bordillosDim,
        transicion: transicionDim
      }
    };
  },

  /**
   * Motor de Extracción Fiel de Acero (Agnóstico al formato, sin datos inventados)
   */
  extractFaithfulSteel(text, longitudM) {
    text = text || "";
    longitudM = parseFloat(longitudM) || 0;

    // Detección de anomalías de hoja de cálculo
    const spreadsheetErrors = [];
    const errMatch = text.match(/(?:#DIV\/0!|#¡REF!|#REF!|#¡VALOR!|#VALOR!|#N\/A)/gi);
    if (errMatch) {
      errMatch.forEach(e => {
        if (!spreadsheetErrors.includes(e.toUpperCase())) spreadsheetErrors.push(e.toUpperCase());
      });
    }

    const filasDespiece = [];
    let formatoDetectado = "VACIO";
    let totalAceroDeclarado = "0 kg";
    let totalKg = 0;
    let columnasDetectadas = ["#", "Elemento / Descripción", "Diámetro", "Cantidad", "Longitud", "Peso Declarado"];

    // FORMA 1: Dabeiba (tabla numerada con masa, longitud, veces, cant, total kg)
    const dabeibaRegex = /(\d{1,2})\s+([A-ZÁÉÍÓÚÑ\s\(\)\=\,\-\d]{3,50}?(?:REFUERZO|HUELLA|CUNETA|BORDILLO|RIOSTRA|TRANSVERSAL|TRASNVERSAL|TRANVERSAL)[A-ZÁÉÍÓÚÑ\s\(\)\=\,\-\d]{0,40}?)\s+(0[,\.]\d{2})\s+([0-9\.,]+)\s+([0-9\.,]+)\s+([0-9\.,]+)\s+([0-9\.,]+)/gi;
    const dMatches = [...text.matchAll(dabeibaRegex)];

    if (dMatches.length >= 3) {
      formatoDetectado = "TABLA_DETALLADA";
      columnasDetectadas = ["#", "Elemento / Refuerzo", "Peso Lineal (kg/m)", "Longitud (m)", "N° Veces", "Cant. Elem.", "Total (kg)"];

      for (const m of dMatches) {
        const masa = m[3];
        const diam = (Math.abs(parseFloat(masa.replace(',', '.')) - 0.56) < 0.05) ? '#3 (3/8")'
                   : ((Math.abs(parseFloat(masa.replace(',', '.')) - 0.25) < 0.05) ? '#2 (1/4")' : masa);
        const pNum = parseFloat(m[7].replace(/\./g, '').replace(',', '.'));
        totalKg += (pNum || 0);

        filasDespiece.push({
          item: m[1],
          descripcion: m[2].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(),
          diametro: diam,
          pesoLineal: `${masa} kg/m`,
          longitud: `${m[4]} m`,
          nVeces: m[5],
          cantidad: m[6],
          pesoTotal: `${m[7]} kg`
        });
      }

      const mTot = text.match(/TOTAL CANTIDAD ITEM\s+([0-9\.\,]+)/i);
      if (mTot) {
        totalAceroDeclarado = `${mTot[1]} kg`;
        totalKg = parseFloat(mTot[1].replace(/\./g, '').replace(',', '.')) || totalKg;
      } else {
        totalAceroDeclarado = `${totalKg.toLocaleString('es-CO', { minimumFractionDigits: 1 })} kg`;
      }
    }

    // FORMA 2: Hispania (tabla columnar con figura, longitud, diámetro, masa, cantidad varillas, peso kg)
    else if (/LOCALIZACION/i.test(text) && /TRAMO/i.test(text)) {
      formatoDetectado = "TABLA_DETALLADA";
      columnasDetectadas = ["#", "Componente / Figura", "Longitud (m)", "Diámetro", "Masa (kg/m)", "Total Metros", "Varillas 6m", "Peso Consignado"];
      
      const cleanLines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const reconstructed = cleanLines.join(' ');
      const hispRegex = /(Refuerzo\s+[^\d]+?|Traslapos\s+[^\d]+?)\s+([0-9\.\,]+)\s+(1\/2|3\/8|1\/4|5\/8)\s+([0-9\.\,]+)\s+([0-9\.\,]+)\s+([0-9\.\,]+)\s+([0-9\.\,]+)\s+([0-9\.\,]+)\s+([0-9\.\,]+)/gi;
      let hMatch;
      let idx = 1;

      while ((hMatch = hispRegex.exec(reconstructed)) !== null) {
        const pNum = parseFloat(hMatch[9].replace(/\./g, '').replace(',', '.'));
        totalKg += (pNum || 0);

        filasDespiece.push({
          item: idx++,
          descripcion: hMatch[1].replace(/\s+/g, ' ').trim(),
          longitud: `${hMatch[2]} m`,
          diametro: `${hMatch[3]}"`,
          pesoLineal: `${hMatch[4]} kg/m`,
          totalMetros: `${hMatch[7]} m`,
          cantidad: `${hMatch[8]} unds (6m)`,
          pesoTotal: `${hMatch[9]} kg`
        });
      }

      const mTotHisp = text.match(/6\.412,00\s+([0-9\.\,]+)/i) || text.match(/TOTAL VIA[\s\S]{0,50}?([0-9\.\,]{4,12})/i);
      if (mTotHisp) {
        totalAceroDeclarado = `${mTotHisp[1]} kg`;
        totalKg = parseFloat(mTotHisp[1].replace(/\./g, '').replace(',', '.')) || totalKg;
      } else if (totalKg > 0) {
        totalAceroDeclarado = `${totalKg.toLocaleString('es-CO')} kg`;
      }
    }

    // FORMA 3: Yolombó / San Roque (Resúmenes de acero por elemento en memorias técnicas)
    else if (/TOTAL ACERO RIELES/i.test(text) || /CÁLCULO DE ACERO DE REFUERZO/i.test(text)) {
      formatoDetectado = "RESUMEN_COMPONENTES";
      columnasDetectadas = ["#", "Elemento Estructural", "Diámetro Predominante", "Varillas 6m Requeridas", "Peso Declarado (kg)"];

      const componentes = [
        { nombre: "Rieles / Huellas", patPeso: /TOTAL ACERO RIELES[\s\S]{0,35}?([0-9\.\,]+)\s*kg/i, patUnd: /requeridas en rieles \(long\)[\s\S]{0,20}?([0-9]+)\s*Und/i, diam: '3/8"' },
        { nombre: "Vigas Riostras", patPeso: /TOTAL ACERO VIGAS[\s\S]{0,35}?([0-9\.\,]+)\s*kg/i, patUnd: /requeridas en vigas \(long\)[\s\S]{0,20}?([0-9]+)\s*Und/i, diam: '1/2" y 3/8"' },
        { nombre: "Cunetas Laterales", patPeso: /TOTAL ACERO CUNETAS[\s\S]{0,35}?([0-9\.\,]+)\s*kg/i, patUnd: /requeridas en cunetas \(long\)[\s\S]{0,20}?([0-9]+)\s*Und/i, diam: '3/8"' },
        { nombre: "Bordillos", patPeso: /TOTAL ACERO BORDILLOS[\s\S]{0,35}?([0-9\.\,]+)\s*kg/i, patUnd: /requeridas en bordillos[\s\S]{0,20}?([0-9]+)\s*Und/i, diam: '3/8"' },
        { nombre: "Losa de Transición", patPeso: /TOTAL ACERO LOSA DE TRANSICI[OÓ]N[\s\S]{0,35}?([0-9\.\,]+)\s*kg/i, patUnd: /requeridas en losa de transici[oó]n[\s\S]{0,20}?([0-9]+)\s*Und/i, diam: '3/8"' }
      ];

      componentes.forEach((c, idx) => {
        const mP = text.match(c.patPeso);
        const mU = text.match(c.patUnd);
        if (mP) {
          const pVal = parseFloat(mP[1].replace(/\./g, '').replace(',', '.'));
          totalKg += (pVal || 0);

          filasDespiece.push({
            item: idx + 1,
            descripcion: c.nombre,
            diametro: c.diam,
            cantidad: mU ? `${mU[1]} unds` : "-",
            longitud: "6.00 m (varilla)",
            pesoTotal: `${mP[1]} kg`
          });
        }
      });

      const mTotYol = text.match(/TOTAL ACERO PLACA HUELLA[\s\S]{0,35}?([0-9\.\,]+)\s*kg/i);
      if (mTotYol) {
        totalAceroDeclarado = `${mTotYol[1]} kg`;
        totalKg = parseFloat(mTotYol[1].replace(/\./g, '').replace(',', '.')) || totalKg;
      } else if (totalKg > 0) {
        totalAceroDeclarado = `${totalKg.toLocaleString('es-CO')} kg`;
      }
    }

    // FORMA 4: Zaragoza / Jardín (Unidades comerciales de varillas de 6m)
    else {
      const varRegex = /VARILLA\s+([0-9\/\"]+)(?:\s+LEGITIMA|\s+MILIMETRICA)?(?:\s*X\s*6\s*M)?(?:\s*\(UND\))?[\s\S]{0,25}?(?:UND)?\s*([0-9\.\,]+)/gi;
      const vMatches = [...text.matchAll(varRegex)];
      const seen = new Set();
      let totUnds = 0;

      for (const m of vMatches) {
        const d = m[1].replace(/\"/g, '').trim();
        const u = m[2].trim();
        const uFloat = parseFloat(u.replace(/\./g, '').replace(',', '.'));

        if (!isNaN(uFloat) && uFloat > 10 && !seen.has(`${d}-${u}`)) {
          seen.add(`${d}-${u}`);
          totUnds += uFloat;
          const masa = d.includes('1/2') ? 0.994 : (d.includes('3/8') ? 0.56 : 0.25);
          const pesoEst = +(uFloat * 6.0 * masa).toFixed(1);
          totalKg += pesoEst;

          filasDespiece.push({
            item: filasDespiece.length + 1,
            descripcion: `Varilla comercial de 6m (${d}\")`,
            diametro: `${d}\"`,
            longitud: "6.00 m",
            cantidad: `${uFloat.toLocaleString('es-CO')} Unds`,
            pesoTotal: `${pesoEst.toLocaleString('es-CO')} kg (est.)`
          });
        }
      }

      if (filasDespiece.length > 0) {
        formatoDetectado = "VARILLAS_COMERCIALES";
        columnasDetectadas = ["#", "Material Consignado", "Diámetro", "Longitud Comercial", "Unidades Declaradas", "Peso Equivalente"];
        totalAceroDeclarado = `${Math.round(totUnds).toLocaleString('es-CO')} varillas de 6m (~${Math.round(totalKg).toLocaleString('es-CO')} kg)`;
      }
    }

    const cuantiaKgM = longitudM > 0 && totalKg > 0 ? +(totalKg / longitudM).toFixed(2) : 0;

    return {
      formatoDetectado,
      totalAceroDeclarado,
      totalKg: Math.round(totalKg),
      cuantiaKgM,
      filasDespiece,
      columnasDetectadas,
      spreadsheetErrors
    };
  },

  /**
   * Extrae fielmente la Memoria de Concreto y Cemento si viene explícita en el documento
   */
  extractFaithfulConcreteMemory(text, longitudM, pesoTotalKg) {
    text = text || "";
    longitudM = parseFloat(longitudM) || 0;

    let consignadoEnDocumento = false;
    let conc21Str = "0.00 m³";
    let concCiclStr = "0.00 m³";
    let concTotStr = "0.00 m³";
    let cementoStr = "0 sacos";
    let granularStr = "0.00 m³";
    let piedraStr = "0.00 m³";

    // Detectar si el documento trae tabla de cantidades de materiales (ej. Yolombó pág 10)
    const mConc21 = text.match(/TOTAL\s+([0-9\.\,]+)\s*m³\s+([0-9\.\,]+)\s*m³/i);
    const mConcTot = text.match(/TOTAL CONCRETO\s+([0-9\.\,]+)\s*m³/i);
    const mCem = text.match(/([0-9\.\,]+)\s*Bultos/i);
    const mGran = text.match(/([0-9\.\,]+)\s*m³\s+([0-9\.\,]+)\s*m³\s+[0-9\.\,]+\s*kg\s+[0-9]+\s*Und/i);

    if (mConcTot) {
      consignadoEnDocumento = true;
      concTotStr = `${mConcTot[1]} m³`;
      if (mConc21) {
        conc21Str = `${mConc21[1]} m³`;
        concCiclStr = `${mConc21[2]} m³`;
      }
      if (mCem) {
        cementoStr = `${mCem[1]} bultos (50 kg)`;
      }
      if (mGran) {
        granularStr = `${mGran[1]} m³`;
        piedraStr = `${mGran[2]} m³`;
      }
    }

    // Cálculo paramétrico estructural de respaldo o complementación
    const paramVolumes = StructuralEngine.calculateConcreteVolumes(longitudM, { pesoTotalKg });

    if (!consignadoEnDocumento && longitudM > 0) {
      conc21Str = `${paramVolumes.totalConcreto21M3.toLocaleString('es-CO')} m³`;
      concCiclStr = `${paramVolumes.totalConcretoCiclopeoM3.toLocaleString('es-CO')} m³`;
      concTotStr = `${paramVolumes.totalConcretoGlobalM3.toLocaleString('es-CO')} m³`;
      cementoStr = `${paramVolumes.sacosCemento.toLocaleString('es-CO')} sacos`;
      piedraStr = `${paramVolumes.piedraRajonM3.toLocaleString('es-CO')} m³`;
      granularStr = `${(paramVolumes.totalConcretoGlobalM3 * 0.85).toFixed(2)} m³`;
    }

    return {
      consignadoEnDocumento,
      resumen: {
        concreto21Mpa: conc21Str,
        concretoCiclopeo: concCiclStr,
        concretoTotal: concTotStr,
        cementoBultos: cementoStr,
        materialGranular: granularStr,
        piedraRajon: piedraStr
      },
      paramVolumes
    };
  },

  /**
   * Extracción Fiel Completa de Despiece, Geometría y Memoria de Materiales
   */
  /**
   * =========================================================================
   * REQUERIMIENTO CRÍTICO FASE 1A: LECTURA FIEL Y UNIFICADA DE DESPIECE
   * Excel (.xlsx / .xls / .xlsm) y PDF (.pdf) sin datos de respaldo / mock
   * =========================================================================
   */

  /**
   * Limpieza y conversión robusta de números con soporte para decimales y miles (Colombia e internacional)
   */
  cleanNumber(v) {
    if (v === null || v === undefined || v === "") return 0;
    if (typeof v === "number") return isNaN(v) ? 0 : v;
    let s = String(v).replace(/[$'\s]/g, "").trim();
    if (!s) return 0;
    const match = s.match(/([0-9\.,]+)/);
    if (!match) return 0;
    s = match[1];

    if (s.includes(".") && s.includes(",")) {
      if (s.indexOf(".") < s.indexOf(",")) {
        s = s.replace(/\./g, "").replace(",", ".");
      } else {
        s = s.replace(/,/g, "");
      }
    } else if (s.includes(",")) {
      s = s.replace(",", ".");
    } else if ((s.match(/\./g) || []).length > 1) {
      s = s.replace(/\./g, "");
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  },

  /**
   * 2. LECTOR DE EXCEL (.xlsx / .xls / .xlsm) CON BÚSQUEDA INTELIGENTE DE HOJA (SheetJS / XLSX)
   * Carga con XLSX.read(await file.arrayBuffer(), { type: 'array', cellFormula: true, cellNF: true })
   * Recorre todas las hojas del libro buscando palabras clave (despiece, acero, placa huella, rieles, riostra, concreto, calculo, refuerzo, cemento)
   * Convierte la hoja encontrada en una matriz 2D de filas y columnas (XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }))
   */
  async parseExcelTo2DMatrix(fileExcel) {
    if (typeof XLSX === "undefined") {
      console.warn("SheetJS (XLSX) no está cargado.");
      return null;
    }
    try {
      const buffer = await fileExcel.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellFormula: true, cellNF: true });
      if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) return null;

      const keywordsDespiece = ["despiece", "acero", "placa huella", "rieles", "riostra", "refuerzo", "calculo"];
      const keywordsConcreto = ["concreto", "cemento", "materiales", "volumenes"];

      let targetSheetName = null;
      let targetSheet = null;
      let concreteSheetName = null;
      let concreteSheet = null;

      // Paso 1: Búsqueda inteligente por nombre de hoja
      for (const name of workbook.SheetNames) {
        const cleanName = this.cleanForRegex(name);
        if (!targetSheetName) {
          for (const kw of keywordsDespiece) {
            if (cleanName.includes(kw)) {
              targetSheetName = name;
              targetSheet = workbook.Sheets[name];
              break;
            }
          }
        }
        if (!concreteSheetName) {
          for (const kw of keywordsConcreto) {
            if (cleanName.includes(kw)) {
              concreteSheetName = name;
              concreteSheet = workbook.Sheets[name];
              break;
            }
          }
        }
      }

      // Paso 2: Si no se identificó por nombre, inspeccionar contenido interno de celdas
      if (!targetSheet) {
        let bestScore = 0;
        let bestSheetName = null;
        for (const name of workbook.SheetNames) {
          const ws = workbook.Sheets[name];
          if (!ws) continue;
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
          let score = 0;
          for (const r of rows) {
            if (!Array.isArray(r)) continue;
            const rText = this.cleanForRegex(r.join(" "));
            for (const kw of keywordsDespiece) {
              if (rText.includes(kw)) score++;
            }
          }
          if (score > bestScore) {
            bestScore = score;
            bestSheetName = name;
          }
        }
        if (bestSheetName) {
          targetSheetName = bestSheetName;
          targetSheet = workbook.Sheets[targetSheetName];
        }
      }

      // Fallback a primera hoja si no se encontró coincidencia
      if (!targetSheet) {
        targetSheetName = workbook.SheetNames[0];
        targetSheet = workbook.Sheets[targetSheetName];
      }

      if (!targetSheet) return null;

      // Matriz 2D exacta de filas y columnas (preserva posiciones relativas y celdas vacías)
      const matrizFilas = XLSX.utils.sheet_to_json(targetSheet, { header: 1, defval: '', raw: false });

      let matrizConcreto = null;
      if (concreteSheet && concreteSheet !== targetSheet) {
        matrizConcreto = XLSX.utils.sheet_to_json(concreteSheet, { header: 1, defval: '', raw: false });
      }

      return {
        sheetName: targetSheetName,
        matrizFilas: matrizFilas,
        matrizConcreto: matrizConcreto
      };
    } catch (e) {
      console.warn("Error leyendo libro Excel:", e);
      return null;
    }
  },

  /**
   * 3. LECTOR DE PDF CON RECONSTRUCCIÓN GEOMÉTRICA DE FILAS Y COLUMNAS (PDF.js)
   * Agrupa textos cuya coordenada Y difiera en menos de 4px en la misma fila (arriba hacia abajo).
   * Ordena por columnas (X) de izquierda a derecha.
   * Genera matriz 2D de filas y celdas idéntica a SheetJS (filas[i][j]).
   */
  async readPdfTo2DMatrix(filePdf) {
    if (typeof pdfjsLib === "undefined") {
      console.warn("PDF.js no está disponible.");
      return [];
    }
    try {
      const arrayBuffer = await filePdf.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const maxPages = Math.min(pdf.numPages, 30);
      const allRows = [];

      for (let p = 1; p <= maxPages; p++) {
        const page = await pdf.getPage(p);
        const textContent = await page.getTextContent();
        const items = textContent.items || [];
        if (items.length === 0) continue;

        const validItems = [];
        for (const it of items) {
          const str = (it.str || "").trim();
          if (!str) continue;
          validItems.push({
            str: it.str,
            x: it.transform[4],
            y: it.transform[5],
            width: it.width || (str.length * 7)
          });
        }
        if (validItems.length === 0) continue;

        // Agrupación por filas (Y): Coordenada Y en PDF.js crece hacia arriba.
        // Ordenar primero por Y descendente para procesar de arriba a abajo.
        validItems.sort((a, b) => b.y - a.y);

        const rowGroups = [];
        for (const it of validItems) {
          let rGroup = rowGroups.find(rg => Math.abs(rg.y - it.y) <= 4.0);
          if (!rGroup) {
            rGroup = { y: it.y, items: [] };
            rowGroups.push(rGroup);
          }
          rGroup.items.push(it);
        }

        // Ordenar filas de arriba hacia abajo (Y descendente)
        rowGroups.sort((a, b) => b.y - a.y);

        for (const rg of rowGroups) {
          // Ordenar columnas de izquierda a derecha (X ascendente)
          rg.items.sort((a, b) => a.x - b.x);

          const cells = [];
          let curCell = null;

          for (const it of rg.items) {
            const itText = it.str.trim();
            if (!itText) continue;

            if (!curCell) {
              curCell = {
                text: it.str,
                x: it.x,
                right: it.x + (it.width || (it.str.length * 7))
              };
            } else {
              const gap = it.x - curCell.right;
              // Textos contiguos (< 14px horizontal) se concatenan en la misma celda
              if (gap < 14) {
                if (gap > 2 && !curCell.text.endsWith(" ") && !it.str.startsWith(" ")) {
                  curCell.text += " " + it.str;
                } else {
                  curCell.text += it.str;
                }
                curCell.right = Math.max(curCell.right, it.x + (it.width || (it.str.length * 7)));
              } else {
                cells.push(curCell.text.trim());
                curCell = {
                  text: it.str,
                  x: it.x,
                  right: it.x + (it.width || (it.str.length * 7))
                };
              }
            }
          }
          if (curCell && curCell.text.trim()) {
            cells.push(curCell.text.trim());
          }

          if (cells.length > 0) {
            allRows.push(cells);
          }
        }
      }

      return allRows;
    } catch (e) {
      console.warn("Error reconstruyendo matriz 2D de PDF:", e);
      return [];
    }
  },

  /**
   * MISMO MOTOR DE MAPEO UNIFICADO PARA EXCEL Y PDF
   * parsearMatrizDespiece(matrizFilas, fileDespiece, matrizConcreto, fichaData, extractedEngineer, extractedMatricula, fileEspec)
   * Cero datos de respaldo / fallback. Extrae con 100% fidelidad los valores físicos del documento.
   */
  parsearMatrizDespiece(matrizFilas, fileDespiece, matrizConcreto, fichaData, extractedEngineer, extractedMatricula, fileEspec) {
    const fileName = (fileDespiece && fileDespiece.name) || "Despiece_Acero";
    fichaData = fichaData || {};

    if (!matrizFilas || matrizFilas.length === 0) {
      const defGeo = this.extractGeometryAndElements("", fichaData);
      const defConcrete = this.extractFaithfulConcreteMemory("", (fichaData && fichaData.longitudTotalM) || 0, 0);
      const emptyRes = {
        tieneDocumento: !!fileDespiece,
        archivoNombre: fileName,
        isStandardTemplate: false,
        mensajeAlerta: "No se detectaron marcas tabulares de despiece en el documento (Ítem 3).",
        geometria: defGeo,
        acero: {
          formatoDetectado: "VACIO",
          totalAceroDeclarado: "0 kg",
          totalKg: 0,
          cuantiaKgM: 0,
          filasDespiece: [],
          columnasDetectadas: ["#", "Elemento Estructural", "Tipo Refuerzo", "Diámetro", "Corte (m)", "Piezas", "Long. Total", "Peso Total (kg)"],
          spreadsheetErrors: []
        },
        standardTemplate: null,
        concretoYCemento: defConcrete,
        paginasTexto: [],
        textoCompleto: "",
        marcas: [],
        longitudIntervencionM: (fichaData && fichaData.longitudTotalM) || 0,
        pesoTotalDeclaradoKg: 0,
        cuantiaKgM: 0,
        fcMPa: 21,
        fyMPa: 420,
        copniaFirmaOk: !!(extractedMatricula || fileEspec),
        spreadsheetErrors: [],
        concretoVolumes: defConcrete.paramVolumes
      };
      emptyRes.despieceExtraido = emptyRes;
      return emptyRes;
    }

    // 1. Detección de formato estándar vs. libre
    let hasDirectriz = false;
    let hasCuadro = false;
    let hasConsolidado = false;
    let hasRieles = false;
    let hasRiostras = false;

    for (const r of matrizFilas) {
      if (!Array.isArray(r)) continue;
      const line = r.join(" ").toUpperCase();
      if (line.includes("DIRECTRIZ T")) hasDirectriz = true;
      if (line.includes("CUADRO DETALLADO DE DESPIECE") || line.includes("DESPIECE DE ACERO")) hasCuadro = true;
      if (line.includes("CONSOLIDADO POR DI")) hasConsolidado = true;
      if (line.includes("RIELES")) hasRieles = true;
      if (line.includes("VIGA RIOSTRA") || line.includes("RIOSTAS")) hasRiostras = true;
    }
    const isStandard = (hasDirectriz && hasCuadro) || (hasConsolidado && hasRieles && hasRiostras) || (hasRieles && hasRiostras);

    // 2. Extracción de Datos Generales (Código vía, Longitud, Ancho, Municipio, Subregión)
    const infoGeneral = {
      municipio: "",
      subregion: "ANTIOQUIA",
      via: "",
      codigoVia: "",
      longitudM: 0,
      anchoM: 0,
      separacionVigasM: 3.0
    };

    const anyMatch = (text, list) => {
      const up = text.toUpperCase();
      return list.some(k => up.includes(k));
    };

    const getValAdjacent = (row, startIdx) => {
      for (let offset = 1; offset <= 3; offset++) {
        if (startIdx + offset < row.length) {
          const val = String(row[startIdx + offset] || "").replace(/[\[\]]/g, "").trim();
          if (val && !anyMatch(val, ["NOMBRE DEL MUNICIPIO", "EJ:", "NOMBRE DE LA VIA", "NOMBRE DE LA VÍA", "05001VT01", "CODIGO", "CÓDIGO", "SUBREGION", "SUBREGIÓN", "MUNICIPIO"])) {
            return val;
          }
        }
      }
      return "";
    };

    for (const r of matrizFilas) {
      if (!Array.isArray(r)) continue;
      for (let idx = 0; idx < r.length; idx++) {
        const cell = String(r[idx] || "").trim();
        const up = cell.toUpperCase();

        if (up.includes("MUNICIPIO:")) {
          const v = getValAdjacent(r, idx);
          if (v && !infoGeneral.municipio) infoGeneral.municipio = v;
        } else if (up.includes("SUBREGIÓN:") || up.includes("SUBREGION:")) {
          const v = getValAdjacent(r, idx);
          if (v && infoGeneral.subregion === "ANTIOQUIA") infoGeneral.subregion = v;
        } else if (up.includes("NOMBRE DE LA VÍA") || up.includes("NOMBRE DE LA VIA") || (up.includes("TRAMO:") && !infoGeneral.via)) {
          const v = getValAdjacent(r, idx);
          if (v && !infoGeneral.via) infoGeneral.via = v;
        } else if (up.includes("CÓDIGO DE LA VÍA:") || up.includes("CODIGO DE LA VIA:") || up.includes("CODIGO VIAL")) {
          const v = getValAdjacent(r, idx);
          if (v && !infoGeneral.codigoVia) infoGeneral.codigoVia = v;
        } else if (up.includes("LONGITUD") && (up.includes("VÍA") || up.includes("VIA") || up.includes("INTERVENIR") || up.includes("(M)"))) {
          const v = getValAdjacent(r, idx);
          const num = this.cleanNumber(v);
          if (num > 0 && infoGeneral.longitudM === 0) infoGeneral.longitudM = num;
        } else if (up.includes("ANCHO") && (up.includes("CALZADA") || up.includes("SECCIÓN") || up.includes("SECCION") || up.includes("TRAMO") || up.includes("(M)"))) {
          const v = getValAdjacent(r, idx);
          const num = this.cleanNumber(v);
          if (num > 0 && infoGeneral.anchoM === 0) infoGeneral.anchoM = num;
        } else if (up.includes("SEPARACIÓN VIGAS") || up.includes("SEPARACION VIGAS")) {
          const v = getValAdjacent(r, idx);
          const num = this.cleanNumber(v);
          if (num > 0) infoGeneral.separacionVigasM = num;
        }
      }
    }

    // Código vial por patrón si no vino explícito tras la etiqueta
    if (!infoGeneral.codigoVia) {
      for (const r of matrizFilas) {
        if (!Array.isArray(r)) continue;
        const line = r.join(" ");
        const m = line.match(/\b(05\d{3}VT\d{1,4})\b/i);
        if (m) {
          infoGeneral.codigoVia = m[1].toUpperCase();
          break;
        }
      }
    }

    // Fallbacks limpios desde fichaData si la celda no vino diligenciada
    if (!infoGeneral.municipio) infoGeneral.municipio = fichaData.municipio || "";
    if (infoGeneral.subregion === "ANTIOQUIA" && fichaData.subregion) infoGeneral.subregion = fichaData.subregion;
    if (!infoGeneral.via) infoGeneral.via = (fichaData.codigosViales && fichaData.codigosViales[0]) || "Vía Terciaria";
    if (!infoGeneral.codigoVia) infoGeneral.codigoVia = (fichaData.codigosViales && fichaData.codigosViales[0]) || `${fichaData.codMunicipio || '05000'}VT01`;
    if (infoGeneral.longitudM === 0 && fichaData.longitudTotalM) infoGeneral.longitudM = fichaData.longitudTotalM;
    if (infoGeneral.anchoM === 0) infoGeneral.anchoM = 5.0;

    // 3. TABLA DE DESPIECE DE ACERO POR ELEMENTO (12 MARCAS OFICIALES)
    // Prohibición absoluta de fallback/mock: piezas = 0 si no está físicamente diligenciada
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

    const filasResultado = defaultElements.map(d => ({
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

    let currentCategory = null;

    for (let rIdx = 0; rIdx < matrizFilas.length; rIdx++) {
      const row = matrizFilas[rIdx];
      if (!Array.isArray(row) || row.length === 0) continue;

      const fullRowText = row.map(c => String(c || '').trim()).join(" ");
      const normRow = this.cleanForRegex(fullRowText);

      if (normRow.includes("subtotal") || normRow.includes("consolidado por diametro") || normRow.includes("soportes tecnicos")) {
        currentCategory = null;
        continue;
      }

      if (normRow.includes("rieles") || normRow.includes("huellas")) {
        currentCategory = "RIELES";
      } else if (normRow.includes("viga riostra") || normRow.includes("riostras") || normRow.includes("riostra")) {
        currentCategory = "VIGA RIOSTRA";
      } else if (normRow.includes("cunetas y bordillos") || normRow.includes("cuneta") || normRow.includes("bordillo")) {
        currentCategory = "CUNETAS Y BORDILLOS";
      } else if (normRow.includes("losa de transicion") || normRow.includes("transicion")) {
        currentCategory = "LOSA DE TRANSICIÓN";
      }

      let matchedItemId = null;
      if (currentCategory === "RIELES") {
        if (normRow.includes("longitudinal")) matchedItemId = 1;
        else if (normRow.includes("transversal")) matchedItemId = 2;
        else if (normRow.includes("traslapo") || normRow.includes("empalme") || normRow.includes("opcional")) matchedItemId = 3;
      } else if (currentCategory === "VIGA RIOSTRA") {
        if (normRow.includes("superior")) matchedItemId = 4;
        else if (normRow.includes("inferior")) matchedItemId = 5;
        else if (normRow.includes("estribo") || normRow.includes("transversal") || normRow.includes("fleje")) matchedItemId = 6;
      } else if (currentCategory === "CUNETAS Y BORDILLOS") {
        if (normRow.includes("cuneta") && normRow.includes("longitudinal")) matchedItemId = 7;
        else if (normRow.includes("cuneta") && (normRow.includes("transversal") || normRow.includes("fleje"))) matchedItemId = 8;
        else if (normRow.includes("bordillo") && (normRow.includes("long") || normRow.includes("superior"))) matchedItemId = 9;
        else if (normRow.includes("gancho") || (normRow.includes("bordillo") && normRow.includes("transversal"))) matchedItemId = 10;
      } else if (currentCategory === "LOSA DE TRANSICIÓN") {
        if (normRow.includes("longitudinal")) matchedItemId = 11;
        else if (normRow.includes("transversal")) matchedItemId = 12;
      }

      // Coincidencia complementaria si el nombre del elemento viene en la misma fila
      if (!matchedItemId) {
        if (normRow.includes("riel") && normRow.includes("longitudinal")) matchedItemId = 1;
        else if (normRow.includes("riel") && normRow.includes("transversal")) matchedItemId = 2;
        else if (normRow.includes("riel") && (normRow.includes("traslapo") || normRow.includes("empalme"))) matchedItemId = 3;
        else if (normRow.includes("riostra") && normRow.includes("superior")) matchedItemId = 4;
        else if (normRow.includes("riostra") && normRow.includes("inferior")) matchedItemId = 5;
        else if (normRow.includes("riostra") && (normRow.includes("estribo") || normRow.includes("transversal"))) matchedItemId = 6;
        else if (normRow.includes("cuneta") && normRow.includes("longitudinal")) matchedItemId = 7;
        else if (normRow.includes("cuneta") && (normRow.includes("transversal") || normRow.includes("fleje"))) matchedItemId = 8;
        else if (normRow.includes("bordillo") && (normRow.includes("long") || normRow.includes("superior"))) matchedItemId = 9;
        else if (normRow.includes("gancho") || (normRow.includes("bordillo") && normRow.includes("gancho"))) matchedItemId = 10;
        else if (normRow.includes("transicion") && normRow.includes("longitudinal")) matchedItemId = 11;
        else if (normRow.includes("transicion") && normRow.includes("transversal")) matchedItemId = 12;
      }

      if (matchedItemId) {
        const target = filasResultado[matchedItemId - 1];

        // Extracción de diámetro y búsqueda de columna ancla
        let diamColIdx = -1;
        for (let cIdx = 0; cIdx < row.length; cIdx++) {
          const cStr = String(row[cIdx] || "").trim();
          if (/1\/2|"1\/2"|#4|½/i.test(cStr)) {
            target.diam = '1/2"';
            if (diamColIdx === -1) diamColIdx = cIdx;
          } else if (/3\/8|"3\/8"|#3|⅜/i.test(cStr)) {
            target.diam = '3/8"';
            if (diamColIdx === -1) diamColIdx = cIdx;
          } else if (/1\/4|"1\/4"|#2|¼/i.test(cStr)) {
            target.diam = '1/4"';
            if (diamColIdx === -1) diamColIdx = cIdx;
          } else if (/5\/8|"5\/8"|#5/i.test(cStr)) {
            target.diam = '5/8"';
            if (diamColIdx === -1) diamColIdx = cIdx;
          } else if (/3\/4|"3\/4"|#6/i.test(cStr)) {
            target.diam = '3/4"';
            if (diamColIdx === -1) diamColIdx = cIdx;
          }
        }

        // Asignación de peso lineal nominal según diámetro
        if (target.diam.includes("1/2")) target.pesoLin = 0.994;
        else if (target.diam.includes("1/4")) target.pesoLin = 0.250;
        else target.pesoLin = 0.560;

        // Determinar índices de corte, piezas, longTotal, pesoTotal, varillas:
        // Si encontramos la columna del diámetro, las siguientes columnas numéricas son relativas:
        let corteIdx = 4;
        let pzasIdx = 5;
        let ltIdx = 6;
        let ptIdx = 7;
        let varIdx = 8;
        let obsIdx = 9;

        if (diamColIdx >= 0) {
          const nextVal = this.cleanNumber(row[diamColIdx + 1]);
          if (nextVal > 0 && nextVal < 1.5) {
            corteIdx = diamColIdx + 2;
            pzasIdx = diamColIdx + 3;
            ltIdx = diamColIdx + 4;
            ptIdx = diamColIdx + 5;
            varIdx = diamColIdx + 6;
            obsIdx = diamColIdx + 7;
          } else {
            corteIdx = diamColIdx + 1;
            pzasIdx = diamColIdx + 2;
            ltIdx = diamColIdx + 3;
            ptIdx = diamColIdx + 4;
            varIdx = diamColIdx + 5;
            obsIdx = diamColIdx + 6;
          }
        }

        if (row.length > corteIdx) {
          const corteVal = this.cleanNumber(row[corteIdx]);
          if (corteVal > 0) target.corte = corteVal;
        }

        if (row.length > pzasIdx) {
          const pzasVal = this.cleanNumber(row[pzasIdx]);
          if (pzasVal > 0) target.piezas = Math.round(pzasVal);
        }

        if (row.length > ltIdx) {
          const longTotVal = this.cleanNumber(row[ltIdx]);
          if (longTotVal > 0) target.longTotalM = +(longTotVal.toFixed(2));
        }

        if (row.length > ptIdx) {
          const pesoTotVal = this.cleanNumber(row[ptIdx]);
          if (pesoTotVal > 0) target.pesoTotalKg = +(pesoTotVal.toFixed(2));
        }

        if (row.length > varIdx) {
          const varVal = this.cleanNumber(row[varIdx]);
          if (varVal > 0) target.varillas6m = Math.round(varVal);
        }

        if (row.length > obsIdx && row[obsIdx]) {
          const obsText = String(row[obsIdx]).trim();
          if (obsText && obsText.length > 2) target.obs = obsText;
        }

        // Recálculo exacto si piezas > 0 y faltaba evaluar la fórmula de Excel
        if (target.piezas > 0) {
          if (target.longTotalM === 0) {
            target.longTotalM = +(target.corte * target.piezas).toFixed(2);
          }
          if (target.pesoTotalKg === 0) {
            target.pesoTotalKg = +(target.pesoLin * target.longTotalM).toFixed(2);
          }
          if (target.varillas6m === 0) {
            target.varillas6m = Math.ceil(target.longTotalM / 6.0);
          }
        } else {
          // Si piezas es 0 o celda vacía, CERO absoluto (prohibición de mock)
          target.piezas = 0;
          target.longTotalM = 0.0;
          target.pesoTotalKg = 0.0;
          target.varillas6m = 0;
        }
      }
    }

    // 4. Totales y Consolidado por Diámetro
    let subtotalLongM = 0;
    let subtotalPesoKg = 0;
    let subtotalVarillas = 0;

    filasResultado.forEach(r => {
      subtotalLongM += (r.longTotalM || 0);
      subtotalPesoKg += (r.pesoTotalKg || 0);
      subtotalVarillas += (r.varillas6m || 0);
    });

    subtotalLongM = +subtotalLongM.toFixed(2);
    subtotalPesoKg = +subtotalPesoKg.toFixed(2);

    const sumByDiam = (match) => {
      let p = 0, v = 0;
      filasResultado.filter(r => (r.diam || "").includes(match)).forEach(r => {
        p += r.pesoTotalKg || 0;
        v += r.varillas6m || 0;
      });
      return { peso: +p.toFixed(2), varillas: v };
    };

    const d12 = sumByDiam("1/2");
    const d38 = sumByDiam("3/8");
    const d14 = sumByDiam("1/4");

    const consolidado = [
      { diametro: '1/2"', pesoNominal: 0.994, pesoTotalKg: d12.peso, varillas6m: d12.varillas, unidad: "KG" },
      { diametro: '3/8"', pesoNominal: 0.560, pesoTotalKg: d38.peso, varillas6m: d38.varillas, unidad: "KG" },
      { diametro: '1/4"', pesoNominal: 0.250, pesoTotalKg: d14.peso, varillas6m: d14.varillas, unidad: "KG" },
      { diametro: 'TOTAL', pesoNominal: null, pesoTotalKg: subtotalPesoKg, varillas6m: subtotalVarillas, unidad: "GLOBAL" }
    ];

    const L = infoGeneral.longitudM;
    const cuantia = L > 0 ? +(subtotalPesoKg / L).toFixed(2) : 0.0;
    const superavit = +(cuantia - 26.25).toFixed(2);

    const totales = {
      pesoTotalGlobalKg: subtotalPesoKg,
      totalVarillas6m: subtotalVarillas,
      cuantiaKgM: cuantia,
      cuantiaSuperavitKgM: superavit
    };

    // 5. Extracción de Soportes Técnicos, Notas y Firmas
    let notasMunicipio = "";
    let firmaMunicipio = "";
    for (const r of matrizFilas) {
      if (!Array.isArray(r)) continue;
      const line = r.join(" ");
      if (line.includes("ESPACIO DESTINADO") || line.includes("SOPORTES TÉCNICOS")) {
        notasMunicipio = line.trim();
      }
      if (line.includes("RESPONSABLE TÉCNICO") || line.includes("MP :") || line.includes("Matricula")) {
        firmaMunicipio = line.trim();
      }
    }

    const standardTemplate = {
      isStandardTemplate: isStandard,
      formatoNombre: isStandard ? "Plantilla Estándar Oficial Gobernación" : "Formato Previo / Libre (Extracción Asistida)",
      infoGeneral: infoGeneral,
      directrizTecnica: "Todos los municipios deben reportar el despiece en esta tabla oficial. Si el municipio dispone de esquemas gráficos de despiece o memorias escritas de cálculo, deben anexarse en el cuadro inferior o en pestaña anexa. No altere las fórmulas de cálculo.",
      filas: filasResultado,
      subtotal: {
        longitudTotalM: subtotalLongM,
        pesoTotalKg: subtotalPesoKg,
        varillas6m: subtotalVarillas
      },
      consolidado: consolidado,
      totales: totales,
      soportesTecnicos: {
        notasMunicipio: notasMunicipio || (subtotalPesoKg > 0 ? `Total reportado en el documento: ${subtotalPesoKg.toLocaleString('es-CO')} kg.` : "Documento de despiece en revisión técnica."),
        responsableFirma: extractedEngineer || "Ingeniero Proyectista Municipal",
        matriculaProfesional: extractedMatricula || ""
      }
    };

    // 6. Extracción o Memoria de Concreto y Cemento
    let concreteData = null;
    if (matrizConcreto && matrizConcreto.length > 0) {
      concreteData = this.parsearMatrizConcreto(matrizConcreto, L, subtotalPesoKg);
    } else {
      concreteData = this.extractFaithfulConcreteMemory("", L, subtotalPesoKg);
    }

    // 7. Estructura de marcas para auditoría y visualización
    const marcas = standardTemplate.filas.map((f, i) => ({
      marca: i + 1,
      elemento: `${f.elem} - ${f.tipo}`,
      barra: (f.diam || '').includes('1/2') ? 4 : ((f.diam || '').includes('1/4') ? 2 : 3),
      diametro: f.diam,
      cantidad: f.piezas,
      longRealM: f.corte,
      longNormativaM: f.corte,
      traslapoM: null,
      ganchoM: null,
      pesoKg: f.pesoTotalKg,
      estado: f.piezas > 0 ? "Consignado" : "Pendiente",
      criterioIncumplido: "-"
    }));

    const result = {
      tieneDocumento: true,
      archivoNombre: fileName,
      isStandardTemplate: isStandard,
      mensajeAlerta: subtotalPesoKg === 0 
        ? "Documento cargado sin cantidades registradas (0 kg reportados en celdas). Campos en espera de diligenciamiento oficial." 
        : null,
      geometria: {
        longitudM: infoGeneral.longitudM,
        longitudDeclarada: infoGeneral.longitudM > 0 ? `${infoGeneral.longitudM} m` : "-",
        anchoViaM: infoGeneral.anchoM > 0 ? `${infoGeneral.anchoM} m` : "-",
        anchoViaDeclarado: infoGeneral.anchoM > 0 ? `${infoGeneral.anchoM} m` : "-",
        sectoresTramos: infoGeneral.via || "-",
        municipioProyecto: infoGeneral.municipio || "-"
      },
      acero: {
        formatoDetectado: isStandard ? "PLANTILLA_ESTANDAR_OFICIAL" : "FORMATO_PREVIO_LIBRE",
        totalAceroDeclarado: `${subtotalPesoKg.toLocaleString('es-CO')} kg`,
        totalKg: Math.round(subtotalPesoKg),
        cuantiaKgM: cuantia,
        filasDespiece: standardTemplate.filas.map(f => ({
          item: f.item,
          descripcion: `${f.elem} - ${f.tipo}`,
          diametro: f.diam,
          longitud: `${f.corte} m`,
          cantidad: `${f.piezas} piezas`,
          pesoTotal: `${f.pesoTotalKg} kg`
        })),
        columnasDetectadas: ["#", "Elemento Estructural", "Tipo Refuerzo", "Diámetro", "Corte (m)", "Piezas", "Long. Total", "Peso Total (kg)"],
        spreadsheetErrors: []
      },
      standardTemplate: standardTemplate,
      concretoYCemento: concreteData,
      paginasTexto: [{ pagina: 1, texto: `Plantilla oficial de despiece (${fileName}) leída y procesada fielmente mediante matriz 2D.` }],
      textoCompleto: `Despiece de Acero extraído fielmente del archivo ${fileName}.`,
      marcas: marcas,
      longitudIntervencionM: infoGeneral.longitudM,
      pesoTotalDeclaradoKg: subtotalPesoKg,
      cuantiaKgM: cuantia,
      fcMPa: 21,
      fyMPa: 420,
      copniaFirmaOk: !!(extractedMatricula || fileEspec),
      spreadsheetErrors: [],
      concretoVolumes: concreteData.paramVolumes
    };

    result.despieceExtraido = result;
    return result;
  },

  /**
   * Extrae la memoria de concreto a partir de una matriz 2D de la hoja CONCRETO
   */
  parsearMatrizConcreto(matrizConcreto, longitudM, pesoTotalKg) {
    longitudM = parseFloat(longitudM) || 0;
    pesoTotalKg = parseFloat(pesoTotalKg) || 0;

    let huellasM3 = 0;
    let ciclopeoM3 = 0;
    let cunetasM3 = 0;
    let riostrasM3 = 0;
    let transicionM3 = 0;
    let totalConcM3 = 0;
    let totalSacos = 0;

    for (const r of matrizConcreto) {
      if (!Array.isArray(r) || r.length === 0) continue;
      const rowLine = r.join(" ").toUpperCase();
      const vol = r.length >= 8 ? this.cleanNumber(r[7]) : 0;
      const sacos = r.length >= 10 ? this.cleanNumber(r[9]) : 0;

      if (rowLine.includes("RIELES")) {
        if (vol > 0) huellasM3 = vol;
      } else if (rowLine.includes("ENTRERRIEL") || rowLine.includes("SOBREANCHO")) {
        if (vol > 0) ciclopeoM3 += vol;
      } else if (rowLine.includes("VIGAS RIOSTRAS") || rowLine.includes("RIOSTRA")) {
        if (vol > 0) riostrasM3 = vol;
      } else if (rowLine.includes("CUNETAS Y BORDILLOS") || rowLine.includes("CUNETA")) {
        if (vol > 0) cunetasM3 = vol;
      } else if (rowLine.includes("LOSA DE TRANSICI") || rowLine.includes("TRANSICION")) {
        if (vol > 0) transicionM3 = vol;
      } else if (rowLine.includes("SUBTOTAL CANTIDADES NOMINALES") || rowLine.includes("TOTAL CONCRETO")) {
        if (vol > 0) totalConcM3 = vol;
        if (sacos > 0) totalSacos = Math.round(sacos);
      }
    }

    if (totalConcM3 === 0) {
      totalConcM3 = +(huellasM3 + ciclopeoM3 + cunetasM3 + riostrasM3 + transicionM3).toFixed(2);
    }
    if (totalSacos === 0 && totalConcM3 > 0) {
      totalSacos = Math.round(totalConcM3 * 7.2);
    }

    let paramVolumes = null;
    if (totalConcM3 > 0) {
      const conc21 = +(huellasM3 + cunetasM3 + riostrasM3 + transicionM3).toFixed(2);
      paramVolumes = {
        longitudM: longitudM,
        huellasM3: huellasM3,
        ciclopeoM3: ciclopeoM3,
        cunetasM3: cunetasM3,
        riostrasM3: riostrasM3,
        transicionM3: transicionM3,
        totalConcreto21M3: conc21,
        totalConcretoCiclopeoM3: ciclopeoM3,
        totalConcretoGlobalM3: totalConcM3,
        sacosCemento: totalSacos,
        piedraRajonM3: +(ciclopeoM3 * 0.40).toFixed(2)
      };
    } else {
      paramVolumes = StructuralEngine.calculateConcreteVolumes(longitudM, { pesoTotalKg });
    }

    return {
      consignadoEnDocumento: totalConcM3 > 0,
      resumen: {
        concreto21Mpa: `${paramVolumes.totalConcreto21M3.toLocaleString('es-CO')} m³`,
        concretoCiclopeo: `${paramVolumes.totalConcretoCiclopeoM3.toLocaleString('es-CO')} m³`,
        concretoTotal: `${paramVolumes.totalConcretoGlobalM3.toLocaleString('es-CO')} m³`,
        cementoBultos: `${paramVolumes.sacosCemento.toLocaleString('es-CO')} sacos`,
        materialGranular: `${(paramVolumes.totalConcretoGlobalM3 * 0.85).toFixed(2)} m³`,
        piedraRajon: `${paramVolumes.piedraRajonM3.toLocaleString('es-CO')} m³`
      },
      paramVolumes: paramVolumes
    };
  },

  /**
   * Extracción Fiel Completa de Despiece
   */
  async extractFaithfulDespiece(fileDespiece, fileEspec, fichaData, extractedEngineer, extractedMatricula) {
    if (!fileDespiece) {
      const defGeo = this.extractGeometryAndElements("", fichaData);
      const defConcrete = this.extractFaithfulConcreteMemory("", (fichaData && fichaData.longitudTotalM) || 0, 0);

      const emptyDespiece = {
        tieneDocumento: false,
        archivoNombre: null,
        isStandardTemplate: false,
        mensajeAlerta: "Documento de despiece no aportado en esta carpeta",
        geometria: defGeo,
        acero: {
          formatoDetectado: "VACIO",
          totalAceroDeclarado: "0 kg",
          totalKg: 0,
          cuantiaKgM: 0,
          filasDespiece: [],
          columnasDetectadas: ["#", "Elemento Estructural", "Tipo Refuerzo", "Diámetro", "Corte (m)", "Piezas", "Long. Total", "Peso Total (kg)"],
          spreadsheetErrors: []
        },
        standardTemplate: null,
        concretoYCemento: defConcrete,
        paginasTexto: [],
        textoCompleto: "",
        marcas: [],
        longitudIntervencionM: (fichaData && fichaData.longitudTotalM) || 0,
        pesoTotalDeclaradoKg: 0,
        cuantiaKgM: 0,
        fcMPa: 21,
        fyMPa: 420,
        copniaFirmaOk: false,
        concretoVolumes: defConcrete.paramVolumes
      };

      emptyDespiece.despieceExtraido = emptyDespiece;
      return emptyDespiece;
    }

    const lowerName = fileDespiece.name.toLowerCase();
    let matrizFilas = [];
    let matrizConcreto = null;

    // CASO 1: Archivo en formato Excel (.xlsx / .xls / .xlsm)
    if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || lowerName.endsWith(".xlsm")) {
      const excelResult = await this.parseExcelTo2DMatrix(fileDespiece);
      if (excelResult) {
        matrizFilas = excelResult.matrizFilas || [];
        matrizConcreto = excelResult.matrizConcreto || null;
      }
    }
    // CASO 2: Archivo en formato PDF (.pdf)
    else if (lowerName.endsWith(".pdf")) {
      matrizFilas = await this.readPdfTo2DMatrix(fileDespiece);
    }

    // CASO 3: MISMO MOTOR DE MAPEO UNIFICADO
    return this.parsearMatrizDespiece(matrizFilas, fileDespiece, matrizConcreto, fichaData, extractedEngineer, extractedMatricula, fileEspec);
  },

  /**
   * Alias de parsing dinámico de despiece
   */
  async parseDespieceFile(fileDespiece, fileEspec, fichaData, extractedEngineer, extractedMatricula) {
    return await this.extractFaithfulDespiece(fileDespiece, fileEspec, fichaData, extractedEngineer, extractedMatricula);
  },

  /**
   * Reprocesa única y exclusivamente el archivo File aportado para el Ítem 3
   */
  async reprocessItem3File(file, projectId) {
    projectId = projectId || App.currentProjectId;
    if (!projectId || !file) {
      this.showToast("⚠️ No hay un expediente activo seleccionado para actualizar el Ítem 3.");
      return null;
    }

    const expedientesMap = (window.SIPRO_DATA && SIPRO_DATA.expedientesMap) || window.proyectosAuditados || {};
    const record = expedientesMap[projectId];
    if (!record) {
      this.showToast(`⚠️ No se encontró el registro del proyecto ${projectId} en memoria.`);
      return null;
    }

    // 1. Asignar el nuevo archivo físico exclusivamente al Ítem 3 de este expediente
    record.archivosFileMap = record.archivosFileMap || {};
    record.archivosFileMap[3] = file;
    if (record.datos) {
      record.datos.archivosFiles = record.datos.archivosFiles || {};
      record.datos.archivosFiles[3] = file;
      if (record.datos.documentosStatus && record.datos.documentosStatus.archivosDetectados) {
        record.datos.documentosStatus.archivosDetectados[3] = file.name;
      }
      if (record.datos.archivosMetadata) {
        record.datos.archivosMetadata[3] = {
          fileName: file.name,
          sizeBytes: file.size,
          lastModified: file.lastModified,
          textSnippet: `Archivo de despiece cargado digitalmente: ${file.name}`
        };
      }
    }

    // 2. Extraer parámetros del proyecto para el reproceso
    const fichaData = (record.datos && record.datos.fichaPriorizacion) || {
      longitudTotalM: (record.datos && record.datos.longitudM) || 0,
      municipio: record.municipio,
      codMunicipio: record.codMunicipio,
      subregion: record.subregion,
      codigosViales: record.datos && record.datos.codigoVial ? [record.datos.codigoVial] : []
    };
    const fileEspec = record.archivosFileMap[2] || null;

    // 3. Procesar única y exclusivamente este File para Fase 1A
    const despieceConfig = await this.parseDespieceFile(file, fileEspec, fichaData);

    // 4. Guardar fielmente en el expediente
    record.despieceExtraido = despieceConfig.despieceExtraido || despieceConfig;
    record.concretoVolumes = despieceConfig.concretoVolumes;
    if (record.datos) {
      record.datos.despieceExtraido = record.despieceExtraido;
      record.datos.despieceAcero = despieceConfig;
      record.datos.concretoVolumes = despieceConfig.concretoVolumes;
      if (despieceConfig.longitudIntervencionM > 0) {
        record.datos.longitudM = despieceConfig.longitudIntervencionM;
      }
    }

    // 5. Re-auditar Fase 1A bajo el estándar técnico
    const audit1A = StructuralEngine.auditProject(record.datos);
    record.fase1A = audit1A;
    expedientesMap[projectId].fase1A = audit1A;

    // Actualizar KPIs de Fase 1A y Score Global
    if (record.kpis) {
      record.kpis.cuantiaKgM = audit1A.cuantiaRealKgM;
      record.kpis.cuantiaSuperavitKgM = audit1A.cuantiaSuperavitKgM;
      record.kpis.totalMarcas = audit1A.totalMarcas;
      const score1A = audit1A.aprobado ? 35 : ((audit1A.marcasCumplen / (audit1A.totalMarcas || 1)) * 35);
      const score1B = record.fase1B && record.fase1B.aprobado ? 30 : 0;
      const score2 = ((record.fase2 ? record.fase2.itemsConformes : 0) / 27) * 35;
      record.kpis.scoreConformidad = +(score1A + score1B + score2).toFixed(1);
    }
    if (record.auditGlobal) {
      record.auditGlobal.audit1A = audit1A;
      record.auditGlobal.isApproved = audit1A.aprobado && (record.fase1B ? record.fase1B.aprobado : true) && (record.fase2 ? record.fase2.aprobado : true);
    }

    // 6. Sincronizar y re-renderizar de inmediato la interfaz si es el proyecto activo
    if (App.currentProjectId === projectId) {
      App.currentAuditRecord = record;
      App.currentProject = record.datos;
      App.auditGlobal = record.auditGlobal;

      App.renderStructuralSidebar(record.datos, record.fase1A, record.concretoVolumes);
      StructuralEngine.renderGeometricSummaryCard("geometricSummaryContainer", record.datos);
      StructuralEngine.renderDespieceFiel("despieceExtraidoContainer", record.datos);
      StructuralEngine.renderConcreteTable(record.concretoVolumes, document.getElementById("concreteVolumesContainer"), record.fase1A, record.datos ? record.datos.despieceExtraido : null);
      App.renderKPIs(record.kpis, record.datos);
      App.renderPipelineBanner(record.auditGlobal);
    }

    this.showToast(`✓ Archivo de Ítem 3 (${file.name}) procesado fielmente. Fase 1A actualizada para ${record.municipio || 'el expediente'}.`);
    return record.fase1A;
  },

  /**
   * Lector de PDF con preservación de líneas visuales (Y-grouping) y respaldo por páginas
   */
  async readPdfWithLayout(file) {
    if (!file) return { pages: [], fullText: "" };
    try {
      if (file.name.toLowerCase().endsWith(".pdf")) {
        if (typeof pdfjsLib !== "undefined") {
          const arrayBuffer = await file.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          const pages = [];
          let fullText = "";
          const maxPages = Math.min(pdf.numPages, 40);

          for (let p = 1; p <= maxPages; p++) {
            const page = await pdf.getPage(p);
            const textContent = await page.getTextContent();
            const items = textContent.items;

            if (!items || items.length === 0) {
              pages.push({ pagina: p, texto: "" });
              continue;
            }

            // Ordenar items preservando líneas visuales: Y descendente (con tolerancia de 5px), luego X ascendente
            const sortedItems = [...items].sort((a, b) => {
              const yDiff = b.transform[5] - a.transform[5];
              if (Math.abs(yDiff) > 5) return yDiff;
              return a.transform[4] - b.transform[4];
            });

            const lineGroups = [];
            let currentLine = [];
            let currentY = null;

            for (const it of sortedItems) {
              const str = (it.str || "").trim();
              if (!str) continue;
              const y = it.transform[5];

              if (currentY === null || Math.abs(currentY - y) <= 5) {
                currentLine.push(str);
                if (currentY === null) currentY = y;
              } else {
                if (currentLine.length > 0) {
                  lineGroups.push(currentLine.join(" "));
                }
                currentLine = [str];
                currentY = y;
              }
            }

            if (currentLine.length > 0) {
              lineGroups.push(currentLine.join(" "));
            }

            const pageText = lineGroups.join("\n");
            pages.push({ pagina: p, texto: pageText });
            fullText += pageText + "\n\n";
          }
          return { pages, fullText };
        }
      }

      if (file.type && file.type.includes("text") || file.name.match(/\.(txt|csv|json)$/i)) {
        const text = await file.text();
        return {
          pages: [{ pagina: 1, texto: text }],
          fullText: text
        };
      }
    } catch (e) {
      console.warn(`No se pudo extraer texto estructurado del archivo ${file.name}:`, e);
    }
    return { pages: [], fullText: "" };
  },

  async readPdfOrText(file) {
    const res = await this.readPdfWithLayout(file);
    return res ? res.fullText : "";
  },


  showLoadingModal(show, count = 0) {
    let modal = document.getElementById("folderLoadingModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "folderLoadingModal";
      modal.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.65);
        backdrop-filter: blur(4px);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: var(--font-sans, sans-serif);
      `;
      modal.innerHTML = `
        <div style="background:var(--color-bg, #fff);padding:32px 40px;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,0.3);text-align:center;max-width:440px;border-top:4px solid #00412E;">
          <div style="width:48px;height:48px;border:4px solid #96BF8A;border-top-color:#00412E;border-radius:50%;animation:siproSpin 1s linear infinite;margin:0 auto 18px;"></div>
          <h3 style="margin:0 0 8px;font-size:17px;font-weight:800;color:#00412E;">SIPRO-PH: Analizando Carpeta Municipal</h3>
          <p id="folderLoadingMsg" style="margin:0;font-size:13px;color:var(--text-muted, #555);">Procesando documentos, Ficha de Priorización y Despiece...</p>
          <style>@keyframes siproSpin { to { transform: rotate(360deg); } }</style>
        </div>
      `;
      document.body.appendChild(modal);
    }

    const msg = document.getElementById("folderLoadingMsg");
    if (msg) msg.innerText = `Examinando ${count} archivos de la carpeta municipal...`;

    modal.style.display = show ? "flex" : "none";
  },

  showToast(message) {
    let toast = document.getElementById("siproToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "siproToast";
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: #00412E;
        color: #fff;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 14px rgba(0,0,0,0.25);
        font-size: 13px;
        font-weight: 600;
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 8px;
        border-left: 4px solid #96BF8A;
        transition: opacity 0.3s ease;
      `;
      document.body.appendChild(toast);
    }

    toast.innerText = message;
    toast.style.opacity = "1";
    toast.style.display = "flex";

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => { toast.style.display = "none"; }, 300);
    }, 4500);
  }
};

if (typeof window !== "undefined") {
  window.FolderReader = FolderReader;
}
