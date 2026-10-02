import React, { useState, useMemo, useEffect, useDeferredValue } from 'react';
import { Navbar } from './components/Navbar';
import { HeroSpotlight } from './components/HeroSpotlight';
import { CategoryFilter } from './components/CategoryFilter';
import { GameCard } from './components/GameCard';
import { GamePlayer } from './components/GamePlayer';
import { OfflineIndicator } from './components/OfflineIndicator';
import { 
  getAllGames, 
  getFavorites, 
  toggleFavorite as toggleFavoriteStorage, 
  recordRecentPlay 
} from './services/gameService';
import { useCloak, launchAboutBlank } from './hooks/useCloak';
import { useGameCache } from './hooks/useGameCache';
import { GameItem, GameCategory } from './types/game';
import { 
  Flame, 
  Search, 
  ShieldCheck, 
  Layers, 
  ArrowRight,
  Gamepad2,
  DownloadCloud
} from 'lucide-react';

const PAGE_SIZE = 36;

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);

  const [selectedCategory, setSelectedCategory] = useState<GameCategory>('All');
  const [sortBy, setSortBy] = useState<'popular' | 'alpha-asc' | 'alpha-desc' | 'random'>('popular');
  const [favorites, setFavorites] = useState<number[]>(() => getFavorites());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [activeGame, setActiveGame] = useState<GameItem | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Tab cloaking & Panic key system
  const {
    activePreset,
    applyPreset,
    panicKey,
    triggerPanic,
    presets,
  } = useCloak();

  // Offline Game Caching Engine
  const {
    cachedIds,
    isGameCached,
    cacheSingleGame,
    preCacheGames,
    isPreCaching,
    cacheProgress,
    cancelPreCaching,
  } = useGameCache();

  // 14-Minute Periodic HTTP Keep-Alive for Render
  useEffect(() => {
    const keepAlivePing = async () => {
      try {
        await fetch('/api/health');
      } catch (err) {
        // Silently catch network errors during keep-alive ping
      }
    };

    const interval = setInterval(keepAlivePing, 14 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Load all games from gn-math
  const allGames = useMemo(() => {
    return getAllGames();
  }, []);

  // Featured games for spotlight
  const featuredGames = useMemo(() => {
    return allGames.filter((g) => g.featured).slice(0, 10);
  }, [allGames]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<GameCategory, number> = {
      All: allGames.length,
      Featured: allGames.filter((g) => g.featured).length,
      'Action & Shooters': 0,
      'Driving & Racing': 0,
      'Skill & Platformer': 0,
      'Horror & Mystery': 0,
      'Retro & Arcade': 0,
      'Sports & Physics': 0,
      'Puzzle & Casual': 0,
      'Emulators & Ports': 0,
      Favorites: favorites.length,
    };

    allGames.forEach((g) => {
      if (counts[g.category] !== undefined) {
        counts[g.category]++;
      }
    });

    return counts;
  }, [allGames, favorites]);

  // Filtered & sorted game list (uses deferredQuery for 60 FPS zero-lag typing)
  const filteredGames = useMemo(() => {
    let list = [...allGames];

    // Filter by favorites if toggled
    if (showFavoritesOnly || selectedCategory === 'Favorites') {
      list = list.filter((g) => favorites.includes(g.id));
    } else if (selectedCategory === 'Featured') {
      list = list.filter((g) => g.featured);
    } else if (selectedCategory !== 'All') {
      list = list.filter((g) => g.category === selectedCategory);
    }

    // Filter by deferred search query (never lags UI)
    if (deferredQuery.trim()) {
      const q = deferredQuery.toLowerCase().trim();
      list = list.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          (g.author && g.author.toLowerCase().includes(q)) ||
          g.category.toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortBy === 'alpha-asc') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'alpha-desc') {
      list.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortBy === 'random') {
      list.sort((a, b) => ((a.id * 17) % 100) - ((b.id * 17) % 100));
    } else {
      list.sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return a.id - b.id;
      });
    }

    return list;
  }, [allGames, selectedCategory, deferredQuery, sortBy, showFavoritesOnly, favorites]);

  // Reset visible count when filter changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedCategory, deferredQuery, sortBy, showFavoritesOnly]);

  const handleToggleFavorite = (id: number) => {
    toggleFavoriteStorage(id);
    setFavorites(getFavorites());
  };

  const handlePlayGame = (game: GameItem) => {
    recordRecentPlay(game.id);
    cacheSingleGame(game); // Auto-caches played game silently for offline play
    setActiveGame(game);
  };

  const handleAboutBlank = (game: GameItem) => {
    recordRecentPlay(game.id);
    cacheSingleGame(game);
    launchAboutBlank(game.resolvedUrl, game.name);
  };

  const handleRandomGame = () => {
    if (!allGames.length) return;
    const randomIndex = Math.floor(Math.random() * allGames.length);
    const chosen = allGames[randomIndex];
    handlePlayGame(chosen);
  };

  const handleGoHome = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setShowFavoritesOnly(false);
    setActiveGame(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCachePopularGames = () => {
    // Cache featured & top 40 games in idle batches
    const targets = allGames.filter((g) => g.featured || favorites.includes(g.id)).slice(0, 40);
    preCacheGames(targets);
  };

  const visibleGames = filteredGames.slice(0, visibleCount);
  const hasMore = visibleCount < filteredGames.length;

  return (
    <div className="min-h-screen bg-[#080808] text-[#f4f4f5] flex flex-col font-sans selection:bg-[#ff5500] selection:text-black">
      
      {/* Top Navigation Bar: Sleek Black and Orange */}
      <Navbar
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
        panicKey={panicKey}
        onTriggerPanic={triggerPanic}
        totalGames={allGames.length}
        onGoHome={handleGoHome}
        cachedCount={cachedIds.size}
        onCacheAllGames={handleCachePopularGames}
        isPreCaching={isPreCaching}
      />

      {/* Main Container */}
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

        {/* Search status notification */}
        {searchQuery && (
          <div className="mb-6 flex items-center justify-between bg-[#111114] px-4 py-3 rounded-xl border border-[#202024]">
            <div className="flex items-center gap-2 text-sm text-zinc-300">
              <Search className="w-4 h-4 text-[#ff5500]" />
              <span>
                Found <strong className="text-white">{filteredGames.length}</strong> games for &ldquo;{searchQuery}&rdquo;
              </span>
            </div>
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-[#ff5500] hover:underline font-semibold cursor-pointer"
            >
              Clear search
            </button>
          </div>
        )}

        {/* Empty State */}
        {filteredGames.length === 0 ? (
          <div className="py-20 text-center bg-[#0e0e10] rounded-2xl border border-[#222225] p-8 max-w-lg mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#ff5500]/15 border border-[#ff5500]/30 text-[#ff5500] flex items-center justify-center mx-auto">
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
              className="px-5 py-2.5 bg-[#ff5500] hover:bg-[#e64d00] text-black text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer font-heading"
            >
              View All {allGames.length} Games
            </button>
          </div>
        ) : (
          /* Game Grid with GPU transforms and React.memo cards for 0 lag */
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
          <div className="mt-10 text-center">
            <button
              onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
              className="inline-flex items-center gap-2 px-8 py-3 bg-[#111114] hover:bg-[#18181c] text-white hover:text-[#ff5500] font-bold text-xs sm:text-sm rounded-xl border border-[#242428] hover:border-[#ff5500]/40 transition-all cursor-pointer font-heading shadow-lg"
            >
              <span>Load More Games</span>
              <span className="text-xs text-zinc-400">
                ({visibleCount} of {filteredGames.length})
              </span>
              <ArrowRight className="w-4 h-4 text-[#ff5500]" />
            </button>
          </div>
        )}

      </main>

      {/* Footer: Sleek Black and Orange */}
      <footer className="mt-16 border-t border-[#1c1c20] bg-[#050505] py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            
            {/* Brand Col */}
            <div className="space-y-2.5 md:col-span-2">
              <button
                onClick={handleGoHome}
                className="flex items-center gap-2.5 group cursor-pointer text-left focus:outline-none"
                title="Go to Home - All Games"
              >
                <div className="w-7 h-7 rounded-lg bg-[#ff5500] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Flame className="w-4 h-4 text-black fill-black" />
                </div>
                <span className="text-lg font-black text-white font-heading tracking-tight group-hover:text-[#ff5500] transition-colors">
                  MELTED
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ff5500]/15 text-[#ff6611] border border-[#ff5500]/30">
                  gn-math
                </span>
              </button>
              <p className="text-xs text-zinc-400 max-w-sm leading-relaxed">
                High-performance unblocked gaming portal featuring 840+ instant HTML5 titles with full offline support.
              </p>
              <div className="flex items-center gap-2 text-[11px] text-zinc-400 pt-1">
                <span className="flex items-center gap-1 text-[#ff5500] font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" /> 100% Unblocked
                </span>
                <span>·</span>
                <span className="flex items-center gap-1 text-zinc-300 font-semibold">
                  <Layers className="w-3.5 h-3.5 text-[#ff5500]" /> Offline Ready
                </span>
                <span>·</span>
                <span>840+ Games</span>
              </div>
            </div>

            {/* Quick Categories */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Categories
              </div>
              <ul className="space-y-1.5 text-xs text-zinc-400">
                <li>
                  <button onClick={() => setSelectedCategory('Action & Shooters')} className="hover:text-[#ff5500] transition-colors cursor-pointer">
                    Action & Shooters
                  </button>
                </li>
                <li>
                  <button onClick={() => setSelectedCategory('Driving & Racing')} className="hover:text-[#ff5500] transition-colors cursor-pointer">
                    Driving & Racing
                  </button>
                </li>
                <li>
                  <button onClick={() => setSelectedCategory('Skill & Platformer')} className="hover:text-[#ff5500] transition-colors cursor-pointer">
                    Skill & Platformer
                  </button>
                </li>
                <li>
                  <button onClick={() => setSelectedCategory('Horror & Mystery')} className="hover:text-[#ff5500] transition-colors cursor-pointer">
                    Horror / FNAF
                  </button>
                </li>
              </ul>
            </div>

            {/* Offline & Stealth */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Offline & Stealth
              </div>
              <ul className="space-y-1.5 text-xs text-zinc-400">
                <li>
                  <button onClick={handleCachePopularGames} className="hover:text-[#ff5500] transition-colors cursor-pointer flex items-center gap-1.5">
                    <DownloadCloud className="w-3.5 h-3.5 text-[#ff5500]" />
                    <span>Cache Top Games for Offline</span>
                  </button>
                </li>
                <li>
                  <button onClick={() => applyPreset('classroom')} className="hover:text-[#ff5500] transition-colors cursor-pointer">
                    Disguise as Classroom
                  </button>
                </li>
                <li>
                  <button onClick={() => applyPreset('drive')} className="hover:text-[#ff5500] transition-colors cursor-pointer">
                    Disguise as Google Drive
                  </button>
                </li>
                <li>
                  <button onClick={handleRandomGame} className="hover:text-[#ff5500] transition-colors cursor-pointer">
                    Surprise Game
                  </button>
                </li>
              </ul>
            </div>

          </div>

          <div className="pt-6 border-t border-[#19191c] flex flex-col sm:flex-row items-center justify-between text-[11px] text-zinc-400 gap-2">
            <div>
              &copy; {new Date().getFullYear()} Melted. Archive based on gn-math.
            </div>
            <div>
              Fast, instant offline & in-browser gaming
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Offline Status & Pre-cache Progress Indicator */}
      <OfflineIndicator
        cachedCount={cachedIds.size}
        isPreCaching={isPreCaching}
        cacheProgress={cacheProgress}
        onCancelPreCache={cancelPreCaching}
      />

      {/* Game Player Modal */}
      {activeGame && (
        <GamePlayer
          game={activeGame}
          onClose={() => setActiveGame(null)}
          isFavorite={favorites.includes(activeGame.id)}
          onToggleFavorite={handleToggleFavorite}
        />
      )}

    </div>
  );
}
