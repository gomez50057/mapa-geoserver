"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import LegendDock from "./LegendDock";
import { GEOSERVER_CONFIG, HIDALGO_REGION_BOUNDS } from "@/config/geoserver";
import { createWmsLayer } from "@/lib/geoserver/client";
import { resolveTopmostFeatureAtLatLng } from "@/lib/geoserver/interaction";
import { extendUnionBounds, resolveLayerBounds } from "@/lib/geoserver/runtime";
import { loadLegacyLocalLayer } from "@/lib/geoserver/legacyLocalLayers";
import { renderPopupContent } from "@/data/popupSchemas";

const FALLBACK_BOUNDS = L.latLngBounds(HIDALGO_REGION_BOUNDS[0], HIDALGO_REGION_BOUNDS[1]);
const clampZ = (z) => Math.max(-9999, Math.min(9999, Math.round(Number(z ?? 400))));

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

export default function MapView({
  selectedLayers = [],
  zMap = {},
  legends = [],
  layerOpacityMap = {},
  layerLoadState = {},
  loadingSummary = null,
  onLayerStatusChange = () => {},
  onLayerOpacityChange = () => {},
  onManyLayerOpacityChange = () => {},
}) {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const groupRef = useRef({});
  const paneRef = useRef({});
  const boundsRef = useRef({});
  const lastPaneRef = useRef({});
  const lastOnRef = useRef(new Set());
  const loadTokenRef = useRef(0);
  const hoverTimerRef = useRef(null);
  const hoverSeqRef = useRef(0);

  const visibleDefs = useMemo(
    () => [...selectedLayers].sort((a, b) => getLayerZ(a, zMap) - getLayerZ(b, zMap)),
    [selectedLayers, zMap]
  );

  const queryableDefs = useMemo(
    () =>
      [...selectedLayers]
        .filter((layer) => getLayerOpacity(layer, layerOpacityMap) > 0.01)
        .filter((layer) => layerLoadState[layer.id]?.status === "ready")
        .filter((layer) => layer.queryMode !== "none")
        .sort((a, b) => getLayerZ(b, zMap) - getLayerZ(a, zMap)),
    [layerLoadState, layerOpacityMap, selectedLayers, zMap]
  );

  const hoverableDefs = useMemo(
    () =>
      [...selectedLayers]
        .filter((layer) => getLayerOpacity(layer, layerOpacityMap) > 0.01)
        .filter((layer) => layerLoadState[layer.id]?.status === "ready")
        .filter((layer) => layer.hoverMode && layer.hoverMode !== "none")
        .sort((a, b) => getLayerZ(b, zMap) - getLayerZ(a, zMap)),
    [layerLoadState, layerOpacityMap, selectedLayers, zMap]
  );

  useEffect(() => {
    if (mapRef.current) return undefined;

    const map = L.map(mapDivRef.current, {
      maxBounds: FALLBACK_BOUNDS,
      maxBoundsViscosity: 1.0,
      worldCopyJump: false,
    });

    const topZ = 20000;
    const popupPane = map.getPane("popupPane");
    if (popupPane) popupPane.style.zIndex = String(topZ);
    const tooltipPane = map.getPane("tooltipPane");
    if (tooltipPane) tooltipPane.style.zIndex = String(topZ - 1);

    map.fitBounds(FALLBACK_BOUNDS, { padding: [20, 20] });
    const computedMin = map.getBoundsZoom(FALLBACK_BOUNDS, true);
    map.setMinZoom(Math.max(5, computedMin));
    map.setMaxZoom(20);

    const commonTileOpts = {
      minZoom: map.getMinZoom(),
      maxZoom: map.getMaxZoom(),
      noWrap: true,
      bounds: FALLBACK_BOUNDS,
    };

    const keepInside = () => map.panInsideBounds(FALLBACK_BOUNDS, { animate: false });
    map.on("drag", keepInside);
    map.attributionControl.setPrefix("");
    map.getContainer().style.cursor = "grab";

    const hybrid = L.tileLayer("http://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
      ...commonTileOpts,
      subdomains: ["mt0", "mt1", "mt2", "mt3"],
    }).addTo(map);
    const dark = L.tileLayer("https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", commonTileOpts);
    const satellite = L.tileLayer("http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
      ...commonTileOpts,
      subdomains: ["mt0", "mt1", "mt2", "mt3"],
    });
    const relief = L.tileLayer("http://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}", {
      ...commonTileOpts,
      subdomains: ["mt0", "mt1", "mt2", "mt3"],
    });
    const roads = L.tileLayer("http://{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}", {
      ...commonTileOpts,
      subdomains: ["mt0", "mt1", "mt2", "mt3"],
    });

    L.control
      .layers(
        {
          "Mapa Híbrido": hybrid,
          "Mapa Satelital": satellite,
          "Mapa Dark": dark,
          "Google Relieve": relief,
          "Google Carreteras": roads,
        },
        {},
        { collapsed: true }
      )
      .addTo(map);

    mapRef.current = map;

    return () => {
      map.off("drag", keepInside);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      map.remove();
      mapRef.current = null;
      groupRef.current = {};
      paneRef.current = {};
      boundsRef.current = {};
      lastPaneRef.current = {};
      lastOnRef.current = new Set();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

    let cancelled = false;
    const token = ++loadTokenRef.current;

    const syncLayers = async () => {
      const currentOn = new Set(visibleDefs.map((layer) => layer.id));
      const newLayerIds = [...currentOn].filter((id) => !lastOnRef.current.has(id));
      let unionBounds = null;

      Object.keys(groupRef.current).forEach((id) => {
        if (currentOn.has(id)) return;
        const layer = groupRef.current[id];
        if (layer) hideLayer(layer);
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
  }, [layerOpacityMap, onLayerStatusChange, visibleDefs, zMap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

    const handleClick = async (event) => {
      const result = await resolveTopmostFeatureAtLatLng({
        map,
        latlng: event.latlng,
        layers: queryableDefs,
        allowWfsFallback: true,
        logErrors: true,
      });
      if (result?.feature?.properties) {
        L.popup({ maxWidth: 420 })
          .setLatLng(event.latlng)
          .setContent(renderPopupContent(result.layerDef.popupSchema, result.feature.properties, result.layerDef))
          .openOn(map);
        return;
      }

      map.closePopup();
    };

    const handleMouseMove = (event) => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      const seq = ++hoverSeqRef.current;

      hoverTimerRef.current = setTimeout(async () => {
        const result = await resolveTopmostFeatureAtLatLng({
          map,
          latlng: event.latlng,
          layers: hoverableDefs,
          allowWfsFallback: false,
          logErrors: false,
        });
        if (seq !== hoverSeqRef.current) return;
        map.getContainer().style.cursor = result ? "pointer" : "grab";
      }, 120);
    };

    const handleMouseOut = () => {
      hoverSeqRef.current += 1;
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      map.getContainer().style.cursor = "grab";
    };

    const handleDragStart = () => {
      hoverSeqRef.current += 1;
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      map.getContainer().style.cursor = "grabbing";
    };

    const handleDragEnd = () => {
      map.getContainer().style.cursor = "grab";
    };

    map.on("click", handleClick);
    map.on("mousemove", handleMouseMove);
    map.on("mouseout", handleMouseOut);
    map.on("dragstart", handleDragStart);
    map.on("dragend", handleDragEnd);
    map.on("zoomstart", handleDragStart);
    map.on("zoomend", handleDragEnd);
    return () => {
      map.off("click", handleClick);
      map.off("mousemove", handleMouseMove);
      map.off("mouseout", handleMouseOut);
      map.off("dragstart", handleDragStart);
      map.off("dragend", handleDragEnd);
      map.off("zoomstart", handleDragStart);
      map.off("zoomend", handleDragEnd);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, [hoverableDefs, queryableDefs]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {loadingSummary?.total > 0 && loadingSummary.isBusy && (
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            zIndex: 20001,
            padding: "10px 14px",
            borderRadius: 14,
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
            fontSize: 12,
            color: "#333",
            backdropFilter: "blur(8px)",
          }}
        >
          <strong style={{ display: "block", marginBottom: 4 }}>Cargando catálogo</strong>
          <span>
            {loadingSummary.ready} / {loadingSummary.total} capas listas
          </span>
          {loadingSummary.pending > 0 && (
            <span style={{ display: "block", marginTop: 2 }}>
              {loadingSummary.pending} preparando consulta...
            </span>
          )}
          {loadingSummary.loading > 0 && (
            <span style={{ display: "block", marginTop: 2 }}>
              {loadingSummary.loading} en carga...
            </span>
          )}
        </div>
      )}
      <div ref={mapDivRef} id="map" style={{ width: "100%", height: "100%" }} />
      <LegendDock
        legends={legends}
        activeLayers={visibleDefs}
        layerOpacityMap={layerOpacityMap}
        onLayerOpacityChange={onLayerOpacityChange}
        onManyLayerOpacityChange={onManyLayerOpacityChange}
      />
    </div>
  );
}
