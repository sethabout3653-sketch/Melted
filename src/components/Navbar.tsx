import React, { useState, useRef, useEffect } from 'react';
import { 
  Snowflake, 
  Search, 
  Shuffle, 
  EyeOff, 
  Heart, 
  X, 
  Gamepad2, 
  MessageSquare,
  Music
} from 'lucide-react';
import { CloakPreset } from '../hooks/useCloak';
import { GameCategory } from '../types/game';

interface NavbarProps {
  currentTab: 'games' | 'music' | 'chat';
  onTabChange: (tab: 'games' | 'music' | 'chat') => void;
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
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  onRandomGame,
  favoritesCount,
  showFavoritesOnly,
  onToggleFavoritesOnly,
  activePreset,
  presets,
  onSelectPreset,
  onGoHome,
  onlineCount = 0,
  isConnected = false,
}) => {
  const [isCloakOpen, setIsCloakOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cloakDropdownRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === '/' || (e.ctrlKey && e.key === 'k')) && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        onTabChange('games');
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTabChange]);

  // Close cloak dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cloakDropdownRef.current && !cloakDropdownRef.current.contains(e.target as Node)) {
        setIsCloakOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0a1128]/95 backdrop-blur-md border-b border-[#1e293b] shrink-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Brand Zone */}
        <div className="flex items-center gap-4 shrink-0">
          <button 
            onClick={() => {
              onTabChange('games');
              onGoHome();
            }}
            className="flex items-center gap-2.5 group cursor-pointer text-left focus:outline-none"
            title="Go to Home"
          >
            <div className="w-9 h-9 rounded-xl bg-[var(--vibrant-cyan)] flex items-center justify-center shadow-lg shadow-[var(--vibrant-cyan)]/25 group-hover:scale-105 transition-transform">
              <Snowflake className="w-5 h-5 text-black fill-none animate-spin-[spin_3s_linear_infinite]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-white font-heading group-hover:text-[var(--vibrant-cyan)] transition-colors">
                  Frosted
                </span>
              </div>
            </div>
          </button>

          {/* Primary View Switcher: All Games vs Chat */}
          <div className="hidden sm:flex items-center bg-[#000000] p-1 rounded-xl border border-[#1e293b] gap-0.5">
            <button
              onClick={() => onTabChange('games')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentTab === 'games'
                  ? 'bg-[var(--vibrant-cyan)] text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>All Games</span>
            </button>

            <button
              onClick={() => onTabChange('music')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentTab === 'music'
                  ? 'bg-[var(--vibrant-cyan)] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>Music</span>
            </button>

            <button
              onClick={() => onTabChange('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentTab === 'chat'
                  ? 'bg-[var(--vibrant-cyan)] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
              {onlineCount > 0 && (
                <div className="flex items-center gap-1 ml-1 pl-1.5 border-l border-white/20">
                  <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-blue-400 shadow-[0_0_5px_rgba(96,165,250,0.5)]' : 'bg-red-400'}`} />
                  <span className="text-[10px] font-black">{onlineCount}</span>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Search Bar Zone */}
        <div className="flex-1 max-w-md mx-2">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                if (currentTab !== 'games') onTabChange('games');
                onSearchChange(e.target.value);
              }}
              placeholder="what are we going to play"
              className="w-full bg-[var(--bg-navy)] hover:bg-[var(--bg-navy)] focus:bg-[var(--bg-navy)] text-sm text-zinc-100 placeholder-zinc-400 rounded-xl pl-10 pr-10 py-2 border border-[var(--bg-navy)] focus:border-[var(--vibrant-cyan)] focus:outline-none focus:ring-1 focus:ring-[var(--vibrant-cyan)] transition-all"
            />
            {searchQuery ? (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 p-1 text-zinc-400 hover:text-white rounded-full transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="hidden md:inline-block absolute right-3 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 bg-[var(--bg-navy)] rounded border border-[var(--bg-navy)]">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Mobile Chat switcher button */}
          <button
            onClick={() => onTabChange(currentTab === 'games' ? 'chat' : 'games')}
            className={`sm:hidden flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
              currentTab === 'chat'
                ? 'bg-[var(--vibrant-cyan)] text-white border-[var(--vibrant-cyan)] shadow-sm'
                : 'bg-[var(--bg-navy)] text-zinc-200 border-[var(--bg-navy)]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>

          {/* Random Game */}
          <button
            onClick={() => {
              if (currentTab !== 'games') onTabChange('games');
              onRandomGame();
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-200 bg-[var(--bg-navy)] hover:bg-[var(--bg-navy)] hover:text-[var(--vibrant-cyan)] rounded-xl border border-[var(--bg-navy)] hover:border-[var(--vibrant-cyan)]/40 transition-all cursor-pointer"
            title="Pick a random game"
          >
            <Shuffle className="w-3.5 h-3.5 text-[var(--vibrant-cyan)]" />
            <span className="hidden lg:inline">Random</span>
          </button>

          {/* Favorites Filter */}
          <button
            onClick={() => {
              if (currentTab !== 'games') onTabChange('games');
              onToggleFavoritesOnly();
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
              showFavoritesOnly 
                ? 'bg-[var(--vibrant-cyan)] text-white font-bold border-[var(--vibrant-cyan)] shadow-sm'
                : 'bg-[var(--bg-navy)] hover:bg-[var(--bg-navy)] text-zinc-200 border-[var(--bg-navy)] hover:border-[var(--vibrant-cyan)]/40'
            }`}
            title="Show saved favorites"
          >
            <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-white text-white' : 'text-[var(--vibrant-cyan)]'}`} />
            <span className="hidden lg:inline">Saved</span>
            {favoritesCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                showFavoritesOnly ? 'bg-black/30 text-white' : 'bg-[var(--vibrant-cyan)]/20 text-[var(--bg-navy)]'
              }`}>
                {favoritesCount}
              </span>
            )}
          </button>

          {/* Tab Cloak Dropdown */}
          <div className="relative" ref={cloakDropdownRef}>
            <button
              onClick={() => setIsCloakOpen(!isCloakOpen)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-200 bg-[var(--bg-navy)] hover:bg-[var(--bg-navy)] hover:text-[var(--vibrant-cyan)] rounded-xl border border-[var(--bg-navy)] hover:border-[var(--vibrant-cyan)]/40 transition-all cursor-pointer"
              title="Disguise browser tab"
            >
              <EyeOff className="w-3.5 h-3.5 text-zinc-300" />
              <span className="hidden sm:inline">Cloak</span>
            </button>

            {isCloakOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-[var(--bg-navy)] border border-[var(--bg-navy)] rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400 border-b border-[var(--bg-navy)]">
                  Tab Camouflage
                </div>
                <div className="py-1 max-h-64 overflow-y-auto">
                  {presets.map((preset) => {
                    const isSelected = preset.id === activePreset;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => {
                          onSelectPreset(preset.id);
                          setIsCloakOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left rounded-xl transition-colors cursor-pointer ${
                          isSelected 
                            ? 'bg-[var(--vibrant-cyan)] text-white font-bold' 
                            : 'text-zinc-300 hover:bg-[var(--bg-navy)]'
                        }`}
                      >
                        <img 
                          src={preset.favicon || undefined} 
                          alt="" 
                          className="w-4 h-4 rounded-sm object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="truncate">
                          <div className="truncate">{preset.name}</div>
                          <div className={`text-[10px] truncate ${isSelected ? 'text-white/80' : 'text-zinc-400'}`}>
                            {preset.title}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </header>
  );
};
