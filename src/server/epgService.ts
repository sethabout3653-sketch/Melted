import fs from 'fs';
import path from 'path';
import express from 'express';
import zlib from 'zlib';
import { TV_CHANNELS, TVChannel } from '../data/channels';

export interface EpgProgramme {
  title: string;
  start: number;
  stop: number;
  desc?: string;
  rating?: string;
  category?: string;
  episode?: string;
}

export interface ChannelNowNext {
  now?: EpgProgramme;
  next?: EpgProgramme;
}

type FeedTag =
  | 'custom'
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
  normNames: Set<string>;
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
  'bbchome-us-8caaf': ['plex.tv.BBC.Home.&.Garden.plex', 'b04b170e5f085586985358512adbdb9f', 'CABD1200012B8'],
  'black-cinema-ed435': ['plex.tv.Maverick.Black.Cinema.plex', '834e2a09799752b3be7ecaab726b7242'],
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
  'fast-dawson-s-creek-party-of-five': ['plex.tv.Dawsons.Creek.and.Party.of.Five.plex'],
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
  'abckids-au-r2v': ['ABCFamilyPerth.au', 'ABCKids.au', 'ABC.Kids.au'],
  'abcme-au-2d1': ['ABCEntertainsPerth.au', 'ABCME.au', 'ABC.Me.au'],
  'rteone-ie-661f5': ['RTE.One.HD.ie', 'RTEOne.ie'],
  'rtenews-ie-f6362': ['RTE.News.ie', 'RTENews.ie'],
  'virginmediaone-ie-2e599': ['Virgin.Media.One.HD.ie', 'VirginMediaOne.ie'],
  'virginmediatwo-ie-42929': ['Virgin.Media.Two.HD.ie', 'VirginMediaTwo.ie'],
  'virginmediathree-ie-57ef4': ['Virgin.Media.Three.HD.ie', 'VirginMediaThree.ie'],
  'cpacenglish-ca-2f417': ['[CPAC].Cable.Public.Affairs.Channel.HD.ca2', 'CPAC.(English).ca2', 'CPAC.English.ca2'],
  'civmdt-ca-8c7aa': ['CIVM-DT.ca2', 'CIVM.ca2'],
  'cbftdt-ca-ca948': ['CBFT.ca2', 'ICI.Radio-Canada.Tele.Montreal.ca2'],
  'bbcscotland-uk-dc635': ['BBCScotland.uk', 'bbcscotland.uk', 'BBC.Scotland.HD.uk'],
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
};

const REFRESH_TTL_MS = 4 * 60 * 60 * 1000;
const MAX_CONCURRENT_FEEDS = 2;
const EPG_DISK_CACHE_PATH = path.join(process.cwd(), '.epg-cache.json');

let cachedProgramsByChannelId: Record<string, EpgProgramme[]> = {};
let cachedTvgIdMap: Record<string, string> = {};
let lastUpdatedAt = 0;
let activeRefreshPromise: Promise<void> | null = null;
let prewarmActive = false;

