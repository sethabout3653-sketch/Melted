import React, { useState, useEffect } from 'react';
import { Play, Heart, ExternalLink, Gamepad2 } from 'lucide-react';
import { motion } from 'motion/react';
import { GameItem } from '../types/game';

interface GameCardProps {
  game: GameItem;
  onPlay: (game: GameItem) => void;
  onToggleFavorite: (id: number) => void;
  isFavorite: boolean;
  onAboutBlank: (game: GameItem) => void;
}

export const GameCard: React.FC<GameCardProps & { variant?: 'standard' | 'large' }> = React.memo(({
  game,
  onPlay,
  onToggleFavorite,
  isFavorite,
  onAboutBlank,
  variant = 'standard'
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [triedFallback, setTriedFallback] = useState(false);

  const primaryCover = game.resolvedCover || game.cover || '';
  const [currentCover, setCurrentCover] = useState<string>(primaryCover);
  const [fallbackAttempt, setFallbackAttempt] = useState<number>(0);

  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
    setFallbackAttempt(0);
    setCurrentCover(primaryCover);
  }, [game.id, primaryCover]);

  const handleImageError = () => {
    if (fallbackAttempt === 0 && game.fallbackCover && game.fallbackCover !== currentCover) {
      setFallbackAttempt(1);
      setCurrentCover(game.fallbackCover);
    } else if (fallbackAttempt <= 1 && game.localCover && game.localCover !== currentCover) {
      setFallbackAttempt(2);
      setCurrentCover(game.localCover);
    } else {
      setImageError(true);
    }
  };

  return (
    <motion.div 
      layout
      whileHover={{ y: -8, boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.08)" }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`group relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-[24px] p-2 flex flex-col shadow-sm hover:border-blue-200 dark:hover:border-blue-700 transition-colors ${
        variant === 'large' ? 'md:col-span-2 md:row-span-2' : ''
      }`}
    >
      {/* Image Container */}
      <div 
        onClick={() => onPlay(game)}
        className="relative w-full aspect-[4/3] rounded-[18px] overflow-hidden bg-slate-50 dark:bg-slate-950 cursor-pointer border border-slate-50 dark:border-slate-800 shadow-inner"
      >
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-slate-100 dark:bg-slate-800 animate-pulse" />
        )}

        {imageError || !currentCover ? (
          <div className="absolute inset-0 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 text-center select-none">
            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600 mb-3 shadow-sm">
              <Gamepad2 className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-4">
              {game.name}
            </span>
          </div>
        ) : (
          <img
            src={currentCover}
            alt={game.name}
            referrerPolicy="no-referrer"
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={handleImageError}
            className={`w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-110 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/* Favorite Button overlay */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(game.id);
          }}
          className={`absolute top-3 right-3 p-2.5 rounded-2xl backdrop-blur-md transition-all cursor-pointer z-10 border shadow-sm ${
            isFavorite 
              ? 'bg-blue-600 border-blue-500 text-white' 
              : 'bg-white/80 dark:bg-slate-900/80 border-white dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
          }`}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>

        {/* Launch overlay */}
        <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <div className="bg-white dark:bg-slate-900 px-4 py-2 rounded-2xl shadow-xl border border-blue-100 dark:border-blue-800 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 flex items-center gap-2">
            <Play className="w-4 h-4 fill-blue-600 text-blue-600 dark:text-blue-400 dark:fill-blue-400" />
            <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Play</span>
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="p-4 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h3 
            onClick={() => onPlay(game)}
            className="font-black text-slate-900 dark:text-white text-sm hover:text-blue-600 dark:hover:text-blue-400 transition-colors leading-tight line-clamp-1 cursor-pointer font-heading tracking-tight"
            title={game.name}
          >
            {game.name}
          </h3>
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-full shrink-0 border border-slate-100 dark:border-slate-800">
            {variant === 'large' ? 'TOP' : 'G'}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider truncate opacity-60">
          {game.author || game.category || 'Arcade'}
        </p>
      </div>

      {/* Quick Action Footer - Subtle */}
      <div className="mt-auto px-4 pb-4 pt-1 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => onAboutBlank(game)}
          className="flex-1 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-100 dark:border-slate-700 hover:border-blue-100 dark:hover:border-blue-800 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
        >
          Stealth
        </button>
      </div>

    </motion.div>
  );
});

