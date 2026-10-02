import React, { useState, useRef, useEffect } from 'react';
import { 
  Flame, 
  Search, 
  Shuffle, 
  ShieldAlert, 
  EyeOff, 
  Heart,
  X,
  WifiOff,
  Gamepad2,
  MessageSquare
} from 'lucide-react';
import { CloakPreset } from '../hooks/useCloak';
import { PWAInstallButton } from './PWAInstallButton';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

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
  panicKey: string;
  onTriggerPanic: () => void;
  totalGames: number;
  onGoHome: () => void;
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
  panicKey,
  onTriggerPanic,
  onGoHome,
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
        
        {/* Brand Zone - Clean human UI without any repetitive tags */}
        <div className="flex items-center gap-4 shrink-0">
          <button 
            onClick={() => {
              onTabChange('games');
              onGoHome();
            }}
            className="flex items-center gap-2.5 group cursor-pointer text-left focus:outline-none"
            title="Go to Home"
          >
            <div className="w-9 h-9 rounded-xl bg-[#ff5500] flex items-center justify-center shadow-lg shadow-[#ff5500]/25 group-hover:scale-105 transition-transform">
              <Flame className="w-5 h-5 text-black fill-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-white font-heading group-hover:text-[#ff5500] transition-colors">
                  MELTED
                </span>
                {!isOnline && (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <WifiOff className="w-3 h-3" /> Offline
                  </span>
                )}
              </div>
              <div className="text-[11px] text-zinc-400 font-medium -mt-0.5">
                840+ Unblocked Games
              </div>
            </div>
          </button>

          {/* Primary View Switcher: Games vs Discord Chat */}
          <div className="hidden sm:flex items-center bg-[#121214] p-1 rounded-xl border border-[#222225]">
            <button
              onClick={() => onTabChange('games')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentTab === 'games'
                  ? 'bg-[#ff5500] text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>Games</span>
            </button>

            <button
              onClick={() => onTabChange('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentTab === 'chat'
                  ? 'bg-[#ff5500] text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
            </button>
          </div>
        </div>

        {/* Search Bar Zone (Visible when in Games tab, or switches to games on search) */}
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
              placeholder="Search 840+ games... (Press '/')"
              className="w-full bg-[#121214] hover:bg-[#161619] focus:bg-[#161619] text-sm text-zinc-100 placeholder-zinc-400 rounded-xl pl-10 pr-10 py-2 border border-[#222225] focus:border-[#ff5500] focus:outline-none focus:ring-1 focus:ring-[#ff5500] transition-all"
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
            onClick={() => onTabChange(currentTab === 'games' ? 'chat' : 'games')}
            className={`sm:hidden flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
              currentTab === 'chat'
                ? 'bg-[#ff5500] text-black border-[#ff5500] shadow-sm'
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
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-200 bg-[#121214] hover:bg-[#1c1c20] hover:text-[#ff5500] rounded-xl border border-[#222225] hover:border-[#ff5500]/40 transition-all cursor-pointer"
            title="Pick a random game"
          >
            <Shuffle className="w-3.5 h-3.5 text-[#ff5500]" />
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
                ? 'bg-[#ff5500] text-black font-bold border-[#ff5500] shadow-sm'
                : 'bg-[#121214] hover:bg-[#1c1c20] text-zinc-200 border-[#222225] hover:border-[#ff5500]/40'
            }`}
            title="Show saved favorites"
          >
            <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-black text-black' : 'text-[#ff5500]'}`} />
            <span className="hidden lg:inline">Saved</span>
            {favoritesCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                showFavoritesOnly ? 'bg-black/30 text-black' : 'bg-[#ff5500]/20 text-[#ff5500]'
              }`}>
                {favoritesCount}
              </span>
            )}
          </button>

          {/* Tab Cloak Dropdown */}
          <div className="relative" ref={cloakDropdownRef}>
            <button
              onClick={() => setIsCloakOpen(!isCloakOpen)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-200 bg-[#121214] hover:bg-[#1c1c20] hover:text-[#ff5500] rounded-xl border border-[#222225] hover:border-[#ff5500]/40 transition-all cursor-pointer"
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
                            ? 'bg-[#ff5500] text-black font-bold' 
                            : 'text-zinc-300 hover:bg-[#1a1a1d]'
                        }`}
                      >
                        <img 
                          src={preset.favicon} 
                          alt="" 
                          className="w-4 h-4 rounded-sm object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="truncate">
                          <div className="truncate">{preset.name}</div>
                          <div className={`text-[10px] truncate ${isSelected ? 'text-black/80' : 'text-zinc-400'}`}>
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

          {/* Panic Key Button: Direct escape action */}
          <button
            onClick={onTriggerPanic}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#ff6611] bg-[#ff5500]/10 hover:bg-[#ff5500]/20 rounded-xl border border-[#ff5500]/30 hover:border-[#ff5500]/60 transition-all cursor-pointer group"
            title={`Panic Button: Click or press [${panicKey}] to escape immediately`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-[#ff5500] group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">Panic</span>
            <kbd className="px-1 py-0.2 bg-[#ff5500]/20 text-[#ff7722] rounded text-[10px] font-mono border border-[#ff5500]/40">
              {panicKey}
            </kbd>
          </button>

        </div>

      </div>
    </header>
  );
};
