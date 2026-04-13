import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  buildDrawingMeasurement,
  buildDrawingPopupHtml,
  buildFeatureMeasurementLayers,
  computeGeodesicArea,
  computeLineDistance,
  destinationPoint,
  DRAW_TOOL_DEFAULT_HELPERS,
  featureToKmlPlacemark,
  formatArea,
  formatDistance,
  getFeatureSummary,
  getRectangleLatLngs,
} from "../utils/drawingUtils";
import { escapeHtml, formatCoordinatePair } from "../utils/shared";

export function useDrawingTools({ mapRef }) {
  const drawingLayerGroupRef = useRef(null);
  const drawingPreviewGroupRef = useRef(null);
  const drawingEditHandlesRef = useRef(null);
  const drawingStateRef = useRef({
    tool: null,
    points: [],
    anchor: null,
  });
  const drawnFeaturesRef = useRef([]);
  const editingSnapshotRef = useRef(null);
  const drawClickTimerRef = useRef(null);

  const [drawingPanelOpen, setDrawingPanelOpen] = useState(false);
  const [activeDrawingTool, setActiveDrawingTool] = useState(null);
  const [drawnFeaturesState, setDrawnFeaturesState] = useState([]);
  const [editingFeatureId, setEditingFeatureId] = useState(null);
  const [drawingDraftState, setDrawingDraftState] = useState({
    tool: null,
    pointsCount: 0,
    canFinish: false,
    helperText: "",
    measurementText: "",
  });
  const [drawnFeatureCount, setDrawnFeatureCount] = useState(0);

  const syncDrawingDraft = useCallback((overrides = {}) => {
    const session = {
      ...drawingStateRef.current,
      ...overrides,
      points: overrides.points ?? drawingStateRef.current.points ?? [],
    };

    const helperText = session.tool
      ? DRAW_TOOL_DEFAULT_HELPERS[session.tool] || "Sigue trazando sobre el mapa."
      : "Elige una herramienta y comienza a dibujar sobre el mapa.";

    let measurementText = "";
    let canFinish = false;

    if (session.tool === "line") {
      canFinish = session.points.length >= 2;
      if (session.points.length >= 2) {
        measurementText = `Longitud actual: ${formatDistance(computeLineDistance(session.points))}`;
      }
    } else if (session.tool === "polygon") {
      canFinish = session.points.length >= 3;
      if (session.points.length >= 3) {
        measurementText = `Área estimada: ${formatArea(computeGeodesicArea(session.points))}`;
      }
    } else if (session.tool === "rectangle" && session.anchor && session.points[0]) {
      const previewBounds = L.latLngBounds(session.anchor, session.points[0]);
      measurementText = `Área estimada: ${formatArea(computeGeodesicArea(getRectangleLatLngs(previewBounds)))}`;
    } else if (session.tool === "circle" && session.anchor && session.points[0]) {
      measurementText = `Radio actual: ${formatDistance(session.anchor.distanceTo(session.points[0]))}`;
    } else if (session.tool === "point" && session.points[0]) {
      measurementText = `Punto: ${formatCoordinatePair(session.points[0])}`;
    }

    setDrawingDraftState({
      tool: session.tool,
      pointsCount: session.points.length,
      canFinish,
      helperText,
      measurementText,
    });
  }, []);

  const clearDrawingPreview = useCallback(() => {
    drawingPreviewGroupRef.current?.clearLayers?.();
  }, []);

  const renderDrawnFeatures = useCallback(() => {
    const group = drawingLayerGroupRef.current;
    if (!group) return;

    group.clearLayers();

    drawnFeaturesRef.current.forEach((feature) => {
      let layer = null;
      if (feature.type === "point" && feature.point) {
        layer = L.circleMarker(feature.point, {
          pane: "pane_drawn_shapes",
          radius: 7,
          color: "#ffffff",
          weight: 2,
          fillColor: feature.id === editingFeatureId ? "#bc955b" : "#7a1d31",
          fillOpacity: 1,
        });
      } else if (feature.type === "line" && feature.latlngs?.length >= 2) {
        layer = L.polyline(feature.latlngs, {
          pane: "pane_drawn_shapes",
          color: feature.id === editingFeatureId ? "#bc955b" : "#7a1d31",
          weight: feature.id === editingFeatureId ? 3.6 : 3,
          opacity: 0.95,
        });
      } else if (feature.type === "circle" && feature.center && feature.radius > 0) {
        layer = L.circle(feature.center, {
          pane: "pane_drawn_shapes",
          radius: feature.radius,
          color: feature.id === editingFeatureId ? "#bc955b" : "#7a1d31",
          weight: feature.id === editingFeatureId ? 3.2 : 2.6,
          opacity: 0.95,
          fillColor: "#bc955b",
          fillOpacity: 0.18,
        });
      } else if ((feature.type === "polygon" || feature.type === "rectangle") && feature.latlngs?.length >= 3) {
        layer = L.polygon(feature.latlngs, {
          pane: "pane_drawn_shapes",
          color: feature.id === editingFeatureId ? "#bc955b" : "#7a1d31",
          weight: feature.id === editingFeatureId ? 3.2 : 2.6,
          opacity: 0.95,
          fillColor: "#bc955b",
          fillOpacity: 0.18,
        });
      }

      if (!layer) return;
      layer.addTo(group);
      layer.bindPopup(buildDrawingPopupHtml(feature));
      layer.on("click", () => setEditingFeatureId((current) => current ?? feature.id));

      buildFeatureMeasurementLayers(feature).forEach((measurementLayer) => measurementLayer.addTo(group));
    });

    setDrawnFeaturesState(
      drawnFeaturesRef.current.map((feature) => ({
        id: feature.id,
        label: feature.label,
        typeLabel: feature.typeLabel,
        summary: getFeatureSummary(feature),
      }))
    );
    setDrawnFeatureCount(drawnFeaturesRef.current.length);
  }, [editingFeatureId]);

  const clearDrawingSession = useCallback(() => {
    drawingStateRef.current = {
      tool: activeDrawingTool,
      points: [],
      anchor: null,
    };
    clearDrawingPreview();
    syncDrawingDraft();
  }, [activeDrawingTool, clearDrawingPreview, syncDrawingDraft]);

  const updateDrawingPreview = useCallback((cursorLatLng = null) => {
    const map = mapRef.current;
    const previewGroup = drawingPreviewGroupRef.current;
    const session = drawingStateRef.current;
    if (!map || !previewGroup) return;

    previewGroup.clearLayers();
    if (!session.tool) return;

    const previewOptions = {
      pane: "pane_drawn_preview",
      color: "#7a1d31",
      weight: 2.4,
      opacity: 0.92,
      fillColor: "#bc955b",
      fillOpacity: 0.14,
      dashArray: "8 6",
    };

    const markerOptions = {
      pane: "pane_drawn_preview",
      radius: 4.5,
      color: "#fff",
      weight: 1.6,
      fillColor: "#7a1d31",
      fillOpacity: 1,
    };

    const previewPoints = session.points.slice();
    if (cursorLatLng && (session.tool === "line" || session.tool === "polygon")) {
      previewPoints.push(cursorLatLng);
    }

    if (session.tool === "point" && cursorLatLng) {
      L.circleMarker(cursorLatLng, markerOptions).addTo(previewGroup);
    }

    session.points.forEach((point) => {
      L.circleMarker(point, markerOptions).addTo(previewGroup);
    });

    let infoLatLng = cursorLatLng || session.points.at(-1) || session.anchor || null;
    let infoText = "";

    if (session.tool === "line" && previewPoints.length > 1) {
      L.polyline(previewPoints, previewOptions).addTo(previewGroup);
      infoText = `Longitud: ${formatDistance(computeLineDistance(previewPoints))}`;
    }

    if (session.tool === "polygon" && previewPoints.length > 1) {
      if (previewPoints.length >= 3) {
        L.polygon(previewPoints, previewOptions).addTo(previewGroup);
        infoText = `Área: ${formatArea(computeGeodesicArea(previewPoints))}`;
      } else {
        L.polyline(previewPoints, previewOptions).addTo(previewGroup);
      }
    }

    if (session.tool === "rectangle" && session.anchor && cursorLatLng) {
      const bounds = L.latLngBounds(session.anchor, cursorLatLng);
      L.rectangle(bounds, previewOptions).addTo(previewGroup);
      infoText = `Área: ${formatArea(computeGeodesicArea(getRectangleLatLngs(bounds)))}`;
    }

    if (session.tool === "circle" && session.anchor && cursorLatLng) {
      const radius = session.anchor.distanceTo(cursorLatLng);
      L.circle(session.anchor, { ...previewOptions, radius }).addTo(previewGroup);
      infoLatLng = cursorLatLng;
      infoText = `Radio: ${formatDistance(radius)}`;
    }

    if (infoLatLng && infoText) {
      L.marker(infoLatLng, {
        pane: "pane_drawn_preview",
        interactive: false,
        icon: L.divIcon({
          className: "drawing-inline-measure-preview",
          iconSize: null,
          html: `
            <span
              style="
                display:inline-flex;
                align-items:center;
                justify-content:center;
                padding:2px 7px;
                border-radius:999px;
                background:rgba(105,27,50,0.82);
                color:#fff;
                font-family:Montserrat,sans-serif;
                font-size:11px;
                font-weight:700;
                line-height:1;
                letter-spacing:.01em;
                border:1px solid rgba(255,255,255,0.24);
                box-shadow:0 6px 14px rgba(0,0,0,0.14);
                white-space:nowrap;
                backdrop-filter:blur(6px);
              "
            >${escapeHtml(infoText)}</span>
          `,
        }),
      }).addTo(previewGroup);
    }
  }, [mapRef]);

  const finalizeDrawingFeature = useCallback(
    ({ type, latlngs = [], point = null, center = null, radius = 0, bounds = null }) => {
      const map = mapRef.current;
      if (!map) return;

      let label = "Trazo";
      const typeLabelMap = {
        point: "Punto",
        line: "Línea",
        polygon: "Polígono",
        rectangle: "Rectángulo",
        circle: "Círculo",
      };
      const typeLabel = typeLabelMap[type] || "Trazo";

      if (type === "point" && point) {
        label = `Punto ${drawnFeaturesRef.current.length + 1}`;
      } else if (type === "line" && latlngs.length >= 2) {
        label = `Línea ${drawnFeaturesRef.current.length + 1}`;
      } else if (type === "circle" && center && radius > 0) {
        label = `Círculo ${drawnFeaturesRef.current.length + 1}`;
      } else if (type === "rectangle" && bounds) {
        label = `Rectángulo ${drawnFeaturesRef.current.length + 1}`;
        latlngs = getRectangleLatLngs(bounds);
      } else if (type === "polygon" && latlngs.length >= 3) {
        label = `Polígono ${drawnFeaturesRef.current.length + 1}`;
      }

      const measurement = buildDrawingMeasurement({ type, latlngs, center, radius, point, bounds });
      const feature = {
        id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        typeLabel,
        label,
        point,
        center,
        radius,
        latlngs,
        measurement,
      };

      drawnFeaturesRef.current = [...drawnFeaturesRef.current, feature];
      renderDrawnFeatures();
      clearDrawingSession();
    },
    [clearDrawingSession, mapRef, renderDrawnFeatures]
  );

  const finalizeCurrentDrawing = useCallback(() => {
    const session = drawingStateRef.current;
    if (!session.tool) return;

    if (session.tool === "line" && session.points.length >= 2) {
      finalizeDrawingFeature({ type: "line", latlngs: session.points.slice() });
      return;
    }

    if (session.tool === "polygon" && session.points.length >= 3) {
      finalizeDrawingFeature({ type: "polygon", latlngs: session.points.slice() });
    }
  }, [finalizeDrawingFeature]);

  const clearAllDrawings = useCallback(() => {
    drawingLayerGroupRef.current?.clearLayers?.();
    drawingEditHandlesRef.current?.clearLayers?.();
    drawnFeaturesRef.current = [];
    setDrawnFeaturesState([]);
    setDrawnFeatureCount(0);
    setEditingFeatureId(null);
    editingSnapshotRef.current = null;
    clearDrawingSession();
  }, [clearDrawingSession]);

  const downloadDrawingsAsKml = useCallback(() => {
    if (!drawnFeaturesRef.current.length) return;

    const placemarks = drawnFeaturesRef.current.map(featureToKmlPlacemark).join("");
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Trazos del mapa</name>
    ${placemarks}
  </Document>
</kml>`;

    const blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `trazos-mapa-${new Date().toISOString().slice(0, 10)}.kml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const buildEditingHandles = useCallback(
    (feature) => {
      const map = mapRef.current;
      const handlesGroup = drawingEditHandlesRef.current;
      if (!map || !handlesGroup || !feature) return;

      handlesGroup.clearLayers();

      const makeHandle = (latlng, onDrag) => {
        const marker = L.marker(latlng, {
          pane: "pane_drawn_preview",
          draggable: true,
          autoPan: true,
          icon: L.divIcon({
            className: "drawing-edit-handle",
            html: `<span style="width:14px;height:14px;border-radius:999px;background:#bc955b;border:2px solid #fff;box-shadow:0 8px 18px rgba(0,0,0,0.16);display:block;"></span>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          }),
        });
        marker.on("drag", (event) => onDrag(event.target.getLatLng()));
        marker.addTo(handlesGroup);
      };

      const updateFeature = (updater) => {
        drawnFeaturesRef.current = drawnFeaturesRef.current.map((current) => {
          if (current.id !== feature.id) return current;
          const updated = updater(current);
          return {
            ...updated,
            measurement: buildDrawingMeasurement(updated),
          };
        });
        renderDrawnFeatures();
      };

      if (feature.type === "point") {
        makeHandle(feature.point, (latlng) =>
          updateFeature((current) => ({
            ...current,
            point: latlng,
          }))
        );
        return;
      }

      if (feature.type === "line" || feature.type === "polygon" || feature.type === "rectangle") {
        feature.latlngs.forEach((latlng, index) => {
          makeHandle(latlng, (nextLatLng) =>
            updateFeature((current) => {
              const nextLatLngs = current.latlngs.map((point, pointIndex) => (pointIndex === index ? nextLatLng : point));
              if (current.type === "rectangle" && nextLatLngs.length >= 4) {
                const oppositeIndex = index === 0 ? 2 : index === 2 ? 0 : index === 1 ? 3 : 1;
                const bounds = L.latLngBounds(nextLatLng, nextLatLngs[oppositeIndex]);
                return { ...current, latlngs: getRectangleLatLngs(bounds) };
              }
              return { ...current, latlngs: nextLatLngs };
            })
          );
        });
        return;
      }

      if (feature.type === "circle") {
        makeHandle(feature.center, (nextCenter) =>
          updateFeature((current) => ({
            ...current,
            center: nextCenter,
          }))
        );
        makeHandle(destinationPoint(feature.center, feature.radius, 90), (edgeLatLng) =>
          updateFeature((current) => ({
            ...current,
            radius: current.center.distanceTo(edgeLatLng),
          }))
        );
      }
    },
    [mapRef, renderDrawnFeatures]
  );

  const handleEditFeature = useCallback(
    (featureId) => {
      const feature = drawnFeaturesRef.current.find((current) => current.id === featureId);
      if (!feature) return;
      setDrawingPanelOpen(true);
      setActiveDrawingTool(null);
      setEditingFeatureId(featureId);
      editingSnapshotRef.current = JSON.parse(JSON.stringify(feature));
      clearDrawingSession();
      buildEditingHandles(feature);
    },
    [buildEditingHandles, clearDrawingSession]
  );

  const handleDeleteFeature = useCallback(
    (featureId) => {
      drawnFeaturesRef.current = drawnFeaturesRef.current.filter((feature) => feature.id !== featureId);
      if (editingFeatureId === featureId) {
        setEditingFeatureId(null);
        editingSnapshotRef.current = null;
        drawingEditHandlesRef.current?.clearLayers?.();
      }
      renderDrawnFeatures();
    },
    [editingFeatureId, renderDrawnFeatures]
  );

  const handleSaveFeatureEdit = useCallback(() => {
    setEditingFeatureId(null);
    editingSnapshotRef.current = null;
    drawingEditHandlesRef.current?.clearLayers?.();
    renderDrawnFeatures();
  }, [renderDrawnFeatures]);

  const handleCancelFeatureEdit = useCallback(() => {
    if (!editingFeatureId || !editingSnapshotRef.current) return;
    drawnFeaturesRef.current = drawnFeaturesRef.current.map((feature) =>
      feature.id === editingFeatureId ? { ...editingSnapshotRef.current, measurement: buildDrawingMeasurement(editingSnapshotRef.current) } : feature
    );
    setEditingFeatureId(null);
    editingSnapshotRef.current = null;
    drawingEditHandlesRef.current?.clearLayers?.();
    renderDrawnFeatures();
  }, [editingFeatureId, renderDrawnFeatures]);

  const closeDrawingPanel = useCallback(() => {
    setDrawingPanelOpen(false);
    setActiveDrawingTool(null);
    setEditingFeatureId(null);
    editingSnapshotRef.current = null;
    drawingStateRef.current = { tool: null, points: [], anchor: null };
    clearDrawingPreview();
    drawingEditHandlesRef.current?.clearLayers?.();
    setDrawingDraftState({
      tool: null,
      pointsCount: 0,
      canFinish: false,
      helperText: "",
      measurementText: "",
    });
  }, [clearDrawingPreview]);

  const openDrawingPanel = useCallback(() => {
    setDrawingPanelOpen(true);
  }, []);

  const handleSelectDrawingTool = useCallback(
    (toolId) => {
      setDrawingPanelOpen(true);
      setActiveDrawingTool((current) => {
        const nextTool = current === toolId ? null : toolId;
        setEditingFeatureId(null);
        editingSnapshotRef.current = null;
        drawingStateRef.current = {
          tool: nextTool,
          points: [],
          anchor: null,
        };
        clearDrawingPreview();
        drawingEditHandlesRef.current?.clearLayers?.();
        syncDrawingDraft({
          tool: nextTool,
          points: [],
          anchor: null,
        });
        return nextTool;
      });
    },
    [clearDrawingPreview, syncDrawingDraft]
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

    if (activeDrawingTool || editingFeatureId) {
      map.doubleClickZoom.disable();
    } else {
      map.doubleClickZoom.enable();
      clearDrawingPreview();
      if (!activeDrawingTool) {
        drawingStateRef.current = { tool: null, points: [], anchor: null };
        syncDrawingDraft({ tool: null, points: [], anchor: null });
      }
    }

    return () => {
      map.doubleClickZoom.enable();
    };
  }, [activeDrawingTool, clearDrawingPreview, editingFeatureId, mapRef, syncDrawingDraft]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

    const handleDrawingClick = (event) => {
      if (!activeDrawingTool) return;

      const session = drawingStateRef.current;
      const latlng = event.latlng;

      if (activeDrawingTool === "point") {
        finalizeDrawingFeature({ type: "point", point: latlng });
        return;
      }

      if (activeDrawingTool === "line" || activeDrawingTool === "polygon") {
        if (drawClickTimerRef.current) clearTimeout(drawClickTimerRef.current);
        drawClickTimerRef.current = window.setTimeout(() => {
          const latestSession = drawingStateRef.current;
          const nextPoints = [...latestSession.points, latlng];
          drawingStateRef.current = {
            tool: activeDrawingTool,
            points: nextPoints,
            anchor: null,
          };
          syncDrawingDraft({ tool: activeDrawingTool, points: nextPoints, anchor: null });
          updateDrawingPreview();
          drawClickTimerRef.current = null;
        }, 180);
        return;
      }

      if (activeDrawingTool === "rectangle" || activeDrawingTool === "circle") {
        if (!session.anchor) {
          drawingStateRef.current = {
            tool: activeDrawingTool,
            points: [],
            anchor: latlng,
          };
          syncDrawingDraft({ tool: activeDrawingTool, points: [], anchor: latlng });
          updateDrawingPreview();
          return;
        }

        if (activeDrawingTool === "rectangle") {
          finalizeDrawingFeature({
            type: "rectangle",
            bounds: L.latLngBounds(session.anchor, latlng),
          });
          return;
        }

        finalizeDrawingFeature({
          type: "circle",
          center: session.anchor,
          radius: session.anchor.distanceTo(latlng),
        });
      }
    };

    const handleDrawingMouseMove = (event) => {
      if (!activeDrawingTool) return;

      const session = drawingStateRef.current;
      if (activeDrawingTool === "point" || activeDrawingTool === "line" || activeDrawingTool === "polygon") {
        updateDrawingPreview(event.latlng);
        return;
      }

      if ((activeDrawingTool === "rectangle" || activeDrawingTool === "circle") && session.anchor) {
        drawingStateRef.current = {
          ...session,
          points: [event.latlng],
        };
        syncDrawingDraft({
          tool: activeDrawingTool,
          points: [event.latlng],
          anchor: session.anchor,
        });
        updateDrawingPreview(event.latlng);
      }
    };

    const handleDrawingDoubleClick = (event) => {
      if (!activeDrawingTool) return;
      if (activeDrawingTool === "line" || activeDrawingTool === "polygon") {
        if (drawClickTimerRef.current) {
          clearTimeout(drawClickTimerRef.current);
          drawClickTimerRef.current = null;
        }
        const session = drawingStateRef.current;
        const nextPoints = [...session.points, event.latlng];
        const dedupedPoints =
          nextPoints.length >= 2 && nextPoints.at(-1).distanceTo(nextPoints.at(-2)) < 1 ? nextPoints.slice(0, -1) : nextPoints;
        drawingStateRef.current = {
          tool: activeDrawingTool,
          points: dedupedPoints,
          anchor: null,
        };
        finalizeCurrentDrawing();
      }
    };

    map.on("click", handleDrawingClick);
    map.on("mousemove", handleDrawingMouseMove);
    map.on("dblclick", handleDrawingDoubleClick);

    return () => {
      if (drawClickTimerRef.current) {
        clearTimeout(drawClickTimerRef.current);
        drawClickTimerRef.current = null;
      }
      map.off("click", handleDrawingClick);
      map.off("mousemove", handleDrawingMouseMove);
      map.off("dblclick", handleDrawingDoubleClick);
    };
  }, [activeDrawingTool, finalizeCurrentDrawing, finalizeDrawingFeature, mapRef, syncDrawingDraft, updateDrawingPreview]);

  useEffect(() => {
    renderDrawnFeatures();
    if (!editingFeatureId) {
      drawingEditHandlesRef.current?.clearLayers?.();
      return;
    }

    const feature = drawnFeaturesRef.current.find((current) => current.id === editingFeatureId);
    if (!feature) {
      drawingEditHandlesRef.current?.clearLayers?.();
      return;
    }

    buildEditingHandles(feature);
  }, [buildEditingHandles, editingFeatureId, renderDrawnFeatures]);

  const hasDrawingSession = useMemo(
    () => drawingDraftState.pointsCount > 0 || Boolean(drawingStateRef.current.anchor),
    [drawingDraftState.pointsCount]
  );

  return {
    drawingLayerGroupRef,
    drawingPreviewGroupRef,
    drawingEditHandlesRef,
    drawingStateRef,
    activeDrawingTool,
    editingFeatureId,
    drawingPanelOpen,
    drawingDraftState,
    drawnFeaturesState,
    drawnFeatureCount,
    hasDrawingSession,
    setEditingFeatureId,
    closeDrawingPanel,
    openDrawingPanel,
    handleSelectDrawingTool,
    finalizeCurrentDrawing,
    clearDrawingSession,
    clearAllDrawings,
    downloadDrawingsAsKml,
    handleEditFeature,
    handleDeleteFeature,
    handleSaveFeatureEdit,
    handleCancelFeatureEdit,
    clearDrawingPreview,
    renderDrawnFeatures,
  };
}
