"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import LegendDock from "./LegendDock";
import DrawingToolsPanel from "./DrawingToolsPanel";
import ImportLayerPanel from "./ImportLayerPanel";
import ExportPdfPanel from "./ExportPdfPanel";
import MapContextMenu from "./MapContextMenu";
import { addMapControls } from "./utils/controls";
import { HIDALGO_REGION_BOUNDS } from "@/config/geoserver";
import { IMPORT_LAYER_PANE } from "./utils/importUtils";
import { DRAW_LAYER_PANE, DRAW_PREVIEW_PANE } from "./utils/drawingUtils";
import { useImportedLayer } from "./hooks/useImportedLayer";
import { usePdfExport } from "./hooks/usePdfExport";
import { useDrawingTools } from "./hooks/useDrawingTools";
import { useMapInteractions } from "./hooks/useMapInteractions";
import { useMapLayersRuntime } from "./hooks/useMapLayersRuntime";

const FALLBACK_BOUNDS = L.latLngBounds(HIDALGO_REGION_BOUNDS[0], HIDALGO_REGION_BOUNDS[1]);
const clampZ = (z) => Math.max(-9999, Math.min(9999, Math.round(Number(z ?? 400))));

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
  const paneRef = useRef({});
  const locationOverlayRef = useRef(null);
  const importedOverlayRef = useRef(null);
  const importInputRef = useRef(null);

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

  const {
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
    closeDrawingPanel,
    openDrawingPanel: openDrawingPanelBase,
    handleSelectDrawingTool,
    finalizeCurrentDrawing,
    clearDrawingSession,
    clearAllDrawings,
    downloadDrawingsAsKml,
    handleEditFeature,
    handleDeleteFeature,
    handleSaveFeatureEdit,
    handleCancelFeatureEdit,
  } = useDrawingTools({ mapRef });

  const { visibleDefs, mosaicStatus, cleanupLayersRuntime } = useMapLayersRuntime({
    mapRef,
    selectedLayers,
    zMap,
    layerOpacityMap,
    onLayerStatusChange,
  });

  const {
    mouseCoordinates,
    contextMenuState,
    closeContextMenu,
    copyCoordinates,
    cleanupInteractions,
  } = useMapInteractions({
    mapRef,
    queryableDefs,
    hoverableDefs,
    activeDrawingTool,
    editingFeatureId,
    isMosaicUpdating: mosaicStatus.isUpdating,
  });

  const {
    importPanelState,
    importSanitizeHelpOpen,
    setImportSanitizeHelpOpen,
    openImportPanel: openImportPanelBase,
    closeImportPanel,
    handleImportedFile,
  } = useImportedLayer({
    mapRef,
    importedOverlayRef,
    importInputRef,
  });

  const {
    exportPanelState,
    openExportPanel: openExportPanelBase,
    closeExportPanel,
    handleExportPaperChange,
    handleExportPdf,
  } = usePdfExport({
    mapDivRef,
    mapRef,
    legends,
  });

  const openImportPanel = useCallback(() => {
    closeDrawingPanel();
    closeExportPanel();
    openImportPanelBase();
  }, [closeDrawingPanel, closeExportPanel, openImportPanelBase]);

  const openExportPanel = useCallback(() => {
    closeDrawingPanel();
    closeImportPanel();
    openExportPanelBase();
  }, [closeDrawingPanel, closeImportPanel, openExportPanelBase]);

  const openDrawingPanel = useCallback(() => {
    closeExportPanel();
    closeImportPanel();
    openDrawingPanelBase();
  }, [closeExportPanel, closeImportPanel, openDrawingPanelBase]);

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

    ensurePane(map, paneRef, DRAW_LAYER_PANE, 760);
    ensurePane(map, paneRef, DRAW_PREVIEW_PANE, 770);
    drawingLayerGroupRef.current = L.layerGroup().addTo(map);
    drawingPreviewGroupRef.current = L.layerGroup().addTo(map);
    drawingEditHandlesRef.current = L.layerGroup().addTo(map);

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
    const cleanupControls = addMapControls({
      map,
      locationOverlayRef,
      onOpenImportPanel: openImportPanel,
      onOpenExportPanel: openExportPanel,
      onOpenDrawingPanel: openDrawingPanel,
    });

    mapRef.current = map;

    return () => {
      cleanupControls();
      cleanupInteractions();
      cleanupLayersRuntime();
      map.remove();
      mapRef.current = null;
      paneRef.current = {};
      if (locationOverlayRef.current) {
        locationOverlayRef.current.remove();
        locationOverlayRef.current = null;
      }
      if (importedOverlayRef.current) {
        importedOverlayRef.current.remove();
        importedOverlayRef.current = null;
      }
      if (drawingLayerGroupRef.current) {
        drawingLayerGroupRef.current.remove();
        drawingLayerGroupRef.current = null;
      }
      if (drawingPreviewGroupRef.current) {
        drawingPreviewGroupRef.current.remove();
        drawingPreviewGroupRef.current = null;
      }
      if (drawingEditHandlesRef.current) {
        drawingEditHandlesRef.current.remove();
        drawingEditHandlesRef.current = null;
      }
    };
  }, [cleanupInteractions, cleanupLayersRuntime, openDrawingPanel, openExportPanel, openImportPanel]);

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%" }}
      onClick={() => {
        if (contextMenuState) closeContextMenu();
        if (importPanelState.open) closeImportPanel();
        if (exportPanelState.open) closeExportPanel();
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
      <ImportLayerPanel
        open={importPanelState.open}
        loading={importPanelState.loading}
        error={importPanelState.error}
        sanitizeHelpOpen={importSanitizeHelpOpen}
        onToggleHelp={() => setImportSanitizeHelpOpen((current) => !current)}
        onOpenHelp={() => setImportSanitizeHelpOpen(true)}
        onCloseHelp={() => setImportSanitizeHelpOpen(false)}
        onClose={closeImportPanel}
        onSelectFile={() => importInputRef.current?.click()}
      />
      <ExportPdfPanel
        open={exportPanelState.open}
        loading={exportPanelState.loading}
        error={exportPanelState.error}
        paperSize={exportPanelState.paperSize}
        importPanelOpen={importPanelState.open}
        onClose={closeExportPanel}
        onPaperChange={handleExportPaperChange}
        onExport={handleExportPdf}
      />
      <DrawingToolsPanel
        open={drawingPanelOpen}
        activeTool={activeDrawingTool}
        hasSession={hasDrawingSession}
        canFinish={drawingDraftState.canFinish}
        measurementText={drawingDraftState.measurementText}
        helperText={drawingDraftState.helperText}
        featureCount={drawnFeatureCount}
        features={drawnFeaturesState}
        editingFeatureId={editingFeatureId}
        onClose={closeDrawingPanel}
        onSelectTool={handleSelectDrawingTool}
        onFinish={finalizeCurrentDrawing}
        onCancel={clearDrawingSession}
        onClear={clearAllDrawings}
        onDownloadKml={downloadDrawingsAsKml}
        onEditFeature={handleEditFeature}
        onDeleteFeature={handleDeleteFeature}
        onSaveEdit={handleSaveFeatureEdit}
        onCancelEdit={handleCancelFeatureEdit}
      />
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
      <MapContextMenu
        contextMenuState={contextMenuState}
        onClose={closeContextMenu}
        onCopy={copyCoordinates}
      />
    </div>
  );
}
