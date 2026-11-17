import React, { useState, useEffect, useMemo, useDeferredValue, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { motion, AnimatePresence } from 'motion/react';
import { CategoryFilter } from './components/CategoryFilter';
import { GameCard } from './components/GameCard';
import { GamePlayer } from './components/GamePlayer';
import { ChatView } from './components/ChatView';
import { AIAssistantView } from './components/AIAssistantView';
import { FrostHubLoadingScreen } from './components/FrostHubLoadingScreen';
import { FrostHubLogo } from './components/FrostHubLogo';
import { InAppNotificationToast } from './components/InAppNotificationToast';
import { VoiceAudioEngine } from './components/VoiceAudioEngine';
import { PersistentVoiceDock } from './components/PersistentVoiceDock';
import { getAllGames, resolveGameUrl, getUGSGames, getCKVGames, mergeUgsGames, getPlayableGameUrl } from './services/gameService';
import { tabTransition, containerVariants, entryVariants } from './utils/animations';
import { useCloak, launchAboutBlank } from './hooks/useCloak';
import { useGlobalChat } from './hooks/useGlobalChat';
import { useDeviceAdaptation } from './hooks/useDeviceAdaptation';
import { useThemeConfig } from './hooks/useThemeConfig';
import { useFontConfig } from './hooks/useFontConfig';
import { ThemeSelectorModal } from './components/ThemeSelectorModal';
import { AppCanvasBackground } from './components/AppCanvasBackground';
import { MovieView } from './components/MovieView';
import { LiveTVView } from './components/LiveTVView';
import { BrowserTab } from './components/BrowserTab';
import {
  getEffectiveUserId,
  getStoredGameFavorites,
  subscribeToFavorites,
  toggleGameFavorite,
} from './services/favoritesService';
import { GameItem, GameCategory } from './types/game';
import { 
  Search, 
  ShieldCheck, 
  Zap, 
  ArrowRight,
  Gamepad2,
  MessageSquare,
  Sparkles,
  Heart,
  Palette,
  Sun,
  Moon,
  Shuffle,
  Film,
  Tv,
  Globe,
  X
} from 'lucide-react';

const PAGE_SIZE = 36;

export default function App() {
  const [currentTab, setCurrentTab] = useState<'games' | 'chat' | 'ai' | 'movies' | 'tv' | 'browser'>('games');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);

  const [selectedCategory, setSelectedCategory] = useState<GameCategory>('All');
  const [sortBy, setSortBy] = useState<'popular' | 'alpha-asc' | 'alpha-desc' | 'random'>('popular');
  const [favorites, setFavorites] = useState<number[]>(() => getStoredGameFavorites());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [targetChatChannel, setTargetChatChannel] = useState<string | null>(null);

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
  const {
    activePreset,
    applyPreset,
    presets,
  } = useCloak();

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
            current = mergeUgsGames(current, ugsResult.value);
          }
          if (ckvResult.status === 'fulfilled' && Array.isArray(ckvResult.value)) {
            current = mergeUgsGames(current, ckvResult.value);
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

  // Background prefetch for Live TV EPG so it renders instantly on navigation
  useEffect(() => {
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
      } else if (currentTab === 'browser') {
        activityLabel = 'Browsing the Web';
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
  }, [currentTab, activeGame, activeMedia, searchQuery, selectedCategory, showFavoritesOnly, allGames.length, globalChat.isInVideo, globalChat.activeChannel]);

  const handleGoHome = useCallback(() => {
    setSelectedCategory('All');
    setSearchQuery('');
    setShowFavoritesOnly(false);
    setCurrentTab('games');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleRandomGame = useCallback(() => {
    const game = allGames[Math.floor(Math.random() * allGames.length)];
    if (game) handlePlayGame(game);
  }, [allGames, handlePlayGame]);

  const handleAboutBlank = useCallback((game: GameItem) => {
    const url = getPlayableGameUrl(game);
    launchAboutBlank(url, game.name);
  }, []);

  const handleSelectCategory = useCallback((cat: GameCategory) => {
    setSelectedCategory(cat);
    if (cat === 'Favorites') setShowFavoritesOnly(true);
    else setShowFavoritesOnly(false);
  }, []);

  const handleSortChange = useCallback((sort: 'popular' | 'alpha-asc' | 'alpha-desc' | 'random') => {
    setSortBy(sort);
  }, []);

  const handleToggleFavoritesOnly = useCallback(() => {
    setShowFavoritesOnly((prev) => !prev);
  }, []);

  const filteredGames = useMemo(() => {
    let result = [...allGames];

    if (showFavoritesOnly) {
      result = result.filter((g) => favorites.includes(g.id));
    } else if (selectedCategory !== 'All') {
      result = result.filter((g) => g.category === selectedCategory);
    }

    const queryTokens = deferredQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (queryTokens.length > 0) {
      result = result.filter((game) => {
        const searchableText = [
          game.name,
          game.category,
          game.author,
          ...(game.special || []),
        ].filter(Boolean).join(' ').toLowerCase();
        return queryTokens.every((token) => searchableText.includes(token));
      });
    }

    // Sorting
    if (sortBy === 'alpha-asc') result.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'alpha-desc') result.sort((a, b) => b.name.localeCompare(a.name));
    if (sortBy === 'random') result.sort(() => Math.random() - 0.5);

    return result;
  }, [allGames, selectedCategory, deferredQuery, favorites, showFavoritesOnly, sortBy]);

  const categoryCounts = useMemo(() => {
    const counts: Record<GameCategory, number> = {
      'All': allGames.length,
      'Featured': 0,
      'Action & Shooters': 0,
      'Driving & Racing': 0,
      'Skill & Platformer': 0,
      'Retro & Arcade': 0,
      'Horror & Mystery': 0,
      'Sports & Physics': 0,
      'Puzzle & Casual': 0,
      'Emulators & Ports': 0,
      'Favorites': favorites.length,
    };
    for (const g of allGames) {
      if (g.featured) counts['Featured']++;
      if (g.category && counts[g.category] !== undefined && g.category !== 'All' && g.category !== 'Featured' && g.category !== 'Favorites') {
        counts[g.category]++;
      }
    }
    return counts;
  }, [allGames, favorites]);

  const featuredGames = useMemo(() => allGames.filter((g) => g.featured).slice(0, 10), [allGames]);
  const visibleGames = useMemo(() => filteredGames.slice(0, visibleCount), [filteredGames, visibleCount]);
  const hasMore = visibleCount < filteredGames.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [deferredQuery, selectedCategory, showFavoritesOnly]);

  // Sync scrolling and overflow based on active tab or game
  useEffect(() => {
    if (currentTab === 'chat' || currentTab === 'browser' || activeGame) {
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

  return (
    <>
      <FrostHubLoadingScreen />
      <AppCanvasBackground themeConfig={themeConfig} isDark={theme === 'dark'} />
      <div 
        className={`relative z-10 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white dark:border-slate-900 transition-colors overflow-hidden ${
          themeConfig.bgMode !== 'solid' || themeConfig.bgSolidColor !== '#090d16'
            ? 'bg-white/90 dark:bg-transparent'
            : 'bg-[#f8fafc] dark:bg-slate-950'
        } h-[100dvh] max-h-[100dvh]`}
        style={
          theme === 'dark' && themeConfig.bgMode === 'solid'
            ? { backgroundColor: themeConfig.bgSolidColor }
            : undefined
        }
      >
        
        {/* Top Navigation Bar */}
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        searchQuery={currentTab === 'games' ? searchQuery : ''}
        onSearchChange={currentTab === 'games' ? setSearchQuery : () => {}}
        onRandomGame={handleRandomGame}
        favoritesCount={favorites.length}
        showFavoritesOnly={showFavoritesOnly}
        onToggleFavoritesOnly={handleToggleFavoritesOnly}
        activePreset={activePreset}
        presets={presets}
        onSelectPreset={applyPreset}
        totalGames={allGames.length}
        onGoHome={handleGoHome}
        onlineCount={globalChat.users.length}
        isConnected={globalChat.isConnected}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenThemeSelector={handleOpenThemeSelector}
      />

      {/* Main Content Scrollable Area with Smooth Transitions */}
      <AnimatePresence mode="wait">
        {currentTab === 'chat' ? (
          <motion.div
            key="chat-tab-view"
            variants={tabTransition}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex-1 flex flex-col min-h-0 h-full w-full pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0"
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
            className="flex-1 flex flex-col min-h-0 h-full w-full overflow-hidden pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:pb-0"
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
            className="flex-1 flex flex-col min-h-0 h-full w-full overflow-y-auto pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:pb-0"
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
            className="flex-1 flex flex-col min-h-0 h-full w-full pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:pb-0"
          >
            <LiveTVView />
          </motion.div>
        ) : currentTab === 'browser' ? (
          <motion.div
            key="browser-tab-view"
            variants={tabTransition}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex-1 flex flex-col min-h-0 h-full w-full overflow-hidden pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:pb-0"
          >
            <BrowserTab />
          </motion.div>
        ) : (
          <motion.main
            key="games-tab-view"
            variants={tabTransition}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex-1 w-full overflow-y-auto"
          >
            <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pb-24 lg:pb-16 sm:pt-6">
            {/* Mobile Search Input (sticky at top of Games view when scrolling/searching) */}
            <div className="sm:hidden sticky top-0 z-20 -mx-3 px-3 py-2.5 bg-white/95 dark:bg-[#090d16]/95 backdrop-blur-md border-b border-slate-200/70 dark:border-white/5 mb-2">
              <div className="relative">
                <Search className="w-4 h-4 text-[var(--brand-blue)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${allGames.length} games...`}
                  className="w-full bg-slate-100/90 dark:bg-[#13151f] text-base text-slate-900 dark:text-white placeholder-slate-400 rounded-xl pl-10 pr-10 py-2 border border-slate-200 dark:border-[#24283b] focus:border-[var(--brand-blue)] focus:outline-none shadow-sm"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Categories & Sorting - Hidden on narrow mobile while actively typing a search so results appear right under the search bar */}
            <div className={`${searchQuery.trim() ? 'hidden sm:block' : ''} mb-4 sm:mb-6`}>
              <CategoryFilter
                selectedCategory={selectedCategory}
                onSelectCategory={handleSelectCategory}
                sortBy={sortBy}
                onSortChange={handleSortChange}
                categoryCounts={categoryCounts}
              />
            </div>

            {/* Search status */}
            {searchQuery && (
              <div className="mb-4 sm:mb-8 flex items-center justify-between bg-white dark:bg-slate-900 px-4 sm:px-6 py-2.5 sm:py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-2.5 sm:gap-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">
                  <Search className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-500 dark:text-cyan-300 shrink-0" />
                  <span>
                    Found <strong className="text-slate-900 dark:text-white">{filteredGames.length}</strong> matches for &ldquo;{searchQuery}&rdquo;
                  </span>
                </div>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-cyan-500 dark:text-cyan-300 hover:text-blue-700 font-bold cursor-pointer border border-blue-100 dark:border-blue-800 px-3 py-1 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors shrink-0"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Empty State */}
            {filteredGames.length === 0 ? (
              <div className="py-24 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-12 max-w-lg mx-auto space-y-6 shadow-xl shadow-slate-200/20 dark:shadow-none">
                <div className="w-20 h-24 rounded-3xl bg-blue-50 dark:bg-blue-900/40 border border-blue-100 dark:border-blue-800 text-cyan-500 dark:text-cyan-300 flex items-center justify-center mx-auto shadow-inner">
                  <Gamepad2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white font-heading">
                  Nothing found
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  {showFavoritesOnly
                    ? 'Your collection is empty. Start adding games by clicking the heart icon on any title.'
                    : `We couldn't find any games matching "${searchQuery}".`}
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                    setShowFavoritesOnly(false);
                  }}
                  className="px-8 py-3.5 bg-cyan-500 hover:bg-blue-700 text-white text-sm font-bold rounded-2xl shadow-lg shadow-cyan-500/30 transition-all cursor-pointer font-heading"
                >
                  Explore All {allGames.length} Titles
                </button>
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
                    onAboutBlank={handleAboutBlank}
                  />
                ))}
              </div>
            )}

            {/* Load More Pagination */}
            {hasMore && (
              <div className="mt-12 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE * 2)}
                  className="inline-flex items-center gap-3 px-8 py-3.5 bg-white hover:bg-slate-50 text-slate-900 font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-200 hover:border-[var(--brand-blue)]/40 transition-all cursor-pointer font-heading shadow-md dark:bg-[#181824] dark:hover:bg-[#202030] dark:text-white dark:border-[#2a2a3e]"
                >
                  <span>Discover More</span>
                  <span className="text-[10px] bg-slate-100 dark:bg-[#090d16] px-2 py-0.5 rounded-md text-[var(--brand-blue)] font-extrabold">
                    {visibleCount} / {filteredGames.length}
                  </span>
                  <ArrowRight className="w-4 h-4 text-[var(--brand-blue)]" />
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
        )}
      </AnimatePresence>


      {/* Game Player Modal */}
      {activeGame && (
        <GamePlayer
          game={activeGame}
          onClose={handleCloseGame}
          isFavorite={favorites.includes(activeGame.id)}
          onToggleFavorite={handleToggleFavorite}
        />
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

      {/* Sleek Responsive Mobile & Tablet Navigation Bar (5 clean tabs, Style lives in top Navbar) */}
      <nav aria-label="Mobile Navigation" className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#0d0d12]/95 backdrop-blur-xl border-t border-slate-200 dark:border-[#1e1e2d] px-2 py-1.5 pb-[max(0.45rem,env(safe-area-inset-bottom))] flex items-center justify-around gap-1 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] transition-colors">
        <button
          type="button"
          onClick={() => setCurrentTab('games')}
          className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors cursor-pointer flex-1 py-1 rounded-xl ${
            currentTab === 'games' ? 'text-[var(--brand-blue)] bg-[var(--brand-blue)]/10' : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Gamepad2 className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tight">Games</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('movies')}
          className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors cursor-pointer flex-1 py-1 rounded-xl ${
            currentTab === 'movies' ? 'text-[var(--brand-blue)] bg-[var(--brand-blue)]/10' : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Film className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tight">Movies</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('tv')}
          className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors cursor-pointer flex-1 py-1 rounded-xl ${
            currentTab === 'tv' ? 'text-[var(--brand-blue)] bg-[var(--brand-blue)]/10' : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Tv className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tight">Live TV</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('browser')}
          className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors cursor-pointer flex-1 py-1 rounded-xl ${
            currentTab === 'browser' ? 'text-[var(--brand-blue)] bg-[var(--brand-blue)]/10' : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Globe className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tight">Browser</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('ai')}
          className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors cursor-pointer flex-1 py-1 rounded-xl ${
            currentTab === 'ai' ? 'text-[var(--brand-blue)] bg-[var(--brand-blue)]/10' : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tight">AI</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('chat')}
          className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors relative cursor-pointer flex-1 py-1 rounded-xl ${
            currentTab === 'chat' ? 'text-[var(--brand-blue)] bg-[var(--brand-blue)]/10' : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5" />
            {globalChat.users.length > 0 && (
              <span className="absolute -top-1.5 -right-2.5 bg-[var(--brand-blue)] text-slate-950 text-[9px] font-black min-w-[16px] h-4 px-1 rounded flex items-center justify-center tabular-nums">
                {globalChat.users.length}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-tight">Social</span>
        </button>
      </nav>

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
      />

      </div>
    </>
  );
}
