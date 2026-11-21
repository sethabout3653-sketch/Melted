import { CfHubCore } from '../../../worker/cfHubCore';

// Cloudflare Pages Function: /api/ws-db/* HTTP signaling & presence endpoints
// Shares the same isolate hub as /functions/ws-db.ts, or forwards to SIGNALING_HUB / WS_HUB_URL if configured.
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

  if (env?.SIGNALING_HUB) {
    const hub = env.SIGNALING_HUB.get(env.SIGNALING_HUB.idFromName('global'));
    return hub.fetch(request);
  }

  if (env?.WS_HUB_URL) {
    try {
      const incomingUrl = new URL(request.url);
      const targetUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, env.WS_HUB_URL);
      return await fetch(new Request(targetUrl.toString(), request));
    } catch {}
  }

  return isolateHub.handleRequest(request);
}
