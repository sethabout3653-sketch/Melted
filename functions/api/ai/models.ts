import { extractGroqKey, FALLBACK_GROQ_MODELS } from '../../../src/utils/groqEdgeHelper';

interface CFContext {
  request: Request;
  env?: Record<string, any>;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequest(context: CFContext): Promise<Response> {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const groqKey = extractGroqKey(env, url.searchParams.get('apiKey') || undefined);

  if (!groqKey) {
    return new Response(
      JSON.stringify({
        success: true,
        hasKey: false,
        models: FALLBACK_GROQ_MODELS,
        source: 'curated-free',
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const fetchRes = await fetch('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (fetchRes.ok) {
      const data = (await fetchRes.json()) as any;
      if (Array.isArray(data.data) && data.data.length > 0) {
        const chatModels = data.data
          .filter((m: any) => {
            if (m.active === false) return false;
            const id = String(m.id || '').toLowerCase();
            return (
              !id.includes('whisper') &&
              !id.includes('guard') &&
              !id.includes('orpheus') &&
              !id.includes('tts') &&
              !id.includes('embed')
            );
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
          return new Response(
            JSON.stringify({
              success: true,
              hasKey: true,
              models: chatModels,
              source: 'native-fetch',
            }),
            { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
          );
        }
      }
    }
  } catch {}

  return new Response(
    JSON.stringify({
      success: true,
      hasKey: true,
      models: FALLBACK_GROQ_MODELS,
      source: 'curated-free',
    }),
    { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
  );
}
