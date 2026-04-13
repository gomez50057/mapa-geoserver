import L from "leaflet";
import { escapeHtml, getFileExtension } from "./shared";

export const IMPORT_LAYER_PANE = "pane_uploaded_vector";
export const MAX_IMPORT_FILE_SIZE_BYTES = 12 * 1024 * 1024;
export const SAFE_IMPORT_EXTENSIONS = new Set([".geojson", ".kml"]);
export const SAFE_IMPORT_MIME_TYPES = {
  ".geojson": new Set(["", "application/geo+json", "application/json"]),
  ".kml": new Set(["", "application/vnd.google-earth.kml+xml", "application/xml", "text/xml"]),
};

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`No se pudo leer el archivo ${file?.name || ""}`.trim()));
    reader.readAsText(file);
  });
}

export function validateImportedFile(file) {
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
      .map((child) =>
        extractKmlGeometry({
          getElementsByTagName: (tagName) => (child.tagName === tagName ? [child] : []),
        })
      )
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

export function parseImportedFile(fileName, text) {
  const extension = getFileExtension(fileName);
  if (extension === ".kml") return parseKml(text);
  if (extension === ".geojson") {
    return normalizeGeoJsonPayload(JSON.parse(text));
  }
  throw new Error("Por seguridad, solo se permiten archivos KML o GeoJSON.");
}

export function buildPropertiesPopup(properties = {}) {
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

export function createImportedLayer(map, geojson, fileName, paneId = IMPORT_LAYER_PANE) {
  const layer = L.geoJSON(geojson, {
    pane: paneId,
    style: (feature) => ({
      color: feature?.geometry?.type?.includes("Line") ? "#0f6cbd" : "#7a1d31",
      weight: feature?.geometry?.type?.includes("Line") ? 3 : 2.2,
      opacity: 0.95,
      fillColor: "#bc955b",
      fillOpacity: feature?.geometry?.type?.includes("Polygon") ? 0.24 : 0,
    }),
    pointToLayer: (feature, latlng) =>
      L.circleMarker(latlng, {
        pane: paneId,
        radius: 7,
        color: "#ffffff",
        weight: 2,
        fillColor: "#7a1d31",
        fillOpacity: 1,
      }).bindPopup(buildPropertiesPopup(feature?.properties || { Archivo: fileName })),
    onEachFeature: (feature, layerRef) => {
      if (typeof layerRef.bindPopup === "function" && !layerRef.getPopup()) {
        layerRef.bindPopup(buildPropertiesPopup(feature?.properties || { Archivo: fileName }));
      }
    },
  });

  layer.__uploadedFileName = fileName;
  return layer;
}
