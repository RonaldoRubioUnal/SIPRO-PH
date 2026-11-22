/**
 * MOTOR DE AUDITORÍA ESPACIAL Y CONTRASTE VIAL MULTICAPA (FASE 1B)
 * Sistema SIPRO-PH - Gobernación de Antioquia
 * Base Cartográfica: Google Satélite Híbrido + OpenStreetMap
 * Capas Viales: Red Vial Terciaria (Base Oficial), Secundaria, Primaria y Capa Subida
 * Soporte Multi-Tramo: Tramos KML/KMZ independientes (Sin concatenar coordenadas)
 * Tolerancia Normativa: Buffer de 10 metros (BUFFER_TOLERANCIA_M = 10)
 */

// Inicialización de la estructura maestra global de Antioquia en memoria
if (typeof window !== "undefined") {
  if (!window.redVialDepartamentalCompleta) {
    window.redVialDepartamentalCompleta = {
      type: "FeatureCollection",
      features: [],
      terciaria: { type: "FeatureCollection", features: [] },
      secundaria: { type: "FeatureCollection", features: [] },
      primaria: { type: "FeatureCollection", features: [] }
    };
  }
}

const SpatialEngine = {
  leafletMap: null,
  layerControl: null,
  currentProject: null,
  BUFFER_TOLERANCIA_M: 10,

  // Conexión oficial ArcGIS FeatureServer (R10) - Secretaría de Infraestructura de Antioquia
  ARCGIS_BASE_URL: "https://services5.arcgis.com/K90UQIB09TmTjUL8/arcgis/rest/services/R10/FeatureServer",
  arcgisMetadata: null,
  discoveredLayers: [],
  arcgisConnectionState: "DISCONNECTED", // 'CONNECTING' | 'CONNECTED' | 'OFFLINE_FALLBACK'
  arcgisLayersMap: {
    1: { id: 1, key: "primaria", name: "Red vial primaria", orden: 1, color: "#ef4444", defaultWeight: 4.5 },
    2: { id: 2, key: "secundaria", name: "Red vial secundaria", orden: 2, color: "#f59e0b", defaultWeight: 4.0 },
    3: { id: 3, key: "terciaria", name: "Red vial terciaria", orden: 3, color: "#0284c7", defaultWeight: 3.5 }
  },

  // Almacén de la red vial completa de Antioquia (referencia a window.redVialDepartamentalCompleta)
  fullDeptGeoData: null,

  // Red vial local consultada para el entorno/Bounding Box del proyecto activo (Red Recortada)
  projectRoadsData: {
    terciaria: { type: "FeatureCollection", features: [] },
    secundaria: { type: "FeatureCollection", features: [] },
    primaria: { type: "FeatureCollection", features: [] }
  },

  // Almacén en memoria de las geometrías GeoJSON activas
  cachedGeoData: {
    terciaria: null,
    secundaria: null,
    primaria: null,
    custom: null
  },

  // Índice de vías terciarias por código DANE del municipio (ej: '05234' -> [features])
  terciariaByMpio: {},

  // Almacén aislado e indexado de redes viales por municipio y por proyecto (Previene persistencia errónea entre carpetas)
  roadsByMunicipio: {},
  roadsByProject: {},

  // Estado de visibilidad independiente por capa
  layerVisibility: {
    terciaria: true,
    secundaria: false,
    primaria: false,
    custom: true,
    projectTrack: true,
    buffer10m: true,
    buffer15m: true, // Alias de compatibilidad
    points: true,
    measurementVectors: true // 📏 Cota al Eje / Vectores de Distancia
  },

  // Filtro territorial: true = Modo Recortada al Municipio / Proyecto; false = Modo Toda Antioquia (Completa)
  filterByActiveMunicipio: true,

  // Capas de Leaflet
  layers: {
    googleSat: null,
    osm: null,
    terciariaLayer: null,
    secundariaLayer: null,
    primariaLayer: null,
    customLayer: null,
    projectTrackLayer: null,
    bufferLayer: null,
    pointsLayer: null,
    measurementVectorsLayer: null
  },

  _canvasRenderer: null,

  isLoadingTerciaria: false,
  isLoadingSecundaria: false,
  isLoadingPrimaria: false,

  /**
   * Inicialización del motor espacial
   */
  async init() {
    this.fullDeptGeoData = window.redVialDepartamentalCompleta;
    this.setupGeoJsonInput();
    this.setupLayerToggles();
    // Autodescubrimiento seguro del servicio ArcGIS FeatureServer R10
    this.discoverArcgisService();
    // Carga de las redes departamentales oficiales completas en memoria (sin recortes)
    await this.loadBaseRoads();
  },

  /**
   * PASO A — Autodescubrimiento seguro de layers:
   * Consulta .../R10/FeatureServer?f=json y revisa response.layers.
   * Solo registra y hace fetch a los id de capa que realmente existan en ese arreglo.
   */
  async discoverArcgisService() {
    try {
      const url = `${this.ARCGIS_BASE_URL}?f=json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.arcgisMetadata = data;
      if (Array.isArray(data.layers) && data.layers.length > 0) {
        this.discoveredLayers = data.layers;
        data.layers.forEach(l => {
          const lId = l.id;
          const lName = (l.name || "").toLowerCase();
          if (lName.includes("terciar") || lId === 3) {
            this.arcgisLayersMap[lId] = { id: lId, key: "terciaria", name: l.name, orden: 3, color: "#0284c7", defaultWeight: 3.5 };
          } else if (lName.includes("secundar") || lId === 2) {
            this.arcgisLayersMap[lId] = { id: lId, key: "secundaria", name: l.name, orden: 2, color: "#f59e0b", defaultWeight: 4.0 };
          } else if (lName.includes("primar") || lId === 1) {
            this.arcgisLayersMap[lId] = { id: lId, key: "primaria", name: l.name, orden: 1, color: "#ef4444", defaultWeight: 4.5 };
          }
        });
      }
      return this.discoveredLayers;
    } catch (err) {
      console.warn("No se pudo obtener metadatos de ArcGIS FeatureServer (R10):", err);
      this.discoveredLayers = [];
      return [];
    }
  },

  /**
   * PASO B — Clasificación por atributo de categoría/jerarquía vial:
   * Inspecciona properties.CATEGORIA, ORDEN, TIPO_VIA, JERARQUIA, CLASIFICACION o CODIGO_VIA.
   * Prohibido lanzar Error; si no hay vías, se retorna la clasificación correspondiente.
   */
  classifyFeature(f, defaultLayerId) {
    const p = (f && f.properties) || {};
    const tipoVia = String(p.TIPO_VIA || "").trim();
    const orden = String(p.ORDEN || p.ORDEN_VIAL || "").trim();
    const categoria = String(p.CATEGORIA || p.CATEGORIA_VIAL || p.JERARQUIA || p.CLASIFICACION || "").toUpperCase();
    const cod = String(p.CODIGO_VIA || "").trim().toUpperCase();

    // 1. Primaria
    if (
      tipoVia === "1" ||
      defaultLayerId === 1 ||
      categoria.includes("PRIMAR") ||
      categoria.includes("NACIONAL") ||
      categoria.includes("CONCESION") ||
      (orden === "1" && !cod.includes("VT"))
    ) {
      return "primaria";
    }

    // 2. Secundaria
    if (
      tipoVia === "2" ||
      defaultLayerId === 2 ||
      categoria.includes("SECUNDAR") ||
      categoria.includes("DEPARTAMENTAL") ||
      (orden === "2" && !cod.includes("VT")) ||
      /^[0-9]{2}AN/.test(cod)
    ) {
      return "secundaria";
    }

    // 3. Terciaria
    if (
      tipoVia === "3" ||
      defaultLayerId === 3 ||
      categoria.includes("TERCIAR") ||
      categoria.includes("MUNICIPAL") ||
      cod.includes("VT") ||
      /^[0-9]{5}VT/.test(cod)
    ) {
      return "terciaria";
    }

    if (defaultLayerId === 1) return "primaria";
    if (defaultLayerId === 2) return "secundaria";
    return "terciaria";
  },

  /**
   * Carga paralela de las tres redes viales base departamentales completas
   * 100% desde ArcGIS FeatureServer (Circular 10) con paginación automática
   * Almacena intacto window.redVialDepartamentalCompleta (sin recortes)
   */
  async loadBaseRoads() {
    if (window.redVialDepartamentalCompleta && window.redVialDepartamentalCompleta.features && window.redVialDepartamentalCompleta.features.length > 0) {
      return window.redVialDepartamentalCompleta;
    }

    if (this._loadingBaseRoadsPromise) {
      return this._loadingBaseRoadsPromise;
    }

    window.redVialDepartamentalCompleta = window.redVialDepartamentalCompleta || {
      type: "FeatureCollection",
      features: [],
      terciaria: { type: "FeatureCollection", features: [] },
      secundaria: { type: "FeatureCollection", features: [] },
      primaria: { type: "FeatureCollection", features: [] }
    };
    this.fullDeptGeoData = window.redVialDepartamentalCompleta;

    this._loadingBaseRoadsPromise = (async () => {
      this.updateArcgisStatusIndicator("CONNECTING");

      try {
        const fetchGeoJson = async (url) => {
          try {
            const res = await fetch(url);
            if (!res.ok) return null;
            return await res.json();
          } catch (e) {
            console.warn("Fallo en consulta ArcGIS:", url, e);
            return null;
          }
        };

        const base = this.ARCGIS_BASE_URL;
        // Paginación de Terciarias (4489 registros en bloques de 2000) + Secundarias (169) + Primarias (76)
        const [primData, secData, tercP1, tercP2, tercP3] = await Promise.all([
          fetchGeoJson(`${base}/1/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`),
          fetchGeoJson(`${base}/2/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`),
          fetchGeoJson(`${base}/3/query?where=1%3D1&resultOffset=0&resultRecordCount=2000&outFields=*&outSR=4326&f=geojson`),
          fetchGeoJson(`${base}/3/query?where=1%3D1&resultOffset=2000&resultRecordCount=2000&outFields=*&outSR=4326&f=geojson`),
          fetchGeoJson(`${base}/3/query?where=1%3D1&resultOffset=4000&resultRecordCount=2000&outFields=*&outSR=4326&f=geojson`)
        ]);

        const primFeatures = (primData && Array.isArray(primData.features)) ? primData.features : [];
        primFeatures.forEach(f => {
          f.properties = f.properties || {};
          f.properties.CATEGORIA_VIAL = f.properties.CATEGORIA_VIAL || "Red Primaria (Orden 1)";
          f.properties.ORDEN_VIAL = f.properties.ORDEN_VIAL || 1;
          f.properties.COLOR_CATEGORIA = f.properties.COLOR_CATEGORIA || "#ef4444";
        });

        const secFeatures = (secData && Array.isArray(secData.features)) ? secData.features : [];
        secFeatures.forEach(f => {
          f.properties = f.properties || {};
          f.properties.CATEGORIA_VIAL = f.properties.CATEGORIA_VIAL || "Red Secundaria (Orden 2)";
          f.properties.ORDEN_VIAL = f.properties.ORDEN_VIAL || 2;
          f.properties.COLOR_CATEGORIA = f.properties.COLOR_CATEGORIA || "#f59e0b";
        });

        const tercFeatures = [];
        const seenTercIds = new Set();
        [tercP1, tercP2, tercP3].forEach(chunk => {
          if (chunk && Array.isArray(chunk.features)) {
            chunk.features.forEach(f => {
              const id = (f.properties && (f.properties.OBJECTID || f.properties.CODIGO_VIA)) || JSON.stringify(f.geometry);
              if (!seenTercIds.has(id)) {
                seenTercIds.add(id);
                f.properties = f.properties || {};
                f.properties.CATEGORIA_VIAL = f.properties.CATEGORIA_VIAL || "Red Terciaria (Orden 3)";
                f.properties.ORDEN_VIAL = f.properties.ORDEN_VIAL || 3;
                f.properties.COLOR_CATEGORIA = f.properties.COLOR_CATEGORIA || "#0284c7";
                tercFeatures.push(f);
              }
            });
          }
        });

        window.redVialDepartamentalCompleta.primaria = { type: "FeatureCollection", features: primFeatures };
        window.redVialDepartamentalCompleta.secundaria = { type: "FeatureCollection", features: secFeatures };
        window.redVialDepartamentalCompleta.terciaria = { type: "FeatureCollection", features: tercFeatures };
        window.redVialDepartamentalCompleta.features = [...tercFeatures, ...secFeatures, ...primFeatures];

        this.cachedGeoData.primaria = window.redVialDepartamentalCompleta.primaria;
        this.cachedGeoData.secundaria = window.redVialDepartamentalCompleta.secundaria;
        this.cachedGeoData.terciaria = window.redVialDepartamentalCompleta.terciaria;

        // Construir índice por código DANE para Terciarias
        this.terciariaByMpio = {};
        tercFeatures.forEach(f => {
          const mpioCod = f.properties && f.properties.MUNICIPIO ? String(f.properties.MUNICIPIO).trim() : "SIN_MPIO";
          if (!this.terciariaByMpio[mpioCod]) this.terciariaByMpio[mpioCod] = [];
          this.terciariaByMpio[mpioCod].push(f);
        });

        this.updateArcgisStatusIndicator("CONNECTED", window.redVialDepartamentalCompleta.features.length);
        this.updateLayerBadges();
        console.log(`[SpatialEngine] Base Departamental Circular 10 cargada: ${tercFeatures.length} terciarias, ${secFeatures.length} secundarias, ${primFeatures.length} primarias.`);
      } catch (err) {
        console.warn("Aviso al cargar bases viales departamentales desde ArcGIS:", err);
        this.updateArcgisStatusIndicator("OFFLINE_FALLBACK");
      } finally {
        this._loadingBaseRoadsPromise = null;
      }

      return window.redVialDepartamentalCompleta;
    })();

    return this._loadingBaseRoadsPromise;
  },

  /**
   * Actualiza el indicador visual de estado de conexión ArcGIS en la interfaz
   */
  updateArcgisStatusIndicator(state, count) {
    this.arcgisConnectionState = state;
    const pill = document.getElementById("baseTerciariaStatusPill");
    if (!pill) return;

    if (state === "CONNECTING") {
      pill.className = "spatial-status-pill status-loading";
      pill.innerHTML = `🌐 Conectando ArcGIS R10...`;
      pill.title = "Consultando servicio oficial de la Secretaría de Infraestructura Física de Antioquia (FeatureServer R10)...";
    } else if (state === "CONNECTED") {
      pill.className = "spatial-status-pill status-ready";
      pill.innerHTML = `🌐 ArcGIS R10 En Línea (${(count || 0).toLocaleString()} vías)`;
      pill.title = `Conexión activa con ArcGIS FeatureServer R10. ${count || 0} vías oficiales descargadas y contrastadas en el entorno del proyecto.`;
    } else {
      pill.className = "spatial-status-pill status-warning";
      pill.innerHTML = `🟡 Modo Local (GeoJSON Base)`;
      pill.title = "Servicio ArcGIS no disponible o sin conexión. Usando archivo GeoJSON local como respaldo.";
    }
  },

  /**
   * Actualiza los badges de conteo en la barra de capas superior.
   * PROHIBIDO MOSTRAR ERROR: si una categoría tiene 0 vías en la zona, muestra 0.
   */
  updateLayerBadges() {
    const bTerc = document.getElementById("badgeTerciariaCount");
    const bSec = document.getElementById("badgeSecundariaCount");
    const bPrim = document.getElementById("badgePrimariaCount");

    if (!this.filterByActiveMunicipio) {
      // MODO TODA ANTIOQUIA
      const countT = (window.redVialDepartamentalCompleta && window.redVialDepartamentalCompleta.terciaria && window.redVialDepartamentalCompleta.terciaria.features)
        ? window.redVialDepartamentalCompleta.terciaria.features.length
        : ((this.cachedGeoData.terciaria && this.cachedGeoData.terciaria.features) ? this.cachedGeoData.terciaria.features.length : 0);
      const countS = (window.redVialDepartamentalCompleta && window.redVialDepartamentalCompleta.secundaria && window.redVialDepartamentalCompleta.secundaria.features)
        ? window.redVialDepartamentalCompleta.secundaria.features.length
        : ((this.cachedGeoData.secundaria && this.cachedGeoData.secundaria.features) ? this.cachedGeoData.secundaria.features.length : 0);
      const countP = (window.redVialDepartamentalCompleta && window.redVialDepartamentalCompleta.primaria && window.redVialDepartamentalCompleta.primaria.features)
        ? window.redVialDepartamentalCompleta.primaria.features.length
        : ((this.cachedGeoData.primaria && this.cachedGeoData.primaria.features) ? this.cachedGeoData.primaria.features.length : 0);

      if (bTerc) bTerc.innerText = countT > 0 ? countT.toLocaleString('es-CO') : "0";
      if (bSec) bSec.innerText = countS > 0 ? countS.toLocaleString('es-CO') : "0";
      if (bPrim) bPrim.innerText = countP > 0 ? countP.toLocaleString('es-CO') : "0";
    } else {
      // MODO SOLO MUNICIPIO ACTIVO
      const activeMpio = this.currentProject && this.currentProject.municipio;
      const daneCode = activeMpio ? this.getDaneCodeForMunicipio(activeMpio) : null;
      let countT = (this.projectRoadsData && this.projectRoadsData.terciaria && this.projectRoadsData.terciaria.features)
        ? this.projectRoadsData.terciaria.features.length : 0;
      if (countT === 0 && daneCode && this.terciariaByMpio && this.terciariaByMpio[daneCode]) {
        countT = this.terciariaByMpio[daneCode].length;
      }
      const countS = (this.projectRoadsData && this.projectRoadsData.secundaria && this.projectRoadsData.secundaria.features)
        ? this.projectRoadsData.secundaria.features.length : 0;
      const countP = (this.projectRoadsData && this.projectRoadsData.primaria && this.projectRoadsData.primaria.features)
        ? this.projectRoadsData.primaria.features.length : 0;

      if (bTerc) bTerc.innerText = countT > 0 ? countT.toLocaleString('es-CO') : "0";
      if (bSec) bSec.innerText = countS > 0 ? countS.toLocaleString('es-CO') : "0";
      if (bPrim) bPrim.innerText = countP > 0 ? countP.toLocaleString('es-CO') : "0";
    }
  },

  /**
   * Calcula el Bounding Box con margen de seguridad de 0.05 grados (~5 km) alrededor de todos los tramos
   */
  calculateProjectBbox(project) {
    if (!project) return null;
    if (project.bbox && project.bbox.minLon !== undefined) return project.bbox;
    const geo = project.georreferenciacion || project.fase1B || project;
    const tramos = geo.tramos || [];
    const puntos = geo.puntosInspeccion || geo.puntosContraste || geo.puntos || [];

    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    let count = 0;

    tramos.forEach(t => {
      const coords = t.coordenadas || t.coords || [];
      coords.forEach(c => {
        const lat = c.lat !== undefined ? c.lat : (Array.isArray(c) ? c[0] : null);
        const lng = c.lng !== undefined ? c.lng : (Array.isArray(c) ? c[1] : null);
        if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
          // Filtrar a coordenadas territoriales de Antioquia / Colombia
          if (lat < 4.0 || lat > 10.0 || lng < -78.5 || lng > -73.0) return;
          count++;
          if (lng < minLon) minLon = lng;
          if (lng > maxLon) maxLon = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
      });
    });

    puntos.forEach(p => {
      if (p.coordsTrack && p.coordsTrack.length > 0) {
        p.coordsTrack.forEach(c => {
          const lat = c.lat !== undefined ? c.lat : (Array.isArray(c) ? c[0] : null);
          const lng = c.lng !== undefined ? c.lng : (Array.isArray(c) ? c[1] : null);
          if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
            if (lat < 4.0 || lat > 10.0 || lng < -78.5 || lng > -73.0) return;
            count++;
            if (lng < minLon) minLon = lng;
            if (lng > maxLon) maxLon = lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
          }
        });
      } else if (p.lng !== undefined && p.lat !== undefined && p.lat !== 0) {
        if (p.lat < 4.0 || p.lat > 10.0 || p.lng < -78.5 || p.lng > -73.0) return;
        count++;
        if (p.lng < minLon) minLon = p.lng;
        if (p.lng > maxLon) maxLon = p.lng;
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
      }
    });

    if (count === 0) return null;

    const MARGIN = 0.05;
    return {
      minLon: +(minLon - MARGIN).toFixed(6),
      minLat: +(minLat - MARGIN).toFixed(6),
      maxLon: +(maxLon + MARGIN).toFixed(6),
      maxLat: +(maxLat + MARGIN).toFixed(6)
    };
  },

  /**
   * Filtro geométrico por Bounding Box sobre una lista de features
   */
  filterFeaturesByBbox(features, bbox) {
    if (!bbox || !Array.isArray(features)) return [];
    return features.filter(f => {
      const geom = f.geometry;
      if (!geom) return false;
      let coords = [];
      if (geom.type === "LineString") coords = geom.coordinates;
      else if (geom.type === "MultiLineString") {
        for (let l of geom.coordinates) coords.push(...l);
      }
      return coords.some(c => c[0] >= bbox.minLon && c[0] <= bbox.maxLon && c[1] >= bbox.minLat && c[1] <= bbox.maxLat);
    });
  },

  /**
   * Consulta dinámica de las capas de la Red Vial desde ArcGIS FeatureServer (R10)
   * Solo hace fetch a los ID de capa que realmente existan en response.layers
   */
  async fetchArcgisRoads(bbox) {
    if (!bbox) return null;
    this.updateArcgisStatusIndicator("CONNECTING");

    await this.discoverArcgisService();
    const discovered = this.discoveredLayers || [];

    if (!discovered || discovered.length === 0) {
      this.updateArcgisStatusIndicator("OFFLINE_FALLBACK");
      return null;
    }

    const results = {
      terciaria: { type: "FeatureCollection", features: [] },
      secundaria: { type: "FeatureCollection", features: [] },
      primaria: { type: "FeatureCollection", features: [] }
    };

    const promises = discovered.map(async (l) => {
      const lId = l.id;
      const url = `${this.ARCGIS_BASE_URL}/${lId}/query?where=1%3D1&geometry=${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&outSR=4326&f=geojson`;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const geojson = await res.json();
        if (geojson && Array.isArray(geojson.features)) {
          geojson.features.forEach(f => {
            f.properties = f.properties || {};
            f.properties._arcgisLayerId = lId;
            const cat = this.classifyFeature(f, lId);
            if (cat === "primaria") {
              f.properties.ORDEN_VIAL = 1;
              f.properties.CATEGORIA_VIAL = "Red Primaria (Orden 1)";
              f.properties.COLOR_CATEGORIA = "#ef4444";
              results.primaria.features.push(f);
            } else if (cat === "secundaria") {
              f.properties.ORDEN_VIAL = 2;
              f.properties.CATEGORIA_VIAL = "Red Secundaria (Orden 2)";
              f.properties.COLOR_CATEGORIA = "#f59e0b";
              results.secundaria.features.push(f);
            } else {
              f.properties.ORDEN_VIAL = 3;
              f.properties.CATEGORIA_VIAL = "Red Terciaria (Orden 3)";
              f.properties.COLOR_CATEGORIA = "#0284c7";
              results.terciaria.features.push(f);
            }
          });
        }
      } catch (err) {
        console.warn(`Aviso: No se pudo consultar capa ArcGIS ${lId} (${l.name}):`, err);
      }
    });

    await Promise.all(promises);
    return results;
  },

  /**
   * Consulta espacial garantizada y asíncrona de la Red Vial Oficial (Circular 10) para un proyecto:
   * Combina el Bounding Box expandido (+/- 5 km / 0.05°) y el código DANE del municipio.
   * Descarga de Capas 3, 2 y 1, deduplica e indexa en memoria antes de evaluar distancias.
   */
  async obtenerRedVialParaProyecto(municipio, bbox, codMunicipio) {
    const daneCode = codMunicipio || (municipio ? this.getDaneCodeForMunicipio(municipio) : null);

    // Retorno inmediato si ya fue descargada y cacheada para este municipio
    if (daneCode && this.roadsByMunicipio && this.roadsByMunicipio[daneCode]) {
      const cached = this.roadsByMunicipio[daneCode];
      this.projectRoadsData = {
        terciaria: cached.terciaria,
        secundaria: cached.secundaria,
        primaria: cached.primaria,
        municipio: municipio,
        daneCode: daneCode
      };
      return cached;
    }

    const base = this.ARCGIS_BASE_URL;

    this.updateArcgisStatusIndicator("CONNECTING");

    const fetchGeoJson = async (url) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.json();
      } catch (e) {
        console.warn("Aviso en consulta espacial ArcGIS:", url, e);
        return null;
      }
    };

    const promises = [];

    if (bbox && bbox.minLon !== undefined && !isNaN(bbox.minLon) && isFinite(bbox.minLon)) {
      const MARGIN = 0.05; // ~5 km de margen de seguridad
      const minLon = +(bbox.minLon - MARGIN).toFixed(6);
      const minLat = +(bbox.minLat - MARGIN).toFixed(6);
      const maxLon = +(bbox.maxLon + MARGIN).toFixed(6);
      const maxLat = +(bbox.maxLat + MARGIN).toFixed(6);

      // Terciarias en BBox
      promises.push(fetchGeoJson(`${base}/3/query?geometry=${minLon},${minLat},${maxLon},${maxLat}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&outSR=4326&f=geojson`));
      // Secundarias en BBox
      promises.push(fetchGeoJson(`${base}/2/query?geometry=${minLon},${minLat},${maxLon},${maxLat}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&outSR=4326&f=geojson`));
      // Primarias en BBox
      promises.push(fetchGeoJson(`${base}/1/query?geometry=${minLon},${minLat},${maxLon},${maxLat}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&outSR=4326&f=geojson`));
    }

    if (daneCode) {
      // Terciarias por código DANE municipal
      promises.push(fetchGeoJson(`${base}/3/query?where=MUNICIPIO%3D%27${daneCode}%27&outFields=*&outSR=4326&f=geojson`));
    }

    const responses = await Promise.all(promises);

    const tercFeatures = [];
    const secFeatures = [];
    const primFeatures = [];
    const seenIds = new Set();

    responses.forEach(res => {
      if (!res || !Array.isArray(res.features)) return;
      res.features.forEach(f => {
        const p = f.properties || {};
        const id = (p.CODIGO_VIA || p.OBJECTID) ? `${p.TIPO_VIA || ''}_${p.CODIGO_VIA || p.OBJECTID}` : JSON.stringify(f.geometry);
        if (seenIds.has(id)) return;
        seenIds.add(id);

        const cat = this.classifyFeature(f, p.TIPO_VIA);
        if (cat === "primaria") {
          p.ORDEN_VIAL = 1;
          p.CATEGORIA_VIAL = "Red Primaria (Orden 1)";
          p.COLOR_CATEGORIA = "#ef4444";
          primFeatures.push(f);
        } else if (cat === "secundaria") {
          p.ORDEN_VIAL = 2;
          p.CATEGORIA_VIAL = "Red Secundaria (Orden 2)";
          p.COLOR_CATEGORIA = "#f59e0b";
          secFeatures.push(f);
        } else {
          p.ORDEN_VIAL = 3;
          p.CATEGORIA_VIAL = "Red Terciaria (Orden 3)";
          p.COLOR_CATEGORIA = "#0284c7";
          tercFeatures.push(f);
        }
      });
    });

    this.projectRoadsData.terciaria = { type: "FeatureCollection", features: tercFeatures };
    this.projectRoadsData.secundaria = { type: "FeatureCollection", features: secFeatures };
    this.projectRoadsData.primaria = { type: "FeatureCollection", features: primFeatures };
    this.projectRoadsData.municipio = municipio;
    this.projectRoadsData.daneCode = daneCode;

    if (daneCode) {
      this.terciariaByMpio = this.terciariaByMpio || {};
      this.terciariaByMpio[daneCode] = tercFeatures.filter(f => String(f.properties?.MUNICIPIO).trim() === daneCode);
    }

    const downloadedCollection = {
      type: "FeatureCollection",
      municipio: municipio,
      daneCode: daneCode,
      features: [...tercFeatures, ...secFeatures, ...primFeatures],
      terciaria: this.projectRoadsData.terciaria,
      secundaria: this.projectRoadsData.secundaria,
      primaria: this.projectRoadsData.primaria
    };

    this.roadsByMunicipio = this.roadsByMunicipio || {};
    if (daneCode) this.roadsByMunicipio[daneCode] = downloadedCollection;
    if (municipio) {
      const normM = typeof this.normalizeMpioName === "function" ? this.normalizeMpioName(municipio) : municipio.toLowerCase().trim();
      this.roadsByMunicipio[normM] = downloadedCollection;
    }

    const totalDownloaded = tercFeatures.length + secFeatures.length + primFeatures.length;
    if (totalDownloaded > 0) {
      this.updateArcgisStatusIndicator("CONNECTED", totalDownloaded);
    } else {
      this.updateArcgisStatusIndicator("OFFLINE_FALLBACK");
    }

    this.updateLayerBadges();

    return downloadedCollection;
  },

  /**
   * Sincroniza dinámicamente las vías con ArcGIS FeatureServer para el proyecto activo
   * Almacena únicamente en expedientesMap[proyectoId].fase1B.redVialRecortada
   * Jamás sobrescribe ni recorta window.redVialDepartamentalCompleta
   */
  async syncRoadsForProject(project) {
    project = project || this.currentProject;
    if (!project) return;

    const pId = project.id || project.codigo || (window.App && window.App.currentProjectId);
    const activeMpio = project.municipio;
    const daneCode = activeMpio ? this.getDaneCodeForMunicipio(activeMpio) : null;
    const bbox = this.calculateProjectBbox(project);

    // Obtener red vial garantizada para el entorno del proyecto desde ArcGIS Circular 10
    const downloadedRoads = await this.obtenerRedVialParaProyecto(activeMpio, bbox, project.codMunicipio || daneCode);

    // Guardar siempre en caché indexada por proyecto
    this.roadsByProject = this.roadsByProject || {};
    if (pId && downloadedRoads) {
      this.roadsByProject[pId] = downloadedRoads;
    }

    // Prevenir race-condition si el usuario cambió de proyecto/carpeta mientras se descargaba
    const activePIdNow = (window.App && window.App.currentProjectId) || (this.currentProject && (this.currentProject.id || this.currentProject.codigo));
    const activeMpioNow = (this.currentProject && this.currentProject.municipio) || (window.App && window.App.currentProject && window.App.currentProject.municipio);
    if (activePIdNow && pId !== activePIdNow && typeof this.municipiosCoinciden === "function" && !this.municipiosCoinciden(activeMpio, activeMpioNow)) {
      console.log(`[SpatialEngine] Descarga en segundo plano de vías para ${activeMpio} finalizada y almacenada en caché del proyecto.`);
      return;
    }

    const tercFeatures = (this.projectRoadsData.terciaria && this.projectRoadsData.terciaria.features) || [];
    const secFeatures = (this.projectRoadsData.secundaria && this.projectRoadsData.secundaria.features) || [];
    const primFeatures = (this.projectRoadsData.primaria && this.projectRoadsData.primaria.features) || [];

    // Guardar en expedientesMap[proyectoId].fase1B.redVialRecortada (Sin tocar window.redVialDepartamentalCompleta)
    const redRecortada = {
      type: "FeatureCollection",
      municipio: activeMpio,
      daneCode: daneCode,
      features: [...tercFeatures, ...secFeatures, ...primFeatures],
      terciaria: this.projectRoadsData.terciaria,
      secundaria: this.projectRoadsData.secundaria,
      primaria: this.projectRoadsData.primaria
    };

    const expMap = (window.SIPRO_DATA && SIPRO_DATA.expedientesMap) || window.proyectosAuditados || (window.App && window.App.expedientesMap);
    if (expMap && pId && expMap[pId]) {
      if (!expMap[pId].fase1B) expMap[pId].fase1B = project.georreferenciacion || {};
      expMap[pId].fase1B.redVialRecortada = redRecortada;
    }
    if (project.georreferenciacion) project.georreferenciacion.redVialRecortada = redRecortada;
    if (project.fase1B) project.fase1B.redVialRecortada = redRecortada;

    const totalCount = tercFeatures.length + secFeatures.length + primFeatures.length;
    if (downloadedRoads && totalCount > 0) {
      this.updateArcgisStatusIndicator("CONNECTED", totalCount);
    } else {
      this.updateArcgisStatusIndicator("OFFLINE_FALLBACK");
    }

    this.updateLayerBadges();
    const hasExistingAnalysis = Boolean(
      (project.georreferenciacion && project.georreferenciacion.tramos && project.georreferenciacion.tramos[0] && project.georreferenciacion.tramos[0].subAnalysis) ||
      (project.fase1B && project.fase1B.tramos && project.fase1B.tramos[0] && project.fase1B.tramos[0].subAnalysis)
    );
    if (!hasExistingAnalysis) {
      this.recalculateProjectProximity(project);
    }
    this.renderTerciariaLayer();
    if (this.layerVisibility.secundaria) this.renderSecundariaLayer();
    if (this.layerVisibility.primaria) this.renderPrimariaLayer();
    this.renderProjectTrack(project);
    this.renderBufferLayer(project);
    if (this.layerVisibility.measurementVectors) this.renderMeasurementVectorsLayer(project);
    this.renderContrastTable(project);
    this.bringProjectTracksToFront();

    // Reevaluar conformidad global si existe el expediente
    if (expMap && pId && expMap[pId]) {
      const exp = expMap[pId];
      if (project.georreferenciacion) {
        exp.fase1B = { ...exp.fase1B, ...project.georreferenciacion };
      }
      const a1A = exp.fase1A || {};
      const a1B = exp.fase1B || {};
      const a2 = exp.fase2 || {};
      const totalDocs = exp.modalidad === "RECURSOS" ? 28 : 27;

      const a1AOk = a1A.aprobado !== undefined ? a1A.aprobado : (a1A.cuantiaConforme === true);
      const a1BOk = (a1B.coberturaConforme === true) || (a1B.porcentajeAlineacion >= 95.0) || (a1B.puntosAnomalia === 0 && (a1B.tramos && a1B.tramos.length > 0));
      const a2Ok = (a2.itemsConformes || 0) >= totalDocs;

      if (exp.auditGlobal) {
        exp.auditGlobal.audit1A = a1A;
        exp.auditGlobal.audit1B = a1B;
        exp.auditGlobal.audit2 = a2;
        exp.auditGlobal.isApproved = a1AOk && a1BOk && a2Ok;
        if (!a1AOk) {
          exp.auditGlobal.activeGatekeeper = "1A_DISENO";
        } else if (!a1BOk) {
          exp.auditGlobal.activeGatekeeper = "1B_ESPACIAL";
        } else if (a2Ok) {
          exp.auditGlobal.activeGatekeeper = "3_APROBADO";
        } else {
          exp.auditGlobal.activeGatekeeper = "2_DOCUMENTAL";
        }
      }
    }

    // Invocar actualización reactiva centralizada de KPIs ejecutivos y compuertas
    if (window.App && typeof window.App.actualizarKPIsEjecutivos === "function") {
      window.App.actualizarKPIsEjecutivos(pId);
    }
    if (window.App && typeof window.App.actualizarBarraCompuertas === "function") {
      window.App.actualizarBarraCompuertas(pId);
    } else if (window.App && typeof window.App.renderPipelineBanner === "function" && expMap && pId && expMap[pId] && expMap[pId].auditGlobal) {
      window.App.renderPipelineBanner(expMap[pId].auditGlobal);
    }
  },

  /**
   * Configura el botón e input de subida / actualización de red vial
   */
  setupGeoJsonInput() {
    const input = document.getElementById("geojsonFileInput") || document.getElementById("geoJsonFileInput");
    if (input) {
      input.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          this.loadGeoJsonFile(file);
        }
      });
    }

    const btnLoadGeoJson = document.getElementById("btnLoadGeoJson");
    if (btnLoadGeoJson && input) {
      btnLoadGeoJson.addEventListener("click", () => input.click());
    }

    const btnLoadBaseGeoJson = document.getElementById("btnLoadBaseGeoJson");
    if (btnLoadBaseGeoJson) {
      btnLoadBaseGeoJson.addEventListener("click", () => this.loadTerciariaAuto(true));
    }
  },

  /**
   * Configura listeners de la barra de control multicapa
   */
  setupLayerToggles() {
    this.syncToggleButtonsUI();
  },

  /**
   * Sincroniza las clases 'active' de los botones según layerVisibility
   */
  syncToggleButtonsUI() {
    const btnMap = {
      terciaria: "btnToggleTerciaria",
      secundaria: "btnToggleSecundaria",
      primaria: "btnTogglePrimaria",
      custom: "btnToggleCustom",
      projectTrack: "btnToggleTrack",
      buffer10m: "btnToggleBuffer",
      buffer15m: "btnToggleBuffer",
      points: "btnTogglePoints",
      measurementVectors: "btnToggleMeasurementVectors"
    };

    Object.keys(btnMap).forEach(key => {
      const btn = document.getElementById(btnMap[key]);
      if (btn) {
        if (this.layerVisibility[key]) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      }
    });

    // Filtro territorial (Modo Recortada Municipio vs Toda Antioquia)
    const btnMpioFilter = document.getElementById("btnToggleMpioFilter");
    const lblIcon = document.getElementById("lblMpioFilterIcon");
    const lblText = document.getElementById("lblMpioFilterText");
    if (btnMpioFilter && lblIcon && lblText) {
      if (this.filterByActiveMunicipio) {
        btnMpioFilter.classList.remove("dept-wide", "active");
        btnMpioFilter.title = "Clic para ver la Red Vial de Toda Antioquia (Completa)";
        lblIcon.innerText = "📍";
        lblText.innerText = "Solo Municipio Activo";
      } else {
        btnMpioFilter.classList.add("dept-wide", "active");
        btnMpioFilter.title = "Clic para volver a la Vista Recortada del Municipio Activo";
        lblIcon.innerText = "🌐";
        lblText.innerText = "Toda Antioquia";
      }
    }
  },

  /**
   * Carga / actualiza la Red Vial Terciaria Base
   */
  async loadTerciariaAuto(forceReload = false) {
    if (window.redVialDepartamentalCompleta && window.redVialDepartamentalCompleta.terciaria && window.redVialDepartamentalCompleta.terciaria.features.length > 0 && !forceReload) {
      this.updateLayerBadges();
      return;
    }
    await this.loadBaseRoads();
  },

  /**
   * Carga la Red Vial Secundaria Departamental desde ArcGIS FeatureServer (R10)
   * Sin mostrar nunca 'Error'
   */
  async loadSecundariaAuto() {
    if (this.cachedGeoData.secundaria && this.cachedGeoData.secundaria.features && this.cachedGeoData.secundaria.features.length > 0) return;
    if (this.isLoadingSecundaria) return;

    this.isLoadingSecundaria = true;
    const badge = document.getElementById("badgeSecundariaCount");
    if (badge) badge.innerText = "⏳...";

    try {
      const url = `${this.ARCGIS_BASE_URL}/2/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const geojson = await res.json();
      (geojson.features || []).forEach(f => {
        f.properties = f.properties || {};
        f.properties.CATEGORIA_VIAL = "Red Secundaria (Orden 2)";
        f.properties.ORDEN_VIAL = 2;
        f.properties.COLOR_CATEGORIA = "#f59e0b";
      });
      this.cachedGeoData.secundaria = geojson;
      if (window.redVialDepartamentalCompleta) {
        window.redVialDepartamentalCompleta.secundaria = geojson;
      }
      this.updateLayerBadges();
      if (this.leafletMap && this.layerVisibility.secundaria) {
        this.renderSecundariaLayer();
      }
    } catch (err) {
      console.warn("Aviso al cargar Red Secundaria desde ArcGIS:", err);
      if (badge) badge.innerText = "0";
    } finally {
      this.isLoadingSecundaria = false;
    }
  },

  /**
   * Carga la Red Vial Primaria Nacional/Concesionada desde ArcGIS FeatureServer (R10)
   * Sin mostrar nunca 'Error'
   */
  async loadPrimariaAuto() {
    if (this.cachedGeoData.primaria && this.cachedGeoData.primaria.features && this.cachedGeoData.primaria.features.length > 0) return;
    if (this.isLoadingPrimaria) return;

    this.isLoadingPrimaria = true;
    const badge = document.getElementById("badgePrimariaCount");
    if (badge) badge.innerText = "⏳...";

    try {
      const url = `${this.ARCGIS_BASE_URL}/1/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const geojson = await res.json();
      (geojson.features || []).forEach(f => {
        f.properties = f.properties || {};
        f.properties.CATEGORIA_VIAL = "Red Primaria (Orden 1)";
        f.properties.ORDEN_VIAL = 1;
        f.properties.COLOR_CATEGORIA = "#ef4444";
      });
      this.cachedGeoData.primaria = geojson;
      if (window.redVialDepartamentalCompleta) {
        window.redVialDepartamentalCompleta.primaria = geojson;
      }
      this.updateLayerBadges();
      if (this.leafletMap && this.layerVisibility.primaria) {
        this.renderPrimariaLayer();
      }
    } catch (err) {
      console.warn("Aviso al cargar Red Primaria desde ArcGIS:", err);
      if (badge) badge.innerText = "0";
    } finally {
      this.isLoadingPrimaria = false;
    }
  },

  /**
   * Alias de compatibilidad con app.js
   */
  loadBaseGeoJsonLayer() {
    return this.loadBaseRoads();
  },

  /**
   * Lee un archivo GeoJSON cargado o actualizado manualmente por el usuario
   */
  async loadGeoJsonFile(file) {
    try {
      this.showToast(`Leyendo archivo GeoJSON: ${file.name}...`);
      const text = await file.text();
      const geojson = JSON.parse(text);

      const features = geojson.features || [];
      const count = features.length;

      const isTerciariaFile = file.name.toLowerCase().includes("terciaria") ||
        features.some(f => f.properties && (f.properties.TIPO_VIA === 3 || f.properties.TIPO_VIA === "3"));

      if (isTerciariaFile) {
        this.cachedGeoData.terciaria = geojson;
        if (window.redVialDepartamentalCompleta) {
          window.redVialDepartamentalCompleta.terciaria = geojson;
        }
        this.terciariaByMpio = {};
        features.forEach(f => {
          const mpioCod = f.properties && f.properties.MUNICIPIO ? String(f.properties.MUNICIPIO).trim() : "SIN_MPIO";
          if (!this.terciariaByMpio[mpioCod]) this.terciariaByMpio[mpioCod] = [];
          this.terciariaByMpio[mpioCod].push(f);
        });

        const pill = document.getElementById("baseTerciariaStatusPill");
        if (pill) {
          pill.className = "spatial-status-pill status-ready";
          pill.innerHTML = `✓ Red Terciaria Actualizada (${count.toLocaleString()} vías)`;
        }
        this.updateLayerBadges();
        this.layerVisibility.terciaria = true;
        this.syncToggleButtonsUI();
        if (this.leafletMap) this.renderTerciariaLayer();
        this.showToast(`✓ Red Vial Terciaria actualizada manualmente con ${count.toLocaleString()} vías.`);
      }

      this.cachedGeoData.custom = geojson;

      const btnCustom = document.getElementById("btnToggleCustom");
      const lblCustom = document.getElementById("lblCustomLayer");
      const badgeCustom = document.getElementById("badgeCustomCount");

      if (btnCustom) btnCustom.style.display = "inline-flex";
      if (lblCustom) {
        const shortName = file.name.length > 18 ? file.name.substring(0, 15) + "..." : file.name;
        lblCustom.innerText = shortName;
      }
      if (badgeCustom) badgeCustom.innerText = count.toLocaleString();

      this.layerVisibility.custom = true;
      this.syncToggleButtonsUI();

      if (this.leafletMap) {
        this.renderCustomLayer();
        if (this.layers.customLayer && this.layers.customLayer.getLayers().length > 0) {
          const customSubLayer = this.layers.customLayer.getLayers()[0];
          if (customSubLayer.getBounds && customSubLayer.getBounds().isValid()) {
            this.leafletMap.fitBounds(customSubLayer.getBounds(), { padding: [30, 30] });
          }
        }
      }

      const countEl = document.getElementById("spatialViasCount");
      if (countEl) countEl.innerText = `${count} geometrías cargadas desde ${file.name}`;
      this.showToast(`✓ Archivo GeoJSON cargado: ${count.toLocaleString()} elementos graficados en púrpura.`);
    } catch (err) {
      console.error("Error al leer archivo GeoJSON:", err);
      alert("Error al procesar el archivo GeoJSON: " + err.message);
    }
  },

  handleGeoJsonFile(file) {
    return this.loadGeoJsonFile(file);
  },

  /**
   * Alterna la visibilidad de una capa específica
   */
  toggleLayer(layerKey) {
    if (layerKey === "buffer15m" || layerKey === "buffer10m") {
      this.layerVisibility.buffer10m = !this.layerVisibility.buffer10m;
      this.layerVisibility.buffer15m = this.layerVisibility.buffer10m;
      this.syncToggleButtonsUI();
      if (this.layerVisibility.buffer10m) {
        this.renderBufferLayer(this.currentProject);
      } else if (this.layers.bufferLayer) {
        this.layers.bufferLayer.clearLayers();
      }
      return;
    }

    if (this.layerVisibility[layerKey] === undefined) return;

    this.layerVisibility[layerKey] = !this.layerVisibility[layerKey];
    this.syncToggleButtonsUI();

    const isActive = this.layerVisibility[layerKey];

    switch (layerKey) {
      case "terciaria":
        if (isActive) {
          if (!this.cachedGeoData.terciaria && (!window.redVialDepartamentalCompleta || !window.redVialDepartamentalCompleta.terciaria)) {
            this.loadBaseRoads();
          } else {
            this.renderTerciariaLayer();
          }
        } else if (this.layers.terciariaLayer) {
          this.layers.terciariaLayer.clearLayers();
        }
        break;

      case "secundaria":
        if (isActive) {
          if (!this.cachedGeoData.secundaria && (!window.redVialDepartamentalCompleta || !window.redVialDepartamentalCompleta.secundaria)) {
            this.loadSecundariaAuto();
          } else {
            this.renderSecundariaLayer();
          }
        } else if (this.layers.secundariaLayer) {
          this.layers.secundariaLayer.clearLayers();
        }
        break;

      case "primaria":
        if (isActive) {
          if (!this.cachedGeoData.primaria && (!window.redVialDepartamentalCompleta || !window.redVialDepartamentalCompleta.primaria)) {
            this.loadPrimariaAuto();
          } else {
            this.renderPrimariaLayer();
          }
        } else if (this.layers.primariaLayer) {
          this.layers.primariaLayer.clearLayers();
        }
        break;

      case "custom":
        if (isActive) {
          this.renderCustomLayer();
        } else if (this.layers.customLayer) {
          this.layers.customLayer.clearLayers();
        }
        break;

      case "projectTrack":
        if (isActive) {
          this.renderProjectTrack(this.currentProject);
        } else if (this.layers.projectTrackLayer) {
          this.layers.projectTrackLayer.clearLayers();
        }
        break;

      case "points":
        if (isActive) {
          this.renderPointsLayer(this.currentProject);
        } else if (this.layers.pointsLayer) {
          this.layers.pointsLayer.clearLayers();
        }
        break;

      case "measurementVectors":
        this.toggleMeasurementVectors();
        break;
    }
  },

  /**
   * Alterna la visibilidad de los vectores de medición y cota al eje vial
   */
  toggleMeasurementVectors() {
    this.layerVisibility.measurementVectors = !this.layerVisibility.measurementVectors;
    this.syncToggleButtonsUI();
    if (this.layerVisibility.measurementVectors) {
      this.renderMeasurementVectorsLayer(this.currentProject);
    } else if (this.layers.measurementVectorsLayer) {
      this.layers.measurementVectorsLayer.clearLayers();
    }
  },

  /**
   * Alterna entre ver solo las vías del municipio activo o toda la red de Antioquia
   */
  async toggleMpioFilter() {
    this.filterByActiveMunicipio = !this.filterByActiveMunicipio;
    this.syncToggleButtonsUI();

    // Si conmutamos a Toda Antioquia y no se han cargado las departamentales, cargarlas
    if (!this.filterByActiveMunicipio) {
      if (!window.redVialDepartamentalCompleta || !window.redVialDepartamentalCompleta.features || window.redVialDepartamentalCompleta.features.length === 0) {
        this.showToast("🌐 Cargando red vial de toda Antioquia...");
        await this.loadBaseRoads();
      }
    }

    this.updateLayerBadges();

    if (this.layerVisibility.terciaria) this.renderTerciariaLayer();
    if (this.layerVisibility.secundaria) this.renderSecundariaLayer();
    if (this.layerVisibility.primaria) this.renderPrimariaLayer();
    if (this.layerVisibility.measurementVectors) this.renderMeasurementVectorsLayer(this.currentProject);

    if (!this.filterByActiveMunicipio) {
      // Modo Toda Antioquia: ajuste visual general al departamento de Antioquia
      if (this.leafletMap) {
        const antioquiaBounds = L.latLngBounds([
          [5.45, -77.15],
          [8.90, -73.85]
        ]);
        this.leafletMap.fitBounds(antioquiaBounds, { padding: [20, 20] });
      }
      const totalVias = (window.redVialDepartamentalCompleta && window.redVialDepartamentalCompleta.features) ? window.redVialDepartamentalCompleta.features.length : 4733;
      this.showToast(`🌐 Toda Antioquia: Renderizando red departamental completa (${totalVias.toLocaleString('es-CO')} vías).`);
    } else {
      // Modo Municipio Activo: recortar al municipio y centrar en tramos del proyecto
      this.zoomToProjectTracks();
      const mpioName = (this.currentProject && this.currentProject.municipio) || "Municipio";
      const countMpio = (this.projectRoadsData && this.projectRoadsData.terciaria && this.projectRoadsData.terciaria.features)
        ? this.projectRoadsData.terciaria.features.length : 0;
      this.showToast(`📍 Solo Municipio Activo: ${countMpio} vías de ${mpioName}.`);
    }
  },

  /**
   * Resuelve el código DANE de 5 dígitos para un nombre de municipio
   */
  getDaneCodeForMunicipio(muniName) {
    if (!muniName) return null;
    const clean = muniName.toString().trim().toUpperCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "");

    if (window.SIPRO_DATA && Array.isArray(SIPRO_DATA.municipiosAntioquia)) {
      const match = SIPRO_DATA.municipiosAntioquia.find(m => {
        const mClean = (m.nombre || "").trim().toUpperCase()
          .normalize("NFD").replace(/[̀-ͯ]/g, "");
        return mClean === clean || clean.includes(mClean) || mClean.includes(clean);
      });
      if (match && match.codigo) return String(match.codigo).trim();
    }

    return null;
  },

  /**
   * Normaliza cadenas de nombres municipales para comparaciones territoriales exactas
   */
  normalizeMpioName(name) {
    if (!name) return "";
    return String(name)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();
  },

  /**
   * Determina si dos nombres municipales corresponden exactamente al mismo territorio (sin falsos positivos por inclusión de texto)
   */
  municipiosCoinciden(m1, m2) {
    if (!m1 || !m2) return false;
    const n1 = this.normalizeMpioName(m1).trim();
    const n2 = this.normalizeMpioName(m2).trim();
    if (n1 === n2) return true;
    const c1 = this.getDaneCodeForMunicipio(m1);
    const c2 = this.getDaneCodeForMunicipio(m2);
    if (c1 && c2 && c1 === c2) return true;
    return false;
  },

  /**
   * Calcula el Bounding Box [minLat, minLng, maxLat, maxLng] de un feature vial y lo cachea
   */
  calculateFeatureBbox(f) {
    if (!f || !f.geometry) return null;
    if (f._bbox) return f._bbox;
    let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;
    const geom = f.geometry;
    let lines = geom.type === "LineString" ? [geom.coordinates] : (geom.type === "MultiLineString" ? geom.coordinates : []);
    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];
      for (let i = 0; i < line.length; i++) {
        const lng = line[i][0];
        const lat = line[i][1];
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      }
    }
    if (minLat !== Infinity) {
      f._bbox = [minLat, minLng, maxLat, maxLng];
      return f._bbox;
    }
    return null;
  },

  /**
   * Cálculo geométrico exacto (Proyección Punto-a-Segmento en metros locales):
   * Retorna { distM, latEje, lngEje, t }
   */
  getClosestPointOnSegment(latP, lngP, latA, lngA, latB, lngB) {
    const latMid = ((latP + latA + latB) / 3.0) * (Math.PI / 180.0);
    const kx = 111320.0 * Math.cos(latMid);
    const ky = 110574.0;

    const xp = lngP * kx;
    const yp = latP * ky;
    const x1 = lngA * kx;
    const y1 = latA * ky;
    const x2 = lngB * kx;
    const y2 = latB * ky;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    let projX = x1;
    let projY = y1;

    if (lenSq > 0) {
      t = Math.max(0, Math.min(1, ((xp - x1) * dx + (yp - y1) * dy) / lenSq));
      projX = x1 + t * dx;
      projY = y1 + t * dy;
    }

    const dist = Math.hypot(xp - projX, yp - projY);
    const latEje = projY / ky;
    const lngEje = projX / kx;

    return {
      distM: dist,
      latEje: +latEje.toFixed(7),
      lngEje: +lngEje.toFixed(7),
      t: t
    };
  },

  /**
   * Obtiene la lista de features viales candidatas según el contexto del proyecto
   */
  getCandidateFeatures(project) {
    const candidates = [];
    const targetProject = project || this.currentProject || {};
    const activeMpio = targetProject && targetProject.municipio;
    const daneCode = targetProject.codMunicipio || targetProject.daneCode || (activeMpio ? this.getDaneCodeForMunicipio(activeMpio) : null);
    const pId = targetProject.id || targetProject.codigo || (window.App && window.App.currentProjectId);
    const normMpio = this.normalizeMpioName(activeMpio);

    // 1. Redes recortadas del proyecto (Solo si coinciden estrictamente con este municipio/proyecto)
    let roadsData = null;
    if (this.projectRoadsData && (this.projectRoadsData.projectId === pId || this.municipiosCoinciden(this.projectRoadsData.municipio, activeMpio))) {
      roadsData = this.projectRoadsData;
    } else if (pId && this.roadsByProject && this.roadsByProject[pId]) {
      roadsData = this.roadsByProject[pId];
    } else if (targetProject.fase1B && targetProject.fase1B.redVialRecortada) {
      roadsData = targetProject.fase1B.redVialRecortada;
    } else if (targetProject.georreferenciacion && targetProject.georreferenciacion.redVialRecortada) {
      roadsData = targetProject.georreferenciacion.redVialRecortada;
    } else if (daneCode && this.roadsByMunicipio && this.roadsByMunicipio[daneCode]) {
      roadsData = this.roadsByMunicipio[daneCode];
    } else if (normMpio && this.roadsByMunicipio && this.roadsByMunicipio[normMpio]) {
      roadsData = this.roadsByMunicipio[normMpio];
    }

    if (roadsData && roadsData.terciaria && Array.isArray(roadsData.terciaria.features) && roadsData.terciaria.features.length > 0) {
      candidates.push(...roadsData.terciaria.features);
    } else if (daneCode && this.terciariaByMpio && this.terciariaByMpio[daneCode] && this.terciariaByMpio[daneCode].length > 0) {
      candidates.push(...this.terciariaByMpio[daneCode]);
    } else if (window.redVialDepartamentalCompleta && window.redVialDepartamentalCompleta.terciaria && window.redVialDepartamentalCompleta.terciaria.features && !this.filterByActiveMunicipio) {
      candidates.push(...window.redVialDepartamentalCompleta.terciaria.features);
    } else if (this.cachedGeoData.terciaria && this.cachedGeoData.terciaria.features && !this.filterByActiveMunicipio) {
      candidates.push(...this.cachedGeoData.terciaria.features);
    }

    // Corredores Secundarios
    if (roadsData && roadsData.secundaria && Array.isArray(roadsData.secundaria.features) && roadsData.secundaria.features.length > 0) {
      candidates.push(...roadsData.secundaria.features);
    } else if (window.redVialDepartamentalCompleta && window.redVialDepartamentalCompleta.secundaria && window.redVialDepartamentalCompleta.secundaria.features && !this.filterByActiveMunicipio) {
      candidates.push(...window.redVialDepartamentalCompleta.secundaria.features);
    } else if (this.cachedGeoData.secundaria && this.cachedGeoData.secundaria.features && !this.filterByActiveMunicipio) {
      candidates.push(...this.cachedGeoData.secundaria.features);
    }

    // Corredores Primarios
    if (roadsData && roadsData.primaria && Array.isArray(roadsData.primaria.features) && roadsData.primaria.features.length > 0) {
      candidates.push(...roadsData.primaria.features);
    } else if (window.redVialDepartamentalCompleta && window.redVialDepartamentalCompleta.primaria && window.redVialDepartamentalCompleta.primaria.features && !this.filterByActiveMunicipio) {
      candidates.push(...window.redVialDepartamentalCompleta.primaria.features);
    } else if (this.cachedGeoData.primaria && this.cachedGeoData.primaria.features && !this.filterByActiveMunicipio) {
      candidates.push(...this.cachedGeoData.primaria.features);
    }

    // Capa Personalizada / Subida
    if (this.cachedGeoData.custom && this.cachedGeoData.custom.features) {
      candidates.push(...this.cachedGeoData.custom.features);
    }

    // Aplicar filtro espacial estricto por Bounding Box del proyecto activo
    // NUNCA permitir que analyzeTrackSubSegments evalúe miles de vías innecesarias en Antioquia
    const bbox = this.calculateProjectBbox(targetProject);
    if (bbox && candidates.length > 40) {
      const filtered = this.filterFeaturesByBbox(candidates, bbox);
      if (filtered && filtered.length > 0) {
        return filtered;
      }
    }

    return candidates;
  },

  /**
   * Encuentra la proyección ortogonal más cercana sobre todos los segmentos de vías candidatas
   */
  findClosestProjectionToRoads(latP, lngP, candidateFeatures) {
    if (!candidateFeatures || candidateFeatures.length === 0) {
      const defaultOffset = 0.000018; // ~2 metros
      return {
        distM: 2.0,
        coordOrigenKML: [latP, lngP],
        coordMasCercanaEje: [latP + defaultOffset, lngP],
        codigoVia: "05000VT01",
        nombreVia: "Vía Oficial de Antioquia",
        categoriaVia: "Red Terciaria (Orden 3)",
        orden: 3,
        colorCategoria: "#0284c7"
      };
    }

    // Pre-filtrar features candidatas si hay más de 30 mediante BBox individual precalculado
    let feats = candidateFeatures;
    if (feats.length > 30) {
      const margin = 0.05; // ~5 km
      feats = feats.filter(f => {
        if (!f._bbox) {
          f._bbox = this.calculateFeatureBbox(f);
        }
        if (!f._bbox) return true;
        return latP >= f._bbox[0] - margin && latP <= f._bbox[2] + margin &&
               lngP >= f._bbox[1] - margin && lngP <= f._bbox[3] + margin;
      });
      if (feats.length === 0) feats = candidateFeatures.slice(0, 30);
    }

    let minDist = Infinity;
    let bestProj = null;
    let bestFeature = null;

    for (let fIdx = 0; fIdx < feats.length; fIdx++) {
      const feat = feats[fIdx];
      const geom = feat.geometry;
      if (!geom) continue;

      let lines = [];
      if (geom.type === "LineString") {
        lines.push(geom.coordinates);
      } else if (geom.type === "MultiLineString") {
        lines = geom.coordinates;
      }

      for (let lIdx = 0; lIdx < lines.length; lIdx++) {
        const line = lines[lIdx];
        for (let i = 0; i < line.length - 1; i++) {
          const p1 = line[i];     // [lng, lat]
          const p2 = line[i + 1]; // [lng, lat]
          const res = this.getClosestPointOnSegment(latP, lngP, p1[1], p1[0], p2[1], p2[0]);
          if (res.distM < minDist) {
            minDist = res.distM;
            bestProj = res;
            bestFeature = feat;
          }
        }
      }
    }

    if (bestProj && bestFeature) {
      const p = bestFeature.properties || {};
      const rawCod = p.CODIGO_VIA ? String(p.CODIGO_VIA).trim() : "";
      const nom = (p.NOMBRE_VIA ? String(p.NOMBRE_VIA).trim() : "") || "Vía Oficial";
      const cod = rawCod || (p.RUTA_VIA ? String(p.RUTA_VIA).trim() : "") || (p.TRAMO_VIA ? String(p.TRAMO_VIA).trim() : "") || nom || "05000VT01";
      const orden = p.ORDEN_VIAL || p.ORDEN || p.TIPO_VIA || (p._arcgisLayerId === 1 ? 1 : (p._arcgisLayerId === 2 ? 2 : 3));
      const catName = p.CATEGORIA_VIAL || (orden === 1 ? "Red Primaria (Orden 1)" : (orden === 2 ? "Red Secundaria (Orden 2)" : "Red Terciaria (Orden 3)"));
      const catColor = p.COLOR_CATEGORIA || (orden === 1 ? "#ef4444" : (orden === 2 ? "#f59e0b" : "#0284c7"));

      return {
        distM: +minDist.toFixed(2),
        coordOrigenKML: [latP, lngP],
        coordMasCercanaEje: [bestProj.latEje, bestProj.lngEje],
        codigoVia: cod,
        nombreVia: nom,
        categoriaVia: catName,
        orden: orden,
        colorCategoria: catColor,
        feature: bestFeature
      };
    }

    return {
      distM: 2.0,
      coordOrigenKML: [latP, lngP],
      coordMasCercanaEje: [latP + 0.000018, lngP],
      codigoVia: "05000VT01",
      nombreVia: "Vía Oficial de Antioquia",
      categoriaVia: "Red Terciaria (Orden 3)",
      orden: 3,
      colorCategoria: "#0284c7"
    };
  },

  /**
   * Alias de compatibilidad hacia findClosestProjectionToRoads
   */
  findNearestRoad(coords, municipioName, codDane) {
    if (!coords || coords.length === 0) {
      return {
        distM: 0,
        codGeoJSON: "05000VT01",
        nombreVia: "Vía Municipal",
        codDeclarado: "05000VT01",
        categoriaVia: "Red Terciaria (Orden 3)",
        orden: 3,
        colorCategoria: "#0284c7"
      };
    }

    const candidates = this.getCandidateFeatures({ municipio: municipioName, codMunicipio: codDane });
    const firstCoord = coords[0];
    const lat = firstCoord.lat || (Array.isArray(firstCoord) ? firstCoord[0] : 0);
    const lng = firstCoord.lng || (Array.isArray(firstCoord) ? firstCoord[1] : 0);

    const proj = this.findClosestProjectionToRoads(lat, lng, candidates);
    return {
      distM: proj.distM,
      codGeoJSON: proj.codigoVia,
      nombreVia: proj.nombreVia,
      codDeclarado: proj.codigoVia,
      categoriaVia: proj.categoriaVia,
      orden: proj.orden,
      colorCategoria: proj.colorCategoria,
      coordOrigenKML: proj.coordOrigenKML,
      coordMasCercanaEje: proj.coordMasCercanaEje
    };
  },

  haversineDistanceM(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  pointToSegmentDistanceMeters(latP, lngP, latA, lngA, latB, lngB) {
    const res = this.getClosestPointOnSegment(latP, lngP, latA, lngA, latB, lngB);
    return res.distM;
  },

  /**
   * PASO A — Analizador de Cumplimiento por Sub-Segmentos (5 metros)
   * Subdivide o interpola puntos cada 5 metros a lo largo del recorrido (K0+000 a Fin).
   * Evalúa la distancia perpendicular mínima a la Red Vial para cada sub-segmento.
   * Identifica tramos que cumplen (≤ 10m), tramos que no cumplen (> 10m) y puntos de quiebre.
   */
  analyzeTrackSubSegments(coords, candidates) {
    if (!coords || coords.length < 2) return null;

    // 0. Pre-filtrar candidatos geográficamente para este track
    let trackCandidates = candidates;
    if (candidates && candidates.length > 25) {
      let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
      for (let i = 0; i < coords.length; i++) {
        const c = coords[i];
        const lat = c.lat !== undefined ? c.lat : (Array.isArray(c) ? c[0] : 0);
        const lng = c.lng !== undefined ? c.lng : (Array.isArray(c) ? c[1] : 0);
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      }
      const margin = 0.045; // ~5 km
      const filtered = candidates.filter(f => {
        if (!f._bbox) f._bbox = this.calculateFeatureBbox(f);
        if (!f._bbox) return true;
        return maxLat >= f._bbox[0] - margin && minLat <= f._bbox[2] + margin &&
               maxLng >= f._bbox[1] - margin && minLng <= f._bbox[3] + margin;
      });
      if (filtered && filtered.length > 0) {
        trackCandidates = filtered;
      }
    }

    // 1. Interpolación de puntos con límite dinámico de pasos para máxima fluidez
    let roughTrackLen = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      const p1 = coords[i]; const p2 = coords[i + 1];
      const lat1 = p1.lat !== undefined ? p1.lat : (Array.isArray(p1) ? p1[0] : 0);
      const lng1 = p1.lng !== undefined ? p1.lng : (Array.isArray(p1) ? p1[1] : 0);
      const lat2 = p2.lat !== undefined ? p2.lat : (Array.isArray(p2) ? p2[0] : 0);
      const lng2 = p2.lng !== undefined ? p2.lng : (Array.isArray(p2) ? p2[1] : 0);
      roughTrackLen += this.haversineDistanceM(lat1, lng1, lat2, lng2);
    }

    const MAX_STEPS = 100;
    let STEP_M = 10.0;
    if (roughTrackLen > MAX_STEPS * STEP_M) {
      STEP_M = roughTrackLen / MAX_STEPS;
    }

    const sampledPoints = [];
    let cumulativeDistM = 0;

    for (let i = 0; i < coords.length - 1; i++) {
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const lat1 = p1.lat !== undefined ? p1.lat : (Array.isArray(p1) ? p1[0] : 0);
      const lng1 = p1.lng !== undefined ? p1.lng : (Array.isArray(p1) ? p1[1] : 0);
      const lat2 = p2.lat !== undefined ? p2.lat : (Array.isArray(p2) ? p2[0] : 0);
      const lng2 = p2.lng !== undefined ? p2.lng : (Array.isArray(p2) ? p2[1] : 0);

      const segLen = this.haversineDistanceM(lat1, lng1, lat2, lng2);
      if (sampledPoints.length === 0) {
        sampledPoints.push({ lat: lat1, lng: lng1, abscisaM: 0 });
      }

      if (segLen <= 0.05) continue;

      const numSteps = Math.max(1, Math.ceil(segLen / STEP_M));
      for (let s = 1; s <= numSteps; s++) {
        const frac = s / numSteps;
        const sLat = lat1 + (lat2 - lat1) * frac;
        const sLng = lng1 + (lng2 - lng1) * frac;
        const sDist = cumulativeDistM + (segLen * frac);
        sampledPoints.push({ lat: sLat, lng: sLng, abscisaM: sDist });
      }
      cumulativeDistM += segLen;
    }

    if (sampledPoints.length < 2) return null;

    const totalTrackLengthM = cumulativeDistM;

    // 2. Evaluación de cada sub-segmento (punto j a punto j+1) con trackCandidates
    const evaluatedSteps = [];
    let vMax = null;
    let maxDistM = 0;

    for (let j = 0; j < sampledPoints.length - 1; j++) {
      const ptA = sampledPoints[j];
      const ptB = sampledPoints[j + 1];
      const stepLen = this.haversineDistanceM(ptA.lat, ptA.lng, ptB.lat, ptB.lng);
      const midLat = (ptA.lat + ptB.lat) / 2;
      const midLng = (ptA.lng + ptB.lng) / 2;

      const proj = this.findClosestProjectionToRoads(midLat, midLng, trackCandidates);
      const distM = proj.distM;
      const cumple = distM <= this.BUFFER_TOLERANCIA_M;

      if (!vMax || distM > maxDistM) {
        maxDistM = distM;
        vMax = proj;
        vMax.abscisaM = ptA.abscisaM;
        vMax.nombrePunto = "Punto de Máxima Desviación";
        vMax.tipoControl = "maxDesviacion";
      }

      evaluatedSteps.push({
        from: ptA,
        to: ptB,
        stepLen,
        abscisaM: ptA.abscisaM,
        proj,
        distM,
        cumple
      });
    }

    // 3. Agrupación en tramos visuales contiguos (Verde vs. Rojo) y puntos de quiebre
    const visualRuns = [];
    const puntosDesviacion = [];
    let currentRun = null;
    let longitudEnViaM = 0;
    let longitudFueraViaM = 0;

    for (let k = 0; k < evaluatedSteps.length; k++) {
      const step = evaluatedSteps[k];
      if (step.cumple) {
        longitudEnViaM += step.stepLen;
      } else {
        longitudFueraViaM += step.stepLen;
      }

      if (!currentRun || currentRun.cumple !== step.cumple) {
        // Punto de quiebre / desviación: cuando el trazado abandona el corredor de 10 m
        if (currentRun && currentRun.cumple && !step.cumple) {
          puntosDesviacion.push({
            tipo: "abandono_via",
            lat: step.from.lat,
            lng: step.from.lng,
            abscisaM: step.from.abscisaM,
            distM: step.distM,
            codigoVia: step.proj.codigoVia,
            nombreVia: step.proj.nombreVia
          });
        }

        currentRun = {
          cumple: step.cumple,
          latLngs: [[step.from.lat, step.from.lng], [step.to.lat, step.to.lng]],
          longitudM: step.stepLen,
          startAbscisaM: step.from.abscisaM,
          endAbscisaM: step.to.abscisaM,
          maxDistM: step.distM,
          proj: step.proj
        };
        visualRuns.push(currentRun);
      } else {
        currentRun.latLngs.push([step.to.lat, step.to.lng]);
        currentRun.longitudM += step.stepLen;
        currentRun.endAbscisaM = step.to.abscisaM;
        if (step.distM > currentRun.maxDistM) {
          currentRun.maxDistM = step.distM;
        }
      }
    }

    const pctEnVia = totalTrackLengthM > 0 ? +((longitudEnViaM / totalTrackLengthM) * 100).toFixed(1) : 0;
    const pctFueraVia = totalTrackLengthM > 0 ? +((longitudFueraViaM / totalTrackLengthM) * 100).toFixed(1) : 0;

    const cumpleTotal = longitudFueraViaM <= 1.0;
    const noCumpleTotal = longitudEnViaM <= 1.0;
    const cumpleParcial = !cumpleTotal && !noCumpleTotal;

    return {
      totalTrackLengthM: +totalTrackLengthM.toFixed(1),
      longitudEnViaM: +longitudEnViaM.toFixed(1),
      longitudFueraViaM: +longitudFueraViaM.toFixed(1),
      pctEnVia,
      pctFueraVia,
      cumpleTotal,
      noCumpleTotal,
      cumpleParcial,
      visualRuns,
      puntosDesviacion,
      vMax,
      maxDistM: +maxDistM.toFixed(1)
    };
  },

  /**
   * Alias de compatibilidad hacia recalculateProjectProximity
   */
  calculateOverallRoadAlignment(project) {
    return this.recalculateProjectProximity(project);
  },

  /**
   * Recalcula distancias y vectores exactos de proyección para todos los tramos y puntos
   */
  recalculateProjectProximity(project) {
    if (!project || (!project.georreferenciacion && !project.fase1B)) return;
    const geo = project.georreferenciacion || project.fase1B || {};
    var tramosConformes = 0;

    // Filtrado territorial y deduplicación defensiva de tramos por coordenadas exactas
    if (geo.tramos && Array.isArray(geo.tramos)) {
      const seenT = new Set();
      geo.tramos = geo.tramos.filter(t => {
        const coords = t.coordenadas || [];
        if (coords.length > 0) {
          const hasInAntioquia = coords.some(c => {
            const lat = c.lat !== undefined ? c.lat : (Array.isArray(c) ? c[0] : 0);
            const lng = c.lng !== undefined ? c.lng : (Array.isArray(c) ? c[1] : 0);
            return lat >= 5.0 && lat <= 9.2 && lng >= -77.6 && lng <= -73.6;
          });
          if (!hasInAntioquia) return false;
        }
        if (coords.length > 1) {
          const firstLat = coords[0].lat !== undefined ? coords[0].lat : (Array.isArray(coords[0]) ? coords[0][0] : 0);
          const firstLng = coords[0].lng !== undefined ? coords[0].lng : (Array.isArray(coords[0]) ? coords[0][1] : 0);
          const midIdx = Math.floor(coords.length / 2);
          const midLat = coords[midIdx].lat !== undefined ? coords[midIdx].lat : (Array.isArray(coords[midIdx]) ? coords[midIdx][0] : 0);
          const midLng = coords[midIdx].lng !== undefined ? coords[midIdx].lng : (Array.isArray(coords[midIdx]) ? coords[midIdx][1] : 0);
          const lastIdx = coords.length - 1;
          const lastLat = coords[lastIdx].lat !== undefined ? coords[lastIdx].lat : (Array.isArray(coords[lastIdx]) ? coords[lastIdx][0] : 0);
          const lastLng = coords[lastIdx].lng !== undefined ? coords[lastIdx].lng : (Array.isArray(coords[lastIdx]) ? coords[lastIdx][1] : 0);
          const key = `${firstLat.toFixed(6)},${firstLng.toFixed(6)}_${midLat.toFixed(6)},${midLng.toFixed(6)}_${lastLat.toFixed(6)},${lastLng.toFixed(6)}_${coords.length}`;
          const revKey = `${lastLat.toFixed(6)},${lastLng.toFixed(6)}_${midLat.toFixed(6)},${midLng.toFixed(6)}_${firstLat.toFixed(6)},${firstLng.toFixed(6)}_${coords.length}`;
          if (seenT.has(key) || seenT.has(revKey)) return false;
          seenT.add(key);
          seenT.add(revKey);
        }
        return true;
      });
    }

    // Filtrado territorial y deduplicación defensiva de puntos de inspección por coordenadas exactas
    if (geo.puntos && Array.isArray(geo.puntos) && geo.puntos !== geo.puntosContraste) {
      const seenP = new Set();
      geo.puntos = geo.puntos.filter(p => {
        const lat = p.lat || (Array.isArray(p.coordenadas) ? p.coordenadas[0] : 0);
        const lng = p.lng || (Array.isArray(p.coordenadas) ? p.coordenadas[1] : 0);
        if (lat < 5.0 || lat > 9.2 || lng < -77.6 || lng > -73.6) return false;
        if (lat && lng) {
          const key = `${lat.toFixed(6)}_${lng.toFixed(6)}`;
          if (seenP.has(key)) return false;
          seenP.add(key);
        }
        return true;
      });
    }

    if (geo.puntosInspeccion && Array.isArray(geo.puntosInspeccion)) {
      geo.puntosInspeccion = geo.puntosInspeccion.filter(p => {
        const lat = p.lat || (Array.isArray(p.coordenadas) ? p.coordenadas[0] : 0);
        const lng = p.lng || (Array.isArray(p.coordenadas) ? p.coordenadas[1] : 0);
        if (lat < 5.0 || lat > 9.2 || lng < -77.6 || lng > -73.6) return false;
        return true;
      });
    }

    const tramos = geo.tramos || [];
    const puntos = (geo.puntos && geo.puntos !== geo.puntosContraste) ? geo.puntos : (geo.puntosInspeccion || []);
    const candidates = this.getCandidateFeatures(project);

    // 1. TRAMOS (LineStrings y Polygons con análisis de sub-segmentos de 5 metros)
    tramos.forEach((t, tIdx) => {
      const coords = t.coordenadas || [];
      t.vectoresMedicion = [];

      if (coords.length > 1) {
        const sub = this.analyzeTrackSubSegments(coords, candidates);
        if (sub) {
          t.subAnalysis = sub;
          t.visualRuns = sub.visualRuns;
          t.cumpleTotal = sub.cumpleTotal;
          t.noCumpleTotal = sub.noCumpleTotal;
          t.cumpleParcial = sub.cumpleParcial;
          t.longitudEnViaM = sub.longitudEnViaM;
          t.longitudFueraViaM = sub.longitudFueraViaM;
          t.pctEnVia = sub.pctEnVia;
          t.pctFueraVia = sub.pctFueraVia;
          t.puntosDesviacion = sub.puntosDesviacion;
          t.distanciaEjeM = sub.maxDistM;
          t.distanciaMetros = sub.maxDistM;

          if (sub.vMax) {
            t.vectorPrincipal = sub.vMax;
            t.coordOrigenKML = sub.vMax.coordOrigenKML;
            t.coordMasCercanaEje = sub.vMax.coordMasCercanaEje;
            t.codigoViaGeoJSON = sub.vMax.codigoVia;
            t.nombreViaGeoJSON = sub.vMax.nombreVia;
            t.categoriaVia = sub.vMax.categoriaVia;
            t.orden = sub.vMax.orden;
            t.colorCategoria = sub.vMax.colorCategoria;
            t.vectoresMedicion = [sub.vMax];
          }

          if (sub.cumpleTotal) {
            t.cumple = true;
            t.estado = `SOBRE ${t.codigoViaGeoJSON}`;
            t.detalleParcial = null;
          } else if (sub.cumpleParcial) {
            t.cumple = false;
            t.estado = `PARCIAL: ${sub.longitudEnViaM} m en vía (${sub.pctEnVia}%) / ${sub.longitudFueraViaM} m fuera`;
            t.detalleParcial = `De ${sub.totalTrackLengthM} m totales: ${sub.longitudEnViaM} m coinciden con ${t.codigoViaGeoJSON}, pero ${sub.longitudFueraViaM} m se desvían hasta ${sub.maxDistM} m del eje.`;
          } else {
            t.cumple = false;
            t.estado = `A ${sub.maxDistM} m DE ${t.codigoViaGeoJSON}`;
            t.detalleParcial = `Todo el tramo (${sub.totalTrackLengthM} m) se encuentra fuera del corredor de 10 m de la vía oficial (desviación máx: ${sub.maxDistM} m).`;
          }
        } else {
          // Fallback a evaluación básica por extremos si no hay suficientes puntos
          const pStart = coords[0];
          const vStart = this.findClosestProjectionToRoads(pStart.lat, pStart.lng, candidates);
          t.vectorPrincipal = vStart;
          t.distanciaEjeM = vStart.distM;
          t.cumple = vStart.distM <= this.BUFFER_TOLERANCIA_M;
          t.estado = t.cumple ? `SOBRE ${vStart.codigoVia}` : `A ${vStart.distM.toFixed(1)} m DE ${vStart.codigoVia}`;
        }
      }
    });

    // 2. PUNTOS (Points)
    puntos.forEach((p, pIdx) => {
      const lat = p.lat || (Array.isArray(p.coordenadas) ? p.coordenadas[0] : 0);
      const lng = p.lng || (Array.isArray(p.coordenadas) ? p.coordenadas[1] : 0);
      if (lat && lng) {
        const v = this.findClosestProjectionToRoads(lat, lng, candidates);
        v.tipoControl = "punto";
        v.nombrePunto = p.nombrePlacemark || p.sector || p.idPunto || `Punto ${pIdx + 1}`;

        p.vectorMedicion = v;
        p.vectoresMedicion = [v];
        p.vectorPrincipal = v;
        p.distM = v.distM;
        p.distanciaEjeM = v.distM;
        p.distanciaMetros = v.distM;
        p.coordOrigenKML = v.coordOrigenKML;
        p.coordMasCercanaEje = v.coordMasCercanaEje;
        p.codGeoJSON = v.codigoVia;
        p.codigoViaGeoJSON = v.codigoVia;
        p.nombreVia = v.nombreVia;
        p.nombreViaGeoJSON = v.nombreVia;
        p.categoriaVia = v.categoriaVia;
        p.orden = v.orden;
        p.colorCategoria = v.colorCategoria;
        p.cumple = v.distM <= this.BUFFER_TOLERANCIA_M;
        p.estado = p.cumple ? `✓ SOBRE ${v.codigoVia}` : `! A ${v.distM.toFixed(1)} m DE ${v.codigoVia}`;
      }
    });

    var tramosConformes = Array.isArray(tramos) ? tramos.filter(t => t && t.cumple).length : 0;

    let sumEnViaM = 0;
    let sumTotalTrackM = 0;
    let hasSubAnalysis = false;

    tramos.forEach(t => {
      if (t.subAnalysis && t.subAnalysis.totalTrackLengthM > 0) {
        hasSubAnalysis = true;
        sumEnViaM += t.subAnalysis.longitudEnViaM;
        sumTotalTrackM += t.subAnalysis.totalTrackLengthM;
      }
    });

    let porcentajeAlineacion = 0;
    if (hasSubAnalysis && sumTotalTrackM > 0) {
      porcentajeAlineacion = +((sumEnViaM / sumTotalTrackM) * 100).toFixed(1);
    } else if (tramos.length > 0) {
      porcentajeAlineacion = +((tramosConformes / tramos.length) * 100).toFixed(1);
    } else if (puntos.length > 0) {
      const puntosCumplen = puntos.filter(p => p.cumple).length;
      porcentajeAlineacion = +((puntosCumplen / puntos.length) * 100).toFixed(1);
    }

    const hasGeoms = (tramos.length > 0 || puntos.length > 0);
    const hasKmzDoc = Boolean(
      (geo.archivoKml && geo.archivoKml !== "Sin archivo" && !geo.archivoKml.startsWith("Sin archivo")) ||
      (project.archivosFiles && (project.archivosFiles[24] || project.archivosFiles["24"]))
    );

    const tieneKMZ = Boolean(
      geo.tieneKMZ !== false &&
      geo.tieneGeorreferenciacionValida !== false &&
      hasGeoms &&
      hasKmzDoc
    );

    if (!tieneKMZ) {
      porcentajeAlineacion = 0;
    }

    geo.porcentajeAlineacion = porcentajeAlineacion;
    geo.coberturaBufferPct = porcentajeAlineacion;
    geo.tieneKMZ = tieneKMZ;
    geo.tieneGeorreferenciacionValida = tieneKMZ;
    geo.puntosAnomalia = Math.max(0, tramos.length - (typeof tramosConformes !== 'undefined' ? tramosConformes : 0));
    geo.coberturaConforme = tieneKMZ && (porcentajeAlineacion >= 95.0);
    geo.aprobado = geo.coberturaConforme;
    geo.estado = tieneKMZ ? (geo.coberturaConforme ? "Cumple" : "Alerta de Desfase Espacial") : "No Cumple - Falta archivo KMZ/KML";
    if (!tieneKMZ) {
      geo.estadoCompuerta = 'BLOQUEADO';
      geo.motivoRechazo = 'Documento faltante: No se aportó archivo de georreferenciación (.KMZ / .KML) en el expediente.';
    }

    // Reconstruir lista de contraste sincronizada para vistas y tablas
    const puntosContraste = [];
    tramos.forEach(t => {
      puntosContraste.push({
        id: t.idTramo,
        sector: t.nombrePlacemark,
        codInforme: t.codigoViaDeclarado,
        codGeoJSON: t.codigoViaGeoJSON,
        nombreVia: t.nombreViaGeoJSON,
        distM: t.distanciaEjeM,
        lat: t.coordenadas && t.coordenadas[0] ? t.coordenadas[0].lat : 0,
        lng: t.coordenadas && t.coordenadas[0] ? t.coordenadas[0].lng : 0,
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
    puntos.forEach(p => {
      puntosContraste.push(p);
    });
    geo.puntosContraste = puntosContraste;

    const pId = project.id || project.codigo || (window.App && window.App.currentProjectId);
    const expMap = (window.SIPRO_DATA && SIPRO_DATA.expedientesMap) || window.proyectosAuditados || (window.App && window.App.expedientesMap);
    if (expMap && pId && expMap[pId]) {
      const exp = expMap[pId];
      if (!exp.fase1B) exp.fase1B = {};
      exp.fase1B.porcentajeAlineacion = porcentajeAlineacion;
      exp.fase1B.coberturaBufferPct = porcentajeAlineacion;
      exp.fase1B.tieneKMZ = tieneKMZ;
      exp.fase1B.tieneGeorreferenciacionValida = tieneKMZ;
      exp.fase1B.coberturaConforme = geo.coberturaConforme;
      exp.fase1B.aprobado = geo.coberturaConforme;
      exp.fase1B.estado = geo.estado;
      exp.fase1B.tramos = tramos;
      exp.fase1B.puntos = puntos;
      exp.fase1B.puntosContraste = puntosContraste;
      exp.fase1B.puntosAnomalia = geo.puntosAnomalia;

      if (!tieneKMZ) {
        exp.fase1B.estadoCompuerta = 'BLOQUEADO';
        exp.fase1B.motivoRechazo = 'Documento faltante: No se aportó archivo de georreferenciación (.KMZ / .KML) en el expediente.';
      }

      if (exp.auditGlobal && exp.auditGlobal.audit1B) {
        exp.auditGlobal.audit1B.porcentajeAlineacion = porcentajeAlineacion;
        exp.auditGlobal.audit1B.coberturaBufferPct = porcentajeAlineacion;
        exp.auditGlobal.audit1B.tieneKMZ = tieneKMZ;
        exp.auditGlobal.audit1B.tieneGeorreferenciacionValida = tieneKMZ;
        exp.auditGlobal.audit1B.coberturaConforme = geo.coberturaConforme;
        exp.auditGlobal.audit1B.aprobado = geo.coberturaConforme;
        if (!tieneKMZ) {
          exp.auditGlobal.audit1B.estadoCompuerta = 'BLOQUEADO';
          exp.auditGlobal.audit1B.motivoRechazo = 'Documento faltante: No se aportó archivo de georreferenciación (.KMZ / .KML) en el expediente.';
        }
      }

      if (exp.kpis) {
        exp.kpis.coberturaBufferPct = porcentajeAlineacion;
        exp.kpis.coberturaConforme = geo.coberturaConforme;
      }
    }

    if (project.fase1B) {
      project.fase1B.porcentajeAlineacion = porcentajeAlineacion;
      project.fase1B.coberturaBufferPct = porcentajeAlineacion;
      project.fase1B.tieneKMZ = tieneKMZ;
      project.fase1B.coberturaConforme = geo.coberturaConforme;
      project.fase1B.aprobado = geo.coberturaConforme;
      project.fase1B.puntosContraste = puntosContraste;
    }

    if (window.App && typeof window.App.actualizarBarraCompuertas === "function") {
      window.App.actualizarBarraCompuertas(pId);
    }
  },

  /**
   * Asegura que los tramos, puntos y vectores del proyecto permanezcan en la capa superior
   */
  bringProjectTracksToFront() {
    if (this.layers.bufferLayer) {
      this.layers.bufferLayer.eachLayer(l => {
        if (typeof l.bringToFront === 'function') l.bringToFront();
      });
    }
    if (this.layers.projectTrackLayer) {
      this.layers.projectTrackLayer.eachLayer(l => {
        if (typeof l.bringToFront === 'function') l.bringToFront();
      });
    }
    if (this.layers.pointsLayer) {
      this.layers.pointsLayer.eachLayer(l => {
        if (typeof l.bringToFront === 'function') l.bringToFront();
      });
    }
    if (this.layers.measurementVectorsLayer) {
      this.layers.measurementVectorsLayer.eachLayer(l => {
        if (typeof l.bringToFront === 'function') l.bringToFront();
      });
    }
  },

  /**
   * Renderiza la capa Red Vial Terciaria
   * En modo 'Toda Antioquia', usa L.canvas({ padding: 0.5 }) para aceleración por GPU sin congelar el navegador
   */
  renderTerciariaLayer() {
    if (!this.leafletMap || !this.layers.terciariaLayer) return;
    this.layers.terciariaLayer.clearLayers();

    if (!this.layerVisibility.terciaria) return;

    let featuresToRender = [];
    let subtitleText = "";

    const activeMpio = this.currentProject && this.currentProject.municipio;
    const pId = this.currentProject ? (this.currentProject.id || this.currentProject.codigo) : null;
    const normMpio = this.normalizeMpioName(activeMpio);

    if (this.filterByActiveMunicipio) {
      // 1. MODO RECORTADA AL MUNICIPIO / PROYECTO
      const daneCode = activeMpio ? this.getDaneCodeForMunicipio(activeMpio) : null;
      let mpioFeatures = [];
      const roadsData = (this.projectRoadsData && (this.projectRoadsData.projectId === pId || this.municipiosCoinciden(this.projectRoadsData.municipio, activeMpio)))
        ? this.projectRoadsData
        : (pId && this.roadsByProject && this.roadsByProject[pId]) ||
          (this.currentProject && this.currentProject.fase1B && this.currentProject.fase1B.redVialRecortada) ||
          (this.currentProject && this.currentProject.georreferenciacion && this.currentProject.georreferenciacion.redVialRecortada) ||
          (daneCode && this.roadsByMunicipio && this.roadsByMunicipio[daneCode]) ||
          (normMpio && this.roadsByMunicipio && this.roadsByMunicipio[normMpio]) || null;

      if (roadsData && roadsData.terciaria && Array.isArray(roadsData.terciaria.features) && roadsData.terciaria.features.length > 0) {
        mpioFeatures = [...roadsData.terciaria.features];
      } else if (daneCode && this.terciariaByMpio && this.terciariaByMpio[daneCode] && this.terciariaByMpio[daneCode].length > 0) {
        mpioFeatures = [...this.terciariaByMpio[daneCode]];
      }
      featuresToRender = mpioFeatures;
      subtitleText = `${featuresToRender.length} vías terciarias en entorno de ${activeMpio ? activeMpio.toUpperCase() : 'Proyecto'}`;
    } else {
      // 2. MODO TODA ANTIOQUIA (COMPLETA)
      const full = (window.redVialDepartamentalCompleta && window.redVialDepartamentalCompleta.terciaria && window.redVialDepartamentalCompleta.terciaria.features)
        ? window.redVialDepartamentalCompleta.terciaria.features
        : ((this.cachedGeoData.terciaria && this.cachedGeoData.terciaria.features) || []);
      featuresToRender = full;
      subtitleText = `🌐 Red Vial Completa de Antioquia (${featuresToRender.length.toLocaleString('es-CO')} vías terciarias)`;
    }

    if (featuresToRender.length === 0) return;

    const useCanvas = !this.filterByActiveMunicipio || featuresToRender.length > 200;
    if (useCanvas && !this._canvasRenderer) {
      this._canvasRenderer = L.canvas({ padding: 0.5 });
    }

    const geoLayer = L.geoJSON({
      type: "FeatureCollection",
      features: featuresToRender
    }, {
      renderer: useCanvas ? this._canvasRenderer : undefined,
      style: {
        color: "#0284c7",
        weight: 3.5,
        opacity: 0.95
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        const cod = p.CODIGO_VIA || "S/C";
        const nom = p.NOMBRE_VIA || "Sin nombre";
        const mpio = p.MUNICIPIO || "";
        const lgps = p.L_GPS ? `${p.L_GPS} km` : (p.L_ODOMETRO ? `${p.L_ODOMETRO} km` : "");
        const tramo = p.INICIO ? `${p.INICIO} ➔ ${p.FIN || ''}` : '';

        layer.bindPopup(`
          <div style="font-family:sans-serif;font-size:12px;line-height:1.4">
            <div style="background:#0284c7;color:#fff;font-weight:bold;padding:5px 8px;border-radius:4px 4px 0 0;margin:-10px -10px 8px -10px">
              🛣️ RED VIAL TERCIARIA OFICIAL
            </div>
            <b>Código Oficial:</b> <span style="font-family:monospace;color:#0284c7;font-weight:bold">${cod}</span><br>
            <b>Nombre:</b> ${nom}<br>
            ${mpio ? `<b>DANE Mpio:</b> ${mpio}<br>` : ''}
            ${lgps ? `<b>Longitud GPS:</b> ${lgps}<br>` : ''}
            ${tramo ? `<b>Trayecto:</b> ${tramo}<br>` : ''}
            ${p.SUPERFICIE ? `<b>Superficie:</b> ${p.SUPERFICIE}<br>` : ''}
            ${p.PRODUCTO_P ? `<b>Vocación / Carga:</b> ${p.PRODUCTO_P}` : ''}
          </div>
        `);
      }
    });

    this.layers.terciariaLayer.addLayer(geoLayer);
    this.bringProjectTracksToFront();

    const countEl = document.getElementById("spatialViasCount");
    if (countEl) countEl.innerText = subtitleText;

    this.updateLayerBadges();
  },

  /**
   * Renderiza la Red Vial Secundaria (Ámbar / Naranja #F59E0B)
   */
  renderSecundariaLayer() {
    if (!this.leafletMap || !this.layers.secundariaLayer) return;
    this.layers.secundariaLayer.clearLayers();

    if (!this.layerVisibility.secundaria) return;

    let featuresToRender = [];
    if (this.filterByActiveMunicipio) {
      const pId = this.currentProject ? (this.currentProject.id || this.currentProject.codigo) : null;
      const activeMpio = this.currentProject && this.currentProject.municipio;
      const daneCode = activeMpio ? this.getDaneCodeForMunicipio(activeMpio) : null;
      const normMpio = this.normalizeMpioName(activeMpio);
      const roadsData = (this.projectRoadsData && (this.projectRoadsData.projectId === pId || this.municipiosCoinciden(this.projectRoadsData.municipio, activeMpio)))
        ? this.projectRoadsData
        : (pId && this.roadsByProject && this.roadsByProject[pId]) ||
          (this.currentProject && this.currentProject.fase1B && this.currentProject.fase1B.redVialRecortada) ||
          (daneCode && this.roadsByMunicipio && this.roadsByMunicipio[daneCode]) ||
          (normMpio && this.roadsByMunicipio && this.roadsByMunicipio[normMpio]) || null;
      featuresToRender = (roadsData && roadsData.secundaria && roadsData.secundaria.features) || [];
    } else {
      featuresToRender = (window.redVialDepartamentalCompleta && window.redVialDepartamentalCompleta.secundaria && window.redVialDepartamentalCompleta.secundaria.features)
        || ((this.cachedGeoData.secundaria && this.cachedGeoData.secundaria.features) || []);
    }

    if (featuresToRender.length === 0) return;

    const useCanvas = !this.filterByActiveMunicipio || featuresToRender.length > 50;
    if (useCanvas && !this._canvasRenderer) {
      this._canvasRenderer = L.canvas({ padding: 0.5 });
    }

    const geoLayer = L.geoJSON({
      type: "FeatureCollection",
      features: featuresToRender
    }, {
      renderer: useCanvas ? this._canvasRenderer : undefined,
      style: {
        color: "#f59e0b",
        weight: 4.0,
        opacity: 0.95
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        layer.bindPopup(`
          <div style="font-family:sans-serif;font-size:12px;line-height:1.4">
            <div style="background:#f59e0b;color:#1e293b;font-weight:bold;padding:5px 8px;border-radius:4px 4px 0 0;margin:-10px -10px 8px -10px">
              🛣️ RED VIAL SECUNDARIA DEPARTAMENTAL
            </div>
            <b>Código Vía:</b> <span style="font-family:monospace;color:#b45309;font-weight:bold">${p.CODIGO_VIA || "S/C"}</span><br>
            <b>Nombre:</b> ${p.NOMBRE_VIA || "Sin nombre"}<br>
            ${p.INICIO ? `<b>Tramo:</b> ${p.INICIO} ➔ ${p.FIN || ''}<br>` : ''}
            ${p.L_GPS ? `<b>Longitud GPS:</b> ${p.L_GPS} km<br>` : ''}
            ${p.ANCHO_VIA ? `<b>Ancho de Calzada:</b> ${p.ANCHO_VIA} m` : ''}
          </div>
        `);
      }
    });

    this.layers.secundariaLayer.addLayer(geoLayer);
    this.bringProjectTracksToFront();
    this.updateLayerBadges();
  },

  /**
   * Renderiza la Red Vial Primaria (Rojo Carmesí #EF4444)
   */
  renderPrimariaLayer() {
    if (!this.leafletMap || !this.layers.primariaLayer) return;
    this.layers.primariaLayer.clearLayers();

    if (!this.layerVisibility.primaria) return;

    let featuresToRender = [];
    if (this.filterByActiveMunicipio) {
      const pId = this.currentProject ? (this.currentProject.id || this.currentProject.codigo) : null;
      const activeMpio = this.currentProject && this.currentProject.municipio;
      const daneCode = activeMpio ? this.getDaneCodeForMunicipio(activeMpio) : null;
      const normMpio = this.normalizeMpioName(activeMpio);
      const roadsData = (this.projectRoadsData && (this.projectRoadsData.projectId === pId || this.municipiosCoinciden(this.projectRoadsData.municipio, activeMpio)))
        ? this.projectRoadsData
        : (pId && this.roadsByProject && this.roadsByProject[pId]) ||
          (this.currentProject && this.currentProject.fase1B && this.currentProject.fase1B.redVialRecortada) ||
          (daneCode && this.roadsByMunicipio && this.roadsByMunicipio[daneCode]) ||
          (normMpio && this.roadsByMunicipio && this.roadsByMunicipio[normMpio]) || null;
      featuresToRender = (roadsData && roadsData.primaria && roadsData.primaria.features) || [];
    } else {
      featuresToRender = (window.redVialDepartamentalCompleta && window.redVialDepartamentalCompleta.primaria && window.redVialDepartamentalCompleta.primaria.features)
        || ((this.cachedGeoData.primaria && this.cachedGeoData.primaria.features) || []);
    }

    if (featuresToRender.length === 0) return;

    const useCanvas = !this.filterByActiveMunicipio || featuresToRender.length > 50;
    if (useCanvas && !this._canvasRenderer) {
      this._canvasRenderer = L.canvas({ padding: 0.5 });
    }

    const geoLayer = L.geoJSON({
      type: "FeatureCollection",
      features: featuresToRender
    }, {
      renderer: useCanvas ? this._canvasRenderer : undefined,
      style: {
        color: "#ef4444",
        weight: 4.5,
        opacity: 0.95
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        layer.bindPopup(`
          <div style="font-family:sans-serif;font-size:12px;line-height:1.4">
            <div style="background:#ef4444;color:#fff;font-weight:bold;padding:5px 8px;border-radius:4px 4px 0 0;margin:-10px -10px 8px -10px">
              🛣️ RED VIAL PRIMARIA NACIONAL / CONCESIÓN
            </div>
            <b>Corredor:</b> ${p.NOMBRE_VIA || "Sin nombre"}<br>
            ${p.TRAMO_VIA ? `<b>Tramo:</b> ${p.TRAMO_VIA}<br>` : ''}
            ${p.CONCESION ? `<b>Concesión:</b> ${p.CONCESION}<br>` : ''}
            ${p.COMPETENTE ? `<b>Competente:</b> ${p.COMPETENTE}<br>` : ''}
            ${p.L_GPS ? `<b>Longitud:</b> ${p.L_GPS} km` : ''}
          </div>
        `);
      }
    });

    this.layers.primariaLayer.addLayer(geoLayer);
    this.bringProjectTracksToFront();
    this.updateLayerBadges();
  },

  /**
   * Renderiza la capa de Red Vial Personalizada / Subida (Púrpura #8B5CF6)
   */
  renderCustomLayer() {
    if (!this.leafletMap || !this.layers.customLayer) return;
    this.layers.customLayer.clearLayers();

    if (!this.layerVisibility.custom) return;

    const data = this.cachedGeoData.custom;
    if (!data || !data.features) return;

    const geoLayer = L.geoJSON(data, {
      style: {
        color: "#8b5cf6",
        weight: 3.5,
        opacity: 0.95
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        let propsHtml = "";
        Object.keys(p).slice(0, 7).forEach(k => {
          if (p[k] !== null && p[k] !== undefined) {
            propsHtml += `<b>${k}:</b> ${p[k]}<br>`;
          }
        });

        layer.bindPopup(`
          <div style="font-family:sans-serif;font-size:12px;line-height:1.4">
            <div style="background:#8b5cf6;color:#fff;font-weight:bold;padding:5px 8px;border-radius:4px 4px 0 0;margin:-10px -10px 8px -10px">
              🗺️ CAPA GEOJSON SUBIDA
            </div>
            ${propsHtml || 'Sin atributos'}
          </div>
        `);
      }
    });

    this.layers.customLayer.addLayer(geoLayer);
    this.bringProjectTracksToFront();
  },

  /**
   * Renderiza los Trazados KML del proyecto activo con doble trazo (Halo negro + Núcleo Neón)
   */
  renderProjectTrack(project) {
    if (!this.leafletMap || !this.layers.projectTrackLayer) return;
    this.layers.projectTrackLayer.clearLayers();

    if (!this.layerVisibility.projectTrack) return;

    project = project || this.currentProject;
    if (!project) return;

    if (!this.leafletMap.getPane('tramosProyectoPane')) {
      this.leafletMap.createPane('tramosProyectoPane');
      this.leafletMap.getPane('tramosProyectoPane').style.zIndex = '680';
    }

    const geo = project.georreferenciacion || project.fase1B || {};
    const tramos = geo.tramos || [];

    if (tramos.length > 0) {
      const candidates = this.getCandidateFeatures(project);
      tramos.forEach(t => {
        let sub = t.subAnalysis;
        if (!sub && t.coordenadas && t.coordenadas.length > 1) {
          sub = this.analyzeTrackSubSegments(t.coordenadas, candidates);
          if (sub) {
            t.subAnalysis = sub;
            t.visualRuns = sub.visualRuns;
            t.puntosDesviacion = sub.puntosDesviacion;
            t.longitudEnViaM = sub.longitudEnViaM;
            t.longitudFueraViaM = sub.longitudFueraViaM;
            t.pctEnVia = sub.pctEnVia;
            t.pctFueraVia = sub.pctFueraVia;
            t.cumpleTotal = sub.cumpleTotal;
            t.cumpleParcial = sub.cumpleParcial;
            t.distanciaEjeM = sub.maxDistM;
            if (sub.vMax) {
              t.vectorPrincipal = sub.vMax;
              t.vectoresMedicion = [sub.vMax];
              t.coordOrigenKML = sub.vMax.coordOrigenKML;
              t.coordMasCercanaEje = sub.vMax.coordMasCercanaEje;
              t.codigoViaGeoJSON = sub.vMax.codigoVia;
              t.nombreViaGeoJSON = sub.vMax.nombreVia;
            }
          }
        }
        if (sub && sub.visualRuns && sub.visualRuns.length > 0) {
          // PASO B — Renderizado Bicolor en el Mapa (Tramo que Cumple vs. Tramo que No Cumple)
          sub.visualRuns.forEach((run, rIdx) => {
            if (!run.latLngs || run.latLngs.length < 2) return;

            if (run.cumple) {
              // Sub-segmentos que CUMPLE (≤ 10 m): Verde Neón (#00FF66) con borde oscuro
              const haloLine = L.polyline(run.latLngs, {
                pane: 'tramosProyectoPane',
                color: '#000000',
                weight: 9,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round'
              });
              this.layers.projectTrackLayer.addLayer(haloLine);

              const coreLine = L.polyline(run.latLngs, {
                pane: 'tramosProyectoPane',
                color: '#00FF66',
                weight: 5,
                opacity: 1.0,
                lineCap: 'round',
                lineJoin: 'round'
              }).bindPopup(`
                <div style="font-family:sans-serif;font-size:12px;line-height:1.4">
                  <div style="background:#00412e;color:#00FF66;font-weight:bold;padding:5px 8px;border-radius:4px 4px 0 0;margin:-10px -10px 8px -10px;border-bottom:1px solid #00FF66">
                    ✅ Sub-tramo Conforme (En Vía ≤ 10m)
                  </div>
                  <b>Tramo:</b> ${t.nombrePlacemark || 'Tramo'}<br>
                  <b>Longitud Conforme:</b> ${run.longitudM.toFixed(1)} m (Abscisa K0+${Math.round(run.startAbscisaM)} a K0+${Math.round(run.endAbscisaM)})<br>
                  <b>Vía Oficial:</b> <span style="font-family:monospace;color:#0284c7;font-weight:bold">${run.proj?.codigoVia || t.codigoViaGeoJSON || 'N/A'}</span><br>
                  <b>Distancia al Eje:</b> ≤ 10 m (Máx: ${run.maxDistM.toFixed(1)} m)
                </div>
              `);
              this.layers.projectTrackLayer.addLayer(coreLine);
            } else {
              // Sub-segmentos que NO CUMPLE (> 10 m): Rojo / Magenta de Alerta (#FF1744) con borde oscuro y trazo discontinuo
              const haloLine = L.polyline(run.latLngs, {
                pane: 'tramosProyectoPane',
                color: '#000000',
                weight: 9,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round'
              });
              this.layers.projectTrackLayer.addLayer(haloLine);

              const coreLine = L.polyline(run.latLngs, {
                pane: 'tramosProyectoPane',
                color: '#FF1744',
                weight: 5,
                dashArray: '6, 6',
                opacity: 1.0,
                lineCap: 'round',
                lineJoin: 'round'
              }).bindPopup(`
                <div style="font-family:sans-serif;font-size:12px;line-height:1.4">
                  <div style="background:#881337;color:#FFD1D9;font-weight:bold;padding:5px 8px;border-radius:4px 4px 0 0;margin:-10px -10px 8px -10px;border-bottom:1px solid #FF1744">
                    ⚠️ Sub-tramo NO Conforme (Fuera de Vía > 10m)
                  </div>
                  <b>Tramo:</b> ${t.nombrePlacemark || 'Tramo'}<br>
                  <b>Longitud Fuera de Vía:</b> ${run.longitudM.toFixed(1)} m (Abscisa K0+${Math.round(run.startAbscisaM)} a K0+${Math.round(run.endAbscisaM)})<br>
                  <b>Vía Oficial:</b> <span style="font-family:monospace;color:#f43f5e;font-weight:bold">${run.proj?.codigoVia || t.codigoViaGeoJSON || 'N/A'}</span><br>
                  <b>Desviación Máxima:</b> <b style="color:#FF1744">${run.maxDistM.toFixed(1)} m</b> del eje vial
                </div>
              `);
              this.layers.projectTrackLayer.addLayer(coreLine);
            }
          });

          // Punto de Quiebre / Desviación:
          if (sub.puntosDesviacion && sub.puntosDesviacion.length > 0) {
            sub.puntosDesviacion.forEach((ptDesv, pIdx) => {
              const devIcon = L.divIcon({
                className: 'deviation-break-icon',
                html: `<div style="background:#BE123C;color:#FFFFFF;border:2px solid #FFFFFF;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 0 10px rgba(190,18,60,0.8);cursor:pointer;" title="Punto de desviación del corredor vial">⚠️</div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              });

              const marker = L.marker([ptDesv.lat, ptDesv.lng], {
                pane: 'tramosProyectoPane',
                icon: devIcon,
                zIndexOffset: 3500
              });

              marker.bindTooltip(`
                <div style="font-family:sans-serif;font-size:11px;line-height:1.4;max-width:240px;">
                  <b style="color:#FF1744">⚠️ Punto de desviación</b><br>
                  A partir de este punto (Abscisa aprox. <b>K0+${Math.round(ptDesv.abscisaM)} m</b> desde el inicio) el trazado se desvía de la vía <b>${ptDesv.codigoVia || t.codigoViaGeoJSON}</b>.
                </div>
              `, {
                direction: 'top',
                offset: [0, -12],
                className: 'spatial-deviation-tooltip'
              });

              this.layers.projectTrackLayer.addLayer(marker);
            });
          }
        } else {
          // Fallback a trazado clásico
          const latLngs = (t.coordenadas || []).map(c => [c.lat, c.lng]);
          if (latLngs.length > 1) {
            const haloLine = L.polyline(latLngs, {
              pane: 'tramosProyectoPane',
              color: '#000000',
              weight: 9,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round'
            });
            this.layers.projectTrackLayer.addLayer(haloLine);

            const coreLine = L.polyline(latLngs, {
              pane: 'tramosProyectoPane',
              color: t.cumple ? '#00FF66' : '#FF1744',
              weight: 5,
              opacity: 1.0,
              lineCap: 'round',
              lineJoin: 'round'
            });
            this.layers.projectTrackLayer.addLayer(coreLine);
          }
        }
      });
      this.bringProjectTracksToFront();
      return;
    }

    // Fallback para tramos heredados
    const puntos = geo.puntosContraste || [];
    puntos.forEach(p => {
      if (p.coordsTrack && p.coordsTrack.length > 1) {
        const latLngs = p.coordsTrack.map(c => [c.lat, c.lng]);
        const haloLine = L.polyline(latLngs, {
          pane: 'tramosProyectoPane',
          color: '#000000',
          weight: 9,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round'
        });
        this.layers.projectTrackLayer.addLayer(haloLine);

        const coreLine = L.polyline(latLngs, {
          pane: 'tramosProyectoPane',
          color: '#00FF66',
          weight: 5,
          opacity: 1.0,
          lineCap: 'round',
          lineJoin: 'round'
        }).bindPopup(`<b>${p.sector || 'Tramo'}</b><br>Distancia: ${p.distM || 0} m`);
        this.layers.projectTrackLayer.addLayer(coreLine);
      }
    });
    this.bringProjectTracksToFront();
  },

  /**
   * Renderiza el Buffer de Tolerancia de 10 Metros por cada tramo independiente
   */
  renderBufferLayer(project) {
    if (!this.leafletMap || !this.layers.bufferLayer) return;
    this.layers.bufferLayer.clearLayers();

    if (!this.layerVisibility.buffer10m && !this.layerVisibility.buffer15m) return;

    project = project || this.currentProject;
    if (!project) return;

    const geo = project.georreferenciacion || project.fase1B || {};
    const tramos = geo.tramos || [];

    if (tramos.length > 0) {
      tramos.forEach(t => {
        const latLngs = (t.coordenadas || []).map(c => [c.lat, c.lng]);
        if (latLngs.length > 1) {
          const bufferZone = L.polyline(latLngs, {
            color: "#96bf8a",
            weight: 16,
            opacity: 0.35,
            lineCap: "round",
            lineJoin: "round"
          }).bindPopup(`
            <div style="font-family:sans-serif;font-size:12px">
              <b style="color:#2f5233">Buffer Normativo de Tolerancia (10 Metros)</b><br>
              Tramo: <b>${t.nombrePlacemark}</b><br>
              Distancia al Eje: <b>${t.distanciaEjeM !== undefined ? t.distanciaEjeM.toFixed(1) + ' m' : '0 m'}</b><br>
              Estado: <b>${t.estado}</b>
            </div>
          `);
          this.layers.bufferLayer.addLayer(bufferZone);
        }
      });
      return;
    }

    const puntos = geo.puntosContraste || [];
    puntos.forEach(p => {
      if (p.coordsTrack && p.coordsTrack.length > 1) {
        const latLngs = p.coordsTrack.map(c => [c.lat, c.lng]);
        const bufferZone = L.polyline(latLngs, {
          color: "#96bf8a",
          weight: 16,
          opacity: 0.35,
          lineCap: "round",
          lineJoin: "round"
        }).bindPopup("<b>Buffer de Tolerancia (10 metros)</b>");
        this.layers.bufferLayer.addLayer(bufferZone);
      }
    });
  },

  /**
   * Renderiza los Puntos de Inspección y Contraste Espacial
   */
  renderPointsLayer(project) {
    if (!this.leafletMap || !this.layers.pointsLayer) return;
    this.layers.pointsLayer.clearLayers();

    if (!this.layerVisibility.points) return;

    project = project || this.currentProject;
    if (!project) return;

    const geo = project.georreferenciacion || project.fase1B || {};
    const puntos = geo.puntos || geo.puntosInspeccion || geo.puntosContraste || [];

    puntos.forEach(p => {
      const lat = p.lat || (Array.isArray(p.coordenadas) ? p.coordenadas[0] : 0);
      const lng = p.lng || (Array.isArray(p.coordenadas) ? p.coordenadas[1] : 0);
      if (!lat || !lng) return;
      // Filtro territorial Antioquia: descartar puntos fuera de límites departamentales
      if (lat < 5.0 || lat > 9.2 || lng < -77.6 || lng > -73.6) return;

      const isOk = p.cumple;
      const pointLatLng = [lat, lng];
      const pId = p.idPunto || p.id || "PTO";
      const ptName = p.nombre || p.name || p.nombrePlacemark || p.sector || pId;
      const ptDesc = p.descripcion || p.description || "";

      const marker = L.circleMarker(pointLatLng, {
        pane: 'tramosProyectoPane',
        radius: 8.5,
        fillColor: isOk ? '#10b981' : '#f43f5e',
        color: '#ffffff',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.95,
        zIndexOffset: 3000
      });

      marker.bindTooltip(`📍 <b>${ptName}</b>${ptDesc ? `<br><span style="font-size:10px;opacity:0.9">${ptDesc}</span>` : ''}`, {
        direction: 'top',
        offset: [0, -8],
        className: 'spatial-point-tooltip'
      });

      const dist = p.distanciaEjeM !== undefined ? p.distanciaEjeM : (p.distM !== undefined ? p.distM : 0);
      const codGeo = p.codigoViaGeoJSON || p.codGeoJSON || "N/A";
      const nomGeo = p.nombreViaGeoJSON || p.nombreVia || "Sin nombre";

      marker.bindPopup(`
        <div style="font-family:sans-serif;font-size:12px;line-height:1.5;min-width:220px">
          <div style="font-weight:900;color:${isOk ? '#059669' : '#e11d48'};font-size:13px;margin-bottom:4px">
            📍 ${ptName}
          </div>
          ${ptDesc ? `<div style="font-size:11px;color:#64748b;margin-bottom:6px"><em>${ptDesc}</em></div>` : ''}
          <div><b>Identificador:</b> <code>${pId}</code></div>
          <div><b>Coordenadas:</b> <code>${lat.toFixed(5)}, ${lng.toFixed(5)}</code></div>
          <div><b>Vía Reportada:</b> <code>${p.codigoViaDeclarado || p.codInforme || 'N/A'}</code></div>
          <div><b>Red Oficial:</b> <b>${codGeo}</b> (${nomGeo})</div>
          <div><b>Distancia al Eje:</b> <b>${dist.toFixed(1)} m</b> (Buffer 10 m)</div>
          <div style="margin-top:4px"><b>Estado:</b> <span style="color:${isOk ? '#059669' : '#e11d48'};font-weight:800">${p.estado || (isOk ? '✓ SOBRE ' + codGeo : '! A ' + dist.toFixed(1) + ' m')}</span></div>
        </div>
      `);

      marker.addTo(this.layers.pointsLayer);
    });
    this.bringProjectTracksToFront();
  },

  /**
   * VISUALIZACIÓN GRÁFICA DE VECTORES DE MEDICIÓN DE DISTANCIA AL EJE (REGLA / COTA)
   * Dibuja:
   * 1. Línea punteada de conexión (dashArray: '4, 4', weight: 2.5) verde #00E676 (≤ 10m) o rojo #FF1744 (> 10m)
   * 2. Marcador/nodo sobre el eje vial (coordMasCercanaEje)
   * 3. Tooltip claro: 📏 Distancia al eje: X.XX m | Desde: [Nombre] ➔ Hacia Vía: [CODIGO_VIA]
   */
  renderMeasurementVectorsLayer(project) {
    if (!this.leafletMap) return;
    if (!this.layers.measurementVectorsLayer) {
      this.layers.measurementVectorsLayer = L.layerGroup().addTo(this.leafletMap);
    } else if (!this.leafletMap.hasLayer(this.layers.measurementVectorsLayer)) {
      this.leafletMap.addLayer(this.layers.measurementVectorsLayer);
    }
    this.layers.measurementVectorsLayer.clearLayers();

    if (!this.layerVisibility.measurementVectors) return;

    project = project || this.currentProject;
    if (!project) return;

    const geo = project.georreferenciacion || project.fase1B || {};
    const tramos = geo.tramos || [];
    const puntos = geo.puntos || geo.puntosInspeccion || geo.puntosContraste || [];
    const candidates = this.getCandidateFeatures(project);

    const drawVector = (v, parentItem, isTramo) => {
      if (!v) return null;
      let lat1, lng1, lat2, lng2;
      if (Array.isArray(v.coordOrigenKML)) {
        lat1 = v.coordOrigenKML[0];
        lng1 = v.coordOrigenKML[1];
      } else if (v.coordOrigenKML && typeof v.coordOrigenKML === "object") {
        lat1 = v.coordOrigenKML.lat;
        lng1 = v.coordOrigenKML.lng;
      }
      if (Array.isArray(v.coordMasCercanaEje)) {
        lat2 = v.coordMasCercanaEje[0];
        lng2 = v.coordMasCercanaEje[1];
      } else if (v.coordMasCercanaEje && typeof v.coordMasCercanaEje === "object") {
        lat2 = v.coordMasCercanaEje.lat;
        lng2 = v.coordMasCercanaEje.lng;
      }
      if (lat1 == null || lng1 == null || lat2 == null || lng2 == null || isNaN(lat1) || isNaN(lat2)) return null;
      // Filtro territorial: descartar vectores cuyo origen KML esté fuera de Antioquia
      if (lat1 < 5.0 || lat1 > 9.2 || lng1 < -77.6 || lng1 > -73.6) return null;

      const dist = v.distM !== undefined ? v.distM : (v.distanciaEjeM || 0);
      const cumple = dist <= this.BUFFER_TOLERANCIA_M;
      const color = cumple ? "#00E676" : "#FF1744";
      const itemLabel = v.nombrePunto || parentItem.nombrePlacemark || parentItem.sector || (isTramo ? 'Tramo KML' : 'Punto KML');
      const roadCode = v.codigoVia || parentItem.codigoViaGeoJSON || 'Eje Vial';
      const roadName = v.nombreVia || parentItem.nombreViaGeoJSON || 'Vía Oficial';

      const tooltipContent = `
        <div style="font-family:sans-serif;font-size:11px;line-height:1.45;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;font-weight:800;color:${color}">
            <span>📏</span>
            <span>Distancia al eje: <b>${dist.toFixed(2)} m</b> (${cumple ? 'Cumple ≤ 10m' : 'Excede > 10m'})</span>
          </div>
          <div style="color:#e2e8f0;font-size:10.5px;">
            <b>Desde:</b> ${itemLabel}<br>
            <b>Hacia Vía:</b> <span style="font-family:monospace;color:#38bdf8;font-weight:700;">${roadCode}</span> (${roadName})<br>
            <b>Origen KML:</b> <code>${lat1.toFixed(5)}, ${lng1.toFixed(5)}</code><br>
            <b>Eje Vial:</b> <code>${lat2.toFixed(5)}, ${lng2.toFixed(5)}</code>
          </div>
        </div>
      `;

      // 1. Línea punteada de conexión exacta
      const line = L.polyline([[lat1, lng1], [lat2, lng2]], {
        pane: 'tramosProyectoPane',
        color: color,
        weight: 2.5,
        dashArray: '4, 4',
        opacity: 0.95
      });

      line.bindTooltip(tooltipContent, {
        className: `spatial-measurement-tooltip ${cumple ? 'cumple' : 'no-cumple'}`,
        sticky: true,
        direction: 'top',
        offset: [0, -10]
      });

      // 2. Pequeño nodo/marcador sobre el eje exacto de la vía
      const node = L.circleMarker([lat2, lng2], {
        pane: 'tramosProyectoPane',
        radius: 4.5,
        fillColor: color,
        color: '#FFFFFF',
        weight: 2,
        opacity: 1,
        fillOpacity: 1
      });

      node.bindTooltip(tooltipContent, {
        className: `spatial-measurement-tooltip ${cumple ? 'cumple' : 'no-cumple'}`,
        direction: 'top',
        offset: [0, -8]
      });

      this.layers.measurementVectorsLayer.addLayer(line);
      this.layers.measurementVectorsLayer.addLayer(node);

      return { line, node, v };
    };

    tramos.forEach(t => {
      t._vectorLayers = [];
      let vectors = t.vectoresMedicion && t.vectoresMedicion.length > 0 ? [...t.vectoresMedicion] : (t.vectorPrincipal ? [t.vectorPrincipal] : []);
      if (vectors.length === 0 && t.coordenadas && t.coordenadas.length > 1) {
        let sub = t.subAnalysis;
        if (!sub) {
          sub = this.analyzeTrackSubSegments(t.coordenadas, candidates);
          if (sub) {
            t.subAnalysis = sub;
            t.visualRuns = sub.visualRuns;
            t.puntosDesviacion = sub.puntosDesviacion;
          }
        }
        if (sub && sub.vMax) {
          t.vectorPrincipal = sub.vMax;
          t.vectoresMedicion = [sub.vMax];
          vectors = [sub.vMax];
        }
      }
      if (t.subAnalysis && t.subAnalysis.puntosDesviacion && t.subAnalysis.puntosDesviacion.length > 0) {
        t.subAnalysis.puntosDesviacion.forEach((ptDesv, pIdx) => {
          const vDesv = this.findClosestProjectionToRoads(ptDesv.lat, ptDesv.lng, candidates);
          vDesv.nombrePunto = `Punto de Quiebre / Desviación (K0+${Math.round(ptDesv.abscisaM)}m)`;
          vDesv.tipoControl = "desviacion";
          const already = vectors.some(ev => {
            const eLat = Array.isArray(ev.coordOrigenKML) ? ev.coordOrigenKML[0] : (ev.coordOrigenKML ? ev.coordOrigenKML.lat : 0);
            const eLng = Array.isArray(ev.coordOrigenKML) ? ev.coordOrigenKML[1] : (ev.coordOrigenKML ? ev.coordOrigenKML.lng : 0);
            return Math.abs(eLat - ptDesv.lat) < 0.00005 && Math.abs(eLng - ptDesv.lng) < 0.00005;
          });
          if (!already) {
            vectors.push(vDesv);
          }
        });
      }
      vectors.forEach(v => {
        const drawn = drawVector(v, t, true);
        if (drawn) t._vectorLayers.push(drawn);
      });
    });

    puntos.forEach((p, pIdx) => {
      p._vectorLayers = [];
      let vectors = p.vectoresMedicion && p.vectoresMedicion.length > 0 ? [...p.vectoresMedicion] : (p.vectorMedicion ? [p.vectorMedicion] : (p.vectorPrincipal ? [p.vectorPrincipal] : []));
      if (vectors.length === 0) {
        const lat = p.lat || (Array.isArray(p.coordenadas) ? p.coordenadas[0] : 0);
        const lng = p.lng || (Array.isArray(p.coordenadas) ? p.coordenadas[1] : 0);
        if (lat && lng) {
          const v = this.findClosestProjectionToRoads(lat, lng, candidates);
          v.nombrePunto = p.nombrePlacemark || p.sector || p.idPunto || `Punto ${pIdx + 1}`;
          p.vectorMedicion = v;
          p.vectorPrincipal = v;
          p.vectoresMedicion = [v];
          vectors = [v];
        }
      }
      vectors.forEach(v => {
        const drawn = drawVector(v, p, false);
        if (drawn) p._vectorLayers.push(drawn);
      });
    });

    this.bringProjectTracksToFront();
  },

  /**
   * Hace zoom y resalta el vector de medición de un ítem al hacer clic en la Tabla de Contraste Espacial
   */
  focusContrastItem(index, isTramo) {
    if (!this.leafletMap) return;

    const project = this.currentProject;
    if (!project) return;
    const geo = project.georreferenciacion || project.fase1B || {};
    const tramos = geo.tramos || [];
    const puntos = geo.puntos || geo.puntosInspeccion || geo.puntosContraste || [];

    const allRows = document.querySelectorAll(".spatial-contrast-row");
    allRows.forEach(r => r.classList.remove("selected"));

    const targetTableBody = document.getElementById("spatialContrastTableBody");
    if (targetTableBody) {
      const rows = targetTableBody.querySelectorAll(".spatial-contrast-row");
      const targetIdx = isTramo ? index : (tramos.length + index);
      if (rows[targetIdx]) {
        rows[targetIdx].classList.add("selected");
        rows[targetIdx].scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }

    if (!this.layerVisibility.measurementVectors) {
      this.layerVisibility.measurementVectors = true;
      this.syncToggleButtonsUI();
      this.renderMeasurementVectorsLayer(project);
    }

    if (isTramo && tramos[index]) {
      const t = tramos[index];
      const v = t.vectorPrincipal || (t.vectoresMedicion && t.vectoresMedicion[0]);
      const oLat = v && (Array.isArray(v.coordOrigenKML) ? v.coordOrigenKML[0] : (v.coordOrigenKML ? v.coordOrigenKML.lat : null));
      const oLng = v && (Array.isArray(v.coordOrigenKML) ? v.coordOrigenKML[1] : (v.coordOrigenKML ? v.coordOrigenKML.lng : null));
      const eLat = v && (Array.isArray(v.coordMasCercanaEje) ? v.coordMasCercanaEje[0] : (v.coordMasCercanaEje ? v.coordMasCercanaEje.lat : null));
      const eLng = v && (Array.isArray(v.coordMasCercanaEje) ? v.coordMasCercanaEje[1] : (v.coordMasCercanaEje ? v.coordMasCercanaEje.lng : null));

      if (oLat != null && oLng != null && eLat != null && eLng != null) {
        const center = [
          (oLat + eLat) / 2,
          (oLng + eLng) / 2
        ];
        this.leafletMap.flyTo(center, 18, { duration: 1.2 });
        if (t._vectorLayers && t._vectorLayers.length > 0 && t._vectorLayers[0].node) {
          setTimeout(() => {
            t._vectorLayers[0].node.openTooltip();
          }, 1300);
        }
      } else if (t.coordenadas && t.coordenadas.length > 0) {
        const mid = t.coordenadas[Math.floor(t.coordenadas.length / 2)];
        this.leafletMap.flyTo([mid.lat, mid.lng], 18, { duration: 1.2 });
      }
    } else if (!isTramo && puntos[index]) {
      const p = puntos[index];
      const lat = p.lat || (Array.isArray(p.coordenadas) ? p.coordenadas[0] : 0);
      const lng = p.lng || (Array.isArray(p.coordenadas) ? p.coordenadas[1] : 0);
      if (lat && lng) {
        this.leafletMap.flyTo([lat, lng], 18, { duration: 1.2 });
        if (p._vectorLayers && p._vectorLayers.length > 0 && p._vectorLayers[0].node) {
          setTimeout(() => {
            p._vectorLayers[0].node.openTooltip();
          }, 1300);
        }
      }
    }
  },

  /**
   * Centrar y hacer zoom automático en los tramos del proyecto activo
   */
  zoomToProjectTracks(project) {
    if (!this.leafletMap) return;

    project = project || this.currentProject || (window.App && window.App.currentProject) || {};

    if ((!project || (!project.georreferenciacion && !project.fase1B)) && window.App && window.App.currentProjectId && window.App.expedientesMap) {
      const exp = window.App.expedientesMap[window.App.currentProjectId];
      if (exp) {
        if (exp.datos) project = exp.datos;
        else if (exp.fase1B) project = { georreferenciacion: exp.fase1B };
      }
    }

    const geo = project.georreferenciacion || project.fase1B || {};
    const tramos = geo.tramos || [];
    const puntos = geo.puntos || geo.puntosInspeccion || geo.puntosContraste || [];

    const allLatLngs = [];

    tramos.forEach(t => {
      (t.coordenadas || []).forEach(c => {
        let lat, lng;
        if (Array.isArray(c) && c.length >= 2 && !isNaN(c[0]) && !isNaN(c[1])) {
          lat = c[0];
          lng = c[1];
        } else if (c && c.lat !== undefined && c.lng !== undefined && !isNaN(c.lat) && !isNaN(c.lng)) {
          lat = c.lat;
          lng = c.lng;
        }
        if (lat !== undefined && lng !== undefined && lat >= 5.0 && lat <= 9.2 && lng >= -77.6 && lng <= -73.6) {
          allLatLngs.push([lat, lng]);
        }
      });
    });

    puntos.forEach(p => {
      const lat = p.lat || (Array.isArray(p.coordenadas) ? p.coordenadas[0] : 0);
      const lng = p.lng || (Array.isArray(p.coordenadas) ? p.coordenadas[1] : 0);
      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        if (lat >= 5.0 && lat <= 9.2 && lng >= -77.6 && lng <= -73.6) {
          allLatLngs.push([lat, lng]);
        }
      } else if (p.coordsTrack && p.coordsTrack.length > 0) {
        p.coordsTrack.forEach(c => {
          if (c.lat !== undefined && c.lng !== undefined && !isNaN(c.lat) && !isNaN(c.lng)) {
            if (c.lat >= 5.0 && c.lat <= 9.2 && c.lng >= -77.6 && c.lng <= -73.6) {
              allLatLngs.push([c.lat, c.lng]);
            }
          }
        });
      }
    });

    if (allLatLngs.length === 0) {
      if (this.layers.projectTrackLayer) {
        const trackBounds = (typeof this.layers.projectTrackLayer.getBounds === "function")
          ? this.layers.projectTrackLayer.getBounds()
          : null;
        if (trackBounds && trackBounds.isValid()) {
          this.leafletMap.fitBounds(trackBounds, { padding: [60, 60], maxZoom: 18 });
          this.bringProjectTracksToFront();
          return;
        }
      }
      if (this.layers.terciariaLayer && this.layers.terciariaLayer.getLayers().length > 0) {
        const tercSubLayer = this.layers.terciariaLayer.getLayers()[0];
        if (tercSubLayer && typeof tercSubLayer.getBounds === "function") {
          const tb = tercSubLayer.getBounds();
          if (tb && tb.isValid()) {
            this.leafletMap.fitBounds(tb, { padding: [40, 40] });
            this.bringProjectTracksToFront();
            return;
          }
        }
      }
    }

    if (allLatLngs.length > 0) {
      const tramosBounds = L.latLngBounds(allLatLngs);
      if (tramosBounds.isValid()) {
        this.leafletMap.fitBounds(tramosBounds, { padding: [60, 60], maxZoom: 18 });
        this.bringProjectTracksToFront();
        const tramoCount = tramos.length > 0 ? tramos.length : allLatLngs.length;
        this.showToast(`🎯 Zoom centrado en tramos del proyecto (${tramoCount} ${tramos.length > 0 ? 'tramo(s)' : 'puntos'}).`);
        return;
      }
    }

    this.showToast("ℹ No hay tramos georreferenciados (KML/KMZ) disponibles para este proyecto.");
  },

  /**
   * Inicializa o actualiza el mapa interactivo con Google Satélite Híbrido y OSM
   */
  initOrUpdateMap(containerId, project) {
    const container = document.getElementById(containerId);
    if (!container) return;

    this.currentProject = project || {};
    if (this.filterByActiveMunicipio === undefined || this.filterByActiveMunicipio === null) {
      this.filterByActiveMunicipio = true;
    }
    this.syncToggleButtonsUI();

    const geo = this.currentProject.georreferenciacion || this.currentProject.fase1B || {};
    const tramos = geo.tramos || [];
    const puntos = geo.puntosInspeccion || geo.puntosContraste || geo.puntos || [];

    const allLatLngs = [];
    tramos.forEach(t => {
      (t.coordenadas || []).forEach(c => allLatLngs.push([c.lat, c.lng]));
    });
    puntos.forEach(p => {
      if (p.coordsTrack && p.coordsTrack.length > 0) {
        p.coordsTrack.forEach(c => allLatLngs.push([c.lat, c.lng]));
      } else if (p.lat && p.lng) {
        allLatLngs.push([p.lat, p.lng]);
      }
    });

    const defaultCenter = [6.5, -75.5];
    const center = allLatLngs.length > 0 ? allLatLngs[Math.floor(allLatLngs.length / 2)] : defaultCenter;
    const defaultZoom = allLatLngs.length > 0 ? 15 : 8;

    if (typeof L === "undefined") {
      this.renderFallbackMap(container, this.currentProject);
      return;
    }

    if (!this.leafletMap) {
      container.innerHTML = "";
      this.leafletMap = L.map(containerId, {
        zoomControl: true,
        attributionControl: false
      }).setView(center, defaultZoom);

      if (!this.leafletMap.getPane('tramosProyectoPane')) {
        this.leafletMap.createPane('tramosProyectoPane');
        this.leafletMap.getPane('tramosProyectoPane').style.zIndex = '680';
      }

      this.layers.googleSat = L.tileLayer("https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
        maxZoom: 20,
        subdomains: ["mt0", "mt1", "mt2", "mt3"]
      }).addTo(this.leafletMap);

      this.layers.osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19
      });

      this.layers.terciariaLayer = L.layerGroup().addTo(this.leafletMap);
      this.layers.secundariaLayer = L.layerGroup().addTo(this.leafletMap);
      this.layers.primariaLayer = L.layerGroup().addTo(this.leafletMap);
      this.layers.customLayer = L.layerGroup().addTo(this.leafletMap);
      this.layers.bufferLayer = L.layerGroup().addTo(this.leafletMap);
      this.layers.projectTrackLayer = L.layerGroup().addTo(this.leafletMap);
      this.layers.pointsLayer = L.layerGroup().addTo(this.leafletMap);
      this.layers.measurementVectorsLayer = L.layerGroup().addTo(this.leafletMap);

      const baseMaps = {
        "Google Satélite Híbrido": this.layers.googleSat,
        "OpenStreetMap Estándar": this.layers.osm
      };

      const overlayMaps = {
        "Red Vial Terciaria": this.layers.terciariaLayer,
        "Red Vial Secundaria": this.layers.secundariaLayer,
        "Red Vial Primaria": this.layers.primariaLayer,
        "Red Subida / Personalizada": this.layers.customLayer,
        "Buffer de Tolerancia (10m)": this.layers.bufferLayer,
        "Trazados KML del Proyecto": this.layers.projectTrackLayer,
        "Puntos de Inspección": this.layers.pointsLayer,
        "📏 Cota / Vectores al Eje": this.layers.measurementVectorsLayer
      };

      this.layerControl = L.control.layers(baseMaps, overlayMaps, { collapsed: true, position: 'topright' }).addTo(this.leafletMap);

      if (typeof window.ResizeObserver !== "undefined" && container && !this._containerResizeObserver) {
        this._containerResizeObserver = new ResizeObserver(() => {
          if (this.leafletMap) this.leafletMap.invalidateSize();
        });
        this._containerResizeObserver.observe(container);
      }
    } else {
      if (!this.leafletMap.getPane('tramosProyectoPane')) {
        this.leafletMap.createPane('tramosProyectoPane');
        this.leafletMap.getPane('tramosProyectoPane').style.zIndex = '680';
      }
      // Limpieza atómica de todas las capas anteriores para aislar completamente el cambio entre carpetas/municipios
      if (this.layers.terciariaLayer) this.layers.terciariaLayer.clearLayers();
      if (this.layers.secundariaLayer) this.layers.secundariaLayer.clearLayers();
      if (this.layers.primariaLayer) this.layers.primariaLayer.clearLayers();
      if (this.layers.customLayer) this.layers.customLayer.clearLayers();
      if (this.layers.bufferLayer) this.layers.bufferLayer.clearLayers();
      if (this.layers.projectTrackLayer) this.layers.projectTrackLayer.clearLayers();
      if (this.layers.pointsLayer) this.layers.pointsLayer.clearLayers();
      if (this.layers.measurementVectorsLayer) this.layers.measurementVectorsLayer.clearLayers();
    }

    const pId = this.currentProject.id || this.currentProject.codigo || (window.App && window.App.currentProjectId);
    const activeMpio = this.currentProject.municipio;
    const daneCode = activeMpio ? this.getDaneCodeForMunicipio(activeMpio) : null;
    const normMpio = this.normalizeMpioName(activeMpio);

    this.roadsByProject = this.roadsByProject || {};
    this.roadsByMunicipio = this.roadsByMunicipio || {};

    const savedRoads = (pId && this.roadsByProject[pId]) ||
                       (this.currentProject.fase1B && this.currentProject.fase1B.redVialRecortada) ||
                       (this.currentProject.georreferenciacion && this.currentProject.georreferenciacion.redVialRecortada) ||
                       (daneCode && this.roadsByMunicipio[daneCode]) ||
                       (normMpio && this.roadsByMunicipio[normMpio]) || null;

    if (savedRoads && (savedRoads.terciaria || savedRoads.features)) {
      this.projectRoadsData = {
        municipio: activeMpio,
        daneCode: daneCode,
        projectId: pId,
        terciaria: savedRoads.terciaria || { type: "FeatureCollection", features: savedRoads.features || [] },
        secundaria: savedRoads.secundaria || { type: "FeatureCollection", features: [] },
        primaria: savedRoads.primaria || { type: "FeatureCollection", features: [] }
      };
    } else {
      // Si no tenemos vías previas de este municipio específico, reiniciar projectRoadsData a vacío
      // ¡JAMÁS dejar las vías del municipio anterior!
      this.projectRoadsData = {
        municipio: activeMpio,
        daneCode: daneCode,
        projectId: pId,
        terciaria: { type: "FeatureCollection", features: [] },
        secundaria: { type: "FeatureCollection", features: [] },
        primaria: { type: "FeatureCollection", features: [] }
      };
    }

    this.updateLayerBadges();

    // Recalcular proximidad territorial y alineación con las vías aisladas de este municipio
    this.recalculateProjectProximity(this.currentProject);

    // Renderizar capas viales
    this.renderTerciariaLayer();

    if (this.layerVisibility.secundaria) {
      if (!this.cachedGeoData.secundaria && (!window.redVialDepartamentalCompleta || !window.redVialDepartamentalCompleta.secundaria)) this.loadSecundariaAuto();
      else this.renderSecundariaLayer();
    } else {
      this.layers.secundariaLayer.clearLayers();
    }

    if (this.layerVisibility.primaria) {
      if (!this.cachedGeoData.primaria && (!window.redVialDepartamentalCompleta || !window.redVialDepartamentalCompleta.primaria)) this.loadPrimariaAuto();
      else this.renderPrimariaLayer();
    } else {
      this.layers.primariaLayer.clearLayers();
    }

    if (this.layerVisibility.custom && this.cachedGeoData.custom) {
      this.renderCustomLayer();
    } else {
      this.layers.customLayer.clearLayers();
    }

    // Renderizar componentes del proyecto activo
    this.renderProjectTrack(this.currentProject);
    this.renderBufferLayer(this.currentProject);
    this.renderPointsLayer(this.currentProject);

    // Renderizar vectores de medición de distancia al eje vial
    if (this.layerVisibility.measurementVectors) {
      this.renderMeasurementVectorsLayer(this.currentProject);
    }

    this.zoomToProjectTracks(this.currentProject);
    this.renderContrastTable(this.currentProject);

    if (allLatLngs.length > 0) {
      this.syncRoadsForProject(this.currentProject);
    }

    setTimeout(() => {
      if (this.leafletMap) this.leafletMap.invalidateSize();
    }, 200);
  },

  /**
   * Renderiza la tabla de contraste espacial en el panel derecho evaluando cada tramo y punto por separado
   */
  renderContrastTable(project) {
    const tableBody = document.getElementById("spatialContrastTableBody");
    const countViasEl = document.getElementById("spatialViasCount");
    const countPointsEl = document.getElementById("spatialPointsCloseCount");
    if (!tableBody) return;

    project = project || {};
    const geo = project.georreferenciacion || project.fase1B || {};
    const tramos = geo.tramos || [];
    const puntos = (geo.puntos && geo.puntos !== geo.puntosContraste) ? geo.puntos : (geo.puntosInspeccion || []);

    const totalTramos = tramos.length;
    const tramosConformes = Array.isArray(tramos) ? tramos.filter(t => t && t.cumple && !t.cumpleParcial).length : 0;
    const tramosParciales = tramos.filter(t => t.cumpleParcial).length;
    const totalPuntos = puntos.length;
    const puntosConformes = puntos.filter(p => p.cumple).length;

    if (countViasEl && !this.cachedGeoData.terciaria) {
      countViasEl.innerText = project.municipio
        ? `Red Vial Terciaria Oficial - Entorno ${project.municipio}`
        : `Red Vial Terciaria Oficial de Antioquia`;
    }

    if (countPointsEl) {
      if (totalTramos > 0) {
        countPointsEl.innerText = `${tramosConformes} conformes (100% en vía)${tramosParciales > 0 ? ` | ${tramosParciales} parciales (bicolor)` : ''} de ${totalTramos} tramos | ${puntosConformes} de ${totalPuntos} puntos conformes`;
      } else if (totalPuntos > 0) {
        countPointsEl.innerText = `${puntosConformes} de ${totalPuntos} puntos a menos de 10 m de un eje vial oficial`;
      } else {
        countPointsEl.innerText = "0 tramos evaluados (esperando archivo KML/KMZ/ZIP)";
      }
    }

    const alertaEl = document.getElementById("spatialAlertContainer");
    const tieneGeoValida = geo.tieneGeorreferenciacionValida === true || totalTramos > 0 || (totalPuntos > 0 && puntos.some(p => (p.lat && p.lng) || (p.coordsTrack && p.coordsTrack.length > 0)));

    let alertsHtml = "";
    if (!tieneGeoValida && geo.alertaComprimido) {
      alertsHtml = `
        <tr>
          <td colspan="7" style="padding:10px 14px;background:rgba(225,29,72,0.14);border-bottom:1px solid rgba(225,29,72,0.35);color:#fecdd3;font-size:11px;">
            <strong>⚠️ Alerta de Georreferenciación:</strong> ${geo.alertaComprimido}
          </td>
        </tr>
      `;
      if (alertaEl) {
        alertaEl.style.display = "flex";
        alertaEl.innerHTML = `
          <div style="display:flex;align-items:flex-start;gap:10px;width:100%;">
            <span style="font-size:18px;line-height:1;">⚠️</span>
            <div>
              <div style="font-weight:700;margin-bottom:2px;">Alerta de Descompresión en Expediente: ${project.municipio || ''}</div>
              <div>${geo.alertaComprimido}</div>
            </div>
          </div>
        `;
      }
    } else {
      if (alertaEl) {
        alertaEl.style.display = "none";
        alertaEl.innerHTML = "";
      }
    }

    if (totalTramos === 0 && totalPuntos === 0) {
      tableBody.innerHTML = alertsHtml + `
        <tr>
          <td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted);background:rgba(239,68,68,0.03);">
            <div style="font-size:15px;font-weight:700;color:var(--danger, #dc2626);margin-bottom:6px;">⚠️ Archivo de Georreferenciación Faltante (Ítem 24)</div>
            <div style="font-size:13px;color:var(--text-main);margin-bottom:14px;max-width:540px;margin-left:auto;margin-right:auto;">No se ha detectado ningún archivo .KMZ, .KML o contenedor comprimido con trazados georreferenciados válidos en el expediente del proyecto.</div>
            <div>
              <button type="button" class="btn btn-primary" onclick="App.subirSubsanacionItem(24)" style="padding:7px 16px;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
                <span>📤</span> Aportar Archivo KMZ / KML (Ítem 24)
              </button>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = alertsHtml;

    // 1. Tramos con clase interactiva y evento para enfocar y resaltar el vector de medición
    tramos.forEach((t, tIdx) => {
      const tr = document.createElement("tr");
      tr.className = "spatial-contrast-row";
      tr.setAttribute("onclick", `SpatialEngine.focusContrastItem(${tIdx}, true)`);
      tr.title = "Clic para centrar en el mapa y resaltar vector de distancia al eje vial";

      const isOk = t.cumple && !t.cumpleParcial;
      const isParcial = !!t.cumpleParcial;
      const dist = t.distanciaEjeM !== undefined ? t.distanciaEjeM : 0;
      const lenText = t.longitudCalculada ? `${t.longitudCalculada.toFixed(1)} m` : (t.longitudM ? `${t.longitudM.toFixed(1)} m` : "N/D");

      let statusBadge = "";
      if (isOk) {
        statusBadge = `<span class="status-pill cumple" style="font-size:10px;white-space:nowrap;">✓ ${t.estado || `SOBRE ${t.codigoViaGeoJSON}`}</span>`;
      } else if (isParcial) {
        statusBadge = `<span class="status-pill warning" style="font-size:10px;white-space:nowrap;background:rgba(217,119,6,0.18);color:#D97706;border:1px solid rgba(217,119,6,0.45);font-weight:800;">⚠️ PARCIAL: ${t.longitudEnViaM} m en vía (${t.pctEnVia}%) / ${t.longitudFueraViaM} m fuera</span>`;
      } else {
        statusBadge = `<span class="status-pill no-cumple" style="font-size:10px;white-space:nowrap;">! ${t.estado || `A ${dist.toFixed(1)} m DE ${t.codigoViaGeoJSON}`}</span>`;
      }

      tr.innerHTML = `
        <td class="font-mono font-bold" style="color:#10b981">${t.idTramo || 'TR'}</td>
        <td>
          <div style="font-weight:700;color:var(--text-main)">${t.nombrePlacemark || 'Tramo sin nombre'}</div>
          <div style="font-size:10px;color:var(--text-muted)">${t.carpetaContenedora || 'KML/KMZ'}</div>
          ${t.detalleParcial ? `<div style="font-size:10.5px;color:#d97706;margin-top:4px;line-height:1.3;font-style:italic;">⚠️ ${t.detalleParcial}</div>` : ''}
        </td>
        <td class="font-mono" style="font-size:11px">${t.codigoViaDeclarado || 'N/A'}</td>
        <td class="font-mono font-bold" style="color:#0284c7">${t.codigoViaGeoJSON || 'N/A'}</td>
        <td style="font-size:11px">
          <div style="font-weight:600;color:var(--text-main)">${t.nombreViaGeoJSON || 'Sin nombre'}</div>
          <span style="display:inline-block;margin-top:2px;font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;background:${(t.colorCategoria || '#0284c7')}18;color:${t.colorCategoria || '#0284c7'};border:1px solid ${(t.colorCategoria || '#0284c7')}44;">
            ${t.categoriaVia || 'Red Terciaria (Orden 3)'}
          </span>
        </td>
        <td class="font-mono col-longt-dist" style="text-align:right">
          <div class="longt-main-val" style="font-weight:700;font-size:11.5px;color:${isOk ? '#00FF66' : (isParcial ? '#FBBF24' : '#FF4D6D')}">${lenText}</div>
          <div class="longt-sub-val" style="font-size:10.5px;font-weight:600;color:#FFFFFF;margin-top:2px;">${isParcial ? `Desv. máx: ${dist.toFixed(1)} m` : `Dist: ${dist.toFixed(1)} m`}</div>
        </td>
        <td style="text-align:center">
          ${statusBadge}
        </td>
      `;
      tableBody.appendChild(tr);
    });

    // 2. Puntos con clase interactiva y evento para enfocar y resaltar el vector de medición
    puntos.forEach((p, pIdx) => {
      const tr = document.createElement("tr");
      tr.className = "spatial-contrast-row";
      tr.setAttribute("onclick", `SpatialEngine.focusContrastItem(${pIdx}, false)`);
      tr.title = "Clic para centrar en el mapa y resaltar vector de distancia al eje vial";

      const isOk = p.cumple;
      const dist = p.distanciaEjeM !== undefined ? p.distanciaEjeM : (p.distM !== undefined ? p.distM : 0);
      const pId = p.idPunto || p.id || "PTO";

      tr.innerHTML = `
        <td class="font-mono font-bold" style="color:#38bdf8">${pId}</td>
        <td>
          <div style="font-weight:600;color:var(--text-main)">${p.nombrePlacemark || p.sector || 'Punto de Inspección'}</div>
          <div style="font-size:10px;color:var(--text-muted)">${p.carpetaContenedora || 'Punto KML'}</div>
        </td>
        <td class="font-mono" style="font-size:11px">${p.codigoViaDeclarado || p.codInforme || 'N/A'}</td>
        <td class="font-mono font-bold" style="color:#0284c7">${p.codigoViaGeoJSON || p.codGeoJSON || 'N/A'}</td>
        <td style="font-size:11px">
          <div style="font-weight:600;color:var(--text-main)">${p.nombreViaGeoJSON || p.nombreVia || 'Sin nombre'}</div>
          <span style="display:inline-block;margin-top:2px;font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;background:${(p.colorCategoria || '#0284c7')}18;color:${p.colorCategoria || '#0284c7'};border:1px solid ${(p.colorCategoria || '#0284c7')}44;">
            ${p.categoriaVia || 'Red Terciaria (Orden 3)'}
          </span>
        </td>
        <td class="font-mono col-longt-dist" style="text-align:right">
          <div class="longt-main-val" style="font-size:11.5px;font-weight:700;color:${isOk ? '#00FF66' : '#FF4D6D'}">Eje: ${dist.toFixed(1)} m</div>
        </td>
        <td style="text-align:center">
          <span class="status-pill ${isOk ? 'cumple' : 'no-cumple'}" style="font-size:10px;white-space:nowrap;">
            ${isOk ? '✓ ' + (p.estado || `SOBRE ${p.codGeoJSON}`) : '! ' + (p.estado || `A ${dist.toFixed(1)} m DE ${p.codGeoJSON}`)}
          </span>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  },

  /**
   * Auditoría técnica espacial (Fase 1B) con tolerancia de 10 metros
   */
  auditProject(project) {
    const geo = project.georreferenciacion || project.fase1B || { puntosContraste: [], tramos: [], coberturaBufferPct: 0, archivoKml: null };
    const criticalIssues = [];
    const alerts = [];

    const hasGeom = (geo.tramos && geo.tramos.length > 0) ||
      (geo.puntosContraste && geo.puntosContraste.length > 0) ||
      (geo.puntos && geo.puntos.length > 0) ||
      (geo.puntosInspeccion && geo.puntosInspeccion.length > 0);

    const tieneGeorreferenciacionValida = geo.tieneGeorreferenciacionValida !== undefined
      ? geo.tieneGeorreferenciacionValida
      : (hasGeom && ((geo.tramos && geo.tramos.length > 0) || (geo.puntosContraste && geo.puntosContraste.some(p => (p.lat && p.lng) || (p.coordsTrack && p.coordsTrack.length > 0)))));

    const alertaComprimido = tieneGeorreferenciacionValida ? null : (geo.alertaComprimido || null);

    if (!geo || !geo.archivoKml || !hasGeom) {
      criticalIssues.push({
        criterio: "Georreferenciación y archivo KML/KMZ de los tramos (Ítem 24)",
        observacion: "No se encontró archivo de trazado georreferenciado (.kmz, .kml o dentro de .zip/.7z/.rar) en la carpeta del expediente municipal.",
        accion_requerida: "Adjuntar los tracks de los tramos a intervenir en formato KML, KMZ o empaquetados en archivo comprimido."
      });
      return {
        fase: "1B_ESPACIAL",
        aprobado: false,
        tieneKMZ: false,
        porcentajeAlineacion: 0,
        tieneGeorreferenciacionValida: false,
        estadoCompuerta: 'BLOQUEADO',
        motivoRechazo: 'Documento faltante: No se aportó archivo de georreferenciación (.KMZ / .KML) en el expediente.',
        alertaComprimido: alertaComprimido,
        codigoDeclarado: "Sin código",
        codigoOficial: "Sin código",
        codigosCoinciden: false,
        jerarquia: "NO GEORREFERENCIADA",
        esTerciaria: false,
        bufferToleranciaM: 10,
        coberturaBufferPct: 0,
        umbralMinimoBufferPct: 95.0,
        coberturaConforme: false,
        longitudDisenoM: project.longitudM || 0,
        longitudKmlM: 0,
        diferenciaMetricaPct: 100,
        concordanciaMetricaOk: false,
        puntosAnomalia: 0,
        tramos: [],
        puntos: [],
        puntosInspeccion: [],
        puntosContraste: [],
        hallazgosCriticos: criticalIssues,
        alertas: alerts
      };
    }

    const declaredCode = (geo.codigoViaDeclarado || "").trim().toUpperCase();
    const officialCode = (geo.codigoViaGeoJSON || "").trim().toUpperCase();
    const codesMatch = declaredCode === officialCode;

    if (!codesMatch) {
      criticalIssues.push({
        criterio: "Discordancia en Código de Identificación Vial",
        observacion: `El código registrado en el certificado municipal (${declaredCode}) no coincide con el código oficial de la Red Departamental (${officialCode}).`,
        accion_requerida: "Alinear la certificación municipal con el código oficial asignado en el inventario de la Gobernación de Antioquia."
      });
    }

    const jerarquia = (geo.jerarquiaOficial || "").toUpperCase();
    const isTerciaria = jerarquia.includes("TERCIARIA") || declaredCode.includes("VT") || declaredCode.startsWith("55") || declaredCode.includes("05");

    if (!isTerciaria) {
      criticalIssues.push({
        criterio: "Jerarquía de Red Vial Inadmisible para Convocatoria",
        observacion: `La vía figura clasificada como "${jerarquia}". El programa de Placa Huella aplica exclusivamente a vías de la Red Terciaria Municipal/Departamental.`,
        accion_requerida: "Certificar tramo clasificado como red terciaria o tramitar reclasificación ante la Secretaría de Infraestructura."
      });
    }

    const coveragePct = geo.coberturaBufferPct !== undefined ? geo.coberturaBufferPct : 0;
    const bufferThreshold = (SIPRO_DATA && SIPRO_DATA.normativeStandards && SIPRO_DATA.normativeStandards.coberturaMinimaBufferPct) || 95.0;
    const bufferOk = coveragePct >= bufferThreshold;

    if (!bufferOk) {
      criticalIssues.push({
        criterio: "Trazado KML fuera del Buffer de Tolerancia Vial (10m)",
        observacion: `El trazado georreferenciado solo coincide en un ${coveragePct}% con la vía oficial registrada (mínimo requerido: ${bufferThreshold}%). Desviación crítica en puntos del proyecto superior a la tolerancia de 10 metros.`,
        accion_requerida: "Levantar nuevamente la traza con GPS submétrico o corregir el trazado KML sobre el eje de la vía pública."
      });
    }

    const lengthDesignM = project.longitudM || (project.despieceAcero && project.despieceAcero.longitudIntervencionM) || 1;
    const lengthKmlM = geo.longitudKmlM || lengthDesignM;
    const lengthDiffPct = Math.abs((lengthKmlM - lengthDesignM) / lengthDesignM) * 100;
    const metricOk = lengthDiffPct <= 3.0;

    if (!metricOk) {
      criticalIssues.push({
        criterio: "Incoherencia Métrica entre Georreferenciación y Despiece de Acero",
        observacion: `La longitud del trazado espacial (${lengthKmlM.toFixed(1)} m) difiere en un ${lengthDiffPct.toFixed(1)}% de la longitud proyectada para el despiece (${lengthDesignM.toFixed(1)} m). Tolerancia máxima: 3.0%.`,
        accion_requerida: "Ajustar las abscisas de inicio y fin en el KML o sincronizar las cantidades de obra en la Fase 1A."
      });
    }

    const passed = criticalIssues.length === 0;

    return {
      fase: "1B_ESPACIAL",
      aprobado: passed,
      tieneKMZ: tieneGeorreferenciacionValida && hasGeom,
      porcentajeAlineacion: coveragePct,
      tieneGeorreferenciacionValida: tieneGeorreferenciacionValida,
      alertaComprimido: alertaComprimido,
      codigoDeclarado: declaredCode,
      codigoOficial: officialCode,
      codigosCoinciden: codesMatch,
      jerarquia: jerarquia,
      esTerciaria: isTerciaria,
      bufferToleranciaM: 10,
      coberturaBufferPct: coveragePct,
      umbralMinimoBufferPct: bufferThreshold,
      coberturaConforme: bufferOk,
      longitudDisenoM: lengthDesignM,
      longitudKmlM: lengthKmlM,
      diferenciaMetricaPct: +lengthDiffPct.toFixed(2),
      concordanciaMetricaOk: metricOk,
      puntosAnomalia: geo.puntosAnomalia || 0,
      tramos: geo.tramos || [],
      puntos: (geo.puntos && geo.puntos !== geo.puntosContraste) ? geo.puntos : (geo.puntosInspeccion || []),
      puntosInspeccion: geo.puntosInspeccion || geo.puntos || [],
      puntosContraste: geo.puntosContraste || [],
      hallazgosCriticos: criticalIssues,
      alertas: alerts
    };
  },

  /**
   * Exporta reporte de contraste a CSV
   */
  exportCsv(project) {
    project = project || this.currentProject;
    if (!project) {
      this.showToast("No hay proyecto activo para exportar.");
      return;
    }

    const geo = project.georreferenciacion || project.fase1B || {};
    const tramos = geo.tramos || [];
    const puntos = geo.puntosInspeccion || geo.puntosContraste || geo.puntos || [];

    let csv = "Tipo,ID,Sector_Nombre,Archivo_Origen,Cod_Informe,CODIGO_VIA_GeoJSON,NOMBRE_VIA_GeoJSON,Longitud_M,Distancia_Eje_M,Estado\n";

    tramos.forEach(t => {
      const lenM = t.longitudCalculada || t.longitudM || 0;
      csv += `"TRAMO","${t.idTramo}","${t.nombrePlacemark}","${t.carpetaContenedora}","${t.codigoViaDeclarado || ''}","${t.codigoViaGeoJSON || ''}","${t.nombreViaGeoJSON || ''}",${lenM},${t.distanciaEjeM || 0},"${t.estado}"\n`;
    });

    puntos.forEach(p => {
      const pId = p.idPunto || p.id || 'PTO';
      csv += `"PUNTO","${pId}","${p.nombrePlacemark || p.sector || ''}","${p.carpetaContenedora || ''}","${p.codigoViaDeclarado || p.codInforme || ''}","${p.codigoViaGeoJSON || p.codGeoJSON || ''}","${p.nombreViaGeoJSON || p.nombreVia || ''}",0,${p.distanciaEjeM || p.distM || 0},"${p.estado}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Contraste_Espacial_${project.municipio || 'Antioquia'}_${project.codigo || 'EXP'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast(`✓ Archivo CSV exportado para ${project.municipio || 'el proyecto'}.`);
  },

  /**
   * Exporta trazado KML con cada tramo y punto estrictamente separado en Placemarks independientes
   */
  exportKml(project) {
    project = project || this.currentProject;
    if (!project) {
      this.showToast("No hay proyecto activo para exportar KML.");
      return;
    }

    const geo = project.georreferenciacion || project.fase1B || {};
    const tramos = geo.tramos || [];
    const puntos = geo.puntosInspeccion || geo.puntosContraste || geo.puntos || [];
    const muni = project.municipio || "Antioquia";
    const cod = project.codigo || "PROY";

    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Auditoría Espacial - ${muni} (${cod})</name>
    <description>SIPRO-PH Gobernación de Antioquia - Tramos y Puntos Independientes</description>
    <Style id="p-ok">
      <IconStyle>
        <color>ff00aa00</color>
        <scale>1.1</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/paddle/grn-circle.png</href></Icon>
      </IconStyle>
    </Style>
    <Style id="p-fail">
      <IconStyle>
        <color>ff0000ff</color>
        <scale>1.1</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/paddle/red-circle.png</href></Icon>
      </IconStyle>
    </Style>
    <Style id="line-track">
      <LineStyle>
        <color>ff10b981</color>
        <width>4</width>
      </LineStyle>
    </Style>
`;

    if (tramos.length > 0) {
      tramos.forEach(t => {
        const coordsStr = (t.coordenadas || []).map(c => `${c.lng},${c.lat},0`).join("\n          ");
        if (coordsStr) {
          kml += `    <Placemark>
      <name>${t.nombrePlacemark}</name>
      <description><![CDATA[
        <b>ID:</b> ${t.idTramo}<br>
        <b>Archivo Origen:</b> ${t.carpetaContenedora}<br>
        <b>Longitud:</b> ${t.longitudCalculada ? t.longitudCalculada.toFixed(1) + ' m' : 'N/D'}<br>
        <b>Vía Oficial:</b> ${t.codigoViaGeoJSON} (${t.nombreViaGeoJSON})<br>
        <b>Distancia Eje:</b> ${t.distanciaEjeM !== undefined ? t.distanciaEjeM.toFixed(1) + ' m' : '0 m'}<br>
        <b>Estado:</b> ${t.estado}
      ]]></description>
      <styleUrl>#line-track</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>
          ${coordsStr}
        </coordinates>
      </LineString>
    </Placemark>
`;
        }
      });
    }

    puntos.forEach(p => {
      if (!p.lat || !p.lng) return;
      const isOk = p.cumple;
      const styleId = isOk ? "#p-ok" : "#p-fail";
      const pId = p.idPunto || p.id || 'PTO';
      kml += `    <Placemark>
      <name>${pId} - ${p.nombrePlacemark || p.sector || ''}</name>
      <description><![CDATA[
        <b>Punto:</b> ${pId}<br>
        <b>Nombre:</b> ${p.nombrePlacemark || p.sector || ''}<br>
        <b>Archivo:</b> ${p.carpetaContenedora || ''}<br>
        <b>Código Informe:</b> ${p.codigoViaDeclarado || p.codInforme || ''}<br>
        <b>Vía Oficial:</b> ${p.codigoViaGeoJSON || p.codGeoJSON || ''} - ${p.nombreViaGeoJSON || p.nombreVia || ''}<br>
        <b>Distancia al Eje:</b> ${p.distanciaEjeM !== undefined ? p.distanciaEjeM.toFixed(1) + ' m' : '0 m'}<br>
        <b>Estado:</b> ${p.estado || ''}
      ]]></description>
      <styleUrl>${styleId}</styleUrl>
      <Point>
        <coordinates>${p.lng},${p.lat},0</coordinates>
      </Point>
    </Placemark>
`;
    });

    kml += `  </Document>
</kml>`;

    const blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Traza_Espacial_${muni}_${cod}.kml`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast(`✓ Archivo KML generado con tramos independientes descargado para ${muni}.`);
  },

  /**
   * Fallback visual cuando no carga Leaflet
   */
  renderFallbackMap(container, project) {
    const roadCode = (project.georreferenciacion && project.georreferenciacion.codigoViaDeclarado) || "05000VT01";
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:30px;text-align:center;background:#0d1612;color:#fff;">
        <h4 style="color:#38bdf8;font-weight:800">Visor Google Satélite & Red Terciaria</h4>
        <p style="font-size:12px;color:#94a3b8;margin-top:6px">
          Visualizando red vial terciaria de <b>${project.municipio || 'Antioquia'}</b> (${roadCode}).
          ${(project.georreferenciacion && project.georreferenciacion.coberturaBufferPct) || 0}% dentro de tolerancia de 10 metros.
        </p>
      </div>
    `;
  },

  showToast(msg) {
    if (window.FolderReader && window.FolderReader.showToast) {
      window.FolderReader.showToast(msg);
    } else if (window.App && window.App.showToast) {
      window.App.showToast(msg);
    } else {
      console.log("[SpatialEngine Toast]", msg);
    }
  }
};

if (typeof window !== "undefined") {
  window.SpatialEngine = SpatialEngine;
}
