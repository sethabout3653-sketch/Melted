import fs from 'fs';
import path from 'path';
import express from 'express';
import zlib from 'zlib';
import { TV_CHANNELS, TVChannel } from '../data/channels';
import '../data/registerExtraChannels';
import { classifyChannel } from '../utils/channelOrganization';
import {
  EpgProgramme,
  ChannelNowNext,
  EpgChannelMeta,
  normalizeRatingBadge,
  normalizeTitleKey,
  stripCircledSymbols,
  resolveAccurateProgrammeRating,
  buildChannelFallbackSchedule,
} from '../utils/epgRatingHelpers';

export type { EpgProgramme, ChannelNowNext };

type FeedTag =
  | 'custom'
  | 'pluto_api'
  | 'pluto'
  | 'samsung'
  | 'roku'
  | 'plex'
  | 'us'
  | 'ca'
  | 'uk'
  | 'freeview'
  | 'ie'
  | 'au'
  | 'au_syd'
  | 'nz'
  | 'sg'
  | 'plex1'
  | 'distrotv';

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
  names: string[];
}

const DEFAULT_XMLTV_FEEDS: FeedSource[] = [
  { tag: 'pluto', url: 'https://i.mjh.nz/PlutoTV/all.xml.gz' },
  { tag: 'samsung', url: 'https://i.mjh.nz/SamsungTVPlus/all.xml.gz' },
  { tag: 'roku', url: 'https://i.mjh.nz/Roku/all.xml.gz' },
  { tag: 'plex', url: 'https://i.mjh.nz/Plex/all.xml.gz' },
  { tag: 'us', url: 'https://epgshare01.online/epgshare01/epg_ripper_US2.xml.gz' },
  { tag: 'ca', url: 'https://epgshare01.online/epgshare01/epg_ripper_CA2.xml.gz' },
  { tag: 'uk', url: 'https://epgshare01.online/epgshare01/epg_ripper_UK1.xml.gz' },
  { tag: 'freeview', url: 'https://raw.githubusercontent.com/dp247/Freeview-EPG/master/epg.xml' },
  { tag: 'ie', url: 'https://epgshare01.online/epgshare01/epg_ripper_IE1.xml.gz' },
  { tag: 'au_syd', url: 'https://i.mjh.nz/au/Sydney/epg.xml.gz' },
  { tag: 'au', url: 'https://epgshare01.online/epgshare01/epg_ripper_AU1.xml.gz' },
  { tag: 'nz', url: 'https://i.mjh.nz/nz/epg.xml.gz', fallbacks: ['https://epgshare01.online/epgshare01/epg_ripper_NZ1.xml.gz'] },
  { tag: 'sg', url: 'https://epgshare01.online/epgshare01/epg_ripper_SG1.xml.gz' },
  { tag: 'plex1', url: 'https://epgshare01.online/epgshare01/epg_ripper_PLEX1.xml.gz' },
  { tag: 'distrotv', url: 'https://epgshare01.online/epgshare01/epg_ripper_DISTROTV1.xml.gz' },
];

const SELECTIVE_STREAM_FEEDS: { tag: FeedTag; url: string; targetIds: string[] }[] = [
  {
    tag: 'us',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_US_LOCALS1.xml.gz',
    targetIds: ['WMPB-DT.us_locals1', 'WMPT-DT.us_locals1', 'WBFF-DT.us_locals1', 'WMAR-DT.us_locals1', 'WBAL-DT.us_locals1', 'WJZ-DT.us_locals1'],
  },
  {
    tag: 'custom',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_BR1.xml.gz',
    targetIds: ['São.Paulo/SP..CNN.Brasil.HD.br', 'São.Paulo/SP..CNN.Brasil.br'],
  },
  {
    tag: 'custom',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_IT1.xml.gz',
    targetIds: ['Boing.it'],
  },
  {
    tag: 'custom',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_NG1.xml.gz',
    targetIds: ['Africanews.ng'],
  },
];

const ADULT_SWIM_SCHEDULE_URL = 'https://www.adultswim.com/api/schedule/marathons/5801264b1bb9661440d5f845';

