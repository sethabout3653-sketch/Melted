import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import http from 'http';
import { Readable } from 'stream';
import { initWebSocketDatabase } from './src/server/wsDatabase';
import { GoogleGenAI } from "@google/genai";
import Groq from 'groq-sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini for TTS Voicemail
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'Frosted - Arcade & Chat',
  });
});

app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Giphy Search & Trending API Proxy
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

// Gemini TTS Voicemail Prompt Endpoint
app.get('/api/voicemail/prompt', async (req, res) => {
  try {
    const text = "The person you are calling is unavailable. Please leave a message after the tone.";
    
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash-lite-tts",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: text,
              speechMetadata: {
                style: "Clear, professional voicemail greeting",
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
            prebuiltVoiceConfig: { voiceName: "Kore" },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      res.json({ success: true, audio: base64Audio });
    } else {
      res.status(500).json({ error: 'Failed to generate speech' });
    }
  } catch (err: any) {
    console.error('TTS error:', err);
    res.status(500).json({ error: 'TTS generation failed', message: err?.message });
  }
});

// AI Study Assistant Endpoint (smart Groq API & Gemini auto-detection)
app.post('/api/ai/assistant', async (req, res) => {
  try {
    const { prompt, history } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const systemInstruction = "You are Frosted AI, an intelligent, helpful, warm, concise, and clear study assistant and academic tutor. You assist students with study questions, homework, concept explanations, math problem steps, essay outlines, and practice quizzes. Give direct, insightful, concise, well-structured, and helpful answers using markdown formatting. Never use robotic disclaimers or canned phrases like 'As an AI language model...'. Answer in a friendly, conversational, human tone.";

    let replyText = '';

    // Auto-detect Groq API Key (Groq keys start with 'gsk_') from GROQ_API_KEY, VITE_GROQ_API_KEY, or GEMINI_API_KEY
    const envGroq = (process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || '').replace(/^["']|["']$/g, '').trim();
    const envGemini = (process.env.GEMINI_API_KEY || '').replace(/^["']|["']$/g, '').trim();
    const groqKey = envGroq || (envGemini.startsWith('gsk_') ? envGemini : '');
    const geminiKey = envGemini.startsWith('gsk_') ? '' : envGemini;

    // 1. TRY GROQ API FIRST if a valid gsk_ Groq key is present
    if (groqKey) {
      try {
        console.log(`[Groq AI] Attempting Groq completion with key starting ${groqKey.slice(0, 6)}...`);
        
        const groqMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          { role: 'system', content: systemInstruction },
        ];

        if (Array.isArray(history) && history.length > 0) {
          for (const msg of history) {
            if (msg.role && msg.text) {
              groqMessages.push({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.text,
              });
            }
          }
        }

        groqMessages.push({ role: 'user', content: prompt });

        const groqModels = [
          'llama-3.3-70b-versatile',
          'llama-3.1-8b-instant',
          'llama3-70b-8192',
          'llama3-8b-8192',
          'mixtral-8x7b-32768',
          'gemma2-9b-it'
        ];

        for (const model of groqModels) {
          try {
            const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${groqKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: model,
                messages: groqMessages,
                temperature: 0.7,
                max_tokens: 1024,
              }),
            });

            if (groqRes.ok) {
              const data = await groqRes.json();
              const text = data.choices?.[0]?.message?.content;
              if (text) {
                replyText = text;
                console.log(`[Groq AI] Success using model ${model}`);
                break;
              }
            } else {
              const errBody = await groqRes.text();
              console.warn(`[Groq AI] Model ${model} HTTP ${groqRes.status}:`, errBody);
            }
          } catch (mErr: any) {
            console.warn(`[Groq AI] Model ${model} fetch error:`, mErr?.message || mErr);
          }
        }
      } catch (gErr: any) {
        console.warn('[Groq AI] Groq API call failed, attempting Gemini fallback:', gErr?.message || gErr);
      }
    }

    // 2. FALLBACK TO GEMINI API if Groq key was not set or Groq call failed
    if (!replyText) {
      const formattedContents = [];
      if (Array.isArray(history) && history.length > 0) {
        for (const msg of history) {
          if (msg.role && msg.text) {
            formattedContents.push({
              role: msg.role === 'user' ? 'user' : 'model',
              parts: [{ text: msg.text }],
            });
          }
        }
      }
      formattedContents.push({
        role: 'user',
        parts: [{ text: prompt }],
      });

      const client = geminiKey ? new GoogleGenAI({ apiKey: geminiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } }) : ai;

      const geminiModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];

      for (const modelName of geminiModels) {
        try {
          const response = await client.models.generateContent({
            model: modelName,
            contents: formattedContents,
            config: { systemInstruction },
          });

          if (response && response.text) {
            replyText = response.text;
            console.log(`[Gemini AI] Success using model ${modelName}`);
            break;
          }
        } catch (err: any) {
          console.warn(`[Gemini AI] Model ${modelName} failed:`, err?.message || err);
        }
      }
    }

    if (!replyText) {
      throw new Error('All AI service providers (Groq & Gemini) were temporarily unavailable. Please check your API key in Vercel environment variables.');
    }

    res.json({ success: true, reply: replyText });
  } catch (err: any) {
    console.error('AI Assistant API Error:', err);
    res.status(500).json({ error: 'AI Assistant error', message: err?.message || 'Failed to generate response' });
  }
});

