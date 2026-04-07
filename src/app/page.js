"use client";
import { useCallback, useMemo, useState } from "react";
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
    opacityMap,
    setLayerOpacity,
    setManyLayerOpacity,
  } = useLayerSelection(LAYERS_TREE);

  const [layerLoadState, setLayerLoadState] = useState({});

  const onLayerStatusChange = useCallback((layerId, nextState) => {
    setLayerLoadState((previous) => {
      const current = previous[layerId];
      const next = {
        status: nextState?.status || "idle",
        message: nextState?.message || "",
        updatedAt: Date.now(),
      };

      if (
        current?.status === next.status &&
        current?.message === next.message
      ) {
        return previous;
      }

      return {
        ...previous,
        [layerId]: next,
      };
    });
  }, []);

  const loadingSummary = useMemo(() => {
    const total = selectedLayers.length;
    const counts = selectedLayers.reduce(
      (acc, layer) => {
        const status = layerLoadState[layer.id]?.status || "idle";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      { idle: 0, loading: 0, ready: 0, error: 0 }
    );

    const pending = (counts.loading || 0) + (counts.idle || 0);

    return {
      total,
      ready: counts.ready || 0,
      loading: counts.loading || 0,
      error: counts.error || 0,
      idle: counts.idle || 0,
      pending,
      isBusy: pending > 0,
    };
  }, [layerLoadState, selectedLayers]);

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
        layerLoadState={layerLoadState}
        loadingSummary={loadingSummary}
      />

      <MapView
        selectedLayers={selectedLayers}
        zMap={zMap}
        legends={legendList}
        layerOpacityMap={opacityMap}
        layerLoadState={layerLoadState}
        loadingSummary={loadingSummary}
        onLayerStatusChange={onLayerStatusChange}
        onLayerOpacityChange={setLayerOpacity}
        onManyLayerOpacityChange={setManyLayerOpacity}
      />
    </div>
  );
}
