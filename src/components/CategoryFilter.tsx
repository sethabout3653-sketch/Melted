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
  { id: 'All', label: 'All Titles', icon: <Gamepad2 className="w-3.5 h-3.5" /> },
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
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2 border-b border-[#1f1f2e]">
      {/* Category Navigation Bar / Chips */}
      <div className="flex overflow-x-auto pb-2 sm:pb-0 scrollbar-none touch-pan-x sm:flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          const count = categoryCounts[cat.id] || 0;

          if (count === 0 && cat.id !== 'Favorites') return null;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`flex items-center gap-2 transition-all cursor-pointer py-1.5 px-3.5 rounded-lg border text-xs font-bold font-heading whitespace-nowrap ${
                isSelected 
                  ? 'bg-[#00f0ff] text-[#090d16] border-[#00f0ff] font-extrabold shadow-md shadow-[#00f0ff]/20' 
                  : 'bg-[#181822] hover:bg-[#20202e] text-slate-300 hover:text-white border-[#262638]'
              }`}
            >
              <span>{cat.label}</span>
              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                isSelected ? 'bg-[#090d16]/20 text-[#090d16]' : 'bg-[#262638] text-slate-400'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sort Selector Right Side */}
      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Sort:</span>
        <div className="relative group">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as any)}
            className="appearance-none bg-[#181822] hover:bg-[#20202e] text-white font-bold px-3 py-1.5 pr-8 rounded-lg border border-[#262638] focus:border-[#00f0ff] focus:outline-none cursor-pointer text-xs shadow-sm transition-all"
          >
            <option value="popular" className="bg-[#181822] text-white">Popularity</option>
            <option value="alpha-asc" className="bg-[#181822] text-white">A-Z</option>
            <option value="alpha-desc" className="bg-[#181822] text-white">Z-A</option>
            <option value="random" className="bg-[#181822] text-white">Random</option>
          </select>
          <ArrowUpDown className="w-3.5 h-3.5 text-[#00f0ff] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>
    </div>
  );
};
