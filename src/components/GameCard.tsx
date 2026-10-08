import React, { useState } from 'react';
import { Play, Heart, ExternalLink, Flame, Gamepad2 } from 'lucide-react';
import { GameItem } from '../types/game';

interface GameCardProps {
  game: GameItem;
  onPlay: (game: GameItem) => void;
  onToggleFavorite: (id: number) => void;
  isFavorite: boolean;
  onAboutBlank: (game: GameItem) => void;
  isCached?: boolean;
}

export const GameCard: React.FC<GameCardProps> = React.memo(({
  game,
  onPlay,
  onToggleFavorite,
  isFavorite,
  onAboutBlank,
  isCached = false,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const ratingNumber = (4.7 + ((game.id * 13) % 30) / 100).toFixed(1);

  return (
    <div className="group relative bg-[#0e0e10] hover:bg-[#131316] border border-[#202024] hover:border-[#0066ff]/40 rounded-2xl p-4 transition-all duration-200 hover:shadow-xl hover:shadow-[#0066ff]/5 flex flex-col justify-between transform-gpu">
      
      {/* Top Section */}
      <div>
        {/* Large Thumbnail with 16px radius */}
        <div 
          onClick={() => onPlay(game)}
          className="relative w-full aspect-[16/10] rounded-[16px] overflow-hidden bg-[#161619] cursor-pointer mb-3.5 border border-[#26262a]"
        >
          {/* Skeleton placeholder while loading */}
          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 bg-[#161619] animate-pulse" />
          )}

          {/* Fallback styling container if image fails to load */}
          {imageError || !game.resolvedCover ? (
            <div className="absolute inset-0 bg-[#121214] flex flex-col items-center justify-center p-4 text-center">
              <div className="w-10 h-10 rounded-xl bg-[#0066ff]/15 border border-[#0066ff]/30 flex items-center justify-center text-[#0066ff] mb-2">
                <Gamepad2 className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-zinc-300 font-heading line-clamp-1">
                {game.name}
              </span>
              <span className="text-[10px] text-zinc-400 mt-0.5">
                Arcade
              </span>
            </div>
          ) : (
            <img
              src={game.resolvedCover || undefined}
              alt={game.name}
              referrerPolicy="no-referrer"
              loading="lazy"
              decoding="async"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              className={`w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105 will-change-transform ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          )}

          {/* Subtle dark gradient scrim at bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
            <span className="text-[11px] font-bold text-white drop-shadow-md flex items-center gap-1 font-heading">
              <Play className="w-3 h-3 fill-[#0066ff] text-[#0066ff]" /> Launch Game
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
                isFavorite ? 'fill-[#0066ff] text-[#0066ff]' : 'text-zinc-400 hover:text-white'
              }`}
            />
          </button>
        </div>

        {/* Title & Metadata */}
        <div className="space-y-1.5">
          <h3 
            onClick={() => onPlay(game)}
            className="font-extrabold text-[15px] text-zinc-100 hover:text-[#0066ff] transition-colors leading-snug line-clamp-1 cursor-pointer font-heading"
            title={game.name}
          >
            {game.name}
          </h3>

          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="text-[11px] text-zinc-400 font-medium truncate">
              {game.author || 'Arcade'}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-zinc-300">
                ★ {ratingNumber}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="mt-4 pt-3 border-t border-[#1c1c20] flex items-center justify-between gap-2">
        <button
          onClick={() => onPlay(game)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-[#18181b] hover:bg-[#0066ff] text-zinc-200 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-[#27272a] hover:border-[#0066ff] font-heading shadow-sm"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Play</span>
        </button>

        <button
          onClick={() => onAboutBlank(game)}
          className="p-2 bg-[#18181b] hover:bg-[#222226] text-zinc-400 hover:text-white rounded-xl border border-[#27272a] transition-all cursor-pointer"
          title="Open in stealth about:blank window"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
});
