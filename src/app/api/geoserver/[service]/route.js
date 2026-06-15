const SERVICE_TARGETS = {
  tilewms:
    process.env.GEOSERVER_REMOTE_TILE_WMS_URL ||
    process.env.GEOSERVER_REMOTE_WMS_URL ||
    "https://metropoli.hidalgo.gob.mx/geoserver/mapa/wms",
  wmts:
    process.env.GEOSERVER_REMOTE_WMTS_URL ||
    "https://metropoli.hidalgo.gob.mx/geoserver/gwc/service/wmts",
  wms:
    process.env.GEOSERVER_REMOTE_WMS_URL ||
    "https://metropoli.hidalgo.gob.mx/geoserver/mapa/wms",
  wfs:
    process.env.GEOSERVER_REMOTE_WFS_URL ||
    "https://metropoli.hidalgo.gob.mx/geoserver/mapa/wfs",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_QUERY_LENGTH = 8000;
const UPSTREAM_TIMEOUT_MS = 25000;
const WMTS_TILE_CACHE_CONTROL = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000";
const WMS_TILE_CACHE_CONTROL = "public, max-age=900, s-maxage=3600, stale-while-revalidate=86400";
const DYNAMIC_TILE_CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=3600";
const METADATA_CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
const DYNAMIC_CACHE_CONTROL = "no-store";
const ALLOWED_SERVICES = new Set(["tilewms", "wmts", "wms", "wfs"]);
const ALLOWED_REQUESTS = {
  tilewms: new Set(["getcapabilities", "getmap", "getfeatureinfo", "getlegendgraphic"]),
  wmts: new Set(["getcapabilities", "gettile"]),
  wms: new Set(["getcapabilities", "getmap", "getfeatureinfo", "getlegendgraphic"]),
  wfs: new Set(["getcapabilities", "describefeaturetype", "getfeature"]),
};
const ALLOWED_QUERY_PARAMS = new Set([
  "bbox",
  "buffer",
  "cachekey",
  "cql_filter",
  "env",
  "exceptions",
  "elevation",
  "feature_count",
  "filter",
  "format",
  "height",
  "info_format",
  "layer",
  "layers",
  "maxfeatures",
  "outputformat",
  "propertyname",
  "query_layers",
  "request",
  "service",
  "sortby",
  "srs",
  "srsname",
  "style",
  "styles",
  "tilecol",
  "tilematrix",
  "tilematrixset",
  "tilerow",
  "tiled",
  "tilesorigin",
  "time",
  "transparent",
  "typename",
  "typenames",
  "viewparams",
  "version",
  "width",
  "x",
  "y",
]);
const QUALIFIED_LAYER_PATTERN = /^[A-Za-z0-9_]+:[A-Za-z0-9_.-]+$/;

function getSearchParamCaseInsensitive(searchParams, name) {
  const wanted = name.toLowerCase();
  for (const [key, value] of searchParams.entries()) {
    if (key.toLowerCase() === wanted) return value;
  }
  return "";
}

function parseLayerNames(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateLayerNames(searchParams) {
  const layerParamNames = ["layer", "layers", "query_layers", "typename", "typenames"];
  for (const paramName of layerParamNames) {
    const value = getSearchParamCaseInsensitive(searchParams, paramName);
    if (!value) continue;
    const layerNames = parseLayerNames(value);
    if (!layerNames.length || layerNames.some((layerName) => !QUALIFIED_LAYER_PATTERN.test(layerName))) {
      return false;
    }
  }
  return true;
}

function hasDynamicRenderParams(searchParams) {
  const dynamicParamNames = ["cql_filter", "env", "elevation", "filter", "time", "viewparams"];
  return dynamicParamNames.some((paramName) => getSearchParamCaseInsensitive(searchParams, paramName));
}

function validateIncomingRequest(service, incoming) {
  if (!ALLOWED_SERVICES.has(service)) {
    return { ok: false, status: 404, message: "Unsupported GeoServer service" };
  }

  if (incoming.search.length > MAX_QUERY_LENGTH) {
    return { ok: false, status: 414, message: "GeoServer query is too long" };
  }

  const requestType = getSearchParamCaseInsensitive(incoming.searchParams, "request").toLowerCase();
  if (!requestType || !ALLOWED_REQUESTS[service]?.has(requestType)) {
    return { ok: false, status: 400, message: "Unsupported GeoServer request" };
  }

  for (const key of incoming.searchParams.keys()) {
    if (!ALLOWED_QUERY_PARAMS.has(key.toLowerCase())) {
      return { ok: false, status: 400, message: "Unsupported GeoServer parameter" };
    }
  }

  if (!validateLayerNames(incoming.searchParams)) {
    return { ok: false, status: 400, message: "Invalid GeoServer layer name" };
  }

  return { ok: true, requestType };
}

function buildUpstreamUrl(service, requestUrl) {
  const target = SERVICE_TARGETS[service];
  if (!target) return null;

  const incoming = new URL(requestUrl);
  const validation = validateIncomingRequest(service, incoming);
  if (!validation.ok) return validation;

  const upstream = new URL(target);
  incoming.searchParams.forEach((value, key) => {
    upstream.searchParams.set(key, value);
  });

  return {
    ok: true,
    url: upstream.toString(),
    requestType: validation.requestType,
    hasDynamicRenderParams: hasDynamicRenderParams(incoming.searchParams),
  };
}

function buildCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type",
    "X-Content-Type-Options": "nosniff",
  };
}

