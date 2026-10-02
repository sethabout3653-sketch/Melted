import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

app.use(express.json());

// 14-Minute Self-Ping Keep-Alive for Render
const FOURTEEN_MINUTES_MS = 14 * 60 * 1000;

function startRenderKeepAlive() {
  console.log(`[Render Keep-Alive] 14-minute periodic ping initiated.`);

  setInterval(async () => {
    try {
      const baseUrl =
        process.env.RENDER_EXTERNAL_URL ||
        process.env.APP_URL ||
        `http://localhost:${PORT}`;

      const target = `${baseUrl.replace(/\/$/, '')}/api/health`;
      console.log(`[Render Keep-Alive 14m] Ping sent to ${target} at ${new Date().toISOString()}`);

      const res = await fetch(target, {
        headers: { 'User-Agent': 'Render-KeepAlive-14min/1.0' },
        signal: AbortSignal.timeout(15000),
      });

      console.log(`[Render Keep-Alive 14m] Response status: ${res.status}`);
    } catch (err: any) {
      console.warn(`[Render Keep-Alive 14m] Ping error:`, err?.message || err);
    }
  }, FOURTEEN_MINUTES_MS);
}

// Health check endpoint (used for keep-alive ping & Render health checks)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    keepAliveEvery: '14 minutes',
    timestamp: new Date().toISOString(),
    service: 'Melted - Unblocked Arcade',
  });
});

// Proxy game files to guarantee 100% reliable iframe loading
// Fetches from RawGitHack first, with resilient fallback to GitHub Raw if Cloudflare restricts it
app.get('/api/raw/:filename', async (req, res) => {
  const filename = req.params.filename;
  if (!filename || !filename.endsWith('.html')) {
    return res.status(400).send('Invalid game filename');
  }

  const rawgithackUrl = `https://raw.githack.com/freebuisness/html/main/${filename}`;
  const githubRawUrl = `https://raw.githubusercontent.com/freebuisness/html/main/${filename}`;

  try {
    let response = await fetch(rawgithackUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(8000),
    });

    // If raw.githack returns 403 or error, fallback to upstream GitHub Raw
    if (!response.ok) {
      response = await fetch(githubRawUrl, {
        signal: AbortSignal.timeout(8000),
      });
    }

    if (!response.ok) {
      return res.status(response.status).send(`Failed to fetch game package: ${response.statusText}`);
    }

    const html = await response.text();

    // Serve with permissive headers and long-term caching for offline speed
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    res.send(html);
  } catch (error: any) {
    console.error(`Error loading game ${filename}:`, error);
    res.status(500).send(`Error streaming game: ${error?.message || error}`);
  }
});

import http from 'http';
import { initWebSocketDatabase } from './src/server/wsDatabase';

// Serve frontend: Vite dev middlewares in development, static files in production
async function startServer() {
  const server = http.createServer(app);

  // Initialize PostgreSQL-like WebSocket Database on /ws-db
  initWebSocketDatabase(server);

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, port: 3000, host: '0.0.0.0' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🔥 Melted server running on http://0.0.0.0:${PORT} (Mode: ${IS_PROD ? 'Production' : 'Development'})`);
    startRenderKeepAlive();
  });
}

startServer();
