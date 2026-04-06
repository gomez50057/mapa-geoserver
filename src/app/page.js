"use client";
import dynamic from "next/dynamic";
import LayerTree from "@/components/LayerTree";
import { LAYERS_TREE } from "@/data/layersTree";
import { useLayerSelection } from "@/hooks/useLayerSelection";
import styles from "./page.module.css";

const MapView = dynamic(() => import("@/components/map/MapView"), { ssr: false });

export default function Home() {
  const {
    selectedIds,
    selectedLayers,
    zMap,
    legendList,
    onToggleLayer,
    onToggleMany,
    bumpZ,
    moveTop,
    moveBottom,
    setZExact,
  } = useLayerSelection(LAYERS_TREE);

  return (
    <div className={styles.layout}>
      <LayerTree
        tree={LAYERS_TREE}
        selected={selectedIds}
        onToggle={onToggleLayer}
        onToggleMany={onToggleMany}
        onZUp={(id, fast) => bumpZ(id, fast ? 500 : 100)}
        onZDown={(id, fast) => bumpZ(id, fast ? -500 : -100)}
        onZTop={moveTop}
        onZBottom={moveBottom}
        onZSet={setZExact}
        zMap={zMap}
      />

      <MapView selectedLayers={selectedLayers} zMap={zMap} legends={legendList} />
    </div>
  );
}
