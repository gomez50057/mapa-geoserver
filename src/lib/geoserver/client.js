import L from "leaflet";
import { GEOSERVER_CONFIG, resolveServiceUrl } from "@/config/geoserver";
import { getLayerPaint } from "@/data/legendCatalog";
import { renderPopupContent } from "@/data/popupSchemas";

const wfsResponseCache = new Map();
const wfsPendingRequests = new Map();
const wmsBoundsCache = new Map();
const localFeatureBoundsCache = new WeakMap();
let wmsCapabilitiesPromise = null;
let wmsCapabilitiesFailed = false;
let localGeoJsonRegistryPromise = null;

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

function resolveLeafletCrs(code) {
  if (code === "EPSG:3857") return L.CRS.EPSG3857;
  if (code === "EPSG:4326") return L.CRS.EPSG4326;
  return null;
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
  const tileCrs = resolveLeafletCrs(GEOSERVER_CONFIG.tileCrs);
  return L.tileLayer.wms(resolveServiceUrl(GEOSERVER_CONFIG.tileWmsUrl), {
    layers: buildQualifiedLayerName(layerDef),
    format: layerDef.wmsFormat || GEOSERVER_CONFIG.overlayFormat,
    transparent: true,
    tiled: true,
    uppercase: true,
    tileSize: GEOSERVER_CONFIG.wmsTileSize,
    keepBuffer: GEOSERVER_CONFIG.wmsKeepBuffer,
    updateWhenIdle: GEOSERVER_CONFIG.wmsUpdateWhenIdle,
    updateWhenZooming: GEOSERVER_CONFIG.wmsUpdateWhenZooming,
    updateInterval: GEOSERVER_CONFIG.wmsUpdateInterval,
    detectRetina: false,
    crossOrigin: GEOSERVER_CONFIG.wmsCrossOrigin ? "anonymous" : false,
    className: "geoserver-wms-layer",
    pane: paneId,
    zIndex,
    styles: layerDef.wmsStyleName || "",
    version: GEOSERVER_CONFIG.wmsVersion,
    srs: GEOSERVER_CONFIG.tileCrs,
    crs: tileCrs || undefined,
    tilesorigin: GEOSERVER_CONFIG.tileGridOrigin,
  });
}

function normalizeFeatureInfoPayload(payload) {
  return {
    ...payload,
    features: Array.isArray(payload?.features) ? payload.features.map(normalizeFeature) : [],
  };
}

function buildFeatureInfoUrl(map, latlng, layerDefs) {
  const point = map.latLngToContainerPoint(latlng, map.getZoom());
  const size = map.getSize();
  const definitions = Array.isArray(layerDefs) ? layerDefs.filter(Boolean) : [layerDefs].filter(Boolean);
  const qualifiedLayers = definitions.map(buildQualifiedLayerName);
  const styles = definitions.map((layerDef) => layerDef.wmsStyleName || "").join(",");

  return buildServiceUrl(GEOSERVER_CONFIG.queryWmsUrl, {
    service: "WMS",
    request: "GetFeatureInfo",
    version: GEOSERVER_CONFIG.wmsVersion,
    layers: qualifiedLayers.join(","),
    query_layers: qualifiedLayers.join(","),
    styles,
    bbox: projectBounds(map),
    width: size.x,
    height: size.y,
    srs: GEOSERVER_CONFIG.defaultCrs,
    format: "image/png",
    info_format: GEOSERVER_CONFIG.infoFormat,
    feature_count: Math.min(
      Math.max(definitions.length, GEOSERVER_CONFIG.defaultFeatureCount),
      GEOSERVER_CONFIG.maxFeatureInfoCount
    ),
    buffer: GEOSERVER_CONFIG.queryBuffer,
    x: Math.round(point.x),
    y: Math.round(point.y),
  });
}

function inferLayerDefFromFeature(feature, layerDefs) {
  if (!feature || !Array.isArray(layerDefs) || layerDefs.length === 0) return layerDefs?.[0] || null;

  const lookup = new Map();
  layerDefs.forEach((layerDef) => {
    const qualifiedName = buildQualifiedLayerName(layerDef).toLowerCase();
    lookup.set(qualifiedName, layerDef);
    lookup.set(layerDef.layerName.toLowerCase(), layerDef);
  });

  const featureId = String(feature?.id || "");
  const featureSource = String(feature?.properties?.layer || feature?.properties?.typename || "");

  const rawToken = featureId.includes(".") ? featureId.split(".")[0] : featureSource;
  const normalizedToken = rawToken.toLowerCase();

  return (
    lookup.get(normalizedToken) ||
    lookup.get(normalizedToken.replace(/^.*:/, "")) ||
    layerDefs[0] ||
    null
  );
}

