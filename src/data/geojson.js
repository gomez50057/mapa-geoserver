import { HgoInfoGen } from "../capas/Hidalgo/base";
import { escMediaSupPrivada } from "../capas/Hidalgo/educacionHidalgo";
import { ZMPACHUCA_INFO, ZMTULA_INFO, ZMTULANCINGO_INFO, ZMVM_INFO } from "../capas/zonas metropolitanas/info basica/zonasMetro";

// Pachuca (Etapas)
import { SUCLargoP, SULargoP, SUMedianoP, SUCMedianoP } from "@/capas/zonas metropolitanas/info basica/PMDU/pachucaDeSoto/EC_Pachuca";

// Tizayuca (Zonificación Secundaria)
import {
  AgriTec, AgriInd, CRA, CUMBD, CUMMD, CAGUA, EUrb,
  HDA_Unifamiliar, HDB_Unifamiliar, HDM_Unifamiliar,
  HDMA_Unifamiliar, HDMB_Unifamiliar, HDMA_MdTC, HDmA2, HDmB_Uni,
  IBI, IGI, IMI, IUrb, mixto, ParqueHid, RTF
} from "@/capas/zonas metropolitanas/info basica/PMDU/tizayuca/zonSecTizayuca";

// Villa Tezontepec (Zonificación Secundaria)
import {
  Villa_TUA, Villa_agroindustria, Villa_areaAgri, Villa_golf, Villa_declaratoria,
  Villa_equipamiento, Villa_habitacional, Villa_parAcu, Villa_parTer,
  Villa_PLATAH, Villa_servicios, Villa_mixto, Villa_ZAV, Villa_ZPE
} from "@/capas/zonas metropolitanas/info basica/PMDU/villaDeTezontepec/zonSecVillaTezontepec";

// Mineral de la Reforma (Zonificación Secundaria)
import {
  MR_EVP, MR_CUM, MR_CS, MR_EI, MR_ER, MR_EVA,
  MR_H05, MR_H1, MR_H2, MR_H3, MR_H4, MR_H5, MR_H6, MR_H7,
  MR_ILNC, MR_PA, MR_PPDU, MR_PAT, MR_PEF, MR_PPI,
  // MR_Puente_bimodal, MR_Puente_multimodal,
  MR_Reserva, MR_Servicios, MR_SUM, MR_ZSEH, MR_ZSERPCE
} from "@/capas/zonas metropolitanas/info basica/PMDU/mineralDeLaReforma/zonSecMR";

// Epazoyucan (Zonificación secundaria)
import {
  CP_Epazoyucan as EPA_CP_EPAZ_DATA,
  CP_San_Juan_Tizahuapan as EPA_CP_SJT_DATA,
  CP_Santa_Mónica as EPA_CP_SM_DATA,
  CP_Xochihuacán as EPA_CP_XOCHI_DATA
} from "@/capas/zonas metropolitanas/info basica/PMDU/epazoyucan/centrosdePoblacion/CP_Epazoyuca";

import {
  Aprovechamiento_Epazoyucan as EPA_APROV_DATA,
  Aprovechamiento_conservacion_Epazoyucan as EPA_APROV_CONS_DATA,
  Aprovechamiento_restauracion_Epazoyuca as EPA_APROV_RES_DATA,
  Conservacion_Epazoyuca as EPA_CONS_DATA,
  Conservacion_restauracion_Epazoyuca as EPA_CONS_RES_DATA,
  Restauracion_Epazoyuca as EPA_RES_DATA,
} from "@/capas/zonas metropolitanas/info basica/PMDU/epazoyucan/sueloNoUrbanizable/SNU_Epazoyuca";

import {
  agroindustria_Epazoyucan as EPA_AG,
  comercio_y_servicios_densidad_minima_Epazoyucan as EPA_CSD1_DATA,
  comercio_y_servicios_densidad_baja_Epazoyucan as EPA_CSD2_DATA,
  comercio_y_servicios_densidad_media_Epazoyucan as EPA_CSD3_DATA,
  Equipamiento_Publico_Epazoyucan as EPA_EQ_DATA,
  Equipamiento_Privado_Epazoyucan as EPA_EQP_DATA,
  Habitacional_Densidad_Mínima_Epazoyucan as EPA_HD1_DATA,
  Habitacional_Densidad_Baja_Epazoyucan as EPA_HD2_DATA,
  Habitacional_Densidad_Media_Epazoyucan as EPA_HD3_DATA,
  Industria_Ligera_Epazoyucan as EPA_IL_DATA,
  poligonoDeActuacion_Epazoyuca_Epazoyucan as EPA_PA_DATA,
} from "@/capas/zonas metropolitanas/info basica/PMDU/epazoyucan/zonificacion/zon_Epazoyuca";


