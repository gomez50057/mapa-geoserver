"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const COORDINATE_DECIMALS = 7;
const IMPORT_LAYER_PANE = "pane_uploaded_vector";
const MAX_IMPORT_FILE_SIZE_BYTES = 12 * 1024 * 1024;
const SAFE_IMPORT_EXTENSIONS = new Set([".geojson", ".kml"]);
const SAFE_IMPORT_MIME_TYPES = {
  ".geojson": new Set(["", "application/geo+json", "application/json"]),
  ".kml": new Set(["", "application/vnd.google-earth.kml+xml", "application/xml", "text/xml"]),
};

function formatCoordinatePair(latlng) {
  if (!latlng) return "20.0830998, -98.7948132";
  return `${Number(latlng.lat).toFixed(COORDINATE_DECIMALS)}, ${Number(latlng.lng).toFixed(COORDINATE_DECIMALS)}`;
}

function clampMenuPosition(point, menuSize, containerSize) {
  const left = Math.max(12, Math.min(point.x - menuSize.width + 22, containerSize.x - menuSize.width - 12));
  const top = Math.max(12, Math.min(point.y - menuSize.height - 14, containerSize.y - menuSize.height - 12));
  return { left, top };
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`No se pudo leer el archivo ${file?.name || ""}`.trim()));
    reader.readAsText(file);
  });
}

function getFileExtension(fileName) {
  const normalizedName = String(fileName || "").trim().toLowerCase();
  const lastDotIndex = normalizedName.lastIndexOf(".");
  return lastDotIndex >= 0 ? normalizedName.slice(lastDotIndex) : "";
}

function validateImportedFile(file) {
  const extension = getFileExtension(file?.name);
  const mimeType = String(file?.type || "").trim().toLowerCase();

  if (!SAFE_IMPORT_EXTENSIONS.has(extension)) {
    return "Por seguridad, solo se permiten archivos KML o GeoJSON.";
  }

  const allowedMimeTypes = SAFE_IMPORT_MIME_TYPES[extension];
  if (allowedMimeTypes && !allowedMimeTypes.has(mimeType)) {
    return "El archivo no coincide con un formato KML o GeoJSON válido.";
  }

  return "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseCoordinateTuple(pair) {
  const [lng, lat, altitude] = String(pair || "")
    .split(",")
    .map((value) => Number(String(value).trim()));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return Number.isFinite(altitude) ? [lng, lat, altitude] : [lng, lat];
}

function parseCoordinatesText(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .map(parseCoordinateTuple)
    .filter(Boolean);
}

function getNodeText(node, tagNames) {
  for (const tagName of tagNames) {
    const match = node.getElementsByTagName(tagName)?.[0];
    const text = match?.textContent?.trim();
    if (text) return text;
  }
  return "";
}

function extractKmlProperties(placemark) {
  const properties = {};
  const name = getNodeText(placemark, ["name"]);
  const description = getNodeText(placemark, ["description"]);
  if (name) properties.name = name;
  if (description) properties.description = description;

  const simpleDatas = Array.from(placemark.getElementsByTagName("SimpleData") || []);
  simpleDatas.forEach((item) => {
    const key = item.getAttribute("name");
    if (!key) return;
    properties[key] = item.textContent?.trim() || "";
  });

  const datas = Array.from(placemark.getElementsByTagName("Data") || []);
  datas.forEach((item) => {
    const key = item.getAttribute("name");
    if (!key) return;
    const value = item.getElementsByTagName("value")?.[0]?.textContent?.trim() || "";
    properties[key] = value;
  });

  return properties;
}

function extractKmlGeometry(node) {
  if (!node) return null;

  const pointNode = node.getElementsByTagName("Point")?.[0];
  if (pointNode) {
    const coordinates = parseCoordinatesText(getNodeText(pointNode, ["coordinates"]));
    if (coordinates[0]) {
      return {
        type: "Point",
        coordinates: coordinates[0],
      };
    }
  }

  const lineNode = node.getElementsByTagName("LineString")?.[0];
  if (lineNode) {
    const coordinates = parseCoordinatesText(getNodeText(lineNode, ["coordinates"]));
    if (coordinates.length > 1) {
      return {
        type: "LineString",
        coordinates,
      };
    }
  }

  const polygonNode = node.getElementsByTagName("Polygon")?.[0];
  if (polygonNode) {
    const boundaries = [];
    const outer = polygonNode.getElementsByTagName("outerBoundaryIs")?.[0];
    const innerNodes = Array.from(polygonNode.getElementsByTagName("innerBoundaryIs") || []);

    if (outer) {
      const coords = parseCoordinatesText(getNodeText(outer, ["coordinates"]));
      if (coords.length >= 4) boundaries.push(coords);
    }

    innerNodes.forEach((inner) => {
      const coords = parseCoordinatesText(getNodeText(inner, ["coordinates"]));
      if (coords.length >= 4) boundaries.push(coords);
    });

    if (boundaries.length > 0) {
      return {
        type: "Polygon",
        coordinates: boundaries,
      };
    }
  }

  const multiGeometryNode = node.getElementsByTagName("MultiGeometry")?.[0];
  if (multiGeometryNode) {
    const childGeometries = Array.from(multiGeometryNode.children || [])
      .map((child) => extractKmlGeometry({ getElementsByTagName: (tagName) => child.tagName === tagName ? [child] : [] }))
      .filter(Boolean);

    if (childGeometries.length > 0) {
      return {
        type: "GeometryCollection",
        geometries: childGeometries,
      };
    }
  }

  return null;
}

