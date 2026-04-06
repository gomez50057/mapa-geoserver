import L from "leaflet";
import { GEOSERVER_CONFIG, resolveServiceUrl } from "@/config/geoserver";
import { getLayerPaint } from "@/data/legendCatalog";
import { renderPopupContent } from "@/data/popupSchemas";

const wfsResponseCache = new Map();
const wfsPendingRequests = new Map();
const wmsBoundsCache = new Map();
let wmsCapabilitiesPromise = null;

const PROPERTY_ALIAS_MAP = {
  id: "ID",
  nom_mun: "NOM_MUN",
  nom_ent: "NOM_ENT",
  nomgeo: "NOMGEO",
  pobmun: "POBMUN",
  pobfem: "POBFEM",
  pobmas: "POBMAS",
  pob_estata: "POB_ESTATA",
  pobmetro: "POBMETRO",
  no_zona: "NO_Zona",
  pmdu: "PMDU",
  pmd: "PMD",
  fech: "FECH",
  fechpmd: "FECHPMD",
  fechatlas: "FECHATLAS",
  linkpmdu: "LINKPMDU",
  linkpmd: "LINKPMD",
  linkatlas: "LINKATLAS",
  nom_link_p: "NOM_LINK_P",
  nom_link_1: "NOM_LINK_1",
  nom_link_a: "NOM_LINK_A",
  atlas: "ATLAS",
  superficie: "Superficie",
  clave: "Clave",
  zona: "Zona",
  zonsec: "ZonSec",
  zonsec2022: "ZonSec2022",
  uso: "Uso",
  categoria: "Categoria",
  politica: "POLITICA",
  region: "REGION",
  ar: "Ar",
  name_1: "Name_1",
};

function buildQualifiedLayerName(layerDef) {
  return layerDef.workspace ? `${layerDef.workspace}:${layerDef.layerName}` : layerDef.layerName;
}

function projectBounds(map) {
  const bounds = map.getBounds();
  const crs = map.options.crs;
  const southWest = crs.project(bounds.getSouthWest());
  const northEast = crs.project(bounds.getNorthEast());
  return [southWest.x, southWest.y, northEast.x, northEast.y].join(",");
}

function buildServiceUrl(url, params) {
  const base = resolveServiceUrl(url);
  const serviceUrl = typeof window !== "undefined" ? new URL(base, window.location.origin) : new URL(base, "http://localhost");

  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== "") serviceUrl.searchParams.set(key, value);
  });

  if (typeof window === "undefined" && !/^https?:\/\//i.test(base)) {
    return `${base}?${serviceUrl.searchParams.toString()}`;
  }

  return serviceUrl.toString();
}

export function createWmsLayer(layerDef, paneId, zIndex) {
  return L.tileLayer.wms(resolveServiceUrl(GEOSERVER_CONFIG.wmsUrl), {
    layers: buildQualifiedLayerName(layerDef),
    format: "image/png",
    transparent: true,
    tiled: true,
    tileSize: 256,
    keepBuffer: 4,
    updateWhenIdle: true,
    pane: paneId,
    zIndex,
    styles: layerDef.wmsStyleName || "",
    version: GEOSERVER_CONFIG.wmsVersion,
  });
}

export async function fetchFeatureInfo(map, latlng, layerDef) {
  const point = map.latLngToContainerPoint(latlng, map.getZoom());
  const size = map.getSize();
  const url = buildServiceUrl(GEOSERVER_CONFIG.wmsUrl, {
    service: "WMS",
    request: "GetFeatureInfo",
    version: GEOSERVER_CONFIG.wmsVersion,
    layers: buildQualifiedLayerName(layerDef),
    query_layers: buildQualifiedLayerName(layerDef),
    styles: layerDef.wmsStyleName || "",
    bbox: projectBounds(map),
    width: size.x,
    height: size.y,
    srs: GEOSERVER_CONFIG.defaultCrs,
    format: "image/png",
    info_format: GEOSERVER_CONFIG.infoFormat,
    feature_count: GEOSERVER_CONFIG.defaultFeatureCount,
    buffer: GEOSERVER_CONFIG.queryBuffer,
    x: Math.round(point.x),
    y: Math.round(point.y),
  });

  const response = await fetch(url);
  if (!response.ok) throw new Error(`GetFeatureInfo failed for ${layerDef.id}`);

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return { features: [] };
  }

  const payload = await response.json();
  return {
    ...payload,
    features: Array.isArray(payload?.features) ? payload.features : [],
  };
}