// Cuautepec de Hinojosa 
// Centros de Población
import {
  CP_Cuautepec as CUA_CP_CUAUTEPEC_DATA,
  CP_San_Lorenzo_Sayula as CUA_CP_SAN_LORENZO_SAYULA_DATA,
  CP_Santa_Elena_Paliseca as CUA_CP_SANTA_ELENA_PALISECA_DATA,
  CP_Cuautepec_Tecocomulco_JuarezF as CUA_CP_TECOCOMULCO_JUAREZF_DATA
} from "@/capas/zonas metropolitanas/info basica/PMDU/cuautepecDeHinojosa/centrosdePoblacion/CP_Cuautepec";

// Zonificación Secundaria
import {
  HD1 as CUA_HD1_DATA,
  HD2 as CUA_HD2_DATA,
  CSD1 as CUA_CSD1_DATA,
  CSD2 as CUA_CSD2_DATA,
  CSD3 as CUA_CSD3_DATA,
  EQ as CUA_EQ_DATA,
  // drenPluvial_Cuautepec // si lo usas, impórtalo aquí
} from "@/capas/zonas metropolitanas/info basica/PMDU/cuautepecDeHinojosa/zonificacion/zon_Cuautepec";

// Uso no Urbano
import {
  APROV_Cuautepec as CUA_APROV_DATA,
  APROV_CONS_Cuautepec as CUA_APROV_CONS_DATA,
  APROV_RES_Cuautepec as CUA_APROV_RES_DATA,
  CONS_Cuautepec as CUA_CONS_DATA,
  CONS_RES_Cuautepec as CUA_CONS_RES_DATA,
  RES_Cuautepec as CUA_RES_DATA
} from "@/capas/zonas metropolitanas/info basica/PMDU/cuautepecDeHinojosa/sueloNoUrbanizable/SNU_Cuautepec";


// ====== Tepeji del Río de Ocampo ======
// Zonificación Secundaria 
import {
  CentroBarrio_Tepeji,
  CentroUrbano_Tepeji,
  CCSAI_Tepeji,
  CCSBI_Tepeji,
  CCSMI_Tepeji,
  HAD_Tepeji,
  HBD_Tepeji,
  HMD_Tepeji,
  IndustriaLigera_Tepeji,
  IndustriaMediana_Tepeji,
  IndustriaPesada_Tepeji,
  SubcentroUrbano_Tepeji,
} from '@/capas/zonas metropolitanas/info basica/PMDU/tepejiDelRioDeOcampo/zonificacion/zon_Tepeji';

// Uso no Urbano
import {
  RES_Tepeji,
  APROV_Tepeji,
  APROV_CONS__Tepeji,
  APROV_RES__Tepeji,
  CONS_Tepeji,
  CONS_REST_Tepeji,
  Proteccion_Tepeji,
} from "@/capas/zonas metropolitanas/info basica/PMDU/tepejiDelRioDeOcampo/sueloNoUrbanizable/SNU_Tepeji";

// Centro de Población
import {
  CP_San_Buenaventura,
  CP_San_Ildefonso,
  CP_Santiago_Tlaltepoxco,
  CP_Santiago_Tlautla,
  CP_Tepeji_del_Rio,
  CP_Zona_Industrial,
  CP_Melchor_Ocampo,
  CP_Ojo_de_Agua,
} from "@/capas/zonas metropolitanas/info basica/PMDU/tepejiDelRioDeOcampo/centrosdePoblacion/CP_Tepeji";

// ====== Santiago de Tulantepec de Lugo Guerrero ======
// Zonificación Secundaria
import {
  CSDB_SantiagoTLG,
  CSDMedia_SantiagoTLG,
  CSDMinima_SantiagoTLG,
  EP_SantiagoTLG,
  HDB_SantiagoTLG,
  HDMedia_SantiagoTLG,
  HDMinima_SantiagoTLG,
  IL_SantiagoTLG,
  PA_SantiagoTLG,
} from "@/capas/zonas metropolitanas/info basica/PMDU/santiagoTulantepecDeLugoGuerrero/zonificacion/zon_SantiagoTLG";

