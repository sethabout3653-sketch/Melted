import { EsrbRatingCode, GameRatingInfo } from '../types/game';

export const ESRB_ORIGIN = 'https://www.esrb.org';
export const ESRB_SEARCH_ENDPOINT = 'https://www.esrb.org/wp-json/esrb/v1/search';

export const OFFICIAL_ESRB_IMAGE_PATHS: Record<EsrbRatingCode, string> = {
  E: '/wp-content/themes/esrb/assets/images/E.svg',
  'E10+': '/wp-content/themes/esrb/assets/images/E10+.svg',
  T: '/wp-content/themes/esrb/assets/images/T.svg',
  M: '/wp-content/themes/esrb/assets/images/M.svg',
  AO: '/wp-content/themes/esrb/assets/images/AO.svg',
  RP: '/wp-content/themes/esrb/assets/images/RP.svg',
};

export interface ParsedEsrbResult {
  title: string;
  esrbUrl: string;
  platforms: string;
  code: EsrbRatingCode;
  label: string;
  badgePath: string;
  descriptors: string;
  interactiveElements: string;
  synopsis: string;
}

export function decodeHtmlEntities(input: string): string {
  return String(input || '')
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&rdquo;|&ldquo;|&quot;/g, '"')
    .replace(/&ndash;|&mdash;/g, '-')
    .replace(/&amp;/g, '&')
    .replace(/&trade;/g, '')
    .replace(/&reg;/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

export function normalizeEsrbTitle(title: string): string {
  return decodeHtmlEntities(title)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[™®©]/g, '')
    .replace(/['’`]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function normalizeRatingLookupKey(title: string): string {
  return normalizeEsrbTitle(cleanGameTitleForEsrbQuery(title)).replace(/\s+/g, '');
}

export function cleanGameTitleForEsrbQuery(title: string): string {
  return String(title || '')
    .replace(
      /\s*[\(\[][^)\]]*(?:flash|html5|webgl|port|n64|gba|nds|nes|snes|psx|ps1|dos|arcade|unofficial|clone|infinite|unblocked|usa|europe|japan|world|rev\s*\d+)[^)\]]*[\)\]]\s*/gi,
      ' '
    )
    .replace(/\s+(?:alpha|beta)?\s*v?\d+\.\d+\.\d+(?:\s*(?:beta|alpha))?$/gi, '')
    .replace(/\s+(?:html5|webgl|flash|pico-8)$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripEditionWords(normalizedTitle: string): string {
  return normalizedTitle
    .replace(
      /\b(version|edition|deluxe|complete|ultimate|definitive|enhanced|remastered|remake|hd|vr|3d|plus|dx|goty|game of the year|collection|trilogy|replanted|classic|anniversary|special|standard|digital|bundle|pack|core)\b/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseEsrbCodeFromBadge(badgePath: string, altLabel?: string): EsrbRatingCode | null {
  const pathMatch = badgePath.match(/\/(E10\+|E10plus|E|T|M|AO|RP)(?:\.(?:svg|png))?$/i);
  if (pathMatch) {
    const raw = pathMatch[1].toUpperCase();
    if (raw === 'E10PLUS' || raw === 'E10+') return 'E10+';
    if (raw === 'E' || raw === 'T' || raw === 'M' || raw === 'AO' || raw === 'RP') return raw;
  }
  const alt = (altLabel || '').toLowerCase().trim();
  if (alt === 'everyone') return 'E';
  if (alt === 'everyone 10+') return 'E10+';
  if (alt === 'teen') return 'T';
  if (alt === 'mature 17+' || alt === 'mature') return 'M';
  if (alt === 'adults only 18+' || alt === 'adults only') return 'AO';
  if (alt.startsWith('rating pending')) return 'RP';
  return null;
}

export function getEsrbLabelForCode(code: EsrbRatingCode): string {
  switch (code) {
    case 'E':
      return 'Everyone';
    case 'E10+':
      return 'Everyone 10+';
    case 'T':
      return 'Teen';
    case 'M':
      return 'Mature 17+';
    case 'AO':
      return 'Adults Only 18+';
    case 'RP':
      return 'Rating Pending';
  }
}

export function parseEsrbSearchHtml(html: string): ParsedEsrbResult[] {
  if (!html || typeof html !== 'string') return [];
  const blocks = html.split('<div class="game">').slice(1);
  const results: ParsedEsrbResult[] = [];

  for (const block of blocks) {
    const linkMatch = block.match(/<h2>\s*<a\s+href="([^"]+)">([\s\S]*?)<\/a>\s*<\/h2>/i);
    if (!linkMatch) continue;

    const esrbUrl = linkMatch[1].trim();
    const title = decodeHtmlEntities(linkMatch[2].replace(/<[^>]+>/g, ''));

    const tableImgMatch = block.match(/<td>\s*<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"/i);
    const headingImgMatch = block.match(/<div class="heading">[\s\S]*?<img[^>]+src="([^"]+)"/i);
    const rawBadgePath = (tableImgMatch?.[1] || headingImgMatch?.[1] || '').trim();
    const rawAlt = decodeHtmlEntities(tableImgMatch?.[2] || '');

    if (!rawBadgePath) continue;
    const badgePath = rawBadgePath.startsWith('https://www.esrb.org')
      ? rawBadgePath.slice('https://www.esrb.org'.length)
      : rawBadgePath;

    const code = parseEsrbCodeFromBadge(badgePath, rawAlt);
    if (!code) continue;

    const platformsMatch = block.match(/<div class="platforms">([\s\S]*?)<\/div>/i);
    const platforms = platformsMatch ? decodeHtmlEntities(platformsMatch[1].replace(/<[^>]+>/g, '')) : '';

    const tds = [...block.matchAll(/<td>([\s\S]*?)<\/td>/gi)].map((m) =>
      decodeHtmlEntities(
        m[1]
          .replace(/<br\s*\/?>/gi, ', ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s*,\s*,+/g, ',')
          .replace(/\s+/g, ' ')
          .replace(/^,\s*|,\s*$/g, '')
          .trim()
      )
    );

    const rawDescriptors = (tds[1] || '').trim();
    const descriptors = /^no\s+content\s+descriptors$/i.test(rawDescriptors) ? '' : rawDescriptors;

    const rawInteractive = (tds[2] || '').trim();
    const interactiveElements = /^no\s+interactive\s+elements$/i.test(rawInteractive) ? '' : rawInteractive;

    const synopsisMatch = block.match(/<div class="synopsis">([\s\S]*?)<\/div>/i);
    const synopsis = synopsisMatch
      ? decodeHtmlEntities(synopsisMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '))
      : '';

    results.push({
      title,
      esrbUrl,
      platforms,
      code,
      label: rawAlt || getEsrbLabelForCode(code),
      badgePath,
      descriptors,
      interactiveElements,
      synopsis,
    });
  }

  return results;
}

export function pickBestEsrbMatch(
  gameName: string,
  candidates: ParsedEsrbResult[]
): ParsedEsrbResult | null {
  if (!candidates || candidates.length === 0) return null;

  const cleaned = cleanGameTitleForEsrbQuery(gameName);
  const qNorm = normalizeEsrbTitle(cleaned);
  const qCompact = qNorm.replace(/\s+/g, '');
  if (!qNorm || qCompact.length < 2) return null;

  const qBase = stripEditionWords(qNorm);
  const qBaseCompact = qBase.replace(/\s+/g, '');

  let best: ParsedEsrbResult | null = null;
  let bestScore = 0;

  for (const cand of candidates) {
    const rawSegments = [cand.title, ...cand.title.split(/[\/+]/).map((s) => s.trim()).filter(Boolean)];
    for (let sIdx = 0; sIdx < rawSegments.length; sIdx++) {
      const seg = rawSegments[sIdx];
      const rNorm = normalizeEsrbTitle(seg);
      const rCompact = rNorm.replace(/\s+/g, '');
      const rBase = stripEditionWords(rNorm);
      const rBaseCompact = rBase.replace(/\s+/g, '');
      const isBundleSeg = sIdx > 0;

      let score = 0;
      if (rNorm === qNorm) {
        score = isBundleSeg ? 94 : 100;
      } else if (rCompact === qCompact) {
        score = isBundleSeg ? 91 : 96;
      } else if (qBase && rBase === qBase) {
        score = isBundleSeg ? 87 : 92;
      } else if (qBaseCompact.length >= 3 && rBaseCompact === qBaseCompact) {
        score = isBundleSeg ? 85 : 90;
      } else if (
        !isBundleSeg &&
        qCompact.length >= 4 &&
        rNorm.startsWith(qNorm + ' ') &&
        stripEditionWords(rNorm.slice(qNorm.length)).length === 0
      ) {
        score = 88;
      }

      if (score > bestScore) {
        bestScore = score;
        best = cand;
      }
    }
  }

  return best;
}

export function buildEsrbProxyImageUrl(badgePath: string): string {
  const clean = badgePath.startsWith('/') ? badgePath : `/${badgePath}`;
  return `/api/esrb/image?src=${encodeURIComponent(clean)}`;
}

export function buildGameRatingInfoFromEsrb(match: ParsedEsrbResult): GameRatingInfo {
  const badgePath = match.badgePath || OFFICIAL_ESRB_IMAGE_PATHS[match.code];
  const officialBadgeUrl = `${ESRB_ORIGIN}${badgePath.startsWith('/') ? badgePath : `/${badgePath}`}`;
  const badgeUrl = buildEsrbProxyImageUrl(badgePath);

  const requiresGate = match.code === 'M' || match.code === 'AO';
  const gateMinAge = match.code === 'AO' ? '18+' : match.code === 'M' ? '17+' : undefined;
  const age =
    match.code === 'AO'
      ? '18+'
      : match.code === 'M'
      ? '17+'
      : match.code === 'T'
      ? '13+'
      : match.code === 'E10+'
      ? '10+'
      : undefined;

  const specialTags = match.descriptors
    ? match.descriptors
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return {
    code: match.code,
    label: match.label || getEsrbLabelForCode(match.code),
    age,
    descriptors: match.descriptors || undefined,
    interactiveElements: match.interactiveElements || undefined,
    synopsis: match.synopsis || undefined,
    esrbTitle: match.title,
    esrbUrl: match.esrbUrl,
    badgePath,
    badgeUrl,
    officialBadgeUrl,
    requiresGate,
    gateMinAge,
    specialTags,
    warningMessage: match.synopsis || undefined,
    source: 'esrb',
  };
}

export function isValidEsrbBadgePath(pathOrUrl: string): string | null {
  let clean = String(pathOrUrl || '').trim();
  if (!clean) return null;
  if (clean.startsWith(ESRB_ORIGIN)) {
    clean = clean.slice(ESRB_ORIGIN.length);
  }
  if (!clean.startsWith('/wp-content/')) return null;
  if (clean.includes('..') || clean.includes('\\')) return null;
  if (!/\.(svg|png|webp|jpg|jpeg)$/i.test(clean)) return null;
  return clean;
}

export interface EsrbFetchResult {
  status: 'matched' | 'unrated' | 'unavailable';
  rating: GameRatingInfo | null;
}

export async function fetchEsrbRatingDetailed(gameName: string): Promise<EsrbFetchResult> {
  const query = cleanGameTitleForEsrbQuery(gameName);
  if (!query || normalizeEsrbTitle(query).replace(/\s+/g, '').length < 2) {
    return { status: 'unrated', rating: null };
  }

  try {
    const url = `${ESRB_SEARCH_ENDPOINT}?searchKeyword=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return { status: 'unavailable', rating: null };
    }
    const data = (await res.json()) as { html_results?: string; code?: string };
    if (typeof data?.html_results !== 'string') {
      return { status: 'unavailable', rating: null };
    }
    const parsed = parseEsrbSearchHtml(data.html_results);
    const best = pickBestEsrbMatch(gameName, parsed);
    if (!best) {
      return { status: 'unrated', rating: null };
    }
    return { status: 'matched', rating: buildGameRatingInfoFromEsrb(best) };
  } catch {
    return { status: 'unavailable', rating: null };
  }
}

export async function fetchEsrbRatingForTitle(gameName: string): Promise<GameRatingInfo | null> {
  const res = await fetchEsrbRatingDetailed(gameName);
  return res.rating;
}
