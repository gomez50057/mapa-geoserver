import {
  buildRows,
  escapeHtml,
  firstDefined,
  formatAreaKm2,
  formatHectares,
  formatNumber,
  renderRows,
  renderSectionSubtitle,
  renderSectionTitle,
} from "../fieldFormatters";

export {
  buildRows,
  escapeHtml,
  firstDefined,
  formatAreaKm2,
  formatHectares,
  formatNumber,
  renderRows,
  renderSectionSubtitle,
  renderSectionTitle,
};

export function getProp(properties, ...keys) {
  for (const key of keys) {
    if (properties?.[key] != null && properties[key] !== "") return properties[key];
  }
  return undefined;
}

export function renderDefault(properties, layerDef) {
  const title = firstDefined(
    getProp(properties, "name", "nombre"),
    getProp(properties, "NOM_MUN", "nom_mun"),
    layerDef?.title,
    layerDef?.name,
    "Elemento"
  );
  return [renderSectionTitle(title), renderRows(buildRows(properties))].join("");
}
