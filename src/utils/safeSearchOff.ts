export const SAFE_SEARCH_HOST_REWRITES: Record<string, string> = {
  'forcesafesearch.google.com': 'www.google.com',
  'safe.duckduckgo.com': 'duckduckgo.com',
  'strict.bing.com': 'www.bing.com',
  'forcesafesearch.bing.com': 'www.bing.com',
  'restrict.youtube.com': 'www.youtube.com',
  'restrictmoderate.youtube.com': 'www.youtube.com',
  'safesearch.pixabay.com': 'pixabay.com',
};

export function mapSafeSearchRestrictedHost(hostname: string): string {
  const lower = (hostname || '').toLowerCase().trim();
  return SAFE_SEARCH_HOST_REWRITES[lower] || hostname;
}

function isProtectedChallengeOrMediaHost(host: string, pathLower: string): boolean {
  if (
    pathLower.startsWith('/sorry') ||
    pathLower.startsWith('/recaptcha') ||
    host.includes('accounts.google.') ||
    host.includes('recaptcha.') ||
    host.includes('gstatic.') ||
    host.includes('googleusercontent.') ||
    host.includes('googlevideo.') ||
    host.includes('challenges.cloudflare.') ||
    host.includes('hcaptcha.') ||
    host.includes('turnstile.')
  ) {
    return true;
  }
  return false;
}

function isGoogleSearchDomain(host: string): boolean {
  return (
    host === 'google.com' ||
    host === 'www.google.com' ||
    host === 'images.google.com' ||
    host === 'm.google.com' ||
    /^(www\.|images\.|m\.)?google\.(com\.[a-z]{2}|co\.[a-z]{2}|[a-z]{2,3})$/.test(host)
  );
}

