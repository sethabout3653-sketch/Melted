// Cloudflare Worker Wisp v1/v2 Server with SOCKS5 Split-Routing & connect()
// Pairs with client-side @mercuryworkshop/epoxy-transport for Scramjet proxying
//
// Features:
// 1. High-speed Wisp protocol handling over Cloudflare WebSocketPair.
// 2. Strict Domain Split-Routing:
//    - High-security domains (*.google.com, *.youtube.com, *.googlevideo.com, *.gstatic.com, CF-protected)
//      are routed through an upstream SOCKS5 residential proxy to bypass Cloudflare AS13335 bot blocks.
//    - Normal domains exit directly through Cloudflare Workers via connect() for maximum speed & zero proxy bandwidth.
// 3. Application-level heartbeat (35s ping/pong) to bypass Cloudflare 100s idle timeout.
// 4. Message size validation guard (< 32 MiB).

const PACKET_TYPE_CONNECT = 0x01;
const PACKET_TYPE_DATA = 0x02;
const PACKET_TYPE_CONTINUE = 0x03;
const PACKET_TYPE_CLOSE = 0x04;

const CLOSE_REASON_VOLUNTARY = 0x01;
const CLOSE_REASON_NETWORK_ERROR = 0x03;
const CLOSE_REASON_CONN_REFUSED = 0x04;

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

export interface Socks5Config {
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

export function resolveSocks5Pool(env?: any, clientKey = 'default'): Socks5Config[] {
  const urlStr = env?.SOCKS5_URL || env?.RESIDENTIAL_PROXY_URL;
  if (urlStr) {
    const list: Socks5Config[] = [];
    for (const raw of String(urlStr).split(',')) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      try {
        const parsed = new URL(trimmed);
        list.push({
          host: parsed.hostname,
          port: Number(parsed.port || 1080),
          user: parsed.username ? decodeURIComponent(parsed.username) : undefined,
          pass: parsed.password ? decodeURIComponent(parsed.password) : undefined,
        });
      } catch {}
    }
    if (list.length > 0) {
      const start = hashClientKey(clientKey) % list.length;
      return [...list.slice(start), ...list.slice(0, start)];
    }
  }

  if (env?.SOCKS5_HOST) {
    return [
      {
        host: env.SOCKS5_HOST,
        port: Number(env.SOCKS5_PORT || 1080),
        user: env.SOCKS5_USER || undefined,
        pass: env.SOCKS5_PASS || undefined,
      },
    ];
  }

  return [];
}

export function resolveSocks5Config(env?: any, clientKey = 'default'): Socks5Config | null {
  return resolveSocks5Pool(env, clientKey)[0] || null;
}

interface GenericTcpSocket {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  close(): Promise<void> | void;
}

async function openOutboundSocket(hostname: string, port: number): Promise<GenericTcpSocket> {
  // 1. Try Cloudflare Workers native connect() from cloudflare:sockets
  try {
    // @ts-ignore
    const cf = await import('cloudflare:sockets');
    if (cf && typeof cf.connect === 'function') {
      return cf.connect({ hostname, port });
    }
  } catch {}

  // 2. Fallback to Node.js 'net' module when running in Node/development
  try {
    const net = await import('net');
    return await new Promise<GenericTcpSocket>((resolve, reject) => {
      const s = net.createConnection({ host: hostname, port }, () => {
        const readable = new ReadableStream<Uint8Array>({
          start(controller) {
            s.on('data', (chunk) => controller.enqueue(new Uint8Array(chunk)));
            s.on('end', () => controller.close());
            s.on('error', (err) => controller.error(err));
          },
          cancel() {
            s.destroy();
          },
        });

        const writable = new WritableStream<Uint8Array>({
          write(chunk) {
            return new Promise((res, rej) => {
              s.write(chunk, (err) => (err ? rej(err) : res()));
            });
          },
          close() {
            s.end();
          },
          abort() {
            s.destroy();
          },
        });

        resolve({
          readable,
          writable,
          close: () => {
            s.destroy();
          },
        });
      });
      s.on('error', reject);
    });
  } catch (err) {
    throw new Error(`Outbound TCP connect not supported in current runtime: ${err}`);
  }
}