// Uso no Urbano
import {
  RES_SantiagoTLG,
  PROT_SantiagoTLG,
  CONS_RES_SantiagoTLG,
  CONS_SantiagoTLG,
  APROV_RES_SantiagoTLG,
  APROV_CONS_SantiagoTLG,
  APROV_SantiagoTLG,
} from "@/capas/zonas metropolitanas/info basica/PMDU/santiagoTulantepecDeLugoGuerrero/sueloNoUrbanizable/SNU_SantiagoTLG";

// Centro de Población
import {
  CP_Ventoquipa,
  CP_Santiago_Tulantepec,
  CP_Los_Romeros,
  CP_Las_Lajas,
  CP_Emiliano_Zapata,
  CP_El_Pedregal_de_San_Jose,
} from "@/capas/zonas metropolitanas/info basica/PMDU/santiagoTulantepecDeLugoGuerrero/centrosdePoblacion/CP_SantiagoTLG";

// Definición de Límites
import { definicionLimites } from "@/capas/zonas metropolitanas/info basica/PMDU/santiagoTulantepecDeLugoGuerrero/definicionLimites/definicionLimites_SantiagoTLG";

// Zona Arqueológica
import { zonaArqueologica } from "@/capas/zonas metropolitanas/info basica/PMDU/santiagoTulantepecDeLugoGuerrero/zonaArqueologica/zonaArqueologica_SantiagoTLG";


