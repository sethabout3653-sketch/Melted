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

interface ParsedFeed {
  tag: FeedTag;
  channels: Map<string, string[]>;
  programmes: Map<string, EpgProgramme[]>;
}

interface CandidateEntry {
  xmlId: string;
  feedTag: FeedTag;
  country?: string;
  hasNonAscii: boolean;
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
  'cartoon-network': ['Cartoon.Network.(HD).sg', 'Cartoon.Network.sg'],
};

const CATEGORY_TO_COUNTRY: Record<string, string> = {
  uk: 'gb', 'united kingdom': 'gb', canada: 'ca', australia: 'au', nigeria: 'ng', india: 'in',
  germany: 'de', france: 'fr', spain: 'es', italy: 'it', brazil: 'br', mexico: 'mx', japan: 'jp',
  korea: 'kr', singapore: 'sg',
};

const REFRESH_TTL_MS = 10 * 60 * 1000;
let cachedProgramsByChannelId: Record<string, EpgProgramme[]> = {};
let cachedTvgIdMap: Record<string, string> = {};
let lastUpdatedAt = 0;
let activeRefreshPromise: Promise<void> | null = null;

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num))).trim();
}

function stripCircledSymbols(name: string): string {
  return name.replace(/[\u24B6-\u24E9]/g, '').trim();
}

function hasNonLatinOrAccentedChars(name: string): boolean {
  return /[^\x00-\x7F]/.test(stripCircledSymbols(name));
}

function compactAsciiName(name: string): string {
  return stripCircledSymbols(name).toLowerCase().replace(/[^a-z0-9]+/g, '').trim();
}

function parseXmltvTime(raw: string): number {
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-])(\d{2})(\d{2}))?/);
  if (!m) return 0;
  const utcMs = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
  if (!m[7]) return utcMs;
  const offsetMinutes = (m[7] === '-' ? -1 : 1) * (Number(m[8]) * 60 + Number(m[9]));
  return utcMs - offsetMinutes * 60_000;
}

