import L from "leaflet";

function buildDefaultLocalLayer(data, paneId, layerDef) {
  const color = layerDef?.meta?.color || "#3388ff";
  return L.geoJSON(data, {
    pane: paneId,
    pointToLayer: (_, latlng) =>
      L.circleMarker(latlng, {
        pane: paneId,
        radius: 6,
        color,
        fillColor: color,
        fillOpacity: 0.8,
      }),
    style: () => ({
      color,
      weight: layerDef?.meta?.weight ?? 2,
      fillColor: color,
      fillOpacity: layerDef?.meta?.asLine ? 0 : 0.3,
      dashArray: layerDef?.meta?.dashArray || null,
    }),
  });
}

export async function loadLegacyLocalLayer(layerDef, paneId) {
  const [{ GEOJSON_REGISTRY }, { LAYER_BUILDERS }] = await Promise.all([
    import("@/data/geojson"),
    import("@/data/customLayers"),
  ]);

  const data = GEOJSON_REGISTRY[layerDef.legacyGeojsonId || layerDef.geojsonId];
  if (!data) return null;

  const builder = LAYER_BUILDERS?.[layerDef.id];
  if (typeof builder === "function") return builder(data, paneId, layerDef);

  return buildDefaultLocalLayer(data, paneId, layerDef);
}
