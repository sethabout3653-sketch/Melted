import { buildAISystemInstruction } from '../data/aiAssistantPrompt';

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

export const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const OPENROUTER_MODEL = 'openrouter/free';

export const FALLBACK_OPENROUTER_MODELS = [
  { id: OPENROUTER_MODEL, owned_by: 'OpenRouter', description: 'Free Models Router (free)' },
];

export function extractOpenRouterKey(env?: Record<string, any>, requestKey?: string): string {
  const candidates = [
    env?.OPENROUTER_API_KEY,
    env?.VITE_OPENROUTER_API_KEY,
    env?.OPENROUTER_KEY,
    requestKey,
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
  onStep?: (step: AIThinkingStep) => void;
}): Promise<{
  reply: string;
  sources: Array<{ title: string; url: string }>;
  steps: AIThinkingStep[];
  errorDetail?: string;
}> {
  const { openRouterKey, prompt, history, model: customModel, searchMode, onStep } = params;
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

  const systemInstruction = buildAISystemInstruction();
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

  let replyText = '';
  let lastError = '';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);
    const res = await fetch(OPENROUTER_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: targetModel,
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
      if (text) replyText = text.trim();
    } else {
      const errText = await res.text().catch(() => '');
      lastError = `OpenRouter HTTP ${res.status}: ${errText.slice(0, 140)}`;
    }
  } catch (err: any) {
    lastError = err?.message || 'OpenRouter request error';
  }

  return {
    reply: replyText,
    sources: searchResults.map((s) => ({ title: s.title, url: s.url })),
    steps,
    errorDetail: replyText ? undefined : lastError || 'OpenRouter API request failed or timed out.',
  };
}
