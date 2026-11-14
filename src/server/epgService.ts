import express from 'express';
import zlib from 'zlib';
import { TV_CHANNELS, TVChannel } from '../data/channels';

export interface EpgProgramme {
  title: string;
  start: number;
  stop: number;
  desc?: string;
  rating?: string;
}

export interface ChannelNowNext {
  now?: EpgProgramme;
  next?: EpgProgramme;
}

type FeedTag = 'custom' | 'pluto' | 'samsung' | 'roku' | 'plex' | 'us' | 'uk' | 'sg';

interface FeedSource {
  tag: FeedTag;
  url: string;
  fallbacks?: string[];
}

interface ParsedFeed {
  tag: FeedTag;
  channels: Map<string, string[]>;
  programmes: Map<string, EpgProgramme[]>;
}

interface CandidateEntry {
  xmlId: string;
  feedTag: FeedTag;
  country?: string;
  names: string[];
}

const DEFAULT_XMLTV_FEEDS: FeedSource[] = [
  { tag: 'pluto', url: 'https://i.mjh.nz/PlutoTV/all.xml.gz' },
  { tag: 'samsung', url: 'https://i.mjh.nz/SamsungTVPlus/all.xml.gz' },
  { tag: 'roku', url: 'https://i.mjh.nz/Roku/all.xml.gz' },
  { tag: 'plex', url: 'https://i.mjh.nz/Plex/all.xml.gz' },
  { tag: 'us', url: 'https://epgshare01.online/epgshare01/epg_ripper_US2.xml.gz' },
  { tag: 'uk', url: 'https://epgshare01.online/epgshare01/epg_ripper_UK1.xml.gz' },
  { tag: 'sg', url: 'https://epgshare01.online/epgshare01/epg_ripper_SG1.xml.gz' },
];

const ADULT_SWIM_SCHEDULE_URL = 'https://www.adultswim.com/api/schedule/marathons/5801264b1bb9661440d5f845';
const EXPLICIT_XMLTV_CHANNEL_IDS: Record<string, string[]> = {
  'cartoon-network': ['Cartoon.Network.(HD).sg', 'Cartoon.Network.sg', 'CartoonNetwork.us'],
  'pbs-mpt-baltimore': ['PBS.us', 'MPT.us', 'WMPB.us'],
};

const REFRESH_TTL_MS = 10 * 60 * 1000;
const MAX_CONCURRENT_FEEDS = 3;
let cachedProgramsByChannelId: Record<string, EpgProgramme[]> = {};
let cachedTvgIdMap: Record<string, string> = {};
let lastUpdatedAt = 0;
let activeRefreshPromise: Promise<void> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num))).trim();
}

function stripCircledSymbols(name: string): string {
  return name.replace(/[\u24B6-\u24E9]/g, '').trim();
}

function normalizeChannelName(name: string): string {
  return stripCircledSymbols(name)
    .toLowerCase()
    .replace(/\b(hd|fhd|uhd|tv|channel|us|uk|sg|east|west)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function parseXmltvTime(raw: string): number {
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-])(\d{2})(\d{2}))?/);
  if (!m) return 0;
  const utcMs = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
  if (!m[7]) return utcMs;
  const offsetMinutes = (m[7] === '-' ? -1 : 1) * (Number(m[8]) * 60 + Number(m[9]));
  return utcMs - offsetMinutes * 60_000;
}

function parseTvRating(programmeBody: string): string | undefined {
  const matches = [...programmeBody.matchAll(/<rating\b[^>]*>([\s\S]*?)<\/rating>/gi)];
  for (const match of matches) {
    const value = match[1].match(/<value\b[^>]*>([\s\S]*?)<\/value>/i)?.[1];
    if (!value) continue;
    const rating = decodeXmlEntities(value.replace(/<[^>]+>/g, '')).trim().toUpperCase().replace(/\s+/g, '');
    if (rating) return rating;
  }
  return undefined;
}