const EXPLICIT_XMLTV_CHANNEL_IDS: Record<string, string[]> = {
  'cartoon-network': ['Cartoon.Network.(HD).sg', 'Cartoon.Network.sg', 'CartoonNetwork.us'],
  'pbs-mpt-baltimore': ['WMPB-DT.us_locals1', 'WMPT-DT.us_locals1', 'WMPB.us', 'MPT.us', 'PBS.Stream.us2'],
  'pbs-kids': ['PBS.Kids.Stream.us2', 'PBS.KIDS.HD.us2', 'PBSKids.us', 'PBSKids.us2', 'PBSKidsHD.us', 'PBS.Kids.us', 'PBSKidsChannel.us', 'PBSKids247.us', 'PBSKidsFast.us', 'pbskids.us'],
  'wbff-fox-45': ['WBFF-DT.us_locals1', 'WBFF.us', 'WBFFDT.us'],
  'foxlivenow-us-2e4ee': ['plex.tv.LiveNOW.from.FOX.plex', 'LiveNOW.from.FOX.us'],
  'fox-livenow-us': ['plex.tv.LiveNOW.from.FOX.plex', 'LiveNOW.from.FOX.us'],
  'nbcnewsnow-us-02844': ['plex.tv.NBC.News.NOW.plex', 'b5fe4277ff365ccda0a7d43028d53d90', 'CAAJ2700011IF'],
  'bbchome-us-8caaf': ['5fb5836fe745b600070fc743', 'plex.tv.BBC.Home.&.Garden.plex', 'b04b170e5f085586985358512adbdb9f', 'CABD1200012B8'],
  'bbcfood-us-55aa7': ['5fb5844bf5514d0007945bda', 'CABD1200010LE', '6a1610bebdf296985fd95603-630905af0417b7074a4ad95e'],
  'black-cinema-ed435': ['58af4c093a41ca9d4ecabe96', 'plex.tv.Maverick.Black.Cinema.plex', '834e2a09799752b3be7ecaab726b7242'],
  'bloomberg-originals-live': ['6a1610bebdf296985fd95603-68fafe0dae4af1c7478fbeec', '697140a85d851f5e69414688-61d73c3ca7b7c7f703418518', 'Bloomberg.Originals.us', 'BloombergOriginals.us'],
  'film-detective-f988f': ['The.Film.Detective.us2', 'The.Film.Detective.us', 'plex.tv.The.Film.Detective.plex'],
  'fast-creator-tv': ['6a1610bebdf296985fd95603-67884bd6d37f2fd48d6220db'],
  'fast-delicious-eats': ['3cc1692ef5f94887414daf3a888964a6'],
  'reuters-now-live': ['The.Reuters.60.distro', 'plex.tv.The.Reuters.60.plex', 'GBBD4900001RG', 'Reuters.us'],
  'fast-reuters-60': ['The.Reuters.60.distro', 'plex.tv.The.Reuters.60.plex', 'GBBD4900001RG', 'Reuters.us'],
  'france-24-english-live': ['mjh-sbs-france24', 'plex.tv.FRANCE.24.plex', 'GBBD1100002L5'],
  'dw-english-live': ['GB1300001RX', 'DW.HD.ca2'],
  'cgtn-english-live': ['CGTN.distro'],
  'africanews-english-free': ['Africanews.ng'],
  'arirangworld-kr-2d976': ['ArirangTV.kr'],
  'arirang-un-free': ['ArirangTV.kr'],
  'cnn-brasil-free': ['São.Paulo/SP..CNN.Brasil.HD.br', 'São.Paulo/SP..CNN.Brasil.br'],
  'boing-italia-hd-free': ['Boing.it'],
  'fast-dungeontv': ['Dungeon.TV.distro'],
  'al-jazeera-english-live': ['GB2300005ML', 'AlJazeeraEnglish.us', 'Al.Jazeera.uk', 'Al.Jazeera.nz'],
  'abc-news-live-3-free': ['USBC39000171G', 'ABCNewsLive.us', 'ABC.News.Live.us'],
  'fast-dawson-s-creek-party-of-five': ['plex.tv.Dawsons.Creek.and.Party.of.Five.plex', '6a1610bebdf296985fd95603-6414957e238e21f260e78440'],
  'fast-stingray-hit-list': ['plex.tv.Stingray.Hit.List.plex'],
  'fast-xumo-free-sci-fi-fantasy-movies': ['plex.tv.FilmRise.Sci-Fi.plex', '6a1610bebdf296985fd95603-6449369eb3ff17382cae580d'],
  'ten-hd-au': ['mjh-10-nsw', '10Sydney.au', 'TenSydney.au', '10.au'],
  '10sydney-au-w39': ['mjh-10-nsw', '10Sydney.au', '10.au'],
  '10bold-au-vpd': ['mjh-10bold-nsw', '10BoldSydney.au', '10Bold.au'],
  '10peach-au-o5x': ['mjh-10peach-nsw', '10PeachSydney.au', '10Peach.au'],
  '10shake-au-k77': ['mjh-10shake-nsw', '10ShakeSydney.au', '10Shake.au', 'NickelodeonAustralia.au'],
  'sevennetwork-au-nwo': ['7Sydney.au', 'SevenSydney.au', '7.au'],
  '7mate-au-d69': ['7mateSydney.au', '7mate.au'],
  '7two-au-9c3': ['7twoSydney.au', '7two.au'],
  'ninenetwork-au-utu': ['mjh-channel-9-nsw', '9Sydney.au', 'Channel9.au'],
  '9gem-au-ygi': ['9GemSydney.au', '9Gem.au'],
  '9go-au-0hm': ['9GoSydney.au', '9Go.au'],
  '9life-au-sv5': ['9LifeSydney.au', '9Life.au'],
  'sbsfood-au-xdk': ['mjh-sbs-3syd', 'SBSFood.au', 'SBS.Food.au'],
  'sbsviceland-au-t1t': ['mjh-sbs-2syd', 'SBSVICELAND.au', 'SBSViceland.au'],
  'sbsworldmovies-au-4o0': ['mjh-sbs-4syd', 'SBSWorldMovies.au', 'SBS.World.Movies.au'],
  'abckids-au-r2v': ['mjh-abc-kids', 'ABCKidsSydney.au', 'ABCKidsMelbourne.au', 'ABCKidsPerth.au', 'ABCKids.au', 'ABC.Kids.au'],
  'abcme-au-2d1': ['mjh-abc-me', 'ABCEntertainsSydney.au', 'ABCEntertainsMelbourne.au', 'ABCME.au', 'ABC.Me.au'],
  'rteone-ie-661f5': ['RTE.One.HD.ie', 'RTEOne.ie'],
  'rtenews-ie-f6362': ['RTE.News.ie', 'RTENews.ie'],
  'virginmediaone-ie-2e599': ['Virgin.Media.One.HD.ie', 'VirginMediaOne.ie'],
  'virginmediatwo-ie-42929': ['Virgin.Media.Two.HD.ie', 'VirginMediaTwo.ie'],
  'virginmediathree-ie-57ef4': ['Virgin.Media.Three.HD.ie', 'VirginMediaThree.ie'],
  'virginmediafour-ie-cd077': ['Virgin.Media.Four.HD.ie', 'VirginMediaFour.ie'],
  'oireachtastv-ie-bad54': ['Oireachtas.TV.ie', 'OireachtasTV.ie'],
  'cpacenglish-ca-2f417': ['[CPAC].Cable.Public.Affairs.Channel.HD.ca2', 'CPAC.(English).ca2', 'CPAC.English.ca2'],
  'civmdt-ca-8c7aa': ['CIVM-DT.ca2', 'CIVM.ca2'],
  'cbftdt-ca-ca948': ['CBFT.ca2', 'ICI.Radio-Canada.Tele.Montreal.ca2'],
  'bbcscotland-uk-dc635': ['BBCScotland.uk', 'bbcscotland.uk', 'BBC.Scotland.HD.uk'],
  'truecrime-uk-4cfbc': ['ITBD1000006RD', 'TrueCrime.uk', 'True.Crime.uk'],
  'gemstv-uk-8e41a': ['Gems.TV.uk', 'GemsTV.uk'],
  'bbcradio1-uk-19d2b': ['BBCR1.uk', 'bbcr1.uk'],
  'bbcradio2-uk-51a96': ['BBCR2.uk', 'bbcr2.uk'],
  'bbcradio1xtra-uk-5fe57': ['BBCR1X.uk', 'bbc1xtra.uk'],
  'bbcradio4fm-uk-6534d': ['BBCR4FM.uk', 'BBCR4LW.uk', 'bbcr4.uk'],
  'bbcradio4extra-uk-93ce8': ['BBCR4EX.uk', 'bbcr4ex.uk'],
  'bbcradio5live-uk-f21da': ['BBCR5L.uk', 'bbcr5l.uk'],
  'bbcradio5sportsextra-uk-590da': ['BBCR5SX.uk', 'bbcr5lsx.uk'],
  'bbcradio6music-uk-abe81': ['BBCR6M.uk', 'bbcr6m.uk'],
  'bbcradioasiannetwork-uk-7efe0': ['BBCRAN.uk', 'bbcran.uk'],
  'one-mt-2b7f9': ['ONE.mt', 'One.mt'],
};

const REFRESH_TTL_MS = 4 * 60 * 60 * 1000;
const REFRESH_RETRY_MS = 5 * 60 * 1000;
let lastRefreshAttemptAt = 0;
const MAX_CONCURRENT_FEEDS = 2;
const EPG_DISK_CACHE_PATH = path.join(process.cwd(), '.epg-cache.json');
const EPG_PUBLIC_CACHE_PATH = path.join(process.cwd(), 'public', 'epg-cache.json');

let cachedProgramsByChannelId: Record<string, EpgProgramme[]> = {};
let cachedTvgIdMap: Record<string, string> = {};
let lastUpdatedAt = 0;
let activeRefreshPromise: Promise<void> | null = null;
let prewarmActive = false;

