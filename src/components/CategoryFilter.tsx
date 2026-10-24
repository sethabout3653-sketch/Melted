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
import { motion } from 'motion/react';

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
    <div className="space-y-6">
      {/* Category Navigation - Unboxed & Institutional */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          const count = categoryCounts[cat.id] || 0;

          if (count === 0 && cat.id !== 'Favorites') return null;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`group flex items-center gap-2.5 transition-all cursor-pointer relative py-1 px-3 rounded-xl border ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800' : 'border-transparent hover:border-slate-100 dark:hover:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
            >
              <span className={`text-sm font-bold tracking-tight transition-colors ${
                isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white'
              }`}>
                {cat.label}
              </span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full transition-all ${
                isSelected 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'
              }`}>
                {count}
              </span>
              {isSelected && (
                <motion.div 
                  layoutId="category-underline"
                  className="absolute bottom-[-4px] left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          <span>Displaying</span>
          <span className="text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-800">
            {categoryCounts[selectedCategory] || 0}
          </span>
          <span>curated titles</span>
        </div>

        {/* Sort Selector - Clean UI */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Sort by:</span>
          <div className="relative group">
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as any)}
              className="appearance-none bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-bold px-4 py-2 pr-10 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-blue-300 dark:focus:border-blue-700 focus:outline-none cursor-pointer text-xs shadow-sm transition-all"
            >
              <option value="popular" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Popularity</option>
              <option value="alpha-asc" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Alphabetical A-Z</option>
              <option value="alpha-desc" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Alphabetical Z-A</option>
              <option value="random" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Random Discovery</option>
            </select>
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
};

