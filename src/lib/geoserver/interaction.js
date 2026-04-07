import { fetchFeatureAtLatLng, fetchFeatureInfo } from "./client";

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
  allowWfsFallback = true,
  logErrors = true,
}) {
  for (const layerDef of layers) {
    if (layerDef.queryMode === "getFeatureInfo" || layerDef.sourceType === "wms") {
      try {
        const collection = await fetchFeatureInfo(map, latlng, layerDef);
        const feature = collection?.features?.[0];
        if (feature?.properties) {
          return { feature, layerDef };
        }
      } catch (error) {
        if (logErrors) {
          console.error(`Query error for layer ${layerDef.id}`, error);
        }
      }
    }

    if (!allowWfsFallback || layerDef.clickFallbackMode !== "wfs") continue;

    try {
      const fallbackFeature = await fetchFeatureAtLatLng(
        layerDef,
        latlng,
        getFallbackRadiusForZoom(map.getZoom())
      );
      if (fallbackFeature?.properties) {
        return { feature: fallbackFeature, layerDef };
      }
    } catch (error) {
      if (logErrors) {
        console.error(`Fallback query error for layer ${layerDef.id}`, error);
      }
    }
  }

  return null;
}
