import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

import fs from 'fs';

// Ensure uploads directory exists for persistent local file hosting
const uploadsDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  next();
}, express.static(uploadsDir));

// File Upload Endpoint
app.post('/api/upload', (req, res) => {
  try {
    const { filename, base64Data, mimeType } = req.body;
    if (!filename || !base64Data) {
      return res.status(400).json({ error: 'Missing filename or base64 file data' });
    }

    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const safeName = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
    const filePath = path.join(uploadsDir, safeName);

    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/${safeName}`;
    res.json({
      success: true,
      url: publicUrl,
      filename,
      size: buffer.length,
      mimeType: mimeType || 'application/octet-stream',
    });
  } catch (err: any) {
    console.error('File upload error:', err);
    res.status(500).json({ error: 'Failed to upload file to server', message: err?.message });
  }
});

// File Download Endpoint
app.get('/api/download', async (req, res) => {
  try {
    const fileUrl = (req.query.url as string) || '';
    const rawFilename = (req.query.filename as string) || 'download';
    const filename = path.basename(rawFilename).replace(/[^\w.-]/g, '_') || 'download';

    if (!fileUrl) {
      return res.status(400).send('Missing url parameter');
    }

    if (fileUrl.startsWith('/uploads/')) {
      const safeBasename = path.basename(fileUrl);
      const localPath = path.join(uploadsDir, safeBasename);
      if (fs.existsSync(localPath)) {
        return res.download(localPath, filename);
      }
    }

    const extRes = await fetch(fileUrl);
    if (!extRes.ok) {
      return res.status(extRes.status).send('Failed to fetch remote attachment');
    }

    const contentType = extRes.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await extRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', buffer.length.toString());
    res.send(buffer);
  } catch (err: any) {
    console.error('Download endpoint error:', err);
    res.status(500).send('Failed to download file');
  }
});

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

// Giphy Search & Trending API Proxy (Supports full Giphy library, limit=50, pagination)
app.get('/api/giphy/search', async (req, res) => {
  const query = (req.query.q as string) || '';
  const limit = (req.query.limit as string) || '50';
  const offset = (req.query.offset as string) || '0';
  const apiKey = process.env.GIPHY_API_KEY || 'sXpGFDGZs0Dv1mmNFvYaGUvYwKX0PWIh';

  const endpoint = !query.trim() || query === 'trending'
    ? `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=${limit}&offset=${offset}`
    : `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`;

  try {
    const response = await fetch(endpoint);
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch Giphy GIFs', message: err?.message });
  }
});

// Load pre-compiled HTML package tree for instant filename resolution
const htmlTreePath = path.resolve(__dirname, 'src/data/htmlTree.json');
let htmlTree: string[] = [];
let htmlTreeSet = new Set<string>();
if (fs.existsSync(htmlTreePath)) {
  try {
    htmlTree = JSON.parse(fs.readFileSync(htmlTreePath, 'utf-8'));
    htmlTreeSet = new Set(htmlTree);
    console.log(`🎮 [Game Index] Loaded ${htmlTree.length} verified game packages into memory.`);
  } catch (e) {
    console.warn('[Game Index] Failed to parse htmlTree.json:', e);
  }
}

// Memory caches for sub-millisecond local serving
const rawGameMemoryCache = new Map<string, string>();
const coverMemoryCache = new Map<string, { buffer: Buffer; contentType: string }>();

function resolveGameFilename(requested: string): string {
  let fname = requested.replace(/\.html$/, '').trim();
  if (htmlTreeSet.has(fname + '.html')) return fname + '.html';
  if (htmlTreeSet.has(requested)) return requested;

  const baseNum = fname.split('-')[0];
  const candidates = [
    fname + '-fix2.html',
    fname + '-fix.html',
    fname + '-fix3.html',
    fname + '-f2.html',
    fname + '-fde.html',
    fname + '-f.html',
    fname + '-fixed.html',
    fname + '-ff.html',
    fname + '-F2.html',
    fname + '-wow2.html',
    fname + '-a.html',
    baseNum + '-fix2.html',
    baseNum + '-fix.html',
    baseNum + '-fix3.html',
    baseNum + '-fixed.html',
    baseNum + '-f2.html',
    baseNum + '-f.html',
    baseNum + '-ff.html',
    baseNum + '-fde.html',
    baseNum + '-F2.html',
    baseNum + '.html'
  ];
  for (const c of candidates) {
    if (htmlTreeSet.has(c)) return c;
  }
  const startsWith = htmlTree.find(f => f.toLowerCase().startsWith(baseNum.toLowerCase() + '-'));
  if (startsWith) return startsWith;
  return requested.endsWith('.html') ? requested : requested + '.html';
}

// Cover image proxy: guarantees 100% cover display on school/restricted networks
app.get('/api/cover/:filename', async (req, res) => {
  let filename = req.params.filename;
  if (!filename) return res.status(400).send('Invalid cover filename');
  const cleanFilename = filename.endsWith('.png') ? filename : `${filename}.png`;

  if (coverMemoryCache.has(cleanFilename)) {
    const cached = coverMemoryCache.get(cleanFilename)!;
    res.setHeader('Content-Type', cached.contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(cached.buffer);
  }

  const sources = [
    `https://cdn.jsdelivr.net/gh/freebuisness/covers@main/${cleanFilename}`,
    `https://raw.githubusercontent.com/freebuisness/covers/main/${cleanFilename}`,
  ];

  for (const src of sources) {
    try {
      const response = await fetch(src, { 
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000) 
      });
      if (response.ok) {
        const arrayBuf = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const contentType = response.headers.get('content-type') || 'image/png';
        coverMemoryCache.set(cleanFilename, { buffer, contentType });
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.send(buffer);
      }
    } catch {}
  }

  // Graceful dynamic SVG fallback so no card ever breaks
  const rawTitle = cleanFilename.replace('.png', '').replace(/[-_]/g, ' ');
  const titleDisplay = rawTitle.length > 20 ? rawTitle.substring(0, 18) + '...' : rawTitle;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#0d0d11;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#1c1c24;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="400" height="250" fill="url(#g)" rx="16"/>
    <circle cx="200" cy="95" r="38" fill="#0066ff" fill-opacity="0.15" stroke="#0066ff" stroke-width="2"/>
    <polygon points="195,82 215,95 195,108" fill="#0066ff" />
    <text x="200" y="165" fill="#f4f4f5" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="16" font-weight="800" text-anchor="middle">${titleDisplay.toUpperCase()}</text>
    <text x="200" y="190" fill="#0066ff" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="11" font-weight="700" letter-spacing="1.5" text-anchor="middle">⚡ INSTALLED LUMIN</text>
  </svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send(svg);
});

