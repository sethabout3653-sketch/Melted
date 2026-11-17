declare module '@mercuryworkshop/wisp-js/server' {
  import type { IncomingMessage } from 'http';
  import type { Duplex } from 'stream';

  export const server: {
    routeRequest: (req: IncomingMessage, socket: Duplex, head: Buffer) => void;
    options: Record<string, any>;
  };
}

declare module '@mercuryworkshop/libcurl-transport' {
  import type { ProxyTransport, RawHeaders, TransferrableResponse } from '@mercuryworkshop/proxy-transports';

  export default class LibcurlClient implements ProxyTransport {
    ready: boolean;
    wisp: string;
    constructor(opts: { wisp: string; [key: string]: any });
    init(): Promise<void>;
    meta(): Promise<void>;
    request(
      remote: URL,
      method: string,
      body: BodyInit | null,
      headers: RawHeaders,
      signal: AbortSignal | undefined
    ): Promise<TransferrableResponse>;
    connect(
      url: URL,
      protocols: string[],
      requestHeaders: RawHeaders,
      onopen: (protocol: string, extensions: string) => void,
      onmessage: (data: Blob | ArrayBuffer | string) => void,
      onclose: (code: number, reason: string) => void,
      onerror: (error: string) => void
    ): [(data: Blob | ArrayBuffer | string) => void, (code: number, reason: string) => void];
  }
}

interface ScramjetGlobalWindow {
  $scramjet?: typeof import('@mercuryworkshop/scramjet');
  $scramjetController?: typeof import('@mercuryworkshop/scramjet-controller');
}

interface Window extends ScramjetGlobalWindow {}
