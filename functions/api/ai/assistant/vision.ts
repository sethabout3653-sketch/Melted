import {
  extractOpenRouterKey,
  runOpenRouterFileAnalysis,
  type OpenRouterFilePayload,
} from '../../../../src/utils/openRouterEdgeHelper';

interface CFContext {
  request: Request;
  env?: Record<string, string | undefined>;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function onRequest(context: CFContext): Promise<Response> {
  const { request, env = {} } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const body = (await request.json().catch(() => ({}))) as OpenRouterFilePayload & {
      openRouterApiKey?: string;
    };

    const hasFileContent = Boolean(
      body.imageDataUrl ||
        (Array.isArray(body.previewImageUrls) && body.previewImageUrls.length > 0) ||
        body.fileDataUrl ||
        body.extractedText ||
        body.binarySummary ||
        body.fileName
    );

    if (!hasFileContent && !body.prompt?.trim()) {
      return jsonResponse({ error: 'Attach a file or provide a prompt to analyze.' }, 400);
    }

    const openRouterKey = extractOpenRouterKey(env, body.openRouterApiKey);
    if (!openRouterKey) {
      return jsonResponse(
        { error: 'OpenRouter API Key is not configured on Cloudflare. Add OPENROUTER_API_KEY in Cloudflare environment variables.' },
        503
      );
    }

    const result = await runOpenRouterFileAnalysis({
      openRouterKey,
      payload: body,
    });

    if (!result.reply) {
      return jsonResponse(
        { error: result.errorDetail || 'OpenRouter could not analyze this file. Please try again.' },
        502
      );
    }

    return jsonResponse({ success: true, reply: result.reply, modelUsed: result.modelUsed }, 200);
  } catch (error: any) {
    return jsonResponse({ error: error?.message || 'File analysis failed.' }, 500);
  }
}
