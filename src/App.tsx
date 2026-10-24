import React, { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { Navbar } from './components/Navbar';
import { motion, AnimatePresence } from 'motion/react';
import { HeroSpotlight } from './components/HeroSpotlight';
import { CategoryFilter } from './components/CategoryFilter';
import { GameCard } from './components/GameCard';
import { GamePlayer } from './components/GamePlayer';
import { ChatView } from './components/ChatView';
import { FrostedLoadingScreen } from './components/FrostedLoadingScreen';
import { InAppNotificationToast } from './components/InAppNotificationToast';
import { getAllGames, resolveGameUrl } from './services/gameService';
import { useCloak, launchAboutBlank } from './hooks/useCloak';
import { useGlobalChat } from './hooks/useGlobalChat';
import { useDeviceAdaptation } from './hooks/useDeviceAdaptation';
import { DeviceAdaptationBar } from './components/DeviceAdaptationBar';
import { GameItem, GameCategory } from './types/game';
import { 
  Snowflake, 
  Search, 
  ShieldCheck, 
  Zap, 
  ArrowRight,
  Gamepad2,
  MessageSquare,
  Video
} from 'lucide-react';

const PAGE_SIZE = 36;

export default function App() {
  const [currentTab, setCurrentTab] = useState<'games' | 'chat'>('games');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);

  const [selectedCategory, setSelectedCategory] = useState<GameCategory>('All');
  const [sortBy, setSortBy] = useState<'popular' | 'alpha-asc' | 'alpha-desc' | 'random'>('popular');
  const [favorites, setFavorites] = useState<number[]>(() => getFavorites());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Theme state: light by default
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('frosted_theme');
      return (saved === 'dark' || saved === 'light') ? saved : 'light';
    } catch {
      return 'light';
    }
  });

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
  const [allGames] = useState<GameItem[]>(() => {
    try {
      return getAllGames();
    } catch {
      return [];
    }
  });
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [activeGame, setActiveGame] = useState<GameItem | null>(null);

  // Global Chat and Notifications
  const globalChat = useGlobalChat({ isChatTabActive: currentTab === 'chat' });

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
    // Track activity in presence
    globalChat.updateUser({ activity: `Playing ${game.name}` });
  };

  const handleCloseGame = () => {
    setActiveGame(null);
    globalChat.updateUser({ activity: currentTab === 'chat' ? 'In Community Chat' : 'Browsing Games' });
  };

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
    const url = resolveGameUrl(game.url);
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
      <div className={`bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white border-8 border-white dark:border-slate-900 shadow-[inset_0_0_100px_rgba(0,0,0,0.02)] transition-colors ${
        currentTab === 'chat' ? 'h-screen h-[100dvh] max-h-screen overflow-hidden' : 'min-h-screen'
      }`}>
        
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
            className="flex-1 flex flex-col min-h-0 h-full w-full"
          >
            <ChatView globalChat={globalChat} />
          </motion.div>
        ) : (
          <motion.main
            key="games-tab-view"
            initial={{ opacity: 0, y: 8, filter: 'blur(2px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(2px)' }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-16"
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
                &copy; {new Date().getFullYear()} Frosted Arcade. All rights reserved.
              </div>
              <div className="flex items-center gap-6">
                <span>V3.8.2-PREMIUM</span>
                <span className="text-blue-500">60 FPS CERTIFIED</span>
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
          setCurrentTab('chat');
        }}
      />

      {/* Persistent Global Voice HUD when browsing games while connected to Voice */}
      {currentTab === 'games' && (() => {
        const currentDbUser = globalChat.users.find((u: any) => u.id === globalChat.currentUser?.id);
        const isConnectedToVoice = currentDbUser?.current_channel === 'video-general' || currentDbUser?.current_channel === 'voice-general';
        if (!isConnectedToVoice) return null;
        return (
          <aside aria-label="Active voice call" className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40 bg-[var(--bg-navy)]/95 backdrop-blur-xl border border-blue-500/50 rounded-2xl p-3 shadow-2xl flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-black text-white">General Voice</span>
                <span className="text-[10px] text-zinc-400 font-medium">
                  {globalChat.users.filter((u: any) => u.current_channel === 'video-general' || u.current_channel === 'voice-general').length} connected
                </span>
              </div>
            </div>

            <div className="h-6 w-px bg-white/10" />

            <button
              onClick={() => setCurrentTab('chat')}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5 border border-blue-400/30"
              title="Return to Video & Screen Share"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Open Call</span>
            </button>
          </aside>
        );
      })()}

      </div>
    </>
  );
}
