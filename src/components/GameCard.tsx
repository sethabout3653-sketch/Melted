import React, { useState, useEffect, useRef } from 'react';
import { Play, Heart, Gamepad2 } from 'lucide-react';
import { GameItem } from '../types/game';
import { generateGameSvgCover } from '../services/gameService';

interface GameCardProps {
  game: GameItem;
  index?: number;
  onPlay: (game: GameItem) => void;
  onToggleFavorite: (id: number) => void;
  isFavorite: boolean;
  onAboutBlank: (game: GameItem) => void;
}

export const GameCard: React.FC<GameCardProps & { variant?: 'standard' | 'large' }> = React.memo(({
  game,
  index = 0,
  onPlay,
  onToggleFavorite,
  isFavorite,
  onAboutBlank,
  variant = 'standard'
}) => {
  const [imageError, setImageError] = useState(false);

  const primaryCover = game.resolvedCover || game.cover || '';
  const [currentCover, setCurrentCover] = useState<string>(primaryCover);
  const [fallbackLevel, setFallbackLevel] = useState<number>(0);

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

  return (
    <div 
      className={`group relative bg-white/90 dark:bg-[#10101a] border border-slate-200/80 dark:border-white/10 shadow-sm dark:shadow-none hover:border-[var(--brand-blue)] hover:shadow-lg hover:shadow-black/5 rounded-2xl p-2 flex flex-col transition-[transform,border-color,box-shadow] duration-150 ease-out hover:-translate-y-1 active:scale-[0.98] [contain:layout_style] ${
        variant === 'large' ? 'md:col-span-2 md:row-span-2' : ''
      }`}
    >
      {/* Thumbnail Container */}
      <div 
        onClick={() => onPlay(game)}
        className="relative w-full aspect-[16/10] sm:aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 dark:bg-[#0d0d12] cursor-pointer border border-slate-200 dark:border-[#1d1d2b] shadow-inner group"
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
            loading="eager"
            decoding={index < 16 ? 'sync' : 'async'}
            fetchPriority={index < 24 ? 'high' : 'auto'}
            onError={handleImageError}
            className="w-full h-full object-cover transition-transform duration-200 ease-out group-hover:scale-105"
          />
        )}

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
              ? 'bg-[var(--brand-blue)] border-[var(--brand-blue)] text-[#090d16]' 
              : 'bg-[#090d16]/75 border-[#222232] text-slate-300 hover:text-white'
          }`}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart className={`w-4 h-4 sm:w-3.5 sm:h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
        </button>

        {/* Hover Play Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
          <div className="bg-[var(--brand-blue)] text-[#090d16] px-4 py-1.5 rounded-full shadow-lg font-semibold text-sm flex items-center gap-1.5 transform scale-90 group-hover:scale-100 transition-transform duration-200">
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Play</span>
          </div>
        </div>
      </div>

      {/* Title & Info */}
      <div className="px-2 py-2 sm:p-2.5 space-y-0.5 sm:space-y-1">
        <h3 
          onClick={() => onPlay(game)}
          className="font-semibold text-slate-900 dark:text-white text-sm hover:text-[var(--brand-blue)] transition-colors leading-snug line-clamp-1 cursor-pointer"
          title={game.name}
        >
          {game.name}
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
          {game.author || game.category || 'Instant Play'}
        </p>
      </div>

      {/* Action Footer */}
      <div className="mt-auto px-2 pb-1.5 sm:px-2.5 sm:pb-2 pt-0.5 flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => onAboutBlank(game)}
          className="flex-1 min-h-[34px] sm:min-h-[30px] py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-[#1e1e2d] dark:hover:bg-[#28283a] text-slate-700 dark:text-slate-300 hover:text-[var(--brand-blue)] border border-slate-200 dark:border-[#2a2a3e] hover:border-[var(--brand-blue)]/40 text-xs font-medium transition-all cursor-pointer"
        >
          Open in stealth
        </button>
      </div>

    </div>
  );
});