export async function fetchWfsFeatures(layerDef, options = {}) {
  const params = {
    service: "WFS",
    version: "1.1.0",
    request: "GetFeature",
    typeName: buildQualifiedLayerName(layerDef),
    outputFormat: "application/json",
    srsName: "EPSG:4326",
  };

  if (options.maxFeatures) params.maxFeatures = options.maxFeatures;
  if (options.bbox) params.bbox = options.bbox;

  const requestUrl = buildServiceUrl(GEOSERVER_CONFIG.wfsUrl, params);
  const cacheKey = requestUrl;

  if (wfsResponseCache.has(cacheKey)) {
    return wfsResponseCache.get(cacheKey);
  }

  if (wfsPendingRequests.has(cacheKey)) {
    return wfsPendingRequests.get(cacheKey);
  }

  const request = fetch(requestUrl)
    .then(async (response) => {
      if (!response.ok) throw new Error(`WFS GetFeature failed for ${layerDef.id}`);
      const payload = await response.json();
      wfsResponseCache.set(cacheKey, payload);
      return payload;
    })
    .catch((error) => {
      throw new Error(`WFS fetch failed for ${layerDef.id}: ${error?.message || error}`);
    })
    .finally(() => {
      wfsPendingRequests.delete(cacheKey);
    });

  wfsPendingRequests.set(cacheKey, request);
  return request;
}

function getFirstTagText(parent, tagNames) {
  for (const tagName of tagNames) {
    const node = parent.getElementsByTagName(tagName)?.[0];
    const text = node?.textContent?.trim();
    if (text) return text;
  }
  return null;
}

function parseBoundsFromLayerNode(layerNode) {
  const exGeo = layerNode.getElementsByTagName("EX_GeographicBoundingBox")?.[0];
  if (exGeo) {
    const west = Number(getFirstTagText(exGeo, ["westBoundLongitude"]));
    const east = Number(getFirstTagText(exGeo, ["eastBoundLongitude"]));
    const south = Number(getFirstTagText(exGeo, ["southBoundLatitude"]));
    const north = Number(getFirstTagText(exGeo, ["northBoundLatitude"]));
    if ([west, east, south, north].every(Number.isFinite)) {
      return L.latLngBounds([south, west], [north, east]);
    }
  }

  const latLon = layerNode.getElementsByTagName("LatLonBoundingBox")?.[0];
  if (latLon) {
    const west = Number(latLon.getAttribute("minx"));
    const east = Number(latLon.getAttribute("maxx"));
    const south = Number(latLon.getAttribute("miny"));
    const north = Number(latLon.getAttribute("maxy"));
    if ([west, east, south, north].every(Number.isFinite)) {
      return L.latLngBounds([south, west], [north, east]);
    }
  }

  const boxes = Array.from(layerNode.getElementsByTagName("BoundingBox") || []);
  const preferredBox = boxes.find((node) => {
    const crs = node.getAttribute("CRS") || node.getAttribute("SRS");
    return crs === "EPSG:4326";
  });

  if (preferredBox) {
    const west = Number(preferredBox.getAttribute("minx"));
    const east = Number(preferredBox.getAttribute("maxx"));
    const south = Number(preferredBox.getAttribute("miny"));
    const north = Number(preferredBox.getAttribute("maxy"));
    if ([west, east, south, north].every(Number.isFinite)) {
      return L.latLngBounds([south, west], [north, east]);
    }
  }

  return null;
}

async function fetchWmsCapabilities() {
  if (wmsCapabilitiesPromise) return wmsCapabilitiesPromise;

  const requestUrl = buildServiceUrl(GEOSERVER_CONFIG.wmsUrl, {
    service: "WMS",
    request: "GetCapabilities",
    version: GEOSERVER_CONFIG.wmsVersion,
  });

  wmsCapabilitiesPromise = fetch(requestUrl)
    .then(async (response) => {
      if (!response.ok) throw new Error("WMS GetCapabilities failed");
      const text = await response.text();
      const parser = new DOMParser();
      return parser.parseFromString(text, "text/xml");
    })
    .catch((error) => {
      wmsCapabilitiesPromise = null;
      throw error;
    });

  return wmsCapabilitiesPromise;
}

