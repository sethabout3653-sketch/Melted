import React from 'react';
import { Gamepad2, MessageSquare, Heart, Shuffle, Search, X } from 'lucide-react';
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
  const { isConsole, hasGamepad, gamepadName, isMobile } = deviceInfo;

  return (
    <>
      {/* Console & Controller HUD Prompts Bar */}
      {(isConsole || hasGamepad) && (
        <aside 
          aria-label="Controller Navigation Help"
          className="fixed top-16 inset-x-0 z-30 bg-[#0c0c10]/95 backdrop-blur-md border-b border-blue-500/30 px-4 py-1.5 flex items-center justify-between text-[11px] text-zinc-300 font-medium shadow-lg animate-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <Gamepad2 className="w-4 h-4 text-blue-400" />
            <span className="font-bold text-white">Console Controller Mode</span>
            {gamepadName && (
              <span className="hidden sm:inline text-zinc-400 truncate max-w-[200px]">
                ({gamepadName})
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 font-mono text-[10px] text-zinc-400 overflow-x-auto no-scrollbar">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-white font-bold">LB / RB</kbd> Tabs
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-blue-400 font-bold">A</kbd> Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-red-400 font-bold">B</kbd> Back
            </span>
            <span className="hidden sm:flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-blue-300 font-bold">X</kbd> Search
            </span>
            <span className="hidden md:flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-amber-400 font-bold">Y</kbd> Surprise
            </span>
          </div>
        </aside>
      )}

      {/* Mobile Ergonomic Bottom Navigation Bar */}
      {isMobile && (
        <nav 
          aria-label="Mobile Navigation"
          className="fixed bottom-0 inset-x-0 z-40 bg-[#070709]/95 backdrop-blur-xl border-t border-[#1c1c24] px-3 py-2 flex items-center justify-around pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl"
        >
          {/* Games Tab */}
          <button
            onClick={() => onTabChange('games')}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-xl transition-all ${
              currentTab === 'games' && !showFavoritesOnly
                ? 'text-[#0066ff] font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Gamepad2 className="w-5 h-5" />
            <span className="text-[10px] tracking-tight">Games</span>
          </button>

          {/* Chat Tab with Live Activity Indicator */}
          <button
            onClick={() => onTabChange('chat')}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-xl relative transition-all ${
              currentTab === 'chat'
                ? 'text-[#0066ff] font-bold'
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
                ? 'text-[#0066ff] font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <div className="relative">
              <Heart className={`w-5 h-5 ${showFavoritesOnly ? 'fill-[#0066ff]' : ''}`} />
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
            className="flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-xl text-zinc-400 hover:text-[#0066ff] transition-all"
          >
            <Shuffle className="w-5 h-5" />
            <span className="text-[10px] tracking-tight">Surprise</span>
          </button>
        </nav>
      )}
    </>
  );
};
