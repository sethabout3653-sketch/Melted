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

  const p = prompt.toLowerCase();
  const searchTriggers = [
    'who is', 'who was', 'who won', 'who created', 'who played', 'when was', 'when did', 'when will',
    'where is', 'where was', 'latest', 'current', 'news', 'score', 'winner', 'weather', 'price',
    'release date', 'super bowl', 'champion', 'championship', 'today', 'yesterday', 'update',
    'president', 'ceo', 'stats', 'movie', 'film', 'born', 'died', 'how many', 'population',
    'search', 'google', 'look up', 'find out', 'history of', 'what is happening', 'record',
  ];

  return searchTriggers.some((t) => p.includes(t)) || p.length > 35;
}

export async function searchWebEdge(query: string): Promise<WebSearchResult[]> {
  const results: WebSearchResult[] = [];
  const cleanQ = query.replace(/[?.,!]+$/, '').trim();
  if (!cleanQ) return results;

  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQ)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(4500),
    });

    if (res.ok) {
      const html = await res.text();
      const regex = /<a[^>]+class="result__snippet"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
      let m;
      while ((m = regex.exec(html)) !== null && results.length < 5) {
        const rawUrl = m[1];
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
  } catch {}

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
        const data = (await wikiRes.json()) as any;
        const hits = data?.query?.search || [];
        for (const hit of hits.slice(0, 4)) {
          const snippet = String(hit.snippet || '')
            .replace(/<[^>]+>/g, '')
            .replace(/&#x27;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/\s+/g, ' ')
            .trim();
          results.push({
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(hit.title || '').replace(/\s+/g, '_'))}`,
            title: String(hit.title || 'Wikipedia'),
            snippet,
          });
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

