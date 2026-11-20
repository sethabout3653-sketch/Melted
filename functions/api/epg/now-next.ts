// Cloudflare EPG endpoint (/api/epg/now-next). XMLTV feeds are too large to parse per request on Workers,
// so this serves now/next from the EPG snapshot that the build copies into dist/epg-cache.json.

interface EpgProgramme {
  title: string;
  start: number;
  stop: number;
  desc?: string;
  rating?: string;
  category?: string;
  episode?: string;
}

interface ChannelNowNext {
  now?: EpgProgramme;
  next?: EpgProgramme;
}

interface EpgSnapshot {
  lastUpdatedAt?: number;
  programs?: Record<string, EpgProgramme[]>;
}

interface EpgContext {
  request: Request;
  env: { ASSETS: { fetch(request: Request): Promise<Response> } };
}

let snapshotPromise: Promise<EpgSnapshot> | null = null;

function loadSnapshot(context: EpgContext): Promise<EpgSnapshot> {
  if (!snapshotPromise) {
    snapshotPromise = context.env.ASSETS.fetch(new Request(new URL('/epg-cache.json', context.request.url)))
      .then(async (res) => {
        if (!res.ok) throw new Error(`EPG snapshot unavailable (${res.status})`);
        return (await res.json()) as EpgSnapshot;
      })
      .catch((err) => {
        snapshotPromise = null;
        throw err;
      });
  }
  return snapshotPromise;
}

function nowNextFor(list: EpgProgramme[], nowMs: number): ChannelNowNext {
  const nowIndex = list.findIndex((p) => p.start <= nowMs && nowMs < p.stop);
  if (nowIndex === -1) {
    const next = list.find((p) => p.start > nowMs);
    return next ? { next } : {};
  }
  const now = list[nowIndex];
  const next = list.slice(nowIndex + 1).find((p) => p.start >= now.stop);
  return next ? { now, next } : { now };
}

export async function onRequest(context: EpgContext): Promise<Response> {
  try {
    const snapshot = await loadSnapshot(context);
    const nowMs = Date.now();
    const programs: Record<string, ChannelNowNext> = {};
    for (const [id, list] of Object.entries(snapshot.programs || {})) {
      const entry = nowNextFor(list, nowMs);
      if (entry.now || entry.next) programs[id] = entry;
    }
    return new Response(JSON.stringify({ updatedAt: snapshot.lastUpdatedAt || 0, programs }), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=30',
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to load EPG guide', programs: {} }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
}
