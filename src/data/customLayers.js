// src/data/customLayers.js
import L from "leaflet";
import { getLegendStyle } from "./simbologia";
import { GEOJSON_REGISTRY } from "./geojson";
import { getLegacyPopupFieldSet } from "./legacyPopupFields";

/* ===== Helpers ===== */
const asNum = (v) => (typeof v === "number" ? v : Number(v));
const fmtHa = (v) => {
  const n = asNum(v);
  return Number.isFinite(n) ? `${n.toFixed(3)} ha` : "—";
};
const fmtNum = (v) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n.toLocaleString("es-MX") : "—";
};
const fmtArea = (v) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? `${n.toFixed(3)} km²` : "—";
};

/** Formatea hectáreas: usa fmtHa si existe; si no, fallback con 3 decimales. */
const fmtHa3 = (v) => {
  const n = Number(v);
  return Number.isFinite(n)
    ? `${n.toLocaleString('es-MX', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ha`
    : v;
};
const asHa = (v) => (typeof fmtHa === 'function' ? fmtHa(v) : fmtHa3(v));

/** Alias de visualización de campos → Etiqueta mostrada */
const DISPLAY_ALIASES = {
  USOS_SUELO: 'usos del suelo',
  SUPERFICIE: 'Superficie',
  PREF_FOR_H: 'Terreno Preferentemente Forestal',
  FORESTAL_H: 'Superficie con cobertura/uso forestal',
  AGUA_HA: 'Superficie de cuerpos de agua',
  APTITUD_SE: 'Aptitud del Terreno Sectorial',
  RIESGOS_AM: 'Riesgos ambientales identificados',
  ACUIFERO: 'Nombre/clave del acuífero asociado',
  DISP_AG_SU: 'Disponibilidad de agua subterránea',
  VOL_EXTR: 'Volumen de extracción de agua subterránea',
  REC_ACUIF: 'Recarga del acuífero',
  CAPT_CO2: 'Capacidad/Captura de CO₂',
  GRADO_CONS: 'Grado de conservación',
  VAL_CONSER: 'Valor de conservación',
  FRAG_ECOL: 'Fragmentación ecológica',
  USO_CONDIC: 'Uso condicionado',
  USO_INCOMP: 'Uso incompatible',
  USO_INCOM2: 'Uso incompatible',
  USO_INCOMP2: 'Uso incompatible',
  NOMBRE_ANP: 'Nombre del Área Natural Protegida',

  POLITICA: 'Política',
  Politica: 'Política',
  'Política': 'Política',

  REGION: 'Región',
  Region: 'Región',
  'REGIÓN': 'Región',
  'Región': 'Región',
};

// Campos que deben terminar en punto si traen coma al final
const PERIODIZE_FIELDS = new Set([
  'Criterios de Regulación Ecológica',
  'Estrategias ecológicas',
  'Uso incompatible',
]);

// Reemplaza periodizeIfTrailingComma por esto:
function ensureFinalPeriod(label, value) {
  if (value == null) return value;
  if (!PERIODIZE_FIELDS.has(label)) return value;
  const s = String(value).trim();
  if (!s) return s;
  // Quita comas/semicolones/2 puntos (y espacios) al final y garantiza punto final.
  const stripped = s.replace(/[,\s;:]+$/u, '');
  return /\.$/u.test(stripped) ? stripped : `${stripped}.`;
}


/** Campos cuyo valor debe llevar sufijo 'ha' (además de SUPERFICIE que usa fmtHa) */
const NEEDS_HA_SUFFIX = new Set(['PREF_FOR_H', 'FORESTAL_H', 'AGUA_HA']);

// === NUEVO: mapa de unidades para campos específicos ===
const UNIT_SUFFIX_MAP = {
  DISP_AG_SU: 'hm³/año',  // Disponibilidad de agua subterránea
  VOL_EXTR: 'hm³/año',  // Volumen de extracción de agua subterránea
  CAPT_CO2: 'CO₂/año',  // Capacidad/Captura de CO₂
};

