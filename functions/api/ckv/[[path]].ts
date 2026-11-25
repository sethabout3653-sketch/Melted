// Cloudflare Pages/Workers Edge Handler: CKV Game Stream Proxy (/api/ckv/*)
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export async function onRequest(context: {
  request?: Request;
  params: { path?: string | string[] };
}): Promise<Response> {
  const rawPath = context.params?.path;
  const ckvPath = Array.isArray(rawPath) ? rawPath.join('/') : String(rawPath || '');
  if (!ckvPath) {
    return new Response('Invalid CKV game path', { status: 400 });
  }

  const cleanPath = ckvPath.startsWith('/') ? ckvPath : `/${ckvPath}`;
  const fullPath = cleanPath.startsWith('/ckv/') ? cleanPath.replace(/^\/ckv\//, '/') : cleanPath;

  const primaryUrl = `https://wanocapy.github.io/ChickenKingsVault${fullPath}`;
  const fallbackUrl = `https://raw.githubusercontent.com/WanoCapy/ChickenKingsVault/main${fullPath}`;

  try {
    let response = await fetch(primaryUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      response = await fetch(fallbackUrl, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(8000),
      });
    }

    if (!response.ok) {
      return new Response('CKV game file not found', { status: response.status });
    }

    const isHtml = fullPath.endsWith('.html') || fullPath.endsWith('.htm') || !fullPath.includes('.');
    if (isHtml) {
      const rawText = await response.text();
      return new Response(rawText, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'X-Frame-Options': 'ALLOWALL',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
        'X-Frame-Options': 'ALLOWALL',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new Response('Error proxying CKV game file', { status: 500 });
  }
}
