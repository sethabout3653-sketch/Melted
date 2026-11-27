/**
 * Rammerhead In-Page Client Runtime (Scramjet-grade Virtualization)
 * - Full Location, Origin, postMessage, & Document URL virtualization (reCAPTCHA/hCaptcha/Turnstile + SPA compatible)
 * - Persistent timestamped cookie jar synced across localStorage + /api/rammerhead/cookies + X-Rammerhead-Cookie-Sync
 * - Per-site isolated localStorage/sessionStorage (site localStorage.clear() never wipes proxy cookies)
 * - Deep MutationObserver + clean DOM URL getters (.href/.pathname/.hostname/.src/.action)
 * - Crash-proof YouTube playback hook & Web Audio auto-resume
 */
(function () {
  'use strict';

  if (window.__rammerhead_injected) return;
  window.__rammerhead_injected = true;

  var sessionId = window.__rammerhead_session_id;
  if (!sessionId) {
    var match = window.location.pathname.match(/^(?:\/api\/rammerhead)?\/([a-f0-9]{32})/i);
    if (match) sessionId = match[1];
  }
  if (!sessionId) return;

  // Capture raw native browser primitives BEFORE any virtualization wraps prototypes
  var rawLS = null;
  var rawGetItem = Storage.prototype.getItem;
  var rawSetItem = Storage.prototype.setItem;
  var rawRemoveItem = Storage.prototype.removeItem;
  var rawClear = Storage.prototype.clear;
  var rawKey = Storage.prototype.key;
  var rawLengthDesc = Object.getOwnPropertyDescriptor(Storage.prototype, 'length');
  try {
    rawLS = window.localStorage;
  } catch (e) {}

  var origFetchRef = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
  var origPostMessageFn =
    (typeof Window !== 'undefined' && Window.prototype && typeof Window.prototype.postMessage === 'function'
      ? Window.prototype.postMessage
      : null) || (typeof window.postMessage === 'function' ? window.postMessage : null);
  var realParent = window.parent;
  var realFrameElement = null;
  try {
    realFrameElement = window.frameElement;
  } catch (e) {}

  function resolveSafeProxyOrigin() {
    var locOrigin = '';
    try {
      if (window.location && window.location.origin && window.location.origin !== 'null') {
        locOrigin = window.location.origin;
      }
    } catch (e) {}
    var injectedOrigin = window.__rammerhead_origin || '';
    if (
      injectedOrigin &&
      !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(injectedOrigin)
    ) {
      return injectedOrigin;
    }
    return locOrigin || '';
  }

  var proxyOrigin = resolveSafeProxyOrigin();
  var proxyHost = '';
  try {
    if (proxyOrigin) proxyHost = new URL(proxyOrigin).hostname.toLowerCase();
  } catch (e) {}

  var upstreamUrl = window.__rammerhead_upstream_url || '';
  var upstreamOrigin = window.__rammerhead_upstream_origin || '';

  if (!upstreamOrigin && upstreamUrl) {
    try {
      upstreamOrigin = new URL(upstreamUrl).origin;
    } catch (e) {}
  }

  var upstreamHost = '';
  try {
    upstreamHost = new URL(upstreamUrl || upstreamOrigin).hostname.toLowerCase();
  } catch (e) {}

  function updateUpstreamState(nextUrl) {
    if (!nextUrl || typeof nextUrl !== 'string') return;
    try {
      var u = new URL(nextUrl);
      upstreamUrl = u.href;
      upstreamOrigin = u.origin;
      upstreamHost = u.hostname.toLowerCase();
      window.__rammerhead_upstream_url = upstreamUrl;
      window.__rammerhead_upstream_origin = upstreamOrigin;
    } catch (e) {}
  }

  function normalizeSlashes(raw) {
    return String(raw || '')
      .trim()
      .replace(/^(https?):\/+([^/])/i, '$1://$2');
  }

  function extractOriginalUrl(proxied) {
    if (!proxied || typeof proxied !== 'string') return proxied;
    var marker = '/' + sessionId + '/';
    var idx = proxied.indexOf(marker);
    if (idx !== -1) {
      return normalizeSlashes(proxied.slice(idx + marker.length));
    }
    var genericMatch = proxied.match(/(?:\/api\/rammerhead)?\/[a-f0-9]{32}\/((?:https?|wss?):\/+.+)$/i);
    if (genericMatch && genericMatch[1]) {
      return normalizeSlashes(genericMatch[1]);
    }
    return proxied;
  }

  function encodeRecaptchaCo(originStr) {
    try {
      var u = new URL(originStr);
      var port = u.port || (u.protocol === 'https:' ? '443' : '80');
      var raw = u.protocol + '//' + u.hostname + ':' + port;
      return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '.');
    } catch (e) {
      return '';
    }
  }

  function decodeBase64Flexible(str) {
    try {
      var b = str.replace(/-/g, '+').replace(/_/g, '/').replace(/\./g, '=');
      while (b.length % 4 !== 0) b += '=';
      return atob(b);
    } catch (e) {
      return '';
    }
  }

  function isProxyOriginLeak(str) {
    if (!str) return false;
    var lower = String(str).toLowerCase();
    if (proxyHost && lower.indexOf(proxyHost) !== -1) return true;
    return (
      lower.indexOf('localhost') !== -1 ||
      lower.indexOf('127.0.0.1') !== -1
    );
  }

  function normalizeCaptchaParams(targetUrlStr) {
    try {
      var u = new URL(targetUrlStr);
      var h = u.hostname.toLowerCase();
      var p = u.pathname.toLowerCase();
      if (
        p.indexOf('/recaptcha/') === -1 &&
        h.indexOf('recaptcha.') === -1 &&
        h.indexOf('hcaptcha.') === -1 &&
        h.indexOf('challenges.cloudflare.') === -1 &&
        h.indexOf('turnstile.') === -1
      ) {
        return targetUrlStr;
      }

      // If current page itself is NOT a captcha frame, its upstreamOrigin is the real site origin!
      var siteOrigin = upstreamOrigin;
      if (
        !siteOrigin ||
        siteOrigin.indexOf('recaptcha') !== -1 ||
        siteOrigin.indexOf('hcaptcha') !== -1 ||
        siteOrigin.indexOf('challenges.cloudflare') !== -1
      ) {
        try {
          if (realParent && realParent !== window && realParent.__rammerhead_upstream_origin) {
            siteOrigin = realParent.__rammerhead_upstream_origin;
          }
        } catch (err) {}
      }
      if (!siteOrigin) return targetUrlStr;

      var co = u.searchParams.get('co');
      if (co) {
        var decoded = decodeBase64Flexible(co);
        if (decoded && isProxyOriginLeak(decoded)) {
          var newCo = encodeRecaptchaCo(siteOrigin);
          if (newCo) u.searchParams.set('co', newCo);
        }
      }

      var originParam = u.searchParams.get('origin');
      if (originParam && isProxyOriginLeak(originParam)) {
        u.searchParams.set('origin', siteOrigin);
      }

      var hostParam = u.searchParams.get('host');
      if (hostParam && isProxyOriginLeak(hostParam)) {
        u.searchParams.set('host', new URL(siteOrigin).hostname);
      }

      return u.href;
    } catch (e) {
      return targetUrlStr;
    }
  }

  function coerceUrlStr(val) {
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object') {
      if (typeof val.href === 'string') return val.href;
      if (typeof val.url === 'string') return val.url;
    }
    return '';
  }

  function rewriteUrlToRammerhead(url) {
    if (url && typeof url === 'object' && typeof url.href === 'string') {
      url = url.href;
    }
    if (!url || typeof url !== 'string') return url;
    var trimmed = url.trim();
    if (
      !trimmed ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('blob:') ||
      trimmed.startsWith('javascript:') ||
      trimmed.startsWith('mailto:') ||
      trimmed.startsWith('tel:') ||
      trimmed.startsWith('about:') ||
      trimmed.startsWith('#')
    ) {
      return url;
    }

    // Never double-wrap internal endpoints or already-proxied URLs
    if (
      trimmed.indexOf('/' + sessionId + '/') !== -1 ||
      trimmed.startsWith('/api/rammerhead/') ||
      trimmed.startsWith('/api/yt-stream') ||
      trimmed.startsWith('/api/yt-player-fallback') ||
      trimmed === '/rammerhead.js' ||
      trimmed.startsWith('/rammerhead.js?')
    ) {
      return url;
    }

    if (proxyOrigin) {
      if (
        trimmed.indexOf(proxyOrigin + '/api/rammerhead/') === 0 ||
        trimmed.indexOf(proxyOrigin + '/api/yt-stream') === 0 ||
        trimmed.indexOf(proxyOrigin + '/api/yt-player-fallback') === 0 ||
        trimmed.indexOf(proxyOrigin + '/rammerhead.js') === 0
      ) {
        return url;
      }
      // Rewrite accidental proxyOrigin + '/path' constructed from native origin back to upstreamOrigin
      if (trimmed === proxyOrigin || trimmed.indexOf(proxyOrigin + '/') === 0) {
        if (upstreamOrigin) {
          var restPath = trimmed.slice(proxyOrigin.length) || '/';
          trimmed = upstreamOrigin + restPath;
        }
      }
    }

    if (trimmed.indexOf('__frost_yt_stream__') !== -1) {
      try {
        var parsedStream = new URL(trimmed, 'https://www.youtube.com');
        return (proxyOrigin ? proxyOrigin : '') + '/api/yt-stream' + parsedStream.search;
      } catch (e) {}
    }

    var normalized = normalizeSlashes(trimmed);
    var prefix = (proxyOrigin || '') + '/api/rammerhead/' + sessionId + '/';

    if (/^https?:\/\//i.test(normalized)) {
      return prefix + normalizeCaptchaParams(normalized);
    }
    if (normalized.startsWith('//')) {
      var proto = upstreamOrigin && upstreamOrigin.startsWith('http:') ? 'http:' : 'https:';
      return prefix + normalizeCaptchaParams(proto + normalized);
    }
    if (normalized.startsWith('/')) {
      var baseOrigin = upstreamOrigin || '';
      if (
        baseOrigin &&
        normalized.indexOf('/api/rammerhead/') !== 0 &&
        normalized.indexOf('/api/yt-stream') !== 0 &&
        normalized.indexOf('/api/yt-player-fallback') !== 0 &&
        normalized !== '/rammerhead.js'
      ) {
        return prefix + normalizeCaptchaParams(baseOrigin + normalized);
      }
      return url;
    }

    try {
      var baseRef = upstreamUrl || upstreamOrigin || '';
      if (baseRef) {
        var resolved = new URL(normalized, baseRef).href;
        return prefix + normalizeCaptchaParams(resolved);
      }
    } catch (e) {}
    return url;
  }

  // Expose helper globals for rewritten inline/bundle JS
  window.__rh_rewrite = rewriteUrlToRammerhead;

  // 0. Timestamp-Aware Persistent Cookie Jar (NEVER resets or overwrites fresh cookies with stale cache)
  var COOKIE_STORAGE_KEY = 'frosthub_rammerhead_cookies_v1';
  var COOKIE_USER_KEY = 'frosthub_chat_user_id';
  var memoryCookieJar = {};
  var syncTimer = null;

  function mergeCookieEntry(ex, inc) {
    if (!inc || typeof inc !== 'object' || !inc.name) return ex;
    if (!ex || typeof ex !== 'object') {
      return {
        name: String(inc.name),
        value: typeof inc.value === 'string' ? inc.value : String(inc.value || ''),
        domain: String(inc.domain || upstreamHost || '').toLowerCase().replace(/^\.+/, ''),
        path: String(inc.path || '/'),
        expires: inc.expires || Date.now() + 365 * 24 * 3600 * 1000,
        secure: inc.secure !== false,
        sameSite: inc.sameSite || 'Lax',
        updatedAt: typeof inc.updatedAt === 'number' ? inc.updatedAt : Date.now(),
      };
    }

    var exVal = typeof ex.value === 'string' ? ex.value : '';
    var inVal = typeof inc.value === 'string' ? inc.value : inc.value != null ? String(inc.value) : '';
    var exTs = typeof ex.updatedAt === 'number' ? ex.updatedAt : 0;
    var inTs = typeof inc.updatedAt === 'number' ? inc.updatedAt : 0;

    var chosenVal = inVal;
    var chosenTs = inTs || Date.now();
    if (exVal.length > 0 && (!inVal || inVal === 'deleted' || inVal === 'null' || inVal === 'undefined')) {
      chosenVal = exVal;
      chosenTs = Math.max(exTs, inTs) || Date.now();
    } else if (exTs > 0 && inTs > 0 && inTs < exTs && exVal.length > 0) {
      chosenVal = exVal;
      chosenTs = exTs;
    } else {
      chosenTs = Math.max(inTs, exTs) || Date.now();
    }

    return {
      name: String(inc.name || ex.name),
      value: chosenVal,
      domain: String(inc.domain || ex.domain || '').toLowerCase().replace(/^\.+/, ''),
      path: String(inc.path || ex.path || '/'),
      expires: Math.max(inc.expires || 0, ex.expires || 0, Date.now() + 365 * 24 * 3600 * 1000),
      secure: inc.secure !== undefined ? inc.secure : ex.secure,
      sameSite: inc.sameSite || ex.sameSite || 'Lax',
      updatedAt: chosenTs,
    };
  }

  function mergeJarMap(target, incomingMap) {
    if (!incomingMap || typeof incomingMap !== 'object') return false;
    var changed = false;
    var keys = Object.keys(incomingMap);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var inc = incomingMap[k];
      if (!inc || typeof inc !== 'object' || !inc.name) continue;
      var ex = target[k];
      var merged = mergeCookieEntry(ex, inc);
      if (!ex || ex.value !== merged.value || (merged.updatedAt || 0) > (ex.updatedAt || 0)) {
        changed = true;
      }
      target[k] = merged;
    }
    return changed;
  }

  function readRawLS(key) {
    if (!rawLS) return null;
    try {
      return rawGetItem.call(rawLS, key);
    } catch (e) {
      return null;
    }
  }

  function writeRawLS(key, val) {
    if (!rawLS) return;
    try {
      rawSetItem.call(rawLS, key, val);
    } catch (e) {}
  }

  function loadStoredCookieJar() {
    try {
      var raw = readRawLS(COOKIE_STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          memoryCookieJar = parsed;
        }
      }
    } catch (e) {}
  }

  function persistCookieJarLocally() {
    try {
      writeRawLS(COOKIE_STORAGE_KEY, JSON.stringify(memoryCookieJar));
    } catch (e) {}
  }

  function syncCookiesToServer(immediate) {
    if (syncTimer) clearTimeout(syncTimer);
    var executeSync = function () {
      try {
        var userId = readRawLS(COOKIE_USER_KEY) || 'default';
        var payload = JSON.stringify({
          userId: userId,
          sessionId: sessionId,
          cookies: memoryCookieJar,
        });
        if (immediate && navigator && typeof navigator.sendBeacon === 'function') {
          navigator.sendBeacon(
            (proxyOrigin || '') + '/api/rammerhead/cookies',
            new Blob([payload], { type: 'application/json' })
          );
          return;
        }
        if (origFetchRef) {
          origFetchRef
            .call(window, (proxyOrigin || '') + '/api/rammerhead/cookies', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: payload,
              keepalive: true,
            })
            .catch(function () {});
        }
      } catch (e) {}
    };

    if (immediate) {
      executeSync();
    } else {
      syncTimer = setTimeout(executeSync, 40);
    }
  }

  function hydrateCookiesFromServer() {
    if (!origFetchRef) return;
    try {
      var userId = readRawLS(COOKIE_USER_KEY) || 'default';
      origFetchRef
        .call(
          window,
          (proxyOrigin || '') +
            '/api/rammerhead/cookies?userId=' +
            encodeURIComponent(userId) +
            '&sessionId=' +
            encodeURIComponent(sessionId),
          { cache: 'no-store' }
        )
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .then(function (data) {
          if (!data || !data.cookies || typeof data.cookies !== 'object') return;
          var serverCookies = data.cookies;
          var changedLocal = mergeJarMap(memoryCookieJar, serverCookies);
          if (changedLocal) {
            persistCookieJarLocally();
          }
          // Only push up if local holds cookies missing on server or strictly newer than server
          var needsPush = false;
          var localKeys = Object.keys(memoryCookieJar);
          for (var i = 0; i < localKeys.length; i++) {
            var k = localKeys[i];
            var loc = memoryCookieJar[k];
            var srv = serverCookies[k];
            if (!loc || !loc.name) continue;
            if (!srv || (loc.value && !srv.value) || (loc.updatedAt || 0) > (srv.updatedAt || 0)) {
              needsPush = true;
              break;
            }
          }
          if (needsPush) {
            syncCookiesToServer(false);
          }
        })
        .catch(function () {});
    } catch (e) {}
  }

  function handleSyncHeaderFromResponse(headerGetter) {
    try {
      var syncRaw = headerGetter('x-rammerhead-cookie-sync');
      if (syncRaw) {
        var parsed = JSON.parse(decodeURIComponent(syncRaw));
        if (parsed && typeof parsed === 'object') {
          if (mergeJarMap(memoryCookieJar, parsed)) {
            persistCookieJarLocally();
          }
        }
      } else if (headerGetter('x-rammerhead-has-cookies') === '1') {
        hydrateCookiesFromServer();
      }
    } catch (e) {}
  }

  // Boot sequence: load local jar -> synchronously merge server-injected host cookies -> persist -> hydrate full server store
  loadStoredCookieJar();
  if (window.__rh_host_cookies && typeof window.__rh_host_cookies === 'object') {
    if (mergeJarMap(memoryCookieJar, window.__rh_host_cookies)) {
      persistCookieJarLocally();
    }
  }
  hydrateCookiesFromServer();

  // Cross-page / cross-tab synchronization
  window.addEventListener('storage', function (e) {
    if (e.key === COOKIE_STORAGE_KEY && e.newValue) {
      try {
        var parsed = JSON.parse(e.newValue);
        if (parsed && typeof parsed === 'object') {
          if (mergeJarMap(memoryCookieJar, parsed)) {
            // Memory jar synced with other tab
          }
        }
      } catch (err) {}
    }
  });

  window.addEventListener('pagehide', function () {
    syncCookiesToServer(true);
  });
  window.addEventListener('beforeunload', function () {
    syncCookiesToServer(true);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      syncCookiesToServer(true);
    }
  });

  // 0.5 Isolate localStorage per upstreamHost (methods AND Proxy direct property access) so site storage/clear() never wipes proxy cookies
  try {
    if (rawLS) {
      var siteStoragePrefix = '__rh_ls::' + (upstreamHost || 'site') + '::';
      var lsProxy = null;
      var isScopedLS = function (ctx) {
        return ctx === rawLS || (lsProxy !== null && ctx === lsProxy);
      };

      var listSiteKeys = function () {
        var out = [];
        var len = rawLengthDesc && rawLengthDesc.get ? rawLengthDesc.get.call(rawLS) : rawLS.length;
        for (var i = 0; i < len; i++) {
          var k = rawKey.call(rawLS, i);
          if (k && k.indexOf(siteStoragePrefix) === 0) {
            out.push(k.slice(siteStoragePrefix.length));
          }
        }
        return out;
      };

      var clearSiteKeys = function () {
        var len = rawLengthDesc && rawLengthDesc.get ? rawLengthDesc.get.call(rawLS) : rawLS.length;
        for (var i = len - 1; i >= 0; i--) {
          var k = rawKey.call(rawLS, i);
          if (k && k.indexOf(siteStoragePrefix) === 0) {
            rawRemoveItem.call(rawLS, k);
          }
        }
      };

      Storage.prototype.getItem = function (key) {
        if (isScopedLS(this)) {
          return rawGetItem.call(rawLS, siteStoragePrefix + String(key));
        }
        return rawGetItem.apply(this, arguments);
      };

      Storage.prototype.setItem = function (key, value) {
        if (isScopedLS(this)) {
          return rawSetItem.call(rawLS, siteStoragePrefix + String(key), String(value));
        }
        return rawSetItem.apply(this, arguments);
      };

      Storage.prototype.removeItem = function (key) {
        if (isScopedLS(this)) {
          return rawRemoveItem.call(rawLS, siteStoragePrefix + String(key));
        }
        return rawRemoveItem.apply(this, arguments);
      };

      Storage.prototype.clear = function () {
        if (isScopedLS(this)) {
          clearSiteKeys();
          return;
        }
        return rawClear.apply(this, arguments);
      };

      Storage.prototype.key = function (index) {
        if (isScopedLS(this)) {
          var keys = listSiteKeys();
          return index >= 0 && index < keys.length ? keys[index] : null;
        }
        return rawKey.apply(this, arguments);
      };

      if (rawLengthDesc && rawLengthDesc.configurable) {
        Object.defineProperty(Storage.prototype, 'length', {
          configurable: true,
          get: function () {
            if (isScopedLS(this)) {
              return listSiteKeys().length;
            }
            return rawLengthDesc.get.call(this);
          },
        });
      }

      // Wrap window.localStorage in a Proxy so `localStorage.foo`, `Object.keys(localStorage)`, and `delete localStorage.foo` stay 100% isolated
      if (typeof Proxy !== 'undefined') {
        var lsDesc =
          Object.getOwnPropertyDescriptor(window, 'localStorage') ||
          Object.getOwnPropertyDescriptor(Window.prototype, 'localStorage');
        if (!lsDesc || lsDesc.configurable) {
          lsProxy = new Proxy(rawLS, {
            get: function (target, prop) {
              if (prop === 'getItem') return function (k) { return rawGetItem.call(rawLS, siteStoragePrefix + String(k)); };
              if (prop === 'setItem') return function (k, v) { return rawSetItem.call(rawLS, siteStoragePrefix + String(k), String(v)); };
              if (prop === 'removeItem') return function (k) { return rawRemoveItem.call(rawLS, siteStoragePrefix + String(k)); };
              if (prop === 'clear') return function () { clearSiteKeys(); };
              if (prop === 'key') return function (idx) { var keys = listSiteKeys(); return idx >= 0 && idx < keys.length ? keys[idx] : null; };
              if (prop === 'length') return listSiteKeys().length;
              if (typeof prop === 'symbol') {
                var sv = target[prop];
                return typeof sv === 'function' ? sv.bind(target) : sv;
              }
              var storedVal = rawGetItem.call(rawLS, siteStoragePrefix + String(prop));
              if (storedVal !== null) return storedVal;
              if (prop in Storage.prototype && typeof target[prop] === 'function') {
                return target[prop].bind(target);
              }
              return undefined;
            },
            set: function (_target, prop, value) {
              if (typeof prop !== 'symbol') {
                rawSetItem.call(rawLS, siteStoragePrefix + String(prop), String(value));
              }
              return true;
            },
            deleteProperty: function (_target, prop) {
              if (typeof prop !== 'symbol') {
                rawRemoveItem.call(rawLS, siteStoragePrefix + String(prop));
              }
              return true;
            },
            has: function (_target, prop) {
              if (typeof prop === 'string' && rawGetItem.call(rawLS, siteStoragePrefix + prop) !== null) return true;
              return prop in Storage.prototype;
            },
            ownKeys: function () {
              return listSiteKeys();
            },
            getOwnPropertyDescriptor: function (_target, prop) {
              if (typeof prop === 'string') {
                var val = rawGetItem.call(rawLS, siteStoragePrefix + prop);
                if (val !== null) {
                  return { value: val, writable: true, enumerable: true, configurable: true };
                }
              }
              return undefined;
            },
          });
          Object.defineProperty(window, 'localStorage', {
            configurable: true,
            enumerable: true,
            get: function () { return lsProxy; },
          });
        }
      }
    }
  } catch (e) {}

  // Virtualize document.cookie scoped to upstreamHost
  try {
    if (upstreamHost) {
      Object.defineProperty(document, 'cookie', {
        configurable: true,
        get: function () {
          var pairs = [];
          Object.keys(memoryCookieJar).forEach(function (key) {
            var entry = memoryCookieJar[key];
            if (!entry || !entry.name || !entry.domain) return;
            var dom = String(entry.domain).toLowerCase().replace(/^\.+/, '');
            if (upstreamHost === dom || upstreamHost.endsWith('.' + dom)) {
              pairs.push(entry.name + '=' + (entry.value || ''));
            }
          });
          return pairs.join('; ');
        },
        set: function (cookieStr) {
          if (!cookieStr || typeof cookieStr !== 'string') return;
          var parts = cookieStr.split(';').map(function (s) { return s.trim(); }).filter(Boolean);
          if (!parts.length) return;
          var eqIdx = parts[0].indexOf('=');
          if (eqIdx <= 0) return;
          var name = parts[0].slice(0, eqIdx).trim();
          var val = parts[0].slice(eqIdx + 1).trim();
          if (!name) return;

          var dom = upstreamHost;
          var path = '/';
          for (var i = 1; i < parts.length; i++) {
            var p = parts[i];
            var pEq = p.indexOf('=');
            var attr = (pEq === -1 ? p : p.slice(0, pEq)).trim().toLowerCase();
            var attrVal = pEq === -1 ? '' : p.slice(pEq + 1).trim();
            if (attr === 'domain' && attrVal) {
              var cand = attrVal.toLowerCase().replace(/^\.+/, '');
              if (upstreamHost === cand || upstreamHost.endsWith('.' + cand)) dom = cand;
            } else if (attr === 'path' && attrVal) {
              path = attrVal;
            }
          }

          var key = dom + '||' + path + '||' + name;
          var existing = memoryCookieJar[key];
          if (existing && existing.value && val === '') return;

          memoryCookieJar[key] = {
            name: name,
            value: val,
            domain: dom,
            path: path,
            expires: Date.now() + 365 * 24 * 3600 * 1000,
            updatedAt: Date.now(),
          };
          persistCookieJarLocally();
          syncCookiesToServer(false);
        },
      });
    }
  } catch (e) {}

  // 1. Scramjet-grade Frame Hierarchy (preserves parent/child communication for CAPTCHAs while hiding FrostHub shell)
  function isRammerheadWindow(win) {
    if (!win) return false;
    try {
      if (win.__rammerhead_injected) return true;
      var p = win.location && win.location.pathname;
      return Boolean(p && (p.indexOf('/api/rammerhead/') !== -1 || /^\/[a-f0-9]{32}\//i.test(p)));
    } catch (e) {
      return false;
    }
  }

  var rhTopWin = window;
  try {
    var cursor = window;
    while (cursor && cursor.parent && cursor.parent !== cursor) {
      if (isRammerheadWindow(cursor.parent)) {
        rhTopWin = cursor.parent;
        cursor = cursor.parent;
      } else {
        break;
      }
    }
  } catch (e) {}

  var rhParentWin = realParent && realParent !== window && isRammerheadWindow(realParent) ? realParent : rhTopWin;
  var rhFrameEl = window === rhTopWin ? null : realFrameElement;

  window.__rh_top = function () { return rhTopWin; };
  window.__rh_parent = function () { return rhParentWin; };
  window.__rh_frameElement = rhFrameEl;

  try {
    Object.defineProperty(window, 'top', {
      get: function () { return rhTopWin; },
      configurable: true,
    });
    Object.defineProperty(window, 'parent', {
      get: function () { return rhParentWin; },
      configurable: true,
    });
    Object.defineProperty(window, 'frameElement', {
      get: function () { return rhFrameEl; },
      configurable: true,
    });
  } catch (e) {}

  // Virtualize postMessage & MessageEvent.prototype.origin so cross-iframe checks match upstream origin
  try {
    if (origPostMessageFn) {
      var wrappedPostMessage = function (message, targetOrigin, transfer) {
        if (arguments.length < 2) {
          return origPostMessageFn.call(this, message, '/');
        }
        var adjustedOrigin = targetOrigin;
        if (
          typeof targetOrigin === 'string' &&
          targetOrigin !== '*' &&
          targetOrigin !== '/' &&
          (!proxyOrigin || targetOrigin.indexOf(proxyOrigin) !== 0)
        ) {
          adjustedOrigin = proxyOrigin || '*';
        } else if (targetOrigin && typeof targetOrigin === 'object' && typeof targetOrigin.targetOrigin === 'string') {
          var copyOpts = {};
          Object.keys(targetOrigin).forEach(function (k) { copyOpts[k] = targetOrigin[k]; });
          if (copyOpts.targetOrigin !== '*' && copyOpts.targetOrigin !== '/') {
            copyOpts.targetOrigin = proxyOrigin || '*';
          }
          return origPostMessageFn.call(this, message, copyOpts);
        }
        return transfer !== undefined
          ? origPostMessageFn.call(this, message, adjustedOrigin, transfer)
          : origPostMessageFn.call(this, message, adjustedOrigin);
      };
      Window.prototype.postMessage = wrappedPostMessage;
      window.postMessage = wrappedPostMessage;
    }

    var msgOriginDesc =
      typeof MessageEvent !== 'undefined' && MessageEvent.prototype
        ? Object.getOwnPropertyDescriptor(MessageEvent.prototype, 'origin')
        : null;
    if (msgOriginDesc && msgOriginDesc.get && msgOriginDesc.configurable) {
      Object.defineProperty(MessageEvent.prototype, 'origin', {
        configurable: true,
        enumerable: msgOriginDesc.enumerable,
        get: function () {
          try {
            if (this.source && this.source.__rammerhead_upstream_origin) {
              return this.source.__rammerhead_upstream_origin;
            }
            if (this.source && this.source !== realParent && upstreamOrigin) {
              var rawOrigin = msgOriginDesc.get.call(this);
              if (proxyOrigin && rawOrigin === proxyOrigin) {
                return upstreamOrigin;
              }
            }
          } catch (e) {}
          return msgOriginDesc.get.call(this);
        },
      });
    }
  } catch (e) {}

  // 1.5 Virtual Location & Document URLs (Scramjet-grade)
  function getUpstreamUrlObj() {
    try {
      var cur = extractOriginalUrl(window.location.href);
      if (cur && /^https?:\/\//i.test(cur)) {
        updateUpstreamState(cur);
        return new URL(cur);
      }
    } catch (e) {}
    try {
      return new URL(upstreamUrl || upstreamOrigin || 'https://example.com/');
    } catch (e) {
      return new URL('https://example.com/');
    }
  }

  function navigateVirtual(rawTarget, replaceMode) {
    try {
      var currentObj = getUpstreamUrlObj();
      var resolved = new URL(String(rawTarget), currentObj.href).href;
      syncCookiesToServer(true);
      var dest = rewriteUrlToRammerhead(resolved);
      if (replaceMode) {
        window.location.replace(dest);
      } else {
        window.location.href = dest;
      }
    } catch (e) {
      var direct = rewriteUrlToRammerhead(String(rawTarget));
      if (replaceMode) window.location.replace(direct);
      else window.location.href = direct;
    }
  }

  var virtualLocation = {
    assign: function (url) { navigateVirtual(url, false); },
    replace: function (url) { navigateVirtual(url, true); },
    reload: function () { window.location.reload(); },
    toString: function () { return getUpstreamUrlObj().href; },
    valueOf: function () { return this; },
  };

  Object.defineProperties(virtualLocation, {
    href: {
      enumerable: true,
      get: function () { return getUpstreamUrlObj().href; },
      set: function (v) { navigateVirtual(v, false); },
    },
    origin: {
      enumerable: true,
      get: function () { return getUpstreamUrlObj().origin; },
    },
    protocol: {
      enumerable: true,
      get: function () { return getUpstreamUrlObj().protocol; },
      set: function (v) {
        var u = getUpstreamUrlObj();
        u.protocol = v;
        navigateVirtual(u.href, false);
      },
    },
    host: {
      enumerable: true,
      get: function () { return getUpstreamUrlObj().host; },
      set: function (v) {
        var u = getUpstreamUrlObj();
        u.host = v;
        navigateVirtual(u.href, false);
      },
    },
    hostname: {
      enumerable: true,
      get: function () { return getUpstreamUrlObj().hostname; },
      set: function (v) {
        var u = getUpstreamUrlObj();
        u.hostname = v;
        navigateVirtual(u.href, false);
      },
    },
    port: {
      enumerable: true,
      get: function () { return getUpstreamUrlObj().port; },
      set: function (v) {
        var u = getUpstreamUrlObj();
        u.port = v;
        navigateVirtual(u.href, false);
      },
    },
    pathname: {
      enumerable: true,
      get: function () { return getUpstreamUrlObj().pathname; },
      set: function (v) {
        var u = getUpstreamUrlObj();
        u.pathname = v;
        navigateVirtual(u.href, false);
      },
    },
    search: {
      enumerable: true,
      get: function () { return getUpstreamUrlObj().search; },
      set: function (v) {
        var u = getUpstreamUrlObj();
        u.search = v;
        navigateVirtual(u.href, false);
      },
    },
    hash: {
      enumerable: true,
      get: function () { return window.location.hash; },
      set: function (v) { window.location.hash = v; },
    },
    ancestorOrigins: {
      enumerable: true,
      get: function () { return window.location.ancestorOrigins; },
    },
  });

  window.__rh_l = virtualLocation;
  window.__rh_loc = function (val) {
    if (val === window.location || val === document.location) return virtualLocation;
    try {
      if (rhTopWin && val === rhTopWin.location) return rhTopWin.__rh_l || virtualLocation;
      if (rhParentWin && val === rhParentWin.location) return rhParentWin.__rh_l || virtualLocation;
    } catch (e) {}
    return val;
  };
  try {
    Object.defineProperty(window, '__rh_href', {
      configurable: true,
      get: function () { return getUpstreamUrlObj().href; },
      set: function (v) { navigateVirtual(v, false); },
    });
    Object.defineProperty(window, '__rh_origin', {
      configurable: true,
      get: function () { return getUpstreamUrlObj().origin; },
    });
  } catch (e) {}

  // Virtualize document.URL, documentURI, baseURI, referrer, and document.domain
  try {
    ['URL', 'documentURI', 'baseURI'].forEach(function (prop) {
      Object.defineProperty(document, prop, {
        configurable: true,
        get: function () { return getUpstreamUrlObj().href; },
      });
    });
    if (upstreamHost) {
      Object.defineProperty(document, 'domain', {
        configurable: true,
        get: function () { return upstreamHost; },
        set: function () {},
      });
    }
    var origReferrerDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'referrer');
    if (origReferrerDesc && origReferrerDesc.get) {
      Object.defineProperty(document, 'referrer', {
        configurable: true,
        get: function () {
          var rawRef = origReferrerDesc.get.call(document);
          if (!rawRef) return '';
          var ext = extractOriginalUrl(rawRef);
          return ext && /^https?:\/\//i.test(ext) ? ext : upstreamOrigin + '/';
        },
      });
    }
  } catch (e) {}

  // 2. Intercept window.fetch + virtualize Response.prototype.url
  try {
    if (typeof Response !== 'undefined' && Response.prototype) {
      var respUrlDesc = Object.getOwnPropertyDescriptor(Response.prototype, 'url');
      if (respUrlDesc && respUrlDesc.get && respUrlDesc.configurable) {
        Object.defineProperty(Response.prototype, 'url', {
          configurable: true,
          enumerable: respUrlDesc.enumerable,
          get: function () {
            var raw = respUrlDesc.get.call(this);
            return typeof raw === 'string' ? extractOriginalUrl(raw) : raw;
          },
        });
      }
    }
  } catch (e) {}

  if (origFetchRef) {
    window.fetch = function (input, init) {
      try {
        var targetUrlStr = coerceUrlStr(input);
        var rewritten = rewriteUrlToRammerhead(targetUrlStr);

        if (
          upstreamHost.indexOf('youtube.com') !== -1 &&
          targetUrlStr.indexOf('/youtubei/v1/player') !== -1
        ) {
          var ytReqArg =
            typeof input === 'string' || (input && typeof input.href === 'string')
              ? rewritten
              : new Request(rewritten, {
                  method: input.method,
                  headers: input.headers,
                  credentials: input.credentials,
                  cache: input.cache,
                  redirect: input.redirect,
                  mode: input.mode === 'navigate' ? 'cors' : input.mode,
                  body: input.method !== 'GET' && input.method !== 'HEAD' ? input.clone().body : undefined,
                });
          return origFetchRef(ytReqArg, init).then(function (resp) {
            handleSyncHeaderFromResponse(function (k) { return resp.headers.get(k); });
            if (!resp.ok) return resp;
            return resp
              .clone()
              .json()
              .then(function (data) {
                var status = data && data.playabilityStatus && data.playabilityStatus.status;
                var vid = data && data.videoDetails && data.videoDetails.videoId;
                if (status && status !== 'OK' && vid) {
                  return origFetchRef((proxyOrigin || '') + '/api/yt-player-fallback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ videoId: vid }),
                  })
                    .then(function (fb) { return fb.ok ? fb.json() : null; })
                    .then(function (fbJson) {
                      if (fbJson && fbJson.ok && fbJson.playerResponse) {
                        return new Response(JSON.stringify(fbJson.playerResponse), {
                          status: 200,
                          headers: { 'Content-Type': 'application/json' },
                        });
                      }
                      return resp;
                    })
                    .catch(function () { return resp; });
                }
                return resp;
              })
              .catch(function () { return resp; });
          });
        }

        var fetchPromise;
        if (typeof input === 'string' || (input && typeof input.href === 'string' && typeof input.url !== 'string')) {
          fetchPromise = origFetchRef(rewritten, init);
        } else if (input && typeof input.url === 'string') {
          if (rewritten !== input.url) {
            var clonedReq;
            try {
              clonedReq = new Request(rewritten, input);
            } catch (reqErr) {
              var reqInit = {
                method: input.method,
                headers: input.headers,
                credentials: input.credentials,
                cache: input.cache,
                redirect: input.redirect,
                mode: input.mode === 'navigate' ? 'cors' : input.mode,
              };
              if (input.method !== 'GET' && input.method !== 'HEAD') {
                try {
                  reqInit.body = input.clone().body;
                  reqInit.duplex = 'half';
                } catch (bErr) {}
              }
              clonedReq = new Request(rewritten, reqInit);
            }
            fetchPromise = origFetchRef(clonedReq, init);
          } else {
            fetchPromise = origFetchRef(input, init);
          }
        } else {
          fetchPromise = origFetchRef.apply(window, arguments);
        }

        return fetchPromise.then(function (resp) {
          handleSyncHeaderFromResponse(function (k) { return resp.headers.get(k); });
          return resp;
        });
      } catch (e) {}
      return origFetchRef.apply(window, arguments);
    };
  }

  // 3. Intercept XMLHttpRequest + virtualize responseURL
  if (window.XMLHttpRequest) {
    try {
      var xhrUrlDesc = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseURL');
      if (xhrUrlDesc && xhrUrlDesc.get && xhrUrlDesc.configurable) {
        Object.defineProperty(XMLHttpRequest.prototype, 'responseURL', {
          configurable: true,
          enumerable: xhrUrlDesc.enumerable,
          get: function () {
            var raw = xhrUrlDesc.get.call(this);
            return typeof raw === 'string' ? extractOriginalUrl(raw) : raw;
          },
        });
      }
    } catch (e) {}

    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      try {
        var uStr = coerceUrlStr(url);
        if (uStr) {
          arguments[1] = rewriteUrlToRammerhead(uStr);
        }
      } catch (e) {}
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      try {
        var selfXhr = this;
        selfXhr.addEventListener('readystatechange', function () {
          if (selfXhr.readyState >= 2) {
            handleSyncHeaderFromResponse(function (k) { return selfXhr.getResponseHeader(k); });
          }
        });
      } catch (e) {}
      return origSend.apply(this, arguments);
    };
  }

  // 4. Intercept navigator.sendBeacon & EventSource + safe ServiceWorker stub
  if (navigator && typeof navigator.sendBeacon === 'function') {
    var origBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      try {
        var uStr = coerceUrlStr(url);
        if (uStr) url = rewriteUrlToRammerhead(uStr);
      } catch (e) {}
      return origBeacon(url, data);
    };
  }

  try {
    if (typeof window.EventSource === 'function') {
      var OrigEventSource = window.EventSource;
      window.EventSource = function (url, eventSourceInitDict) {
        var uStr = coerceUrlStr(url);
        return new OrigEventSource(uStr ? rewriteUrlToRammerhead(uStr) : url, eventSourceInitDict);
      };
      window.EventSource.prototype = OrigEventSource.prototype;
    }
  } catch (e) {}

  try {
    if (navigator && navigator.serviceWorker && typeof navigator.serviceWorker.register === 'function') {
      navigator.serviceWorker.register = function () {
        return Promise.resolve({
          scope: upstreamOrigin + '/',
          active: null,
          installing: null,
          waiting: null,
          unregister: function () { return Promise.resolve(true); },
          update: function () { return Promise.resolve(); },
          addEventListener: function () {},
          removeEventListener: function () {},
        });
      };
    }
  } catch (e) {}

  // 5. Intercept window.open & history state updates so SPA routes keep proxy prefix & sync upstreamUrl
  var origOpenWin = window.open;
  if (typeof origOpenWin === 'function') {
    window.open = function (url, target, features) {
      try {
        var uStr = coerceUrlStr(url);
        if (uStr) url = rewriteUrlToRammerhead(uStr);
      } catch (e) {}
      return origOpenWin.call(this, url, target, features);
    };
  }

  try {
    var origPushState = history.pushState;
    var origReplaceState = history.replaceState;
    var syncUpstreamFromRewritten = function (rewrittenUrl) {
      try {
        var orig = extractOriginalUrl(rewrittenUrl);
        if (orig && /^https?:\/\//i.test(orig)) {
          updateUpstreamState(orig);
        }
      } catch (e) {}
    };
    history.pushState = function (state, title, url) {
      var uStr = coerceUrlStr(url);
      if (uStr) {
        url = rewriteUrlToRammerhead(uStr);
        syncUpstreamFromRewritten(url);
      }
      return origPushState.call(this, state, title, url);
    };
    history.replaceState = function (state, title, url) {
      var uStr = coerceUrlStr(url);
      if (uStr) {
        url = rewriteUrlToRammerhead(uStr);
        syncUpstreamFromRewritten(url);
      }
      return origReplaceState.call(this, state, title, url);
    };
    window.addEventListener('popstate', function () {
      syncUpstreamFromRewritten(window.location.href);
    });
  } catch (e) {}

  // 6. Intercept setAttribute AND DOM URL property setters/getters (.href / .pathname / .hostname / .src / .action)
  var origSetAttribute = Element.prototype.setAttribute;
  try {
    Element.prototype.setAttribute = function (name, value) {
      try {
        var lower = String(name || '').toLowerCase();
        var valStr = typeof value === 'string' ? value : coerceUrlStr(value);
        if (
          (lower === 'src' ||
            lower === 'href' ||
            lower === 'action' ||
            lower === 'poster' ||
            lower === 'data-src' ||
            lower === 'formaction') &&
          valStr
        ) {
          value = rewriteUrlToRammerhead(valStr);
        }
      } catch (e) {}
      return origSetAttribute.call(this, name, value);
    };

    var wrapUrlProp = function (proto, prop) {
      if (!proto) return;
      var desc = Object.getOwnPropertyDescriptor(proto, prop);
      if (!desc || !desc.set || !desc.get || !desc.configurable) return;
      Object.defineProperty(proto, prop, {
        configurable: true,
        enumerable: desc.enumerable,
        get: function () {
          var rawVal = desc.get.call(this);
          return typeof rawVal === 'string' ? extractOriginalUrl(rawVal) : rawVal;
        },
        set: function (val) {
          try {
            var valStr = typeof val === 'string' ? val : coerceUrlStr(val);
            if (valStr) {
              val = rewriteUrlToRammerhead(valStr);
            }
          } catch (e) {}
          return desc.set.call(this, val);
        },
      });
    };

    wrapUrlProp(window.HTMLAnchorElement && window.HTMLAnchorElement.prototype, 'href');
    wrapUrlProp(window.HTMLAreaElement && window.HTMLAreaElement.prototype, 'href');
    wrapUrlProp(window.HTMLLinkElement && window.HTMLLinkElement.prototype, 'href');
    wrapUrlProp(window.HTMLScriptElement && window.HTMLScriptElement.prototype, 'src');
    wrapUrlProp(window.HTMLImageElement && window.HTMLImageElement.prototype, 'src');
    wrapUrlProp(window.HTMLIFrameElement && window.HTMLIFrameElement.prototype, 'src');
    wrapUrlProp(window.HTMLMediaElement && window.HTMLMediaElement.prototype, 'src');
    wrapUrlProp(window.HTMLSourceElement && window.HTMLSourceElement.prototype, 'src');
    wrapUrlProp(window.HTMLEmbedElement && window.HTMLEmbedElement.prototype, 'src');
    wrapUrlProp(window.HTMLTrackElement && window.HTMLTrackElement.prototype, 'src');
    wrapUrlProp(window.HTMLVideoElement && window.HTMLVideoElement.prototype, 'poster');
    wrapUrlProp(window.HTMLFormElement && window.HTMLFormElement.prototype, 'action');
    wrapUrlProp(window.HTMLObjectElement && window.HTMLObjectElement.prototype, 'data');

    // Clean anchor URL decomposition props & setters (so mutating a.pathname / a.search keeps proxy prefix intact!)
    if (window.HTMLAnchorElement && window.HTMLAnchorElement.prototype) {
      var anchorHrefDesc = Object.getOwnPropertyDescriptor(window.HTMLAnchorElement.prototype, 'href');
      ['origin', 'protocol', 'host', 'hostname', 'port', 'pathname', 'search', 'hash'].forEach(function (part) {
        var partDesc = Object.getOwnPropertyDescriptor(window.HTMLAnchorElement.prototype, part);
        if (!partDesc || !partDesc.get || !partDesc.configurable) return;
        Object.defineProperty(window.HTMLAnchorElement.prototype, part, {
          configurable: true,
          enumerable: partDesc.enumerable,
          get: function () {
            try {
              var origHref = anchorHrefDesc && anchorHrefDesc.get ? anchorHrefDesc.get.call(this) : '';
              if (origHref && /^https?:\/\//i.test(origHref)) {
                return new URL(origHref)[part];
              }
            } catch (e) {}
            return partDesc.get.call(this);
          },
          set:
            part === 'origin' || !partDesc.set
              ? partDesc.set
              : function (v) {
                  try {
                    var origHref = anchorHrefDesc && anchorHrefDesc.get ? anchorHrefDesc.get.call(this) : '';
                    if (origHref && /^https?:\/\//i.test(origHref) && anchorHrefDesc.set) {
                      var parsed = new URL(origHref);
                      parsed[part] = v;
                      anchorHrefDesc.set.call(this, parsed.href);
                      return;
                    }
                  } catch (e) {}
                  partDesc.set.call(this, v);
                },
        });
      });
    }
  } catch (e) {}

  // 6.5 Rewrite URL attributes in HTML strings BEFORE innerHTML/insertAdjacentHTML/document.write triggers immediate browser requests
  function rewriteDynamicHtmlFragment(htmlStr) {
    if (typeof htmlStr !== 'string' || htmlStr.indexOf('<') === -1) return htmlStr;
    return htmlStr.replace(
      /<(a|area|link|img|script|iframe|video|audio|source|embed|form|object|track|input|button)\b([^>]*)>/gi,
      function (_m, tag, attrs) {
        if (!attrs) return '<' + tag + '>';
        var rwAttrs = attrs.replace(
          /(\s+)(href|src|action|poster|data-src|formaction|data)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+))/gi,
          function (_am, ws, attrName, dVal, sVal, uVal) {
            var val = dVal !== undefined ? dVal : sVal !== undefined ? sVal : uVal;
            var rewritten = String(rewriteUrlToRammerhead(val)).replace(/"/g, '&quot;');
            return ws + attrName + '="' + rewritten + '"';
          }
        );
        return '<' + tag + rwAttrs + '>';
      }
    );
  }

  try {
    var innerHtmlDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (innerHtmlDesc && innerHtmlDesc.set && innerHtmlDesc.configurable) {
      Object.defineProperty(Element.prototype, 'innerHTML', {
        configurable: true,
        enumerable: innerHtmlDesc.enumerable,
        get: innerHtmlDesc.get,
        set: function (val) {
          if (typeof val === 'string' && this.tagName !== 'SCRIPT' && this.tagName !== 'STYLE') {
            val = rewriteDynamicHtmlFragment(val);
          }
          return innerHtmlDesc.set.call(this, val);
        },
      });
    }
    var origInsertAdjacentHTML = Element.prototype.insertAdjacentHTML;
    if (typeof origInsertAdjacentHTML === 'function') {
      Element.prototype.insertAdjacentHTML = function (position, text) {
        if (typeof text === 'string' && this.tagName !== 'SCRIPT' && this.tagName !== 'STYLE') {
          text = rewriteDynamicHtmlFragment(text);
        }
        return origInsertAdjacentHTML.call(this, position, text);
      };
    }
    var origDocWrite = document.write;
    var origDocWriteln = document.writeln;
    if (typeof origDocWrite === 'function') {
      document.write = function () {
        var args = [];
        for (var i = 0; i < arguments.length; i++) {
          args.push(typeof arguments[i] === 'string' ? rewriteDynamicHtmlFragment(arguments[i]) : arguments[i]);
        }
        return origDocWrite.apply(this, args);
      };
    }
    if (typeof origDocWriteln === 'function') {
      document.writeln = function () {
        var args = [];
        for (var i = 0; i < arguments.length; i++) {
          args.push(typeof arguments[i] === 'string' ? rewriteDynamicHtmlFragment(arguments[i]) : arguments[i]);
        }
        return origDocWriteln.apply(this, args);
      };
    }
  } catch (e) {}

  // 7. Notify FrostHub parent tabs if embedded (using realParent directly, not virtualized parent)
  try {
    if (realParent && realParent !== window && window === rhTopWin && upstreamUrl) {
      var lastTitle = '';
      var postMeta = function () {
        try {
          var currentUpstream = getUpstreamUrlObj().href || upstreamUrl;
          if (document.title !== lastTitle) {
            lastTitle = document.title;
            origPostMessageFn
              ? origPostMessageFn.call(
                  realParent,
                  { type: 'RAMMERHEAD_NAV', url: currentUpstream, title: document.title },
                  '*'
                )
              : realParent.postMessage(
                  { type: 'RAMMERHEAD_NAV', url: currentUpstream, title: document.title },
                  '*'
                );
          }
        } catch (e) {}
      };
      window.addEventListener('DOMContentLoaded', postMeta);
      window.addEventListener('load', postMeta);
    }
  } catch (e) {}

  // 8. Auto-resume Web Audio on user gesture
  var audioContexts = [];
  var OrigAudioContext = window.AudioContext || window.webkitAudioContext;
  if (OrigAudioContext) {
    var PatchedAudioContext = function () {
      var ctx = new OrigAudioContext();
      audioContexts.push(ctx);
      return ctx;
    };
    PatchedAudioContext.prototype = OrigAudioContext.prototype;
    window.AudioContext = PatchedAudioContext;
    if (window.webkitAudioContext) window.webkitAudioContext = PatchedAudioContext;
  }

  function resumeAllAudio() {
    for (var i = 0; i < audioContexts.length; i++) {
      try {
        if (audioContexts[i].state === 'suspended') {
          audioContexts[i].resume();
        }
      } catch (e) {}
    }
  }
  window.addEventListener('pointerdown', resumeAllAudio, { capture: true, passive: true });
  window.addEventListener('keydown', resumeAllAudio, { capture: true, passive: true });

  // 9. Rewrite element URL attributes + forms reliably
  function rewriteElementTree(root) {
    if (!root || root.nodeType !== 1) return;
    try {
      var rewriteSingle = function (el) {
        var tag = (el.tagName || '').toUpperCase();
        if (tag === 'A' || tag === 'AREA' || tag === 'LINK') {
          var h = el.getAttribute('href');
          if (h && !h.startsWith('#') && !h.startsWith('javascript:')) {
            var rh = rewriteUrlToRammerhead(h);
            if (rh !== h) origSetAttribute.call(el, 'href', rh);
          }
          if (tag === 'A' && window === rhTopWin) {
            var tgt = (el.getAttribute('target') || '').toLowerCase();
            if (tgt === '_top' || tgt === '_parent') {
              origSetAttribute.call(el, 'target', '_self');
            }
          }
        } else if (tag === 'FORM') {
          var rawAct = el.getAttribute('action');
          var act = rawAct || ((el.method || 'get').toLowerCase() === 'get' ? upstreamUrl.split('?')[0] : upstreamUrl) || upstreamOrigin + '/';
          if (act) {
            var rAct = rewriteUrlToRammerhead(act);
            if (rAct !== rawAct) origSetAttribute.call(el, 'action', rAct);
          }
          if (window === rhTopWin) {
            var ftgt = (el.getAttribute('target') || '').toLowerCase();
            if (ftgt === '_top' || ftgt === '_parent') {
              origSetAttribute.call(el, 'target', '_self');
            }
          }
          var ss = el.querySelector('input[name="safe"]');
          if (ss) ss.value = 'off';
          var safe = el.querySelector('input[name="safesearch"]');
          if (safe) safe.value = '0';
        } else if (
          tag === 'IMG' ||
          tag === 'SCRIPT' ||
          tag === 'IFRAME' ||
          tag === 'VIDEO' ||
          tag === 'AUDIO' ||
          tag === 'SOURCE' ||
          tag === 'EMBED' ||
          tag === 'TRACK' ||
          tag === 'INPUT'
        ) {
          var s = el.getAttribute('src');
          if (s) {
            var rs = rewriteUrlToRammerhead(s);
            if (rs !== s) origSetAttribute.call(el, 'src', rs);
          }
          if (tag === 'VIDEO') {
            var p = el.getAttribute('poster');
            if (p) {
              var rp = rewriteUrlToRammerhead(p);
              if (rp !== p) origSetAttribute.call(el, 'poster', rp);
            }
          }
          if (tag === 'INPUT' || tag === 'BUTTON') {
            var fa = el.getAttribute('formaction');
            if (fa) {
              var rfa = rewriteUrlToRammerhead(fa);
              if (rfa !== fa) origSetAttribute.call(el, 'formaction', rfa);
            }
          }
        } else if (tag === 'OBJECT') {
          var d = el.getAttribute('data');
          if (d) {
            var rd = rewriteUrlToRammerhead(d);
            if (rd !== d) origSetAttribute.call(el, 'data', rd);
          }
        }
      };

      rewriteSingle(root);
      var children = root.querySelectorAll('a, area, link, form, img, script, iframe, video, audio, source, embed, track, object, input, button');
      for (var i = 0; i < children.length; i++) {
        rewriteSingle(children[i]);
      }
    } catch (e) {}
  }

  function scanForms() {
    try {
      var forms = document.querySelectorAll('form');
      for (var i = 0; i < forms.length; i++) {
        rewriteElementTree(forms[i]);
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanForms, { once: true });
  } else {
    scanForms();
  }

  // 10. Intercept link clicks and form submissions to guarantee searches NEVER escape to app shell or FrostHub top frame
  document.addEventListener(
    'click',
    function (e) {
      var target = e.target;
      while (target && String(target.tagName || '').toUpperCase() !== 'A') {
        target = target.parentElement || target.parentNode;
      }
      if (target && String(target.tagName || '').toUpperCase() === 'A') {
        var href = target.getAttribute('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          var rewritten = rewriteUrlToRammerhead(href);
          if (rewritten !== href) {
            origSetAttribute.call(target, 'href', rewritten);
          }
        }
        if (window === rhTopWin) {
          var tgt = (target.getAttribute('target') || '').toLowerCase();
          if (tgt === '_top' || tgt === '_parent') {
            origSetAttribute.call(target, 'target', '_self');
          }
        }
      }
    },
    true
  );

  function prepareFormAction(form) {
    if (!form || String(form.tagName || '').toUpperCase() !== 'FORM') return;
    var rawAct = form.getAttribute('action');
    var act = rawAct || ((form.method || 'get').toLowerCase() === 'get' ? upstreamUrl.split('?')[0] : upstreamUrl) || upstreamOrigin + '/';
    var rewrittenAct = rewriteUrlToRammerhead(act);
    if (rewrittenAct && rewrittenAct !== rawAct) {
      origSetAttribute.call(form, 'action', rewrittenAct);
    }
    if (window === rhTopWin) {
      var ftgt = (form.getAttribute('target') || '').toLowerCase();
      if (ftgt === '_top' || ftgt === '_parent') {
        origSetAttribute.call(form, 'target', '_self');
      }
    }
    syncCookiesToServer(true);
  }

  document.addEventListener(
    'submit',
    function (e) {
      try {
        prepareFormAction(e.target);
      } catch (err) {}
    },
    true
  );

  try {
    var origFormSubmit = HTMLFormElement.prototype.submit;
    HTMLFormElement.prototype.submit = function () {
      try {
        prepareFormAction(this);
      } catch (e) {}
      return origFormSubmit.apply(this, arguments);
    };
  } catch (e) {}

  // 11. Deep MutationObserver for SPA dynamic links, search results & forms
  if (typeof MutationObserver !== 'undefined') {
    var startObserver = function () {
      var rootTarget = document.body || document.documentElement;
      if (!rootTarget) return;
      var observer = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          var added = mutations[i].addedNodes;
          for (var j = 0; j < added.length; j++) {
            var node = added[j];
            if (node && node.nodeType === 1) {
              rewriteElementTree(node);
            }
          }
        }
      });
      observer.observe(rootTarget, { childList: true, subtree: true });
    };
    if (document.body) {
      startObserver();
    } else {
      window.addEventListener('DOMContentLoaded', startObserver, { once: true });
    }
  }
})();
