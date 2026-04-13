import L from "leaflet";
import { getLegendStyle } from "../simbologia";
import { asHa, buildPopupHTML } from "./helpers";

function pmduPoly(data, paneId, ld, popupBuilder) {
  const sty = getLegendStyle(ld?.legendKey, ld?.legendItem) || {};
  const asLine = !!ld?.meta?.asLine;
  const weight = ld?.meta?.weight ?? (asLine ? 3 : 2.5);
  const fillColor = asLine ? "transparent" : (ld?.meta?.fill || ld?.meta?.color || sty.fill || "#888");
  const strokeColor = ld?.meta?.stroke || ld?.meta?.color || sty.stroke || "#444";
  const isCSD = /^CSD[123]/.test(ld?.legendItem || "");
  const w = isCSD ? Math.max(weight, 3.5) : weight;

  return L.geoJSON(data, {
    pane: paneId,
    style: () => ({
      fillColor,
      fillOpacity: asLine ? 0 : 0.5,
      color: strokeColor,
      weight: w,
      className: isCSD ? "epz-3d" : "",
      dashArray: ld?.meta?.dashArray || null,
    }),
    onEachFeature: (feature, layer) => {
      const p = feature?.properties ?? {};
      if (popupBuilder) layer.bindPopup(popupBuilder(p, ld));
    },
  });
}

const popupPachuca = (p) => {
  const estatus = p?.Name_1 ? `<b>Estatus:</b> ${p.Name_1}<br>` : "";
  const area = p?.Ar != null ? `<b>Área:</b> ${asHa(p.Ar)}` : "";
  return `<div class="PopupSubT"><b>Etapas de Crecimiento</b></div>${estatus}${area}`;
};

const popupTizayuca = (p, ld) => {
  const title = (p?.ZonSec2022 || "").toString().toUpperCase();
  return buildPopupHTML(
    p,
    {
      titleKeys: ["ZonSec2022"],
      perKeyRender: ({ k, label, value }) => {
        if (k === "Superficie" || /^SUPERFICIE$/i.test(k)) {
          return `<b>Superficie:</b> ${asHa(p[k])}<br>`;
        }
        if (k === "Plazo") {
          return `<b>${label}:</b> ${value}<p class="PopText"> Plazo</p><br>`;
        }
        return undefined;
      },
    },
    ld
  ).replace('<div class="PopupSubT"><b></b></div>', `<div class="PopupSubT"><b>${title}</b></div>`);
};

const popupVilla = (p, ld) => buildPopupHTML(p, { titleKeys: ["ZonSec"], extraOmit: ["NOMGEO"] }, ld);
const popupMR = (p, ld) => buildPopupHTML(p, { titleKeys: ["ZonSec"] }, ld);
const popupEpaz = (p, ld) => buildPopupHTML(p, { titleKeys: ["ZonSec", "ZonSec2022", "Uso", "USO"] }, ld);
const popupCuautepec = (p, ld) => buildPopupHTML(p, { titleKeys: ["ZonSec", "ZonSec2022", "Uso", "USO"] }, ld);
const popupTepeji = (p, ld) => buildPopupHTML(p, { titleKeys: ["ZonSec", "USO", "Uso", "Clasif", "Categoria"] }, ld);
const popupSantiago = (p, ld) => buildPopupHTML(p, { titleKeys: ["ZonSec", "ZonSec2022", "Uso", "USO", "Categoria"] }, ld);

export const buildPachuca = (data, paneId, ld) => pmduPoly(data, paneId, ld, popupPachuca);
export const buildTizayuca = (data, paneId, ld) => pmduPoly(data, paneId, ld, popupTizayuca);
export const buildVilla = (data, paneId, ld) => pmduPoly(data, paneId, ld, popupVilla);
export const buildMineralRef = (data, paneId, ld) => pmduPoly(data, paneId, ld, popupMR);
export const buildEpaz = (data, paneId, ld) => pmduPoly(data, paneId, ld, popupEpaz);
export const buildCuautepec = (data, paneId, ld) => pmduPoly(data, paneId, ld, popupCuautepec);
export const buildTepeji = (data, paneId, ld) => pmduPoly(data, paneId, ld, popupTepeji);
export const buildSantiago = (data, paneId, ld) => pmduPoly(data, paneId, ld, popupSantiago);
