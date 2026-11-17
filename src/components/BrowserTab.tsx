// BrowserTab component - updated with persistent cookies, bookmarks, and intelligent transport routing
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Home,
  Lock,
  Search,
  Star,
  Plus,
  X,
  Globe,
  Bookmark,
  History,
  MoreVertical,
  Maximize2,
  Minimize2,
  EyeOff,
  Trash2,
  ExternalLink,
  FolderOpen,
  ChevronDown,
  Check,
} from 'lucide-react';
import {
  SEARCH_ENGINES,
  SearchEngineId,
  BrowserBookmark,
  BrowserHistoryItem,
  getSavedSearchEngine,
  saveSearchEngine,
  getBookmarksBarVisible,
  saveBookmarksBarVisible,
  loadBookmarks,
  saveBookmarks,
  syncRemoteBookmarks,
  loadBrowserHistory,
  saveBrowserHistory,
  resolveOmniboxInput,
  getDisplayTitleFromUrl,
  getFaviconForUrl,
} from '../services/browserStorageService';
import {
  launchInScramjetFrame,
  getScramjetFrameForIframe,
  extractUrlFromScramjetSrc,
  flushScramjetCookies,
} from '../services/scramjetProxyService';
import { launchAboutBlank } from '../hooks/useCloak';

interface TabState {
  id: string;
  title: string;
  url: string;
  inputValue: string;
  isLoading: boolean;
  history: string[];
  historyIndex: number;
  proxiedSrc?: string;
}