/** Grupos a consolidar en un solo campo */
const GROUPS = {
  'Lineamiento': ['LINEAMIENT', 'LINEAMIEN2', 'LINEAMIEN3', 'LINEAMIEN4', 'LINEAMIEN5', 'LINEAMIEN6', 'LINEAMIEN7'],
  'Criterios de Regulación Ecológica': ['CRE_1', 'CRE_2', 'CRE_3', 'CRE_4', 'CRE_5', 'CRE_6'],
  'Estrategias ecológicas': ['EST_1', 'EST_2', 'EST_3', 'EST_4'],
  'Uso incompatible': ['USO_INCOMP', 'USO_INCOM2', 'USO_INCOMP2'],
};

/** Claves que no deben mostrarse (títulos/duplicados) */
const BASE_OMIT = new Set(['NOMGEO']);

/** Normaliza un par k/v → { label, value, skip } */
function normalizeKV(k, v) {
  if (!Object.prototype.hasOwnProperty.call({ [k]: true }, k)) return { skip: true };
  let label = DISPLAY_ALIASES[k] || k;
  let value = v;

  // Campos con unidad específica (hm³/año o CO₂/año)
  if (UNIT_SUFFIX_MAP[k]) {
    const unit = UNIT_SUFFIX_MAP[k];
    const n = Number(v);
    if (Number.isFinite(n)) {
      value = `${n.toLocaleString('es-MX', { maximumFractionDigits: 3 })} ${unit}`;
    } else {
      const s = String(v ?? '').trim();
      // Evita duplicar la unidad si ya viene en el valor
      const endsWithUnit = new RegExp(`${unit.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}$`, 'i').test(s);
      value = s ? (endsWithUnit ? s : `${s} ${unit}`) : '—';
    }
  }

  // SUPERFICIE → siempre con formato ha
  if (/^(SUPERFICIE|Superficie)$/i.test(k)) {
    label = 'Superficie';
    value = asHa(v);
  }

  // Campos con sufijo ha
  if (NEEDS_HA_SUFFIX.has(k)) {
    const n = Number(v);
    value = Number.isFinite(n)
      ? `${n.toLocaleString('es-MX', { maximumFractionDigits: 3 })} ha`
      : (typeof v === 'string' && !/ha$/i.test(v) ? `${v} ha` : v);
  }

  return { label, value, skip: false };
}

/** Construye HTML de popup con normalización + consolidación */
function buildPopupHTML(p, {
  titleKeys = ['ZonSec', 'ZonSec2022', 'Uso', 'USO', 'Categoria'],
  extraOmit = [],
  perKeyRender = null, // fn({k, label, value}) → string|undefined (para casos especiales)
} = {}, layerDef) {
  const title = (titleKeys.map((k) => p?.[k]).find(Boolean) || '').toString().toUpperCase();
  let html = `<div class="PopupSubT"><b>${title}</b></div>`;

  const omit = new Set(
    [...BASE_OMIT, ...titleKeys, ...extraOmit].flatMap((key) => [key, String(key).toLowerCase()])
  );
  const allow = getLegacyPopupFieldSet(layerDef);
  const seen = new Set();

  // 1) Consolidar grupos (limpia fragmentos y asegura punto final)
  const consolidated = {};
  for (const [outLabel, keys] of Object.entries(GROUPS)) {
    const vals = keys
      .map((k) => p?.[k])
      .filter((x) => x != null && String(x).trim() !== '')
      // limpia cada fragmento: quita , ; : y espacios finales
      .map((s) => String(s).trim().replace(/[,\s;:]+$/u, ''));

    if (vals.length) {
      const joined = vals.join('; ');
      consolidated[outLabel] = ensureFinalPeriod(outLabel, joined);
    }
    keys.forEach((k) => {
      omit.add(k);
      omit.add(String(k).toLowerCase());
    });
  }

  // 2) Recorrer props originales con normalización
  for (const k in p) {
    const normalizedKey = String(k).toLowerCase();
    if (!Object.hasOwn(p, k) || omit.has(k) || omit.has(normalizedKey)) continue;
    if (allow && !allow.has(normalizedKey)) continue;
    if (seen.has(normalizedKey)) continue;
    seen.add(normalizedKey);
    const { label, value, skip } = normalizeKV(k, p[k]);
    if (skip) continue;

    // Gancho para personalizaciones por municipio/campo
    if (typeof perKeyRender === 'function') {
      const custom = perKeyRender({ k, label, value });
      if (typeof custom === 'string') { html += custom; continue; }
    }
    const displayValue = ensureFinalPeriod(label, value);
    html += `<b>${label}:</b> ${displayValue}<br>`;
  }

  // 3) Añadir los campos consolidados al final (orden definido)
  for (const [label, value] of Object.entries(consolidated)) {
    const displayValue = ensureFinalPeriod(label, value);
    html += `<b>${label}:</b> ${displayValue}<br>`;
  }

  return html;
}

