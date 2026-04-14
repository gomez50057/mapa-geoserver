import { getLegendItems } from "@/data/legendCatalog";
import { escapeHtml } from "./shared";

export const EXPORT_PAGE_PRESETS = {
  letter: {
    label: "Carta",
    pageSize: "letter",
    pageLabel: "Carta",
    pdfWidthMm: 279.4,
    pdfHeightMm: 215.9,
    pixelWidth: 1056,
    pixelHeight: 816,
    maxLegendUnitsFirstPage: 8,
    maxLegendUnitsExtraPage: 28,
  },
  legal: {
    label: "Legal / Oficio",
    pageSize: "legal",
    pageLabel: "Legal / Oficio",
    pdfWidthMm: 355.6,
    pdfHeightMm: 215.9,
    pixelWidth: 1344,
    pixelHeight: 816,
    maxLegendUnitsFirstPage: 10,
    maxLegendUnitsExtraPage: 36,
  },
  tabloid: {
    label: "Tabloide / Doble carta",
    pageSize: "tabloid",
    pageLabel: "Tabloide / Doble carta",
    pdfWidthMm: 431.8,
    pdfHeightMm: 279.4,
    pixelWidth: 1632,
    pixelHeight: 1056,
    maxLegendUnitsFirstPage: 12,
    maxLegendUnitsExtraPage: 48,
  },
};

function toFinitePositiveNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

const normalizeLegendText = (value) => String(value || "").trim().toLowerCase();

export function buildLegendGroupsForExport(legends = []) {
  return legends
    .map((group) => {
      const key = group.legendKey || group.key || group.id;
      const base = getLegendItems(key);
      const filters = (group.filterTexts || []).map(normalizeLegendText);

      let items = filters.length
        ? base.filter((item) => filters.includes(normalizeLegendText(item.text)))
        : base.slice();

      const extra = Array.isArray(group.extras) ? group.extras : [];
      const merged = new Map();
      [...items, ...extra].forEach((item) => {
        if (!item?.text) return;
        const mergedKey = normalizeLegendText(item.text);
        if (!merged.has(mergedKey)) merged.set(mergedKey, item);
      });

      items = Array.from(merged.values());
      return {
        key,
        title: group.title || key,
        items,
      };
    })
    .filter((group) => group.items.length > 0);
}

export function splitLegendGroups(groups, maxUnits) {
  const chunks = [];
  let currentChunk = [];
  let currentUnits = 0;

  groups.forEach((group) => {
    const groupUnits = Math.max(2, (group.items?.length || 0) + 1);
    if (currentChunk.length > 0 && currentUnits + groupUnits > maxUnits) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentUnits = 0;
    }

    currentChunk.push(group);
    currentUnits += groupUnits;
  });

  if (currentChunk.length > 0) chunks.push(currentChunk);
  return chunks;
}

async function getHtml2Canvas() {
  const module = await import("html2canvas");
  return module.default;
}

async function getJsPdf() {
  const module = await import("jspdf");
  return module.jsPDF;
}

function sanitizeCropMargins(margins = {}, width = 0, height = 0, scale = 1) {
  const left = Math.max(0, Number(margins.left) || 0);
  const right = Math.max(0, Number(margins.right) || 0);
  const top = Math.max(0, Number(margins.top) || 0);
  const bottom = Math.max(0, Number(margins.bottom) || 0);
  const remainingWidth = width - (left + right) * scale;
  const remainingHeight = height - (top + bottom) * scale;

  if (remainingWidth < width * 0.35 || remainingHeight < height * 0.35) {
    return { left: 0, right: 0, top: 0, bottom: 0 };
  }

  return { left, right, top, bottom };
}