async function fetchBufferWithRetry(url: string, timeoutMs: number, retries = 2): Promise<Buffer> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'application/xml,text/xml,application/gzip,application/octet-stream,*/*;q=0.8',
          'Cache-Control': 'no-cache',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastError = err;
      if (attempt < retries) await sleep(750 * (attempt + 1));
    }
  }
  throw lastError;
}

async function fetchAndParseXmltvFeed(source: FeedSource, windowStart: number, windowEnd: number): Promise<ParsedFeed> {
  const channels = new Map<string, string[]>();
  const programmes = new Map<string, EpgProgramme[]>();
  const urlsToTry = [source.url, ...(source.fallbacks || [])];

  for (const targetUrl of urlsToTry) {
    try {
      const buf = await fetchBufferWithRetry(targetUrl, 40000, 2);
      const isGzip = buf[0] === 0x1f && buf[1] === 0x8b;
      const xml = isGzip ? zlib.gunzipSync(buf).toString('utf8') : buf.toString('utf8');

      const chRegex = /<channel\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/channel>/gi;
      let chMatch: RegExpExecArray | null;
      while ((chMatch = chRegex.exec(xml)) !== null) {
        const names: string[] = [];
        const nameRegex = /<display-name\b[^>]*>([\s\S]*?)<\/display-name>/gi;
        let nameMatch: RegExpExecArray | null;
        while ((nameMatch = nameRegex.exec(chMatch[2])) !== null) {
          const name = decodeXmlEntities(nameMatch[1].replace(/<[^>]+>/g, ''));
          if (name) names.push(name);
        }
        channels.set(chMatch[1].trim(), names);
      }

      const progRegex = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi;
      let progMatch: RegExpExecArray | null;
      while ((progMatch = progRegex.exec(xml)) !== null) {
        const attrs = progMatch[1];
        const startRaw = attrs.match(/\bstart="([^"]+)"/i)?.[1];
        const stopRaw = attrs.match(/\bstop="([^"]+)"/i)?.[1];
        const channelId = attrs.match(/\bchannel="([^"]+)"/i)?.[1]?.trim();
        if (!startRaw || !stopRaw || !channelId) continue;
        const start = parseXmltvTime(startRaw);
        const stop = parseXmltvTime(stopRaw);
        if (!start || !stop || stop <= start || stop <= windowStart || start >= windowEnd) continue;
        const body = progMatch[2];
        const titleRaw = body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
        const title = titleRaw ? decodeXmlEntities(titleRaw.replace(/<[^>]+>/g, '')) : '';
        if (!title) continue;
        const descRaw = body.match(/<desc\b[^>]*>([\s\S]*?)<\/desc>/i)?.[1];
        const desc = descRaw ? decodeXmlEntities(descRaw.replace(/<[^>]+>/g, '')).slice(0, 180) : undefined;
        const rating = parseTvRating(body);
        
        const list = programmes.get(channelId) || [];
        list.push({ title, start, stop, ...(desc ? { desc } : {}), ...(rating ? { rating } : {}) });
        programmes.set(channelId, list);
      }

      if (programmes.size > 0) return { tag: source.tag, channels, programmes };
    } catch (err: any) {
      console.warn(`[EPG] Failed loading XMLTV feed ${targetUrl}: ${err?.message || err}`);
    }
  }
  return { tag: source.tag, channels, programmes };
}

async function fetchFeedsWithConcurrency(sources: FeedSource[], windowStart: number, windowEnd: number, concurrency = MAX_CONCURRENT_FEEDS): Promise<ParsedFeed[]> {
  const results: ParsedFeed[] = new Array(sources.length);
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= sources.length) break;
      results[idx] = await fetchAndParseXmltvFeed(sources[idx], windowStart, windowEnd);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, sources.length) }, () => worker()));
  return results;
}

