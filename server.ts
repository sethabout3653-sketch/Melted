import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import http from 'http';
import { Readable } from 'stream';
import { initWebSocketDatabase, globalWsDb, broadcastTable, broadcastWss, sendToUserSockets } from './src/server/wsDatabase';
import Groq from 'groq-sdk';
import { processGameHtml, getScaffoldingBuffer } from './src/server/scaffoldingLoader';
import { initSethsrcEngine } from './src/server/sethsrcEngine';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Initialize Sethsrc HLS Streaming & Reverse Proxy Engine
initSethsrcEngine(app, __dirname);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Global CORS middleware for published & preview apps
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

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
    service: 'FrostHub - Entertainment & Chat',
  });
});

app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// --- WebSocket Database REST API Fallback Endpoints ---
app.get('/api/ws-db/snapshot', (req, res) => {
  res.json({
    success: true,
    users: globalWsDb.getUsers(),
    messages: globalWsDb.messages,
    channels: globalWsDb.channels,
    timestamp: Date.now(),
  });
});

app.post('/api/ws-db/register', (req, res) => {
  try {
    const { user } = req.body;
    if (!user || !user.id) {
      return res.status(400).json({ error: 'Missing user object or user.id' });
    }
    const existingUser = globalWsDb.getUser(user.id);
    const userObj = {
      id: user.id,
      username: user.username || existingUser?.username || 'Player',
      avatar_color: user.avatar_color || existingUser?.avatar_color || '#0066ff',
      avatar_url: user.avatar_url ?? existingUser?.avatar_url ?? '',
      current_channel: user.current_channel || existingUser?.current_channel || 'text-general',
      is_speaking: user.is_speaking !== undefined ? Boolean(user.is_speaking) : Boolean(existingUser?.is_speaking),
      is_muted: user.is_muted !== undefined ? Boolean(user.is_muted) : Boolean(existingUser?.is_muted),
      is_deafened: user.is_deafened !== undefined ? Boolean(user.is_deafened) : Boolean(existingUser?.is_deafened),
      has_video: user.has_video !== undefined ? Boolean(user.has_video) : Boolean(existingUser?.has_video),
      is_screen_sharing: user.is_screen_sharing !== undefined ? Boolean(user.is_screen_sharing) : Boolean(existingUser?.is_screen_sharing),
      activity: user.activity ?? existingUser?.activity ?? '',
      typing_channel: user.typing_channel ?? existingUser?.typing_channel ?? undefined,
      typing_at: user.typing_at ?? existingUser?.typing_at ?? undefined,
      updated_at: Date.now(),
    };
    globalWsDb.upsertUser(userObj as any);
    broadcastTable('users', globalWsDb.getUsers());
    res.json({ success: true, user: userObj, users: globalWsDb.getUsers() });
  } catch (err: any) {
    res.status(500).json({ error: 'Register failed', message: err?.message });
  }
});

app.post('/api/ws-db/update-user', (req, res) => {
  try {
    const { id, set } = req.body;
    if (!id || !set) {
      return res.status(400).json({ error: 'Missing id or set parameters' });
    }
    const existing = globalWsDb.getUser(id);
    const updated = {
      id,
      username: existing?.username || 'Player',
      avatar_color: existing?.avatar_color || '#0066ff',
      avatar_url: existing?.avatar_url || '',
      current_channel: existing?.current_channel || 'text-general',
      is_speaking: existing?.is_speaking || false,
      is_muted: existing?.is_muted || false,
      is_deafened: existing?.is_deafened || false,
      has_video: existing?.has_video || false,
      is_screen_sharing: existing?.is_screen_sharing || false,
      activity: existing?.activity || '',
      ...existing,
      ...set,
      updated_at: Date.now(),
    };
    globalWsDb.upsertUser(updated as any);
    broadcastTable('users', globalWsDb.getUsers());
    res.json({ success: true, user: updated, users: globalWsDb.getUsers() });
  } catch (err: any) {
    res.status(500).json({ error: 'Update user failed', message: err?.message });
  }
});