function inferChannelCountry(ch: TVChannel): string | undefined {
  const idCountry = ch.id.match(/-([a-z]{2})-[a-z0-9]{4,}$/i)?.[1]?.toLowerCase();
  if (idCountry) return idCountry === 'uk' ? 'gb' : idCountry;
  const category = (ch.category || '').toLowerCase();
  if (CATEGORY_TO_COUNTRY[category]) return CATEGORY_TO_COUNTRY[category];
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

async function fetchAndParseXmltvFeed(source: FeedSource, windowStart: number, windowEnd: number): Promise<ParsedFeed> {
  const channels = new Map<string, string[]>();
  const programmes = new Map<string, EpgProgramme[]>();
  try {
    const res = await fetch(source.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { tag: source.tag, channels, programmes };

    const buf = Buffer.from(await res.arrayBuffer());
    // Fetch implementations may transparently decompress HTTP gzip responses, so
    // inspect the payload rather than assuming every .gz URL is still compressed.
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
      // XMLTV content ratings are usually provided as <rating><value>TV-PG</value></rating>.
      // Add supported US TV ratings to the displayed programme title so both Now and Next
      // show the rating without requiring a separate client-side data path.
      const rawRating = body.match(/<rating\b[^>]*>\s*<value\b[^>]*>([\s\S]*?)<\/value>/i)?.[1];
      const ratingValue = rawRating ? decodeXmlEntities(rawRating.replace(/<[^>]+>/g, '')).toUpperCase().replace(/\s+/g, '') : '';
      const rating = /^(TV-Y|TV-Y7|TV-G|TV-PG|TV-14|TV-MA)$/.test(ratingValue) ? ratingValue : undefined;
      const displayTitle = rating ? `${title} (${rating})` : title;
      const list = programmes.get(channelId) || [];
      list.push({ title: displayTitle, start, stop, ...(desc ? { desc } : {}) });
      programmes.set(channelId, list);
    }
  } catch (err: any) {
    console.warn(`[EPG] Failed loading XMLTV feed ${source.url}:`, err?.message || err);
  }
  return { tag: source.tag, channels, programmes };
}

async function fetchAdultSwimSchedule(): Promise<EpgProgramme[]> {
  try {
    const res = await fetch(ADULT_SWIM_SCHEDULE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const json: any = await res.json();
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
  } catch (err: any) {
    console.warn('[EPG] Failed loading Adult Swim schedule:', err?.message || err);
    return [];
  }
}

function dedupeAndSortProgrammes(rawProgs: EpgProgramme[]): EpgProgramme[] {
  const sorted = [...rawProgs].sort((a, b) => a.start - b.start || b.stop - a.stop);
  const seen = new Set<number>();
  return sorted.filter((programme) => {
    if (seen.has(programme.start)) return false;
    seen.add(programme.start);
    return true;
  });
}

/** Resolve a provider ID even when XMLTV decorates it with a provider/region prefix or suffix. */
function findProviderXmlId(idMap: Map<string, string> | undefined, providerId: string): string | undefined {
  if (!idMap) return undefined;
  const exact = idMap.get(providerId.toLowerCase());
  if (exact) return exact;
  const matches = [...idMap.entries()].filter(([xmlId]) =>
    new RegExp(`(?:^|[^a-f0-9])${providerId}(?:$|[^a-f0-9])`, 'i').test(xmlId)
  );
  // Embedded IDs are safe only when they identify exactly one XMLTV channel.
  return matches.length === 1 ? matches[0][1] : undefined;
}

function buildChannelScheduleMap(feeds: ParsedFeed[], adultSwimProgs: EpgProgramme[]) {
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
    for (const [xmlId, progs] of feed.programmes) {
      const key = `${feed.tag}::${xmlId}`;
      const existing = programmesByFeedAndXmlId.get(key);
      if (!existing || progs.length > existing.length) programmesByFeedAndXmlId.set(key, progs);
    }
    for (const [xmlId, names] of feed.channels) {
      if (!programmesByFeedAndXmlId.has(`${feed.tag}::${xmlId}`)) continue;
      const lowerId = xmlId.toLowerCase();
      if (!idMap.has(lowerId)) idMap.set(lowerId, xmlId);
      if (!xmlIdByLowerIdGlobal.has(lowerId)) xmlIdByLowerIdGlobal.set(lowerId, xmlId);
      const country = inferXmlChannelCountry(xmlId, feed.tag);
      for (const name of names) {
        const compactName = compactAsciiName(name);
        if (!compactName) continue;
        const list = candidatesByCompactName.get(compactName) || [];
        list.push({ xmlId, feedTag: feed.tag, country, hasNonAscii: hasNonLatinOrAccentedChars(name) });
        candidatesByCompactName.set(compactName, list);
      }
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

    // Provider stream IDs are stronger evidence than channel-name similarity. Some XMLTV
    // feeds decorate IDs with prefixes/suffixes, so also accept one unique embedded ID.
    const providerIds: Array<{ tag: FeedTag; id: string }> = [
      { tag: 'pluto', id: ch.url.match(/plu-([a-f0-9]+)/i)?.[1]?.toLowerCase() || '' },
      { tag: 'samsung', id: ch.url.match(/stvp-([a-z0-9]+)/i)?.[1]?.toLowerCase() || '' },
      { tag: 'roku', id: ch.url.match(/rok-([a-f0-9]+)/i)?.[1]?.toLowerCase() || '' },
    ];
    for (const provider of providerIds) {
      if (!provider.id) continue;
      const candidate = findProviderXmlId(xmlIdByFeedAndLowerId.get(provider.tag), provider.id);
      if (candidate && programmesByFeedAndXmlId.has(`${provider.tag}::${candidate}`)) {
        matchedFeed = provider.tag;
        matchedXmlId = candidate;
        break;
      }
    }

    if (!matchedXmlId && EXPLICIT_XMLTV_CHANNEL_IDS[ch.id]) {
      for (const targetId of EXPLICIT_XMLTV_CHANNEL_IDS[ch.id]) {
        const target = targetId.toLowerCase();
        for (const feed of feeds) {
          const candidate = xmlIdByFeedAndLowerId.get(feed.tag)?.get(target);
          if (candidate && programmesByFeedAndXmlId.has(`${feed.tag}::${candidate}`)) {
            matchedFeed = feed.tag;
            matchedXmlId = candidate;
            break;
          }
        }
        if (matchedXmlId) break;
      }
    }

    // Exact channel-ID matching is also useful for imported/custom playlists.
    if (!matchedXmlId) {
      const cleanId = ch.id.replace(/^(samsung-|roku-|pluto-|freetv-)/i, '').toLowerCase();
      for (const feed of feeds) {
        const idMap = xmlIdByFeedAndLowerId.get(feed.tag);
        const candidate = idMap?.get(ch.id.toLowerCase()) || idMap?.get(cleanId);
        if (candidate && programmesByFeedAndXmlId.has(`${feed.tag}::${candidate}`)) {
          matchedFeed = feed.tag;
          matchedXmlId = candidate;
          break;
        }
      }
    }

    if (!matchedXmlId) {
      const isPluto = Boolean(providerIds[0].id || ch.id.startsWith('pluto-'));
      const isSamsung = Boolean(providerIds[1].id || ch.id.startsWith('samsung-'));
      const isRoku = ch.id.startsWith('roku-') || /roku\.wurl\.tv/i.test(ch.url);
      const isPlex = ch.id.startsWith('plex-') || /plex\.tv/i.test(ch.url);
      const channelCountry = inferChannelCountry(ch);
      const channelHasNonAscii = hasNonLatinOrAccentedChars(ch.name);
      const compactName = compactAsciiName(ch.name);
      if (compactName.length >= 3) {
        const eligible = (candidatesByCompactName.get(compactName) || []).filter((candidate) => {
          if (!channelHasNonAscii && candidate.hasNonAscii) return false;
          if (isPluto && candidate.feedTag !== 'pluto') return false;
          if (isSamsung && candidate.feedTag !== 'samsung') return false;
          if (isRoku && candidate.feedTag !== 'roku') return false;
          if (isPlex && candidate.feedTag !== 'plex') return false;
          if (channelCountry) {
            if (candidate.country && candidate.country !== channelCountry) return false;
            if (!candidate.country && channelCountry !== 'us' && candidate.feedTag === 'us') return false;
          } else {
            if (candidate.country && candidate.country !== 'us' && candidate.country !== 'ca') return false;
            if (candidate.feedTag === 'uk' || candidate.feedTag === 'sg') return false;
          }
          return true;
        });
        // Duplicate names (for example local stations or similarly named FAST channels) are
        // ambiguous. Do not display a potentially incorrect guide just to increase coverage.
        const uniqueCandidates = new Map(eligible.map((candidate) => [`${candidate.feedTag}::${candidate.xmlId}`, candidate]));
        if (uniqueCandidates.size === 1) {
          const picked = [...uniqueCandidates.values()][0];
          matchedFeed = picked.feedTag;
          matchedXmlId = picked.xmlId;
        }
      }
    }

    if (matchedXmlId && matchedFeed) {
      tvgIds[ch.id] = matchedXmlId;
      const rawPrograms = programmesByFeedAndXmlId.get(`${matchedFeed}::${matchedXmlId}`) || [];
      if (rawPrograms.length) byChannelId[ch.id] = dedupeAndSortProgrammes(rawPrograms);
    }
  }
  return { byChannelId, tvgIds };
}

export async function refreshEpgCache(customUrls?: string[], force = false): Promise<void> {
  if (!force && lastUpdatedAt > 0 && Date.now() - lastUpdatedAt < REFRESH_TTL_MS && !customUrls?.length) return;
  if (activeRefreshPromise && !customUrls?.length) return activeRefreshPromise;

  const run = async () => {
    const now = Date.now();
    const windowStart = now - 5 * 60_000;
    const windowEnd = now + 8 * 3600_000;
    const sources: FeedSource[] = [
      ...(customUrls || []).map((url) => ({ tag: 'custom' as FeedTag, url })),
      ...DEFAULT_XMLTV_FEEDS,
    ];
    const [parsedFeeds, adultSwimProgs] = await Promise.all([
      Promise.all(sources.map((source) => fetchAndParseXmltvFeed(source, windowStart, windowEnd))),
      fetchAdultSwimSchedule(),
    ]);
    const { byChannelId, tvgIds } = buildChannelScheduleMap(parsedFeeds, adultSwimProgs);
    // Keep the last good cache when every upstream guide is temporarily unavailable.
    if (Object.keys(byChannelId).length) {
      cachedProgramsByChannelId = byChannelId;
      cachedTvgIdMap = tvgIds;
      lastUpdatedAt = Date.now();
      console.log(`📺 [EPG] Loaded live Now & Next guide for ${Object.keys(byChannelId).length} channels`);
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
          if (candidate.start > programme.start && candidate.stop > programme.stop) {
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
    if (nowProg || nextProg) programs[channelId] = { ...(nowProg ? { now: nowProg } : {}), ...(nextProg ? { next: nextProg } : {}) };
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
          await Promise.race([refreshEpgCache(), new Promise((resolve) => setTimeout(resolve, 20000))]);
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
