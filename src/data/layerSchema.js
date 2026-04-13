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

const LAYER_PAINT_OVERRIDES = {
  hgo_info_gen: {
    stroke: "#ffffff",
    fill: "rgba(0, 0, 0, 0.4)",
    weight: 2.6,
    fillOpacity: 0.6,
    dashArray: null,
    pointRadius: 6,
  },
  esc_priv_ms: {
    stroke: "#7C3AED",
    fill: "#7C3AED",
    weight: 1.5,
    fillOpacity: 0.85,
    dashArray: null,
    pointRadius: 6,
  },
  zmvm_info: {
    stroke: "transparent",
    fill: "#BC955B",
    weight: 2.6,
    fillOpacity: 0.45,
    dashArray: null,
    pointRadius: 6,
  },
  zmpachuca_info: {
    stroke: "transparent",
    fill: "#B6DC76",
    weight: 2,
    fillOpacity: 0.7,
    dashArray: null,
    pointRadius: 6,
  },
  zmtula_info: {
    stroke: "transparent",
    fill: "Aqua",
    weight: 2,
    fillOpacity: 0.7,
    dashArray: null,
    pointRadius: 6,
  },
  zmtulancingo_info: {
    stroke: "transparent",
    fill: "#241E4E",
    weight: 2,
    fillOpacity: 0.7,
    dashArray: null,
    pointRadius: 6,
  },
};

function includesSegment(groupPath, text) {
  return groupPath.some((segment) => segment.toLowerCase().includes(text));
}

export function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .toLowerCase();
}

export function resolvePopupSchema(layer, groupPath = []) {
  if (layer.popupSchema) return layer.popupSchema;
  if (POPUP_SCHEMA_OVERRIDES[layer.id]) return POPUP_SCHEMA_OVERRIDES[layer.id];
  if (layer.legendKey === "PMDU_Pachuca") return "pachucaEtapas";
  if (layer.legendKey?.startsWith("PMDU_")) return "pmduGeneric";
  if (includesSegment(groupPath, "pmdu")) return "pmduGeneric";
  if (includesSegment(groupPath, "metropolitana")) return "zonaMetropolitana";
  return "default";
}

export function resolveGeometryType(layer) {
  if (layer.geometryType) return layer.geometryType;
  if (layer.meta?.asLine) return "LineString";
  if (layer.id === "esc_priv_ms") return "Point";
  return "Polygon";
}

export function resolveStyleRef(layer) {
  if (layer.styleRef) return layer.styleRef;
  return slugify(layer.legendKey || layer.legendTitle || layer.name || layer.id);
}

export function resolveLayerName(layer) {
  if (LAYER_NAME_OVERRIDES[layer.id]) return LAYER_NAME_OVERRIDES[layer.id];
  if (layer.layerName) return layer.layerName;
  return slugify(layer.geojsonId || layer.id);
}

export function resolveLayerBehavior(layer, groupPath = []) {
  const popupSchema = resolvePopupSchema(layer, groupPath);
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

export function resolveLayerPaintOverride(layerDef) {
  return LAYER_PAINT_OVERRIDES[layerDef?.id] || null;
}

export function buildLayerSchema(layer, groupPath = []) {
  const behavior = resolveLayerBehavior(layer, groupPath);
  return {
    behavior,
    sourceType: behavior.sourceType,
    renderMode: behavior.renderMode,
    popupSchema: behavior.popupSchema,
    queryMode: behavior.queryMode,
    hoverMode: behavior.hoverMode,
    clickFallbackMode: behavior.clickFallbackMode,
    boundsMode: behavior.boundsMode,
    fitOnEnable: behavior.fitOnEnable,
    layerName: resolveLayerName(layer),
    styleRef: resolveStyleRef(layer),
    geometryType: resolveGeometryType(layer),
    legacyGeojsonId: layer.geojsonId || null,
    migrationStatus: behavior.sourceType === "local" ? "pendiente" : "conectada",
  };
}
