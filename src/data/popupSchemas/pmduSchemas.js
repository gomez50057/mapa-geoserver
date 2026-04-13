import { getLegacyPopupFields } from "../legacyPopupFields";
import {
  buildRows,
  escapeHtml,
  firstDefined,
  formatHectares,
  getProp,
  renderRows,
  renderSectionSubtitle,
} from "./helpers";

export function renderPachucaEtapas(properties) {
  return [
    renderSectionSubtitle("Etapas de Crecimiento"),
    getProp(properties, "Name_1", "name_1") ? `<div><b>Estatus:</b> ${escapeHtml(getProp(properties, "Name_1", "name_1"))}</div>` : "",
    getProp(properties, "Ar", "ar") != null ? `<div><b>Área:</b> ${escapeHtml(formatHectares(getProp(properties, "Ar", "ar")))}</div>` : "",
  ].join("");
}

export function renderPmduGeneric(properties, layerDef) {
  const allow = getLegacyPopupFields(layerDef);
  const title = firstDefined(
    getProp(properties, "ZonSec", "zonsec"),
    getProp(properties, "ZonSec2022", "zonsec2022"),
    getProp(properties, "Uso", "uso"),
    getProp(properties, "USO", "uso"),
    getProp(properties, "Categoria", "categoria"),
    layerDef?.title,
    layerDef?.name
  );

  const rows = buildRows(properties, {
    allow,
    omit: [
      "ZonSec",
      "ZonSec2022",
      "Uso",
      "USO",
      "Categoria",
      "zonsec",
      "zonsec2022",
      "uso",
      "categoria",
      "geometry",
    ],
  });

  return [renderSectionSubtitle(title), renderRows(rows)].join("");
}