// Proxy game files to guarantee 100% reliable iframe loading across ANY device and network
app.get('/api/raw/:filename', async (req, res) => {
  let filename = req.params.filename;
  if (!filename) {
    return res.status(400).send('Invalid game filename');
  }

  // Resolve target to exact existing package in tree
  const targetFilename = resolveGameFilename(filename);

  // Return instantly from in-memory cache if available
  if (rawGameMemoryCache.has(targetFilename)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    return res.send(rawGameMemoryCache.get(targetFilename)!);
  }

  const jsdelivrUrl = `https://cdn.jsdelivr.net/gh/freebuisness/html@main/${targetFilename}`;
  const githubRawUrl = `https://raw.githubusercontent.com/freebuisness/html/main/${targetFilename}`;

  try {
    let response: Response | null = null;
    let html = '';

    // Step 1: Try ultra-fast jsdelivr CDN
    try {
      const res1 = await fetch(jsdelivrUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(6000),
      });
      if (res1.ok) {
        response = res1;
        html = await res1.text();
      }
    } catch {}

    // Step 2: Fallback to GitHub Raw if jsdelivr is blocked on restricted Wi-Fi
    if (!response || !response.ok || !html) {
      try {
        const res2 = await fetch(githubRawUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(8000),
        });
        if (res2.ok) {
          response = res2;
          html = await res2.text();
        }
      } catch {}
    }

    if (!html) {
      return res.status(404).send(`Failed to fetch game package for ${filename} (resolved: ${targetFilename})`);
    }

    // Desktop Spoofing, GPU Acceleration, Inactivity Wake-Up, & Batch Save Sync for School Chromebooks
    const desktopSpoof = `<script>(function(){try{
var u='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
Object.defineProperty(navigator,'userAgent',{get:function(){return u},configurable:true});
Object.defineProperty(navigator,'platform',{get:function(){return'Win32'},configurable:true});
Object.defineProperty(navigator,'vendor',{get:function(){return'Google Inc.'},configurable:true});
if(navigator.userAgentData){Object.defineProperty(navigator,'userAgentData',{get:function(){return{brands:[{brand:'Chromium',version:'124'},{brand:'Google Chrome',version:'124'}],mobile:false,platform:'Windows',getHighEntropyValues:function(){return Promise.resolve({architecture:'x86',bitness:'64',mobile:false,platform:'Windows'})}}},configurable:true});}

var s=document.createElement('style');
s.textContent='canvas,#canvas,body{image-rendering:pixelated;image-rendering:-webkit-optimize-contrast;image-rendering:crisp-edges;transform:translate3d(0,0,0);backface-visibility:hidden;}';
(document.head||document.documentElement).appendChild(s);

// High-Performance WebGL/Canvas context override for Chromebook GPUs
var origGetContext=HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext=function(type,attrs){
  attrs=attrs||{};
  if(type==='webgl'||type==='webgl2'||type==='experimental-webgl'){
    attrs.powerPreference='high-performance';
    attrs.desynchronized=true;
    attrs.antialias=false;
    attrs.preserveDrawingBuffer=false;
  }else if(type==='2d'){
    attrs.desynchronized=true;
  }
  return origGetContext.call(this,type,attrs);
};

var trackedAudio=[];
var OrigAudioCtx=window.AudioContext||window.webkitAudioContext;
if(OrigAudioCtx){
  var PatchedAudio=function(){
    var ctx=new OrigAudioCtx();
    trackedAudio.push(ctx);
    return ctx;
  };
  PatchedAudio.prototype=OrigAudioCtx.prototype;
  window.AudioContext=PatchedAudio;
  if(window.webkitAudioContext) window.webkitAudioContext=PatchedAudio;
}

function wakeGameEngine(){
  try{
    trackedAudio.forEach(function(ctx){
      if(ctx&&ctx.state==='suspended'){ctx.resume().catch(function(){});}
    });
    // Unpause GameMaker HTML5 (Undertale / Undertale Yellow)
    if(typeof window.g_isWindowBlurred!=='undefined') window.g_isWindowBlurred=false;
    if(typeof window.g_WindowHasFocus!=='undefined') window.g_WindowHasFocus=true;
    if(window.g_pGMEntityManager){
      if(typeof window.g_pGMEntityManager.Resume==='function') try{window.g_pGMEntityManager.Resume();}catch(e){}
      if(typeof window.g_pGMEntityManager.UnPause==='function') try{window.g_pGMEntityManager.UnPause();}catch(e){}
    }
    window.focus();
    var c=document.querySelector('canvas')||document.getElementById('canvas');
    if(c){
      if(c.focus) c.focus();
      c.dispatchEvent(new Event('focus'));
    }
    window.dispatchEvent(new Event('focus'));
  }catch(e){}
}

window.addEventListener('focus',wakeGameEngine,true);
window.addEventListener('click',wakeGameEngine,true);
window.addEventListener('pointerdown',wakeGameEngine,true);
window.addEventListener('mousedown',wakeGameEngine,true);
window.addEventListener('keydown',wakeGameEngine,true);
window.addEventListener('touchstart',wakeGameEngine,true);
document.addEventListener('visibilitychange',function(){if(!document.hidden)wakeGameEngine();});

// Watchdog to immediately revive audio and game loop after inactive tab backgrounding
setInterval(function(){
  if(!document.hidden){
    try{
      trackedAudio.forEach(function(ctx){
        if(ctx&&ctx.state==='suspended'){ctx.resume().catch(function(){});}
      });
      if(typeof window.g_isWindowBlurred!=='undefined'&&window.g_isWindowBlurred) window.g_isWindowBlurred=false;
      if(typeof window.g_WindowHasFocus!=='undefined'&&!window.g_WindowHasFocus) window.g_WindowHasFocus=true;
    }catch(e){}
  }
},1000);

var pendingSaveBatch={};
var saveFlushTimer=null;
function sendPendingSaves(){
  if(Object.keys(pendingSaveBatch).length===0)return;
  try{
    window.parent.postMessage({type:'FROSTED_SAVE_BATCH',data:pendingSaveBatch},'*');
    pendingSaveBatch={};
  }catch(e){}
}

var origSetItem=localStorage.setItem;
localStorage.setItem=function(k,v){
  try{
    origSetItem.apply(this,arguments);
    pendingSaveBatch[k]=String(v);
    if(!saveFlushTimer){
      saveFlushTimer=setTimeout(function(){
        saveFlushTimer=null;
        sendPendingSaves();
      },1000);
    }
  }catch(e){
    origSetItem.apply(this,arguments);
  }
};

window.addEventListener('beforeunload',sendPendingSaves);
window.addEventListener('pagehide',sendPendingSaves);

window.addEventListener('message',function(e){
  if(!e.data)return;
  if(e.data.type==='FROSTED_RESTORE_SAVES'&&e.data.saves){
    Object.keys(e.data.saves).forEach(function(k){try{origSetItem.call(localStorage,k,e.data.saves[k]);}catch(err){}});
    wakeGameEngine();
  }
  if(e.data.type==='RESUME_GAME'||e.data.type==='WAKE_GAME'){
    wakeGameEngine();
  }
});
}catch(e){}})();</script>`;

    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>${desktopSpoof}`);
    } else if (html.includes('<html>')) {
      html = html.replace('<html>', `<html><head>${desktopSpoof}</head>`);
    } else {
      html = `${desktopSpoof}${html}`;
    }

    // Cache in memory for instant subsequent loads
    rawGameMemoryCache.set(targetFilename, html);

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
