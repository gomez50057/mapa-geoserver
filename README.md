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
- `src/data/layersTree.js`: fachada estable del árbol visible + catálogo híbrido generado.
- `src/data/layersTree/`: bloques del árbol por dominio (`Hidalgo`, `Instrumentos`, `Zonas metropolitanas`).
- `src/data/layerSchema.js`: fuente declarativa para nombre técnico, popup, comportamiento y overrides por capa.
- `src/data/layerBehaviors.js`: fachada estable del comportamiento declarativo por capa.
- `src/data/layerMigrationTable.js`: tabla maestra `layer id -> workspace -> layerName -> style -> popup schema -> estado`.
- `src/lib/geoserver/client.js`: cliente WMS/WFS/GetFeatureInfo.
- `src/lib/geoserver/interaction.js`: resolución de clic/hover sobre capas.
- `src/lib/geoserver/runtime.js`: bounds y utilidades de runtime del mapa.
- `src/data/popupSchemas.js`: fachada estable del render declarativo de popups.
- `src/data/popupSchemas/`: esquemas de popup por dominio.
- `src/data/customLayers/`: builders especiales por familia de capa.
- `src/hooks/useLayerSelection.js`: estado de selección, leyendas y z-order.

## Arquitectura recomendada
- `WMS` como render principal para la mayoría de las capas.
- `GetFeatureInfo` como consulta principal para popup.
- `WFS` solo como fallback controlado o para casos especiales.
- GeoServer como fuente de estilo y publicación; frontend como orquestador de UX.

## Cómo agregar una capa nueva
La integración nueva está pensada para tocar lo mínimo y de forma declarativa. En la mayoría de los casos basta con árbol + esquema.

1. Publica la capa en GeoServer y confirma `workspace:layerName`, estilo y tipo de geometría.
2. Agrega la capa en el módulo del árbol que corresponda dentro de `src/data/layersTree/`:
   - `hidalgoTree.js`
   - `instrumentosTree.js`
   - `zonasMetropolitanasTree.js`
3. Define `id`, nombre visible, grupo, `legendKey`, `defaultVisible`, `defaultZ` y metadata UX dentro de ese bloque.
3. Si la capa necesita un nombre técnico distinto al `id`, un `popupSchema` especial, un comportamiento diferente o un override visual, decláralo en `src/data/layerSchema.js`.
4. Si el popup no encaja con los ya existentes, crea o ajusta el esquema en `src/data/popupSchemas/` y asígnalo desde `layerSchema.js`.
5. Solo si la capa requiere un render especial que no puede resolverse con WMS + popup declarativo, agrega un builder específico en `src/data/customLayers/`.

### Flujo recomendado
- `layersTree/`: define dónde aparece la capa y en qué dominio vive.
- `layersTree.js`: ensambla el árbol completo sin que tengas que tocar imports en el resto de la app.
- `layerSchema.js`: define cómo se conecta y cómo se comporta.
- `popupSchemas/`: define qué información muestra.
- `customLayers/`: úsalo únicamente para casos especiales.

### Regla práctica
- Capa estándar: toca el módulo correcto dentro de `layersTree/` y, si hace falta, `layerSchema.js`.
- Capa con popup especial: añade `popupSchemas/`.
- Capa con lógica visual excepcional: añade `customLayers/`.

### Ejemplo de mantenimiento sano
- Capa de Hidalgo: agrégala en `src/data/layersTree/hidalgoTree.js`.
- Capa PMDU o instrumento: agrégala en `src/data/layersTree/instrumentosTree.js`.
- Capa metropolitana: agrégala en `src/data/layersTree/zonasMetropolitanasTree.js`.