function parseKml(text) {
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(text, "application/xml");
  const parseError = documentNode.getElementsByTagName("parsererror")?.[0];
  if (parseError) {
    throw new Error("El archivo KML no tiene un formato válido.");
  }

  const placemarks = Array.from(documentNode.getElementsByTagName("Placemark") || []);
  const features = placemarks
    .map((placemark) => {
      const geometry = extractKmlGeometry(placemark);
      if (!geometry) return null;
      return {
        type: "Feature",
        properties: extractKmlProperties(placemark),
        geometry,
      };
    })
    .filter(Boolean);

  if (features.length === 0) {
    throw new Error("El KML no contiene geometrías compatibles.");
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

function normalizeGeoJsonPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("El archivo no contiene un GeoJSON válido.");
  }

  if (payload.type === "FeatureCollection") return payload;
  if (payload.type === "Feature") {
    return {
      type: "FeatureCollection",
      features: [payload],
    };
  }

  if (payload.type && payload.coordinates) {
    return {
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry: payload }],
    };
  }

  throw new Error("El archivo no contiene un GeoJSON válido.");
}

function parseImportedFile(fileName, text) {
  const extension = getFileExtension(fileName);
  if (extension === ".kml") return parseKml(text);
  if (extension === ".geojson") {
    return normalizeGeoJsonPayload(JSON.parse(text));
  }
  throw new Error("Por seguridad, solo se permiten archivos KML o GeoJSON.");
}

function buildPropertiesPopup(properties = {}) {
  const entries = Object.entries(properties || {}).filter(([, value]) => value != null && String(value).trim() !== "");
  if (entries.length === 0) {
    return `<div style="font-family:Montserrat,sans-serif;font-size:12px;color:#333;">Sin atributos disponibles</div>`;
  }

  const rows = entries
    .slice(0, 20)
    .map(
      ([key, value]) => `
        <div style="display:grid;gap:2px;padding:6px 0;border-top:1px solid rgba(0,0,0,0.06);">
          <strong style="font-size:11px;color:#7a1d31;text-transform:uppercase;letter-spacing:.04em;">${escapeHtml(key)}</strong>
          <span style="font-size:12px;color:#2e2e2e;word-break:break-word;">${escapeHtml(value)}</span>
        </div>
      `
    )
    .join("");

  return `<div style="font-family:Montserrat,sans-serif;min-width:180px;">${rows}</div>`;
}

