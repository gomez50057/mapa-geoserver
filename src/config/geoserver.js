const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");
const DEFAULT_GEOSERVER_WMS_URL = "https://metropoli.hidalgo.gob.mx/geoserver/mapa/wms";
const DEFAULT_GEOSERVER_WFS_URL = "https://metropoli.hidalgo.gob.mx/geoserver/mapa/wfs";
const DEFAULT_GEOSERVER_TILE_WMS_URL = "/api/geoserver/tilewms";
const DEFAULT_GEOSERVER_WMTS_URL = "/api/geoserver/wmts";
const numberOr = (value, fallback) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};
const booleanOr = (value, fallback) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
};

export const HIDALGO_REGION_BOUNDS = [
  [18.0, -101.6],
  [22.8, -96.0],
];

export const GEOSERVER_CONFIG = {
  wmsUrl: trimTrailingSlash(
    process.env.NEXT_PUBLIC_GEOSERVER_WMS_URL || DEFAULT_GEOSERVER_WMS_URL
  ),
  tileWmsUrl: trimTrailingSlash(
    process.env.NEXT_PUBLIC_GEOSERVER_TILE_WMS_URL || DEFAULT_GEOSERVER_TILE_WMS_URL
  ),
  wmtsUrl: trimTrailingSlash(
    process.env.NEXT_PUBLIC_GEOSERVER_WMTS_URL || DEFAULT_GEOSERVER_WMTS_URL
  ),
  wfsUrl: trimTrailingSlash(
    process.env.NEXT_PUBLIC_GEOSERVER_WFS_URL || DEFAULT_GEOSERVER_WFS_URL
  ),
  queryWmsUrl: trimTrailingSlash(process.env.NEXT_PUBLIC_GEOSERVER_QUERY_WMS_URL || "/api/geoserver/wms"),
  queryWfsUrl: trimTrailingSlash(process.env.NEXT_PUBLIC_GEOSERVER_QUERY_WFS_URL || "/api/geoserver/wfs"),
  workspace: process.env.NEXT_PUBLIC_GEOSERVER_WORKSPACE || "mapa",
  localFallbackEnabled: process.env.NEXT_PUBLIC_ENABLE_LOCAL_LAYER_FALLBACK === "true",
  regionBounds: HIDALGO_REGION_BOUNDS,
  infoFormat: "application/json",
  wmsVersion: "1.1.1",
  defaultCrs: "EPSG:3857",
  tileServiceMode: String(process.env.NEXT_PUBLIC_GEOSERVER_TILE_SERVICE || "wms").toLowerCase() === "wmts" ? "wmts" : "wms",
  tileCacheKey: process.env.NEXT_PUBLIC_GEOSERVER_TILE_CACHE_KEY || "",
  tileCrs: process.env.NEXT_PUBLIC_GEOSERVER_TILE_CRS || "EPSG:3857",
  tileGridOrigin:
    process.env.NEXT_PUBLIC_GEOSERVER_TILE_GRID_ORIGIN || "-20037508.342789244,-20037508.342789244",
  wmtsMatrixSet: process.env.NEXT_PUBLIC_GEOSERVER_WMTS_MATRIX_SET || "EPSG:900913",
  wmtsTileMatrixPrefix:
    process.env.NEXT_PUBLIC_GEOSERVER_WMTS_TILE_MATRIX_PREFIX ||
    process.env.NEXT_PUBLIC_GEOSERVER_WMTS_MATRIX_SET ||
    "EPSG:900913",
  wmtsStyle: process.env.NEXT_PUBLIC_GEOSERVER_WMTS_STYLE || "",
  wmtsFormat: process.env.NEXT_PUBLIC_GEOSERVER_WMTS_FORMAT || "image/png",
  defaultFeatureCount: 5,
  maxFeatureInfoCount: numberOr(process.env.NEXT_PUBLIC_GEOSERVER_MAX_FEATURE_INFO_COUNT, 24),
  queryBuffer: 10,
  overlayFormat: process.env.NEXT_PUBLIC_GEOSERVER_WMS_FORMAT || "image/png8",
  wmsTileSize: numberOr(process.env.NEXT_PUBLIC_GEOSERVER_WMS_TILE_SIZE, 256),
  wmsKeepBuffer: numberOr(process.env.NEXT_PUBLIC_GEOSERVER_WMS_KEEP_BUFFER, 1),
  wmsUpdateInterval: numberOr(process.env.NEXT_PUBLIC_GEOSERVER_WMS_UPDATE_INTERVAL, 90),
  wmsUpdateWhenIdle: booleanOr(process.env.NEXT_PUBLIC_GEOSERVER_WMS_UPDATE_WHEN_IDLE, true),
  wmsUpdateWhenZooming: booleanOr(process.env.NEXT_PUBLIC_GEOSERVER_WMS_UPDATE_WHEN_ZOOMING, false),
  wmsCrossOrigin: booleanOr(process.env.NEXT_PUBLIC_GEOSERVER_WMS_CROSS_ORIGIN, false),
  capabilitiesBoundsEnabled: booleanOr(process.env.NEXT_PUBLIC_GEOSERVER_ENABLE_CAPABILITIES_BOUNDS, true),
  hoverDebounceMs: numberOr(process.env.NEXT_PUBLIC_GEOSERVER_HOVER_DEBOUNCE_MS, 120),
  interactionResumeDelayMs: numberOr(process.env.NEXT_PUBLIC_GEOSERVER_INTERACTION_RESUME_DELAY_MS, 120),
  featureInfoTimeoutMs: numberOr(process.env.NEXT_PUBLIC_GEOSERVER_FEATURE_INFO_TIMEOUT_MS, 8000),
  featureInfoRetryTimeoutMs: numberOr(process.env.NEXT_PUBLIC_GEOSERVER_FEATURE_INFO_RETRY_TIMEOUT_MS, 14000),
  hoverFeatureInfoTimeoutMs: numberOr(process.env.NEXT_PUBLIC_GEOSERVER_HOVER_FEATURE_INFO_TIMEOUT_MS, 1600),
  wfsTimeoutMs: numberOr(process.env.NEXT_PUBLIC_GEOSERVER_WFS_TIMEOUT_MS, 8000),
  clickQueryBatchSize: numberOr(process.env.NEXT_PUBLIC_GEOSERVER_CLICK_QUERY_BATCH_SIZE, 4),
};

export function resolveServiceUrl(url) {
  if (/^https?:\/\//i.test(url)) return url;
  if (typeof window === "undefined") return url;
  return new URL(url, window.location.origin).toString();
}
