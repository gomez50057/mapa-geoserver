export const ALLOWED_SEARCH_STATES = [
  {
    key: "cdmx",
    label: "Ciudad de México",
    aliases: ["ciudad de mexico", "cdmx", "distrito federal", "mexico city"],
    bbox: {
      south: 19.048,
      west: -99.365,
      north: 19.593,
      east: -98.94,
    },
  },
  {
    key: "edomex",
    label: "Estado de México",
    aliases: ["estado de mexico", "edomex", "mexico"],
    bbox: {
      south: 18.253,
      west: -100.638,
      north: 20.288,
      east: -98.603,
    },
  },
  {
    key: "hidalgo",
    label: "Hidalgo",
    aliases: ["hidalgo", "estado de hidalgo"],
    bbox: {
      south: 19.353,
      west: -99.8596,
      north: 21.3986,
      east: -97.9849,
    },
  },
  {
    key: "morelos",
    label: "Morelos",
    aliases: ["morelos", "estado de morelos"],
    bbox: {
      south: 18.32,
      west: -99.51,
      north: 19.139,
      east: -98.63,
    },
  },
];

export const ALLOWED_SEARCH_REGION_LABEL =
  "Ciudad de México, Estado de México, Hidalgo y Morelos";

export const SEARCH_LIMITS = {
  minQueryLength: 3,
  maxSuggestions: 6,
  debounceMs: 360,
  cacheTtlMs: 10 * 60 * 1000,
};

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function getSearchBoundingRect() {
  const bounds = ALLOWED_SEARCH_STATES.reduce(
    (acc, state) => ({
      south: Math.min(acc.south, state.bbox.south),
      west: Math.min(acc.west, state.bbox.west),
      north: Math.max(acc.north, state.bbox.north),
      east: Math.max(acc.east, state.bbox.east),
    }),
    {
      south: Infinity,
      west: Infinity,
      north: -Infinity,
      east: -Infinity,
    }
  );

  return bounds;
}

export function getSearchRegionCenter() {
  const bounds = getSearchBoundingRect();
  return {
    lat: (bounds.south + bounds.north) / 2,
    lon: (bounds.west + bounds.east) / 2,
  };
}

export function isPointInBoundingBox(lat, lon, bbox) {
  if (!bbox) return false;
  return lat >= bbox.south && lat <= bbox.north && lon >= bbox.west && lon <= bbox.east;
}

export function resolveAllowedStateByPoint(lat, lon) {
  return ALLOWED_SEARCH_STATES.find((state) => isPointInBoundingBox(lat, lon, state.bbox)) || null;
}

export function normalizeStateName(value) {
  return normalizeText(value);
}

export function resolveAllowedStateByName(value) {
  const normalized = normalizeStateName(value);
  if (!normalized) return null;

  return (
    ALLOWED_SEARCH_STATES.find(
      (state) =>
        normalizeStateName(state.label) === normalized ||
        state.aliases.some((alias) => normalizeStateName(alias) === normalized)
    ) || null
  );
}

export function isAllowedSearchResult({ lat, lon, stateName }) {
  const byPoint =
    Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))
      ? resolveAllowedStateByPoint(Number(lat), Number(lon))
      : null;
  if (byPoint) return byPoint;

  return resolveAllowedStateByName(stateName);
}

