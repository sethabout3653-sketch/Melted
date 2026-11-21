import { CfHubCore } from '../worker/cfHubCore';

// Cloudflare Pages Function: /ws-db Edge WebSocket Database & Signaling Server
// Proxies to shared Worker/Durable Object hub when bound (SIGNALING_HUB or WS_HUB_URL),
// or serves in-isolate WebSocket + REST hub while Firestore bridges all Pages isolates & instances.
interface PagesWsEnv {
  SIGNALING_HUB?: {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(request: Request): Promise<Response> };
  };
  WS_HUB_URL?: string;
}

const g = globalThis as any;
const isolateHub: CfHubCore = (g.__frosthubCfHubCore ??= new CfHubCore());

export async function onRequest(context: { request: Request; env?: PagesWsEnv }): Promise<Response> {
  const { request, env } = context;

  // 1. Shared Durable Object binding if configured in Cloudflare Pages
  if (env?.SIGNALING_HUB) {
    const hub = env.SIGNALING_HUB.get(env.SIGNALING_HUB.idFromName('global'));
    return hub.fetch(request);
  }

  // 2. External shared Worker / Node hub proxy if WS_HUB_URL is configured
  if (env?.WS_HUB_URL) {
    try {
      const incomingUrl = new URL(request.url);
      const targetUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, env.WS_HUB_URL);
      return await fetch(new Request(targetUrl.toString(), request));
    } catch {}
  }

  // 3. Native Cloudflare Pages WebSocketPair / REST hub
  return isolateHub.handleRequest(request);
}
