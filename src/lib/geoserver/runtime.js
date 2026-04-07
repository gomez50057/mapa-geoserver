import L from "leaflet";
import { fetchLayerBounds } from "./client";

export function extendUnionBounds(unionBounds, bounds) {
  if (!bounds?.isValid?.()) return unionBounds;
  return unionBounds
    ? unionBounds.extend(bounds)
    : L.latLngBounds(bounds.getSouthWest(), bounds.getNorthEast());
}

export async function resolveLayerBounds({
  layerDef,
  boundsCache,
  boundsFromConfig,
}) {
  if (layerDef.boundsMode === "none") return null;

  const configuredBounds = boundsFromConfig(layerDef.bounds);
  if (configuredBounds) return configuredBounds;

  const cacheKey = layerDef.id;
  if (boundsCache.current[cacheKey]) return boundsCache.current[cacheKey];

  if (layerDef.boundsMode === "capabilities") {
    const bounds = await fetchLayerBounds(layerDef);
    if (bounds?.isValid?.()) {
      boundsCache.current[cacheKey] = bounds;
      return bounds;
    }
  }

  return null;
}
