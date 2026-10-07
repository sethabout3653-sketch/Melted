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
  let filename = req.params.filename;
  if (!filename) {
    return res.status(400).send('Invalid game filename');
  }
  if (!filename.endsWith('.html')) {
    filename = `${filename}.html`;
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

    let html = await response.text();

    // Desktop Spoofing, GPU Acceleration, Inactivity Wake-Up, & Batch Save Sync for School Chromebooks
    const desktopSpoof = `<script>(function(){try{
var u='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
Object.defineProperty(navigator,'userAgent',{get:function(){return u},configurable:true});
Object.defineProperty(navigator,'platform',{get:function(){return'Win32'},configurable:true});
Object.defineProperty(navigator,'vendor',{get:function(){return'Google Inc.'},configurable:true});
if(navigator.userAgentData){Object.defineProperty(navigator,'userAgentData',{get:function(){return{brands:[{brand:'Chromium',version:'124'},{brand:'Google Chrome',version:'124'}],mobile:false,platform:'Windows',getHighEntropyValues:function(){return Promise.resolve({architecture:'x86',bitness:'64',mobile:false,platform:'Windows'})}}},configurable:true});}

var s=document.createElement('style');
s.textContent='canvas,#canvas,body{image-rendering:-webkit-optimize-contrast;image-rendering:crisp-edges;transform:translate3d(0,0,0);backface-visibility:hidden;}';
(document.head||document.documentElement).appendChild(s);

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
    window.focus();
  }catch(e){}
}

window.addEventListener('focus',wakeGameEngine,true);
window.addEventListener('click',wakeGameEngine,true);
window.addEventListener('keydown',wakeGameEngine,true);
window.addEventListener('touchstart',wakeGameEngine,true);
document.addEventListener('visibilitychange',function(){if(!document.hidden)wakeGameEngine();});

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
