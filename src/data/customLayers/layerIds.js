import { GEOJSON_REGISTRY } from "../geojson";

export const IDS_PACHUCA = ["SUCLargoP", "SULargoP", "SUMedianoP", "SUCMedianoP"];

export const IDS_TIZAYUCA = [
  "AgriTec", "AgriInd", "CRA", "CUMBD", "CUMMD", "CAGUA", "EUrb",
  "HDA_Unifamiliar", "HDB_Unifamiliar", "HDM_Unifamiliar", "HDMA_Unifamiliar", "HDMB_Unifamiliar",
  "HDMA_MdTC", "HDmA2", "HDmB_Uni", "IBI", "IGI", "IMI", "IUrb", "mixto", "ParqueHid", "RTF",
];

export const IDS_VILLA = [
  "Villa_TUA", "Villa_agroindustria", "Villa_areaAgri", "Villa_golf", "Villa_declaratoria",
  "Villa_equipamiento", "Villa_habitacional", "Villa_parAcu", "Villa_parTer",
  "Villa_PLATAH", "Villa_servicios", "Villa_mixto", "Villa_ZAV", "Villa_ZPE",
];

export const IDS_MR = [
  "MR_EVP", "MR_CUM", "MR_CS", "MR_EI", "MR_ER", "MR_EVA",
  "MR_H05", "MR_H1", "MR_H2", "MR_H3", "MR_H4", "MR_H5", "MR_H6", "MR_H7",
  "MR_ILNC", "MR_PA", "MR_PPDU", "MR_PAT", "MR_PEF", "MR_PPI",
  "MR_Reserva", "MR_Servicios", "MR_SUM", "MR_ZSEH", "MR_ZSERPCE",
];

Object.assign(GEOJSON_REGISTRY, {
  "Habitacional_Densidad_Mínima_Epazoyucan": GEOJSON_REGISTRY.EPA_HD1,
  "Habitacional_Densidad_Baja_Epazoyucan": GEOJSON_REGISTRY.EPA_HD2,
  "Habitacional_Densidad_Media_Epazoyucan": GEOJSON_REGISTRY.EPA_HD3,
  "comercio_y_servicios_densidad_minima_Epazoyucan": GEOJSON_REGISTRY.EPA_CSD1,
  "comercio_y_servicios_densidad_baja_Epazoyucan": GEOJSON_REGISTRY.EPA_CSD2,
  "comercio_y_servicios_densidad_media_Epazoyucan": GEOJSON_REGISTRY.EPA_CSD3,
  "Industria_Ligera_Epazoyucan": GEOJSON_REGISTRY.EPA_IL,
  agroindustria_Epazoyucan: GEOJSON_REGISTRY.EPA_AG,
  "Equipamiento_Publico_Epazoyucan": GEOJSON_REGISTRY.EPA_EQ,
  "Equipamiento_Privado_Epazoyucan": GEOJSON_REGISTRY.EPA_EQP,
  "poligonoDeActuacion_Epazoyuca_Epazoyucan": GEOJSON_REGISTRY.EPA_PA,
  "Aprovechamiento_Epazoyucan": GEOJSON_REGISTRY.EPA_APROV,
  "Aprovechamiento_conservacion_Epazoyucan": GEOJSON_REGISTRY.EPA_APROV_CONS,
  "Aprovechamiento_restauracion_Epazoyucan": GEOJSON_REGISTRY.EPA_APROV_RES,
  "Conservacion_Epazoyuca": GEOJSON_REGISTRY.EPA_CONS,
  "Conservacion_restauracion_Epazoyucan": GEOJSON_REGISTRY.EPA_CONS_RES,
  "Restauracion_Epazoyucan": GEOJSON_REGISTRY.EPA_RES,
  "CP_Epazoyucan": GEOJSON_REGISTRY.EPA_CP_EPAZ,
  "CP_San_Juan_Tizahuapan": GEOJSON_REGISTRY.EPA_CP_SJT,
  "CP_Santa_Mónica": GEOJSON_REGISTRY.EPA_CP_SM,
  "CP_Xochihuacán": GEOJSON_REGISTRY.EPA_CP_XOCHI,
});

export const IDS_EPAZ = [
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
  "Aprovechamiento_Epazoyucan",
  "Aprovechamiento_conservacion_Epazoyucan",
  "Aprovechamiento_restauracion_Epazoyucan",
  "Conservacion_Epazoyuca",
  "Conservacion_restauracion_Epazoyucan",
  "Restauracion_Epazoyucan",
  "CP_Epazoyucan",
  "CP_San_Juan_Tizahuapan",
  "CP_Santa_Mónica",
  "CP_Xochihuacán",
];

