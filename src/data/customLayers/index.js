import { mapFrom } from "./helpers";
import { buildEscPrivLayer, buildInfoHgoLayer, buildMetropolitana, buildZMVM } from "./metroBuilders";
import {
  buildCuautepec,
  buildEpaz,
  buildMineralRef,
  buildPachuca,
  buildSantiago,
  buildTepeji,
  buildTizayuca,
  buildVilla,
} from "./pmduBuilders";
import {
  IDS_CUAU,
  IDS_EPAZ,
  IDS_MR,
  IDS_PACHUCA,
  IDS_SANTIAGO_CP,
  IDS_SANTIAGO_DEF_LIMITES,
  IDS_SANTIAGO_NO_URB,
  IDS_SANTIAGO_ZA,
  IDS_SANTIAGO_ZONSEC,
  IDS_TEPEJI_CP,
  IDS_TEPEJI_USO_NO_URB,
  IDS_TEPEJI_ZONSEC,
  IDS_TIZAYUCA,
  IDS_VILLA,
} from "./layerIds";

export { buildEscPrivLayer, buildInfoHgoLayer };

export const LAYER_BUILDERS = {
  hgo_info_gen: (data, paneId, ld) => buildInfoHgoLayer({ data, paneId, color: "#fff", layerName: ld?.name }),
  esc_priv_ms: (data, paneId, ld) => buildEscPrivLayer({ data, paneId, layerDef: ld }),
  zmvm_info: (data, paneId) => buildZMVM(data, paneId),
  zmpachuca_info: (data, paneId) => buildMetropolitana(data, paneId, "#B6DC76", "transparent", "Zona Metropolitana"),
  zmtula_info: (data, paneId) => buildMetropolitana(data, paneId, "Aqua", "transparent", "Zona Metropolitana"),
  zmtulancingo_info: (data, paneId) => buildMetropolitana(data, paneId, "#241E4E", "transparent", "Zona Metropolitana"),
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
