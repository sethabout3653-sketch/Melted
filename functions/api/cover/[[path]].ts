// Cloudflare Pages Function for /api/cover/* game cover image caching & delivery
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export async function onRequest(context: {
  request: Request;
  params: { path?: string | string[] };
}): Promise<Response> {
  const rawPath = context.params?.path;
  const coverPath = Array.isArray(rawPath) ? rawPath.join('/') : String(rawPath || '');
  if (!coverPath) {
    return new Response('Invalid cover path', { status: 400 });
  }

  const urls = [
    `https://raw.githubusercontent.com/gn-math/covers/main/${coverPath}`,
    `https://raw.githack.com/gn-math/covers/main/${coverPath}`,
  ];

  for (const targetUrl of urls) {
    try {
      const upstream = await fetch(targetUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(5000),
      });
      if (upstream.ok) {
        return new Response(upstream.body, {
          status: 200,
          headers: {
            'Content-Type': upstream.headers.get('content-type') || 'image/png',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=604800, immutable',
          },
        });
      }
    } catch {}
  }

  return new Response('Cover image not found', { status: 404 });
}
