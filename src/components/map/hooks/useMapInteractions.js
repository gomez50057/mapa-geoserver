import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import { GEOSERVER_CONFIG } from "@/config/geoserver";
import { resolveTopmostFeatureAtLatLng } from "@/lib/geoserver/interaction";
import { renderPopupContent } from "@/data/popupSchemas";
import { formatCoordinatePair } from "../utils/shared";

function clampMenuPosition(point, menuSize, containerSize) {
  const left = Math.max(12, Math.min(point.x - menuSize.width + 22, containerSize.x - menuSize.width - 12));
  const top = Math.max(12, Math.min(point.y - menuSize.height - 14, containerSize.y - menuSize.height - 12));
  return { left, top };
}

function abortControllerRef(controllerRef) {
  controllerRef.current?.abort?.();
  controllerRef.current = null;
}

export function useMapInteractions({
  mapRef,
  queryableDefs,
  hoverableDefs,
  activeDrawingTool,
  editingFeatureId,
  isMosaicUpdating,
}) {
  const hoverTimerRef = useRef(null);
  const hoverSeqRef = useRef(0);
  const moveResumeTimerRef = useRef(null);
  const clickControllerRef = useRef(null);
  const hoverControllerRef = useRef(null);
  const movingRef = useRef(false);
  const mapBusyRef = useRef(false);
  const pendingClickRef = useRef(null);

  const [mouseCoordinates, setMouseCoordinates] = useState(formatCoordinatePair(null));
  const [contextMenuState, setContextMenuState] = useState(null);

  const updateCursor = useCallback(
    (cursor) => {
      const map = mapRef.current;
      if (!map) return;
      map.getContainer().style.cursor = cursor;
    },
    [mapRef]
  );

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

  const cleanupInteractions = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (moveResumeTimerRef.current) clearTimeout(moveResumeTimerRef.current);
    abortControllerRef(clickControllerRef);
    abortControllerRef(hoverControllerRef);
  }, []);

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
    [mapRef, queryableDefs, updateCursor]
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

    const handleClick = async (event) => {
      if (activeDrawingTool || editingFeatureId) return;
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
      if (activeDrawingTool || editingFeatureId) {
        if (!movingRef.current && !mapBusyRef.current) updateCursor("crosshair");
        return;
      }
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
      if (activeDrawingTool || editingFeatureId) {
        updateCursor("crosshair");
        return;
      }
      hoverSeqRef.current += 1;
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      abortControllerRef(hoverControllerRef);
      updateCursor(mapBusyRef.current ? "wait" : "grab");
    };

    const handleContextMenu = (event) => {
      if (activeDrawingTool || editingFeatureId) {
        event.originalEvent?.preventDefault?.();
        event.originalEvent?.stopPropagation?.();
        return;
      }
      event.originalEvent?.preventDefault?.();
      event.originalEvent?.stopPropagation?.();
      const coordsText = formatCoordinatePair(event.latlng);
      const containerSize = map.getSize();
      const menuPosition = clampMenuPosition(event.containerPoint, { width: 252, height: 112 }, containerSize);

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
      updateCursor(activeDrawingTool || editingFeatureId ? "crosshair" : "grabbing");
    };

    const handleMoveEnd = () => {
      if (moveResumeTimerRef.current) clearTimeout(moveResumeTimerRef.current);
      moveResumeTimerRef.current = window.setTimeout(() => {
        movingRef.current = false;
        if (isMosaicUpdating) {
          mapBusyRef.current = true;
          updateCursor(activeDrawingTool || editingFeatureId ? "crosshair" : "wait");
          return;
        }

        mapBusyRef.current = false;
        updateCursor(activeDrawingTool || editingFeatureId ? "crosshair" : "grab");
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
      cleanupInteractions();
    };
  }, [
    activeDrawingTool,
    cleanupInteractions,
    closeContextMenu,
    editingFeatureId,
    hoverableDefs,
    isMosaicUpdating,
    mapRef,
    runPopupQuery,
    updateCursor,
  ]);

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

  useEffect(() => {
    if (movingRef.current) return;
    mapBusyRef.current = Boolean(isMosaicUpdating);
    updateCursor(activeDrawingTool || editingFeatureId ? "crosshair" : isMosaicUpdating ? "wait" : "grab");
  }, [activeDrawingTool, editingFeatureId, isMosaicUpdating, updateCursor]);

  return {
    mouseCoordinates,
    contextMenuState,
    closeContextMenu,
    copyCoordinates,
    cleanupInteractions,
  };
}
