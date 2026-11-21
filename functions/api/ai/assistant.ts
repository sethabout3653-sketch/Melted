import { extractOpenRouterKey, runOpenRouterAssistantEdge } from '../../../src/utils/openRouterEdgeHelper';

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
      openRouterApiKey?: string;
      model?: string;
      searchMode?: 'auto' | 'always' | 'off';
    };

    const prompt = body?.prompt;
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Missing prompt' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const openRouterKey = extractOpenRouterKey(env, body.openRouterApiKey);
    if (!openRouterKey) {
      return new Response(
        JSON.stringify({
          error: 'OpenRouter API Key is not configured on Cloudflare. Add OPENROUTER_API_KEY in Worker/Pages secrets and redeploy.',
        }),
        { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const result = await runOpenRouterAssistantEdge({
      openRouterKey,
      prompt,
      history: body.history,
      model: body.model,
      searchMode: body.searchMode,
    });

    if (!result.reply) {
      return new Response(
        JSON.stringify({
          error: result.errorDetail || 'OpenRouter API request failed or timed out. Please check your OpenRouter API key.',
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