function cropCanvasToVisibleArea(sourceCanvas, cropMargins = {}, scale = 1) {
  const safeMargins = sanitizeCropMargins(cropMargins, sourceCanvas.width, sourceCanvas.height, scale);
  const cropLeft = Math.round(safeMargins.left * scale);
  const cropRight = Math.round(safeMargins.right * scale);
  const cropTop = Math.round(safeMargins.top * scale);
  const cropBottom = Math.round(safeMargins.bottom * scale);
  const targetWidth = sourceCanvas.width - cropLeft - cropRight;
  const targetHeight = sourceCanvas.height - cropTop - cropBottom;

  if (targetWidth <= 0 || targetHeight <= 0) {
    return sourceCanvas;
  }

  if (cropLeft === 0 && cropRight === 0 && cropTop === 0 && cropBottom === 0) {
    return sourceCanvas;
  }

  const croppedCanvas = document.createElement("canvas");
  croppedCanvas.width = targetWidth;
  croppedCanvas.height = targetHeight;
  const context = croppedCanvas.getContext("2d");
  if (!context) return sourceCanvas;

  context.drawImage(
    sourceCanvas,
    cropLeft,
    cropTop,
    targetWidth,
    targetHeight,
    0,
    0,
    targetWidth,
    targetHeight
  );

  return croppedCanvas;
}

function hideElementsForExport(rootElement) {
  if (!rootElement) return () => {};

  const nodes = Array.from(
    rootElement.querySelectorAll(
      ".leaflet-control-container, .leaflet-top, .leaflet-bottom, .leaflet-left, .leaflet-right, .leaflet-popup-pane, .leaflet-tooltip-pane"
    )
  );

  const previousStyles = nodes.map((node) => ({
    node,
    visibility: node.style.visibility,
    opacity: node.style.opacity,
    pointerEvents: node.style.pointerEvents,
  }));

  previousStyles.forEach(({ node }) => {
    node.style.visibility = "hidden";
    node.style.opacity = "0";
    node.style.pointerEvents = "none";
  });

  return () => {
    previousStyles.forEach(({ node, visibility, opacity, pointerEvents }) => {
      node.style.visibility = visibility;
      node.style.opacity = opacity;
      node.style.pointerEvents = pointerEvents;
    });
  };
}

export async function captureMapImage(mapElement, options = {}) {
  if (!mapElement) throw new Error("No fue posible capturar el mapa actual.");

  const scale = Number(options.scale) > 0 ? Number(options.scale) : 2;
  const html2canvas = await getHtml2Canvas();
  const restoreHiddenElements = hideElementsForExport(mapElement);
  let sourceCanvas;

  try {
    sourceCanvas = await html2canvas(mapElement, {
      backgroundColor: "#dde3e8",
      scale,
      useCORS: true,
      imageTimeout: 15000,
      logging: false,
      ignoreElements: (element) =>
        element.dataset?.exportIgnore === "true" ||
        element.dataset?.exportRoot === "true" ||
        element.classList?.contains("leaflet-control-container") ||
        element.classList?.contains("leaflet-top") ||
        element.classList?.contains("leaflet-bottom") ||
        element.classList?.contains("leaflet-left") ||
        element.classList?.contains("leaflet-right") ||
        element.classList?.contains("leaflet-popup-pane") ||
        element.classList?.contains("leaflet-tooltip-pane"),
    });
  } finally {
    restoreHiddenElements();
  }
  const canvas = cropCanvasToVisibleArea(sourceCanvas, options.cropMargins, scale);

  return {
    src: canvas.toDataURL("image/jpeg", 0.92),
    width: canvas.width,
    height: canvas.height,
  };
}

export function buildLegendMarkup(groups = []) {
  if (!groups.length) {
    return `
      <div class="export-empty-state">
        No hay elementos de simbología visibles en esta vista.
      </div>
    `;
  }

  return groups
    .map(
      (group) => `
        <section class="export-legend-group">
          <h3>${escapeHtml(group.title)}</h3>
          <ul>
            ${group.items
              .map(
                (item) => `
                  <li>
                    <span class="legend-dot" style="background:${escapeHtml(item.color || "#999")}"></span>
                    <span>${escapeHtml(item.text)}</span>
                  </li>
                `
              )
              .join("")}
          </ul>
        </section>
      `
    )
    .join("");
}

