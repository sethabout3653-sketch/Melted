// Cloudflare Pages Functions: Global Middleware
export async function onRequest(context: { request: Request; next: () => Promise<Response> }): Promise<Response> {
  const { request, next } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  // CRITICAL: WebSockets (Upgrade: websocket or status 101) must pass through untouched!
  // Re-creating a Response in middleware strips the WebSocket handshake pair and breaks connection.
  const upgradeHeader = request.headers.get('Upgrade');
  if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
    return next();
  }

  const response = await next();

  if (response.status === 101) {
    return response;
  }

  // Clone headers and add permissive policies
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.set('X-Frame-Options', 'ALLOWALL');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