app.post('/api/ws-db/leave', (req, res) => {
  try {
    const { id } = req.body;
    if (id) {
      const user = globalWsDb.getUser(id);
      const oldChannel = user?.current_channel;
      globalWsDb.deleteUser(id);
      broadcastTable('users', globalWsDb.getUsers());
      if (oldChannel === 'video-general' || oldChannel === 'voice-general') {
        broadcastWss({
          type: 'USER_LEFT_MEDIA',
          userId: id,
          channel: oldChannel,
          timestamp: Date.now(),
        });
      }
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Leave failed', message: err?.message });
  }
});

app.post('/api/ws-db/message', (req, res) => {
  try {
    const { row } = req.body;
    if (!row || !row.id) {
      return res.status(400).json({ error: 'Missing message row' });
    }
    const newMsg = {
      id: row.id,
      channel_id: row.channel_id || 'text-general',
      sender_id: row.sender_id || 'anon',
      sender_name: row.sender_name || 'Player',
      avatar_color: row.avatar_color || '#0066ff',
      sender_avatar_url: row.sender_avatar_url || '',
      content: row.content || '',
      attachment_url: row.attachment_url,
      attachment_type: row.attachment_type,
      attachment_name: row.attachment_name,
      timestamp: row.timestamp || ('Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
      created_at: Number(row.created_at) || Date.now(),
    };
    globalWsDb.insertMessage(newMsg as any);
    broadcastTable('messages', globalWsDb.messages);
    res.json({ success: true, message: newMsg, messages: globalWsDb.messages });
  } catch (err: any) {
    res.status(500).json({ error: 'Insert message failed', message: err?.message });
  }
});

app.delete('/api/ws-db/message/:id', (req, res) => {
  try {
    const messageId = req.params.id;
    if (messageId) {
      globalWsDb.deleteMessage(messageId);
      broadcastWss({ type: 'SQL_DELETE', table: 'messages', id: messageId });
      broadcastTable('messages', globalWsDb.messages);
    }
    res.json({ success: true, messages: globalWsDb.messages });
  } catch (err: any) {
    res.status(500).json({ error: 'Delete message failed', message: err?.message });
  }
});

app.delete('/api/ws-db/channel-messages/:channelId', (req, res) => {
  try {
    const channelId = req.params.channelId;
    if (channelId) {
      globalWsDb.deleteChannelMessages(channelId);
      broadcastWss({ type: 'SQL_DELETE_CHANNEL', table: 'messages', channel_id: channelId });
      broadcastTable('messages', globalWsDb.messages);
    }
    res.json({ success: true, messages: globalWsDb.messages });
  } catch (err: any) {
    res.status(500).json({ error: 'Delete channel messages failed', message: err?.message });
  }
});

app.delete('/api/ws-db/messages/all', (req, res) => {
  try {
    globalWsDb.deleteAllMessages();
    broadcastWss({ type: 'DB_CLEAR_MESSAGES' });
    res.json({ success: true, messages: [] });
  } catch (err: any) {
    res.status(500).json({ error: 'Global delete failed', message: err?.message });
  }
});

app.post('/api/ws-db/signal', (req, res) => {
  try {
    const { fromUserId, fromUserName, targetUserId, type, callType, signal } = req.body;
    if (!targetUserId || targetUserId === fromUserId) {
      return res.status(400).json({ error: 'Invalid targetUserId' });
    }

    const payload = {
      type,
      fromUserId,
      fromUserName: fromUserName || 'Player',
      targetUserId,
      callType: callType || 'audio',
      signal,
      ...(req.body.voicemail ? { voicemail: req.body.voicemail } : {}),
      timestamp: Date.now(),
    };

    const delivered = sendToUserSockets(targetUserId, payload);
    if (!delivered) {
      globalWsDb.addPendingSignal({
        id: (type || 'sig') + '-' + Date.now(),
        ...payload,
      });
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Signal failed', message: err?.message });
  }
});

app.get('/api/ws-db/signals/:userId', (req, res) => {
  try {
    const userId = req.params.userId;
    const signals = userId ? globalWsDb.popPendingSignals(userId) : [];
    res.json({ success: true, signals });
  } catch (err: any) {
    res.status(500).json({ error: 'Get signals failed', message: err?.message });
  }
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

// AI Groq Models Endpoint - Option 1: groq-sdk models.list() / Option 2: Native fetch
app.get('/api/ai/models', async (req, res) => {
  const fallbackModels = [
    { id: 'llama-3.1-8b-instant', owned_by: 'Meta', context_window: 131072, description: 'Super fast & lightweight (recommended)' },
    { id: 'llama-3.3-70b-versatile', owned_by: 'Meta', context_window: 131072, description: 'High reasoning & versatile' },
    { id: 'llama-3.2-1b-preview', owned_by: 'Meta', context_window: 131072, description: 'Ultra-lightweight instant response' },
    { id: 'llama-3.2-3b-preview', owned_by: 'Meta', context_window: 131072, description: 'Fast compact model' },
    { id: 'mixtral-8x7b-32768', owned_by: 'Mistral AI', context_window: 32768, description: 'Balanced MoE architecture' },
    { id: 'gemma2-9b-it', owned_by: 'Google', context_window: 8192, description: 'Google Gemma 2 instruct model' },
    { id: 'deepseek-r1-distill-llama-70b', owned_by: 'DeepSeek', context_window: 131072, description: 'Deep reasoning & problem solving' },
  ];

  const groqKey = (
    process.env.GROQ_API_KEY ||
    process.env.VITE_GROQ_API_KEY ||
    (req.query.apiKey as string) ||
    (process.env.GEMINI_API_KEY?.startsWith('gsk_') ? process.env.GEMINI_API_KEY : '') ||
    ''
  ).replace(/^["']|["']$/g, '').trim();

  if (!groqKey) {
    return res.json({
      success: true,
      hasKey: false,
      models: fallbackModels,
      source: 'curated-free',
    });
  }

  // Option 1: Official groq-sdk
  try {
    const groq = new Groq({ apiKey: groqKey });
    const response = await groq.models.list();
    if (response && Array.isArray(response.data) && response.data.length > 0) {
      const chatModels = response.data
        .filter((m: any) => {
          if (m.active === false) return false;
          const id = (m.id || '').toLowerCase();
          return !id.includes('whisper') && !id.includes('guard') && !id.includes('orpheus') && !id.includes('tts') && !id.includes('embed');
        })
        .map((m: any) => ({
          id: m.id,
          owned_by: m.owned_by || 'Groq',
          context_window: m.context_window || 131072,
          description: m.id.includes('oss-20b')
            ? 'Super fast & lightweight (recommended)'
            : m.id.includes('8b') || m.id.includes('7b')
            ? 'Ultra-fast & lightweight'
            : m.id.includes('70b') || m.id.includes('120b')
            ? 'High reasoning & versatile'
            : 'Active Groq chat model',
        }));

      if (chatModels.length > 0) {
        return res.json({
          success: true,
          hasKey: true,
          models: chatModels,
          source: 'groq-sdk',
        });
      }
    }
  } catch (sdkErr: any) {
    console.warn('[Groq Models] Official SDK models.list() notice:', sdkErr?.message);
  }

  // Option 2: Native fetch fallback
  try {
    const fetchRes = await fetch('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (fetchRes.ok) {
      const data = await fetchRes.json();
      if (Array.isArray(data.data) && data.data.length > 0) {
        const chatModels = data.data
          .filter((m: any) => {
            if (m.active === false) return false;
            const id = (m.id || '').toLowerCase();
            return !id.includes('whisper') && !id.includes('guard') && !id.includes('orpheus') && !id.includes('tts') && !id.includes('embed');
          })
          .map((m: any) => ({
            id: m.id,
            owned_by: m.owned_by || 'Groq',
            context_window: m.context_window || 131072,
            description: m.id.includes('oss-20b')
              ? 'Super fast & lightweight (recommended)'
              : m.id.includes('8b') || m.id.includes('7b')
              ? 'Ultra-fast & lightweight'
              : m.id.includes('70b') || m.id.includes('120b')
              ? 'High reasoning & versatile'
              : 'Active Groq chat model',
          }));

        if (chatModels.length > 0) {
          return res.json({
            success: true,
            hasKey: true,
            models: chatModels,
            source: 'native-fetch',
          });
        }
      }
    }
  } catch (fetchErr: any) {
    console.warn('[Groq Models] Native fetch notice:', fetchErr?.message);
  }

  return res.json({
    success: true,
    hasKey: true,
    models: fallbackModels,
    source: 'curated-free',
  });
});

// Web Search helper: DuckDuckGo HTML with Wikipedia Fallback
interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

async function searchWeb(query: string): Promise<WebSearchResult[]> {
  const results: WebSearchResult[] = [];
  const cleanQ = query.replace(/[?.,!]+$/, '').trim();
  if (!cleanQ) return results;

  // 1. Try DuckDuckGo HTML
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQ)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(4500),
    });

    if (res.ok) {
      const html = await res.text();
      const regex = /<a[^>]+class="result__snippet"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
      let m;
      while ((m = regex.exec(html)) !== null && results.length < 5) {
        let rawUrl = m[1];
        let url = rawUrl;
        if (rawUrl.includes('uddg=')) {
          const match = rawUrl.match(/uddg=([^&]+)/);
          if (match) url = decodeURIComponent(match[1]);
        }
        const snippet = m[2]
          .replace(/<[^>]+>/g, '')
          .replace(/&#x27;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\s+/g, ' ')
          .trim();

        let domain = 'Web';
        try {
          domain = new URL(url).hostname.replace(/^www\./, '');
        } catch {}

        if (snippet && !results.some((r) => r.url === url)) {
          results.push({ url, title: domain, snippet });
        }
      }
    }
  } catch (err: any) {
    console.warn('[Web Search] DuckDuckGo search warning:', err?.message || err);
  }

  // 2. Fallback to Wikipedia Query Search if DDG returned no snippets
  if (results.length === 0) {
    try {
      const wikiRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQ)}&utf8=&format=json`,
        {
          headers: { 'User-Agent': 'FrostedAI/1.0' },
          signal: AbortSignal.timeout(3500),
        }
      );
      if (wikiRes.ok) {
        const data = await wikiRes.json();
        const hits = data?.query?.search || [];
        for (const hit of hits.slice(0, 4)) {
          const snippet = (hit.snippet || '')
            .replace(/<[^>]+>/g, '')
            .replace(/&#x27;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/\s+/g, ' ')
            .trim();
          results.push({
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/\s+/g, '_'))}`,
            title: hit.title,
            snippet,
          });
        }
      }
    } catch (wikiErr: any) {
      console.warn('[Web Search] Wikipedia fallback warning:', wikiErr?.message || wikiErr);
    }
  }

  return results;
}

