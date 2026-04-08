"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import LegendDock from "./LegendDock";
import DrawingToolsPanel from "./DrawingToolsPanel";
import { GEOSERVER_CONFIG, HIDALGO_REGION_BOUNDS } from "@/config/geoserver";
import { createWmsLayer } from "@/lib/geoserver/client";
import { resolveTopmostFeatureAtLatLng } from "@/lib/geoserver/interaction";
import { extendUnionBounds, resolveLayerBounds } from "@/lib/geoserver/runtime";
import { loadLegacyLocalLayer } from "@/lib/geoserver/legacyLocalLayers";
import { getLegendItems } from "@/data/legendCatalog";
import { renderPopupContent } from "@/data/popupSchemas";

const FALLBACK_BOUNDS = L.latLngBounds(HIDALGO_REGION_BOUNDS[0], HIDALGO_REGION_BOUNDS[1]);
const clampZ = (z) => Math.max(-9999, Math.min(9999, Math.round(Number(z ?? 400))));
const COORDINATE_DECIMALS = 7;
const IMPORT_LAYER_PANE = "pane_uploaded_vector";
const DRAW_LAYER_PANE = "pane_drawn_shapes";
const DRAW_PREVIEW_PANE = "pane_drawn_preview";
const MAX_IMPORT_FILE_SIZE_BYTES = 12 * 1024 * 1024;
const SAFE_IMPORT_EXTENSIONS = new Set([".geojson", ".kml"]);
const EARTH_RADIUS_METERS = 6378137;
const DRAW_TOOL_DEFAULT_HELPERS = {
  point: "Haz clic en el mapa para colocar un punto de referencia.",
  line: "Haz clic para agregar vértices. Usa Finalizar o doble clic para terminar la línea.",
  polygon: "Haz clic para agregar vértices. Usa Finalizar o doble clic para cerrar el polígono.",
  rectangle: "Haz clic para la primera esquina y una segunda vez para la esquina opuesta.",
  circle: "Haz clic para definir el centro y una segunda vez para fijar el radio.",
};
const SAFE_IMPORT_MIME_TYPES = {
  ".geojson": new Set(["", "application/geo+json", "application/json"]),
  ".kml": new Set(["", "application/vnd.google-earth.kml+xml", "application/xml", "text/xml"]),
};
const EXPORT_PAGE_PRESETS = {
  letter: {
    label: "Carta",
    pageSize: "letter landscape",
    pageLabel: "Carta",
    pdfWidthMm: 279.4,
    pdfHeightMm: 215.9,
    pixelWidth: 1056,
    pixelHeight: 816,
    maxLegendUnitsFirstPage: 16,
    maxLegendUnitsExtraPage: 28,
  },
  legal: {
    label: "Legal / Oficio",
    pageSize: "legal landscape",
    pageLabel: "Legal / Oficio",
    pdfWidthMm: 355.6,
    pdfHeightMm: 215.9,
    pixelWidth: 1344,
    pixelHeight: 816,
    maxLegendUnitsFirstPage: 22,
    maxLegendUnitsExtraPage: 36,
  },
  tabloid: {
    label: "Tabloide / Doble carta",
    pageSize: "tabloid landscape",
    pageLabel: "Tabloide / Doble carta",
    pdfWidthMm: 431.8,
    pdfHeightMm: 279.4,
    pixelWidth: 1632,
    pixelHeight: 1056,
    maxLegendUnitsFirstPage: 30,
    maxLegendUnitsExtraPage: 48,
  },
};

function formatCoordinatePair(latlng) {
  if (!latlng) return "20.0830998, -98.7948132";
  return `${Number(latlng.lat).toFixed(COORDINATE_DECIMALS)}, ${Number(latlng.lng).toFixed(COORDINATE_DECIMALS)}`;
}

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function toDegrees(value) {
  return (Number(value) * 180) / Math.PI;
}

function formatDistance(distanceMeters) {
  const distance = Number(distanceMeters || 0);
  if (distance >= 1000) return `${(distance / 1000).toFixed(distance >= 10000 ? 1 : 2)} km`;
  return `${distance.toFixed(distance >= 100 ? 0 : 1)} m`;
}

