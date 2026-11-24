import net from 'net';
import { resolveUnfilteredIp } from './dohResolver';
import { mapSafeSearchRestrictedHost } from '../utils/safeSearchOff';

export const HIGH_SECURITY_DOMAINS = [
  'google.com',
  'youtube.com',
  'googlevideo.com',
  'gstatic.com',
  'ytimg.com',
  'ggpht.com',
  'doubleclick.net',
  'googleusercontent.com',
  'googleapis.com',
  'withgoogle.com',
  'pki.goog',
  'g.co',
  'goo.gl',
  'duckduckgo.com',
  'duck.com',
  'startpage.com',
  'search.brave.com',
  'brave.com',
  'bing.com',
  'discord.com',
  'discordapp.com',
  'challenges.cloudflare.com',
  'cloudflare.com',
  'turnstile.com',
  'recaptcha.net',
  'hcaptcha.com',
  'arkoselabs.com',
  'funcaptcha.com',
  'openai.com',
  'chatgpt.com',
  'ipinfo.io',
  'ip-api.com',
  'whoer.net',
  'bot.sannysoft.com',
];

export function isHighSecurityDomain(hostname: string): boolean {
  if (!hostname) return false;
  const h = hostname.toLowerCase().trim();
  if (/^(www\.|accounts\.|gemini\.|ogs\.|clients\d+\.)?google\.(com\.[a-z]{2}|co\.[a-z]{2}|[a-z]{2,3})$/.test(h)) {
    return true;
  }
  return HIGH_SECURITY_DOMAINS.some((domain) => h === domain || h.endsWith('.' + domain));
}

export interface Socks5Endpoint {
  host: string;
  port: number;
  user?: string;
  pass?: string;
}

function hashClientKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function getStickySocks5Pool(clientKey = 'default'): Socks5Endpoint[] {
  const envRaw = [process.env.SOCKS5_URL || '', process.env.RESIDENTIAL_PROXY_URL || '', process.env.PROXY_POOL_URLS || '']
    .join(',')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const customList: Socks5Endpoint[] = [];
  for (const raw of envRaw) {
    try {
      const parsed = new URL(raw);
      customList.push({
        host: parsed.hostname,
        port: Number(parsed.port || 1080),
        user: parsed.username ? decodeURIComponent(parsed.username) : undefined,
        pass: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      });
    } catch {}
  }

  if (customList.length === 0) return [];
  const start = hashClientKey(clientKey || 'default') % customList.length;
  return [...customList.slice(start), ...customList.slice(0, start)];
}

class AsyncDataQueue {
  private items: Array<Buffer | null> = [];
  private waiters: Array<(val: Buffer | null) => void> = [];
  private closed = false;
  public max_size: number;

  constructor(maxSize = 128) {
    this.max_size = maxSize;
  }

  get size(): number {
    return this.items.length;
  }

  put(chunk: Buffer): void {
    if (this.closed) return;
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(chunk);
    } else {
      this.items.push(chunk);
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      waiter?.(null);
    }
  }

  async get(): Promise<Buffer | null> {
    if (this.items.length > 0) {
      return this.items.shift() ?? null;
    }
    if (this.closed) return null;
    return new Promise<Buffer | null>((resolve) => {
      this.waiters.push(resolve);
    });
  }
}

async function connectViaSocks5(
  proxy: Socks5Endpoint,
  targetHost: string,
  targetPort: number,
  timeoutMs = 7000
): Promise<{ socket: net.Socket; leftover: Buffer | null }> {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    sock.setNoDelay(true);

    let buffer: Buffer = Buffer.alloc(0);
    let step: 'greeting' | 'auth' | 'connect' | 'done' = 'greeting';
    let settled = false;

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      sock.setTimeout(0);
      sock.removeAllListeners();
      sock.destroy();
      reject(err);
    };

    sock.setTimeout(timeoutMs, () => fail(new Error(`SOCKS5 timeout (${proxy.host}:${proxy.port})`)));
    sock.on('error', (err) => fail(err));
    sock.on('close', () => {
      if (!settled) fail(new Error('SOCKS5 closed before handshake finished'));
    });

    const sendConnect = () => {
      step = 'connect';
      const hostBuf = Buffer.from(targetHost, 'utf8');
      const portBuf = Buffer.alloc(2);
      portBuf.writeUInt16BE(targetPort, 0);
      sock.write(Buffer.concat([Buffer.from([0x05, 0x01, 0x00, 0x03, hostBuf.length]), hostBuf, portBuf]));
    };

    sock.on('data', (chunk: Buffer) => {
      buffer = buffer.length === 0 ? chunk : Buffer.concat([buffer, chunk]);

      try {
        if (step === 'greeting') {
          if (buffer.length < 2) return;
          const ver = buffer[0];
          const method = buffer[1];
          buffer = buffer.subarray(2);
          if (ver !== 0x05) {
            fail(new Error(`Invalid SOCKS version ${ver}`));
            return;
          }
          if (method === 0x02 && proxy.user && proxy.pass) {
            step = 'auth';
            const uBuf = Buffer.from(proxy.user, 'utf8');
            const pBuf = Buffer.from(proxy.pass, 'utf8');
            sock.write(
              Buffer.concat([Buffer.from([0x01, uBuf.length]), uBuf, Buffer.from([pBuf.length]), pBuf])
            );
          } else if (method === 0x00) {
            sendConnect();
          } else {
            fail(new Error(`SOCKS5 auth method unsupported: ${method}`));
          }
          return;
        }

        if (step === 'auth') {
          if (buffer.length < 2) return;
          const status = buffer[1];
          buffer = buffer.subarray(2);
          if (status !== 0x00) {
            fail(new Error(`SOCKS5 auth rejected (${status})`));
            return;
          }
          sendConnect();
          return;
        }

        if (step === 'connect') {
          if (buffer.length < 4) return;
          const rep = buffer[1];
          const atyp = buffer[3];
          let needed = 4;
          if (atyp === 0x01) needed += 4 + 2;
          else if (atyp === 0x03) {
            if (buffer.length < 5) return;
            needed += 1 + buffer[4] + 2;
          } else if (atyp === 0x04) needed += 16 + 2;
          else {
            fail(new Error(`Unsupported SOCKS5 ATYP ${atyp}`));
            return;
          }

          if (buffer.length < needed) return;
          if (rep !== 0x00) {
            fail(new Error(`SOCKS5 CONNECT failed with code ${rep}`));
            return;
          }

          const leftover = buffer.length > needed ? buffer.subarray(needed) : null;
          step = 'done';
          settled = true;
          sock.setTimeout(0);
          sock.removeAllListeners('data');
          sock.removeAllListeners('error');
          sock.removeAllListeners('close');
          resolve({ socket: sock, leftover });
        }
      } catch (err: any) {
        fail(err instanceof Error ? err : new Error(String(err)));
      }
    });

    sock.connect({ host: proxy.host, port: proxy.port }, () => {
      if (proxy.user && proxy.pass) {
        sock.write(Buffer.from([0x05, 0x02, 0x00, 0x02]));
      } else {
        sock.write(Buffer.from([0x05, 0x01, 0x00]));
      }
    });
  });
}

