import { useState, useEffect, useCallback } from 'react';
import { GameItem } from '../types/game';
import { shouldUseScramjetByDefault, getScramjetTargetUrl, getPlayableGameUrl } from '../services/gameService';
import { initScramjetProxy, launchInScramjetFrame } from '../services/scramjetProxyService';

export interface CloakPreset {
  id: string;
  name: string;
  title: string;
  favicon: string;
}

export const CLOAK_PRESETS: CloakPreset[] = [
  {
    id: 'default',
    name: 'FrostHub',
    title: 'FrostHub — Unblocked Games & Arcades',
    favicon: '/assets/cloaks/frosthub.svg',
  },
  {
    id: 'google',
    name: 'Google',
    title: 'Google',
    favicon: '/assets/cloaks/google.svg',
  },
  {
    id: 'classroom',
    name: 'Google Classroom',
    title: 'Home',
    favicon: '/assets/cloaks/classroom.svg',
  },
  {
    id: 'drive',
    name: 'Google Drive',
    title: 'My Drive - Google Drive',
    favicon: '/assets/cloaks/drive.svg',
  },
  {
    id: 'desmos',
    name: 'Desmos',
    title: 'Desmos | Graphing Calculator',
    favicon: '/assets/cloaks/desmos.svg',
  },
  {
    id: 'canvas',
    name: 'Canvas',
    title: 'Dashboard',
    favicon: '/assets/cloaks/canvas.svg',
  },
  {
    id: 'clever',
    name: 'Clever',
    title: 'Clever | Portal',
    favicon: '/assets/cloaks/clever.svg',
  },
];

const CLOAK_STORAGE_KEY = 'melted_cloak_preset';
const PANIC_KEY_STORAGE = 'melted_panic_key';
const PANIC_URL_STORAGE = 'melted_panic_url';

function resolveFullUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
}

function updateDocumentFavicon(faviconUrl: string) {
  if (typeof document === 'undefined' || !faviconUrl) return;
  const isSvg = faviconUrl.includes('.svg') || faviconUrl.includes('image/svg+xml');
  const type = isSvg ? 'image/svg+xml' : 'image/png';

  document.querySelectorAll("link[rel*='icon']").forEach((el) => el.remove());

  const rels = ['icon', 'shortcut icon', 'apple-touch-icon'];
  rels.forEach((rel) => {
    const link = document.createElement('link');
    link.rel = rel;
    link.type = type;
    link.href = faviconUrl;
    document.head.appendChild(link);
  });
}

function notifyParentMetadata(title: string, favicon: string) {
  if (typeof window === 'undefined' || window.self === window.top) return;
  try {
    const fullFavicon = resolveFullUrl(favicon);
    window.parent.postMessage(
      {
        type: 'TAB_METADATA_UPDATE',
        title: title || document.title,
        favicon: fullFavicon,
      },
      '*'
    );
  } catch (err) {
    console.debug('Failed to send metadata to parent frame:', err);
  }
}

