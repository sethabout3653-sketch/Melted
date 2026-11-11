import React, { useRef, useState, useEffect } from 'react';
import { 
  Search, 
  Shuffle, 
  Heart, 
  X, 
  Palette,
  Phone,
  Video,
  Users,
  Check,
  ChevronDown
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
  users?: any[];
  currentUser?: any;
  onOpenThemeSelector?: () => void;
  onStartCall?: (user: any) => void;
  onStartVideoCall?: (user: any) => void;
  onStartGroupCall?: (users: any[]) => void;
}

interface NavSearchInputProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onTabChange: (tab: 'games' | 'chat' | 'ai' | 'movies' | 'tv') => void;
  currentTab: string;
}

const NavSearchInput: React.FC<NavSearchInputProps> = React.memo(({
  searchQuery,
  onSearchChange,
  onTabChange,
  currentTab,
}) => {
  const [localVal, setLocalVal] = useState(searchQuery);

  useEffect(() => {
    setLocalVal(searchQuery);
  }, [searchQuery]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalVal(val);
    if (currentTab !== 'games') onTabChange('games');
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
        placeholder="Search titles..."
        className="w-full bg-[#181824] hover:bg-[#1e1e2d] focus:bg-[#13131c] text-sm text-white placeholder-slate-400 rounded-xl pl-10 pr-10 py-2.5 border border-[#2a2a3c] focus:border-[var(--brand-blue)] focus:ring-1 focus:ring-[var(--brand-blue)] transition-colors duration-150 focus:outline-none shadow-inner"
      />
      {localVal && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
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
  users = [],
  currentUser,
  onStartCall,
  onStartVideoCall,
  onStartGroupCall,
}) => {
  const [isCallMenuOpen, setIsCallMenuOpen] = useState(false);
  const [callMode, setCallMode] = useState<'audio' | 'video' | 'group'>('audio');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const callableUsers = users.filter((user) => user.id !== currentUser?.id && user.status !== 'offline');
  const selectedGroupUsers = callableUsers.filter((user) => selectedGroupIds.includes(user.id));

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
            <FrostHubLogo size="md" className="transition-transform group-hover:scale-105" />
          </button>
        </div>

        {/* Zone 2: Central Search Bar */}
        <div className="flex-1 max-w-xl mx-1 sm:mx-4">
          <NavSearchInput
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            onTabChange={onTabChange}
            currentTab={currentTab}
          />
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
                      ? 'text-[var(--brand-blue)] bg-[var(--brand-blue)]/10 border-[var(--brand-blue)]/30 shadow-sm' 
                      : 'text-slate-300 hover:text-white border-transparent hover:bg-[#1a1a26]'
                  }`}
                >
                  {tab.label}
                  {tab.id === 'chat' && onlineCount > 0 && (
                    <span className="ml-1.5 bg-[var(--brand-blue)] text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-md">
                      {onlineCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Quick Action Icons */}
          <div className="flex items-center gap-1.5 border-l border-[#242436] pl-2 sm:pl-3">
            {onStartCall && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCallMenuOpen((open) => !open)}
                  className={`flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold transition-all ${isCallMenuOpen ? 'bg-[var(--brand-blue)]/15 text-[var(--brand-blue)]' : 'text-slate-400 hover:bg-[#1a1a26] hover:text-[var(--brand-blue)]'}`}
                  title="Call someone online"
                  aria-expanded={isCallMenuOpen}
                  aria-haspopup="menu"
                >
                  <Phone className="h-4 w-4" />
                  <span className="hidden xl:inline">Call</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
                {isCallMenuOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-[#2a2a3c] bg-[#12121b] p-2 shadow-2xl" role="menu">
                    <div className="mb-2 grid grid-cols-3 gap-1 rounded-lg bg-white/5 p-1">
                      {([['audio', Phone, 'Voice'], ['video', Video, 'Video'], ['group', Users, 'Group']] as const).map(([mode, Icon, label]) => (
                        <button key={mode} type="button" onClick={() => setCallMode(mode)} className={`flex flex-col items-center gap-1 rounded-md px-1 py-1.5 text-[10px] font-semibold ${callMode === mode ? 'bg-[var(--brand-blue)]/15 text-[var(--brand-blue)]' : 'text-slate-400 hover:text-white'}`}>
                          <Icon className="h-3.5 w-3.5" />{label}
                        </button>
                      ))}
                    </div>
                    <div className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">{callMode === 'group' ? 'Select people' : 'Online people'}</div>
                    {callableUsers.length === 0 ? (
                      <div className="px-2 py-3 text-xs text-slate-500">No one else is online.</div>
                    ) : callableUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          if (callMode === 'group') {
                            setSelectedGroupIds((ids) => ids.includes(user.id) ? ids.filter((id) => id !== user.id) : [...ids, user.id]);
                          } else {
                            (callMode === 'video' ? onStartVideoCall : onStartCall)?.(user);
                            setIsCallMenuOpen(false);
                          }
                        }}
                        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/10"
                      >
                        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{user.username || user.display_name || 'Online user'}</span>
                        {callMode === 'group' ? (selectedGroupIds.includes(user.id) ? <Check className="h-3.5 w-3.5 text-[var(--brand-blue)]" /> : <span className="h-4 w-4 rounded border border-white/30" />) : callMode === 'video' ? <Video className="h-3.5 w-3.5 text-[var(--brand-blue)]" /> : <Phone className="h-3.5 w-3.5 text-[var(--brand-blue)]" />}
                      </button>
                    ))}
                    {callMode === 'group' && (
                      <button type="button" disabled={selectedGroupUsers.length === 0} onClick={() => { onStartGroupCall?.(selectedGroupUsers); setSelectedGroupIds([]); setIsCallMenuOpen(false); }} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand-blue)] px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-[var(--brand-blue-hover)] disabled:cursor-not-allowed disabled:opacity-40">
                        <Users className="h-3.5 w-3.5" /> Group Call ({selectedGroupUsers.length})
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={onRandomGame}
              className="p-2 text-slate-400 hover:text-[var(--brand-blue)] hover:bg-[#1a1a26] rounded-lg transition-all cursor-pointer"
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
                className="p-2 rounded-lg text-slate-400 hover:text-[var(--brand-blue)] hover:bg-[#1a1a26] transition-all cursor-pointer"
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
});

