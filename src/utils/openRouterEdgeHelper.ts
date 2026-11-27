import { buildAISystemInstruction } from '../data/aiPersonalities';

export const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const OPENROUTER_MODEL = 'openrouter/free';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface AIThinkingStep {
  id: string;
  title: string;
  detail: string;
  icon: string;
  timestamp: number;
  query?: string;
  sources?: Array<{ title: string; url: string }>;
}

export const FALLBACK_OPENROUTER_MODELS = [
  { id: 'openrouter/free', owned_by: 'OpenRouter', context_window: 131072, description: 'OpenRouter Free Model (Default)' },
  { id: 'google/gemma-4-31b-it:free', owned_by: 'Google', context_window: 131072, description: 'Gemma 4 31B Multimodal (Vision/Video)' },
  { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', owned_by: 'NVIDIA', context_window: 131072, description: 'Nemotron Omni (Image/Audio/Video)' },
  { id: 'nvidia/nemotron-3.5-super-vl:free', owned_by: 'NVIDIA', context_window: 131072, description: 'Nemotron 3.5 Super VL (Vision/Video)' },
  { id: 'deepseek/deepseek-chat', owned_by: 'DeepSeek', context_window: 64000, description: 'DeepSeek V3 Chat' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', owned_by: 'Meta', context_window: 131072, description: 'Llama 3.3 70B Instruct' },
];

export function extractOpenRouterKey(env?: Record<string, any>, requestKey?: string): string {
  const candidates = [
    env?.OPENROUTER_API_KEY,
    env?.VITE_OPENROUTER_API_KEY,
    env?.OPENROUTER_KEY,
    requestKey,
    typeof env?.GEMINI_API_KEY === 'string' && !env.GEMINI_API_KEY.startsWith('AIza') ? env.GEMINI_API_KEY : '',
  ];
  for (const raw of candidates) {
    if (typeof raw === 'string') {
      const cleaned = raw.replace(/^["']|["']$/g, '').trim();
      if (cleaned) return cleaned;
    }
  }
  return '';
}

export function shouldSearchWeb(prompt: string, searchMode?: 'auto' | 'always' | 'off'): boolean {
  if (searchMode === 'off') return false;
  if (searchMode === 'always') return true;

  const trimmed = (prompt || '').trim().toLowerCase();
  if (!trimmed) return false;
  const greetings = /^(?:hi+|hello+|hey+|yo+|sup|ok(?:ay)?|thanks?(?: you)?|ty|np|bye|gn|gm)[!?. ]*$/i;
  if (greetings.test(trimmed)) return false;

  const p = trimmed;
  const searchTriggers = [
    'who', 'what', 'when', 'where', 'why', 'how', 'latest', 'current', 'news', 'score', 'winner',
    'weather', 'price', 'release', 'champion', 'today', 'yesterday', 'update', 'stats', 'movie',
    'film', 'search', 'google', 'look up', 'find', 'history', 'record', 'define', 'meaning',
  ];

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  return wordCount >= 2 || trimmed.includes('?') || trimmed.length >= 4 || searchTriggers.some((t) => p.includes(t));
}

function decodeHtmlEntities(str: string): string {
  return String(str || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeBingTrackingUrl(rawUrl: string): string {
  try {
    if (rawUrl.includes('bing.com/ck/a')) {
      const u = new URL(rawUrl);
      const uParam = u.searchParams.get('u') || '';
      if (uParam.startsWith('a1')) {
        const b64 = uParam.slice(2).replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
        const decoded =
          typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('utf8');
        if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
          return decoded;
        }
      }
    }
  } catch {}
  return rawUrl;
}

export async function searchWebEdge(query: string): Promise<WebSearchResult[]> {
  const results: WebSearchResult[] = [];
  const cleanQ = query.replace(/[?.,!]+$/, '').trim();
  if (!cleanQ) return results;

  const addResult = (item: WebSearchResult) => {
    if (!item.url || !item.snippet) return;
    if (results.some((r) => r.url === item.url)) return;
    results.push(item);
  };

  // Run Bing HTML, DuckDuckGo Instant Answer JSON, and Wikipedia Search in parallel
  const bingPromise = (async () => {
    const bingItems: WebSearchResult[] = [];
    try {
      const res = await fetch(
        `https://www.bing.com/search?q=${encodeURIComponent(cleanQ)}&setlang=en-US&cc=US&adlt=off`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: AbortSignal.timeout(4500),
        }
      );
      if (res.ok) {
        const html = await res.text();
        const blockRegex = /<li[^>]+class="[^"]*\bb_algo\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
        let m: RegExpExecArray | null;
        while ((m = blockRegex.exec(html)) !== null && bingItems.length < 7) {
          const block = m[1];
          const linkMatch = block.match(/<h2[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
          if (!linkMatch) continue;
          const url = decodeBingTrackingUrl(decodeHtmlEntities(linkMatch[1]));
          const title = decodeHtmlEntities(linkMatch[2]);
          const snippetMatch =
            block.match(/<div[^>]+class="[^"]*\bb_caption\b[^"]*"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i) ||
            block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
          const snippet = snippetMatch ? decodeHtmlEntities(snippetMatch[1]) : title;
          if (url && /^https?:\/\//i.test(url) && snippet) {
            bingItems.push({ url, title: title || 'Web', snippet });
          }
        }
      }
    } catch {}
    return bingItems;
  })();

  const ddgInstantPromise = (async () => {
    const instantItems: WebSearchResult[] = [];
    try {
      const res = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQ)}&format=json&no_html=1&skip_disambig=1`,
        {
          headers: { 'User-Agent': 'FrostedAI/1.0' },
          signal: AbortSignal.timeout(3000),
        }
      );
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data?.AbstractText && data?.AbstractURL) {
          instantItems.push({
            url: String(data.AbstractURL),
            title: String(data.Heading || data.AbstractSource || 'Instant Answer'),
            snippet: decodeHtmlEntities(String(data.AbstractText)),
          });
        }
        const topics = Array.isArray(data?.RelatedTopics) ? data.RelatedTopics : [];
        for (const t of topics) {
          if (instantItems.length >= 3) break;
          if (t?.Text && t?.FirstURL) {
            instantItems.push({
              url: String(t.FirstURL),
              title: String(t.Text).split(' - ')[0].slice(0, 60) || 'DuckDuckGo',
              snippet: decodeHtmlEntities(String(t.Text)),
            });
          }
        }
      }
    } catch {}
    return instantItems;
  })();

  const wikiPromise = (async () => {
    const wikiItems: WebSearchResult[] = [];
    try {
      const wikiRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQ)}&utf8=&format=json`,
        {
          headers: { 'User-Agent': 'FrostedAI/1.0' },
          signal: AbortSignal.timeout(3500),
        }
      );
      if (wikiRes.ok) {
        const data = (await wikiRes.json()) as any;
        const hits = data?.query?.search || [];
        for (const hit of hits.slice(0, 3)) {
          const snippet = decodeHtmlEntities(String(hit.snippet || ''));
          if (snippet) {
            wikiItems.push({
              url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(hit.title || '').replace(/\s+/g, '_'))}`,
              title: String(hit.title || 'Wikipedia'),
              snippet,
            });
          }
        }
      }
    } catch {}
    return wikiItems;
  })();

  const [instantItems, bingItems, wikiItems] = await Promise.all([ddgInstantPromise, bingPromise, wikiPromise]);

  for (const item of instantItems) addResult(item);
  for (const item of bingItems) {
    if (results.length >= 8) break;
    addResult(item);
  }
  for (const item of wikiItems) {
    if (results.length >= 8) break;
    addResult(item);
  }

  // Last-resort fallback: DuckDuckGo Lite
  if (results.length === 0) {
    try {
      const res = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(cleanQ)}`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept: 'text/html',
        },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const html = await res.text();
        const linkRegex = /<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        const snipRegex = /<td[^>]+class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;
        const links: Array<{ url: string; title: string }> = [];
        let lm: RegExpExecArray | null;
        while ((lm = linkRegex.exec(html)) !== null) {
          let rawUrl = decodeHtmlEntities(lm[1]);
          if (rawUrl.includes('uddg=')) {
            const um = rawUrl.match(/uddg=([^&]+)/);
            if (um) rawUrl = decodeURIComponent(um[1]);
          }
          links.push({ url: rawUrl, title: decodeHtmlEntities(lm[2]) });
        }
        let idx = 0;
        let sm: RegExpExecArray | null;
        while ((sm = snipRegex.exec(html)) !== null && idx < links.length && results.length < 6) {
          addResult({
            url: links[idx].url,
            title: links[idx].title || 'Web',
            snippet: decodeHtmlEntities(sm[1]),
          });
          idx++;
        }
      }
    } catch {}
  }

  return results;
}

export async function runOpenRouterAssistantEdge(params: {
  openRouterKey: string;
  prompt: string;
  history?: Array<{ role?: string; text?: string }>;
  model?: string;
  searchMode?: 'auto' | 'always' | 'off';
  personality?: unknown;
  onStep?: (step: AIThinkingStep) => void;
}): Promise<{
  reply: string;
  sources: Array<{ title: string; url: string }>;
  steps: AIThinkingStep[];
  errorDetail?: string;
}> {
  const { openRouterKey, prompt, history, model: customModel, searchMode, personality, onStep } = params;
  const steps: AIThinkingStep[] = [];

  const recordStep = (
    id: string,
    title: string,
    detail: string,
    icon: string,
    extra: Partial<AIThinkingStep> = {}
  ) => {
    const stepObj: AIThinkingStep = { id, title, detail, icon, timestamp: Date.now(), ...extra };
    steps.push(stepObj);
    onStep?.(stepObj);
  };

  let searchResults: WebSearchResult[] = [];
  if (shouldSearchWeb(prompt, searchMode)) {
    recordStep('searching', 'Searching the Web', `Querying live web sources for "${prompt}"...`, 'search', {
      query: prompt,
    });
    searchResults = await searchWebEdge(prompt);
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
      recordStep('reading', 'Direct Knowledge', 'Consulting OpenRouter model...', 'cpu');
    }
  }

  const targetModel = typeof customModel === 'string' && customModel.trim() ? customModel.trim() : OPENROUTER_MODEL;
  recordStep('synthesizing', 'Synthesizing Answer', `Formulating direct response with ${targetModel}...`, 'sparkles');

  const systemInstruction = buildAISystemInstruction(personality);
  let searchContext = '';
  if (searchResults.length > 0) {
    searchContext =
      `\n\n[Live Web Search Context for "${prompt}"]:\n` +
      searchResults.map((r, i) => `[Source ${i + 1}] (${r.title} - ${r.url}): ${r.snippet}`).join('\n') +
      `\nUse the above live web facts to answer accurately and concisely.`;
  }

  const chatMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemInstruction + searchContext },
  ];

  if (Array.isArray(history) && history.length > 0) {
    for (const msg of history) {
      if (msg?.role && msg?.text) {
        chatMessages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: String(msg.text),
        });
      }
    }
  }
  chatMessages.push({ role: 'user', content: prompt });

  const modelsToTry = [
    targetModel,
    'openrouter/free',
    'google/gemma-4-31b-it:free',
    'deepseek/deepseek-chat',
    'meta-llama/llama-3.3-70b-instruct:free',
  ].filter((m, idx, arr) => arr.indexOf(m) === idx);

  let replyText = '';
  let lastError = '';

  for (const model of modelsToTry) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);
      const res = await fetch(OPENROUTER_CHAT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://frosted.app',
          'X-Title': 'FrostHub AI',
        },
        body: JSON.stringify({
          model,
          messages: chatMessages,
          temperature: 0.3,
          max_tokens: 1024,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as any;
        const text = data.choices?.[0]?.message?.content;
        if (text) {
          replyText = text.trim();
          break;
        }
      } else {
        const errText = await res.text().catch(() => '');
        lastError = `OpenRouter HTTP ${res.status}: ${errText.slice(0, 140)}`;
        if (res.status === 401 || res.status === 403) {
          break;
        }
      }
    } catch (err: any) {
      lastError = err?.message || 'OpenRouter request error';
    }
  }

  return {
    reply: replyText,
    sources: searchResults.map((s) => ({ title: s.title, url: s.url })),
    steps,
    errorDetail: replyText ? undefined : lastError || 'OpenRouter API request failed or timed out.',
  };
}