const CHANNEL_BY_ID = new Map<string, TVChannel>(TV_CHANNELS.map((c) => [c.id, c]));

const TMDB_API_KEY = process.env.TMDB_API_KEY || 'e378bd904d6b4952f9261f8f27882a9c';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_TIMEOUT_MS = 8000;
const TMDB_LOOKUP_CONCURRENCY = 12;
const tmdbRatingLookups = new Map<string, Promise<string | undefined>>();
const tmdbRatingResults = new Map<string, string | undefined>();

function buildChannelMetaMap(): Record<string, EpgChannelMeta> {
  const out: Record<string, EpgChannelMeta> = {};
  for (const ch of TV_CHANNELS) {
    const cls = classifyChannel(ch);
    const decoded = extractStreamUrl(ch.url);
    const plutoId =
      decoded.match(/plu-([a-f0-9]{24})/i)?.[1] ||
      decoded.match(/\/stitch\/(?:v1\/|embed\/)?(?:hls\/)?channel\/([a-f0-9]{24})/i)?.[1];
    out[ch.id] = {
      id: ch.id,
      name: ch.name,
      category: cls.category || ch.category,
      subType: cls.subType,
      ...(ch.description ? { description: ch.description.slice(0, 140) } : {}),
      ...(plutoId ? { plutoId } : {}),
    };
  }
  return out;
}

function buildBakedProgramsForDisk(): Record<string, EpgProgramme[]> {
  const out: Record<string, EpgProgramme[]> = {};
  for (const ch of TV_CHANNELS) {
    const list = cachedProgramsByChannelId[ch.id];
    if (!list?.length) continue;
    const cls = classifyChannel(ch);
    const chInfo = { id: ch.id, name: ch.name, category: cls.category || ch.category, subType: cls.subType };
    out[ch.id] = list.map((p) => ({
      ...p,
      rating: resolveAccurateProgrammeRating(p, chInfo, tmdbRatingResults),
    }));
  }
  return out;
}

export function loadEpgFromDisk(): boolean {
  try {
    const sourcePath = fs.existsSync(EPG_DISK_CACHE_PATH)
      ? EPG_DISK_CACHE_PATH
      : fs.existsSync(EPG_PUBLIC_CACHE_PATH)
      ? EPG_PUBLIC_CACHE_PATH
      : null;
    if (sourcePath) {
      const raw = fs.readFileSync(sourcePath, 'utf8');
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        if (data.programs && Object.keys(data.programs).length > 0) {
          cachedProgramsByChannelId = data.programs;
        }
        if (data.tvgIds) {
          cachedTvgIdMap = data.tvgIds;
        }
        if (typeof data.lastUpdatedAt === 'number') {
          lastUpdatedAt = data.lastUpdatedAt;
        }
        if (Array.isArray(data.tmdbRatings)) {
          for (const [k, v] of data.tmdbRatings) {
            tmdbRatingResults.set(k, v);
          }
        }
        console.log(`⚡ [EPG] Hydrated instant disk cache for ${Object.keys(cachedProgramsByChannelId).length} channels`);
        return true;
      }
    }
  } catch (err) {
    console.warn('[EPG] Disk cache load notice:', err);
  }
  return false;
}

