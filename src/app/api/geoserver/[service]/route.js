const SERVICE_TARGETS = {
  tilewms:
    process.env.GEOSERVER_REMOTE_TILE_WMS_URL ||
    process.env.GEOSERVER_REMOTE_WMS_URL ||
    "https://metropoli.hidalgo.gob.mx/geoserver/mapa/wms",
  wms:
    process.env.GEOSERVER_REMOTE_WMS_URL ||
    "https://metropoli.hidalgo.gob.mx/geoserver/mapa/wms",
  wfs:
    process.env.GEOSERVER_REMOTE_WFS_URL ||
    "https://metropoli.hidalgo.gob.mx/geoserver/mapa/wfs",
};

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_QUERY_LENGTH = 8000;
const UPSTREAM_TIMEOUT_MS = 25000;
const ALLOWED_SERVICES = new Set(["tilewms", "wms", "wfs"]);
const ALLOWED_REQUESTS = {
  tilewms: new Set(["getcapabilities", "getmap", "getfeatureinfo", "getlegendgraphic"]),
  wms: new Set(["getcapabilities", "getmap", "getfeatureinfo", "getlegendgraphic"]),
  wfs: new Set(["getcapabilities", "describefeaturetype", "getfeature"]),
};
const ALLOWED_QUERY_PARAMS = new Set([
  "bbox",
  "buffer",
  "exceptions",
  "feature_count",
  "format",
  "height",
  "info_format",
  "layers",
  "maxfeatures",
  "outputformat",
  "query_layers",
  "request",
  "service",
  "srs",
  "srsname",
  "styles",
  "tiled",
  "tilesorigin",
  "transparent",
  "typename",
  "typenames",
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
  const layerParamNames = ["layers", "query_layers", "typename", "typenames"];
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

  return { ok: true };
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

  return { ok: true, url: upstream.toString() };
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

    const body = await upstream.arrayBuffer();
    return new Response(body, {
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
