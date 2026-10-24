import { Hono } from 'hono';

const app = new Hono();

// Middleware for JSON parsing and CORS (Hono does this well)
app.use('*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.header('Access-Control-Allow-Headers', '*');
  if (c.req.method === 'OPTIONS') {
    return c.text('', 204);
  }
  await next();
});

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Frosted - Cloudflare Worker',
  });
});

app.get('/ping', (c) => c.text('pong'));

// Game Cover Image Proxy
app.get('/api/cover/:path{.*}', async (c) => {
  const coverPath = c.req.param('path');
  if (!coverPath) {
    return c.text('Invalid cover path', 400);
  }

  const primaryUrl = `https://raw.githubusercontent.com/gn-math/covers/main/${coverPath}`;
  const fallbackUrl = `https://cdn.statically.io/gh/gn-math/covers/main/${coverPath}`;

  try {
    let res = await fetch(primaryUrl);
    if (!res.ok) {
      res = await fetch(fallbackUrl);
    }
    if (!res.ok) {
      return c.text('Cover not found', 404);
    }

    return new Response(res.body, {
      status: 200,
      headers: {
        'Content-Type': res.headers.get('content-type') || 'image/png',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    return c.text('Error fetching cover', 500);
  }
});

// Giphy Search & Trending API Proxy
app.get('/api/giphy/search', async (c) => {
  const query = c.req.query('q') || '';
  const limit = c.req.query('limit') || '50';
  const offset = c.req.query('offset') || '0';
  const apiKey = 'sXpGFDGZs0Dv1mmNFvYaGUvYwKX0PWIh';

  const endpoint = !query.trim() || query === 'trending'
    ? `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=${limit}&offset=${offset}`
    : `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`;

  try {
    const response = await fetch(endpoint);
    const data = await response.json();
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: 'Failed to fetch Giphy GIFs', message: err?.message }, 500);
  }
});

// Music API Routes
app.get('/api/music/search', async (c) => {
  const query = c.req.query('q') || '';
  const limit = Math.min(parseInt(c.req.query('limit') || '30', 10), 50);

  if (!query.trim()) {
    return c.json({ success: true, count: 0, artists: [], albums: [], tracks: [] });
  }

  try {
    const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=${limit}`);
    if (!itunesRes.ok) {
      return c.json({ success: true, count: 0, artists: [], albums: [], tracks: [] });
    }
    const data: any = await itunesRes.json();
    const tracks = (data.results || []).map((t: any) => ({
      id: `itunes-${t.trackId}`,
      title: t.trackName || 'Unknown Track',
      artist: t.artistName || 'Unknown Artist',
      album: t.collectionName || 'Unknown Album',
      artwork: (t.artworkUrl100 || '').replace('100x100bb', '600x600bb'),
      duration: t.trackTimeMillis ? Math.floor(t.trackTimeMillis / 60000) + ':' + Math.floor((t.trackTimeMillis % 60000) / 1000).toString().padStart(2, '0') : '0:00',
      rawDuration: Math.floor((t.trackTimeMillis || 0) / 1000),
      previewUrl: t.previewUrl || '',
      streamUrl: t.previewUrl || '',
      isFullLength: false,
    }));

    return c.json({
      success: true,
      count: tracks.length,
      artists: [],
      albums: [],
      tracks,
    });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to search music', message: err?.message }, 500);
  }
});

app.get('/api/music/artist/:id', (c) => {
  return c.json({ success: false, error: 'Artist catalog offline' }, 404);
});

app.get('/api/music/album/:id', (c) => {
  return c.json({ success: false, error: 'Album catalog offline' }, 404);
});

// Audio Stream Proxy
app.get('/api/music/stream', async (c) => {
  const targetUrl = c.req.query('url');
  if (!targetUrl) return c.text('Missing url parameter', 400);

  const rangeHeader = c.req.header('range');
  const headers: any = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  };
  if (rangeHeader) headers['Range'] = rangeHeader;

  const audioRes = await fetch(targetUrl, { headers, redirect: 'follow' });
  const responseHeaders = new Headers(audioRes.headers);
  responseHeaders.set('Access-Control-Allow-Origin', '*');
  responseHeaders.set('Accept-Ranges', 'bytes');

  return new Response(audioRes.body, {
    status: audioRes.status,
    headers: responseHeaders,
  });
});

// Music Status
app.get('/api/music/status', async (c) => {
  const t0 = Date.now();
  let itunesOk = false;
  try {
    const testRes = await fetch('https://itunes.apple.com/search?term=test&limit=1');
    itunesOk = testRes.ok;
  } catch {}

  return c.json({
    status: 'operational',
    providers: [
      { id: 'builtin', name: 'Cherri Music Engine', status: 'online', latency: Date.now() - t0, type: 'worker' },
      { id: 'itunes', name: 'iTunes API', status: itunesOk ? 'online' : 'degraded', latency: 50, type: 'external' },
    ],
  });
});

// Game Proxy
app.get('/api/raw/:filename', async (c) => {
  let filename = c.req.param('filename');
  if (!filename.includes('.')) filename = `${filename}.html`;

  const rawgithackUrl = `https://raw.githack.com/gn-math/html/main/${filename}`;
  const githubRawUrl = `https://raw.githubusercontent.com/gn-math/html/main/${filename}`;

  try {
    let response = await fetch(rawgithackUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!response.ok) response = await fetch(githubRawUrl);
    if (!response.ok) return c.text('Failed to fetch game package', response.status as any);

    let html = await response.text();
    const baseTag = `<base href="https://raw.githack.com/gn-math/html/main/">`;
    html = html.includes('<head>') ? html.replace('<head>', `<head>${baseTag}`) : `${baseTag}${html}`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'X-Frame-Options': 'ALLOWALL',
      },
    });
  } catch (error: any) {
    return c.text(`Error: ${error?.message}`, 500);
  }
});

// Default fetch handler export
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    // 1. WebSocket Handler (Requested by User)
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new (globalThis as any).WebSocketPair();
      const [client, server] = Object.values(pair) as [any, any];

      server.accept();
      
      // Basic Echo logic as requested, or you can integrate with Durable Objects here
      server.addEventListener("message", (event: MessageEvent) => {
        server.send(`Echo from Cloudflare: ${event.data}`);
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    // 2. Route API requests through Hono
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return app.fetch(request, env, ctx);
    }

    // 3. Static Assets (handled by Wrangler Assets if configured, or fallback)
    // In Workers with Assets, the worker only runs for non-asset matches if configured correctly.
    // We return 404 for other non-asset paths if Hono doesn't handle them.
    return app.fetch(request, env, ctx);
  },
};
