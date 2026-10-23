import React, { useState } from 'react';
import { Play, Heart, ExternalLink, Gamepad2 } from 'lucide-react';
import { GameItem } from '../types/game';

interface GameCardProps {
  game: GameItem;
  onPlay: (game: GameItem) => void;
  onToggleFavorite: (id: number) => void;
  isFavorite: boolean;
  onAboutBlank: (game: GameItem) => void;
}

export const GameCard: React.FC<GameCardProps> = React.memo(({
  game,
  onPlay,
  onToggleFavorite,
  isFavorite,
  onAboutBlank,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [triedFallback, setTriedFallback] = useState(false);

  const initialCover = game.localCover || game.resolvedCover || game.cover || '';
  const [currentCover, setCurrentCover] = useState<string>(initialCover);

  const ratingNumber = (4.7 + ((game.id * 13) % 30) / 100).toFixed(1);

  const handleImageError = () => {
    if (game.fallbackCover && currentCover !== game.fallbackCover) {
      setCurrentCover(game.fallbackCover);
      setImageLoaded(true);
    } else {
      setImageError(true);
    }
  };

  return (
    <div className="group relative bg-[var(--bg-navy)] hover:bg-[var(--bg-navy)] border border-[var(--bg-navy)] hover:border-[var(--vibrant-cyan)]/40 rounded-2xl p-4 transition-all duration-200 hover:shadow-xl hover:shadow-[var(--vibrant-cyan)]/5 flex flex-col justify-between transform-gpu">
      
      {/* Top Section */}
      <div>
        {/* Large Thumbnail with 16px radius */}
        <div 
          onClick={() => onPlay(game)}
          className="relative w-full aspect-[16/10] rounded-[16px] overflow-hidden bg-[var(--bg-navy)] cursor-pointer mb-3.5 border border-[var(--bg-navy)]"
        >
          {/* Skeleton placeholder while loading */}
          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 bg-[var(--bg-navy)] animate-pulse" />
          )}

          {/* Fallback styling container if image fails to load */}
          {imageError || !currentCover ? (
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--bg-navy)] to-[var(--bg-navy)] flex flex-col items-center justify-center p-4 text-center select-none">
              <div className="w-10 h-10 rounded-xl bg-[var(--vibrant-cyan)]/15 border border-[var(--vibrant-cyan)]/30 flex items-center justify-center text-[var(--vibrant-cyan)] mb-2 shadow-inner">
                <Gamepad2 className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-zinc-200 font-heading line-clamp-1">
                {game.name}
              </span>
              <span className="text-[10px] text-zinc-400 mt-0.5">
                {game.category || 'Arcade'}
              </span>
            </div>
          ) : (
            <img
              src={currentCover}
              alt={game.name}
              referrerPolicy="no-referrer"
              loading="lazy"
              decoding="async"
              onLoad={() => setImageLoaded(true)}
              onError={handleImageError}
              className={`w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105 will-change-transform ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          )}

          {/* Subtle dark gradient scrim at bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
            <span className="text-[11px] font-bold text-white drop-shadow-md flex items-center gap-1 font-heading">
              <Play className="w-3 h-3 fill-[var(--vibrant-cyan)] text-[var(--vibrant-cyan)]" /> Launch Game
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
                isFavorite ? 'fill-[var(--vibrant-cyan)] text-[var(--vibrant-cyan)]' : 'text-zinc-400 hover:text-white'
              }`}
            />
          </button>
        </div>

        {/* Title & Metadata */}
        <div className="space-y-1.5">
          <h3 
            onClick={() => onPlay(game)}
            className="font-extrabold text-[15px] text-zinc-100 hover:text-[var(--vibrant-cyan)] transition-colors leading-snug line-clamp-1 cursor-pointer font-heading"
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
      <div className="mt-4 pt-3 border-t border-[var(--bg-navy)] flex items-center justify-between gap-2">
        <button
          onClick={() => onPlay(game)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-[var(--bg-navy)] hover:bg-[var(--vibrant-cyan)] text-zinc-200 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-[var(--bg-navy)] hover:border-[var(--vibrant-cyan)] font-heading shadow-sm"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Play</span>
        </button>

        <button
          onClick={() => onAboutBlank(game)}
          className="p-2 bg-[var(--bg-navy)] hover:bg-[var(--bg-navy)] text-zinc-400 hover:text-white rounded-xl border border-[var(--bg-navy)] transition-all cursor-pointer"
          title="Open in stealth about:blank window"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
});
