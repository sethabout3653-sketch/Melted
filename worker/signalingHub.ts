import { CfHubCore } from './cfHubCore';

// Durable Object: single shared /ws-db presence & signaling hub for all Cloudflare Worker clients
export class SignalingHub {
  private readonly hub = new CfHubCore();
  public readonly state?: unknown;
  public readonly env?: unknown;

  constructor(state?: unknown, env?: unknown) {
    this.state = state;
    this.env = env;
  }

  fetch(request: Request): Promise<Response> {
    return this.hub.handleRequest(request);
  }
}