/* ==================== ZMVM (por entidad) ==================== */
function buildZMVM(data, paneId) {
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
    }
  });
}

/* ==================== Zonas metropolitanas genéricas ==================== */
function buildMetropolitana(data, paneId, fillColor, strokeColor, zonaLabel = "Zona Metropolitana") {
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
      if (ATLAS !== "No existe" && p.LINKATLAS)
        html += `<br><b>Atlas de Riesgos:</b> <a href='${p.LINKATLAS}' target='_blank'><b>Consultar</b></a> <b>(${p.FECHATLAS ?? "—"})</b>`;
      else html += `<br><b>Atlas de Riesgos:</b> ${ATLAS}`;
      layer.bindPopup(html);
    }
  });
}

/* ==================== Capas informativas Hgo / Escuelas ==================== */
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
      if (PMDU !== "No existe" && p.LINKPMDU)
        html += `<b>PMDU:</b> <a href='${p.LINKPMDU}' target='_blank'>${p.NOM_LINK_P ?? "Consultar"}</a> <b>(</b>${p.FECH ?? ""}<b>)</b>`;
      else html += `<b>PMDU:</b> ${PMDU}`;
      if (p.LINKPMD)
        html += `<br><b>PMD:</b> <a href='${p.LINKPMD}' target='_blank'><b>Consultar</b></a> <b>(</b>${p.FECHPMD ?? ""}<b>)</b>`;
      if (ATLAS !== "No existe" && p.LINKATLAS)
        html += `<br><b>Atlas de Riesgos:</b> <a href='${p.LINKATLAS}' target='_blank'><b>Consultar</b></a> <b>(</b>${p.FECHATLAS ?? ""}<b>)</b>`;
      else html += `<br><b>Atlas de Riesgos:</b> ${ATLAS}`;
      layer.bindPopup(html);
      layer.on("click", (e) => layer.openPopup(e.latlng));
    }
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
    }
  });
}

/* ==================== PMDU (polígonos) ==================== */
/** Soporta meta.fill/meta.stroke (o meta.color como fallback) y “relieve” opcional. */
function pmduPoly(data, paneId, ld, popupBuilder) {
  const sty = getLegendStyle(ld?.legendKey, ld?.legendItem) || {};
  const asLine = !!ld?.meta?.asLine;
  const weight = ld?.meta?.weight ?? (asLine ? 3 : 2.5);

  // Fallbacks que respetan meta.*, y si no, usan la leyenda
  const fillColor = asLine
    ? "transparent"
    : (ld?.meta?.fill || ld?.meta?.color || sty.fill || "#888");

  const strokeColor = ld?.meta?.stroke || ld?.meta?.color || sty.stroke || "#444";

  // “relieve” 3D para CSD1/2/3
  const isCSD = /^CSD[123]/.test(ld?.legendItem || "");
  const w = isCSD ? Math.max(weight, 3.5) : weight;

  return L.geoJSON(data, {
    pane: paneId,
    style: () => ({
      fillColor,
      fillOpacity: asLine ? 0.0 : 0.5,
      color: strokeColor,
      weight: w,
      className: isCSD ? "epz-3d" : "",
      dashArray: ld?.meta?.dashArray || null,
    }),
    onEachFeature: (feature, layer) => {
      const p = feature?.properties ?? {};
      if (popupBuilder) layer.bindPopup(popupBuilder(p, ld));
    }
  });
}

/* ====== Popup builders ====== */
const popupPachuca = (p) => {
  const estatus = p?.Name_1 ? `<b>Estatus:</b> ${p.Name_1}<br>` : '';
  const area = p?.Ar != null ? `<b>Área:</b> ${asHa(p.Ar)}` : '';
  return `<div class="PopupSubT"><b>Etapas de Crecimiento</b></div>${estatus}${area}`;
};


