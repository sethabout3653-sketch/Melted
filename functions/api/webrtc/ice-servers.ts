// Cloudflare Pages Function & Worker Route: Dynamic WebRTC ICE/TURN Servers

export interface IceServerEntry {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface IceServerEnv {
  CLOUDFLARE_TURN_TOKEN_ID?: string;
  CLOUDFLARE_TURN_API_TOKEN?: string;
  METERED_TURN_DOMAIN?: string;
  METERED_TURN_API_KEY?: string;
  TURN_URLS?: string;
  VITE_TURN_URLS?: string;
  TURN_USERNAME?: string;
  VITE_TURN_USERNAME?: string;
  TURN_CREDENTIAL?: string;
  VITE_TURN_CREDENTIAL?: string;
}

export const DEFAULT_ICE_SERVERS: IceServerEntry[] = [
  {
    urls: [
      'stun:stun.cloudflare.com:3478',
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
      'stun:stun3.l.google.com:19302',
      'stun:stun.relay.metered.ca:80',
    ],
  },
  {
    urls: [
      'turn:global.relay.metered.ca:80',
      'turn:global.relay.metered.ca:80?transport=tcp',
      'turn:global.relay.metered.ca:443',
      'turn:global.relay.metered.ca:443?transport=tcp',
      'turns:global.relay.metered.ca:443?transport=tcp',
      'turn:standard.relay.metered.ca:80',
      'turn:standard.relay.metered.ca:80?transport=tcp',
      'turn:standard.relay.metered.ca:443',
      'turn:standard.relay.metered.ca:443?transport=tcp',
      'turns:standard.relay.metered.ca:443?transport=tcp',
      'turn:a.relay.metered.ca:80?transport=tcp',
      'turn:a.relay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export async function resolveDynamicIceServers(env: IceServerEnv = {}): Promise<IceServerEntry[]> {
  const servers: IceServerEntry[] = [];

  // 1. Optional Cloudflare Realtime TURN (ephemeral short-lived credentials across global UDP/TCP/TLS 443)
  const cfTokenId = env.CLOUDFLARE_TURN_TOKEN_ID?.trim();
  const cfApiToken = env.CLOUDFLARE_TURN_API_TOKEN?.trim();
  if (cfTokenId && cfApiToken) {
    try {
      const res = await fetch(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(cfTokenId)}/credentials/generate-ice-servers`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ttl: 43200 }),
          signal: AbortSignal.timeout(3500),
        }
      );
      if (res.ok) {
        const data = (await res.json()) as { iceServers?: IceServerEntry[] | IceServerEntry };
        const cfList = Array.isArray(data?.iceServers)
          ? data.iceServers
          : data?.iceServers
            ? [data.iceServers]
            : [];
        for (const entry of cfList) {
          if (entry?.urls) servers.push(entry);
        }
      }
    } catch {
      // Fallback gracefully
    }
  }

  // 2. Optional Metered TURN API (ephemeral credentials)
  const meteredDomain = env.METERED_TURN_DOMAIN?.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const meteredApiKey = env.METERED_TURN_API_KEY?.trim();
  if (meteredDomain && meteredApiKey) {
    try {
      const res = await fetch(
        `https://${meteredDomain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(meteredApiKey)}`,
        { signal: AbortSignal.timeout(3500) }
      );
      if (res.ok) {
        const list = (await res.json()) as IceServerEntry[];
        if (Array.isArray(list)) {
          for (const entry of list) {
            if (entry?.urls) servers.push(entry);
          }
        }
      }
    } catch {
      // Fallback gracefully
    }
  }

  // 3. Optional custom TURN environment variables
  const customUrls = String(env.TURN_URLS || env.VITE_TURN_URLS || '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
  if (customUrls.length > 0) {
    servers.push({
      urls: customUrls,
      username: env.TURN_USERNAME || env.VITE_TURN_USERNAME || '',
      credential: env.TURN_CREDENTIAL || env.VITE_TURN_CREDENTIAL || '',
    });
  }

  // 4. Always include multi-port STUN + live relay fallbacks
  return [...servers, ...DEFAULT_ICE_SERVERS];
}

export async function onRequest(context: { request: Request; env?: IceServerEnv }): Promise<Response> {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  const iceServers = await resolveDynamicIceServers(context.env || {});
  return new Response(
    JSON.stringify({
      iceServers,
      ttl: 600,
    }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    }
  );
}