export function enforceSafeSearchOffUrl(inputUrl: URL): URL {
  try {
    const rawHost = inputUrl.hostname.toLowerCase();
    const pathLower = inputUrl.pathname.toLowerCase();

    if (SAFE_SEARCH_HOST_REWRITES[rawHost]) {
      inputUrl.hostname = SAFE_SEARCH_HOST_REWRITES[rawHost];
    }

    const host = inputUrl.hostname.toLowerCase();
    if (isProtectedChallengeOrMediaHost(host, pathLower)) {
      return inputUrl;
    }

    // Universal SafeSearch parameter scrub across any website
    const safeParam = (inputUrl.searchParams.get('safe') || '').toLowerCase();
    if (safeParam && safeParam !== 'off' && safeParam !== '0' && safeParam !== 'false') {
      inputUrl.searchParams.set('safe', 'off');
    }

    const safeSearchParam = (inputUrl.searchParams.get('safesearch') || '').toLowerCase();
    if (safeSearchParam && safeSearchParam !== 'off' && safeSearchParam !== '0' && safeSearchParam !== 'false') {
      inputUrl.searchParams.set(
        'safesearch',
        host.includes('ecosia.org') || host.includes('qwant.com') ? '0' : 'off'
      );
    }

    const adltParam = (inputUrl.searchParams.get('adlt') || '').toLowerCase();
    if (adltParam && adltParam !== 'off') {
      inputUrl.searchParams.set('adlt', 'off');
    }

    if (inputUrl.searchParams.has('ssui')) {
      inputUrl.searchParams.delete('ssui');
    }
    if (inputUrl.searchParams.has('restricted')) {
      inputUrl.searchParams.delete('restricted');
    }

    // Engine-specific forced OFF enforcement
    const isGoogleSearchPage =
      pathLower === '/' ||
      pathLower === '/search' ||
      pathLower === '/webhp' ||
      pathLower === '/images' ||
      pathLower === '/imgres' ||
      pathLower === '/imghp' ||
      pathLower === '/videohp' ||
      pathLower === '/m' ||
      pathLower === '/complete/search' ||
      inputUrl.searchParams.has('q');

    if (isGoogleSearchDomain(host)) {
      if (
        /^(www\.)?google\.(com\.[a-z]{2}|co\.[a-z]{2}|[a-z]{2,3})$/.test(host) &&
        host !== 'google.com' &&
        host !== 'www.google.com' &&
        (pathLower === '/' || pathLower === '/search' || pathLower === '/webhp')
      ) {
        inputUrl.hostname = 'www.google.com';
      }
      if (!inputUrl.searchParams.has('hl')) inputUrl.searchParams.set('hl', 'en');
      if (!inputUrl.searchParams.has('gl')) inputUrl.searchParams.set('gl', 'us');
      inputUrl.searchParams.set('safe', 'off');
      inputUrl.searchParams.set('safeui', 'off');
      inputUrl.searchParams.delete('ssui');
    } else if (
      host === 'duckduckgo.com' ||
      host === 'www.duckduckgo.com' ||
      host === 'html.duckduckgo.com' ||
      host === 'lite.duckduckgo.com'
    ) {
      if (
        pathLower === '/' ||
        pathLower.startsWith('/html') ||
        pathLower.startsWith('/lite') ||
        inputUrl.searchParams.has('q')
      ) {
        if (!inputUrl.searchParams.has('kl')) {
          inputUrl.searchParams.set('kl', 'us-en');
        }
        inputUrl.searchParams.set('kp', '-2');
      }
    } else if (host === 'www.bing.com' || host === 'bing.com' || host === 'cn.bing.com') {
      if (
        pathLower === '/' ||
        pathLower === '/search' ||
        pathLower === '/images/search' ||
        pathLower === '/videos/search' ||
        pathLower === '/news/search' ||
        inputUrl.searchParams.has('q')
      ) {
        inputUrl.searchParams.set('setlang', 'en-US');
        inputUrl.searchParams.set('cc', 'US');
        inputUrl.searchParams.set('adlt', 'off');
      }
    } else if (host === 'search.brave.com') {
      if (
        pathLower === '/' ||
        pathLower === '/search' ||
        pathLower === '/images' ||
        pathLower === '/videos' ||
        pathLower === '/news' ||
        inputUrl.searchParams.has('q')
      ) {
        inputUrl.searchParams.set('safesearch', 'off');
      }
    } else if (host === 'www.startpage.com' || host === 'startpage.com') {
      if (
        pathLower === '/sp/search' ||
        pathLower === '/do/search' ||
        pathLower === '/do/dsearch' ||
        inputUrl.searchParams.has('query') ||
        inputUrl.searchParams.has('q')
      ) {
        inputUrl.searchParams.set('ff', '0');
      }
    } else if (host === 'search.yahoo.com' || host.endsWith('.search.yahoo.com')) {
      if (pathLower.includes('/search') || inputUrl.searchParams.has('p')) {
        inputUrl.searchParams.set('vm', 'p');
      }
    } else if (host === 'www.ecosia.org' || host === 'ecosia.org') {
      if (pathLower.includes('/search') || inputUrl.searchParams.has('q')) {
        inputUrl.searchParams.set('safesearch', '0');
      }
    } else if (host === 'www.qwant.com' || host === 'qwant.com') {
      inputUrl.searchParams.set('safesearch', '0');
    } else if (host === 'yandex.com' || host === 'www.yandex.com' || host === 'ya.ru') {
      if (pathLower.includes('/search') || inputUrl.searchParams.has('text')) {
        inputUrl.searchParams.set('fyandex', '0');
      }
    } else if (host === 'www.youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (
        pathLower === '/' ||
        pathLower === '/watch' ||
        pathLower === '/results' ||
        pathLower.startsWith('/shorts/')
      ) {
        if (!inputUrl.searchParams.has('hl')) inputUrl.searchParams.set('hl', 'en');
        if (!inputUrl.searchParams.has('gl')) inputUrl.searchParams.set('gl', 'US');
      }
    }
  } catch {}
  return inputUrl;
}

export function stripYoutubeRestrictedPrefValue(prefVal: string): string {
  if (!prefVal) return prefVal;
  return prefVal
    .split('&')
    .map((part) => {
      if (!part.toLowerCase().startsWith('f2=')) return part;
      const hex = part.slice(3);
      const parsed = parseInt(hex, 16);
      if (!Number.isFinite(parsed)) return 'f2=0';
      const cleared = parsed & ~0x8000000;
      return `f2=${cleared.toString(16)}`;
    })
    .join('&');
}