/** Tizayuca (con aviso visual en "Plazo") */
const popupTizayuca = (p, ld) => {
  const title = (p?.ZonSec2022 || '').toString().toUpperCase();
  return buildPopupHTML(p, {
    titleKeys: ['ZonSec2022'],
    perKeyRender: ({ k, label, value }) => {
      if (k === 'Superficie' || /^SUPERFICIE$/i.test(k)) {
        return `<b>Superficie:</b> ${asHa(p[k])}<br>`;
      }
      if (k === 'Plazo') {
        return `<b>${label}:</b> ${value}<p class="PopText"> Plazo</p><br>`;
      }
      return undefined;
    },
  }, ld).replace('<div class="PopupSubT"><b></b></div>', `<div class="PopupSubT"><b>${title}</b></div>`);
};

/** Villa de Tezontepec (ignora NOMGEO y muestra título desde ZonSec) */
const popupVilla = (p, ld) => buildPopupHTML(p, {
  titleKeys: ['ZonSec'],
  extraOmit: ['NOMGEO'],
}, ld);

/** Mineral de la Reforma (genérico, respetando Superficie) */
const popupMR = (p, ld) => buildPopupHTML(p, {
  titleKeys: ['ZonSec'],
}, ld);

/** Epazoyucan (genérico) */
const popupEpaz = (p, ld) => buildPopupHTML(p, {
  titleKeys: ['ZonSec', 'ZonSec2022', 'Uso', 'USO'],
}, ld);

/** Cuautepec (genérico) */
const popupCuautepec = (p, ld) => buildPopupHTML(p, {
  titleKeys: ['ZonSec', 'ZonSec2022', 'Uso', 'USO'],
}, ld);

/** Tepeji (genérico; conserva posibles títulos alternos) */
const popupTepeji = (p, ld) => buildPopupHTML(p, {
  titleKeys: ['ZonSec', 'USO', 'Uso', 'Clasif', 'Categoria'],
}, ld);

/** Santiago de Tulantepec de Lugo Guerrero (genérico) */
const popupSantiago = (p, ld) => buildPopupHTML(p, {
  titleKeys: ['ZonSec', 'ZonSec2022', 'Uso', 'USO', 'Categoria'],
}, ld);

/* ====== Builders concretos ====== */
const buildPachuca = (data, paneId, ld) => pmduPoly(data, paneId, ld, popupPachuca);
const buildTizayuca = (data, paneId, ld) => pmduPoly(data, paneId, ld, popupTizayuca);
const buildVilla = (data, paneId, ld) => pmduPoly(data, paneId, ld, popupVilla);
const buildMineralRef = (data, paneId, ld) => pmduPoly(data, paneId, ld, popupMR);
const buildEpaz = (data, paneId, ld) => pmduPoly(data, paneId, ld, popupEpaz);
const buildCuautepec = (data, paneId, ld) => pmduPoly(data, paneId, ld, popupCuautepec);
const buildTepeji = (data, paneId, ld) => pmduPoly(data, paneId, ld, popupTepeji);

/* ====== Util ====== */
const mapFrom = (ids, fn) => ids.reduce((acc, id) => ((acc[id] = fn), acc), {});

/* ====== IDs por municipio ====== */
const IDS_PACHUCA = ["SUCLargoP", "SULargoP", "SUMedianoP", "SUCMedianoP"];

const IDS_TIZAYUCA = [
  "AgriTec", "AgriInd", "CRA", "CUMBD", "CUMMD", "CAGUA", "EUrb",
  "HDA_Unifamiliar", "HDB_Unifamiliar", "HDM_Unifamiliar", "HDMA_Unifamiliar", "HDMB_Unifamiliar",
  "HDMA_MdTC", "HDmA2", "HDmB_Uni", "IBI", "IGI", "IMI", "IUrb", "mixto", "ParqueHid", "RTF"
];

const IDS_VILLA = [
  "Villa_TUA", "Villa_agroindustria", "Villa_areaAgri", "Villa_golf", "Villa_declaratoria",
  "Villa_equipamiento", "Villa_habitacional", "Villa_parAcu", "Villa_parTer",
  "Villa_PLATAH", "Villa_servicios", "Villa_mixto", "Villa_ZAV", "Villa_ZPE"
];

