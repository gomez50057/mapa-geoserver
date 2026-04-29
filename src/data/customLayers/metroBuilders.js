import L from "leaflet";
import { escapeHtml, fmtArea, fmtNum, sanitizeExternalUrl } from "./helpers";

const safeText = (value, fallback = "—") => escapeHtml(value ?? fallback);
const safeLink = (url, label) => {
  const safeUrl = sanitizeExternalUrl(url);
  if (!safeUrl) return "";
  return `<a href='${escapeHtml(safeUrl)}' target='_blank' rel='noopener noreferrer'>${escapeHtml(label || "Consultar")}</a>`;
};

export function buildZMVM(data, paneId) {
  return L.geoJSON(data, {
    pane: paneId,
    style: (feature) => {
      const ent = feature?.properties?.NOM_ENT;
      const color =
        ent === "Hidalgo" ? "#BC955B" :
        ent === "Estado de México" ? "#691B31" :
        ent === "Ciudad de México" ? "#3a9680" : "orange";
      return { fillColor: color, color, weight: 2.6, fillOpacity: 0.45 };
    },
    pointToLayer: (feat, latlng) => L.circleMarker(latlng, { pane: paneId, radius: 6 }),
    onEachFeature: (feature, layer) => {
      const p = feature?.properties ?? {};
      const html =
        `<div class='PopupT'>${safeText(p.NOM_ENT, "Entidad")}</div>` +
        `<b>Nombre del Municipio:</b> ${safeText(p.NOM_MUN)}` +
        `<br><b>Población Municipal:</b> ${fmtNum(p.POBMUN)}` +
        `<br><b>Mujeres:</b> ${fmtNum(p.POBFEM)}` +
        `<br><b>Hombres:</b> ${fmtNum(p.POBMAS)}` +
        `<br><b>Superficie:</b> ${fmtArea(p.Superficie)}` +
        `<br><b>Población Metropolitana:</b> ${fmtNum(p.POBMETRO)}`;
      layer.bindPopup(html);
    },
  });
}

export function buildMetropolitana(data, paneId, fillColor, strokeColor, zonaLabel = "Zona Metropolitana") {
  return L.geoJSON(data, {
    pane: paneId,
    style: () => ({ fillColor, fillOpacity: 0.7, color: strokeColor, weight: 2 }),
    pointToLayer: (feat, latlng) => L.circleMarker(latlng, { pane: paneId, radius: 6 }),
    onEachFeature: (feature, layer) => {
      const p = feature?.properties ?? {};
      let html =
        `<div class='PopupT'><b>${safeText(zonaLabel)} de</b> ${safeText(p.NO_Zona)}</div>` +
        `<b>Municipio:</b> ${safeText(p.NOM_MUN)}` +
        `<br><b>Población Municipal:</b> ${fmtNum(p.POBMUN)}` +
        `<br><b>Mujeres:</b> ${fmtNum(p.POBFEM)}` +
        `<br><b>Hombres:</b> ${fmtNum(p.POBMAS)}` +
        `<br><b>Superficie:</b> ${fmtArea(p.Superficie)}` +
        `<br><b>Población Metropolitana:</b> ${fmtNum(p.POB_ESTATA)}` +
        `<div class='PopupSubT'><b>Instrumentos de Planeación</b></div>`;
      const PMDU = p.PMDU ?? "—";
      const pmduLink = safeLink(p.LINKPMDU, p.NOM_LINK_P ?? "Consultar");
      if (PMDU !== "No existe" && pmduLink) {
        html += `<b>PMDU:</b> ${pmduLink} <b>(${safeText(p.FECH)})</b>`;
      } else html += `<b>PMDU:</b> ${safeText(PMDU)}`;
      const pmdLink = safeLink(p.LINKPMD, "Consultar");
      if (pmdLink) html += `<br><b>PMD:</b> ${pmdLink} <b>(${safeText(p.FECHPMD)})</b>`;
      else html += `<br><b>PMD:</b> —`;
      const ATLAS = p.ATLAS ?? "—";
      const atlasLink = safeLink(p.LINKATLAS, "Consultar");
      if (ATLAS !== "No existe" && atlasLink) {
        html += `<br><b>Atlas de Riesgos:</b> ${atlasLink} <b>(${safeText(p.FECHATLAS)})</b>`;
      } else html += `<br><b>Atlas de Riesgos:</b> ${safeText(ATLAS)}`;
      layer.bindPopup(html);
    },
  });
}

