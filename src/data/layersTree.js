import { buildHybridLayersTree, buildLayerMigrationTable } from "./layerCatalog";
import { HIDALGO_TREE } from "./layersTree/hidalgoTree";
import { INSTRUMENTOS_TREE } from "./layersTree/instrumentosTree";
import { ZONAS_METROPOLITANAS_TREE } from "./layersTree/zonasMetropolitanasTree";

export const RAW_LAYERS_TREE = [HIDALGO_TREE, INSTRUMENTOS_TREE, ZONAS_METROPOLITANAS_TREE];

export const LAYERS_TREE = buildHybridLayersTree(RAW_LAYERS_TREE);
export const LAYER_MIGRATION_TABLE = buildLayerMigrationTable(LAYERS_TREE);
