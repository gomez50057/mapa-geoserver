import { useCallback, useState } from "react";
import {
  buildExportPagesMarkup,
  buildLegendGroupsForExport,
  buildLegendMarkup,
  captureMapImage,
  EXPORT_PAGE_PRESETS,
  renderPdfPages,
  splitLegendGroups,
} from "../utils/exportPdfUtils";
import { escapeHtml, formatCoordinatePair } from "../utils/shared";

export function usePdfExport({
  mapDivRef,
  mapRef,
  legends,
}) {
  const [exportPanelState, setExportPanelState] = useState({
    open: false,
    loading: false,
    paperSize: "letter",
    error: "",
  });

  const closeExportPanel = useCallback(() => {
    setExportPanelState((current) => ({
      ...current,
      open: false,
      loading: false,
      error: "",
    }));
  }, []);

  const openExportPanel = useCallback(() => {
    setExportPanelState((current) => ({
      ...current,
      open: true,
      loading: false,
      error: "",
    }));
  }, []);

  const handleExportPaperChange = useCallback((paperSize) => {
    setExportPanelState((current) => ({ ...current, paperSize, error: "" }));
  }, []);

  const handleExportPdf = useCallback(async () => {
    const mapElement = mapDivRef.current;
    const map = mapRef.current;
    const paperPreset = EXPORT_PAGE_PRESETS[exportPanelState.paperSize] || EXPORT_PAGE_PRESETS.letter;

    if (!mapElement || !map) {
      setExportPanelState((current) => ({
        ...current,
        open: true,
        loading: false,
        error: "No fue posible preparar el mapa para exportación.",
      }));
      return;
    }

    setExportPanelState((current) => ({ ...current, loading: true, error: "" }));

    try {
      const legendGroups = buildLegendGroupsForExport(legends);
      const firstLegendChunks = splitLegendGroups(legendGroups, paperPreset.maxLegendUnitsFirstPage);
      const firstLegendGroups = firstLegendChunks[0] || [];
      const remainingLegendGroups = legendGroups.slice(firstLegendGroups.length);
      const extraLegendChunks = splitLegendGroups(remainingLegendGroups, paperPreset.maxLegendUnitsExtraPage);

      const center = map.getCenter?.();
      const centerCoordinates = formatCoordinatePair(center || null);
      const generatedAt = new Intl.DateTimeFormat("es-MX", {
        dateStyle: "long",
        timeStyle: "short",
      }).format(new Date());
      const logoSrc = `${window.location.origin}/img/logos/Coordinaci%C3%B3n.png`;
      const firstLegendMarkup = buildLegendMarkup(firstLegendGroups);
      const extraLegendPagesMarkup = extraLegendChunks
        .map(
          (groups, index) => `
            <div class="pdf-page export-legend-page">
              <header class="export-header">
                <div class="export-ribbon">
                  <span>Mapa</span>
                  <strong>UPLAPH</strong>
                </div>
                <div class="export-title-card">
                  <span class="export-kicker">Mapa digital regional y metropolitano</span>
                  <p class="export-meta-inline"><strong>Fecha:</strong> ${escapeHtml(generatedAt)}, <strong>Centro:</strong> ${escapeHtml(centerCoordinates)}</p>
                </div>
                <div class="export-logo-wrap">
                  <img src="${escapeHtml(logoSrc)}" alt="Coordinación" style="max-width:100%; max-height:196px; object-fit:contain;" />
                </div>
              </header>
              <section class="export-legend-card">
                <div class="export-section-head">
                  <strong>Simbología</strong>
                  <span>Hoja ${index + 2}</span>
                </div>
                <div class="export-legend-wrap export-legend-columns">
                  ${buildLegendMarkup(groups)}
                </div>
              </section>
              <div class="export-footer-note">
                El presente documento cartográfico fue elaborado por la Unidad de Planeación y Prospectiva del Estado de Hidalgo, a través de la Coordinación General de Planeación y Proyectos
              </div>
            </div>
          `
        )
        .join("");

      const capturedMap = await captureMapImage(mapElement);
      const mapAspectRatio =
        capturedMap.width > 0 && capturedMap.height > 0
          ? `${capturedMap.width} / ${capturedMap.height}`
          : "16 / 9";

      const exportRoot = document.createElement("div");
      exportRoot.dataset.exportRoot = "true";
      exportRoot.style.position = "fixed";
      exportRoot.style.left = "-20000px";
      exportRoot.style.top = "0";
      exportRoot.style.width = `${paperPreset.pixelWidth}px`;
      exportRoot.style.zIndex = "-1";
      exportRoot.style.pointerEvents = "none";
      exportRoot.innerHTML = buildExportPagesMarkup({
        mapImageSrc: capturedMap.src,
        mapAspectRatio,
        logoSrc,
        paperPreset,
        generatedAt,
        centerCoordinates,
        firstLegendMarkup,
        extraLegendPagesMarkup,
      });

      document.body.appendChild(exportRoot);

      const pageNodes = Array.from(exportRoot.querySelectorAll(".pdf-page"));
      if (pageNodes.length === 0) {
        throw new Error("No fue posible preparar el contenido del PDF.");
      }

      await renderPdfPages({
        exportRoot,
        pages: pageNodes,
        paperPreset,
        fileName: `mapa-${exportPanelState.paperSize}-${new Date().toISOString().slice(0, 10)}.pdf`,
      });

      closeExportPanel();
    } catch (error) {
      console.error("Export PDF failed", error);
      document.querySelectorAll('[data-export-root="true"]').forEach((node) => node.remove());
      setExportPanelState((current) => ({
        ...current,
        open: true,
        loading: false,
        error:
          error?.message?.includes("tainted")
            ? "No se pudo generar el PDF con la base cartográfica actual. Intenta con una base compatible con exportación."
            : error?.message || "No se pudo generar la vista para PDF.",
      }));
      return;
    }

    setExportPanelState((current) => ({ ...current, loading: false }));
  }, [closeExportPanel, exportPanelState.paperSize, legends, mapDivRef, mapRef]);

  return {
    exportPanelState,
    openExportPanel,
    closeExportPanel,
    handleExportPaperChange,
    handleExportPdf,
  };
}
