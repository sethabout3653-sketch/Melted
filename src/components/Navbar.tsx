import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Shuffle, 
  Heart, 
  X, 
  Palette,
  Sun,
  Moon
} from 'lucide-react';
import { motion } from 'motion/react';
import { FrostHubLogo } from './FrostHubLogo';
import { CloakPreset } from '../hooks/useCloak';
import { GameCategory } from '../types/game';
import { containerVariants, slideInVariants } from '../utils/animations';

interface NavbarProps {
  currentTab: 'games' | 'chat' | 'ai' | 'movies' | 'tv';
  onTabChange: (tab: 'games' | 'chat' | 'ai' | 'movies' | 'tv') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onRandomGame: () => void;
  favoritesCount: number;
  showFavoritesOnly: boolean;
  onToggleFavoritesOnly: () => void;
  activePreset: string;
  presets: CloakPreset[];
  onSelectPreset: (id: string) => void;
  totalGames: number;
  onGoHome: () => void;
  selectedCategory?: GameCategory;
  onSelectCategory?: (category: GameCategory) => void;
  onlineCount?: number;
  isConnected?: boolean;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onOpenFirebase?: () => void;
  firebaseUser?: any;
  onOpenThemeSelector?: () => void;
}

interface NavSearchInputProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

const NavSearchInput: React.FC<NavSearchInputProps> = React.memo(({
  searchQuery,
  onSearchChange,
}) => {
  const [localVal, setLocalVal] = useState(searchQuery);

  useEffect(() => {
    setLocalVal(searchQuery);
  }, [searchQuery]);

  const placeholder = 'What are you in the mood for?';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalVal(val);
    React.startTransition(() => {
      onSearchChange(val);
    });
  };

  const handleClear = () => {
    setLocalVal('');
    onSearchChange('');
  };

  return (
    <div className="relative group">
      <Search className="w-4 h-4 text-[var(--brand-blue)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors" />
      <input
        type="text"
        value={localVal}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full bg-slate-100 hover:bg-slate-200/70 focus:bg-white dark:bg-[#181824] dark:hover:bg-[#1e1e2d] dark:focus:bg-[#13131c] text-sm text-slate-900 dark:text-white placeholder-slate-400 rounded-xl pl-10 pr-10 py-2.5 border border-slate-200 dark:border-[#2a2a3c] focus:border-[var(--brand-blue)] focus:ring-1 focus:ring-[var(--brand-blue)] transition-colors duration-150 focus:outline-none shadow-inner"
      />
      {localVal && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
});

export const Navbar: React.FC<NavbarProps> = React.memo(({
  currentTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  onRandomGame,
  showFavoritesOnly,
  onToggleFavoritesOnly,
  onGoHome,
  onlineCount = 0,
  theme = 'dark',
  onToggleTheme,
  onOpenThemeSelector,
}) => {

  return (
    <header className="sticky top-0 z-50 w-full bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl border-b border-slate-200/70 dark:border-white/10 text-slate-900 dark:text-white shrink-0 shadow-lg shadow-black/5 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-[4.25rem] flex items-center justify-between gap-2 sm:gap-6">
        
        {/* Zone 1: FrostHub Logo */}
        <div className="flex items-center shrink-0">
          <button 
            type="button"
            onClick={() => {
              onTabChange('games');
              onGoHome();
            }}
            aria-label="Go to FrostHub home"
            className="flex items-center group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)] rounded-xl select-none"
          >
            <FrostHubLogo size="md" className="transition-transform group-hover:scale-105" />
          </button>
        </div>

        {/* Zone 2: Central Search Bar (Games tab only — Movies, Live TV, and Chat have dedicated in-tab searches) */}
        <div className="hidden sm:block flex-1 max-w-md lg:max-w-lg mx-1 sm:mx-3">
          {currentTab === 'games' && (
            <NavSearchInput
              searchQuery={searchQuery}
              onSearchChange={onSearchChange}
            />
          )}
        </div>

        {/* Zone 3: Navigation Links & Actions */}
        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          <nav aria-label="Main navigation" className="hidden lg:flex items-center gap-1">
            {[
              { id: 'games', label: 'Games' },
              { id: 'movies', label: 'Movies' },
              { id: 'tv', label: 'Live TV' },
              { id: 'ai', label: 'AI Assistant' },
              { id: 'chat', label: 'Community' },
            ].map((tab) => {
              const isActive = currentTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id as any)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`press relative text-sm font-medium transition-colors px-3.5 py-2 rounded-full whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'text-[var(--brand-blue)]'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-white/5'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-active-indicator"
                      className="absolute inset-0 rounded-full bg-[var(--brand-blue)]/12 ring-1 ring-inset ring-[var(--brand-blue)]/25"
                      transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                    />
                  )}
                  <span className="relative">{tab.label}</span>
                  {tab.id === 'chat' && onlineCount > 0 && (
                    <span className="ml-1.5 bg-[var(--brand-blue)] text-slate-950 text-[11px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums">
                      {onlineCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Quick Action Icons */}
          <div className="flex items-center gap-1 sm:gap-1.5 sm:border-l border-slate-200 dark:border-[#242436] sm:pl-3">
            <button
              type="button"
              onClick={onRandomGame}
              className="min-w-[38px] min-h-[38px] flex items-center justify-center p-2 text-slate-500 hover:text-[var(--brand-blue)] hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#1a1a26] rounded-lg transition-all cursor-pointer"
              title="Surprise me"
              aria-label="Play a random game"
            >
              <Shuffle className="w-4 h-4" />
            </button>
            
            <button
              type="button"
              onClick={onToggleFavoritesOnly}
              className={`min-w-[38px] min-h-[38px] flex items-center justify-center p-2 rounded-lg transition-all cursor-pointer ${
                showFavoritesOnly 
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                  : 'text-slate-500 hover:text-rose-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-[#1a1a26]'
              }`}
              title="Saved games"
              aria-label="Filter saved games"
              aria-pressed={showFavoritesOnly}
            >
              <Heart className={`w-4 h-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
            </button>

            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className="min-w-[38px] min-h-[38px] flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-amber-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-amber-400 dark:hover:bg-[#1a1a26] transition-all cursor-pointer"
                title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
                aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-300" />
                ) : (
                  <Moon className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                )}
              </button>
            )}

            {onOpenThemeSelector && (
              <button
                type="button"
                onClick={onOpenThemeSelector}
                className="min-w-[38px] min-h-[38px] flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-[var(--brand-blue)] hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#1a1a26] transition-all cursor-pointer"
                title={`Customize Theme & Font (${theme === 'dark' ? 'Dark' : 'Light'})`}
                aria-label="Customize theme and font"
              >
                <Palette className="w-4 h-4" />
              </button>
            )}
          </div>

        </div>

      </div>
    </header>
  );
});