Object.assign(GEOJSON_REGISTRY, {
  "Habitacional_Densidad_Mínima_Cuautepec": GEOJSON_REGISTRY.CUA_HD1,
  "Habitacional_Densidad_Baja_Cuautepec": GEOJSON_REGISTRY.CUA_HD2,
  "comercio_y_servicios_densidad_minima_Cuautepec": GEOJSON_REGISTRY.CUA_CSD1,
  "comercio_y_servicios_densidad_baja_Cuautepec": GEOJSON_REGISTRY.CUA_CSD2,
  "comercio_y_servicios_densidad_media_Cuautepec": GEOJSON_REGISTRY.CUA_CSD3,
  "Equipamiento_Publico_Cuautepec": GEOJSON_REGISTRY.CUA_EQ,
  "Aprovechamiento_Cuautepec": GEOJSON_REGISTRY.CUA_APROV,
  "Aprovechamiento_conservacion_Cuautepec": GEOJSON_REGISTRY.CUA_APROV_CONS,
  "Aprovechamiento_restauracion_Cuautepec": GEOJSON_REGISTRY.CUA_APROV_RES,
  "Conservacion_Cuautepec": GEOJSON_REGISTRY.CUA_CONS,
  "Conservacion_restauracion_Cuautepec": GEOJSON_REGISTRY.CUA_CONS_RES,
  "Restauracion_Cuautepec": GEOJSON_REGISTRY.CUA_RES,
  "CP_Cuautepec": GEOJSON_REGISTRY.CUA_CP_CUAUTEPEC,
  "CP_Santa_Elena_Paliseca": GEOJSON_REGISTRY.CUA_CP_SANTA_ELENA_PALISECA,
  "CP_San_Lorenzo_Sayula": GEOJSON_REGISTRY.CUA_CP_SAN_LORENZO_SAYULA,
  "CP_Cuautepec_Tecocomulco_JuarezF": GEOJSON_REGISTRY.CUA_CP_TECOCOMULCO_JUAREZF,
});

export const IDS_CUAU = [
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
  "CP_Cuautepec_Tecocomulco_JuarezF",
];

export const IDS_TEPEJI_ZONSEC = [
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

export const IDS_TEPEJI_USO_NO_URB = [
  "Aprovechamiento_Tepeji",
  "Aprovechamiento_Conservacion_Tepeji",
  "Aprovechamiento_Restauracion_Tepeji",
  "Conservacion_Tepeji",
  "Conservacion_Restauracion_Tepeji",
  "Proteccion_Tepeji",
  "Restauracion_Tepeji",
];

export const IDS_TEPEJI_CP = [
  "CP_Tepeji_del_Rio_Tepeji",
  "CP_Melchor_Ocampo_Tepeji",
  "CP_Ojo_de_Agua_Tepeji",
  "CP_San_Buenaventura_Tepeji",
  "CP_San_Ildefonso_Tepeji",
  "CP_Santiago_Tlautla_Tepeji",
  "CP_Santiago_Tlaltepoxco_Tepeji",
  "CP_Zona_Industrial_Tepeji",
];

export const IDS_SANTIAGO_ZONSEC = [
  "HDMinima_SantiagoTLG",
  "HDB_SantiagoTLG",
  "HDMedia_SantiagoTLG",
  "CSDMinima_SantiagoTLG",
  "CSDB_SantiagoTLG",
  "CSDMedia_SantiagoTLG",
  "IL_SantiagoTLG",
  "EP_SantiagoTLG",
  "PA_SantiagoTLG",
];

export const IDS_SANTIAGO_NO_URB = [
  "APROV_SantiagoTLG",
  "APROV_CONS_SantiagoTLG",
  "APROV_RES_SantiagoTLG",
  "CONS_SantiagoTLG",
  "CONS_RES_SantiagoTLG",
  "PROT_SantiagoTLG",
  "RES_SantiagoTLG",
];

export const IDS_SANTIAGO_CP = [
  "CP_Santiago_Tulantepec",
  "CP_El_Pedregal_de_San_Jose",
  "CP_Los_Romeros",
  "CP_Las_Lajas",
  "CP_Emiliano_Zapata",
  "CP_Ventoquipa",
];

export const IDS_SANTIAGO_DEF_LIMITES = ["definicionLimites_SantiagoTLG"];
export const IDS_SANTIAGO_ZA = ["zonaArqueologica_SantiagoTLG"];
