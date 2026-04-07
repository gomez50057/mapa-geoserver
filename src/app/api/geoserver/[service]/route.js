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

function buildUpstreamUrl(service, requestUrl) {
  const target = SERVICE_TARGETS[service];
  if (!target) return null;

  const incoming = new URL(requestUrl);
  const upstream = new URL(target);
  incoming.searchParams.forEach((value, key) => {
    upstream.searchParams.set(key, value);
  });

  return upstream.toString();
}

export async function GET(request, context) {
  const params = await context?.params;
  const service = params?.service;
  const upstreamUrl = buildUpstreamUrl(service, request.url);
  if (!upstreamUrl) {
    return new Response("Unsupported GeoServer service", { status: 404 });
  }

  const upstream = await fetch(upstreamUrl, {
    method: "GET",
    headers: {
      Accept: request.headers.get("accept") || "*/*",
    },
    ...(service === "tilewms" ? {} : { cache: "no-store" }),
  });

  const headers = new Headers();
  [
    "content-type",
    "cache-control",
    "etag",
    "last-modified",
    "expires",
    "vary",
    "content-length",
  ].forEach((headerName) => {
    const value = upstream.headers.get(headerName);
    if (value) headers.set(headerName, value);
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
