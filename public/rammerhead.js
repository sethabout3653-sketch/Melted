/**
 * Rammerhead In-Page Client Runtime
 * - Root-relative / current-origin URL rewriting (never leaks localhost)
 * - Persistent additive cookie jar synced across localStorage + /api/rammerhead/cookies (never resets cookies)
 * - Crash-proof YouTube playback hook & auto fallback via /api/yt-player-fallback + /api/yt-stream
 * - Framebusting protection, SafeSearch OFF enforcement, and Web Audio auto-resume
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

  function normalizeSlashes(raw) {
    return String(raw || '')
      .trim()
      .replace(/^(https?):\/+([^/])/i, '$1://$2');
  }

  function rewriteUrlToRammerhead(url) {
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

    // Never double-wrap our own internal Rammerhead/YouTube endpoints or already-proxied URLs
    if (
      trimmed.indexOf('/' + sessionId + '/') !== -1 ||
      trimmed.startsWith('/api/rammerhead/') ||
      trimmed.startsWith('/api/yt-stream') ||
      trimmed.startsWith('/api/yt-player-fallback') ||
      trimmed.indexOf(proxyOrigin + '/api/rammerhead/') === 0 ||
      trimmed.indexOf(proxyOrigin + '/api/yt-stream') === 0 ||
      trimmed.indexOf(proxyOrigin + '/api/yt-player-fallback') === 0 ||
      trimmed === '/rammerhead.js' ||
      trimmed.startsWith('/rammerhead.js?')
    ) {
      return url;
    }

    // Special YouTube resilient stream redirect inside FrostHub
    if (trimmed.indexOf('__frost_yt_stream__') !== -1) {
      try {
        var parsedStream = new URL(trimmed, 'https://www.youtube.com');
        return (proxyOrigin ? proxyOrigin : '') + '/api/yt-stream' + parsedStream.search;
      } catch (e) {}
    }

    var normalized = normalizeSlashes(trimmed);
    var prefix = (proxyOrigin || '') + '/api/rammerhead/' + sessionId + '/';

    if (/^https?:\/\//i.test(normalized)) {
      return prefix + normalized;
    }
    if (normalized.startsWith('//')) {
      var proto = upstreamOrigin && upstreamOrigin.startsWith('http:') ? 'http:' : 'https:';
      return prefix + proto + normalized;
    }
    if (normalized.startsWith('/')) {
      var baseOrigin = upstreamOrigin || (window.location.origin !== 'null' ? window.location.origin : '');
      if (
        baseOrigin &&
        normalized.indexOf('/api/rammerhead/') !== 0 &&
        normalized.indexOf('/api/yt-stream') !== 0 &&
        normalized.indexOf('/api/yt-player-fallback') !== 0 &&
        normalized !== '/rammerhead.js'
      ) {
        return prefix + baseOrigin + normalized;
      }
      return url;
    }

    // Relative URL resolved against actual upstream URL
    try {
      var resolved = new URL(normalized, upstreamUrl || upstreamOrigin || window.location.href).href;
      return prefix + resolved;
    } catch (e) {
      return url;
    }
  }

  function extractOriginalUrl(proxied) {
    if (!proxied || typeof proxied !== 'string') return proxied;
    var idx = proxied.indexOf('/' + sessionId + '/');
    if (idx !== -1) {
      return normalizeSlashes(proxied.slice(idx + sessionId.length + 2));
    }
    return proxied;
  }

  // 0. Persistent Additive Client Cookie Jar (never resets cookies)
  var COOKIE_STORAGE_KEY = 'frosthub_rammerhead_cookies_v1';
  var COOKIE_USER_KEY = 'frosthub_chat_user_id';
  var memoryCookieJar = {};
  var syncTimer = null;

  function loadStoredCookieJar() {
    try {
      var raw = window.localStorage.getItem(COOKIE_STORAGE_KEY);
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
      window.localStorage.setItem(COOKIE_STORAGE_KEY, JSON.stringify(memoryCookieJar));
    } catch (e) {}
  }

  function syncCookiesToServer(immediate) {
    if (syncTimer) clearTimeout(syncTimer);
    var executeSync = function () {
      try {
        var userId = window.localStorage.getItem(COOKIE_USER_KEY) || 'default';
        var payload = JSON.stringify({
          userId: userId,
          sessionId: sessionId,
          cookies: memoryCookieJar,
        });
        if (immediate && navigator && typeof navigator.sendBeacon === 'function') {
          navigator.sendBeacon((proxyOrigin || '') + '/api/rammerhead/cookies', new Blob([payload], { type: 'application/json' }));
          return;
        }
        if (origFetchRef) {
          origFetchRef.call(window, (proxyOrigin || '') + '/api/rammerhead/cookies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
          }).catch(function () {});
        }
      } catch (e) {}
    };

    if (immediate) {
      executeSync();
    } else {
      syncTimer = setTimeout(executeSync, 50);
    }
  }

  function hydrateCookiesFromServer() {
    try {
      var userId = window.localStorage.getItem(COOKIE_USER_KEY) || 'default';
      if (!origFetchRef) return;
      origFetchRef
        .call(window, (proxyOrigin || '') + '/api/rammerhead/cookies?userId=' + encodeURIComponent(userId) + '&sessionId=' + encodeURIComponent(sessionId))
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .then(function (data) {
          if (!data || !data.cookies || typeof data.cookies !== 'object') return;
          var changed = false;
          Object.keys(data.cookies).forEach(function (k) {
            var incoming = data.cookies[k];
            if (!incoming || !incoming.name) return;
            var ex = memoryCookieJar[k];
            // Only adopt server cookie if local doesn't have it or if server has a non-empty value and local is empty
            if (!ex || (!ex.value && incoming.value)) {
              memoryCookieJar[k] = incoming;
              changed = true;
            }
          });
          if (changed) {
            persistCookieJarLocally();
          }
        })
        .catch(function () {});
    } catch (e) {}
  }

  // Cross-page / cross-tab synchronization
  window.addEventListener('storage', function (e) {
    if (e.key === COOKIE_STORAGE_KEY && e.newValue) {
      try {
        var parsed = JSON.parse(e.newValue);
        if (parsed && typeof parsed === 'object') {
          memoryCookieJar = parsed;
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

  var origFetchRef = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
  loadStoredCookieJar();
  if (origFetchRef) {
    syncCookiesToServer(true);
    hydrateCookiesFromServer();
  }

  // Virtualize document.cookie scoped to upstreamHost so cookies persist safely without polluting FrostHub's root origin
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
          // Never wipe non-empty cookie values automatically
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
          syncCookiesToServer();
        },
      });
    }
  } catch (e) {}

  // 1. Trap top-level framebusting
  try {
    Object.defineProperty(window, 'top', {
      get: function () { return window; },
      configurable: true,
    });
    Object.defineProperty(window, 'parent', {
      get: function () { return window; },
      configurable: true,
    });
    Object.defineProperty(window, 'frameElement', {
      get: function () { return null; },
      configurable: true,
    });
  } catch (e) {}

  // 2. Intercept window.fetch (with YouTube /youtubei/v1/player resilience)
  if (origFetchRef) {
    window.fetch = function (input, init) {
      try {
        var targetUrlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
        var rewritten = rewriteUrlToRammerhead(targetUrlStr);

        // Wrap YouTube player JSON fetches to recover automatically from bot-gate/LOGIN_REQUIRED without crashing
        if (
          upstreamHost.indexOf('youtube.com') !== -1 &&
          targetUrlStr.indexOf('/youtubei/v1/player') !== -1
        ) {
          var reqArg = typeof input === 'string' ? rewritten : new Request(rewritten, input);
          return origFetchRef(reqArg, init).then(function (resp) {
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

        if (typeof input === 'string') {
          return origFetchRef(rewritten, init);
        }
        if (input && typeof input.url === 'string') {
          if (rewritten !== input.url) {
            return origFetchRef(new Request(rewritten, input), init);
          }
          return origFetchRef(input, init);
        }
      } catch (e) {}
      return origFetchRef.apply(window, arguments);
    };
  }

  // 3. Intercept XMLHttpRequest
  if (window.XMLHttpRequest) {
    var origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      try {
        if (typeof url === 'string') {
          arguments[1] = rewriteUrlToRammerhead(url);
        }
      } catch (e) {}
      return origOpen.apply(this, arguments);
    };
  }

  // 4. Intercept navigator.sendBeacon
  if (navigator && typeof navigator.sendBeacon === 'function') {
    var origBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      try {
        if (typeof url === 'string') {
          url = rewriteUrlToRammerhead(url);
        }
      } catch (e) {}
      return origBeacon(url, data);
    };
  }

  // 5. Intercept window.open & history state updates so SPA routes keep proxy prefix
  var origOpenWin = window.open;
  if (typeof origOpenWin === 'function') {
    window.open = function (url, target, features) {
      try {
        if (typeof url === 'string') {
          url = rewriteUrlToRammerhead(url);
        }
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
          upstreamUrl = orig;
          upstreamOrigin = new URL(orig).origin;
          upstreamHost = new URL(orig).hostname.toLowerCase();
        }
      } catch (e) {}
    };
    history.pushState = function (state, title, url) {
      if (typeof url === 'string') {
        url = rewriteUrlToRammerhead(url);
        syncUpstreamFromRewritten(url);
      }
      return origPushState.call(this, state, title, url);
    };
    history.replaceState = function (state, title, url) {
      if (typeof url === 'string') {
        url = rewriteUrlToRammerhead(url);
        syncUpstreamFromRewritten(url);
      }
      return origReplaceState.call(this, state, title, url);
    };
  } catch (e) {}

  // 6. Intercept setAttribute AND DOM URL property setters (.href / .src / .action)
  try {
    var origSetAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name, value) {
      try {
        var lower = String(name || '').toLowerCase();
        if (
          (lower === 'src' || lower === 'href' || lower === 'action' || lower === 'poster' || lower === 'data-src') &&
          typeof value === 'string'
        ) {
          value = rewriteUrlToRammerhead(value);
        }
      } catch (e) {}
      return origSetAttribute.call(this, name, value);
    };

    var wrapUrlProp = function (proto, prop) {
      if (!proto) return;
      var desc = Object.getOwnPropertyDescriptor(proto, prop);
      if (!desc || !desc.set || !desc.configurable) return;
      Object.defineProperty(proto, prop, {
        configurable: true,
        enumerable: desc.enumerable,
        get: desc.get,
        set: function (val) {
          try {
            if (typeof val === 'string') {
              val = rewriteUrlToRammerhead(val);
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
    wrapUrlProp(window.HTMLFormElement && window.HTMLFormElement.prototype, 'action');
  } catch (e) {}

  // 7. Notify FrostHub parent tabs if embedded
  try {
    if (window.parent && window.parent !== window && upstreamUrl) {
      var lastTitle = '';
      var postMeta = function () {
        try {
          if (document.title !== lastTitle) {
            lastTitle = document.title;
            window.parent.postMessage(
              {
                type: 'RAMMERHEAD_NAV',
                url: extractOriginalUrl(window.location.href) || upstreamUrl,
                title: document.title,
              },
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

  // 9. Enforce SafeSearch OFF inside forms and ensure form actions route through Rammerhead
  function scanForms() {
    try {
      var forms = document.querySelectorAll('form');
      for (var i = 0; i < forms.length; i++) {
        var form = forms[i];
        var action = form.getAttribute('action');
        if (action) {
          form.setAttribute('action', rewriteUrlToRammerhead(action));
        }
        var ss = form.querySelector('input[name="safe"]');
        if (ss) ss.value = 'off';
        var safe = form.querySelector('input[name="safesearch"]');
        if (safe) safe.value = '0';
      }
    } catch (e) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanForms, { once: true });
  } else {
    scanForms();
  }

  // 10. Intercept link clicks and form submissions to maintain proxying
  document.addEventListener(
    'click',
    function (e) {
      var target = e.target;
      while (target && target.tagName !== 'A') {
        target = target.parentElement;
      }
      if (target && target.tagName === 'A') {
        var href = target.getAttribute('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          var rewritten = rewriteUrlToRammerhead(href);
          if (rewritten !== href) {
            target.setAttribute('href', rewritten);
          }
        }
      }
    },
    true
  );

  document.addEventListener(
    'submit',
    function (e) {
      try {
        var form = e.target;
        if (form && form.tagName === 'FORM') {
          var act = form.getAttribute('action') || form.action || upstreamUrl || '';
          if (act) {
            var rewrittenAct = rewriteUrlToRammerhead(act);
            if (rewrittenAct !== act) {
              form.setAttribute('action', rewrittenAct);
              if (form.action && form.action !== rewrittenAct) {
                form.action = rewrittenAct;
              }
            }
          }
        }
      } catch (err) {}
    },
    true
  );

  try {
    var origFormSubmit = HTMLFormElement.prototype.submit;
    HTMLFormElement.prototype.submit = function () {
      try {
        var act = this.getAttribute('action') || this.action || upstreamUrl || '';
        if (act) {
          var rewritten = rewriteUrlToRammerhead(act);
          if (rewritten !== act) {
            this.setAttribute('action', rewritten);
            this.action = rewritten;
          }
        }
      } catch (e) {}
      return origFormSubmit.apply(this, arguments);
    };
  } catch (e) {}

  // 11. MutationObserver for dynamically injected DOM nodes
  if (typeof MutationObserver !== 'undefined') {
    var startObserver = function () {
      var rootTarget = document.body || document.documentElement;
      if (!rootTarget) return;
      var observer = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          var added = mutations[i].addedNodes;
          for (var j = 0; j < added.length; j++) {
            var node = added[j];
            if (node.nodeType === 1) {
              if (node.tagName === 'A') {
                var h = node.getAttribute('href');
                if (h && !h.startsWith('#') && !h.startsWith('javascript:')) {
                  var rh = rewriteUrlToRammerhead(h);
                  if (rh !== h) node.setAttribute('href', rh);
                }
              } else if (
                node.tagName === 'IMG' ||
                node.tagName === 'SCRIPT' ||
                node.tagName === 'IFRAME' ||
                node.tagName === 'VIDEO' ||
                node.tagName === 'AUDIO' ||
                node.tagName === 'SOURCE'
              ) {
                var s = node.getAttribute('src');
                if (s) {
                  var rs = rewriteUrlToRammerhead(s);
                  if (rs !== s) node.setAttribute('src', rs);
                }
              } else if (node.tagName === 'FORM') {
                scanForms();
              }
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
