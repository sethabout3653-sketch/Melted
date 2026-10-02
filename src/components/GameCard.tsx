import React, { useState } from 'react';
import { Play, Heart, ExternalLink, Flame, Gamepad2 } from 'lucide-react';
import { GameItem } from '../types/game';

interface GameCardProps {
  game: GameItem;
  onPlay: (game: GameItem) => void;
  onToggleFavorite: (id: number) => void;
  isFavorite: boolean;
  onAboutBlank: (game: GameItem) => void;
}

export const GameCard: React.FC<GameCardProps> = ({
  game,
  onPlay,
  onToggleFavorite,
  isFavorite,
  onAboutBlank,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const ratingNumber = (4.7 + ((game.id * 13) % 30) / 100).toFixed(1);

  return (
    <div className="group relative bg-[#0e0e10] hover:bg-[#141416] border border-[#202024] hover:border-[#ff5500]/50 rounded-2xl p-4 transition-all duration-200 hover:shadow-xl hover:shadow-[#ff5500]/5 flex flex-col justify-between">
      
      {/* Top Section */}
      <div>
        {/* Large Thumbnail with 16px radius */}
        <div 
          onClick={() => onPlay(game)}
          className="relative w-full aspect-[16/10] rounded-[16px] overflow-hidden bg-[#18181b] cursor-pointer mb-3.5 border border-[#26262a]"
        >
          {/* Skeleton placeholder while loading */}
          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 bg-[#161618] animate-pulse" />
          )}

          {/* Fallback styling container if image fails to load */}
          {imageError ? (
            <div className="absolute inset-0 bg-[#121214] flex flex-col items-center justify-center p-4 text-center">
              <div className="w-10 h-10 rounded-xl bg-[#ff5500]/15 border border-[#ff5500]/30 flex items-center justify-center text-[#ff5500] mb-2">
                <Gamepad2 className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-zinc-300 font-heading line-clamp-1">
                {game.name}
              </span>
              <span className="text-[10px] text-zinc-400 mt-0.5">
                gn-math Arcade
              </span>
            </div>
          ) : (
            <img
              src={game.resolvedCover}
              alt={game.name}
              referrerPolicy="no-referrer"
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              className={`w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          )}

          {/* Subtle dark gradient scrim at bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
            <span className="text-[11px] font-bold text-white drop-shadow-md flex items-center gap-1">
              <Play className="w-3 h-3 fill-[#ff5500] text-[#ff5500]" /> Launch Game
            </span>
          </div>

          {/* Favorite button (top-right overlay) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(game.id);
            }}
            className="absolute top-2.5 right-2.5 p-2 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/10 text-white transition-all cursor-pointer z-10"
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart
              className={`w-3.5 h-3.5 transition-colors ${
                isFavorite ? 'fill-[#ff5500] text-[#ff5500]' : 'text-zinc-400 hover:text-white'
              }`}
            />
          </button>

          {/* Featured badge */}
          {game.featured && (
            <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-[#ff5500] text-black text-[9px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1">
              <Flame className="w-2.5 h-2.5 fill-black" /> Hot
            </div>
          )}
        </div>

        {/* Title & Metadata Pills */}
        <div className="space-y-1.5">
          <h3 
            onClick={() => onPlay(game)}
            className="font-extrabold text-[15px] text-zinc-100 hover:text-[#ff5500] transition-colors leading-snug line-clamp-1 cursor-pointer font-heading"
            title={game.name}
          >
            {game.name}
          </h3>

          <p className="text-xs text-zinc-400 line-clamp-1 font-normal">
            {game.author ? `By ${game.author}` : 'gn-math HTML5 Library'}
          </p>

          {/* Metadata Pills: Clean and restrained */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="inline-flex items-center gap-1 bg-[#17171a] border border-[#27272a] rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-[#ff6611]">
              <span>★</span> {ratingNumber}
            </span>

            <span className="inline-flex items-center bg-[#17171a] border border-[#27272a] rounded-full px-2.5 py-0.5 text-[11px] font-medium text-zinc-300">
              {game.category.split(' ')[0]}
            </span>

            <span className="inline-flex items-center bg-[#ff5500]/10 border border-[#ff5500]/25 rounded-full px-2 py-0.5 text-[10px] font-bold text-[#ff6611]">
              RawGitHack
            </span>
          </div>
        </div>
      </div>

      {/* Card Actions: 16px internal padding */}
      <div className="mt-4 pt-3 border-t border-[#1c1c20] flex items-center justify-between gap-2">
        <button
          onClick={() => onPlay(game)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-black bg-[#ff5500] hover:bg-[#e64d00] active:scale-[0.98] rounded-xl transition-all shadow-md shadow-[#ff5500]/20 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-black" />
          <span>Play</span>
        </button>

        <button
          onClick={() => onAboutBlank(game)}
          className="p-2 text-zinc-400 hover:text-white bg-[#151518] hover:bg-[#202024] rounded-xl border border-[#252528] hover:border-[#ff5500]/40 transition-all cursor-pointer"
          title="Open in stealth about:blank tab"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
};
