import express from 'express';
import zlib from 'zlib';
import { TV_CHANNELS, TVChannel } from '../data/channels';

export interface EpgProgramme {
  title: string;
  start: number;
  stop: number;
  desc?: string;
}

export interface ChannelNowNext {
  now?: EpgProgramme;
  next?: EpgProgramme;
}

type FeedTag = 'custom' | 'pluto' | 'samsung' | 'roku' | 'plex' | 'us' | 'uk' | 'sg';

interface FeedSource {
  tag: FeedTag;
  url: string;
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

// Official Adult Swim 24/7 Rick and Morty marathon schedule API (matches adultswim-vodlive.cdn.turner.com/live/rick-and-morty/stream_de.m3u8)
const ADULT_SWIM_SCHEDULE_URL = 'https://www.adultswim.com/api/schedule/marathons/5801264b1bb9661440d5f845';

// Verified exact XMLTV channel IDs for non-FAST streams whose stream region is known
const EXPLICIT_XMLTV_CHANNEL_IDS: Record<string, string[]> = {
  'cartoon-network': ['Cartoon.Network.(HD).sg', 'Cartoon.Network.sg'],
};

const CATEGORY_TO_COUNTRY: Record<string, string> = {
  uk: 'gb',
  'united kingdom': 'gb',
  canada: 'ca',
  australia: 'au',
  nigeria: 'ng',
  india: 'in',
  germany: 'de',
  france: 'fr',
  spain: 'es',
  italy: 'it',
  brazil: 'br',
  mexico: 'mx',
  japan: 'jp',
  korea: 'kr',
  singapore: 'sg',
};

const REFRESH_TTL_MS = 10 * 60 * 1000; // 10 minutes

let cachedProgramsByChannelId: Record<string, EpgProgramme[]> = {};
let cachedTvgIdMap: Record<string, string> = {};
let lastUpdatedAt = 0;
let activeRefreshPromise: Promise<void> | null = null;

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .trim();
}

function stripCircledSymbols(name: string): string {
  return name.replace(/[\u24B6-\u24E9]/g, '').trim();
}

function hasNonLatinOrAccentedChars(name: string): boolean {
  return /[^\x00-\x7F]/.test(stripCircledSymbols(name));
}

function compactAsciiName(name: string): string {
  return stripCircledSymbols(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

/**
 * Parses XMLTV datetime strings like "20261114113000 +0000" or "20261114113000"
 */
function parseXmltvTime(raw: string): number {
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-])(\d{2})(\d{2}))?/);
  if (!m) return 0;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const min = Number(m[5]);
  const sec = Number(m[6]);
  let utcMs = Date.UTC(year, month, day, hour, min, sec);
  if (m[7]) {
    const sign = m[7] === '-' ? -1 : 1;
    const offMinutes = sign * (Number(m[8]) * 60 + Number(m[9]));
    utcMs -= offMinutes * 60_000;
  }
  return utcMs;
}

function inferChannelCountry(ch: TVChannel): string | undefined {
  const idCountry = ch.id.match(/-([a-z]{2})-[a-z0-9]{4,}$/i)?.[1]?.toLowerCase();
  if (idCountry) {
    return idCountry === 'uk' ? 'gb' : idCountry;
  }
  const catLower = (ch.category || '').toLowerCase();
  if (CATEGORY_TO_COUNTRY[catLower]) {
    return CATEGORY_TO_COUNTRY[catLower];
  }
  if (/\.uk/i.test(ch.id)) return 'gb';
  if (/\.ca/i.test(ch.id)) return 'ca';
  if (/\.au/i.test(ch.id)) return 'au';
  return undefined;
}

function inferXmlChannelCountry(xmlId: string, feedTag: FeedTag): string | undefined {
  if (feedTag === 'uk' || /\.uk$/i.test(xmlId)) return 'gb';
  if (feedTag === 'us' || /\.us2?$/i.test(xmlId)) return 'us';
  if (feedTag === 'sg' || /\.sg$/i.test(xmlId)) return 'sg';
  if (feedTag === 'samsung') {
    const prefix = xmlId.slice(0, 2).toLowerCase();
    if (/^[a-z]{2}$/.test(prefix)) return prefix;
  }
  return undefined;
}