export function buildExportPagesMarkup({
  mapImageSrc,
  mapAspectRatio,
  logoSrc,
  paperPreset,
  generatedAt,
  centerCoordinates,
  firstLegendMarkup,
  extraLegendPagesMarkup,
}) {
  return `
    <style>
      * { box-sizing: border-box; }
      .pdf-root {
        width: ${paperPreset.pixelWidth}px;
        display: grid;
        gap: 20px;
        font-family: "Montserrat", Arial, sans-serif;
        color: #241f1f;
      }
      .pdf-page {
        width: ${paperPreset.pixelWidth}px;
        min-height: ${paperPreset.pixelHeight}px;
        padding: 28px 32px 32px;
        background: #f4f1ec;
        display: grid;
        gap: 22px;
        align-content: start;
        position: relative;
      }
      .export-header {
        display: grid;
        grid-template-columns: 160px 1fr 280px;
        gap: 22px;
        align-items: center;
      }
      .export-ribbon {
        min-height: 112px;
        background: linear-gradient(135deg, #691B32, #8f2746 68%, #b24562);
        clip-path: polygon(0 0, 100% 0, 82% 100%, 0 100%);
        border-radius: 26px 0 0 26px;
        color: white;
        display: grid;
        align-content: center;
        padding: 18px 24px;
        box-shadow: 0 18px 30px rgba(105, 27, 50, 0.22);
      }
      .export-ribbon span {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: .08em;
        text-transform: uppercase;
        opacity: .82;
      }
      .export-ribbon strong {
        font-size: 28px;
        line-height: .95;
        margin-top: 8px;
      }
      .export-title-card {
        display: grid;
        gap: 6px;
        align-content: center;
        padding: 0;
      }
      .export-kicker {
        font-size: 13px;
        letter-spacing: .08em;
        text-transform: uppercase;
        color: #7a1d31;
        font-weight: 700;
      }
      .export-meta-inline {
        margin: 0;
        font-size: 12.5px;
        color: #5b5555;
        line-height: 1.55;
      }
      .export-logo-wrap {
        display: flex;
        align-items: center;
        justify-content: flex-end;
      }
      .export-main {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 18px;
        align-items: start;
      }
      .export-map-card,
      .export-legend-card {
        background: transparent;
        border-radius: 0;
        border: none;
        box-shadow: none;
        overflow: visible;
      }
      .export-section-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 0 0 8px;
        border-bottom: none;
      }
      .export-section-head strong {
        font-size: 13px;
        color: #202020;
        letter-spacing: .02em;
      }
      .export-section-head span {
        font-size: 11px;
        color: #7a1d31;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .06em;
      }
      .export-map-frame {
        padding: 8px 0 0;
      }
      .export-map-shell {
        aspect-ratio: ${mapAspectRatio};
        border-radius: 30px;
        overflow: hidden;
        border: none;
        background: #dde3e8;
        box-shadow: 0 22px 40px rgba(0,0,0,0.12);
        width: 100%;
      }
      .export-map-shell img {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: contain;
        background: #dde3e8;
      }
      .export-map-meta {
        display: grid;
        gap: 8px;
        padding: 2px 2px 0;
      }
      .export-meta-line {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        font-size: 11.5px;
        color: #5d5959;
      }
      .export-legend-wrap {
        padding: 10px 0 0 18px;
        display: grid;
        gap: 12px;
        border-left: 2px solid rgba(105, 27, 50, 0.12);
      }
      .export-legend-group {
        display: grid;
        gap: 8px;
        padding-top: 8px;
        border-top: 1px solid rgba(0,0,0,0.05);
      }
      .export-legend-group:first-child {
        padding-top: 0;
        border-top: none;
      }
      .export-legend-group h3 {
        margin: 0;
        font-size: 12px;
        color: #202020;
        line-height: 1.25;
      }
      .export-legend-group ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 6px;
      }
      .export-legend-group li {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11.5px;
        color: #2d2d2d;
      }
      .legend-dot {
        width: 12px;
        height: 12px;
        border-radius: 999px;
        border: 1px solid rgba(0,0,0,0.15);
        flex: 0 0 12px;
      }
      .export-empty-state {
        padding: 8px 0;
        color: #6f6666;
        font-size: 11.5px;
      }
      .export-legend-page {
        display: grid;
        gap: 32px;
      }
      .export-legend-columns {
        columns: 2 220px;
        column-gap: 32px;
      }
      .export-legend-columns .export-legend-group {
        break-inside: avoid;
        margin-bottom: 10px;
      }
      .export-footer-note {
        position: absolute;
        left: 32px;
        bottom: 18px;
        max-width: 58%;
        font-size: 7.5px;
        line-height: 1.32;
        color: rgba(58, 52, 52, 0.78);
      }
      .export-first-page-legend {
        max-height: ${Math.max(120, Math.round(paperPreset.pixelHeight * 0.19))}px;
        overflow: hidden;
      }
    </style>
    <div class="pdf-root">
      <div class="pdf-page">
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
        <main class="export-main">
          <section class="export-map-card">
            <div class="export-map-frame">
              <div class="export-map-shell">
                <img src="${mapImageSrc}" alt="Mapa exportado" />
              </div>
            </div>
          </section>
          <aside class="export-legend-card export-first-page-legend">
            <div class="export-legend-wrap">
              ${firstLegendMarkup}
            </div>
          </aside>
        </main>
        <div class="export-footer-note">
          El presente documento cartográfico fue elaborado por la Unidad de Planeación y Prospectiva del Estado de Hidalgo, a través de la Coordinación General de Planeación y Proyectos
        </div>
      </div>
      ${extraLegendPagesMarkup}
    </div>
  `;
}

