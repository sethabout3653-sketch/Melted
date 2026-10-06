// Cloudflare Pages Function: Raw Game Stream Proxy
// Streams HTML games directly with permissive headers and edge caching
export async function onRequest(context: { params: { filename: string } }): Promise<Response> {
  let filename = context.params.filename;
  if (!filename) {
    return new Response('Invalid game filename', { status: 400 });
  }

  if (!filename.endsWith('.html')) {
    filename = `${filename}.html`;
  }

  const rawgithackUrl = `https://raw.githack.com/freebuisness/html/main/${filename}`;
  const githubRawUrl = `https://raw.githubusercontent.com/freebuisness/html/main/${filename}`;

  try {
    let response = await fetch(rawgithackUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      response = await fetch(githubRawUrl);
    }

    if (!response.ok) {
      return new Response(`Failed to fetch game package: ${response.statusText}`, {
        status: response.status,
      });
    }

    const html = await response.text();

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'X-Frame-Options': 'ALLOWALL',
        'Cache-Control': 'public, max-age=2592000, immutable',
      },
    });
  } catch (error: any) {
    return new Response(`Error streaming game: ${error?.message || error}`, { status: 500 });
  }
}
