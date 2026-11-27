import React, { useState, useEffect, useRef } from 'react';
import { Play, Heart, Gamepad2 } from 'lucide-react';
import { GameItem, GameRatingInfo } from '../types/game';
import { generateGameSvgCover } from '../services/gameService';
import {
  getCachedGameRating,
  requestEsrbRating,
  subscribeToGameRatings,
} from '../services/gameRatingService';
import { EsrbBadge } from './EsrbBadge';

interface GameCardProps {
  game: GameItem;
  index?: number;
  onPlay: (game: GameItem) => void;
  onToggleFavorite: (id: number) => void;
  isFavorite: boolean;
}

export const GameCard: React.FC<GameCardProps & { variant?: 'standard' | 'large' }> = React.memo(({
  game,
  index = 0,
  onPlay,
  onToggleFavorite,
  isFavorite,
  variant = 'standard'
}) => {
  const [imageError, setImageError] = useState(false);

  const primaryCover = game.resolvedCover || game.cover || '';
  const [currentCover, setCurrentCover] = useState<string>(primaryCover);
  const [fallbackLevel, setFallbackLevel] = useState<number>(0);
  const [esrbRating, setEsrbRating] = useState<GameRatingInfo | undefined>(
    () => game.rating || getCachedGameRating(game.name)
  );

  useEffect(() => {
    const sync = () => {
      const next = game.rating || getCachedGameRating(game.name);
      setEsrbRating(next);
    };
    sync();
    if (!game.rating && !getCachedGameRating(game.name)) {
      requestEsrbRating(game.name);
    }
    return subscribeToGameRatings(sync);
  }, [game.id, game.name, game.rating]);

  const isFirstRunRef = useRef(true);
  useEffect(() => {
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      return;
    }
    setImageError(false);
    setFallbackLevel(0);
    setCurrentCover(primaryCover);
  }, [game.id, primaryCover]);

  const handleImageError = () => {
    if (fallbackLevel === 0) {
      if (game.fallbackCover && game.fallbackCover !== currentCover) {
        setFallbackLevel(1);
        setCurrentCover(game.fallbackCover);
      } else {
        setFallbackLevel(2);
        setCurrentCover(game.localCover || generateGameSvgCover(game.name, game.category));
      }
    } else if (fallbackLevel === 1) {
      setFallbackLevel(2);
      setCurrentCover(game.localCover || generateGameSvgCover(game.name, game.category));
    } else if (fallbackLevel === 2 && game.localCover && currentCover === game.localCover) {
      setFallbackLevel(3);
      setCurrentCover(generateGameSvgCover(game.name, game.category));
    } else {
      setImageError(true);
    }
  };

  const entryDelayMs = index < 12 ? index * 16 : 0;

  return (
    <div 
      style={entryDelayMs > 0 ? { animationDelay: `${entryDelayMs}ms` } : undefined}
      className={`group relative flex flex-col rounded-[1.35rem] border border-slate-200/80 bg-white/90 p-2 shadow-[0_12px_30px_-24px_rgba(14,41,31,0.45)] transition-[border-color,box-shadow] duration-200 hover:border-[var(--brand-blue)]/50 hover:shadow-[0_18px_42px_-26px_var(--brand-blue-glow)] dark:border-white/[0.07] dark:bg-[#111819] dark:shadow-none dark:hover:border-[var(--brand-accent-tint)]/35 card-smooth-in [contain:layout_style] ${
        variant === 'large' ? 'md:col-span-2 md:row-span-2' : ''
      }`}
    >
      {/* Thumbnail Container */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`Play ${game.name}`}
        onClick={() => onPlay(game)}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onPlay(game);
          }
        }}
        className="relative w-full aspect-[16/10] sm:aspect-[4/3] rounded-[1.05rem] overflow-hidden bg-slate-100 dark:bg-[#0b1012] cursor-pointer border border-slate-200/70 dark:border-white/[0.06] group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-blue)]"
      >
        {imageError || !currentCover ? (
          <div className="absolute inset-0 bg-slate-100 dark:bg-[#0f0f18] flex flex-col items-center justify-center p-3 text-center select-none">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#1a1a26] border border-slate-200 dark:border-[#2a2a3c] flex items-center justify-center text-[var(--brand-blue)] mb-2 shadow-sm">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 px-2 line-clamp-1">
              {game.name}
            </span>
          </div>
        ) : (
          <img
            src={currentCover}
            alt={game.name}
            referrerPolicy="no-referrer"
            loading={index < 18 ? 'eager' : 'lazy'}
            decoding={index < 6 ? 'sync' : 'async'}
            fetchPriority={index < 12 ? 'high' : 'auto'}
            onError={handleImageError}
            className="w-full h-full object-cover transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
          />
        )}

        <span className="absolute left-2 top-2 z-10 max-w-[70%] truncate rounded-md border border-white/15 bg-black/55 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white/90 backdrop-blur-md">
          {game.category || 'Arcade'}
        </span>

        {/* Favorite Button overlay */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(game.id);
          }}
          aria-label={isFavorite ? `Remove ${game.name} from favorites` : `Add ${game.name} to favorites`}
          className={`absolute top-1.5 right-1.5 min-w-[38px] min-h-[38px] sm:min-w-[34px] sm:min-h-[34px] flex items-center justify-center rounded-xl transition-colors duration-150 cursor-pointer z-10 border shadow-md ${
            isFavorite 
              ? 'bg-[var(--brand-blue)] border-[var(--brand-blue)] text-white'
              : 'bg-[#090d16]/75 border-[#222232] text-slate-300 hover:text-white'
          }`}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart className={`w-4 h-4 sm:w-3.5 sm:h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
        </button>

        {/* Official ESRB Rating Badge (Only shown for games with a verified real ESRB rating) */}
        {esrbRating && (
          <EsrbBadge
            rating={esrbRating}
            className="absolute bottom-1.5 left-1.5 z-10 w-[30px] sm:w-[36px]"
          />
        )}

        {/* Hover Play Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
          <div className="bg-[var(--brand-blue)] text-white px-4 py-1.5 rounded-full shadow-lg font-semibold text-sm flex items-center gap-1.5 transform scale-90 group-hover:scale-100 transition-transform duration-200">
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Play</span>
          </div>
        </div>
      </div>

      {/* Title & Info */}
      <div className="px-2 py-2 sm:p-2.5 space-y-0.5 sm:space-y-1">
        <h3 className="truncate text-sm font-semibold leading-snug text-slate-900 dark:text-white">
          <button type="button" onClick={() => onPlay(game)} className="truncate text-left transition-colors hover:text-[var(--brand-blue)]" title={game.name}>
            {game.name}
          </button>
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
          {game.author || game.category || 'Instant Play'}
          {esrbRating?.descriptors ? ` · ${esrbRating.descriptors.split(',')[0].trim()}` : ''}
        </p>
      </div>

    </div>
  );
});
