import { createGateway, generateText } from 'ai';

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
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const imageDataUrl = typeof body.imageDataUrl === 'string' ? body.imageDataUrl : '';
    const match = imageDataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/i);
    if (!match) return jsonResponse({ error: 'Attach a valid PNG, JPEG, or WebP image.' }, 400);

    const gatewayKey = env.AI_GATEWAY_API_KEY || env.VERCEL_AI_GATEWAY_API_KEY;
    if (!gatewayKey) {
      return jsonResponse({ error: 'Cloudflare is missing the AI_GATEWAY_API_KEY secret required for image chat.' }, 503);
    }

    const binary = atob(match[2]);
    if (!binary.length || binary.length > 10 * 1024 * 1024) {
      return jsonResponse({ error: 'Images must be 10 MB or smaller.' }, 413);
    }
    const image = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) image[index] = binary.charCodeAt(index);

    const gateway = createGateway({ apiKey: gatewayKey });
    const { text } = await generateText({
      model: gateway.languageModel('google/gemini-3.8-flash'),
      messages: [{
        role: 'user',
        content: [
          { type: 'image', image, mediaType: match[1].toLowerCase() },
          { type: 'text', text: prompt || 'Describe this image.' },
        ],
      }],
      maxOutputTokens: 1000,
    });
    const reply = text.trim();
    if (!reply) return jsonResponse({ error: 'The image model returned an empty response. Please try again.' }, 502);
    return jsonResponse({ success: true, reply }, 200);
  } catch (error: any) {
    return jsonResponse({ error: error?.message || 'Image analysis failed.' }, 500);
  }
}
