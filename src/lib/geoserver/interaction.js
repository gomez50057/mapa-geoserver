import { GEOSERVER_CONFIG } from "@/config/geoserver";
import { fetchCombinedFeatureInfo, fetchFeatureAtLatLng, fetchFeatureInfo } from "./client";

export function getFallbackRadiusForZoom(zoom) {
  if (zoom >= 17) return 0.00012;
  if (zoom >= 15) return 0.00025;
  if (zoom >= 13) return 0.0006;
  if (zoom >= 11) return 0.0012;
  return 0.002;
}

function getClickBatchSize() {
  return Math.max(1, Math.min(8, Math.round(GEOSERVER_CONFIG.clickQueryBatchSize || 4)));
}

async function resolveCombinedFeatureInfoSafe({
  map,
  latlng,
  layers,
  signal,
  timeoutMs,
  logErrors,
  label,
}) {
  try {
    return await fetchCombinedFeatureInfo(map, latlng, layers, {
      signal,
      timeoutMs,
    });
  } catch (error) {
    if (signal?.aborted || error?.name === "AbortError") return null;
    if (logErrors && error?.name !== "TimeoutError") {
      console.warn(label, error);
    }
    return null;
  }
}

async function resolveWfsFallbackFeature({
  map,
  latlng,
  layers,
  signal,
  radius,
  logErrors,
}) {
  const batchSize = getClickBatchSize();

  for (let index = 0; index < layers.length; index += batchSize) {
    if (signal?.aborted) return null;

    const batch = layers.slice(index, index + batchSize).filter((layerDef) => layerDef?.clickFallbackMode === "wfs");
    if (batch.length === 0) continue;

    const results = await Promise.all(
      batch.map(async (layerDef) => {
        try {
          const feature = await fetchFeatureAtLatLng(layerDef, latlng, radius, {
            map,
            signal,
            timeoutMs: GEOSERVER_CONFIG.wfsTimeoutMs,
          });

          if (!feature?.properties) return null;

          return {
            feature,
            layerDef,
            collection: {
              type: "FeatureCollection",
              features: [feature],
            },
          };
        } catch (fallbackError) {
          if (signal?.aborted || fallbackError?.name === "AbortError") return null;
          if (logErrors && fallbackError?.name !== "TimeoutError") {
            console.warn(`WFS fallback query failed for ${layerDef?.id}`, fallbackError);
          }
          return null;
        }
      })
    );

    const match = results.find((result) => result?.feature?.properties);
    if (match) return match;
  }

  return null;
}

async function resolveSingleLayerFeatureInfoBatch({
  map,
  latlng,
  layers,
  signal,
  logErrors,
  buffer = 6,
}) {
  const batchSize = getClickBatchSize();

  for (let index = 0; index < layers.length; index += batchSize) {
    if (signal?.aborted) return null;

    const batch = layers.slice(index, index + batchSize);
    const results = await Promise.all(
      batch.map(async (layerDef) => {
        try {
          const collection = await fetchFeatureInfo(map, latlng, layerDef, {
            signal,
            featureCount: 1,
            buffer,
            timeoutMs: GEOSERVER_CONFIG.featureInfoTimeoutMs,
          });
          const feature = collection?.features?.[0];

          if (!feature?.properties) return null;

          return {
            feature,
            layerDef,
            collection,
          };
        } catch (featureInfoError) {
          if (signal?.aborted || featureInfoError?.name === "AbortError") return null;
          if (logErrors && featureInfoError?.name !== "TimeoutError") {
            console.warn(`Single-layer feature info failed for ${layerDef?.id}`, featureInfoError);
          }
          return null;
        }
      })
    );

    const match = results.find((result) => result?.feature?.properties);
    if (match) return match;
  }

  return null;
}

export async function resolveTopmostFeatureAtLatLng({
  map,
  latlng,
  layers,
  signal,
  enableClickFallback = false,
  logErrors = true,
}) {
  if (!Array.isArray(layers) || layers.length === 0) return null;

  try {
    const radius = getFallbackRadiusForZoom(map?.getZoom?.() ?? 12);

    if (enableClickFallback) {
      const combinedResult = await resolveCombinedFeatureInfoSafe({
        map,
        latlng,
        layers,
        signal,
        timeoutMs: GEOSERVER_CONFIG.featureInfoTimeoutMs,
        logErrors,
        label: "Combined popup query failed",
      });

      if (combinedResult?.feature?.properties && combinedResult.layerDef) {
        const matchedIndex = layers.findIndex((layerDef) => layerDef.id === combinedResult.layerDef?.id);
        const higherPriorityLayers = matchedIndex > 0 ? layers.slice(0, matchedIndex) : [];

        if (higherPriorityLayers.length > 0) {
          const higherPriorityResult = await resolveSingleLayerFeatureInfoBatch({
            map,
            latlng,
            layers: higherPriorityLayers,
            signal,
            logErrors,
          });

          if (higherPriorityResult) return higherPriorityResult;
        }

        return combinedResult;
      }

      const singleLayerResult = await resolveSingleLayerFeatureInfoBatch({
        map,
        latlng,
        layers,
        signal,
        logErrors,
      });

      if (singleLayerResult) return singleLayerResult;

      const fallbackResult = await resolveWfsFallbackFeature({
        map,
        latlng,
        layers,
        signal,
        radius,
        logErrors,
      });

      if (fallbackResult) return fallbackResult;

      return await resolveCombinedFeatureInfoSafe({
        map,
        latlng,
        layers,
        signal,
        timeoutMs: GEOSERVER_CONFIG.featureInfoRetryTimeoutMs,
        logErrors,
        label: "Final combined popup retry failed",
      });
    }

    const featureInfoResult = await fetchCombinedFeatureInfo(map, latlng, layers, {
      signal,
      timeoutMs: GEOSERVER_CONFIG.hoverFeatureInfoTimeoutMs,
    });

    return featureInfoResult;
  } catch (error) {
    if (error?.name === "AbortError") return null;
    if (logErrors) {
      console.error("Combined query error", error);
    }
    return null;
  }
}
