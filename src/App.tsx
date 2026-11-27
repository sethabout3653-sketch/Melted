import React, { useState, useEffect, useMemo, useDeferredValue, useCallback, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { AppSidebar, MobileMenu } from './components/AppSidebar';
import { motion, AnimatePresence } from 'motion/react';
import { CategoryFilter } from './components/CategoryFilter';
import { GameCard } from './components/GameCard';
import { GamePlayer } from './components/GamePlayer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ChatView } from './components/ChatView';
import { AIAssistantView } from './components/AIAssistantView';
import { FrostHubLoadingScreen } from './components/FrostHubLoadingScreen';
import { FrostHubLogo } from './components/FrostHubLogo';
import { InAppNotificationToast } from './components/InAppNotificationToast';
import { VoiceAudioEngine } from './components/VoiceAudioEngine';
import { PersistentVoiceDock } from './components/PersistentVoiceDock';
import { getAllGames, getUGSGames, getCKVGames, mergeUgsGames, deduplicateAcrossLibraries } from './services/gameService';
import { initEsrbRatingsCache, getCachedGameRating, subscribeToGameRatings } from './services/gameRatingService';
import { tabTransition } from './utils/animations';
import { useCloak } from './hooks/useCloak';
import { useGlobalChat } from './hooks/useGlobalChat';
import { useDeviceAdaptation } from './hooks/useDeviceAdaptation';
import { useThemeConfig } from './hooks/useThemeConfig';
import { useFontConfig } from './hooks/useFontConfig';
import { ThemeSelectorModal } from './components/ThemeSelectorModal';
import { AppCanvasBackground } from './components/AppCanvasBackground';
import { MovieView } from './components/MovieView';
import { LiveTVView } from './components/LiveTVView';
import {
  getEffectiveUserId,
  getStoredGameFavorites,
  subscribeToFavorites,
  toggleGameFavorite,
} from './services/favoritesService';
import { GameItem, GameCategory, GameLibrarySelection } from './types/game';
import { Search, ArrowRight, Gamepad2 } from 'lucide-react';

const PAGE_SIZE = 72;

export default function App() {
  const [currentTab, setCurrentTab] = useState<'games' | 'chat' | 'ai' | 'movies' | 'tv'>('games');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);

  const [selectedLibrary, setSelectedLibrary] = useState<GameLibrarySelection>('all');
  const [selectedCategory, setSelectedCategory] = useState<GameCategory>('All');
  const [sortBy, setSortBy] = useState<'popular' | 'alpha-asc' | 'alpha-desc' | 'random'>('random');
  const [shuffleSeed, setShuffleSeed] = useState<number>(() => Math.floor(Math.random() * 1_000_000_000));
  const [favorites, setFavorites] = useState<number[]>(() => getStoredGameFavorites());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [targetChatChannel, setTargetChatChannel] = useState<string | null>(null);
  const gamesScrollRef = useRef<HTMLElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  // Theme state: dark by default
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('frosthub_theme');
      return (saved === 'dark' || saved === 'light') ? saved : 'dark';
    } catch {
      return 'dark';
    }
  });

  const { config: themeConfig, updateConfig: updateThemeConfig, resetTheme } = useThemeConfig();
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('frosthub_theme', theme);
    } catch {}
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Activate custom font & typography engine across app
  useFontConfig();

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const handleOpenThemeSelector = useCallback(() => {
    setIsThemeModalOpen(true);
  }, []);

  const handleCloseThemeModal = useCallback(() => {
    setIsThemeModalOpen(false);
  }, []);

  // Tab cloaking system
  const cloak = useCloak();

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Master Games State - Pre-populated with initial catalogue so UI renders instantly
  const [allGames, setAllGames] = useState<GameItem[]>(() => {
    try {
      return getAllGames();
    } catch {
      return [];
    }
  });

  // Dynamic CDN UGS & CKV refresh in background to load latest games
  useEffect(() => {
    let isMounted = true;
    Promise.allSettled([getUGSGames(), getCKVGames()])
      .then(([ugsResult, ckvResult]) => {
        if (!isMounted) return;
        setAllGames((prev) => {
          let current = prev;
          if (ugsResult.status === 'fulfilled' && Array.isArray(ugsResult.value)) {
            current = mergeUgsGames(current, ugsResult.value, 'ugs');
          }
          if (ckvResult.status === 'fulfilled' && Array.isArray(ckvResult.value)) {
            current = mergeUgsGames(current, ckvResult.value, 'ckv');
          }
          return current;
        });
      })
      .catch((err) => {
        console.warn('Game dynamic update warning:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Load real ESRB ratings cache on startup and re-sync search metadata when updated
  const [esrbVersion, setEsrbVersion] = useState(0);
  useEffect(() => {
    void initEsrbRatingsCache();
    return subscribeToGameRatings(() => {
      setEsrbVersion((v) => v + 1);
    });
  }, []);

  // Immediately prewarm Rammerhead session so games and featured apps launch cleanly on first click
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const timer = window.setTimeout(() => {
      import('./services/rammerheadProxyService')
        .then((m) => m.initRammerheadSession())
        .catch(() => {});
    }, 50);
    return () => window.clearTimeout(timer);
  }, []);

  // Deferred background prefetch for Live TV EPG so Home and Games render with top priority
  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetch('/api/epg/now-next')
        .then((r) => r.json())
        .then((data) => {
          if (data?.programs && typeof data.programs === 'object' && Object.keys(data.programs).length > 0) {
            try {
              localStorage.setItem('frosthub_epg_cache', JSON.stringify(data.programs));
            } catch {}
          }
        })
        .catch(() => {});
    }, 4000);

    return () => window.clearTimeout(timer);
  }, []);

  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [activeGame, setActiveGame] = useState<GameItem | null>(null);
  const [activeMedia, setActiveMedia] = useState<{ title: string; mediaType: 'movie' | 'tv'; season?: number; episode?: number } | null>(null);

  // Global Chat and Notifications
  const globalChat = useGlobalChat({ 
    isChatTabActive: currentTab === 'chat'
  });

  useEffect(() => {
    if (currentTab === 'chat' && globalChat.activeNotification) {
      // Only dismiss if the user is actually looking at the channel the notification came from
      if (globalChat.activeChannel === globalChat.activeNotification.channel_id) {
        globalChat.dismissNotification();
      }
    }
  }, [currentTab, globalChat.activeChannel, globalChat.activeNotification, globalChat.dismissNotification]);

  // Multi-Device Adaptation System (Mobile, Tablet, Desktop)
  const deviceInfo = useDeviceAdaptation();

  // Catalog Load dismissal
  useEffect(() => {
    const introTimer = setTimeout(() => {
      setIsCatalogLoading(false);
    }, 500); // Faster loading for instant feel

    return () => {
      clearTimeout(introTimer);
    };
  }, []);

  // Sync game favorites reliably across LocalStorage, backend API, and Firestore
  useEffect(() => {
    const userId = getEffectiveUserId();
    const unsub = subscribeToFavorites(userId, ({ gameIds }) => {
      setFavorites(gameIds);
    });
    return () => unsub();
  }, [globalChat.currentUser?.id]);

  const handleToggleFavorite = useCallback((id: number) => {
    const updated = toggleGameFavorite(id);
    setFavorites(updated);
  }, []);

  const handlePlayGame = useCallback((game: GameItem) => {
    setActiveGame(game);
  }, []);

  const handleCloseGame = useCallback(() => {
    setActiveGame(null);
  }, []);

  // Keep user activity tracker synchronized with current tab, active game, active media, search, and voice state
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const inVoice = Boolean(globalChat.isInVideo || globalChat.activeChannel === 'video-general');
        const activeChName = globalChat.activeChannel || 'text-general';

        let activityLabel = 'Browsing FrostHub';

        if (activeGame) {
          activityLabel = `Playing ${activeGame.name} (${activeGame.category || 'Game'})`;
        } else if (activeMedia) {
          const isTV = activeMedia.mediaType === 'tv';
          activityLabel = isTV && activeMedia.season && activeMedia.episode
            ? `Watching ${activeMedia.title} (Season ${activeMedia.season}, Episode ${activeMedia.episode})`
            : `Watching Movie: ${activeMedia.title}`;
        } else if (currentTab === 'chat') {
          activityLabel = inVoice ? 'In General Voice Channel' : `Chatting in #${activeChName}`;
        } else if (currentTab === 'ai') {
          activityLabel = 'Chatting with Frosted AI Assistant';
        } else if (currentTab === 'movies') {
          activityLabel = 'Browsing Movies & Shows Library';
        } else if (currentTab === 'tv') {
          activityLabel = 'Watching Live TV Channels';
        } else if (currentTab === 'games') {
          if (searchQuery.trim()) {
            activityLabel = `Searching games for "${searchQuery.trim()}"`;
          } else if (showFavoritesOnly) {
            activityLabel = 'Browsing Favorite Games';
          } else if (selectedCategory !== 'All') {
            activityLabel = `Browsing ${selectedCategory} Games`;
          } else {
            activityLabel = `Browsing all ${allGames.length} games`;
          }
        }

        globalChat.updateUser({
          activity: activityLabel,
          current_channel: inVoice ? 'video-general' : (activeChName === 'video-general' || activeChName === 'voice-general' ? activeChName : 'text-general'),
        });
      } catch {}
    }, 800);

    return () => window.clearTimeout(timer);
  }, [currentTab, activeGame, activeMedia, searchQuery, selectedCategory, showFavoritesOnly, allGames.length, globalChat.isInVideo, globalChat.activeChannel]);

  const libraryBuckets = useMemo(() => {
    const gnMath = allGames.filter((g) => g.library === 'gn-math');
    const ugs = allGames.filter((g) => g.library === 'ugs');
    const ckv = allGames.filter((g) => g.library === 'ckv');
    const all = deduplicateAcrossLibraries(allGames);
    return { 'gn-math': gnMath, ugs, ckv, all };
  }, [allGames]);

  const libraryGames = libraryBuckets[selectedLibrary];

  // Stable Fisher-Yates random order per session / reshuffle so games appear randomized without flickering on filter/favorite changes
  const randomRankMap = useMemo(() => {
    const ids = allGames.map((g) => g.id);
    // Mulberry32 PRNG seeded with shuffleSeed
    let seed = (shuffleSeed ^ ids.length) >>> 0 || 1;
    const nextRand = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(nextRand() * (i + 1));
      const tmp = ids[i];
      ids[i] = ids[j];
      ids[j] = tmp;
    }
    const map = new Map<number, number>();
    for (let i = 0; i < ids.length; i++) {
      map.set(ids[i], i);
    }
    return map;
  }, [allGames, shuffleSeed]);

  const handleGoHome = useCallback(() => {
    setSelectedCategory('All');
    setSearchQuery('');
    setShowFavoritesOnly(false);
    setCurrentTab('games');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleRandomGame = useCallback(() => {
    const pool = libraryGames.length > 0 ? libraryGames : allGames;
    const game = pool[Math.floor(Math.random() * pool.length)];
    if (game) handlePlayGame(game);
  }, [libraryGames, allGames, handlePlayGame]);

  const handleSelectLibrary = useCallback((lib: GameLibrarySelection) => {
    setSelectedLibrary(lib);
    setSelectedCategory('All');
    setShowFavoritesOnly(false);
    setCurrentTab('games');
  }, []);

  const handleSelectCategory = useCallback((cat: GameCategory) => {
    setSelectedCategory(cat);
    setCurrentTab('games');
    if (cat === 'Favorites') {
      setShowFavoritesOnly(true);
    } else {
      setShowFavoritesOnly(false);
    }
  }, []);

  const handleSortChange = useCallback((sort: 'popular' | 'alpha-asc' | 'alpha-desc' | 'random') => {
    setSortBy(sort);
    if (sort === 'random') {
      setShuffleSeed((s) => (s + 1) | 0);
    }
  }, []);

  const handleReshuffle = useCallback(() => {
    setShuffleSeed((s) => (s + 1) | 0);
  }, []);

  const handleToggleFavoritesOnly = useCallback(() => {
    setShowFavoritesOnly((prev) => {
      const next = !prev;
      setCurrentTab('games');
      if (next) {
        setSelectedCategory('Favorites');
      } else {
        setSelectedCategory('All');
      }
      return next;
    });
  }, []);

  const filteredGames = useMemo(() => {
    const queryTokens = deferredQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const compactQuery = deferredQuery.toLowerCase().replace(/[^a-z0-9]/g, '');

    const applyQuery = (list: GameItem[]) => {
      if (queryTokens.length === 0) return list;
      return list.filter((game) => {
        const realRating = game.rating || getCachedGameRating(game.name);
        const searchableText = [
          game.name,
          game.category,
          game.author,
          realRating?.code,
          realRating?.label,
          realRating?.descriptors,
          ...(realRating?.specialTags || []),
          ...(game.special || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (queryTokens.every((token) => searchableText.includes(token))) {
          return true;
        }
        if (compactQuery.length >= 2) {
          const compactSearchable = searchableText.replace(/[^a-z0-9]/g, '');
          if (compactSearchable.includes(compactQuery)) {
            return true;
          }
        }
        return false;
      });
    };

    let result = [...libraryGames];

    if (showFavoritesOnly) {
      result = result.filter((g) => favorites.includes(g.id));
    } else if (selectedCategory === 'Featured') {
      result = result.filter((g) => g.featured);
    } else if (selectedCategory !== 'All') {
      result = result.filter((g) => g.category === selectedCategory);
    }

    if (queryTokens.length > 0) {
      const categoryMatched = applyQuery(result);
      // If active category or favorites filter hid valid matches within this library, search across the active library
      result = categoryMatched.length > 0 ? categoryMatched : applyQuery(libraryGames);
    }

    // Sorting
    if (sortBy === 'alpha-asc') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'alpha-desc') {
      result.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortBy === 'random') {
      result.sort((a, b) => (randomRankMap.get(a.id) ?? 0) - (randomRankMap.get(b.id) ?? 0));
    }

    return result;
  }, [libraryGames, selectedCategory, deferredQuery, favorites, showFavoritesOnly, sortBy, esrbVersion, randomRankMap]);

  const categoryCounts = useMemo(() => {
    const libraryFavCount = libraryGames.filter((g) => favorites.includes(g.id)).length;
    const counts: Record<GameCategory, number> = {
      'All': libraryGames.length,
      'Featured': 0,
      'Action & Shooters': 0,
      'Driving & Racing': 0,
      'Skill & Platformer': 0,
      'Retro & Arcade': 0,
      'Horror & Mystery': 0,
      'Sports & Physics': 0,
      'Puzzle & Casual': 0,
      'Emulators & Ports': 0,
      'Favorites': libraryFavCount,
    };
    for (const g of libraryGames) {
      if (g.featured) counts['Featured']++;
      if (g.category && counts[g.category] !== undefined && g.category !== 'All' && g.category !== 'Featured' && g.category !== 'Favorites') {
        counts[g.category]++;
      }
    }
    return counts;
  }, [libraryGames, favorites]);

  const visibleGames = useMemo(() => filteredGames.slice(0, visibleCount), [filteredGames, visibleCount]);
  const hasMore = visibleCount < filteredGames.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [deferredQuery, selectedLibrary, selectedCategory, showFavoritesOnly]);

  // Smooth infinite scroll: automatically load more games as the user scrolls
  useEffect(() => {
    if (currentTab !== 'games' || !hasMore) return;
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(filteredGames.length, prev + 96));
        }
      },
      {
        root: gamesScrollRef.current,
        rootMargin: '500px 0px',
        threshold: 0.01,
      }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [currentTab, hasMore, filteredGames.length]);

  // Sync scrolling and overflow based on active tab or game
  useEffect(() => {
    if (currentTab === 'chat' || activeGame) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [currentTab, activeGame]);

  const navProps = {
    currentTab,
    onTabChange: setCurrentTab,
    onGoHome: handleGoHome,
    onlineCount: globalChat.users.length,
    showFavoritesOnly,
    onToggleFavoritesOnly: handleToggleFavoritesOnly,
    onRandomGame: handleRandomGame,
    theme,
    onToggleTheme: toggleTheme,
    onOpenThemeSelector: handleOpenThemeSelector,
  };

  return (
    <>
      <FrostHubLoadingScreen />
      <AppCanvasBackground themeConfig={themeConfig} isDark={theme === 'dark'} />
      <div 
        className={`relative z-10 text-slate-900 dark:text-slate-100 flex font-sans selection:bg-[var(--brand-blue)] selection:text-white dark:border-slate-900 transition-colors overflow-hidden ${
          themeConfig.bgMode !== 'solid' || (themeConfig.bgSolidColor !== '#090d16' && themeConfig.bgSolidColor !== '#0a1128')
            ? 'bg-white/90 dark:bg-transparent'
            : 'bg-[#f8fafc] dark:bg-slate-950'
        } h-[100dvh] max-h-[100dvh] pb-[env(safe-area-inset-bottom)]`}
        style={
          theme === 'dark' && themeConfig.bgMode === 'solid'
            ? {
                backgroundColor:
                  themeConfig.bgSolidColor === '#0a1128' || themeConfig.bgSolidColor === '#090d16'
                    ? 'var(--brand-navy-bg)'
                    : themeConfig.bgSolidColor,
              }
            : undefined
        }
      >
        
        <AppSidebar {...navProps} />

        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <Navbar
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedLibrary={selectedLibrary}
          onSelectLibrary={handleSelectLibrary}
          onGoHome={handleGoHome}
          onOpenMenu={() => setIsMenuOpen(true)}
        />

      {/* Main Content Scrollable Area with Smooth Transitions */}
      <AnimatePresence mode="wait" initial={false}>
        {currentTab === 'chat' ? (
          <motion.div
            key="chat-tab-view"
            variants={tabTransition}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex-1 flex flex-col min-h-0 h-full w-full"
          >
            <ChatView globalChat={globalChat} initialChannel={targetChatChannel} />
          </motion.div>
        ) : currentTab === 'ai' ? (
          <motion.div
            key="ai-tab-view"
            variants={tabTransition}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex-1 flex flex-col min-h-0 h-full w-full overflow-hidden"
          >
            <AIAssistantView />
          </motion.div>
        ) : currentTab === 'movies' ? (
          <motion.div
            key="movies-tab-view"
            variants={tabTransition}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex-1 flex flex-col min-h-0 h-full w-full overflow-y-auto"
          >
            <MovieView onActiveMediaChange={setActiveMedia} />
          </motion.div>
        ) : currentTab === 'tv' ? (
          <motion.div
            key="tv-tab-view"
            variants={tabTransition}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex-1 flex flex-col min-h-0 h-full w-full"
          >
            <LiveTVView />
          </motion.div>
        ) : currentTab === 'games' ? (
          <motion.main
            key="games-tab-view"
            ref={gamesScrollRef as any}
            variants={tabTransition}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex-1 w-full overflow-y-auto"
          >
            <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pb-24 lg:pb-16 sm:pt-6">
            {/* Categories & Sorting */}
            <div className="mb-4 sm:mb-6">
              <CategoryFilter
                selectedCategory={selectedCategory}
                onSelectCategory={handleSelectCategory}
                sortBy={sortBy}
                onSortChange={handleSortChange}
                onReshuffle={handleReshuffle}
                categoryCounts={categoryCounts}
              />
            </div>

            {/* Search status */}
            {searchQuery && (
              <div className="mb-4 sm:mb-8 flex items-center justify-between bg-white dark:bg-slate-900 px-4 sm:px-6 py-2.5 sm:py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-2.5 sm:gap-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">
                  <Search className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--brand-blue)] dark:text-[var(--brand-accent-tint)] shrink-0" />
                  <span>
                    <strong className="text-slate-900 dark:text-white">{filteredGames.length}</strong> {filteredGames.length === 1 ? 'result' : 'results'} for &ldquo;{searchQuery}&rdquo;
                  </span>
                </div>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-sm text-[var(--brand-blue)] dark:text-[var(--brand-accent-tint)] hover:opacity-80 font-semibold cursor-pointer px-3 py-1 rounded-full hover:bg-[var(--brand-blue)]/10 transition-colors shrink-0"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Empty State */}
            {filteredGames.length === 0 ? (
              <div className="py-24 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-12 max-w-lg mx-auto space-y-6 shadow-xl shadow-slate-200/20 dark:shadow-none">
                <div className="w-16 h-16 rounded-2xl bg-[var(--brand-blue)]/15 text-[var(--brand-blue)] dark:text-[var(--brand-accent-tint)] flex items-center justify-center mx-auto">
                  <Gamepad2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {showFavoritesOnly ? 'Nothing saved yet' : 'No games found'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  {showFavoritesOnly
                    ? 'Tap the heart on any game in this library to keep it here for quick access.'
                    : searchQuery ? `Nothing turned up for "${searchQuery}" in this library. Try searching all libraries or clearing your filter.` : 'Try another category or switch libraries.'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {searchQuery && selectedLibrary !== 'all' && (
                    <button
                      onClick={() => setSelectedLibrary('all')}
                      className="px-6 py-3 bg-[var(--brand-blue)] hover:opacity-90 active:scale-95 text-white text-sm font-semibold rounded-full shadow-md shadow-[var(--brand-blue-glow)] transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer"
                    >
                      Search all libraries
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('All');
                      setShowFavoritesOnly(false);
                    }}
                    className={`px-6 py-3 active:scale-95 text-sm font-semibold rounded-full transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer ${
                      searchQuery && selectedLibrary !== 'all'
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-white/10 dark:hover:bg-white/15 dark:text-white'
                        : 'bg-[var(--brand-blue)] hover:opacity-90 text-white shadow-md shadow-[var(--brand-blue-glow)]'
                    }`}
                  >
                    Show all {libraryGames.length} games
                  </button>
                </div>
              </div>
            ) : (
              /* Game Grid - Animated Container */
              <div 
                className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6 lg:gap-8"
              >
                {visibleGames.map((game, index) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    index={index}
                    onPlay={handlePlayGame}
                    onToggleFavorite={handleToggleFavorite}
                    isFavorite={favorites.includes(game.id)}
                  />
                ))}
              </div>
            )}

            {/* Load More Pagination & Auto-Scroll Sentinel */}
            {hasMore && (
              <div ref={loadMoreSentinelRef} className="mt-12 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => Math.min(filteredGames.length, prev + 120))}
                  className="inline-flex items-center gap-3 px-6 py-3 bg-white hover:bg-slate-50 active:scale-95 text-slate-900 font-medium text-sm rounded-full border border-slate-200 hover:border-[var(--brand-blue)]/40 transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer shadow-sm dark:bg-[#181824] dark:hover:bg-[#202030] dark:text-white dark:border-[#2a2a3e]"
                >
                  <span>Show more</span>
                  <span className="text-xs bg-slate-100 dark:bg-[#090d16] px-2 py-0.5 rounded-full text-[var(--brand-blue)] font-semibold tabular-nums">
                    {visibleCount} / {filteredGames.length}
                  </span>
                  <ArrowRight className="w-4 h-4 text-[var(--brand-blue)]" />
                </button>
                <button
                  type="button"
                  onClick={() => setVisibleCount(filteredGames.length)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--brand-blue)] hover:opacity-90 active:scale-95 text-white font-medium text-sm rounded-full transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer shadow-md shadow-[var(--brand-blue-glow)]"
                >
                  <span>Show all {filteredGames.length}</span>
                </button>
              </div>
            )}

            </div>

            {/* Footer */}
            <footer className="mt-16 border-t border-slate-200 bg-slate-50 dark:border-[#1f1f2e] dark:bg-[#0d0d12] py-8 transition-colors">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <button
                    type="button"
                    onClick={handleGoHome}
                    className="flex items-center gap-2 group cursor-pointer focus:outline-none"
                  >
                    <FrostHubLogo size="sm" />
                  </button>

                  <div className="text-slate-500 font-medium text-[11px]">
                    &copy; {new Date().getFullYear()} FrostHub. All rights reserved.
                  </div>
                </div>
              </div>
            </footer>
          </motion.main>
        ) : null}
      </AnimatePresence>
        </div>

      {/* Game Player Modal */}
      {activeGame && (
        <ErrorBoundary key={activeGame.id} fallback={() => null} onError={handleCloseGame}>
          <GamePlayer
            game={activeGame}
            onClose={handleCloseGame}
            isFavorite={favorites.includes(activeGame.id)}
            onToggleFavorite={handleToggleFavorite}
          />
        </ErrorBoundary>
      )}

      {/* Global In-App Message Notification Toast - visible on every screen and over games */}
      <InAppNotificationToast
        notification={globalChat.activeNotification}
        onDismiss={globalChat.dismissNotification}
        onOpenChat={() => {
          if (globalChat.activeNotification?.channel_id) {
            setTargetChatChannel(globalChat.activeNotification.channel_id);
          }
          setCurrentTab('chat');
        }}
      />

      <MobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} {...navProps} />

      {/* Global Voice Audio Engine - Stays mounted across all tabs */}
      <VoiceAudioEngine 
        remoteStreams={globalChat.remoteStreams}
        remoteScreenAudioStreams={globalChat.remoteScreenAudioStreams}
        isDeafened={globalChat.isDeafened}
      />

      {/* Persistent Voice Session Overlay - visible if in voice but NOT on chat tab */}
      {globalChat.isInVideo && currentTab !== 'chat' && (
        <PersistentVoiceDock
          globalChat={globalChat}
          onMaximizeToVoice={() => {
            setTargetChatChannel('video-general');
            setCurrentTab('chat');
          }}
        />
      )}

      {/* Theme & Style Selector Modal */}
      <ThemeSelectorModal
        isOpen={isThemeModalOpen}
        onClose={handleCloseThemeModal}
        config={themeConfig}
        onUpdateConfig={updateThemeConfig}
        onResetTheme={resetTheme}
        theme={theme}
        onToggleTheme={toggleTheme}
        cloak={cloak}
      />

      </div>
    </>
  );
}
