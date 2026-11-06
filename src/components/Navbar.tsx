import React, { useRef } from 'react';
import { 
  Search, 
  Shuffle, 
  Heart, 
  X, 
  Sun,
  Moon,
  Palette
} from 'lucide-react';
import { motion } from 'motion/react';
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
  users?: any[];
  currentUser?: any;
  onOpenThemeSelector?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
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
  const searchInputRef = useRef<HTMLInputElement>(null);

  return (
    <header className="sticky top-0 z-50 w-full bg-[#0d0d12] border-b border-[#1e1e2d] text-white shrink-0 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4 sm:gap-8">
        
        {/* Zone 1: FrostHub Logo */}
        <div className="flex items-center shrink-0">
          <button 
            type="button"
            onClick={() => {
              onTabChange('games');
              onGoHome();
            }}
            className="flex items-center group cursor-pointer focus:outline-none select-none"
          >
            <img 
              src="/assets/aistudio/Screenshot_2026-11-04_190053-removebg-preview_82d6e6a3.png" 
              alt="FrostHub" 
              className="h-10 sm:h-12 w-auto object-contain brightness-110 drop-shadow-[0_0_10px_rgba(0,240,255,0.25)] transition-transform group-hover:scale-105"
            />
          </button>
        </div>

        {/* Zone 2: Central Search Bar */}
        <div className="flex-1 max-w-xl mx-1 sm:mx-4">
          <div className="relative group">
            <Search className="w-4 h-4 text-[#00f0ff] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                if (currentTab !== 'games') onTabChange('games');
                onSearchChange(e.target.value);
              }}
              placeholder="Search titles..."
              className="w-full bg-[#181824] hover:bg-[#1e1e2d] focus:bg-[#13131c] text-sm text-white placeholder-slate-400 rounded-xl pl-10 pr-10 py-2.5 border border-[#2a2a3c] focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff] transition-all focus:outline-none shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Zone 3: Navigation Links & Actions */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <nav className="hidden lg:flex items-center gap-1">
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
                  className={`text-xs font-extrabold uppercase tracking-wider transition-all px-3 py-2 rounded-lg border ${
                    isActive 
                      ? 'text-[#00f0ff] bg-[#00f0ff]/10 border-[#00f0ff]/30 shadow-sm' 
                      : 'text-slate-300 hover:text-white border-transparent hover:bg-[#1a1a26]'
                  }`}
                >
                  {tab.label}
                  {tab.id === 'chat' && onlineCount > 0 && (
                    <span className="ml-1.5 bg-[#00f0ff] text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-md">
                      {onlineCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Quick Action Icons */}
          <div className="flex items-center gap-1.5 border-l border-[#242436] pl-2 sm:pl-3">
            <button
              type="button"
              onClick={onRandomGame}
              className="p-2 text-slate-400 hover:text-[#00f0ff] hover:bg-[#1a1a26] rounded-lg transition-all cursor-pointer"
              title="Surprise / Shuffle"
            >
              <Shuffle className="w-4 h-4" />
            </button>
            
            <button
              type="button"
              onClick={onToggleFavoritesOnly}
              className={`p-2 rounded-lg transition-all cursor-pointer ${
                showFavoritesOnly 
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                  : 'text-slate-400 hover:text-rose-400 hover:bg-[#1a1a26]'
              }`}
              title="Saved Collection"
            >
              <Heart className={`w-4 h-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
            </button>

            {onOpenThemeSelector && (
              <button
                type="button"
                onClick={onOpenThemeSelector}
                className="p-2 rounded-lg text-slate-400 hover:text-[#00f0ff] hover:bg-[#1a1a26] transition-all cursor-pointer"
                title="Theme Customizer"
              >
                <Palette className="w-4 h-4" />
              </button>
            )}
          </div>

        </div>

      </div>
    </header>
  );
};
