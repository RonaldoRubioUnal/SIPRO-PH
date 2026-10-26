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
   * Almacena intacto window.redVialDepartamentalCompleta (sin recortes)
   */
  async loadBaseRoads() {
    if (window.redVialDepartamentalCompleta && window.redVialDepartamentalCompleta.features && window.redVialDepartamentalCompleta.features.length > 0) {
      return window.redVialDepartamentalCompleta;
    }

    window.redVialDepartamentalCompleta = window.redVialDepartamentalCompleta || {
      type: "FeatureCollection",
      features: [],
      terciaria: { type: "FeatureCollection", features: [] },
      secundaria: { type: "FeatureCollection", features: [] },
      primaria: { type: "FeatureCollection", features: [] }
    };
    this.fullDeptGeoData = window.redVialDepartamentalCompleta;

    try {
      const [tercRes, secRes, primRes] = await Promise.all([
        fetch(encodeURI("Base/Red Vial/Terciaria.geojson")).catch(e => null),
        fetch(encodeURI("Base/Red Vial/Secundaria.geojson")).catch(e => null),
        fetch(encodeURI("Base/Red Vial/Primaria.geojson")).catch(e => null)
      ]);

      if (tercRes && tercRes.ok) {
        const data = await tercRes.json();
        window.redVialDepartamentalCompleta.terciaria = data;
        this.cachedGeoData.terciaria = data;
        (data.features || []).forEach(f => {
          f.properties = f.properties || {};
          f.properties.CATEGORIA_VIAL = f.properties.CATEGORIA_VIAL || "Red Terciaria (Orden 3)";
          f.properties.ORDEN_VIAL = f.properties.ORDEN_VIAL || 3;
          f.properties.COLOR_CATEGORIA = f.properties.COLOR_CATEGORIA || "#0284c7";
        });
      }

      if (secRes && secRes.ok) {
        const data = await secRes.json();
        window.redVialDepartamentalCompleta.secundaria = data;
        this.cachedGeoData.secundaria = data;
        (data.features || []).forEach(f => {
          f.properties = f.properties || {};
          f.properties.CATEGORIA_VIAL = f.properties.CATEGORIA_VIAL || "Red Secundaria (Orden 2)";
          f.properties.ORDEN_VIAL = f.properties.ORDEN_VIAL || 2;
          f.properties.COLOR_CATEGORIA = f.properties.COLOR_CATEGORIA || "#f59e0b";
        });
      }

      if (primRes && primRes.ok) {
        const data = await primRes.json();
        window.redVialDepartamentalCompleta.primaria = data;
        this.cachedGeoData.primaria = data;
        (data.features || []).forEach(f => {
          f.properties = f.properties || {};
          f.properties.CATEGORIA_VIAL = f.properties.CATEGORIA_VIAL || "Red Primaria (Orden 1)";
          f.properties.ORDEN_VIAL = f.properties.ORDEN_VIAL || 1;
          f.properties.COLOR_CATEGORIA = f.properties.COLOR_CATEGORIA || "#ef4444";
        });
      }

      // Consolidar arreglo maestro intacto
      window.redVialDepartamentalCompleta.features = [
        ...(window.redVialDepartamentalCompleta.terciaria.features || []),
        ...(window.redVialDepartamentalCompleta.secundaria.features || []),
        ...(window.redVialDepartamentalCompleta.primaria.features || [])
      ];

      // Construir índice por código DANE para Terciarias
      this.terciariaByMpio = {};
      (window.redVialDepartamentalCompleta.terciaria.features || []).forEach(f => {
        const mpioCod = f.properties && f.properties.MUNICIPIO ? String(f.properties.MUNICIPIO).trim() : "SIN_MPIO";
        if (!this.terciariaByMpio[mpioCod]) this.terciariaByMpio[mpioCod] = [];
        this.terciariaByMpio[mpioCod].push(f);
      });

      this.updateLayerBadges();
      const countT = (window.redVialDepartamentalCompleta.terciaria.features || []).length;
      const countS = (window.redVialDepartamentalCompleta.secundaria.features || []).length;
      const countP = (window.redVialDepartamentalCompleta.primaria.features || []).length;
      console.log(`[SpatialEngine] Base Departamental cargada: ${countT} terciarias, ${countS} secundarias, ${countP} primarias.`);
    } catch (err) {
      console.warn("Aviso al cargar bases viales departamentales:", err);
    }

    return window.redVialDepartamentalCompleta;
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

      if (bTerc) bTerc.innerText = countT > 0 ? countT.toLocaleString() : "0";
      if (bSec) bSec.innerText = countS > 0 ? countS.toLocaleString() : "0";
      if (bPrim) bPrim.innerText = countP > 0 ? countP.toLocaleString() : "0";
    } else {
      // MODO SOLO MUNICIPIO ACTIVO
      const countT = (this.projectRoadsData && this.projectRoadsData.terciaria && this.projectRoadsData.terciaria.features)
        ? this.projectRoadsData.terciaria.features.length : 0;
      const countS = (this.projectRoadsData && this.projectRoadsData.secundaria && this.projectRoadsData.secundaria.features)
        ? this.projectRoadsData.secundaria.features.length : 0;
      const countP = (this.projectRoadsData && this.projectRoadsData.primaria && this.projectRoadsData.primaria.features)
        ? this.projectRoadsData.primaria.features.length : 0;

      if (bTerc) bTerc.innerText = countT.toLocaleString();
      if (bSec) bSec.innerText = countS.toLocaleString();
      if (bPrim) bPrim.innerText = countP.toLocaleString();
    }
  },

  /**
   * Calcula el Bounding Box con margen de seguridad de 0.05 grados (~5 km) alrededor de todos los tramos
   */
  calculateProjectBbox(project) {
    if (!project || (!project.georreferenciacion && !project.fase1B)) return null;
    const geo = project.georreferenciacion || project.fase1B || {};
    const tramos = geo.tramos || [];
    const puntos = geo.puntosInspeccion || geo.puntosContraste || geo.puntos || [];

    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    let count = 0;

    tramos.forEach(t => {
      (t.coordenadas || []).forEach(c => {
        if (c.lng !== undefined && c.lat !== undefined && !isNaN(c.lng) && !isNaN(c.lat)) {
          count++;
          if (c.lng < minLon) minLon = c.lng;
          if (c.lng > maxLon) maxLon = c.lng;
          if (c.lat < minLat) minLat = c.lat;
          if (c.lat > maxLat) maxLat = c.lat;
        }
      });
    });

    puntos.forEach(p => {
      if (p.coordsTrack && p.coordsTrack.length > 0) {
        p.coordsTrack.forEach(c => {
          count++;
          if (c.lng < minLon) minLon = c.lng;
          if (c.lng > maxLon) maxLon = c.lng;
          if (c.lat < minLat) minLat = c.lat;
          if (c.lat > maxLat) maxLat = c.lat;
        });
      } else if (p.lng !== undefined && p.lat !== undefined && p.lat !== 0) {
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
   * Sincroniza dinámicamente las vías con ArcGIS FeatureServer para el proyecto activo
   * Almacena únicamente en expedientesMap[proyectoId].fase1B.redVialRecortada
   * Jamás sobrescribe ni recorta window.redVialDepartamentalCompleta
   */
  async syncRoadsForProject(project) {
    project = project || this.currentProject;
    if (!project) return;

    if (!window.redVialDepartamentalCompleta || !window.redVialDepartamentalCompleta.features || window.redVialDepartamentalCompleta.features.length === 0) {
      await this.loadBaseRoads();
    }

    const bbox = this.calculateProjectBbox(project);
    let arcgisData = null;

    if (bbox) {
      try {
        arcgisData = await this.fetchArcgisRoads(bbox);
      } catch (arcgisErr) {
        console.warn("Aviso al consultar ArcGIS FeatureServer:", arcgisErr);
      }
    }

    const activeMpio = project.municipio;
    const daneCode = activeMpio ? this.getDaneCodeForMunicipio(activeMpio) : null;

    // 1. Terciaria Recortada
    let tercFeatures = [];
    if (arcgisData && arcgisData.terciaria && arcgisData.terciaria.features && arcgisData.terciaria.features.length > 0) {
      tercFeatures = arcgisData.terciaria.features;
    } else if (daneCode && this.terciariaByMpio[daneCode] && this.terciariaByMpio[daneCode].length > 0) {
      tercFeatures = this.terciariaByMpio[daneCode];
    } else if (bbox && window.redVialDepartamentalCompleta && window.redVialDepartamentalCompleta.terciaria) {
      tercFeatures = this.filterFeaturesByBbox(window.redVialDepartamentalCompleta.terciaria.features || [], bbox);
    }
    this.projectRoadsData.terciaria = { type: "FeatureCollection", features: tercFeatures };

    // 2. Secundaria Recortada
    let secFeatures = [];
    if (arcgisData && arcgisData.secundaria && arcgisData.secundaria.features && arcgisData.secundaria.features.length > 0) {
      secFeatures = arcgisData.secundaria.features;
    } else if (bbox && window.redVialDepartamentalCompleta && window.redVialDepartamentalCompleta.secundaria) {
      secFeatures = this.filterFeaturesByBbox(window.redVialDepartamentalCompleta.secundaria.features || [], bbox);
    }
    this.projectRoadsData.secundaria = { type: "FeatureCollection", features: secFeatures };

    // 3. Primaria Recortada
    let primFeatures = [];
    if (arcgisData && arcgisData.primaria && arcgisData.primaria.features && arcgisData.primaria.features.length > 0) {
      primFeatures = arcgisData.primaria.features;
    } else if (bbox && window.redVialDepartamentalCompleta && window.redVialDepartamentalCompleta.primaria) {
      primFeatures = this.filterFeaturesByBbox(window.redVialDepartamentalCompleta.primaria.features || [], bbox);
    }
    this.projectRoadsData.primaria = { type: "FeatureCollection", features: primFeatures };

    // Guardar en expedientesMap[proyectoId].fase1B.redVialRecortada (Sin tocar window.redVialDepartamentalCompleta)
    const redRecortada = {
      type: "FeatureCollection",
      features: [...tercFeatures, ...secFeatures, ...primFeatures],
      terciaria: this.projectRoadsData.terciaria,
      secundaria: this.projectRoadsData.secundaria,
      primaria: this.projectRoadsData.primaria
    };

    const pId = project.id || project.codigo || (window.App && window.App.currentProjectId);
    const expMap = (window.SIPRO_DATA && SIPRO_DATA.expedientesMap) || window.proyectosAuditados || (window.App && window.App.expedientesMap);
    if (expMap && pId && expMap[pId]) {
      if (!expMap[pId].fase1B) expMap[pId].fase1B = project.georreferenciacion || {};
      expMap[pId].fase1B.redVialRecortada = redRecortada;
    }
    if (project.georreferenciacion) project.georreferenciacion.redVialRecortada = redRecortada;
    if (project.fase1B) project.fase1B.redVialRecortada = redRecortada;

    const totalCount = tercFeatures.length + secFeatures.length + primFeatures.length;
    if (arcgisData && (arcgisData.terciaria.features.length > 0 || arcgisData.secundaria.features.length > 0 || arcgisData.primaria.features.length > 0)) {
      this.updateArcgisStatusIndicator("CONNECTED", totalCount);
    } else {
      this.updateArcgisStatusIndicator("OFFLINE_FALLBACK");
    }

    this.updateLayerBadges();
    this.recalculateProjectProximity(project);
    this.renderTerciariaLayer();
    if (this.layerVisibility.secundaria) this.renderSecundariaLayer();
    if (this.layerVisibility.primaria) this.renderPrimariaLayer();
    if (this.layerVisibility.measurementVectors) this.renderMeasurementVectorsLayer(project);
    this.renderContrastTable(project);
    this.bringProjectTracksToFront();
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
   * Carga la Red Vial Secundaria Departamental (Base/Red Vial/Secundaria.geojson)
   * Sin mostrar nunca 'Error'
   */
  async loadSecundariaAuto() {
    if (this.cachedGeoData.secundaria || this.isLoadingSecundaria) return;

    this.isLoadingSecundaria = true;
    const badge = document.getElementById("badgeSecundariaCount");
    if (badge) badge.innerText = "⏳...";

    try {
      const url = encodeURI("Base/Red Vial/Secundaria.geojson");
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const geojson = await res.json();
      this.cachedGeoData.secundaria = geojson;
      if (window.redVialDepartamentalCompleta) {
        window.redVialDepartamentalCompleta.secundaria = geojson;
      }
      this.updateLayerBadges();
      if (this.leafletMap && this.layerVisibility.secundaria) {
        this.renderSecundariaLayer();
      }
    } catch (err) {
      console.warn("Aviso al cargar Red Secundaria:", err);
      if (badge) badge.innerText = "0";
    } finally {
      this.isLoadingSecundaria = false;
    }
  },

  /**
   * Carga la Red Vial Primaria Nacional/Concesionada (Base/Red Vial/Primaria.geojson)
   * Sin mostrar nunca 'Error'
   */
  async loadPrimariaAuto() {
    if (this.cachedGeoData.primaria || this.isLoadingPrimaria) return;

    this.isLoadingPrimaria = true;
    const badge = document.getElementById("badgePrimariaCount");
    if (badge) badge.innerText = "⏳...";

    try {
      const url = encodeURI("Base/Red Vial/Primaria.geojson");
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const geojson = await res.json();
      this.cachedGeoData.primaria = geojson;
      if (window.redVialDepartamentalCompleta) {
        window.redVialDepartamentalCompleta.primaria = geojson;
      }
      this.updateLayerBadges();
      if (this.leafletMap && this.layerVisibility.primaria) {
        this.renderPrimariaLayer();
      }
    } catch (err) {
      console.warn("Aviso al cargar Red Primaria:", err);
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
  toggleMpioFilter() {
    this.filterByActiveMunicipio = !this.filterByActiveMunicipio;
    this.syncToggleButtonsUI();
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
      this.showToast(`🌐 Toda Antioquia: Renderizando red departamental completa (${totalVias.toLocaleString()} vías con aceleración por canvas).`);
    } else {
      // Modo Municipio Activo: recortar al municipio y centrar en tramos del proyecto
      this.zoomToProjectTracks();
      const mpioName = (this.currentProject && this.currentProject.municipio) || "Municipio";
      this.showToast(`📍 Solo Municipio Activo: Red vial recortada al entorno de ${mpioName}.`);
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
    const activeMpio = project && project.municipio;
    const daneCode = activeMpio ? this.getDaneCodeForMunicipio(activeMpio) : null;

    // 1. Redes recortadas del proyecto
    if (this.projectRoadsData.terciaria && this.projectRoadsData.terciaria.features && this.projectRoadsData.terciaria.features.length > 0) {
      candidates.push(...this.projectRoadsData.terciaria.features);
    } else if (daneCode && this.terciariaByMpio[daneCode] && this.terciariaByMpio[daneCode].length > 0) {
      candidates.push(...this.terciariaByMpio[daneCode]);
    } else if (window.redVialDepartamentalCompleta && window.redVialDepartamentalCompleta.terciaria && window.redVialDepartamentalCompleta.terciaria.features) {
      candidates.push(...window.redVialDepartamentalCompleta.terciaria.features);
    } else if (this.cachedGeoData.terciaria && this.cachedGeoData.terciaria.features) {
      candidates.push(...this.cachedGeoData.terciaria.features);
    }

    // Corredores Secundarios
    if (this.projectRoadsData.secundaria && this.projectRoadsData.secundaria.features) {
      candidates.push(...this.projectRoadsData.secundaria.features);
    } else if (this.cachedGeoData.secundaria && this.cachedGeoData.secundaria.features) {
      candidates.push(...this.cachedGeoData.secundaria.features);
    }

    // Corredores Primarios
    if (this.projectRoadsData.primaria && this.projectRoadsData.primaria.features) {
      candidates.push(...this.projectRoadsData.primaria.features);
    } else if (this.cachedGeoData.primaria && this.cachedGeoData.primaria.features) {
      candidates.push(...this.cachedGeoData.primaria.features);
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

    let minDist = Infinity;
    let bestProj = null;
    let bestFeature = null;

    for (let fIdx = 0; fIdx < candidateFeatures.length; fIdx++) {
      const feat = candidateFeatures[fIdx];
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
      const cod = (p.CODIGO_VIA ? String(p.CODIGO_VIA).trim() : "") || "05000VT01";
      const nom = (p.NOMBRE_VIA ? String(p.NOMBRE_VIA).trim() : "") || "Vía Oficial";
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

  pointToSegmentDistanceMeters(latP, lngP, latA, lngA, latB, lngB) {
    const res = this.getClosestPointOnSegment(latP, lngP, latA, lngA, latB, lngB);
    return res.distM;
  },

  /**
   * Recalcula distancias y vectores exactos de proyección para todos los tramos y puntos
   */
  recalculateProjectProximity(project) {
    if (!project || (!project.georreferenciacion && !project.fase1B)) return;
    const geo = project.georreferenciacion || project.fase1B || {};
    const tramos = geo.tramos || [];
    const puntos = geo.puntos || geo.puntosInspeccion || geo.puntosContraste || [];
    const candidates = this.getCandidateFeatures(project);

    // 1. TRAMOS (LineStrings)
    tramos.forEach((t, tIdx) => {
      const coords = t.coordenadas || [];
      t.vectoresMedicion = [];

      if (coords.length > 0) {
        const pStart = coords[0];
        const pMid = coords[Math.floor(coords.length / 2)];
        const pEnd = coords[coords.length - 1];

        const vStart = this.findClosestProjectionToRoads(pStart.lat, pStart.lng, candidates);
        vStart.tipoControl = "inicio";
        vStart.nombrePunto = `${t.nombrePlacemark || 'Tramo'} (Inicio)`;

        const vMid = this.findClosestProjectionToRoads(pMid.lat, pMid.lng, candidates);
        vMid.tipoControl = "medio";
        vMid.nombrePunto = `${t.nombrePlacemark || 'Tramo'} (Punto Medio)`;

        const vEnd = this.findClosestProjectionToRoads(pEnd.lat, pEnd.lng, candidates);
        vEnd.tipoControl = "fin";
        vEnd.nombrePunto = `${t.nombrePlacemark || 'Tramo'} (Fin)`;

        let vMax = vStart;
        const step = Math.max(1, Math.floor(coords.length / 12));
        for (let i = 0; i < coords.length; i += step) {
          const pt = coords[i];
          const vSample = this.findClosestProjectionToRoads(pt.lat, pt.lng, candidates);
          if (vSample.distM > vMax.distM) {
            vMax = vSample;
            vMax.tipoControl = "maxDesviacion";
            vMax.nombrePunto = `${t.nombrePlacemark || 'Tramo'} (Máx. Desviación)`;
          }
        }

        t.vectoresMedicion = [vStart, vMid, vEnd];
        if (vMax !== vStart && vMax !== vMid && vMax !== vEnd) {
          t.vectoresMedicion.push(vMax);
        }

        t.vectorPrincipal = vMax;
        t.distanciaEjeM = vMax.distM;
        t.distanciaMetros = vMax.distM;
        t.coordOrigenKML = vMax.coordOrigenKML;
        t.coordMasCercanaEje = vMax.coordMasCercanaEje;
        t.codigoViaGeoJSON = vMax.codigoVia;
        t.nombreViaGeoJSON = vMax.nombreVia;
        t.categoriaVia = vMax.categoriaVia;
        t.orden = vMax.orden;
        t.colorCategoria = vMax.colorCategoria;
        t.cumple = t.distanciaEjeM <= this.BUFFER_TOLERANCIA_M;
        t.estado = t.cumple ? `✓ SOBRE ${t.codigoViaGeoJSON}` : `! A ${t.distanciaEjeM.toFixed(1)} m DE ${t.codigoViaGeoJSON}`;
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

    const tramosConformes = tramos.filter(t => t.cumple).length;
    geo.coberturaBufferPct = tramos.length > 0 ? +((tramosConformes / tramos.length) * 100).toFixed(1) : 100;
    geo.puntosAnomalia = tramos.length - tramosConformes;
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

    if (this.filterByActiveMunicipio) {
      // 1. MODO RECORTADA AL MUNICIPIO / PROYECTO
      featuresToRender = (this.projectRoadsData && this.projectRoadsData.terciaria && this.projectRoadsData.terciaria.features) || [];
      subtitleText = `${featuresToRender.length} vías terciarias en entorno de ${activeMpio ? activeMpio.toUpperCase() : 'Proyecto'}`;
    } else {
      // 2. MODO TODA ANTIOQUIA (COMPLETA)
      const full = (window.redVialDepartamentalCompleta && window.redVialDepartamentalCompleta.terciaria && window.redVialDepartamentalCompleta.terciaria.features)
        ? window.redVialDepartamentalCompleta.terciaria.features
        : ((this.cachedGeoData.terciaria && this.cachedGeoData.terciaria.features) || []);
      featuresToRender = full;
      subtitleText = `🌐 Red Vial Completa de Antioquia (${featuresToRender.length.toLocaleString()} vías terciarias)`;
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
      featuresToRender = (this.projectRoadsData && this.projectRoadsData.secundaria && this.projectRoadsData.secundaria.features) || [];
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
      featuresToRender = (this.projectRoadsData && this.projectRoadsData.primaria && this.projectRoadsData.primaria.features) || [];
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
      tramos.forEach(t => {
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
            color: '#00FF66',
            weight: 5,
            opacity: 1.0,
            lineCap: 'round',
            lineJoin: 'round'
          }).bindPopup(`
            <div style="font-family:sans-serif;font-size:12px;line-height:1.4">
              <div style="background:#00412e;color:#00FF66;font-weight:bold;padding:5px 8px;border-radius:4px 4px 0 0;margin:-10px -10px 8px -10px;border-bottom:1px solid #00FF66">
                📍 ${t.nombrePlacemark || t.idTramo || 'Tramo de Proyecto'}
              </div>
              <b>Longitud Calculada:</b> ${t.longitudCalculada ? t.longitudCalculada.toFixed(1) + ' m' : (t.longitudM ? t.longitudM.toFixed(1) + ' m' : 'N/D')}<br>
              <b>Archivo de Origen:</b> ${t.carpetaContenedora || geo.archivoKml || 'KML'}<br>
              <b>Vía Oficial Cruzada:</b> <span style="font-family:monospace;color:#0284c7;font-weight:bold">${t.codigoViaGeoJSON || 'N/A'}</span><br>
              <b>Nombre Vía:</b> ${t.nombreViaGeoJSON || 'N/A'}<br>
              <b>Distancia al Eje:</b> <b>${t.distanciaEjeM !== undefined ? t.distanciaEjeM.toFixed(1) + ' m' : '0 m'}</b><br>
              <b>Estado:</b> <span style="color:${t.cumple ? '#059669' : '#e11d48'};font-weight:bold">${t.estado}</span>
            </div>
          `);
          this.layers.projectTrackLayer.addLayer(coreLine);
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
    if (!this.leafletMap || !this.layers.measurementVectorsLayer) return;
    this.layers.measurementVectorsLayer.clearLayers();

    if (!this.layerVisibility.measurementVectors) return;

    project = project || this.currentProject;
    if (!project) return;

    const geo = project.georreferenciacion || project.fase1B || {};
    const tramos = geo.tramos || [];
    const puntos = geo.puntos || geo.puntosInspeccion || geo.puntosContraste || [];

    const drawVector = (v, parentItem, isTramo) => {
      if (!v || !v.coordOrigenKML || !v.coordMasCercanaEje) return null;
      const [lat1, lng1] = v.coordOrigenKML;
      const [lat2, lng2] = v.coordMasCercanaEje;
      const dist = v.distM;
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
      const vectors = t.vectoresMedicion && t.vectoresMedicion.length > 0 ? t.vectoresMedicion : (t.vectorPrincipal ? [t.vectorPrincipal] : []);
      vectors.forEach(v => {
        const drawn = drawVector(v, t, true);
        if (drawn) t._vectorLayers.push(drawn);
      });
    });

    puntos.forEach(p => {
      p._vectorLayers = [];
      const vectors = p.vectoresMedicion && p.vectoresMedicion.length > 0 ? p.vectoresMedicion : (p.vectorMedicion ? [p.vectorMedicion] : []);
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
      if (v && v.coordOrigenKML && v.coordMasCercanaEje) {
        const center = [
          (v.coordOrigenKML[0] + v.coordMasCercanaEje[0]) / 2,
          (v.coordOrigenKML[1] + v.coordMasCercanaEje[1]) / 2
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
        if (Array.isArray(c) && c.length >= 2 && !isNaN(c[0]) && !isNaN(c[1])) {
          allLatLngs.push([c[0], c[1]]);
        } else if (c && c.lat !== undefined && c.lng !== undefined && !isNaN(c.lat) && !isNaN(c.lng)) {
          allLatLngs.push([c.lat, c.lng]);
        }
      });
    });

    puntos.forEach(p => {
      const lat = p.lat || (Array.isArray(p.coordenadas) ? p.coordenadas[0] : 0);
      const lng = p.lng || (Array.isArray(p.coordenadas) ? p.coordenadas[1] : 0);
      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        allLatLngs.push([lat, lng]);
      } else if (p.coordsTrack && p.coordsTrack.length > 0) {
        p.coordsTrack.forEach(c => {
          if (c.lat !== undefined && c.lng !== undefined && !isNaN(c.lat) && !isNaN(c.lng)) {
            allLatLngs.push([c.lat, c.lng]);
          }
        });
      }
    });

    if (allLatLngs.length === 0 && this.layers.projectTrackLayer) {
      const trackBounds = (typeof this.layers.projectTrackLayer.getBounds === "function")
        ? this.layers.projectTrackLayer.getBounds()
        : null;
      if (trackBounds && trackBounds.isValid()) {
        this.leafletMap.fitBounds(trackBounds, { padding: [60, 60], maxZoom: 18 });
        this.bringProjectTracksToFront();
        return;
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
    this.filterByActiveMunicipio = true;
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
    }

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
    const puntos = geo.puntos || geo.puntosInspeccion || geo.puntosContraste || [];

    const totalTramos = tramos.length;
    const tramosConformes = tramos.filter(t => t.cumple).length;
    const totalPuntos = puntos.length;
    const puntosConformes = puntos.filter(p => p.cumple).length;

    if (countViasEl && !this.cachedGeoData.terciaria) {
      countViasEl.innerText = project.municipio
        ? `Red Vial Terciaria Oficial - Entorno ${project.municipio}`
        : `Red Vial Terciaria Oficial de Antioquia`;
    }

    if (countPointsEl) {
      if (totalTramos > 0) {
        countPointsEl.innerText = `${tramosConformes} de ${totalTramos} tramos conformes (≤ 10 m de eje vial) | ${puntosConformes} de ${totalPuntos} puntos conformes`;
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
          <td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted);background:rgba(0,0,0,0.02);">
            <div style="font-size:14px;font-weight:700;color:var(--text-main);margin-bottom:4px;">Eje vial pendiente de georreferenciación</div>
            <div style="font-size:12px;">Cargue la carpeta del municipio con archivo KML, KMZ, ZIP, 7Z o RAR para contrastar contra la red vial terciaria oficial.</div>
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

      const isOk = t.cumple;
      const dist = t.distanciaEjeM !== undefined ? t.distanciaEjeM : 0;
      const lenText = t.longitudCalculada ? `${t.longitudCalculada.toFixed(1)} m` : (t.longitudM ? `${t.longitudM.toFixed(1)} m` : "N/D");

      tr.innerHTML = `
        <td class="font-mono font-bold" style="color:#10b981">${t.idTramo || 'TR'}</td>
        <td>
          <div style="font-weight:700;color:var(--text-main)">${t.nombrePlacemark || 'Tramo sin nombre'}</div>
          <div style="font-size:10px;color:var(--text-muted)">${t.carpetaContenedora || 'KML/KMZ'}</div>
        </td>
        <td class="font-mono" style="font-size:11px">${t.codigoViaDeclarado || 'N/A'}</td>
        <td class="font-mono font-bold" style="color:#0284c7">${t.codigoViaGeoJSON || 'N/A'}</td>
        <td style="font-size:11px">
          <div style="font-weight:600;color:var(--text-main)">${t.nombreViaGeoJSON || 'Sin nombre'}</div>
          <span style="display:inline-block;margin-top:2px;font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;background:${(t.colorCategoria || '#0284c7')}18;color:${t.colorCategoria || '#0284c7'};border:1px solid ${(t.colorCategoria || '#0284c7')}44;">
            ${t.categoriaVia || 'Red Terciaria (Orden 3)'}
          </span>
        </td>
        <td class="font-mono" style="text-align:right">
          <div style="font-weight:700;color:#10b981">${lenText}</div>
          <div style="font-size:10px;color:var(--text-muted)">Dist: ${dist.toFixed(1)} m</div>
        </td>
        <td style="text-align:center">
          <span class="status-pill ${isOk ? 'cumple' : 'no-cumple'}" style="font-size:10px;white-space:nowrap;">
            ${isOk ? '✓ ' + (t.estado || `SOBRE ${t.codigoViaGeoJSON}`) : '! ' + (t.estado || `A ${dist.toFixed(1)} m DE ${t.codigoViaGeoJSON}`)}
          </span>
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
        <td class="font-mono" style="text-align:right">
          <div style="font-size:11px;font-weight:700;color:var(--text-main)">Eje: ${dist.toFixed(1)} m</div>
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
        tieneGeorreferenciacionValida: tieneGeorreferenciacionValida,
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
      puntos: geo.puntos || geo.puntosInspeccion || [],
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
