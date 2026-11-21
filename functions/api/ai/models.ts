import { extractOpenRouterKey, FALLBACK_OPENROUTER_MODELS } from '../../../src/utils/openRouterEdgeHelper';

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
  const openRouterKey = extractOpenRouterKey(env, url.searchParams.get('apiKey') || undefined);

  return new Response(
    JSON.stringify({
      success: true,
      hasKey: Boolean(openRouterKey),
      models: FALLBACK_OPENROUTER_MODELS,
      source: 'curated-free',
    }),
    { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
  );
}
