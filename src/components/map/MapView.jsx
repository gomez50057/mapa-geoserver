"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import LegendDock from "./LegendDock";
import { GEOSERVER_CONFIG, HIDALGO_REGION_BOUNDS } from "@/config/geoserver";
import {
  buildWfsLayer,
  createWmsLayer,
  fetchFeatureInfo,
  fetchWfsFeatures,
} from "@/lib/geoserver/client";
import { loadLegacyLocalLayer } from "@/lib/geoserver/legacyLocalLayers";
import { renderPopupContent } from "@/data/popupSchemas";

const FALLBACK_BOUNDS = L.latLngBounds(HIDALGO_REGION_BOUNDS[0], HIDALGO_REGION_BOUNDS[1]);
const clampZ = (z) => Math.max(-9999, Math.min(9999, Math.round(Number(z ?? 400))));
const vectorPaneIdFromZ = (z) => `pane_vec_${clampZ(z)}`;

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

function ensureVectorRenderer(map, rendererRegistryRef, paneId) {
  let renderer = rendererRegistryRef.current[paneId];
  if (!renderer) {
    renderer = L.svg({ pane: paneId });
    rendererRegistryRef.current[paneId] = renderer;
  }

  if (!renderer._map) renderer.addTo(map);
  return renderer;
}

function bindLayerToPane(layer, paneId, renderer) {
  if (!layer) return;

  if (layer.options) {
    layer.options.pane = paneId;
    layer.options.renderer = renderer;
  }

  if (typeof layer.eachLayer === "function") {
    layer.eachLayer((child) => bindLayerToPane(child, paneId, renderer));
  }
}

export default function MapView({ selectedLayers = [], zMap = {}, legends = [] }) {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const groupRef = useRef({});
  const paneRef = useRef({});
  const rendererRef = useRef({});
  const sourceDataRef = useRef({});
  const lastPaneRef = useRef({});
  const lastOnRef = useRef(new Set());
  const loadTokenRef = useRef(0);

  const visibleDefs = useMemo(
    () => [...selectedLayers].sort((a, b) => getLayerZ(a, zMap) - getLayerZ(b, zMap)),
    [selectedLayers, zMap]
  );

  const queryableDefs = useMemo(
    () =>
      [...selectedLayers]
        .filter((layer) => layer.sourceType === "wms")
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
      map.remove();
      mapRef.current = null;
      groupRef.current = {};
      paneRef.current = {};
      rendererRef.current = {};
      sourceDataRef.current = {};
      lastPaneRef.current = {};
      lastOnRef.current = new Set();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

    let cancelled = false;
    const token = ++loadTokenRef.current;

    const addVectorLayer = async (layerDef, layer, paneId, renderer) => {
      bindLayerToPane(layer, paneId, renderer);

      try {
        layer.addTo(map);
        return layer;
      } catch (error) {
        if (layer?.remove) layer.remove();

        const featureCollection = sourceDataRef.current[layerDef.id];
        if (!featureCollection || layerDef.sourceType !== "wfs") {
          throw error;
        }

        console.warn(`Falling back to generic renderer for layer ${layerDef.id}`, error);
        const fallbackLayer = await buildWfsLayer(featureCollection, paneId, layerDef, {
          preferLegacyBuilder: false,
        });

        bindLayerToPane(fallbackLayer, paneId, renderer);
        fallbackLayer.addTo(map);
        groupRef.current[layerDef.id] = fallbackLayer;
        return fallbackLayer;
      }
    };

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

          if (layerDef.sourceType === "wms") {
            const paneId = ensureTilePane(map, paneRef, layerDef.id, z);
            let layer = groupRef.current[layerDef.id];

            if (!layer || lastPaneRef.current[layerDef.id] !== paneId) {
              if (layer && map.hasLayer(layer)) map.removeLayer(layer);
              layer = createWmsLayer(layerDef, paneId, z);
              groupRef.current[layerDef.id] = layer;
              lastPaneRef.current[layerDef.id] = paneId;
              layer.addTo(map);
            } else {
              if (!map.hasLayer(layer)) layer.addTo(map);
              if (typeof layer.setZIndex === "function") layer.setZIndex(z);
            }

            if (newLayerIds.includes(layerDef.id) && layerDef.bounds) {
              const configuredBounds = boundsFromConfig(layerDef.bounds);
              if (configuredBounds) {
                unionBounds = unionBounds
                  ? unionBounds.extend(configuredBounds)
                  : L.latLngBounds(configuredBounds.getSouthWest(), configuredBounds.getNorthEast());
              }
            }
            continue;
          }

          const paneId = vectorPaneIdFromZ(z);
          ensurePane(map, paneRef, paneId, z);
          const renderer = ensureVectorRenderer(map, rendererRef, paneId);
          let layer = groupRef.current[layerDef.id];

          if (layer && lastPaneRef.current[layerDef.id] !== paneId) {
            if (map.hasLayer(layer)) map.removeLayer(layer);
            delete groupRef.current[layerDef.id];
            layer = null;
          }

          if (!layer) {
            if (layerDef.sourceType === "wfs") {
              const featureCollection =
                sourceDataRef.current[layerDef.id] ||
                (await fetchWfsFeatures(layerDef, { maxFeatures: 3000 }));
              sourceDataRef.current[layerDef.id] = featureCollection;
              layer = await buildWfsLayer(featureCollection, paneId, layerDef);
            } else if (layerDef.sourceType === "local" && GEOSERVER_CONFIG.localFallbackEnabled) {
              layer = await loadLegacyLocalLayer(layerDef, paneId);
            }

            if (layer) {
              groupRef.current[layerDef.id] = layer;
              lastPaneRef.current[layerDef.id] = paneId;
              layer = await addVectorLayer(layerDef, layer, paneId, renderer);
            }
          } else if (!map.hasLayer(layer)) {
            layer = await addVectorLayer(layerDef, layer, paneId, renderer);
          }

          if (newLayerIds.includes(layerDef.id) && layer?.getBounds?.()?.isValid?.()) {
            const bounds = layer.getBounds();
            unionBounds = unionBounds
              ? unionBounds.extend(bounds)
              : L.latLngBounds(bounds.getSouthWest(), bounds.getNorthEast());
          }
        } catch (error) {
          console.error(`Layer sync failed for ${layerDef.id}`, error);
        }
      }

      if (unionBounds?.isValid?.()) {
        map.flyToBounds(unionBounds, {
          padding: [40, 40],
          maxZoom: 13,
          duration: 0.7,
        });
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

    const handleClick = async (event) => {
      for (const layerDef of queryableDefs) {
        try {
          const collection = await fetchFeatureInfo(map, event.latlng, layerDef);
          const feature = collection?.features?.[0];
          if (feature?.properties) {
            L.popup({ maxWidth: 420 })
              .setLatLng(event.latlng)
              .setContent(renderPopupContent(layerDef.popupSchema, feature.properties, layerDef))
              .openOn(map);
            return;
          }
        } catch (error) {
          console.error(`Query error for layer ${layerDef.id}`, error);
        }
      }

      map.closePopup();
    };

    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [queryableDefs]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mapDivRef} id="map" style={{ width: "100%", height: "100%" }} />
      <LegendDock legends={legends} />
    </div>
  );
}