async function fetchAdultSwimSchedule(): Promise<EpgProgramme[]> {
  try {
    const buf = await fetchBufferWithRetry(ADULT_SWIM_SCHEDULE_URL, 15000, 1);
    const json: any = JSON.parse(buf.toString('utf8'));
    const out: EpgProgramme[] = [];
    for (const item of (Array.isArray(json?.data) ? json.data : [])) {
      const start = typeof item.time === 'number' ? Math.round(item.time) : Date.parse(item.startTime || '');
      const durationSec = Number(item.duration) || 0;
      if (!Number.isFinite(start) || durationSec <= 0) continue;
      const series = typeof item.seriesName === 'string' ? item.seriesName.trim() : '';
      const episode = typeof item.name === 'string' ? item.name.trim() : '';
      const title = series && episode ? `${series}: ${episode}` : episode || series;
      if (!title) continue;
      const desc = item.season && item.episodeNumber ? `Season ${item.season}, Episode ${item.episodeNumber}` : undefined;
      out.push({ title, start, stop: Math.round(start + durationSec * 1000), ...(desc ? { desc } : {}) });
    }
    return out;
  } catch {
    return [];
  }
}

function dedupeAndSortProgrammes(rawProgs: EpgProgramme[]): EpgProgramme[] {
  const sorted = [...rawProgs].sort((a, b) => a.start - b.start || b.stop - a.stop);
  const seen = new Set<number>();
  return sorted.filter((p) => {
    if (seen.has(p.start)) return false;
    seen.add(p.start);
    return true;
  });
}

function buildChannelScheduleMap(feeds: ParsedFeed[], adultSwimProgs: EpgProgramme[]) {
  const programmesByFeedAndXmlId = new Map<string, EpgProgramme[]>();
  const globalCandidates: CandidateEntry[] = [];

  for (const feed of feeds) {
    if (!feed) continue;
    for (const [xmlId, progs] of feed.programmes) {
      programmesByFeedAndXmlId.set(`${feed.tag}::${xmlId}`, progs);
    }
    for (const [xmlId, names] of feed.channels) {
      if (!feed.programmes.has(xmlId)) continue;
      globalCandidates.push({ xmlId, feedTag: feed.tag, names });
    }
  }

  const byChannelId: Record<string, EpgProgramme[]> = {};
  const tvgIds: Record<string, string> = {};

  if (adultSwimProgs.length) {
    byChannelId['adult-swim'] = dedupeAndSortProgrammes(adultSwimProgs);
    tvgIds['adult-swim'] = 'AdultSwim.RickAndMorty.marathon';
  }

  for (const ch of TV_CHANNELS) {
    if (ch.id === 'adult-swim' && byChannelId['adult-swim']) continue;
    
    let matchedFeed: FeedTag | undefined;
    let matchedXmlId: string | undefined;

    // 1. Try exact or explicit ID mappings first
    const explicitList = EXPLICIT_XMLTV_CHANNEL_IDS[ch.id] || [];
    for (const targetId of [ch.id, ...explicitList]) {
      for (const feed of feeds) {
        if (!feed) continue;
        if (feed.programmes.has(targetId)) {
          matchedFeed = feed.tag;
          matchedXmlId = targetId;
          break;
        }
      }
      if (matchedXmlId) break;
    }

    // 2. Exact normalized display-name match across all feeds
    if (!matchedXmlId) {
      const targetNormalized = normalizeChannelName(ch.name);
      if (targetNormalized) {
        for (const candidate of globalCandidates) {
          if (candidate.names.some(n => normalizeChannelName(n) === targetNormalized)) {
            matchedFeed = candidate.feedTag;
            matchedXmlId = candidate.xmlId;
            break;
          }
        }
      }
    }

    if (matchedXmlId && matchedFeed) {
      tvgIds[ch.id] = matchedXmlId;
      const rawPrograms = programmesByFeedAndXmlId.get(`${matchedFeed}::${matchedXmlId}`) || [];
      if (rawPrograms.length) {
        byChannelId[ch.id] = dedupeAndSortProgrammes(rawPrograms);
      }
    }
  }

  return { byChannelId, tvgIds };
}

