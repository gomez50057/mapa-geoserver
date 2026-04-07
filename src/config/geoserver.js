const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");
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
  wmsUrl: trimTrailingSlash(process.env.NEXT_PUBLIC_GEOSERVER_WMS_URL || "/api/geoserver/wms"),
  tileWmsUrl: trimTrailingSlash(process.env.NEXT_PUBLIC_GEOSERVER_TILE_WMS_URL || "/api/geoserver/tilewms"),
  wfsUrl: trimTrailingSlash(process.env.NEXT_PUBLIC_GEOSERVER_WFS_URL || "/api/geoserver/wfs"),
  workspace: process.env.NEXT_PUBLIC_GEOSERVER_WORKSPACE || "mapa",
  localFallbackEnabled: process.env.NEXT_PUBLIC_ENABLE_LOCAL_LAYER_FALLBACK === "true",
  regionBounds: HIDALGO_REGION_BOUNDS,
  infoFormat: "application/json",
  wmsVersion: "1.1.1",
  defaultCrs: "EPSG:3857",
  tileCrs: process.env.NEXT_PUBLIC_GEOSERVER_TILE_CRS || "EPSG:3857",
  tileGridOrigin:
    process.env.NEXT_PUBLIC_GEOSERVER_TILE_GRID_ORIGIN || "-20037508.342789244,-20037508.342789244",
  defaultFeatureCount: 5,
  maxFeatureInfoCount: numberOr(process.env.NEXT_PUBLIC_GEOSERVER_MAX_FEATURE_INFO_COUNT, 24),
  queryBuffer: 10,
  overlayFormat: process.env.NEXT_PUBLIC_GEOSERVER_WMS_FORMAT || "image/png8",
  wmsTileSize: numberOr(process.env.NEXT_PUBLIC_GEOSERVER_WMS_TILE_SIZE, 256),
  wmsKeepBuffer: numberOr(process.env.NEXT_PUBLIC_GEOSERVER_WMS_KEEP_BUFFER, 3),
  wmsUpdateInterval: numberOr(process.env.NEXT_PUBLIC_GEOSERVER_WMS_UPDATE_INTERVAL, 90),
  wmsUpdateWhenIdle: booleanOr(process.env.NEXT_PUBLIC_GEOSERVER_WMS_UPDATE_WHEN_IDLE, true),
  wmsUpdateWhenZooming: booleanOr(process.env.NEXT_PUBLIC_GEOSERVER_WMS_UPDATE_WHEN_ZOOMING, false),
  hoverDebounceMs: numberOr(process.env.NEXT_PUBLIC_GEOSERVER_HOVER_DEBOUNCE_MS, 180),
  interactionResumeDelayMs: numberOr(process.env.NEXT_PUBLIC_GEOSERVER_INTERACTION_RESUME_DELAY_MS, 180),
};

export function resolveServiceUrl(url) {
  if (/^https?:\/\//i.test(url)) return url;
  if (typeof window === "undefined") return url;
  return new URL(url, window.location.origin).toString();
}