async function getLocalGeoJsonRegistry() {
  if (!localGeoJsonRegistryPromise) {
    localGeoJsonRegistryPromise = Promise.all([
      import("@/data/geojson"),
      import("@/data/customLayers/layerIds"),
    ]).then(([{ GEOJSON_REGISTRY }]) => GEOJSON_REGISTRY);
  }

  return localGeoJsonRegistryPromise;
}

async function resolveLocalFeatureCollection(layerDef) {
  const registry = await getLocalGeoJsonRegistry();
  const candidates = [
    layerDef?.legacyGeojsonId,
    layerDef?.geojsonId,
    layerDef?.id,
    layerDef?.layerName,
    buildQualifiedLayerName(layerDef),
  ].filter(Boolean);

  return candidates.map((key) => registry[key]).find((collection) => Array.isArray(collection?.features)) || null;
}

function extendCoordinateBounds(value, bounds) {
  if (!Array.isArray(value)) return bounds;

  if (typeof value[0] === "number" && typeof value[1] === "number") {
    const [lng, lat] = value;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return bounds;
    bounds.minLng = Math.min(bounds.minLng, lng);
    bounds.maxLng = Math.max(bounds.maxLng, lng);
    bounds.minLat = Math.min(bounds.minLat, lat);
    bounds.maxLat = Math.max(bounds.maxLat, lat);
    return bounds;
  }

  value.forEach((item) => extendCoordinateBounds(item, bounds));
  return bounds;
}

function getFeatureCoordinateBounds(feature) {
  if (!feature || typeof feature !== "object") return null;
  if (localFeatureBoundsCache.has(feature)) return localFeatureBoundsCache.get(feature);

  const bounds = extendCoordinateBounds(feature.geometry?.coordinates, {
    minLng: Infinity,
    minLat: Infinity,
    maxLng: -Infinity,
    maxLat: -Infinity,
  });

  const result = [bounds.minLng, bounds.minLat, bounds.maxLng, bounds.maxLat].every(Number.isFinite) ? bounds : null;
  localFeatureBoundsCache.set(feature, result);
  return result;
}

function getQueryTolerance(map, latlng) {
  const buffer = Number(GEOSERVER_CONFIG.queryBuffer) || 10;
  const point = map.latLngToContainerPoint(latlng);
  const east = map.containerPointToLatLng(L.point(point.x + buffer, point.y));
  const south = map.containerPointToLatLng(L.point(point.x, point.y + buffer));

  return {
    pixels: buffer,
    lng: Math.max(Math.abs(east.lng - latlng.lng), 0.000001),
    lat: Math.max(Math.abs(south.lat - latlng.lat), 0.000001),
  };
}

function featureBoundsMayContain(bounds, latlng, tolerance) {
  if (!bounds) return true;
  return (
    latlng.lng >= bounds.minLng - tolerance.lng &&
    latlng.lng <= bounds.maxLng + tolerance.lng &&
    latlng.lat >= bounds.minLat - tolerance.lat &&
    latlng.lat <= bounds.maxLat + tolerance.lat
  );
}

function pointInRing(point, ring) {
  const [lng, lat] = point;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }

  return inside;
}

function pointInPolygonCoordinates(point, polygon) {
  if (!Array.isArray(polygon?.[0]) || !pointInRing(point, polygon[0])) return false;
  return !polygon.slice(1).some((ring) => pointInRing(point, ring));
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return point.distanceTo(start);

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return point.distanceTo(L.point(start.x + t * dx, start.y + t * dy));
}

function coordinateToPoint(map, coordinate) {
  return map.latLngToContainerPoint(L.latLng(coordinate[1], coordinate[0]));
}

function lineCoordinatesHit(map, clickPoint, coordinates, bufferPixels) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) return false;
  if (coordinates.length === 1) return clickPoint.distanceTo(coordinateToPoint(map, coordinates[0])) <= bufferPixels;

  for (let index = 1; index < coordinates.length; index += 1) {
    const start = coordinateToPoint(map, coordinates[index - 1]);
    const end = coordinateToPoint(map, coordinates[index]);
    if (distanceToSegment(clickPoint, start, end) <= bufferPixels) return true;
  }

  return false;
}

function pointCoordinatesHit(map, clickPoint, coordinate, bufferPixels) {
  return clickPoint.distanceTo(coordinateToPoint(map, coordinate)) <= bufferPixels;
}