const createNewTabState = (initialUrl = 'about:newtab'): TabState => ({
  id: `tab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  title: initialUrl === 'about:newtab' ? 'New Tab' : getDisplayTitleFromUrl(initialUrl),
  url: initialUrl,
  inputValue: initialUrl === 'about:newtab' ? '' : initialUrl,
  isLoading: initialUrl !== 'about:newtab',
  history: [initialUrl],
  historyIndex: 0,
});

export const BrowserTab: React.FC = () => {
  const [tabs, setTabs] = useState<TabState[]>(() => [createNewTabState('about:newtab')]);
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0].id);
  const [searchEngine, setSearchEngine] = useState<SearchEngineId>(() => getSavedSearchEngine());
  const [bookmarks, setBookmarks] = useState<BrowserBookmark[]>(() => loadBookmarks());
  const [historyItems, setHistoryItems] = useState<BrowserHistoryItem[]>(() => loadBrowserHistory());
  const [showBookmarksBar, setShowBookmarksBar] = useState<boolean>(() => getBookmarksBarVisible());
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Dropdowns & Side Panels
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showEngineMenu, setShowEngineMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showBookmarkPopover, setShowBookmarkPopover] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<'none' | 'bookmarks' | 'history'>('none');
  const [newTabSearchInput, setNewTabSearchInput] = useState('');

  // Bookmark Popover / Manager Form States
  const [bmTitleInput, setBmTitleInput] = useState('');
  const [bmUrlInput, setBmUrlInput] = useState('');
  const [bmFolderInput, setBmFolderInput] = useState('Bookmarks Bar');
  const [showAddBookmarkModal, setShowAddBookmarkModal] = useState(false);
  const [drawerFilter, setDrawerFilter] = useState('');

  const browserRootRef = useRef<HTMLDivElement>(null);
  const omniboxRef = useRef<HTMLInputElement>(null);
  const iframeRefs = useRef<Map<string, HTMLIFrameElement>>(new Map());
  const pendingNavTargetRef = useRef<Map<string, string>>(new Map());

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) || tabs[0],
    [tabs, activeTabId]
  );

  const activeEngineConfig = useMemo(
    () => SEARCH_ENGINES.find((e) => e.id === searchEngine) || SEARCH_ENGINES[0],
    [searchEngine]
  );

  // Sync remote bookmarks once on mount
  useEffect(() => {
    syncRemoteBookmarks().then((remote) => {
      if (remote) setBookmarks(remote);
    });
  }, []);

  // Fullscreen listener
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Persist cookies when unmounting browser tab
  useEffect(() => {
    return () => {
      flushScramjetCookies(true);
    };
  }, []);

  const recordHistoryVisit = useCallback((url: string, title: string) => {
    if (!url || url === 'about:newtab') return;
    setHistoryItems((prev) => {
      const filtered = prev.filter((item) => item.url !== url || Date.now() - item.visitedAt > 60000);
      const next: BrowserHistoryItem[] = [
        {
          id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title: title || getDisplayTitleFromUrl(url),
          url,
          visitedAt: Date.now(),
        },
        ...filtered,
      ].slice(0, 200);
      saveBrowserHistory(next);
      return next;
    });
  }, []);

  const handleOpenNewTabRef = useRef<(url?: string, activate?: boolean) => void>(() => {});

  const syncFrameNavigation = useCallback(
    (tabId: string, finalUrl: string, pageTitle?: string | null) => {
      if (!finalUrl || finalUrl === 'about:newtab' || finalUrl === 'about:blank') return;

      const pending = pendingNavTargetRef.current.get(tabId);
      // If navigation is pending to a new URL, ignore any reads from previous page until new target loads
      if (pending && finalUrl !== pending) {
        return;
      }
      if (pending && finalUrl === pending) {
        pendingNavTargetRef.current.delete(tabId);
      }

      const finalTitle = (pageTitle && pageTitle.trim()) || getDisplayTitleFromUrl(finalUrl);
      const isOmniboxFocused = document.activeElement === omniboxRef.current;

      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== tabId) return t;
          const urlChanged = finalUrl !== t.url;
          const titleChanged = finalTitle !== t.title;
          if (!urlChanged && !titleChanged && !t.isLoading) return t;

          const nextHistory = urlChanged
            ? [...t.history.slice(0, t.historyIndex + 1), finalUrl]
            : t.history;
          const nextIndex = urlChanged ? nextHistory.length - 1 : t.historyIndex;

          return {
            ...t,
            isLoading: false,
            url: finalUrl,
            inputValue: isOmniboxFocused && t.id === activeTabId ? t.inputValue : finalUrl,
            title: finalTitle,
            history: nextHistory,
            historyIndex: nextIndex,
          };
        })
      );

      recordHistoryVisit(finalUrl, finalTitle);
    },
    [activeTabId, recordHistoryVisit]
  );

  // Sync async SPA URL & document.title updates (e.g., YouTube watch pages & TikTok feeds)
  useEffect(() => {
    if (!activeTab || activeTab.url === 'about:newtab') return;
    const tabId = activeTab.id;

    const timer = window.setInterval(() => {
      const iframe = iframeRefs.current.get(tabId);
      if (!iframe) return;
      try {
        const winHref = iframe.contentWindow?.location?.href || '';
        const decodedUrl = extractUrlFromScramjetSrc(winHref);
        const pageTitle = iframe.contentDocument?.title?.trim() || null;
        if (decodedUrl && decodedUrl !== 'about:blank') {
          syncFrameNavigation(tabId, decodedUrl, pageTitle);
        } else if (pageTitle && pageTitle !== 'about:blank') {
          syncFrameNavigation(tabId, activeTab.url, pageTitle);
        }
      } catch {
        // Cross-origin frame access guard
      }
    }, 650);

    return () => window.clearInterval(timer);
  }, [activeTab?.id, activeTab?.url, syncFrameNavigation]);

  const launchTabUrl = useCallback(
    async (tabId: string, targetUrl: string) => {
      if (targetUrl === 'about:newtab') return;
      pendingNavTargetRef.current.set(tabId, targetUrl);

      // Wait one tick for iframe mount if transitioning from about:newtab
      await new Promise((r) => setTimeout(r, 15));
      const iframe = iframeRefs.current.get(tabId);
      if (!iframe) return;

      try {
        const { proxiedSrc } = await launchInScramjetFrame(iframe, targetUrl, {
          onNavigate: (nextUrl, nextTitle) => {
            syncFrameNavigation(tabId, nextUrl, nextTitle);
          },
          onOpenNewTab: (newTabUrl) => {
            handleOpenNewTabRef.current(newTabUrl, false);
          },
        });
        setTabs((prev) =>
          prev.map((t) => (t.id === tabId ? { ...t, proxiedSrc: proxiedSrc || iframe.src || t.proxiedSrc } : t))
        );
      } catch (err) {
        console.warn('[BrowserTab] Scramjet launch failed:', err);
        setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, isLoading: false } : t)));
      }
    },
    [syncFrameNavigation]
  );

  const navigateTab = useCallback(
    (tabId: string, rawInput: string, options?: { pushHistory?: boolean }) => {
      const pushHistory = options?.pushHistory !== false;
      const resolvedUrl = resolveOmniboxInput(rawInput, searchEngine);

      pendingNavTargetRef.current.set(tabId, resolvedUrl);

      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id !== tabId) return tab;
          let nextHistory = tab.history;
          let nextIndex = tab.historyIndex;

          if (pushHistory && resolvedUrl !== tab.url) {
            nextHistory = [...tab.history.slice(0, tab.historyIndex + 1), resolvedUrl];
            nextIndex = nextHistory.length - 1;
          }

          return {
            ...tab,
            url: resolvedUrl,
            inputValue: resolvedUrl === 'about:newtab' ? '' : resolvedUrl,
            title: resolvedUrl === 'about:newtab' ? 'New Tab' : getDisplayTitleFromUrl(resolvedUrl),
            isLoading: resolvedUrl !== 'about:newtab',
            history: nextHistory,
            historyIndex: nextIndex,
          };
        })
      );

      setShowSuggestions(false);
      setShowEngineMenu(false);
      setShowMoreMenu(false);
      setShowBookmarkPopover(false);

      if (resolvedUrl !== 'about:newtab') {
        recordHistoryVisit(resolvedUrl, getDisplayTitleFromUrl(resolvedUrl));
        launchTabUrl(tabId, resolvedUrl);
      }
    },
    [launchTabUrl, recordHistoryVisit, searchEngine]
  );

  const handleOpenNewTab = useCallback(
    (url = 'about:newtab', activate = true) => {
      const newTab = createNewTabState(url);
      setTabs((prev) => [...prev, newTab]);
      if (activate) {
        setActiveTabId(newTab.id);
        setShowMoreMenu(false);
        setShowBookmarkPopover(false);
      }
      if (url !== 'about:newtab') {
        recordHistoryVisit(url, getDisplayTitleFromUrl(url));
        launchTabUrl(newTab.id, url);
      }
    },
    [launchTabUrl, recordHistoryVisit]
  );

  useEffect(() => {
    handleOpenNewTabRef.current = handleOpenNewTab;
  }, [handleOpenNewTab]);

  const handleCloseTab = useCallback(
    (tabId: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      iframeRefs.current.delete(tabId);
      pendingNavTargetRef.current.delete(tabId);

      setTabs((prev) => {
        if (prev.length === 1) {
          const fresh = createNewTabState('about:newtab');
          setActiveTabId(fresh.id);
          return [fresh];
        }
        const idx = prev.findIndex((t) => t.id === tabId);
        const filtered = prev.filter((t) => t.id !== tabId);
        if (tabId === activeTabId) {
          const fallbackTab = filtered[Math.max(0, idx - 1)] || filtered[0];
          setActiveTabId(fallbackTab.id);
        }
        return filtered;
      });
    },
    [activeTabId]
  );

  const handleBack = useCallback(() => {
    if (!activeTab) return;
    if (activeTab.historyIndex > 0) {
      const targetIndex = activeTab.historyIndex - 1;
      const targetUrl = activeTab.history[targetIndex];
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTab.id
            ? {
                ...t,
                historyIndex: targetIndex,
                url: targetUrl,
                inputValue: targetUrl === 'about:newtab' ? '' : targetUrl,
                title: targetUrl === 'about:newtab' ? 'New Tab' : getDisplayTitleFromUrl(targetUrl),
                isLoading: targetUrl !== 'about:newtab',
              }
            : t
        )
      );
      if (targetUrl !== 'about:newtab') {
        launchTabUrl(activeTab.id, targetUrl);
      }
    } else {
      const iframe = iframeRefs.current.get(activeTab.id);
      const frame = getScramjetFrameForIframe(iframe || null);
      frame?.back();
    }
  }, [activeTab, launchTabUrl]);

  const handleForward = useCallback(() => {
    if (!activeTab) return;
    if (activeTab.historyIndex < activeTab.history.length - 1) {
      const targetIndex = activeTab.historyIndex + 1;
      const targetUrl = activeTab.history[targetIndex];
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTab.id
            ? {
                ...t,
                historyIndex: targetIndex,
                url: targetUrl,
                inputValue: targetUrl === 'about:newtab' ? '' : targetUrl,
                title: targetUrl === 'about:newtab' ? 'New Tab' : getDisplayTitleFromUrl(targetUrl),
                isLoading: targetUrl !== 'about:newtab',
              }
            : t
        )
      );
      if (targetUrl !== 'about:newtab') {
        launchTabUrl(activeTab.id, targetUrl);
      }
    } else {
      const iframe = iframeRefs.current.get(activeTab.id);
      const frame = getScramjetFrameForIframe(iframe || null);
      frame?.forward();
    }
  }, [activeTab, launchTabUrl]);

  const handleReload = useCallback(() => {
    if (!activeTab || activeTab.url === 'about:newtab') return;
    setTabs((prev) => prev.map((t) => (t.id === activeTab.id ? { ...t, isLoading: true } : t)));
    const iframe = iframeRefs.current.get(activeTab.id);
    const frame = getScramjetFrameForIframe(iframe || null);
    if (frame) {
      frame.reload();
    } else {
      launchTabUrl(activeTab.id, activeTab.url);
    }
  }, [activeTab, launchTabUrl]);

  const handleHome = useCallback(() => {
    if (!activeTab) return;
    navigateTab(activeTab.id, 'about:newtab');
  }, [activeTab, navigateTab]);

  // Keyboard shortcuts (Ctrl+L to focus omnibox, Ctrl+T for new tab)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        omniboxRef.current?.focus();
        omniboxRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const currentBookmark = useMemo(
    () => bookmarks.find((b) => activeTab && b.url === activeTab.url),
    [bookmarks, activeTab]
  );

  const handleToggleStarBookmark = () => {
    if (!activeTab || activeTab.url === 'about:newtab') return;
    if (currentBookmark) {
      setBmTitleInput(currentBookmark.title);
      setBmUrlInput(currentBookmark.url);
      setBmFolderInput(currentBookmark.folder || 'Bookmarks Bar');
      setShowBookmarkPopover((prev) => !prev);
    } else {
      const created: BrowserBookmark = {
        id: `bm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: activeTab.title || getDisplayTitleFromUrl(activeTab.url),
        url: activeTab.url,
        folder: 'Bookmarks Bar',
        createdAt: Date.now(),
      };
      const updated = [created, ...bookmarks];
      setBookmarks(updated);
      saveBookmarks(updated);
      setBmTitleInput(created.title);
      setBmUrlInput(created.url);
      setBmFolderInput(created.folder);
      setShowBookmarkPopover(true);
    }
  };

  const handleSaveBookmarkEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = resolveOmniboxInput(bmUrlInput, searchEngine);
    if (!cleanUrl || cleanUrl === 'about:newtab') return;

    const existingIdx = bookmarks.findIndex((b) => b.url === (currentBookmark?.url || cleanUrl));
    let updated: BrowserBookmark[];
    if (existingIdx >= 0) {
      updated = bookmarks.map((b, i) =>
        i === existingIdx
          ? {
              ...b,
              title: bmTitleInput.trim() || getDisplayTitleFromUrl(cleanUrl),
              url: cleanUrl,
              folder: bmFolderInput || 'Bookmarks Bar',
            }
          : b
      );
    } else {
      updated = [
        {
          id: `bm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title: bmTitleInput.trim() || getDisplayTitleFromUrl(cleanUrl),
          url: cleanUrl,
          folder: bmFolderInput || 'Bookmarks Bar',
          createdAt: Date.now(),
        },
        ...bookmarks,
      ];
    }
    setBookmarks(updated);
    saveBookmarks(updated);
    setShowBookmarkPopover(false);
    setShowAddBookmarkModal(false);
  };

  const handleRemoveBookmark = (bookmarkId: string) => {
    const updated = bookmarks.filter((b) => b.id !== bookmarkId);
    setBookmarks(updated);
    saveBookmarks(updated);
    setShowBookmarkPopover(false);
  };

  const handleEngineChange = (engineId: SearchEngineId) => {
    setSearchEngine(engineId);
    saveSearchEngine(engineId);
    setShowEngineMenu(false);
  };

  const handleToggleBookmarksBar = () => {
    setShowBookmarksBar((prev) => {
      const next = !prev;
      saveBookmarksBarVisible(next);
      return next;
    });
    setShowMoreMenu(false);
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && browserRootRef.current) {
        await browserRootRef.current.requestFullscreen();
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {}
  };

  // Omnibox autocomplete matches from bookmarks & history
  const omniboxSuggestions = useMemo(() => {
    const q = (activeTab?.inputValue || '').trim().toLowerCase();
    const items: Array<{ type: 'bookmark' | 'history'; title: string; url: string }> = [];
    const seen = new Set<string>();

    for (const bm of bookmarks) {
      if (!q || bm.title.toLowerCase().includes(q) || bm.url.toLowerCase().includes(q)) {
        if (!seen.has(bm.url)) {
          seen.add(bm.url);
          items.push({ type: 'bookmark', title: bm.title, url: bm.url });
        }
      }
    }
    for (const h of historyItems) {
      if (!q || h.title.toLowerCase().includes(q) || h.url.toLowerCase().includes(q)) {
        if (!seen.has(h.url)) {
          seen.add(h.url);
          items.push({ type: 'history', title: h.title, url: h.url });
        }
      }
    }
    return items.slice(0, 7);
  }, [activeTab?.inputValue, bookmarks, historyItems]);

  const barBookmarks = useMemo(
    () => bookmarks.filter((b) => !b.folder || b.folder === 'Bookmarks Bar'),
    [bookmarks]
  );

  const canGoBack = Boolean(activeTab && activeTab.historyIndex > 0);
  const canGoForward = Boolean(activeTab && activeTab.historyIndex < activeTab.history.length - 1);

  return (
    <div
      ref={browserRootRef}
      className="flex-1 flex flex-col min-h-0 h-full w-full bg-slate-100 dark:bg-[#0d1017] text-slate-900 dark:text-slate-100 select-none"
    >
      {/* 1. Chrome / Firefox Tab Strip */}
      <div className="flex items-end gap-1 px-2 pt-2 bg-slate-200/90 dark:bg-[#090b10] border-b border-slate-300/70 dark:border-[#1c2030] overflow-x-auto no-scrollbar shrink-0">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab?.id;
          const faviconUrl = getFaviconForUrl(tab.url);

          return (
            <div
              key={tab.id}
              onClick={() => {
                setActiveTabId(tab.id);
                setShowSuggestions(false);
                setShowBookmarkPopover(false);
              }}
              className={`group relative flex items-center gap-2 min-w-[130px] max-w-[220px] h-9 px-3 rounded-t-xl text-xs font-medium cursor-pointer transition-colors shrink-0 ${
                isActive
                  ? 'bg-white dark:bg-[#161923] text-slate-900 dark:text-white border-t border-x border-slate-300/80 dark:border-[#262b3d] -mb-px z-10'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-300/60 dark:hover:bg-[#131620] hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab.isLoading ? (
                <RotateCw className="w-3.5 h-3.5 text-[var(--brand-blue)] animate-spin shrink-0" />
              ) : faviconUrl ? (
                <img
                  src={faviconUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-3.5 h-3.5 rounded-sm shrink-0 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <Globe className="w-3.5 h-3.5 text-[var(--brand-blue)] shrink-0" />
              )}

              <span className="truncate flex-1 text-left">{tab.title || 'New Tab'}</span>

              <button
                type="button"
                onClick={(e) => handleCloseTab(tab.id, e)}
                aria-label={`Close ${tab.title}`}
                className={`p-0.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-opacity shrink-0 cursor-pointer ${
                  isActive ? 'opacity-70 hover:opacity-100' : 'opacity-0 group-hover:opacity-70 hover:!opacity-100'
                }`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => handleOpenNewTab('about:newtab')}
          title="New Tab"
          aria-label="Open new browser tab"
          className="h-8 w-8 mb-0.5 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-300/70 dark:hover:bg-[#1a1e2c] hover:text-slate-900 dark:hover:text-white transition-colors shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Navigation & Omnibox Toolbar */}
      <div className="relative z-30 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 bg-white dark:bg-[#161923] border-b border-slate-200 dark:border-[#242938] shrink-0">
        {/* Nav Buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={handleBack}
            disabled={!canGoBack}
            title="Back"
            aria-label="Back"
            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#222738] disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleForward}
            disabled={!canGoForward}
            title="Forward"
            aria-label="Forward"
            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#222738] disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleReload}
            disabled={!activeTab || activeTab.url === 'about:newtab'}
            title="Reload page"
            aria-label="Reload page"
            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#222738] disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <RotateCw className={`w-4 h-4 ${activeTab?.isLoading ? 'animate-spin text-[var(--brand-blue)]' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleHome}
            title="Home (New Tab)"
            aria-label="Home"
            className="hidden sm:flex w-8 h-8 items-center justify-center rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#222738] transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" />
          </button>
        </div>

        {/* Omnibox (Address + Search Bar) */}
        <div className="relative flex-1 min-w-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (activeTab) {
                navigateTab(activeTab.id, activeTab.inputValue);
              }
            }}
            className="flex items-center w-full h-9 bg-slate-100 dark:bg-[#0e1017] hover:bg-slate-200/70 dark:hover:bg-[#11141e] focus-within:bg-white dark:focus-within:bg-[#0b0d13] rounded-full border border-slate-200 dark:border-[#2a2f42] focus-within:border-[var(--brand-blue)] focus-within:ring-2 focus-within:ring-[var(--brand-blue)]/20 px-2.5 transition-all"
          >
            {/* Search Engine / Security Badge Dropdown Trigger */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowEngineMenu((prev) => !prev);
                  setShowMoreMenu(false);
                }}
                title={`Search engine: ${activeEngineConfig.name}`}
                className="flex items-center gap-1 pr-2 mr-1.5 border-r border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-[var(--brand-blue)] cursor-pointer"
              >
                {activeTab?.url && activeTab.url !== 'about:newtab' && activeTab.url.startsWith('https://') ? (
                  <Lock className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Search className="w-3.5 h-3.5 text-[var(--brand-blue)]" />
                )}
                <span className="hidden md:inline text-[11px]">{activeEngineConfig.shortName}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {showEngineMenu && (
                <div className="absolute left-0 top-9 w-48 bg-white dark:bg-[#1a1d29] border border-slate-200 dark:border-[#2c3144] rounded-xl shadow-xl py-1.5 z-50">
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-400">Search Engine</div>
                  {SEARCH_ENGINES.map((engine) => (
                    <button
                      key={engine.id}
                      type="button"
                      onClick={() => handleEngineChange(engine.id)}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#252a3b] cursor-pointer"
                    >
                      <span>{engine.name}</span>
                      {searchEngine === engine.id && <Check className="w-3.5 h-3.5 text-[var(--brand-blue)]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <input
              ref={omniboxRef}
              type="text"
              value={activeTab?.inputValue ?? ''}
              onFocus={(e) => {
                e.currentTarget.select();
                setShowSuggestions(true);
              }}
              onBlur={() => {
                setTimeout(() => setShowSuggestions(false), 160);
              }}
              onChange={(e) => {
                const val = e.target.value;
                setTabs((prev) =>
                  prev.map((t) => (t.id === activeTab?.id ? { ...t, inputValue: val } : t))
                );
              }}
              placeholder={`Search ${activeEngineConfig.name} or type a URL`}
              className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none select-text"
            />

            {/* Bookmark Star Inside Omnibox */}
            {activeTab && activeTab.url !== 'about:newtab' && (
              <div className="relative shrink-0 ml-1">
                <button
                  type="button"
                  onClick={handleToggleStarBookmark}
                  title={currentBookmark ? 'Edit bookmark' : 'Bookmark this page'}
                  aria-label={currentBookmark ? 'Edit bookmark' : 'Bookmark this page'}
                  className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                    currentBookmark
                      ? 'text-amber-400 hover:bg-amber-400/10'
                      : 'text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800'
                  }`}
                >
                  <Star className={`w-4 h-4 ${currentBookmark ? 'fill-current' : ''}`} />
                </button>

                {/* Chrome-style Bookmark Added/Edit Popover */}
                {showBookmarkPopover && (
                  <div className="absolute right-0 top-10 w-72 bg-white dark:bg-[#1a1d29] border border-slate-200 dark:border-[#2c3144] rounded-2xl shadow-2xl p-4 z-50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {currentBookmark ? 'Edit Bookmark' : 'Bookmark Added'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowBookmarkPopover(false)}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <form onSubmit={handleSaveBookmarkEdit} className="space-y-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Name
                        </label>
                        <input
                          type="text"
                          value={bmTitleInput}
                          onChange={(e) => setBmTitleInput(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-[#0e1017] border border-slate-200 dark:border-[#2a2f42] text-slate-900 dark:text-white focus:outline-none focus:border-[var(--brand-blue)] select-text"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Folder
                        </label>
                        <select
                          value={bmFolderInput}
                          onChange={(e) => setBmFolderInput(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-[#0e1017] border border-slate-200 dark:border-[#2a2f42] text-slate-900 dark:text-white focus:outline-none focus:border-[var(--brand-blue)]"
                        >
                          <option value="Bookmarks Bar">Bookmarks Bar</option>
                          <option value="Other Bookmarks">Other Bookmarks</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        {currentBookmark ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveBookmark(currentBookmark.id)}
                            className="px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-500/10 rounded-lg cursor-pointer"
                          >
                            Remove
                          </button>
                        ) : (
                          <span />
                        )}
                        <button
                          type="submit"
                          className="px-4 py-1.5 text-xs font-semibold bg-[var(--brand-blue)] text-white rounded-lg hover:opacity-90 cursor-pointer"
                        >
                          Done
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
          </form>

          {/* Omnibox Suggestions Dropdown */}
          {showSuggestions && omniboxSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-10 bg-white dark:bg-[#1a1d29] border border-slate-200 dark:border-[#2c3144] rounded-2xl shadow-2xl py-1.5 z-50 overflow-hidden">
              {omniboxSuggestions.map((s) => (
                <button
                  key={`${s.type}_${s.url}`}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (activeTab) navigateTab(activeTab.id, s.url);
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2 text-left hover:bg-slate-100 dark:hover:bg-[#24293a] transition-colors cursor-pointer"
                >
                  {s.type === 'bookmark' ? (
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-current shrink-0" />
                  ) : (
                    <History className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {s.title}
                  </span>
                  <span className="text-[11px] text-slate-400 truncate flex-1">{s.url}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Toolbar Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveDrawer((prev) => (prev === 'bookmarks' ? 'none' : 'bookmarks'))}
            title="Bookmarks Manager"
            aria-label="Bookmarks Manager"
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer ${
              activeDrawer === 'bookmarks'
                ? 'bg-[var(--brand-blue)]/15 text-[var(--brand-blue)]'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#222738]'
            }`}
          >
            <Bookmark className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setActiveDrawer((prev) => (prev === 'history' ? 'none' : 'history'))}
            title="History"
            aria-label="History"
            className={`hidden sm:flex w-8 h-8 items-center justify-center rounded-full transition-colors cursor-pointer ${
              activeDrawer === 'history'
                ? 'bg-[var(--brand-blue)]/15 text-[var(--brand-blue)]'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#222738]'
            }`}
          >
            <History className="w-4 h-4" />
          </button>

          {activeTab && activeTab.url !== 'about:newtab' && (
            <button
              type="button"
              onClick={() => launchAboutBlank(activeTab.proxiedSrc || activeTab.url, activeTab.title)}
              title="Open in Stealth Window (about:blank)"
              aria-label="Open in Stealth Window"
              className="hidden md:flex w-8 h-8 items-center justify-center rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#222738] transition-colors cursor-pointer"
            >
              <EyeOff className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Browser'}
            aria-label="Toggle Fullscreen"
            className="hidden sm:flex w-8 h-8 items-center justify-center rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#222738] transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Chrome More Menu (⋮) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowMoreMenu((prev) => !prev);
                setShowEngineMenu(false);
              }}
              title="Customize and control browser"
              aria-label="Browser Menu"
              className="w-8 h-8 flex items-center justify-center rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#222738] transition-colors cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMoreMenu && (
              <div className="absolute right-0 top-9 w-56 bg-white dark:bg-[#1a1d29] border border-slate-200 dark:border-[#2c3144] rounded-xl shadow-2xl py-1.5 z-50 text-xs">
                <button
                  type="button"
                  onClick={() => handleOpenNewTab('about:newtab')}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-[#252a3b] text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Tab</span>
                </button>
                <button
                  type="button"
                  onClick={handleToggleBookmarksBar}
                  className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-[#252a3b] text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <Bookmark className="w-4 h-4" />
                    <span>Show Bookmarks Bar</span>
                  </span>
                  {showBookmarksBar && <Check className="w-3.5 h-3.5 text-[var(--brand-blue)]" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveDrawer('bookmarks');
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-[#252a3b] text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Bookmarks Manager</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveDrawer('history');
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-[#252a3b] text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <History className="w-4 h-4" />
                  <span>Browsing History</span>
                </button>
                <div className="my-1 border-t border-slate-200 dark:border-[#2a2f42]" />
                <button
                  type="button"
                  onClick={() => {
                    toggleFullscreen();
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-[#252a3b] text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Chrome-Style Bookmarks Bar */}
      {showBookmarksBar && (
        <div className="flex items-center gap-1 px-3 py-1 bg-white dark:bg-[#161923] border-b border-slate-200 dark:border-[#242938] overflow-x-auto no-scrollbar shrink-0">
          {barBookmarks.map((bm) => (
            <button
              key={bm.id}
              type="button"
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  handleOpenNewTab(bm.url);
                } else if (activeTab) {
                  navigateTab(activeTab.id, bm.url);
                }
              }}
              onAuxClick={(e) => {
                if (e.button === 1) handleOpenNewTab(bm.url);
              }}
              title={`${bm.title}\n${bm.url}`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#222738] whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <img
                src={getFaviconForUrl(bm.url)}
                alt=""
                referrerPolicy="no-referrer"
                className="w-3.5 h-3.5 rounded-sm shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span className="max-w-[120px] truncate">{bm.title}</span>
            </button>
          ))}

          <button
            type="button"
            onClick={() => {
              setBmTitleInput('');
              setBmUrlInput('');
              setBmFolderInput('Bookmarks Bar');
              setShowAddBookmarkModal(true);
            }}
            title="Add Bookmark"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#222738] whitespace-nowrap shrink-0 cursor-pointer ml-auto"
          >
            <Plus className="w-3 h-3" />
            <span>Add</span>
          </button>
        </div>
      )}

      {/* 4. Main Browser Viewport + Side Drawer */}
      <div className="relative flex-1 flex min-h-0 overflow-hidden">
        <div className="relative flex-1 min-w-0 min-h-0 bg-white dark:bg-[#0f111a]">
          {/* Active New Tab Page */}
          {activeTab?.url === 'about:newtab' && (
            <div className="absolute inset-0 overflow-y-auto flex flex-col items-center justify-center px-4 py-10 bg-gradient-to-b from-slate-50 to-white dark:from-[#0f111a] dark:to-[#131724]">
              <div className="w-full max-w-2xl flex flex-col items-center gap-7">
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--brand-blue)]/10 border border-[var(--brand-blue)]/25 flex items-center justify-center text-[var(--brand-blue)]">
                    <Globe className="w-7 h-7" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-heading">
                    FrostHub Browser
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    Powered by Scramjet proxy with persistent cookies and bookmarks
                  </p>
                </div>

                {/* New Tab Centered Search Bar */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newTabSearchInput.trim()) return;
                    if (activeTab) {
                      navigateTab(activeTab.id, newTabSearchInput);
                      setNewTabSearchInput('');
                    }
                  }}
                  className="w-full"
                >
                  <div className="flex items-center gap-3 w-full h-12 px-4 rounded-full bg-white dark:bg-[#1a1e2c] border border-slate-200 dark:border-[#2c3144] shadow-lg focus-within:border-[var(--brand-blue)] focus-within:ring-2 focus-within:ring-[var(--brand-blue)]/20 transition-all">
                    <Search className="w-5 h-5 text-[var(--brand-blue)] shrink-0" />
                    <input
                      type="text"
                      value={newTabSearchInput}
                      onChange={(e) => setNewTabSearchInput(e.target.value)}
                      placeholder={`Search ${activeEngineConfig.name} or enter a URL...`}
                      className="flex-1 bg-transparent text-sm sm:text-base text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none select-text"
                    />
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-full bg-[var(--brand-blue)] text-white text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer shrink-0"
                    >
                      Go
                    </button>
                  </div>

                  {/* Quick Search Engine Selector */}
                  <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
                    {SEARCH_ENGINES.map((engine) => (
                      <button
                        key={engine.id}
                        type="button"
                        onClick={() => handleEngineChange(engine.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          searchEngine === engine.id
                            ? 'bg-[var(--brand-blue)]/15 text-[var(--brand-blue)] border border-[var(--brand-blue)]/30'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-[#1f2435]'
                        }`}
                      >
                        {engine.name}
                      </button>
                    ))}
                  </div>
                </form>

                {/* Chrome-style Speed Dial Shortcuts */}
                <div className="w-full">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Bookmarks & Shortcuts
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setBmTitleInput('');
                        setBmUrlInput('');
                        setBmFolderInput('Bookmarks Bar');
                        setShowAddBookmarkModal(true);
                      }}
                      className="text-xs font-semibold text-[var(--brand-blue)] hover:underline cursor-pointer"
                    >
                      + Add Shortcut
                    </button>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {bookmarks.slice(0, 9).map((bm) => (
                      <div
                        key={bm.id}
                        onClick={() => activeTab && navigateTab(activeTab.id, bm.url)}
                        className="group relative flex flex-col items-center gap-2 p-3 rounded-2xl bg-white dark:bg-[#181c28] border border-slate-200/80 dark:border-[#262b3d] hover:border-[var(--brand-blue)]/50 hover:shadow-md transition-all cursor-pointer"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveBookmark(bm.id);
                          }}
                          title="Remove shortcut"
                          className="absolute top-1.5 right-1.5 p-1 rounded-md opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-opacity cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#10131c] flex items-center justify-center overflow-hidden">
                          <img
                            src={getFaviconForUrl(bm.url)}
                            alt={bm.title}
                            referrerPolicy="no-referrer"
                            className="w-6 h-6 object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate w-full text-center">
                          {bm.title}
                        </span>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        setBmTitleInput('');
                        setBmUrlInput('');
                        setBmFolderInput('Bookmarks Bar');
                        setShowAddBookmarkModal(true);
                      }}
                      className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border border-dashed border-slate-300 dark:border-[#2e344a] text-slate-500 dark:text-slate-400 hover:border-[var(--brand-blue)] hover:text-[var(--brand-blue)] transition-colors cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#181c28] flex items-center justify-center">
                        <Plus className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-semibold">Add site</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Persistent Scramjet Iframes (one per non-newtab tab so sessions & logins stay alive) */}
          {tabs.map((tab) => {
            if (tab.url === 'about:newtab') return null;
            const isTabActive = tab.id === activeTab?.id;

            return (
              <iframe
                key={tab.id}
                ref={(el) => {
                  if (el) {
                    iframeRefs.current.set(tab.id, el);
                  } else {
                    iframeRefs.current.delete(tab.id);
                  }
                }}
                title={tab.title}
                className={`absolute inset-0 w-full h-full border-none outline-none bg-white ${
                  isTabActive ? 'opacity-100 z-10 pointer-events-auto visible' : 'opacity-0 z-0 pointer-events-none invisible'
                }`}
                allow="fullscreen; autoplay; gamepad; clipboard-read; clipboard-write; microphone; camera; pointer-lock; encrypted-media; picture-in-picture; midi; accelerometer; gyroscope; display-capture; web-share"
                allowFullScreen
                onLoad={(e) => {
                  const iframe = e.currentTarget;
                  let decodedUrl: string | null = null;
                  let pageTitle: string | null = null;

                  try {
                    const winHref = iframe.contentWindow?.location?.href || iframe.src;
                    decodedUrl = extractUrlFromScramjetSrc(winHref);
                    pageTitle = iframe.contentDocument?.title?.trim() || null;
                  } catch {
                    decodedUrl = extractUrlFromScramjetSrc(iframe.src);
                  }

                  const finalUrl = decodedUrl || tab.url;
                  syncFrameNavigation(tab.id, finalUrl, pageTitle);
                  setTabs((prev) =>
                    prev.map((t) =>
                      t.id === tab.id ? { ...t, isLoading: false, proxiedSrc: iframe.src || t.proxiedSrc } : t
                    )
                  );
                  flushScramjetCookies(false);
                }}
                onError={() => {
                  setTabs((prev) => prev.map((t) => (t.id === tab.id ? { ...t, isLoading: false } : t)));
                }}
              />
            );
          })}
        </div>

        {/* Bookmarks & History Side Drawer */}
        {activeDrawer !== 'none' && (
          <aside className="w-80 max-w-[90vw] bg-white dark:bg-[#161923] border-l border-slate-200 dark:border-[#242938] flex flex-col shrink-0 z-20">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-[#242938]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveDrawer('bookmarks')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                    activeDrawer === 'bookmarks'
                      ? 'bg-[var(--brand-blue)] text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#222738]'
                  }`}
                >
                  Bookmarks
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDrawer('history')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                    activeDrawer === 'history'
                      ? 'bg-[var(--brand-blue)] text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#222738]'
                  }`}
                >
                  History
                </button>
              </div>
              <button
                type="button"
                onClick={() => setActiveDrawer('none')}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-200 dark:border-[#242938]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={drawerFilter}
                  onChange={(e) => setDrawerFilter(e.target.value)}
                  placeholder={`Search ${activeDrawer}...`}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-[#0e1017] border border-slate-200 dark:border-[#2a2f42] text-slate-900 dark:text-white focus:outline-none focus:border-[var(--brand-blue)] select-text"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {activeDrawer === 'bookmarks' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setBmTitleInput(activeTab?.url !== 'about:newtab' ? activeTab.title : '');
                      setBmUrlInput(activeTab?.url !== 'about:newtab' ? activeTab.url : '');
                      setBmFolderInput('Bookmarks Bar');
                      setShowAddBookmarkModal(true);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 mb-2 rounded-lg bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] text-xs font-bold hover:bg-[var(--brand-blue)]/20 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Bookmark</span>
                  </button>

                  {bookmarks
                    .filter(
                      (b) =>
                        !drawerFilter.trim() ||
                        b.title.toLowerCase().includes(drawerFilter.toLowerCase()) ||
                        b.url.toLowerCase().includes(drawerFilter.toLowerCase())
                    )
                    .map((bm) => (
                      <div
                        key={bm.id}
                        className="group flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#222738] cursor-pointer"
                        onClick={() => activeTab && navigateTab(activeTab.id, bm.url)}
                      >
                        <img
                          src={getFaviconForUrl(bm.url)}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-4 h-4 rounded-sm shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {bm.title}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">{bm.url}</div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenNewTab(bm.url);
                          }}
                          title="Open in new tab"
                          className="p-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-[var(--brand-blue)] cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveBookmark(bm.id);
                          }}
                          title="Delete bookmark"
                          className="p-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                </>
              ) : (
                <>
                  {historyItems.length > 0 && (
                    <div className="flex items-center justify-between px-2 py-1 mb-1">
                      <span className="text-[11px] text-slate-400">Cookies stay saved</span>
                      <button
                        type="button"
                        onClick={() => {
                          setHistoryItems([]);
                          saveBrowserHistory([]);
                        }}
                        className="text-[11px] font-semibold text-red-500 hover:underline cursor-pointer"
                      >
                        Clear History
                      </button>
                    </div>
                  )}
                  {historyItems.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">No browsing history yet</div>
                  ) : (
                    historyItems
                      .filter(
                        (h) =>
                          !drawerFilter.trim() ||
                          h.title.toLowerCase().includes(drawerFilter.toLowerCase()) ||
                          h.url.toLowerCase().includes(drawerFilter.toLowerCase())
                      )
                      .map((item) => (
                        <div
                          key={item.id}
                          onClick={() => activeTab && navigateTab(activeTab.id, item.url)}
                          className="group flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#222738] cursor-pointer"
                        >
                          <img
                            src={getFaviconForUrl(item.url)}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-4 h-4 rounded-sm shrink-0"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                              {item.title}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">{item.url}</div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenNewTab(item.url);
                            }}
                            title="Open in new tab"
                            className="p-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-[var(--brand-blue)] cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                  )}
                </>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Add Bookmark Modal */}
      {showAddBookmarkModal && (
        <div className="fixed inset-0 z-[120] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#181c28] border border-slate-200 dark:border-[#2a2f42] rounded-2xl shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Add Bookmark</h3>
              <button
                type="button"
                onClick={() => setShowAddBookmarkModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveBookmarkEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={bmTitleInput}
                  onChange={(e) => setBmTitleInput(e.target.value)}
                  placeholder="e.g., Wikipedia"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-[#0e1017] border border-slate-200 dark:border-[#2a2f42] text-slate-900 dark:text-white focus:outline-none focus:border-[var(--brand-blue)] select-text"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">URL</label>
                <input
                  type="text"
                  required
                  value={bmUrlInput}
                  onChange={(e) => setBmUrlInput(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-[#0e1017] border border-slate-200 dark:border-[#2a2f42] text-slate-900 dark:text-white focus:outline-none focus:border-[var(--brand-blue)] select-text"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Folder</label>
                <select
                  value={bmFolderInput}
                  onChange={(e) => setBmFolderInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-[#0e1017] border border-slate-200 dark:border-[#2a2f42] text-slate-900 dark:text-white focus:outline-none focus:border-[var(--brand-blue)]"
                >
                  <option value="Bookmarks Bar">Bookmarks Bar</option>
                  <option value="Other Bookmarks">Other Bookmarks</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddBookmarkModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#222738] rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-[var(--brand-blue)] text-white rounded-xl hover:opacity-90 cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
