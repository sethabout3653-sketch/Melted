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
  { id: 'All', label: 'All Games', icon: <Gamepad2 className="w-3.5 h-3.5" /> },
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

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  selectedCategory,
  onSelectCategory,
  sortBy,
  onSortChange,
  categoryCounts,
}) => {
  return (
    <div className="space-y-3 mb-6">
      {/* Category Pills: Fully responsive flex-wrap so ALL tabs are 100% visible on every device without scrolling */}
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          const count = categoryCounts[cat.id] || 0;

          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-[#0066ff] text-white border-[#0066ff] shadow-md shadow-[#0066ff]/25 font-bold'
                  : 'bg-[#111113] hover:bg-[#17171a] text-zinc-300 border-[#222225] hover:border-[#0066ff]/40'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                  isSelected
                    ? 'bg-black/25 text-white font-black'
                    : 'bg-[#1c1c20] text-zinc-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sorting & count info */}
      <div className="flex items-center justify-between gap-3 text-xs text-zinc-400 pt-2 border-t border-[#1c1c20]">
        <div className="text-zinc-400 flex items-center gap-2">
          <span>Showing</span>
          <strong className="text-white font-bold">{categoryCounts[selectedCategory] || 0}</strong>
          <span>games</span>
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-1.5 bg-[#111113] px-3 py-1.5 rounded-xl border border-[#222225]">
          <ArrowUpDown className="w-3 h-3 text-zinc-400" />
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as any)}
            className="bg-transparent text-zinc-200 font-semibold focus:outline-none cursor-pointer text-xs"
          >
            <option value="popular" className="bg-[#111113] text-white">Popular & Trending</option>
            <option value="alpha-asc" className="bg-[#111113] text-white">Alphabetical (A-Z)</option>
            <option value="alpha-desc" className="bg-[#111113] text-white">Alphabetical (Z-A)</option>
            <option value="random" className="bg-[#111113] text-white">🔀 Surprise Me (Random)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