const IDS_MR = [
  "MR_EVP", "MR_CUM", "MR_CS", "MR_EI", "MR_ER", "MR_EVA",
  "MR_H05", "MR_H1", "MR_H2", "MR_H3", "MR_H4", "MR_H5", "MR_H6", "MR_H7",
  "MR_ILNC", "MR_PA", "MR_PPDU", "MR_PAT", "MR_PEF", "MR_PPI",
  // "MR_Puente_bimodal","MR_Puente_multimodal",
  "MR_Reserva", "MR_Servicios", "MR_SUM", "MR_ZSEH", "MR_ZSERPCE"
];

/* === ALIAS para IDs con acento / nombres largos usados en layersTree === */
Object.assign(GEOJSON_REGISTRY, {
  // Zonificación Secundaria (Epazoyucan)
  "Habitacional_Densidad_Mínima_Epazoyucan": GEOJSON_REGISTRY.EPA_HD1,
  "Habitacional_Densidad_Baja_Epazoyucan": GEOJSON_REGISTRY.EPA_HD2,
  "Habitacional_Densidad_Media_Epazoyucan": GEOJSON_REGISTRY.EPA_HD3,
  "comercio_y_servicios_densidad_minima_Epazoyucan": GEOJSON_REGISTRY.EPA_CSD1,
  "comercio_y_servicios_densidad_baja_Epazoyucan": GEOJSON_REGISTRY.EPA_CSD2,
  "comercio_y_servicios_densidad_media_Epazoyucan": GEOJSON_REGISTRY.EPA_CSD3,
  "Industria_Ligera_Epazoyucan": GEOJSON_REGISTRY.EPA_IL,
  "agroindustria_Epazoyucan": GEOJSON_REGISTRY.EPA_AG,
  "Equipamiento_Publico_Epazoyucan": GEOJSON_REGISTRY.EPA_EQ,
  "Equipamiento_Privado_Epazoyucan": GEOJSON_REGISTRY.EPA_EQP,
  "poligonoDeActuacion_Epazoyuca_Epazoyucan": GEOJSON_REGISTRY.EPA_PA,

  // Uso no Urbano (Epazoyucan)
  "Aprovechamiento_Epazoyucan": GEOJSON_REGISTRY.EPA_APROV,
  "Aprovechamiento_conservacion_Epazoyucan": GEOJSON_REGISTRY.EPA_APROV_CONS,
  "Aprovechamiento_restauracion_Epazoyucan": GEOJSON_REGISTRY.EPA_APROV_RES,
  "Conservacion_Epazoyuca": GEOJSON_REGISTRY.EPA_CONS,
  "Conservacion_restauracion_Epazoyucan": GEOJSON_REGISTRY.EPA_CONS_RES,
  "Restauracion_Epazoyucan": GEOJSON_REGISTRY.EPA_RES,

  // Centros de Población (Epazoyucan)
  "CP_Epazoyucan": GEOJSON_REGISTRY.EPA_CP_EPAZ,
  "CP_San_Juan_Tizahuapan": GEOJSON_REGISTRY.EPA_CP_SJT,
  "CP_Santa_Mónica": GEOJSON_REGISTRY.EPA_CP_SM,
  "CP_Xochihuacán": GEOJSON_REGISTRY.EPA_CP_XOCHI,
});

const IDS_EPAZ = [
  // Zonificación Secundaria
  "Habitacional_Densidad_Mínima_Epazoyucan",
  "Habitacional_Densidad_Baja_Epazoyucan",
  "Habitacional_Densidad_Media_Epazoyucan",
  "comercio_y_servicios_densidad_minima_Epazoyucan",
  "comercio_y_servicios_densidad_baja_Epazoyucan",
  "comercio_y_servicios_densidad_media_Epazoyucan",
  "Industria_Ligera_Epazoyucan",
  "agroindustria_Epazoyucan",
  "Equipamiento_Publico_Epazoyucan",
  "Equipamiento_Privado_Epazoyucan",
  "poligonoDeActuacion_Epazoyuca_Epazoyucan",

  // Uso no Urbano
  "Aprovechamiento_Epazoyucan",
  "Aprovechamiento_conservacion_Epazoyucan",
  "Aprovechamiento_restauracion_Epazoyucan",
  "Conservacion_Epazoyuca",
  "Conservacion_restauracion_Epazoyucan",
  "Restauracion_Epazoyucan",

  // Centros de Población
  "CP_Epazoyucan",
  "CP_San_Juan_Tizahuapan",
  "CP_Santa_Mónica",
  "CP_Xochihuacán"
];

