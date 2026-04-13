import { GEOSERVER_CONFIG } from "@/config/geoserver";
import { buildLayerSchema } from "./layerSchema";

function buildWorkspace(layer) {
  if (layer.workspace) return layer.workspace;
  return GEOSERVER_CONFIG.workspace;
}

function decorateLayer(layer, groupPath) {
  const schema = buildLayerSchema(layer, groupPath);
  return {
    ...layer,
    behavior: schema.behavior,
    sourceType: schema.sourceType,
    renderMode: schema.renderMode,
    workspace: buildWorkspace(layer),
    layerName: schema.layerName,
    title: layer.title || layer.name,
    groupPath,
    popupSchema: schema.popupSchema,
    queryMode: schema.queryMode,
    hoverMode: schema.hoverMode,
    clickFallbackMode: schema.clickFallbackMode,
    boundsMode: schema.boundsMode,
    fitOnEnable: schema.fitOnEnable,
    bounds: layer.bounds || null,
    styleRef: schema.styleRef,
    geometryType: schema.geometryType,
    legacyGeojsonId: schema.legacyGeojsonId,
    migrationStatus: schema.migrationStatus,
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
    renderMode: layer.renderMode,
    queryMode: layer.queryMode,
    boundsMode: layer.boundsMode,
    styleRef: layer.styleRef,
    popupSchema: layer.popupSchema,
    migrationStatus: layer.migrationStatus,
  }));
}
