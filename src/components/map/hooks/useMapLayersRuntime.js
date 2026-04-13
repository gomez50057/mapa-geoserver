import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GEOSERVER_CONFIG } from "@/config/geoserver";
import { createWmsLayer } from "@/lib/geoserver/client";
import { extendUnionBounds, resolveLayerBounds } from "@/lib/geoserver/runtime";
import { loadLegacyLocalLayer } from "@/lib/geoserver/legacyLocalLayers";

function clampZ(z) {
  return Math.max(-9999, Math.min(9999, Math.round(Number(z ?? 400))));
}

function boundsFromConfig(bounds) {
  if (!Array.isArray(bounds) || bounds.length !== 2) return null;
  return L.latLngBounds(bounds[0], bounds[1]);
}

function getLayerZ(layerDef, zMap) {
  return zMap?.[layerDef.id] ?? layerDef.defaultZ ?? 400;
}

function getLayerOpacity(layerDef, layerOpacityMap) {
  const raw = layerOpacityMap?.[layerDef.id];
  if (raw == null) return 1;
  return Math.max(0, Math.min(1, Number(raw)));
}

function ensurePane(map, paneRegistryRef, paneId, z) {
  let pane = map.getPane(paneId);
  if (!pane) pane = map.createPane(paneId);
  pane.style.zIndex = String(clampZ(z));
  const parent = pane.parentNode;
  if (parent) parent.appendChild(pane);
  paneRegistryRef.current[paneId] = true;
  return pane;
}

function ensureTilePane(map, paneRegistryRef, layerId, z) {
  const paneId = `pane_tile_${layerId}`;
  ensurePane(map, paneRegistryRef, paneId, z);
  return paneId;
}

function applyLayerOpacity(layer, opacity) {
  if (!layer) return;
  if (typeof layer.setOpacity === "function") {
    layer.setOpacity(opacity);
    return;
  }

  if (typeof layer.setStyle === "function") {
    layer.setStyle({ opacity, fillOpacity: Math.min(opacity, 1) * 0.6 });
    return;
  }

  if (typeof layer.eachLayer === "function") {
    layer.eachLayer((child) => applyLayerOpacity(child, opacity));
  }
}

function setLayerContainerVisibility(layer, visible) {
  const container = layer?.getContainer?.();
  if (!container) return;
  container.style.visibility = visible ? "visible" : "hidden";
  container.style.pointerEvents = "none";
}

function showLayer(layer, opacity, zIndex) {
  applyLayerOpacity(layer, opacity);
  setLayerContainerVisibility(layer, opacity > 0);
  if (typeof layer.setZIndex === "function") {
    layer.setZIndex(zIndex);
  }
  if (typeof layer.bringToFront === "function") {
    layer.bringToFront();
  }
  layer.__codexVisible = opacity > 0;
}

function hideLayer(layer) {
  applyLayerOpacity(layer, 0);
  setLayerContainerVisibility(layer, false);
  layer.__codexVisible = false;
}

async function waitForLayerReady(layer) {
  if (!layer) return;
  if (layer.__codexReady) return;

  if (typeof layer.isLoading === "function" && !layer.isLoading()) {
    layer.__codexReady = true;
    return;
  }

  await new Promise((resolve) => {
    let settled = false;
    const cleanup = () => {
      clearTimeout(timeoutId);
      layer.off?.("load", handleDone);
      layer.off?.("tileerror", handleDone);
    };
    const handleDone = () => {
      if (settled) return;
      settled = true;
      layer.__codexReady = true;
      cleanup();
      resolve();
    };
    const timeoutId = window.setTimeout(handleDone, 1800);
    layer.once?.("load", handleDone);
    layer.once?.("tileerror", handleDone);
  });
}