function formatArea(areaSqMeters) {
  const area = Math.max(0, Number(areaSqMeters || 0));
  if (area >= 1000000) return `${(area / 1000000).toFixed(2)} km²`;
  if (area >= 10000) return `${(area / 10000).toFixed(2)} ha`;
  return `${area.toFixed(area >= 100 ? 0 : 1)} m²`;
}

function computeLineDistance(latlngs = []) {
  let total = 0;
  for (let index = 1; index < latlngs.length; index += 1) {
    total += latlngs[index - 1].distanceTo(latlngs[index]);
  }
  return total;
}

function computeGeodesicArea(latlngs = []) {
  if (!Array.isArray(latlngs) || latlngs.length < 3) return 0;

  let area = 0;
  for (let index = 0; index < latlngs.length; index += 1) {
    const current = latlngs[index];
    const next = latlngs[(index + 1) % latlngs.length];
    area += toRadians(next.lng - current.lng) * (2 + Math.sin(toRadians(current.lat)) + Math.sin(toRadians(next.lat)));
  }

  return Math.abs((area * EARTH_RADIUS_METERS * EARTH_RADIUS_METERS) / 2);
}

function getRectangleLatLngs(bounds) {
  if (!bounds) return [];
  const northWest = bounds.getNorthWest();
  const northEast = bounds.getNorthEast();
  const southEast = bounds.getSouthEast();
  const southWest = bounds.getSouthWest();
  return [northWest, northEast, southEast, southWest];
}

function buildDrawingMeasurement({ type, latlngs = [], center = null, radius = 0, point = null, bounds = null }) {
  if (type === "point" && point) {
    return {
      headline: "Punto",
      detail: formatCoordinatePair(point),
      metrics: [{ label: "Coordenadas", value: formatCoordinatePair(point) }],
    };
  }

  if (type === "line") {
    const length = computeLineDistance(latlngs);
    const segmentMetrics = latlngs.slice(1).map((point, index) => ({
      label: `Tramo ${index + 1}`,
      value: formatDistance(latlngs[index].distanceTo(point)),
    }));
    return {
      headline: "Longitud",
      detail: formatDistance(length),
      metrics: [...segmentMetrics, { label: "Longitud total", value: formatDistance(length) }],
    };
  }

  if (type === "circle" && center && radius > 0) {
    const area = Math.PI * radius * radius;
    return {
      headline: "Área",
      detail: formatArea(area),
      metrics: [
        { label: "Centro", value: formatCoordinatePair(center) },
        { label: "Radio", value: formatDistance(radius) },
        { label: "Diámetro", value: formatDistance(radius * 2) },
        { label: "Área", value: formatArea(area) },
      ],
    };
  }

  const polygonLatLngs = type === "rectangle" && bounds ? getRectangleLatLngs(bounds) : latlngs;
  const area = computeGeodesicArea(polygonLatLngs);
  const closed = [...polygonLatLngs, polygonLatLngs[0]].filter(Boolean);
  const segmentMetrics = closed.slice(1).map((point, index) => ({
    label: `Lado ${index + 1}`,
    value: formatDistance(closed[index].distanceTo(point)),
  }));

  return {
    headline: "Área",
    detail: formatArea(area),
    metrics: [...segmentMetrics, { label: "Área", value: formatArea(area) }],
  };
}

function buildDrawingPopupHtml(feature) {
  const rows = (feature?.measurement?.metrics || [])
    .map(
      (metric) => `
        <div style="display:grid;gap:2px;padding:6px 0;border-top:1px solid rgba(0,0,0,0.06);">
          <strong style="font-size:11px;color:#7a1d31;text-transform:uppercase;letter-spacing:.04em;">${escapeHtml(metric.label)}</strong>
          <span style="font-size:12px;color:#2e2e2e;word-break:break-word;">${escapeHtml(metric.value)}</span>
        </div>
      `
    )
    .join("");

  return `
    <div style="font-family:Montserrat,sans-serif;min-width:188px;">
      <div style="display:grid;gap:2px;padding-bottom:4px;">
        <strong style="font-size:12.5px;color:#202020;">${escapeHtml(feature?.label || "Trazo")}</strong>
        <span style="font-size:11.5px;color:#666;">${escapeHtml(feature?.typeLabel || "")}</span>
      </div>
      ${rows || `<span style="font-size:12px;color:#444;">Sin mediciones disponibles.</span>`}
    </div>
  `;
}

