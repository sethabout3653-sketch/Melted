import React, { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { Navbar } from './components/Navbar';
import { motion, AnimatePresence } from 'motion/react';
import { HeroSpotlight } from './components/HeroSpotlight';
import { CategoryFilter } from './components/CategoryFilter';
import { GameCard } from './components/GameCard';
import { GamePlayer } from './components/GamePlayer';
import { ChatView } from './components/ChatView';
import { AIAssistantView } from './components/AIAssistantView';
import { FrostedLoadingScreen } from './components/FrostedLoadingScreen';
import { InAppNotificationToast } from './components/InAppNotificationToast';
import { VoiceAudioEngine } from './components/VoiceAudioEngine';
import { PhoneCallOverlay } from './components/PhoneCallOverlay';
import { getAllGames, resolveGameUrl, getUGSGames, getCKVGames, mergeUgsGames } from './services/gameService';
import { useCloak, launchAboutBlank } from './hooks/useCloak';
import { useGlobalChat } from './hooks/useGlobalChat';
import { useDeviceAdaptation } from './hooks/useDeviceAdaptation';
import { DeviceAdaptationBar } from './components/DeviceAdaptationBar';
import { useThemeConfig } from './hooks/useThemeConfig';
import { useFontConfig } from './hooks/useFontConfig';
import { ThemeSelectorModal } from './components/ThemeSelectorModal';
import { AppCanvasBackground } from './components/AppCanvasBackground';
import { MovieView } from './components/MovieView';
import { GameItem, GameCategory } from './types/game';
import { 
  Snowflake, 
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
  Maximize2
} from 'lucide-react';

const PAGE_SIZE = 36;

export default function App() {
  const [currentTab, setCurrentTab] = useState<'games' | 'chat' | 'ai' | 'movies'>('games');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);

  const [selectedCategory, setSelectedCategory] = useState<GameCategory>('All');
  const [sortBy, setSortBy] = useState<'popular' | 'alpha-asc' | 'alpha-desc' | 'random'>('popular');
  const [favorites, setFavorites] = useState<number[]>(() => getFavorites());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [targetChatChannel, setTargetChatChannel] = useState<string | null>(null);

  // Theme state: light by default
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('frosted_theme');
      return (saved === 'dark' || saved === 'light') ? saved : 'light';
    } catch {
      return 'light';
    }
  });

  const { config: themeConfig, updateConfig: updateThemeConfig, resetTheme } = useThemeConfig();
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('frosted_theme', theme);
    } catch {}
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Activate custom font & typography engine across app
  useFontConfig();

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

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
      globalChat.dismissNotification();
    }
  }, [currentTab, globalChat.activeNotification, globalChat.dismissNotification]);

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
      const stored = localStorage.getItem('frosted_favorites');
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
      localStorage.setItem('frosted_favorites', JSON.stringify(updated));
      return updated;
    } catch {
      return [];
    }
  }

  const handleToggleFavorite = (id: number) => {
    const updated = toggleFavoriteStorage(id);
    setFavorites(updated);
  };

  const handlePlayGame = (game: GameItem) => {
    setActiveGame(game);
  };

  const handleCloseGame = () => {
    setActiveGame(null);
  };

  // Keep user activity tracker perfectly synchronized with current tab, active game, active movie/show, and voice state
  useEffect(() => {
    if (activeMedia) {
      const isTV = activeMedia.mediaType === 'tv';
      const mediaLabel = isTV && activeMedia.season && activeMedia.episode
        ? `Watching ${activeMedia.title} (S${activeMedia.season} E${activeMedia.episode})`
        : `Watching ${activeMedia.title}`;
      globalChat.updateUser({ activity: mediaLabel, current_channel: 'text-general' });
    } else if (activeGame) {
      globalChat.updateUser({ activity: `Playing ${activeGame.name}` });
    } else if (globalChat.isInVideo) {
      globalChat.updateUser({ activity: 'In General Voice', current_channel: 'video-general' });
    } else if (currentTab === 'chat') {
      globalChat.updateUser({ activity: 'In Community Chat', current_channel: 'text-general' });
    } else if (currentTab === 'ai') {
      globalChat.updateUser({ activity: 'Using AI Assistant', current_channel: 'text-general' });
    } else if (currentTab === 'movies') {
      globalChat.updateUser({ activity: 'Browsing Movies & Shows', current_channel: 'text-general' });
    } else {
      globalChat.updateUser({ activity: 'Browsing Games', current_channel: 'text-general' });
    }
  }, [currentTab, activeGame, activeMedia, globalChat.isInVideo]);

  const handleGoHome = () => {
    setSelectedCategory('All');
    setSearchQuery('');
    setShowFavoritesOnly(false);
    setCurrentTab('games');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRandomGame = () => {
    const game = allGames[Math.floor(Math.random() * allGames.length)];
    if (game) handlePlayGame(game);
  };

  const handleAboutBlank = (game: GameItem) => {
    const url = game.resolvedUrl || resolveGameUrl(game.url, game.id);
    launchAboutBlank(url, game.name);
  };

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
      'Featured': allGames.filter(g => g.featured).length,
      'Action & Shooters': allGames.filter(g => g.category === 'Action & Shooters').length,
      'Driving & Racing': allGames.filter(g => g.category === 'Driving & Racing').length,
      'Skill & Platformer': allGames.filter(g => g.category === 'Skill & Platformer').length,
      'Retro & Arcade': allGames.filter(g => g.category === 'Retro & Arcade').length,
      'Horror & Mystery': allGames.filter(g => g.category === 'Horror & Mystery').length,
      'Sports & Physics': allGames.filter(g => g.category === 'Sports & Physics').length,
      'Puzzle & Casual': allGames.filter(g => g.category === 'Puzzle & Casual').length,
      'Emulators & Ports': allGames.filter(g => g.category === 'Emulators & Ports').length,
      'Favorites': favorites.length
    };
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

  return (
    <>
      <FrostedLoadingScreen isLoading={isCatalogLoading} />
      <AppCanvasBackground themeConfig={themeConfig} isDark={theme === 'dark'} />
      <div 
        className={`relative z-10 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white border-white dark:border-slate-900 transition-colors ${
          themeConfig.bgMode !== 'solid' || themeConfig.bgSolidColor !== '#090d16'
            ? 'bg-white/90 dark:bg-transparent'
            : 'bg-[#f8fafc] dark:bg-slate-950'
        } ${
          currentTab === 'chat' || currentTab === 'ai' ? 'h-[100dvh] max-h-[100dvh] overflow-hidden' : 'min-h-screen'
        }`}
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
        onToggleFavoritesOnly={() => setShowFavoritesOnly(!showFavoritesOnly)}
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
        onOpenThemeSelector={() => setIsThemeModalOpen(true)}
      />

      {/* Main Content Scrollable Area with Smooth Transitions */}
      <AnimatePresence mode="wait">
        {currentTab === 'chat' ? (
          <motion.div
            key="chat-tab-view"
            initial={{ opacity: 0, y: 8, filter: 'blur(2px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(2px)' }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col min-h-0 h-full w-full pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0"
          >
            <ChatView globalChat={globalChat} initialChannel={targetChatChannel} />
          </motion.div>
        ) : currentTab === 'ai' ? (
          <motion.div
            key="ai-tab-view"
            initial={{ opacity: 0, y: 8, filter: 'blur(2px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(2px)' }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col min-h-0 h-full w-full overflow-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0"
          >
            <AIAssistantView />
          </motion.div>
        ) : currentTab === 'movies' ? (
          <motion.div
            key="movies-tab-view"
            initial={{ opacity: 0, y: 8, filter: 'blur(2px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(2px)' }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col min-h-0 h-full w-full"
          >
            <MovieView onActiveMediaChange={setActiveMedia} />
          </motion.div>
        ) : (
          <motion.main
            key="games-tab-view"
            initial={{ opacity: 0, y: 8, filter: 'blur(2px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(2px)' }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-16 pb-24 md:pb-16"
          >
            {/* Hero Section */}
            {!searchQuery && !showFavoritesOnly && selectedCategory === 'All' && (
              <HeroSpotlight
                featuredGames={featuredGames}
                onPlay={handlePlayGame}
                onAboutBlank={handleAboutBlank}
              />
            )}

            {/* Categories & Sorting */}
            <div className="mb-12">
              <CategoryFilter
                selectedCategory={selectedCategory}
                onSelectCategory={(cat) => {
                  setSelectedCategory(cat);
                  if (cat === 'Favorites') setShowFavoritesOnly(true);
                  else setShowFavoritesOnly(false);
                }}
                sortBy={sortBy}
                onSortChange={setSortBy}
                categoryCounts={categoryCounts}
              />
            </div>

            {/* Search status */}
            {searchQuery && (
              <div className="mb-10 flex items-center justify-between bg-white dark:bg-slate-900 px-6 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300 font-medium">
                  <Search className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span>
                    Found <strong className="text-slate-900 dark:text-white">{filteredGames.length}</strong> matches for &ldquo;{searchQuery}&rdquo;
                  </span>
                </div>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-bold cursor-pointer border border-blue-100 dark:border-blue-800 px-3 py-1.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                >
                  Clear search
                </button>
              </div>
            )}

            {/* Empty State */}
            {filteredGames.length === 0 ? (
              <div className="py-24 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-12 max-w-lg mx-auto space-y-6 shadow-xl shadow-slate-200/20 dark:shadow-none">
                <div className="w-20 h-24 rounded-3xl bg-blue-50 dark:bg-blue-900/40 border border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-inner">
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
                  className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-2xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer font-heading"
                >
                  Explore All {allGames.length} Titles
                </button>
              </div>
            ) : (
              /* Game Grid - Animated Container */
              <motion.div 
                layout
                className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 sm:gap-8"
              >
                <AnimatePresence>
                  {visibleGames.map((game) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      onPlay={handlePlayGame}
                      onToggleFavorite={handleToggleFavorite}
                      isFavorite={favorites.includes(game.id)}
                      onAboutBlank={handleAboutBlank}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Load More Pagination */}
            {hasMore && (
              <div className="mt-16 flex flex-wrap items-center justify-center gap-4">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE * 2)}
                  className="inline-flex items-center gap-3 px-8 py-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer font-heading shadow-sm"
                >
                  <span>Discover More</span>
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-500 dark:text-slate-400">
                    {visibleCount} / {filteredGames.length}
                  </span>
                  <ArrowRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </motion.button>

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setVisibleCount(filteredGames.length)}
                  className="inline-flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-2xl transition-all cursor-pointer font-heading shadow-xl shadow-blue-600/25 border border-blue-400/30"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  <span>Show All Games</span>
                </motion.button>
              </div>
            )}

          </motion.main>
        )}
      </AnimatePresence>

      {/* Footer */}
      {currentTab === 'games' && (
        <footer className="mt-24 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 py-16 transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
              
              {/* Brand Col */}
              <div className="space-y-4 md:col-span-2">
                <button
                  type="button"
                  onClick={handleGoHome}
                  className="flex items-center gap-3 group cursor-pointer text-left focus:outline-none"
                >
                  <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center shadow-xl shadow-blue-600/20 group-hover:rotate-12 transition-transform">
                    <Snowflake className="w-7 h-7 text-white fill-none" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight font-heading">
                      Frosted
                    </h2>
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest">Premium Arcade</p>
                  </div>
                </button>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed font-medium">
                  The web's most refined collection of instant-play experiences. Hand-curated, performance-optimized, and always accessible.
                </p>
                <div className="flex items-center gap-4 pt-4">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>ENCRYPTED END-TO-END</span>
                  </div>
                </div>
              </div>

              {/* Quick Links */}
              <div className="space-y-4">
                <div className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Catalog
                </div>
                <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300 font-semibold">
                  <li><button type="button" onClick={() => { setSelectedCategory('Action & Shooters'); setCurrentTab('games'); }} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">High Action</button></li>
                  <li><button type="button" onClick={() => { setSelectedCategory('Puzzle & Casual'); setCurrentTab('games'); }} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">Logic & Puzzles</button></li>
                  <li><button type="button" onClick={() => { setSelectedCategory('Driving & Racing'); setCurrentTab('games'); }} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">Speed & Racing</button></li>
                  <li><button type="button" onClick={() => { setSelectedCategory('Sports & Physics'); setCurrentTab('games'); }} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">Competitive Sports</button></li>
                </ul>
              </div>

              {/* Community & Stealth */}
              <div className="space-y-4">
                <div className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Ecosystem
                </div>
                <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300 font-semibold">
                  <li>
                    <button type="button" onClick={() => setCurrentTab('chat')} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer flex items-center gap-2 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-800">
                      <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Community Chat</span>
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => applyPreset('classroom')} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">
                      School Mask
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => applyPreset('drive')} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">
                      Productivity Mask
                    </button>
                  </li>
                </ul>
              </div>

            </div>



            <div className="pt-10 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[12px] text-slate-400 font-medium gap-4">
              <div>
                &copy; {new Date().getFullYear()} Frosted. All rights reserved.
              </div>
              <div className="flex items-center gap-6">
                <span>V3.8.2</span>
              </div>
            </div>
          </div>
        </footer>
      )}


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

      {/* Sleek Responsive Mobile Navigation Bar */}
      <nav aria-label="Mobile Navigation" className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/98 dark:bg-slate-950/98 backdrop-blur-2xl border-t border-slate-200 dark:border-slate-800 px-1 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex items-center justify-around shadow-[0_-10px_40px_rgba(0,0,0,0.12)] transition-colors">
        <button
          type="button"
          onClick={() => {
            setCurrentTab('games');
            handleGoHome();
          }}
          className={`flex flex-col items-center gap-2 transition-all cursor-pointer flex-1 py-1 ${
            currentTab === 'games' ? 'text-blue-600 dark:text-blue-400 scale-110' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          <Gamepad2 className={`${currentTab === 'games' ? 'w-6 h-6' : 'w-5.5 h-5.5'}`} />
          <span className="text-[10px] font-black uppercase tracking-tighter">Games</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('ai')}
          className={`flex flex-col items-center gap-2 transition-all cursor-pointer flex-1 py-1 ${
            currentTab === 'ai' ? 'text-blue-600 dark:text-blue-400 scale-110' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          <Sparkles className={`${currentTab === 'ai' ? 'w-6 h-6' : 'w-5.5 h-5.5'}`} />
          <span className="text-[10px] font-black uppercase tracking-tighter">AI</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('chat')}
          className={`flex flex-col items-center gap-2 transition-all relative cursor-pointer flex-1 py-1 ${
            currentTab === 'chat' ? 'text-blue-600 dark:text-blue-400 scale-110' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          <div className="relative">
            <MessageSquare className={`${currentTab === 'chat' ? 'w-6 h-6' : 'w-5.5 h-5.5'}`} />
            {globalChat.users.length > 0 && (
              <span className="absolute -top-2 -right-2.5 bg-blue-600 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                {globalChat.users.length}
              </span>
            )}
          </div>
          <span className="text-[10px] font-black uppercase tracking-tighter">Social</span>
        </button>

        <button
          type="button"
          onClick={() => setIsThemeModalOpen(true)}
          className="flex flex-col items-center gap-2 text-slate-400 dark:text-slate-500 transition-all cursor-pointer flex-1 py-1"
        >
          <Palette className="w-5.5 h-5.5" />
          <span className="text-[10px] font-black uppercase tracking-tighter">Style</span>
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
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center animate-pulse">
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
              className="ml-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black rounded-xl uppercase tracking-tighter transition-all flex items-center gap-1.5 shadow-lg shadow-blue-600/20 cursor-pointer"
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
        onClose={() => setIsThemeModalOpen(false)}
        config={themeConfig}
        onUpdateConfig={updateThemeConfig}
        onResetTheme={resetTheme}
      />

      </div>
    </>
  );
}
