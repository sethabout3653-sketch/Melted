// Cloudflare EPG endpoint (/api/epg/now-next) for both Cloudflare Workers and Cloudflare Pages.
// Combines the pre-enriched /epg-cache.json snapshot with live Edge feeds (Adult Swim + Pluto TV JSON API),
// rolling continuity if the snapshot ages, and accurate ratings for ALL channels.

import {
  EpgProgramme,
  ChannelNowNext,
  EpgChannelMeta,
  normalizeRatingBadge,
  resolveAccurateProgrammeRating,
  buildChannelFallbackSchedule,
} from '../../../src/utils/epgRatingHelpers';

interface EpgSnapshot {
  lastUpdatedAt?: number;
  programs?: Record<string, EpgProgramme[]>;
  tvgIds?: Record<string, string>;
  channelMeta?: Record<string, EpgChannelMeta>;
  tmdbRatings?: Array<[string, string | undefined]>;
}

interface EpgContext {
  request: Request;
  env?: { ASSETS?: { fetch(request: Request): Promise<Response> } };
}

const ADULT_SWIM_SCHEDULE_URL = 'https://www.adultswim.com/api/schedule/marathons/5801264b1bb9661440d5f845';
const EDGE_LIVE_TTL_MS = 15 * 60 * 1000;

let snapshotPromise: Promise<EpgSnapshot> | null = null;
let cachedTmdbMap: Record<string, string | undefined> | null = null;

interface LiveEdgeData {
  fetchedAt: number;
  adultSwim: EpgProgramme[];
  plutoById: Record<string, EpgProgramme[]>;
}

let liveEdgeCache: LiveEdgeData | null = null;
let liveEdgeInFlight: Promise<LiveEdgeData> | null = null;

async function loadSnapshot(context: EpgContext): Promise<EpgSnapshot> {
  if (!snapshotPromise) {
    const assetUrl = new URL('/epg-cache.json', context.request.url);
    const fetcher = context.env?.ASSETS
      ? context.env.ASSETS.fetch(new Request(assetUrl.toString()))
      : fetch(assetUrl.toString());

    snapshotPromise = fetcher
      .then(async (res) => {
        if (!res.ok) return {};
        return (await res.json()) as EpgSnapshot;
      })
      .catch(() => {
        snapshotPromise = null;
        return {};
      });
  }
  return snapshotPromise;
}