function createImportedLayer(map, geojson, fileName) {
  ensurePane(map, { current: {} }, IMPORT_LAYER_PANE, 650);

  const layer = L.geoJSON(geojson, {
    pane: IMPORT_LAYER_PANE,
    style: (feature) => ({
      color: feature?.geometry?.type?.includes("Line") ? "#0f6cbd" : "#7a1d31",
      weight: feature?.geometry?.type?.includes("Line") ? 3 : 2.2,
      opacity: 0.95,
      fillColor: "#bc955b",
      fillOpacity: feature?.geometry?.type?.includes("Polygon") ? 0.24 : 0,
    }),
    pointToLayer: (feature, latlng) =>
      L.circleMarker(latlng, {
        pane: IMPORT_LAYER_PANE,
        radius: 7,
        color: "#ffffff",
        weight: 2,
        fillColor: "#7a1d31",
        fillOpacity: 1,
      }).bindPopup(buildPropertiesPopup(feature?.properties || { Archivo: fileName })),
    onEachFeature: (feature, layer) => {
      if (typeof layer.bindPopup === "function" && !layer.getPopup()) {
        layer.bindPopup(buildPropertiesPopup(feature?.properties || { Archivo: fileName }));
      }
    },
  });

  layer.__uploadedFileName = fileName;
  return layer;
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
  const moveResumeTimerRef = useRef(null);
  const clickControllerRef = useRef(null);
  const hoverControllerRef = useRef(null);
  const locationOverlayRef = useRef(null);
  const importedOverlayRef = useRef(null);
  const importInputRef = useRef(null);
  const movingRef = useRef(false);
  const mapBusyRef = useRef(false);
  const pendingClickRef = useRef(null);
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
  const [mouseCoordinates, setMouseCoordinates] = useState(formatCoordinatePair(null));
  const [contextMenuState, setContextMenuState] = useState(null);
  const [importPanelState, setImportPanelState] = useState({
    open: false,
    loading: false,
    error: "",
  });
  const [importSanitizeHelpOpen, setImportSanitizeHelpOpen] = useState(false);

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

  const bindTileLayerProgress = useCallback((layerDef, layer) => {
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
  }, [syncMosaicStatus]);

  const abortControllerRef = (controllerRef) => {
    controllerRef.current?.abort?.();
    controllerRef.current = null;
  };

  const closeContextMenu = useCallback(() => {
    setContextMenuState(null);
  }, []);

  const copyCoordinates = useCallback(async (coordsText) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(coordsText);
      } else {
        const input = document.createElement("textarea");
        input.value = coordsText;
        input.setAttribute("readonly", "");
        input.style.position = "absolute";
        input.style.left = "-9999px";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }

      setContextMenuState((current) => (current ? { ...current, copied: true } : current));
      window.setTimeout(() => {
        setContextMenuState((current) => (current ? { ...current, copied: false } : current));
      }, 1100);
    } catch (error) {
      console.error("Could not copy coordinates", error);
    }
  }, []);

  const openImportPanel = useCallback(() => {
    setImportPanelState((current) => ({ ...current, open: true, error: "" }));
  }, []);

  const closeImportPanel = useCallback(() => {
    setImportPanelState((current) => ({ ...current, open: false, loading: false, error: "" }));
    setImportSanitizeHelpOpen(false);
    if (importInputRef.current) importInputRef.current.value = "";
  }, []);

  const handleImportedFile = useCallback(
    async (file) => {
      const map = mapRef.current;
      if (!map || !file) return;

      const importValidationError = validateImportedFile(file);
      if (importValidationError) {
        setImportPanelState((current) => ({
          ...current,
          open: true,
          loading: false,
          error: importValidationError,
        }));
        return;
      }

      if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
        setImportPanelState((current) => ({
          ...current,
          open: true,
          loading: false,
          error: "Limita tus archivos a 12 MB.",
        }));
        return;
      }

      setImportPanelState((current) => ({
        ...current,
        open: true,
        loading: true,
        error: "",
      }));

      try {
        const text = await readFileAsText(file);
        const geojson = parseImportedFile(file.name, text);

        if (importedOverlayRef.current) {
          importedOverlayRef.current.remove();
          importedOverlayRef.current = null;
        }

        const layer = createImportedLayer(map, geojson, file.name).addTo(map);
        importedOverlayRef.current = layer;

        const bounds = layer.getBounds?.();
        if (bounds?.isValid?.()) {
          map.flyToBounds(bounds, {
            padding: [30, 30],
            maxZoom: 16,
            duration: 0.75,
          });
        }

        L.popup({ autoClose: true, closeButton: false, offset: [0, -16] })
          .setLatLng(map.getCenter())
          .setContent(
            `<div style="font-family:Montserrat,sans-serif;font-size:12px;color:#222;padding:2px 4px;">
              <strong style="color:#1d6fa5;display:block;margin-bottom:2px;">Archivo importado</strong>
              <span style="display:block;background:rgba(29,111,165,0.08);padding:6px 8px;border-radius:10px;">${escapeHtml(file.name)}</span>
            </div>`
          )
          .openOn(map);

        closeImportPanel();
      } catch (error) {
        console.error("Import failed", error);
        setImportPanelState((current) => ({
          ...current,
          open: true,
          loading: false,
          error: error?.message || "No se pudo importar el archivo.",
        }));
      } finally {
        if (importInputRef.current) importInputRef.current.value = "";
      }
    },
    [closeImportPanel]
  );

  const updateCursor = useCallback(
    (cursor) => {
      const map = mapRef.current;
      if (!map) return;
      map.getContainer().style.cursor = cursor;
    },
    []
  );

  const runPopupQuery = useCallback(
    async (latlng) => {
      const map = mapRef.current;
      if (!map || !latlng || queryableDefs.length === 0) {
        map?.closePopup?.();
        return;
      }

      abortControllerRef(clickControllerRef);
      const controller = new AbortController();
      clickControllerRef.current = controller;
      updateCursor("wait");

      const result = await resolveTopmostFeatureAtLatLng({
        map,
        latlng,
        layers: queryableDefs,
        signal: controller.signal,
        logErrors: true,
      });

      if (controller.signal.aborted) return;

      if (result?.feature?.properties && result.layerDef) {
        L.popup({ maxWidth: 420 })
          .setLatLng(latlng)
          .setContent(renderPopupContent(result.layerDef.popupSchema, result.feature.properties, result.layerDef))
          .openOn(map);
      } else {
        map.closePopup();
      }

      updateCursor(mapBusyRef.current ? "wait" : "grab");
      clickControllerRef.current = null;
    },
    [queryableDefs, updateCursor]
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

    map.attributionControl.setPrefix("");
    map.getContainer().style.cursor = "grab";

    const hybrid = L.tileLayer("https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
      ...commonTileOpts,
      subdomains: ["mt0", "mt1", "mt2", "mt3"],
    }).addTo(map);
    const dark = L.tileLayer("https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", commonTileOpts);
    const satellite = L.tileLayer("https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
      ...commonTileOpts,
      subdomains: ["mt0", "mt1", "mt2", "mt3"],
    });
    const relief = L.tileLayer("https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}", {
      ...commonTileOpts,
      subdomains: ["mt0", "mt1", "mt2", "mt3"],
    });
    const roads = L.tileLayer("https://{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}", {
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

    const LocateControl = L.Control.extend({
      options: { position: "topleft" },
      onAdd() {
        const wrapper = L.DomUtil.create("div", "leaflet-bar leaflet-control");
        wrapper.style.marginTop = "10px";
        wrapper.style.border = "none";
        wrapper.style.background = "transparent";

        const button = L.DomUtil.create("button", "", wrapper);
        button.type = "button";
        button.title = "Ir a mi ubicación";
        button.setAttribute("aria-label", "Ir a mi ubicación");
        button.style.width = "34px";
        button.style.height = "34px";
        button.style.display = "inline-flex";
        button.style.alignItems = "center";
        button.style.justifyContent = "center";
        button.style.border = "1px solid rgba(0,0,0,0.12)";
        button.style.borderRadius = "10px";
        button.style.background = "rgba(255,255,255,0.95)";
        button.style.backdropFilter = "blur(10px)";
        button.style.boxShadow = "0 10px 20px rgba(0,0,0,0.14)";
        button.style.cursor = "pointer";
        button.style.transition = "transform 120ms ease, box-shadow 120ms ease, background 120ms ease";
        button.style.color = "#7a1d31";
        button.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3v3m0 12v3M3 12h3m12 0h3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="12" cy="12" r="5.2" fill="none" stroke="currentColor" stroke-width="1.8"/>
            <circle cx="12" cy="12" r="1.7" fill="currentColor"/>
          </svg>
        `;

        const setLoading = (loading) => {
          button.disabled = loading;
          button.style.cursor = loading ? "wait" : "pointer";
          button.style.opacity = loading ? "0.78" : "1";
          button.style.transform = loading ? "scale(0.98)" : "scale(1)";
        };

        const showMessage = (latlng, message) => {
          L.popup({ autoClose: true, closeButton: false, offset: [0, -16] })
            .setLatLng(latlng || map.getCenter())
            .setContent(
              `<div style="font-family:Montserrat,sans-serif;font-size:12px;color:#222;padding:2px 4px;">${message}</div>`
            )
            .openOn(map);
        };

        const handleLocate = () => {
          if (!navigator?.geolocation) {
            showMessage(map.getCenter(), "La ubicación no está disponible en este navegador.");
            return;
          }

          setLoading(true);
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const latlng = L.latLng(position.coords.latitude, position.coords.longitude);

              if (locationOverlayRef.current) {
                locationOverlayRef.current.remove();
              }

              const marker = L.circleMarker(latlng, {
                radius: 7,
                color: "#ffffff",
                weight: 2.2,
                fillColor: "#1d6fa5",
                fillOpacity: 1,
              }).bindPopup(
                `
                  <div style="position:relative;font-family:Montserrat,sans-serif;display:grid;gap:6px;width:164px;padding-right:18px;line-height:1.2;">
                    <button
                      type="button"
                      data-close-location="true"
                      aria-label="Cerrar"
                      style="
                        position:absolute;
                        top:-4px;
                        right:-4px;
                        width:22px;
                        height:22px;
                        border:none;
                        border-radius:999px;
                        background:rgba(0,0,0,0.05);
                        color:#7d7d7d;
                        display:inline-flex;
                        align-items:center;
                        justify-content:center;
                        cursor:pointer;
                      "
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                    </button>
                    <strong style="font-size:12.5px;color:#202020;">Ubicación actual</strong>
                    <button
                      type="button"
                      data-remove-location="true"
                      style="
                        padding:8px 10px;
                        border:none;
                        border-radius:10px;
                        background:linear-gradient(135deg, rgba(122,29,49,0.08), rgba(188,149,91,0.18));
                        color:#7a1d31;
                        font-weight:700;
                        font-size:12px;
                        cursor:pointer;
                        box-shadow:0 8px 18px rgba(0,0,0,0.08);
                      "
                    >
                      Quitar ubicación
                    </button>
                  </div>
                `,
                {
                  offset: [0, -10],
                  closeButton: false,
                  className: "location-popup",
                  autoPanPadding: [24, 24],
                  minWidth: 192,
                  maxWidth: 192,
                }
              );

              marker.on("popupopen", () => {
                const closeButton = document.querySelector('[data-close-location="true"]');
                const button = document.querySelector('[data-remove-location="true"]');
                if (closeButton && closeButton.dataset.bound !== "true") {
                  closeButton.dataset.bound = "true";
                  closeButton.addEventListener("click", () => {
                    map.closePopup();
                  });
                }
                if (!button || button.dataset.bound === "true") return;
                button.dataset.bound = "true";
                button.addEventListener("click", () => {
                  locationOverlayRef.current?.remove?.();
                  locationOverlayRef.current = null;
                  map.closePopup();
                });
              });

              const group = L.layerGroup([marker]).addTo(map);
              locationOverlayRef.current = group;

              const targetZoom = Math.max(map.getZoom(), 16);
              map.flyTo(latlng, targetZoom, {
                duration: 0.85,
                easeLinearity: 0.22,
              });

              window.setTimeout(() => {
                marker.openPopup();
              }, 240);

              setLoading(false);
            },
            () => {
              showMessage(map.getCenter(), "No se pudo obtener tu ubicación.");
              setLoading(false);
            },
            {
              enableHighAccuracy: true,
              timeout: 12000,
              maximumAge: 30000,
            }
          );
        };

        L.DomEvent.disableClickPropagation(wrapper);
        L.DomEvent.disableScrollPropagation(wrapper);
        L.DomEvent.on(button, "click", (event) => {
          L.DomEvent.preventDefault(event);
          L.DomEvent.stopPropagation(event);
          handleLocate();
        });
        L.DomEvent.on(button, "mouseenter", () => {
          button.style.boxShadow = "0 14px 28px rgba(0,0,0,0.18)";
          button.style.transform = "translateY(-1px)";
        });
        L.DomEvent.on(button, "mouseleave", () => {
          if (!button.disabled) {
            button.style.boxShadow = "0 10px 20px rgba(0,0,0,0.14)";
            button.style.transform = "translateY(0)";
          }
        });

        return wrapper;
      },
    });

    const ImportControl = L.Control.extend({
      options: { position: "topleft" },
      onAdd() {
        const wrapper = L.DomUtil.create("div", "leaflet-bar leaflet-control");
        wrapper.style.marginTop = "10px";
        wrapper.style.border = "none";
        wrapper.style.background = "transparent";

        const button = L.DomUtil.create("button", "", wrapper);
        button.type = "button";
        button.title = "Agregar KML o GeoJSON";
        button.setAttribute("aria-label", "Agregar KML o GeoJSON");
        button.style.width = "34px";
        button.style.height = "34px";
        button.style.display = "inline-flex";
        button.style.alignItems = "center";
        button.style.justifyContent = "center";
        button.style.border = "1px solid rgba(0,0,0,0.12)";
        button.style.borderRadius = "10px";
        button.style.background = "rgba(255,255,255,0.95)";
        button.style.backdropFilter = "blur(10px)";
        button.style.boxShadow = "0 10px 20px rgba(0,0,0,0.14)";
        button.style.cursor = "pointer";
        button.style.transition = "transform 120ms ease, box-shadow 120ms ease, background 120ms ease";
        button.style.color = "#7a1d31";
        button.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M6 18.5h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.45"/>
          </svg>
        `;

        L.DomEvent.disableClickPropagation(wrapper);
        L.DomEvent.disableScrollPropagation(wrapper);
        L.DomEvent.on(button, "click", (event) => {
          L.DomEvent.preventDefault(event);
          L.DomEvent.stopPropagation(event);
          openImportPanel();
        });
        L.DomEvent.on(button, "mouseenter", () => {
          button.style.boxShadow = "0 14px 28px rgba(0,0,0,0.18)";
          button.style.transform = "translateY(-1px)";
        });
        L.DomEvent.on(button, "mouseleave", () => {
          if (!button.disabled) {
            button.style.boxShadow = "0 10px 20px rgba(0,0,0,0.14)";
            button.style.transform = "translateY(0)";
          }
        });

        return wrapper;
      },
    });

    new LocateControl().addTo(map);
    new ImportControl().addTo(map);

    mapRef.current = map;

    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      map.remove();
      mapRef.current = null;
      groupRef.current = {};
      paneRef.current = {};
      boundsRef.current = {};
      lastPaneRef.current = {};
      lastOnRef.current = new Set();
      visibleIdsRef.current = new Set();
      tileStateRef.current = {};
      if (mosaicStatusFrameRef.current) cancelAnimationFrame(mosaicStatusFrameRef.current);
      if (moveResumeTimerRef.current) clearTimeout(moveResumeTimerRef.current);
      abortControllerRef(clickControllerRef);
      abortControllerRef(hoverControllerRef);
      if (locationOverlayRef.current) {
        locationOverlayRef.current.remove();
        locationOverlayRef.current = null;
      }
      if (importedOverlayRef.current) {
        importedOverlayRef.current.remove();
        importedOverlayRef.current = null;
      }
    };
  }, [openImportPanel]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

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
  }, [bindTileLayerProgress, layerOpacityMap, onLayerStatusChange, syncMosaicStatus, visibleDefs, zMap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

    if (mosaicStatus.isUpdating || movingRef.current) {
      mapBusyRef.current = true;
      if (!movingRef.current) updateCursor("wait");
      return undefined;
    }

    mapBusyRef.current = false;
    updateCursor("grab");

    if (pendingClickRef.current) {
      const latlng = pendingClickRef.current;
      pendingClickRef.current = null;
      runPopupQuery(latlng).catch((error) => {
        if (error?.name !== "AbortError") {
          console.error("Deferred popup query failed", error);
        }
      });
    }

    return undefined;
  }, [mosaicStatus.isUpdating, runPopupQuery, updateCursor]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

    const handleClick = async (event) => {
      closeContextMenu();
      pendingClickRef.current = event.latlng;

      if (mapBusyRef.current) {
        updateCursor("wait");
        return;
      }

      const latlng = pendingClickRef.current;
      pendingClickRef.current = null;
      try {
        await runPopupQuery(latlng);
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.error("Popup query failed", error);
        }
      }
    };

    const handleMouseMove = (event) => {
      setMouseCoordinates(formatCoordinatePair(event.latlng));
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      abortControllerRef(hoverControllerRef);

      if (mapBusyRef.current || hoverableDefs.length === 0) {
        updateCursor(mapBusyRef.current ? "wait" : "grab");
        return;
      }

      const seq = ++hoverSeqRef.current;

      hoverTimerRef.current = setTimeout(async () => {
        const controller = new AbortController();
        hoverControllerRef.current = controller;
        const result = await resolveTopmostFeatureAtLatLng({
          map,
          latlng: event.latlng,
          layers: hoverableDefs,
          signal: controller.signal,
          logErrors: false,
        });
        if (controller.signal.aborted || seq !== hoverSeqRef.current) return;
        map.getContainer().style.cursor = result ? "pointer" : "grab";
        hoverControllerRef.current = null;
      }, GEOSERVER_CONFIG.hoverDebounceMs);
    };

    const handleMouseOut = () => {
      hoverSeqRef.current += 1;
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      abortControllerRef(hoverControllerRef);
      updateCursor(mapBusyRef.current ? "wait" : "grab");
    };

    const handleContextMenu = (event) => {
      event.originalEvent?.preventDefault?.();
      event.originalEvent?.stopPropagation?.();
      const coordsText = formatCoordinatePair(event.latlng);
      const containerSize = map.getSize();
      const menuPosition = clampMenuPosition(
        event.containerPoint,
        { width: 252, height: 112 },
        containerSize
      );

      setContextMenuState({
        ...menuPosition,
        coordsText,
        copied: false,
      });
    };

    const handleMoveStart = () => {
      movingRef.current = true;
      mapBusyRef.current = true;
      closeContextMenu();
      hoverSeqRef.current += 1;
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (moveResumeTimerRef.current) clearTimeout(moveResumeTimerRef.current);
      abortControllerRef(hoverControllerRef);
      updateCursor("grabbing");
    };

    const handleMoveEnd = () => {
      if (moveResumeTimerRef.current) clearTimeout(moveResumeTimerRef.current);
      moveResumeTimerRef.current = window.setTimeout(() => {
        movingRef.current = false;
        if (mosaicStatus.isUpdating) {
          mapBusyRef.current = true;
          updateCursor("wait");
          return;
        }

        mapBusyRef.current = false;
        updateCursor("grab");
        if (pendingClickRef.current) {
          const latlng = pendingClickRef.current;
          pendingClickRef.current = null;
          runPopupQuery(latlng).catch((error) => {
            if (error?.name !== "AbortError") {
              console.error("Deferred popup query failed", error);
            }
          });
        }
      }, GEOSERVER_CONFIG.interactionResumeDelayMs);
    };

    map.on("click", handleClick);
    map.on("mousemove", handleMouseMove);
    map.on("mouseout", handleMouseOut);
    map.on("contextmenu", handleContextMenu);
    map.on("movestart", handleMoveStart);
    map.on("moveend", handleMoveEnd);
    return () => {
      map.off("click", handleClick);
      map.off("mousemove", handleMouseMove);
      map.off("mouseout", handleMouseOut);
      map.off("contextmenu", handleContextMenu);
      map.off("movestart", handleMoveStart);
      map.off("moveend", handleMoveEnd);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (moveResumeTimerRef.current) clearTimeout(moveResumeTimerRef.current);
      abortControllerRef(clickControllerRef);
      abortControllerRef(hoverControllerRef);
    };
  }, [closeContextMenu, hoverableDefs, mosaicStatus.isUpdating, queryableDefs, runPopupQuery, updateCursor]);

  useEffect(() => {
    if (!contextMenuState) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") closeContextMenu();
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closeContextMenu, contextMenuState]);

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%" }}
      onClick={() => {
        if (contextMenuState) closeContextMenu();
        if (importPanelState.open) closeImportPanel();
      }}
    >
      <input
        ref={importInputRef}
        type="file"
        accept=".geojson,.kml"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleImportedFile(file);
        }}
      />
      {mosaicStatus.isUpdating && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 24,
            transform: "translateX(-50%)",
            zIndex: 20002,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: 999,
            background: "rgba(34,34,34,0.84)",
            color: "#fff",
            boxShadow: "0 12px 28px rgba(0,0,0,0.24)",
            backdropFilter: "blur(10px)",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#dec9a3",
              boxShadow: "0 0 0 6px rgba(222,201,163,0.18)",
            }}
          />
          <span style={{ fontSize: 12.5, lineHeight: 1.2 }}>
            Actualizando mosaicos: {mosaicStatus.pendingLayers} capa{mosaicStatus.pendingLayers === 1 ? "" : "s"} y {mosaicStatus.pendingTiles} tesela{mosaicStatus.pendingTiles === 1 ? "" : "s"}
          </span>
          <span
            style={{
              width: 120,
              height: 6,
              borderRadius: 999,
              background: "rgba(255,255,255,0.18)",
              overflow: "hidden",
            }}
          >
            <span
              style={{
                display: "block",
                width: `${Math.max(8, Math.round((mosaicStatus.progress || 0) * 100))}%`,
                height: "100%",
                borderRadius: 999,
                background: "linear-gradient(90deg, #dec9a3, #bc955b)",
                transition: "width 140ms ease-out",
              }}
            />
          </span>
        </div>
      )}
      {importPanelState.open ? (
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            position: "absolute",
            top: 62,
            left: 54,
            zIndex: 20008,
            width: 298,
            padding: 14,
            borderRadius: 18,
            background: "rgba(255,255,255,0.96)",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 18px 38px rgba(0,0,0,0.2)",
            backdropFilter: "blur(14px)",
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "grid", gap: 3 }}>
              <strong style={{ fontSize: 13, color: "#202020" }}>Subir una capa</strong>
            </div>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={closeImportPanel}
              style={{
                width: 28,
                height: 28,
                border: "none",
                borderRadius: 999,
                background: "rgba(0,0,0,0.05)",
                color: "#7d7d7d",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div
            style={{
              padding: "2px 0 0",
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 11, color: "#7a1d31", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>
                Formatos habilitados
              </span>
              <span style={{ fontSize: 12.5, color: "#2e2e2e" }}>KML y GeoJSON</span>
            </div>
            <div style={{ height: 1, background: "linear-gradient(90deg, rgba(122,29,49,0.12), rgba(188,149,91,0.22), rgba(122,29,49,0.04))" }} />
            <div style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 11, color: "#7a1d31", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>
                Validación
              </span>
              <span style={{ fontSize: 12.5, color: "#2e2e2e" }}>Limita tus archivos a 12 MB.</span>
            </div>
          </div>
          <div style={{ display: "grid", gap: 5 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: 11.5, color: "#666", lineHeight: 1.45 }}>
                Solo se leen geometrías y atributos de texto. El contenido se sanitiza antes de mostrarse.
              </span>
              <div
                style={{ position: "relative", flexShrink: 0 }}
                onMouseEnter={() => setImportSanitizeHelpOpen(true)}
                onMouseLeave={() => setImportSanitizeHelpOpen(false)}
              >
                <button
                  type="button"
                  aria-label="Cómo funciona la sanitización"
                  onClick={() => setImportSanitizeHelpOpen((current) => !current)}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    border: "1px solid rgba(122,29,49,0.14)",
                    background: "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(188,149,91,0.12))",
                    color: "#7a1d31",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 6px 12px rgba(0,0,0,0.08)",
                    transition: "transform 120ms ease, box-shadow 120ms ease",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M12 10.2V16.1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <circle cx="12" cy="7.4" r="1.1" fill="currentColor" />
                  </svg>
                </button>
                {importSanitizeHelpOpen ? (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "calc(100% + 8px)",
                      width: 220,
                      padding: "10px 12px",
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.98)",
                      color: "#444",
                      fontSize: 11.5,
                      lineHeight: 1.5,
                      border: "1px solid rgba(122,29,49,0.12)",
                      boxShadow: "0 16px 30px rgba(0,0,0,0.12)",
                      zIndex: 8,
                    }}
                  >
                    Revisamos el archivo como texto, extraemos solo geometrías y atributos, y convertimos caracteres especiales para que se muestren como texto en vez de ejecutarse.
                  </div>
                ) : null}
              </div>
            </div>
            {importPanelState.error ? (
              <span
                style={{
                  fontSize: 11.5,
                  color: "#9f2241",
                  background: "rgba(159,34,65,0.08)",
                  border: "1px solid rgba(159,34,65,0.12)",
                  padding: "8px 10px",
                  borderRadius: 12,
                }}
              >
                {importPanelState.error}
              </span>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              disabled={importPanelState.loading}
              onClick={() => importInputRef.current?.click()}
              style={{
                flex: 1,
                padding: "11px 12px",
                borderRadius: 14,
                border: "1px solid rgba(122,29,49,0.14)",
                background: importPanelState.loading
                  ? "rgba(0,0,0,0.05)"
                  : "linear-gradient(135deg, rgba(122,29,49,0.08), rgba(188,149,91,0.18))",
                color: "#7a1d31",
                fontWeight: 700,
                fontSize: 12.5,
                cursor: importPanelState.loading ? "wait" : "pointer",
                boxShadow: "0 10px 20px rgba(0,0,0,0.08)",
              }}
            >
              {importPanelState.loading ? "Cargando..." : "Seleccionar archivo"}
            </button>
            <button
              type="button"
              onClick={closeImportPanel}
              style={{
                padding: "11px 12px",
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.08)",
                background: "rgba(255,255,255,0.8)",
                color: "#505050",
                fontWeight: 700,
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
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
      <div
        style={{
          position: "absolute",
          right: 12,
          bottom: 12,
          display: "flex",
          alignItems: "flex-end",
          gap: 10,
          zIndex: 9999,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            pointerEvents: "auto",
            minWidth: 220,
            maxWidth: 280,
            padding: "10px 12px",
            borderRadius: 14,
            background: "rgba(255,255,255,0.88)",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 10px 24px rgba(0,0,0,.12)",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, rgba(122,29,49,0.08), rgba(188,149,91,0.16))",
              color: "#7a1d31",
              flex: "0 0 30px",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 21s6-5.2 6-11a6 6 0 10-12 0c0 5.8 6 11 6 11zm0-8.2a2.8 2.8 0 110-5.6 2.8 2.8 0 010 5.6z"
                fill="currentColor"
              />
            </svg>
          </span>
          <div
            style={{
              minWidth: 0,
              display: "grid",
              gap: 2,
            }}
          >
            <div
              style={{
                fontFamily: '"Montserrat", sans-serif',
                fontVariantNumeric: "tabular-nums",
                fontSize: 13.5,
                lineHeight: 1.2,
                color: "#1f1f1f",
                letterSpacing: "0.01em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {mouseCoordinates}
            </div>
            <span style={{ fontSize: 10.5, color: "#6c6c6c", letterSpacing: "0.02em" }}>Coordenadas</span>
          </div>
        </div>
        <LegendDock
          legends={legends}
          activeLayers={visibleDefs}
          layerOpacityMap={layerOpacityMap}
          onLayerOpacityChange={onLayerOpacityChange}
          onManyLayerOpacityChange={onManyLayerOpacityChange}
          style={{ pointerEvents: "auto" }}
        />
      </div>
      {contextMenuState ? (
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            position: "absolute",
            left: contextMenuState.left,
            top: contextMenuState.top,
            zIndex: 20010,
            width: 318,
            minHeight: 112,
            borderRadius: 22,
            background: "rgba(255,255,255,0.97)",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 22px 46px rgba(0,0,0,0.22)",
            backdropFilter: "blur(14px)",
            overflow: "hidden",
            display: "flex",
          }}
        >
          <div
            style={{
              position: "relative",
              width: 88,
              flex: "0 0 88px",
              background: "linear-gradient(180deg, #bc955b 0%, #9f2241 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <span
              style={{
                position: "absolute",
                right: -26,
                top: 0,
                bottom: 0,
                width: 54,
                background: "rgba(255,255,255,0.96)",
                clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%, 62% 50%)",
              }}
            />
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.34)",
                background: "rgba(255,255,255,0.12)",
                boxShadow: "0 10px 18px rgba(58,20,32,0.14)",
                zIndex: 1,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 21s6-5.2 6-11a6 6 0 10-12 0c0 5.8 6 11 6 11zm0-8.2a2.8 2.8 0 110-5.6 2.8 2.8 0 010 5.6z"
                  fill="currentColor"
                />
              </svg>
            </span>
          </div>
          <div
            style={{
              position: "relative",
              flex: 1,
              padding: "14px 14px 12px 18px",
              display: "grid",
              alignContent: "center",
              gap: 10,
            }}
          >
            <button
              type="button"
              aria-label="Cerrar"
              onClick={(event) => {
                event.stopPropagation();
                closeContextMenu();
              }}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                width: 28,
                height: 28,
                border: "none",
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#7d7d7d",
                background: "rgba(0,0,0,0.05)",
                transition: "background 120ms ease, color 120ms ease, transform 120ms ease",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <div style={{ display: "grid", gap: 3, paddingRight: 18 }}>
              <strong style={{ fontSize: 13, color: "#202020" }}>Coordenadas del punto</strong>
              <span
                style={{
                  fontSize: 14,
                  color: "#3a3a3a",
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: "0.01em",
                }}
              >
                {contextMenuState.coordsText}
              </span>
            </div>
            <button
              type="button"
              onClick={() => copyCoordinates(contextMenuState.coordsText)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "11px 12px",
                borderRadius: 14,
                border: "1px solid rgba(122,29,49,0.14)",
                background: contextMenuState.copied
                  ? "linear-gradient(135deg, rgba(36,133,93,0.12), rgba(77,187,133,0.18))"
                  : "linear-gradient(135deg, rgba(122,29,49,0.08), rgba(188,149,91,0.18))",
                color: contextMenuState.copied ? "#1f6b4c" : "#7a1d31",
                cursor: "pointer",
                transition: "transform 120ms ease, box-shadow 120ms ease, background 120ms ease",
                boxShadow: "0 10px 20px rgba(0,0,0,0.08)",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: 12.5 }}>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(255,255,255,0.7)",
                  }}
                >
                  {contextMenuState.copied ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M20 7L10 17l-5-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="9" y="9" width="10" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
                      <path d="M7 15H6a2 2 0 01-2-2V6a2 2 0 012-2h7a2 2 0 012 2v1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  )}
                </span>
                {contextMenuState.copied ? "Coordenadas copiadas" : "Copiar coordenadas"}
              </span>
              <span style={{ fontSize: 11.5, opacity: 0.78 }}>
                {contextMenuState.copied ? "Listo" : "Click"}
              </span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