export async function fetchLayerBounds(layerDef) {
  const qualifiedName = buildQualifiedLayerName(layerDef);
  if (wmsBoundsCache.has(qualifiedName)) {
    return wmsBoundsCache.get(qualifiedName);
  }

  const capabilities = await fetchWmsCapabilities();
  const layerNodes = Array.from(capabilities.getElementsByTagName("Layer") || []);
  const match = layerNodes.find((node) => {
    const name = getFirstTagText(node, ["Name"]);
    return name === qualifiedName || name === layerDef.layerName;
  });

  const bounds = match ? parseBoundsFromLayerNode(match) : null;
  if (bounds?.isValid?.()) {
    wmsBoundsCache.set(qualifiedName, bounds);
    return bounds;
  }

  return null;
}

export function buildPointBbox(latlng, radius = 0.003) {
  const south = latlng.lat - radius;
  const north = latlng.lat + radius;
  const west = latlng.lng - radius;
  const east = latlng.lng + radius;
  return `${west},${south},${east},${north},EPSG:4326`;
}

function normalizeProperties(properties) {
  const normalized = { ...(properties || {}) };

  Object.entries(properties || {}).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();
    const upperKey = key.toUpperCase();

    if (!(lowerKey in normalized)) normalized[lowerKey] = value;
    if (!(upperKey in normalized)) normalized[upperKey] = value;

    const alias = PROPERTY_ALIAS_MAP[lowerKey];
    if (alias && !(alias in normalized)) normalized[alias] = value;
  });

  return normalized;
}

function normalizeFeature(feature) {
  if (!feature) return null;
  return {
    ...feature,
    properties: normalizeProperties(feature.properties),
  };
}

function normalizeFeatureCollection(featureCollection) {
  return {
    ...featureCollection,
    features: (featureCollection?.features || []).map(normalizeFeature),
  };
}

export async function fetchFeatureAtLatLng(layerDef, latlng, radius = 0.0015) {
  const collection = await fetchWfsFeatures(layerDef, {
    bbox: buildPointBbox(latlng, radius),
    maxFeatures: 1,
  });

  const feature = normalizeFeature(collection?.features?.[0]);
  return feature || null;
}

function buildGenericWfsLayer(normalizedCollection, paneId, layerDef) {
  const paint = getLayerPaint(layerDef);
  return L.geoJSON(normalizedCollection, {
    pane: paneId,
    pointToLayer: (_, latlng) =>
      L.circleMarker(latlng, {
        pane: paneId,
        radius: paint.pointRadius,
        color: paint.stroke,
        weight: paint.weight,
        fillColor: paint.fill,
        fillOpacity: paint.fillOpacity,
      }),
    style: () => ({
      color: paint.stroke,
      weight: paint.weight,
      fillColor: paint.fill,
      fillOpacity: paint.fillOpacity,
      dashArray: paint.dashArray,
    }),
    onEachFeature: (feature, leafletLayer) => {
      const html = renderPopupContent(layerDef.popupSchema, normalizeProperties(feature?.properties || {}), layerDef);
      leafletLayer.bindPopup(html, { maxWidth: 420 });
      leafletLayer.on("click", (event) => {
        leafletLayer.openPopup(event.latlng);
      });
    },
  });
}

export async function buildWfsLayer(featureCollection, paneId, layerDef, options = {}) {
  const normalizedCollection = normalizeFeatureCollection(featureCollection);
  const { preferLegacyBuilder = true } = options;

  if (!preferLegacyBuilder) {
    return buildGenericWfsLayer(normalizedCollection, paneId, layerDef);
  }

  const { LAYER_BUILDERS } = await import("@/data/customLayers");
  const builder = LAYER_BUILDERS?.[layerDef.id];
  if (typeof builder === "function") {
    return builder(normalizedCollection, paneId, layerDef);
  }

  return buildGenericWfsLayer(normalizedCollection, paneId, layerDef);
}
