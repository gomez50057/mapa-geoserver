import { fetchCombinedFeatureInfo } from "./client";

export function getFallbackRadiusForZoom(zoom) {
  if (zoom >= 17) return 0.00012;
  if (zoom >= 15) return 0.00025;
  if (zoom >= 13) return 0.0006;
  if (zoom >= 11) return 0.0012;
  return 0.002;
}

export async function resolveTopmostFeatureAtLatLng({
  map,
  latlng,
  layers,
  signal,
  logErrors = true,
}) {
  if (!Array.isArray(layers) || layers.length === 0) return null;

  try {
    return await fetchCombinedFeatureInfo(map, latlng, layers, { signal });
  } catch (error) {
    if (error?.name === "AbortError") return null;
    if (logErrors) {
      console.error("Combined query error", error);
    }
    return null;
  }
}