function buildUpstreamHeaders(request) {
  const accept = request.headers.get("accept") || "*/*";
  return {
    Accept: accept,
    "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
  };
}

function setSharedCacheHeaders(headers, value) {
  headers.set("Cache-Control", value);
  headers.set("CDN-Cache-Control", value);
  headers.set("Vercel-CDN-Cache-Control", value);
}

function disableSharedCache(headers, reason) {
  headers.set("Cache-Control", DYNAMIC_CACHE_CONTROL);
  headers.delete("CDN-Cache-Control");
  headers.delete("Vercel-CDN-Cache-Control");
  headers.set("X-GeoServer-Proxy-Cache", reason);
}

function isImageResponse(headers) {
  return String(headers.get("content-type") || "").toLowerCase().startsWith("image/");
}

function applyProxyCacheHeaders(headers, service, requestType, hasDynamicParams = false, upstreamOk = true) {
  if (!upstreamOk) {
    disableSharedCache(headers, "bypass-error");
    return;
  }

  if (
    requestType === "getfeatureinfo" ||
    requestType === "getfeature" ||
    requestType === "describefeaturetype"
  ) {
    disableSharedCache(headers, "bypass-dynamic");
    return;
  }

  if (requestType === "gettile") {
    if (!isImageResponse(headers)) {
      disableSharedCache(headers, "bypass-non-image");
      return;
    }

    setSharedCacheHeaders(headers, hasDynamicParams ? DYNAMIC_TILE_CACHE_CONTROL : WMTS_TILE_CACHE_CONTROL);
    headers.set("X-GeoServer-Proxy-Cache", "wmts-tile");
    return;
  }

  if (requestType === "getmap") {
    if (!isImageResponse(headers)) {
      disableSharedCache(headers, "bypass-non-image");
      return;
    }

    setSharedCacheHeaders(headers, hasDynamicParams ? DYNAMIC_TILE_CACHE_CONTROL : WMS_TILE_CACHE_CONTROL);
    headers.set("X-GeoServer-Proxy-Cache", "wms-tile");
    return;
  }

  if (requestType === "getlegendgraphic") {
    if (!isImageResponse(headers)) {
      disableSharedCache(headers, "bypass-non-image");
      return;
    }

    setSharedCacheHeaders(headers, METADATA_CACHE_CONTROL);
    headers.set("X-GeoServer-Proxy-Cache", "legend");
    return;
  }

  if (requestType === "getcapabilities") {
    setSharedCacheHeaders(headers, METADATA_CACHE_CONTROL);
    headers.set("X-GeoServer-Proxy-Cache", "metadata");
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(),
  });
}

export async function GET(request, context) {
  const params = await context?.params;
  const service = params?.service;
  const upstreamTarget = buildUpstreamUrl(service, request.url);
  if (!upstreamTarget?.ok) {
    return Response.json(
      { message: upstreamTarget?.message || "Unsupported GeoServer service" },
      { status: upstreamTarget?.status || 404, headers: buildCorsHeaders() }
    );
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(upstreamTarget.url, {
      method: "GET",
      headers: buildUpstreamHeaders(request),
      cache: "no-store",
      signal: abortController.signal,
    });

    const headers = new Headers(buildCorsHeaders());
    ["content-type", "cache-control", "etag", "last-modified", "expires", "vary"].forEach((headerName) => {
      const value = upstream.headers.get(headerName);
      if (value) headers.set(headerName, value);
    });
    applyProxyCacheHeaders(
      headers,
      service,
      upstreamTarget.requestType,
      upstreamTarget.hasDynamicRenderParams,
      upstream.ok
    );

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  } catch (error) {
    console.error("GeoServer proxy failed", { service, error });
    return Response.json(
      {
        message: "GeoServer proxy failed",
        service,
      },
      {
        status: 502,
        headers: buildCorsHeaders(),
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}
