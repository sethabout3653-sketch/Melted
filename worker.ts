import { Hono } from 'hono';
import { searchOfficialCatalog, ALL_OFFICIAL_ARTISTS, ALL_OFFICIAL_ALBUMS, ALL_OFFICIAL_TRACKS } from './src/data/musicCatalog';

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

// Tidal Integration
const TIDAL_CLIENT_ID = 'txNoH4kkV41MfH25';
const TIDAL_CLIENT_SECRET = 'dQjy0MinCEvxi1O4UmxvxWnDjt4cgHBPw8ll6nYBk98=';
let cachedTidalToken: { token: string; exp: number } | null = null;

async function getTidalToken(): Promise<string | null> {
  if (cachedTidalToken && Date.now() < cachedTidalToken.exp) {
    return cachedTidalToken.token;
  }
  try {
    const res = await fetch('https://auth.tidal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + btoa(`${TIDAL_CLIENT_ID}:${TIDAL_CLIENT_SECRET}`),
      },
      body: new URLSearchParams({
        client_id: TIDAL_CLIENT_ID,
        client_secret: TIDAL_CLIENT_SECRET,
        grant_type: 'client_credentials',
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    if (data.access_token) {
      cachedTidalToken = {
        token: data.access_token,
        exp: Date.now() + (data.expires_in || 3600) * 1000 - 60000,
      };
      return cachedTidalToken.token;
    }
  } catch (err) {
    console.warn('[Tidal] Token fetch failed:', err);
  }
  return null;
}

// Music API Routes
app.get('/api/music/search', async (c) => {
  const query = c.req.query('q') || '';
  const limit = Math.min(parseInt(c.req.query('limit') || '30', 10), 50);

  try {
    let tracks: any[] = [];
    let artists: any[] = [];
    let albums: any[] = [];

    const lowerQ = query.toLowerCase().trim();

    // 1. Official catalog
    const officialMatches = searchOfficialCatalog(query);
    artists.push(...officialMatches.artists);
    albums.push(...officialMatches.albums);
    tracks.push(...officialMatches.tracks);

    // 2. Tidal
    const tidalToken = await getTidalToken();
    if (tidalToken && lowerQ.length > 0) {
      const tidalRes = await fetch(`https://api.tidal.com/v1/search?query=${encodeURIComponent(query)}&limit=${Math.min(limit, 30)}&countryCode=US`, {
        headers: { Authorization: `Bearer ${tidalToken}` },
      });

      if (tidalRes.ok) {
        const tData: any = await tidalRes.json();
        if (tData.artists?.items) {
           artists.push(...tData.artists.items.map((a: any) => ({
               id: `tidal-artist-${a.id}`,
               name: a.name || 'Unknown Artist',
               avatar: a.picture ? `https://resources.tidal.com/images/${a.picture.replace(/-/g, '/')}/640x640.jpg` : '',
               popularTracks: [],
               albums: []
           })));
        }
        if (tData.albums?.items) {
           albums.push(...tData.albums.items.map((a: any) => ({
               id: `tidal-album-${a.id}`,
               title: a.title || 'Unknown Album',
               artist: a.artist?.name || 'Unknown Artist',
               artwork: a.cover ? `https://resources.tidal.com/images/${a.cover.replace(/-/g, '/')}/640x640.jpg` : '',
               year: a.releaseDate ? a.releaseDate.split('-')[0] : '',
               tracksCount: a.numberOfTracks || 0,
               totalDuration: '',
               tracks: []
           })));
        }
        if (tData.tracks?.items) {
           tracks.push(...tData.tracks.items.map((t: any) => ({
               id: `tidal-track-${t.id}`,
               title: t.title || 'Unknown Track',
               artist: t.artist?.name || 'Unknown Artist',
               album: t.album?.title || 'Unknown Album',
               artwork: t.album?.cover ? `https://resources.tidal.com/images/${t.album.cover.replace(/-/g, '/')}/640x640.jpg` : '',
               duration: t.duration ? Math.floor(t.duration / 60) + ':' + (t.duration % 60).toString().padStart(2, '0') : '0:00',
               rawDuration: t.duration || 0,
               previewUrl: t.url || '',
               streamUrl: `/api/music/stream?url=${encodeURIComponent(t.url || '')}`,
               isFullLength: true
           })));
        }
      }
    }

    if (tracks.length < 5) {
      tracks = [...tracks, ...ALL_OFFICIAL_TRACKS.slice(0, 30)];
    }

    tracks = tracks.filter((t) => t.title && (t.previewUrl || t.streamUrl));
    const seenTracks = new Set<string>();
    tracks = tracks.filter((t) => {
      const key = `${t.title.toLowerCase()}-${t.artist.toLowerCase()}`;
      if (seenTracks.has(key)) return false;
      seenTracks.add(key);
      return true;
    });

    return c.json({
      success: true,
      count: tracks.length,
      artists: artists.slice(0, 12),
      albums: albums.slice(0, 15),
      tracks: tracks.slice(0, 30),
    });
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to search music', message: err?.message }, 500);
  }
});

app.get('/api/music/artist/:id', (c) => {
  const id = c.req.param('id');
  const match = ALL_OFFICIAL_ARTISTS.find((a) => a.id === id || a.name.toLowerCase() === id.toLowerCase());
  if (match) return c.json({ success: true, artist: match });
  return c.json({ success: false, error: 'Artist not found' }, 404);
});

app.get('/api/music/album/:id', (c) => {
  const id = c.req.param('id');
  const match = ALL_OFFICIAL_ALBUMS.find((al) => al.id === id || al.title.toLowerCase() === id.toLowerCase());
  if (match) return c.json({ success: true, album: match });
  return c.json({ success: false, error: 'Album not found' }, 404);
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
  if (!filename.endsWith('.html')) filename = `${filename}.html`;

  const rawgithackUrl = `https://raw.githack.com/freebuisness/html/main/${filename}`;
  const githubRawUrl = `https://raw.githubusercontent.com/freebuisness/html/main/${filename}`;

  try {
    let response = await fetch(rawgithackUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!response.ok) response = await fetch(githubRawUrl);
    if (!response.ok) return c.text('Failed to fetch game package', response.status);

    let html = await response.text();
    const desktopSpoof = `<script>(function(){/* Desktop Spoof Script */})()</script>`;
    html = html.replace('<head>', `<head>${desktopSpoof}`);

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
