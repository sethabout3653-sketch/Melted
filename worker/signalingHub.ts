import { CfHubCore } from './cfHubCore';

// Durable Object: single shared /ws-db presence & signaling hub for all Cloudflare Worker clients
export class SignalingHub {
  private readonly hub: CfHubCore;
  public readonly state?: any;
  public readonly env?: unknown;

  constructor(state?: any, env?: unknown) {
    this.state = state;
    this.env = env;
    this.hub = new CfHubCore(state?.storage);
  }

  fetch(request: Request): Promise<Response> {
    return this.hub.handleRequest(request);
  }
}
