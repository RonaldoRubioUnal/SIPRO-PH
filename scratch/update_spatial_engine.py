import os, re

def update_spatial():
    with open('js/spatial.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add discoveredLayers and measurementVectors in SpatialEngine object
    old_props = '''  // Conexión oficial ArcGIS FeatureServer (R10) - Secretaría de Infraestructura de Antioquia
  ARCGIS_BASE_URL: "https://services5.arcgis.com/K90UQIB09TmTjUL8/arcgis/rest/services/R10/FeatureServer",
  arcgisMetadata: null,
  arcgisConnectionState: "DISCONNECTED", // 'CONNECTING' | 'CONNECTED' | 'OFFLINE_FALLBACK'
  arcgisLayersMap: {
    1: { id: 1, key: "primaria", name: "Red vial primaria", orden: 1, color: "#ef4444", defaultWeight: 4.5 },
    2: { id: 2, key: "secundaria", name: "Red vial secundaria", orden: 2, color: "#f59e0b", defaultWeight: 4.0 },
    3: { id: 3, key: "terciaria", name: "Red vial terciaria", orden: 3, color: "#0284c7", defaultWeight: 3.5 }
  },'''

    new_props = '''  // Conexión oficial ArcGIS FeatureServer (R10) - Secretaría de Infraestructura de Antioquia
  ARCGIS_BASE_URL: "https://services5.arcgis.com/K90UQIB09TmTjUL8/arcgis/rest/services/R10/FeatureServer",
  arcgisMetadata: null,
  arcgisConnectionState: "DISCONNECTED", // 'CONNECTING' | 'CONNECTED' | 'OFFLINE_FALLBACK'
  discoveredLayers: [], // Capas autodescubiertas dinámicamente mediante .../FeatureServer?f=json
  arcgisLayersMap: {
    1: { id: 1, key: "primaria", name: "Red vial primaria", orden: 1, color: "#ef4444", defaultWeight: 4.5 },
    2: { id: 2, key: "secundaria", name: "Red vial secundaria", orden: 2, color: "#f59e0b", defaultWeight: 4.0 },
    3: { id: 3, key: "terciaria", name: "Red vial terciaria", orden: 3, color: "#0284c7", defaultWeight: 3.5 }
  },'''

    assert old_props in content, "old_props not found in spatial.js"
    content = content.replace(old_props, new_props)

    # 2. Add measurementVectors in layerVisibility and layers
    old_layers = '''  // Estado de visibilidad independiente por capa
  layerVisibility: {
    terciaria: true,
    secundaria: false,
    primaria: false,
    custom: true,
    projectTrack: true,
    buffer10m: true,
    buffer15m: true, // Alias de compatibilidad
    points: true
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
    pointsLayer: null
  },'''

    new_layers = '''  // Estado de visibilidad independiente por capa
  layerVisibility: {
    terciaria: true,
    secundaria: false,
    primaria: false,
    custom: true,
    projectTrack: true,
    buffer10m: true,
    buffer15m: true, // Alias de compatibilidad
    points: true,
    measurementVectors: true // 📏 Cota al Eje / Vectores de medición de distancia
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
    measurementVectorsLayer: null // Capa de líneas punteadas y nodos de medición
  },'''

    assert old_layers in content, "old_layers not found in spatial.js"
    content = content.replace(old_layers, new_layers)

    # 3. Update discoverArcgisService and add classifyFeature
    old_discover = '''  /**
   * Consulta el metadato del servicio (.../FeatureServer?f=json) para listar las capas activas
   */
  async discoverArcgisService() {
    try {
      const url = `${this.ARCGIS_BASE_URL}?f=json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.arcgisMetadata = data;
      if (Array.isArray(data.layers)) {
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
      return true;
    } catch (err) {
      console.warn("No se pudo obtener metadatos de ArcGIS FeatureServer (R10):", err);
      return false;
    }
  },'''

    new_discover = '''  /**
   * Consulta el metadato del servicio (.../FeatureServer?f=json) para listar las capas activas
   * Autodescubrimiento seguro: registra los IDs de capa que realmente existan en el servidor
   */
  async discoverArcgisService() {
    try {
      const url = `${this.ARCGIS_BASE_URL}?f=json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.arcgisMetadata = data;
      this.discoveredLayers = Array.isArray(data.layers) ? data.layers : [];

      if (this.discoveredLayers.length > 0) {
        this.arcgisLayersMap = {};
        this.discoveredLayers.forEach(l => {
          const lId = l.id;
          const lName = (l.name || "").toLowerCase();
          if (lName.includes("terciar") || lId === 3) {
            this.arcgisLayersMap[lId] = { id: lId, key: "terciaria", name: l.name, orden: 3, color: "#0284c7", defaultWeight: 3.5 };
          } else if (lName.includes("secundar") || lId === 2) {
            this.arcgisLayersMap[lId] = { id: lId, key: "secundaria", name: l.name, orden: 2, color: "#f59e0b", defaultWeight: 4.0 };
          } else if (lName.includes("primar") || lId === 1) {
            this.arcgisLayersMap[lId] = { id: lId, key: "primaria", name: l.name, orden: 1, color: "#ef4444", defaultWeight: 4.5 };
          } else {
            this.arcgisLayersMap[lId] = { id: lId, key: "terciaria", name: l.name, orden: 3, color: "#0284c7", defaultWeight: 3.5 };
          }
        });
      }
      return true;
    } catch (err) {
      console.warn("No se pudo obtener metadatos de ArcGIS FeatureServer (R10):", err);
      return false;
    }
  },

  /**
   * Clasifica una vía inspeccionando rigurosamente sus atributos de jerarquía vial
   * (CATEGORIA, ORDEN, TIPO_VIA, JERARQUIA, CLASIFICACION o CODIGO_VIA)
   */
  classifyFeature(f, defaultLayerId) {
    if (!f) return "terciaria";
    const p = f.properties = f.properties || {};
    const tipoVia = String(p.TIPO_VIA || "").trim();
    const orden = String(p.ORDEN || p.ORDEN_VIAL || "").trim();
    const cat = String(p.CATEGORIA || p.CATEGORIA_VIAL || p.JERARQUIA || p.CLASIFICACION || "").toUpperCase();
    const cod = String(p.CODIGO_VIA || "").toUpperCase();
    const nom = String(p.NOMBRE_VIA || "").toUpperCase();

    // 1. Red Primaria (Nacional / Concesionada / Orden 1)
    if (defaultLayerId === 1 || tipoVia === "1" || orden === "1" ||
        cat.includes("PRIMAR") || cat.includes("NACIONAL") || cat.includes("CONCESION") ||
        nom.includes("AUTOPISTA") || nom.includes("TRONCAL")) {
      p.ORDEN_VIAL = 1;
      p.CATEGORIA_VIAL = "Red Primaria (Orden 1)";
      p.COLOR_CATEGORIA = "#ef4444";
      return "primaria";
    }

    // 2. Red Secundaria (Departamental / Orden 2)
    if (defaultLayerId === 2 || tipoVia === "2" || orden === "2" ||
        cat.includes("SECUNDAR") || cat.includes("DEPARTAMENTAL")) {
      p.ORDEN_VIAL = 2;
      p.CATEGORIA_VIAL = "Red Secundaria (Orden 2)";
      p.COLOR_CATEGORIA = "#f59e0b";
      return "secundaria";
    }

    // 3. Red Terciaria (Municipal / Rural / VT)
    p.ORDEN_VIAL = 3;
    p.CATEGORIA_VIAL = "Red Terciaria (Orden 3)";
    p.COLOR_CATEGORIA = "#0284c7";
    return "terciaria";
  },'''

    assert old_discover in content, "old_discover not found in spatial.js"
    content = content.replace(old_discover, new_discover)

    with open('js/spatial.js', 'w', encoding='utf-8') as f:
        f.write(content)

    print('Step 1 applied successfully!')

if __name__ == '__main__':
    update_spatial()
