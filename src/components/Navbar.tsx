import React, { useState, useEffect } from 'react';
import { Menu, Search, X } from 'lucide-react';
import { FrostHubLogo } from './FrostHubLogo';
import { AppTab } from './AppSidebar';

interface NavbarProps {
  currentTab: AppTab;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onGoHome: () => void;
  onOpenMenu: () => void;
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
        placeholder="What are you in the mood for?"
        className="w-full bg-slate-100 hover:bg-slate-200/70 focus:bg-white dark:bg-[#181824] dark:hover:bg-[#1e1e2d] dark:focus:bg-[#13131c] text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 rounded-xl pl-10 pr-10 py-2.5 border border-slate-200 dark:border-[#2a2a3c] focus:border-[var(--brand-blue)] focus:ring-1 focus:ring-[var(--brand-blue)] transition-colors duration-150 focus:outline-none shadow-inner"
      />
      {localVal && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
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
  searchQuery,
  onSearchChange,
  onGoHome,
  onOpenMenu,
}) => {
  const isVisible = currentTab === 'games';

  return (
    <header className="sticky top-0 z-50 w-full shrink-0 text-slate-900 dark:text-white">
      <div
        className={`grid transition-[grid-template-rows,opacity,visibility] duration-300 ease-in-out ${
          isVisible ? 'grid-rows-[1fr] opacity-100 visible' : 'grid-rows-[0fr] opacity-0 invisible'
        }`}
      >
        <div className="min-h-0 overflow-hidden bg-white/95 dark:bg-[#070d1a]/95 border-b border-slate-200/70 dark:border-white/10 transition-colors">
          <div className="h-14 lg:h-[4.25rem] px-3 sm:px-6 lg:px-8 flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={onOpenMenu}
              aria-label="Open menu"
              className="lg:hidden min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5 cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={onGoHome}
              aria-label="Go to FrostHub home"
              className="lg:hidden shrink-0 cursor-pointer rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]"
            >
              <FrostHubLogo size="sm" />
            </button>

            <div className="flex-1 min-w-0 max-w-3xl">
              {isVisible && (
                <NavSearchInput searchQuery={searchQuery} onSearchChange={onSearchChange} />
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
});