export function saveEpgToDisk(): void {
  try {
    const payload = {
      programs: buildBakedProgramsForDisk(),
      tvgIds: cachedTvgIdMap,
      channelMeta: buildChannelMetaMap(),
      lastUpdatedAt,
      tmdbRatings: Array.from(tmdbRatingResults.entries()),
    };
    const json = JSON.stringify(payload);
    fs.writeFileSync(EPG_DISK_CACHE_PATH, json, 'utf8');
    if (fs.existsSync(path.dirname(EPG_PUBLIC_CACHE_PATH))) {
      fs.writeFileSync(EPG_PUBLIC_CACHE_PATH, json, 'utf8');
    }
  } catch (err) {
    console.warn('[EPG] Disk cache save notice:', err);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function normalizeStrictName(name: string): string {
  return stripCircledSymbols(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\((?:720p|1080p|480p|sd|hd|fhd|uhd|en|english)\)/gi, '')
    .replace(/&/g, 'and')
    .replace(/\b(hd|fhd|uhd|sd)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function normalizeLooseName(name: string): string {
  return stripCircledSymbols(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\((?:720p|1080p|480p|sd|hd|fhd|uhd|en|english|east|west|us|uk|ca|au|ie|nz|sg)\)/gi, '')
    .replace(/&/g, 'and')
    .replace(/\b(hd|fhd|uhd|sd|tv|channel|east|west)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function extractStreamUrl(rawUrl: string): string {
  const clean = (rawUrl || '').trim();
  if (clean.startsWith('/api/proxy-stream?url=')) {
    try {
      return decodeURIComponent(clean.slice('/api/proxy-stream?url='.length));
    } catch {
      return clean;
    }
  }
  return clean;
}

function extractProviderXmltvIds(streamUrl: string): { id: string; feed?: FeedTag }[] {
  const decoded = extractStreamUrl(streamUrl);
  const out: { id: string; feed?: FeedTag }[] = [];

  const plu = decoded.match(/plu-([a-f0-9]{24,32})(?:\.m3u8|$)/i)?.[1];
  if (plu) out.push({ id: plu, feed: 'pluto_api' });

  const stitcherPlu = decoded.match(/\/stitch\/(?:v1\/|embed\/)?(?:hls\/)?channel\/([a-f0-9]{24})/i)?.[1];
  if (stitcherPlu) out.push({ id: stitcherPlu, feed: 'pluto_api' });

  const rok = decoded.match(/rok-([a-f0-9]{24,32})(?:\.m3u8|$)/i)?.[1];
  if (rok) out.push({ id: rok, feed: 'roku' });

  const stvp = decoded.match(/stvp-([A-Za-z0-9]{8,20})/i)?.[1];
  if (stvp) out.push({ id: stvp, feed: 'samsung' });

  const plexPart = decoded.match(/\/library\/parts\/([a-f0-9]+-[a-f0-9]+)/i)?.[1];
  if (plexPart) out.push({ id: plexPart, feed: 'plex' });

  return out;
}

function parseXmltvTime(raw: string): number {
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-])(\d{2})(\d{2}))?/);
  if (!m) return 0;
  const utcMs = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
  if (!m[7]) return utcMs;
  const offsetMinutes = (m[7] === '-' ? -1 : 1) * (Number(m[8]) * 60 + Number(m[9]));
  return utcMs - offsetMinutes * 60_000;
}

function parseEpisodeInfo(programmeBody: string, title: string, desc?: string): string | undefined {
  const epNumMatch = programmeBody.match(/<episode-num\b[^>]*>([\s\S]*?)<\/episode-num>/gi);
  if (epNumMatch) {
    for (const tag of epNumMatch) {
      const val = decodeXmlEntities(tag.replace(/<[^>]+>/g, '')).trim();
      if (!val) continue;
      if (tag.includes('system="xmltv_ns"') || tag.includes("system='xmltv_ns'")) {
        const parts = val.split('.');
        if (parts.length >= 2) {
          const s = parseInt(parts[0].trim(), 10);
          const e = parseInt(parts[1].trim(), 10);
          if (!isNaN(s) && !isNaN(e)) {
            return `S${String(s + 1).padStart(2, '0')}E${String(e + 1).padStart(2, '0')}`;
          }
        }
      }
      if (/s\d+e\d+/i.test(val) || /season\s*\d+/i.test(val)) {
        return val;
      }
    }
  }

  const combined = `${title} ${desc || ''}`;
  const sEFormat = combined.match(/\b(S\d+E\d+|\d+x\d+)\b/i);
  if (sEFormat) return sEFormat[1].toUpperCase();

  const seasonEpFormat = combined.match(/\bSeason\s*(\d+)[,\s]+Episode\s*(\d+)\b/i);
  if (seasonEpFormat) {
    return `S${String(seasonEpFormat[1]).padStart(2, '0')}E${String(seasonEpFormat[2]).padStart(2, '0')}`;
  }

  return undefined;
}

function parseTvRating(programmeBody: string): string | undefined {
  const matches = [...programmeBody.matchAll(/<rating\b[^>]*>([\s\S]*?)<\/rating>/gi)];
  for (const match of matches) {
    const value = match[1].match(/<value\b[^>]*>([\s\S]*?)<\/value>/i)?.[1];
    if (!value) continue;
    const raw = decodeXmlEntities(value.replace(/<[^>]+>/g, ''));
    const normalized = normalizeRatingBadge(raw);
    if (normalized) return normalized;
  }
  return undefined;
}

function parseProgrammeCategory(programmeBody: string): string | undefined {
  const matches = [...programmeBody.matchAll(/<category\b[^>]*>([\s\S]*?)<\/category>/gi)];
  const cats: string[] = [];
  for (const match of matches) {
    const c = decodeXmlEntities(match[1].replace(/<[^>]+>/g, ''));
    if (c) cats.push(c);
  }
  return cats.length ? cats.join(', ').slice(0, 80) : undefined;
}

function buildSearchTitleVariants(title: string): string[] {
  const clean = decodeXmlEntities(title)
    .replace(/\((?:19|20)\d{2}\)/g, '')
    .replace(/\b(?:new|live|repeat|encore|hd|broadcast edit)\b/gi, '')
    .replace(/\[[^\]]+\]/g, '')
    .trim();
  const base = clean.split(/[:|–—-]/)[0]?.trim() || clean;
  const variants = [clean, base].filter((s) => s.length >= 2);
  return Array.from(new Set(variants));
}

async function tmdbGet<T>(reqPath: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TMDB_BASE}${reqPath}`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url, { signal: AbortSignal.timeout(TMDB_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`TMDB HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

async function resolveTmdbRating(title: string): Promise<string | undefined> {
  const variants = buildSearchTitleVariants(title);
  if (variants.length === 0) return undefined;

  const titleKey = normalizeTitleKey(variants[0]);
  const baseKey = normalizeTitleKey(variants[variants.length - 1]);

  let match: { id: number; media_type: string; name?: string; title?: string } | undefined;
  for (const query of variants) {
    const search = await tmdbGet<{ results: { id: number; media_type: string; name?: string; title?: string }[] }>(
      '/search/multi',
      { query, include_adult: 'false', language: 'en-US' }
    );
    match = search.results?.find((result) => {
      if (result.media_type !== 'movie' && result.media_type !== 'tv') return false;
      return [result.name, result.title].some((name) => {
        const key = normalizeTitleKey(name || '');
        return key !== '' && (key === titleKey || key === baseKey || key === normalizeTitleKey(query));
      });
    });
    if (match) break;
  }

  if (!match) return undefined;

  if (match.media_type === 'movie') {
    const data = await tmdbGet<{ results: { iso_3166_1: string; release_dates: { certification?: string }[] }[] }>(
      `/movie/${match.id}/release_dates`
    );
    for (const regionCode of ['US', 'CA', 'GB', 'AU']) {
      const certification = data.results
        ?.find((region) => region.iso_3166_1 === regionCode)
        ?.release_dates?.map((release) => release.certification?.trim())
        .find(Boolean);
      const normalized = certification ? normalizeRatingBadge(certification) : undefined;
      if (normalized) return normalized;
    }
    return undefined;
  }

  const data = await tmdbGet<{ results: { iso_3166_1: string; rating?: string }[] }>(`/tv/${match.id}/content_ratings`);
  for (const regionCode of ['US', 'CA', 'GB', 'AU']) {
    const raw = data.results?.find((region) => region.iso_3166_1 === regionCode)?.rating;
    const normalized = raw ? normalizeRatingBadge(raw) : undefined;
    if (normalized) return normalized;
  }
  return undefined;
}

export function lookupTmdbRating(title: string): Promise<string | undefined> {
  const key = normalizeTitleKey(title);
  if (!key) return Promise.resolve(undefined);
  if (tmdbRatingResults.has(key)) return Promise.resolve(tmdbRatingResults.get(key));
  const existing = tmdbRatingLookups.get(key);
  if (existing) return existing;
  const lookup = resolveTmdbRating(title)
    .then((rating) => {
      tmdbRatingResults.set(key, rating);
      return rating;
    })
    .catch(() => {
      tmdbRatingLookups.delete(key);
      return undefined;
    });
  tmdbRatingLookups.set(key, lookup);
  return lookup;
}

export async function prewarmAllTmdbRatings(maxTitles = 1200): Promise<number> {
  if (prewarmActive) return 0;
  prewarmActive = true;
  let resolvedCount = 0;
  try {
    const nowMs = Date.now();
    const pending = new Set<string>();
    for (const ch of TV_CHANNELS) {
      const list = cachedProgramsByChannelId[ch.id];
      if (!list?.length) continue;
      const upcoming = list.filter((p) => p.stop > nowMs).slice(0, 4);
      for (const p of upcoming) {
        if (p.rating && p.rating !== 'TV-PG') continue;
        const key = normalizeTitleKey(p.title);
        if (!key || tmdbRatingResults.has(key)) continue;
        const isLiveNewsOrRadio = /\b(live broadcast|live radio|live coverage|featured broadcast|weather|oireachtas|parliament|test cricket|bulletin|morning news|evening news|world news|live news)\b/i.test(p.title);
        if (!isLiveNewsOrRadio) {
          pending.add(p.title);
        }
      }
    }
    const queue = [...pending].slice(0, maxTitles);
    const worker = async () => {
      while (queue.length) {
        const title = queue.shift();
        if (!title) break;
        const r = await lookupTmdbRating(title);
        if (r) resolvedCount++;
      }
    };
    await Promise.all(Array.from({ length: Math.min(TMDB_LOOKUP_CONCURRENCY, queue.length) }, worker));
    if (resolvedCount > 0 || pending.size > 0) {
      saveEpgToDisk();
    }
    return resolvedCount;
  } catch {
    return resolvedCount;
  } finally {
    prewarmActive = false;
  }
}

function prewarmTmdbRatingsInBackground() {
  if (prewarmActive) return;
  void prewarmAllTmdbRatings(1200);
}

async function withTmdbRatings(snapshot: ReturnType<typeof getNowNextSnapshot>): Promise<ReturnType<typeof getNowNextSnapshot>> {
  const pendingTitles = new Set<string>();
  for (const ch of TV_CHANNELS) {
    const entry = snapshot.programs[ch.id];
    if (!entry) continue;
    for (const programme of [entry.now, entry.next]) {
      if (programme && (!programme.rating || programme.rating === 'TV-PG')) {
        const key = normalizeTitleKey(programme.title);
        if (key && !tmdbRatingResults.has(key)) {
          const isObviousLiveRadio = /\b(live broadcast|live radio|live coverage|weather|oireachtas|bulletin)\b/i.test(programme.title);
          if (!isObviousLiveRadio) {
            pendingTitles.add(programme.title);
          }
        }
      }
    }
  }

  if (pendingTitles.size > 0 && !prewarmActive) {
    setTimeout(() => {
      void prewarmAllTmdbRatings(1200);
    }, 10);
  }

  const applyRating = (programme: EpgProgramme | undefined, ch: TVChannel | undefined): EpgProgramme | undefined => {
    if (!programme) return undefined;
    const { category: _cat, ...rest } = programme;
    const cls = ch ? classifyChannel(ch) : undefined;
    const chInfo = {
      id: ch?.id,
      name: ch?.name,
      category: cls?.category || ch?.category,
      subType: cls?.subType,
    };
    const accurate = resolveAccurateProgrammeRating(programme, chInfo, tmdbRatingResults);
    return { ...rest, rating: accurate };
  };

  const programs: Record<string, ChannelNowNext> = {};
  for (const [channelId, entry] of Object.entries(snapshot.programs)) {
    const ch = CHANNEL_BY_ID.get(channelId);
    const now = applyRating(entry.now, ch);
    const next = applyRating(entry.next, ch);
    programs[channelId] = { ...(now ? { now } : {}), ...(next ? { next } : {}) };
  }
  return { updatedAt: snapshot.updatedAt, programs };
}

async function fetchBufferWithRetry(url: string, timeoutMs: number, retries = 2): Promise<Buffer> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'application/xml,text/xml,application/json,application/gzip,application/octet-stream,*/*;q=0.8',
          'Cache-Control': 'no-cache',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastError = err;
      if (attempt < retries) await sleep(600 * (attempt + 1));
    }
  }
  throw lastError;
}

