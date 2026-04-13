export const HIDALGO_TREE =   {
    id: "cat_hidalgo",
    name: "Hidalgo",
    layers: [
      {
        id: "hgo_info_gen",
        name: "Info general (municipios)",
        type: "vector",
        geojsonId: "HGO_INFO_GEN",
        hasLegend: false,
        legendKey: "hidalgo",
        legendTitle: "Hidalgo - Info general",
        defaultVisible: true,
        defaultZ: 200,
      },
      {
        id: "esc_priv_ms",
        name: "Escuelas Privadas",
        type: "vector",
        geojsonId: "ESC_PRIV_MS",
        hasLegend: false,
        legendKey: "escuelas_privadas",
        legendTitle: "Escuelas Privadas (media y superior)",
        defaultVisible: false,
        defaultZ: 210,
      },
    ],
  };