Object.assign(GEOJSON_REGISTRY, {
  // Zonificación Secundaria
  "Habitacional_Densidad_Mínima_Cuautepec": GEOJSON_REGISTRY.CUA_HD1,
  "Habitacional_Densidad_Baja_Cuautepec": GEOJSON_REGISTRY.CUA_HD2,
  "comercio_y_servicios_densidad_minima_Cuautepec": GEOJSON_REGISTRY.CUA_CSD1,
  "comercio_y_servicios_densidad_baja_Cuautepec": GEOJSON_REGISTRY.CUA_CSD2,
  "comercio_y_servicios_densidad_media_Cuautepec": GEOJSON_REGISTRY.CUA_CSD3,
  "Equipamiento_Publico_Cuautepec": GEOJSON_REGISTRY.CUA_EQ,

  // Uso no Urbano
  "Aprovechamiento_Cuautepec": GEOJSON_REGISTRY.CUA_APROV,
  "Aprovechamiento_conservacion_Cuautepec": GEOJSON_REGISTRY.CUA_APROV_CONS,
  "Aprovechamiento_restauracion_Cuautepec": GEOJSON_REGISTRY.CUA_APROV_RES,
  "Conservacion_Cuautepec": GEOJSON_REGISTRY.CUA_CONS,
  "Conservacion_restauracion_Cuautepec": GEOJSON_REGISTRY.CUA_CONS_RES,
  "Restauracion_Cuautepec": GEOJSON_REGISTRY.CUA_RES,

  // Centros de Población (usamos los mismos ids de las capas)
  "CP_Cuautepec": GEOJSON_REGISTRY.CUA_CP_CUAUTEPEC,
  "CP_Santa_Elena_Paliseca": GEOJSON_REGISTRY.CUA_CP_SANTA_ELENA_PALISECA,
  "CP_San_Lorenzo_Sayula": GEOJSON_REGISTRY.CUA_CP_SAN_LORENZO_SAYULA,
  "CP_Cuautepec_Tecocomulco_JuarezF": GEOJSON_REGISTRY.CUA_CP_TECOCOMULCO_JUAREZF
});


// ====== IDs Cuautepec para mapFrom ======
const IDS_CUAU = [
  "Habitacional_Densidad_Mínima_Cuautepec",
  "Habitacional_Densidad_Baja_Cuautepec",
  "comercio_y_servicios_densidad_minima_Cuautepec",
  "comercio_y_servicios_densidad_baja_Cuautepec",
  "comercio_y_servicios_densidad_media_Cuautepec",
  "Equipamiento_Publico_Cuautepec",

  "Aprovechamiento_Cuautepec",
  "Aprovechamiento_conservacion_Cuautepec",
  "Aprovechamiento_restauracion_Cuautepec",
  "Conservacion_Cuautepec",
  "Conservacion_restauracion_Cuautepec",
  "Restauracion_Cuautepec",

  "CP_Cuautepec",
  "CP_Santa_Elena_Paliseca",
  "CP_San_Lorenzo_Sayula",
  "CP_Cuautepec_Tecocomulco_JuarezF"
];

const IDS_TEPEJI_ZONSEC = [
  "Centro_Urbano_Tepeji",
  "Subcentro_Urbano_Tepeji",
  "Centro_de_Barrio_Tepeji",
  "Corredor_Comercial_Servicios_Alta_Tepeji",
  "Corredor_Comercial_Servicios_Mediana_Tepeji",
  "Corredor_Comercial_Servicios_Baja_Tepeji",
  "Habitacional_Alta_Densidad_Tepeji",
  "Habitacional_Mediana_Densidad_Tepeji",
  "Habitacional_Baja_Densidad_Tepeji",
  "Industria_Ligera_Tepeji",
  "Industria_Mediana_Tepeji",
  "Industria_Pesada_Tepeji",
];

const IDS_TEPEJI_USO_NO_URB = [
  "Aprovechamiento_Tepeji",
  "Aprovechamiento_Conservacion_Tepeji",
  "Aprovechamiento_Restauracion_Tepeji",
  "Conservacion_Tepeji",
  "Conservacion_Restauracion_Tepeji",
  "Proteccion_Tepeji",
  "Restauracion_Tepeji",
];

