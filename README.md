# Next Maps MVP (Leaflet + GeoServer)

## Requisitos
- Node 18+
- PNPM/NPM/Yarn (usa uno)

## Instalación
```bash
npm i
npm run dev
```
Abre http://localhost:3000

## Variables de entorno
```bash
NEXT_PUBLIC_GEOSERVER_WMS_URL=/api/geoserver/wms
NEXT_PUBLIC_GEOSERVER_WFS_URL=/api/geoserver/wfs
NEXT_PUBLIC_GEOSERVER_WORKSPACE=mapa
NEXT_PUBLIC_ENABLE_LOCAL_LAYER_FALLBACK=false
GEOSERVER_REMOTE_WMS_URL=https://metropoli.hidalgo.gob.mx/geoserver/mapa/wms
GEOSERVER_REMOTE_WFS_URL=https://metropoli.hidalgo.gob.mx/geoserver/mapa/wfs
```

## Qué incluye
- Árbol de capas (hasta 4 niveles) con hojas seleccionables.
- Catálogo híbrido en frontend: grupos y UX locales, metadata técnica lista para GeoServer.
- Render principal por WMS y consultas de atributos por `GetFeatureInfo` / WFS.
- Orden frente/atrás por zIndex (defaultZ mayor = arriba). Controles ▲ ▼ por hoja.
- LegendDock en esquina inferior derecha con catálogo de leyendas desacoplado.
- Hook de estado para selección, z-order y leyendas.
- Compatibilidad temporal con capas legacy vía carga diferida.

## Archivos clave
- `src/data/layersTree.js`: árbol visible + catálogo híbrido generado.
- `src/data/layerBehaviors.js`: contrato declarativo de comportamiento por capa.
- `src/data/layerMigrationTable.js`: tabla maestra `layer id -> workspace -> layerName -> style -> popup schema -> estado`.
- `src/lib/geoserver/client.js`: cliente WMS/WFS/GetFeatureInfo.
- `src/lib/geoserver/interaction.js`: resolución de clic/hover sobre capas.
- `src/lib/geoserver/runtime.js`: bounds y utilidades de runtime del mapa.
- `src/data/popupSchemas.js`: render declarativo de popups.
- `src/hooks/useLayerSelection.js`: estado de selección, leyendas y z-order.

## Arquitectura recomendada
- `WMS` como render principal para la mayoría de las capas.
- `GetFeatureInfo` como consulta principal para popup.
- `WFS` solo como fallback controlado o para casos especiales.
- GeoServer como fuente de estilo y publicación; frontend como orquestador de UX.

## Cómo agregar una capa nueva
1. Publica la capa en GeoServer y confirma `workspace:layerName`.
2. Agrega la capa al árbol en `src/data/layersTree.js`.
3. Si el nombre técnico no coincide con el `id`, declara el override en `src/data/layerBehaviors.js`.
4. Si requiere popup especial, asigna o crea `popupSchema`.
5. Si requiere comportamiento distinto de clic/hover/bounds, ajusta solo `layerBehaviors.js`.
