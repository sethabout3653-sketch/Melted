import React, { useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { Film, Gamepad2, Heart, LucideIcon, MessageSquare, Moon, Palette, Shuffle, Sparkles, Sun, Tv, X } from 'lucide-react';
import { FrostHubLogo } from './FrostHubLogo';

export type AppTab = 'games' | 'chat' | 'ai' | 'movies' | 'tv';

export interface NavigationProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onGoHome: () => void;
  onlineCount: number;
  showFavoritesOnly: boolean;
  onToggleFavoritesOnly: () => void;
  onRandomGame: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenThemeSelector: () => void;
}

const NAV_ITEMS: { id: AppTab; label: string; icon: LucideIcon }[] = [
  { id: 'games', label: 'Games', icon: Gamepad2 },
  { id: 'movies', label: 'Movies', icon: Film },
  { id: 'tv', label: 'Live TV', icon: Tv },
  { id: 'ai', label: 'AI Assistant', icon: Sparkles },
  { id: 'chat', label: 'Community', icon: MessageSquare },
];

interface NavLinksProps extends NavigationProps {
  onNavigate?: () => void;
  layoutGroupId: string;
}

const NavLinks: React.FC<NavLinksProps> = ({ currentTab, onTabChange, onlineCount, onNavigate, layoutGroupId }) => {
  const [hoveredId, setHoveredId] = useState<AppTab | null>(null);

  return (
    <LayoutGroup id={layoutGroupId}>
      <nav
        aria-label="Main navigation"
        onMouseLeave={() => setHoveredId(null)}
        className="flex flex-col gap-1.5"
      >
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = currentTab === id;
          const isHovered = hoveredId === id && !isActive;

          return (
            <button
              key={id}
              type="button"
              onMouseEnter={() => setHoveredId(id)}
              onClick={() => {
                onTabChange(id);
                onNavigate?.();
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`group relative flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:translate-x-1 active:scale-[0.98] cursor-pointer ${
                isActive
                  ? 'text-[var(--brand-blue)]'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              <AnimatePresence>
                {isHovered && (
                  <motion.span
                    layoutId="sidebar-hover-pill"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 36, mass: 0.7 }}
                    className="pointer-events-none absolute inset-0 rounded-xl bg-slate-100/90 dark:bg-white/[0.07]"
                  />
                )}
              </AnimatePresence>
              {isActive && (
                <motion.span
                  layoutId="sidebar-active-pill"
                  transition={{ type: 'spring', stiffness: 460, damping: 35, mass: 0.8 }}
                  className="pointer-events-none absolute inset-0 rounded-xl bg-[var(--brand-blue)]/12 ring-1 ring-inset ring-[var(--brand-blue)]/25"
                />
              )}
              <Icon
                className={`relative z-10 w-5 h-5 shrink-0 transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110 ${
                  isActive ? 'scale-105' : ''
                }`}
              />
              <span className="relative z-10 flex-1 text-left">{label}</span>
              {id === 'chat' && onlineCount > 0 && (
                <span className="relative z-10 bg-[var(--brand-blue)] text-slate-950 text-[11px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105">
                  {onlineCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </LayoutGroup>
  );
};

interface UtilityButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
}

const UtilityButton: React.FC<UtilityButtonProps> = ({ icon: Icon, label, onClick, active }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`group flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-medium transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:translate-x-1 active:scale-[0.98] cursor-pointer ${
      active
        ? 'bg-rose-500/15 text-rose-500 dark:text-rose-400'
        : 'text-slate-500 hover:bg-slate-100/90 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.07] dark:hover:text-white'
    }`}
  >
    <Icon className="w-4 h-4 shrink-0 transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110" />
    <span>{label}</span>
  </button>
);

const UtilityActions: React.FC<NavigationProps & { onNavigate?: () => void }> = ({
  showFavoritesOnly,
  onToggleFavoritesOnly,
  onRandomGame,
  theme,
  onToggleTheme,
  onOpenThemeSelector,
  onNavigate,
}) => (
  <div className="flex flex-col gap-1">
    <UtilityButton
      icon={Shuffle}
      label="Surprise me"
      onClick={() => {
        onRandomGame();
        onNavigate?.();
      }}
    />
    <UtilityButton icon={Heart} label="Saved games" active={showFavoritesOnly} onClick={onToggleFavoritesOnly} />
    <UtilityButton
      icon={theme === 'dark' ? Sun : Moon}
      label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      onClick={onToggleTheme}
    />
    <UtilityButton
      icon={Palette}
      label="Customize theme"
      onClick={() => {
        onOpenThemeSelector();
        onNavigate?.();
      }}
    />
  </div>
);

export const AppSidebar: React.FC<NavigationProps> = (props) => (
  <aside
    aria-label="Sidebar"
    className="hidden lg:flex flex-col w-[252px] shrink-0 h-full border-r border-slate-200/70 dark:border-white/[0.07] bg-white/70 dark:bg-[#0b1114]/90 backdrop-blur-xl transition-colors duration-200"
  >
    <div className="h-[76px] flex items-center px-6 shrink-0 border-b border-slate-200/70 dark:border-white/[0.06]">
      <button
        type="button"
        onClick={props.onGoHome}
        aria-label="Go to FrostHub home"
        className="cursor-pointer rounded-xl transition duration-200 hover:scale-[1.03] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]"
      >
        <FrostHubLogo size="md" />
      </button>
    </div>
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <p className="hub-eyebrow mb-3 px-3">Explore</p>
      <NavLinks {...props} layoutGroupId="desktop-sidebar-nav" />
    </div>
    <div className="px-4 py-5 border-t border-slate-200/70 dark:border-white/[0.06]">
      <p className="hub-eyebrow mb-3 px-3">Your space</p>
      <UtilityActions {...props} />
    </div>
  </aside>
);

interface MobileMenuProps extends NavigationProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose, ...nav }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        className="lg:hidden fixed inset-0 z-[500]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-black/50" />
        <motion.aside
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-y-0 left-0 w-72 max-w-[85vw] flex flex-col bg-white/95 dark:bg-[#0b1114]/98 backdrop-blur-2xl shadow-2xl"
        >
          <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 dark:border-white/10 shrink-0">
            <FrostHubLogo size="sm" />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 transition duration-150 active:scale-90 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <NavLinks {...nav} onNavigate={onClose} layoutGroupId="mobile-drawer-nav" />
          </div>
          <div className="px-3 py-3 border-t border-slate-200 dark:border-white/10 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <UtilityActions {...nav} onNavigate={onClose} />
          </div>
        </motion.aside>
      </motion.div>
    )}
  </AnimatePresence>
);
