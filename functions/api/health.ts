// Cloudflare Pages Function: Health Check Endpoint
export async function onRequest(): Promise<Response> {
  return new Response(
    JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      platform: 'Cloudflare Pages Functions',
      service: 'Frosted — Unblocked Arcade & Real-Time Mesh',
      timeoutPing: '100s Idle Timeout Heartbeat Active (25s cadence)',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      },
    }
  );
}
