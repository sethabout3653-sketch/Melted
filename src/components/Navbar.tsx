import React, { useState, useRef, useEffect } from 'react';
import { 
  Snowflake, 
  Search, 
  Shuffle, 
  EyeOff, 
  Heart, 
  X, 
  WifiOff, 
  Gamepad2, 
  MessageSquare,
  Zap
} from 'lucide-react';
import { CloakPreset } from '../hooks/useCloak';
import { PWAInstallButton } from './PWAInstallButton';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { GameCategory } from '../types/game';

interface NavbarProps {
  currentTab: 'games' | 'chat';
  onTabChange: (tab: 'games' | 'chat') => void;
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
  selectedCategory = 'All',
  onSelectCategory,
  onlineCount = 0,
  isConnected = false,
}) => {
  const [isCloakOpen, setIsCloakOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cloakDropdownRef = useRef<HTMLDivElement>(null);
  const isOnline = useOnlineStatus();

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
    <header className="sticky top-0 z-40 w-full bg-[#050505]/95 backdrop-blur-md border-b border-[#1f1f1f]">
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
            <div className="w-9 h-9 rounded-xl bg-[#0066ff] flex items-center justify-center shadow-lg shadow-[#0066ff]/25 group-hover:scale-105 transition-transform">
              <Snowflake className="w-5 h-5 text-white fill-none animate-spin-[spin_3s_linear_infinite]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-white font-heading group-hover:text-[#0066ff] transition-colors">
                  Frosted
                </span>
                {!isOnline && (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <WifiOff className="w-3 h-3" /> Offline
                  </span>
                )}
              </div>
            </div>
          </button>

          {/* Primary View Switcher: All Games vs Videos vs Chat */}
          <div className="hidden sm:flex items-center bg-[#121214] p-1 rounded-xl border border-[#222225] gap-0.5">
            <button
              onClick={() => {
                onTabChange('games');
                if (onSelectCategory) onSelectCategory('All');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentTab === 'games'
                  ? 'bg-[#0066ff] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>All Games</span>
            </button>



            <button
              onClick={() => onTabChange('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentTab === 'chat'
                  ? 'bg-[#0066ff] text-white shadow-sm'
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
              className="w-full bg-[#121214] hover:bg-[#161619] focus:bg-[#161619] text-sm text-zinc-100 placeholder-zinc-400 rounded-xl pl-10 pr-10 py-2 border border-[#222225] focus:border-[#0066ff] focus:outline-none focus:ring-1 focus:ring-[#0066ff] transition-all"
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
              <kbd className="hidden md:inline-block absolute right-3 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 bg-[#1c1c1f] rounded border border-[#2c2c30]">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Mobile Chat switcher button */}
          <button
            onClick={() => onTabChange(currentTab === 'chat' ? 'games' : 'chat')}
            className={`sm:hidden flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
              currentTab === 'chat'
                ? 'bg-[#0066ff] text-white border-[#0066ff] shadow-sm'
                : 'bg-[#121214] text-zinc-200 border-[#222225]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>

          {/* In-App PWA Install Prompt */}
          <PWAInstallButton />

          {/* Random Game */}
          <button
            onClick={() => {
              if (currentTab !== 'games') onTabChange('games');
              onRandomGame();
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-200 bg-[#121214] hover:bg-[#1c1c20] hover:text-[#0066ff] rounded-xl border border-[#222225] hover:border-[#0066ff]/40 transition-all cursor-pointer"
            title="Pick a random game"
          >
            <Shuffle className="w-3.5 h-3.5 text-[#0066ff]" />
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
                ? 'bg-[#0066ff] text-white font-bold border-[#0066ff] shadow-sm'
                : 'bg-[#121214] hover:bg-[#1c1c20] text-zinc-200 border-[#222225] hover:border-[#0066ff]/40'
            }`}
            title="Show saved favorites"
          >
            <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-white text-white' : 'text-[#0066ff]'}`} />
            <span className="hidden lg:inline">Saved</span>
            {favoritesCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                showFavoritesOnly ? 'bg-black/30 text-white' : 'bg-[#0066ff]/20 text-[#60a5fa]'
              }`}>
                {favoritesCount}
              </span>
            )}
          </button>

          {/* Tab Cloak Dropdown */}
          <div className="relative" ref={cloakDropdownRef}>
            <button
              onClick={() => setIsCloakOpen(!isCloakOpen)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-200 bg-[#121214] hover:bg-[#1c1c20] hover:text-[#0066ff] rounded-xl border border-[#222225] hover:border-[#0066ff]/40 transition-all cursor-pointer"
              title="Disguise browser tab"
            >
              <EyeOff className="w-3.5 h-3.5 text-zinc-300" />
              <span className="hidden sm:inline">Cloak</span>
            </button>

            {isCloakOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-[#111113] border border-[#262629] rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400 border-b border-[#222226]">
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
                            ? 'bg-[#0066ff] text-white font-bold' 
                            : 'text-zinc-300 hover:bg-[#1a1a1d]'
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