async function performSocks5Handshake(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  targetHost: string,
  targetPort: number,
  auth?: { user?: string; pass?: string }
): Promise<{ leftover: Uint8Array | null }> {
  let buffer = new Uint8Array(0);

  const readExact = async (count: number): Promise<Uint8Array> => {
    while (buffer.length < count) {
      const { done, value } = await reader.read();
      if (done || !value) {
        throw new Error('SOCKS5 connection closed unexpectedly during handshake');
      }
      const next = new Uint8Array(buffer.length + value.length);
      next.set(buffer, 0);
      next.set(value, buffer.length);
      buffer = next;
    }
    const chunk = buffer.subarray(0, count);
    buffer = buffer.subarray(count);
    return chunk;
  };

  // 1. Client greeting: send supported auth methods
  if (auth?.user && auth?.pass) {
    // 0x05 (version 5), 0x02 (2 methods), 0x00 (no auth), 0x02 (username/password)
    await writer.write(new Uint8Array([0x05, 0x02, 0x00, 0x02]));
  } else {
    // 0x05 (version 5), 0x01 (1 method), 0x00 (no auth)
    await writer.write(new Uint8Array([0x05, 0x01, 0x00]));
  }

  // 2. Server selects method: [0x05, method]
  const methodResp = await readExact(2);
  if (methodResp[0] !== 0x05) {
    throw new Error(`Unsupported SOCKS version: ${methodResp[0]}`);
  }

  const selectedMethod = methodResp[1];
  if (selectedMethod === 0x02 && auth?.user && auth?.pass) {
    // Sub-negotiation: Username/Password auth (RFC 1929)
    const userBytes = new TextEncoder().encode(auth.user);
    const passBytes = new TextEncoder().encode(auth.pass);
    const authReq = new Uint8Array(3 + userBytes.length + passBytes.length);
    authReq[0] = 0x01; // auth version 1
    authReq[1] = userBytes.length;
    authReq.set(userBytes, 2);
    authReq[2 + userBytes.length] = passBytes.length;
    authReq.set(passBytes, 3 + userBytes.length);
    await writer.write(authReq);

    const authResp = await readExact(2);
    if (authResp[1] !== 0x00) {
      throw new Error(`SOCKS5 authentication failed (status ${authResp[1]})`);
    }
  } else if (selectedMethod !== 0x00) {
    throw new Error(`SOCKS5 proxy rejected authentication (method ${selectedMethod})`);
  }

  // 3. Send CONNECT request for domain
  // [0x05, 0x01 (CONNECT), 0x00 (RSV), 0x03 (DOMAIN), domainLen, ...domainBytes, portHigh, portLow]
  const hostBytes = new TextEncoder().encode(targetHost);
  const connectReq = new Uint8Array(7 + hostBytes.length);
  connectReq[0] = 0x05;
  connectReq[1] = 0x01; // CMD: CONNECT
  connectReq[2] = 0x00; // RSV
  connectReq[3] = 0x03; // ATYP: Domain
  connectReq[4] = hostBytes.length;
  connectReq.set(hostBytes, 5);
  connectReq[5 + hostBytes.length] = (targetPort >> 8) & 0xff;
  connectReq[6 + hostBytes.length] = targetPort & 0xff;
  await writer.write(connectReq);

  // 4. Read CONNECT response
  // [0x05, REP, RSV, ATYP, ...BND.ADDR, BND.PORT]
  const head = await readExact(4);
  if (head[0] !== 0x05 || head[1] !== 0x00) {
    throw new Error(`SOCKS5 connect request failed with status ${head[1]}`);
  }

  const atyp = head[3];
  if (atyp === 0x01) {
    // IPv4: 4 bytes addr + 2 bytes port
    await readExact(6);
  } else if (atyp === 0x03) {
    // Domain: 1 byte len + domain bytes + 2 bytes port
    const dLen = (await readExact(1))[0];
    await readExact(dLen + 2);
  } else if (atyp === 0x04) {
    // IPv6: 16 bytes addr + 2 bytes port
    await readExact(18);
  }

  return { leftover: buffer.length > 0 ? buffer : null };
}

interface ActiveStream {
  streamId: number;
  socket: GenericTcpSocket;
  writer: WritableStreamDefaultWriter<Uint8Array>;
  reader: ReadableStreamDefaultReader<Uint8Array>;
  closed: boolean;
  packetsSent: number;
}