async function fetchPlutoApiFeed(windowStart: number, windowEnd: number): Promise<ParsedFeed> {
  const channels = new Map<string, string[]>();
  const programmes = new Map<string, EpgProgramme[]>();
  try {
    const startIso = new Date(Math.max(windowStart, Date.now() - 2 * 3600_000)).toISOString();
    const stopIso = new Date(Math.min(windowEnd, Date.now() + 10 * 3600_000)).toISOString();
    const url = `https://api.pluto.tv/v2/channels?start=${encodeURIComponent(startIso)}&stop=${encodeURIComponent(stopIso)}`;
    const buf = await fetchBufferWithRetry(url, 15000, 1);
    const list: any[] = JSON.parse(buf.toString('utf8'));
    if (Array.isArray(list)) {
      for (const ch of list) {
        const chId = String(ch?._id || '').trim();
        const chName = String(ch?.name || '').trim();
        if (!chId) continue;
        if (chName) channels.set(chId, [chName]);
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
          const season = Number(ep?.season);
          const number = Number(ep?.number);
          const episode =
            Number.isFinite(season) && Number.isFinite(number) && season > 0 && number > 0
              ? `S${String(season).padStart(2, '0')}E${String(number).padStart(2, '0')}`
              : undefined;
          progs.push({
            title,
            start,
            stop,
            ...(desc ? { desc } : {}),
            ...(rating ? { rating } : {}),
            ...(category ? { category } : {}),
            ...(episode ? { episode } : {}),
          });
        }
        if (progs.length) programmes.set(chId, progs);
      }
    }
  } catch (err: any) {
    console.debug(`[EPG] Pluto JSON API skipped: ${err?.message || err}`);
  }
  return { tag: 'pluto_api', channels, programmes };
}

async function fetchAndParseXmltvFeed(source: FeedSource, windowStart: number, windowEnd: number): Promise<ParsedFeed> {
  const channels = new Map<string, string[]>();
  const programmes = new Map<string, EpgProgramme[]>();
  const urlsToTry = [source.url, ...(source.fallbacks || [])];

  for (const targetUrl of urlsToTry) {
    try {
      const buf = await fetchBufferWithRetry(targetUrl, 45000, 1);
      const isGzip = buf[0] === 0x1f && buf[1] === 0x8b;
      const xml = isGzip ? zlib.gunzipSync(buf).toString('utf8') : buf.toString('utf8');

      const chRegex = /<channel\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/channel>/gi;
      let chMatch: RegExpExecArray | null;
      while ((chMatch = chRegex.exec(xml)) !== null) {
        const chId = decodeXmlEntities(chMatch[1].trim());
        const names: string[] = [];
        const nameRegex = /<display-name\b[^>]*>([\s\S]*?)<\/display-name>/gi;
        let nameMatch: RegExpExecArray | null;
        while ((nameMatch = nameRegex.exec(chMatch[2])) !== null) {
          const name = decodeXmlEntities(nameMatch[1].replace(/<[^>]+>/g, ''));
          if (name) names.push(name);
        }
        channels.set(chId, names);
      }

      const progRegex = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi;
      let progMatch: RegExpExecArray | null;
      while ((progMatch = progRegex.exec(xml)) !== null) {
        const attrs = progMatch[1];
        const startRaw = attrs.match(/\bstart="([^"]+)"/i)?.[1];
        const stopRaw = attrs.match(/\bstop="([^"]+)"/i)?.[1];
        const rawChannelId = attrs.match(/\bchannel="([^"]+)"/i)?.[1]?.trim();
        if (!startRaw || !stopRaw || !rawChannelId) continue;
        const channelId = decodeXmlEntities(rawChannelId);
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
        const category = parseProgrammeCategory(body);
        const episode = parseEpisodeInfo(body, title, desc);

        const list = programmes.get(channelId) || [];
        list.push({
          title,
          start,
          stop,
          ...(desc ? { desc } : {}),
          ...(rating ? { rating } : {}),
          ...(category ? { category } : {}),
          ...(episode ? { episode } : {}),
        });
        programmes.set(channelId, list);
      }

      if (programmes.size > 0) return { tag: source.tag, channels, programmes };
    } catch (err: any) {
      console.debug(`[EPG] Feed ${targetUrl} unavailable or skipped: ${err?.message || err}`);
    }
  }
  return { tag: source.tag, channels, programmes };
}

