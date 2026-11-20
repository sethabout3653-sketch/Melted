// Cloudflare image reverse proxy (/api/proxy-image), mirrors the Express handler in src/server/sethsrcEngine.ts

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export async function onRequest(context: { request: Request }): Promise<Response> {
  const imageUrl = (new URL(context.request.url).searchParams.get('url') || '').trim();
  if (!imageUrl) {
    return new Response('Missing url parameter', { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return new Response('Invalid url parameter', { status: 400 });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return new Response('Unsupported protocol', { status: 400 });
  }

  try {
    const upstream = await fetch(parsed.href, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) {
      return new Response('Failed to fetch image', { status: 404 });
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'image/png',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new Response('Failed to fetch image', { status: 404 });
  }
}