export function useCloak() {
  const [activePreset, setActivePreset] = useState<string>(() => {
    return localStorage.getItem(CLOAK_STORAGE_KEY) || 'default';
  });

  const [panicKey, setPanicKey] = useState<string>(() => {
    return localStorage.getItem(PANIC_KEY_STORAGE) || ']';
  });

  const [panicUrl, setPanicUrl] = useState<string>(() => {
    return localStorage.getItem(PANIC_URL_STORAGE) || 'https://classroom.google.com';
  });

  // Apply tab cloak to document and notify parent frame
  const applyPreset = useCallback((presetId: string) => {
    const preset = CLOAK_PRESETS.find((p) => p.id === presetId) || CLOAK_PRESETS[0];
    document.title = preset.title;
    updateDocumentFavicon(preset.favicon);

    setActivePreset(presetId);
    localStorage.setItem(CLOAK_STORAGE_KEY, presetId);

    notifyParentMetadata(preset.title, preset.favicon);
  }, []);

  // Custom apply title & favicon
  const applyCustomCloak = useCallback((title: string, favicon: string) => {
    if (title) document.title = title;
    if (favicon) {
      updateDocumentFavicon(favicon);
    }
    setActivePreset('custom');
    localStorage.setItem(CLOAK_STORAGE_KEY, 'custom');

    notifyParentMetadata(title || document.title, favicon);
  }, []);

  // Update panic key
  const updatePanicKey = useCallback((newKey: string) => {
    setPanicKey(newKey);
    localStorage.setItem(PANIC_KEY_STORAGE, newKey);
  }, []);

  // Update panic URL
  const updatePanicUrl = useCallback((newUrl: string) => {
    setPanicUrl(newUrl);
    localStorage.setItem(PANIC_URL_STORAGE, newUrl);
  }, []);

  // Panic trigger handler
  const triggerPanic = useCallback(() => {
    window.location.replace(panicUrl);
  }, [panicUrl]);

  // Global key listener for panic button and postMessage cross-origin metadata sync
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === panicKey) {
        e.preventDefault();
        triggerPanic();
      }
    };

    const handleMessage = (event: MessageEvent) => {
      try {
        if (!event.data) return;

        // Parent requests metadata update
        if (event.data.type === 'REQUEST_TAB_METADATA') {
          const currentPreset = CLOAK_PRESETS.find((p) => p.id === activePreset) || CLOAK_PRESETS[0];
          const iconEl = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
          const currentFavicon = iconEl ? iconEl.href : currentPreset.favicon;
          notifyParentMetadata(document.title, currentFavicon);
          return;
        }

        // Child receives metadata from nested frame
        if (event.data.type === 'TAB_METADATA_UPDATE') {
          const { title, favicon } = event.data;
          if (title && document.title !== title && activePreset !== 'default') {
            document.title = title;
          }
          if (favicon) {
            updateDocumentFavicon(favicon);
          }
          // Propagate upward if embedded
          notifyParentMetadata(title || document.title, favicon);
        }
      } catch {}
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('message', handleMessage);
    };
  }, [panicKey, triggerPanic, activePreset]);

  // Restore saved preset on mount and notify parent
  useEffect(() => {
    const saved = localStorage.getItem(CLOAK_STORAGE_KEY) || 'default';
    const preset = CLOAK_PRESETS.find((p) => p.id === saved) || CLOAK_PRESETS[0];
    document.title = preset.title;
    updateDocumentFavicon(preset.favicon);
    notifyParentMetadata(preset.title, preset.favicon);
  }, []);

  return {
    activePreset,
    applyPreset,
    applyCustomCloak,
    panicKey,
    updatePanicKey,
    panicUrl,
    updatePanicUrl,
    triggerPanic,
    presets: CLOAK_PRESETS,
  };
}

const META_INJECTION_SCRIPT = `
  (function () {
    if (window.self === window.top) return;

    function getFaviconHref() {
      const iconEl =
        document.querySelector('link[rel="icon"]') ||
        document.querySelector('link[rel="shortcut icon"]') ||
        document.querySelector('link[rel*="icon"]');
      return iconEl ? iconEl.href : '';
    }

    function sendTabMetadata() {
      window.parent.postMessage(
        {
          type: 'TAB_METADATA_UPDATE',
          title: document.title,
          favicon: getFaviconHref()
        },
        '*'
      );
    }

    window.addEventListener('DOMContentLoaded', sendTabMetadata);
    window.addEventListener('load', sendTabMetadata);

    const observer = new MutationObserver(sendTabMetadata);
    function observeHead() {
      if (document.head) {
        observer.observe(document.head, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['href', 'rel'],
          characterData: true
        });
        sendTabMetadata();
      } else {
        requestAnimationFrame(observeHead);
      }
    }

    observeHead();
  })();
`;

