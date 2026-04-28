import {
  ALLOWED_SEARCH_REGION_LABEL,
  isAllowedSearchResult,
  resolveAllowedStateByPoint,
} from "./searchBounds";

function normalizeSearchText(value) {
  return String(value || "").trim();
}

export function parseCoordinateQuery(query) {
  const normalized = normalizeSearchText(query).replace(/\s+/g, " ");
  const match = normalized.match(
    /^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/
  );
  if (!match) return null;

  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

  return { lat, lon };
}

export function buildCoordinateSearchResult({ lat, lon }) {
  const allowedState = resolveAllowedStateByPoint(lat, lon);
  if (!allowedState) {
    return {
      valid: false,
      message: `La búsqueda está limitada a ${ALLOWED_SEARCH_REGION_LABEL}.`,
      result: null,
    };
  }

  return {
    valid: true,
    message: "",
    result: {
      id: `coords:${lat},${lon}`,
      label: `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
      secondaryLabel: allowedState.label,
      lat,
      lon,
      bbox: null,
      type: "coordinates",
      source: "manual",
      state: allowedState.label,
    },
  };
}

export function normalizeProviderResults(payload) {
  const rawResults = Array.isArray(payload?.results)
    ? payload.results
    : Array.isArray(payload?.features)
      ? payload.features.map((feature) => feature.properties || {})
      : [];

  return rawResults
    .map((item, index) => {
      const lat = Number(item.lat ?? item.latitude);
      const lon = Number(item.lon ?? item.longitude);
      const stateName = item.state || item.state_code || item.county || "";
      const allowedState = isAllowedSearchResult({ lat, lon, stateName });
      if (!allowedState) return null;

      const bbox = item.bbox
        ? {
            lon1: Number(item.bbox.lon1),
            lat1: Number(item.bbox.lat1),
            lon2: Number(item.bbox.lon2),
            lat2: Number(item.bbox.lat2),
          }
        : null;

      const primaryLabel = item.formatted || item.address_line1 || item.name || item.city || item.street;
      const secondaryParts = [
        item.address_line2,
        item.suburb,
        item.city,
        allowedState.label,
      ].filter(Boolean);

      return {
        id: item.place_id || item.result_id || `${lat},${lon}:${index}`,
        label: primaryLabel || `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
        secondaryLabel: secondaryParts.join(" · "),
        lat,
        lon,
        bbox:
          bbox &&
          [bbox.lon1, bbox.lat1, bbox.lon2, bbox.lat2].every((value) => Number.isFinite(value))
            ? bbox
            : null,
        type: item.result_type || item.rank?.match_type || item.datasource?.sourcename || "place",
        source: item.datasource?.sourcename || "provider",
        state: allowedState.label,
      };
    })
    .filter(Boolean);
}