function splitCookies(cookieHeader: string): string[] {
  return (cookieHeader || '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function enforceSafeSearchOffCookieString(hostname: string, currentCookie: string): string {
  const host = (hostname || '').toLowerCase();
  const parts = splitCookies(currentCookie);

  if (host.includes('duckduckgo.com')) {
    const filtered = parts.filter((s) => !/^p=/i.test(s) && !/^kl=/i.test(s));
    filtered.push('p=-2', 'kl=us-en');
    return filtered.join('; ');
  }

  if (host.includes('bing.com')) {
    let foundSrch = false;
    const updated = parts.map((s) => {
      if (/^SRCHHPGUSR=/i.test(s)) {
        foundSrch = true;
        let val = s.slice('SRCHHPGUSR='.length);
        if (/ADLT=/i.test(val)) {
          val = val.replace(/ADLT=[^&]*/gi, 'ADLT=OFF');
        } else {
          val = val ? `${val}&ADLT=OFF` : 'ADLT=OFF';
        }
        return `SRCHHPGUSR=${val}`;
      }
      return s.replace(/ADLT=(STRICT|DEMOTE|MODERATE)/gi, 'ADLT=OFF');
    });
    if (!foundSrch) {
      updated.push('SRCHHPGUSR=ADLT=OFF');
    }
    return updated.join('; ');
  }

  if (host.includes('search.brave.com')) {
    const filtered = parts.filter((s) => !/^safesearch=/i.test(s));
    filtered.push('safesearch=off');
    return filtered.join('; ');
  }

  if (host.includes('yahoo.com')) {
    let foundSb = false;
    const updated = parts.map((s) => {
      if (/^sB=/i.test(s)) {
        foundSb = true;
        let val = s.slice(3);
        if (/vm=/i.test(val)) {
          val = val.replace(/vm=[^&]*/gi, 'vm=p');
        } else {
          val = val ? `${val}&vm=p` : 'v=1&vm=p';
        }
        return `sB=${val}`;
      }
      return s;
    });
    if (!foundSb) {
      updated.push('sB=v=1&vm=p');
    }
    return updated.join('; ');
  }

  if (host.includes('youtube.com')) {
    const updated = parts.map((s) => {
      if (/^PREF=/i.test(s)) {
        const val = s.slice(5);
        return `PREF=${stripYoutubeRestrictedPrefValue(val)}`;
      }
      return s;
    });
    return updated.join('; ');
  }

  if (host.includes('google.')) {
    let foundPref = false;
    const filtered = parts
      .filter((s) => !/^SSUI=/i.test(s))
      .map((s) => {
        if (/^PREF=/i.test(s)) {
          foundPref = true;
          let val = stripYoutubeRestrictedPrefValue(s.slice(5));
          if (/safeui=[^&]*/i.test(val)) {
            val = val.replace(/safeui=[^&]*/gi, 'safeui=off');
          } else {
            val = val ? `${val}&safeui=off` : 'safeui=off';
          }
          if (/safe=[^&]*/i.test(val)) {
            val = val.replace(/safe=[^&]*/gi, 'safe=off');
          } else {
            val = `${val}&safe=off`;
          }
          return `PREF=${val}`;
        }
        return s;
      });
    if (!foundPref) {
      filtered.push('PREF=safe=off&safeui=off');
    }
    return filtered.join('; ');
  }

  if (host.includes('reddit.com')) {
    const filtered = parts.filter((s) => !/^over18=/i.test(s));
    filtered.push('over18=1');
    return filtered.join('; ');
  }

  return currentCookie;
}

export function sanitizeSafeSearchSetCookie(hostname: string, setCookie: string): string {
  if (!setCookie) return setCookie;
  const host = (hostname || '').toLowerCase();
  let out = setCookie;

  if (host.includes('duckduckgo.com') && /^p=(1|-1)\b/i.test(out)) {
    out = out.replace(/^p=(1|-1)\b/i, 'p=-2');
  } else if (host.includes('bing.com') && /ADLT=(STRICT|DEMOTE|MODERATE)/i.test(out)) {
    out = out.replace(/ADLT=(STRICT|DEMOTE|MODERATE)/gi, 'ADLT=OFF');
  } else if (host.includes('search.brave.com') && /^safesearch=(strict|moderate)/i.test(out)) {
    out = out.replace(/^safesearch=(strict|moderate)/i, 'safesearch=off');
  } else if ((host.includes('youtube.com') || host.includes('google.')) && /^PREF=/i.test(out)) {
    const semiIdx = out.indexOf(';');
    const nameVal = semiIdx === -1 ? out : out.slice(0, semiIdx);
    const attrs = semiIdx === -1 ? '' : out.slice(semiIdx);
    let val = stripYoutubeRestrictedPrefValue(nameVal.slice(5));
    if (host.includes('google.')) {
      if (/safeui=[^&]*/i.test(val)) {
        val = val.replace(/safeui=[^&]*/gi, 'safeui=off');
      } else {
        val = val ? `${val}&safeui=off` : 'safeui=off';
      }
      if (/safe=[^&]*/i.test(val)) {
        val = val.replace(/safe=[^&]*/gi, 'safe=off');
      } else {
        val = `${val}&safe=off`;
      }
    }
    out = `PREF=${val}${attrs}`;
  } else if (host.includes('yahoo.com') && /^sB=.*vm=(r|m)/i.test(out)) {
    out = out.replace(/vm=(r|m)/gi, 'vm=p');
  }

  return out;
}

export function sanitizeSafeSearchLocation(locationHeader: string, baseOrigin?: string): string {
  if (!locationHeader) return locationHeader;
  try {
    const resolved = baseOrigin ? new URL(locationHeader, baseOrigin) : new URL(locationHeader);
    enforceSafeSearchOffUrl(resolved);
    return resolved.href;
  } catch {
    return locationHeader;
  }
}