export async function renderPdfPages({ exportRoot, pages, paperPreset, fileName }) {
  const html2canvas = await getHtml2Canvas();
  const jsPDF = await getJsPdf();
  const pdfWidthMm = toFinitePositiveNumber(paperPreset?.pdfWidthMm, 279.4);
  const pdfHeightMm = toFinitePositiveNumber(paperPreset?.pdfHeightMm, 215.9);
  const pageFormat = [pdfWidthMm, pdfHeightMm];
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: pageFormat,
    compress: true,
  });

  for (let index = 0; index < pages.length; index += 1) {
    const pageElement = pages[index];
    const pageCanvas = await html2canvas(pageElement, {
      backgroundColor: "#f4f1ec",
      scale: 2,
      useCORS: true,
      imageTimeout: 15000,
      logging: false,
    });

    const canvasWidth = toFinitePositiveNumber(pageCanvas?.width, 0);
    const canvasHeight = toFinitePositiveNumber(pageCanvas?.height, 0);
    if (!canvasWidth || !canvasHeight) {
      throw new Error("No fue posible preparar una página válida para el PDF.");
    }

    const pageData = pageCanvas.toDataURL("image/jpeg", 0.95);
    const pageWidth = toFinitePositiveNumber(pdf.internal.pageSize.getWidth?.(), pdfWidthMm);
    const pageHeight = toFinitePositiveNumber(pdf.internal.pageSize.getHeight?.(), pdfHeightMm);
    if (index > 0) pdf.addPage(pageFormat, "landscape");
    pdf.addImage(pageData, "JPEG", 0, 0, pageWidth, pageHeight);
  }

  pdf.save(fileName);

  if (exportRoot?.parentNode) {
    exportRoot.parentNode.removeChild(exportRoot);
  }
}
