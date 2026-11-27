import { Buffer } from 'node:buffer';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { experimental_generateVideo as generateVideo } from 'ai';

export const config = {
  maxDuration: 300,
  api: { bodyParser: { sizeLimit: '15mb' } },
};

class RequestError extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message);
  }
}

function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) ||
      (a === 192 && b === 0 && c === 0) || (a === 198 && (b === 18 || b === 19)));
  }
  if (version !== 6) return false;
  const normalized = address.toLowerCase();
  return !normalized.startsWith('::ffff:') &&
    !/^::$|^::1$|^fc|^fd|^fe[89ab]|^ff/i.test(normalized);
}

async function fetchPublicImage(imageUrl: string): Promise<{ mimeType: string; image: Buffer }> {
  let url: URL;
  try {
    url = new URL(imageUrl);
  } catch {
    throw new RequestError('Enter a valid public HTTPS image URL.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
    throw new RequestError('Image URLs must use a public HTTPS address.');
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new RequestError('That image URL does not point to a public address.');
  }

  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new RequestError(`Could not load the image URL (HTTP ${response.status}).`);
  const mimeType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
    throw new RequestError('The image URL must serve a PNG, JPEG, or WebP image.');
  }
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > 10 * 1024 * 1024) throw new RequestError('Images must be 10 MB or smaller.', 413);
  const image = Buffer.from(await response.arrayBuffer());
  if (!image.length || image.length > 10 * 1024 * 1024) throw new RequestError('Images must be 10 MB or smaller.', 413);
  return { mimeType, image };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) throw new RequestError('Write a description of the video you want to generate.');

    const model = body.model === 'spacexai/grok-imagine-video-1.5'
      ? 'spacexai/grok-imagine-video-1.5'
      : 'google/veo-3.1-generate-001';
    const requestedDuration = Number(body.durationSeconds);
    let duration = Number.isInteger(requestedDuration) ? Math.min(10, Math.max(2, requestedDuration)) : 8;
    if (model === 'google/veo-3.1-generate-001' && ![4, 6, 8].includes(duration)) duration = 8;

    let image: Buffer | undefined;
    let mimeType = '';
    if (typeof body.imageDataUrl === 'string' && body.imageDataUrl) {
      const match = body.imageDataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/i);
      if (!match) throw new RequestError('Choose a valid PNG, JPEG, or WebP image.');
      image = Buffer.from(match[2], 'base64');
      mimeType = match[1].toLowerCase();
      if (!image.length || image.length > 10 * 1024 * 1024) throw new RequestError('Images must be 10 MB or smaller.', 413);
    } else if (typeof body.imageUrl === 'string' && body.imageUrl.trim()) {
      ({ image, mimeType } = await fetchPublicImage(body.imageUrl.trim()));
    }

    if (image && model !== 'spacexai/grok-imagine-video-1.5') {
      throw new RequestError('Choose Grok Imagine Video 1.5 for image-to-video generation.');
    }

    const videoPrompt = image ? { image, text: prompt } : prompt;
    const { video } = await generateVideo({
      model,
      prompt: videoPrompt,
      duration,
      aspectRatio: image ? 'adaptive' : body.aspectRatio === '9:16' ? '9:16' : '16:9',
      ...(model === 'google/veo-3.1-generate-001' ? { resolution: '1280x720' } : {}),
      poll: { intervalMs: 5_000, timeoutMs: 280_000 },
    });

    const videoBase64 = video.base64 || Buffer.from(video.uint8Array).toString('base64');
    const videoMimeType = video.mediaType || 'video/mp4';
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      success: true,
      videoUrl: `data:${videoMimeType};base64,${videoBase64}`,
      mimeType: videoMimeType,
      prompt,
      duration: `${duration}s`,
      model,
    });
  } catch (error: any) {
    const statusCode = error instanceof RequestError ? error.statusCode : 500;
    console.error('AI Video Generation Error:', error?.message || error);
    return res.status(statusCode).json({ error: error?.message || 'Failed to generate video.' });
  }
}
