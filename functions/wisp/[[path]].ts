import { handleWispRequest } from '../../worker/wispServer';

// Cloudflare Pages Function: /wisp and /wisp/* WebSocket Wisp Server
export async function onRequest(context: { request: Request; env?: any }): Promise<Response> {
  return handleWispRequest(context.request, context.env);
}