async function fetchAdultSwimLive(): Promise<EpgProgramme[]> {
  try {
    const res = await fetch(ADULT_SWIM_SCHEDULE_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return [];
    const json: any = await res.json();
    const out: EpgProgramme[] = [];
    for (const item of Array.isArray(json?.data) ? json.data : []) {
      const start = typeof item.time === 'number' ? Math.round(item.time) : Date.parse(item.startTime || '');
      const durationSec = Number(item.duration) || 0;
      if (!Number.isFinite(start) || durationSec <= 0) continue;
      const series = typeof item.seriesName === 'string' ? item.seriesName.trim() : '';
      const episode = typeof item.name === 'string' ? item.name.trim() : '';
      const title = series && episode ? `${series}: ${episode}` : episode || series;
      if (!title) continue;
      const desc = item.season && item.episodeNumber ? `Season ${item.season}, Episode ${item.episodeNumber}` : undefined;
      out.push({
        title,
        start,
        stop: Math.round(start + durationSec * 1000),
        rating: 'TV-14',
        ...(desc ? { desc } : {}),
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchPlutoLive(): Promise<Record<string, EpgProgramme[]>> {
  const plutoById: Record<string, EpgProgramme[]> = {};
  try {
    const now = Date.now();
    const startIso = new Date(now - 2 * 3600_000).toISOString();
    const stopIso = new Date(now + 6 * 3600_000).toISOString();
    const url = `https://api.pluto.tv/v2/channels?start=${encodeURIComponent(startIso)}&stop=${encodeURIComponent(stopIso)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return plutoById;
    const list: any[] = await res.json();
    if (!Array.isArray(list)) return plutoById;

    for (const ch of list) {
      const chId = String(ch?._id || '').trim();
      if (!chId) continue;
      const timelines = Array.isArray(ch?.timelines) ? ch.timelines : [];
      const progs: EpgProgramme[] = [];
      for (const item of timelines) {
        const start = Date.parse(item?.start || '');
        const stop = Date.parse(item?.stop || '');
        const title = String(item?.title || '').trim();
        if (!Number.isFinite(start) || !Number.isFinite(stop) || stop <= start || !title) continue;
        const ep = item?.episode || {};
        const rawRating = ep?.rating || item?.rating || '';
        const rating = typeof rawRating === 'string' ? normalizeRatingBadge(rawRating) : undefined;
        const desc = typeof ep?.description === 'string' ? ep.description.trim().slice(0, 180) : undefined;
        const category = typeof ep?.genre === 'string' ? ep.genre.trim() : undefined;
        progs.push({
          title,
          start,
          stop,
          ...(desc ? { desc } : {}),
          ...(rating ? { rating } : {}),
          ...(category ? { category } : {}),
        });
      }
      if (progs.length) {
        progs.sort((a, b) => a.start - b.start);
        plutoById[chId] = progs;
      }
    }
  } catch {
    // Non-fatal: snapshot programs & fallbacks continue seamlessly
  }
  return plutoById;
}

async function getLiveEdgeFeeds(): Promise<LiveEdgeData> {
  const now = Date.now();
  if (liveEdgeCache && now - liveEdgeCache.fetchedAt < EDGE_LIVE_TTL_MS) {
    return liveEdgeCache;
  }
  if (!liveEdgeInFlight) {
    liveEdgeInFlight = Promise.all([fetchAdultSwimLive(), fetchPlutoLive()])
      .then(([adultSwim, plutoById]) => {
        const next: LiveEdgeData = {
          fetchedAt: Date.now(),
          adultSwim,
          plutoById,
        };
        if (adultSwim.length > 0 || Object.keys(plutoById).length > 0) {
          liveEdgeCache = next;
        }
        return next;
      })
      .finally(() => {
        liveEdgeInFlight = null;
      });
  }
  return liveEdgeInFlight;
}

function projectExpiredScheduleForward(list: EpgProgramme[], nowMs: number): EpgProgramme[] {
  if (!list.length) return [];
  const firstStart = list[0].start;
  const lastStop = list[list.length - 1].stop;
  const span = Math.max(3600_000, lastStop - firstStart);
  const cycles = Math.floor((nowMs - firstStart) / span);
  if (cycles <= 0) return list;
  const shift = cycles * span;
  return list.map((p) => ({
    ...p,
    start: p.start + shift,
    stop: p.stop + shift,
  }));
}

function nowNextFor(list: EpgProgramme[], nowMs: number): ChannelNowNext {
  const nowIndex = list.findIndex((p) => p.start <= nowMs && nowMs < p.stop);
  if (nowIndex === -1) {
    const next = list.find((p) => p.start > nowMs);
    return next ? { next } : {};
  }
  const now = list[nowIndex];
  const next = list.slice(nowIndex + 1).find((p) => p.start >= now.stop || p.start > nowMs);
  return next ? { now, next } : { now };
}

export async function onRequest(context: EpgContext): Promise<Response> {
  try {
    const [snapshot, liveEdge] = await Promise.all([
      loadSnapshot(context),
      Promise.race([
        getLiveEdgeFeeds(),
        new Promise<LiveEdgeData>((resolve) =>
          setTimeout(
            () =>
              resolve(
                liveEdgeCache || {
                  fetchedAt: 0,
                  adultSwim: [],
                  plutoById: {},
                }
              ),
            2600
          )
        ),
      ]),
    ]);

    if (!cachedTmdbMap && Array.isArray(snapshot.tmdbRatings)) {
      const map: Record<string, string | undefined> = {};
      for (const [k, v] of snapshot.tmdbRatings) {
        map[k] = v;
      }
      cachedTmdbMap = map;
    }

    const tmdbMap = cachedTmdbMap || {};
    const snapshotPrograms = snapshot.programs || {};
    const tvgIds = snapshot.tvgIds || {};
    const channelMeta = snapshot.channelMeta || {};

    const allChannelIds = new Set<string>([
      ...Object.keys(channelMeta),
      ...Object.keys(snapshotPrograms),
      'adult-swim',
    ]);

    const nowMs = Date.now();
    const programs: Record<string, ChannelNowNext> = {};

    for (const id of allChannelIds) {
      const meta: EpgChannelMeta = channelMeta[id] || {
        id,
        name: id,
        category: 'Entertainment',
      };

      let candidateList: EpgProgramme[] | undefined;

      // 1. Live Adult Swim schedule
      if (id === 'adult-swim' && liveEdge.adultSwim.length > 0) {
        const hasLive = liveEdge.adultSwim.some((p) => p.start <= nowMs && nowMs < p.stop);
        if (hasLive) candidateList = liveEdge.adultSwim;
      }

      // 2. Live Pluto API timeline
      if (!candidateList) {
        const plutoId = meta.plutoId || (/^[a-f0-9]{24}$/i.test(tvgIds[id] || '') ? tvgIds[id] : undefined);
        if (plutoId && liveEdge.plutoById[plutoId]?.length) {
          const hasLive = liveEdge.plutoById[plutoId].some((p) => p.start <= nowMs && nowMs < p.stop);
          if (hasLive) candidateList = liveEdge.plutoById[plutoId];
        }
      }

      // 3. Snapshot program list (with rolling projection if snapshot aged beyond 36h)
      if (!candidateList && snapshotPrograms[id]?.length) {
        const snapList = snapshotPrograms[id];
        if (snapList.some((p) => p.stop > nowMs)) {
          candidateList = snapList;
        } else {
          candidateList = projectExpiredScheduleForward(snapList, nowMs);
        }
      }

      // 4. Channel-aware fallback schedule
      const fallbackSchedule = buildChannelFallbackSchedule(meta, nowMs);
      if (!candidateList || !candidateList.some((p) => p.stop > nowMs)) {
        candidateList = fallbackSchedule;
      }

      const rawEntry = nowNextFor(candidateList, nowMs);
      if (!rawEntry.now && rawEntry.next && fallbackSchedule.length > 0) {
        const fbNow = fallbackSchedule.find((p) => p.start <= nowMs && nowMs < p.stop) || fallbackSchedule[0];
        rawEntry.now = { ...fbNow, start: Math.min(fbNow.start, nowMs), stop: rawEntry.next.start };
      }
      if (rawEntry.now && !rawEntry.next && fallbackSchedule.length > 0) {
        const fbNext = fallbackSchedule.find((p) => p.start >= rawEntry.now!.stop) || fallbackSchedule[1] || fallbackSchedule[0];
        rawEntry.next = { ...fbNext, start: rawEntry.now.stop, stop: Math.max(rawEntry.now.stop + 1800_000, fbNext.stop) };
      }
      if (!rawEntry.now && !rawEntry.next && fallbackSchedule.length > 0) {
        rawEntry.now = fallbackSchedule[0];
        rawEntry.next = fallbackSchedule[1] || fallbackSchedule[0];
      }

      const formatProg = (p?: EpgProgramme): EpgProgramme | undefined => {
        if (!p) return undefined;
        const { category: _cat, ...rest } = p;
        return {
          ...rest,
          rating: resolveAccurateProgrammeRating(p, meta, tmdbMap),
        };
      };

      const nowProg = formatProg(rawEntry.now);
      const nextProg = formatProg(rawEntry.next);
      if (nowProg || nextProg) {
        programs[id] = {
          ...(nowProg ? { now: nowProg } : {}),
          ...(nextProg ? { next: nextProg } : {}),
        };
      }
    }

    return new Response(
      JSON.stringify({
        updatedAt: Math.max(snapshot.lastUpdatedAt || 0, liveEdge.fetchedAt || 0) || nowMs,
        programs,
      }),
      {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=30',
        },
      }
    );
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to load EPG guide', programs: {} }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
}
