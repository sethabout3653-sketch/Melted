import React from 'react';
import { 
  Sparkles, 
  Gamepad2, 
  Car, 
  Flame, 
  Ghost, 
  History, 
  Trophy, 
  Puzzle, 
  Cpu, 
  Heart,
  ArrowUpDown
} from 'lucide-react';
import { GameCategory } from '../types/game';

interface CategoryFilterProps {
  selectedCategory: GameCategory;
  onSelectCategory: (category: GameCategory) => void;
  sortBy: 'popular' | 'alpha-asc' | 'alpha-desc' | 'random';
  onSortChange: (sort: 'popular' | 'alpha-asc' | 'alpha-desc' | 'random') => void;
  categoryCounts: Record<GameCategory, number>;
}

const CATEGORIES: { id: GameCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'All', label: 'All', icon: <Gamepad2 className="w-3.5 h-3.5" /> },
  { id: 'Featured', label: 'Featured', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: 'Action & Shooters', label: 'Action', icon: <Flame className="w-3.5 h-3.5" /> },
  { id: 'Driving & Racing', label: 'Driving', icon: <Car className="w-3.5 h-3.5" /> },
  { id: 'Skill & Platformer', label: 'Skill', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: 'Horror & Mystery', label: 'Horror', icon: <Ghost className="w-3.5 h-3.5" /> },
  { id: 'Retro & Arcade', label: 'Retro', icon: <History className="w-3.5 h-3.5" /> },
  { id: 'Sports & Physics', label: 'Sports', icon: <Trophy className="w-3.5 h-3.5" /> },
  { id: 'Puzzle & Casual', label: 'Puzzle', icon: <Puzzle className="w-3.5 h-3.5" /> },
  { id: 'Emulators & Ports', label: 'Emulators', icon: <Cpu className="w-3.5 h-3.5" /> },
  { id: 'Favorites', label: 'Saved', icon: <Heart className="w-3.5 h-3.5" /> },
];

export const CategoryFilter: React.FC<CategoryFilterProps> = React.memo(({
  selectedCategory,
  onSelectCategory,
  sortBy,
  onSortChange,
  categoryCounts,
}) => {
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0) {
      e.currentTarget.scrollLeft += e.deltaY;
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-4 py-1.5 sm:py-2 border-b border-slate-200 dark:border-[#1f1f2e]">
      {/* Category Navigation Bar / Chips */}
      <div 
        onWheel={handleWheel}
        className="flex overflow-x-auto pb-1.5 sm:pb-0 scrollbar-none touch-pan-x sm:flex-wrap items-center gap-1.5 sm:gap-2 flex-1 min-w-0 cursor-grab active:cursor-grabbing"
      >
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          const count = categoryCounts[cat.id] || 0;

          if (count === 0 && cat.id !== 'Favorites') return null;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`flex items-center gap-1.5 transition-colors duration-150 cursor-pointer min-h-[38px] sm:min-h-[34px] py-1.5 px-3.5 rounded-full border text-sm font-medium whitespace-nowrap shrink-0 ${
                isSelected 
                  ? 'bg-[var(--brand-blue)] text-slate-950 border-[var(--brand-blue)] shadow-md shadow-[var(--brand-blue-glow)]' 
                  : 'bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border-slate-200 dark:bg-[#181822] dark:hover:bg-[#20202e] dark:text-slate-300 dark:hover:text-white dark:border-[#262638]'
              }`}
            >
              <span>{cat.label}</span>
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full tabular-nums ${
                isSelected ? 'bg-black/20 text-slate-950' : 'bg-slate-100 text-slate-500 dark:bg-[#262638] dark:text-slate-400'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sort Selector Right Side */}
      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
        <span className="text-sm text-slate-500 dark:text-slate-400">Sort by</span>
        <div className="relative group">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as any)}
            aria-label="Sort games"
            className="appearance-none bg-white hover:bg-slate-50 dark:bg-[#181822] dark:hover:bg-[#20202e] text-slate-900 dark:text-white font-medium px-4 py-1.5 pr-9 rounded-full border border-slate-200 dark:border-[#262638] focus:border-[var(--brand-blue)] focus:outline-none cursor-pointer text-sm shadow-sm transition-colors duration-150 min-h-[38px] sm:min-h-[34px]"
          >
            <option value="popular" className="bg-white dark:bg-[#181822] text-slate-900 dark:text-white">Popularity</option>
            <option value="alpha-asc" className="bg-white dark:bg-[#181822] text-slate-900 dark:text-white">A to Z</option>
            <option value="alpha-desc" className="bg-white dark:bg-[#181822] text-slate-900 dark:text-white">Z to A</option>
            <option value="random" className="bg-white dark:bg-[#181822] text-slate-900 dark:text-white">Random</option>
          </select>
          <ArrowUpDown className="w-3.5 h-3.5 text-[var(--brand-blue)] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>
    </div>
  );
});