interface ParsedFeed {
  tag: FeedTag;
  channels: Map<string, string[]>; // xmlChannelId -> display names
  programmes: Map<string, EpgProgramme[]>; // xmlChannelId -> programmes within window
}

async function fetchAndParseXmltvFeed(source: FeedSource, windowStart: number, windowEnd: number): Promise<ParsedFeed> {
  const channels = new Map<string, string[]>();
  const programmes = new Map<string, EpgProgramme[]>();

  try {
    const res = await fetch(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Encoding': 'gzip, deflate',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return { tag: source.tag, channels, programmes };
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const isGzip = source.url.endsWith('.gz') || (buf[0] === 0x1f && buf[1] === 0x8b);
    const xml = isGzip ? zlib.gunzipSync(buf).toString('utf8') : buf.toString('utf8');

    // 1. Parse <channel id="..."> blocks
    const chRegex = /<channel\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/channel>/gi;
    let chMatch: RegExpExecArray | null;
    while ((chMatch = chRegex.exec(xml)) !== null) {
      const id = chMatch[1].trim();
      const body = chMatch[2];
      const names: string[] = [];
      const dnRegex = /<display-name\b[^>]*>([^<]+)<\/display-name>/gi;
      let dnMatch: RegExpExecArray | null;
      while ((dnMatch = dnRegex.exec(body)) !== null) {
        const decoded = decodeXmlEntities(dnMatch[1]);
        if (decoded) names.push(decoded);
      }
      if (id) {
        channels.set(id, names);
      }
    }

    // 2. Parse <programme ...> blocks keeping only those within the active Now & Next window
    const progRegex = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi;
    let pMatch: RegExpExecArray | null;
    while ((pMatch = progRegex.exec(xml)) !== null) {
      const attrs = pMatch[1];
      const startM = attrs.match(/\bstart="([^"]+)"/i);
      const stopM = attrs.match(/\bstop="([^"]+)"/i);
      const chM = attrs.match(/\bchannel="([^"]+)"/i);
      if (!startM || !stopM || !chM) continue;

      const start = parseXmltvTime(startM[1]);
      const stop = parseXmltvTime(stopM[1]);
      if (!start || !stop || stop <= windowStart || start >= windowEnd) continue;

      const chId = chM[1].trim();
      const body = pMatch[2];
      const titleM = body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
      if (!titleM) continue;

      const title = decodeXmlEntities(titleM[1].replace(/<[^>]+>/g, ''));
      if (!title) continue;

      const descM = body.match(/<desc\b[^>]*>([\s\S]*?)<\/desc>/i);
      const desc = descM ? decodeXmlEntities(descM[1].replace(/<[^>]+>/g, '')).slice(0, 180) : undefined;

      let list = programmes.get(chId);
      if (!list) {
        list = [];
        programmes.set(chId, list);
      }
      list.push({ title, start, stop, desc });
    }
  } catch (err: any) {
    console.warn(`[EPG] Failed loading XMLTV feed ${source.url}:`, err?.message || err);
  }

  return { tag: source.tag, channels, programmes };
}

