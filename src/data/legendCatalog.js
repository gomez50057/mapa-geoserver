import { getLegendStyle, SYMBOLOGY } from "./simbologia";

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

  if (layerDef.id === "hgo_info_gen") {
    return {
      stroke: "#ffffff",
      fill: "rgba(0, 0, 0, 0.4)",
      weight: 2.6,
      fillOpacity: 0.6,
      dashArray: null,
      pointRadius: 6,
    };
  }

  if (layerDef.id === "esc_priv_ms") {
    return {
      stroke: "#7C3AED",
      fill: "#7C3AED",
      weight: 1.5,
      fillOpacity: 0.85,
      dashArray: null,
      pointRadius: 6,
    };
  }

  if (["zmvm_info", "zmpachuca_info", "zmtula_info", "zmtulancingo_info"].includes(layerDef.id)) {
    const fillById = {
      zmvm_info: "#BC955B",
      zmpachuca_info: "#B6DC76",
      zmtula_info: "Aqua",
      zmtulancingo_info: "#241E4E",
    };

    return {
      stroke: "transparent",
      fill: fillById[layerDef.id] || "#3388ff",
      weight: layerDef.id === "zmvm_info" ? 2.6 : 2,
      fillOpacity: layerDef.id === "zmvm_info" ? 0.45 : 0.7,
      dashArray: null,
      pointRadius: 6,
    };
  }

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
