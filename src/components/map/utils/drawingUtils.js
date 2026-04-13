import L from "leaflet";
import { escapeHtml, formatCoordinatePair } from "./shared";

export const DRAW_LAYER_PANE = "pane_drawn_shapes";
export const DRAW_PREVIEW_PANE = "pane_drawn_preview";
const EARTH_RADIUS_METERS = 6378137;

export const DRAW_TOOL_DEFAULT_HELPERS = {
  point: "Haz clic en el mapa para colocar un punto de referencia.",
  line: "Haz clic para agregar vértices. Usa Finalizar o doble clic para terminar la línea.",
  polygon: "Haz clic para agregar vértices. Usa Finalizar o doble clic para cerrar el polígono.",
  rectangle: "Haz clic para la primera esquina y una segunda vez para la esquina opuesta.",
  circle: "Haz clic para definir el centro y una segunda vez para fijar el radio.",
};

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function toDegrees(value) {
  return (Number(value) * 180) / Math.PI;
}

export function formatDistance(distanceMeters) {
  const distance = Number(distanceMeters || 0);
  if (distance >= 1000) return `${(distance / 1000).toFixed(distance >= 10000 ? 1 : 2)} km`;
  return `${distance.toFixed(distance >= 100 ? 0 : 1)} m`;
}

export function formatArea(areaSqMeters) {
  const area = Math.max(0, Number(areaSqMeters || 0));
  if (area >= 1000000) return `${(area / 1000000).toFixed(2)} km²`;
  if (area >= 10000) return `${(area / 10000).toFixed(2)} ha`;
  return `${area.toFixed(area >= 100 ? 0 : 1)} m²`;
}

export function computeLineDistance(latlngs = []) {
  let total = 0;
  for (let index = 1; index < latlngs.length; index += 1) {
    total += latlngs[index - 1].distanceTo(latlngs[index]);
  }
  return total;
}

export function computeGeodesicArea(latlngs = []) {
  if (!Array.isArray(latlngs) || latlngs.length < 3) return 0;

  let area = 0;
  for (let index = 0; index < latlngs.length; index += 1) {
    const current = latlngs[index];
    const next = latlngs[(index + 1) % latlngs.length];
    area += toRadians(next.lng - current.lng) * (2 + Math.sin(toRadians(current.lat)) + Math.sin(toRadians(next.lat)));
  }

  return Math.abs((area * EARTH_RADIUS_METERS * EARTH_RADIUS_METERS) / 2);
}

export function getRectangleLatLngs(bounds) {
  if (!bounds) return [];
  const northWest = bounds.getNorthWest();
  const northEast = bounds.getNorthEast();
  const southEast = bounds.getSouthEast();
  const southWest = bounds.getSouthWest();
  return [northWest, northEast, southEast, southWest];
}

export function buildDrawingMeasurement({ type, latlngs = [], center = null, radius = 0, point = null, bounds = null }) {
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

export function buildDrawingPopupHtml(feature) {
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

export function getFeatureSummary(feature) {
  const metrics = feature?.measurement?.metrics || [];
  return metrics
    .slice(0, 2)
    .map((metric) => `${metric.label}: ${metric.value}`)
    .join(" · ");
}

export function buildFeatureMeasurementLayers(feature) {
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
    createLabel(
      feature.center,
      feature.measurement?.metrics?.find((metric) => metric.label === "Área")?.value || "",
      "accent"
    );
  }

  return layers;
}

function latLngToKmlCoordinate(latlng) {
  return `${Number(latlng.lng).toFixed(7)},${Number(latlng.lat).toFixed(7)},0`;
}

export function destinationPoint(center, distanceMeters, bearingDegrees) {
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

export function featureToKmlPlacemark(feature) {
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
    const ring = [...feature.latlngs, feature.latlngs[0]];
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