function cleanShortAnswer(text: string): string {
  if (!text) return '';
  // Strip any trailing pleasantries, disclaimers, or "Would you like..." / "Do you want..." follow-ups
  let cleaned = text
    .replace(/(?:\r?\n)+(?:Would you like|Do you want|Let me know|Hope this helps|Feel free to|Should I|If you want|If you'd like|Can I help|Do you need)[\s\S]*$/i, '')
    .trim();
  return cleaned || text.trim();
}

function shouldSearchWeb(prompt: string, searchMode?: 'auto' | 'always' | 'off'): boolean {
  if (searchMode === 'off') return false;
  if (searchMode === 'always') return true;

  const p = prompt.toLowerCase();
  // Check for search trigger words or factual inquiries
  const searchTriggers = [
    'who is', 'who was', 'who won', 'who created', 'who played', 'when was', 'when did', 'when will',
    'where is', 'where was', 'latest', 'current', 'news', 'score', 'winner', 'weather', 'price',
    'release date', 'super bowl', 'champion', 'championship', 'today', 'yesterday', 'update',
    'president', 'ceo', 'stats', 'movie', 'film', 'born', 'died', 'how many', 'population',
    'search', 'google', 'look up', 'find out', 'history of', 'what is happening', 'record'
  ];

  return searchTriggers.some((t) => p.includes(t)) || p.length > 35;
}

// AI Assistant SSE Streaming Endpoint - Live step-by-step thinking & web search
app.post('/api/ai/assistant/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let isAborted = false;
  res.on('close', () => {
    if (!res.writableEnded) {
      isAborted = true;
    }
  });

  const sendEvent = (event: any) => {
    if (isAborted) return;
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      (res as any).flush?.();
    } catch {}
  };

  try {
    const { prompt, history, groqApiKey, model: customModel, searchMode } = req.body;
    if (!prompt) {
      sendEvent({ type: 'error', error: 'Missing prompt' });
      return res.end();
    }

    const completedSteps: Array<{ id: string; title: string; detail: string; icon: string; timestamp: number }> = [];

    const recordStep = (id: string, title: string, detail: string, icon: string, extra: any = {}) => {
      const stepObj = { id, title, detail, icon, timestamp: Date.now(), ...extra };
      completedSteps.push(stepObj);
      sendEvent({ type: 'step', ...stepObj });
    };

    // Step 1: Logic starting...

    // Auto-detect Groq API Key
    const groqKey = (
      process.env.GROQ_API_KEY ||
      process.env.VITE_GROQ_API_KEY ||
      (groqApiKey as string) ||
      (process.env.GEMINI_API_KEY?.startsWith('gsk_') ? process.env.GEMINI_API_KEY : '') ||
      ''
    ).replace(/^["']|["']$/g, '').trim();

    if (!groqKey) {
      sendEvent({
        type: 'error',
        error: 'Groq API Key is not configured on the server. Please add GROQ_API_KEY to your server environment secrets.',
      });
      return res.end();
    }

    // Step 2: Determine Web Search requirement
    let searchResults: WebSearchResult[] = [];
    const needsSearch = shouldSearchWeb(prompt, searchMode);

    if (needsSearch && !isAborted) {
      recordStep('searching', 'Searching the Web', `Querying live web sources for "${prompt}"...`, 'search', { query: prompt });
      searchResults = await searchWeb(prompt);

      if (searchResults.length > 0) {
        const sourceNames = searchResults.map((s) => s.title).join(', ');
        recordStep(
          'reading',
          'Reading Sources',
          `Scanned ${searchResults.length} live sources (${sourceNames}). Extracting relevant facts...`,
          'globe',
          { sources: searchResults.map((s) => ({ title: s.title, url: s.url })) }
        );
      } else {
        recordStep('reading', 'Direct Knowledge', 'Consulting fast Groq inference engine...', 'cpu');
      }
    }

    if (isAborted) return res.end();

    // Step 3: Synthesis with Groq
    const targetModel = typeof customModel === 'string' && customModel.trim() ? customModel.trim() : 'openai/gpt-oss-20b';
    recordStep('synthesizing', 'Synthesizing Answer', `Formulating direct response with ${targetModel}...`, 'sparkles');

    const systemInstruction =
      "You are Frosted AI. Keep all answers short, direct, and concise (1 to 3 sentences maximum). For overview questions like 'what is ___ about' or 'what is the ___ all about', give a clear high-level answer with just a little tiny bit of explanation. Never give unsolicited multi-step lecture breakdowns, long essays, or repetitive summary lists. State formulas or facts directly. USE PROFESSIONAL LATEX FOR ALL MATH FORMULAS. CRITICAL: Use $...$ for inline math and $$...$$ for block math. ALWAYS use \\dfrac for fractions to make them clear and vertically stacked. NEVER include any follow-up questions or offers such as 'Would you like...', 'Do you want...', 'Let me know', 'Can I help with...', etc. NONE of that. Answer and stop.";

    let searchContext = '';
    if (searchResults.length > 0) {
      searchContext = `\n\n[Live Web Search Context for "${prompt}"]:\n` +
        searchResults.map((r, i) => `[Source ${i + 1}] (${r.title} - ${r.url}): ${r.snippet}`).join('\n') +
        `\nUse the above live web facts to answer accurately and concisely.`;
    }

    const groqMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemInstruction + searchContext },
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
      targetModel,
      'openai/gpt-oss-20b',
      'llama-3.1-8b-instant',
      'qwen/qwen3.8-27b',
      'openai/gpt-oss-120b',
      'allam-2-7b',
      'llama-3.3-70b-versatile',
    ].filter((m, idx, arr) => arr.indexOf(m) === idx);

    let replyText = '';

    for (const model of groqModels) {
      if (isAborted) break;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 9000);

        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: groqMessages,
            temperature: 0.3,
            max_tokens: 240,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (groqRes.ok) {
          const data = await groqRes.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) {
            replyText = cleanShortAnswer(text);
            console.log(`[Groq AI Stream] Success with model ${model}`);
            break;
          }
        }
      } catch (mErr: any) {
        console.warn(`[Groq AI Stream] Model ${model} fetch failed:`, mErr?.message || mErr);
      }
    }

    if (isAborted) return res.end();

    if (!replyText) {
      sendEvent({
        type: 'error',
        error: 'Groq API request failed or timed out. Please check your Groq API key.',
      });
      return res.end();
    }

    // Step 4: Done event
    sendEvent({
      type: 'done',
      reply: replyText,
      sources: searchResults.map((s) => ({ title: s.title, url: s.url })),
      steps: completedSteps,
    });
    res.end();
  } catch (err: any) {
    console.error('AI Stream Error:', err);
    sendEvent({ type: 'error', error: err?.message || 'Failed to stream response' });
    res.end();
  }
});

