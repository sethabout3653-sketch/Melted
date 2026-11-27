import React, { useState, useEffect } from 'react';
import { Menu, Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { FrostHubLogo } from './FrostHubLogo';
import { AppTab } from './AppSidebar';
import { LibrarySelector } from './LibrarySelector';
import { GameLibrarySelection } from '../types/game';

interface NavbarProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedLibrary: GameLibrarySelection;
  onSelectLibrary: (lib: GameLibrarySelection) => void;
  onGoHome: () => void;
  onOpenMenu: () => void;
}

const TAB_CONTEXT: Record<AppTab, { title: string; description: string }> = {
  games: { title: 'Discover', description: 'Your next favorite starts here' },
  movies: { title: 'Movies & series', description: 'A little something for tonight' },
  tv: { title: 'Live television', description: 'Find a channel and tune in' },
  ai: { title: 'AI assistant', description: 'Ask a question or explore an idea' },
  chat: { title: 'Community', description: 'Your people, all in one place' },
};

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
      <Search className="w-4 h-4 text-[var(--brand-blue)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-focus-within:scale-110" />
      <input
        type="text"
        value={localVal}
        onChange={handleChange}
        placeholder="Search games..."
        className="w-full bg-slate-100 hover:bg-slate-200/70 focus:bg-white dark:bg-[#181824] dark:hover:bg-[#1e1e2d] dark:focus:bg-[#13131c] text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 rounded-xl pl-10 pr-10 py-2.5 border border-slate-200 dark:border-[#2a2a3c] focus:border-[var(--brand-blue)] focus:ring-1 focus:ring-[var(--brand-blue)] transition-[background-color,border-color,box-shadow] duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] focus:outline-none shadow-inner"
      />
      <AnimatePresence>
        {localVal && (
          <motion.button
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.75 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
});

export const Navbar: React.FC<NavbarProps> = React.memo(({
  currentTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  selectedLibrary,
  onSelectLibrary,
  onGoHome,
  onOpenMenu,
}) => {
  const isGames = currentTab === 'games';

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-50 w-full shrink-0 text-slate-900 dark:text-white"
    >
      <div className="hub-glass-header text-slate-900 dark:text-white transition-colors duration-200">
        <div className="h-[60px] lg:h-[72px] px-3 sm:px-6 lg:px-8 flex items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open menu"
            className="lg:hidden min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10 transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-95 cursor-pointer shrink-0 touch-manipulation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onGoHome}
            aria-label="Go to FrostHub home"
            className="lg:hidden shrink-0 cursor-pointer rounded-xl transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.03] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]"
          >
            <FrostHubLogo size="sm" />
          </button>

          {isGames ? (
            <motion.div
              key="navbar-search-zone"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 min-w-0 max-w-4xl flex items-center gap-2 sm:gap-2.5"
            >
              <div className="flex-1 min-w-0">
                <NavSearchInput searchQuery={searchQuery} onSearchChange={onSearchChange} />
              </div>
              <LibrarySelector selectedLibrary={selectedLibrary} onSelectLibrary={onSelectLibrary} />
            </motion.div>
          ) : (
            <div className="flex min-w-0 flex-1 flex-col justify-center lg:flex">
              <span className="hub-eyebrow hidden sm:block">{TAB_CONTEXT[currentTab].description}</span>
              <h1 className="truncate text-sm font-bold tracking-tight text-slate-900 dark:text-white sm:mt-1 sm:text-lg">{TAB_CONTEXT[currentTab].title}</h1>
            </div>
          )}
        </div>
      </div>
    </motion.header>
  );
});