export async function handleWispRequest(request: Request, env?: any): Promise<Response> {
  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return new Response('Expected WebSocket upgrade for Wisp server', { status: 426 });
  }

  const WebSocketPairCtor = (globalThis as any).WebSocketPair;
  if (!WebSocketPairCtor) {
    return new Response('WebSocketPair not available in this runtime', { status: 501 });
  }

  const pair = new WebSocketPairCtor();
  const [client, server] = [pair[0], pair[1]];
  server.accept();

  const streams = new Map<number, ActiveStream>();
  const clientKey =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('user-agent') ||
    'default';
  const socks5Pool = resolveSocks5Pool(env, clientKey);

  // Send initial stream 0 CONTINUE packet to client so client knows buffer space is open
  const initContinue = new Uint8Array(9);
  initContinue[0] = PACKET_TYPE_CONTINUE;
  new DataView(initContinue.buffer).setUint32(1, 0, true); // stream_id 0
  new DataView(initContinue.buffer).setUint32(5, 128, true); // buffer_remaining 128
  try {
    server.send(initContinue);
  } catch {}

  const sendClose = (streamId: number, reason = CLOSE_REASON_VOLUNTARY) => {
    const closePacket = new Uint8Array(6);
    closePacket[0] = PACKET_TYPE_CLOSE;
    new DataView(closePacket.buffer).setUint32(1, streamId, true);
    closePacket[5] = reason;
    try {
      server.send(closePacket);
    } catch {}
  };

  const closeStream = async (streamId: number, reason?: number) => {
    const stream = streams.get(streamId);
    if (!stream || stream.closed) return;
    stream.closed = true;
    streams.delete(streamId);

    try {
      await stream.writer.close().catch(() => {});
      await stream.reader.cancel().catch(() => {});
      stream.socket.close();
    } catch {}

    if (reason !== undefined) {
      sendClose(streamId, reason);
    }
  };

  // Heartbeat interval to beat Cloudflare's 100-second idle timeout
  const heartbeatInterval = setInterval(() => {
    try {
      server.send(JSON.stringify({ type: 'ping' }));
    } catch {
      clearInterval(heartbeatInterval);
    }
  }, 35000);

  const cleanupAll = () => {
    clearInterval(heartbeatInterval);
    for (const id of Array.from(streams.keys())) {
      void closeStream(id);
    }
  };

  server.addEventListener('close', cleanupAll);
  server.addEventListener('error', cleanupAll);

  server.addEventListener('message', async (event: any) => {
    // 1. Zero-latency intercept for text ping/pong heartbeats
    if (typeof event.data === 'string') {
      const trimmed = event.data.trim();
      if (
        trimmed === '{"type":"ping"}' ||
        trimmed === 'ping' ||
        trimmed === '{"type":"PING"}' ||
        trimmed === '{"type":"pong"}'
      ) {
        if (trimmed.includes('ping')) {
          try {
            server.send('{"type":"pong"}');
          } catch {}
        }
        return;
      }
    }

    // 2. Enforce Cloudflare Workers 32 MiB max message size guard
    const byteLen = event.data?.byteLength || event.data?.length || 0;
    if (byteLen > 32 * 1024 * 1024) {
      try {
        server.close(1009, 'Message exceeds 32 MiB limit');
      } catch {}
      cleanupAll();
      return;
    }

    if (!(event.data instanceof ArrayBuffer) && !ArrayBuffer.isView(event.data)) {
      return;
    }

    const rawBytes =
      event.data instanceof ArrayBuffer
        ? new Uint8Array(event.data)
        : new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength);

    if (rawBytes.length < 5) return;

    const packetType = rawBytes[0];
    const streamId =
      rawBytes[1] | (rawBytes[2] << 8) | (rawBytes[3] << 16) | (rawBytes[4] << 24);

    switch (packetType) {
      case PACKET_TYPE_CONNECT: {
        if (streams.has(streamId)) {
          sendClose(streamId, CLOSE_REASON_NETWORK_ERROR);
          return;
        }

        if (rawBytes.length < 8) {
          sendClose(streamId, CLOSE_REASON_NETWORK_ERROR);
          return;
        }

        const streamType = rawBytes[5]; // 0x01 = TCP, 0x02 = UDP
        const port = rawBytes[6] | (rawBytes[7] << 8);
        const targetHost = new TextDecoder().decode(rawBytes.subarray(8)).trim();

        if (!targetHost || port <= 0 || port > 65535) {
          sendClose(streamId, CLOSE_REASON_NETWORK_ERROR);
          return;
        }

        const isHighSecurity = isHighSecurityDomain(targetHost);
        const shouldUseSocks5 = isHighSecurity && socks5Pool.length > 0;

        (async () => {
          let socket: GenericTcpSocket | null = null;
          let leftover: Uint8Array | null = null;

          try {
            if (shouldUseSocks5) {
              // Upstream sticky SOCKS5 handshake for Google/YouTube/CAPTCHA/CF-protected domains
              for (let attempt = 0; attempt < Math.min(socks5Pool.length, 2); attempt++) {
                const socksCfg = socks5Pool[attempt];
                let candidateSocket: GenericTcpSocket | null = null;
                try {
                  candidateSocket = await openOutboundSocket(socksCfg.host, socksCfg.port);
                  const r = candidateSocket.readable.getReader();
                  const w = candidateSocket.writable.getWriter();
                  try {
                    const res = await performSocks5Handshake(
                      r,
                      w,
                      targetHost,
                      port,
                      socksCfg.user && socksCfg.pass
                        ? { user: socksCfg.user, pass: socksCfg.pass }
                        : undefined
                    );
                    leftover = res.leftover;
                    r.releaseLock();
                    w.releaseLock();
                    socket = candidateSocket;
                    break;
                  } catch (handshakeErr) {
                    try { r.releaseLock(); } catch {}
                    try { w.releaseLock(); } catch {}
                    try { candidateSocket.close(); } catch {}
                  }
                } catch {
                  try { candidateSocket?.close(); } catch {}
                }
              }

              // Fallback to direct connect only if all SOCKS5 attempts failed
              if (!socket) {
                socket = await openOutboundSocket(targetHost, port);
              }
            } else {
              // Direct connect() through Cloudflare Worker for normal fast web traffic
              socket = await openOutboundSocket(targetHost, port);
            }

            const streamWriter = socket.writable.getWriter();
            const streamReader = socket.readable.getReader();

            const active: ActiveStream = {
              streamId,
              socket,
              writer: streamWriter,
              reader: streamReader,
              closed: false,
              packetsSent: 0,
            };
            streams.set(streamId, active);

            // Notify client that connection succeeded with stream CONTINUE packet
            const cont = new Uint8Array(9);
            cont[0] = PACKET_TYPE_CONTINUE;
            new DataView(cont.buffer).setUint32(1, streamId, true);
            new DataView(cont.buffer).setUint32(5, 128, true);
            server.send(cont);

            // Forward any leftover bytes from SOCKS5 handshake buffer
            if (leftover && leftover.length > 0) {
              const dataPacket = new Uint8Array(5 + leftover.length);
              dataPacket[0] = PACKET_TYPE_DATA;
              new DataView(dataPacket.buffer).setUint32(1, streamId, true);
              dataPacket.set(leftover, 5);
              server.send(dataPacket);
            }

            // Pipe socket readable stream to Wisp DATA packets
            (async () => {
              try {
                while (!active.closed) {
                  const { done, value } = await streamReader.read();
                  if (done || !value) break;

                  const dataPacket = new Uint8Array(5 + value.length);
                  dataPacket[0] = PACKET_TYPE_DATA;
                  new DataView(dataPacket.buffer).setUint32(1, streamId, true);
                  dataPacket.set(value, 5);
                  server.send(dataPacket);

                  active.packetsSent++;
                  if (active.packetsSent % 32 === 0) {
                    const contAck = new Uint8Array(9);
                    contAck[0] = PACKET_TYPE_CONTINUE;
                    new DataView(contAck.buffer).setUint32(1, streamId, true);
                    new DataView(contAck.buffer).setUint32(5, 128, true);
                    server.send(contAck);
                  }
                }
              } catch {}
              await closeStream(streamId, CLOSE_REASON_VOLUNTARY);
            })();
          } catch (err) {
            sendClose(streamId, CLOSE_REASON_CONN_REFUSED);
          }
        })();
        break;
      }

      case PACKET_TYPE_DATA: {
        const stream = streams.get(streamId);
        if (!stream || stream.closed) return;
        const payload = rawBytes.subarray(5);
        if (payload.length > 0) {
          try {
            await stream.writer.write(payload);
          } catch {
            await closeStream(streamId, CLOSE_REASON_NETWORK_ERROR);
          }
        }
        break;
      }

      case PACKET_TYPE_CONTINUE: {
        // Client flow control ACK
        break;
      }

      case PACKET_TYPE_CLOSE: {
        await closeStream(streamId);
        break;
      }
    }
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
    headers: {
      'Sec-WebSocket-Protocol': request.headers.get('Sec-WebSocket-Protocol') || 'wisp-v1',
    },
  });
}
