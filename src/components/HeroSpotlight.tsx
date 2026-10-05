import React, { useState } from 'react';
import { Play, Star, ExternalLink, Zap, ShieldCheck } from 'lucide-react';
import { GameItem } from '../types/game';

interface HeroSpotlightProps {
  featuredGames: GameItem[];
  onPlay: (game: GameItem) => void;
  onAboutBlank: (game: GameItem) => void;
}

export const HeroSpotlight: React.FC<HeroSpotlightProps> = ({
  featuredGames,
  onPlay,
  onAboutBlank,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (!featuredGames.length) return null;

  const activeGame = featuredGames[selectedIndex] || featuredGames[0];

  return (
    <div className="relative mb-8 overflow-hidden rounded-2xl bg-[#0e0e10] border border-[#222226] p-6 lg:p-8 shadow-2xl">
      {/* Background ambient blue glow */}
      <div className="absolute -top-24 right-1/4 w-96 h-96 bg-[#0066ff]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        
        {/* Left Column: Spotlight details */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Tag row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0066ff]/15 border border-[#0066ff]/30 text-[#60a5fa] text-xs font-bold uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5 fill-[#0066ff] text-[#0066ff]" /> Featured Title
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#18181b] border border-[#27272a] text-zinc-300 text-xs font-medium">
              Instant Play
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#18181b] border border-[#27272a] text-zinc-300 text-xs font-medium">
              <ShieldCheck className="w-3 h-3 text-[#0066ff]" /> Unblocked
            </span>
          </div>

          {/* Heading */}
          <div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight font-heading leading-tight">
              {activeGame.name}
            </h2>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-zinc-400 mt-2 font-medium">
              <span>{activeGame.author ? `By ${activeGame.author}` : 'Arcade Archive'}</span>
              <span>·</span>
              <span className="flex items-center text-[#60a5fa] font-semibold gap-1">
                <Star className="w-3.5 h-3.5 fill-[#0066ff] text-[#0066ff]" /> 4.9
              </span>
              <span>·</span>
              <span className="text-zinc-400">Arcade Library</span>
            </div>
          </div>

          {/* Blurb */}
          <p className="text-sm text-zinc-300 max-w-xl font-normal leading-relaxed">
            Instant 60 FPS unblocked gameplay streamed seamlessly in-browser. 
            Responsive controls with built-in tab camouflage.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => onPlay(activeGame)}
              className="flex items-center gap-2 px-6 py-3 bg-[#0066ff] hover:bg-[#0052cc] text-white text-sm font-extrabold rounded-xl shadow-lg shadow-[#0066ff]/25 active:scale-[0.98] transition-all cursor-pointer font-heading"
            >
              <Play className="w-4 h-4 fill-white text-white" />
              <span>Play Now</span>
            </button>

            <button
              onClick={() => onAboutBlank(activeGame)}
              className="flex items-center gap-2 px-5 py-3 bg-[#18181b] hover:bg-[#222226] text-zinc-200 hover:text-white text-sm font-semibold rounded-xl border border-[#27272a] hover:border-[#0066ff]/40 transition-all cursor-pointer"
              title="Open in an unblockable stealth about:blank window"
            >
              <ExternalLink className="w-4 h-4 text-zinc-400" />
              <span>Stealth Window</span>
            </button>
          </div>

        </div>

        {/* Right Column: Hero Visual + Quick Pickers */}
        <div className="lg:col-span-5 space-y-3">
          
          {/* Main Visual Card */}
          <div 
            onClick={() => onPlay(activeGame)}
            className="group relative w-full aspect-[16/10] rounded-xl overflow-hidden bg-[#161619] border border-[#26262a] shadow-2xl cursor-pointer"
          >
            <img
              src={activeGame.resolvedCover || undefined}
              alt={activeGame.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
              <div>
                <span className="text-[10px] uppercase font-black tracking-wider text-white bg-[#0066ff] px-2 py-0.5 rounded-full">
                  Trending
                </span>
                <div className="text-base font-bold text-white mt-1">
                  {activeGame.name}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Switch Strip */}
          <div className="grid grid-cols-4 gap-2">
            {featuredGames.slice(0, 4).map((game, idx) => {
              const isSelected = selectedIndex === idx;
              return (
                <button
                  key={game.id}
                  onClick={() => setSelectedIndex(idx)}
                  className={`relative rounded-lg overflow-hidden aspect-[4/3] border transition-all cursor-pointer ${
                    isSelected 
                      ? 'border-[#0066ff] ring-2 ring-[#0066ff]/50' 
                      : 'border-[#27272a] opacity-60 hover:opacity-100'
                  }`}
                  title={game.name}
                >
                  <img
                    src={game.resolvedCover || undefined}
                    alt={game.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </button>
              );
            })}
          </div>

        </div>

      </div>
    </div>
  );
};