export function launchAboutBlank(gameUrl: string, gameTitle: string) {
  try {
    const win = window.open('about:blank', '_blank');
    if (!win) {
      window.open(gameUrl, '_blank');
      return;
    }

    win.document.title = gameTitle || 'Classes';
    
    // Desktop Spoofing Script for School Chromebooks
    const script = win.document.createElement('script');
    script.textContent = `(function(){try{var u='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';Object.defineProperty(navigator,'userAgent',{get:function(){return u},configurable:true});Object.defineProperty(navigator,'platform',{get:function(){return'Win32'},configurable:true});Object.defineProperty(navigator,'vendor',{get:function(){return'Google Inc.'},configurable:true});if(navigator.userAgentData){Object.defineProperty(navigator,'userAgentData',{get:function(){return{brands:[{brand:'Chromium',version:'124'},{brand:'Google Chrome',version:'124'}],mobile:false,platform:'Windows',getHighEntropyValues:function(){return Promise.resolve({architecture:'x86',bitness:'64',mobile:false,platform:'Windows'})}}},configurable:true})}}catch(e){}})();`;
    win.document.head.appendChild(script);

    // Inject cross-origin postMessage metadata sync script
    const metaScript = win.document.createElement('script');
    metaScript.textContent = META_INJECTION_SCRIPT;
    win.document.head.appendChild(metaScript);

    // Set favicon to Google Classroom icon for extra stealth
    const link = win.document.createElement('link');
    link.rel = 'icon';
    link.href = 'https://ssl.gstatic.com/classroom/favicon.png';
    win.document.head.appendChild(link);

    const resolvedUrl = (() => {
      try {
        return new URL(gameUrl, window.location.href).href;
      } catch {
        return gameUrl;
      }
    })();

    const iframe = win.document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.width = '100vw';
    iframe.style.height = '100vh';
    iframe.style.border = 'none';
    iframe.allowFullscreen = true;
    iframe.setAttribute('allow', 'fullscreen; autoplay; gamepad; microphone; clipboard-read; clipboard-write');
    iframe.src = resolvedUrl;

    win.document.body.style.margin = '0';
    win.document.body.style.padding = '0';
    win.document.body.style.overflow = 'hidden';
    win.document.body.style.backgroundColor = '#000';
    win.document.body.appendChild(iframe);
  } catch (err) {
    console.error('About blank launch error:', err);
    window.open(gameUrl, '_blank');
  }
}

export async function launchGameInNewTab(game: GameItem) {
  const gameTitle = game.name || 'Game';
  const useSj = shouldUseScramjetByDefault(game);
  const targetUrl = useSj ? getScramjetTargetUrl(game) : getPlayableGameUrl(game);

  try {
    const win = window.open('about:blank', '_blank');
    if (!win) {
      window.open(targetUrl, '_blank');
      return;
    }

    win.document.title = `${gameTitle} — Google Classroom`;
    
    const script = win.document.createElement('script');
    script.textContent = `(function(){try{var u='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';Object.defineProperty(navigator,'userAgent',{get:function(){return u},configurable:true});Object.defineProperty(navigator,'platform',{get:function(){return'Win32'},configurable:true});Object.defineProperty(navigator,'vendor',{get:function(){return'Google Inc.'},configurable:true});}catch(e){}})();`;
    win.document.head.appendChild(script);

    const metaScript = win.document.createElement('script');
    metaScript.textContent = META_INJECTION_SCRIPT;
    win.document.head.appendChild(metaScript);

    const link = win.document.createElement('link');
    link.rel = 'icon';
    link.href = 'https://ssl.gstatic.com/classroom/favicon.png';
    win.document.head.appendChild(link);

    const iframe = win.document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.width = '100vw';
    iframe.style.height = '100vh';
    iframe.style.border = 'none';
    iframe.allowFullscreen = true;
    iframe.setAttribute('allow', 'fullscreen; autoplay; gamepad; microphone; clipboard-read; clipboard-write; focus-without-user-activation; pointer-lock');

    win.document.body.style.margin = '0';
    win.document.body.style.padding = '0';
    win.document.body.style.overflow = 'hidden';
    win.document.body.style.backgroundColor = '#000';
    win.document.body.appendChild(iframe);

    if (useSj && targetUrl) {
      await initScramjetProxy();
      await launchInScramjetFrame(iframe, targetUrl);
    } else {
      iframe.src = targetUrl;
    }
  } catch (err) {
    console.error('Failed to launch game in new tab:', err);
    window.open(targetUrl, '_blank');
  }
}
