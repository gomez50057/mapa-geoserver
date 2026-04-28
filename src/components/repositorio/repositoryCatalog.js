import { GEOSERVER_CONFIG } from "@/config/geoserver";
import { LAYERS_TREE } from "@/data/layersTree";
import { flattenLayers } from "@/data/layerCatalog";

const DOWNLOAD_FORMATS = [
  {
    key: "geojson",
    label: "GeoJSON",
    outputFormat: "application/json",
    title: "Formato recomendado para web, análisis y edición SIG.",
  },
  {
    key: "shp",
    label: "SHP",
    outputFormat: "SHAPE-ZIP",
    title: "Paquete shapefile comprimido para escritorio SIG.",
  },
  {
    key: "csv",
    label: "CSV",
    outputFormat: "csv",
    title: "Tabla para revisión rápida y cruces de información.",
  },
];

function qualifiedLayerName(layer) {
  return layer.workspace ? `${layer.workspace}:${layer.layerName}` : layer.layerName;
}

function buildDownloadUrl(layer, outputFormat) {
  const params = new URLSearchParams({
    service: "WFS",
    version: "1.1.0",
    request: "GetFeature",
    typeName: qualifiedLayerName(layer),
    outputFormat,
    srsName: "EPSG:4326",
  });

  return `${GEOSERVER_CONFIG.wfsUrl}?${params.toString()}`;
}

function walkTree(node, ancestors = [], collector = []) {
  const nextPath = node.name ? [...ancestors, node.name] : ancestors;

  if (Array.isArray(node.layers)) {
    node.layers.forEach((layer) => {
      collector.push({
        ...layer,
        groupPath: nextPath,
      });
    });
  }

  if (Array.isArray(node.children)) {
    node.children.forEach((child) => walkTree(child, nextPath, collector));
  }

  return collector;
}

function buildLayerRecord(layer) {
  const collection = layer.groupPath[0] || "Catálogo";
  const municipality = collection === "Instrumentos de Planeación" ? layer.groupPath[1] || "General" : collection;
  const program = layer.groupPath.slice(2).join(" / ") || layer.groupPath.slice(1).join(" / ") || "Información territorial";

  return {
    id: layer.id,
    name: layer.title || layer.name,
    collection,
    municipality,
    program,
    groupPath: layer.groupPath.join(" / "),
    geometryType: layer.geometryType,
    migrationStatus: layer.migrationStatus,
    typeName: qualifiedLayerName(layer),
    downloads: DOWNLOAD_FORMATS.map((format) => ({
      ...format,
      href: buildDownloadUrl(layer, format.outputFormat),
    })),
  };
}

export function buildRepositoryCatalog() {
  const layers = walkTree({ children: LAYERS_TREE }).map(buildLayerRecord);
  const flatLayers = flattenLayers(LAYERS_TREE);
  const collections = [...new Set(layers.map((layer) => layer.collection))].sort((a, b) => a.localeCompare(b, "es"));
  const municipalities = [...new Set(layers.map((layer) => layer.municipality))].sort((a, b) => a.localeCompare(b, "es"));

  return {
    layers,
    collections,
    municipalities,
    formats: DOWNLOAD_FORMATS,
    stats: {
      layers: layers.length,
      connected: flatLayers.filter((layer) => layer.migrationStatus === "conectada").length,
      collections: collections.length,
    },
  };
}
