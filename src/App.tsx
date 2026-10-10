import React, { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { Navbar } from './components/Navbar';
import { HeroSpotlight } from './components/HeroSpotlight';
import { CategoryFilter } from './components/CategoryFilter';
import { GameCard } from './components/GameCard';
import { GamePlayer } from './components/GamePlayer';
import { ChatView } from './components/ChatView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { FrostedLoadingScreen } from './components/FrostedLoadingScreen';
import { InAppNotificationToast } from './components/InAppNotificationToast';
import { fetchGames, getAllGames, resolveGameUrl } from './services/gameService';
import { fetchLuminGames, getInitialLuminGames } from './services/luminService';
import { useCloak, launchAboutBlank } from './hooks/useCloak';
import { useGameCache } from './hooks/useGameCache';
import { useGlobalChat } from './hooks/useGlobalChat';
import { GameItem, GameCategory } from './types/game';
import { 
  Snowflake, 
  Search, 
  ShieldCheck, 
  Layers, 
  ArrowRight,
  Gamepad2,
  MessageSquare,
  Zap
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

  // Tab cloaking system
  const {
    activePreset,
    applyPreset,
    presets,
  } = useCloak();

  // Master Games State - Pre-populated with initial catalogue so UI renders instantly
  const [allGames, setAllGames] = useState<GameItem[]>(() => {
    try {
      const initial = getAllGames();
      const seedLumin = getInitialLuminGames();
      return [...initial, ...seedLumin];
    } catch {
      return [];
    }
  });
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [activeGame, setActiveGame] = useState<GameItem | null>(null);

  // Offline caching hook
  const { isGameCached, cacheProgress, cachedIds } = useGameCache(allGames);

  // Global Chat and Notifications
  const globalChat = useGlobalChat();

  // Master Catalog Load: Instant local boot + background 1,169+ Lumin catalog sync
  useEffect(() => {
    let active = true;

    // Fast intro animation dismissal (600ms)
    const introTimer = setTimeout(() => {
      if (active) setIsCatalogLoading(false);
    }, 600);

    async function syncCatalogs() {
      try {
        const meltedGames = getAllGames();
        
        // Fetch full Lumin SDK catalog (1,169+ games)
        const luminGames = await fetchLuminGames();

        if (!active || !luminGames || luminGames.length === 0) return;

        // Combine master archives preserving 100% of all titles across both catalogs
        const masterMap = new Map<string, GameItem>();
        
        // Add Melted games
        meltedGames.forEach((g) => {
          if (g && g.id !== undefined) {
            masterMap.set(`melted-${g.id}`, g);
          }
        });

        // Add full Lumin games
        luminGames.forEach((g) => {
          if (g && (g.luminId || g.id !== undefined)) {
            masterMap.set(`lumin-${g.luminId || g.id}`, g);
          }
        });

        const combined = Array.from(masterMap.values());
        setAllGames(combined);
        console.log(`⚡ [Master Catalog] ${combined.length} Total Games Loaded!`);
      } catch (err) {
        console.warn('Catalog sync notice:', err);
      } finally {
        if (active) setIsCatalogLoading(false);
      }
    }

    syncCatalogs();

    return () => {
      active = false;
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
    const url = game.source === 'lumin' ? game.url : resolveGameUrl(game.url);
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
        (g.author && g.author.toLowerCase().includes(q))
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
    <div className={`bg-[#050505] text-[#f4f4f5] flex flex-col font-sans selection:bg-[#0066ff] selection:text-white ${
      currentTab === 'chat' ? 'h-screen h-[100dvh] max-h-screen overflow-hidden' : 'min-h-screen'
    }`}>
      <FrostedLoadingScreen isLoading={isCatalogLoading} />
      
      {/* Top Navigation Bar: Sleek Black and Electric Blue */}
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

      {/* Main View: Either Discord Chat OR Games Catalog */}
      {currentTab === 'chat' ? (
        <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
          <ChatView globalChat={globalChat} />
        </div>
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          
          {/* Hero Spotlight: Shown on default landing */}
          {!searchQuery && selectedCategory === 'All' && !showFavoritesOnly && (
            <HeroSpotlight
              featuredGames={featuredGames}
              onPlay={handlePlayGame}
              onAboutBlank={handleAboutBlank}
            />
          )}

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
            <div className="mb-6 flex items-center justify-between bg-[#111114] px-4 py-3 rounded-xl border border-[#202024]">
              <div className="flex items-center gap-2 text-sm text-zinc-300">
                <Search className="w-4 h-4 text-[#0066ff]" />
                <span>
                  Found <strong className="text-white">{filteredGames.length}</strong> games for &ldquo;{searchQuery}&rdquo;
                </span>
              </div>
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-[#0066ff] hover:underline font-semibold cursor-pointer"
              >
                Clear search
              </button>
            </div>
          )}

          {/* Empty State */}
          {filteredGames.length === 0 ? (
            <div className="py-20 text-center bg-[#0e0e10] rounded-2xl border border-[#222225] p-8 max-w-lg mx-auto space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[#0066ff]/15 border border-[#0066ff]/30 text-[#0066ff] flex items-center justify-center mx-auto">
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
                className="px-5 py-2.5 bg-[#0066ff] hover:bg-[#0052cc] text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer font-heading"
              >
                View All {allGames.length} Games
              </button>
            </div>
          ) : (
            /* Game Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {visibleGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  onPlay={handlePlayGame}
                  onToggleFavorite={handleToggleFavorite}
                  isFavorite={favorites.includes(game.id)}
                  onAboutBlank={handleAboutBlank}
                  isCached={isGameCached(game.id)}
                />
              ))}
            </div>
          )}

          {/* Load More Pagination */}
          {hasMore && (
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE * 2)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#111114] hover:bg-[#18181c] text-white hover:text-[#0066ff] font-bold text-xs sm:text-sm rounded-xl border border-[#242428] hover:border-[#0066ff]/40 transition-all cursor-pointer font-heading shadow-lg"
              >
                <span>Load More Games</span>
                <span className="text-xs text-zinc-400">
                  ({visibleCount} of {filteredGames.length})
                </span>
                <ArrowRight className="w-4 h-4 text-[#0066ff]" />
              </button>

              <button
                onClick={() => setVisibleCount(filteredGames.length)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#0066ff] hover:bg-[#0052cc] text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all cursor-pointer font-heading shadow-md shadow-[#0066ff]/20"
              >
                <Zap className="w-4 h-4 fill-white text-white" />
                <span>Show All {filteredGames.length} Games</span>
              </button>
            </div>
          )}

        </main>
      )}

      {/* Footer: Clean, Precise, Robotic Alignment */}
      {currentTab === 'games' && (
        <footer className="mt-16 border-t border-[#1c1c20] bg-[#050505] py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
              
              {/* Brand Col */}
              <div className="space-y-2.5 md:col-span-2">
                <button
                  onClick={handleGoHome}
                  className="flex items-center gap-2.5 group cursor-pointer text-left focus:outline-none"
                  title="Go to Home"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#0066ff] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Snowflake className="w-4 h-4 text-white fill-none" />
                  </div>
                  <span className="text-lg font-black text-white font-heading tracking-tight group-hover:text-[#0066ff] transition-colors">
                    Frosted
                  </span>
                </button>
                <p className="text-xs text-zinc-400 max-w-sm leading-relaxed">
                  High-performance unblocked gaming portal featuring instant titles with full offline support.
                </p>
                <div className="flex items-center gap-2 text-[11px] text-zinc-400 pt-1">
                  <span className="flex items-center gap-1 text-[#0066ff] font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" /> 100% Unblocked
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1 text-zinc-300 font-semibold">
                    <Layers className="w-3.5 h-3.5 text-[#0066ff]" /> Offline Ready
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
                    <button onClick={() => setSelectedCategory('Action & Shooters')} className="hover:text-[#0066ff] transition-colors cursor-pointer">
                      Action & Shooters
                    </button>
                  </li>
                  <li>
                    <button onClick={() => setSelectedCategory('Driving & Racing')} className="hover:text-[#0066ff] transition-colors cursor-pointer">
                      Driving & Racing
                    </button>
                  </li>
                  <li>
                    <button onClick={() => setSelectedCategory('Skill & Platformer')} className="hover:text-[#0066ff] transition-colors cursor-pointer">
                      Skill & Platformer
                    </button>
                  </li>
                  <li>
                    <button onClick={() => setSelectedCategory('Horror & Mystery')} className="hover:text-[#0066ff] transition-colors cursor-pointer">
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
                    <button onClick={() => setCurrentTab('chat')} className="hover:text-[#0066ff] transition-colors cursor-pointer flex items-center gap-1.5 text-zinc-300">
                      <MessageSquare className="w-3.5 h-3.5 text-[#0066ff]" />
                      <span>Community Chat</span>
                    </button>
                  </li>
                  <li>
                    <button onClick={() => applyPreset('classroom')} className="hover:text-[#0066ff] transition-colors cursor-pointer">
                      Disguise as Classroom
                    </button>
                  </li>
                  <li>
                    <button onClick={() => applyPreset('drive')} className="hover:text-[#0066ff] transition-colors cursor-pointer">
                      Disguise as Google Drive
                    </button>
                  </li>
                  <li>
                    <button onClick={handleRandomGame} className="hover:text-[#0066ff] transition-colors cursor-pointer">
                      Surprise Game
                    </button>
                  </li>
                </ul>
              </div>

            </div>

            <div className="pt-6 border-t border-[#19191c] flex flex-col sm:flex-row items-center justify-between text-[11px] text-zinc-400 gap-2">
              <div>
                &copy; {new Date().getFullYear()} Frosted. Fast, instant offline gaming.
              </div>
              <div>
                Instant 60 FPS in-browser gameplay
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* Floating Offline Notification */}
      <OfflineIndicator
        cachedCount={cachedIds.size}
        isPreCaching={false}
        cacheProgress={cacheProgress}
      />

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

    </div>
  );
}
