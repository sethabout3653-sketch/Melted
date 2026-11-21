import { extractGroqKey, runGroqAssistantEdge } from '../../../src/utils/groqEdgeHelper';

interface CFContext {
  request: Request;
  env?: Record<string, any>;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequest(context: CFContext): Promise<Response> {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      prompt?: string;
      history?: Array<{ role?: string; text?: string }>;
      groqApiKey?: string;
      model?: string;
      searchMode?: 'auto' | 'always' | 'off';
      personality?: unknown;
    };

    const prompt = body?.prompt;
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Missing prompt' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const groqKey = extractGroqKey(env, body.groqApiKey);
    if (!groqKey) {
      return new Response(
        JSON.stringify({
          error: 'Groq API Key is not configured on Cloudflare. Add GROQ_API_KEY in Worker/Pages secrets and redeploy.',
        }),
        { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const result = await runGroqAssistantEdge({
      groqKey,
      prompt,
      history: body.history,
      model: body.model,
      searchMode: body.searchMode,
      personality: body.personality,
    });

    if (!result.reply) {
      return new Response(
        JSON.stringify({
          error: result.errorDetail || 'Groq API request failed or timed out. Please check your Groq API key.',
        }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        reply: result.reply,
        sources: result.sources,
        steps: result.steps,
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: 'AI Assistant error',
        message: err?.message || 'Failed to generate response',
      }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}