export async function dialSocks5Tunnel(
  proxyUrl: URL,
  targetHost: string,
  targetPort: number,
  timeoutMs = 8000
): Promise<net.Socket> {
  const endpoint: Socks5Endpoint = {
    host: proxyUrl.hostname,
    port: Number(proxyUrl.port || 1080),
    user: proxyUrl.username ? decodeURIComponent(proxyUrl.username) : undefined,
    pass: proxyUrl.password ? decodeURIComponent(proxyUrl.password) : undefined,
  };
  const { socket, leftover } = await connectViaSocks5(endpoint, targetHost, targetPort, timeoutMs);
  if (leftover && leftover.length > 0) {
    socket.unshift(leftover);
  }
  return socket;
}

export function createSplitRoutingWispTCPSocket(clientKey = 'default') {
  const socks5Pool = getStickySocks5Pool(clientKey);

  return class SplitRoutingWispTCPSocket {
    public hostname: string;
    public port: number;
    public recv_buffer_size = 128;
    public socket: net.Socket | null = null;
    public paused = false;
    public connected = false;
    public data_queue: AsyncDataQueue;

    constructor(hostname: string, port: number) {
      this.hostname = mapSafeSearchRestrictedHost(hostname);
      this.port = port;
      this.data_queue = new AsyncDataQueue(this.recv_buffer_size);
    }

    async connect(ipOverride: string | null = null): Promise<void> {
      const targetHostname = mapSafeSearchRestrictedHost(this.hostname);
      const useSocks5 = isHighSecurityDomain(targetHostname) && socks5Pool.length > 0;

      if (useSocks5) {
        for (let i = 0; i < Math.min(socks5Pool.length, 2); i++) {
          try {
            const { socket, leftover } = await connectViaSocks5(socks5Pool[i], targetHostname, this.port);
            this.socket = socket;
            this.connected = true;
            if (leftover && leftover.length > 0) {
              this.data_queue.put(leftover);
            }
            this.attachSocketEvents(socket);
            return;
          } catch {
            // Try next clean proxy slot before falling back to direct
          }
        }
      }

      const dohIp = !ipOverride ? await resolveUnfilteredIp(targetHostname).catch(() => null) : null;
      const host = ipOverride || dohIp || targetHostname;
      await new Promise<void>((resolve, reject) => {
        const sock = new net.Socket();
        sock.setNoDelay(true);
        sock.on('connect', () => {
          this.socket = sock;
          this.connected = true;
          resolve();
        });
        sock.on('data', (data) => {
          this.data_queue.put(data);
        });
        sock.on('close', (hadError) => {
          if (hadError && !this.connected) reject(new Error(`TCP connect failed to ${host}:${this.port}`));
          else this.data_queue.close();
          this.socket = null;
        });
        sock.on('error', () => {
          if (!this.connected) reject(new Error(`TCP error connecting to ${host}:${this.port}`));
        });
        sock.on('end', () => {
          if (!this.socket) return;
          this.socket.destroy();
          this.socket = null;
        });
        sock.connect({ host, port: this.port });
      });
    }

    private attachSocketEvents(sock: net.Socket): void {
      sock.on('data', (data) => {
        this.data_queue.put(data);
      });
      sock.on('close', () => {
        this.data_queue.close();
        this.socket = null;
      });
      sock.on('error', () => {
        this.data_queue.close();
      });
      sock.on('end', () => {
        if (!this.socket) return;
        this.socket.destroy();
        this.socket = null;
      });
    }

    async recv(): Promise<Buffer | null> {
      return await this.data_queue.get();
    }

    async send(data: Uint8Array | Buffer): Promise<void> {
      if (!this.socket) return;
      await new Promise<void>((resolve) => {
        this.socket!.write(data, () => resolve());
      });
    }

    async close(): Promise<void> {
      this.data_queue.close();
      if (!this.socket) return;
      try {
        this.socket.end();
      } catch {}
      this.socket = null;
    }

    pause(): void {
      if (!this.socket) return;
      if (this.data_queue.size >= this.data_queue.max_size) {
        this.socket.pause();
        this.paused = true;
      }
    }

    resume(): void {
      if (!this.socket) return;
      if (this.paused) {
        this.socket.resume();
        this.paused = false;
      }
    }
  };
}