// AI Study Assistant Endpoint (Standard JSON) - Powered exclusively by Groq with Web Search
app.post('/api/ai/assistant', async (req, res) => {
  try {
    const { prompt, history, groqApiKey, model: customModel, searchMode } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const systemInstruction =
      "You are Frosted AI. Keep all answers short, direct, and concise (1 to 3 sentences maximum). For overview questions like 'what is ___ about' or 'what is the ___ all about', give a clear high-level answer with just a little tiny bit of explanation. Never give unsolicited multi-step lecture breakdowns, long essays, or repetitive summary lists. State formulas or facts directly. USE PROFESSIONAL LATEX FOR ALL MATH FORMULAS. CRITICAL: Use $...$ for inline math and $$...$$ for block math. ALWAYS use \\dfrac for fractions to make them clear and vertically stacked. NEVER include any follow-up questions or offers such as 'Would you like...', 'Do you want...', 'Let me know', 'Can I help with...', etc. NONE of that. Answer and stop.";

    // Auto-detect Groq API Key from server environment secrets (GROQ_API_KEY) or request body
    const groqKey = (
      process.env.GROQ_API_KEY ||
      process.env.VITE_GROQ_API_KEY ||
      (groqApiKey as string) ||
      (process.env.GEMINI_API_KEY?.startsWith('gsk_') ? process.env.GEMINI_API_KEY : '') ||
      ''
    ).replace(/^["']|["']$/g, '').trim();

    if (!groqKey) {
      return res.status(503).json({
        error: 'Groq API Key is not configured on the server. Please add GROQ_API_KEY to your server environment secrets.',
      });
    }

    let searchResults: WebSearchResult[] = [];
    const steps: Array<{ id: string; title: string; detail: string; icon: string; timestamp: number }> = [];

    if (shouldSearchWeb(prompt, searchMode)) {
      steps.push({ id: 'searching', title: 'Searching the Web', detail: `Querying for "${prompt}"`, icon: 'search', timestamp: Date.now() });
      searchResults = await searchWeb(prompt);
      if (searchResults.length > 0) {
        steps.push({
          id: 'reading',
          title: 'Reading Sources',
          detail: `Analyzed ${searchResults.length} live sources`,
          icon: 'globe',
          timestamp: Date.now(),
        });
      }
    }

    let searchContext = '';
    if (searchResults.length > 0) {
      searchContext = `\n\n[Live Web Search Context for "${prompt}"]:\n` +
        searchResults.map((r, i) => `[Source ${i + 1}] (${r.title} - ${r.url}): ${r.snippet}`).join('\n') +
        `\nUse the above live web facts to answer accurately and concisely.`;
    }

    const groqMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemInstruction + searchContext },
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

    const targetModel = typeof customModel === 'string' && customModel.trim() ? customModel.trim() : 'openai/gpt-oss-20b';
    const groqModels = [
      targetModel,
      'openai/gpt-oss-20b',
      'llama-3.1-8b-instant',
      'qwen/qwen3.8-27b',
      'openai/gpt-oss-120b',
      'allam-2-7b',
      'llama-3.3-70b-versatile',
    ].filter((m, idx, arr) => arr.indexOf(m) === idx);

    let replyText = '';

    for (const model of groqModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 9000);

        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: groqMessages,
            temperature: 0.3,
            max_tokens: 240,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (groqRes.ok) {
          const data = await groqRes.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) {
            replyText = cleanShortAnswer(text);
            console.log(`[Groq AI] Fast success with model ${model}`);
            break;
          }
        } else {
          const errBody = await groqRes.text().catch(() => '');
          console.warn(`[Groq AI] Model ${model} returned ${groqRes.status}:`, errBody.slice(0, 150));
        }
      } catch (mErr: any) {
        console.warn(`[Groq AI] Model ${model} fetch failed:`, mErr?.message || mErr);
      }
    }

    if (!replyText) {
      return res.status(502).json({
        error: 'Groq API request failed or timed out. Please check your Groq API key.',
      });
    }

    res.json({
      success: true,
      reply: replyText,
      sources: searchResults.map((s) => ({ title: s.title, url: s.url })),
      steps,
    });
  } catch (err: any) {
    console.error('AI Assistant API Error:', err);
    res.status(500).json({ error: 'AI Assistant error', message: err?.message || 'Failed to generate response' });
  }
});

