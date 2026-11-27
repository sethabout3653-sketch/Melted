import { createGateway, experimental_generateVideo as generateVideo } from 'ai';

interface CFContext {
  request: Request;
  env?: Record<string, string | undefined>;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

class RequestError extends Error {
  constructor(message: string, readonly status: number = 400) {
    super(message);
  }
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function decodeImageDataUrl(value: string): { bytes: Uint8Array; mimeType: string } {
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!match) throw new RequestError('Choose a valid PNG, JPEG, or WebP image.');
  const binary = atob(match[2]);
  if (!binary.length || binary.length > 10 * 1024 * 1024) throw new RequestError('Images must be 10 MB or smaller.', 413);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { bytes, mimeType: match[1].toLowerCase() };
}

function hasPrivateIpLiteral(host: string): boolean {
  const cleanHost = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (cleanHost === 'localhost' || cleanHost.endsWith('.localhost') || cleanHost.endsWith('.local') || cleanHost.endsWith('.internal')) return true;
  const ipv4 = cleanHost.split('.').map(Number);
  if (ipv4.length === 4 && ipv4.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    const [a, b, c] = ipv4;
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) ||
      (a === 192 && b === 0 && c === 0) || (a === 198 && (b === 18 || b === 19));
  }
  return cleanHost === '::' || cleanHost === '::1' || cleanHost.startsWith('fc') ||
    cleanHost.startsWith('fd') || /^fe[89ab]/.test(cleanHost) || cleanHost.startsWith('ff');
}

async function fetchImageUrl(value: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RequestError('Enter a valid public HTTPS image URL.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || hasPrivateIpLiteral(url.hostname)) {
    throw new RequestError('Image URLs must use a public HTTPS address.');
  }

  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new RequestError(`Could not load the image URL (HTTP ${response.status}).`);
  const mimeType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
    throw new RequestError('The image URL must serve a PNG, JPEG, or WebP image.');
  }
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > 10 * 1024 * 1024) throw new RequestError('Images must be 10 MB or smaller.', 413);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new RequestError('Images must be 10 MB or smaller.', 413);
  return { bytes, mimeType };
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export async function onRequest(context: CFContext): Promise<Response> {
  const { request, env = {} } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) throw new RequestError('Write a description of the video you want to generate.');

    const gatewayKey = env.AI_GATEWAY_API_KEY || env.VERCEL_AI_GATEWAY_API_KEY;
    if (!gatewayKey) {
      return jsonResponse({ error: 'Cloudflare is missing the AI_GATEWAY_API_KEY secret required for video generation.' }, 503);
    }

    const model = body.model === 'spacexai/grok-imagine-video-1.5'
      ? 'spacexai/grok-imagine-video-1.5'
      : 'google/veo-3.1-generate-001';
    const requestedDuration = Number(body.durationSeconds);
    let duration = Number.isInteger(requestedDuration) ? Math.min(10, Math.max(2, requestedDuration)) : 8;
    if (model === 'google/veo-3.1-generate-001' && ![4, 6, 8].includes(duration)) duration = 8;

    let sourceImage: { bytes: Uint8Array; mimeType: string } | undefined;
    if (typeof body.imageDataUrl === 'string' && body.imageDataUrl) {
      sourceImage = decodeImageDataUrl(body.imageDataUrl);
    } else if (typeof body.imageUrl === 'string' && body.imageUrl.trim()) {
      sourceImage = await fetchImageUrl(body.imageUrl.trim());
    }
    if (sourceImage && model !== 'spacexai/grok-imagine-video-1.5') {
      throw new RequestError('Choose Grok Imagine Video 1.5 for image-to-video generation.');
    }

    const gateway = createGateway({ apiKey: gatewayKey });
    const videoPrompt = sourceImage
      ? { image: sourceImage.bytes, text: prompt }
      : prompt;
    const { video } = await generateVideo({
      model: gateway.video(model),
      prompt: videoPrompt,
      duration,
      aspectRatio: sourceImage ? 'adaptive' : body.aspectRatio === '9:16' ? '9:16' : '16:9',
      ...(model === 'google/veo-3.1-generate-001' ? { resolution: '1280x720' } : {}),
      poll: { intervalMs: 5_000, timeoutMs: 280_000 },
    });

    const bytes = video.uint8Array || Uint8Array.from(atob(video.base64), (character) => character.charCodeAt(0));
    const mimeType = video.mediaType || 'video/mp4';
    return jsonResponse({
      success: true,
      videoUrl: `data:${mimeType};base64,${encodeBase64(bytes)}`,
      mimeType,
      prompt,
      duration: `${duration}s`,
      model,
    }, 200);
  } catch (error: any) {
    const status = error instanceof RequestError ? error.status : 500;
    return jsonResponse({ error: error?.message || 'Failed to generate video.' }, status);
  }
}
