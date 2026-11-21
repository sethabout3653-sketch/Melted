const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const MIME: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  mjs: 'application/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  wasm: 'application/wasm',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
};

export async function onRequest(context: { params: { path?: string | string[] } }): Promise<Response> {
  const raw = context.params.path;
  let path = (Array.isArray(raw) ? raw.join('/') : raw || '').replace(/^\/+/, '');
  if (!path || path.includes('..')) {
    return new Response('Invalid game path', { status: 400 });
  }
  if (!path.startsWith('ugs/')) path = `ugs/${path}`;
  const primaryUrl = `https://raw.githack.com/gmshelf/ugs/main/${path}`;
  const fallbackUrl = `https://raw.githubusercontent.com/gmshelf/ugs/main/${path}`;

  try {
    let upstream = await fetch(primaryUrl, { headers: { 'User-Agent': UA } });
    if (!upstream.ok) upstream = await fetch(fallbackUrl, { headers: { 'User-Agent': UA } });
    if (!upstream.ok) {
      return new Response('Game file not found', { status: upstream.status });
    }

    const ext = path.includes('.') ? path.split('.').pop()!.toLowerCase() : 'html';
    const contentType = MIME[ext] || upstream.headers.get('content-type') || 'application/octet-stream';

    return new Response(upstream.body, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error: any) {
    return new Response(`Error proxying game file: ${error?.message || error}`, { status: 500 });
  }
}