// Cover Image Proxy with Memory Cache
const coverCache = new Map<string, { data: Buffer; contentType: string; timestamp: number }>();
const MAX_COVER_CACHE_SIZE = 1000;

app.get('/api/cover/:path(*)', async (req, res) => {
  const coverPath = req.params.path;
  if (!coverPath) {
    return res.status(400).send('Invalid cover path');
  }

  // Serve from memory cache if available
  const cached = coverCache.get(coverPath);
  if (cached && (Date.now() - cached.timestamp < 86400000 * 7)) {
    res.setHeader('Content-Type', cached.contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    return res.send(cached.data);
  }

  const primaryUrl = `https://raw.githubusercontent.com/gn-math/covers/main/${coverPath}`;
  const fallbackUrl = `https://raw.githack.com/gn-math/covers/main/${coverPath}`;

  try {
    let response = await fetch(primaryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      response = await fetch(fallbackUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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

    // Save to memory cache (purge oldest if cache is full)
    if (coverCache.size >= MAX_COVER_CACHE_SIZE) {
      const firstKey = coverCache.keys().next().value;
      if (firstKey) coverCache.delete(firstKey);
    }
    coverCache.set(coverPath, { data: buffer, contentType, timestamp: Date.now() });

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
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

// Proxy UGS game files to force text/html MIME type and guarantee 100% playable iframe rendering
app.get('/api/ugs/:path(*)', async (req, res) => {
  const ugsPath = req.params.path;
  if (!ugsPath) {
    return res.status(400).send('Invalid UGS game path');
  }

  const cleanPath = ugsPath.startsWith('/') ? ugsPath : `/${ugsPath}`;
  const fullPath = cleanPath.startsWith('/ugs/') ? cleanPath : `/ugs${cleanPath}`;

  const primaryUrl = `https://raw.githack.com/gmshelf/ugs/main${fullPath}`;
  const fallbackUrl = `https://raw.githubusercontent.com/gmshelf/ugs/main${fullPath}`;

  try {
    let response = await fetch(primaryUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      response = await fetch(fallbackUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(6000),
      });
    }

    // Fallback for missing TurboWarp scaffolding script files (e.g., script.js, scaffolding.js)
    if (!response.ok) {
      const lower = fullPath.toLowerCase();
      if (
        lower.endsWith('script.js') ||
        lower.endsWith('scaffolding.js') ||
        lower.endsWith('scaffolding-full.js') ||
        lower.endsWith('scaffolding-min.js')
      ) {
        const scaffoldingBuffer = await getScaffoldingBuffer();
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        return res.send(scaffoldingBuffer);
      }

      return res.status(response.status).send('UGS game file not found');
    }

    const isHtml = fullPath.endsWith('.html') || fullPath.endsWith('.htm') || !fullPath.includes('.');

    if (isHtml) {
      const rawText = await response.text();
      const processedHtml = processGameHtml(rawText, '/api/ugs/script.js');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(processedHtml);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).send('Error proxying UGS game file');
  }
});

// Proxy CKV game files to force text/html MIME type and guarantee 100% playable iframe rendering
app.get('/api/ckv/:path(*)', async (req, res) => {
  const ckvPath = req.params.path;
  if (!ckvPath) {
    return res.status(400).send('Invalid CKV game path');
  }

  const cleanPath = ckvPath.startsWith('/') ? ckvPath : `/${ckvPath}`;
  const fullPath = cleanPath.startsWith('/ckv/') ? cleanPath.replace(/^\/ckv\//, '/') : cleanPath;

  const primaryUrl = `https://wanocapy.github.io/ChickenKingsVault${fullPath}`;
  const fallbackUrl = `https://raw.githubusercontent.com/WanoCapy/ChickenKingsVault/main${fullPath}`;

  try {
    let response = await fetch(primaryUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      response = await fetch(fallbackUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(8000),
      });
    }

    if (!response.ok) {
      return res.status(response.status).send('CKV game file not found');
    }

    const isHtml = fullPath.endsWith('.html') || fullPath.endsWith('.htm') || !fullPath.includes('.');

    if (isHtml) {
      const rawText = await response.text();
      const processedHtml = processGameHtml(rawText, '/api/ugs/script.js');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(processedHtml);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).send('Error proxying CKV game file');
  }
});

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
      const lower = rawPath.toLowerCase();
      if (
        lower.endsWith('script.js') ||
        lower.endsWith('scaffolding.js') ||
        lower.endsWith('scaffolding-full.js') ||
        lower.endsWith('scaffolding-min.js')
      ) {
        const scaffoldingBuffer = await getScaffoldingBuffer();
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        return res.send(scaffoldingBuffer);
      }

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
    html = processGameHtml(html, '/api/raw/script.js');

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

// Catch-all for API routes to never return HTML
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route ${req.method} ${req.originalUrl || req.path} not found` });
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
