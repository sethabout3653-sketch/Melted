import React from 'react';
import { Gamepad2, MessageSquare, Heart, Shuffle } from 'lucide-react';
import { DeviceAdaptationInfo } from '../hooks/useDeviceAdaptation';

interface DeviceAdaptationBarProps {
  deviceInfo: DeviceAdaptationInfo;
  currentTab: 'games' | 'chat';
  onTabChange: (tab: 'games' | 'chat') => void;
  favoritesCount: number;
  showFavoritesOnly: boolean;
  onToggleFavoritesOnly: () => void;
  onRandomGame: () => void;
  onlineCount?: number;
  isConnected?: boolean;
}

export const DeviceAdaptationBar: React.FC<DeviceAdaptationBarProps> = ({
  deviceInfo,
  currentTab,
  onTabChange,
  favoritesCount,
  showFavoritesOnly,
  onToggleFavoritesOnly,
  onRandomGame,
  onlineCount = 0,
  isConnected = false,
}) => {
  const { isMobile } = deviceInfo;

  return (
    <>
      {/* Mobile Ergonomic Bottom Navigation Bar */}
      {isMobile && (
        <nav 
          aria-label="Mobile Navigation"
          className="fixed bottom-0 inset-x-0 z-40 bg-[#0a1128]/95 backdrop-blur-xl border-t border-white/10 px-3 py-2 flex items-center justify-around pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl"
        >
          {/* Games Tab */}
          <button
            onClick={() => onTabChange('games')}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-xl transition-all border ${
              currentTab === 'games' && !showFavoritesOnly
                ? 'text-[var(--brand-blue)] font-bold border-[var(--brand-blue)]/20 bg-[var(--brand-blue)]/5'
                : 'text-zinc-400 hover:text-white border-transparent'
            }`}
          >
            <Gamepad2 className="w-5 h-5" />
            <span className="text-[10px] tracking-tight">Games</span>
          </button>

          {/* Chat Tab with Live Activity Indicator */}
          <button
            onClick={() => onTabChange('chat')}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-xl relative transition-all border ${
              currentTab === 'chat'
                ? 'text-[var(--brand-blue)] font-bold border-[var(--brand-blue)]/20 bg-[var(--brand-blue)]/5'
                : 'text-zinc-400 hover:text-white border-transparent'
            }`}
          >
            <div className="relative">
              <MessageSquare className="w-5 h-5" />
              {onlineCount > 0 && (
                <span className={`absolute -top-1 -right-2 px-1 py-0.2 rounded-sm text-[9px] font-black border border-white/20 ${
                  isConnected ? 'bg-[var(--brand-blue)] text-white' : 'bg-red-500 text-white'
                }`}>
                  {onlineCount}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight">Chat</span>
          </button>

          {/* Saved / Favorites */}
          <button
            onClick={() => {
              if (currentTab !== 'games') onTabChange('games');
              onToggleFavoritesOnly();
            }}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-xl transition-all border ${
              showFavoritesOnly
                ? 'text-[var(--brand-blue)] font-bold border-[var(--brand-blue)]/20 bg-[var(--brand-blue)]/5'
                : 'text-zinc-400 hover:text-white border-transparent'
            }`}
          >
            <div className="relative">
              <Heart className={`w-5 h-5 ${showFavoritesOnly ? 'fill-[var(--brand-blue)]' : ''}`} />
              {favoritesCount > 0 && (
                <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-sm bg-[var(--brand-blue)]/30 text-[var(--brand-blue)] text-[9px] font-black border border-[var(--brand-blue)]/30">
                  {favoritesCount}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight">Saved</span>
          </button>

          {/* Surprise Game */}
          <button
            onClick={() => {
              if (currentTab !== 'games') onTabChange('games');
              onRandomGame();
            }}
            className="flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-xl text-zinc-400 hover:text-[var(--brand-blue)] transition-all border border-transparent hover:border-white/10"
          >
            <Shuffle className="w-5 h-5" />
            <span className="text-[10px] tracking-tight">Surprise</span>
          </button>
        </nav>
      )}
    </>
  );
};
