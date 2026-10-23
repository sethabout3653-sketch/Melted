import React from 'react';
import { Gamepad2, MessageSquare, Heart, Shuffle, Music } from 'lucide-react';
import { DeviceAdaptationInfo } from '../hooks/useDeviceAdaptation';

interface DeviceAdaptationBarProps {
  deviceInfo: DeviceAdaptationInfo;
  currentTab: 'games' | 'music' | 'chat';
  onTabChange: (tab: 'games' | 'music' | 'chat') => void;
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
          className="fixed bottom-0 inset-x-0 z-40 bg-[var(--bg-navy)]/95 backdrop-blur-xl border-t border-[var(--bg-navy)] px-3 py-2 flex items-center justify-around pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl"
        >
          {/* Games Tab */}
          <button
            onClick={() => onTabChange('games')}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-xl transition-all ${
              currentTab === 'games' && !showFavoritesOnly
                ? 'text-[var(--vibrant-cyan)] font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Gamepad2 className="w-5 h-5" />
            <span className="text-[10px] tracking-tight">Games</span>
          </button>

          {/* Music Tab (Spotify / YouTube Music) */}
          <button
            onClick={() => onTabChange('music')}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-xl transition-all ${
              currentTab === 'music'
                ? 'text-purple-400 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Music className="w-5 h-5" />
            <span className="text-[10px] tracking-tight">Music</span>
          </button>

          {/* Chat Tab with Live Activity Indicator */}
          <button
            onClick={() => onTabChange('chat')}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-xl relative transition-all ${
              currentTab === 'chat'
                ? 'text-[var(--vibrant-cyan)] font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <div className="relative">
              <MessageSquare className="w-5 h-5" />
              {onlineCount > 0 && (
                <span className={`absolute -top-1 -right-2 px-1 py-0.2 rounded-full text-[9px] font-black ${
                  isConnected ? 'bg-blue-600 text-white' : 'bg-red-500 text-white'
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
            className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-xl transition-all ${
              showFavoritesOnly
                ? 'text-[var(--vibrant-cyan)] font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <div className="relative">
              <Heart className={`w-5 h-5 ${showFavoritesOnly ? 'fill-[var(--vibrant-cyan)]' : ''}`} />
              {favoritesCount > 0 && (
                <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full bg-blue-600/30 text-blue-400 text-[9px] font-black border border-blue-500/30">
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
            className="flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-xl text-zinc-400 hover:text-[var(--vibrant-cyan)] transition-all"
          >
            <Shuffle className="w-5 h-5" />
            <span className="text-[10px] tracking-tight">Surprise</span>
          </button>
        </nav>
      )}
    </>
  );
};

