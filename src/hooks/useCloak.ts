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
    favicon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='12' fill='%230f172a'/><text x='15' y='44' font-family='sans-serif' font-weight='900' font-size='28' fill='%23ffffff'>F</text><rect x='34' y='18' width='24' height='28' rx='6' fill='%230066FF'/><text x='46' y='40' font-family='sans-serif' font-weight='900' font-size='20' fill='%23ffffff' text-anchor='middle'>H</text></svg>",
  },
  {
    id: 'google',
    name: 'Google',
    title: 'Google',
    favicon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%234285F4' d='M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z'/><path fill='%2334A853' d='M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.13 0-5.78-2.11-6.73-4.96H1.18v3.14C3.17 21.36 7.23 24 12 24z'/><path fill='%23FBBC05' d='M5.27 14.24c-.25-.72-.39-1.5-.39-2.24s.14-1.52.39-2.24V6.62H1.18C.43 8.13 0 9.82 0 12s.43 3.87 1.18 5.38l4.09-3.14z'/><path fill='%23EA4335' d='M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.17 2.64 1.18 6.62l4.09 3.14c.95-2.85 3.6-4.96 6.73-4.96z'/></svg>",
  },
  {
    id: 'classroom',
    name: 'Google Classroom',
    title: 'Home',
    favicon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><path fill='%230f9d58' d='M448 32H64C28.65 32 0 60.65 0 96v320c0 35.35 28.65 64 64 64h384c35.35 0 64-28.65 64-64V96c0-35.35-28.65-64-64-64z'/><path fill='%23ffffff' d='M256 144c-44.18 0-80 35.82-80 80s35.82 80 80 80 80-35.82 80-80-35.82-80-80-80zm0 128c-26.47 0-48-21.53-48-48s21.53-48 48-48 48 21.53 48 48-21.53 48-48 48zm0 32c-53.02 0-160 26.51-160 79.5v32.5h320v-32.5c0-52.99-106.98-79.5-160-79.5zm128 79.5H128v-1.12c14.7-12.28 73.04-30.38 128-30.38s113.3 18.1 128 30.38v1.12z'/></svg>",
  },
  {
    id: 'drive',
    name: 'Google Drive',
    title: 'My Drive - Google Drive',
    favicon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 87.3 78.2'><path fill='%230066da' d='M6.1 72.2l15.2-26.3h30.4l15.2 26.3H6.1z'/><path fill='%2300ac47' d='M43.7 4.7L21.3 43.7l15.2 26.3h30.4L58.9 43.7 43.7 4.7z'/><path fill='%23ea4335' d='M66.9 72.2L51.7 45.9 36.5 72.2h30.4z'/><path fill='%23fbbc05' d='M21.3 43.7L6.1 72.2h15.2l15.2-28.5-15.2z'/></svg>",
  },
  {
    id: 'desmos',
    name: 'Desmos',
    title: 'Desmos | Graphing Calculator',
    favicon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><rect width='512' height='512' rx='96' fill='%230a3641'/><path fill='none' stroke='%23eb5757' stroke-width='48' stroke-linecap='round' stroke-linejoin='round' d='M96 256h80l64-128 64 256 64-128h80'/></svg>",
  },
  {
    id: 'canvas',
    name: 'Canvas',
    title: 'Dashboard',
    favicon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><circle cx='256' cy='256' r='240' fill='%23e02424'/><path fill='%23ffffff' d='M256 112c-79.53 0-144 64.47-144 144s64.47 144 144 144 144-64.47 144-144-64.47-144-144-144zm0 240c-52.94 0-96-43.06-96-96s43.06-96 96-96 96 43.06 96 96-43.06 96-96 96z'/></svg>",
  },
  {
    id: 'clever',
    name: 'Clever',
    title: 'Clever | Portal',
    favicon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><rect width='512' height='512' rx='112' fill='%232855D9'/><path fill='%23ffffff' d='M352 160H224c-52.94 0-96 43.06-96 96s43.06 96 96 96h128v-64H224c-17.67 0-32-14.33-32-32s14.33-32 32-32h128V160z'/></svg>",
  },
];

const CLOAK_STORAGE_KEY = 'melted_cloak_preset';
const PANIC_KEY_STORAGE = 'melted_panic_key';
const PANIC_URL_STORAGE = 'melted_panic_url';

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

  // Apply tab cloak to document
  const applyPreset = useCallback((presetId: string) => {
    const preset = CLOAK_PRESETS.find((p) => p.id === presetId) || CLOAK_PRESETS[0];
    document.title = preset.title;

    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = preset.favicon;

    setActivePreset(presetId);
    localStorage.setItem(CLOAK_STORAGE_KEY, presetId);
  }, []);

  // Custom apply title & favicon
  const applyCustomCloak = useCallback((title: string, favicon: string) => {
    if (title) document.title = title;
    if (favicon) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = favicon;
    }
    setActivePreset('custom');
    localStorage.setItem(CLOAK_STORAGE_KEY, 'custom');
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
        if (event.data && event.data.type === 'TAB_METADATA_UPDATE') {
          const { title, favicon } = event.data;
          if (title && document.title !== title && activePreset !== 'default') {
            document.title = title;
          }
          if (favicon) {
            let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
            if (!link) {
              link = document.createElement('link');
              link.rel = 'icon';
              document.head.appendChild(link);
            }
            if (link.href !== favicon) {
              link.href = favicon;
            }
          }
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

  // Restore saved preset on mount
  useEffect(() => {
    const saved = localStorage.getItem(CLOAK_STORAGE_KEY);
    if (saved && saved !== 'default') {
      applyPreset(saved);
    }
  }, [applyPreset]);

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
