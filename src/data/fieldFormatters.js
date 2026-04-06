const DASH = "—";

const DISPLAY_ALIASES = {
  id: "ID",
  USOS_SUELO: "Usos del suelo",
  usos_suelo: "Usos del suelo",
  SUPERFICIE: "Superficie",
  superficie: "Superficie",
  PREF_FOR_H: "Terreno preferentemente forestal",
  pref_for_h: "Terreno preferentemente forestal",
  FORESTAL_H: "Superficie con cobertura/uso forestal",
  forestal_h: "Superficie con cobertura/uso forestal",
  AGUA_HA: "Superficie de cuerpos de agua",
  agua_ha: "Superficie de cuerpos de agua",
  APTITUD_SE: "Aptitud del terreno sectorial",
  aptitud_se: "Aptitud del terreno sectorial",
  RIESGOS_AM: "Riesgos ambientales identificados",
  riesgos_am: "Riesgos ambientales identificados",
  ACUIFERO: "Nombre/clave del acuífero asociado",
  acuifero: "Nombre/clave del acuífero asociado",
  DISP_AG_SU: "Disponibilidad de agua subterránea",
  disp_ag_su: "Disponibilidad de agua subterránea",
  VOL_EXTR: "Volumen de extracción de agua subterránea",
  vol_extr: "Volumen de extracción de agua subterránea",
  REC_ACUIF: "Recarga del acuífero",
  rec_acuif: "Recarga del acuífero",
  CAPT_CO2: "Capacidad/Captura de CO2",
  capt_co2: "Capacidad/Captura de CO2",
  GRADO_CONS: "Grado de conservación",
  grado_cons: "Grado de conservación",
  VAL_CONSER: "Valor de conservación",
  val_conser: "Valor de conservación",
  FRAG_ECOL: "Fragmentación ecológica",
  frag_ecol: "Fragmentación ecológica",
  USO_CONDIC: "Uso condicionado",
  uso_condic: "Uso condicionado",
  USO_INCOMP: "Uso incompatible",
  USO_INCOM2: "Uso incompatible",
  USO_INCOMP2: "Uso incompatible",
  uso_incomp: "Uso incompatible",
  uso_incom2: "Uso incompatible",
  uso_incomp2: "Uso incompatible",
  NOMBRE_ANP: "Nombre del área natural protegida",
  nombre_anp: "Nombre del área natural protegida",
  POLITICA: "Política",
  Politica: "Política",
  politica: "Política",
  REGION: "Región",
  Region: "Región",
  region: "Región",
  NOM_MUN: "Municipio",
  nom_mun: "Municipio",
  NOM_ENT: "Entidad",
  nom_ent: "Entidad",
  POBMUN: "Población municipal",
  pobmun: "Población municipal",
  POBFEM: "Mujeres",
  pobfem: "Mujeres",
  POBMAS: "Hombres",
  pobmas: "Hombres",
  POB_ESTATA: "Población estatal",
  pob_estata: "Población estatal",
  POBMETRO: "Población metropolitana",
  pobmetro: "Población metropolitana",
  pmd: "PMD",
  pmdu: "PMDU",
  fech: "Fecha",
  fechpmd: "Fecha PMD",
  fechatlas: "Fecha Atlas",
  linkpmdu: "Liga PMDU",
  linkpmd: "Liga PMD",
  linkatlas: "Liga Atlas",
  atlas: "Atlas de Riesgos",
  "atlas de riesgos": "Atlas de Riesgos",
  nom_link_p: "Documento PMDU",
  nom_link_1: "Documento PMD",
  nom_link_a: "Documento Atlas",
  clave: "Clave",
  nombre: "Nombre",
  municipio: "Municipio",
  nivel: "Nivel",
  sitio: "Sitio",
};

const HA_FIELDS = new Set(["PREF_FOR_H", "FORESTAL_H", "AGUA_HA"]);
const UNIT_SUFFIX_MAP = {
  DISP_AG_SU: "hm3/año",
  VOL_EXTR: "hm3/año",
  CAPT_CO2: "CO2/año",
};

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function asNumber(value) {
  return typeof value === "number" ? value : Number(value);
}

export function formatNumber(value) {
  const number = asNumber(value);
  return Number.isFinite(number) ? number.toLocaleString("es-MX") : DASH;
}

export function formatAreaKm2(value) {
  const number = asNumber(value);
  return Number.isFinite(number) ? `${number.toFixed(3)} km²` : DASH;
}

export function formatHectares(value) {
  const number = asNumber(value);
  return Number.isFinite(number)
    ? `${number.toLocaleString("es-MX", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ha`
    : DASH;
}

export function formatValue(fieldName, value) {
  if (value == null || value === "") return DASH;

  if (/^https?:\/\//i.test(String(value))) {
    const url = escapeHtml(value);
    return `<a href="${url}" target="_blank" rel="noreferrer">${url}</a>`;
  }

  if (/^(SUPERFICIE|Superficie)$/i.test(fieldName)) return escapeHtml(formatHectares(value));
  if (HA_FIELDS.has(fieldName)) return escapeHtml(formatHectares(value));

  const unit = UNIT_SUFFIX_MAP[fieldName];
  if (unit) {
    const number = asNumber(value);
    if (Number.isFinite(number)) {
      return escapeHtml(`${number.toLocaleString("es-MX", { maximumFractionDigits: 3 })} ${unit}`);
    }
    return escapeHtml(`${value} ${unit}`.trim());
  }

  if (typeof value === "number") return escapeHtml(formatNumber(value));
  return escapeHtml(value);
}

export function formatLabel(fieldName) {
  if (DISPLAY_ALIASES[fieldName]) return DISPLAY_ALIASES[fieldName];
  return String(fieldName)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function buildRows(properties, options = {}) {
  const omit = new Set(options.omit || []);
  return Object.entries(properties || {})
    .filter(([key, value]) => !omit.has(key) && value != null && value !== "")
    .map(([key, value]) => ({
      label: formatLabel(key),
      value: formatValue(key, value),
    }));
}

export function renderRows(rows) {
  return rows
    .filter((row) => row?.value && row.value !== DASH)
    .map((row) => `<div><b>${escapeHtml(row.label)}:</b> ${row.value}</div>`)
    .join("");
}

export function renderSectionTitle(title) {
  if (!title) return "";
  return `<div class="PopupT">${escapeHtml(title)}</div>`;
}

export function renderSectionSubtitle(title) {
  if (!title) return "";
  return `<div class="PopupSubT"><b>${escapeHtml(title)}</b></div>`;
}

export function firstDefined(...values) {
  return values.find((value) => value != null && value !== "");
}
