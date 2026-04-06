"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import LegendDock from "./LegendDock";
import { GEOSERVER_CONFIG, HIDALGO_REGION_BOUNDS } from "@/config/geoserver";
import {
  createWmsLayer,
  fetchFeatureAtLatLng,
  fetchFeatureInfo,
  fetchLayerBounds,
} from "@/lib/geoserver/client";
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

export default function MapView({ selectedLayers = [], zMap = {}, legends = [] }) {
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
        .filter((layer) => layer.queryMode === "getFeatureInfo" || layer.sourceType === "wms")
        .sort((a, b) => getLayerZ(b, zMap) - getLayerZ(a, zMap)),
    [selectedLayers, zMap]
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
        if (layer && map.hasLayer(layer)) map.removeLayer(layer);
      });

      for (const layerDef of visibleDefs) {
        if (cancelled || token !== loadTokenRef.current) return;

        try {
          const z = getLayerZ(layerDef, zMap);
          const paneId = ensureTilePane(map, paneRef, layerDef.id, z);
          let layer = groupRef.current[layerDef.id];

          if (layer && lastPaneRef.current[layerDef.id] !== paneId) {
            if (map.hasLayer(layer)) map.removeLayer(layer);
            layer = null;
          }

          if (!layer) {
            layer =
              layerDef.sourceType === "local" && GEOSERVER_CONFIG.localFallbackEnabled
                ? await loadLegacyLocalLayer(layerDef, paneId)
                : createWmsLayer(layerDef, paneId, z);

            if (!layer) continue;
            groupRef.current[layerDef.id] = layer;
            lastPaneRef.current[layerDef.id] = paneId;
            layer.addTo(map);
          } else if (!map.hasLayer(layer)) {
            layer.addTo(map);
          }

          if (typeof layer.setZIndex === "function") {
            layer.setZIndex(z);
          }

          if (newLayerIds.includes(layerDef.id)) {
            const configuredBounds = boundsFromConfig(layerDef.bounds);
            const bounds =
              configuredBounds ||
              boundsRef.current[layerDef.id] ||
              (layerDef.sourceType === "local" ? null : await fetchLayerBounds(layerDef));
            if (bounds?.isValid?.()) {
              boundsRef.current[layerDef.id] = bounds;
              unionBounds = unionBounds
                ? unionBounds.extend(bounds)
                : L.latLngBounds(bounds.getSouthWest(), bounds.getNorthEast());
            }
          }
        } catch (error) {
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
  }, [visibleDefs, zMap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

    const getFallbackRadius = () => {
      const zoom = map.getZoom();
      if (zoom >= 17) return 0.00012;
      if (zoom >= 15) return 0.00025;
      if (zoom >= 13) return 0.0006;
      if (zoom >= 11) return 0.0012;
      return 0.002;
    };

    const resolveFeatureAtLatLng = async (latlng, options = {}) => {
      const { allowWfsFallback = true, logErrors = true } = options;

      for (const layerDef of queryableDefs) {
        try {
          const collection = await fetchFeatureInfo(map, latlng, layerDef);
          const feature = collection?.features?.[0];
          if (feature?.properties) {
            return { feature, layerDef };
          }
        } catch (error) {
          if (logErrors) {
            console.error(`Query error for layer ${layerDef.id}`, error);
          }
        }

        if (!allowWfsFallback) continue;

        try {
          const fallbackFeature = await fetchFeatureAtLatLng(layerDef, latlng, getFallbackRadius());
          if (fallbackFeature?.properties) {
            return { feature: fallbackFeature, layerDef };
          }
        } catch (error) {
          if (logErrors) {
            console.error(`Fallback query error for layer ${layerDef.id}`, error);
          }
        }
      }

      return null;
    };

    const handleClick = async (event) => {
      const result = await resolveFeatureAtLatLng(event.latlng, {
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
        const result = await resolveFeatureAtLatLng(event.latlng, {
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
  }, [queryableDefs]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mapDivRef} id="map" style={{ width: "100%", height: "100%" }} />
      <LegendDock legends={legends} />
    </div>
  );
}
