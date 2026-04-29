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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function buildCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type",
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
  const upstreamUrl = buildUpstreamUrl(service, request.url);
  if (!upstreamUrl) {
    return new Response("Unsupported GeoServer service", { status: 404 });
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        Accept: request.headers.get("accept") || "*/*",
      },
      cache: "no-store",
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
    console.error("GeoServer proxy failed", { service, upstreamUrl, error });
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
  }
}
