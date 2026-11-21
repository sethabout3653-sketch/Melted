// Cloudflare Pages Function: Persistent Additive Cookie Store (/api/scramjet-cookies)

interface CookieKV {
  get(key: string, type: 'json'): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
}

interface CFContext {
  request: Request;
  env?: { SCRAMJET_COOKIES?: CookieKV };
}

type CookieEntry = { cookies: Record<string, any>; updatedAt: number };

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const memoryStore = new Map<string, CookieEntry>();

async function readEntry(env: CFContext['env'], userId: string): Promise<CookieEntry> {
  const kv = env?.SCRAMJET_COOKIES;
  if (!kv) return memoryStore.get(userId) || { cookies: {}, updatedAt: 0 };
  const stored = (await kv.get(`sj:${userId}`, 'json')) as CookieEntry | null;
  return stored || { cookies: {}, updatedAt: 0 };
}

async function writeEntry(env: CFContext['env'], userId: string, entry: CookieEntry): Promise<void> {
  const kv = env?.SCRAMJET_COOKIES;
  if (!kv) {
    memoryStore.set(userId, entry);
    return;
  }
  await kv.put(`sj:${userId}`, JSON.stringify(entry));
}

function mergeCookiesAdditive(
  existing: Record<string, any>,
  incoming: Record<string, any>
): Record<string, any> {
  const merged: Record<string, any> = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    if (!v || typeof v !== 'object') continue;
    const ex = merged[k] || {};
    const combined: Record<string, any> = { ...ex, ...v };
    if (
      typeof ex.value === 'string' &&
      ex.value.length > 0 &&
      (v.value === '' || v.value === undefined || v.value === null)
    ) {
      combined.value = ex.value;
    }
    if (typeof combined.maxAge === 'number' && combined.maxAge <= 0) {
      delete combined.maxAge;
    }
    if (combined.expires !== undefined) {
      const parsed = typeof combined.expires === 'string' ? Date.parse(combined.expires) : Number(combined.expires);
      const minFuture = Date.now() + 365 * 24 * 3600 * 1000;
      combined.expires = Number.isFinite(parsed) ? Math.max(parsed, minFuture) : minFuture;
    }
    merged[k] = combined;
  }
  return merged;
}

export async function onRequest(context: CFContext): Promise<Response> {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const url = new URL(request.url);

    if (request.method === 'GET') {
      const userId = url.searchParams.get('userId') || 'default';
      const entry = await readEntry(env, userId);
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
      const existing = (await readEntry(env, userId)).cookies;
      const merged = mergeCookiesAdditive(existing, cookies);
      const updatedAt = Date.now();
      await writeEntry(env, userId, { cookies: merged, updatedAt });

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
