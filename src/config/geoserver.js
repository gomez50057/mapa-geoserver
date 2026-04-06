const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

export const HIDALGO_REGION_BOUNDS = [
  [18.0, -101.6],
  [22.8, -96.0],
];

export const GEOSERVER_CONFIG = {
  wmsUrl: trimTrailingSlash(process.env.NEXT_PUBLIC_GEOSERVER_WMS_URL || "/api/geoserver/wms"),
  wfsUrl: trimTrailingSlash(process.env.NEXT_PUBLIC_GEOSERVER_WFS_URL || "/api/geoserver/wfs"),
  workspace: process.env.NEXT_PUBLIC_GEOSERVER_WORKSPACE || "mapa",
  localFallbackEnabled: process.env.NEXT_PUBLIC_ENABLE_LOCAL_LAYER_FALLBACK === "true",
  regionBounds: HIDALGO_REGION_BOUNDS,
  infoFormat: "application/json",
  wmsVersion: "1.1.1",
  defaultCrs: "EPSG:3857",
  defaultFeatureCount: 5,
  queryBuffer: 10,
};

export function resolveServiceUrl(url) {
  if (/^https?:\/\//i.test(url)) return url;
  if (typeof window === "undefined") return url;
  return new URL(url, window.location.origin).toString();
}