function getLatLngAverage(latlngs = []) {
  if (!latlngs.length) return null;
  const sums = latlngs.reduce(
    (accumulator, point) => ({
      lat: accumulator.lat + Number(point.lat || 0),
      lng: accumulator.lng + Number(point.lng || 0),
    }),
    { lat: 0, lng: 0 }
  );
  return L.latLng(sums.lat / latlngs.length, sums.lng / latlngs.length);
}

function getFeatureCenter(feature) {
  if (feature.type === "point") return feature.point || null;
  if (feature.type === "circle") return feature.center || null;
  if (feature.latlngs?.length) {
    const bounds = L.latLngBounds(feature.latlngs);
    if (bounds?.isValid?.()) return bounds.getCenter();
    return getLatLngAverage(feature.latlngs);
  }
  return null;
}

function getMidpoint(first, second) {
  return L.latLng((first.lat + second.lat) / 2, (first.lng + second.lng) / 2);
}

function getFeatureSummary(feature) {
  const metrics = feature?.measurement?.metrics || [];
  return metrics
    .slice(0, 2)
    .map((metric) => `${metric.label}: ${metric.value}`)
    .join(" · ");
}

function buildFeatureMeasurementLayers(feature) {
  const layers = [];
  const createLabel = (latlng, text, tone = "dark") => {
    if (!latlng || !text) return;
    const marker = L.marker(latlng, {
      pane: DRAW_LAYER_PANE,
      interactive: false,
      keyboard: false,
      icon: L.divIcon({
        className: "drawing-inline-measure",
        iconSize: null,
        html: `
          <span
            style="
              display:inline-flex;
              align-items:center;
              justify-content:center;
              padding:2px 7px;
              border-radius:999px;
              background:${tone === "accent" ? "rgba(105,27,50,0.82)" : "rgba(25,25,25,0.72)"};
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
          >${escapeHtml(text)}</span>
        `,
      }),
    });
    layers.push(marker);
  };

  if (feature.type === "point" && feature.point) {
    createLabel(feature.point, formatCoordinatePair(feature.point));
    return layers;
  }

  if (feature.type === "line" && feature.latlngs?.length >= 2) {
    feature.latlngs.forEach((point, index) => {
      if (index === 0) return;
      const previous = feature.latlngs[index - 1];
      createLabel(getMidpoint(previous, point), formatDistance(previous.distanceTo(point)));
    });
    createLabel(getFeatureCenter(feature), feature.measurement?.detail || "", "accent");
    return layers;
  }

  if ((feature.type === "polygon" || feature.type === "rectangle") && feature.latlngs?.length >= 3) {
    const closed = [...feature.latlngs, feature.latlngs[0]];
    closed.forEach((point, index) => {
      if (index === 0) return;
      const previous = closed[index - 1];
      createLabel(getMidpoint(previous, point), formatDistance(previous.distanceTo(point)));
    });
    createLabel(getFeatureCenter(feature), feature.measurement?.detail || "", "accent");
    return layers;
  }

  if (feature.type === "circle" && feature.center && feature.radius > 0) {
    const edge = destinationPoint(feature.center, feature.radius, 90);
    createLabel(getMidpoint(feature.center, edge), formatDistance(feature.radius));
    createLabel(feature.center, feature.measurement?.metrics?.find((metric) => metric.label === "Área")?.value || "", "accent");
  }

  return layers;
}

function latLngToKmlCoordinate(latlng) {
  return `${Number(latlng.lng).toFixed(7)},${Number(latlng.lat).toFixed(7)},0`;
}

function destinationPoint(center, distanceMeters, bearingDegrees) {
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const bearing = toRadians(bearingDegrees);
  const lat1 = toRadians(center.lat);
  const lng1 = toRadians(center.lng);

  const lat2 =
    Math.asin(
      Math.sin(lat1) * Math.cos(angularDistance) +
        Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
    );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

  return L.latLng(toDegrees(lat2), toDegrees(lng2));
}