export function useMapLayersRuntime({
  mapRef,
  mapReady,
  selectedLayers,
  zMap,
  layerOpacityMap,
  onLayerStatusChange,
}) {
  const groupRef = useRef({});
  const paneRef = useRef({});
  const boundsRef = useRef({});
  const lastPaneRef = useRef({});
  const lastOnRef = useRef(new Set());
  const loadTokenRef = useRef(0);
  const visibleIdsRef = useRef(new Set());
  const tileStateRef = useRef({});
  const mosaicStatusFrameRef = useRef(null);
  const [mosaicStatus, setMosaicStatus] = useState({
    pendingLayers: 0,
    pendingTiles: 0,
    requestedTiles: 0,
    settledTiles: 0,
    progress: 1,
    isUpdating: false,
  });

  const visibleDefs = useMemo(
    () => [...selectedLayers].sort((a, b) => getLayerZ(a, zMap) - getLayerZ(b, zMap)),
    [selectedLayers, zMap]
  );

  const syncMosaicStatus = useCallback(() => {
    if (mosaicStatusFrameRef.current) cancelAnimationFrame(mosaicStatusFrameRef.current);

    mosaicStatusFrameRef.current = requestAnimationFrame(() => {
      let pendingLayers = 0;
      let pendingTiles = 0;
      let requestedTiles = 0;
      let settledTiles = 0;

      visibleIdsRef.current.forEach((layerId) => {
        const layerState = tileStateRef.current[layerId];
        if (!layerState) return;

        pendingTiles += layerState.pendingTiles || 0;
        requestedTiles += layerState.requestedTiles || 0;
        settledTiles += layerState.settledTiles || 0;
        if (layerState.isUpdating || (layerState.pendingTiles || 0) > 0) {
          pendingLayers += 1;
        }
      });

      const progress = requestedTiles > 0 ? Math.min(1, settledTiles / requestedTiles) : 1;

      setMosaicStatus((previous) => {
        const next = {
          pendingLayers,
          pendingTiles,
          requestedTiles,
          settledTiles,
          progress,
          isUpdating: pendingLayers > 0 || pendingTiles > 0,
        };

        if (
          previous.pendingLayers === next.pendingLayers &&
          previous.pendingTiles === next.pendingTiles &&
          previous.requestedTiles === next.requestedTiles &&
          previous.settledTiles === next.settledTiles &&
          previous.progress === next.progress &&
          previous.isUpdating === next.isUpdating
        ) {
          return previous;
        }

        return next;
      });
    });
  }, []);

  const bindTileLayerProgress = useCallback(
    (layerDef, layer) => {
      if (!layer || layer.__codexTileProgressBound) return;

      const layerState = (tileStateRef.current[layerDef.id] = {
        pendingTiles: 0,
        requestedTiles: 0,
        settledTiles: 0,
        isUpdating: false,
      });

      const updateState = (changes) => {
        Object.assign(layerState, changes);
        syncMosaicStatus();
      };

      layer.on("loading", () =>
        updateState({
          isUpdating: true,
          pendingTiles: 0,
          requestedTiles: 0,
          settledTiles: 0,
        })
      );
      layer.on("load", () =>
        updateState({
          isUpdating: false,
          pendingTiles: 0,
          settledTiles: Math.max(layerState.settledTiles || 0, layerState.requestedTiles || 0),
        })
      );
      layer.on("tileloadstart", (event) => {
        const tile = event?.tile;
        if (tile) {
          tile.decoding = "async";
          tile.loading = "eager";
          tile.classList.remove("codex-tile-loaded", "codex-tile-error");
          tile.classList.add("codex-tile-loading");
        }

        updateState({
          isUpdating: true,
          pendingTiles: (layerState.pendingTiles || 0) + 1,
          requestedTiles: (layerState.requestedTiles || 0) + 1,
        });
      });
      layer.on("tileload", (event) => {
        const tile = event?.tile;
        if (tile) {
          tile.classList.remove("codex-tile-loading", "codex-tile-error");
          tile.classList.add("codex-tile-loaded");
        }

        updateState({
          pendingTiles: Math.max(0, (layerState.pendingTiles || 0) - 1),
          settledTiles: (layerState.settledTiles || 0) + 1,
        });
      });
      layer.on("tileerror", (event) => {
        const tile = event?.tile;
        if (tile) {
          tile.classList.remove("codex-tile-loading", "codex-tile-loaded");
          tile.classList.add("codex-tile-error");
        }

        updateState({
          pendingTiles: Math.max(0, (layerState.pendingTiles || 0) - 1),
          settledTiles: (layerState.settledTiles || 0) + 1,
        });
      });

      layer.__codexTileProgressBound = true;
    },
    [syncMosaicStatus]
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return undefined;

    let cancelled = false;
    const token = ++loadTokenRef.current;

    const syncLayers = async () => {
      const currentOn = new Set(visibleDefs.map((layer) => layer.id));
      visibleIdsRef.current = currentOn;
      syncMosaicStatus();
      const newLayerIds = [...currentOn].filter((id) => !lastOnRef.current.has(id));
      let unionBounds = null;

      Object.keys(groupRef.current).forEach((id) => {
        if (currentOn.has(id)) return;
        const layer = groupRef.current[id];
        if (layer) hideLayer(layer);
        visibleIdsRef.current.delete(id);
        syncMosaicStatus();
        onLayerStatusChange(id, { status: "idle", message: "" });
      });

      for (const layerDef of visibleDefs) {
        if (cancelled || token !== loadTokenRef.current) return;

        try {
          const z = getLayerZ(layerDef, zMap);
          const opacity = getLayerOpacity(layerDef, layerOpacityMap);
          const paneId = ensureTilePane(map, paneRef, layerDef.id, z);
          let layer = groupRef.current[layerDef.id];

          if (layer && lastPaneRef.current[layerDef.id] !== paneId) {
            if (map.hasLayer(layer)) map.removeLayer(layer);
            layer = null;
          }

          if (!layer) {
            onLayerStatusChange(layerDef.id, { status: "loading", message: "Cargando capa..." });
            layer =
              layerDef.sourceType === "local" && GEOSERVER_CONFIG.localFallbackEnabled
                ? await loadLegacyLocalLayer(layerDef, paneId)
                : createWmsLayer(layerDef, paneId, z);

            if (!layer) continue;
            groupRef.current[layerDef.id] = layer;
            lastPaneRef.current[layerDef.id] = paneId;
            bindTileLayerProgress(layerDef, layer);
            layer.addTo(map);
            await waitForLayerReady(layer);
            if (cancelled || token !== loadTokenRef.current) return;
          } else if (!map.hasLayer(layer)) {
            layer.addTo(map);
          }

          showLayer(layer, opacity, z);
          if (layer.__codexReady) {
            onLayerStatusChange(layerDef.id, { status: "ready", message: "" });
          } else {
            onLayerStatusChange(layerDef.id, { status: "loading", message: "Preparando consulta..." });
          }

          if (newLayerIds.includes(layerDef.id) && layerDef.fitOnEnable !== false) {
            const bounds = await resolveLayerBounds({
              layerDef,
              boundsCache: boundsRef,
              boundsFromConfig,
            });
            unionBounds = extendUnionBounds(unionBounds, bounds);
          }
        } catch (error) {
          onLayerStatusChange(layerDef.id, {
            status: "error",
            message: error?.message || "No se pudo cargar la capa",
          });
          console.error(`Layer sync failed for ${layerDef.id}`, error);
        }
      }

      if (cancelled || token !== loadTokenRef.current || mapRef.current !== map || !map._loaded) {
        return;
      }

      if (unionBounds?.isValid?.()) {
        try {
          map.flyToBounds(unionBounds, {
            padding: [40, 40],
            maxZoom: 13,
            duration: 0.7,
          });
        } catch (error) {
          console.warn("Animated flyToBounds failed, falling back to fitBounds", error);
          map.fitBounds(unionBounds, {
            padding: [40, 40],
            maxZoom: 13,
            animate: false,
          });
        }
      }

      lastOnRef.current = currentOn;
    };

    syncLayers().catch((error) => {
      console.error("Error while syncing GeoServer layers", error);
    });

    return () => {
      cancelled = true;
    };
  }, [
    bindTileLayerProgress,
    layerOpacityMap,
    mapReady,
    mapRef,
    onLayerStatusChange,
    syncMosaicStatus,
    visibleDefs,
    zMap,
  ]);

  const cleanupLayersRuntime = useCallback(() => {
    groupRef.current = {};
    paneRef.current = {};
    boundsRef.current = {};
    lastPaneRef.current = {};
    lastOnRef.current = new Set();
    visibleIdsRef.current = new Set();
    tileStateRef.current = {};
    if (mosaicStatusFrameRef.current) cancelAnimationFrame(mosaicStatusFrameRef.current);
  }, []);

  return {
    visibleDefs,
    mosaicStatus,
    cleanupLayersRuntime,
  };
}