async function fetchSelectiveXmltvStream(
  spec: { tag: FeedTag; url: string; targetIds: string[] },
  windowStart: number,
  windowEnd: number
): Promise<ParsedFeed> {
  const { Readable } = await import('stream');
  const channels = new Map<string, string[]>();
  const programmes = new Map<string, EpgProgramme[]>();
  const targetSet = new Set(spec.targetIds);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Selective XMLTV timeout (${spec.url})`));
  }, 45000);
  timeoutId.unref?.();

  let sourceStream: import('stream').Readable | null = null;
  let gunzip: zlib.Gunzip | null = null;

  try {
    const res = await fetch(spec.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/xml,text/xml,application/gzip,application/octet-stream,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    if (!res.ok || !res.body) return { tag: spec.tag, channels, programmes };

    for (const id of spec.targetIds) channels.set(id, [id]);

    sourceStream = Readable.fromWeb(res.body as any);
    let stream: AsyncIterable<Buffer>;
    if (spec.url.endsWith('.gz')) {
      gunzip = zlib.createGunzip();
      const gz = gunzip;
      sourceStream.on('error', (err) => {
        gz.destroy(err);
      });
      gz.on('error', () => {
        sourceStream?.destroy();
      });
      stream = sourceStream.pipe(gz);
    } else {
      sourceStream.on('error', () => {});
      stream = sourceStream;
    }

    let buffer = '';
    for await (const chunk of stream) {
      buffer += chunk.toString('utf8');
      let closeIdx: number;
      let processedUpTo = 0;
      while ((closeIdx = buffer.indexOf('</programme>', processedUpTo)) !== -1) {
        const end = closeIdx + '</programme>'.length;
        const start = buffer.lastIndexOf('<programme ', closeIdx);
        processedUpTo = end;
        if (start === -1) continue;
        const block = buffer.slice(start, end);
        const rawChannel = block.match(/\bchannel="([^"]+)"/i)?.[1]?.trim();
        if (!rawChannel) continue;
        const channelId = decodeXmlEntities(rawChannel);
        if (!targetSet.has(channelId)) continue;

        const startRaw = block.match(/\bstart="([^"]+)"/i)?.[1];
        const stopRaw = block.match(/\bstop="([^"]+)"/i)?.[1];
        if (!startRaw || !stopRaw) continue;
        const pStart = parseXmltvTime(startRaw);
        const pStop = parseXmltvTime(stopRaw);
        if (!pStart || !pStop || pStop <= pStart || pStop <= windowStart || pStart >= windowEnd) continue;

        const titleRaw = block.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
        const title = titleRaw ? decodeXmlEntities(titleRaw.replace(/<[^>]+>/g, '')) : '';
        if (!title) continue;
        const descRaw = block.match(/<desc\b[^>]*>([\s\S]*?)<\/desc>/i)?.[1];
        const desc = descRaw ? decodeXmlEntities(descRaw.replace(/<[^>]+>/g, '')).slice(0, 180) : undefined;
        const rating = parseTvRating(block);
        const category = parseProgrammeCategory(block);

        const list = programmes.get(channelId) || [];
        list.push({
          title,
          start: pStart,
          stop: pStop,
          ...(desc ? { desc } : {}),
          ...(rating ? { rating } : {}),
          ...(category ? { category } : {}),
        });
        programmes.set(channelId, list);
      }
      if (processedUpTo > 0) {
        buffer = buffer.slice(processedUpTo);
      } else if (buffer.length > 1024 * 1024) {
        const lastProg = buffer.lastIndexOf('<programme ');
        buffer = lastProg > 0 ? buffer.slice(lastProg) : buffer.slice(-65536);
      }
    }
  } catch (err: any) {
    console.debug(`[EPG] Selective feed ${spec.url} unavailable or skipped: ${err?.message || err}`);
  } finally {
    clearTimeout(timeoutId);
    try {
      gunzip?.destroy();
    } catch {}
    try {
      sourceStream?.destroy();
    } catch {}
  }
  return { tag: spec.tag, channels, programmes };
}

async function fetchFeedsWithConcurrency(
  sources: FeedSource[],
  windowStart: number,
  windowEnd: number,
  concurrency = MAX_CONCURRENT_FEEDS
): Promise<ParsedFeed[]> {
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
    for (const item of Array.isArray(json?.data) ? json.data : []) {
      const start = typeof item.time === 'number' ? Math.round(item.time) : Date.parse(item.startTime || '');
      const durationSec = Number(item.duration) || 0;
      if (!Number.isFinite(start) || durationSec <= 0) continue;
      const series = typeof item.seriesName === 'string' ? item.seriesName.trim() : '';
      const episode = typeof item.name === 'string' ? item.name.trim() : '';
      const title = series && episode ? `${series}: ${episode}` : episode || series;
      if (!title) continue;
      const desc = item.season && item.episodeNumber ? `Season ${item.season}, Episode ${item.episodeNumber}` : undefined;
      out.push({ title, start, stop: Math.round(start + durationSec * 1000), rating: 'TV-14', ...(desc ? { desc } : {}) });
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

function getChannelRoutingHints(ch: TVChannel): {
  preferredFeeds: FeedTag[];
  strictRegionOnly: boolean;
  countryCode?: string;
} {
  const cat = (ch.category || '').trim();
  const id = ch.id.toLowerCase();

  if (cat === 'Australia' || /-au-/.test(id)) {
    return { preferredFeeds: ['au_syd', 'au', 'custom'], strictRegionOnly: true, countryCode: 'AU' };
  }
  if (cat === 'Ireland' || /-ie-/.test(id)) {
    return { preferredFeeds: ['ie', 'uk', 'freeview', 'custom'], strictRegionOnly: true, countryCode: 'IE' };
  }
  if (cat === 'New Zealand' || /-nz-/.test(id)) {
    return { preferredFeeds: ['nz', 'au_syd', 'au', 'custom'], strictRegionOnly: true, countryCode: 'NZ' };
  }
  if (cat === 'UK' || /-uk-/.test(id)) {
    return { preferredFeeds: ['freeview', 'uk', 'samsung', 'pluto', 'plex', 'plex1', 'custom'], strictRegionOnly: true, countryCode: 'GB' };
  }
  if (cat === 'Canada' || /-ca-/.test(id)) {
    return { preferredFeeds: ['ca', 'samsung', 'pluto', 'plex', 'plex1', 'custom'], strictRegionOnly: true, countryCode: 'CA' };
  }
  if (cat === 'Malta' || /-mt-/.test(id)) {
    return { preferredFeeds: ['custom'], strictRegionOnly: true, countryCode: 'MT' };
  }
  if (cat === 'Nigeria' || /-ng-/.test(id)) {
    return { preferredFeeds: ['custom'], strictRegionOnly: true, countryCode: 'NG' };
  }
  if (cat === 'Kenya' || /-ke-/.test(id)) {
    return { preferredFeeds: ['custom'], strictRegionOnly: true, countryCode: 'KE' };
  }
  if (id.startsWith('pluto-')) {
    return { preferredFeeds: ['pluto_api', 'pluto', 'samsung', 'plex', 'plex1', 'roku', 'us', 'custom'], strictRegionOnly: false, countryCode: 'US' };
  }
  if (id.startsWith('samsung-')) {
    return { preferredFeeds: ['samsung', 'pluto_api', 'pluto', 'plex', 'plex1', 'roku', 'us', 'custom'], strictRegionOnly: false, countryCode: 'US' };
  }
  if (id.startsWith('roku-')) {
    return { preferredFeeds: ['roku', 'samsung', 'pluto_api', 'pluto', 'plex', 'plex1', 'us', 'custom'], strictRegionOnly: false, countryCode: 'US' };
  }
  if (id.startsWith('fast-')) {
    return { preferredFeeds: ['plex', 'plex1', 'pluto_api', 'pluto', 'samsung', 'roku', 'distrotv', 'us', 'custom'], strictRegionOnly: false, countryCode: 'US' };
  }
  return {
    preferredFeeds: ['custom', 'us', 'plex', 'plex1', 'pluto_api', 'pluto', 'samsung', 'roku', 'distrotv', 'au_syd', 'uk', 'freeview', 'ca', 'sg'],
    strictRegionOnly: false,
    countryCode: 'US',
  };
}

function scoreCandidateForChannel(candidate: CandidateEntry, ch: TVChannel, countryCode?: string): number {
  const xmlId = candidate.xmlId;
  let score = 0;

  // Check Samsung STVP country prefixes (US, GB, CA, IN, IT, ES, FR, DE, BR, MX, KR)
  const stvpCountry = xmlId.match(/^([A-Z]{2})[A-Z0-9]{6,}$/)?.[1];
  const suffixCountry = xmlId.match(/\.([a-z0-9_]+)$/i)?.[1]?.toLowerCase();

  if (countryCode === 'GB') {
    if (suffixCountry === 'uk' || stvpCountry === 'GB') score += 100;
    else if (stvpCountry && stvpCountry !== 'GB') score -= 120;
    else if (suffixCountry && suffixCountry !== 'uk') score -= 100;
  } else if (countryCode === 'CA') {
    if (suffixCountry === 'ca' || suffixCountry === 'ca2' || stvpCountry === 'CA') score += 100;
    else if (stvpCountry && stvpCountry !== 'CA') score -= 120;
  } else if (countryCode === 'AU') {
    if (suffixCountry === 'au' || xmlId.startsWith('mjh-')) score += 100;
  } else if (countryCode === 'IE') {
    if (suffixCountry === 'ie') score += 100;
    else if (suffixCountry === 'uk') score += 50;
  } else if (countryCode === 'US') {
    if (suffixCountry === 'us' || suffixCountry === 'us2' || suffixCountry === 'us_locals1' || stvpCountry === 'US' || xmlId.includes('.plex') || /^[a-f0-9]{24}/.test(xmlId)) {
      score += 100;
    } else if (stvpCountry && !['US', 'CA', 'GB'].includes(stvpCountry)) {
      // Avoid picking India/Italy/Brazil/Germany Samsung feed when US/EN exists
      if (!ch.name.toLowerCase().includes('india') && !ch.name.toLowerCase().includes('ndtv') && !ch.name.toLowerCase().includes('wion') && !ch.name.toLowerCase().includes('cnbc tv18') && !ch.name.toLowerCase().includes('cnn news18') && !ch.name.toLowerCase().includes('news9') && !ch.name.toLowerCase().includes('republic')) {
        score -= 100;
      }
    }
  }

  return score;
}

function buildChannelScheduleMap(feeds: ParsedFeed[], adultSwimProgs: EpgProgramme[]) {
  const feedsByTag = new Map<FeedTag, ParsedFeed>();
  const programmesByFeedAndXmlId = new Map<string, EpgProgramme[]>();
  const strictCandidatesByFeed = new Map<FeedTag, Map<string, CandidateEntry[]>>();
  const looseCandidatesByFeed = new Map<FeedTag, Map<string, CandidateEntry[]>>();

  for (const feed of feeds) {
    if (!feed) continue;
    let targetFeed = feedsByTag.get(feed.tag);
    if (!targetFeed) {
      targetFeed = { tag: feed.tag, channels: new Map(feed.channels), programmes: new Map(feed.programmes) };
      feedsByTag.set(feed.tag, targetFeed);
    } else {
      for (const [k, v] of feed.channels) targetFeed.channels.set(k, v);
      for (const [k, v] of feed.programmes) targetFeed.programmes.set(k, v);
    }
  }

  for (const [tag, feed] of feedsByTag) {
    const strictIndex = new Map<string, CandidateEntry[]>();
    const looseIndex = new Map<string, CandidateEntry[]>();
    for (const [xmlId, progs] of feed.programmes) {
      programmesByFeedAndXmlId.set(`${tag}::${xmlId}`, progs);
    }
    for (const [xmlId, names] of feed.channels) {
      if (!feed.programmes.has(xmlId)) continue;
      const entry: CandidateEntry = { xmlId, feedTag: tag, names };
      for (const n of names) {
        const sn = normalizeStrictName(n);
        if (sn) {
          const list = strictIndex.get(sn) || [];
          if (!list.includes(entry)) list.push(entry);
          strictIndex.set(sn, list);
        }
        const ln = normalizeLooseName(n);
        if (ln) {
          const list = looseIndex.get(ln) || [];
          if (!list.includes(entry)) list.push(entry);
          looseIndex.set(ln, list);
        }
      }
    }
    strictCandidatesByFeed.set(tag, strictIndex);
    looseCandidatesByFeed.set(tag, looseIndex);
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

    const { preferredFeeds, strictRegionOnly, countryCode } = getChannelRoutingHints(ch);
    const searchOrderFeeds = strictRegionOnly
      ? preferredFeeds
      : Array.from(new Set([...preferredFeeds, ...feeds.map((f) => f?.tag).filter(Boolean) as FeedTag[]]));

    // 1. Exact Provider Stream ID mappings (Pluto / Roku / Samsung STVP / Plex Part UUID)
    const providerIds = extractProviderXmltvIds(ch.url);
    for (const pid of providerIds) {
      const feedCheckOrder = pid.feed
        ? pid.feed === 'pluto_api'
          ? ['pluto_api' as FeedTag, 'pluto' as FeedTag, ...searchOrderFeeds.filter((t) => t !== 'pluto_api' && t !== 'pluto')]
          : [pid.feed, ...searchOrderFeeds.filter((t) => t !== pid.feed)]
        : searchOrderFeeds;
      for (const tag of feedCheckOrder) {
        const feed = feedsByTag.get(tag);
        if (feed?.programmes.has(pid.id)) {
          matchedFeed = tag;
          matchedXmlId = pid.id;
          break;
        }
      }
      if (matchedXmlId) break;
    }

    // 2. Explicit XMLTV channel ID overrides
    if (!matchedXmlId) {
      const explicitList = EXPLICIT_XMLTV_CHANNEL_IDS[ch.id] || [];
      for (const targetId of [ch.id, ...explicitList]) {
        for (const tag of searchOrderFeeds) {
          const feed = feedsByTag.get(tag);
          if (feed?.programmes.has(targetId)) {
            matchedFeed = tag;
            matchedXmlId = targetId;
            break;
          }
        }
        if (matchedXmlId) break;
      }
    }

    // 3. Exact strict normalized display-name match respecting regional & provider priority
    const nameVariants = [
      ch.name,
      stripCircledSymbols(ch.name).replace(/^(Pluto TV |Roku |Samsung )/i, '').trim(),
    ];

    const tryMatchByNormalizer = (indexMap: Map<FeedTag, Map<string, CandidateEntry[]>>, normFn: (s: string) => string) => {
      for (const rawName of nameVariants) {
        const targetNorm = normFn(rawName);
        if (!targetNorm) continue;
        for (const tag of searchOrderFeeds) {
          const idx = indexMap.get(tag);
          const list = idx?.get(targetNorm);
          if (!list?.length) continue;
          const sorted = [...list]
            .map((entry) => ({ entry, score: scoreCandidateForChannel(entry, ch, countryCode) }))
            .sort((a, b) => b.score - a.score);
          const best = sorted[0];
          if (best && best.score >= -50) {
            matchedFeed = best.entry.feedTag;
            matchedXmlId = best.entry.xmlId;
            return true;
          }
        }
      }
      return false;
    };

    if (!matchedXmlId) {
      tryMatchByNormalizer(strictCandidatesByFeed, normalizeStrictName);
    }
    if (!matchedXmlId && !strictRegionOnly) {
      tryMatchByNormalizer(looseCandidatesByFeed, normalizeLooseName);
    }

    if (matchedXmlId && matchedFeed) {
      tvgIds[ch.id] = matchedXmlId;
      const rawPrograms = programmesByFeedAndXmlId.get(`${matchedFeed}::${matchedXmlId}`) || [];
      if (rawPrograms.length) {
        byChannelId[ch.id] = dedupeAndSortProgrammes(rawPrograms);
      }
    } else {
      // Ensure every channel always has a curated channel-aware schedule stored in cache too
      const cls = classifyChannel(ch);
      byChannelId[ch.id] = buildChannelFallbackSchedule({
        id: ch.id,
        name: ch.name,
        category: cls.category || ch.category,
        subType: cls.subType,
        description: ch.description,
      });
      tvgIds[ch.id] = ch.id;
    }
  }

  return { byChannelId, tvgIds };
}

export async function refreshEpgCache(customUrls?: string[], force = false): Promise<void> {
  if (!force && lastUpdatedAt > 0 && Date.now() - lastUpdatedAt < REFRESH_TTL_MS && !customUrls?.length) return;
  if (activeRefreshPromise && !customUrls?.length) return activeRefreshPromise;

  const run = async () => {
    const now = Date.now();
    const windowStart = now - 30 * 60_000;
    const windowEnd = now + 36 * 3600_000;
    const sources: FeedSource[] = [
      ...(customUrls || []).map((url) => ({ tag: 'custom' as FeedTag, url })),
      ...DEFAULT_XMLTV_FEEDS,
    ];
    const [plutoApiFeed, parsedFeeds, selectiveFeeds, adultSwimProgs] = await Promise.all([
      fetchPlutoApiFeed(windowStart, windowEnd),
      fetchFeedsWithConcurrency(sources, windowStart, windowEnd, MAX_CONCURRENT_FEEDS),
      Promise.all(SELECTIVE_STREAM_FEEDS.map((s) => fetchSelectiveXmltvStream(s, windowStart, windowEnd))),
      fetchAdultSwimSchedule(),
    ]);
    const { byChannelId, tvgIds } = buildChannelScheduleMap([plutoApiFeed, ...parsedFeeds, ...selectiveFeeds], adultSwimProgs);
    if (Object.keys(byChannelId).length) {
      cachedProgramsByChannelId = { ...cachedProgramsByChannelId, ...byChannelId };
      cachedTvgIdMap = { ...cachedTvgIdMap, ...tvgIds };
      lastUpdatedAt = Date.now();
      saveEpgToDisk();
      console.log(`📺 [EPG] Mapped schedules for ${Object.keys(cachedProgramsByChannelId).length}/${TV_CHANNELS.length} channels`);
      prewarmTmdbRatingsInBackground();
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
  for (const ch of TV_CHANNELS) {
    const cachedList = cachedProgramsByChannelId[ch.id];
    const hasUpcoming = cachedList?.some((p) => p.stop > nowMs);
    const cls = classifyChannel(ch);
    const fallbackList = buildChannelFallbackSchedule(
      { id: ch.id, name: ch.name, category: cls.category || ch.category, subType: cls.subType, description: ch.description },
      nowMs
    );
    const list = hasUpcoming ? cachedList : fallbackList;
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
    if (!nowProg && nextProg && fallbackList.length > 0) {
      const fbNow = fallbackList.find((p) => p.start <= nowMs && nowMs < p.stop) || fallbackList[0];
      nowProg = { ...fbNow, start: Math.min(fbNow.start, nowMs), stop: nextProg.start };
    }
    if (nowProg && !nextProg && fallbackList.length > 0) {
      const fbNext = fallbackList.find((p) => p.start >= nowProg!.stop) || fallbackList[1] || fallbackList[0];
      nextProg = { ...fbNext, start: nowProg.stop, stop: Math.max(nowProg.stop + 1800_000, fbNext.stop) };
    }
    if (!nowProg && !nextProg && fallbackList.length > 0) {
      nowProg = fallbackList[0];
      nextProg = fallbackList[1] || fallbackList[0];
    }
    if (nowProg || nextProg) {
      programs[ch.id] = { ...(nowProg ? { now: nowProg } : {}), ...(nextProg ? { next: nextProg } : {}) };
    }
  }
  return { updatedAt: lastUpdatedAt, programs };
}

export function getMappedTvgId(channel: TVChannel): string {
  return cachedTvgIdMap[channel.id] || channel.id;
}

function ensureFreshEpg(): void {
  const now = Date.now();
  if (now - lastUpdatedAt < REFRESH_TTL_MS) return;
  if (now - lastRefreshAttemptAt < REFRESH_RETRY_MS) return;
  lastRefreshAttemptAt = now;
  refreshEpgCache().catch(() => {});
}

export function initEpgRoutes(app: express.Express) {
  loadEpgFromDisk();
  ensureFreshEpg();

  app.get('/api/epg/now-next', async (req, res) => {
    try {
      const customUrl = typeof req.query.epgUrl === 'string' ? req.query.epgUrl.trim() : '';
      if (customUrl) {
        refreshEpgCache([customUrl], true).catch(() => {});
      } else {
        ensureFreshEpg();
      }
      res.setHeader('Cache-Control', 'public, max-age=30');
      res.json(await withTmdbRatings(getNowNextSnapshot()));
    } catch {
      res.status(500).json({ error: 'Failed to load EPG guide', programs: {} });
    }
  });

  app.post('/api/epg/refresh', async (req, res) => {
    try {
      const epgUrl = typeof req.body?.epgUrl === 'string' ? req.body.epgUrl.trim() : '';
      await refreshEpgCache(epgUrl ? [epgUrl] : undefined, true);
      res.json(await withTmdbRatings(getNowNextSnapshot()));
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'EPG refresh failed' });
    }
  });
}
