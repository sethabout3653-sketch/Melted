import React from 'react';
import { GameRatingInfo } from '../types/game';

interface EsrbBadgeProps {
  rating?: GameRatingInfo | string;
  className?: string;
}

export const EsrbBadge: React.FC<EsrbBadgeProps> = ({ rating, className = '' }) => {
  const code = typeof rating === 'string' ? rating : (rating?.code || 'E');
  const label = typeof rating === 'string' ? rating : (rating?.label || 'Everyone');

  const getBg = (c: string) => {
    switch (c.toUpperCase()) {
      case 'AO': return 'bg-red-950 text-red-200 border-red-600';
      case 'M': return 'bg-red-900 text-red-100 border-red-500';
      case 'T': return 'bg-amber-950 text-amber-200 border-amber-600';
      case 'E10+': return 'bg-blue-950 text-blue-200 border-blue-600';
      default: return 'bg-emerald-950 text-emerald-200 border-emerald-600';
    }
  };

  return (
    <div className={`inline-flex items-center justify-center px-2 py-0.5 rounded border text-[10px] font-bold shadow-sm ${getBg(code)} ${className}`} title={label}>
      {code}
    </div>
  );
};
