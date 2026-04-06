import { GEOSERVER_CONFIG } from "@/config/geoserver";

const POPUP_SCHEMA_OVERRIDES = {
  hgo_info_gen: "hidalgoInfo",
  esc_priv_ms: "escuelaPrivada",
  zmvm_info: "zonaMetropolitana",
  zmpachuca_info: "zonaMetropolitana",
  zmtula_info: "zonaMetropolitana",
  zmtulancingo_info: "zonaMetropolitana",
};

const SOURCE_TYPE_OVERRIDES = {};
const LAYER_NAME_OVERRIDES = {
  hgo_info_gen: "hgoinfogen",
  esc_priv_ms: "escmediasupprivada",
  definicion_de_limites_santiagotlg: "definicionlimites",
  zona_arqueologica_zazacuala: "zonaarqueologica",
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

function guessPopupSchema(layer, groupPath) {
  if (POPUP_SCHEMA_OVERRIDES[layer.id]) return POPUP_SCHEMA_OVERRIDES[layer.id];
  if (layer.legendKey === "PMDU_Pachuca") return "pachucaEtapas";
  if (layer.legendKey?.startsWith("PMDU_")) return "pmduGeneric";
  if (groupPath.some((segment) => segment.toLowerCase().includes("pmdu"))) return "pmduGeneric";
  if (groupPath.some((segment) => segment.toLowerCase().includes("metropolitana"))) return "zonaMetropolitana";
  return "default";
}

function guessGeometryType(layer) {
  if (layer.geometryType) return layer.geometryType;
  if (layer.meta?.asLine) return "LineString";
  if (layer.id === "esc_priv_ms") return "Point";
  return "Polygon";
}

function guessStyleRef(layer) {
  if (layer.styleRef) return layer.styleRef;
  return slugify(layer.legendKey || layer.legendTitle || layer.name || layer.id);
}

function buildLayerName(layer) {
  if (LAYER_NAME_OVERRIDES[layer.id]) return LAYER_NAME_OVERRIDES[layer.id];
  if (layer.layerName) return layer.layerName;
  return slugify(layer.geojsonId || layer.id);
}

function buildWorkspace(layer) {
  if (layer.workspace) return layer.workspace;
  return GEOSERVER_CONFIG.workspace;
}

function buildQueryMode(layer) {
  if (layer.queryMode) return layer.queryMode;
  return layer.sourceType === "wms" ? "getFeatureInfo" : "wfs";
}

function decorateLayer(layer, groupPath) {
  const sourceType =
    SOURCE_TYPE_OVERRIDES[layer.id] ||
    layer.sourceType ||
    "wms";
  return {
    ...layer,
    sourceType,
    workspace: buildWorkspace(layer),
    layerName: buildLayerName(layer),
    title: layer.title || layer.name,
    groupPath,
    popupSchema: layer.popupSchema || guessPopupSchema(layer, groupPath),
    queryMode: layer.queryMode || (sourceType === "wms" ? "getFeatureInfo" : "wfs"),
    bounds: layer.bounds || null,
    styleRef: guessStyleRef(layer),
    geometryType: guessGeometryType(layer),
    legacyGeojsonId: layer.geojsonId || null,
    migrationStatus: sourceType === "local" ? "pendiente" : "conectada",
  };
}

function decorateNode(node, ancestors = []) {
  const nextPath = node.name ? [...ancestors, node.name] : ancestors;
  const nextNode = { ...node };

  if (Array.isArray(node.layers)) {
    nextNode.layers = node.layers.map((layer) => decorateLayer(layer, nextPath));
  }

  if (Array.isArray(node.children)) {
    nextNode.children = node.children.map((child) => decorateNode(child, nextPath));
  }

  return nextNode;
}

export function buildHybridLayersTree(rawTree) {
  return rawTree.map((node) => decorateNode(node));
}

export function flattenLayers(tree) {
  const layers = [];

  const walk = (node) => {
    if (Array.isArray(node.layers)) layers.push(...node.layers);
    (node.children || []).forEach(walk);
  };

  tree.forEach(walk);
  return layers;
}

export function buildLayerIndex(tree) {
  return Object.fromEntries(flattenLayers(tree).map((layer) => [layer.id, layer]));
}

export function buildLayerMigrationTable(tree) {
  return flattenLayers(tree).map((layer) => ({
    id: layer.id,
    workspace: layer.workspace,
    layerName: layer.layerName,
    sourceType: layer.sourceType,
    styleRef: layer.styleRef,
    popupSchema: layer.popupSchema,
    migrationStatus: layer.migrationStatus,
  }));
}