function circleToLatLngs(center, radiusMeters, steps = 72) {
  return Array.from({ length: steps }, (_, index) => destinationPoint(center, radiusMeters, (index / steps) * 360));
}

function featureToKmlPlacemark(feature) {
  const propertiesXml = (feature?.measurement?.metrics || [])
    .map(
      (metric) => `
        <Data name="${escapeHtml(metric.label)}">
          <value>${escapeHtml(metric.value)}</value>
        </Data>
      `
    )
    .join("");

  let geometryXml = "";
  if (feature.type === "point") {
    geometryXml = `<Point><coordinates>${latLngToKmlCoordinate(feature.point)}</coordinates></Point>`;
  } else if (feature.type === "line") {
    geometryXml = `
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>${feature.latlngs.map(latLngToKmlCoordinate).join(" ")}</coordinates>
      </LineString>
    `;
  } else if (feature.type === "circle") {
    const circleLatLngs = circleToLatLngs(feature.center, feature.radius);
    const circleRing = [...circleLatLngs, circleLatLngs[0]];
    geometryXml = `
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${circleRing.map(latLngToKmlCoordinate).join(" ")}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    `;
  } else {
    const latlngs = feature.latlngs;
    const ring = [...latlngs, latlngs[0]];
    geometryXml = `
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${ring.map(latLngToKmlCoordinate).join(" ")}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    `;
  }

  return `
    <Placemark>
      <name>${escapeHtml(feature.label)}</name>
      <description>${escapeHtml(feature.measurement?.detail || "")}</description>
      <ExtendedData>${propertiesXml}</ExtendedData>
      ${geometryXml}
    </Placemark>
  `;
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

function normalizeLegendText(value) {
  return String(value || "").trim().toLowerCase();
}

function buildLegendGroupsForExport(legends = []) {
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

function splitLegendGroups(groups, maxUnits) {
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

async function captureMapImage(mapElement) {
  if (!mapElement) throw new Error("No fue posible capturar el mapa actual.");

  const canvas = await html2canvas(mapElement, {
    backgroundColor: "#dde3e8",
    scale: 2,
    useCORS: true,
    imageTimeout: 15000,
    logging: false,
    ignoreElements: (element) =>
      element.classList?.contains("leaflet-control-container") ||
      element.classList?.contains("leaflet-popup-pane") ||
      element.classList?.contains("leaflet-tooltip-pane"),
  });

  return {
    src: canvas.toDataURL("image/jpeg", 0.92),
    width: canvas.width,
    height: canvas.height,
  };
}

function buildLegendMarkup(groups = []) {
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

function buildExportPagesMarkup({
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
        grid-template-columns: minmax(0, 2fr) minmax(250px, 0.82fr);
        gap: 30px;
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
        padding: 8px 0 6px;
      }
      .export-map-shell {
        aspect-ratio: ${mapAspectRatio};
        border-radius: 30px;
        overflow: hidden;
        border: none;
        background: #dde3e8;
        box-shadow: 0 22px 40px rgba(0,0,0,0.12);
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
        padding: 12px 0 0 18px;
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
            <div class="export-section-head">
              <strong>Vista actual</strong>
            </div>
            <div class="export-map-frame">
              <div class="export-map-shell">
                <img src="${mapImageSrc}" alt="Mapa exportado" />
              </div>
            </div>
          </section>
          <aside class="export-legend-card">
            <div class="export-section-head">
              <strong>Simbología</strong>
              <span>Referencia</span>
            </div>
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
  const [exportPanelState, setExportPanelState] = useState({
    open: false,
    loading: false,
    paperSize: "letter",
    error: "",
  });
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
          pane: DRAW_LAYER_PANE,
          radius: 7,
          color: "#ffffff",
          weight: 2,
          fillColor: feature.id === editingFeatureId ? "#bc955b" : "#7a1d31",
          fillOpacity: 1,
        });
      } else if (feature.type === "line" && feature.latlngs?.length >= 2) {
        layer = L.polyline(feature.latlngs, {
          pane: DRAW_LAYER_PANE,
          color: feature.id === editingFeatureId ? "#bc955b" : "#7a1d31",
          weight: feature.id === editingFeatureId ? 3.6 : 3,
          opacity: 0.95,
        });
      } else if (feature.type === "circle" && feature.center && feature.radius > 0) {
        layer = L.circle(feature.center, {
          pane: DRAW_LAYER_PANE,
          radius: feature.radius,
          color: feature.id === editingFeatureId ? "#bc955b" : "#7a1d31",
          weight: feature.id === editingFeatureId ? 3.2 : 2.6,
          opacity: 0.95,
          fillColor: "#bc955b",
          fillOpacity: 0.18,
        });
      } else if ((feature.type === "polygon" || feature.type === "rectangle") && feature.latlngs?.length >= 3) {
        layer = L.polygon(feature.latlngs, {
          pane: DRAW_LAYER_PANE,
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

  const updateDrawingPreview = useCallback(
    (cursorLatLng = null) => {
      const map = mapRef.current;
      const previewGroup = drawingPreviewGroupRef.current;
      const session = drawingStateRef.current;
      if (!map || !previewGroup) return;

      previewGroup.clearLayers();

      if (!session.tool) return;

      const previewOptions = {
        pane: DRAW_PREVIEW_PANE,
        color: "#7a1d31",
        weight: 2.4,
        opacity: 0.92,
        fillColor: "#bc955b",
        fillOpacity: 0.14,
        dashArray: "8 6",
      };

      const markerOptions = {
        pane: DRAW_PREVIEW_PANE,
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
        L.circle(session.anchor, {
          ...previewOptions,
          radius,
        }).addTo(previewGroup);
        infoLatLng = cursorLatLng;
        infoText = `Radio: ${formatDistance(radius)}`;
      }

      if (infoLatLng && infoText) {
        L.marker(infoLatLng, {
          pane: DRAW_PREVIEW_PANE,
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
        })
          .addTo(previewGroup);
      }
    },
    []
  );

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
    [clearDrawingSession, renderDrawnFeatures]
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
          pane: DRAW_PREVIEW_PANE,
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
    [renderDrawnFeatures]
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
    closeDrawingPanel();
    setExportPanelState((current) => ({
      ...current,
      open: false,
      loading: false,
      error: "",
    }));
    setImportPanelState((current) => ({ ...current, open: true, error: "" }));
  }, [closeDrawingPanel]);

  const closeImportPanel = useCallback(() => {
    setImportPanelState((current) => ({ ...current, open: false, loading: false, error: "" }));
    setImportSanitizeHelpOpen(false);
    if (importInputRef.current) importInputRef.current.value = "";
  }, []);

  const openExportPanel = useCallback(() => {
    closeDrawingPanel();
    closeImportPanel();
    setExportPanelState((current) => ({
      ...current,
      open: true,
      loading: false,
      error: "",
    }));
  }, [closeDrawingPanel, closeImportPanel]);

  const closeExportPanel = useCallback(() => {
    setExportPanelState((current) => ({
      ...current,
      open: false,
      loading: false,
      error: "",
    }));
  }, []);

  const openDrawingPanel = useCallback(() => {
    closeExportPanel();
    closeImportPanel();
    setDrawingPanelOpen(true);
  }, [closeExportPanel, closeImportPanel]);

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

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: [paperPreset.pdfWidthMm, paperPreset.pdfHeightMm],
        compress: true,
      });

      for (let index = 0; index < pageNodes.length; index += 1) {
        const pageNode = pageNodes[index];
        const canvas = await html2canvas(pageNode, {
          backgroundColor: "#f4f1ec",
          scale: 2,
          useCORS: true,
          imageTimeout: 15000,
          logging: false,
        });

        const imageData = canvas.toDataURL("image/jpeg", 0.92);
        if (index > 0) pdf.addPage([paperPreset.pdfWidthMm, paperPreset.pdfHeightMm], "landscape");
        pdf.addImage(imageData, "JPEG", 0, 0, paperPreset.pdfWidthMm, paperPreset.pdfHeightMm, undefined, "FAST");
      }

      document.body.removeChild(exportRoot);
      pdf.save(`mapa-${exportPanelState.paperSize}-${new Date().toISOString().slice(0, 10)}.pdf`);
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
  }, [closeExportPanel, exportPanelState.paperSize, legends, visibleDefs]);

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

    const ExportControl = L.Control.extend({
      options: { position: "topleft" },
      onAdd() {
        const wrapper = L.DomUtil.create("div", "leaflet-bar leaflet-control");
        wrapper.style.marginTop = "10px";
        wrapper.style.border = "none";
        wrapper.style.background = "transparent";

        const button = L.DomUtil.create("button", "", wrapper);
        button.type = "button";
        button.title = "Descargar mapa en PDF";
        button.setAttribute("aria-label", "Descargar mapa en PDF");
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
            <path d="M12 4v9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M8.6 10.4L12 13.8l3.4-3.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M5 17.5h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <rect x="4.5" y="16.5" width="15" height="3" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/>
          </svg>
        `;

        L.DomEvent.disableClickPropagation(wrapper);
        L.DomEvent.disableScrollPropagation(wrapper);
        L.DomEvent.on(button, "click", (event) => {
          L.DomEvent.preventDefault(event);
          L.DomEvent.stopPropagation(event);
          openExportPanel();
        });
        L.DomEvent.on(button, "mouseenter", () => {
          button.style.boxShadow = "0 14px 28px rgba(0,0,0,0.18)";
          button.style.transform = "translateY(-1px)";
        });
        L.DomEvent.on(button, "mouseleave", () => {
          button.style.boxShadow = "0 10px 20px rgba(0,0,0,0.14)";
          button.style.transform = "translateY(0)";
        });

        return wrapper;
      },
    });

    const DrawingControl = L.Control.extend({
      options: { position: "topleft" },
      onAdd() {
        const wrapper = L.DomUtil.create("div", "leaflet-bar leaflet-control");
        wrapper.style.marginTop = "10px";
        wrapper.style.border = "none";
        wrapper.style.background = "transparent";

        const button = L.DomUtil.create("button", "", wrapper);
        button.type = "button";
        button.title = "Herramientas de dibujo";
        button.setAttribute("aria-label", "Herramientas de dibujo");
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
            <path d="M4 18l5.5-1.3L19 7.2 16.8 5 7.3 14.5 6 20z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            <path d="M14.8 7l2.2 2.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        `;

        L.DomEvent.disableClickPropagation(wrapper);
        L.DomEvent.disableScrollPropagation(wrapper);
        L.DomEvent.on(button, "click", (event) => {
          L.DomEvent.preventDefault(event);
          L.DomEvent.stopPropagation(event);
          openDrawingPanel();
        });
        L.DomEvent.on(button, "mouseenter", () => {
          button.style.boxShadow = "0 14px 28px rgba(0,0,0,0.18)";
          button.style.transform = "translateY(-1px)";
        });
        L.DomEvent.on(button, "mouseleave", () => {
          button.style.boxShadow = "0 10px 20px rgba(0,0,0,0.14)";
          button.style.transform = "translateY(0)";
        });

        return wrapper;
      },
    });

    new LocateControl().addTo(map);
    new ImportControl().addTo(map);
    new ExportControl().addTo(map);
    new DrawingControl().addTo(map);

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
  }, [openDrawingPanel, openExportPanel, openImportPanel]);

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
  }, [activeDrawingTool, clearDrawingPreview, editingFeatureId, syncDrawingDraft]);

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
      if (activeDrawingTool === "point") {
        updateDrawingPreview(event.latlng);
        return;
      }

      if (activeDrawingTool === "line" || activeDrawingTool === "polygon") {
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
  }, [activeDrawingTool, finalizeCurrentDrawing, finalizeDrawingFeature, syncDrawingDraft, updateDrawingPreview]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

    if (mosaicStatus.isUpdating || movingRef.current) {
      mapBusyRef.current = true;
      if (!movingRef.current && !activeDrawingTool && !editingFeatureId) updateCursor("wait");
      return undefined;
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

    return undefined;
  }, [activeDrawingTool, editingFeatureId, mosaicStatus.isUpdating, runPopupQuery, updateCursor]);

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
      updateCursor(activeDrawingTool || editingFeatureId ? "crosshair" : "grabbing");
    };

    const handleMoveEnd = () => {
      if (moveResumeTimerRef.current) clearTimeout(moveResumeTimerRef.current);
      moveResumeTimerRef.current = window.setTimeout(() => {
        movingRef.current = false;
        if (mosaicStatus.isUpdating) {
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
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (moveResumeTimerRef.current) clearTimeout(moveResumeTimerRef.current);
      abortControllerRef(clickControllerRef);
      abortControllerRef(hoverControllerRef);
    };
  }, [activeDrawingTool, closeContextMenu, editingFeatureId, hoverableDefs, mosaicStatus.isUpdating, queryableDefs, runPopupQuery, updateCursor]);

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
      {exportPanelState.open ? (
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            position: "absolute",
            top: importPanelState.open ? 344 : 108,
            left: 54,
            zIndex: 20007,
            width: 318,
            padding: 14,
            borderRadius: 18,
            background: "rgba(255,255,255,0.96)",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 18px 38px rgba(0,0,0,0.18)",
            backdropFilter: "blur(14px)",
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "grid", gap: 3 }}>
              <strong style={{ fontSize: 13, color: "#202020" }}>Descargar mapa</strong>
              <span style={{ fontSize: 11.5, color: "#666" }}>Incluye mapa visible y simbología en PDF</span>
            </div>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={closeExportPanel}
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

          <div style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 11, color: "#7a1d31", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>
              Tamaño de salida
            </span>
            <div style={{ display: "grid", gap: 8 }}>
              {Object.entries(EXPORT_PAGE_PRESETS).map(([key, preset]) => {
                const selected = exportPanelState.paperSize === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleExportPaperChange(key)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: selected ? "1px solid rgba(122,29,49,0.28)" : "1px solid rgba(0,0,0,0.08)",
                      background: selected
                        ? "linear-gradient(135deg, rgba(122,29,49,0.08), rgba(188,149,91,0.18))"
                        : "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(248,245,240,0.95))",
                      color: "#2a2a2a",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ display: "grid", gap: 2 }}>
                      <strong style={{ fontSize: 12.5 }}>{preset.label}</strong>
                      <span style={{ fontSize: 11.5, color: "#666" }}>Horizontal, listo para guardar como PDF</span>
                    </span>
                    <span
                      aria-hidden
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 999,
                        border: selected ? "5px solid #7a1d31" : "2px solid rgba(122,29,49,0.24)",
                        background: selected ? "#f7f1ea" : "transparent",
                        flex: "0 0 18px",
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

            <div style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 11.5, color: "#666", lineHeight: 1.45 }}>
                Si la simbología no cabe en la primera hoja, se agrega una segunda.
              </span>
            {exportPanelState.error ? (
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
                {exportPanelState.error}
              </span>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              disabled={exportPanelState.loading}
              onClick={handleExportPdf}
              style={{
                flex: 1,
                padding: "11px 12px",
                borderRadius: 14,
                border: "1px solid rgba(122,29,49,0.14)",
                background: exportPanelState.loading
                  ? "rgba(0,0,0,0.05)"
                  : "linear-gradient(135deg, rgba(122,29,49,0.08), rgba(188,149,91,0.18))",
                color: "#7a1d31",
                fontWeight: 700,
                fontSize: 12.5,
                cursor: exportPanelState.loading ? "wait" : "pointer",
                boxShadow: "0 10px 20px rgba(0,0,0,0.08)",
              }}
            >
              {exportPanelState.loading ? "Preparando..." : "Descargar PDF"}
            </button>
            <button
              type="button"
              onClick={closeExportPanel}
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
      <DrawingToolsPanel
        open={drawingPanelOpen}
        activeTool={activeDrawingTool}
        hasSession={drawingDraftState.pointsCount > 0 || Boolean(drawingStateRef.current.anchor)}
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