// Cover Image Proxy
app.get('/api/cover/:path(*)', async (req, res) => {
  const coverPath = req.params.path;
  if (!coverPath) {
    return res.status(400).send('Invalid cover path');
  }

  const primaryUrl = `https://raw.githubusercontent.com/gn-math/covers/main/${coverPath}`;
  const fallbackUrl = `https://cdn.statically.io/gh/gn-math/covers/main/${coverPath}`;

  try {
    let response = await fetch(primaryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      response = await fetch(fallbackUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        signal: AbortSignal.timeout(6000),
      });
    }

    if (!response.ok) {
      return res.status(response.status).send('Cover image not found');
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).send('Error fetching cover');
  }
});

// File map lookup
const fileMapPath = path.resolve(__dirname, 'src/data/gnMathFileMap.json');
let fileMap: Record<string, string> = {};
if (fs.existsSync(fileMapPath)) {
  try {
    fileMap = JSON.parse(fs.readFileSync(fileMapPath, 'utf8'));
  } catch {}
}

// Proxy game files to guarantee 100% reliable iframe loading
app.get('/api/raw/:filename(*)', async (req, res) => {
  let rawPath = req.params.filename || '';
  if (!rawPath) {
    return res.status(400).send('Invalid game filename');
  }

  // Look up in gnMathFileMap
  const mapped = fileMap[rawPath] || fileMap[`${rawPath}.html`] || fileMap[rawPath.replace(/\.html$/, '')];
  if (mapped) {
    rawPath = mapped;
  } else if (!rawPath.includes('.') && !rawPath.includes('/')) {
    rawPath = `${rawPath}.html`;
  }

  const isHtml = rawPath.endsWith('.html') || rawPath.endsWith('.htm');
  const baseNum = rawPath.match(/^\d+/)?.[0];
  const candidates = [
    rawPath,
    ...(baseNum ? [
      `${baseNum}-fix3.html`,
      `${baseNum}-fix2.html`,
      `${baseNum}-fix.html`,
      `${baseNum}-f.html`,
      `${baseNum}-fde.html`,
      `${baseNum}-pf.html`,
      `${baseNum}.html`
    ] : [])
  ];

  try {
    let response: Response | null = null;
    let successfulFile = rawPath;

    for (const cand of candidates) {
      const rawgithackUrl = `https://raw.githack.com/gn-math/html/main/${cand}`;
      try {
        const testRes = await fetch(rawgithackUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(6000),
        });
        if (testRes.ok) {
          response = testRes;
          successfulFile = cand;
          break;
        }
      } catch {}
    }

    if (!response || !response.ok) {
      const jsdelivrUrl = `https://cdn.jsdelivr.net/gh/gn-math/html@main/${rawPath}`;
      response = await fetch(jsdelivrUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(8000),
      });
    }

    if (!response || !response.ok) {
      return res.status(response?.status || 404).send(`Failed to fetch game package: ${response?.statusText || 'Not found'}`);
    }

    rawPath = successfulFile;

    if (!isHtml) {
      // Pipe binary / JS / WASM / CSS asset with appropriate headers
      const contentType = response.headers.get('content-type') || 
        (rawPath.endsWith('.js') ? 'application/javascript' :
         rawPath.endsWith('.wasm') ? 'application/wasm' :
         rawPath.endsWith('.css') ? 'text/css' :
         rawPath.endsWith('.png') ? 'image/png' :
         rawPath.endsWith('.jpg') || rawPath.endsWith('.jpeg') ? 'image/jpeg' :
         rawPath.endsWith('.json') ? 'application/json' : 'application/octet-stream');

      const arrayBuffer = await response.arrayBuffer();
      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(Buffer.from(arrayBuffer));
    }

    let html = await response.text();

    // Determine directory base for relative asset resolution through raw.githack.com
    const dirBase = rawPath.includes('/') ? rawPath.substring(0, rawPath.lastIndexOf('/') + 1) : '';
    const rawgithackBaseTag = `<base href="https://raw.githack.com/gn-math/html/main/${dirBase}">`;

    // Desktop Spoofing & GPU Optimization script injection
    const desktopSpoof = `${rawgithackBaseTag}<script>(function(){try{
var u='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
Object.defineProperty(navigator,'userAgent',{get:function(){return u},configurable:true});
Object.defineProperty(navigator,'platform',{get:function(){return'Win32'},configurable:true});
Object.defineProperty(navigator,'vendor',{get:function(){return'Google Inc.'},configurable:true});
if(navigator.userAgentData){Object.defineProperty(navigator,'userAgentData',{get:function(){return{brands:[{brand:'Chromium',version:'124'},{brand:'Google Chrome',version:'124'}],mobile:false,platform:'Windows',getHighEntropyValues:function(){return Promise.resolve({architecture:'x86',bitness:'64',mobile:false,platform:'Windows'})}}},configurable:true});}

var s=document.createElement('style');
s.textContent='canvas,#canvas,body{image-rendering:pixelated;image-rendering:-webkit-optimize-contrast;image-rendering:crisp-edges;transform:translate3d(0,0,0);backface-visibility:hidden;}';
(document.head||document.documentElement).appendChild(s);

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
}catch(e){}})();</script>`;

    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>${desktopSpoof}`);
    } else if (html.includes('<html>')) {
      html = html.replace('<html>', `<html><head>${desktopSpoof}</head>`);
    } else {
      html = `${desktopSpoof}${html}`;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.send(html);
  } catch (error: any) {
    console.error(`Error loading game ${rawPath}:`, error);
    res.status(500).send(`Error streaming game: ${error?.message || error}`);
  }
});

// Serve frontend: Vite dev middlewares in development, static files in production
async function startServer() {
  const server = http.createServer(app);

  // Initialize Pure WebSocket Database on /ws-db
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
    console.log(`🔥 Frosted server running on http://0.0.0.0:${PORT} (Mode: ${IS_PROD ? 'Production' : 'Development'})`);
  });
}

startServer();
