import { renderDefault } from "./helpers";
import { renderEscuelaPrivada, renderHidalgoInfo, renderZonaMetropolitana } from "./metroSchemas";
import { renderPachucaEtapas, renderPmduGeneric } from "./pmduSchemas";

export const POPUP_SCHEMAS = {
  default: renderDefault,
  hidalgoInfo: renderHidalgoInfo,
  zonaMetropolitana: renderZonaMetropolitana,
  escuelaPrivada: renderEscuelaPrivada,
  pachucaEtapas: renderPachucaEtapas,
  pmduGeneric: renderPmduGeneric,
};

export function renderPopupContent(popupSchema, properties, layerDef) {
  const renderer = POPUP_SCHEMAS[popupSchema] || POPUP_SCHEMAS.default;
  return renderer(properties || {}, layerDef);
}