const IDS_TEPEJI_CP = [
  "CP_Tepeji_del_Rio_Tepeji",
  "CP_Melchor_Ocampo_Tepeji",
  "CP_Ojo_de_Agua_Tepeji",
  "CP_San_Buenaventura_Tepeji",
  "CP_San_Ildefonso_Tepeji",
  "CP_Santiago_Tlautla_Tepeji",
  "CP_Santiago_Tlaltepoxco_Tepeji",
  "CP_Zona_Industrial_Tepeji",
];


const IDS_SANTIAGO_ZONSEC = [
  "HDMinima_SantiagoTLG",  // HD1
  "HDB_SantiagoTLG",       // HD2
  "HDMedia_SantiagoTLG",   // HD3
  "CSDMinima_SantiagoTLG", // CSD1
  "CSDB_SantiagoTLG",      // CSD2
  "CSDMedia_SantiagoTLG",  // CSD3
  "IL_SantiagoTLG",        // IL
  "EP_SantiagoTLG",        // EQ
  "PA_SantiagoTLG",        // PA
];

/* ====== IDs Santiago de Tulantepec — Uso no Urbano ====== */
const IDS_SANTIAGO_NO_URB = [
  "APROV_SantiagoTLG",
  "APROV_CONS_SantiagoTLG",
  "APROV_RES_SantiagoTLG",
  "CONS_SantiagoTLG",
  "CONS_RES_SantiagoTLG",
  "PROT_SantiagoTLG",
  "RES_SantiagoTLG",
];

/* ====== IDs Santiago de Tulantepec — Centros de Población ====== */
const IDS_SANTIAGO_CP = [
  "CP_Santiago_Tulantepec",
  "CP_El_Pedregal_de_San_Jose",
  "CP_Los_Romeros",
  "CP_Las_Lajas",
  "CP_Emiliano_Zapata",
  "CP_Ventoquipa",
];

/* ====== IDs especiales ====== */
const IDS_SANTIAGO_DEF_LIMITES = ["definicionLimites_SantiagoTLG"];
const IDS_SANTIAGO_ZA = ["zonaArqueologica_SantiagoTLG"];

const buildSantiago = (data, paneId, ld) => pmduPoly(data, paneId, ld, popupSantiago);

/* ====== Export Builders ====== */
export const LAYER_BUILDERS = {
  // Info general / Escuelas / Zonas Metro
  hgo_info_gen: (data, paneId, ld) => buildInfoHgoLayer({ data, paneId, color: "#fff", layerName: ld?.name }),
  esc_priv_ms: (data, paneId, ld) => buildEscPrivLayer({ data, paneId, layerDef: ld }),
  zmvm_info: (data, paneId) => buildZMVM(data, paneId),
  zmpachuca_info: (data, paneId) => buildMetropolitana(data, paneId, "#B6DC76", "transparent", "Zona Metropolitana"),
  zmtula_info: (data, paneId) => buildMetropolitana(data, paneId, "Aqua", "transparent", "Zona Metropolitana"),
  zmtulancingo_info: (data, paneId) => buildMetropolitana(data, paneId, "#241E4E", "transparent", "Zona Metropolitana"),


  // PMDU
  ...mapFrom(IDS_PACHUCA, buildPachuca),
  ...mapFrom(IDS_TIZAYUCA, buildTizayuca),
  ...mapFrom(IDS_VILLA, buildVilla),
  ...mapFrom(IDS_MR, buildMineralRef),
  ...mapFrom(IDS_EPAZ, buildEpaz),
  ...mapFrom(IDS_CUAU, buildCuautepec),

  ...mapFrom(IDS_TEPEJI_ZONSEC, buildTepeji),
  ...mapFrom(IDS_TEPEJI_USO_NO_URB, buildTepeji),
  ...mapFrom(IDS_TEPEJI_CP, buildTepeji),

  ...mapFrom(IDS_SANTIAGO_ZONSEC, buildSantiago),
  ...mapFrom(IDS_SANTIAGO_NO_URB, buildSantiago),
  ...mapFrom(IDS_SANTIAGO_CP, buildSantiago),
  ...mapFrom(IDS_SANTIAGO_DEF_LIMITES, buildSantiago),
  ...mapFrom(IDS_SANTIAGO_ZA, buildSantiago),
};