function loadEpgFromDisk(): boolean {
  try {
    if (fs.existsSync(EPG_DISK_CACHE_PATH)) {
      const raw = fs.readFileSync(EPG_DISK_CACHE_PATH, 'utf8');
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

function saveEpgToDisk(): void {
  try {
    const payload = {
      programs: cachedProgramsByChannelId,
      tvgIds: cachedTvgIdMap,
      lastUpdatedAt,
      tmdbRatings: Array.from(tmdbRatingResults.entries()),
    };
    fs.writeFileSync(EPG_DISK_CACHE_PATH, JSON.stringify(payload), 'utf8');
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

function stripCircledSymbols(name: string): string {
  return name.replace(/[\u24B6-\u24E9]/g, '').trim();
}

function normalizeChannelName(name: string): string {
  return stripCircledSymbols(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\((?:720p|1080p|480p|sd|hd|fhd|uhd|en|english|east|west|us|uk|ca|au|ie|nz|sg)\)/gi, '')
    .replace(/&/g, 'and')
    .replace(/\b(hd|fhd|uhd|sd|tv|channel|us|uk|sg|au|ie|ca|nz|east|west|plus)\b/g, '')
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
  if (plu) out.push({ id: plu, feed: 'pluto' });

  const rok = decoded.match(/rok-([a-f0-9]{24,32})(?:\.m3u8|$)/i)?.[1];
  if (rok) out.push({ id: rok, feed: 'roku' });

  const stvp = decoded.match(/stvp-([A-Za-z0-9]{8,20})/i)?.[1];
  if (stvp) out.push({ id: stvp, feed: 'samsung' });

  const plexPart = decoded.match(/\/library\/parts\/([a-f0-9]+-[a-f0-9]+)/i)?.[1];
  if (plexPart) out.push({ id: plexPart, feed: 'plex' });

  const stitcherPlu = decoded.match(/\/stitch\/embed\/hls\/channel\/([a-f0-9]{24})/i)?.[1];
  if (stitcherPlu) out.push({ id: stitcherPlu, feed: 'pluto' });

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

function normalizeRatingBadge(raw: string): string | undefined {
  const clean = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!clean || clean === 'NA' || clean === 'N/A' || clean === 'NONE' || clean === 'UNRATED' || clean === 'UNKNOWN' || clean === '-') {
    return undefined;
  }
  const table: Record<string, string> = {
    TVY: 'TV-Y',
    'TV-Y': 'TV-Y',
    Y: 'TV-Y',
    C: 'TV-Y',
    P: 'TV-Y',
    TVY7: 'TV-Y7',
    'TV-Y7': 'TV-Y7',
    TVY7FV: 'TV-Y7',
    'TV-Y7-FV': 'TV-Y7',
    Y7: 'TV-Y7',
    C8: 'TV-Y7',
    '7': 'TV-Y7',
    '7+': 'TV-Y7',
    '8': 'TV-Y7',
    'FSK6': 'TV-Y7',
    '6': 'TV-Y7',
    '6+': 'TV-Y7',
    TVG: 'TV-G',
    'TV-G': 'TV-G',
    G: 'G',
    U: 'TV-G',
    AL: 'TV-G',
    ALL: 'TV-G',
    TP: 'TV-G',
    T: 'TV-G',
    L: 'TV-G',
    KT: 'TV-G',
    'FSK0': 'TV-G',
    '0': 'TV-G',
    '3': 'TV-G',
    '4': 'TV-G',
    '5': 'TV-G',
    TVPG: 'TV-PG',
    'TV-PG': 'TV-PG',
    PG: 'PG',
    PG8: 'TV-PG',
    M: 'TV-PG',
    '9': 'TV-PG',
    '10': 'TV-PG',
    '10+': 'TV-PG',
    '11': 'TV-PG',
    '12': 'TV-PG',
    '12+': 'TV-PG',
    '12A': 'PG-13',
    'FSK12': 'TV-PG',
    PG13: 'PG-13',
    'PG-13': 'PG-13',
    '13': 'PG-13',
    '13+': 'PG-13',
    TV14: 'TV-14',
    'TV-14': 'TV-14',
    '14': 'TV-14',
    '14+': 'TV-14',
    '14A': 'TV-14',
    VM14: 'TV-14',
    '15': 'TV-14',
    '15+': 'TV-14',
    '16': 'TV-14',
    '16+': 'TV-14',
    'FSK16': 'TV-14',
    MA15: 'TV-14',
    'MA15+': 'TV-14',
    'AV15+': 'TV-14',
    TVMA: 'TV-MA',
    'TV-MA': 'TV-MA',
    R: 'R',
    NC17: 'NC-17',
    'NC-17': 'NC-17',
    '18': 'TV-MA',
    '18+': 'TV-MA',
    '18A': 'TV-MA',
    'R18+': 'TV-MA',
    M18: 'TV-MA',
    R21: 'TV-MA',
    VM18: 'TV-MA',
    'FSK18': 'TV-MA',
  };
  return table[clean] || (/^(TV-Y|TV-Y7|TV-G|TV-PG|TV-14|TV-MA|G|PG|PG-13|R|NC-17)$/.test(clean) ? clean : undefined);
}

function getDefaultRatingForCategory(category?: string, channelName?: string): string {
  const cat = (category || '').toLowerCase();
  const name = (channelName || '').toLowerCase();
  if (cat.includes('kids') || name.includes('cartoon') || name.includes('kids') || name.includes('family') || cat.includes('animation')) return 'TV-G';
  if (cat.includes('news') || cat.includes('ambiance') || cat.includes('music') || cat.includes('lifestyle') || name.includes('news') || name.includes('radio')) return 'TV-G';
  if (cat.includes('sci-fi') || cat.includes('horror') || cat.includes('crime') || cat.includes('action')) return 'TV-14';
  if (cat.includes('comedy') || cat.includes('entertainment') || cat.includes('series') || cat.includes('movies') || cat.includes('drama') || cat.includes('reality') || cat.includes('game show')) return 'TV-PG';
  return 'TV-PG';
}

function getGuaranteedContentRating(title: string): string | undefined {
  const t = title.toLowerCase();
  if (
    t.includes('south park') ||
    t.includes('rick and morty') ||
    t.includes('family guy') ||
    t.includes('american dad') ||
    t.includes('robot chicken') ||
    t.includes('breaking bad') ||
    t.includes('game of thrones') ||
    t.includes('succession') ||
    t.includes('sopranos') ||
    t.includes('wire') ||
    t.includes('the boys') ||
    t.includes('peacemaker') ||
    t.includes('fargo') ||
    t.includes('dexter') ||
    t.includes('true detective') ||
    t.includes('metalocalypse') ||
    t.includes('aqua teen') ||
    t.includes('superjail') ||
    t.includes('boondocks')
  ) {
    return 'TV-MA';
  }
  if (
    t.includes('enemy of the state') ||
    t.includes('pulp fiction') ||
    t.includes('fight club') ||
    t.includes('terminator') ||
    t.includes('matrix') ||
    t.includes('die hard') ||
    t.includes('deadpool') ||
    t.includes('goodfellas') ||
    t.includes('scarface') ||
    t.includes('godfather') ||
    t.includes('saving private ryan') ||
    t.includes('gladiator') ||
    t.includes('john wick') ||
    t.includes('mad max')
  ) {
    return 'R';
  }
  return undefined;
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

const CHANNEL_BY_ID = new Map<string, TVChannel>(TV_CHANNELS.map((c) => [c.id, c]));

const TMDB_API_KEY = process.env.TMDB_API_KEY || 'e378bd904d6b4952f9261f8f27882a9c';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_TIMEOUT_MS = 8000;
const TMDB_LOOKUP_CONCURRENCY = 8;
const RATING_ENRICH_WAIT_MS = 4000;
const tmdbRatingLookups = new Map<string, Promise<string | undefined>>();
const tmdbRatingResults = new Map<string, string | undefined>();

function normalizeTitleKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function buildSearchTitleVariants(title: string): string[] {
  const clean = decodeXmlEntities(title)
    .replace(/\((?:19|20)\d{2}\)/g, '')
    .replace(/\b(?:new|live|repeat|encore|hd)\b$/i, '')
    .trim();
  const base = clean.split(/[:|–—-]/)[0]?.trim() || clean;
  const variants = [clean, base].filter((s) => s.length >= 2);
  return Array.from(new Set(variants));
}

async function tmdbGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TMDB_BASE}${path}`);
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
      { query, include_adult: 'false', language: 'en-US' },
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
      `/movie/${match.id}/release_dates`,
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

function lookupTmdbRating(title: string): Promise<string | undefined> {
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

function prewarmTmdbRatingsInBackground() {
  if (prewarmActive) return;
  prewarmActive = true;
  (async () => {
    try {
      const snapshot = getNowNextSnapshot();
      const pending = new Set<string>();
      for (const ch of TV_CHANNELS) {
        const entry = snapshot.programs[ch.id];
        if (!entry) continue;
        for (const p of [entry.now, entry.next]) {
          if (!p || p.rating) continue;
          const key = normalizeTitleKey(p.title);
          if (!key || tmdbRatingResults.has(key)) continue;
          // Prioritize TMDB for series, movies, entertainment, anime, horror, sci-fi, comedy
          const isNewsOrRadioOnly = /\b(live broadcast|radio|weather|oireachtas|parliament|test cricket|bulletin)\b/i.test(p.title);
          if (!isNewsOrRadioOnly) {
            pending.add(p.title);
          }
        }
      }
      const queue = [...pending];
      const worker = async () => {
        while (queue.length) {
          const title = queue.shift()!;
          await lookupTmdbRating(title);
        }
      };
      await Promise.all(Array.from({ length: Math.min(8, queue.length) }, worker));
    } catch {
      // ignore prewarm failures
    } finally {
      prewarmActive = false;
    }
  })();
}

async function withTmdbRatings(snapshot: ReturnType<typeof getNowNextSnapshot>): Promise<ReturnType<typeof getNowNextSnapshot>> {
  const pendingTitles = new Set<string>();
  for (const ch of TV_CHANNELS) {
    const entry = snapshot.programs[ch.id];
    if (!entry) continue;
    for (const programme of [entry.now, entry.next]) {
      if (programme && !programme.rating) {
        const key = normalizeTitleKey(programme.title);
        if (key && !tmdbRatingResults.has(key)) {
          // Always try TMDB first for scripted/VOD/entertainment titles
          const isObviousLiveRadio = /\b(live broadcast|radio|weather|oireachtas)\b/i.test(programme.title);
          if (!isObviousLiveRadio) {
            pendingTitles.add(programme.title);
          }
        }
      }
    }
  }

  const queue = [...pendingTitles].slice(0, 48);
  if (queue.length) {
    // Run TMDB lookups completely non-blocking in background
    setTimeout(() => {
      const worker = async () => {
        while (queue.length) {
          const t = queue.shift();
          if (t) await lookupTmdbRating(t);
        }
      };
      Promise.all(Array.from({ length: Math.min(TMDB_LOOKUP_CONCURRENCY, queue.length) }, worker)).catch(() => {});
    }, 10);
  }

  const applyRating = (programme?: EpgProgramme, channelCategory?: string, channelName?: string): EpgProgramme | undefined => {
    if (!programme) return undefined;
    const { category: _cat, ...rest } = programme;
    
    const guaranteed = getGuaranteedContentRating(programme.title);
    if (guaranteed) {
      return { ...rest, rating: guaranteed };
    }

    if (programme.rating && programme.rating.toLowerCase() !== 'none' && programme.rating.toLowerCase() !== 'n/a' && programme.rating !== 'TV-PG') {
      return rest;
    }
    const tmdbRating = tmdbRatingResults.get(normalizeTitleKey(programme.title));
    const fallbackRating = getDefaultRatingForCategory(programme.category || channelCategory, channelName);
    return { ...rest, rating: tmdbRating || fallbackRating };
  };

  const programs: Record<string, ChannelNowNext> = {};
  for (const [channelId, entry] of Object.entries(snapshot.programs)) {
    const ch = CHANNEL_BY_ID.get(channelId);
    const now = applyRating(entry.now, ch?.category, ch?.name);
    const next = applyRating(entry.next, ch?.category, ch?.name);
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
      if (attempt < retries) await sleep(600 * (attempt + 1));
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
} {
  const cat = (ch.category || '').trim();
  const id = ch.id.toLowerCase();

  if (cat === 'Australia' || /-au-/.test(id)) {
    return { preferredFeeds: ['au_syd', 'au', 'custom'], strictRegionOnly: true };
  }
  if (cat === 'Ireland' || /-ie-/.test(id)) {
    return { preferredFeeds: ['ie', 'uk', 'freeview', 'custom'], strictRegionOnly: true };
  }
  if (cat === 'New Zealand' || /-nz-/.test(id)) {
    return { preferredFeeds: ['nz', 'au_syd', 'au', 'custom'], strictRegionOnly: true };
  }
  if (cat === 'UK' || /-uk-/.test(id)) {
    return { preferredFeeds: ['freeview', 'uk', 'samsung', 'pluto', 'plex', 'plex1', 'custom'], strictRegionOnly: true };
  }
  if (cat === 'Canada' || /-ca-/.test(id)) {
    return { preferredFeeds: ['ca', 'samsung', 'pluto', 'plex', 'plex1', 'custom'], strictRegionOnly: true };
  }
  if (id.startsWith('pluto-')) {
    return { preferredFeeds: ['pluto', 'samsung', 'plex', 'plex1', 'roku', 'us', 'custom'], strictRegionOnly: false };
  }
  if (id.startsWith('samsung-')) {
    return { preferredFeeds: ['samsung', 'pluto', 'plex', 'plex1', 'roku', 'us', 'custom'], strictRegionOnly: false };
  }
  if (id.startsWith('roku-')) {
    return { preferredFeeds: ['roku', 'samsung', 'pluto', 'plex', 'plex1', 'us', 'custom'], strictRegionOnly: false };
  }
  if (id.startsWith('fast-')) {
    return { preferredFeeds: ['plex', 'plex1', 'pluto', 'samsung', 'roku', 'distrotv', 'us', 'custom'], strictRegionOnly: false };
  }
  return {
    preferredFeeds: ['custom', 'us', 'pluto', 'samsung', 'plex', 'plex1', 'roku', 'distrotv', 'au_syd', 'uk', 'freeview', 'ca', 'sg'],
    strictRegionOnly: false,
  };
}

function buildMetadataFallbackSchedule(ch: TVChannel, nowMs: number = Date.now()): EpgProgramme[] {
  const hourStart = Math.floor(nowMs / 3600_000) * 3600_000;
  const hourEnd = hourStart + 3600_000;
  const nextEnd = hourEnd + 3600_000;
  const cleanName = stripCircledSymbols(ch.name);
  const cat = (ch.category || '').trim();
  const isRadio = /\b(fm|radio|newstalk|spin 103|classic hits)\b/i.test(cleanName);
  const isNews = cat === 'News' || /\b(news|oireachtas|al jazeera)\b/i.test(cleanName);

  if (ch.id === 'pbs-kids') {
    const pbsShows = [
      { title: "Daniel Tiger's Neighborhood", desc: "Explore life's little lessons with Daniel Tiger and friends." },
      { title: "Curious George", desc: "Join everyone's favorite curious monkey on educational adventures." },
      { title: "Wild Kratts", desc: "Chris and Martin Kratt dive into creature habitats around the world." },
      { title: "Alma's Way", desc: "Alma Rivera speaks up, listens to others, and solves problems in the Bronx." },
      { title: "Lyla in the Loop", desc: "Lyla, her blue sidekick Stu, and her family tackle creative problem-solving." },
      { title: "Work It Out Wombats!", desc: "Malik, Zadie, and Hamilton practice computational thinking in the Treeborhood." },
      { title: "Pinkalicious & Peterrific", desc: "Inspiring kids to engage in the arts and self-expression." },
      { title: "Elinor Wonders Why", desc: "Elinor and her pals explore nature, curiosity, and asking why." },
      { title: "Donkey Hodie", desc: "Empowering preschoolers to be resourceful and resilient problem solvers." },
      { title: "Xavier Riddle and the Secret Museum", desc: "Xavier and friends travel back in time to meet historical heroes." },
      { title: "Molly of Denali", desc: "Molly shares her life in rural Alaska with humor and resourcefulness." },
      { title: "Arthur", desc: "Classic animated adventures with Arthur Read and friends in Elwood City." }
    ];
    const currentHourIndex = Math.floor(nowMs / 3600_000);
    const nowShow = pbsShows[currentHourIndex % pbsShows.length];
    const nextShow = pbsShows[(currentHourIndex + 1) % pbsShows.length];
    const laterShow = pbsShows[(currentHourIndex + 2) % pbsShows.length];

    return [
      {
        title: nowShow.title,
        start: hourStart,
        stop: hourEnd,
        desc: nowShow.desc,
        category: 'Family',
        rating: 'TV-Y',
      },
      {
        title: nextShow.title,
        start: hourEnd,
        stop: nextEnd,
        desc: nextShow.desc,
        category: 'Family',
        rating: 'TV-Y',
      },
      {
        title: laterShow.title,
        start: nextEnd,
        stop: nextEnd + 3600_000,
        desc: laterShow.desc,
        category: 'Family',
        rating: 'TV-Y',
      }
    ];
  }

  let nowTitle = `${cleanName} Live Broadcast`;
  let nextTitle = `${cleanName} Continuing Broadcast`;

  if (isRadio) {
    nowTitle = `${cleanName} — Live Radio`;
    nextTitle = `${cleanName} — Continuous Music & Talk`;
  } else if (isNews) {
    nowTitle = `${cleanName} — Live Coverage`;
    nextTitle = `${cleanName} — News & Analysis`;
  } else if (cat === 'Kids') {
    nowTitle = `${cleanName} — Kids Programming`;
    nextTitle = `${cleanName} — Family Favorites`;
  } else if (cat === 'Sports') {
    nowTitle = `${cleanName} — Sports & Highlights`;
    nextTitle = `${cleanName} — Action Replay`;
  } else if (cat === 'Documentary' || cat === 'Gaming & Tech') {
    nowTitle = `${cleanName} — Featured Programming`;
    nextTitle = `${cleanName} — Upcoming Feature`;
  } else if (cat === 'Comedy' || cat === 'Sci-Fi & Horror' || cat === 'Series' || cat === 'Movies' || cat === 'VOD Movies (EN)') {
    nowTitle = `${cleanName} — Continuous Feature`;
    nextTitle = `${cleanName} — Next Showcase`;
  }

  const defaultRating = getDefaultRatingForCategory(ch.category, cleanName);

  return [
    {
      title: nowTitle,
      start: hourStart,
      stop: hourEnd,
      desc: ch.description || `Live programming on ${cleanName}.`,
      category: ch.category,
      rating: defaultRating,
    },
    {
      title: nextTitle,
      start: hourEnd,
      stop: nextEnd,
      desc: ch.description || `Continuing broadcast on ${cleanName}.`,
      category: ch.category,
      rating: defaultRating,
    },
  ];
}

function buildChannelScheduleMap(feeds: ParsedFeed[], adultSwimProgs: EpgProgramme[]) {
  const feedsByTag = new Map<FeedTag, ParsedFeed>();
  const programmesByFeedAndXmlId = new Map<string, EpgProgramme[]>();
  const candidatesByFeed = new Map<FeedTag, Map<string, CandidateEntry>>();

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
    const feedIndex = new Map<string, CandidateEntry>();
    for (const [xmlId, progs] of feed.programmes) {
      programmesByFeedAndXmlId.set(`${tag}::${xmlId}`, progs);
    }
    for (const [xmlId, names] of feed.channels) {
      if (!feed.programmes.has(xmlId)) continue;
      const normNames = new Set<string>();
      for (const n of names) {
        const nn = normalizeChannelName(n);
        if (nn) normNames.add(nn);
      }
      const entry: CandidateEntry = { xmlId, feedTag: tag, names, normNames };
      for (const nn of normNames) {
        if (!feedIndex.has(nn)) feedIndex.set(nn, entry);
      }
    }
    candidatesByFeed.set(tag, feedIndex);
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

    const { preferredFeeds, strictRegionOnly } = getChannelRoutingHints(ch);
    const searchOrderFeeds = strictRegionOnly
      ? preferredFeeds
      : Array.from(new Set([...preferredFeeds, ...feeds.map((f) => f?.tag).filter(Boolean) as FeedTag[]]));

    // 1. Exact Provider Stream ID mappings (Pluto / Roku / Samsung STVP / Plex Part UUID)
    const providerIds = extractProviderXmltvIds(ch.url);
    for (const pid of providerIds) {
      const feedCheckOrder = pid.feed ? [pid.feed, ...searchOrderFeeds.filter((t) => t !== pid.feed)] : searchOrderFeeds;
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

    // 3. Exact normalized display-name match respecting regional / provider feed priority
    if (!matchedXmlId) {
      const nameVariants = [
        ch.name,
        stripCircledSymbols(ch.name).replace(/^(Pluto TV |Roku |Samsung )/i, '').trim(),
      ];
      for (const rawName of nameVariants) {
        const targetNorm = normalizeChannelName(rawName);
        if (!targetNorm) continue;
        for (const tag of searchOrderFeeds) {
          const idx = candidatesByFeed.get(tag);
          const candidate = idx?.get(targetNorm);
          if (candidate) {
            matchedFeed = candidate.feedTag;
            matchedXmlId = candidate.xmlId;
            break;
          }
        }
        if (matchedXmlId) break;
      }
    }

    if (matchedXmlId && matchedFeed) {
      tvgIds[ch.id] = matchedXmlId;
      const rawPrograms = programmesByFeedAndXmlId.get(`${matchedFeed}::${matchedXmlId}`) || [];
      if (rawPrograms.length) {
        byChannelId[ch.id] = dedupeAndSortProgrammes(rawPrograms);
      }
    }
    if (!byChannelId[ch.id]?.length) {
      byChannelId[ch.id] = buildMetadataFallbackSchedule(ch);
      if (!tvgIds[ch.id]) tvgIds[ch.id] = ch.id;
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
    const [parsedFeeds, selectiveFeeds, adultSwimProgs] = await Promise.all([
      fetchFeedsWithConcurrency(sources, windowStart, windowEnd, MAX_CONCURRENT_FEEDS),
      Promise.all(SELECTIVE_STREAM_FEEDS.map((s) => fetchSelectiveXmltvStream(s, windowStart, windowEnd))),
      fetchAdultSwimSchedule(),
    ]);
    const { byChannelId, tvgIds } = buildChannelScheduleMap([...parsedFeeds, ...selectiveFeeds], adultSwimProgs);
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
    const list = cachedProgramsByChannelId[ch.id] || buildMetadataFallbackSchedule(ch, nowMs);
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
    if (!nowProg && !nextProg && list.length > 0) {
      nowProg = list[0];
      nextProg = list[1] || list[0];
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

export function initEpgRoutes(app: express.Express) {
  // 1. Instant disk hydration
  loadEpgFromDisk();

  // 2. Pre-fill any missing channels with baseline schedule so snapshot is never empty
  for (const ch of TV_CHANNELS) {
    if (!cachedProgramsByChannelId[ch.id] || cachedProgramsByChannelId[ch.id].length === 0) {
      cachedProgramsByChannelId[ch.id] = buildMetadataFallbackSchedule(ch);
    }
  }

  // 3. Kick off background refresh only if cache is completely empty
  const hasHydratedChannels = Object.keys(cachedProgramsByChannelId).length > 0;
  if (!hasHydratedChannels && (lastUpdatedAt === 0 || Date.now() - lastUpdatedAt >= REFRESH_TTL_MS)) {
    refreshEpgCache().catch(() => {});
  }

  app.get('/api/epg/now-next', async (req, res) => {
    try {
      const customUrl = typeof req.query.epgUrl === 'string' ? req.query.epgUrl.trim() : '';
      if (customUrl) {
        refreshEpgCache([customUrl], true).catch(() => {});
      } else if (!hasHydratedChannels && (lastUpdatedAt === 0 || Date.now() - lastUpdatedAt >= REFRESH_TTL_MS)) {
        refreshEpgCache().catch(() => {});
      }
      res.setHeader('Cache-Control', 'public, max-age=30');
      // Instant non-blocking response from memory
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
