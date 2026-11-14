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
import { PhoneCallOverlay } from './components/PhoneCallOverlay';
import { getAllGames, resolveGameUrl, getUGSGames, getCKVGames, mergeUgsGames, getPlayableGameUrl } from './services/gameService';
import { tabTransition, containerVariants, entryVariants } from './utils/animations';
import { useCloak, launchAboutBlank } from './hooks/useCloak';
import { useGlobalChat } from './hooks/useGlobalChat';
import { useDeviceAdaptation } from './hooks/useDeviceAdaptation';
import { DeviceAdaptationBar } from './components/DeviceAdaptationBar';
import { useThemeConfig } from './hooks/useThemeConfig';
import { useFontConfig } from './hooks/useFontConfig';
import { ThemeSelectorModal } from './components/ThemeSelectorModal';
import { AppCanvasBackground } from './components/AppCanvasBackground';
import { MovieView } from './components/MovieView';
import { LiveTVView } from './components/LiveTVView';
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
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  VolumeX,
  Maximize2,
  Film,
  Tv
} from 'lucide-react';

const PAGE_SIZE = 36;

export default function App() {
  const [currentTab, setCurrentTab] = useState<'games' | 'chat' | 'ai' | 'movies' | 'tv'>('games');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);

  const [selectedCategory, setSelectedCategory] = useState<GameCategory>('All');
  const [sortBy, setSortBy] = useState<'popular' | 'alpha-asc' | 'alpha-desc' | 'random'>('popular');
  const [favorites, setFavorites] = useState<number[]>(() => getFavorites());
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

  // Favorites helpers
  function getFavorites(): number[] {
    try {
      const stored = localStorage.getItem('frosthub_favorites');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  function toggleFavoriteStorage(id: number) {
    try {
      const current = getFavorites();
      const updated = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      localStorage.setItem('frosthub_favorites', JSON.stringify(updated));
      return updated;
    } catch {
      return [];
    }
  }

  const handleToggleFavorite = useCallback((id: number) => {
    const updated = toggleFavoriteStorage(id);
    setFavorites(updated);
  }, []);

  const handlePlayGame = useCallback((game: GameItem) => {
    setActiveGame(game);
  }, []);

  const handleCloseGame = useCallback(() => {
    setActiveGame(null);
  }, []);

  // Keep user activity tracker synchronized with current tab, active game, active media, and voice state
  useEffect(() => {
    const inVoice = Boolean(globalChat.isInVideo || globalChat.activeChannel === 'video-general');

    if (inVoice) {
      if (activeGame) {
        globalChat.updateUser({ activity: `Playing ${activeGame.name}`, current_channel: 'video-general' });
      } else if (activeMedia) {
        const isTV = activeMedia.mediaType === 'tv';
        const mediaLabel = isTV && activeMedia.season && activeMedia.episode
          ? `Watching ${activeMedia.title} (S${activeMedia.season} E${activeMedia.episode})`
          : `Watching ${activeMedia.title}`;
        globalChat.updateUser({ activity: mediaLabel, current_channel: 'video-general' });
      } else {
        globalChat.updateUser({ activity: 'In General Voice', current_channel: 'video-general' });
      }
      return;
    }

    if (activeMedia) {
      const isTV = activeMedia.mediaType === 'tv';
      const mediaLabel = isTV && activeMedia.season && activeMedia.episode
        ? `Watching ${activeMedia.title} (S${activeMedia.season} E${activeMedia.episode})`
        : `Watching ${activeMedia.title}`;
      globalChat.updateUser({ activity: mediaLabel, current_channel: 'text-general' });
    } else if (activeGame) {
      globalChat.updateUser({ activity: `Playing ${activeGame.name}`, current_channel: 'text-general' });
    } else if (currentTab === 'chat') {
      globalChat.updateUser({ activity: 'In Community Chat', current_channel: 'text-general' });
    } else if (currentTab === 'ai') {
      globalChat.updateUser({ activity: 'Using AI Assistant', current_channel: 'text-general' });
    } else if (currentTab === 'movies') {
      globalChat.updateUser({ activity: 'Browsing Movies & Shows', current_channel: 'text-general' });
    } else if (currentTab === 'tv') {
      globalChat.updateUser({ activity: 'Watching Live TV', current_channel: 'text-general' });
    } else {
      globalChat.updateUser({ activity: 'Browsing Games', current_channel: 'text-general' });
    }
  }, [currentTab, activeGame, activeMedia, globalChat.isInVideo, globalChat.activeChannel]);

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

    if (deferredQuery.trim()) {
      const q = deferredQuery.toLowerCase();
      result = result.filter(
        (g) => g.name.toLowerCase().includes(q)
      );
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

  const handleStartCall = useCallback((user: any) => {
    globalChat.initiateCall(user.id, user.username || user.display_name || 'Online user', 'audio');
  }, [globalChat]);

  const handleStartVideoCall = useCallback((user: any) => {
    globalChat.initiateCall(user.id, user.username || user.display_name || 'Online user', 'video');
  }, [globalChat]);

  const handleStartGroupCall = useCallback((selectedUsers: any[]) => {
    const firstUser = selectedUsers[0];
    if (firstUser) globalChat.initiateCall(firstUser.id, firstUser.username || firstUser.display_name || 'Group call', 'audio');
  }, [globalChat]);

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
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
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
        users={globalChat.users}
        currentUser={globalChat.currentUser}
        onOpenThemeSelector={handleOpenThemeSelector}
        onStartCall={handleStartCall}
        onStartVideoCall={handleStartVideoCall}
        onStartGroupCall={handleStartGroupCall}
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
            className="flex-1 flex flex-col min-h-0 h-full w-full overflow-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0"
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
            className="flex-1 flex flex-col min-h-0 h-full w-full overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0"
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
        ) : (
          <motion.main
            key="games-tab-view"
            variants={tabTransition}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex-1 w-full overflow-y-auto"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 lg:pb-16">
            {/* Categories & Sorting - Directly at top below header */}
            <div className="mb-6">
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
              <div className="mb-10 flex items-center justify-between bg-white dark:bg-slate-900 px-6 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300 font-medium">
                  <Search className="w-5 h-5 text-cyan-500 dark:text-cyan-300" />
                  <span>
                    Found <strong className="text-slate-900 dark:text-white">{filteredGames.length}</strong> matches for &ldquo;{searchQuery}&rdquo;
                  </span>
                </div>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-cyan-500 dark:text-cyan-300 hover:text-blue-700 font-bold cursor-pointer border border-blue-100 dark:border-blue-800 px-3 py-1.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                >
                  Clear search
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
                className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 sm:gap-8"
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
                  className="inline-flex items-center gap-3 px-8 py-3.5 bg-[#181824] hover:bg-[#202030] text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-[#2a2a3e] hover:border-[var(--brand-blue)]/40 transition-all cursor-pointer font-heading shadow-md"
                >
                  <span>Discover More</span>
                  <span className="text-[10px] bg-[#090d16] px-2 py-0.5 rounded-md text-[var(--brand-blue)] font-extrabold">
                    {visibleCount} / {filteredGames.length}
                  </span>
                  <ArrowRight className="w-4 h-4 text-[var(--brand-blue)]" />
                </button>
              </div>
            )}

            </div>

            {/* Footer */}
            <footer className="mt-16 border-t border-[#1f1f2e] bg-[#0d0d12] py-8 transition-colors">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
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

      <PhoneCallOverlay
        incomingCall={globalChat.incomingCall}
        outgoingCall={globalChat.outgoingCall}
        activeDirectCall={globalChat.activeDirectCall}
  isConnected={globalChat.directRtc?.isConnected}
  localVideoStream={globalChat.cameraStream}
  onToggleVideo={() => globalChat.toggleCamera()}
  onToggleMic={(enabled) => globalChat.setIsMuted(!enabled)}
  onAccept={globalChat.acceptCall}
        onDecline={globalChat.dismissIncomingCall}
        onEnd={globalChat.endDirectCall}
      />

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

      {/* Sleek Responsive Mobile & Tablet Navigation Bar */}
      <nav aria-label="Mobile Navigation" className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#0d0d12]/95 backdrop-blur-xl border-t border-slate-200 dark:border-[#1e1e2d] px-1 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-around shadow-[0_-10px_40px_rgba(0,0,0,0.2)] transition-colors">
        <button
          type="button"
          onClick={() => setCurrentTab('games')}
          className={`flex flex-col items-center justify-center gap-1 min-h-[44px] transition-colors cursor-pointer flex-1 py-1 rounded-xl ${
            currentTab === 'games' ? 'text-[var(--brand-blue)]' : 'text-slate-400 dark:text-slate-500 hover:text-slate-200'
          }`}
        >
          <Gamepad2 className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tight">Games</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('movies')}
          className={`flex flex-col items-center justify-center gap-1 min-h-[44px] transition-colors cursor-pointer flex-1 py-1 rounded-xl ${
            currentTab === 'movies' ? 'text-[var(--brand-blue)]' : 'text-slate-400 dark:text-slate-500 hover:text-slate-200'
          }`}
        >
          <Film className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tight">Movies</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('ai')}
          className={`flex flex-col items-center justify-center gap-1 min-h-[44px] transition-colors cursor-pointer flex-1 py-1 rounded-xl ${
            currentTab === 'ai' ? 'text-[var(--brand-blue)]' : 'text-slate-400 dark:text-slate-500 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tight">AI</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('tv')}
          className={`flex flex-col items-center justify-center gap-1 min-h-[44px] transition-colors cursor-pointer flex-1 py-1 rounded-xl ${
            currentTab === 'tv' ? 'text-[var(--brand-blue)]' : 'text-slate-400 dark:text-slate-500 hover:text-slate-200'
          }`}
        >
          <Tv className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tight">Live TV</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('chat')}
          className={`flex flex-col items-center justify-center gap-1 min-h-[44px] transition-colors relative cursor-pointer flex-1 py-1 rounded-xl ${
            currentTab === 'chat' ? 'text-[var(--brand-blue)]' : 'text-slate-400 dark:text-slate-500 hover:text-slate-200'
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

        <button
          type="button"
          onClick={() => setIsThemeModalOpen(true)}
          className="flex flex-col items-center justify-center gap-1 min-h-[44px] text-slate-400 dark:text-slate-500 hover:text-slate-200 transition-colors cursor-pointer flex-1 py-1 rounded-xl"
        >
          <Palette className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tight">Style</span>
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
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-4 shadow-2xl"
        >
          <div className="flex items-center gap-2 pr-4 border-r border-white/10">
            <div className="w-8 h-8 rounded-xl bg-cyan-500 flex items-center justify-center">
              <Mic className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-white uppercase tracking-tighter">In Voice</span>
              <span className="text-[9px] text-slate-400 font-bold truncate max-w-[80px]">General Voice</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => globalChat.setIsMuted(!globalChat.isMuted)}
              className={`p-2 rounded-xl transition-all ${globalChat.isMuted ? 'bg-red-500/20 text-red-500' : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'}`}
            >
              {globalChat.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button 
              onClick={() => globalChat.setIsDeafened(!globalChat.isDeafened)}
              className={`p-2 rounded-xl transition-all ${globalChat.isDeafened ? 'bg-red-500/20 text-red-500' : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'}`}
            >
              {globalChat.isDeafened ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button 
              onClick={() => globalChat.stopVoiceChannel()}
              className="p-2 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all shadow-lg shadow-red-600/20"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
            <button 
              onClick={() => {
                setTargetChatChannel('video-general');
                setCurrentTab('chat');
              }}
              className="ml-2 px-3.5 py-2 bg-cyan-500 hover:bg-cyan-400 text-white text-[10px] font-black rounded-xl uppercase tracking-tighter transition-all flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 cursor-pointer"
              title="Maximize Voice"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Maximize</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Theme & Style Selector Modal */}
      <ThemeSelectorModal
        isOpen={isThemeModalOpen}
        onClose={handleCloseThemeModal}
        config={themeConfig}
        onUpdateConfig={updateThemeConfig}
        onResetTheme={resetTheme}
      />

      </div>
    </>
  );
}
