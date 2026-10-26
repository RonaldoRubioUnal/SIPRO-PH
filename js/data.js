/**
 * BASE DE DATOS Y CONFIGURACIÓN MAESTRA DEL SISTEMA (SIPRO-PH)
 * Gobernación de Antioquia - Secretaría de Infraestructura Física
 * Estándar Técnico: Criterios Técnicos de Pavimentos con Placa-huella (26.25 kg/m)
 */

const SIPRO_DATA = {
  // 1. Estándar Oficial: Criterio Técnico Departamental
  normativeStandards: {
    normaBase: "Criterios Técnicos de Diseño de Pavimentos con Placa-huella",
    resolucion: "Criterio Técnico Estructural Departamental",
    concretoFcMPa: 21, // 21 MPa = 210 kg/cm2
    aceroFyMPa: 420,  // Grado 60
    anchoBancaEstandarM: 4.30,
    anchoHuellaM: 0.90,
    anchoCiclopeoCentralM: 0.90,
    anchoBermaCunetaM: 0.70,
    espesorPlacaM: 0.15,
    separacionRiostrasM: 3.00,
    
    // Mínimo de cuantía de acero exigido (kg/m de vía estándar 4.30m)
    cuantiaMinimaKgM: 26.25,

    // Masas lineales nominales oficiales (NTC 2289)
    barrasNominales: {
      "2": { designacion: "#2 (1/4\")", diametroMm: 6.4, diametroPulg: "1/4\"", masaLinealKgM: 0.250, traslapoMinM: 0.40, gancho135MinM: 0.12 },
      "3": { designacion: "#3 (3/8\")", diametroMm: 9.5, diametroPulg: "3/8\"", masaLinealKgM: 0.560, traslapoMinM: 0.54, gancho135MinM: 0.16 },
      "4": { designacion: "#4 (1/2\")", diametroMm: 12.7, diametroPulg: "1/2\"", masaLinealKgM: 0.996, traslapoMinM: 0.72, gancho135MinM: 0.20 },
      "5": { designacion: "#5 (5/8\")", diametroMm: 15.9, diametroPulg: "5/8\"", masaLinealKgM: 1.552, traslapoMinM: 0.90, gancho135MinM: 0.25 },
      "6": { designacion: "#6 (3/4\")", diametroMm: 19.1, diametroPulg: "3/4\"", masaLinealKgM: 2.235, traslapoMinM: 1.10, gancho135MinM: 0.30 }
    },

    bufferToleranciaM: 10,
    coberturaMinimaBufferPct: 95.0
  },

  // 2. Inventario estricto de los 27 ítems numerados secuencialmente (1 al 27)
  items27: [
    {
        "id": 1,
        "num": "01",
        "title": "Solicitud formal del alcalde dirigida a la Secretaría de Infraestructura Física",
        "rule": "Coincidencia exacta de nombre, cédula y período constitucional vigente.",
        "entity": "Alcaldía Municipal",
        "validity": "Vigente",
        "daysMax": 60,
        "expectedFilePattern": [
            "solicitud",
            "formal",
            "1. "
        ]
    },
    {
        "id": 2,
        "num": "02",
        "title": "Esquema de especificaciones técnicas firmado por un ingeniero civil",
        "rule": "Firma autógrafa/digital y número de matrícula profesional COPNIA verificable según Criterios Técnicos de Placa Huella.",
        "entity": "Ingeniero Civil Proyectista",
        "validity": "Vigente",
        "daysMax": 180,
        "expectedFilePattern": [
            "especificaciones",
            "tecnicas",
            "2. "
        ]
    },
    {
        "id": 3,
        "num": "03",
        "title": "Despiece del acero solicitado con longitud, peso total y figuración",
        "rule": "Sumatoria (Longitud * Masa Lineal) == Peso Declarado; Cuantía >= 26.25 kg/m estándar técnico.",
        "entity": "Diseño Estructural Municipal",
        "validity": "Vigente",
        "daysMax": 180,
        "expectedFilePattern": [
            "despiece",
            "acero",
            "3. "
        ]
    },
    {
        "id": 4,
        "num": "04",
        "title": "Certificado de vías a intervenir como terciarias a cargo del municipio (con códigos)",
        "rule": "Coincidencia estricta de código vial con inventario oficial y jerarquía terciaria a cargo del municipio.",
        "entity": "Secretaría de Obras / Planeación",
        "validity": "Vigente",
        "daysMax": 90,
        "expectedFilePattern": [
            "certificado",
            "terciarias",
            "vias",
            "4. "
        ]
    },
    {
        "id": 5,
        "num": "05",
        "title": "Acta de socialización con la comunidad beneficiada",
        "rule": "Participación comunitaria, listado de firmas legibles de beneficiarios directos de la vereda.",
        "entity": "Junta de Acción Comunal / Alcaldía",
        "validity": "Vigente",
        "daysMax": 180,
        "expectedFilePattern": [
            "socializacion",
            "comunidad",
            "5. "
        ]
    },
    {
        "id": 6,
        "num": "06",
        "title": "Registro fotográfico a color",
        "rule": "Mínimo 8 tomas a color con georreferenciación y estado crítico actual de la banca vial.",
        "entity": "Equipo Técnico Municipal",
        "validity": "Vigente",
        "daysMax": 90,
        "expectedFilePattern": [
            "registro",
            "fotografico",
            "fotos",
            "6. "
        ]
    },
    {
        "id": 7,
        "num": "07",
        "title": "Fotocopia de la cédula de ciudadanía del alcalde",
        "rule": "Coincidencia idéntica de nombres, apellidos y número de documento con todos los actos.",
        "entity": "Registraduría Nacional",
        "validity": "Vigente",
        "daysMax": 1460,
        "expectedFilePattern": [
            "cedula",
            "alcalde",
            "7. "
        ]
    },
    {
        "id": 8,
        "num": "08",
        "title": "Acta de posesión del alcalde",
        "rule": "Período constitucional vigente debidamente posesionado ante Notaría o Juzgado.",
        "entity": "Notaría / Juzgado Municipal",
        "validity": "Vigente",
        "daysMax": 1460,
        "expectedFilePattern": [
            "posesion",
            "acta",
            "8. "
        ]
    },
    {
        "id": 9,
        "num": "09",
        "title": "Acuerdo del Concejo que faculta al alcalde para contratar (vigencia < 1 mes)",
        "rule": "Expedición o certificación menor a 1 mes (30 días); facultades explícitas para convenios interadministrativos.",
        "entity": "Concejo Municipal",
        "validity": "< 1 mes (30 días)",
        "daysMax": 30,
        "expectedFilePattern": [
            "acuerdo",
            "concejo",
            "facultades",
            "9. "
        ]
    },
    {
        "id": 10,
        "num": "10",
        "title": "Copia del RUT del municipio (vigencia < 1 mes)",
        "rule": "Descarga de la DIAN con fecha de generación menor a 30 días, estado Activo, NIT correcto.",
        "entity": "DIAN",
        "validity": "< 1 mes (30 días)",
        "daysMax": 30,
        "expectedFilePattern": [
            "rut",
            "10. "
        ]
    },
    {
        "id": 11,
        "num": "11",
        "title": "Certificado de Responsables Fiscales de la Contraloría General (vigencia < 1 mes)",
        "rule": "Vigencia < 30 días. Estado: NO REPORTADO COMO RESPONSABLE FISCAL (Alcalde y Municipio).",
        "entity": "Contraloría General de la República",
        "validity": "< 1 mes (30 días)",
        "daysMax": 30,
        "expectedFilePattern": [
            "contraloria",
            "fiscales",
            "11. "
        ]
    },
    {
        "id": 12,
        "num": "12",
        "title": "Certificado de Medidas Correctivas del alcalde (vigencia < 1 mes)",
        "rule": "Vigencia < 30 días. Sistema RNMC Policía Nacional sin sanciones de convivencia pendientes.",
        "entity": "Policía Nacional - RNMC",
        "validity": "< 1 mes (30 días)",
        "daysMax": 30,
        "expectedFilePattern": [
            "rnmc",
            "medidas",
            "correctivas",
            "12. "
        ]
    },
    {
        "id": 13,
        "num": "13",
        "title": "Certificado de Antecedentes Judiciales del alcalde (vigencia < 1 mes)",
        "rule": "Vigencia < 30 días. Sin asuntos pendientes con las autoridades judiciales.",
        "entity": "Policía Nacional",
        "validity": "< 1 mes (30 días)",
        "daysMax": 30,
        "expectedFilePattern": [
            "judiciales",
            "antecedentes",
            "13. "
        ]
    },
    {
        "id": 14,
        "num": "14",
        "title": "Certificado de Antecedentes Disciplinarios de la Procuraduría (vigencia < 1 mes)",
        "rule": "Vigencia < 30 días. Sin inhabilidades ni sanciones disciplinarias vigentes ordinarias/especiales.",
        "entity": "Procuraduría General de la Nación",
        "validity": "< 1 mes (30 días)",
        "daysMax": 30,
        "expectedFilePattern": [
            "procuraduria",
            "disciplinarios",
            "14. "
        ]
    },
    {
        "id": 15,
        "num": "15",
        "title": "Certificado de paz y salvo de seguridad social y parafiscales del mes presente",
        "rule": "Expedido en el mes corriente por revisor fiscal o representante legal acreditando pagos al día.",
        "entity": "Revisor Fiscal / Tesorería",
        "validity": "Mes presente",
        "daysMax": 30,
        "expectedFilePattern": [
            "parafiscales",
            "seguridad social",
            "15. "
        ]
    },
    {
        "id": 16,
        "num": "16",
        "title": "Certificado Registro de Deudores Alimentarios Morosos (REDAM)",
        "rule": "Estado: NO REGISTRA deuda alimentaria morosa vigente en el sistema del MinTIC/MinJusticia.",
        "entity": "Ministerio de Tecnologías / MinJusticia",
        "validity": "< 1 mes (30 días)",
        "daysMax": 30,
        "expectedFilePattern": [
            "redam",
            "deudores",
            "16. "
        ]
    },
    {
        "id": 17,
        "num": "17",
        "title": "Compromiso anticorrupción (Documento anexo)",
        "rule": "Formato anexo debidamente diligenciado y firmado con firma autógrafa/digital por el alcalde.",
        "entity": "Alcaldía Municipal",
        "validity": "Vigente",
        "daysMax": 90,
        "expectedFilePattern": [
            "anticorrupcion",
            "compromiso anticorrupcion"
        ]
    },
    {
        "id": 18,
        "num": "18",
        "title": "Declaración de no lavado de activos ni financiación del terrorismo (Documento anexo)",
        "rule": "Declaración jurada de prevención de LA/FT firmada íntegramente.",
        "entity": "Alcaldía Municipal",
        "validity": "Vigente",
        "daysMax": 90,
        "expectedFilePattern": [
            "lavado",
            "activos",
            "terrorismo"
        ]
    },
    {
        "id": 19,
        "num": "19",
        "title": "Declaración de inhabilidades, incompatibilidades y conflictos de interés (Documento anexo)",
        "rule": "Declaración expresa bajo gravedad de juramento suscrita por el mandatario local.",
        "entity": "Alcaldía Municipal",
        "validity": "Vigente",
        "daysMax": 90,
        "expectedFilePattern": [
            "inhabilidades e incompatibilidades"
        ]
    },
    {
        "id": 20,
        "num": "20",
        "title": "Declaración de no multas, sanciones ni declaratorias de incumplimiento (Documento anexo)",
        "rule": "Certificación de no haber sido objeto de declaratorias de caducidad ni multas contractuales.",
        "entity": "Alcaldía Municipal",
        "validity": "Vigente",
        "daysMax": 90,
        "expectedFilePattern": [
            "no multas",
            "sanciones",
            "incumplimiento"
        ]
    },
    {
        "id": 21,
        "num": "21",
        "title": "Constancia de consulta en el portal anticorrupción de Colombia - PACO",
        "rule": "Consulta en PACO (Secretaría de Transparencia de la Presidencia) sin reportes de sanciones.",
        "entity": "Presidencia de la República - PACO",
        "validity": "< 1 mes (30 días)",
        "daysMax": 30,
        "expectedFilePattern": [
            "paco",
            "portal anticorrupcion",
            "certificados_cic"
        ]
    },
    {
        "id": 22,
        "num": "22",
        "title": "Certificado de inhabilidades por delitos sexuales contra menores del alcalde",
        "rule": "Ley 1918 de 2018. Certificado de la Policía Nacional con resultado 'NO REGISTRA INHABILIDAD'.",
        "entity": "Policía Nacional",
        "validity": "< 1 mes (30 días)",
        "daysMax": 30,
        "expectedFilePattern": [
            "delitos sexuales",
            "menores",
            "inhabilidades alcalde"
        ]
    },
    {
        "id": 23,
        "num": "23",
        "title": "Certificado de banco y programas de proyectos del municipio",
        "rule": "Registro MGA / BPIN municipal activo con código BPIN y viabilidad técnica local.",
        "entity": "Banco de Programas y Proyectos",
        "validity": "Vigente",
        "daysMax": 180,
        "expectedFilePattern": [
            "banco de proyectos",
            "17. "
        ]
    },
    {
        "id": 24,
        "num": "24",
        "title": "Georreferenciación de los tramos de vías a intervenir (tracks en KML, KMZ o GPX)",
        "rule": "Archivo vectorial de coordenadas GPS; >= 95% dentro del buffer de 10m de la Red Terciaria.",
        "entity": "Topografía / SIG Municipal",
        "validity": "Vigente",
        "daysMax": 180,
        "expectedFilePattern": [
            "kmz",
            "kml",
            "zip",
            "7z",
            "rar",
            "gpx",
            "18. "
        ]
    },
    {
        "id": 25,
        "num": "25",
        "title": "Cronograma de actividades (etapas de contratación, ejecución y recibo)",
        "rule": "Coherencia temporal en meses con el plazo de vigencia del convenio interadministrativo.",
        "entity": "Secretaría de Infraestructura Municipal",
        "validity": "Vigente",
        "daysMax": 180,
        "expectedFilePattern": [
            "cronograma",
            "actividades",
            "19. "
        ]
    },
    {
        "id": 26,
        "num": "26",
        "title": "Certificado de banco de proyectos del municipio",
        "rule": "Certificado de inscripción y radicación presupuestal en el Banco Municipal de Proyectos.",
        "entity": "Planeación Municipal",
        "validity": "Vigente",
        "daysMax": 180,
        "expectedFilePattern": [
            "plan dllo",
            "proyecto y plan"
        ]
    },
    {
        "id": 27,
        "num": "27",
        "title": "Certificado de financiación (especificando valor total y aportes depto/municipio)",
        "rule": "Cierre financiero explícito: aporte Gobernación de Antioquia + contrapartida municipal.",
        "entity": "Hacienda y Tesorería Municipal",
        "validity": "Vigente",
        "daysMax": 90,
        "expectedFilePattern": [
            "recursos municipio",
            "financiacion"
        ]
    }
],

  // 3. Catálogo oficial de Municipios de Antioquia
  municipios: [
    {
        "codigo": "05002",
        "nombre": "ABEJORRAL",
        "subregion": "ORIENTE"
    },
    {
        "codigo": "05004",
        "nombre": "ABRIAQUÍ",
        "subregion": "OCCIDENTE"
    },
    {
        "codigo": "05021",
        "nombre": "ALEJANDRÍA",
        "subregion": "ORIENTE"
    },
    {
        "codigo": "05030",
        "nombre": "AMAGÁ",
        "subregion": "SUROESTE"
    },
    {
        "codigo": "05031",
        "nombre": "AMALFI",
        "subregion": "NORDESTE"
    },
    {
        "codigo": "05034",
        "nombre": "ANDES",
        "subregion": "SUROESTE"
    },
    {
        "codigo": "05036",
        "nombre": "ANGELÓPOLIS",
        "subregion": "SUROESTE"
    },
    {
        "codigo": "05038",
        "nombre": "ANGOSTURA",
        "subregion": "NORTE"
    },
    {
        "codigo": "05040",
        "nombre": "ANORÍ",
        "subregion": "NORDESTE"
    },
    {
        "codigo": "05044",
        "nombre": "ANZÁ",
        "subregion": "OCCIDENTE"
    },
    {
        "codigo": "05045",
        "nombre": "APARTADÓ",
        "subregion": "URABA"
    },
    {
        "codigo": "05051",
        "nombre": "ARBOLETES",
        "subregion": "URABA"
    },
    {
        "codigo": "05055",
        "nombre": "ARGELIA",
        "subregion": "ORIENTE"
    },
    {
        "codigo": "05059",
        "nombre": "ARMENIA",
        "subregion": "OCCIDENTE"
    },
    {
        "codigo": "05079",
        "nombre": "BARBOSA",
        "subregion": "VALLE DE ABURRA"
    },
    {
        "codigo": "05088",
        "nombre": "BELLO",
        "subregion": "VALLE DE ABURRA"
    },
    {
        "codigo": "05086",
        "nombre": "BELMIRA",
        "subregion": "NORTE"
    },
    {
        "codigo": "05091",
        "nombre": "BETANIA",
        "subregion": "SUROESTE"
    },
    {
        "codigo": "05093",
        "nombre": "BETULIA",
        "subregion": "SUROESTE"
    },
    {
        "codigo": "05107",
        "nombre": "BRICEÑO",
        "subregion": "NORTE"
    },
    {
        "codigo": "05113",
        "nombre": "BURITICÁ",
        "subregion": "OCCIDENTE"
    },
    {
        "codigo": "05125",
        "nombre": "CAICEDO",
        "subregion": "OCCIDENTE"
    },
    {
        "codigo": "05129",
        "nombre": "CALDAS",
        "subregion": "VALLE DE ABURRA"
    },
    {
        "codigo": "05134",
        "nombre": "CAMPAMENTO",
        "subregion": "NORTE"
    },
    {
        "codigo": "05142",
        "nombre": "CARACOLÍ",
        "subregion": "MAGDALENA MEDIO"
    },
    {
        "codigo": "05145",
        "nombre": "CARAMANTA",
        "subregion": "SUROESTE"
    },
    {
        "codigo": "05147",
        "nombre": "CAREPA",
        "subregion": "URABA"
    },
    {
        "codigo": "05150",
        "nombre": "CAROLINA",
        "subregion": "NORTE"
    },
    {
        "codigo": "05154",
        "nombre": "CAUCASIA",
        "subregion": "BAJO CAUCA"
    },
    {
        "codigo": "05138",
        "nombre": "CAÑASGORDAS",
        "subregion": "OCCIDENTE"
    },
    {
        "codigo": "05172",
        "nombre": "CHIGORODÓ",
        "subregion": "URABA"
    },
    {
        "codigo": "05190",
        "nombre": "CISNEROS",
        "subregion": "NORDESTE"
    },
    {
        "codigo": "05101",
        "nombre": "CIUDAD BOLÍVAR",
        "subregion": "SUROESTE"
    },
    {
        "codigo": "05197",
        "nombre": "COCORNÁ",
        "subregion": "ORIENTE"
    },
    {
        "codigo": "05206",
        "nombre": "CONCEPCIÓN",
        "subregion": "ORIENTE"
    },
    {
        "codigo": "05209",
        "nombre": "CONCORDIA",
        "subregion": "SUROESTE"
    },
    {
        "codigo": "05212",
        "nombre": "COPACABANA",
        "subregion": "VALLE DE ABURRA"
    },
    {
        "codigo": "05120",
        "nombre": "CÁCERES",
        "subregion": "BAJO CAUCA"
    },
    {
        "codigo": "05234",
        "nombre": "DABEIBA",
        "subregion": "OCCIDENTE"
    },
    {
        "codigo": "05237",
        "nombre": "DON MATÍAS",
        "subregion": "NORTE"
    },
    {
        "codigo": "05240",
        "nombre": "EBÉJICO",
        "subregion": "OCCIDENTE"
    },
    {
        "codigo": "05250",
        "nombre": "EL BAGRE",
        "subregion": "BAJO CAUCA"
    },
    {
        "codigo": "05148",
        "nombre": "EL CARMEN DE VIBORAL",
        "subregion": "ORIENTE"
    },
    {
        "codigo": "05541",
        "nombre": "EL PEÑOL",
        "subregion": "ORIENTE"
    },
    {
        "codigo": "05607",
        "nombre": "EL RETIRO",
        "subregion": "ORIENTE"
    },
    {
        "codigo": "05697",
        "nombre": "EL SANTUARIO",
        "subregion": "ORIENTE"
    },
    {
        "codigo": "05264",
        "nombre": "ENTRERRIOS",
        "subregion": "NORTE"
    },
    {
        "codigo": "05266",
        "nombre": "ENVIGADO",
        "subregion": "VALLE DE ABURRA"
    },
    {
        "codigo": "05282",
        "nombre": "FREDONIA",
        "subregion": "SUROESTE"
    },
    {
        "codigo": "05284",
        "nombre": "FRONTINO",
        "subregion": "OCCIDENTE"
    },
    {
        "codigo": "05306",
        "nombre": "GIRALDO",
        "subregion": "OCCIDENTE"
    },
    {
        "codigo": "05308",
        "nombre": "GIRARDOTA",
        "subregion": "VALLE DE ABURRA"
    },
    {
        "codigo": "05310",
        "nombre": "GOMEZ PLATA",
        "subregion": "NORTE"
    },
    {
        "codigo": "05313",
        "nombre": "GRANADA",
        "subregion": "ORIENTE"
    },
    {
        "codigo": "05315",
        "nombre": "GUADALUPE",
        "subregion": "NORTE"
    },
    {
        "codigo": "05318",
        "nombre": "GUARNE",
        "subregion": "ORIENTE"
    },
    {
        "codigo": "05321",
        "nombre": "GUATAPÉ",
        "subregion": "ORIENTE"
    },
    {
        "codigo": "05347",
        "nombre": "HELICONIA",
        "subregion": "OCCIDENTE"
    },
    {
        "codigo": "05353",
        "nombre": "HISPANIA",
        "subregion": "SUROESTE"
    },
    {
        "codigo": "05360",
        "nombre": "ITAGÜÍ",
        "subregion": "VALLE DE ABURRA"
    },
    {
        "codigo": "05361",
        "nombre": "ITUANGO",
        "subregion": "NORTE"
    },
    {
        "codigo": "05364",
        "nombre": "JARDÍN",
        "subregion": "SUROESTE"
    },
    {
        "codigo": "05368",
        "nombre": "JERICÓ",
        "subregion": "SUROESTE"
    },
    {
        "codigo": "05376",
        "nombre": "LA CEJA",
        "subregion": "ORIENTE"
    },
    {
        "codigo": "05380",
        "nombre": "LA ESTRELLA",
        "subregion": "VALLE DE ABURRA"
    },
    {
        "codigo": "05390",
        "nombre": "LA PINTADA",
        "subregion": "SUROESTE"
    },
    {
        "codigo": "05400",
        "nombre": "LA UNIÓN",
        "subregion": "ORIENTE"
    },
    {
        "codigo": "05411",
        "nombre": "LIBORINA",
        "subregion": "OCCIDENTE"
    },
    {
        "codigo": "05425",
        "nombre": "MACEO",
        "subregion": "MAGDALENA MEDIO"
    },
    {
        "codigo": "05440",
        "nombre": "MARINILLA",
        "subregion": "ORIENTE"
    },
    {
        "codigo": "05001",
        "nombre": "MEDELLÍN",
        "subregion": "VALLE DE ABURRA"
    },
    {
        "codigo": "05467",
        "nombre": "MONTEBELLO",
        "subregion": "SUROESTE"
    },
    {
        "codigo": "05475",
        "nombre": "MURINDÓ",
        "subregion": "URABA"
    },
    {
        "codigo": "05480",
        "nombre": "MUTATÁ",
        "subregion": "URABA"
    },
    {
        "codigo": "05483",
        "nombre": "NARIÑO",
        "subregion": "ORIENTE"
    },
    {
        "codigo": "05495",
        "nombre": "NECHÍ",
        "subregion": "BAJO CAUCA"
    },
    {
        "codigo": "05490",
        "nombre": "NECOCLÍ",
        "subregion": "URABA"
    },
    {
        "codigo": "05501",
        "nombre": "OLAYA",
        "subregion": "OCCIDENTE"
    },
    {
        "codigo": "05543",
        "nombre": "PEQUE",
        "subregion": "OCCIDENTE"
    },
    {
        "codigo": "05576",
        "nombre": "PUEBLORRICO",
        "subregion": "SUROESTE"
    },
    {
        "codigo": "05579",
        "nombre": "PUERTO BERRIO",
        "subregion": "MAGDALENA MEDIO"
    },
    {
        "codigo": "05585",
        "nombre": "PUERTO NARE",
        "subregion": "MAGDALENA MEDIO"
    },
    {
        "codigo": "05591",
        "nombre": "PUERTO TRIUNFO",
        "subregion": "MAGDALENA MEDIO"
    },
    {
        "codigo": "05604",
        "nombre": "REMEDIOS",
        "subregion": "NORDESTE"
    },
    {
        "codigo": "05615",
        "nombre": "RIONEGRO",
        "subregion": "ORIENTE"
    },
    {
        "codigo": "05628",
        "nombre": "SABANALARGA",
        "subregion": "OCCIDENTE"
    },
    {
        "codigo": "05631",
        "nombre": "SABANETA",
        "subregion": "VALLE DE ABURRA"
    },
    {
        "codigo": "05642",
        "nombre": "SALGAR",
        "subregion": "SUROESTE"
    },
    {
        "codigo": "05647",
        "nombre": "SAN ANDRÉS DE CUERQUIA",
        "subregion": "NORTE"
    },
    {
        "codigo": "05649",
        "nombre": "SAN CARLOS",
        "subregion": "ORIENTE"
    },
    {
        "codigo": "05652",
        "nombre": "SAN FRANCISCO",
        "subregion": "ORIENTE"
    },
    {
        "codigo": "05656",
        "nombre": "SAN JERÓNIMO",
        "subregion": "OCCIDENTE"
    },
    {
        "codigo": "05658",
        "nombre": "SAN JOSÉ DE LA MONTAÑA",
        "subregion": "NORTE"
    },
    {
        "codigo": "05659",
        "nombre": "SAN JUAN DE URABÁ",
        "subregion": "URABA"
    },
    {
        "codigo": "05660",
        "nombre": "SAN LUIS",
        "subregion": "ORIENTE"
    },
    {
        "codigo": "05664",
        "nombre": "SAN PEDRO DE LOS MILAGROS",
        "subregion": "NORTE"
    },
    {
        "codigo": "05665",
        "nombre": "SAN PEDRO DE URABÁ",
        "subregion": "URABA"
    },
    {
        "codigo": "05667",
        "nombre": "SAN RAFAEL",
        "subregion": "ORIENTE"
    },
    {
        "codigo": "05670",
        "nombre": "SAN ROQUE",
        "subregion": "NORDESTE"
    },
    {
        "codigo": "05674",
        "nombre": "SAN VICENTE",
        "subregion": "ORIENTE"
    },
    {
        "codigo": "05679",
        "nombre": "SANTA BÁRBARA",
        "subregion": "SUROESTE"
    },
    {
        "codigo": "05042",
        "nombre": "SANTA FE DE ANTIOQUIA",
        "subregion": "OCCIDENTE"
    },
    {
        "codigo": "05686",
        "nombre": "SANTA ROSA DE OSOS",
        "subregion": "NORTE"
    },
    {
        "codigo": "05690",
        "nombre": "SANTO DOMINGO",
        "subregion": "NORDESTE"
    },
    {
        "codigo": "05736",
        "nombre": "SEGOVIA",
        "subregion": "NORDESTE"
    },
    {
        "codigo": "05756",
        "nombre": "SONSÓN",
        "subregion": "ORIENTE"
    },
    {
        "codigo": "05761",
        "nombre": "SOPETRÁN",
        "subregion": "OCCIDENTE"
    },
    {
        "codigo": "05790",
        "nombre": "TARAZÁ",
        "subregion": "BAJO CAUCA"
    },
    {
        "codigo": "05792",
        "nombre": "TARSO",
        "subregion": "SUROESTE"
    },
    {
        "codigo": "05809",
        "nombre": "TITIRIBÍ",
        "subregion": "SUROESTE"
    },
    {
        "codigo": "05819",
        "nombre": "TOLEDO",
        "subregion": "NORTE"
    },
    {
        "codigo": "05837",
        "nombre": "TURBO",
        "subregion": "URABA"
    },
    {
        "codigo": "05789",
        "nombre": "TÁMESIS",
        "subregion": "SUROESTE"
    },
    {
        "codigo": "05842",
        "nombre": "URAMITA",
        "subregion": "OCCIDENTE"
    },
    {
        "codigo": "05847",
        "nombre": "URRAO",
        "subregion": "SUROESTE"
    },
    {
        "codigo": "05854",
        "nombre": "VALDIVIA",
        "subregion": "NORTE"
    },
    {
        "codigo": "05856",
        "nombre": "VALPARAISO",
        "subregion": "SUROESTE"
    },
    {
        "codigo": "05858",
        "nombre": "VEGACHÍ",
        "subregion": "NORDESTE"
    },
    {
        "codigo": "05861",
        "nombre": "VENECIA",
        "subregion": "SUROESTE"
    },
    {
        "codigo": "05873",
        "nombre": "VIGÍA DEL FUERTE",
        "subregion": "URABA"
    },
    {
        "codigo": "05885",
        "nombre": "YALÍ",
        "subregion": "NORDESTE"
    },
    {
        "codigo": "05887",
        "nombre": "YARUMAL",
        "subregion": "NORTE"
    },
    {
        "codigo": "05890",
        "nombre": "YOLOMBÓ",
        "subregion": "NORDESTE"
    },
    {
        "codigo": "05893",
        "nombre": "YONDÓ",
        "subregion": "MAGDALENA MEDIO"
    },
    {
        "codigo": "05895",
        "nombre": "ZARAGOZA",
        "subregion": "BAJO CAUCA"
    }
],

  // 4. Muestras de ejes viales oficiales de Antioquia (Red Terciaria GeoJSON)
  viasMuestra: {
    "AMALFI": {
        "codigo": "05031VT30",
        "nombre": "Portachuelo- Q La Matica  Limite Con Vegachi",
        "mpio": "AMALFI",
        "longitud_km": 3.33,
        "ancho_m": 4.0,
        "coords": [
            [
                -74.922481,
                6.800839
            ],
            [
                -74.922049,
                6.800785
            ],
            [
                -74.921515,
                6.800731
            ],
            [
                -74.92094,
                6.800554
            ],
            [
                -74.920322,
                6.800388
            ],
            [
                -74.91971,
                6.800139
            ],
            [
                -74.919191,
                6.800065
            ],
            [
                -74.9187,
                6.799955
            ],
            [
                -74.917969,
                6.799995
            ],
            [
                -74.917312,
                6.800109
            ],
            [
                -74.916849,
                6.800429
            ],
            [
                -74.916321,
                6.80028
            ],
            [
                -74.916006,
                6.799896
            ],
            [
                -74.916165,
                6.799492
            ],
            [
                -74.916079,
                6.799073
            ],
            [
                -74.915597,
                6.799292
            ],
            [
                -74.915088,
                6.799406
            ],
            [
                -74.914523,
                6.799199
            ],
            [
                -74.914248,
                6.799419
            ],
            [
                -74.91399,
                6.799611
            ],
            [
                -74.913559,
                6.79969
            ],
            [
                -74.913351,
                6.799922
            ],
            [
                -74.913054,
                6.800004
            ],
            [
                -74.912741,
                6.799842
            ],
            [
                -74.91239,
                6.799619
            ],
            [
                -74.911953,
                6.799481
            ],
            [
                -74.911557,
                6.799309
            ],
            [
                -74.911237,
                6.799116
            ],
            [
                -74.910776,
                6.799045
            ],
            [
                -74.91012,
                6.799027
            ],
            [
                -74.909211,
                6.799062
            ],
            [
                -74.908572,
                6.799072
            ],
            [
                -74.90802,
                6.798633
            ],
            [
                -74.907831,
                6.798311
            ],
            [
                -74.907429,
                6.798023
            ],
            [
                -74.906849,
                6.797534
            ],
            [
                -74.906326,
                6.797118
            ],
            [
                -74.905894,
                6.797014
            ],
            [
                -74.905518,
                6.796697
            ],
            [
                -74.905119,
                6.796553
            ],
            [
                -74.904568,
                6.796809
            ],
            [
                -74.904207,
                6.796691
            ],
            [
                -74.904155,
                6.796119
            ],
            [
                -74.903862,
                6.795817
            ],
            [
                -74.903341,
                6.795852
            ],
            [
                -74.902886,
                6.795876
            ],
            [
                -74.902667,
                6.795983
            ],
            [
                -74.902512,
                6.79619
            ],
            [
                -74.902254,
                6.796324
            ],
            [
                -74.901958,
                6.796483
            ],
            [
                -74.90193,
                6.796877
            ],
            [
                -74.901967,
                6.797365
            ],
            [
                -74.901895,
                6.797709
            ],
            [
                -74.901692,
                6.798056
            ],
            [
                -74.901348,
                6.798323
            ],
            [
                -74.900906,
                6.798553
            ],
            [
                -74.90057,
                6.798716
            ],
            [
                -74.900309,
                6.79873
            ],
            [
                -74.900016,
                6.798698
            ],
            [
                -74.899681,
                6.798654
            ],
            [
                -74.899338,
                6.798806
            ],
            [
                -74.898961,
                6.79892
            ],
            [
                -74.898711,
                6.798989
            ],
            [
                -74.898516,
                6.799091
            ],
            [
                -74.89849,
                6.799106
            ]
        ]
    },
    "FREDONIA": {
        "codigo": "55980",
        "nombre": "Murrapal - La Garrucha",
        "mpio": "FREDONIA",
        "longitud_km": 8.08,
        "ancho_m": 4.0,
        "coords": [
            [
                -75.692406,
                5.911408
            ],
            [
                -75.692262,
                5.911179
            ],
            [
                -75.69147,
                5.911439
            ],
            [
                -75.691178,
                5.911952
            ],
            [
                -75.6903,
                5.911883
            ],
            [
                -75.689823,
                5.912384
            ],
            [
                -75.689455,
                5.91199
            ],
            [
                -75.688844,
                5.911631
            ],
            [
                -75.68816,
                5.911383
            ],
            [
                -75.688078,
                5.910704
            ],
            [
                -75.68827,
                5.909911
            ],
            [
                -75.687312,
                5.909608
            ],
            [
                -75.687555,
                5.908322
            ],
            [
                -75.687711,
                5.907318
            ],
            [
                -75.68858,
                5.906669
            ],
            [
                -75.689582,
                5.90623
            ],
            [
                -75.690363,
                5.90645
            ],
            [
                -75.691087,
                5.905799
            ],
            [
                -75.691958,
                5.905526
            ],
            [
                -75.692678,
                5.904908
            ],
            [
                -75.693373,
                5.904504
            ],
            [
                -75.694288,
                5.903993
            ],
            [
                -75.694483,
                5.903251
            ],
            [
                -75.694693,
                5.9026
            ],
            [
                -75.695379,
                5.902039
            ],
            [
                -75.696083,
                5.901785
            ],
            [
                -75.696432,
                5.902376
            ],
            [
                -75.69676,
                5.902539
            ],
            [
                -75.69692,
                5.90138
            ],
            [
                -75.69718,
                5.899819
            ],
            [
                -75.697591,
                5.899148
            ],
            [
                -75.69843,
                5.898803
            ],
            [
                -75.699072,
                5.899565
            ],
            [
                -75.699471,
                5.899505
            ],
            [
                -75.699878,
                5.899778
            ],
            [
                -75.700118,
                5.898941
            ],
            [
                -75.699839,
                5.897897
            ],
            [
                -75.699254,
                5.896942
            ],
            [
                -75.698876,
                5.895762
            ],
            [
                -75.698668,
                5.895049
            ],
            [
                -75.697766,
                5.894292
            ],
            [
                -75.697061,
                5.893947
            ],
            [
                -75.69633,
                5.894321
            ],
            [
                -75.695699,
                5.894322
            ],
            [
                -75.696196,
                5.893685
            ],
            [
                -75.695465,
                5.893441
            ],
            [
                -75.695062,
                5.893158
            ],
            [
                -75.695723,
                5.892372
            ],
            [
                -75.69593,
                5.891202
            ],
            [
                -75.695633,
                5.890391
            ],
            [
                -75.696539,
                5.889142
            ],
            [
                -75.696691,
                5.888259
            ],
            [
                -75.697168,
                5.887672
            ],
            [
                -75.697953,
                5.88704
            ],
            [
                -75.697887,
                5.886156
            ],
            [
                -75.697668,
                5.885909
            ],
            [
                -75.697465,
                5.886431
            ],
            [
                -75.696474,
                5.886073
            ],
            [
                -75.696135,
                5.885276
            ],
            [
                -75.695841,
                5.884347
            ],
            [
                -75.695496,
                5.883434
            ],
            [
                -75.694808,
                5.882792
            ],
            [
                -75.694415,
                5.881488
            ],
            [
                -75.693419,
                5.880972
            ],
            [
                -75.693006,
                5.880196
            ],
            [
                -75.692126,
                5.879408
            ],
            [
                -75.691463,
                5.878634
            ],
            [
                -75.690924,
                5.879207
            ],
            [
                -75.6903,
                5.879801
            ],
            [
                -75.690216,
                5.880677
            ],
            [
                -75.689561,
                5.881283
            ],
            [
                -75.689092,
                5.882633
            ],
            [
                -75.689002,
                5.883226
            ],
            [
                -75.69028,
                5.883671
            ],
            [
                -75.689959,
                5.884625
            ],
            [
                -75.688546,
                5.885625
            ]
        ]
    },
    "GIRARDOTA": {
        "codigo": "05308VT01",
        "nombre": "El Barro - La Escuela",
        "mpio": "GIRARDOTA",
        "longitud_km": 1.6,
        "ancho_m": 4.3,
        "coords": [
            [
                -75.440804,
                6.359127
            ],
            [
                -75.44068,
                6.359018
            ],
            [
                -75.440598,
                6.358924
            ],
            [
                -75.440551,
                6.358766
            ],
            [
                -75.440566,
                6.358624
            ],
            [
                -75.440672,
                6.358524
            ],
            [
                -75.440849,
                6.358425
            ],
            [
                -75.441024,
                6.35834
            ],
            [
                -75.441126,
                6.35828
            ],
            [
                -75.441269,
                6.35822
            ],
            [
                -75.441339,
                6.358086
            ],
            [
                -75.441349,
                6.357916
            ],
            [
                -75.441487,
                6.357775
            ],
            [
                -75.441555,
                6.357658
            ],
            [
                -75.44165,
                6.357392
            ],
            [
                -75.441703,
                6.357155
            ],
            [
                -75.441774,
                6.356869
            ],
            [
                -75.441874,
                6.356719
            ],
            [
                -75.441869,
                6.356527
            ],
            [
                -75.441772,
                6.3564
            ],
            [
                -75.44162,
                6.356211
            ],
            [
                -75.441481,
                6.356117
            ],
            [
                -75.441425,
                6.355886
            ],
            [
                -75.44137,
                6.355747
            ],
            [
                -75.441262,
                6.355648
            ],
            [
                -75.441145,
                6.355665
            ],
            [
                -75.440939,
                6.355662
            ],
            [
                -75.440751,
                6.35563
            ],
            [
                -75.440683,
                6.355523
            ],
            [
                -75.440616,
                6.355379
            ],
            [
                -75.44051,
                6.355172
            ],
            [
                -75.440455,
                6.355025
            ],
            [
                -75.440428,
                6.354844
            ],
            [
                -75.440434,
                6.35472
            ],
            [
                -75.440524,
                6.354828
            ],
            [
                -75.440581,
                6.3549
            ],
            [
                -75.44072,
                6.354885
            ],
            [
                -75.440858,
                6.354869
            ],
            [
                -75.440954,
                6.354808
            ],
            [
                -75.441007,
                6.354721
            ],
            [
                -75.441101,
                6.354652
            ],
            [
                -75.441026,
                6.354573
            ],
            [
                -75.440984,
                6.354512
            ],
            [
                -75.440952,
                6.354451
            ],
            [
                -75.440886,
                6.354365
            ],
            [
                -75.440787,
                6.354304
            ],
            [
                -75.440739,
                6.354253
            ],
            [
                -75.440733,
                6.354153
            ],
            [
                -75.440843,
                6.354065
            ],
            [
                -75.440731,
                6.353949
            ],
            [
                -75.44071,
                6.353836
            ],
            [
                -75.440698,
                6.353701
            ],
            [
                -75.44071,
                6.353607
            ],
            [
                -75.440813,
                6.353664
            ],
            [
                -75.440892,
                6.353728
            ],
            [
                -75.440988,
                6.353769
            ],
            [
                -75.441038,
                6.353722
            ],
            [
                -75.441023,
                6.353673
            ],
            [
                -75.441049,
                6.353637
            ],
            [
                -75.441081,
                6.353576
            ],
            [
                -75.441075,
                6.353502
            ],
            [
                -75.441021,
                6.3534
            ],
            [
                -75.441004,
                6.353334
            ],
            [
                -75.441095,
                6.35333
            ],
            [
                -75.441285,
                6.353351
            ],
            [
                -75.441334,
                6.353352
            ],
            [
                -75.441371,
                6.353247
            ],
            [
                -75.441462,
                6.3532
            ],
            [
                -75.44153,
                6.353131
            ],
            [
                -75.441664,
                6.353112
            ],
            [
                -75.441838,
                6.353157
            ],
            [
                -75.441972,
                6.353197
            ],
            [
                -75.442096,
                6.353221
            ],
            [
                -75.442192,
                6.353223
            ],
            [
                -75.442303,
                6.353208
            ],
            [
                -75.442325,
                6.353144
            ],
            [
                -75.442338,
                6.353075
            ],
            [
                -75.442421,
                6.35304
            ],
            [
                -75.442519,
                6.353026
            ],
            [
                -75.442524,
                6.353021
            ],
            [
                -75.44262,
                6.353025
            ],
            [
                -75.442746,
                6.353076
            ],
            [
                -75.442827,
                6.353136
            ],
            [
                -75.442978,
                6.353148
            ],
            [
                -75.443136,
                6.353131
            ],
            [
                -75.44327,
                6.353153
            ],
            [
                -75.443406,
                6.353194
            ],
            [
                -75.443432,
                6.353194
            ],
            [
                -75.443631,
                6.353139
            ],
            [
                -75.443839,
                6.353104
            ],
            [
                -75.443857,
                6.353104
            ],
            [
                -75.443927,
                6.353106
            ],
            [
                -75.444044,
                6.353127
            ],
            [
                -75.444234,
                6.353169
            ],
            [
                -75.444333,
                6.35318
            ],
            [
                -75.444255,
                6.353054
            ],
            [
                -75.444225,
                6.353024
            ],
            [
                -75.444078,
                6.352824
            ],
            [
                -75.443982,
                6.352585
            ],
            [
                -75.444019,
                6.352541
            ],
            [
                -75.444118,
                6.352516
            ],
            [
                -75.444169,
                6.352517
            ],
            [
                -75.444269,
                6.352447
            ],
            [
                -75.444235,
                6.352135
            ],
            [
                -75.444234,
                6.352068
            ],
            [
                -75.44421,
                6.351885
            ],
            [
                -75.444385,
                6.351863
            ],
            [
                -75.444455,
                6.351897
            ]
        ]
    },
    "ANDES": {
        "codigo": "05034VT220",
        "nombre": "Palestina - La Bodega",
        "mpio": "ANDES",
        "longitud_km": 5.0,
        "ancho_m": 4.8,
        "coords": [
            [
                -75.875305,
                5.690042
            ],
            [
                -75.873952,
                5.686999
            ],
            [
                -75.873124,
                5.683855
            ],
            [
                -75.873133,
                5.682502
            ],
            [
                -75.872408,
                5.681797
            ],
            [
                -75.872051,
                5.681523
            ],
            [
                -75.871798,
                5.681258
            ],
            [
                -75.871528,
                5.680982
            ],
            [
                -75.871238,
                5.680734
            ],
            [
                -75.870948,
                5.680434
            ],
            [
                -75.870568,
                5.680082
            ],
            [
                -75.870444,
                5.679777
            ],
            [
                -75.870603,
                5.679435
            ],
            [
                -75.870567,
                5.679153
            ],
            [
                -75.870212,
                5.6793
            ],
            [
                -75.869709,
                5.679226
            ],
            [
                -75.869376,
                5.679109
            ],
            [
                -75.869132,
                5.679283
            ],
            [
                -75.868802,
                5.679339
            ],
            [
                -75.868514,
                5.679158
            ],
            [
                -75.868264,
                5.678896
            ],
            [
                -75.868046,
                5.678588
            ],
            [
                -75.86771,
                5.67851
            ],
            [
                -75.867265,
                5.678586
            ],
            [
                -75.866896,
                5.678449
            ],
            [
                -75.866505,
                5.678479
            ],
            [
                -75.865959,
                5.67862
            ],
            [
                -75.865618,
                5.678952
            ],
            [
                -75.865235,
                5.679358
            ],
            [
                -75.86483,
                5.679298
            ],
            [
                -75.864484,
                5.679512
            ],
            [
                -75.864068,
                5.679709
            ],
            [
                -75.863974,
                5.679295
            ],
            [
                -75.863893,
                5.678939
            ],
            [
                -75.86399,
                5.678595
            ],
            [
                -75.863927,
                5.678271
            ],
            [
                -75.863544,
                5.67807
            ],
            [
                -75.863393,
                5.677713
            ],
            [
                -75.863026,
                5.677328
            ],
            [
                -75.863331,
                5.676936
            ],
            [
                -75.863611,
                5.676501
            ],
            [
                -75.863744,
                5.676043
            ],
            [
                -75.863412,
                5.675642
            ],
            [
                -75.862893,
                5.67527
            ],
            [
                -75.862616,
                5.674747
            ],
            [
                -75.862205,
                5.674391
            ],
            [
                -75.86178,
                5.674045
            ],
            [
                -75.861183,
                5.673917
            ],
            [
                -75.861044,
                5.673554
            ],
            [
                -75.861196,
                5.672914
            ],
            [
                -75.861409,
                5.672394
            ],
            [
                -75.86163,
                5.671753
            ],
            [
                -75.861998,
                5.671212
            ],
            [
                -75.862274,
                5.670619
            ],
            [
                -75.86193,
                5.670049
            ],
            [
                -75.86213,
                5.669491
            ],
            [
                -75.862596,
                5.66899
            ],
            [
                -75.863288,
                5.668618
            ],
            [
                -75.863912,
                5.668823
            ],
            [
                -75.864396,
                5.668068
            ],
            [
                -75.863446,
                5.666817
            ],
            [
                -75.86029,
                5.665265
            ]
        ]
    },
    "MARINILLA": {
        "codigo": "05440VT01",
        "nombre": "Vía Marinilla Nuevo Peñol - Salto Abajo El Porvenir",
        "mpio": "MARINILLA",
        "longitud_km": 1.0,
        "ancho_m": 4.3,
        "coords": [
            [
                -75.284392,
                6.24243
            ],
            [
                -75.284249,
                6.242171
            ],
            [
                -75.28385,
                6.2415
            ],
            [
                -75.2834,
                6.2408
            ],
            [
                -75.2829,
                6.2401
            ],
            [
                -75.2825,
                6.2395
            ]
        ]
    }
},

  // 5. Diccionario Maestro Oficial: 125 Municipios de Antioquia (DANE / Gobernación)
  municipiosAntioquia: [
    {
        "nombre": "ABEJORRAL",
        "codigo": "05002",
        "subregion": "ORIENTE"
    },
    {
        "nombre": "ABRIAQUÍ",
        "codigo": "05004",
        "subregion": "OCCIDENTE"
    },
    {
        "nombre": "ALEJANDRÍA",
        "codigo": "05021",
        "subregion": "ORIENTE"
    },
    {
        "nombre": "AMAGÁ",
        "codigo": "05030",
        "subregion": "SUROESTE"
    },
    {
        "nombre": "AMALFI",
        "codigo": "05031",
        "subregion": "NORDESTE"
    },
    {
        "nombre": "ANDES",
        "codigo": "05034",
        "subregion": "SUROESTE"
    },
    {
        "nombre": "ANGELÓPOLIS",
        "codigo": "05036",
        "subregion": "SUROESTE"
    },
    {
        "nombre": "ANGOSTURA",
        "codigo": "05038",
        "subregion": "NORTE"
    },
    {
        "nombre": "ANORÍ",
        "codigo": "05040",
        "subregion": "NORDESTE"
    },
    {
        "nombre": "ANZÁ",
        "codigo": "05044",
        "subregion": "OCCIDENTE"
    },
    {
        "nombre": "APARTADÓ",
        "codigo": "05045",
        "subregion": "URABA"
    },
    {
        "nombre": "ARBOLETES",
        "codigo": "05051",
        "subregion": "URABA"
    },
    {
        "nombre": "ARGELIA",
        "codigo": "05055",
        "subregion": "ORIENTE"
    },
    {
        "nombre": "ARMENIA",
        "codigo": "05059",
        "subregion": "OCCIDENTE"
    },
    {
        "nombre": "BARBOSA",
        "codigo": "05079",
        "subregion": "VALLE DE ABURRA"
    },
    {
        "nombre": "BELLO",
        "codigo": "05088",
        "subregion": "VALLE DE ABURRA"
    },
    {
        "nombre": "BELMIRA",
        "codigo": "05086",
        "subregion": "NORTE"
    },
    {
        "nombre": "BETANIA",
        "codigo": "05091",
        "subregion": "SUROESTE"
    },
    {
        "nombre": "BETULIA",
        "codigo": "05093",
        "subregion": "SUROESTE"
    },
    {
        "nombre": "BRICEÑO",
        "codigo": "05107",
        "subregion": "NORTE"
    },
    {
        "nombre": "BURITICÁ",
        "codigo": "05113",
        "subregion": "OCCIDENTE"
    },
    {
        "nombre": "CAICEDO",
        "codigo": "05125",
        "subregion": "OCCIDENTE"
    },
    {
        "nombre": "CALDAS",
        "codigo": "05129",
        "subregion": "VALLE DE ABURRA"
    },
    {
        "nombre": "CAMPAMENTO",
        "codigo": "05134",
        "subregion": "NORTE"
    },
    {
        "nombre": "CARACOLÍ",
        "codigo": "05142",
        "subregion": "MAGDALENA MEDIO"
    },
    {
        "nombre": "CARAMANTA",
        "codigo": "05145",
        "subregion": "SUROESTE"
    },
    {
        "nombre": "CAREPA",
        "codigo": "05147",
        "subregion": "URABA"
    },
    {
        "nombre": "CAROLINA",
        "codigo": "05150",
        "subregion": "NORTE"
    },
    {
        "nombre": "CAUCASIA",
        "codigo": "05154",
        "subregion": "BAJO CAUCA"
    },
    {
        "nombre": "CAÑASGORDAS",
        "codigo": "05138",
        "subregion": "OCCIDENTE"
    },
    {
        "nombre": "CHIGORODÓ",
        "codigo": "05172",
        "subregion": "URABA"
    },
    {
        "nombre": "CISNEROS",
        "codigo": "05190",
        "subregion": "NORDESTE"
    },
    {
        "nombre": "CIUDAD BOLÍVAR",
        "codigo": "05101",
        "subregion": "SUROESTE"
    },
    {
        "nombre": "COCORNÁ",
        "codigo": "05197",
        "subregion": "ORIENTE"
    },
    {
        "nombre": "CONCEPCIÓN",
        "codigo": "05206",
        "subregion": "ORIENTE"
    },
    {
        "nombre": "CONCORDIA",
        "codigo": "05209",
        "subregion": "SUROESTE"
    },
    {
        "nombre": "COPACABANA",
        "codigo": "05212",
        "subregion": "VALLE DE ABURRA"
    },
    {
        "nombre": "CÁCERES",
        "codigo": "05120",
        "subregion": "BAJO CAUCA"
    },
    {
        "nombre": "DABEIBA",
        "codigo": "05234",
        "subregion": "OCCIDENTE"
    },
    {
        "nombre": "DON MATÍAS",
        "codigo": "05237",
        "subregion": "NORTE"
    },
    {
        "nombre": "EBÉJICO",
        "codigo": "05240",
        "subregion": "OCCIDENTE"
    },
    {
        "nombre": "EL BAGRE",
        "codigo": "05250",
        "subregion": "BAJO CAUCA"
    },
    {
        "nombre": "EL CARMEN DE VIBORAL",
        "codigo": "05148",
        "subregion": "ORIENTE"
    },
    {
        "nombre": "EL PEÑOL",
        "codigo": "05541",
        "subregion": "ORIENTE"
    },
    {
        "nombre": "EL RETIRO",
        "codigo": "05607",
        "subregion": "ORIENTE"
    },
    {
        "nombre": "EL SANTUARIO",
        "codigo": "05697",
        "subregion": "ORIENTE"
    },
    {
        "nombre": "ENTRERRIOS",
        "codigo": "05264",
        "subregion": "NORTE"
    },
    {
        "nombre": "ENVIGADO",
        "codigo": "05266",
        "subregion": "VALLE DE ABURRA"
    },
    {
        "nombre": "FREDONIA",
        "codigo": "05282",
        "subregion": "SUROESTE"
    },
    {
        "nombre": "FRONTINO",
        "codigo": "05284",
        "subregion": "OCCIDENTE"
    },
    {
        "nombre": "GIRALDO",
        "codigo": "05306",
        "subregion": "OCCIDENTE"
    },
    {
        "nombre": "GIRARDOTA",
        "codigo": "05308",
        "subregion": "VALLE DE ABURRA"
    },
    {
        "nombre": "GOMEZ PLATA",
        "codigo": "05310",
        "subregion": "NORTE"
    },
    {
        "nombre": "GRANADA",
        "codigo": "05313",
        "subregion": "ORIENTE"
    },
    {
        "nombre": "GUADALUPE",
        "codigo": "05315",
        "subregion": "NORTE"
    },
    {
        "nombre": "GUARNE",
        "codigo": "05318",
        "subregion": "ORIENTE"
    },
    {
        "nombre": "GUATAPÉ",
        "codigo": "05321",
        "subregion": "ORIENTE"
    },
    {
        "nombre": "HELICONIA",
        "codigo": "05347",
        "subregion": "OCCIDENTE"
    },
    {
        "nombre": "HISPANIA",
        "codigo": "05353",
        "subregion": "SUROESTE"
    },
    {
        "nombre": "ITAGÜÍ",
        "codigo": "05360",
        "subregion": "VALLE DE ABURRA"
    },
    {
        "nombre": "ITUANGO",
        "codigo": "05361",
        "subregion": "NORTE"
    },
    {
        "nombre": "JARDÍN",
        "codigo": "05364",
        "subregion": "SUROESTE"
    },
    {
        "nombre": "JERICÓ",
        "codigo": "05368",
        "subregion": "SUROESTE"
    },
    {
        "nombre": "LA CEJA",
        "codigo": "05376",
        "subregion": "ORIENTE"
    },
    {
        "nombre": "LA ESTRELLA",
        "codigo": "05380",
        "subregion": "VALLE DE ABURRA"
    },
    {
        "nombre": "LA PINTADA",
        "codigo": "05390",
        "subregion": "SUROESTE"
    },
    {
        "nombre": "LA UNIÓN",
        "codigo": "05400",
        "subregion": "ORIENTE"
    },
    {
        "nombre": "LIBORINA",
        "codigo": "05411",
        "subregion": "OCCIDENTE"
    },
    {
        "nombre": "MACEO",
        "codigo": "05425",
        "subregion": "MAGDALENA MEDIO"
    },
    {
        "nombre": "MARINILLA",
        "codigo": "05440",
        "subregion": "ORIENTE"
    },
    {
        "nombre": "MEDELLÍN",
        "codigo": "05001",
        "subregion": "VALLE DE ABURRA"
    },
    {
        "nombre": "MONTEBELLO",
        "codigo": "05467",
        "subregion": "SUROESTE"
    },
    {
        "nombre": "MURINDÓ",
        "codigo": "05475",
        "subregion": "URABA"
    },
    {
        "nombre": "MUTATÁ",
        "codigo": "05480",
        "subregion": "URABA"
    },
    {
        "nombre": "NARIÑO",
        "codigo": "05483",
        "subregion": "ORIENTE"
    },
    {
        "nombre": "NECHÍ",
        "codigo": "05495",
        "subregion": "BAJO CAUCA"
    },
    {
        "nombre": "NECOCLÍ",
        "codigo": "05490",
        "subregion": "URABA"
    },
    {
        "nombre": "OLAYA",
        "codigo": "05501",
        "subregion": "OCCIDENTE"
    },
    {
        "nombre": "PEQUE",
        "codigo": "05543",
        "subregion": "OCCIDENTE"
    },
    {
        "nombre": "PUEBLORRICO",
        "codigo": "05576",
        "subregion": "SUROESTE"
    },
    {
        "nombre": "PUERTO BERRIO",
        "codigo": "05579",
        "subregion": "MAGDALENA MEDIO"
    },
    {
        "nombre": "PUERTO NARE",
        "codigo": "05585",
        "subregion": "MAGDALENA MEDIO"
    },
    {
        "nombre": "PUERTO TRIUNFO",
        "codigo": "05591",
        "subregion": "MAGDALENA MEDIO"
    },
    {
        "nombre": "REMEDIOS",
        "codigo": "05604",
        "subregion": "NORDESTE"
    },
    {
        "nombre": "RIONEGRO",
        "codigo": "05615",
        "subregion": "ORIENTE"
    },
    {
        "nombre": "SABANALARGA",
        "codigo": "05628",
        "subregion": "OCCIDENTE"
    },
    {
        "nombre": "SABANETA",
        "codigo": "05631",
        "subregion": "VALLE DE ABURRA"
    },
    {
        "nombre": "SALGAR",
        "codigo": "05642",
        "subregion": "SUROESTE"
    },
    {
        "nombre": "SAN ANDRÉS DE CUERQUIA",
        "codigo": "05647",
        "subregion": "NORTE"
    },
    {
        "nombre": "SAN CARLOS",
        "codigo": "05649",
        "subregion": "ORIENTE"
    },
    {
        "nombre": "SAN FRANCISCO",
        "codigo": "05652",
        "subregion": "ORIENTE"
    },
    {
        "nombre": "SAN JERÓNIMO",
        "codigo": "05656",
        "subregion": "OCCIDENTE"
    },
    {
        "nombre": "SAN JOSÉ DE LA MONTAÑA",
        "codigo": "05658",
        "subregion": "NORTE"
    },
    {
        "nombre": "SAN JUAN DE URABÁ",
        "codigo": "05659",
        "subregion": "URABA"
    },
    {
        "nombre": "SAN LUIS",
        "codigo": "05660",
        "subregion": "ORIENTE"
    },
    {
        "nombre": "SAN PEDRO DE LOS MILAGROS",
        "codigo": "05664",
        "subregion": "NORTE"
    },
    {
        "nombre": "SAN PEDRO DE URABÁ",
        "codigo": "05665",
        "subregion": "URABA"
    },
    {
        "nombre": "SAN RAFAEL",
        "codigo": "05667",
        "subregion": "ORIENTE"
    },
    {
        "nombre": "SAN ROQUE",
        "codigo": "05670",
        "subregion": "NORDESTE"
    },
    {
        "nombre": "SAN VICENTE",
        "codigo": "05674",
        "subregion": "ORIENTE"
    },
    {
        "nombre": "SANTA BÁRBARA",
        "codigo": "05679",
        "subregion": "SUROESTE"
    },
    {
        "nombre": "SANTA FE DE ANTIOQUIA",
        "codigo": "05042",
        "subregion": "OCCIDENTE"
    },
    {
        "nombre": "SANTA ROSA DE OSOS",
        "codigo": "05686",
        "subregion": "NORTE"
    },
    {
        "nombre": "SANTO DOMINGO",
        "codigo": "05690",
        "subregion": "NORDESTE"
    },
    {
        "nombre": "SEGOVIA",
        "codigo": "05736",
        "subregion": "NORDESTE"
    },
    {
        "nombre": "SONSÓN",
        "codigo": "05756",
        "subregion": "ORIENTE"
    },
    {
        "nombre": "SOPETRÁN",
        "codigo": "05761",
        "subregion": "OCCIDENTE"
    },
    {
        "nombre": "TARAZÁ",
        "codigo": "05790",
        "subregion": "BAJO CAUCA"
    },
    {
        "nombre": "TARSO",
        "codigo": "05792",
        "subregion": "SUROESTE"
    },
    {
        "nombre": "TITIRIBÍ",
        "codigo": "05809",
        "subregion": "SUROESTE"
    },
    {
        "nombre": "TOLEDO",
        "codigo": "05819",
        "subregion": "NORTE"
    },
    {
        "nombre": "TURBO",
        "codigo": "05837",
        "subregion": "URABA"
    },
    {
        "nombre": "TÁMESIS",
        "codigo": "05789",
        "subregion": "SUROESTE"
    },
    {
        "nombre": "URAMITA",
        "codigo": "05842",
        "subregion": "OCCIDENTE"
    },
    {
        "nombre": "URRAO",
        "codigo": "05847",
        "subregion": "SUROESTE"
    },
    {
        "nombre": "VALDIVIA",
        "codigo": "05854",
        "subregion": "NORTE"
    },
    {
        "nombre": "VALPARAISO",
        "codigo": "05856",
        "subregion": "SUROESTE"
    },
    {
        "nombre": "VEGACHÍ",
        "codigo": "05858",
        "subregion": "NORDESTE"
    },
    {
        "nombre": "VENECIA",
        "codigo": "05861",
        "subregion": "SUROESTE"
    },
    {
        "nombre": "VIGÍA DEL FUERTE",
        "codigo": "05873",
        "subregion": "URABA"
    },
    {
        "nombre": "YALÍ",
        "codigo": "05885",
        "subregion": "NORDESTE"
    },
    {
        "nombre": "YARUMAL",
        "codigo": "05887",
        "subregion": "NORTE"
    },
    {
        "nombre": "YOLOMBÓ",
        "codigo": "05890",
        "subregion": "NORDESTE"
    },
    {
        "nombre": "YONDÓ",
        "codigo": "05893",
        "subregion": "MAGDALENA MEDIO"
    },
    {
        "nombre": "ZARAGOZA",
        "codigo": "05895",
        "subregion": "BAJO CAUCA"
    }
],

  // 6. Expedientes Reales en Evaluación (Gestor Multi-Expediente Centralizado)
  // Almacén indexado por ID de proyecto: window.proyectosAuditados = { [id]: { datos, fase1A, fase1B, fase2, kpis, archivos } }
  // Inicia completamente vacío; solo se poblará con las carpetas que cargue el usuario.
  expedientesMap: {},
  proyectos: [],

  // Parámetros normativos estándar estructurales
  parametrosNormativosEstructurales: {
    anchoBancaM: 4.30,
    anchoPlacaHuellaM: 0.90,
    anchoPiedraPegadaM: 0.90,
    anchoBermaCunetaM: 0.70,
    espesorPlacaM: 0.15,
    distanciaRiostrasM: 3.00,
    fcMPa: 21,
    fyMPa: 420,
    cuantiaMinimaKgM: 26.25,
    bufferToleranciaM: 10
  }
};

if (typeof window !== "undefined") {
  window.SIPRO_DATA = SIPRO_DATA;
}
