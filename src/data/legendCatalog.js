import { getLegendStyle, SYMBOLOGY } from "./simbologia";
import { resolveLayerPaintOverride } from "./layerSchema";

export const LEGEND_CATALOG = SYMBOLOGY;

export function getLegendItems(legendKey) {
  return Array.isArray(LEGEND_CATALOG?.[legendKey]) ? LEGEND_CATALOG[legendKey] : [];
}

export function getLegendColor(layerDef) {
  if (layerDef?.meta?.color) return layerDef.meta.color;
  if (layerDef?.legendItem) {
    const match = getLegendItems(layerDef.legendKey).find((item) => item.text === layerDef.legendItem);
    if (match?.color) return match.color;
  }
  const first = getLegendItems(layerDef?.legendKey)[0];
  return first?.color || "#3388ff";
}

export function getLayerPaint(layerDef) {
  if (!layerDef) {
    return {
      stroke: "#3388ff",
      fill: "#3388ff",
      weight: 2,
      fillOpacity: 0.35,
      dashArray: null,
      pointRadius: 6,
    };
  }

  const schemaOverride = resolveLayerPaintOverride(layerDef);
  if (schemaOverride) return schemaOverride;

  const legendStyle = getLegendStyle(layerDef.legendKey, layerDef.legendItem) || {};
  const asLine = !!layerDef?.meta?.asLine;
  const weight = layerDef?.meta?.weight ?? (asLine ? 3 : 2.5);
  const stroke = layerDef?.meta?.stroke || layerDef?.meta?.color || legendStyle.stroke || getLegendColor(layerDef);
  const fill = asLine
    ? "transparent"
    : layerDef?.meta?.fill || layerDef?.meta?.color || legendStyle.fill || getLegendColor(layerDef);

  return {
    stroke,
    fill,
    weight,
    fillOpacity: asLine ? 0 : 0.5,
    dashArray: layerDef?.meta?.dashArray || null,
    pointRadius: 6,
  };
}
