import { SEARCH_LIMITS, getSearchBoundingRect, getSearchRegionCenter } from "@/lib/search/searchBounds";
import { normalizeProviderResults } from "@/lib/search/geocoder";

const responseCache = new Map();

function clampLimit(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return SEARCH_LIMITS.maxSuggestions;
  return Math.max(1, Math.min(SEARCH_LIMITS.maxSuggestions, Math.round(numeric)));
}

function getCacheKey(query, limit) {
  return `${String(query || "").trim().toLowerCase()}::${limit}`;
}

function readCache(cacheKey) {
  const cached = responseCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    responseCache.delete(cacheKey);
    return null;
  }
  return cached.payload;
}

function writeCache(cacheKey, payload) {
  responseCache.set(cacheKey, {
    payload,
    expiresAt: Date.now() + SEARCH_LIMITS.cacheTtlMs,
  });
}

function buildGeoapifyUrl(query, limit) {
  const baseUrl = process.env.SEARCH_GEOCODER_BASE_URL || "https://api.geoapify.com/v1";
  const apiKey = process.env.GEOAPIFY_API_KEY || "";
  const bounds = getSearchBoundingRect();
  const center = getSearchRegionCenter();
  const url = new URL("/geocode/autocomplete", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);

  url.searchParams.set("text", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("lang", "es");
  url.searchParams.set("type", "street,city,amenity,postcode");
  url.searchParams.set(
    "filter",
    `rect:${bounds.west},${bounds.south},${bounds.east},${bounds.north}`
  );
  url.searchParams.set("bias", `proximity:${center.lon},${center.lat}`);
  url.searchParams.set("apiKey", apiKey);

  return url;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = String(searchParams.get("q") || "").trim();
  const limit = clampLimit(searchParams.get("limit"));

  if (query.length < SEARCH_LIMITS.minQueryLength) {
    return Response.json({
      results: [],
      message: `Escribe al menos ${SEARCH_LIMITS.minQueryLength} caracteres para buscar.`,
    });
  }

  const provider = (process.env.SEARCH_PROVIDER || "geoapify").toLowerCase();
  if (provider !== "geoapify") {
    return Response.json(
      {
        results: [],
        message: "El proveedor de búsqueda configurado no está disponible.",
      },
      { status: 503 }
    );
  }

  if (!process.env.GEOAPIFY_API_KEY) {
    return Response.json(
      {
        results: [],
        message: "Configura GEOAPIFY_API_KEY para habilitar la búsqueda de lugares.",
      },
      { status: 503 }
    );
  }

  const cacheKey = getCacheKey(query, limit);
  const cachedPayload = readCache(cacheKey);
  if (cachedPayload) {
    return Response.json(cachedPayload, {
      headers: {
        "Cache-Control": "private, max-age=300",
      },
    });
  }

  const requestUrl = buildGeoapifyUrl(query, limit);
  const response = await fetch(requestUrl, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return Response.json(
      {
        results: [],
        message: "No fue posible consultar el servicio de búsqueda.",
      },
      { status: 502 }
    );
  }

  const payload = await response.json();
  const results = normalizeProviderResults(payload).slice(0, limit);
  const normalizedPayload = {
    results,
    message: results.length ? "" : "La búsqueda está limitada a Ciudad de México, Estado de México, Hidalgo y Morelos.",
  };

  writeCache(cacheKey, normalizedPayload);

  return Response.json(normalizedPayload, {
    headers: {
      "Cache-Control": "private, max-age=300",
    },
  });
}
