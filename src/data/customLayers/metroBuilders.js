import L from "leaflet";
import { asHa, fmtArea, fmtNum } from "./helpers";

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
        `<div class='PopupT'>${p.NOM_ENT ?? "Entidad"}</div>` +
        `<b>Nombre del Municipio:</b> ${p.NOM_MUN ?? "—"}` +
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
        `<div class='PopupT'><b>${zonaLabel} de</b> ${p.NO_Zona ?? "—"}</div>` +
        `<b>Municipio:</b> ${p.NOM_MUN ?? "—"}` +
        `<br><b>Población Municipal:</b> ${fmtNum(p.POBMUN)}` +
        `<br><b>Mujeres:</b> ${fmtNum(p.POBFEM)}` +
        `<br><b>Hombres:</b> ${fmtNum(p.POBMAS)}` +
        `<br><b>Superficie:</b> ${fmtArea(p.Superficie)}` +
        `<br><b>Población Metropolitana:</b> ${fmtNum(p.POB_ESTATA)}` +
        `<div class='PopupSubT'><b>Instrumentos de Planeación</b></div>`;
      const PMDU = p.PMDU ?? "—";
      if (PMDU !== "No existe" && p.LINKPMDU) {
        html += `<b>PMDU:</b> <a href='${p.LINKPMDU}' target='_blank'>${p.NOM_LINK_P ?? "Consultar"}</a> <b>(${p.FECH ?? "—"})</b>`;
      } else html += `<b>PMDU:</b> ${PMDU}`;
      if (p.LINKPMD) html += `<br><b>PMD:</b> <a href='${p.LINKPMD}' target='_blank'><b>Consultar</b></a> <b>(${p.FECHPMD ?? "—"})</b>`;
      else html += `<br><b>PMD:</b> —`;
      const ATLAS = p.ATLAS ?? "—";
      if (ATLAS !== "No existe" && p.LINKATLAS) {
        html += `<br><b>Atlas de Riesgos:</b> <a href='${p.LINKATLAS}' target='_blank'><b>Consultar</b></a> <b>(${p.FECHATLAS ?? "—"})</b>`;
      } else html += `<br><b>Atlas de Riesgos:</b> ${ATLAS}`;
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
        <div class='PopupT'>${p.NOM_MUN || layerName || "Hidalgo"}</div>
        <b>Población Municipal:</b> ${fmt(p.POBMUN)}
        <br><b>Mujeres:</b> ${fmt(p.POBFEM)}
        <br><b>Hombres:</b> ${fmt(p.POBMAS)}
        <br><b>Superficie:</b> ${sup}
        <br><b>Población Estatal:</b> ${fmt(p.POB_ESTATA)}
        <div class='PopupSubT'><b>Instrumentos de Planeación</b></div>
      `;
      if (PMDU !== "No existe" && p.LINKPMDU) {
        html += `<b>PMDU:</b> <a href='${p.LINKPMDU}' target='_blank'>${p.NOM_LINK_P ?? "Consultar"}</a> <b>(</b>${p.FECH ?? ""}<b>)</b>`;
      } else html += `<b>PMDU:</b> ${PMDU}`;
      if (p.LINKPMD) html += `<br><b>PMD:</b> <a href='${p.LINKPMD}' target='_blank'><b>Consultar</b></a> <b>(</b>${p.FECHPMD ?? ""}<b>)</b>`;
      if (ATLAS !== "No existe" && p.LINKATLAS) {
        html += `<br><b>Atlas de Riesgos:</b> <a href='${p.LINKATLAS}' target='_blank'><b>Consultar</b></a> <b>(</b>${p.FECHATLAS ?? ""}<b>)</b>`;
      } else html += `<br><b>Atlas de Riesgos:</b> ${ATLAS}`;
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
      layer.bindTooltip(`<div><b>${nombre}</b></div><div>Nivel: ${nivel}</div><div>Municipio: ${muni}</div>`, { sticky: true });
      layer.on("click", (e) => layer.openTooltip(e.latlng));
      let html = `<div class='PopupT'>${nombre}</div>
        <b>Nivel:</b> ${nivel}
        <br><b>Municipio:</b> ${muni}
        <br><b>CCT:</b> ${cct}`;
      if (sitio) html += `<br><b>Sitio:</b> <a href='${sitio}' target='_blank'>${sitio}</a>`;
      layer.bindPopup(html);
    },
  });
}