export const GEOJSON_REGISTRY = {
  HGO_INFO_GEN: HgoInfoGen,
  ESC_PRIV_MS: escMediaSupPrivada,

  ZMVM_INFO: ZMVM_INFO,
  ZMPACHUCA_INFO: ZMPACHUCA_INFO,
  ZMTULA_INFO: ZMTULA_INFO,
  ZMTULANCINGO_INFO: ZMTULANCINGO_INFO,


  /* Pachuca */
  SUCLargoP, SULargoP, SUMedianoP, SUCMedianoP,

  /* Tizayuca */
  AgriTec, AgriInd, CRA, CUMBD, CUMMD, CAGUA, EUrb,
  HDA_Unifamiliar, HDB_Unifamiliar, HDM_Unifamiliar,
  HDMA_Unifamiliar, HDMB_Unifamiliar, HDMA_MdTC, HDmA2, HDmB_Uni,
  IBI, IGI, IMI, IUrb, mixto, ParqueHid, RTF,

  /* Villa Tezontepec */
  Villa_TUA, Villa_agroindustria, Villa_areaAgri, Villa_golf, Villa_declaratoria,
  Villa_equipamiento, Villa_habitacional, Villa_parAcu, Villa_parTer,
  Villa_PLATAH, Villa_servicios, Villa_mixto, Villa_ZAV, Villa_ZPE,

  /* Mineral de la Reforma */
  MR_EVP, MR_CUM, MR_CS, MR_EI, MR_ER, MR_EVA,
  MR_H05, MR_H1, MR_H2, MR_H3, MR_H4, MR_H5, MR_H6, MR_H7,
  MR_ILNC, MR_PA, MR_PPDU, MR_PAT, MR_PEF, MR_PPI,
  // MR_Puente_bimodal, MR_Puente_multimodal,
  MR_Reserva, MR_Servicios, MR_SUM, MR_ZSEH, MR_ZSERPCE,

  /* Epazoyucan */
  // Zonificación Secundaria
  EPA_HD1: EPA_HD1_DATA,
  EPA_HD2: EPA_HD2_DATA,
  EPA_HD3: EPA_HD3_DATA,
  EPA_CSD1: EPA_CSD1_DATA,
  EPA_CSD2: EPA_CSD2_DATA,
  EPA_CSD3: EPA_CSD3_DATA,
  EPA_IL: EPA_IL_DATA,
  EPA_AG: EPA_AG,
  EPA_EQ: EPA_EQ_DATA,
  EPA_EQP: EPA_EQP_DATA,
  EPA_PA: EPA_PA_DATA,

  // Uso no Urbano
  EPA_APROV: EPA_APROV_DATA,
  EPA_APROV_CONS: EPA_APROV_CONS_DATA,
  EPA_APROV_RES: EPA_APROV_RES_DATA,
  EPA_CONS: EPA_CONS_DATA,
  EPA_CONS_RES: EPA_CONS_RES_DATA,
  EPA_RES: EPA_RES_DATA,

  // Centro de Población
  EPA_CP_EPAZ: EPA_CP_EPAZ_DATA,
  EPA_CP_SJT: EPA_CP_SJT_DATA,
  EPA_CP_SM: EPA_CP_SM_DATA,
  EPA_CP_XOCHI: EPA_CP_XOCHI_DATA,

  /* Cuautepec de Hinojosa */
  // Zonificación Secundaria
  CUA_HD1: CUA_HD1_DATA,
  CUA_HD2: CUA_HD2_DATA,
  CUA_CSD1: CUA_CSD1_DATA,
  CUA_CSD2: CUA_CSD2_DATA,
  CUA_CSD3: CUA_CSD3_DATA,
  CUA_EQ: CUA_EQ_DATA,

  // Uso no Urbano
  CUA_APROV: CUA_APROV_DATA,
  CUA_APROV_CONS: CUA_APROV_CONS_DATA,
  CUA_APROV_RES: CUA_APROV_RES_DATA,
  CUA_CONS: CUA_CONS_DATA,
  CUA_CONS_RES: CUA_CONS_RES_DATA,
  CUA_RES: CUA_RES_DATA,

  // Centro de Población
  CUA_CP_CUAUTEPEC: CUA_CP_CUAUTEPEC_DATA,
  CUA_CP_SANTA_ELENA_PALISECA: CUA_CP_SANTA_ELENA_PALISECA_DATA,
  CUA_CP_SAN_LORENZO_SAYULA: CUA_CP_SAN_LORENZO_SAYULA_DATA,
  CUA_CP_TECOCOMULCO_JUAREZF: CUA_CP_TECOCOMULCO_JUAREZF_DATA,

  /* Cuautepec de Hinojosa */
  // Zonificación Secundaria
  CentroBarrio_Tepeji,
  CentroUrbano_Tepeji,
  CCSAI_Tepeji,
  CCSBI_Tepeji,
  CCSMI_Tepeji,
  HAD_Tepeji,
  HBD_Tepeji,
  HMD_Tepeji,
  IndustriaLigera_Tepeji,
  IndustriaMediana_Tepeji,
  IndustriaPesada_Tepeji,
  SubcentroUrbano_Tepeji,

  // Uso no Urbano
  RES_Tepeji,
  APROV_Tepeji,
  APROV_CONS__Tepeji,
  APROV_RES__Tepeji,
  CONS_Tepeji,
  CONS_REST_Tepeji,
  Proteccion_Tepeji,

  // Centros de Población
  CP_San_Buenaventura,
  CP_San_Ildefonso,
  CP_Santiago_Tlaltepoxco,
  CP_Santiago_Tlautla,
  CP_Tepeji_del_Rio,
  CP_Zona_Industrial,
  CP_Melchor_Ocampo,
  CP_Ojo_de_Agua,

  /* ====== Santiago de Tulantepec de Lugo Guerrero ====== */
  // Zonificación Secundaria
  CSDB_SantiagoTLG,
  CSDMedia_SantiagoTLG,
  CSDMinima_SantiagoTLG,
  EP_SantiagoTLG,
  HDB_SantiagoTLG,
  HDMedia_SantiagoTLG,
  HDMinima_SantiagoTLG,
  IL_SantiagoTLG,
  PA_SantiagoTLG,

  // Uso no Urbano
  RES_SantiagoTLG,
  PROT_SantiagoTLG,
  CONS_RES_SantiagoTLG,
  CONS_SantiagoTLG,
  APROV_RES_SantiagoTLG,
  APROV_CONS_SantiagoTLG,
  APROV_SantiagoTLG,

  // Centros de Población
  CP_Ventoquipa,
  CP_Santiago_Tulantepec,
  CP_Los_Romeros,
  CP_Las_Lajas,
  CP_Emiliano_Zapata,
  CP_El_Pedregal_de_San_Jose,

  // Definición de Límites (alias registrable)
  definicionLimites_SantiagoTLG: definicionLimites,

  // Zona Arqueológica (alias registrable)
  zonaArqueologica_SantiagoTLG: zonaArqueologica,

};
