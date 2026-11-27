import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { GameLibrarySelection } from '../types/game';

interface LibrarySelectorProps {
  selectedLibrary: GameLibrarySelection;
  onSelectLibrary: (library: GameLibrarySelection) => void;
}

const LIBRARIES: { id: GameLibrarySelection; label: string }[] = [
  { id: 'all', label: 'Library' },
  { id: 'gn-math', label: 'GN Math' },
  { id: 'ugs', label: 'UGS' },
  { id: 'ckv', label: 'CKV' },
];

export const LibrarySelector: React.FC<LibrarySelectorProps> = React.memo(({
  selectedLibrary,
  onSelectLibrary,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const activeLabel = LIBRARIES.find((l) => l.id === selectedLibrary)?.label || 'Library';

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Select game library (current: ${activeLabel})`}
        className={`flex items-center gap-2 min-h-[40px] sm:min-h-[42px] px-2.5 sm:px-4 rounded-xl border text-sm font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap ${
          isOpen || selectedLibrary !== 'all'
            ? 'bg-white dark:bg-[#13131c] text-slate-900 dark:text-white border-[var(--brand-blue)] ring-1 ring-[var(--brand-blue)]/30 shadow-sm'
            : 'bg-slate-100 hover:bg-slate-200/70 dark:bg-[#181824] dark:hover:bg-[#1e1e2d] text-slate-800 dark:text-slate-100 border-slate-200 dark:border-[#2a2a3c]'
        }`}
      >
        <BookOpen className="h-4 w-4 shrink-0 sm:hidden" aria-hidden="true" />
        <span className="hidden sm:inline">{activeLabel}</span>
        <ChevronDown
          className={`hidden h-4 w-4 text-slate-400 transition-transform duration-150 dark:text-slate-400 sm:block ${
            isOpen ? 'rotate-180 text-[var(--brand-blue)]' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="listbox"
            aria-label="Game libraries"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-white dark:bg-[#14141f] border border-slate-200 dark:border-white/10 shadow-xl py-1.5 z-[120] overflow-hidden"
          >
            {LIBRARIES.map((lib) => {
              const isSelected = selectedLibrary === lib.id;
              return (
                <button
                  key={lib.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onSelectLibrary(lib.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-[var(--brand-blue)]/15 text-[var(--brand-blue)] dark:bg-white/[0.08] dark:text-white'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/[0.05]'
                  }`}
                >
                  <span>{lib.label}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
