import { onRequest as health } from '../functions/api/health';
import { onRequest as scramjetCookies } from '../functions/api/scramjet-cookies';
import { onRequest as scramjetFetch } from '../functions/api/scramjet-fetch';
import { onRequest as raw } from '../functions/api/raw/[filename]';
import { onRequest as cover } from '../functions/api/cover/[[path]]';
import { onRequest as proxyStream } from '../functions/api/proxy-stream';
import { onRequest as proxyImage } from '../functions/api/proxy-image';
import { onRequest as epgNowNext } from '../functions/api/epg/now-next';
import { onRequest as aiModels } from '../functions/api/ai/models';
import { onRequest as aiAssistant } from '../functions/api/ai/assistant';
import { onRequest as aiAssistantStream } from '../functions/api/ai/assistant/stream';
import { onRequest as esrbImage } from '../functions/api/esrb/image';
import { onRequest as esrbRatings } from '../functions/api/esrb/ratings';
import { SignalingHub } from './signalingHub';
import { handleWispRequest } from './wispServer';

export { SignalingHub };

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  SIGNALING_HUB: {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(request: Request): Promise<Response> };
  };
  SCRAMJET_COOKIES?: {
    get(key: string, type: 'json'): Promise<unknown>;
    put(key: string, value: string): Promise<void>;
  };
  OPENROUTER_API_KEY?: string;
  VITE_OPENROUTER_API_KEY?: string;
  OPENROUTER_KEY?: string;
}

type Handler = (context: { request: Request; env: Env; params: Record<string, string> }) => Promise<Response>;

const routes: Array<{ pattern: RegExp; handler: Handler }> = [
  { pattern: /^\/api\/health\/?$/, handler: health },
  { pattern: /^\/api\/scramjet-cookies\/?$/, handler: ({ request, env }) => scramjetCookies({ request, env }) },
  { pattern: /^\/api\/scramjet-fetch\/?$/, handler: scramjetFetch },
  { pattern: /^\/api\/raw\/(.+)\/?$/, handler: ({ params }) => raw({ params: { filename: params.filename } }) },
  { pattern: /^\/api\/cover\/(.+)\/?$/, handler: ({ request, params }) => cover({ request, params: { path: params.filename } }) },
  { pattern: /^\/api\/proxy-stream\/?$/, handler: proxyStream },
  { pattern: /^\/api\/proxy-image\/?$/, handler: proxyImage },
  { pattern: /^\/api\/esrb\/image\/?$/, handler: ({ request }) => esrbImage({ request }) },
  { pattern: /^\/api\/esrb\/ratings\/?$/, handler: ({ request, env }) => esrbRatings({ request, env }) },
  { pattern: /^\/api\/epg\/now-next\/?$/, handler: epgNowNext },
  { pattern: /^\/api\/ai\/models\/?$/, handler: ({ request, env }) => aiModels({ request, env }) },
  { pattern: /^\/api\/ai\/assistant\/stream\/?$/, handler: ({ request, env }) => aiAssistantStream({ request, env }) },
  { pattern: /^\/api\/ai\/assistant\/?$/, handler: ({ request, env }) => aiAssistant({ request, env }) },
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (
      url.pathname === '/ws-db' ||
      url.pathname === '/ws-db/' ||
      url.pathname.startsWith('/api/ws-db/')
    ) {
      const hub = env.SIGNALING_HUB.get(env.SIGNALING_HUB.idFromName('global'));
      return hub.fetch(request);
    }

    if (
      url.pathname === '/wisp' ||
      url.pathname === '/wisp/' ||
      url.pathname.startsWith('/wisp/')
    ) {
      return handleWispRequest(request, env);
    }

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
