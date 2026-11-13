import React, { useState, useEffect } from 'react';
import { Play, Heart, Gamepad2 } from 'lucide-react';
import { motion } from 'motion/react';
import { GameItem } from '../types/game';
import { generateGameSvgCover } from '../services/gameService';
import { cardHover, hoverTransition, entryVariants } from '../utils/animations';

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
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const primaryCover = game.resolvedCover || game.cover || '';
  const [currentCover, setCurrentCover] = useState<string>(primaryCover);
  const [fallbackLevel, setFallbackLevel] = useState<number>(0);
  const [retryCount, setRetryCount] = useState(0);

  const [imgKey, setImgKey] = useState(0);

  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
    setFallbackLevel(0);
    setRetryCount(0);
    setCurrentCover(primaryCover);
    setImgKey(prev => prev + 1);
  }, [game.id, primaryCover]);

  const handleImageError = () => {
    if (retryCount < 2) {
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        setImgKey(prev => prev + 1);
      }, 600);
      return;
    }

    if (fallbackLevel === 0) {
      if (game.fallbackCover && game.fallbackCover !== currentCover) {
        setFallbackLevel(1);
        setRetryCount(0);
        setCurrentCover(game.fallbackCover);
      } else {
        setFallbackLevel(2);
        setRetryCount(0);
        setCurrentCover(game.localCover || generateGameSvgCover(game.name, game.category));
      }
    } else if (fallbackLevel === 1) {
      setFallbackLevel(2);
      setRetryCount(0);
      setCurrentCover(game.localCover || generateGameSvgCover(game.name, game.category));
    } else if (fallbackLevel === 2 && game.localCover && currentCover === game.localCover) {
      setFallbackLevel(3);
      setRetryCount(0);
      setCurrentCover(generateGameSvgCover(game.name, game.category));
    } else {
      setImageError(true);
    }
  };

  return (
    <motion.div 
      whileHover={cardHover}
      transition={hoverTransition}
      className={`group relative bg-[#14141d] dark:bg-[#14141d] border border-[#222232] hover:border-[var(--brand-blue)] hover:shadow-[0_0_20px_var(--brand-blue-glow)] rounded-2xl p-2 flex flex-col will-change-transform transition-colors duration-150 ${
        variant === 'large' ? 'md:col-span-2 md:row-span-2' : ''
      }`}
    >
      {/* Thumbnail Container */}
      <div 
        onClick={() => onPlay(game)}
        className="relative w-full aspect-[16/10] sm:aspect-[4/3] rounded-xl overflow-hidden bg-[#0d0d12] cursor-pointer border border-[#1d1d2b] shadow-inner group"
      >
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-[#1a1a28] animate-pulse" />
        )}

        {imageError || !currentCover ? (
          <div className="absolute inset-0 bg-[#0f0f18] flex flex-col items-center justify-center p-3 text-center select-none">
            <div className="w-10 h-10 rounded-xl bg-[#1a1a26] border border-[#2a2a3c] flex items-center justify-center text-[var(--brand-blue)] mb-2 shadow-sm">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider px-2 line-clamp-1">
              {game.name}
            </span>
          </div>
        ) : (
          <img
            key={imgKey}
            src={currentCover}
            alt={game.name}
            referrerPolicy="no-referrer"
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={handleImageError}
            className={`w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            } transition-opacity duration-200`}
          />
        )}

        {/* Favorite Button overlay */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(game.id);
          }}
          className={`absolute top-2 right-2 p-2 rounded-xl backdrop-blur-md transition-colors duration-150 cursor-pointer z-10 border shadow-md ${
            isFavorite 
              ? 'bg-[var(--brand-blue)] border-[var(--brand-blue)] text-[#090d16]' 
              : 'bg-[#090d16]/70 border-[#222232] text-slate-400 hover:text-white'
          }`}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
        </button>

        {/* Hover Play Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
          <div className="bg-[var(--brand-blue)] text-[#090d16] px-3.5 py-1.5 rounded-xl shadow-lg font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transform scale-90 group-hover:scale-100 transition-transform duration-200">
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Play</span>
          </div>
        </div>
      </div>

      {/* Title & Info */}
      <div className="p-2.5 space-y-1">
        <h3 
          onClick={() => onPlay(game)}
          className="font-bold text-white text-xs sm:text-sm hover:text-[var(--brand-blue)] transition-colors leading-tight line-clamp-1 cursor-pointer font-heading tracking-tight"
          title={game.name}
        >
          {game.name}
        </h3>
        <p className="text-[11px] text-slate-400 font-medium truncate">
          {game.author || game.category || 'Instant Play'}
        </p>
      </div>

      {/* Action Footer */}
      <div className="mt-auto px-2.5 pb-2 pt-0.5 flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => onAboutBlank(game)}
          className="flex-1 py-1.5 rounded-lg bg-[#1e1e2d] hover:bg-[#28283a] text-slate-300 hover:text-[var(--brand-blue)] border border-[#2a2a3e] hover:border-[var(--brand-blue)]/40 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
        >
          Stealth Launch
        </button>
      </div>

    </motion.div>
  );
});
