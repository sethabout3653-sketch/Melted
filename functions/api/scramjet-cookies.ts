// Cloudflare Pages Function: Persistent Additive Cookie Store (/api/scramjet-cookies)

interface CFContext {
  request: Request;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const memoryStore = new Map<string, { cookies: Record<string, any>; updatedAt: number }>();

function mergeCookiesAdditive(
  existing: Record<string, any>,
  incoming: Record<string, any>
): Record<string, any> {
  const merged: Record<string, any> = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    if (!v || typeof v !== 'object') continue;
    const ex = merged[k] || {};
    const combined: Record<string, any> = { ...ex, ...v };
    if (typeof combined.maxAge === 'number' && combined.maxAge <= 0) {
      delete combined.maxAge;
    }
    if (combined.expires !== undefined) {
      const parsed = Number(combined.expires);
      combined.expires = Number.isFinite(parsed)
        ? Math.max(parsed, Date.now() + 365 * 24 * 3600 * 1000)
        : Date.now() + 365 * 24 * 3600 * 1000;
    }
    merged[k] = combined;
  }
  return merged;
}

export async function onRequest(context: CFContext): Promise<Response> {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const url = new URL(request.url);

    if (request.method === 'GET') {
      const userId = url.searchParams.get('userId') || 'default';
      const entry = memoryStore.get(userId) || { cookies: {}, updatedAt: 0 };
      return new Response(
        JSON.stringify({ success: true, cookies: entry.cookies, updatedAt: entry.updatedAt }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        }
      );
    }

    if (request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as {
        userId?: string;
        cookies?: Record<string, any>;
      };
      const userId = body?.userId || 'default';
      const cookies = body?.cookies;
      if (!cookies || typeof cookies !== 'object') {
        return new Response(JSON.stringify({ error: 'Missing cookies object' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      const existing = memoryStore.get(userId)?.cookies || {};
      const merged = mergeCookiesAdditive(existing, cookies);
      const updatedAt = Date.now();
      memoryStore.set(userId, { cookies: merged, updatedAt });

      return new Response(
        JSON.stringify({ success: true, cookies: merged, updatedAt }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        }
      );
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: 'Cookie store error', message: String(err?.message || err) }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }
}
