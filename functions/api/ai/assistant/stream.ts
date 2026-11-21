import { extractOpenRouterKey, runOpenRouterAssistantEdge } from '../../../../src/utils/openRouterEdgeHelper';

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

  const body = (await request.json().catch(() => ({}))) as {
    prompt?: string;
    history?: Array<{ role?: string; text?: string }>;
    openRouterApiKey?: string;
    model?: string;
    searchMode?: 'auto' | 'always' | 'off';
    personality?: unknown;
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {}
      };

      try {
        const prompt = body?.prompt;
        if (!prompt) {
          sendEvent({ type: 'error', error: 'Missing prompt' });
          controller.close();
          return;
        }

        const openRouterKey = extractOpenRouterKey(env, body.openRouterApiKey);
        if (!openRouterKey) {
          sendEvent({
            type: 'error',
            error: 'OpenRouter API Key is not configured on Cloudflare. Add OPENROUTER_API_KEY in Worker/Pages secrets and redeploy.',
          });
          controller.close();
          return;
        }

        const result = await runOpenRouterAssistantEdge({
          openRouterKey,
          prompt,
          history: body.history,
          model: body.model,
          searchMode: body.searchMode,
          personality: body.personality,
          onStep: (step) => sendEvent({ type: 'step', ...step }),
        });

        if (!result.reply) {
          sendEvent({
            type: 'error',
            error: result.errorDetail || 'OpenRouter API request failed or timed out. Please check your OpenRouter API key.',
          });
          controller.close();
          return;
        }

        sendEvent({
          type: 'done',
          reply: result.reply,
          sources: result.sources,
          steps: result.steps,
        });
      } catch (err: any) {
        sendEvent({ type: 'error', error: err?.message || 'Failed to stream response' });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