export function buildInfoHgoLayer({ data, paneId, color = "#fff", layerName }) {
  return L.geoJSON(data, {
    pane: paneId,
    style: () => ({ fillColor: "rgba(0, 0, 0, 0.4)", color, weight: 2.6, fillOpacity: 0.6 }),
    onEachFeature: function (feature, layer) {
      const p = feature?.properties || {};
      const n = (x) => (typeof x === "number" ? x : Number(x));
      const fmt = (x) => (isFinite(n(x)) ? n(x).toLocaleString() : (x ?? "—"));
      const sup = isFinite(n(p.Superficie)) ? `${n(p.Superficie).toFixed(3)} km²` : (p.Superficie ?? "—");
      const PMDU = p.PMDU ?? "No existe";
      const ATLAS = p.ATLAS ?? "No existe";
      let html = `
        <div class='PopupT'>${safeText(p.NOM_MUN || layerName, "Hidalgo")}</div>
        <b>Población Municipal:</b> ${safeText(fmt(p.POBMUN))}
        <br><b>Mujeres:</b> ${safeText(fmt(p.POBFEM))}
        <br><b>Hombres:</b> ${safeText(fmt(p.POBMAS))}
        <br><b>Superficie:</b> ${safeText(sup)}
        <br><b>Población Estatal:</b> ${safeText(fmt(p.POB_ESTATA))}
        <div class='PopupSubT'><b>Instrumentos de Planeación</b></div>
      `;
      const pmduLink = safeLink(p.LINKPMDU, p.NOM_LINK_P ?? "Consultar");
      if (PMDU !== "No existe" && pmduLink) {
        html += `<b>PMDU:</b> ${pmduLink} <b>(</b>${safeText(p.FECH, "")}<b>)</b>`;
      } else html += `<b>PMDU:</b> ${safeText(PMDU)}`;
      const pmdLink = safeLink(p.LINKPMD, "Consultar");
      if (pmdLink) html += `<br><b>PMD:</b> ${pmdLink} <b>(</b>${safeText(p.FECHPMD, "")}<b>)</b>`;
      const atlasLink = safeLink(p.LINKATLAS, "Consultar");
      if (ATLAS !== "No existe" && atlasLink) {
        html += `<br><b>Atlas de Riesgos:</b> ${atlasLink} <b>(</b>${safeText(p.FECHATLAS, "")}<b>)</b>`;
      } else html += `<br><b>Atlas de Riesgos:</b> ${safeText(ATLAS)}`;
      layer.bindPopup(html);
      layer.on("click", (e) => layer.openPopup(e.latlng));
    },
  });
}

export function buildEscPrivLayer({ data, paneId, layerDef }) {
  const stroke = "#7C3AED";
  const fill = "#7C3AED";
  return L.geoJSON(data, {
    pane: paneId,
    pointToLayer: (feat, latlng) =>
      L.circleMarker(latlng, {
        pane: paneId,
        radius: 6,
        color: stroke,
        weight: 1.5,
        fillColor: fill,
        fillOpacity: 0.85,
      }),
    onEachFeature: (feature, layer) => {
      const p = feature?.properties || {};
      const nombre = p.NOMBRE || p.nombre || layerDef?.name || "Escuela privada";
      const nivel = p.NIVEL || p.nivel || "—";
      const muni = p.MUNICIPIO || p.municipio || "—";
      const cct = p.CCT || p.CLAVE || "—";
      const sitio = p.SITIO || p.WEB || p.URL;
      layer.bindTooltip(`<div><b>${safeText(nombre)}</b></div><div>Nivel: ${safeText(nivel)}</div><div>Municipio: ${safeText(muni)}</div>`, { sticky: true });
      layer.on("click", (e) => layer.openTooltip(e.latlng));
      let html = `<div class='PopupT'>${safeText(nombre)}</div>
        <b>Nivel:</b> ${safeText(nivel)}
        <br><b>Municipio:</b> ${safeText(muni)}
        <br><b>CCT:</b> ${safeText(cct)}`;
      const sitioLink = safeLink(sitio, sitio);
      if (sitioLink) html += `<br><b>Sitio:</b> ${sitioLink}`;
      layer.bindPopup(html);
    },
  });
}
