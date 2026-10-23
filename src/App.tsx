import React, { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { Navbar } from './components/Navbar';
import { HeroSpotlight } from './components/HeroSpotlight';
import { CategoryFilter } from './components/CategoryFilter';
import { GameCard } from './components/GameCard';
import { GamePlayer } from './components/GamePlayer';
import { ChatView } from './components/ChatView';
import { MusicView } from './components/MusicView';
import { AdsterraBanner468 } from './components/AdsterraBanner468';
import { AdsterraCpmWidget } from './components/AdsterraCpmWidget';
import { AdsterraAd } from './components/AdsterraAd';
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
  const [currentTab, setCurrentTab] = useState<'games' | 'chat' | 'music'>('games');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);

  const [selectedCategory, setSelectedCategory] = useState<GameCategory>('All');
  const [sortBy, setSortBy] = useState<'popular' | 'alpha-asc' | 'alpha-desc' | 'random'>('popular');
  const [favorites, setFavorites] = useState<number[]>(() => getFavorites());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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
    }, 400);

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
    } catch {}
  }

  const handleToggleFavorite = (id: number) => {
    toggleFavoriteStorage(id);
    setFavorites(getFavorites());
  };

  const handleAboutBlank = (game: GameItem) => {
    const url = resolveGameUrl(game.url);
    if (url) {
      launchAboutBlank(url, game.name);
    }
  };

  const handlePlayGame = (game: GameItem) => {
    setActiveGame(game);
  };

  const handleCloseGame = () => {
    setActiveGame(null);
  };

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: allGames.length,
      Featured: allGames.filter((g) => g.featured).length,
      'Action & Shooters': allGames.filter((g) => g.category === 'Action & Shooters').length,
      'Driving & Racing': allGames.filter((g) => g.category === 'Driving & Racing').length,
      'Skill & Platformer': allGames.filter((g) => g.category === 'Skill & Platformer').length,
      'Horror & Mystery': allGames.filter((g) => g.category === 'Horror & Mystery').length,
      'Retro & Arcade': allGames.filter((g) => g.category === 'Retro & Arcade').length,
      'Sports & Physics': allGames.filter((g) => g.category === 'Sports & Physics').length,
      'Puzzle & Casual': allGames.filter((g) => g.category === 'Puzzle & Casual').length,
      'Emulators & Ports': allGames.filter((g) => g.category === 'Emulators & Ports').length,
      Favorites: favorites.length,
    };
    return counts as Record<GameCategory, number>;
  }, [allGames, favorites]);

  // Featured list for spotlight
  const featuredGames = useMemo(() => {
    return allGames.filter((g) => g.featured).slice(0, 6);
  }, [allGames]);

  // Filtered and sorted games list
  const filteredGames = useMemo(() => {
    let list = [...allGames];

    // Favorites filter
    if (showFavoritesOnly || selectedCategory === 'Favorites') {
      list = list.filter((g) => favorites.includes(g.id));
    } else if (selectedCategory === 'Featured') {
      list = list.filter((g) => g.featured);
    } else if (selectedCategory !== 'All') {
      list = list.filter((g) => g.category === selectedCategory);
    }

    // Search query filter
    if (deferredQuery.trim()) {
      const q = deferredQuery.toLowerCase().trim();
      list = list.filter((g) => 
        g.name.toLowerCase().includes(q) || 
        g.category.toLowerCase().includes(q) ||
        (g.author && g.author.toLowerCase().includes(q)) ||
        (g.special && g.special.some((s) => s.toLowerCase().includes(q)))
      );
    }

    // Sorting
    if (sortBy === 'alpha-asc') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'alpha-desc') {
      list.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortBy === 'random') {
      list.sort((a, b) => ((a.id * 7) % 100) - ((b.id * 7) % 100));
    } else {
      list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    }

    return list;
  }, [allGames, selectedCategory, deferredQuery, sortBy, showFavoritesOnly, favorites]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedCategory, deferredQuery, sortBy, showFavoritesOnly]);

  const handleRandomGame = () => {
    if (!allGames.length) return;
    const randomIndex = Math.floor(Math.random() * allGames.length);
    const chosen = allGames[randomIndex];
    handlePlayGame(chosen);
  };

  const handleGoHome = () => {
    setCurrentTab('games');
    setSearchQuery('');
    setSelectedCategory('All');
    setShowFavoritesOnly(false);
    setActiveGame(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const visibleGames = filteredGames.slice(0, visibleCount);
  const hasMore = visibleCount < filteredGames.length;

  // Real-time Presence Activity status (e.g. playing "Slope", searching games, in #general)
  const currentActivity = useMemo(() => {
    if (activeGame) {
      return `Playing "${activeGame.name}"`;
    }
    if (deferredQuery.trim()) {
      return 'Searching games';
    }
    if (currentTab === 'chat') {
      return 'In #general';
    }
    if (selectedCategory === 'Favorites') {
      return 'Viewing Favorites';
    }
    if (selectedCategory !== 'All') {
      return `Browsing ${selectedCategory}`;
    }
    return 'Browsing games';
  }, [activeGame, deferredQuery, currentTab, selectedCategory]);

  useEffect(() => {
    if (globalChat.updateUser && globalChat.isConnected) {
      globalChat.updateUser({ activity: currentActivity });
    }
  }, [currentActivity, globalChat.updateUser, globalChat.isConnected]);

  // Prevent outer window scrolling when inside chat tab so only chat messages & online list can scroll
  useEffect(() => {
    if (currentTab === 'chat') {
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
  }, [currentTab]);

  return (
    <div className={`bg-[var(--bg-navy)] text-[var(--text-white)] flex flex-col font-sans selection:bg-[var(--vibrant-cyan)] selection:text-white ${
      currentTab === 'chat' || currentTab === 'music' ? 'h-screen h-[100dvh] max-h-screen overflow-hidden' : 'min-h-screen'
    }`}>
      <FrostedLoadingScreen isLoading={isCatalogLoading} />
      
      {/* Top Navigation Bar */}
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRandomGame={handleRandomGame}
        favoritesCount={favorites.length}
        showFavoritesOnly={showFavoritesOnly}
        onToggleFavoritesOnly={() => {
          setShowFavoritesOnly(!showFavoritesOnly);
          if (!showFavoritesOnly) setSelectedCategory('Favorites');
          else setSelectedCategory('All');
        }}
        activePreset={activePreset}
        presets={presets}
        onSelectPreset={applyPreset}
        totalGames={allGames.length}
        onGoHome={handleGoHome}
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
          setShowFavoritesOnly(cat === 'Favorites');
        }}
        onlineCount={globalChat.users.length}
        isConnected={globalChat.isConnected}
      />

      {/* Multi-Device Adaptation Bar */}
      <DeviceAdaptationBar
        deviceInfo={deviceInfo}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        favoritesCount={favorites.length}
        showFavoritesOnly={showFavoritesOnly}
        onToggleFavoritesOnly={() => {
          setShowFavoritesOnly(!showFavoritesOnly);
          if (!showFavoritesOnly) setSelectedCategory('Favorites');
          else setSelectedCategory('All');
        }}
        onRandomGame={handleRandomGame}
        onlineCount={globalChat.users.length}
        isConnected={globalChat.isConnected}
      />

      {/* Persistent Global Chat & WebRTC Voice/Video View */}
      <div 
        className={`flex-1 min-h-0 w-full overflow-hidden flex flex-col ${deviceInfo.isMobile ? 'pb-16' : ''} ${
          currentTab === 'chat' ? 'flex' : 'hidden'
        }`}
      >
        <ChatView globalChat={globalChat} />
      </div>

      {/* Persistent Music View - Spotify / YouTube Music Style */}
      <div 
        className={`flex-1 min-h-0 w-full overflow-hidden flex flex-col ${deviceInfo.isMobile ? 'pb-16' : ''} ${
          currentTab === 'music' ? 'flex' : 'hidden'
        }`}
      >
        <MusicView />
      </div>

      {/* Main View: Games Catalog */}
      {currentTab === 'games' && (
        <main className={`flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 ${deviceInfo.isMobile ? 'pb-24' : ''}`}>
          
          {/* Hero Spotlight: Shown on default landing */}
          {!searchQuery && selectedCategory === 'All' && !showFavoritesOnly && (
            <HeroSpotlight
              featuredGames={featuredGames}
              onPlay={handlePlayGame}
              onAboutBlank={handleAboutBlank}
            />
          )}

          {/* Adsterra Top Sponsored Banner */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 my-6">
            <AdsterraBanner468 />
            <AdsterraCpmWidget />
          </div>

          {/* Categories & Sorting */}
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

          {/* Search status */}
          {searchQuery && (
            <div className="mb-6 flex items-center justify-between bg-[var(--bg-navy)] px-4 py-3 rounded-xl border border-[var(--bg-navy)]">
              <div className="flex items-center gap-2 text-sm text-zinc-300">
                <Search className="w-4 h-4 text-[var(--vibrant-cyan)]" />
                <span>
                  Found <strong className="text-white">{filteredGames.length}</strong> games for &ldquo;{searchQuery}&rdquo;
                </span>
              </div>
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-[var(--vibrant-cyan)] hover:underline font-semibold cursor-pointer"
              >
                Clear search
              </button>
            </div>
          )}

          {/* Empty State */}
          {filteredGames.length === 0 ? (
            <div className="py-20 text-center bg-[var(--bg-navy)] rounded-2xl border border-[var(--bg-navy)] p-8 max-w-lg mx-auto space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[var(--vibrant-cyan)]/15 border border-[var(--vibrant-cyan)]/30 text-[var(--vibrant-cyan)] flex items-center justify-center mx-auto">
                <Gamepad2 className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-black text-white font-heading">
                No games found
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400">
                {showFavoritesOnly
                  ? 'No games saved to your favorites yet. Click the heart icon on any game card to bookmark it!'
                  : `No games found matching "${searchQuery}".`}
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                  setShowFavoritesOnly(false);
                }}
                className="px-5 py-2.5 bg-[var(--vibrant-cyan)] hover:bg-[var(--bg-navy)] text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer font-heading"
              >
                View All {allGames.length} Games
              </button>
            </div>
          ) : (
            /* Game Grid */
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5">
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
            </div>
          )}

          {/* Load More Pagination */}
          {hasMore && (
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE * 2)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--bg-navy)] hover:bg-[var(--bg-navy)] text-white hover:text-[var(--vibrant-cyan)] font-bold text-xs sm:text-sm rounded-xl border border-[var(--bg-navy)] hover:border-[var(--vibrant-cyan)]/40 transition-all cursor-pointer font-heading shadow-lg"
              >
                <span>Load More Games</span>
                <span className="text-xs text-zinc-400">
                  ({visibleCount} of {filteredGames.length})
                </span>
                <ArrowRight className="w-4 h-4 text-[var(--vibrant-cyan)]" />
              </button>

              <button
                onClick={() => setVisibleCount(filteredGames.length)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--vibrant-cyan)] hover:bg-[var(--bg-navy)] text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all cursor-pointer font-heading shadow-md shadow-[var(--vibrant-cyan)]/20"
              >
                <Zap className="w-4 h-4 fill-white text-white" />
                <span>Show All {filteredGames.length} Games</span>
              </button>
            </div>
          )}

        </main>
      )}

      {/* Footer */}
      {currentTab === 'games' && (
        <footer className="mt-16 border-t border-[var(--bg-navy)] bg-[var(--bg-navy)] py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
              
              {/* Brand Col */}
              <div className="space-y-2.5 md:col-span-2">
                <button
                  onClick={handleGoHome}
                  className="flex items-center gap-2.5 group cursor-pointer text-left focus:outline-none"
                  title="Go to Home"
                >
                  <div className="w-7 h-7 rounded-lg bg-[var(--vibrant-cyan)] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Snowflake className="w-4 h-4 text-white fill-none" />
                  </div>
                  <span className="text-lg font-black text-white font-heading tracking-tight group-hover:text-[var(--vibrant-cyan)] transition-colors">
                    Frosted
                  </span>
                </button>
                <p className="text-xs text-zinc-400 max-w-sm leading-relaxed">
                  High-performance unblocked gaming portal featuring instant titles with 60 FPS in-browser play.
                </p>
                <div className="flex items-center gap-2 text-[11px] text-zinc-400 pt-1">
                  <span className="flex items-center gap-1 text-[var(--vibrant-cyan)] font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" /> 100% Unblocked
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1 text-zinc-300 font-semibold">
                    <Zap className="w-3.5 h-3.5 text-[var(--vibrant-cyan)]" /> High-Performance
                  </span>
                </div>
              </div>

              {/* Quick Categories */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Categories
                </div>
                <ul className="space-y-1.5 text-xs text-zinc-400">
                  <li>
                    <button onClick={() => setSelectedCategory('Action & Shooters')} className="hover:text-[var(--vibrant-cyan)] transition-colors cursor-pointer">
                      Action & Shooters
                    </button>
                  </li>
                  <li>
                    <button onClick={() => setSelectedCategory('Driving & Racing')} className="hover:text-[var(--vibrant-cyan)] transition-colors cursor-pointer">
                      Driving & Racing
                    </button>
                  </li>
                  <li>
                    <button onClick={() => setSelectedCategory('Skill & Platformer')} className="hover:text-[var(--vibrant-cyan)] transition-colors cursor-pointer">
                      Skill & Platformer
                    </button>
                  </li>
                  <li>
                    <button onClick={() => setSelectedCategory('Horror & Mystery')} className="hover:text-[var(--vibrant-cyan)] transition-colors cursor-pointer">
                      Horror / Mystery
                    </button>
                  </li>
                </ul>
              </div>

              {/* Community & Stealth */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Community & Stealth
                </div>
                <ul className="space-y-1.5 text-xs text-zinc-400">
                  <li>
                    <button onClick={() => setCurrentTab('chat')} className="hover:text-[var(--vibrant-cyan)] transition-colors cursor-pointer flex items-center gap-1.5 text-zinc-300">
                      <MessageSquare className="w-3.5 h-3.5 text-[var(--vibrant-cyan)]" />
                      <span>Community Chat</span>
                    </button>
                  </li>
                  <li>
                    <button onClick={() => applyPreset('classroom')} className="hover:text-[var(--vibrant-cyan)] transition-colors cursor-pointer">
                      Disguise as Classroom
                    </button>
                  </li>
                  <li>
                    <button onClick={() => applyPreset('drive')} className="hover:text-[var(--vibrant-cyan)] transition-colors cursor-pointer">
                      Disguise as Google Drive
                    </button>
                  </li>
                  <li>
                    <button onClick={handleRandomGame} className="hover:text-[var(--vibrant-cyan)] transition-colors cursor-pointer">
                      Surprise Game
                    </button>
                  </li>
                </ul>
              </div>

            </div>

            {/* Footer Adsterra Ad Unit */}
            <div className="my-8 flex justify-center">
              <AdsterraAd className="max-w-md w-full" />
            </div>

            <div className="pt-6 border-t border-[var(--bg-navy)] flex flex-col sm:flex-row items-center justify-between text-[11px] text-zinc-400 gap-2">
              <div>
                &copy; {new Date().getFullYear()} Frosted. Fast, instant arcade gaming.
              </div>
              <div>
                Instant 60 FPS in-browser gameplay
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
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
              title="Return to Video & Screen Share"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Open Call</span>
            </button>
          </aside>
        );
      })()}

    </div>
  );
}
