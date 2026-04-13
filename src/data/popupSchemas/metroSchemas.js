import {
  escapeHtml,
  firstDefined,
  formatAreaKm2,
  formatNumber,
  getProp,
  renderSectionSubtitle,
  renderSectionTitle,
} from "./helpers";

function renderInstrumentLinks(properties) {
  const pmduLabel = getProp(properties, "NOM_LINK_P", "nom_link_p") || "Consultar";
  const atlasLabel = getProp(properties, "NOM_LINK_A", "nom_link_a") || "Consultar";
  const pmdLabel = getProp(properties, "NOM_LINK_1", "nom_link_1") || "Consultar";

  const renderLink = (label, url, fallback, year) => {
    if (!url || url === "No aplica") return `<div><b>${escapeHtml(label)}:</b> ${escapeHtml(fallback || "No existe")}</div>`;
    return `<div><b>${escapeHtml(label)}:</b> <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(fallback)}</a>${year ? ` <b>(${escapeHtml(year)})</b>` : ""}</div>`;
  };

  return [
    renderLink("PMDU", properties.LINKPMDU, properties.PMDU || pmduLabel, properties.FECH),
    renderLink("PMD", properties.LINKPMD, pmdLabel, properties.FECHPMD),
    renderLink("Atlas de Riesgos", properties.LINKATLAS, properties.ATLAS || atlasLabel, properties.FECHATLAS),
  ].join("");
}

export function renderHidalgoInfo(properties, layerDef) {
  const title = firstDefined(getProp(properties, "NOM_MUN", "nom_mun"), layerDef?.title, layerDef?.name, "Hidalgo");
  return [
    renderSectionTitle(title),
    `<div><b>Población municipal:</b> ${escapeHtml(formatNumber(getProp(properties, "POBMUN", "pobmun")))}</div>`,
    `<div><b>Mujeres:</b> ${escapeHtml(formatNumber(getProp(properties, "POBFEM", "pobfem")))}</div>`,
    `<div><b>Hombres:</b> ${escapeHtml(formatNumber(getProp(properties, "POBMAS", "pobmas")))}</div>`,
    `<div><b>Superficie:</b> ${escapeHtml(formatAreaKm2(getProp(properties, "Superficie", "superficie")))}</div>`,
    `<div><b>Población estatal:</b> ${escapeHtml(formatNumber(getProp(properties, "POB_ESTATA", "pob_estata")))}</div>`,
    renderSectionSubtitle("Instrumentos de Planeación"),
    renderInstrumentLinks(properties),
  ].join("");
}

export function renderZonaMetropolitana(properties, layerDef) {
  const title = firstDefined(
    getProp(properties, "NO_Zona", "no_zona"),
    getProp(properties, "NOM_ENT", "nom_ent"),
    layerDef?.title,
    layerDef?.name,
    "Zona Metropolitana"
  );
  return [
    renderSectionTitle(title),
    `<div><b>Municipio:</b> ${escapeHtml(firstDefined(getProp(properties, "NOM_MUN", "nom_mun"), getProp(properties, "NOMGEO", "nomgeo"), "—"))}</div>`,
    `<div><b>Población municipal:</b> ${escapeHtml(formatNumber(getProp(properties, "POBMUN", "pobmun")))}</div>`,
    `<div><b>Mujeres:</b> ${escapeHtml(formatNumber(getProp(properties, "POBFEM", "pobfem")))}</div>`,
    `<div><b>Hombres:</b> ${escapeHtml(formatNumber(getProp(properties, "POBMAS", "pobmas")))}</div>`,
    `<div><b>Superficie:</b> ${escapeHtml(formatAreaKm2(getProp(properties, "Superficie", "superficie")))}</div>`,
    `<div><b>Población metropolitana:</b> ${escapeHtml(formatNumber(firstDefined(getProp(properties, "POBMETRO", "pobmetro"), getProp(properties, "POB_ESTATA", "pob_estata"))))}</div>`,
    renderSectionSubtitle("Instrumentos de Planeación"),
    renderInstrumentLinks(properties),
  ].join("");
}

export function renderEscuelaPrivada(properties, layerDef) {
  const title = firstDefined(getProp(properties, "NOMBRE", "nombre"), layerDef?.title, layerDef?.name, "Escuela privada");
  const sitio = firstDefined(getProp(properties, "SITIO", "sitio"), getProp(properties, "WEB", "web"), getProp(properties, "URL", "url"));
  return [
    renderSectionTitle(title),
    `<div><b>Nivel:</b> ${escapeHtml(firstDefined(getProp(properties, "NIVEL", "nivel"), "—"))}</div>`,
    `<div><b>Municipio:</b> ${escapeHtml(firstDefined(getProp(properties, "MUNICIPIO", "municipio"), "—"))}</div>`,
    `<div><b>CCT:</b> ${escapeHtml(firstDefined(getProp(properties, "CCT", "cct"), getProp(properties, "CLAVE", "clave"), "—"))}</div>`,
    sitio ? `<div><b>Sitio:</b> <a href="${escapeHtml(sitio)}" target="_blank" rel="noreferrer">${escapeHtml(sitio)}</a></div>` : "",
  ].join("");
}
