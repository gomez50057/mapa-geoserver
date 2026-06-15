"use client";
import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import LayerTree from "@/components/LayerTree";
import { LAYERS_TREE } from "@/data/layersTree";
import { filterTreeByQuery } from "@/data/layerSearch";
import { useLayerSelection } from "@/hooks/useLayerSelection";
import styles from "./page.module.css";

const MapView = dynamic(() => import("@/components/map/MapView"), { ssr: false });

export default function MapaPage() {
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
    resetToDefaults,
  } = useLayerSelection(LAYERS_TREE);

  const [layerLoadState, setLayerLoadState] = useState({});
  const [layerSearchQuery, setLayerSearchQuery] = useState("");
  const [focusRequest, setFocusRequest] = useState(null);

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

  const layerSearchState = useMemo(
    () => filterTreeByQuery(LAYERS_TREE, layerSearchQuery),
    [layerSearchQuery]
  );

  const handleToggleLayer = useCallback(
    (layer) => {
      const isTurningOn = !selectedIds.has(layer.id);
      onToggleLayer(layer);

      if (!isTurningOn) return;
      setFocusRequest({
        nonce: Date.now(),
        layerIds: [layer.id],
      });
    },
    [onToggleLayer, selectedIds]
  );

  const handleToggleMany = useCallback(
    (layers, nextOn) => {
      onToggleMany(layers, nextOn);
      if (!nextOn) return;

      const newLayerIds = layers
        .filter((layer) => !selectedIds.has(layer.id))
        .map((layer) => layer.id);

      if (newLayerIds.length === 0) return;
      setFocusRequest({
        nonce: Date.now(),
        layerIds: newLayerIds,
      });
    },
    [onToggleMany, selectedIds]
  );

  return (
    <div className={styles.layout}>
      <Link className={styles.homeLink} href="/" aria-label="Regresar a la página principal">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10.8 4.3 3.1 12l7.7 7.7 1.4-1.4L6.9 13H21v-2H6.9l5.3-5.3-1.4-1.4Z" />
        </svg>
        Inicio
      </Link>

      <LayerTree
        tree={LAYERS_TREE}
        searchQuery={layerSearchQuery}
        selected={selectedIds}
        onToggle={handleToggleLayer}
        onToggleMany={handleToggleMany}
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
        layerSearchQuery={layerSearchQuery}
        onLayerSearchQueryChange={setLayerSearchQuery}
        layerSearchMatchCount={layerSearchState.matchCount}
        layerOpacityMap={opacityMap}
        layerLoadState={layerLoadState}
        loadingSummary={loadingSummary}
        onLayerStatusChange={onLayerStatusChange}
        focusRequest={focusRequest}
        onLayerOpacityChange={setLayerOpacity}
        onManyLayerOpacityChange={setManyLayerOpacity}
        onResetLayers={resetToDefaults}
      />
    </div>
  );
}
