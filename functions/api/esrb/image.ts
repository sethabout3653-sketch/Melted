import {
  ESRB_ORIGIN,
  OFFICIAL_ESRB_IMAGE_PATHS,
  isValidEsrbBadgePath,
} from '../../../src/utils/esrbRatingCore';
import { EsrbRatingCode } from '../../../src/types/game';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export async function onRequest(context: { request: Request }): Promise<Response> {
  const url = new URL(context.request.url);
  const srcParam = (url.searchParams.get('src') || '').trim();
  const codeParam = (url.searchParams.get('code') || '').trim().toUpperCase() as EsrbRatingCode;

  let badgePath = isValidEsrbBadgePath(srcParam);
  if (!badgePath && codeParam && OFFICIAL_ESRB_IMAGE_PATHS[codeParam]) {
    badgePath = OFFICIAL_ESRB_IMAGE_PATHS[codeParam];
  }

  if (!badgePath) {
    return new Response('Invalid ESRB image path', { status: 400 });
  }

  // Encode '+' cleanly for ESRB CDN URLs like E10+.svg -> E10%2B.svg if needed
  const encodedPath = badgePath.replace(/\+/g, '%2B');
  const upstreamUrl = `${ESRB_ORIGIN}${encodedPath}`;

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'image/svg+xml,image/png,image/webp,image/*,*/*;q=0.8',
        Referer: `${ESRB_ORIGIN}/`,
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      return new Response('ESRB badge not found upstream', { status: 404 });
    }

    const contentType =
      upstream.headers.get('content-type') ||
      (badgePath.endsWith('.svg') ? 'image/svg+xml; charset=utf-8' : 'image/png');

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=604800',
      },
    });
  } catch {
    return new Response('Failed to fetch ESRB badge', { status: 502 });
  }
}