export async function refreshEpgCache(customUrls?: string[], force = false): Promise<void> {
  if (!force && lastUpdatedAt > 0 && Date.now() - lastUpdatedAt < REFRESH_TTL_MS && !customUrls?.length) return;
  if (activeRefreshPromise && !customUrls?.length) return activeRefreshPromise;

  const run = async () => {
    const now = Date.now();
    const windowStart = now - 10 * 60_000;
    const windowEnd = now + 12 * 3600_000;
    const sources: FeedSource[] = [
      ...(customUrls || []).map((url) => ({ tag: 'custom' as FeedTag, url })),
      ...DEFAULT_XMLTV_FEEDS,
    ];
    const [parsedFeeds, adultSwimProgs] = await Promise.all([
      fetchFeedsWithConcurrency(sources, windowStart, windowEnd, MAX_CONCURRENT_FEEDS),
      fetchAdultSwimSchedule(),
    ]);
    const { byChannelId, tvgIds } = buildChannelScheduleMap(parsedFeeds, adultSwimProgs);
    if (Object.keys(byChannelId).length) {
      cachedProgramsByChannelId = { ...cachedProgramsByChannelId, ...byChannelId };
      cachedTvgIdMap = { ...cachedTvgIdMap, ...tvgIds };
      lastUpdatedAt = Date.now();
      console.log(`📺 [EPG] Successfully mapped guide and ratings for ${Object.keys(cachedProgramsByChannelId).length} channels`);
    }
  };

  if (!customUrls?.length) {
    activeRefreshPromise = run().finally(() => { activeRefreshPromise = null; });
    return activeRefreshPromise;
  }
  return run();
}

export function getNowNextSnapshot(nowMs: number = Date.now()): {
  updatedAt: number;
  programs: Record<string, ChannelNowNext>;
} {
  const programs: Record<string, ChannelNowNext> = {};
  for (const [channelId, list] of Object.entries(cachedProgramsByChannelId)) {
    let nowProg: EpgProgramme | undefined;
    let nextProg: EpgProgramme | undefined;
    for (let i = 0; i < list.length; i++) {
      const programme = list[i];
      if (programme.start <= nowMs && programme.stop > nowMs) {
        nowProg = programme;
        for (let j = i + 1; j < list.length; j++) {
          const candidate = list[j];
          if (candidate.start >= nowProg.stop || candidate.start > nowMs) {
            nextProg = candidate;
            break;
          }
        }
        break;
      }
      if (programme.start > nowMs) {
        nextProg = programme;
        break;
      }
    }
    if (nowProg || nextProg) {
      programs[channelId] = { ...(nowProg ? { now: nowProg } : {}), ...(nextProg ? { next: nextProg } : {}) };
    }
  }
  return { updatedAt: lastUpdatedAt, programs };
}

export function getMappedTvgId(channel: TVChannel): string {
  return cachedTvgIdMap[channel.id] || channel.id;
}

export function initEpgRoutes(app: express.Express) {
  refreshEpgCache().catch(() => {});
  app.get('/api/epg/now-next', async (req, res) => {
    try {
      const customUrl = typeof req.query.epgUrl === 'string' ? req.query.epgUrl.trim() : '';
      if (customUrl) {
        await refreshEpgCache([customUrl], true);
      } else if (lastUpdatedAt === 0 || Date.now() - lastUpdatedAt >= REFRESH_TTL_MS) {
        if (lastUpdatedAt === 0) {
          await Promise.race([refreshEpgCache(), new Promise((resolve) => setTimeout(resolve, 25000))]);
        } else {
          refreshEpgCache().catch(() => {});
        }
      }
      res.setHeader('Cache-Control', 'public, max-age=30');
      res.json(getNowNextSnapshot());
    } catch {
      res.status(500).json({ error: 'Failed to load EPG guide', programs: {} });
    }
  });

  app.post('/api/epg/refresh', async (req, res) => {
    try {
      const epgUrl = typeof req.body?.epgUrl === 'string' ? req.body.epgUrl.trim() : '';
      await refreshEpgCache(epgUrl ? [epgUrl] : undefined, true);
      res.json(getNowNextSnapshot());
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'EPG refresh failed' });
    }
  });
}
