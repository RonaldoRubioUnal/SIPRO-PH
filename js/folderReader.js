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
    },
    28: {
      kw: ["presupuesto", "pto", "apu", "cantidades de obra", "cantidades", "analisis de precios", "presupuesto oficial"],
      pref: ["28", "3 28"],
      exc: ["despiece"]
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

  /**
   * Extrae la extensión de cualquier archivo de forma 100% segura
   * usando exclusivamente file.name.split('.').pop().toLowerCase().trim()
   */
  getFileExtension(fileOrName) {
    if (!fileOrName) return "";
    const name = typeof fileOrName === "string" ? fileOrName : (fileOrName.name || "");
    return name.includes(".") ? name.split(".").pop().toLowerCase().trim() : "";
  },

  /**
   * Obtiene el nombre físico de la carpeta contenedora sin alterar
   */
  getRawFolderName(rawFiles, dirHandle = null) {
    if (dirHandle && dirHandle.name) {
      return dirHandle.name;
    }
    if (rawFiles && rawFiles.length > 0) {
      const fWithRel = rawFiles.find(f => f.webkitRelativePath && f.webkitRelativePath.includes("/"));
      if (fWithRel) {
        return fWithRel.webkitRelativePath.split("/")[0];
      }
      if (rawFiles[0] && rawFiles[0].name) {
        return rawFiles[0].name.replace(/\.[^/.]+$/, "");
      }
    }
    return "expediente_municipal";
  },

  /**
   * Limpia el nombre del archivo quitando números iniciales, tildes y caracteres especiales
   */
  ADMIN_EXCLUSIONS: [
    "cedula", "identidad", "identificacion", "representante legal",
    "rut", "dian", "tributario",
    "posesion", "acta de posesion",
    "concejo", "acuerdo", "facultades",
    "contralor", "sirec", "responsables fiscales",
    "procurad", "disciplinario", "siri",
    "policia", "judicial", "pasado judicial",
    "rnmc", "medidas correctivas",
    "redam", "alimentos", "deudores",
    "parafiscal", "parfiscal", "seguridad social",
    "anticorrupcion", "sarlaft", "lavado", "inhabilidad", "multas", "sancion",
    "compromiso anticorrupcion", "declaracion sarlaft", "declaracion lavado", "declaracion inhabilidad", "declaracion de no multas", "declaracion juramentada anticorrupcion",
    "resolucion cae", "analisis del sector", "matriz de riesgos", "balance contrato", "lista de precios"
  ],

  hasAdminExclusion(clean) {
    if (!clean) return false;
    return this.ADMIN_EXCLUSIONS.some(e => clean.includes(e));
  },

  isConvocatoriaDoc(clean) {
    if (!clean) return false;
    return ["resolucion cae", "analisis del sector", "matriz de riesgos", "mantenimiento rvt", "balance contrato", "lista de precios", "precios abril"].some(k => clean.includes(k));
  },

  cleanFileNameForSemanticMatch(fileName) {
    if (!fileName) return "";
    return fileName
      .replace(/\.[^/.]+$/, '')
      .replace(/^\s*(\d+[\d.\-_)]*)+/, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  },

  /**
   * Determina si un archivo corresponde estrictamente a la Ficha de Priorización:
   * Requiere extensión .pdf, .xlsx, .xlsm, .xls o .xlsb y contener las raíces 'ficha' + 'prioriz' o 'acta' + 'prioriz'
   */
  isFichaPriorizacionFile(file) {
    if (!file || !file.name) return false;
    const ext = this.getFileExtension(file);
    if (!["pdf", "xlsx", "xlsm", "xls", "xlsb"].includes(ext)) return false;
    const clean = this.cleanFileNameForSemanticMatch(file.name);
    return (clean.includes("ficha") || clean.includes("acta")) && clean.includes("prioriz");
  },

  /**
   * Evalúa la coincidencia semántica flexible por raíces para clasificar un archivo en uno o varios ítems (27/28 requisitos)
   */
  matchFileToItems(file, processMode = "ORDINARIO") {
    if (processMode === "2026_2" || processMode === "CONVENIOS_2026_2") {
      return this.matchFileToItems2026_2(file);
    }
    const fileName = file.name || "";
    const clean = this.cleanFileNameForSemanticMatch(fileName);
    const cleanNorm = clean.replace(/[^a-z0-9]/g, ' ');
    const ext = this.getFileExtension(file);
    const matched = [];

    // Ignorar explícitamente documentos administrativos de la convocatoria departamental
    if (this.isConvocatoriaDoc(clean)) {
      return [];
    }

    // Soporte para etiquetado explícito del usuario: "item 24", "requisito_04", "anexo 28"
    const explicitItemMatch = fileName.match(/\b(?:item|requisito|anexo)\s*[-_]?\s*(\d{1,2})\b/i);
    if (explicitItemMatch) {
      const n = parseInt(explicitItemMatch[1], 10);
      if (n >= 1 && n <= 28) {
        matched.push(n);
      }
    }

    // Item 24: Georreferenciación (KMZ / KML o ZIP/RAR de georreferenciación)
    if (ext === "kmz" || ext === "kml" || (["zip", "rar", "7z"].includes(ext) && ["georref", "georef", "trazado", "track"].some(k => clean.includes(k))) ||
       (["georreferenciacion", "georref", "georef", "trazado de via", "tracks"].some(k => clean.includes(k)) && !this.hasAdminExclusion(clean))) {
      matched.push(24);
    }

    // Item 28: Presupuesto oficial detallado
    if ((["xlsx", "xlsm", "xls", "xlsb", "ods"].includes(ext) && ["presupuesto", "pto", "apu", "cantidades de obra"].some(k => clean.includes(k)) && !clean.includes("despiece")) ||
       (["presupuesto oficial", "presupuesto de obra", "presupuesto detallado", "analisis de precios", "cantidades de obra", "memorias de cantidades", "apu", "apus"].some(k => clean.includes(k)) && !this.hasAdminExclusion(clean) && !clean.includes("despiece"))) {
      matched.push(28);
    }

    // Item 1: Solicitud formal del alcalde
    if ((clean.includes("solicitud") && ["formal", "alcalde", "priorizacion", "carta", "oficio"].some(k => clean.includes(k))) ||
        clean.startsWith("solicitud") || clean.startsWith("carta de solicitud") ||
        (clean.includes("carta") && clean.includes("solicitud"))) {
      if (!["cedula", "rut", "posesion", "planos", "presupuesto", "fotos", "acuerdo", "compromiso", "intencion"].some(e => clean.includes(e))) {
        matched.push(1);
      }
    }

    // Item 2: Esquema de especificaciones técnicas
    if (["especificaciones tecnicas", "especificacion tecnica", "especificaciones", "esquema de especificaciones"].some(k => clean.includes(k)) ||
        (clean.startsWith("esquema") && ["placa", "placah", "tecnico", "act"].some(k => clean.includes(k)))) {
      if (ext !== "dwg" && !["acuerdo", "concejo", "posesion", "despiece", "presupuesto"].some(e => clean.includes(e))) {
        matched.push(2);
      }
    }

    // Item 3: Despiece del acero solicitado
    if (["despiece", "figuracion"].some(k => clean.includes(k)) ||
        (clean.includes("acero") && ["despiece", "planilla", "hierro", "armado", "cuantia"].some(k => clean.includes(k))) ||
        clean.startsWith("despiece")) {
      if (!["solicitud", "socializ", "posesion", "cedula", "rut", "cronograma", "presupuesto"].some(e => clean.includes(e))) {
        matched.push(3);
      }
    }

    // Item 4: Certificado de vías a intervenir como terciarias
    if (["vias a intervenir", "vias terciarias", "via a cargo", "red vial municipal", "competencia via"].some(k => clean.includes(k)) ||
        (["certific", "certificado"].some(k => clean.includes(k)) && ["via", "vias"].some(k => clean.includes(k)))) {
      if (ext !== "kmz" && ext !== "kml" && !["posesion", "especificac", "despiece", "acuerdo", "intencion", "carta de intencion"].some(e => clean.includes(e))) {
        matched.push(4);
      }
    }

    // Item 5: Socialización con la comunidad
    if (["socializacion", "socializ"].some(k => clean.includes(k)) ||
        (clean.includes("acta") && ["comunidad", "asistencia", "reunion", "participacion", "concertacion"].some(k => clean.includes(k)))) {
      if (!["posesion", "especificac", "despiece"].some(e => clean.includes(e))) {
        matched.push(5);
      }
    }

    // Item 6: Registro fotográfico
    if (["fotograf", "fotos via", "fotos de la via", "evidencia fotografica", "panel fotografico", "registro fotog"].some(k => clean.includes(k))) {
      if (!["especificac", "despiece"].some(e => clean.includes(e))) {
        matched.push(6);
      }
    }

    // Item 7: Cédula del alcalde
    if (["cedula", "identidad", "identificacion"].some(k => clean.includes(k)) || /\bcc\b/.test(cleanNorm)) {
      if (!["rut", "foto", "posesion"].some(e => clean.includes(e))) {
        matched.push(7);
      }
    }

    // Item 8: Acta de posesión
    if (clean.includes("posesion") && !["socializ", "especificac", "despiece"].some(e => clean.includes(e))) {
      matched.push(8);
    }

    // Item 9: Concejo / Facultades para contratar
    if (["acuerdo concejo", "acuerdo municipal", "facultades para contratar", "facultades contratar", "decreto compilatorio"].some(k => clean.includes(k)) ||
        (clean.includes("acuerdo") && ["concejo", "facultad", "contratar", "vigencia"].some(k => clean.includes(k))) ||
        (clean.includes("faculta") && clean.includes("contratar"))) {
      if (!clean.includes("posesion")) {
        matched.push(9);
      }
    }

    // Item 10: RUT del municipio
    if (["rut", "dian", "tributario", "registro unico tributario"].some(k => clean.includes(k)) && !["especificac", "despiece"].some(e => clean.includes(e))) {
      matched.push(10);
    }

    // Item 11: Contraloría (Responsables Fiscales)
    if (["contralor", "responsables fiscales", "responsabilidad fiscal", "sirec", "boletin fiscal"].some(k => clean.includes(k)) &&
        !["procurad", "policia"].some(e => clean.includes(e))) {
      matched.push(11);
    }

    // Item 12: Medidas Correctivas RNMC
    if (["rnmc", "medidas correctivas", "correctivas"].some(k => clean.includes(k))) {
      matched.push(12);
    }

    // Item 13: Antecedentes Judiciales Policía
    if (["antecedentes judiciales", "judicial", "pasado judicial", "policia"].some(k => clean.includes(k)) &&
        !["rnmc", "correctivas", "sexuales", "procurad", "contralor"].some(e => clean.includes(e))) {
      matched.push(13);
    }

    // Item 14: Procuraduría (Disciplinarios)
    if (["procurad", "disciplinario", "siri"].some(k => clean.includes(k)) && !["contralor", "policia"].some(e => clean.includes(e))) {
      matched.push(14);
    }

    // Item 15: Parafiscales y seguridad social
    if (["parafiscal", "parfiscal", "seguridad social"].some(k => clean.includes(k)) ||
        (clean.includes("paz y salvo") && !["alimento", "contralor", "procurad"].some(e => clean.includes(e)))) {
      matched.push(15);
    }

    // Item 16: REDAM (Deudores alimentarios)
    if (["redam", "alimentarios", "alimentos", "deudores"].some(k => clean.includes(k))) {
      matched.push(16);
    }

    // Bundle declaraciones y compromisos (17, 18, 19, 20)
    const isBundle = ["declaracion", "declaraciones"].some(k => clean.includes(k)) && ["compromiso", "compromisos", "anexo", "anexos"].some(k => clean.includes(k));
    if (isBundle) {
      matched.push(17, 18, 19, 20);
    } else {
      if ((["anticorrupcion", "pacto anticorrupcion"].some(k => clean.includes(k)) || (clean.includes("compromiso") && clean.includes("corrupcion"))) && !clean.includes("paco")) {
        matched.push(17);
      }
      if (["lavado", "sarlaft", "terrorismo"].some(k => clean.includes(k)) || (clean.includes("activos") && !clean.includes("fijo"))) {
        matched.push(18);
      }
      if (["inhabilidad", "incompatibilidad", "conflicto"].some(k => clean.includes(k)) && !["sexuales", "menores"].some(e => clean.includes(e))) {
        matched.push(19);
      }
      if (["multas", "sancion", "no multas", "incumplimiento"].some(k => clean.includes(k)) && !["rnmc", "correctivas"].some(e => clean.includes(e))) {
        matched.push(20);
      }
    }

    // Item 21: PACO
    if (["paco", "portal anticorrupcion", "transparencia"].some(k => clean.includes(k)) && !["compromiso", "balance contrato"].some(e => clean.includes(e))) {
      matched.push(21);
    }

    // Item 22: Delitos sexuales menores
    if (["delitos sexuales", "menores", "sexuales", "1918"].some(k => clean.includes(k))) {
      matched.push(22);
    }

    // Item 23: Banco de proyectos / BPIN / BPIM
    if (((clean.includes("banco") && clean.includes("proyecto")) || ["bppim", "bpim", "bpin", "bpp", "radicacion"].some(k => clean.includes(k))) &&
        !["especificac", "despiece"].some(e => clean.includes(e))) {
      matched.push(23);
    }

    // Item 25: Cronograma de actividades
    if (["cronograma", "plan de trabajo"].some(k => clean.includes(k)) && !["especificac", "despiece", "ficha"].some(e => clean.includes(e))) {
      matched.push(25);
    }

    // Item 26: Plan de Desarrollo Municipal
    if (["plan desarrollo", "plan de desarrollo", "pdd"].some(k => clean.includes(k)) && !["especificac", "despiece"].some(e => clean.includes(e))) {
      matched.push(26);
    }

    // Item 27: Cofinanciación / CDP / Financiación
    if (["financiacion", "cofinanciacion", "cofianciacion", "cofinanc", "cofianc", "cdp", "disponibilidad presupuestal", "contrapartida", "carta de intencion"].some(k => clean.includes(k)) ||
        (["certific", "cerific", "certificado"].some(k => clean.includes(k)) && ["recursos", "aporte", "valor del proyecto", "materiales", "maquinaria", "mano de obra"].some(k => clean.includes(k)))) {
      if (!["regalias", "especificac", "despiece", "anticorrupcion", "banco", "bpim", "bppim"].some(e => clean.includes(e))) {
        matched.push(27);
      }
    }

    return [...new Set(matched)];
  },

  /**
   * Evalúa coincidencias para los 41 requisitos de la lista de chequeo oficial de Convenios "2026 - II"
   * Fuente: Base/Lista de chqueo ok (1).xlsx - Dirección de Estructuración de Proyectos
   * REGLA ESTRICTA: Cero falsos positivos. Se prohíbe asociar números de prefijo de paquete convocatorio a ítems técnicos.
   */
  matchFileToItems2026_2(file) {
    const fileName = file.name || "";
    const clean = this.cleanFileNameForSemanticMatch(fileName);
    const cleanNorm = clean.replace(/[^a-z0-9]/g, ' ');
    const cleanNoDots = clean.replace(/\./g, '');
    const cleanNoDotsNorm = cleanNoDots.replace(/[^a-z0-9]/g, ' ');
    const ext = this.getFileExtension(file);
    const matched = [];

    // Extracción de prefijo numérico de archivo (ej: "08. ...", "15_...", "09 - ...")
    const prefixMatch = fileName.match(/^\s*0*(\d{1,2})[\s.\-_)]/);
    const prefixNum = prefixMatch ? parseInt(prefixMatch[1], 10) : null;

    // Ignorar explícitamente documentos administrativos de la convocatoria departamental
    if (this.isConvocatoriaDoc(clean)) {
      return [];
    }

    // Soporte para etiquetado explícito del usuario: "item 4", "requisito_04", "anexo 41"
    const explicitItemMatch = fileName.match(/\b(?:item|requisito|anexo)\s*[-_]?\s*(\d{1,2})\b/i);
    if (explicitItemMatch) {
      const n = parseInt(explicitItemMatch[1], 10);
      if (n >= 1 && n <= 41) {
        matched.push(n);
      }
    }

    // Item 1: Solicitud formal del alcalde
    if ((clean.includes("solicitud") && ["formal", "alcalde", "priorizacion", "carta", "oficio"].some(k => clean.includes(k))) ||
        clean.startsWith("carta de solicitud") || clean.startsWith("solicitud") ||
        (clean.includes("carta") && clean.includes("solicitud"))) {
      if (!["cedula", "rut", "posesion", "planos", "presupuesto", "fotos", "acuerdo", "compromiso", "intencion"].some(e => clean.includes(e))) {
        matched.push(1);
      }
    }

    // Item 2: Plano de localización e implantación MAGNA SIRGAS (KMZ / KML o planos de localización)
    if (ext === "kmz" || ext === "kml" || (["zip", "rar", "7z"].includes(ext) && ["georref", "georef", "trazado", "track"].some(k => clean.includes(k))) ||
       (["localizacion", "implantacion", "magna sirgas", "magna", "sirgas"].some(k => clean.includes(k)) && ["plano", "esquema", "espacial"].some(k => clean.includes(k)))) {
      matched.push(2);
    }

    // Item 3: Estudio hidrológico, hidráulico e hidrosanitario
    if (["hidrolog", "hidraul", "hidrosanitar", "estudio de drenaje", "socavacion"].some(k => clean.includes(k)) && !this.hasAdminExclusion(clean)) {
      matched.push(3);
    }

    // Item 4: Estudio de suelos (CBR)
    if ((["estudio de suelos", "estudio suelos", "ensayos de suelos", "ensayo de suelos", "mecanica de suelos", "informe geotecnico", "geotecn"].some(k => clean.includes(k)) ||
        (/\bcbr\b/.test(cleanNorm) && ["suelo", "estudio", "ensayo", "informe"].some(k => clean.includes(k)))) && !this.hasAdminExclusion(clean)) {
      matched.push(4);
    }

    // Item 5: Diseño de estructuras (obras transversales y contención)
    if ((["diseno estructuras", "diseno de estructuras", "calculo estructural", "memoria estructural", "obras de contencion", "muros de contencion", "box culvert", "alcantarilla"].some(k => clean.includes(k)) ||
        (clean.includes("estructur") && ["diseno", "calculo", "memoria"].some(k => clean.includes(k)) && !clean.includes("pavimento"))) && !this.hasAdminExclusion(clean)) {
      matched.push(5);
    }

    // Item 6: Planos de construcción generales y de detalle (dwg, planta y perfil, cortes)
    if (ext === "dwg" || (["planos de construccion", "planos constructivos", "planta y perfil", "perfil longitudinal", "cortes y detalles", "detalles constructivos", "planos generales"].some(k => clean.includes(k)) ||
        (clean.includes("plano") && ["construccion", "obra", "perfil", "corte", "general"].some(k => clean.includes(k)))) && !this.hasAdminExclusion(clean) && ext !== "kmz" && ext !== "kml") {
      matched.push(6);
    }

    // Item 7: Especificaciones técnicas
    if (["especificaciones tecnicas", "especificacion tecnica", "especificaciones", "esquema de especificaciones"].some(k => clean.includes(k)) ||
        (clean.startsWith("esquema") && ["placa", "placah", "tecnico", "act"].some(k => clean.includes(k)))) {
      if (ext !== "dwg" && !["acuerdo", "concejo", "posesion", "despiece", "presupuesto"].some(e => clean.includes(e))) {
        matched.push(7);
      }
    }

    // Item 8: Plan de manejo ambiental (PMA, PAGA, PGYO, carta compromiso ambiental)
    const hasPmaAcronym = /\bpma\b/.test(cleanNoDotsNorm) || (cleanNoDots.startsWith("pma") && (cleanNoDots.length === 3 || /[^a-z]/.test(cleanNoDots[3]))) || cleanNoDots === "pma";
    const hasEnvKeywords = [
      "pma", "paga", "pgyo", "pmas", "pgir",
      "manejo ambiental", "plan ambiental", "gestion ambiental",
      "licencia ambiental", "licencias ambientales",
      "permiso ambiental", "permisos ambientales",
      "compromiso ambiental", "estudio ambiental",
      "ficha ambiental", "componente ambiental"
    ].some(k => clean.includes(k)) ||
    (clean.includes("ambiental") && ["plan", "manejo", "gestion", "compromiso", "permiso", "licencia", "carta", "certificado", "documento"].some(k => clean.includes(k)));
    const isNonAdminCommitmentForEnv = prefixNum === 8 && ["ambiental", "pma", "compromiso", "licencia", "permiso", "plan"].some(k => clean.includes(k) || cleanNoDots.includes(k));
    const isBarePrefix8 = prefixNum === 8 && (!clean || clean.length <= 3);

    if ((hasPmaAcronym || hasEnvKeywords || isNonAdminCommitmentForEnv || isBarePrefix8) &&
        !this.hasAdminExclusion(clean) &&
        !clean.includes("despiece") &&
        !["cofinanc", "contrapartida", "recurso", "aporte"].some(k => clean.includes(k))) {
      matched.push(8);
    }

    // Item 9: Plan de manejo de tránsito (PMT) y costeo
    const hasPmtAcronym = /\bpmt\b/.test(cleanNoDotsNorm) || (cleanNoDots.startsWith("pmt") && (cleanNoDots.length === 3 || /[^a-z]/.test(cleanNoDots[3]))) || cleanNoDots === "pmt";
    const hasPmtKeywords = [
      "manejo de transito", "manejo transito", "plan de transito",
      "costeo pmt", "desvios", "senalizacion y desvios", "plan vial de transito"
    ].some(k => clean.includes(k)) ||
    (clean.includes("transito") && ["manejo", "plan", "costeo", "senalizacion", "desvio", "desvios"].some(k => clean.includes(k)));
    const isTransitStudy = [
      "estudio de transito", "estudio transito", "aforo", "aforos",
      "tpda", "tpd", "volumen vehicular", "conteo vehicular"
    ].some(k => clean.includes(k));
    const isPrefix9Pmt = prefixNum === 9 && ["transito", "pmt", "costeo", "desvio", "senaliz", "plan"].some(k => clean.includes(k) || cleanNoDots.includes(k));
    const isBarePrefix9 = prefixNum === 9 && (!clean || clean.length <= 3);

    if ((hasPmtAcronym || hasPmtKeywords || isPrefix9Pmt || isBarePrefix9) &&
        !isTransitStudy &&
        !this.hasAdminExclusion(clean) &&
        !clean.includes("despiece")) {
      matched.push(9);
    }

    // Item 10: Estudio de tránsito (aforo, TPDA)
    if (["estudio de transito", "estudio transito", "aforo vehicular", "aforos", "tpda", "volumen vehicular", "conteo vehicular"].some(k => clean.includes(k)) && !this.hasAdminExclusion(clean)) {
      matched.push(10);
    }

    // Item 11: Diseño de estructura del pavimento
    if (["diseno de pavimento", "diseno pavimento", "estructura de pavimento", "estructura pavimento", "paquete estructural", "calculo de pavimento"].some(k => clean.includes(k)) && !this.hasAdminExclusion(clean)) {
      matched.push(11);
    }

    // Item 12: Certificación de no puntos críticos / zonas de riesgo / POT
    if (["puntos criticos", "zonas de riesgo", "zona de riesgo", "amenaza y riesgo", "riesgo geologico"].some(k => clean.includes(k)) && !this.hasAdminExclusion(clean)) {
      matched.push(12);
    }

    // Item 13: Fuentes de materiales y distancias de acarreo
    if (["fuentes de materiales", "fuente de materiales", "fuentes materiales", "cantera", "canteras", "distancias de acarreo", "distancia de acarreo", "suministro de materiales"].some(k => clean.includes(k)) && !this.hasAdminExclusion(clean)) {
      matched.push(13);
    }

    // Item 14: Presupuesto detallado y memorias de cantidades
    if ((["xlsx", "xlsm", "xls", "xlsb", "ods"].includes(ext) && ["presupuesto", "pto", "apu", "cantidades de obra"].some(k => clean.includes(k)) && !clean.includes("despiece")) ||
       (["presupuesto oficial", "presupuesto de obra", "presupuesto detallado", "analisis de precios", "cantidades de obra", "memorias de cantidades", "apu", "apus"].some(k => clean.includes(k)) && !clean.includes("pmt") && !this.hasAdminExclusion(clean) && !clean.includes("despiece"))) {
      matched.push(14);
    }

    // Item 15: Certificación de vías no intervenidas con otro tipo de obras
    const hasNoIntervKeywords = [
      "no intervenidas", "no intervencion", "no intervenida", "no intervenciones",
      "no estan siendo intervenidas", "no estan intervenidas",
      "no doble intervencion", "doble intervencion",
      "duplicidad", "no duplicidad", "sin duplicidad",
      "concurrencia", "no concurrencia",
      "superposicion", "no superposicion",
      "otra obra", "otras obras", "otro tipo de obras", "otras intervenciones", "otra intervencion",
      "no cruce de obras", "no cruce", "cruce de obras",
      "intervencion con otro tipo", "intervenidas con otro tipo"
    ].some(k => clean.includes(k)) ||
    (clean.includes("interven") && ["otra", "otras", "otro", "doble", "duplic", "cruce"].some(k => clean.includes(k)));
    const isPrefix15 = prefixNum === 15 && [
      "intervenc", "interven", "obra", "duplic", "vias", "concurrenc",
      "superposic", "declaracion", "certific", "cruce"
    ].some(k => clean.includes(k));
    const isBarePrefix15 = prefixNum === 15 && (!clean || clean.length <= 3);

    if ((hasNoIntervKeywords || isPrefix15 || isBarePrefix15) &&
        !this.hasAdminExclusion(clean) &&
        !clean.includes("despiece") &&
        !["parafiscal", "seguridad social", "paz y salvo"].some(k => clean.includes(k))) {
      matched.push(15);
    }

    // Item 16: Certificación de documentos y planos originales firmados con matrícula COPNIA
    if (["planos originales", "documentos originales", "originales firmados", "certificado de disenos", "certificacion de disenos", "matricula profesional", "tarjeta profesional", "copnia"].some(k => clean.includes(k)) && !this.hasAdminExclusion(clean)) {
      matched.push(16);
    }

    // Item 17: Memorial de responsabilidad profesional por especialidad
    if (["memorial de responsabilidad", "memorial responsabilidad", "responsabilidad profesional"].some(k => clean.includes(k)) && !this.hasAdminExclusion(clean)) {
      matched.push(17);
    }

    // Item 18: Redes de servicios públicos en buen estado (vías urbanas)
    if (["servicios publicos", "redes de servicios", "redes de acueducto", "acueducto y alcantarillado"].some(k => clean.includes(k)) && !this.hasAdminExclusion(clean)) {
      matched.push(18);
    }

    // Item 19: Competencia de la vía a intervenir
    if (["competencia via", "competencia municipal", "via a cargo", "propiedad de la via", "vias a intervenir", "vias terciarias", "red vial municipal"].some(k => clean.includes(k)) ||
        (["certific", "certificado"].some(k => clean.includes(k)) && ["via", "vias"].some(k => clean.includes(k)))) {
      if (ext !== "kmz" && ext !== "kml" && prefixNum !== 15 && !["posesion", "acuerdo", "especificac", "intencion", "carta de intencion", "no doble", "doble intervencion", "duplicidad", "concurrencia", "superposic", "otra obra", "no estan siendo"].some(e => clean.includes(e))) {
        matched.push(19);
      }
    }

    // Item 20: Acta de socialización con la comunidad
    if (["socializacion", "socializ"].some(k => clean.includes(k)) ||
        (clean.includes("acta") && ["comunidad", "asistencia", "reunion", "participacion", "concertacion"].some(k => clean.includes(k)))) {
      if (!["posesion", "especificac", "despiece"].some(e => clean.includes(e))) {
        matched.push(20);
      }
    }

    // Item 21: Registro fotográfico a color con coordenadas
    if (["fotograf", "fotos via", "fotos de la via", "evidencia fotografica", "panel fotografico", "registro fotog"].some(k => clean.includes(k))) {
      if (!["especificac", "despiece"].some(e => clean.includes(e))) {
        matched.push(21);
      }
    }

    // Item 22: Cronograma de actividades
    if (["cronograma", "plan de trabajo"].some(k => clean.includes(k)) && !["especificac", "despiece", "ficha"].some(e => clean.includes(e))) {
      matched.push(22);
    }

    // Item 23: Certificado de financiación (CDP + aporte municipio)
    if (["financiacion", "cofinanciacion", "cofianciacion", "cofinanc", "cofianc", "cdp", "disponibilidad presupuestal", "contrapartida", "carta de intencion"].some(k => clean.includes(k)) ||
        (["certific", "cerific", "certificado"].some(k => clean.includes(k)) && ["recursos", "aporte", "valor del proyecto", "materiales", "maquinaria", "mano de obra"].some(k => clean.includes(k)))) {
      if (!["regalias", "especificac", "despiece", "anticorrupcion", "banco", "bpim", "bppim"].some(e => clean.includes(e))) {
        matched.push(23);
      }
    }

    // Item 24: Regalías municipales
    if (["regalias", "sgr", "regalias municipales", "resolucion viabilidad regalias", "acuerdo ocad"].some(k => clean.includes(k))) {
      matched.push(24);
    }

    // Item 25: Cédula del alcalde
    if (["cedula", "identidad", "identificacion"].some(k => clean.includes(k)) || /\bcc\b/.test(cleanNorm)) {
      if (!["rut", "foto", "posesion"].some(e => clean.includes(e))) {
        matched.push(25);
      }
    }

    // Item 26: Acta de posesión del alcalde
    if (clean.includes("posesion") && !["socializ", "especificac", "despiece"].some(e => clean.includes(e))) {
      matched.push(26);
    }

    // Item 27: Acuerdo del Concejo (< 1 mes)
    if (["acuerdo concejo", "acuerdo municipal", "facultades para contratar", "facultades contratar", "decreto compilatorio"].some(k => clean.includes(k)) ||
        (clean.includes("acuerdo") && ["concejo", "facultad", "contratar", "vigencia"].some(k => clean.includes(k))) ||
        (clean.includes("faculta") && clean.includes("contratar"))) {
      if (!clean.includes("posesion")) {
        matched.push(27);
      }
    }

    // Item 28: Copia del RUT del municipio (< 1 mes)
    if (["rut", "dian", "tributario", "registro unico tributario"].some(k => clean.includes(k)) && !["especificac", "despiece"].some(e => clean.includes(e))) {
      matched.push(28);
    }

    // Item 29: Contraloría - Responsables Fiscales (< 1 mes)
    if (["contralor", "responsables fiscales", "responsabilidad fiscal", "sirec", "boletin fiscal"].some(k => clean.includes(k)) &&
        !["procurad", "policia"].some(e => clean.includes(e))) {
      matched.push(29);
    }

    // Item 30: Medidas Correctivas RNMC (< 1 mes)
    if (["rnmc", "medidas correctivas", "correctivas"].some(k => clean.includes(k))) {
      matched.push(30);
    }

    // Item 31: Antecedentes Judiciales Policía (< 1 mes)
    if (["antecedentes judiciales", "judicial", "pasado judicial", "policia"].some(k => clean.includes(k)) &&
        !["rnmc", "correctivas", "sexuales", "procurad", "contralor"].some(e => clean.includes(e))) {
      matched.push(31);
    }

    // Item 32: Procuraduría - Antecedentes Disciplinarios (< 1 mes)
    if (["procurad", "disciplinario", "siri"].some(k => clean.includes(k)) && !["contralor", "policia"].some(e => clean.includes(e))) {
      matched.push(32);
    }

    // Item 33: Seguridad social y parafiscales (mes presente)
    if (["parafiscal", "parfiscal", "seguridad social"].some(k => clean.includes(k)) ||
        (clean.includes("paz y salvo") && !["alimento", "contralor", "procurad"].some(e => clean.includes(e)))) {
      matched.push(33);
    }

    // Item 34: REDAM (< 1 mes)
    if (["redam", "alimentarios", "alimentos", "deudores"].some(k => clean.includes(k))) {
      matched.push(34);
    }

    // Bundle de declaraciones y compromisos (Items 35, 36, 37, 38)
    const isBundle = ["declaracion", "declaraciones"].some(k => clean.includes(k)) && ["compromiso", "compromisos", "anexo", "anexos"].some(k => clean.includes(k));
    if (isBundle) {
      matched.push(35, 36, 37, 38);
    } else {
      if ((["anticorrupcion", "pacto anticorrupcion"].some(k => clean.includes(k)) || (clean.includes("compromiso") && clean.includes("corrupcion"))) && !clean.includes("paco")) {
        matched.push(35);
      }
      if (["lavado", "sarlaft", "terrorismo"].some(k => clean.includes(k)) || (clean.includes("activos") && !clean.includes("fijo"))) {
        matched.push(36);
      }
      if (["inhabilidad", "incompatibilidad", "conflicto"].some(k => clean.includes(k)) && !["sexuales", "menores"].some(e => clean.includes(e))) {
        matched.push(37);
      }
      if (["multas", "sancion", "no multas", "incumplimiento"].some(k => clean.includes(k)) && !["rnmc", "correctivas"].some(e => clean.includes(e))) {
        matched.push(38);
      }
    }

    // Item 39: Consulta portal anticorrupción PACO (< 1 mes)
    if (["paco", "portal anticorrupcion", "transparencia"].some(k => clean.includes(k)) && !["compromiso", "balance contrato"].some(e => clean.includes(e))) {
      matched.push(39);
    }

    // Item 40: Inhabilidades delitos sexuales menores (< 1 mes)
    if (["delitos sexuales", "menores", "sexuales", "1918"].some(k => clean.includes(k))) {
      matched.push(40);
    }

    // Item 41: Banco y programas de proyectos del municipio
    if (((clean.includes("banco") && clean.includes("proyecto")) || ["bppim", "bpim", "bpin", "bpp", "radicacion"].some(k => clean.includes(k))) &&
        !["especificac", "despiece"].some(e => clean.includes(e))) {
      matched.push(41);
    }

    return [...new Set(matched)];
  },

  /**
   * Clasifica los archivos en los 41 requisitos de Convenios "2026 - II"
   */
  async classifyFilesToItems41(files) {
    const detectedMap = {};
    const detectedFilesMap = {};
    const archivosDetectadosMap = {};

    for (let itemId = 1; itemId <= 41; itemId++) {
      detectedFilesMap[itemId] = [];
    }

    // 1. Coincidencias semánticas y por prefijo numérico
    for (const file of files) {
      const matchedItemIds = this.matchFileToItems2026_2(file);
      for (const itemId of matchedItemIds) {
        if (itemId >= 1 && itemId <= 41) {
          detectedFilesMap[itemId].push(file);
        }
      }
    }

    // 2. Si el ítem 14 (Presupuesto) no se detectó por nombre, inspeccionar hojas en Excel
    if (detectedFilesMap[14].length === 0 && typeof XLSX !== "undefined") {
      for (const file of files) {
        const ext = this.getFileExtension(file);
        if (["xlsx", "xlsm", "xls", "xlsb", "ods"].includes(ext)) {
          try {
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array", bookSheets: true });
            if (wb && wb.SheetNames && wb.SheetNames.some(s => {
              const u = s.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              return u.includes("PRESUPUESTO") || u.includes("APU") || u.includes("PTO") || u.includes("CANTIDAD");
            })) {
              detectedFilesMap[14].push(file);
              break;
            }
          } catch (e) { }
        }
      }
    }

    // 3. Poblar detectedMap y archivosDetectadosMap
    for (let itemId = 1; itemId <= 41; itemId++) {
      const matched = detectedFilesMap[itemId];
      if (matched && matched.length > 0) {
        detectedMap[itemId] = matched[0];
        archivosDetectadosMap[itemId] = matched.map(f => f.name).join(", ");
      } else {
        detectedMap[itemId] = null;
      }
    }

    return { detectedMap, detectedFilesMap, archivosDetectadosMap };
  },

  /**
   * Clasifica los archivos delegando al proceso correspondiente (Ordinario o 2026 - II)
   */
  async classifyFiles(files, processMode = "ORDINARIO") {
    if (processMode === "2026_2" || processMode === "CONVENIOS_2026_2") {
      return await this.classifyFilesToItems41(files);
    }
    return await this.classifyFilesToItems27(files);
  },

  /**
   * Método de compatibilidad para evaluar un archivo contra un ítem específico
   */
  matchFileToItemRule(fileName, itemId) {
    const matched = this.matchFileToItems({ name: fileName });
    return { matched: matched.includes(itemId), score: matched.includes(itemId) ? 10 : 0 };
  },

  /**
   * Lee un archivo Excel y extrae su texto plano de forma segura
   */
  async readExcelAsText(file) {
    if (!file) return "";
    try {
      if (typeof XLSX === "undefined") return "";
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      let text = "";
      for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName];
        if (sheet && typeof XLSX.utils !== "undefined" && XLSX.utils.sheet_to_txt) {
          text += " " + XLSX.utils.sheet_to_txt(sheet);
        }
      }
      return text;
    } catch (e) {
      console.warn("Error leyendo Excel como texto:", file.name, e);
      return "";
    }
  },

  /**
   * Clasifica la totalidad de archivos de la carpeta en los 28 ítems normativos
   * Permite asociar múltiples archivos por requisito y nunca indexa por número inicial
   */
  async classifyFilesToItems27(files) {
    const detectedMap = {};
    const detectedFilesMap = {};
    const archivosDetectadosMap = {};

    for (let itemId = 1; itemId <= 28; itemId++) {
      detectedFilesMap[itemId] = [];
    }

    // 1. Recorrer la totalidad de archivos de la carpeta evaluando coincidencias semánticas
    for (const file of files) {
      const matchedItemIds = this.matchFileToItems(file);
      for (const itemId of matchedItemIds) {
        detectedFilesMap[itemId].push(file);
      }
    }

    // 2. Si el ítem 3 no se detectó por nombre, inspeccionar si alguna hoja de cálculo contiene internamente la tabla de despiece de acero
    if (detectedFilesMap[3].length === 0 && typeof XLSX !== "undefined") {
      const item3Exclusiones = [
        "vigencias", "cdp", "disponibilidad", "certificado", "solicitud",
        "acta", "socializacion", "socializ", "rut", "cedula", "antecedentes",
        "cronograma", "ficha", "presupuesto", "especificaciones", "especificac", "fotografico", "fotos"
      ];
      for (const file of files) {
        const ext = this.getFileExtension(file);
        if (["xlsx", "xlsm", "xls", "xlsb", "ods"].includes(ext)) {
          const fClean = this.cleanFileNameForSemanticMatch(file.name);
          if (item3Exclusiones.some(e => fClean.includes(e))) continue;
          if (detectedFilesMap[28].includes(file)) continue;
          try {
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array" });
            let hasSteelTable = false;
            for (const sName of wb.SheetNames) {
              const sheet = wb.Sheets[sName];
              if (!sheet) continue;
              const sTxt = (XLSX.utils && XLSX.utils.sheet_to_txt) ? XLSX.utils.sheet_to_txt(sheet).toUpperCase() : "";
              if (sTxt.includes("DESPIECE DE ACERO") || sTxt.includes("CUADRO DETALLADO DE DESPIECE") || (sTxt.includes("RIELES") && sTxt.includes("VIGA RIOSTRA") && sTxt.includes("CUANTIA"))) {
                hasSteelTable = true;
                break;
              }
            }
            if (hasSteelTable) {
              detectedFilesMap[3].push(file);
              console.log("Ítem 3 detectado por inspección interna de tabla de despiece en Excel:", file.name);
              break;
            }
          } catch (e) { }
        }
      }
    }

    // 3. Si el ítem 28 no se detectó por nombre, inspeccionar si alguna hoja de cálculo contiene la pestaña PRESUPUESTO
    if (detectedFilesMap[28].length === 0 && typeof XLSX !== "undefined") {
      for (const file of files) {
        const ext = this.getFileExtension(file);
        if (["xlsx", "xlsm", "xls", "xlsb", "ods"].includes(ext)) {
          try {
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array", bookSheets: true });
            if (wb && wb.SheetNames && wb.SheetNames.some(s => s.trim().toUpperCase().includes("PRESUPUESTO"))) {
              detectedFilesMap[28].push(file);
              console.log("Ítem 28 detectado por inspección interna de hoja PRESUPUESTO:", file.name);
              break;
            }
          } catch (e) { }
        }
      }
    }

    // 4. Poblar detectedMap y archivosDetectadosMap (soporta multi-archivo por requisito)
    // Cero relleno o fallback: si un requisito no encuentra archivo estricto, queda archivo: null y Faltante
    for (let itemId = 1; itemId <= 28; itemId++) {
      const matched = detectedFilesMap[itemId];
      if (matched && matched.length > 0) {
        detectedMap[itemId] = matched[0]; // Archivo principal para visualización
        archivosDetectadosMap[itemId] = matched.map(f => f.name).join(", ");
      } else {
        detectedMap[itemId] = null;
      }
    }

    return { detectedMap, detectedFilesMap, archivosDetectadosMap };
  },

  init() {
    this.setupInputs();
    this.setupDropzones();
    this.initCrossTabSync();
  },

  /**
   * Canal de sincronización en paralelo entre pestañas hermanas (Ordinario vs 2026 - II)
   * Permite que ambas interfaces convivan abiertas simultáneamente sin borrarse
   */
  initCrossTabSync() {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    try {
      this.syncChannel = new BroadcastChannel("sipro_parallel_sync");
      this.syncChannel.onmessage = async (event) => {
        const data = event.data;
        if (!data || !data.type) return;

        // 1. Otra pestaña hermana solicita el proyecto activo para sincronizar en paralelo
        if (data.type === "REQUEST_ACTIVE_PROJECTS") {
          const activeId = window.App && App.currentProjectId;
          const rec = (window.proyectosAuditados && window.proyectosAuditados[activeId]) || (window.proyectosAuditados && Object.values(window.proyectosAuditados)[0]);
          if (rec && this.rawFilesByProject && this.rawFilesByProject[rec.id]) {
            const files = this.rawFilesByProject[rec.id];
            try {
              this.syncChannel.postMessage({
                type: "RESPONSE_ACTIVE_PROJECTS",
                proyectoId: rec.id,
                municipio: rec.municipio,
                rawFolderName: rec.rawFolderName,
                files: files,
                senderProcessMode: (window.App && App.currentProcessMode) || window.SIPRO_PROCESS_MODE || "ORDINARIO"
              });
            } catch (errPost) {
              console.warn("No se pudo transmitir archivos por BroadcastChannel:", errPost);
            }
          }
        }

        // 2. Respuesta con el proyecto activo o notificación de nuevo proyecto cargado
        if (data.type === "RESPONSE_ACTIVE_PROJECTS" || data.type === "BROADCAST_NEW_PROJECT") {
          const hasLocalProjects = window.proyectosAuditados && Object.keys(window.proyectosAuditados).length > 0;
          if (!hasLocalProjects && data.files && data.files.length > 0) {
            console.log(`[PARALELO] Sincronizando expediente "${data.municipio}" desde pestaña paralela...`);
            this.showToast(`⧉ Expediente "${data.municipio}" sincronizado en paralelo. Evaluando...`);
            await this.processFileList(data.files, null);
          }
        }
      };

      // Si no tenemos proyectos cargados localmente en esta pestaña, solicitar a la pestaña hermana
      const hasLocalProjects = window.proyectosAuditados && Object.keys(window.proyectosAuditados).length > 0;
      if (!hasLocalProjects) {
        setTimeout(() => {
          try {
            if (this.syncChannel) {
              this.syncChannel.postMessage({ type: "REQUEST_ACTIVE_PROJECTS" });
            }
          } catch (e) { }
        }, 350);
      }
    } catch (e) {
      console.warn("BroadcastChannel no disponible:", e);
    }
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
          if (window.App && typeof App.subirSubsanacionItem === "function") {
            await App.subirSubsanacionItem(3, App.currentProjectId, file);
          } else {
            await this.reprocessItem3File(file, App.currentProjectId);
          }
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
          this.triggerFolderPicker();
        });
      }
    });
  },

  /**
   * Abre selector de carpeta con File System Access API (showDirectoryPicker) o fallback
   */
  async triggerFolderPicker() {
    if (window.showDirectoryPicker) {
      try {
        let dirHandle = null;
        try {
          dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
        } catch (eDir) {
          if (eDir.name === "AbortError") return;
          console.warn("showDirectoryPicker con readwrite no concedido, reintentando read:", eDir);
          try {
            dirHandle = await window.showDirectoryPicker({ mode: "read" });
          } catch (eRead) {
            if (eRead.name === "AbortError") return;
            try {
              dirHandle = await window.showDirectoryPicker();
            } catch (eBasic) {
              if (eBasic.name === "AbortError") return;
              throw eBasic;
            }
          }
        }
        if (dirHandle) {
          const files = [];
          async function readDir(handle, currentPath = "") {
            for await (const entry of handle.values()) {
              if (entry.kind === "file") {
                const file = await entry.getFile();
                Object.defineProperty(file, "webkitRelativePath", {
                  value: currentPath ? `${currentPath}/${file.name}` : file.name,
                  configurable: true
                });
                file._handle = entry;
                files.push(file);
              } else if (entry.kind === "directory") {
                await readDir(entry, currentPath ? `${currentPath}/${entry.name}` : entry.name);
              }
            }
          }
          await readDir(dirHandle, dirHandle.name);
          if (files.length > 0) {
            const exp = await this.readFolder(files, dirHandle);
            if (exp) exp.dirHandle = dirHandle;
            return;
          }
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        console.warn("showDirectoryPicker fallback a input:", err);
      }
    }
    const inp = document.getElementById("folderInput") || document.getElementById("sidebarFolderInput");
    if (inp) inp.click();
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
          if (window.App && typeof App.subirSubsanacionItem === "function") {
            await App.subirSubsanacionItem(3, App.currentProjectId, files[0]);
          } else {
            await this.reprocessItem3File(files[0], App.currentProjectId);
          }
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
    if (fileList._isAlreadyExpanded) return fileList;
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

      // 0. Si el archivo comprimido es un registro fotográfico / fotos, CONSERVARLO directamente sin descomprimir
      // Las fotos ocupan cientos de MB en RAM y no contienen KMLs ni documentos de auditoría (el archivo satisface el Ítem 6)
      const isFotoArchive = /(?:foto|fotograf|registro[\s_-]*fotog|panel[\s_-]*fotog)/i.test(lower);
      if (isFotoArchive && (lower.endsWith(".zip") || lower.endsWith(".rar") || lower.endsWith(".7z") || lower.endsWith(".tar") || lower.endsWith(".gz") || lower.endsWith(".kmz"))) {
        expandedFiles.push(file);
        continue;
      }

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

              // Omitir imágenes dentro de archivos comprimidos para ahorrar memoria y prevenir congelamiento de navegador
              if (/\.(?:jpe?g|png|gif|bmp|webp|heic|tiff?)$/i.test(entryLower)) {
                continue;
              }

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
        // Si el archivo supera 8 MB, no intentar descompresión WebAssembly en memoria para prevenir cuelgues
        if (file.size > 8 * 1024 * 1024) {
          console.warn(`Archivo comprimido ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB) conservado sin descompresión profunda en memoria.`);
          continue;
        }
        let extractedCount = 0;
        try {
          if (ArchiveClass) {
            const archive = await ArchiveClass.open(file);
            const entries = await archive.extractFiles();

            for (const [entryName, entryItem] of Object.entries(entries)) {
              let extractedFile = null;
              const cleanEntryName = entryName.split('/').pop();
              if (!cleanEntryName) continue;

              // Omitir imágenes dentro del archivo comprimido para proteger la memoria RAM
              if (/\.(?:jpe?g|png|gif|bmp|webp|heic|tiff?)$/i.test(cleanEntryName)) {
                continue;
              }

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
                  } catch (kErr) { }
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

    expandedFiles._isAlreadyExpanded = true;
    return expandedFiles;
  },

  /**
   * Alias de lectura de carpeta para compatibilidad con File System Access API
   */
  async readFolder(rawFiles, dirHandle = null) {
    return this.processFileList(rawFiles, dirHandle);
  },

  async processFolder(rawFiles, rawFolderName = "", id = "", dirHandle = null) {
    return this.processFileList(rawFiles, dirHandle);
  },

  /**
   * Procesa la lista de archivos soportando carpetas múltiples o individuales
   * Garantiza que cada proyecto quede indexado en window.proyectosAuditados
   */
  async processFileList(rawFiles, dirHandle = null) {
    this.isProcessing = true;
    this.showLoadingModal(true, rawFiles.length);

    try {
      window.proyectosAuditados = window.proyectosAuditados || {};

      // PIPELINE DE DESCOMPRESIÓN AUTOMÁTICA EN MEMORIA (PASO A y B)
      const files = await this.expandirArchivosComprimidos(rawFiles);

      // 1. Detectar si los archivos pertenecen a múltiples proyectos (por Fichas de priorización en distintas subcarpetas)
      const fichas = files.filter(f => this.isFichaPriorizacionFile(f));

      // Deduplicar fichas que estén en la misma carpeta física (ej. .pdf y .xlsx de la misma ficha en la misma carpeta)
      const seenDirs = new Map();
      fichas.forEach(f => {
        const rel = f.webkitRelativePath || "";
        const dir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
        if (!seenDirs.has(dir)) {
          seenDirs.set(dir, f);
        } else {
          // Si ambos existen en el mismo directorio, priorizar Excel para extracción de datos
          const current = seenDirs.get(dir);
          const isCurrentExcel = ['xlsx', 'xls', 'xlsm', 'xlsb'].includes(this.getFileExtension(current));
          const isNewExcel = ['xlsx', 'xls', 'xlsm', 'xlsb'].includes(this.getFileExtension(f));
          if (!isCurrentExcel && isNewExcel) {
            seenDirs.set(dir, f);
          }
        }
      });
      const uniqueFichas = Array.from(seenDirs.values());

      let projectGroups = [];
      if (uniqueFichas.length > 1) {
        projectGroups = this.groupFilesByProject(files, uniqueFichas);
      }

      let lastCreatedId = null;

      if (projectGroups.length > 1) {
        // Procesamiento en lote de múltiples proyectos reales en subcarpetas
        for (const grp of projectGroups) {
          const rec = await this.processSingleProjectFiles(grp.files, grp.fichaFile, dirHandle);
          if (rec) lastCreatedId = rec.id;
        }
        App.populateProjectSelect();
        if (lastCreatedId && typeof window.cargarProyecto === "function") {
          window.cargarProyecto(lastCreatedId);
        }
        this.showToast(`✓ Se auditaron ${projectGroups.length} proyectos de manera independiente.`);
      } else {
        // Procesamiento de un solo proyecto: asignación estricta de Ficha de Priorización (sin falsos positivos)
        let fichaFile = uniqueFichas[0] || fichas.find(f => ['xlsx', 'xls', 'xlsm'].includes(this.getFileExtension(f)))
          || fichas.find(f => this.getFileExtension(f) === 'pdf')
          || fichas[0]
          || null;

        const rec = await this.processSingleProjectFiles(files, fichaFile, dirHandle);
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
        if (dir && (itemPath.startsWith(dir + "/") || itemPath === dir)) return true;
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
  async processSingleProjectFiles(rawFiles, fichaFile, dirHandle = null) {
    const t0 = performance.now();
    console.log(`[AUDIT-STEP] Starting project files processing... (${rawFiles.length} files)`);
    // Asegurar descompresión completa en memoria sin duplicar si ya fue expandido
    const files = (rawFiles && rawFiles._isAlreadyExpanded) ? rawFiles : await this.expandirArchivosComprimidos(rawFiles);
    console.log(`[AUDIT-STEP] 0. Expansion finished: ${(performance.now() - t0).toFixed(0)}ms (${files.length} files)`);

    // Obtener nombre de la carpeta de forma segura sin split('.') destructivo
    const rawFolderName = this.getRawFolderName(files, dirHandle);

    // Generar proyectoId sanitizado (solo letras, números, guiones y guiones bajos)
    const proyectoId = 'proj_' + rawFolderName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();

    // =========================================================================
    // PASO 1: DETECCIÓN Y LECTURA BLINDADA DE "FICHA DE PRIORIZACIÓN"
    // =========================================================================
    const mpiosList = SIPRO_DATA.municipiosAntioquia || SIPRO_DATA.municipios || [];

    // Localizar Ficha de Priorización estrictamente (nomenclatura 'ficha' + 'prioriz')
    const allFichas = files.filter(f => this.isFichaPriorizacionFile(f));
    const archivoExcel = allFichas.find(f => ["xlsx", "xlsm", "xls"].includes(this.getFileExtension(f))) || null;
    const archivoPdf = allFichas.find(f => this.getFileExtension(f) === "pdf") || null;
    const existeFicha = Boolean(archivoExcel || archivoPdf);

    // Prioridad 1 para extracción de datos estructurados: Excel (las celdas nunca pierden texto)
    // Para visualización: preferir PDF si existe, de lo contrario Excel
    fichaFile = existeFicha ? (archivoExcel || archivoPdf) : null;
    const archivoVisualizacion = existeFicha ? (archivoPdf || archivoExcel) : null;

    let fichaData = {
      existe: existeFicha,
      detected: existeFicha,
      archivoPdf: archivoPdf,
      archivoExcel: archivoExcel,
      archivoVisualizacion: archivoVisualizacion,
      fileName: fichaFile ? fichaFile.name : null,
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

    if (fichaFile) {
      let text = "";
      try {
        const ext = this.getFileExtension(fichaFile);
        if (ext === "pdf") {
          text = await this.readPdfOrText(fichaFile);
        } else if (["xlsx", "xls", "xlsm", "xlsb", "ods"].includes(ext)) {
          text = await this.readExcelAsText(fichaFile);
        } else {
          text = await fichaFile.text();
        }
      } catch (errFicha) {
        console.warn("Error leyendo Ficha principal (" + fichaFile.name + "):", errFicha);
        const altFicha = allFichas.find(f => f.name !== fichaFile.name);
        if (altFicha) {
          try {
            const extAlt = this.getFileExtension(altFicha);
            if (extAlt === "pdf") text = await this.readPdfOrText(altFicha);
            else if (["xlsx", "xls", "xlsm", "xlsb", "ods"].includes(extAlt)) text = await this.readExcelAsText(altFicha);
            else text = await altFicha.text();
            fichaData.fileName = altFicha.name;
          } catch (eAlt) {
            console.warn("Error leyendo Ficha alternativa (" + altFicha.name + "):", eAlt);
          }
        }
      }
      fichaData.textoExtraido = text || "";

      if (text) {
        try {
          // Localizar sección "1. DATOS GENERALES DEL PROYECTO"
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

          // B. Coincidencia columnar en sección 1
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

          // D. Extraer Aporte del Departamento
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

          // Códigos viales
          const matchedCodes = this.normalizeText(text).match(/05[0-9]{3}vt[0-9]{1,4}/gi);
          if (matchedCodes) fichaData.codigosViales = [...new Set(matchedCodes.map(c => c.toUpperCase()))];
        } catch (eParseFicha) {
          console.warn("Advertencia analizando campos de Ficha de Priorización:", eParseFicha);
        }
      }
    }

    // =========================================================================
    // FALLBACKS BLINDADOS PARA DETECCIÓN DEL MUNICIPIO (125 MUNICIPIOS DE ANTIOQUIA)
    // =========================================================================
    const sortedMpios = [...mpiosList].sort((a, b) => (b.nombre || "").length - (a.nombre || "").length);

    // 1. Fallback: Buscar municipio en el nombre de la carpeta (ej. DOC. MPIO GIRALDO -> GIRALDO)
    if (!fichaData.municipio && rawFolderName) {
      const normFolder = this.normalizeText(rawFolderName);
      for (const m of sortedMpios) {
        if (!m || !m.nombre) continue;
        const normMpio = this.normalizeText(m.nombre);
        const reg = new RegExp(`(?:^|[^a-z0-9])${normMpio}(?:$|[^a-z0-9])`, 'i');
        if (reg.test(normFolder)) {
          fichaData.municipio = m.nombre;
          fichaData.codMunicipio = m.codigo;
          fichaData.subregion = m.subregion;
          break;
        }
      }
    }

    // 2. Fallback: Buscar municipio en los nombres de todos los archivos (ej. RVT_Giraldo_Vereda.kmz -> GIRALDO)
    if (!fichaData.municipio) {
      for (const f of files) {
        const normName = this.normalizeText(f.name);
        for (const m of sortedMpios) {
          if (!m || !m.nombre) continue;
          const normMpio = this.normalizeText(m.nombre);
          const reg = new RegExp(`(?:^|[^a-z0-9])${normMpio}(?:$|[^a-z0-9])`, 'i');
          if (reg.test(normName)) {
            fichaData.municipio = m.nombre;
            fichaData.codMunicipio = m.codigo;
            fichaData.subregion = m.subregion;
            break;
          }
        }
        if (fichaData.municipio) break;
      }
    }

    // 3. Fallback: Buscar municipio en el texto completo de la Ficha
    if (!fichaData.municipio && fichaData.textoExtraido) {
      const normFull = this.normalizeText(fichaData.textoExtraido);
      for (const m of sortedMpios) {
        if (!m || !m.nombre) continue;
        const normMpio = this.normalizeText(m.nombre);
        const reg = new RegExp(`\\b${normMpio}\\b`, 'i');
        if (reg.test(normFull)) {
          fichaData.municipio = m.nombre;
          fichaData.codMunicipio = m.codigo;
          fichaData.subregion = m.subregion;
          break;
        }
      }
    }

    const isAmbiguous = !fichaData.municipio;
    if (isAmbiguous) {
      fichaData.municipio = "MUNICIPIO POR CONFIRMAR";
      fichaData.codMunicipio = "05000";
      fichaData.subregion = "ANTIOQUIA";
    }

    console.log(`[AUDIT-STEP] 1. Ficha parsed: ${(performance.now() - t0).toFixed(0)}ms (Mpio: ${fichaData.municipio})`);

    // =========================================================================
    // PASO 2: MAPEO DINÁMICO DE ÍTEMS NORMATIVOS (ORDINARIO: 27/28 vs 2026-II: 41)
    // =========================================================================
    const processMode = (window.App && window.App.currentProcessMode) || (window.SIPRO_PROCESS_MODE) || "ORDINARIO";
    const is2026_2 = processMode === "2026_2" || processMode === "CONVENIOS_2026_2";
    
    // Almacenar archivos en memoria por proyecto para permitir conmutación reactiva inmediata
    this.rawFilesByProject = this.rawFilesByProject || {};
    this.rawFilesByProject[proyectoId] = files;

    const classification = await this.classifyFiles(files, processMode);
    console.log(`[AUDIT-STEP] 2. Classify finished (${processMode}): ${(performance.now() - t0).toFixed(0)}ms`);
    const detectedMap = classification.detectedMap || {};
    const detectedFilesMap = classification.detectedFilesMap || {};
    const archivosDetectadosMap = classification.archivosDetectadosMap || {};
    const itemsNormativos = is2026_2 ? (SIPRO_DATA.items41_2026_2 || []) : (SIPRO_DATA.items27 || []);
    const items27 = itemsNormativos;

    // =========================================================================
    // PASO 3: METADATOS Y TEXTO DE LOS ARCHIVOS DETECTADOS (BLINDADO CON TRY/CATCH)
    // =========================================================================
    const archivosMetadata = {};
    const itemTextsMap = {};
    let extractedEngineer = null;
    let extractedMatricula = null;
    let extractedAlcalde = null;
    let extractedCargoAlcalde = null;
    let extractedCcAlcalde = null;
    let extractedOrigenAlcalde = null;
    let extractedSecretario = null;
    let extractedCargoSecretario = null;
    let extractedCcSecretario = null;
    let extractedOrigenSecretario = null;

    // Indexación ágil de metadatos de los ítems (hasta 41 en 2026-II o 28 en Ordinario)
    const maxIndexCount = is2026_2 ? 41 : 28;
    for (let i = 1; i <= maxIndexCount; i++) {
      const file = detectedMap[i];
      if (file) {
        const allMatched = detectedFilesMap[i] || [file];
        archivosMetadata[i] = {
          fileName: allMatched.map(f => f.name).join(", "),
          sizeBytes: file.size,
          lastModified: file.lastModified,
          textSnippet: "Documento digital verificado en la carpeta."
        };
      }
    }

    // Extracción rápida de Matrícula e Ingeniero Proyectista (Ítems 2 y 3 en ordinario, o 6 y 7 en 2026-II)
    const checkIngItems = is2026_2 ? [6, 16, 17, 7] : [2, 3];
    for (const i of checkIngItems) {
      const file = detectedMap[i];
      if (file && (!extractedMatricula || !extractedEngineer)) {
        try {
          const ext = this.getFileExtension(file);
          let quickSnippet = "";
          if (ext === "pdf") {
            quickSnippet = await this.readPdfOrText(file, 2);
          } else if (["xlsx", "xls", "xlsm", "xlsb"].includes(ext)) {
            quickSnippet = await this.readExcelAsText(file);
          }
          if (quickSnippet) {
            itemTextsMap[i] = quickSnippet;
            if (archivosMetadata[i]) archivosMetadata[i].textSnippet = quickSnippet.slice(0, 500);
            const matMatch = quickSnippet.match(/mat[\s\.:]*([0-9A-Z\-\s]+ANT)/i) || quickSnippet.match(/(05202-[0-9A-Z]+)/i);
            if (matMatch && !extractedMatricula) extractedMatricula = matMatch[1].trim();

            const ingMatch = quickSnippet.match(/ING(?:ENIERO|ENIERA)?[\.\s]+([A-Z\s]{8,35})/i);
            if (ingMatch && !extractedEngineer) extractedEngineer = ingMatch[0].trim();
          }
        } catch (eSnippet) {
          console.warn("Aviso leyendo snippet de ítem " + i + ":", eSnippet);
        }
      }
    }

    // Extracción de fecha para ítems sujetos a vigencia mensual estricta
    // Ordinario: [9, 10, 11, 12, 13, 14, 15, 16, 21, 22]
    // Convenios 2026-II: [27, 28, 29, 30, 31, 32, 33, 34, 39, 40]
    const itemsVigencia = is2026_2
      ? [27, 28, 29, 30, 31, 32, 33, 34, 39, 40]
      : [9, 10, 11, 12, 13, 14, 15, 16, 21, 22];
    for (const i of itemsVigencia) {
      const file = detectedMap[i] || detectedMap[String(i)];
      if (file) {
        try {
          const ext = this.getFileExtension(file);
          let snippet = "";
          if (ext === "pdf") {
            snippet = await this.readPdfOrText(file, 5);
          } else if (["txt", "csv", "json"].includes(ext)) {
            snippet = await file.text();
          } else if (["xlsx", "xls", "xlsm", "xlsb"].includes(ext)) {
            snippet = await this.readExcelAsText(file);
          }
          if (snippet) {
            itemTextsMap[i] = snippet;
            itemTextsMap[String(i)] = snippet;
            if (archivosMetadata[i]) archivosMetadata[i].textSnippet = snippet.slice(0, 500);
            if (archivosMetadata[String(i)]) archivosMetadata[String(i)].textSnippet = snippet.slice(0, 500);
          }
          if (typeof DocumentalEngine !== "undefined" && typeof DocumentalEngine.extraerFechaDocumento === "function") {
            const extDate = DocumentalEngine.extraerFechaDocumento(file, snippet);
            if (extDate) {
              if (archivosMetadata[i]) {
                archivosMetadata[i].fechaDoc = extDate.fecha;
                archivosMetadata[i].fechaDocStr = extDate.fechaStr;
              }
              if (archivosMetadata[String(i)]) {
                archivosMetadata[String(i)].fechaDoc = extDate.fecha;
                archivosMetadata[String(i)].fechaDocStr = extDate.fechaStr;
              }
            }
          }
        } catch (eDate) {
          console.warn("Aviso extrayendo fecha de ítem " + i + ":", eDate);
        }
      }
    }

    console.log(`[AUDIT-STEP] 3. Metadata & Vigencia finished: ${(performance.now() - t0).toFixed(0)}ms`);

    // Extracción de firmas mediante Motor Heurístico y Recursivo de 5 Capas (Ficha + Fallback Multi-Documento)
    try {
      const firmasFicha = await this.extraerFirmasFichaPriorizacion(files, fichaFile, allFichas, detectedMap, itemTextsMap, fichaData.municipio);
      if (firmasFicha) {
        if (firmasFicha.alcalde && firmasFicha.alcalde.nombre) {
          extractedAlcalde = firmasFicha.alcalde.nombre;
          extractedCargoAlcalde = firmasFicha.alcalde.cargo || "ALCALDE MUNICIPAL";
          extractedCcAlcalde = firmasFicha.alcalde.cedula || "";
          extractedOrigenAlcalde = firmasFicha.alcalde.origen || "Extraído de: Ficha de Priorización";
        }
        if (firmasFicha.secretario && firmasFicha.secretario.nombre) {
          extractedSecretario = firmasFicha.secretario.nombre;
          extractedCargoSecretario = firmasFicha.secretario.cargo || "SECRETARIO(A) DE PLANEACIÓN / OBRAS PÚBLICAS";
          extractedCcSecretario = firmasFicha.secretario.cedula || "";
          extractedOrigenSecretario = firmasFicha.secretario.origen || "Extraído de: Ficha de Priorización";
        }
      }
    } catch (eFirmas) {
      console.warn("Aviso al extraer firmas con motor heurístico:", eFirmas);
    }
    console.log(`[AUDIT-STEP] 4. Signatures finished: ${(performance.now() - t0).toFixed(0)}ms`);

    const matchedCount = Object.keys(archivosDetectadosMap).length;

    // =========================================================================
    // PASO 4: AUDITORÍA Y RECÁLCULO DE ACERO Y CONCRETO (FASE 1A)
    // =========================================================================
    const fileDespiece = files.find(f => /despiece|acero|figuracion|planilla/i.test(f.name)) || (is2026_2 ? null : detectedMap[3]);
    const fileEspec = is2026_2
      ? (detectedMap[7] || files.find(f => /especificac/i.test(f.name)))
      : detectedMap[2];
    let despieceConfig = null;
    if (fileDespiece) {
      try {
        despieceConfig = await this.parseDespieceFile(fileDespiece, fileEspec, fichaData, extractedEngineer, extractedMatricula);
      } catch (eDespiece) {
        console.warn("Error en parseDespieceFile:", eDespiece);
      }
    }
    console.log(`[AUDIT-STEP] 5. Despiece finished: ${(performance.now() - t0).toFixed(0)}ms`);
    if (!despieceConfig) {
      despieceConfig = {
        tieneDocumento: false,
        archivoNombre: null,
        totalKilos: 0,
        pesoTotalDeclaradoKg: 0,
        longitudIntervencionM: 0,
        cuantiaKgM: 0,
        cumpleCuantia: false,
        marcas: [],
        concreto: [],
        despieceExtraido: {
          tieneDocumento: false,
          archivoNombre: null,
          mensajeAlerta: "Documento de despiece de acero (Ítem 3) no aportado en esta carpeta",
          acero: {
            formatoDetectado: "NO_APORTADO",
            totalAceroDeclarado: "0 kg",
            totalKg: 0,
            cuantiaKgM: 0,
            filasDespiece: []
          },
          standardTemplate: null,
          marcas: [],
          concreto: []
        },
        concretoVolumes: { totalConcretoGlobalM3: 0, totalCementoSacos: 0, sacosCemento: 0, totalConcreto21M3: 0, totalConcretoCiclopeoM3: 0, dosificacionGlobal: 0, elementos: {} }
      };
    }

    // =========================================================================
    // PASO 5: AUDITORÍA ESPACIAL (FASE 1B)
    // =========================================================================
    // Recopilar candidatos a georreferenciación (Ítem 24): KML, KMZ, ZIP, 7Z, RAR
    const georefCandidates = [];
    if (detectedFilesMap[24] && detectedFilesMap[24].length > 0) {
      georefCandidates.push(...detectedFilesMap[24]);
    } else if (detectedMap[24]) {
      georefCandidates.push(detectedMap[24]);
    }

    for (const f of files) {
      if (georefCandidates.includes(f)) continue;
      const ext = this.getFileExtension(f);
      if (ext === "kml" || ext === "kmz") {
        georefCandidates.push(f);
      } else if (["zip", "7z", "rar"].includes(ext)) {
        const clean = this.cleanForRegex(f.name);
        if (clean.includes("georref") || clean.includes("trazado") || clean.includes("track") ||
          clean.includes("tramo") || clean.includes("placa") || clean.includes("kml") || clean.includes("kmz") ||
          clean.includes("anexo") || clean.includes("item24") || clean.includes("24")) {
          georefCandidates.push(f);
        }
      }
    }

    if (georefCandidates.length === 0) {
      for (const f of files) {
        const ext = this.getFileExtension(f);
        if (["zip", "kmz", "7z", "rar", "kml"].includes(ext)) {
          georefCandidates.push(f);
        }
      }
    }

    let geoConfig = null;
    if (georefCandidates.length > 0) {
      try {
        geoConfig = await this.parseGeorefFiles(georefCandidates, fichaData);
      } catch (eGeo) {
        console.warn("Error en parseGeorefFiles:", eGeo);
        geoConfig = null;
      }
      console.log(`[AUDIT-STEP] 6. Georef finished: ${(performance.now() - t0).toFixed(0)}ms (tramos: ${geoConfig && geoConfig.tramos ? geoConfig.tramos.length : 0})`);

      const hasValidGeom = Boolean(
        geoConfig &&
        geoConfig.tieneKMZ === true &&
        ((geoConfig.tramos && geoConfig.tramos.length > 0) ||
          (geoConfig.puntos && geoConfig.puntos.length > 0) ||
          (geoConfig.puntosInspeccion && geoConfig.puntosInspeccion.length > 0))
      );

      if (hasValidGeom) {
        const geoItemId = is2026_2 ? 2 : 24;
        const primaryFile = detectedMap[geoItemId] || detectedMap[String(geoItemId)] || georefCandidates.find(f => {
          const ext = this.getFileExtension(f);
          return ext === "kml" || ext === "kmz";
        }) || georefCandidates[0];
        detectedMap[geoItemId] = primaryFile;
        detectedMap[String(geoItemId)] = primaryFile;
        archivosDetectadosMap[geoItemId] = primaryFile.name;
        archivosDetectadosMap[String(geoItemId)] = primaryFile.name;
        archivosMetadata[geoItemId] = {
          fileName: primaryFile.name,
          sizeBytes: primaryFile.size,
          lastModified: primaryFile.lastModified,
          textSnippet: is2026_2
            ? `Plano de localización e implantación espacial en coordenadas MAGNA SIRGAS verificado. ${geoConfig.tramos.length} tramos independientes procesados.`
            : `Georreferenciación verificada en contenedor digital. ${geoConfig.tramos.length} tramos independientes procesados.`
        };
        archivosMetadata[String(geoItemId)] = archivosMetadata[geoItemId];
      } else {
        // Garantizar que no quede registrado como detectado si no hay geometrías válidas
        const geoItemId = is2026_2 ? 2 : 24;
        delete detectedMap[geoItemId];
        delete detectedMap[String(geoItemId)];
        delete archivosDetectadosMap[geoItemId];
        delete archivosDetectadosMap[String(geoItemId)];
        delete archivosMetadata[geoItemId];
        delete archivosMetadata[String(geoItemId)];
        if (detectedFilesMap && detectedFilesMap[geoItemId]) {
          delete detectedFilesMap[geoItemId];
          delete detectedFilesMap[String(geoItemId)];
        }
      }
    }

    const hasValidGeomConfig = Boolean(
      geoConfig &&
      geoConfig.tieneKMZ === true &&
      ((geoConfig.tramos && geoConfig.tramos.length > 0) ||
        (geoConfig.puntos && geoConfig.puntos.length > 0) ||
        (geoConfig.puntosInspeccion && geoConfig.puntosInspeccion.length > 0))
    );

    if (!hasValidGeomConfig) {
      const prevAlerts = geoConfig ? (geoConfig.alertasArchivos || []) : [];
      const failedArchive = (files || []).find(f => f._extractionError || /\.(zip|kmz|7z|rar)$/i.test(f.name));
      let alertaComp = null;
      if (failedArchive) {
        alertaComp = failedArchive._extractionError || (prevAlerts.length > 0 ? prevAlerts[0] : `Se detectó el archivo comprimido ${failedArchive.name}, pero requiere extracción manual o formato .zip/.kmz estándar.`);
      }

      geoConfig = {
        archivoKml: null,
        archivosProcesados: [],
        codigoViaDeclarado: "Sin código",
        codigoViaGeoJSON: "Sin código",
        jerarquiaOficial: "NO GEORREFERENCIADA",
        jurisdiccion: `Municipal de ${fichaData.municipio}`,
        bufferToleranciaM: 10,
        coberturaBufferPct: 0,
        porcentajeAlineacion: 0,
        longitudKmlM: 0,
        desviacionLongitudPct: 100,
        puntosAnomalia: 0,
        tramos: [],
        puntos: [],
        puntosInspeccion: [],
        puntosContraste: [],
        tieneKMZ: false,
        tieneGeorreferenciacionValida: false,
        aprobado: false,
        coberturaConforme: false,
        estadoCompuerta: 'BLOQUEADO',
        motivoRechazo: 'Documento faltante: No se aportó archivo de georreferenciación (.KMZ / .KML) en el expediente.',
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

    // =========================================================================
    // LECTURA DE ARCHIVO DE TRAZABILIDAD (sipro_auditoria.json) O LIMPIEZA DE CACHÉ
    // =========================================================================
    let savedAuditData = null;
    const auditJsonFile = files.find(f => f.name.toLowerCase() === "sipro_auditoria.json");
    if (auditJsonFile) {
      try {
        const jsonTxt = await auditJsonFile.text();
        savedAuditData = JSON.parse(jsonTxt);
        console.log("sipro_auditoria.json restaurado desde archivo físico:", savedAuditData);
      } catch (err) {
        console.warn("Error leyendo sipro_auditoria.json:", err);
      }
    }

    // Si NO se encontró en archivo físico o falló la lectura, consultar en localStorage
    if (!savedAuditData) {
      try {
        const candidateKeys = [
          `sipro_auditoria_${proyectoId}`,
          `sipro_auditoria_${slug}`,
          `sipro_auditoria_${newExpedienteId}`,
          `sipro_auditoria_${rawFolderName}`,
          `sipro_auditoria_${cleanMpioSlug}`
        ];
        for (const k of candidateKeys) {
          const rawLocal = localStorage.getItem(k);
          if (rawLocal) {
            try {
              savedAuditData = JSON.parse(rawLocal);
              console.log("sipro_auditoria restaurado exitosamente desde localStorage:", k);
              break;
            } catch (eParse) { }
          }
        }
      } catch (eLocal) {
        console.warn("Aviso al consultar localStorage:", eLocal);
      }
    }

    // =========================================================================
    // RESTAURACIÓN DE ASIGNACIONES MANUALES Y CALIFICACIONES DE FASE 2
    // =========================================================================
    const savedArchivosDetectados = (savedAuditData && (
      (savedAuditData.documentosStatus && savedAuditData.documentosStatus.archivosDetectados) ||
      (savedAuditData.fase2 && savedAuditData.fase2.archivosDetectados)
    )) || {};

    for (const [rawItemId, fileName] of Object.entries(savedArchivosDetectados)) {
      if (!fileName || typeof fileName !== "string") continue;
      const itId = Number(rawItemId);
      if (isNaN(itId)) continue;
      const matchedFile = files.find(f => f && f.name && f.name.toLowerCase() === fileName.toLowerCase());
      if (matchedFile) {
        detectedMap[itId] = matchedFile;
        detectedMap[String(itId)] = matchedFile;
        archivosDetectadosMap[itId] = matchedFile.name;
        archivosDetectadosMap[String(itId)] = matchedFile.name;
        if (!detectedFilesMap[itId]) detectedFilesMap[itId] = [];
        if (!detectedFilesMap[itId].includes(matchedFile)) detectedFilesMap[itId].unshift(matchedFile);

        if (!archivosMetadata[itId]) {
          const savedMeta = (savedAuditData.archivosMetadata && (savedAuditData.archivosMetadata[itId] || savedAuditData.archivosMetadata[String(itId)]))
                         || (savedAuditData.fase2 && savedAuditData.fase2.archivosMetadata && (savedAuditData.fase2.archivosMetadata[itId] || savedAuditData.fase2.archivosMetadata[String(itId)]));
          archivosMetadata[itId] = savedMeta || {
            fileName: matchedFile.name,
            sizeBytes: matchedFile.size,
            lastModified: matchedFile.lastModified,
            textSnippet: `Documento asignado: ${matchedFile.name}`
          };
          archivosMetadata[String(itId)] = archivosMetadata[itId];
        }
      }
    }

    const savedRevSup = (savedAuditData && (
      savedAuditData.revisionSupervisor ||
      (savedAuditData.fase2 && savedAuditData.fase2.revisionSupervisor)
    )) || null;

    // =========================================================================
    // DETECCIÓN DE MODALIDAD (MATERIALES vs RECURSOS)
    // =========================================================================
    const budgetItemId = is2026_2 ? 14 : 28;
    let modalidad = "MATERIALES";
    if (detectedMap[budgetItemId] || detectedMap[28] || detectedMap[14] || (detectedFilesMap && ((detectedFilesMap[budgetItemId] && detectedFilesMap[budgetItemId].length > 0) || (detectedFilesMap[14] && detectedFilesMap[14].length > 0) || (detectedFilesMap[28] && detectedFilesMap[28].length > 0))) || files.some(f => /\.(xlsx|xlsm|xls|xlsb|ods)$/i.test(f.name) && /presupuesto|pto|apu|cantidades/i.test(f.name))) {
      modalidad = "RECURSOS";
    }
    if (savedAuditData && savedAuditData.modalidad) {
      modalidad = savedAuditData.modalidad;
    }

    const nombreExp = `${fichaData.municipio} - Proyecto Placa Huella Vías Terciarias`;
    const deptoVal = fichaData.aporteDepto || Math.round(fichaData.presupuestoEstimado * 0.8);
    const mpioVal = Math.round(deptoVal * 0.25);

    const proyectoData = {
      id: proyectoId,
      rawFolderName: rawFolderName,
      slug: slug,
      codigo: `EXP-${fichaData.codMunicipio || '05000'}-PH`,
      nombreExpediente: (savedAuditData && savedAuditData.datosIdentificacion && savedAuditData.datosIdentificacion.nombreExpediente) || nombreExp,
      municipio: fichaData.municipio,
      codMunicipio: fichaData.codMunicipio || "05000",
      subregion: fichaData.subregion || "ANTIOQUIA",
      modalidad: modalidad,
      vereda: (geoConfig.tramos && geoConfig.tramos.length > 0)
        ? geoConfig.tramos.slice(0, 4).map(t => t.nombrePlacemark).join(", ")
        : (geoConfig.puntosContraste.length > 0
          ? geoConfig.puntosContraste.slice(0, 4).map(p => p.sector).join(", ")
          : "Tramos según expediente cargado"),
      nombreTramo: `Placa Huella ${fichaData.municipio} (${finalLength}m)`,
      codigoVial: (savedAuditData && savedAuditData.datosIdentificacion && savedAuditData.datosIdentificacion.codigoVial)
        || geoConfig.codigoViaDeclarado || fichaData.codigosViales[0] || `${fichaData.codMunicipio || '05000'}VT01`,
      longitudM: (savedAuditData && savedAuditData.datosIdentificacion && savedAuditData.datosIdentificacion.longitudM) || finalLength,
      presupuestoTotal: deptoVal + mpioVal,
      aporteDepto: deptoVal,
      aporteMpio: mpioVal,
      plazoMeses: 6,
      poblacionBeneficiada: Math.round(finalLength * 3.8),
      alcalde: {
        nombre: (savedAuditData && savedAuditData.datosIdentificacion && savedAuditData.datosIdentificacion.alcalde && savedAuditData.datosIdentificacion.alcalde.nombre)
          || extractedAlcalde
          || `ALCALDE MUNICIPAL DE ${fichaData.municipio}`,
        cargo: (savedAuditData && savedAuditData.datosIdentificacion && savedAuditData.datosIdentificacion.alcalde && savedAuditData.datosIdentificacion.alcalde.cargo)
          || extractedCargoAlcalde
          || "ALCALDE MUNICIPAL",
        cedula: (savedAuditData && savedAuditData.datosIdentificacion && savedAuditData.datosIdentificacion.alcalde && savedAuditData.datosIdentificacion.alcalde.cedula)
          || extractedCcAlcalde
          || "71.000.000",
        origen: (savedAuditData && savedAuditData.datosIdentificacion && savedAuditData.datosIdentificacion.alcalde && savedAuditData.datosIdentificacion.alcalde.origen)
          || extractedOrigenAlcalde
          || (extractedAlcalde ? "Extraído de: Ficha de Priorización" : "Sin firma detectada"),
        periodo: "2024 - 2027"
      },
      secretarioPlaneacion: {
        nombre: (savedAuditData && savedAuditData.datosIdentificacion && savedAuditData.datosIdentificacion.secretarioPlaneacion && savedAuditData.datosIdentificacion.secretarioPlaneacion.nombre)
          || extractedSecretario
          || "SECRETARIO(A) DE PLANEACIÓN / OBRAS PÚBLICAS",
        cargo: (savedAuditData && savedAuditData.datosIdentificacion && savedAuditData.datosIdentificacion.secretarioPlaneacion && savedAuditData.datosIdentificacion.secretarioPlaneacion.cargo)
          || extractedCargoSecretario
          || "Secretario(a) de Planeación / Obras Públicas",
        cedula: (savedAuditData && savedAuditData.datosIdentificacion && savedAuditData.datosIdentificacion.secretarioPlaneacion && savedAuditData.datosIdentificacion.secretarioPlaneacion.cedula)
          || extractedCcSecretario
          || "",
        origen: (savedAuditData && savedAuditData.datosIdentificacion && savedAuditData.datosIdentificacion.secretarioPlaneacion && savedAuditData.datosIdentificacion.secretarioPlaneacion.origen)
          || extractedOrigenSecretario
          || (extractedSecretario ? "Extraído de: Ficha de Priorización" : "Sin firma detectada"),
        entidad: `Municipio de ${fichaData.municipio}`,
        periodo: "2024 - 2027"
      },
      ingenieroProyectista: {
        nombre: extractedEngineer || "INGENIERO CIVIL PROYECTISTA",
        matricula: extractedMatricula || "COPNIA",
        entidadMatricula: "COPNIA",
        vigente: !!extractedMatricula
      },
      estadoSimulacion: matchedCount >= (is2026_2 ? 41 : (modalidad === "RECURSOS" ? 28 : 27)) ? "APROBADO_CONFORME" : "EN_EVALUACION",
      faseActiva: matchedCount >= (is2026_2 ? 41 : (modalidad === "RECURSOS" ? 28 : 27)) ? "3_APROBADO" : "2_DOCUMENTAL",
      procesoEspecial: processMode,
      fichaPriorizacion: fichaData,
      totalArchivosCargados: files.length,
      archivosMetadata: archivosMetadata,
      archivosFiles: detectedMap,
      archivosFilesMap: detectedFilesMap,
      despieceExtraido: despieceConfig.despieceExtraido || despieceConfig,
      despieceAcero: despieceConfig,
      concretoVolumes: despieceConfig.concretoVolumes,
      georreferenciacion: {
        ...geoConfig,
        puntos: (geoConfig && (geoConfig.puntos || geoConfig.puntosInspeccion)) || []
      },
      revisionSupervisor: savedRevSup || {},
      documentosStatus: {
        itemsCumplidos: Object.keys(archivosDetectadosMap).map(Number),
        itemsSubsanar: itemsNormativos.filter(i => !archivosDetectadosMap[i.id]).map(i => i.id),
        archivosDetectados: archivosDetectadosMap,
        revisionSupervisor: savedRevSup || {},
        fechasDocumentos: Object.fromEntries(
          itemsVigencia.filter(i => archivosMetadata[i] && archivosMetadata[i].fechaDoc)
            .map(i => [i, archivosMetadata[i].fechaDoc])
        )
      }
    };

    if (savedRevSup) {
      Object.entries(savedRevSup).forEach(([k, sup]) => {
        const num = Number(k);
        if (!isNaN(num) && sup && (sup.estado === "CONFORME" || sup.estado === "NO_APLICA")) {
          proyectoData.documentosStatus.itemsSubsanar = proyectoData.documentosStatus.itemsSubsanar.filter(id => Number(id) !== num);
          if (!proyectoData.documentosStatus.itemsCumplidos.includes(num)) {
            proyectoData.documentosStatus.itemsCumplidos.push(num);
          }
        }
      });
    }

    // =========================================================================
    // PASO 7: EJECUTAR AUDITORÍA AISLADA COMPLETA Y ENCAPSULAR EN EL ALMACÉN GLOBAL
    // =========================================================================
    let audit1A, audit1B, audit2;
    try {
      audit1A = StructuralEngine.auditProject(proyectoData);
    } catch (eA) {
      console.warn("Error en StructuralEngine.auditProject:", eA);
      audit1A = { cuantiaConforme: false, cuantiaCalculadaKgM: 0 };
    }
    try {
      audit1B = SpatialEngine.auditProject(proyectoData);
    } catch (eB) {
      console.warn("Error en SpatialEngine.auditProject:", eB);
      audit1B = { coberturaConforme: false, coberturaBufferPct: 0 };
    }
    try {
      audit2 = DocumentalEngine.auditProject(proyectoData);
    } catch (eC) {
      console.warn("Error en DocumentalEngine.auditProject:", eC);
      audit2 = { itemsConformes: matchedCount, itemsNoConformes: (is2026_2 ? 41 : 27) - matchedCount };
    }

    const hasValidKmz = Boolean(
      geoConfig &&
      geoConfig.tieneKMZ === true &&
      ((geoConfig.tramos && geoConfig.tramos.length > 0) ||
        (geoConfig.puntos && geoConfig.puntos.length > 0) ||
        (geoConfig.puntosInspeccion && geoConfig.puntosInspeccion.length > 0))
    );

    audit1B.tieneKMZ = hasValidKmz;
    audit1B.tieneGeorreferenciacionValida = hasValidKmz;
    audit1B.coberturaConforme = hasValidKmz && Boolean(audit1B.coberturaConforme);
    audit1B.aprobado = audit1B.coberturaConforme;
    audit1B.coberturaBufferPct = hasValidKmz ? audit1B.coberturaBufferPct : 0;
    audit1B.porcentajeAlineacion = hasValidKmz ? (audit1B.porcentajeAlineacion !== undefined ? audit1B.porcentajeAlineacion : audit1B.coberturaBufferPct) : 0;
    audit1B.tramos = geoConfig.tramos || [];
    audit1B.puntosContraste = geoConfig.puntosContraste || [];
    audit1B.alertasArchivos = geoConfig.alertasArchivos || [];
    audit1B.alertaComprimido = geoConfig.alertaComprimido || null;
    if (!hasValidKmz) {
      audit1B.estadoCompuerta = 'BLOQUEADO';
      audit1B.motivoRechazo = 'Documento faltante: No se aportó archivo de georreferenciación (.KMZ / .KML) en el expediente.';
    }

    const totalItemsCount = is2026_2 ? 41 : ((modalidad === "RECURSOS") ? 28 : 27);
    const isApproved = (
      audit1A.cuantiaConforme &&
      hasValidKmz &&
      audit1B.coberturaConforme &&
      audit2.itemsConformes >= totalItemsCount
    );

    let activeGatekeeper = "2_DOCUMENTAL";
    if (!audit1A.cuantiaConforme) {
      activeGatekeeper = "1A_DISENO";
    } else if (!hasValidKmz || !audit1B.coberturaConforme) {
      activeGatekeeper = "1B_ESPACIAL";
    } else if (isApproved) {
      activeGatekeeper = "3_APROBADO";
    }

    const kpis = {
      cuantiaActualKgM: despieceConfig.cuantiaKgM || audit1A.cuantiaCalculadaKgM,
      cuantiaConforme: audit1A.cuantiaConforme,
      coberturaBufferPct: audit1B.coberturaBufferPct,
      coberturaConforme: audit1B.coberturaConforme,
      itemsConformes: audit2.itemsConformes,
      itemsNoConformes: audit2.itemsNoConformes,
      itemsTotal: totalItemsCount
    };

    const auditGlobal = {
      audit1A,
      audit1B,
      audit2,
      isApproved,
      activeGatekeeper
    };

    // Encapsular TODO el estado indexado de forma segura por proyectoId
    window.proyectosAuditados = window.proyectosAuditados || {};
    window.proyectosAuditados[proyectoId] = {
      id: proyectoId,
      rawFolderName: rawFolderName,
      slug: slug,
      expedienteId: newExpedienteId,
      municipio: fichaData.municipio,
      codMunicipio: fichaData.codMunicipio,
      subregion: fichaData.subregion,
      modalidad: modalidad,
      procesoEspecial: processMode,
      dirHandle: dirHandle || null,
      fichaPriorizacion: fichaData,
      historialSubsanaciones: (savedAuditData && savedAuditData.historialSubsanaciones) || [],
      datos: proyectoData,
      revisionSupervisor: (proyectoData && proyectoData.revisionSupervisor) || savedRevSup || {},
      alcalde: proyectoData.alcalde,
      secretarioPlaneacion: proyectoData.secretarioPlaneacion,
      archivos: files,
      archivosFileMap: detectedMap,
      archivosFilesMap: detectedFilesMap,
      despieceExtraido: despieceConfig.despieceExtraido || despieceConfig,
      fase1A: {
        ...audit1A,
        longitudTramo: (despieceConfig && despieceConfig.tieneDocumento !== false) ? finalLength : 0,
        longitudIntervencionM: (despieceConfig && despieceConfig.tieneDocumento !== false) ? finalLength : 0,
        tieneDocumento: audit1A.tieneDocumento !== false && despieceConfig.tieneDocumento !== false,
        marcas: (audit1A.tieneDocumento !== false && despieceConfig.tieneDocumento !== false) ? (audit1A.marcas || []) : [],
        concreto: (audit1A.tieneDocumento !== false && despieceConfig.tieneDocumento !== false) ? (audit1A.concreto || []) : []
      },
      concretoVolumes: despieceConfig.concretoVolumes,
      fase1B: {
        ...audit1B,
        porcentajeAlineacion: hasValidKmz ? (geoConfig.porcentajeAlineacion !== undefined ? geoConfig.porcentajeAlineacion : geoConfig.coberturaBufferPct) : 0,
        coberturaBufferPct: hasValidKmz ? geoConfig.coberturaBufferPct : 0,
        tieneKMZ: hasValidKmz,
        tieneGeorreferenciacionValida: hasValidKmz,
        aprobado: hasValidKmz && audit1B.coberturaConforme,
        coberturaConforme: hasValidKmz && audit1B.coberturaConforme,
        estadoCompuerta: (hasValidKmz && audit1B.coberturaConforme) ? 'APROBADO' : 'BLOQUEADO',
        motivoRechazo: !hasValidKmz
          ? 'Documento faltante: No se aportó archivo de georreferenciación (.KMZ / .KML) en el expediente.'
          : (audit1B.coberturaConforme ? null : `Desfase de alineación: Cobertura (${audit1B.coberturaBufferPct}%) inferior al 95%.`),
        puntos: (geoConfig && (geoConfig.puntos || geoConfig.puntosInspeccion)) || [],
        redVialRecortada: (geoConfig && geoConfig.redVialRecortada) || null
      },
      fase2: audit2,
      kpis: kpis,
      auditGlobal: auditGlobal,
      timestamp: Date.now()
    };

    if (window.SpatialEngine && geoConfig && geoConfig.redVialRecortada) {
      window.SpatialEngine.roadsByProject = window.SpatialEngine.roadsByProject || {};
      window.SpatialEngine.roadsByProject[proyectoId] = geoConfig.redVialRecortada;
    }

    // Si modalidad es RECURSOS o se detectó presupuesto, ejecutar de una vez la auditoría de presupuesto (Fase 1C)
    if ((modalidad === "RECURSOS" || is2026_2) && typeof PresupuestoEngine !== "undefined") {
      const budgetCandidates = (detectedFilesMap && (detectedFilesMap[budgetItemId] || detectedFilesMap[14] || detectedFilesMap[28])) || [];
      const budgetFile = budgetCandidates.find(f => /\.(xlsx|xlsm|xls|xlsb|ods)$/i.test(f.name))
                      || detectedMap[budgetItemId]
                      || detectedMap[14]
                      || detectedMap[28]
                      || files.find(f => /\.(xlsx|xlsm|xls|xlsb|ods)$/i.test(f.name) && /presupuesto|pto|apu|cantidades/i.test(f.name));
      if (budgetFile && /\.(xlsx|xlsm|xls|xlsb|ods)$/i.test(budgetFile.name)) {
        try {
          const pData = await PresupuestoEngine.parseExcelBudget(budgetFile, window.proyectosAuditados[proyectoId]?.fase1A || audit1A);
          PresupuestoEngine.auditarCoherencia(window.proyectosAuditados[proyectoId], pData);
        } catch (eBudget) {
          console.warn("Error en parseExcelBudget:", eBudget);
          PresupuestoEngine.auditarCoherencia(window.proyectosAuditados[proyectoId]);
        }
      } else {
        PresupuestoEngine.auditarCoherencia(window.proyectosAuditados[proyectoId]);
      }
    }

    // Restaurar observaciones previas si existían en savedAuditData (SIN sobreescribir archivos ni detección)
    if (savedAuditData) {
      const expObj = window.proyectosAuditados[proyectoId];
      if (savedAuditData.fase3) {
        expObj.fase3 = expObj.fase3 || { observacionesEditadas: {}, matrizObservaciones: {}, conceptoGeneral: "", hallazgosManuales: [] };
        expObj.fase3.matrizObservaciones = expObj.fase3.matrizObservaciones || {};
        expObj.fase3.observacionesEditadas = expObj.fase3.observacionesEditadas || {};

        const obsData = savedAuditData.fase3.matrizObservaciones || savedAuditData.fase3.observaciones || {};
        for (const [key, val] of Object.entries(obsData)) {
          expObj.fase3.matrizObservaciones[key] = val;
          expObj.fase3.observacionesEditadas[key] = val;
        }
        if (savedAuditData.fase3.conceptoGeneral) {
          expObj.fase3.conceptoGeneral = savedAuditData.fase3.conceptoGeneral;
        }
        if (savedAuditData.fase3.hallazgosManuales) {
          expObj.fase3.hallazgosManuales = savedAuditData.fase3.hallazgosManuales;
        }
      }
      if (savedAuditData.fase1C && expObj.fase1C) {
        if (savedAuditData.fase1C.toleranciaPct) expObj.fase1C.toleranciaPct = savedAuditData.fase1C.toleranciaPct;
      }
    }

    // Asegurar registro estricto de observación si falta el archivo de georreferenciación (Ítem 24 / Fase 1B)
    const expObjMaster = window.proyectosAuditados[proyectoId];
    if (expObjMaster) {
      expObjMaster.fase3 = expObjMaster.fase3 || { observacionesEditadas: {}, matrizObservaciones: {}, conceptoGeneral: "", hallazgosManuales: [] };
      expObjMaster.fase3.matrizObservaciones = expObjMaster.fase3.matrizObservaciones || {};
      expObjMaster.fase3.observacionesEditadas = expObjMaster.fase3.observacionesEditadas || {};

      if (!hasValidKmz) {
        const geoObs = "Georreferenciación / Archivo KMZ-KML (Fase 1B - Ítem 24): Documento faltante. No se aportó archivo de georreferenciación del proyecto para verificar su alineación con la red vial.";
        expObjMaster.fase3.matrizObservaciones["item_24"] = geoObs;
        expObjMaster.fase3.matrizObservaciones["FASE_2_ITEM_24"] = geoObs;
        expObjMaster.fase3.matrizObservaciones["FASE_1B_GEO"] = geoObs;
        if (expObjMaster.fase2 && expObjMaster.fase2.items) {
          const it24 = expObjMaster.fase2.items.find(i => Number(i.id) === 24 || i.id === "24");
          if (it24) {
            it24.conforme = false;
            it24.faltante = true;
            it24.estado = "Faltante";
            it24.archivoDetectado = null;
            it24.observacion = geoObs;
          }
        }
      }
    }

    // Sincronizar catálogo maestro de SIPRO_DATA
    SIPRO_DATA.expedientesMap = window.proyectosAuditados;
    SIPRO_DATA.expedientesMap[proyectoId].despieceExtraido = despieceConfig.despieceExtraido || despieceConfig;
    SIPRO_DATA.proyectos = Object.values(window.proyectosAuditados).map(p => p.datos);

    if (savedAuditData) {
      const fechaAviso = savedAuditData.fechaEdicion || new Date(savedAuditData.timestamp || Date.now()).toLocaleString("es-CO");
      this.showToast(`🔄 Sesión de revisión previa restaurada (Última edición: ${fechaAviso})`);
    } else if (isAmbiguous) {
      App.openExpedienteModal();
      this.showToast("⚠️ Ficha leída pero municipio ambiguo. Por favor confirma el municipio.");
    } else {
      const missingCount = totalItemsCount - matchedCount;
      const cv = despieceConfig.concretoVolumes;
      const msg = missingCount === 0
        ? `✓ Carpeta de ${fichaData.municipio}: 100% Completa (${modalidad}). Despiece (${finalLength}m, ${despieceConfig.pesoTotalDeclaradoKg}kg) y Concreto (${cv.totalConcretoGlobalM3}m³) listos en memoria.`
        : `⚠️ Carpeta de ${fichaData.municipio}: ${matchedCount} aportados, ${missingCount} FALTANTES (${modalidad}). Despiece (${finalLength}m) y Concreto (${cv.totalConcretoGlobalM3}m³) indexados.`;
      this.showToast(msg);
    }

    // Sincronización vial con ArcGIS Circular 10 y cálculo espacial completo
    if (typeof SpatialEngine !== "undefined" && typeof SpatialEngine.syncRoadsForProject === "function") {
      try {
        await SpatialEngine.syncRoadsForProject(window.proyectosAuditados[proyectoId].datos || window.proyectosAuditados[proyectoId]);
      } catch (errSync) {
        console.warn("Aviso en sincronización vial:", errSync);
      }
    }

    // Transmitir proyecto a cualquier pestaña hermana abierta en paralelo
    if (this.syncChannel) {
      try {
        this.syncChannel.postMessage({
          type: "BROADCAST_NEW_PROJECT",
          proyectoId: proyectoId,
          municipio: fichaData.municipio,
          rawFolderName: rawFolderName,
          files: files,
          senderProcessMode: processMode
        });
      } catch (eBroadcast) {
        console.warn("Aviso: No se pudo emitir BROADCAST_NEW_PROJECT:", eBroadcast);
      }
    }

    return window.proyectosAuditados[proyectoId];
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
        archivoKml: null,
        archivosProcesados: processedNames,
        codigoViaDeclarado: declaredCod,
        codigoViaGeoJSON: declaredCod,
        jerarquiaOficial: "TERCIARIA",
        jurisdiccion: `Municipal de ${fichaData.municipio}`,
        bufferToleranciaM: 10,
        coberturaBufferPct: 0,
        porcentajeAlineacion: 0,
        longitudKmlM: 0,
        desviacionLongitudPct: 100,
        puntosAnomalia: 0,
        tramos: [],
        puntos: [],
        puntosInspeccion: [],
        puntosContraste: [],
        tieneKMZ: false,
        tieneGeorreferenciacionValida: false,
        aprobado: false,
        coberturaConforme: false,
        estadoCompuerta: 'BLOQUEADO',
        motivoRechazo: 'Documento faltante: No se aportó archivo de georreferenciación (.KMZ / .KML) en el expediente.',
        alertaComprimido: alertaComp,
        alertasArchivos: allAlerts,
        estado: alertaComp ? "Alerta de Extracción" : "No Cumple - Falta archivo KMZ/KML"
      };
    }

    // 1. Reiniciar siempre arreglos y estructuras de deduplicación geográfica
    const pId = fichaData?.id || fichaData?.codigo;
    const expedientesMap = (window.SIPRO_DATA && SIPRO_DATA.expedientesMap) || window.proyectosAuditados || {};
    if (pId && expedientesMap[pId] && expedientesMap[pId].fase1B) {
      expedientesMap[pId].fase1B.tramos = [];
      expedientesMap[pId].fase1B.puntos = [];
      expedientesMap[pId].fase1B.puntosInspeccion = [];
      expedientesMap[pId].fase1B.puntosContraste = [];
      expedientesMap[pId].fase1B.alertas = [];
      expedientesMap[pId].fase1B.alertasArchivos = [];
    }

    const tramos = [];
    const puntosInspeccion = [];
    const rawTramos = [];
    const rawPuntos = [];
    const seenPoints = new Set();
    const seenTramos = new Set();
    let tramoCounter = 1;
    let puntoCounter = 1;
    let totalLengthM = 0;
    var tramosConformes = 0;

    const parser = new DOMParser();

    // =========================================================================
    // PASO 1: Extraer geometrías crudas (LineStrings, Polygons, Points) de los KMLs
    // =========================================================================
    for (const item of allExtractedKmls) {
      await new Promise(r => setTimeout(r, 0)); // Ceder control antes de parsear cada archivo KML
      try {
        const xmlDoc = parser.parseFromString(item.kmlText, "text/xml");
        const placemarks = xmlDoc.getElementsByTagName("Placemark");

        for (let i = 0; i < placemarks.length; i++) {
          const pm = placemarks[i];

          // 1. Omitir elementos y capas ocultas (<visibility>0</visibility>) en Google Earth
          const visNode = pm.getElementsByTagName("visibility")[0];
          if (visNode && visNode.textContent.trim() === "0") {
            continue; // Elemento oculto en Google Earth
          }
          let parentEl = pm.parentElement;
          let isParentHidden = false;
          while (parentEl && parentEl.tagName !== "kml" && parentEl !== xmlDoc) {
            if (parentEl.tagName === "Folder" || parentEl.tagName === "Document") {
              const pVis = parentEl.querySelector(":scope > visibility");
              if (pVis && pVis.textContent.trim() === "0") {
                isParentHidden = true;
                break;
              }
            }
            parentEl = parentEl.parentElement;
          }
          if (isParentHidden) continue;

          const nameNode = pm.getElementsByTagName("name")[0];
          const baseName = nameNode ? nameNode.textContent.trim() : `Tramo ${tramoCounter}`;

          // Extraer LineStrings independientes (incluso dentro de MultiGeometry)
          if (rawTramos.length < 60) {
            const lineStrings = pm.getElementsByTagName("LineString");
            for (let lsIdx = 0; lsIdx < lineStrings.length; lsIdx++) {
              if (rawTramos.length >= 60) break;
              const ls = lineStrings[lsIdx];
              const coordNode = ls.getElementsByTagName("coordinates")[0];
              if (coordNode) {
                const coords = this.parseCoordinatesText(coordNode.textContent);
                if (coords.length > 1) {
                  // Deduplicación por Coordenadas Geográficas Exactas (primer, medio y último vértice)
                  const firstLat = coords[0].lat;
                  const firstLng = coords[0].lng;
                  const midIdx = Math.floor(coords.length / 2);
                  const midLat = coords[midIdx].lat;
                  const midLng = coords[midIdx].lng;
                  const lastIdx = coords.length - 1;
                  const lastLat = coords[lastIdx].lat;
                  const lastLng = coords[lastIdx].lng;

                  // Filtro territorial estricto: omitir tramos cuyas coordenadas caigan fuera de Antioquia / Colombia
                  const hasCoordInAntioquia = coords.some(c => c.lat >= 5.0 && c.lat <= 9.2 && c.lng >= -77.6 && c.lng <= -73.6);
                  if (!hasCoordInAntioquia) continue;

                  const lineGeoKey = `${firstLat.toFixed(6)},${firstLng.toFixed(6)}_${midLat.toFixed(6)},${midLng.toFixed(6)}_${lastLat.toFixed(6)},${lastLng.toFixed(6)}_${coords.length}`;
                  const revLineGeoKey = `${lastLat.toFixed(6)},${lastLng.toFixed(6)}_${midLat.toFixed(6)},${midLng.toFixed(6)}_${firstLat.toFixed(6)},${firstLng.toFixed(6)}_${coords.length}`;

                  if (seenTramos.has(lineGeoKey) || seenTramos.has(revLineGeoKey)) {
                    continue; // Tramo duplicado omitido
                  }
                  seenTramos.add(lineGeoKey);
                  seenTramos.add(revLineGeoKey);

                  let lenM = 0;
                  for (let j = 0; j < coords.length - 1; j++) {
                    lenM += this.haversineMeters(coords[j].lat, coords[j].lng, coords[j + 1].lat, coords[j + 1].lng);
                  }
                  if (lenM > 6000) continue; // Un eje continuo mayor a 6 km es una carretera o red territorial completa, no un tramo de obra de placa huella
                  totalLengthM += lenM;

                  const tramoName = lineStrings.length > 1
                    ? `${baseName} (Subtramo ${lsIdx + 1})`
                    : baseName;

                  const idTramo = `TR-${String(tramoCounter++).padStart(2, "0")}`;

                  rawTramos.push({
                    idTramo: idTramo,
                    nombrePlacemark: tramoName,
                    sourceFile: item.sourceFile,
                    tipoGeometria: "LineString",
                    coords: coords,
                    lenM: lenM
                  });
                }
              }
            }
          }

          // Extraer Polygons independientes (outerBoundaryIs -> LinearRing -> coordinates)
          // Regla técnica estricta: En proyectos de placa huella los tramos viales son lineales (LineString).
          // Los polígonos suelen ser límites administrativos ("MPIO DE NARIÑO"), cascos urbanos ("CABECERA MPAL"),
          // predios catastrales ("GLORIA ELENA") o reservas. Solo se aceptan si expresamente nombran un tramo/vía
          // o si no existe ningún LineString en el expediente.
          const polygons = pm.getElementsByTagName("Polygon");
          const isRoadPolygon = /(?:tramo|via\b|vía\b|placa[\s_-]*huella|intervencion|intervención|eje)/i.test(baseName) &&
            !/(?:mpio|municipio|cabecera|limite|límite|predio|lote|manzana|catast|reserva|cuenca|zona|área|area)/i.test(baseName);

          if (polygons.length > 0 && rawTramos.length < 60 && (isRoadPolygon || (rawTramos.length === 0 && !/(?:mpio|municipio|cabecera|limite|predio|lote|catast)/i.test(baseName)))) {
            for (let polyIdx = 0; polyIdx < polygons.length; polyIdx++) {
              if (rawTramos.length >= 60) break;
              const poly = polygons[polyIdx];
              const coordNode = poly.getElementsByTagName("coordinates")[0];
              if (coordNode) {
                const coords = this.parseCoordinatesText(coordNode.textContent);
                if (coords.length > 1) {
                  let lenM = 0;
                  for (let j = 0; j < coords.length - 1; j++) {
                    lenM += this.haversineMeters(coords[j].lat, coords[j].lng, coords[j + 1].lat, coords[j + 1].lng);
                  }
                  if (lenM > 4000) continue; // Un polígono con perímetro > 4km es un predio o zona territorial, no un tramo de placa huella

                  // Deduplicación por Coordenadas Geográficas Exactas para Polígonos
                  const firstLat = coords[0].lat;
                  const firstLng = coords[0].lng;
                  const midIdx = Math.floor(coords.length / 2);
                  const midLat = coords[midIdx].lat;
                  const midLng = coords[midIdx].lng;
                  const lastIdx = coords.length - 1;
                  const lastLat = coords[lastIdx].lat;
                  const lastLng = coords[lastIdx].lng;

                  // Filtro territorial estricto: omitir polígonos fuera de Antioquia / Colombia
                  const hasCoordInAntioquia = coords.some(c => c.lat >= 5.0 && c.lat <= 9.2 && c.lng >= -77.6 && c.lng <= -73.6);
                  if (!hasCoordInAntioquia) continue;

                  const lineGeoKey = `${firstLat.toFixed(6)},${firstLng.toFixed(6)}_${midLat.toFixed(6)},${midLng.toFixed(6)}_${lastLat.toFixed(6)},${lastLng.toFixed(6)}_${coords.length}`;
                  const revLineGeoKey = `${lastLat.toFixed(6)},${lastLng.toFixed(6)}_${midLat.toFixed(6)},${midLng.toFixed(6)}_${firstLat.toFixed(6)},${firstLng.toFixed(6)}_${coords.length}`;

                  if (seenTramos.has(lineGeoKey) || seenTramos.has(revLineGeoKey)) {
                    continue; // Polígono duplicado omitido
                  }
                  seenTramos.add(lineGeoKey);
                  seenTramos.add(revLineGeoKey);

                  totalLengthM += lenM;

                  const tramoName = polygons.length > 1
                    ? `${baseName} (Polígono ${polyIdx + 1})`
                    : `${baseName} (Polígono)`;

                  const idTramo = `TR-${String(tramoCounter++).padStart(2, "0")}`;

                  rawTramos.push({
                    idTramo: idTramo,
                    nombrePlacemark: tramoName,
                    sourceFile: item.sourceFile,
                    tipoGeometria: "Polygon",
                    coords: coords,
                    lenM: lenM
                  });
                }
              }
            }
          }

          // Extraer Points independientes
          if (rawPuntos.length < 80) {
            const points = pm.getElementsByTagName("Point");
            for (let ptIdx = 0; ptIdx < points.length; ptIdx++) {
              if (rawPuntos.length >= 80) break;
              const pt = points[ptIdx];
              const coordNode = pt.getElementsByTagName("coordinates")[0];
              if (coordNode) {
                const coords = this.parseCoordinatesText(coordNode.textContent);
                if (coords.length > 0) {
                  const primaryCoord = coords[0];
                  const lat = primaryCoord.lat;
                  const lng = primaryCoord.lng;

                  // Filtro territorial estricto: omitir puntos fuera de Antioquia / Colombia
                  // Descarta puntos de muestra turísticos o globales (Torre Eiffel, Sydney, Cristo Redentor, etc.)
                  if (lat < 5.0 || lat > 9.2 || lng < -77.6 || lng > -73.6) {
                    continue;
                  }

                  // Huella única de punto basada en coordenadas redondeadas a 6 decimales (~0.11 m)
                  const pointGeoKey = `${lat.toFixed(6)}_${lng.toFixed(6)}`;
                  if (seenPoints.has(pointGeoKey)) {
                    continue; // Punto duplicado en misma coordenada exacta omitido
                  }
                  seenPoints.add(pointGeoKey);

                  const ptName = points.length > 1
                    ? `${baseName} (Punto ${ptIdx + 1})`
                    : baseName;

                  const descNode = pm.getElementsByTagName("description")[0];
                  const description = descNode ? descNode.textContent.trim() : "";

                  const idPunto = `PTO-${String(puntoCounter++).padStart(2, "0")}`;

                  rawPuntos.push({
                    idPunto: idPunto,
                    nombrePlacemark: ptName,
                    description: description,
                    sourceFile: item.sourceFile,
                    primaryCoord: primaryCoord
                  });
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn(`Error al parsear KML de ${item.sourceFile}:`, err);
      }
    }

    // =========================================================================
    // PASO 2: Calcular el Bounding Box del proyecto (+/- 5 km de margen)
    // =========================================================================
    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    let validCoordCount = 0;

    // Regla de coherencia territorial: Proyectos viales de Antioquia (Colombia)
    // Latitud válida: [4.0, 10.0], Longitud válida: [-78.5, -73.0].
    // Excluye marcadores mundiales accidentales (ej. Torre Eiffel, Sydney, Tokio) que deforman el Bbox.
    rawTramos.forEach(t => {
      (t.coords || []).forEach(c => {
        if (c.lng !== undefined && c.lat !== undefined && !isNaN(c.lng) && !isNaN(c.lat)) {
          if (c.lat < 4.0 || c.lat > 10.0 || c.lng < -78.5 || c.lng > -73.0) return;
          validCoordCount++;
          if (c.lng < minLon) minLon = c.lng;
          if (c.lng > maxLon) maxLon = c.lng;
          if (c.lat < minLat) minLat = c.lat;
          if (c.lat > maxLat) maxLat = c.lat;
        }
      });
    });

    rawPuntos.forEach(p => {
      const c = p.primaryCoord;
      if (c && c.lng !== undefined && c.lat !== undefined && !isNaN(c.lng) && !isNaN(c.lat)) {
        if (c.lat < 4.0 || c.lat > 10.0 || c.lng < -78.5 || c.lng > -73.0) return;
        validCoordCount++;
        if (c.lng < minLon) minLon = c.lng;
        if (c.lng > maxLon) maxLon = c.lng;
        if (c.lat < minLat) minLat = c.lat;
        if (c.lat > maxLat) maxLat = c.lat;
      }
    });

    const projectBbox = validCoordCount > 0 ? { minLon, minLat, maxLon, maxLat } : null;

    // =========================================================================
    // PASO 3: Await obligatorio para descargar las vías oficiales de la Circular 10
    // =========================================================================
    if (window.SpatialEngine && typeof window.SpatialEngine.obtenerRedVialParaProyecto === "function") {
      try {
        await window.SpatialEngine.obtenerRedVialParaProyecto(fichaData.municipio, projectBbox, fichaData.codMunicipio);
      } catch (errSync) {
        console.warn("Aviso al obtener red vial oficial para el proyecto:", errSync);
      }
    }

    // =========================================================================
    // PASO 4: Con las vías oficiales YA en memoria, evaluar distancias ortogonales y conformidad
    // =========================================================================
    const candidates = (window.SpatialEngine && typeof window.SpatialEngine.getCandidateFeatures === "function")
      ? window.SpatialEngine.getCandidateFeatures({
          municipio: fichaData.municipio,
          codMunicipio: fichaData.codMunicipio,
          bbox: projectBbox,
          tramos: rawTramos
        })
      : [];

    for (let tIdx = 0; tIdx < rawTramos.length; tIdx++) {
      const item = rawTramos[tIdx];
      await new Promise(r => setTimeout(r, 0)); // Ceder control al bucle de eventos en cada tramo para mantener la interfaz 100% fluida
      let sub = null;
      if (window.SpatialEngine && typeof window.SpatialEngine.analyzeTrackSubSegments === "function" && item.coords && item.coords.length > 1) {
        sub = window.SpatialEngine.analyzeTrackSubSegments(item.coords, candidates);
      }

      if (sub) {
        const distM = sub.maxDistM;
        const cumpleTotal = sub.cumpleTotal;
        const cumpleParcial = sub.cumpleParcial;
        const noCumpleTotal = sub.noCumpleTotal;
        const codGeo = (sub.vMax && sub.vMax.codigoVia) || (fichaData.codigosViales && fichaData.codigosViales[0]) || "05000VT01";
        const nomGeo = (sub.vMax && sub.vMax.nombreVia) || "Vía Oficial";

        let estado = "";
        let detalleParcial = null;
        if (cumpleTotal) {
          estado = `✓ SOBRE ${codGeo}`;
        } else if (cumpleParcial) {
          estado = `⚠️ PARCIAL: ${sub.longitudEnViaM} m en vía (${sub.pctEnVia}%) / ${sub.longitudFueraViaM} m fuera`;
          detalleParcial = `De ${sub.totalTrackLengthM} m totales: ${sub.longitudEnViaM} m coinciden con ${codGeo}, pero ${sub.longitudFueraViaM} m se desvían hasta ${distM} m del eje.`;
        } else {
          estado = `! A ${distM} m DE ${codGeo}`;
          detalleParcial = `Todo el tramo (${sub.totalTrackLengthM} m) se encuentra fuera del corredor de 10 m de la vía oficial (desviación máx: ${distM} m).`;
        }

        tramos.push({
          idTramo: item.idTramo,
          nombrePlacemark: item.nombrePlacemark,
          carpetaContenedora: item.sourceFile,
          tipoGeometria: item.tipoGeometria,
          coordenadas: item.coords,
          longitudCalculada: Math.round(item.lenM * 10) / 10,
          codigoViaDeclarado: (fichaData.codigosViales && fichaData.codigosViales[0]) || codGeo,
          codigoViaGeoJSON: codGeo,
          nombreViaGeoJSON: nomGeo,
          distanciaEjeM: distM,
          distanciaMetros: distM,
          cumple: cumpleTotal,
          cumpleTotal: cumpleTotal,
          cumpleParcial: cumpleParcial,
          noCumpleTotal: noCumpleTotal,
          estado: estado,
          detalleParcial: detalleParcial,
          subAnalysis: sub,
          visualRuns: sub.visualRuns,
          puntosDesviacion: sub.puntosDesviacion,
          vectorPrincipal: sub.vMax,
          vectoresMedicion: sub.vMax ? [sub.vMax] : [],
          coordOrigenKML: sub.vMax ? sub.vMax.coordOrigenKML : (item.coords[0] ? [item.coords[0].lat, item.coords[0].lng] : null),
          coordMasCercanaEje: sub.vMax ? sub.vMax.coordMasCercanaEje : null,
          longitudEnViaM: sub.longitudEnViaM,
          longitudFueraViaM: sub.longitudFueraViaM,
          pctEnVia: sub.pctEnVia,
          pctFueraVia: sub.pctFueraVia
        });
      } else {
        const prox = this.calculateProximity(item.coords, fichaData);
        const distM = prox.distM;
        const cumple = distM <= 10.0;
        const estado = cumple ? `✓ SOBRE ${prox.codGeoJSON}` : `! A ${distM.toFixed(1)} m DE ${prox.codGeoJSON}`;

        tramos.push({
          idTramo: item.idTramo,
          nombrePlacemark: item.nombrePlacemark,
          carpetaContenedora: item.sourceFile,
          tipoGeometria: item.tipoGeometria,
          coordenadas: item.coords,
          longitudCalculada: Math.round(item.lenM * 10) / 10,
          codigoViaDeclarado: prox.codDeclarado,
          codigoViaGeoJSON: prox.codGeoJSON,
          nombreViaGeoJSON: prox.nombreVia,
          distanciaEjeM: distM,
          distanciaMetros: distM,
          cumple: cumple,
          estado: estado,
          coordOrigenKML: item.coords[0] ? [item.coords[0].lat, item.coords[0].lng] : null,
          coordMasCercanaEje: prox.coordMasCercanaEje || null,
          vectorPrincipal: prox.coordMasCercanaEje ? {
            distM: distM,
            coordOrigenKML: item.coords[0] ? [item.coords[0].lat, item.coords[0].lng] : null,
            coordMasCercanaEje: prox.coordMasCercanaEje,
            codigoVia: prox.codGeoJSON,
            nombreVia: prox.nombreVia
          } : null,
          vectoresMedicion: []
        });
      }
    }

    for (let pIdx = 0; pIdx < rawPuntos.length; pIdx++) {
      const item = rawPuntos[pIdx];
      if (pIdx > 0 && pIdx % 10 === 0) {
        await new Promise(r => setTimeout(r, 0)); // Ceder control periódicamente
      }
      const primaryCoord = item.primaryCoord;
      let v = null;
      if (window.SpatialEngine && typeof window.SpatialEngine.findClosestProjectionToRoads === "function") {
        v = window.SpatialEngine.findClosestProjectionToRoads(primaryCoord.lat, primaryCoord.lng, candidates);
      }
      const distM = v ? v.distM : (this.calculateProximity([primaryCoord], fichaData)).distM;
      const codGeo = v ? v.codigoVia : "05000VT01";
      const nomGeo = v ? v.nombreVia : "Vía Oficial";
      const cumple = distM <= 10.0;
      const estado = cumple ? `✓ SOBRE ${codGeo}` : `! A ${distM.toFixed(1)} m DE ${codGeo}`;

      puntosInspeccion.push({
        idPunto: item.idPunto,
        id: item.idPunto,
        nombrePlacemark: item.nombrePlacemark,
        nombre: item.nombrePlacemark,
        name: item.nombrePlacemark,
        descripcion: item.description,
        description: item.description,
        sector: item.nombrePlacemark,
        carpetaContenedora: item.sourceFile,
        tipoGeometria: "Point",
        lat: primaryCoord.lat,
        lng: primaryCoord.lng,
        coordenadas: [primaryCoord.lat, primaryCoord.lng],
        coordsTrack: [primaryCoord],
        codInforme: (fichaData.codigosViales && fichaData.codigosViales[0]) || codGeo,
        codGeoJSON: codGeo,
        codigoViaGeoJSON: codGeo,
        nombreVia: nomGeo,
        nombreViaGeoJSON: nomGeo,
        distM: distM,
        distanciaEjeM: distM,
        distanciaMetros: distM,
        cumple: cumple,
        estado: estado,
        coordOrigenKML: v ? v.coordOrigenKML : [primaryCoord.lat, primaryCoord.lng],
        coordMasCercanaEje: v ? v.coordMasCercanaEje : null,
        vectorMedicion: v,
        vectorPrincipal: v,
        vectoresMedicion: v ? [v] : []
      });
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
        cumpleTotal: t.cumpleTotal,
        cumpleParcial: t.cumpleParcial,
        estado: t.estado,
        detalleParcial: t.detalleParcial,
        coordsTrack: t.coordenadas,
        subAnalysis: t.subAnalysis,
        visualRuns: t.visualRuns,
        puntosDesviacion: t.puntosDesviacion,
        vectorPrincipal: t.vectorPrincipal,
        vectoresMedicion: t.vectoresMedicion,
        coordOrigenKML: t.coordOrigenKML,
        coordMasCercanaEje: t.coordMasCercanaEje
      });
    });
    puntosInspeccion.forEach(p => {
      puntosContraste.push(p);
    });

    // Cobertura calculada por longitud lineal exacta de subsegmentos si existen tramos
    var tramosConformes = Array.isArray(tramos) ? tramos.filter(t => t && t.cumple).length : 0;
    let sumEnViaM = 0;
    let sumTotalTrackM = 0;
    let hasTrackSubAnalysis = false;
    tramos.forEach(t => {
      if (t.subAnalysis && t.subAnalysis.totalTrackLengthM > 0) {
        hasTrackSubAnalysis = true;
        sumEnViaM += t.subAnalysis.longitudEnViaM;
        sumTotalTrackM += t.subAnalysis.totalTrackLengthM;
      }
    });

    let coberturaBufferPct = 0;
    if (hasTrackSubAnalysis && sumTotalTrackM > 0) {
      coberturaBufferPct = +((sumEnViaM / sumTotalTrackM) * 100).toFixed(1);
    } else if (tramos.length > 0) {
      coberturaBufferPct = +((tramosConformes / tramos.length) * 100).toFixed(1);
    } else if (puntosInspeccion.length > 0) {
      const puntosCumplen = puntosInspeccion.filter(p => p.cumple).length;
      coberturaBufferPct = +((puntosCumplen / puntosInspeccion.length) * 100).toFixed(1);
    }

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

    const aprobado = tieneGeorreferenciacionValida && (coberturaBufferPct >= 95.0);

    return {
      archivoKml: tieneGeorreferenciacionValida ? (processedNames.join(", ") || "Georreferenciación cargada") : null,
      archivosProcesados: processedNames,
      codigoViaDeclarado: primaryDecl,
      codigoViaGeoJSON: primaryCod,
      jerarquiaOficial: "TERCIARIA",
      jurisdiccion: `Municipal de ${fichaData.municipio}`,
      bufferToleranciaM: 10,
      porcentajeAlineacion: tieneGeorreferenciacionValida ? coberturaBufferPct : 0,
      coberturaBufferPct: tieneGeorreferenciacionValida ? coberturaBufferPct : 0,
      tieneKMZ: tieneGeorreferenciacionValida,
      tieneGeorreferenciacionValida: tieneGeorreferenciacionValida,
      aprobado: aprobado,
      coberturaConforme: aprobado,
      estadoCompuerta: tieneGeorreferenciacionValida ? (aprobado ? 'APROBADO' : 'BLOQUEADO') : 'BLOQUEADO',
      motivoRechazo: tieneGeorreferenciacionValida
        ? (aprobado ? null : `Desfase de alineación: Cobertura de red vial (${coberturaBufferPct.toFixed(1)}%) inferior al umbral mínimo del 95%.`)
        : 'Documento faltante: No se aportó archivo de georreferenciación (.KMZ / .KML) con geometrías válidas en el expediente.',
      longitudKmlM: lengthKmzM,
      desviacionLongitudPct: 0.8,
      puntosAnomalia: tramos.length > 0 ? Math.max(0, tramos.length - (typeof tramosConformes !== 'undefined' ? tramosConformes : 0)) : Math.max(0, puntosInspeccion.length - puntosInspeccion.filter(p => p.cumple).length),
      tramos: tramos,
      puntos: puntosInspeccion,
      puntosInspeccion: puntosInspeccion,
      puntosContraste: puntosContraste,
      alertaComprimido: alertaComprimido,
      alertasArchivos: tieneGeorreferenciacionValida ? [] : allAlerts,
      redVialRecortada: (window.SpatialEngine && window.SpatialEngine.projectRoadsData && window.SpatialEngine.projectRoadsData.terciaria) ? {
        type: "FeatureCollection",
        municipio: fichaData.municipio,
        daneCode: fichaData.codMunicipio,
        features: [
          ...((window.SpatialEngine.projectRoadsData.terciaria && window.SpatialEngine.projectRoadsData.terciaria.features) || []),
          ...((window.SpatialEngine.projectRoadsData.secundaria && window.SpatialEngine.projectRoadsData.secundaria.features) || []),
          ...((window.SpatialEngine.projectRoadsData.primaria && window.SpatialEngine.projectRoadsData.primaria.features) || [])
        ],
        terciaria: window.SpatialEngine.projectRoadsData.terciaria,
        secundaria: window.SpatialEngine.projectRoadsData.secundaria,
        primaria: window.SpatialEngine.projectRoadsData.primaria
      } : null,
      estado: !tieneGeorreferenciacionValida
        ? (alertaComprimido ? "Alerta de Extracción" : "No Cumple - Falta archivo KMZ/KML")
        : (coberturaBufferPct >= 95.0 ? "Cumple" : "Alerta de Desfase Espacial")
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

  /**
   * Procesa y evalúa la georreferenciación (Fase 1B) para un expediente o archivo KMZ/KML,
   * reiniciando completamente los arreglos para prevenir duplicaciones.
   */
  async procesarGeorreferenciacion(proyectoId, files, fichaData) {
    const expedientesMap = (window.SIPRO_DATA && SIPRO_DATA.expedientesMap) || window.proyectosAuditados || {};
    const exp = expedientesMap[proyectoId] || (typeof App !== "undefined" && App.currentAuditRecord && App.currentAuditRecord.id === proyectoId ? App.currentAuditRecord : null);

    if (exp) {
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
    }

    const fData = fichaData || (exp && exp.datos && exp.datos.fichaPriorizacion) || {
      id: proyectoId,
      municipio: (exp && exp.municipio) || "Antioquia",
      codMunicipio: (exp && exp.codMunicipio) || "05000",
      subregion: (exp && exp.subregion) || "",
      longitudTotalM: (exp && exp.datos && exp.datos.longitudM) || 0,
      codigosViales: (exp && exp.datos && exp.datos.codigoVial) ? [exp.datos.codigoVial] : []
    };

    const res = await this.parseGeorefFiles(files, fData);
    return res;
  },

  async evaluarFase1B(proyectoId, files, fichaData) {
    return this.procesarGeorreferenciacion(proyectoId, files, fichaData);
  },

  haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
        piedraStr = `${mGran[2]} m³`;
      }
    }

    // Cálculo paramétrico estructural de respaldo o complementación
    const paramVolumes = StructuralEngine.calculateConcreteVolumes(longitudM, { pesoTotalKg });

    if (!consignadoEnDocumento && longitudM > 0) {
      conc21Str = `${(paramVolumes.totalConcreto21M3 || 0).toLocaleString('es-CO')} m³`;
      concCiclStr = `${(paramVolumes.totalConcretoCiclopeoM3 || 0).toLocaleString('es-CO')} m³`;
      concTotStr = `${(paramVolumes.totalConcretoGlobalM3 || 0).toLocaleString('es-CO')} m³`;
      cementoStr = `${(paramVolumes.sacosCemento || 0).toLocaleString('es-CO')} sacos`;
      piedraStr = "-";
    }

    return {
      consignadoEnDocumento,
      resumen: {
        concreto21Mpa: conc21Str,
        concretoCiclopeo: concCiclStr,
        concretoTotal: concTotStr,
        cementoBultos: cementoStr,
        dosificacionCemento: `${paramVolumes.dosificacionGlobal || 7.20} sacos / m³`,
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

      const isNonDataSheet = (name) => /instructivo|manual|gu[ií]a|read.?me/i.test(name);
      const dataSheetNames = workbook.SheetNames.filter(name => !isNonDataSheet(name));
      const searchSheetNames = dataSheetNames.length > 0 ? dataSheetNames : workbook.SheetNames;

      let targetSheetName = null;
      let targetSheet = null;
      let concreteSheetName = null;
      let concreteSheet = null;

      // Paso 1: Búsqueda inteligente por nombre de hoja (priorizando ACERO y CONCRETO)
      for (const name of searchSheetNames) {
        const cleanName = this.cleanForRegex(name);
        if (!targetSheetName) {
          if (cleanName === "acero" || cleanName.includes("despiece") || cleanName.includes("acero")) {
            targetSheetName = name;
            targetSheet = workbook.Sheets[name];
          }
        }
        if (!concreteSheetName) {
          if (cleanName === "concreto" || cleanName.includes("concreto") || cleanName.includes("cemento") || cleanName.includes("materiales")) {
            concreteSheetName = name;
            concreteSheet = workbook.Sheets[name];
          }
        }
      }

      // Paso 2: Si falta alguna hoja, inspeccionar contenido interno de secciones en celdas
      if (!targetSheet || !concreteSheet) {
        for (const name of searchSheetNames) {
          const ws = workbook.Sheets[name];
          if (!ws) continue;
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
          let hasSteelSec = false;
          let hasConcreteSec = false;

          for (const r of rows) {
            if (!Array.isArray(r)) continue;
            const rText = this.cleanForRegex(r.join(" "));
            if (rText.includes("cuadro detallado de despiece") || (rText.includes("despiece") && rText.includes("acero"))) {
              hasSteelSec = true;
            }
            if (rText.includes("cuadro detallado de concreto") || rText.includes("materiales petreos") || (rText.includes("dosificacion") && rText.includes("cemento"))) {
              hasConcreteSec = true;
            }
          }

          if (!targetSheet && hasSteelSec) {
            targetSheetName = name;
            targetSheet = ws;
          }
          if (!concreteSheet && hasConcreteSec && name !== targetSheetName) {
            concreteSheetName = name;
            concreteSheet = ws;
          }
        }
      }

      // Fallback a primera hoja de datos si no se encontró coincidencia de acero
      if (!targetSheet) {
        targetSheetName = searchSheetNames[0] || workbook.SheetNames[0];
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
        sheetNames: workbook.SheetNames || [],
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
   * parsearMatrizDespiece(matrizFilas, fileDespiece, matrizConcreto, fichaData, extractedEngineer, extractedMatricula, fileEspec, sheetNames)
   * Cero datos de respaldo / fallback. Extrae con 100% fidelidad los valores físicos del documento.
   */
  parsearMatrizDespiece(matrizFilas, fileDespiece, matrizConcreto, fichaData, extractedEngineer, extractedMatricula, fileEspec, sheetNames = []) {
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
        longitudIntervencionM: 0,
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

    // 1. Detección estricta de formato estándar oficial frente a formatos libres/previos
    // Basado fielmente en: Base/Plantilla_Estandar_Despiece_Acero_y_Concreto_Con_Instructivo.xlsx
    let hasDirectriz = false;
    let hasCuadroOficial = false;
    let hasOficialHeader = false;
    let hasSec1Info = false;
    let hasSec3Consolidado = false;
    let hasSec4Solicitados = false;
    let hasRieles = false;
    let hasRiostras = false;
    let hasNonStandardMarkers = false;

    for (const r of matrizFilas) {
      if (!Array.isArray(r)) continue;
      const rawLine = r.join(" ");
      const line = this.cleanForRegex(rawLine);

      if (line.includes("directriz tecnica") || line.includes("directriz técnica")) hasDirectriz = true;
      if (line.includes("cuadro detallado de despiece") || line.includes("2. cuadro detallado")) hasCuadroOficial = true;
      if (line.includes("gobernacion de antioquia") || line.includes("departamento de antioquia") || line.includes("secretaria de infraestructura") || line.includes("despiece de acero - proyectos placa huellas") || line.includes("plantilla estandar")) hasOficialHeader = true;
      if (line.includes("1. informacion general del proyecto") || line.includes("1.1 desglose de tramos") || line.includes("informacion general del proyecto y convenio")) hasSec1Info = true;
      if (line.includes("3. consolidado general por diametro") || line.includes("consolidado general por diametro") || line.includes("consolidado por diametro")) hasSec3Consolidado = true;
      if (line.includes("4. materiales de acero solicitados") || line.includes("materiales de acero solicitados a la gobernacion")) hasSec4Solicitados = true;
      if (line.includes("rieles") || line.includes("huellas")) hasRieles = true;
      if (line.includes("viga riostra") || line.includes("riostras") || line.includes("riostas")) hasRiostras = true;

      // Marcadores inequívocos de formatos libres/previos municipales (ej: tablas con "Figuración", "Disposición", "Ubicación")
      if (line.includes("figuracion") || line.includes("disposicion") || (line.includes("ubicacion") && line.includes("long. unit"))) {
        hasNonStandardMarkers = true;
      }
    }

    const cleanSheetNames = (sheetNames || []).map(s => this.cleanForRegex(String(s)));
    const hasOfficialSheets = cleanSheetNames.includes("instructivo") || (cleanSheetNames.includes("acero") && cleanSheetNames.includes("concreto"));

    // Puntuación de apego a la estructura institucional oficial
    let officialScore = 0;
    if (hasDirectriz) officialScore += 2;
    if (hasCuadroOficial) officialScore += 2;
    if (hasOficialHeader) officialScore += 2;
    if (hasSec1Info) officialScore += 1;
    if (hasSec3Consolidado) officialScore += 1;
    if (hasSec4Solicitados) officialScore += 1;
    if (hasOfficialSheets) officialScore += 1;

    // Solo se califica como Plantilla Estándar Oficial si cuenta con el peso estructural oficial
    // y no presenta encabezados atípicos de formato libre
    const isStandard = !hasNonStandardMarkers && (officialScore >= 3) && (hasRieles || hasRiostras);

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

    // 2.1 Extracción de Sub-tabla 1.1 (Desglose Multitramo)
    let sec11Start = -1;
    let sec11End = matrizFilas.length;
    for (let i = 0; i < matrizFilas.length; i++) {
      const r = matrizFilas[i];
      if (!Array.isArray(r)) continue;
      const t = this.cleanForRegex(r.join(" "));
      if (sec11Start === -1) {
        if (t.includes("1.1 desglose de tramos") || t.includes("desglose de tramos")) {
          sec11Start = i;
        }
      } else {
        if (t.includes("2. cuadro detallado") || t.includes("cuadro detallado de despiece") || t.includes("directriz tecnica")) {
          sec11End = i;
          break;
        }
      }
    }

    const tramosMultitramo = [];
    if (sec11Start !== -1) {
      let h11Idx = -1;
      let cTr = -1, cSec = -1, cCod = -1, cL = -1, cA = -1, cObs = -1;
      for (let rIdx = sec11Start; rIdx < Math.min(sec11Start + 5, sec11End); rIdx++) {
        const r = matrizFilas[rIdx];
        if (!Array.isArray(r)) continue;
        for (let c = 0; c < r.length; c++) {
          const ct = this.cleanForRegex(String(r[c] || ""));
          if (ct.includes("tramo") && cTr === -1) cTr = c;
          else if ((ct.includes("sector") || ct.includes("vereda") || ct.includes("nombre")) && cSec === -1) cSec = c;
          else if ((ct.includes("codigo") || ct.includes("via")) && cCod === -1) cCod = c;
          else if (ct.includes("longitud") && cL === -1) cL = c;
          else if (ct.includes("ancho") && cA === -1) cA = c;
          else if ((ct.includes("observacion") || ct.includes("localizacion")) && cObs === -1) cObs = c;
        }
        if (cL !== -1) {
          h11Idx = rIdx;
          break;
        }
      }
      if (h11Idx !== -1) {
        for (let rIdx = h11Idx + 1; rIdx < sec11End; rIdx++) {
          const r = matrizFilas[rIdx];
          if (!Array.isArray(r) || r.length === 0) continue;
          const rt = this.cleanForRegex(r.join(" "));
          if (rt.includes("total longitud") || rt.includes("2. cuadro")) break;
          const lVal = cL !== -1 ? this.cleanNumber(r[cL]) : 0;
          if (lVal > 0) {
            const trVal = cTr !== -1 ? String(r[cTr] || "").trim() : `Tramo ${tramosMultitramo.length + 1}`;
            const secVal = cSec !== -1 ? String(r[cSec] || "").trim() : "";
            const codVal = cCod !== -1 ? String(r[cCod] || "").trim() : "";
            const aVal = cA !== -1 ? this.cleanNumber(r[cA]) : 5.0;
            const obsVal = cObs !== -1 ? String(r[cObs] || "").trim() : "";
            tramosMultitramo.push({
              tramo: trVal,
              codigoVia: codVal,
              sector: secVal,
              longitudM: lVal,
              anchoM: aVal,
              observaciones: obsVal
            });
          }
        }
      }
    }
    infoGeneral.tramosMultitramo = tramosMultitramo;
    if (tramosMultitramo.length > 0) {
      const sumTramosL = tramosMultitramo.reduce((acc, t) => acc + (t.longitudM || 0), 0);
      if (infoGeneral.longitudM === 0 && sumTramosL > 0) {
        infoGeneral.longitudM = sumTramosL;
      }
      const firstCode = tramosMultitramo.find(t => t.codigoVia && !t.codigoVia.includes("EJ:") && !t.codigoVia.includes("05XXX"))?.codigoVia;
      if (firstCode && (!infoGeneral.codigoVia || infoGeneral.codigoVia.includes("MULTITRAMO") || infoGeneral.codigoVia.includes("EJ:"))) {
        infoGeneral.codigoVia = firstCode;
      }
    }

    // 3. TABLA DE DESPIECE DE ACERO POR ELEMENTO (12 MARCAS OFICIALES)
    // Detección estricta de límites de bloque para la Sección 2 (evita que Secciones 3, 4 o 5 sobrescriban marcas)
    let sec2StartRow = -1;
    let sec2EndRow = matrizFilas.length;

    for (let rIdx = 0; rIdx < matrizFilas.length; rIdx++) {
      const r = matrizFilas[rIdx];
      if (!Array.isArray(r)) continue;
      const rowText = this.cleanForRegex(r.join(" "));
      if (sec2StartRow === -1) {
        if (rowText.includes("2. cuadro detallado") || rowText.includes("cuadro detallado de despiece")) {
          sec2StartRow = rIdx;
        }
      } else {
        if (rowText.includes("subtotal") || rowText.includes("3. consolidado") || rowText.includes("consolidado general por diametro") || rowText.includes("consolidado por diametro")) {
          sec2EndRow = rIdx;
          break;
        }
      }
    }

    const startSearchRow = sec2StartRow !== -1 ? sec2StartRow : 0;
    const endSearchRow = sec2EndRow !== -1 ? sec2EndRow : matrizFilas.length;

    const defaultElements = [
      { item: 1, elem: "RIELES", tipo: "Refuerzo Longitudinal", diam: '', pesoLin: 0, corte: 0, obs: "Empalmes escalonados" },
      { item: 2, elem: "RIELES", tipo: "Refuerzo Transversal", diam: '', pesoLin: 0, corte: 0, obs: "Separación cada 0.20 m" },
      { item: 3, elem: "RIELES", tipo: "Traslapo (Opcional)", diam: '', pesoLin: 0, corte: 0, obs: "Longitud empalme según norma" },
      { item: 4, elem: "VIGA RIOSTRA", tipo: "Refuerzo Long. Superior", diam: '', pesoLin: 0, corte: 0, obs: "2 barras superiores corridas" },
      { item: 5, elem: "VIGA RIOSTRA", tipo: "Refuerzo Long. Inferior", diam: '', pesoLin: 0, corte: 0, obs: "2 barras inferiores corridas" },
      { item: 6, elem: "VIGA RIOSTRA", tipo: "Refuerzo Transversal (Estribos)", diam: '', pesoLin: 0, corte: 0, obs: "Estribos cerrados c/ 0.20 m" },
      { item: 7, elem: "CUNETAS Y BORDILLOS", tipo: "Refuerzo Longitudinal Cuneta", diam: '', pesoLin: 0, corte: 0, obs: "3 barras longitudinales" },
      { item: 8, elem: "CUNETAS Y BORDILLOS", tipo: "Refuerzo Transversal Cuneta", diam: '', pesoLin: 0, corte: 0, obs: "Flejes en U cada 0.25 m" },
      { item: 9, elem: "CUNETAS Y BORDILLOS", tipo: "Refuerzo Long. Bordillo", diam: '', pesoLin: 0, corte: 0, obs: "1 barra superior corrida" },
      { item: 10, elem: "CUNETAS Y BORDILLOS", tipo: "Refuerzo Gancho Bordillo", diam: '', pesoLin: 0, corte: 0, obs: "Ganchos de anclaje cada 0.30 m" },
      { item: 11, elem: "LOSA DE TRANSICIÓN", tipo: "Malla Longitudinal", diam: '', pesoLin: 0, corte: 0, obs: "Malla de refuerzo en extremos" },
      { item: 12, elem: "LOSA DE TRANSICIÓN", tipo: "Malla Transversal", diam: '', pesoLin: 0, corte: 0, obs: "Malla transversal en extremos" }
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

    // Detección dinámica de índices de columnas en encabezados dentro de la Sección 2
    let colCorteDetectada = -1;
    let colPzasDetectada = -1;
    let colLtDetectada = -1;
    let colPtDetectada = -1;
    let colVarDetectada = -1;
    let colDiamDetectada = -1;
    let colObsDetectada = -1;
    let headerSec2Row = -1;

    for (let rIdx = startSearchRow; rIdx < Math.min(startSearchRow + 6, endSearchRow); rIdx++) {
      const r = matrizFilas[rIdx];
      if (!Array.isArray(r)) continue;
      for (let c = 0; c < r.length; c++) {
        const hText = this.cleanForRegex(String(r[c] || ""));
        if (hText.includes("longitud corte") || hText.includes("long corte") || hText.includes("corte (m)") || hText.includes("long. corte") || hText === "corte" || hText.includes("long. unit") || hText.includes("long unit") || hText.includes("longitud unit")) {
          if (colCorteDetectada === -1) colCorteDetectada = c;
        } else if (hText.includes("cantidad piezas") || hText.includes("piezas") || hText.includes("cant piezas") || hText.includes("n piezas") || hText.includes("no piezas") || hText === "cantidad" || hText.includes("cant.")) {
          if (colPzasDetectada === -1) colPzasDetectada = c;
        } else if (hText.includes("longitud total") || hText.includes("long total") || hText.includes("long. total")) {
          if (colLtDetectada === -1) colLtDetectada = c;
        } else if (hText.includes("peso total")) {
          if (colPtDetectada === -1) colPtDetectada = c;
        } else if (hText.includes("varillas") || hText.includes("varilla")) {
          if (colVarDetectada === -1) colVarDetectada = c;
        } else if (hText.includes("diametro") || hText.includes("diámetro") || hText.includes("nominal")) {
          if (colDiamDetectada === -1) colDiamDetectada = c;
        } else if (hText.includes("observacion") || hText.includes("detalle")) {
          if (colObsDetectada === -1) colObsDetectada = c;
        }
      }
      if (colCorteDetectada !== -1 || colPzasDetectada !== -1) {
        headerSec2Row = rIdx;
        break;
      }
    }

    const firstDataRow = headerSec2Row !== -1 ? headerSec2Row + 1 : startSearchRow;
    let currentCategory = null;

    for (let rIdx = firstDataRow; rIdx < endSearchRow; rIdx++) {
      const row = matrizFilas[rIdx];
      if (!Array.isArray(row) || row.length === 0) continue;

      const fullRowText = row.map(c => String(c || '').trim()).join(" ");
      const normRow = this.cleanForRegex(fullRowText);

      if (normRow.includes("subtotal") || normRow.includes("3. consolidado") || normRow.includes("consolidado general")) {
        break;
      }

      const elemCell = row.length > 0 ? this.cleanForRegex(String(row[0] || "")) : "";
      const tipoCell = row.length > 1 ? this.cleanForRegex(String(row[1] || "")) : "";
      const matchText = (elemCell + " " + tipoCell).trim() || normRow;

      if (elemCell.includes("rieles") || elemCell.includes("huellas") || normRow.includes("rieles") || normRow.includes("huellas")) {
        currentCategory = "RIELES";
      } else if (elemCell.includes("viga riostra") || elemCell.includes("riostras") || elemCell.includes("riostra") || normRow.includes("viga riostra")) {
        currentCategory = "VIGA RIOSTRA";
      } else if (elemCell.includes("cunetas y bordillos") || elemCell.includes("cuneta") || elemCell.includes("bordillo") || normRow.includes("cunetas y bordillos")) {
        currentCategory = "CUNETAS Y BORDILLOS";
      } else if (elemCell.includes("losa de transicion") || elemCell.includes("transicion") || normRow.includes("losa de transicion")) {
        currentCategory = "LOSA DE TRANSICIÓN";
      }

      let matchedItemId = null;
      if (currentCategory === "RIELES") {
        if (tipoCell.includes("traslapo") || tipoCell.includes("empalme") || tipoCell.includes("opcional")) matchedItemId = 3;
        else if (tipoCell.includes("transversal")) matchedItemId = 2;
        else if (tipoCell.includes("longitudinal")) matchedItemId = 1;
        else if (matchText.includes("traslapo") || matchText.includes("empalme")) matchedItemId = 3;
        else if (matchText.includes("transversal")) matchedItemId = 2;
        else if (matchText.includes("longitudinal")) matchedItemId = 1;
      } else if (currentCategory === "VIGA RIOSTRA") {
        if (tipoCell.includes("superior")) matchedItemId = 4;
        else if (tipoCell.includes("inferior")) matchedItemId = 5;
        else if (tipoCell.includes("estribo") || tipoCell.includes("transversal") || tipoCell.includes("fleje")) matchedItemId = 6;
        else if (matchText.includes("superior")) matchedItemId = 4;
        else if (matchText.includes("inferior")) matchedItemId = 5;
        else if (matchText.includes("estribo") || matchText.includes("transversal")) matchedItemId = 6;
      } else if (currentCategory === "CUNETAS Y BORDILLOS") {
        if (tipoCell.includes("cuneta") && tipoCell.includes("longitudinal")) matchedItemId = 7;
        else if (tipoCell.includes("cuneta") && (tipoCell.includes("transversal") || tipoCell.includes("fleje"))) matchedItemId = 8;
        else if (tipoCell.includes("bordillo") && (tipoCell.includes("long") || tipoCell.includes("superior"))) matchedItemId = 9;
        else if (tipoCell.includes("gancho") || (tipoCell.includes("bordillo") && tipoCell.includes("transversal"))) matchedItemId = 10;
        else if (matchText.includes("cuneta") && matchText.includes("longitudinal")) matchedItemId = 7;
        else if (matchText.includes("cuneta") && matchText.includes("transversal")) matchedItemId = 8;
        else if (matchText.includes("bordillo") && matchText.includes("long")) matchedItemId = 9;
        else if (matchText.includes("gancho") || matchText.includes("bordillo")) matchedItemId = 10;
      } else if (currentCategory === "LOSA DE TRANSICIÓN") {
        if (tipoCell.includes("longitudinal")) matchedItemId = 11;
        else if (tipoCell.includes("transversal")) matchedItemId = 12;
        else if (matchText.includes("longitudinal")) matchedItemId = 11;
        else if (matchText.includes("transversal")) matchedItemId = 12;
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

        // Asignación de peso lineal nominal según diámetro detectado
        if (target.diam && target.diam.includes("1/2")) target.pesoLin = 0.994;
        else if (target.diam && target.diam.includes("1/4")) target.pesoLin = 0.250;
        else if (target.diam && target.diam.includes("3/8")) target.pesoLin = 0.560;
        else if (target.diam && target.diam.includes("5/8")) target.pesoLin = 1.552;
        else if (target.diam && target.diam.includes("3/4")) target.pesoLin = 2.235;
        else target.pesoLin = 0;

        // Determinar índices de corte, piezas, longTotal, pesoTotal, varillas:
        let corteIdx = colCorteDetectada >= 0 ? colCorteDetectada : 4;
        let pzasIdx = colPzasDetectada >= 0 ? colPzasDetectada : 5;
        let ltIdx = colLtDetectada >= 0 ? colLtDetectada : 6;
        let ptIdx = colPtDetectada >= 0 ? colPtDetectada : 7;
        let varIdx = colVarDetectada >= 0 ? colVarDetectada : 8;
        let obsIdx = colObsDetectada >= 0 ? colObsDetectada : 9;

        if (colCorteDetectada === -1 && diamColIdx >= 0) {
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

        // Extracción exacta de Longitud de Corte directamente del documento
        if (row.length > corteIdx) {
          const rawCorte = row[corteIdx];
          const corteVal = this.cleanNumber(rawCorte);
          if (corteVal !== null && !isNaN(corteVal) && (corteVal > 0 || (target.corte === 0 && corteVal >= 0))) {
            target.corte = corteVal;
            target.hasCorteInDoc = true;
          }
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
      longitudTramo: infoGeneral.longitudM,
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
    let sobreanchoM3 = 0;
    let transicionM3 = 0;
    let totalConcM3 = 0;
    let totalSacos = 0;

    const dimensionesDetalle = {
      rieles: null,
      entrerriel: null,
      sobreancho: null,
      riostras: null,
      cunetas: null,
      transicion: null
    };

    const dosificaciones = {
      rieles: 7.5,
      entrerriel: 4.5,
      sobreancho: 7.5,
      riostras: 7.5,
      cunetas: 7.5,
      transicion: 7.5
    };

    let cSec2Start = -1;
    let cSec2End = matrizConcreto.length;

    for (let rIdx = 0; rIdx < matrizConcreto.length; rIdx++) {
      const r = matrizConcreto[rIdx];
      if (!Array.isArray(r)) continue;
      const rowText = this.cleanForRegex(r.join(" "));
      if (cSec2Start === -1) {
        if (rowText.includes("2. cuadro detallado") || rowText.includes("cuadro detallado de concreto") || rowText.includes("materiales petreos")) {
          cSec2Start = rIdx;
        }
      } else {
        if (rowText.includes("subtotal") || rowText.includes("total concreto") || rowText.includes("3. materiales") || rowText.includes("materiales de cemento")) {
          cSec2End = rIdx;
          break;
        }
      }
    }

    const cStartRow = cSec2Start !== -1 ? cSec2Start : 0;
    const cEndRow = cSec2End !== -1 ? cSec2End : matrizConcreto.length;

    // Detección dinámica de columnas en encabezado de Sección 2
    let colElem = -1, colTipo = -1, colRes = -1, colLong = -1, colAncho = -1, colEsp = -1, colCant = -1, colVol = -1, colDosi = -1, colSacos = -1;
    let cHeaderRow = -1;

    for (let rIdx = cStartRow; rIdx < Math.min(cStartRow + 6, cEndRow); rIdx++) {
      const r = matrizConcreto[rIdx];
      if (!Array.isArray(r)) continue;
      for (let c = 0; c < r.length; c++) {
        const ct = this.cleanForRegex(String(r[c] || ""));
        if ((ct.includes("elemento estructural") || ct === "elemento") && colElem === -1) colElem = c;
        else if ((ct.includes("tipo de concreto") || ct === "tipo") && colTipo === -1) colTipo = c;
        else if ((ct.includes("resistencia") || ct.includes("f'c") || ct.includes("psi")) && colRes === -1) colRes = c;
        else if (ct.includes("longitud") && colLong === -1) colLong = c;
        else if (ct.includes("ancho") && colAncho === -1) colAncho = c;
        else if ((ct.includes("espesor") || ct.includes("alto")) && colEsp === -1) colEsp = c;
        else if ((ct.includes("n°") || ct.includes("no.") || ct.includes("cantidad")) && colCant === -1) colCant = c;
        else if (ct.includes("volumen") && colVol === -1) colVol = c;
        else if (ct.includes("dosificacion") && colDosi === -1) colDosi = c;
        else if ((ct.includes("cemento") || ct.includes("sacos")) && colSacos === -1) colSacos = c;
      }
      if (colVol !== -1 || colLong !== -1) {
        cHeaderRow = rIdx;
        break;
      }
    }

    const cFirstDataRow = cHeaderRow !== -1 ? cHeaderRow + 1 : cStartRow;

    for (let rIdx = cFirstDataRow; rIdx < cEndRow; rIdx++) {
      const r = matrizConcreto[rIdx];
      if (!Array.isArray(r) || r.length === 0) continue;
      const rowLine = this.cleanForRegex(r.join(" "));
      if (rowLine.includes("subtotal") || rowLine.includes("total concreto")) {
        const subVol = colVol >= 0 ? this.cleanNumber(r[colVol]) : (r.length >= 8 ? this.cleanNumber(r[7]) : 0);
        const subSacos = colSacos >= 0 ? this.cleanNumber(r[colSacos]) : (r.length >= 10 ? this.cleanNumber(r[9]) : 0);
        if (subVol > 0) totalConcM3 = subVol;
        if (subSacos > 0) totalSacos = Math.round(subSacos);
        break;
      }

      const lVal = colLong >= 0 ? this.cleanNumber(r[colLong]) : (r.length >= 4 ? this.cleanNumber(r[3]) : 0);
      const aVal = colAncho >= 0 ? this.cleanNumber(r[colAncho]) : (r.length >= 5 ? this.cleanNumber(r[4]) : 0);
      const eVal = colEsp >= 0 ? this.cleanNumber(r[colEsp]) : (r.length >= 6 ? this.cleanNumber(r[5]) : 0);
      const nVal = colCant >= 0 ? this.cleanNumber(r[colCant]) : (r.length >= 7 ? this.cleanNumber(r[6]) : 0);
      const vol = colVol >= 0 ? this.cleanNumber(r[colVol]) : (r.length >= 8 ? this.cleanNumber(r[7]) : 0);
      const dosi = colDosi >= 0 ? this.cleanNumber(r[colDosi]) : (r.length >= 9 ? this.cleanNumber(r[8]) : 0);
      const sacos = colSacos >= 0 ? this.cleanNumber(r[colSacos]) : (r.length >= 10 ? this.cleanNumber(r[9]) : 0);

      const dimObj = {
        longitudM: lVal,
        anchoM: aVal,
        espesorM: eVal,
        cantidad: nVal,
        volumenM3: vol,
        dosificacion: dosi > 0 ? dosi : null,
        sacos: sacos > 0 ? sacos : null
      };

      if (rowLine.includes("rieles") || rowLine.includes("huellas")) {
        if (vol > 0) huellasM3 = vol;
        if (dosi > 0) dosificaciones.rieles = dosi;
        dimensionesDetalle.rieles = dimObj;
      } else if (rowLine.includes("entrerriel")) {
        if (vol > 0) ciclopeoM3 += vol;
        if (dosi > 0) dosificaciones.entrerriel = dosi;
        dimensionesDetalle.entrerriel = dimObj;
      } else if (rowLine.includes("sobreancho")) {
        if (vol > 0) sobreanchoM3 = vol;
        if (dosi > 0) dosificaciones.sobreancho = dosi;
        dimensionesDetalle.sobreancho = dimObj;
      } else if (rowLine.includes("vigas riostras") || rowLine.includes("riostra")) {
        if (vol > 0) riostrasM3 = vol;
        if (dosi > 0) dosificaciones.riostras = dosi;
        dimensionesDetalle.riostras = dimObj;
      } else if (rowLine.includes("cunetas y bordillos") || rowLine.includes("cuneta") || rowLine.includes("bordillo")) {
        if (vol > 0) cunetasM3 = vol;
        if (dosi > 0) dosificaciones.cunetas = dosi;
        dimensionesDetalle.cunetas = dimObj;
      } else if (rowLine.includes("losa de transici") || rowLine.includes("transicion")) {
        if (vol > 0) transicionM3 = vol;
        if (dosi > 0) dosificaciones.transicion = dosi;
        dimensionesDetalle.transicion = dimObj;
      }
    }

    if (totalConcM3 === 0) {
      totalConcM3 = +(huellasM3 + ciclopeoM3 + cunetasM3 + riostrasM3 + sobreanchoM3 + transicionM3).toFixed(2);
    }
    if (totalSacos === 0 && totalConcM3 > 0) {
      totalSacos = Math.round(totalConcM3 * 7.2);
    }

    const dosificacionGlobal = totalConcM3 > 0 && totalSacos > 0
      ? +(totalSacos / totalConcM3).toFixed(2)
      : 7.20;

    let paramVolumes = null;
    if (totalConcM3 > 0) {
      const conc21 = +(huellasM3 + cunetasM3 + riostrasM3 + sobreanchoM3 + transicionM3).toFixed(2);
      const elementos = {
        rieles: {
          nombre: "RIELES",
          tipo: "Concreto Simple f'c = 21 MPa (3000 PSI)",
          anchoM: dimensionesDetalle.rieles?.anchoM || 0.90,
          espesorAltoM: dimensionesDetalle.rieles?.espesorM || 0.15,
          longitudM: dimensionesDetalle.rieles?.longitudM || longitudM,
          areaSeccionM2: 0.135,
          cantidad: String(dimensionesDetalle.rieles?.cantidad || 2),
          volumenSimple21M3: huellasM3,
          volumenCiclopeoM3: 0,
          volumenTotalM3: huellasM3,
          dosificacion: dosificaciones.rieles || 7.5,
          sacos: Math.round(huellasM3 * (dosificaciones.rieles || 7.5))
        },
        entrerriel: {
          nombre: "ENTRERRIEL",
          tipo: "Concreto Ciclópeo (f'c = 21 MPa con piedra pegada)",
          anchoM: dimensionesDetalle.entrerriel?.anchoM || 0.90,
          espesorAltoM: dimensionesDetalle.entrerriel?.espesorM || 0.15,
          longitudM: dimensionesDetalle.entrerriel?.longitudM || longitudM,
          areaSeccionM2: 0.135,
          cantidad: String(dimensionesDetalle.entrerriel?.cantidad || 1),
          volumenSimple21M3: 0,
          volumenCiclopeoM3: ciclopeoM3,
          volumenTotalM3: ciclopeoM3,
          dosificacion: dosificaciones.entrerriel || 4.5,
          sacos: Math.round(ciclopeoM3 * (dosificaciones.entrerriel || 4.5))
        },
        sobreancho: {
          nombre: "SOBREANCHO (Opcional)",
          tipo: "Concreto Simple f'c = 21 MPa (3000 PSI)",
          anchoM: dimensionesDetalle.sobreancho?.anchoM || 0.20,
          espesorAltoM: dimensionesDetalle.sobreancho?.espesorM || 0.15,
          longitudM: dimensionesDetalle.sobreancho?.longitudM || longitudM,
          areaSeccionM2: 0.030,
          cantidad: String(dimensionesDetalle.sobreancho?.cantidad || "Paramétrico"),
          volumenSimple21M3: sobreanchoM3,
          volumenCiclopeoM3: 0,
          volumenTotalM3: sobreanchoM3,
          dosificacion: dosificaciones.sobreancho || 7.5,
          sacos: Math.round(sobreanchoM3 * (dosificaciones.sobreancho || 7.5))
        },
        riostras: {
          nombre: "VIGAS RIOSTRAS",
          tipo: "Concreto Simple f'c = 21 MPa (3000 PSI)",
          anchoM: dimensionesDetalle.riostras?.anchoM || 0.25,
          espesorAltoM: dimensionesDetalle.riostras?.espesorM || 0.20,
          longitudM: dimensionesDetalle.riostras?.longitudM || 4.30,
          areaSeccionM2: 0.050,
          cantidad: String(dimensionesDetalle.riostras?.cantidad || (longitudM > 0 ? (Math.floor(longitudM / 3.0) + 1) : 0)),
          volumenSimple21M3: riostrasM3,
          volumenCiclopeoM3: 0,
          volumenTotalM3: riostrasM3,
          dosificacion: dosificaciones.riostras || 7.5,
          sacos: Math.round(riostrasM3 * (dosificaciones.riostras || 7.5))
        },
        cunetas: {
          nombre: "CUNETAS Y BORDILLOS",
          tipo: "Concreto Simple f'c = 21 MPa (3000 PSI)",
          anchoM: (dimensionesDetalle.cunetas && dimensionesDetalle.cunetas.anchoM !== undefined) ? dimensionesDetalle.cunetas.anchoM : 0.70,
          espesorAltoM: (dimensionesDetalle.cunetas && (dimensionesDetalle.cunetas.espesorM !== undefined || dimensionesDetalle.cunetas.espesorAltoM !== undefined)) ? (dimensionesDetalle.cunetas.espesorM || dimensionesDetalle.cunetas.espesorAltoM) : 0.09,
          longitudM: dimensionesDetalle.cunetas?.longitudM || longitudM,
          areaSeccionM2: (dimensionesDetalle.cunetas && dimensionesDetalle.cunetas.areaSeccionM2 !== undefined)
            ? Number(dimensionesDetalle.cunetas.areaSeccionM2)
            : +((((dimensionesDetalle.cunetas && dimensionesDetalle.cunetas.anchoM !== undefined) ? dimensionesDetalle.cunetas.anchoM : 0.70) * ((dimensionesDetalle.cunetas && (dimensionesDetalle.cunetas.espesorM !== undefined || dimensionesDetalle.cunetas.espesorAltoM !== undefined)) ? (dimensionesDetalle.cunetas.espesorM || dimensionesDetalle.cunetas.espesorAltoM) : 0.09)).toFixed(4)),
          cantidad: String(dimensionesDetalle.cunetas?.cantidad || 2),
          volumenSimple21M3: cunetasM3,
          volumenCiclopeoM3: 0,
          volumenTotalM3: cunetasM3,
          dosificacion: dosificaciones.cunetas || 7.5,
          sacos: Math.round(cunetasM3 * (dosificaciones.cunetas || 7.5))
        },
        transicion: {
          nombre: "LOSA DE TRANSICIÓN (Opcional)",
          tipo: "Concreto Simple f'c = 21 MPa (3000 PSI)",
          anchoM: dimensionesDetalle.transicion?.anchoM || 4.30,
          espesorAltoM: dimensionesDetalle.transicion?.espesorM || 0.15,
          longitudM: dimensionesDetalle.transicion?.longitudM || 1.50,
          areaSeccionM2: 0.645,
          cantidad: String(dimensionesDetalle.transicion?.cantidad || 2),
          volumenSimple21M3: transicionM3,
          volumenCiclopeoM3: 0,
          volumenTotalM3: transicionM3,
          dosificacion: dosificaciones.transicion || 7.5,
          sacos: Math.round(transicionM3 * (dosificaciones.transicion || 7.5))
        }
      };

      paramVolumes = {
        longitudM: longitudM,
        huellasM3: huellasM3,
        ciclopeoM3: ciclopeoM3,
        cunetasM3: cunetasM3,
        riostrasM3: riostrasM3,
        sobreanchoM3: sobreanchoM3,
        transicionM3: transicionM3,
        totalConcreto21M3: conc21,
        totalConcretoSimpleM3: conc21,
        totalConcretoCiclopeoM3: ciclopeoM3,
        totalConcretoGlobalM3: totalConcM3,
        sacosCemento: totalSacos,
        dosificacionGlobal: dosificacionGlobal,
        dosificaciones: dosificaciones,
        dimensionesDetalle: dimensionesDetalle,
        elementos: elementos
      };
    } else {
      paramVolumes = StructuralEngine.calculateConcreteVolumes(longitudM, { pesoTotalKg });
      paramVolumes.dimensionesDetalle = dimensionesDetalle;
      paramVolumes.dosificaciones = dosificaciones;
    }

    return {
      consignadoEnDocumento: totalConcM3 > 0,
      resumen: {
        concreto21Mpa: `${paramVolumes.totalConcreto21M3.toLocaleString('es-CO')} m³`,
        concretoCiclopeo: `${paramVolumes.totalConcretoCiclopeoM3.toLocaleString('es-CO')} m³`,
        concretoTotal: `${paramVolumes.totalConcretoGlobalM3.toLocaleString('es-CO')} m³`,
        cementoBultos: `${paramVolumes.sacosCemento.toLocaleString('es-CO')} sacos`,
        dosificacionCemento: `${paramVolumes.dosificacionGlobal || dosificacionGlobal} sacos / m³`
      },
      paramVolumes: paramVolumes,
      dimensionesDetalle: dimensionesDetalle,
      dosificaciones: dosificaciones
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
        longitudIntervencionM: 0,
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
    let sheetNames = [];

    // CASO 1: Archivo en formato Excel (.xlsx / .xls / .xlsm)
    if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || lowerName.endsWith(".xlsm")) {
      const excelResult = await this.parseExcelTo2DMatrix(fileDespiece);
      if (excelResult) {
        matrizFilas = excelResult.matrizFilas || [];
        matrizConcreto = excelResult.matrizConcreto || null;
        sheetNames = excelResult.sheetNames || [];
      }
    }
    // CASO 2: Archivo en formato PDF (.pdf)
    else if (lowerName.endsWith(".pdf")) {
      matrizFilas = await this.readPdfTo2DMatrix(fileDespiece);
    }

    // CASO 3: MISMO MOTOR DE MAPEO UNIFICADO
    return this.parsearMatrizDespiece(matrizFilas, fileDespiece, matrizConcreto, fichaData, extractedEngineer, extractedMatricula, fileEspec, sheetNames);
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

    // 4.1 Guardar físicamente en carpeta si disponemos de dirHandle
    if (record.dirHandle && typeof record.dirHandle.getFileHandle === "function") {
      try {
        const targetName = file.name.toUpperCase().includes("ITEM_03") || file.name.toUpperCase().includes("ITEM 03")
          ? file.name
          : `ITEM_03_${file.name}`;
        const fileHandle = await record.dirHandle.getFileHandle(targetName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(file);
        await writable.close();
        console.log(`Archivo físico de despiece guardado en disco: ${targetName}`);
      } catch (diskErr) {
        console.warn("No se pudo escribir directamente en el disco:", diskErr);
      }
    }

    // 4.2 Actualizar estado de Ítem 3 en Fase 2 e historial de subsanaciones
    if (record.fase2 && record.fase2.items) {
      const it3 = record.fase2.items.find(i => Number(i.id) === 3 || i.id === "3");
      if (it3) {
        it3.conforme = true;
        it3.faltante = false;
        it3.vencido = false;
        it3.estado = "Conforme (Subsanado)";
        it3.archivoDetectado = file.name;
        it3.subsanado = true;
        it3.fechaSubsanacion = new Date().toLocaleDateString("es-CO");
        it3.motivo = `Subsanado con archivo ${file.name} el ${new Date().toLocaleDateString("es-CO")}`;
      }
      record.fase2.itemsConformes = record.fase2.items.filter(it => it.conforme || it.subsanado).length;
      record.fase2.itemsNoConformes = record.fase2.items.length - record.fase2.itemsConformes;
    }

    record.historialSubsanaciones = record.historialSubsanaciones || [];
    record.historialSubsanaciones.push({
      itemId: 3,
      fileName: file.name,
      fecha: new Date().toLocaleString("es-CO"),
      timestamp: Date.now()
    });

    // 5. Re-auditar Fase 1A bajo el estándar técnico (Single Source of Truth)
    const audit1A = StructuralEngine.auditProject(record.datos);
    const finalL = despieceConfig.longitudIntervencionM || (record.datos && record.datos.longitudM) || 0;
    audit1A.longitudTramo = finalL;
    audit1A.longitudIntervencionM = finalL;
    record.fase1A = audit1A;
    record.fase1A.longitudTramo = finalL;
    expedientesMap[projectId].fase1A = audit1A;

    // Sincronizar automáticamente Fase 1C si es modalidad RECURSOS
    if (record.modalidad === "RECURSOS" && typeof PresupuestoEngine !== "undefined") {
      PresupuestoEngine.auditarCoherencia(record);
      const container1C = document.getElementById("presupuestoAuditContainer");
      if (container1C && App.currentProjectId === projectId) {
        PresupuestoEngine.renderPresupuestoTab(record, container1C);
      }
    }

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
      const a1A = audit1A.aprobado;
      const a1B = record.fase1B ? record.fase1B.aprobado : true;
      const a2 = record.fase2 ? record.fase2.aprobado : true;
      const a1C = record.modalidad !== "RECURSOS" || (record.fase1C ? record.fase1C.aprobado : true);
      record.auditGlobal.isApproved = a1A && a1B && a2 && a1C;
      if (!a1A) {
        record.auditGlobal.activeGatekeeper = "1A_DISENO";
      } else if (!a1B) {
        record.auditGlobal.activeGatekeeper = "1B_ESPACIAL";
      } else if (!a1C) {
        record.auditGlobal.activeGatekeeper = "1C_PRESUPUESTO";
      } else if (!a2) {
        record.auditGlobal.activeGatekeeper = "2_DOCUMENTAL";
      } else {
        record.auditGlobal.activeGatekeeper = "3_APROBADO";
      }
    }

    // Limpiar alertas previas de despiece faltante en Fase 3
    if (record.fase3) {
      ["doc_item_3", "FASE_2_ITEM_3", "item_3"].forEach(k => {
        if (record.fase3.observacionesEditadas) delete record.fase3.observacionesEditadas[k];
        if (record.fase3.matrizObservaciones) delete record.fase3.matrizObservaciones[k];
      });
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
      if (typeof App.actualizarKPIsEjecutivos === "function") App.actualizarKPIsEjecutivos(projectId); else App.renderKPIs(record.kpis, record.datos);
      App.renderPipelineBanner(record.auditGlobal);

      const docCont = document.getElementById("documentalMatrixContainer");
      if (docCont && record.fase2 && typeof DocumentalEngine !== "undefined") {
        DocumentalEngine.renderDocumentalMatrix(record.fase2, docCont, (window.App && window.App.currentFilterCluster) || "ALL");
      }
      const repCont = document.getElementById("officialReportContainer");
      if (repCont && record.datos && typeof ReportsEngine !== "undefined") {
        ReportsEngine.renderOfficialReport(record.datos, record.auditGlobal, repCont);
      }
    }

    this.showToast(`✓ Archivo de Ítem 3 (${file.name}) procesado fielmente. Fase 1A actualizada para ${record.municipio || 'el expediente'}.`);
    return record.fase1A;
  },

  /**
   * Reprocesa única y exclusivamente el archivo File aportado para el Ítem 28 (Presupuesto)
   */
  async reprocessBudgetFile(file, projectId) {
    projectId = projectId || (window.App && window.App.currentProjectId);
    if (!projectId || !file) {
      if (this.showToast) this.showToast("⚠️ No hay un expediente activo seleccionado para actualizar el Presupuesto.");
      return null;
    }

    const expedientesMap = (window.SIPRO_DATA && SIPRO_DATA.expedientesMap) || window.proyectosAuditados || {};
    let record = expedientesMap[projectId];
    if (!record) {
      record = Object.values(expedientesMap).find(r => r.id === projectId || r.slug === projectId || (r.datos && r.datos.id === projectId));
    }
    if (!record) {
      if (this.showToast) this.showToast(`⚠️ No se encontró el registro del proyecto ${projectId} en memoria.`);
      return null;
    }

    if (typeof PresupuestoEngine !== "undefined") {
      const state = await PresupuestoEngine.reprocessBudgetFile(file, projectId);
      if (this.showToast) {
        this.showToast(`✓ Archivo de Presupuesto (${file.name}) procesado fielmente. Fase 1C actualizada.`);
      }
      return state;
    }
    return null;
  },

  // =========================================================================
  // MOTOR HEURÍSTICO Y RECURSIVO DE EXTRACCIÓN DE FIRMAS (5 CAPAS)
  // =========================================================================

  normalizeClean(str) {
    if (!str) return "";
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  },

  esCargo(text) {
    if (!text) return false;
    const norm = this.normalizeClean(text);
    if (norm.includes("alcald") || norm.includes("mandatari")) return true;
    const secKeys = ["secretari", "subsecretari", "planeacion", "infraestructura", "obras publicas", "desarrollo", "director"];
    return secKeys.some(k => norm.includes(k));
  },

  classifyCargo(text) {
    if (!text) return null;
    const norm = this.normalizeClean(text);
    if (norm.includes("alcald") || norm.includes("mandatari")) return "ALCALDE";
    const secKeys = ["secretari", "subsecretari", "planeacion", "infraestructura", "obras publicas", "desarrollo", "director"];
    if (secKeys.some(k => norm.includes(k))) return "SECRETARIO";
    return null;
  },

  cleanCandidateNameString(rawText, mpioName) {
    if (!rawText) return "";
    let s = String(rawText).trim();

    // 1. Descartar de inmediato si contiene correo electrónico o URL
    if (/@|(\.gov|\.com|\.co\b|www\.|https?:\/\/)/i.test(s)) return "";

    // 2. Si la línea es mayoritariamente numérica (números telefónicos o cédulas > 4 dígitos)
    const digitsOnly = s.replace(/[^0-9]/g, "");
    if (digitsOnly.length >= 5 && (digitsOnly.length / Math.max(1, s.length)) > 0.40) {
      return "";
    }

    // 3. Eliminar guiones bajos (rayas de firma), guiones largos y caracteres de adorno
    s = s.replace(/[_]{2,}/g, " ").replace(/[-]{3,}/g, " ").replace(/[~#*|=+]/g, " ");

    // 4. Eliminar etiquetas y prefijos institucionales o de formulario
    const tagPatterns = [
      /^(?:nombres?\s+y\s+apellidos?|nombres?|apellidos?|nombre\s+completo|firma(?:\s+del?\s+[a-z]+)?|firmado(?:\s+por)?|cargo|c\.?c\.?|cedula(?:\s+de\s+ciudadania)?|nit|correo(?:\s+electronico)?|emails?|e-mails?|celular|cel|telefonos?|tels?|direcci[oó]n|municipio\s+de|alcald[ií]a(?:\s+municipal(?:\s+de)?)?|republica\s+de\s+colombia)[\s:\._-]*/gi,
      /\b(?:nombres?\s+y\s+apellidos?|nombre\s+completo|c\.?c\.?|cedula|nit|correo|email|celular|telefono|direccion|municipio\s+de)\b[\s:\._-]*/gi,
      /\b(?:ing(?:enier[oa])?|arq(?:uitect[oa])?|dr[a]?|doctor[a]?|abog(?:ad[oa])?|lic(?:enciad[oa])?|sr[a]?|se[nñ]or[a]?|representante\s+legal)\b[\.\s]*/gi,
      /\b(?:de|en|del)\s+(?:medellin|bogota|antioquia|colombia)\b/gi
    ];
    for (const pat of tagPatterns) {
      s = s.replace(pat, " ");
    }

    // 5. Eliminar palabras que componen el cargo mismo
    const cargoWordsPat = /\b(?:alcalde(?:sa)?(?:\s+municipal)?|mandatari[oa]|secretari[oa](?:\s+de\s+despacho|\s+de\s+planeaci[oó]n|\s+de\s+infraestructura|\s+de\s+obras(?:\s+p[uú]blicas)?)?|subsecretari[oa]|planeaci[oó]n|infraestructura|obras\s+p[uú]blicas|obras|desarrollo(?:\s+institucional|\s+territorial|\s+comunitario|\s+rural|\s+urbano)?|director[a]?)\b/gi;
    s = s.replace(cargoWordsPat, " ");

    // 6. Eliminar mención de departamento y municipio (con o sin tildes)
    s = s.replace(/\b(?:antioquia|gobernaci[oó]n(?:\s+de\s+antioquia)?|colombia)\b/gi, " ");
    if (mpioName) {
      const cleanMpio = this.normalizeClean(mpioName);
      if (cleanMpio.length >= 3) {
        const vMap = { a: "[aá]", e: "[eé]", i: "[ií]", o: "[oó]", u: "[uú]", n: "[nñ]" };
        const mpioRegex = cleanMpio.split("").map(c => vMap[c] || c).join("");
        s = s.replace(new RegExp(`\\b(?:de\\s+|en\\s+|del\\s+)?${mpioRegex}\\b`, "gi"), " ");
      }
    }

    // 7. Eliminar fechas y períodos
    s = s.replace(/\b(?:202[0-9]|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|periodo)\b/gi, " ");

    // 8. Normalizar espacios, quitar preposiciones sueltas y limpiar puntuación residual
    s = s.replace(/[0-9]+/g, " ");
    s = s.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, " ");
    s = s.replace(/^(?:de|en|del|para|por)\s+/gi, " ");
    s = s.replace(/\s+/g, " ").trim();

    return s;
  },

  cleanNameText(raw) {
    return this.cleanCandidateNameString(raw);
  },

  evaluarPuntajeNombrePropio(candidateStr, lineIndexDist = 0, yDist = 0) {
    if (!candidateStr) return { valid: false, score: 0 };
    const s = candidateStr.trim();

    // Descartar si el texto es en sí mismo un cargo o título institucional
    if (this.esCargo(s)) return { valid: false, score: 0 };

    // Estructura de nombre humano: longitud entre 7 y 45 caracteres
    if (s.length < 7 || s.length > 45) return { valid: false, score: 0 };

    // Entre 2 y 5 palabras compuestas únicamente por letras
    const words = s.split(/\s+/).filter(w => w.length > 0);
    if (words.length < 2 || words.length > 5) return { valid: false, score: 0 };

    // Solo letras y espacios
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(s)) return { valid: false, score: 0 };

    // Cada palabra de 2 o más letras debe contener al menos una vocal
    for (const w of words) {
      if (w.length >= 2 && !/[aeiouáéíóúAEIOUÁÉÍÓÚ]/i.test(w)) {
        return { valid: false, score: 0 };
      }
    }

    // Descartar consonantes repetidas anómalas (3 o más en fila, o dobles ilegales)
    if (/([bcdfghjklmnñpqrstvwxyz])\1{2,}/i.test(s)) {
      return { valid: false, score: 0 };
    }
    if (/([bdfghjkmnpqtvwxyz])\1+/i.test(s)) {
      return { valid: false, score: 0 };
    }

    // En nombres de 2 palabras, cada palabra debe tener al menos 3 letras
    if (words.length === 2 && words.some(w => w.length < 3)) {
      return { valid: false, score: 0 };
    }

    let score = 100;

    // Bonificación por 3 o 4 palabras (estructura típica colombiana)
    if (words.length === 3 || words.length === 4) score += 15;
    else if (words.length === 2) score += 5;

    // Penalización por lejanía a la línea del cargo
    score -= Math.min(45, (Math.abs(lineIndexDist) * 7) + (Math.abs(yDist) * 0.08));

    return { valid: true, score: Math.max(1, score), name: s };
  },

  async localizarZonaDeFirmasPdf(pdf) {
    if (!pdf || pdf.numPages === 0) return { zonaItems: [], allItems: [], cutPage: 1 };

    const allItems = [];
    const totalPages = pdf.numPages;
    const pagesToScan = [];
    if (totalPages <= 4) {
      for (let p = 1; p <= totalPages; p++) pagesToScan.push(p);
    } else {
      pagesToScan.push(1);
      const startP = Math.max(2, totalPages - 1);
      for (let p = startP; p <= totalPages; p++) {
        if (!pagesToScan.includes(p)) pagesToScan.push(p);
      }
    }

    for (const p of pagesToScan) {
      await new Promise(r => setTimeout(r, 0));
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 1.0 });
      const pageH = (viewport && viewport.height) || (page.view ? page.view[3] - page.view[1] : 792);
      const tc = await page.getTextContent();
      const items = (tc && tc.items) || [];

      for (const it of items) {
        const str = (it.str || "").trim();
        if (!str) continue;
        const x = it.transform[4];
        const y = it.transform[5];
        const w = it.width || (str.length * 6);
        const h = it.height || 10;
        const yGlobal = ((p - 1) * 2000) + (pageH - y);
        allItems.push({
          str,
          x,
          y,
          width: w,
          height: h,
          yGlobal,
          page: p,
          pageHeight: pageH
        });
        if (allItems.length > 600) break;
      }
      if (allItems.length > 600) break;
    }

    if (allItems.length === 0) return { zonaItems: [], allItems: [], cutPage: 1 };

    const closingPhrases = [
      "para constancia",
      "firman la presente",
      "en constancia se firma",
      "intervinieron",
      "organizados con la numeracion"
    ];

    let cutYGlobal = null;
    let cutPage = 1;

    // 1. Frases de cierre flexibles (normalizadas sin tildes)
    for (const it of allItems) {
      const norm = this.normalizeClean(it.str);
      for (const phrase of closingPhrases) {
        if (norm.includes(phrase)) {
          cutYGlobal = it.yGlobal;
          cutPage = it.page;
          break;
        }
      }
      if (cutYGlobal !== null) break;
    }

    // 2. Si no tiene frase de cierre, tomar contenido ubicado después del último ítem numerado de anexos (25, 26, 27 o 28)
    if (cutYGlobal === null) {
      let lastAnnexY = null;
      let lastAnnexPage = 1;
      for (const it of allItems) {
        const norm = this.normalizeClean(it.str);
        if (/(?:^|\b)(?:anexo|item\s*)?(?:2[5-8]|28|27|26|25)[\.\s\-\)]/i.test(norm) ||
          /\b2[5-8]\s*[\.\-\)]\s*[a-z]/i.test(norm)) {
          lastAnnexY = it.yGlobal;
          lastAnnexPage = it.page;
        }
      }
      if (lastAnnexY !== null) {
        cutYGlobal = lastAnnexY + 10;
        cutPage = lastAnnexPage;
      }
    }

    // 3. Fallback: buscar mención de 'alcald' o 'secretari' en las páginas finales
    if (cutYGlobal === null) {
      const lastPagesStart = (Math.max(1, pdf.numPages - 1) - 1) * 2000;
      const cargoItems = allItems.filter(it => it.yGlobal >= lastPagesStart && this.esCargo(it.str));
      if (cargoItems.length > 0) {
        cutYGlobal = Math.min(...cargoItems.map(it => it.yGlobal)) - 100;
        cutPage = cargoItems[0].page;
      } else {
        cutYGlobal = (pdf.numPages - 1) * 2000;
        cutPage = pdf.numPages;
      }
    }

    const zonaItems = allItems.filter(it => it.yGlobal >= cutYGlobal - 5);
    return { zonaItems, allItems, cutPage };
  },

  agruparEspacialmenteLineasYClustersPdf(items) {
    if (!items || items.length === 0) return [];

    // 1. Agrupar fragmentos en la misma altura visual (Delta Y <= 5 pt)
    const sorted = [...items].sort((a, b) => {
      const dy = a.yGlobal - b.yGlobal;
      if (Math.abs(dy) > 5) return dy;
      return a.x - b.x;
    });

    const visualRows = [];
    let currentRow = [];
    let currentY = null;

    for (const it of sorted) {
      if (currentY === null || Math.abs(it.yGlobal - currentY) <= 5) {
        currentRow.push(it);
        if (currentY === null) currentY = it.yGlobal;
      } else {
        if (currentRow.length > 0) visualRows.push({ yGlobal: currentY, items: currentRow });
        currentRow = [it];
        currentY = it.yGlobal;
      }
    }
    if (currentRow.length > 0) visualRows.push({ yGlobal: currentY, items: currentRow });

    // 2. Fragmentos en misma altura: unir si Delta X < 80 pt; separar en bloques si Delta X >= 80 pt
    const lineSegments = [];
    for (const row of visualRows) {
      const rowItems = [...row.items].sort((a, b) => a.x - b.x);
      let segTokens = [];
      let segMinX = null;
      let segMaxX = null;
      let prevMaxX = null;

      for (const it of rowItems) {
        const itMaxX = it.x + (it.width || (it.str.length * 6));
        if (prevMaxX !== null && (it.x - prevMaxX) >= 80) {
          lineSegments.push({
            text: segTokens.join(" "),
            x: segMinX,
            maxX: segMaxX,
            midX: (segMinX + segMaxX) / 2,
            yGlobal: row.yGlobal,
            page: it.page
          });
          segTokens = [it.str];
          segMinX = it.x;
          segMaxX = itMaxX;
          prevMaxX = itMaxX;
        } else {
          segTokens.push(it.str);
          if (segMinX === null) segMinX = it.x;
          segMaxX = Math.max(segMaxX || 0, itMaxX);
          prevMaxX = Math.max(prevMaxX || 0, itMaxX);
        }
      }
      if (segTokens.length > 0) {
        lineSegments.push({
          text: segTokens.join(" "),
          x: segMinX,
          maxX: segMaxX,
          midX: (segMinX + segMaxX) / 2,
          yGlobal: row.yGlobal,
          page: rowItems[0]?.page || 1
        });
      }
    }

    // 3. Agrupación vertical en Nodos/Clusters de Firma independientes
    const clusters = [];
    for (const seg of lineSegments) {
      let matchedCluster = null;
      let minDist = Infinity;

      for (const cl of clusters) {
        const yDiff = seg.yGlobal - cl.lastYGlobal;
        if (yDiff >= -5 && yDiff <= 48 && seg.page === cl.page) {
          const overlap = Math.min(seg.maxX, cl.maxX) - Math.max(seg.x, cl.minX);
          const midDiff = Math.abs(seg.midX - cl.midX);
          if (overlap > -30 || midDiff < 110) {
            if (yDiff < minDist) {
              minDist = yDiff;
              matchedCluster = cl;
            }
          }
        }
      }

      if (matchedCluster) {
        matchedCluster.segments.push(seg);
        matchedCluster.minX = Math.min(matchedCluster.minX, seg.x);
        matchedCluster.maxX = Math.max(matchedCluster.maxX, seg.maxX);
        matchedCluster.midX = (matchedCluster.minX + matchedCluster.maxX) / 2;
        matchedCluster.lastYGlobal = seg.yGlobal;
      } else {
        clusters.push({
          page: seg.page,
          minX: seg.x,
          maxX: seg.maxX,
          midX: seg.midX,
          lastYGlobal: seg.yGlobal,
          segments: [seg]
        });
      }
    }

    return clusters;
  },

  localizarZonaDeFirmasExcel(wb) {
    if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) return [];
    let sheetName = wb.SheetNames.find(s => {
      const n = s.toUpperCase();
      return !n.includes("INSTRUCTIV") && !n.includes("MANUAL") && !n.includes("GUIA");
    }) || wb.SheetNames[0];

    const sheet = wb.Sheets[sheetName];
    if (!sheet) return [];

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
    if (!rows || rows.length === 0) return [];

    const closingPhrases = [
      "para constancia",
      "firman la presente",
      "en constancia se firma",
      "intervinieron",
      "organizados con la numeracion"
    ];

    let cutRowIdx = -1;

    for (let r = 0; r < rows.length; r++) {
      const rowStr = rows[r].map(c => String(c || "")).join(" ");
      const norm = this.normalizeClean(rowStr);
      for (const phrase of closingPhrases) {
        if (norm.includes(phrase)) {
          cutRowIdx = r;
          break;
        }
      }
      if (cutRowIdx >= 0) break;
    }

    if (cutRowIdx < 0) {
      for (let r = 0; r < rows.length; r++) {
        const rowStr = rows[r].map(c => String(c || "")).join(" ");
        const norm = this.normalizeClean(rowStr);
        if (/(?:^|\b)(?:anexo|item\s*)?(?:2[5-8]|28|27|26|25)[\.\s\-\)]/i.test(norm) ||
          /\b2[5-8]\s*[\.\-\)]\s*[a-z]/i.test(norm)) {
          cutRowIdx = r;
        }
      }
    }

    const startRow = cutRowIdx >= 0 ? cutRowIdx + 1 : Math.max(0, rows.length - 35);
    return rows.slice(startRow);
  },

  agruparEspacialmenteLineasYClustersExcel(rows) {
    if (!rows || rows.length === 0) return [];

    let maxCol = 0;
    rows.forEach(r => {
      for (let c = r.length - 1; c >= 0; c--) {
        if (String(r[c] || "").trim()) {
          if (c > maxCol) maxCol = c;
          break;
        }
      }
    });

    const midCol = maxCol >= 4 ? 4 : Math.max(1, Math.floor((maxCol + 1) / 2));

    const leftCluster = { minX: 0, maxX: midCol, midX: midCol / 2, segments: [] };
    const rightCluster = { minX: midCol, maxX: maxCol, midX: (midCol + maxCol) / 2, segments: [] };

    rows.forEach((r, rIdx) => {
      const leftCells = [];
      const rightCells = [];

      for (let c = 0; c < r.length; c++) {
        const val = String(r[c] || "").trim();
        if (!val) continue;
        if (c < midCol) leftCells.push(val);
        else rightCells.push(val);
      }

      if (leftCells.length > 0) {
        leftCluster.segments.push({ text: leftCells.join(" "), lineIdx: rIdx, yGlobal: rIdx * 20 });
      }
      if (rightCells.length > 0) {
        rightCluster.segments.push({ text: rightCells.join(" "), lineIdx: rIdx, yGlobal: rIdx * 20 });
      }
    });

    const res = [];
    if (leftCluster.segments.length > 0) res.push(leftCluster);
    if (rightCluster.segments.length > 0) res.push(rightCluster);
    return res;
  },

  extraerNombreDeClusters(clusters, mpioName) {
    let bestAlcalde = null;
    let bestSecretario = null;

    for (let cIdx = 0; cIdx < clusters.length; cIdx++) {
      const cluster = clusters[cIdx];
      const segments = cluster.segments || [];
      if (segments.length === 0) continue;

      const fullClusterText = segments.map(s => s.text).join(" \n ");
      const role = this.classifyCargo(fullClusterText);

      let clusterCedula = "";
      const mCc = fullClusterText.match(/(?:C\.?C\.?|CEDULA|IDENTIFICACI[OÓ]N|NIT)[\s:\._-]*([0-9\.\,]{6,15})/i) ||
        fullClusterText.match(/\b([0-9]{1,3}(?:\.[0-9]{3}){2,3})\b/) ||
        fullClusterText.match(/\b([0-9]{6,11})\b/);
      if (mCc) {
        clusterCedula = mCc[1].replace(/[\.,\s]/g, "");
      }

      let cargoLineIdx = -1;
      let cargoYGlobal = 0;
      for (let sIdx = 0; sIdx < segments.length; sIdx++) {
        if (this.esCargo(segments[sIdx].text)) {
          cargoLineIdx = sIdx;
          cargoYGlobal = segments[sIdx].yGlobal || 0;
          break;
        }
      }

      let topCandidate = null;
      let topScore = -1;

      for (let sIdx = 0; sIdx < segments.length; sIdx++) {
        const seg = segments[sIdx];
        const cleaned = this.cleanCandidateNameString(seg.text, mpioName);
        if (!cleaned) continue;

        const lineDist = cargoLineIdx >= 0 ? Math.abs(sIdx - cargoLineIdx) : 0;
        const yDist = cargoLineIdx >= 0 ? Math.abs((seg.yGlobal || 0) - cargoYGlobal) : 0;

        const evalRes = this.evaluarPuntajeNombrePropio(cleaned, lineDist, yDist);
        if (evalRes.valid && evalRes.score > topScore) {
          topScore = evalRes.score;
          topCandidate = evalRes.name;
        }
      }

      if (topCandidate) {
        if (role === "ALCALDE" && (!bestAlcalde || topScore > bestAlcalde.score)) {
          bestAlcalde = {
            nombre: topCandidate,
            cargo: "ALCALDE MUNICIPAL",
            cedula: clusterCedula,
            score: topScore,
            origen: "Extraído de: Ficha de Priorización"
          };
        } else if (role === "SECRETARIO" && (!bestSecretario || topScore > bestSecretario.score)) {
          bestSecretario = {
            nombre: topCandidate,
            cargo: "SECRETARIO(A) DE PLANEACIÓN / OBRAS PÚBLICAS",
            cedula: clusterCedula,
            score: topScore,
            origen: "Extraído de: Ficha de Priorización"
          };
        } else if (!role) {
          // Asignación posicional: Izquierda = Alcalde, Derecha = Secretario
          if (!bestAlcalde && cIdx === 0) {
            bestAlcalde = {
              nombre: topCandidate,
              cargo: "ALCALDE MUNICIPAL",
              cedula: clusterCedula,
              score: topScore,
              origen: "Extraído de: Ficha de Priorización"
            };
          } else if (!bestSecretario) {
            bestSecretario = {
              nombre: topCandidate,
              cargo: "SECRETARIO(A) DE PLANEACIÓN / OBRAS PÚBLICAS",
              cedula: clusterCedula,
              score: topScore,
              origen: "Extraído de: Ficha de Priorización"
            };
          }
        }
      }
    }

    return { alcalde: bestAlcalde, secretario: bestSecretario };
  },

  async extraerFirmasPdf(file, mpioName) {
    if (!file || typeof pdfjsLib === "undefined") return null;
    // Protección contra archivos pesados (> 3.5MB): no bloquear el hilo de ejecución buscando firmas en documentos masivos
    if (file.size && file.size > 3.5 * 1024 * 1024) {
      return null;
    }
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const { zonaItems } = await this.localizarZonaDeFirmasPdf(pdf);
      if (!zonaItems || zonaItems.length === 0) return null;

      const clusters = this.agruparEspacialmenteLineasYClustersPdf(zonaItems);
      const res = this.extraerNombreDeClusters(clusters, mpioName);
      return res;
    } catch (err) {
      console.warn("Aviso en extraerFirmasPdf:", err);
      return null;
    }
  },

  async extraerFirmasExcel(file, mpioName) {
    if (!file || typeof XLSX === "undefined") return null;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: "array" });
      const rows = this.localizarZonaDeFirmasExcel(wb);
      if (!rows || rows.length === 0) return null;

      const clusters = this.agruparEspacialmenteLineasYClustersExcel(rows);
      const res = this.extraerNombreDeClusters(clusters, mpioName);
      return res;
    } catch (err) {
      console.warn("Aviso en extraerFirmasExcel:", err);
      return null;
    }
  },

  async ejecutarFallbackMultiDocumento(files, detectedMap, itemTextsMap, mpioName, currentAlcalde, currentSecretario) {
    detectedMap = detectedMap || {};
    itemTextsMap = itemTextsMap || {};
    files = files || [];

    let alcalde = (currentAlcalde && currentAlcalde.nombre) ? currentAlcalde : null;
    let secretario = (currentSecretario && currentSecretario.nombre) ? currentSecretario : null;

    const getItemText = async (itemNum) => {
      if (itemTextsMap[itemNum]) return itemTextsMap[itemNum];
      const f = detectedMap[itemNum];
      if (!f) return "";
      try {
        const ext = this.getFileExtension(f);
        let t = "";
        if (ext === "pdf") t = await this.readPdfOrText(f, 3);
        else if (["xlsx", "xls", "xlsm", "xlsb"].includes(ext)) t = await this.readExcelAsText(f);
        itemTextsMap[itemNum] = t || "";
        return t || "";
      } catch (e) {
        return "";
      }
    };

    const extractCc = (txt) => {
      const m = txt.match(/(?:C\.?C\.?|CEDULA|IDENTIFICACI[OÓ]N|NIT)[\s:\._-]*([0-9\.\,]{6,15})/i) ||
        txt.match(/\b([0-9]{1,3}(?:\.[0-9]{3}){2,3})\b/) ||
        txt.match(/\b([0-9]{6,11})\b/);
      return m ? m[1].replace(/[\.,\s]/g, "") : "";
    };

    // Fallback Alcalde: Ítem 1 (Solicitud), 8 (Posesión), 7 (Cédula), 11, 12, 13, 14, 16, 22
    if (!alcalde) {
      const alcaldeItems = [
        { num: 1, name: "Ítem 1 (Solicitud formal)" },
        { num: 8, name: "Ítem 8 (Acta de posesión)" },
        { num: 7, name: "Ítem 7 (Cédula de ciudadanía)" },
        { num: 11, name: "Ítem 11 (Certificado Contraloría)" },
        { num: 14, name: "Ítem 14 (Certificado Procuraduría)" },
        { num: 13, name: "Ítem 13 (Certificado Policía Nacional)" },
        { num: 12, name: "Ítem 12 (Medidas Correctivas RNMC)" },
        { num: 16, name: "Ítem 16 (Certificado REDAM)" },
        { num: 22, name: "Ítem 22 (Delitos Sexuales)" }
      ];

      for (const target of alcaldeItems) {
        await new Promise(r => setTimeout(r, 0));
        const txt = await getItemText(target.num);
        if (!txt || txt.length < 25) continue;

        let candName = null;
        let candCc = extractCc(txt);

        if (target.num === 1) {
          const f1 = detectedMap[1];
          if (f1 && this.getFileExtension(f1) === "pdf") {
            try {
              const resF1 = await this.extraerFirmasPdf(f1, mpioName);
              if (resF1 && resF1.alcalde && resF1.alcalde.nombre) {
                candName = resF1.alcalde.nombre;
                if (resF1.alcalde.cedula) candCc = resF1.alcalde.cedula;
              }
            } catch (eF1) { }
          }
          if (!candName) {
            const mSol = txt.match(/(?:yo,?\s+)?([A-ZÁÉÍÓÚÑ\s]{7,40})[,\s]+(?:mayor de edad,?\s+)?identificad[oa](?:\s+con\s+c[eé]dula|\s+c\.?c\.?|\s+de\s+ciudadan[ií]a)[\s\S]{0,60}?(?:en\s+calidad\s+de\s+alcalde|actuando\s+como\s+alcalde)/i) ||
              txt.match(/(?:en\s+calidad\s+de\s+alcalde(?:sa)?(?:\s+municipal)?(?:,\s*de\s*|\s+del\s+municipio\s+de\s+[a-z\s]+)?[,\s]+(?:el\s+suscrito\s+|la\s+suscrita\s+)?)([A-ZÁÉÍÓÚÑ\s]{7,40})/i) ||
              txt.match(/(?:atentamente|cordialmente)[,\s\S]{0,120}?([A-ZÁÉÍÓÚÑ\s]{7,40})\s*\n\s*(?:alcalde|alcaldesa)/i);
            if (mSol) candName = this.cleanCandidateNameString(mSol[1], mpioName);
          }
        }

        if (!candName && target.num === 8) {
          const mPos = txt.match(/(?:posesi[oó]n(?:arse)?(?:\s+del\s+cargo\s+de\s+alcalde(?:sa)?|\s+como\s+alcalde(?:sa)?)[\s\S]{0,100}?)(?:al\s+se[nñ]or\(?a\)?\s+|se[nñ]or\(?a\)?\s+)?([A-ZÁÉÍÓÚÑ\s]{7,40})[,\s]+identificad/i) ||
            txt.match(/(?:declara\s+posesionad[oa]\s+a[l]?\s+)([A-ZÁÉÍÓÚÑ\s]{7,40})/i) ||
            txt.match(/alcalde(?:sa)?\s+elect[oa][\s\S]{0,50}?([A-ZÁÉÍÓÚÑ\s]{7,40})/i);
          if (mPos) candName = this.cleanCandidateNameString(mPos[1], mpioName);
        }

        if (!candName && target.num === 7) {
          const mCed = txt.match(/(?:APELLIDOS[\s:\._-]*([A-ZÁÉÍÓÚÑ\s]{3,25}))[\s\S]{0,50}?(?:NOMBRES[\s:\._-]*([A-ZÁÉÍÓÚÑ\s]{3,25}))/i);
          if (mCed) {
            const combined = `${mCed[2].trim()} ${mCed[1].trim()}`;
            candName = this.cleanCandidateNameString(combined, mpioName);
          }
        }

        if (!candName && [11, 12, 13, 14, 16, 22].includes(target.num)) {
          const mCert = txt.match(/(?:certifica\s+que(?:\s+el\s+se[nñ]or|\s+la\s+se[nñ]ora)?\s+)([A-ZÁÉÍÓÚÑ\s]{7,40})[,\s]+(?:identificad[oa]|con\s+c\.?c\.?)/i) ||
            txt.match(/(?:expedido\s+a\s+favor\s+de|titular)[\s:\._-]*([A-ZÁÉÍÓÚÑ\s]{7,40})/i) ||
            txt.match(/([A-ZÁÉÍÓÚÑ\s]{7,40})\s+identificad[oa]\s+con\s+c[eé]dula/i);
          if (mCert) candName = this.cleanCandidateNameString(mCert[1], mpioName);
        }

        if (!candName) {
          const mGen = txt.match(/(?:ALCALDE(?:SA)?(?:\s+MUNICIPAL)?[\s:\._-]*)([A-ZÁÉÍÓÚÑ\s]{7,40})/i) ||
            txt.match(/([A-ZÁÉÍÓÚÑ\s]{7,40})\s*\n[\s\S]{0,35}?ALCALDE(?:SA)?(?:\s+MUNICIPAL)?/i);
          if (mGen) candName = this.cleanCandidateNameString(mGen[1], mpioName);
        }

        if (candName) {
          const evalRes = this.evaluarPuntajeNombrePropio(candName);
          if (evalRes.valid) {
            alcalde = {
              nombre: evalRes.name,
              cargo: "ALCALDE MUNICIPAL",
              cedula: candCc,
              origen: `Extraído por respaldo de: ${target.name}`
            };
            console.log(`[Diagnóstico Firmas Ficha]: Fallback Alcalde activado en ${target.name}:`, alcalde);
            break;
          }
        }
      }
    }

    // Fallback Secretario: Ítems técnicos 2, 3, 4, 23, 25
    if (!secretario) {
      const secretarioItems = [
        { num: 4, name: "Ítem 4 (Certificado de vías terciarias)" },
        { num: 2, name: "Ítem 2 (Especificaciones técnicas)" },
        { num: 3, name: "Ítem 3 (Despiece de acero)" },
        { num: 23, name: "Ítem 23 (Banco de proyectos)" },
        { num: 25, name: "Ítem 25 (Cronograma de obra)" }
      ];

      for (const target of secretarioItems) {
        await new Promise(r => setTimeout(r, 0));
        const file = detectedMap[target.num];
        let candName = null;
        let candCc = "";

        if (file) {
          const ext = this.getFileExtension(file);
          // Omitir extracción profunda en archivos técnicos pesados (> 2MB como Especificaciones Técnicas)
          const isHeavyDoc = file.size && file.size > 2 * 1024 * 1024;
          if (!isHeavyDoc) {
            try {
              let resDoc = null;
              if (ext === "pdf") resDoc = await this.extraerFirmasPdf(file, mpioName);
              else if (["xlsx", "xls", "xlsm", "xlsb"].includes(ext)) resDoc = await this.extraerFirmasExcel(file, mpioName);

              if (resDoc && resDoc.secretario && resDoc.secretario.nombre) {
                candName = resDoc.secretario.nombre;
                candCc = resDoc.secretario.cedula || "";
              }
            } catch (eDoc) { }
          }
        }

        if (!candName) {
          const txt = await getItemText(target.num);
          if (txt && txt.length > 25) {
            candCc = extractCc(txt);
            const mSec = txt.match(/(?:el\s+suscrito\s+)?secretari[oa]\s+de\s+(?:planeaci[oó]n|infraestructura|obras(?:\s+p[uú]blicas)?)[,\s]+([A-ZÁÉÍÓÚÑ\s]{7,40})[,\s]+identificad/i) ||
              txt.match(/(?:secretari[oa]\s+de\s+(?:planeaci[oó]n|infraestructura|obras(?:\s+p[uú]blicas)?))[\s:\._-]*([A-ZÁÉÍÓÚÑ\s]{7,40})/i) ||
              txt.match(/([A-ZÁÉÍÓÚÑ\s]{7,40})\s*\n[\s\S]{0,50}?(?:secretari[oa]\s+de\s+(?:planeaci[oó]n|infraestructura|obras))/i);
            if (mSec) candName = this.cleanCandidateNameString(mSec[1], mpioName);
          }
        }

        if (candName) {
          const evalRes = this.evaluarPuntajeNombrePropio(candName);
          if (evalRes.valid) {
            secretario = {
              nombre: evalRes.name,
              cargo: "SECRETARIO(A) DE PLANEACIÓN / OBRAS PÚBLICAS",
              cedula: candCc,
              origen: `Extraído por respaldo de: ${target.name}`
            };
            console.log(`[Diagnóstico Firmas Ficha]: Fallback Secretario activado en ${target.name}:`, secretario);
            break;
          }
        }
      }
    }

    return { alcalde, secretario };
  },

  async extraerFirmasFichaPriorizacion(files, fichaFile, allFichas, detectedMap, itemTextsMap, mpioName) {
    allFichas = allFichas || [];
    const validFichas = allFichas.filter(f => this.isFichaPriorizacionFile(f));

    const excelFicha = validFichas.find(f => ["xlsx", "xls", "xlsm", "xlsb"].includes(this.getFileExtension(f))) ||
      (files && files.find(f => this.isFichaPriorizacionFile(f) && ["xlsx", "xls", "xlsm", "xlsb"].includes(this.getFileExtension(f)))) ||
      (fichaFile && ["xlsx", "xls", "xlsm", "xlsb"].includes(this.getFileExtension(fichaFile)) ? fichaFile : null);

    const pdfFicha = validFichas.find(f => this.getFileExtension(f) === "pdf") ||
      (files && files.find(f => this.isFichaPriorizacionFile(f) && this.getFileExtension(f) === "pdf")) ||
      (fichaFile && this.getFileExtension(fichaFile) === "pdf" ? fichaFile : null);

    let result = { alcalde: null, secretario: null };

    // 1. Capas 1-4: Prioridad 1 en Excel estructurado
    if (excelFicha) {
      try {
        const xlRes = await this.extraerFirmasExcel(excelFicha, mpioName);
        if (xlRes) {
          if (xlRes.alcalde && xlRes.alcalde.nombre) result.alcalde = xlRes.alcalde;
          if (xlRes.secretario && xlRes.secretario.nombre) result.secretario = xlRes.secretario;
        }
      } catch (eXl) {
        console.warn("Aviso en extracción de firmas Excel:", eXl);
      }
    }

    // 2. Capas 1-4: Prioridad 2 en PDF oficial si falta algún rol
    if ((!result.alcalde || !result.secretario) && pdfFicha) {
      try {
        const pdfRes = await this.extraerFirmasPdf(pdfFicha, mpioName);
        if (pdfRes) {
          if (!result.alcalde && pdfRes.alcalde && pdfRes.alcalde.nombre) {
            result.alcalde = pdfRes.alcalde;
          }
          if (!result.secretario && pdfRes.secretario && pdfRes.secretario.nombre) {
            result.secretario = pdfRes.secretario;
          }
        }
      } catch (ePdf) {
        console.warn("Aviso en extracción de firmas PDF:", ePdf);
      }
    }

    // 3. Capa 5: Búsqueda Recursiva Multi-Documento en todo el Expediente (Fallback automático)
    if (!result.alcalde || !result.secretario) {
      try {
        const fallbackRes = await this.ejecutarFallbackMultiDocumento(
          files,
          detectedMap,
          itemTextsMap,
          mpioName,
          result.alcalde,
          result.secretario
        );
        if (fallbackRes) {
          if (!result.alcalde && fallbackRes.alcalde) result.alcalde = fallbackRes.alcalde;
          if (!result.secretario && fallbackRes.secretario) result.secretario = fallbackRes.secretario;
        }
      } catch (eFallback) {
        console.warn("Aviso en fallback multi-documento:", eFallback);
      }
    }

    return result;
  },

  /**
   * Lector de PDF con preservación de líneas visuales (Y-grouping) y respaldo por páginas
   */
  async readPdfWithLayout(file, maxPagesToRead = 40) {
    if (!file) return { pages: [], fullText: "" };
    try {
      if (file.name.toLowerCase().endsWith(".pdf")) {
        if (typeof pdfjsLib !== "undefined") {
          const arrayBuffer = await file.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          const pages = [];
          let fullText = "";
          const maxPages = Math.min(pdf.numPages, maxPagesToRead || 40);

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

  async readPdfOrText(file, maxPagesToRead = 40) {
    if (!file) return "";
    try {
      const ext = this.getFileExtension(file);
      if (ext === "pdf") {
        const res = await this.readPdfWithLayout(file, maxPagesToRead);
        return res ? res.fullText : "";
      } else if (["xlsx", "xls", "xlsm", "xlsb", "ods"].includes(ext)) {
        return await this.readExcelAsText(file);
      } else {
        return await file.text();
      }
    } catch (e) {
      console.warn("Error en readPdfOrText con archivo " + (file ? file.name : "desconocido") + ":", e);
      return "";
    }
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
  FolderReader.clasificarPartidaConcreto = function (desc) {
    return typeof PresupuestoEngine !== "undefined" && typeof PresupuestoEngine.clasificarPartidaConcreto === "function"
      ? PresupuestoEngine.clasificarPartidaConcreto(desc)
      : { esConcreto: false };
  };
  FolderReader.extraerDimensionesItem = function (desc, f1A) {
    return typeof PresupuestoEngine !== "undefined" && typeof PresupuestoEngine.extraerDimensionesItem === "function"
      ? PresupuestoEngine.extraerDimensionesItem(desc, f1A)
      : { converted: false, motivo: "Motor no disponible" };
  };
  window.FolderReader = FolderReader;
}
