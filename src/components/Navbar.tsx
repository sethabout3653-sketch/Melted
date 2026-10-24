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
  Sun,
  Moon,
  Flame
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CloakPreset } from '../hooks/useCloak';
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
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onOpenFirebase?: () => void;
  firebaseUser?: any;
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
  theme = 'light',
  onToggleTheme,
  onOpenFirebase,
  firebaseUser,
}) => {
  const [isCloakOpen, setIsCloakOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cloakDropdownRef = useRef<HTMLDivElement>(null);

  return (
    <header className="sticky top-0 z-50 w-full bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 shrink-0 shadow-sm transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-12">
        
        {/* Zone 1: Brand */}
        <div className="flex items-center gap-8 shrink-0">
          <button 
            type="button"
            onClick={() => {
              onTabChange('games');
              onGoHome();
            }}
            className="flex items-center gap-2 group cursor-pointer focus:outline-none"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Snowflake className="w-6 h-6 text-white fill-none" />
            </div>
            <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white font-heading">
              Frosted
            </span>
          </button>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-6">
            <button 
              type="button"
              onClick={() => onTabChange('games')}
              className={`text-sm font-bold transition-all px-4 py-2 rounded-xl border ${currentTab === 'games' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-transparent hover:border-slate-100 dark:hover:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
            >
              Games
            </button>
            <button 
              type="button"
              onClick={() => onTabChange('chat')}
              className={`text-sm font-bold transition-all flex items-center gap-2 px-4 py-2 rounded-xl border ${currentTab === 'chat' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-transparent hover:border-slate-100 dark:hover:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
            >
              Community
              {onlineCount > 0 && (
                <span className="bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] px-1.5 py-0.5 rounded-full border border-blue-100 dark:border-blue-800">
                  {onlineCount}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Zone 2: Search (Integrated) */}
        <div className="flex-1 max-w-xl hidden lg:block">
          <div className="relative group">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                if (currentTab !== 'games') onTabChange('games');
                onSearchChange(e.target.value);
              }}
              placeholder="Search 1,000+ premium titles..."
              className="w-full bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder-slate-400 rounded-2xl pl-12 pr-12 py-3 border border-slate-100 dark:border-slate-800 focus:border-blue-200 dark:focus:border-blue-700 transition-all focus:outline-none shadow-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2 pr-4 border-r border-slate-100 dark:border-slate-800 hidden sm:flex">
            <button
              type="button"
              onClick={onRandomGame}
              className="p-2.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all cursor-pointer border border-transparent hover:border-blue-100 dark:hover:border-blue-800"
              title="Surprise Me"
            >
              <Shuffle className="w-5 h-5" />
            </button>
            
            <button
              type="button"
              onClick={onToggleFavoritesOnly}
              className={`p-2.5 rounded-xl transition-all cursor-pointer border ${
                showFavoritesOnly ? 'bg-red-50 dark:bg-red-900/30 text-red-500 border-red-100 dark:border-red-800' : 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border-transparent hover:border-red-100 dark:hover:border-red-800'
              }`}
              title="Saved Games"
            >
              <Heart className={`w-5 h-5 ${showFavoritesOnly ? 'fill-current' : ''}`} />
            </button>

            {/* Theme Toggle Button */}
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className="p-2.5 rounded-xl transition-all cursor-pointer border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-800"
                title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              >
                {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
              </button>
            )}

            {/* Firebase Cloud Engine Button */}
            {onOpenFirebase && (
              <button
                type="button"
                onClick={onOpenFirebase}
                className={`p-2.5 rounded-xl transition-all cursor-pointer border flex items-center gap-1.5 ${
                  firebaseUser 
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 shadow-sm' 
                    : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 border-transparent hover:border-amber-100 dark:hover:border-amber-800'
                }`}
                title={firebaseUser ? `Firebase: ${firebaseUser.displayName || firebaseUser.email || 'Connected'}` : "Firebase Cloud Sync"}
              >
                <Flame className={`w-5 h-5 ${firebaseUser ? 'fill-current text-amber-500' : ''}`} />
                <span className="hidden xl:inline text-xs font-bold">
                  {firebaseUser ? 'Cloud' : 'Firebase'}
                </span>
                {firebaseUser && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </button>
            )}
          </div>

          <div className="relative" ref={cloakDropdownRef}>
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsCloakOpen(!isCloakOpen)}
              className="bg-slate-900 dark:bg-blue-600 hover:bg-black dark:hover:bg-blue-700 text-white px-6 py-3 rounded-2xl text-sm font-black shadow-xl shadow-slate-900/10 transition-all cursor-pointer flex items-center gap-2 border border-slate-800 dark:border-blue-500"
            >
              <EyeOff className="w-4 h-4" />
              <span>Cloak</span>
            </motion.button>

            <AnimatePresence>
              {isCloakOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className="absolute right-0 mt-3 w-72 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] p-3 z-50 overflow-hidden"
                >
                  <div className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 border-b border-slate-50 dark:border-slate-800 mb-2">
                    Tab Displacement
                  </div>
                  <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-1">
                    {presets.map((preset) => {
                      const isSelected = preset.id === activePreset;
                      return (
                        <button
                          type="button"
                          key={preset.id}
                          onClick={() => {
                            onSelectPreset(preset.id);
                            setIsCloakOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-xs text-left rounded-xl transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <img 
                            src={preset.favicon || undefined} 
                            alt="" 
                            className="w-5 h-5 rounded-md object-contain bg-white p-0.5 shadow-sm"
                          />
                          <div className="truncate">
                            <div className="font-black tracking-tight">{preset.name}</div>
                            <div className={`text-[10px] truncate ${isSelected ? 'text-white/70' : 'text-slate-400 font-medium'}`}>
                              {preset.title}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>
    </header>
  );
};

