import React, { useState } from 'react';
import { Play, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GameItem } from '../types/game';
import { entryVariants, hoverTransition, cardHover } from '../utils/animations';

interface HeroSpotlightProps {
  featuredGames: GameItem[];
  onPlay: (game: GameItem) => void;
  onAboutBlank: (game: GameItem) => void;
}

export const HeroSpotlight: React.FC<HeroSpotlightProps> = React.memo(({
  featuredGames,
  onPlay,
  onAboutBlank,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (!featuredGames.length) return null;

  const activeGame = featuredGames[selectedIndex] || featuredGames[0];

  return (
    <div className="relative mb-20 overflow-hidden rounded-[40px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-8 lg:p-16 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.05)] dark:shadow-none">
      {/* Background soft glow */}
      <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-blue-50/30 dark:from-blue-900/10 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
        
        {/* Left Column: Content */}
        <div className="lg:col-span-6 space-y-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeGame.id}
              variants={entryVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, x: -20 }}
              custom={0}
              className="space-y-6"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 text-cyan-500 dark:text-cyan-300 text-[11px] font-black uppercase tracking-[0.2em]">
                <Zap className="w-3.5 h-3.5 fill-current" />
                Featured Experience
              </div>

              <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black text-slate-900 dark:text-white tracking-tight font-heading leading-[1.05]">
                {activeGame.name}
              </h2>
              
              <p className="text-xl text-slate-500 dark:text-slate-400 max-w-xl font-medium leading-relaxed">
                Interactive educational modules, logic challenges, and study resources designed for student engagement.
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-6">
            <motion.button
              type="button"
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.96 }}
              transition={hoverTransition}
              onClick={() => onPlay(activeGame)}
              className="px-10 py-5 bg-cyan-500 hover:bg-blue-700 text-white text-base font-black rounded-2xl shadow-2xl shadow-cyan-500/30 transition-colors duration-150 cursor-pointer font-heading tracking-tight border border-cyan-400 will-change-transform"
            >
              Start Playing Now
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.96 }}
              transition={hoverTransition}
              onClick={() => onAboutBlank(activeGame)}
              className="px-8 py-5 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 text-base font-bold rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors duration-150 cursor-pointer shadow-sm will-change-transform"
            >
              Quiet Window
            </motion.button>
          </div>
        </div>

        {/* Right Column: Visual */}
        <div className="lg:col-span-6">
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeGame.id}
              initial={{ opacity: 0, scale: 0.8, rotate: -3 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 1.2, rotate: 3 }}
              whileHover={cardHover}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="relative aspect-square sm:aspect-[4/3] rounded-[48px] overflow-hidden bg-slate-50 dark:bg-slate-950 border-4 border-white dark:border-slate-800 shadow-2xl shadow-slate-200/60 dark:shadow-none group cursor-pointer will-change-transform"
              onClick={() => onPlay(activeGame)}
            >
              <img
                src={activeGame.resolvedCover || activeGame.fallbackCover || activeGame.localCover || undefined}
                alt={activeGame.name}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (activeGame.fallbackCover && target.src !== activeGame.fallbackCover) {
                    target.src = activeGame.fallbackCover;
                  } else if (activeGame.localCover && target.src !== activeGame.localCover) {
                    target.src = activeGame.localCover;
                  }
                }}
                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-10">
                <div className="text-white font-heading">
                  <div className="text-3xl font-black">{activeGame.name}</div>
                  <div className="text-sm font-bold opacity-80 uppercase tracking-widest mt-1">Ready to stream</div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Quick pickers underneath - GPU safe transform */}
          <div className="flex items-center gap-3 mt-8 px-4 justify-center lg:justify-start">
            {featuredGames.slice(0, 5).map((game, idx) => {
              const isSelected = selectedIndex === idx;
              return (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => setSelectedIndex(idx)}
                  className={`h-3 rounded-full transition-all duration-200 cursor-pointer ${
                    isSelected ? 'w-10 bg-cyan-500' : 'w-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600'
                  }`}
                  title={game.name}
                />
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
});


