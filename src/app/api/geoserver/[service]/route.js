const SERVICE_TARGETS = {
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
    cache: "no-store",
  });

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const cacheControl = upstream.headers.get("cache-control");
  if (cacheControl) headers.set("cache-control", cacheControl);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
