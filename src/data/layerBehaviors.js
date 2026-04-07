const POPUP_SCHEMA_OVERRIDES = {
  hgo_info_gen: "hidalgoInfo",
  esc_priv_ms: "escuelaPrivada",
  zmvm_info: "zonaMetropolitana",
  zmpachuca_info: "zonaMetropolitana",
  zmtula_info: "zonaMetropolitana",
  zmtulancingo_info: "zonaMetropolitana",
};

const LAYER_NAME_OVERRIDES = {
  hgo_info_gen: "hgoinfogen",
  esc_priv_ms: "escmediasupprivada",
  definicion_de_limites_santiagotlg: "definicionlimites",
  zona_arqueologica_zazacuala: "zonaarqueologica",
};

const LAYER_BEHAVIOR_OVERRIDES = {
  esc_priv_ms: {
    clickFallbackMode: "wfs",
    hoverMode: "getFeatureInfo",
  },
  hgo_info_gen: {
    clickFallbackMode: "wfs",
    hoverMode: "getFeatureInfo",
  },
};

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .toLowerCase();
}

export function guessPopupSchema(layer, groupPath) {
  if (POPUP_SCHEMA_OVERRIDES[layer.id]) return POPUP_SCHEMA_OVERRIDES[layer.id];
  if (layer.legendKey === "PMDU_Pachuca") return "pachucaEtapas";
  if (layer.legendKey?.startsWith("PMDU_")) return "pmduGeneric";
  if (groupPath.some((segment) => segment.toLowerCase().includes("pmdu"))) return "pmduGeneric";
  if (groupPath.some((segment) => segment.toLowerCase().includes("metropolitana"))) return "zonaMetropolitana";
  return "default";
}

export function guessGeometryType(layer) {
  if (layer.geometryType) return layer.geometryType;
  if (layer.meta?.asLine) return "LineString";
  if (layer.id === "esc_priv_ms") return "Point";
  return "Polygon";
}

export function guessStyleRef(layer) {
  if (layer.styleRef) return layer.styleRef;
  return slugify(layer.legendKey || layer.legendTitle || layer.name || layer.id);
}

export function buildLayerName(layer) {
  if (LAYER_NAME_OVERRIDES[layer.id]) return LAYER_NAME_OVERRIDES[layer.id];
  if (layer.layerName) return layer.layerName;
  return slugify(layer.geojsonId || layer.id);
}

export function buildLayerBehavior(layer, groupPath) {
  const popupSchema = layer.popupSchema || guessPopupSchema(layer, groupPath);
  const sourceType = layer.sourceType || "wms";
  const baseBehavior = {
    sourceType,
    renderMode: sourceType === "local" ? "local" : "wms",
    queryMode: sourceType === "local" ? "none" : "getFeatureInfo",
    hoverMode: sourceType === "local" ? "none" : "getFeatureInfo",
    clickFallbackMode: sourceType === "local" ? "none" : "wfs",
    boundsMode: sourceType === "local" ? "none" : "capabilities",
    fitOnEnable: true,
    popupSchema,
  };

  const override = LAYER_BEHAVIOR_OVERRIDES[layer.id] || {};
  return {
    ...baseBehavior,
    ...override,
    popupSchema: override.popupSchema || popupSchema,
  };
}
