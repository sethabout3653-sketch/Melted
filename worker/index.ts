import { onRequest as health } from '../functions/api/health';
import { onRequest as scramjetCookies } from '../functions/api/scramjet-cookies';
import { onRequest as scramjetFetch } from '../functions/api/scramjet-fetch';
import { onRequest as raw } from '../functions/api/raw/[filename]';
import { onRequest as proxyStream } from '../functions/api/proxy-stream';
import { onRequest as proxyImage } from '../functions/api/proxy-image';
import { onRequest as epgNowNext } from '../functions/api/epg/now-next';
import { onRequest as wsDb } from '../functions/ws-db';

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

type Handler = (context: { request: Request; env: Env; params: Record<string, string> }) => Promise<Response>;

const routes: Array<{ pattern: RegExp; handler: Handler }> = [
  { pattern: /^\/api\/health\/?$/, handler: health },
  { pattern: /^\/api\/scramjet-cookies\/?$/, handler: scramjetCookies },
  { pattern: /^\/api\/scramjet-fetch\/?$/, handler: scramjetFetch },
  { pattern: /^\/api\/raw\/([^/]+)\/?$/, handler: ({ params }) => raw({ params: { filename: params.filename } }) },
  { pattern: /^\/api\/proxy-stream\/?$/, handler: proxyStream },
  { pattern: /^\/api\/proxy-image\/?$/, handler: proxyImage },
  { pattern: /^\/api\/epg\/now-next\/?$/, handler: epgNowNext },
  { pattern: /^\/ws-db\/?$/, handler: wsDb },
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    for (const { pattern, handler } of routes) {
      const match = url.pathname.match(pattern);
      if (!match) continue;

      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': '*',
          },
        });
      }

      const params = match[1] ? { filename: decodeURIComponent(match[1]) } : {};
      const response = await handler({ request, env, params });
      if (response.status === 101) return response;

      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('X-Frame-Options', 'ALLOWALL');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }

    return env.ASSETS.fetch(request);
  },
};