function geometryContainsLatLng(map, geometry, latlng, tolerance) {
  if (!geometry) return false;

  const clickPoint = map.latLngToContainerPoint(latlng);
  const queryPoint = [latlng.lng, latlng.lat];

  switch (geometry.type) {
    case "Point":
      return pointCoordinatesHit(map, clickPoint, geometry.coordinates, tolerance.pixels);
    case "MultiPoint":
      return geometry.coordinates.some((coordinate) => pointCoordinatesHit(map, clickPoint, coordinate, tolerance.pixels));
    case "LineString":
      return lineCoordinatesHit(map, clickPoint, geometry.coordinates, tolerance.pixels);
    case "MultiLineString":
      return geometry.coordinates.some((line) => lineCoordinatesHit(map, clickPoint, line, tolerance.pixels));
    case "Polygon":
      return pointInPolygonCoordinates(queryPoint, geometry.coordinates);
    case "MultiPolygon":
      return geometry.coordinates.some((polygon) => pointInPolygonCoordinates(queryPoint, polygon));
    case "GeometryCollection":
      return geometry.geometries?.some((item) => geometryContainsLatLng(map, item, latlng, tolerance)) || false;
    default:
      return false;
  }
}

function buildLocalFeature(feature, layerDef, index) {
  const qualifiedName = buildQualifiedLayerName(layerDef);
  const properties = {
    ...(feature?.properties || {}),
    layer: feature?.properties?.layer || qualifiedName,
    typename: feature?.properties?.typename || qualifiedName,
  };

  return normalizeFeature({
    ...feature,
    id: feature?.id || `${qualifiedName}.${index}`,
    properties,
  });
}

async function queryLocalFeatureInfo(map, latlng, layerDefs) {
  const definitions = Array.isArray(layerDefs) ? layerDefs.filter(Boolean) : [layerDefs].filter(Boolean);
  if (definitions.length === 0) return { result: null, coveredLayerIds: new Set(), allCovered: false };

  const layers = await Promise.all(
    definitions.map(async (layerDef) => ({
      layerDef,
      collection: await resolveLocalFeatureCollection(layerDef),
    }))
  );

  const localLayers = layers.filter(({ collection }) => collection);
  const coveredLayerIds = new Set(localLayers.map(({ layerDef }) => layerDef.id));
  if (localLayers.length === 0) return { result: null, coveredLayerIds, allCovered: false };

  const tolerance = getQueryTolerance(map, latlng);

  for (const { layerDef, collection } of localLayers) {
    const features = [];
    collection.features.forEach((feature, index) => {
      const bounds = getFeatureCoordinateBounds(feature);
      if (!featureBoundsMayContain(bounds, latlng, tolerance)) return;
      if (geometryContainsLatLng(map, feature.geometry, latlng, tolerance)) {
        features.push(buildLocalFeature(feature, layerDef, index));
      }
    });

    if (features.length > 0) {
      const normalized = normalizeFeatureInfoPayload({
        type: "FeatureCollection",
        features,
      });

      return {
        result: {
          feature: normalized.features[0],
          layerDef,
          collection: normalized,
        },
        coveredLayerIds,
        allCovered: localLayers.length === definitions.length,
      };
    }
  }

  return { result: null, coveredLayerIds, allCovered: localLayers.length === definitions.length };
}

export async function fetchFeatureInfo(map, latlng, layerDef, options = {}) {
  const local = await queryLocalFeatureInfo(map, latlng, layerDef);
  if (local.result) return local.result.collection;
  if (local.allCovered) return { features: [] };

  const url = buildFeatureInfoUrl(map, latlng, layerDef);
  const response = await fetch(url, { signal: options.signal });
  if (!response.ok) return { features: [] };

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return { features: [] };
  }

  const payload = await response.json();
  return normalizeFeatureInfoPayload(payload);
}

export async function fetchCombinedFeatureInfo(map, latlng, layerDefs, options = {}) {
  const definitions = Array.isArray(layerDefs) ? layerDefs.filter(Boolean) : [];
  if (definitions.length === 0) return null;

  const local = await queryLocalFeatureInfo(map, latlng, definitions);
  if (local.result) return local.result;
  if (local.allCovered) return null;

  const remoteDefinitions = definitions.filter((layerDef) => !local.coveredLayerIds.has(layerDef.id));
  if (remoteDefinitions.length === 0) return null;

  const url = buildFeatureInfoUrl(map, latlng, remoteDefinitions);
  const response = await fetch(url, { signal: options.signal });
  if (!response.ok) return null;

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  const payload = await response.json();
  const normalized = normalizeFeatureInfoPayload(payload);
  const feature = normalized.features?.[0];
  if (!feature?.properties) return null;

  return {
    feature,
    layerDef: inferLayerDefFromFeature(feature, remoteDefinitions),
    collection: normalized,
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

  const requestUrl = buildServiceUrl(GEOSERVER_CONFIG.queryWfsUrl, params);
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
  if (wmsCapabilitiesFailed) return null;
  if (wmsCapabilitiesPromise) return wmsCapabilitiesPromise;

  const requestUrl = buildServiceUrl(GEOSERVER_CONFIG.queryWmsUrl, {
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
      wmsCapabilitiesFailed = true;
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
  if (!capabilities) return null;
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
