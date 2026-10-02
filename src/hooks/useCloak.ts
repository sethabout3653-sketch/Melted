import { useState, useEffect, useCallback } from 'react';

export interface CloakPreset {
  id: string;
  name: string;
  title: string;
  favicon: string;
}

export const CLOAK_PRESETS: CloakPreset[] = [
  {
    id: 'default',
    name: 'Melted (Original)',
    title: 'Melted — Unblocked Games & Arcades',
    favicon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='46' fill='%23FF5722'/><path d='M30 65 Q50 25 70 65 Q60 80 50 65 Q40 80 30 65 Z' fill='%23FFF'/></svg>",
  },
  {
    id: 'classroom',
    name: 'Google Classroom',
    title: 'Home',
    favicon: 'https://ssl.gstatic.com/classroom/favicon.png',
  },
  {
    id: 'drive',
    name: 'Google Drive',
    title: 'My Drive - Google Drive',
    favicon: 'https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png',
  },
  {
    id: 'docs',
    name: 'Google Docs',
    title: 'Untitled document - Google Docs',
    favicon: 'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico',
  },
  {
    id: 'canvas',
    name: 'Canvas LMS',
    title: 'Dashboard',
    favicon: 'https://du11hjcvx0uqb.cloudfront.net/dist/images/favicon-e10d657a73.ico',
  },
  {
    id: 'desmos',
    name: 'Desmos Calculator',
    title: 'Desmos | Graphing Calculator',
    favicon: 'https://www.desmos.com/favicon.ico',
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    title: 'Mathematics - Wikipedia',
    favicon: 'https://en.wikipedia.org/static/favicon/wikipedia.ico',
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

  // Global key listener for panic button
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === panicKey) {
        e.preventDefault();
        triggerPanic();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [panicKey, triggerPanic]);

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
    panicKey,
    updatePanicKey,
    panicUrl,
    updatePanicUrl,
    triggerPanic,
    presets: CLOAK_PRESETS,
  };
}

export function launchAboutBlank(gameUrl: string, gameTitle: string) {
  try {
    const win = window.open('about:blank', '_blank');
    if (!win) {
      // Fallback to normal new tab
      window.open(gameUrl, '_blank');
      return;
    }

    win.document.title = gameTitle || 'Classes';
    
    // Set favicon to Google Classroom icon for extra stealth
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
    iframe.setAttribute('allow', 'fullscreen; autoplay; gamepad');
    iframe.src = gameUrl;

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
