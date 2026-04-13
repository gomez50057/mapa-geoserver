import { getLegacyPopupFieldSet } from "../legacyPopupFields";

export const asNum = (v) => (typeof v === "number" ? v : Number(v));

export const fmtHa = (v) => {
  const n = asNum(v);
  return Number.isFinite(n) ? `${n.toFixed(3)} ha` : "—";
};

export const fmtNum = (v) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n.toLocaleString("es-MX") : "—";
};

export const fmtArea = (v) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? `${n.toFixed(3)} km²` : "—";
};

const fmtHa3 = (v) => {
  const n = Number(v);
  return Number.isFinite(n)
    ? `${n.toLocaleString("es-MX", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ha`
    : v;
};

export const asHa = (v) => (typeof fmtHa === "function" ? fmtHa(v) : fmtHa3(v));

const DISPLAY_ALIASES = {
  USOS_SUELO: "usos del suelo",
  SUPERFICIE: "Superficie",
  PREF_FOR_H: "Terreno Preferentemente Forestal",
  FORESTAL_H: "Superficie con cobertura/uso forestal",
  AGUA_HA: "Superficie de cuerpos de agua",
  APTITUD_SE: "Aptitud del Terreno Sectorial",
  RIESGOS_AM: "Riesgos ambientales identificados",
  ACUIFERO: "Nombre/clave del acuífero asociado",
  DISP_AG_SU: "Disponibilidad de agua subterránea",
  VOL_EXTR: "Volumen de extracción de agua subterránea",
  REC_ACUIF: "Recarga del acuífero",
  CAPT_CO2: "Capacidad/Captura de CO₂",
  GRADO_CONS: "Grado de conservación",
  VAL_CONSER: "Valor de conservación",
  FRAG_ECOL: "Fragmentación ecológica",
  USO_CONDIC: "Uso condicionado",
  USO_INCOMP: "Uso incompatible",
  USO_INCOM2: "Uso incompatible",
  USO_INCOMP2: "Uso incompatible",
  NOMBRE_ANP: "Nombre del Área Natural Protegida",
  POLITICA: "Política",
  Politica: "Política",
  "Política": "Política",
  REGION: "Región",
  Region: "Región",
  REGIÓN: "Región",
  Región: "Región",
};

const PERIODIZE_FIELDS = new Set([
  "Criterios de Regulación Ecológica",
  "Estrategias ecológicas",
  "Uso incompatible",
]);

export function ensureFinalPeriod(label, value) {
  if (value == null) return value;
  if (!PERIODIZE_FIELDS.has(label)) return value;
  const s = String(value).trim();
  if (!s) return s;
  const stripped = s.replace(/[,\s;:]+$/u, "");
  return /\.$/u.test(stripped) ? stripped : `${stripped}.`;
}

const NEEDS_HA_SUFFIX = new Set(["PREF_FOR_H", "FORESTAL_H", "AGUA_HA"]);

const UNIT_SUFFIX_MAP = {
  DISP_AG_SU: "hm³/año",
  VOL_EXTR: "hm³/año",
  CAPT_CO2: "CO₂/año",
};

const GROUPS = {
  Lineamiento: ["LINEAMIENT", "LINEAMIEN2", "LINEAMIEN3", "LINEAMIEN4", "LINEAMIEN5", "LINEAMIEN6", "LINEAMIEN7"],
  "Criterios de Regulación Ecológica": ["CRE_1", "CRE_2", "CRE_3", "CRE_4", "CRE_5", "CRE_6"],
  "Estrategias ecológicas": ["EST_1", "EST_2", "EST_3", "EST_4"],
  "Uso incompatible": ["USO_INCOMP", "USO_INCOM2", "USO_INCOMP2"],
};

const BASE_OMIT = new Set(["NOMGEO"]);

function normalizeKV(k, v) {
  if (!Object.prototype.hasOwnProperty.call({ [k]: true }, k)) return { skip: true };
  let label = DISPLAY_ALIASES[k] || k;
  let value = v;

  if (UNIT_SUFFIX_MAP[k]) {
    const unit = UNIT_SUFFIX_MAP[k];
    const n = Number(v);
    if (Number.isFinite(n)) {
      value = `${n.toLocaleString("es-MX", { maximumFractionDigits: 3 })} ${unit}`;
    } else {
      const s = String(v ?? "").trim();
      const endsWithUnit = new RegExp(`${unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i").test(s);
      value = s ? (endsWithUnit ? s : `${s} ${unit}`) : "—";
    }
  }

  if (/^(SUPERFICIE|Superficie)$/i.test(k)) {
    label = "Superficie";
    value = asHa(v);
  }

  if (NEEDS_HA_SUFFIX.has(k)) {
    const n = Number(v);
    value = Number.isFinite(n)
      ? `${n.toLocaleString("es-MX", { maximumFractionDigits: 3 })} ha`
      : (typeof v === "string" && !/ha$/i.test(v) ? `${v} ha` : v);
  }

  return { label, value, skip: false };
}

export function buildPopupHTML(
  p,
  {
    titleKeys = ["ZonSec", "ZonSec2022", "Uso", "USO", "Categoria"],
    extraOmit = [],
    perKeyRender = null,
  } = {},
  layerDef
) {
  const title = (titleKeys.map((k) => p?.[k]).find(Boolean) || "").toString().toUpperCase();
  let html = `<div class="PopupSubT"><b>${title}</b></div>`;

  const omit = new Set([...BASE_OMIT, ...titleKeys, ...extraOmit].flatMap((key) => [key, String(key).toLowerCase()]));
  const allow = getLegacyPopupFieldSet(layerDef);
  const seen = new Set();

  const consolidated = {};
  for (const [outLabel, keys] of Object.entries(GROUPS)) {
    const vals = keys
      .map((k) => p?.[k])
      .filter((x) => x != null && String(x).trim() !== "")
      .map((s) => String(s).trim().replace(/[,\s;:]+$/u, ""));

    if (vals.length) {
      const joined = vals.join("; ");
      consolidated[outLabel] = ensureFinalPeriod(outLabel, joined);
    }
    keys.forEach((k) => {
      omit.add(k);
      omit.add(String(k).toLowerCase());
    });
  }

  for (const k in p) {
    const normalizedKey = String(k).toLowerCase();
    if (!Object.hasOwn(p, k) || omit.has(k) || omit.has(normalizedKey)) continue;
    if (allow && !allow.has(normalizedKey)) continue;
    if (seen.has(normalizedKey)) continue;
    seen.add(normalizedKey);
    const { label, value, skip } = normalizeKV(k, p[k]);
    if (skip) continue;

    if (typeof perKeyRender === "function") {
      const custom = perKeyRender({ k, label, value });
      if (typeof custom === "string") {
        html += custom;
        continue;
      }
    }

    const displayValue = ensureFinalPeriod(label, value);
    html += `<b>${label}:</b> ${displayValue}<br>`;
  }

  for (const [label, value] of Object.entries(consolidated)) {
    const displayValue = ensureFinalPeriod(label, value);
    html += `<b>${label}:</b> ${displayValue}<br>`;
  }

  return html;
}

export const mapFrom = (ids, fn) => ids.reduce((acc, id) => ((acc[id] = fn), acc), {});