export interface OpenRouterFilePayload {
  prompt?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  sizeFormatted?: string;
  kind?: string;
  imageDataUrl?: string;
  previewImageUrls?: string[];
  fileDataUrl?: string;
  extractedText?: string;
  binarySummary?: string;
  history?: Array<{ role?: string; text?: string }>;
  model?: string;
}

export async function runOpenRouterFileAnalysis(params: {
  openRouterKey: string;
  payload: OpenRouterFilePayload;
}): Promise<{ reply: string; modelUsed?: string; errorDetail?: string }> {
  const { openRouterKey, payload } = params;
  const prompt = (payload.prompt || '').trim();
  const fileName = (payload.fileName || '').trim() || 'uploaded-file';
  const mimeType = (payload.mimeType || '').trim().toLowerCase() || 'application/octet-stream';
  const sizeLabel = payload.sizeFormatted || (payload.sizeBytes ? `${(payload.sizeBytes / (1024 * 1024)).toFixed(2)} MB` : 'unknown size');
  const kind = payload.kind || (mimeType.startsWith('image/') ? 'image' : 'file');

  const fileDataUrl = typeof payload.fileDataUrl === 'string' ? payload.fileDataUrl : '';
  const previewImages = [
    ...(Array.isArray(payload.previewImageUrls) ? payload.previewImageUrls : []),
    ...(payload.imageDataUrl ? [payload.imageDataUrl] : []),
    ...(fileDataUrl.startsWith('data:image/') ? [fileDataUrl] : []),
  ]
    .filter((u, idx, arr) => typeof u === 'string' && u.startsWith('data:image/') && arr.indexOf(u) === idx)
    .slice(0, 6);

  const isPdfDataUrl = fileDataUrl.startsWith('data:application/pdf');
  const audioMatch = fileDataUrl.match(/^data:audio\/(mpeg|mp3|wav);base64,([A-Za-z0-9+/=]+)$/i);
  const videoDataUrl = fileDataUrl.startsWith('data:video/') ? fileDataUrl : '';

  const contextLines = [
    `Uploaded File: "${fileName}"`,
    `Kind: ${kind}`,
    `MIME Type: ${mimeType}`,
    `Size: ${sizeLabel}`,
    payload.binarySummary ? `\nFile Metadata & Inspection:\n${payload.binarySummary}` : '',
    payload.extractedText ? `\nExtracted File Content / Structure:\n${payload.extractedText.slice(0, 60000)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const defaultQuestion =
    kind === 'image'
      ? 'Inspect and describe this image clearly and accurately.'
      : kind === 'video'
      ? 'Inspect these video frames and metadata, and explain what happens in this video.'
      : `Analyze and explain this uploaded file ("${fileName}").`;

  const textInstruction = `${contextLines}\n\nUser Question: ${prompt || defaultQuestion}`;

  const priorMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: any }> = [
    {
      role: 'system',
      content: `${buildAISystemInstruction()} You are inspecting an uploaded file or image for the user. Answer directly and accurately based on the visual frames, file data, metadata, and extracted contents provided.`,
    },
  ];

  if (Array.isArray(payload.history) && payload.history.length > 0) {
    for (const msg of payload.history.slice(-8)) {
      if (msg?.role && msg?.text) {
        priorMessages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: String(msg.text),
        });
      }
    }
  }

  // Build multimodal content variants (native media first, then fallback to image keyframes / text inspection)
  const buildUserContent = (includeNativeBinary: boolean): any => {
    const parts: Array<Record<string, any>> = [];

    if (includeNativeBinary && isPdfDataUrl) {
      parts.push({
        type: 'file',
        file: {
          filename: fileName,
          file_data: fileDataUrl,
        },
      });
    } else if (includeNativeBinary && audioMatch) {
      parts.push({
        type: 'input_audio',
        input_audio: {
          data: audioMatch[2],
          format: audioMatch[1].toLowerCase() === 'wav' ? 'wav' : 'mp3',
        },
      });
    } else if (includeNativeBinary && videoDataUrl && previewImages.length === 0) {
      parts.push({
        type: 'video_url',
        video_url: { url: videoDataUrl },
      });
    }

    for (const imgUrl of previewImages) {
      parts.push({
        type: 'image_url',
        image_url: { url: imgUrl },
      });
    }

    parts.push({
      type: 'text',
      text: textInstruction,
    });

    return parts.length === 1 ? textInstruction : parts;
  };

  const rawRequested = typeof payload.model === 'string' && payload.model.trim() ? payload.model.trim() : '';
  const specificRequestedModel = rawRequested && rawRequested !== OPENROUTER_MODEL ? rawRequested : '';

  const candidateAttempts: Array<{ model: string; nativeBinary: boolean; usePdfPlugin: boolean }> = [];
  if (audioMatch) {
    if (specificRequestedModel) candidateAttempts.push({ model: specificRequestedModel, nativeBinary: true, usePdfPlugin: false });
    candidateAttempts.push({ model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', nativeBinary: true, usePdfPlugin: false });
    candidateAttempts.push({ model: 'google/gemma-4-31b-it:free', nativeBinary: false, usePdfPlugin: false });
    candidateAttempts.push({ model: 'openrouter/free', nativeBinary: false, usePdfPlugin: false });
  } else if (isPdfDataUrl) {
    if (specificRequestedModel) candidateAttempts.push({ model: specificRequestedModel, nativeBinary: true, usePdfPlugin: true });
    candidateAttempts.push({ model: 'google/gemma-4-31b-it:free', nativeBinary: true, usePdfPlugin: true });
    candidateAttempts.push({ model: 'openrouter/free', nativeBinary: true, usePdfPlugin: true });
    candidateAttempts.push({ model: 'google/gemma-4-31b-it:free', nativeBinary: false, usePdfPlugin: false });
    candidateAttempts.push({ model: 'openrouter/free', nativeBinary: false, usePdfPlugin: false });
  } else if (previewImages.length > 0 || videoDataUrl) {
    if (specificRequestedModel) candidateAttempts.push({ model: specificRequestedModel, nativeBinary: true, usePdfPlugin: false });
    candidateAttempts.push({ model: 'google/gemma-4-31b-it:free', nativeBinary: false, usePdfPlugin: false });
    candidateAttempts.push({ model: 'nvidia/nemotron-3.5-super-vl:free', nativeBinary: false, usePdfPlugin: false });
    candidateAttempts.push({ model: 'google/gemma-4-26b-a4b-it:free', nativeBinary: false, usePdfPlugin: false });
    candidateAttempts.push({ model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', nativeBinary: Boolean(videoDataUrl), usePdfPlugin: false });
    candidateAttempts.push({ model: 'particle-ai/particle-1:free', nativeBinary: false, usePdfPlugin: false });
    candidateAttempts.push({ model: 'openrouter/free', nativeBinary: false, usePdfPlugin: false });
  } else {
    if (specificRequestedModel) candidateAttempts.push({ model: specificRequestedModel, nativeBinary: false, usePdfPlugin: false });
    candidateAttempts.push({ model: 'openrouter/free', nativeBinary: false, usePdfPlugin: false });
    candidateAttempts.push({ model: 'google/gemma-4-31b-it:free', nativeBinary: false, usePdfPlugin: false });
    candidateAttempts.push({ model: 'deepseek/deepseek-chat', nativeBinary: false, usePdfPlugin: false });
    candidateAttempts.push({ model: 'meta-llama/llama-3.3-70b-instruct:free', nativeBinary: false, usePdfPlugin: false });
  }

  let lastError = '';
  for (const attempt of candidateAttempts) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 22000);
      const reqBody: Record<string, any> = {
        model: attempt.model,
        messages: [
          ...priorMessages,
          { role: 'user', content: buildUserContent(attempt.nativeBinary) },
        ],
        temperature: 0.25,
        max_tokens: 1400,
      };
      if (attempt.usePdfPlugin) {
        reqBody.plugins = [{ id: 'file-parser', pdf: { engine: 'pdf-text' } }];
      }

      const res = await fetch(OPENROUTER_CHAT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://frosted.app',
          'X-Title': 'FrostHub AI',
        },
        body: JSON.stringify(reqBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as any;
        const content = data?.choices?.[0]?.message?.content;
        const replyText =
          typeof content === 'string'
            ? content.trim()
            : Array.isArray(content)
            ? content
                .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
                .join('')
                .trim()
            : '';
        if (replyText) {
          return { reply: replyText, modelUsed: data?.model || attempt.model };
        }
      } else {
        const errText = await res.text().catch(() => '');
        lastError = `OpenRouter HTTP ${res.status}: ${errText.slice(0, 180)}`;
        if (res.status === 401 || res.status === 403) {
          break;
        }
      }
    } catch (err: any) {
      lastError = err?.message || 'OpenRouter request failed';
    }
  }

  return {
    reply: '',
    errorDetail: lastError || 'OpenRouter could not analyze this file.',
  };
}