async function fetchAdultSwimSchedule(): Promise<EpgProgramme[]> {
  try {
    const res = await fetch(ADULT_SWIM_SCHEDULE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const json: any = await res.json();
    const items: any[] = Array.isArray(json?.data) ? json.data : [];
    const out: EpgProgramme[] = [];
    for (const item of items) {
      const start = typeof item.time === 'number' ? Math.round(item.time) : Date.parse(item.startTime || '');
      const durationSec = Number(item.duration) || 0;
      if (!Number.isFinite(start) || durationSec <= 0) continue;
      const stop = Math.round(start + durationSec * 1000);
      const series = typeof item.seriesName === 'string' ? item.seriesName.trim() : '';
      const ep = typeof item.name === 'string' ? item.name.trim() : '';
      const title = series && ep ? `${series}: ${ep}` : ep || series;
      if (!title) continue;
      const desc =
        item.season && item.episodeNumber ? `Season ${item.season}, Episode ${item.episodeNumber}` : undefined;
      out.push({ title, start, stop, desc });
    }
    return out;
  } catch (err: any) {
    console.warn('[EPG] Failed loading Adult Swim schedule:', err?.message || err);
    return [];
  }
}

interface CandidateEntry {
  xmlId: string;
  feedTag: FeedTag;
  country?: string;
  hasNonAscii: boolean;
}

function dedupeAndSortProgrammes(rawProgs: EpgProgramme[]): EpgProgramme[] {
  const sorted = [...rawProgs].sort((a, b) => a.start - b.start || b.stop - a.stop);
  const deduped: EpgProgramme[] = [];
  const seenStarts = new Set<number>();
  for (const prog of sorted) {
    if (seenStarts.has(prog.start)) continue;
    seenStarts.add(prog.start);
    deduped.push(prog);
  }
  return deduped;
}

function buildChannelScheduleMap(
  feeds: ParsedFeed[],
  adultSwimProgs: EpgProgramme[]
): {
  byChannelId: Record<string, EpgProgramme[]>;
  tvgIds: Record<string, string>;
} {
  const xmlIdByFeedAndLowerId = new Map<FeedTag, Map<string, string>>();
  const xmlIdByLowerIdGlobal = new Map<string, string>();
  const candidatesByCompactName = new Map<string, CandidateEntry[]>();
  const programmesByFeedAndXmlId = new Map<string, EpgProgramme[]>();

  for (const feed of feeds) {
    let idMap = xmlIdByFeedAndLowerId.get(feed.tag);
    if (!idMap) {
      idMap = new Map<string, string>();
      xmlIdByFeedAndLowerId.set(feed.tag, idMap);
    }

    for (const [xmlId, progs] of feed.programmes.entries()) {
      const key = `${feed.tag}::${xmlId}`;
      const existing = programmesByFeedAndXmlId.get(key);
      if (!existing || progs.length > existing.length) {
        programmesByFeedAndXmlId.set(key, progs);
      }
    }

    for (const [xmlId, names] of feed.channels.entries()) {
      const hasProgs = programmesByFeedAndXmlId.has(`${feed.tag}::${xmlId}`);
      if (!hasProgs) continue;

      const lowerId = xmlId.toLowerCase();
      if (!idMap.has(lowerId)) idMap.set(lowerId, xmlId);
      if (!xmlIdByLowerIdGlobal.has(lowerId)) xmlIdByLowerIdGlobal.set(lowerId, xmlId);

      const country = inferXmlChannelCountry(xmlId, feed.tag);
      for (const n of names) {
        const cName = compactAsciiName(n);
        if (!cName) continue;
        let list = candidatesByCompactName.get(cName);
        if (!list) {
          list = [];
          candidatesByCompactName.set(cName, list);
        }
        list.push({
          xmlId,
          feedTag: feed.tag,
          country,
          hasNonAscii: hasNonLatinOrAccentedChars(n),
        });
      }
    }
  }

  const byChannelId: Record<string, EpgProgramme[]> = {};
  const tvgIds: Record<string, string> = {};

  if (adultSwimProgs.length > 0) {
    byChannelId['adult-swim'] = dedupeAndSortProgrammes(adultSwimProgs);
    tvgIds['adult-swim'] = 'AdultSwim.RickAndMorty.marathon';
  }

  for (const ch of TV_CHANNELS) {
    if (ch.id === 'adult-swim' && byChannelId['adult-swim']) {
      continue;
    }

    let matchedFeed: FeedTag | undefined;
    let matchedXmlId: string | undefined;

    // 1. Direct Pluto TV stream ID match (plu-...) strictly from PlutoTV feed
    const pluId = ch.url.match(/plu-([a-f0-9]+)/i)?.[1]?.toLowerCase();
    if (pluId) {
      const candidate = xmlIdByFeedAndLowerId.get('pluto')?.get(pluId);
      if (candidate && programmesByFeedAndXmlId.has(`pluto::${candidate}`)) {
        matchedFeed = 'pluto';
        matchedXmlId = candidate;
      }
    }

    // 2. Direct Samsung TV Plus stream ID match (stvp-...) strictly from SamsungTVPlus feed
    const stvpId = ch.url.match(/stvp-([a-z0-9]+)/i)?.[1]?.toLowerCase();
    if (!matchedXmlId && stvpId) {
      const candidate = xmlIdByFeedAndLowerId.get('samsung')?.get(stvpId);
      if (candidate && programmesByFeedAndXmlId.has(`samsung::${candidate}`)) {
        matchedFeed = 'samsung';
        matchedXmlId = candidate;
      }
    }

    // 3. Verified explicit XMLTV ID overrides (e.g. Cartoon Network Asia feed)
    if (!matchedXmlId && EXPLICIT_XMLTV_CHANNEL_IDS[ch.id]) {
      for (const targetId of EXPLICIT_XMLTV_CHANNEL_IDS[ch.id]) {
        const lowerTarget = targetId.toLowerCase();
        for (const feed of feeds) {
          const candidate = xmlIdByFeedAndLowerId.get(feed.tag)?.get(lowerTarget);
          if (candidate && programmesByFeedAndXmlId.has(`${feed.tag}::${candidate}`)) {
            matchedFeed = feed.tag;
            matchedXmlId = candidate;
            break;
          }
        }
        if (matchedXmlId) break;
      }
    }

    // 4. Direct channel ID match (custom EPG / roku / plex)
    if (!matchedXmlId) {
      const cleanId = ch.id.replace(/^(samsung-|roku-|pluto-|freetv-)/i, '').toLowerCase();
      for (const feed of feeds) {
        const idMap = xmlIdByFeedAndLowerId.get(feed.tag);
        if (!idMap) continue;
        const candidate = idMap.get(ch.id.toLowerCase()) || idMap.get(cleanId);
        if (candidate && programmesByFeedAndXmlId.has(`${feed.tag}::${candidate}`)) {
          matchedFeed = feed.tag;
          matchedXmlId = candidate;
          break;
        }
      }
    }

    // 5. Provider-locked & region-safe exact display-name match (no loose region-stripping!)
    if (!matchedXmlId) {
      const isPlutoChannel = Boolean(pluId || ch.id.startsWith('pluto-'));
      const isSamsungChannel = Boolean(stvpId || ch.id.startsWith('samsung-'));
      const isRokuChannel = ch.id.startsWith('roku-') || /roku\.wurl\.tv/i.test(ch.url);
      const isPlexChannel = ch.id.startsWith('plex-') || /plex\.tv/i.test(ch.url);
      const channelCountry = inferChannelCountry(ch);
      const channelHasNonAscii = hasNonLatinOrAccentedChars(ch.name);

      const cName = compactAsciiName(ch.name);
      if (cName.length >= 3) {
        const candidates = candidatesByCompactName.get(cName) || [];
        const picked = candidates.find((cand) => {
          // Never match a Korean/non-Latin display name onto a pure-ASCII channel name
          if (!channelHasNonAscii && cand.hasNonAscii) return false;

          // Lock FAST channels strictly to their own provider's guide
          if (isPlutoChannel && cand.feedTag !== 'pluto') return false;
          if (isSamsungChannel && cand.feedTag !== 'samsung') return false;
          if (isRokuChannel && cand.feedTag !== 'roku') return false;
          if (isPlexChannel && cand.feedTag !== 'plex') return false;

          // Enforce regional compatibility
          if (channelCountry) {
            if (cand.country && cand.country !== channelCountry) return false;
            if (!cand.country && channelCountry !== 'us' && cand.feedTag === 'us') return false;
          } else {
            // Unprefixed English channels (e.g. PBS Kids, QVC 2, Comedy Dynamics) must not match non-US regional feeds
            if (cand.country && cand.country !== 'us' && cand.country !== 'ca') return false;
            if (cand.feedTag === 'uk' || cand.feedTag === 'sg') return false;
          }

          return true;
        });

        if (picked) {
          matchedFeed = picked.feedTag;
          matchedXmlId = picked.xmlId;
        }
      }
    }

    if (matchedXmlId && matchedFeed) {
      tvgIds[ch.id] = matchedXmlId;
      const rawProgs = programmesByFeedAndXmlId.get(`${matchedFeed}::${matchedXmlId}`) || [];
      if (rawProgs.length > 0) {
        byChannelId[ch.id] = dedupeAndSortProgrammes(rawProgs);
      }
    }
  }

  return { byChannelId, tvgIds };
}

export async function refreshEpgCache(customUrls?: string[], force = false): Promise<void> {
  if (!force && lastUpdatedAt > 0 && Date.now() - lastUpdatedAt < REFRESH_TTL_MS && !customUrls?.length) {
    return;
  }
  if (activeRefreshPromise && !customUrls?.length) {
    return activeRefreshPromise;
  }

  const run = async () => {
    const now = Date.now();
    const windowStart = now - 5 * 60_000;
    const windowEnd = now + 8 * 3600_000;
    const sources: FeedSource[] = [
      ...(customUrls || []).map((url) => ({ tag: 'custom' as FeedTag, url })),
      ...DEFAULT_XMLTV_FEEDS,
    ];
    const [parsedFeeds, adultSwimProgs] = await Promise.all([
      Promise.all(sources.map((s) => fetchAndParseXmltvFeed(s, windowStart, windowEnd))),
      fetchAdultSwimSchedule(),
    ]);
    const { byChannelId, tvgIds } = buildChannelScheduleMap(parsedFeeds, adultSwimProgs);

    if (Object.keys(byChannelId).length > 0) {
      cachedProgramsByChannelId = byChannelId;
      cachedTvgIdMap = tvgIds;
      lastUpdatedAt = Date.now();
      console.log(`📺 [EPG] Loaded live Now & Next guide for ${Object.keys(byChannelId).length} channels`);
    }
  };

  if (!customUrls?.length) {
    activeRefreshPromise = run().finally(() => {
      activeRefreshPromise = null;
    });
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
      const p = list[i];
      if (p.start <= nowMs && p.stop > nowMs) {
        nowProg = p;
        for (let j = i + 1; j < list.length; j++) {
          const candidate = list[j];
          if (candidate.start > p.start && candidate.stop > p.stop) {
            nextProg = candidate;
            break;
          }
        }
        break;
      }
      if (p.start > nowMs) {
        nextProg = p;
        break;
      }
    }

    if (nowProg || nextProg) {
      programs[channelId] = {
        ...(nowProg ? { now: nowProg } : {}),
        ...(nextProg ? { next: nextProg } : {}),
      };
    }
  }

  return {
    updatedAt: lastUpdatedAt,
    programs,
  };
}

export function getMappedTvgId(channel: TVChannel): string {
  return cachedTvgIdMap[channel.id] || channel.id;
}

export function initEpgRoutes(app: express.Express) {
  // Background warm-up shortly after server boot so startup stays instant
  setTimeout(() => {
    refreshEpgCache().catch(() => {});
  }, 1500);

  app.get('/api/epg/now-next', async (req, res) => {
    try {
      const customUrl = typeof req.query.epgUrl === 'string' ? req.query.epgUrl.trim() : '';
      if (customUrl) {
        await refreshEpgCache([customUrl], true);
      } else if (lastUpdatedAt === 0 || Date.now() - lastUpdatedAt >= REFRESH_TTL_MS) {
        if (lastUpdatedAt === 0) {
          await Promise.race([
            refreshEpgCache(),
            new Promise((resolve) => setTimeout(resolve, 6500)),
          ]);
        } else {
          refreshEpgCache().catch(() => {});
        }
      }

      const snapshot = getNowNextSnapshot();
      res.setHeader('Cache-Control', 'public, max-age=30');
      res.json(snapshot);
    } catch (err: any) {
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
