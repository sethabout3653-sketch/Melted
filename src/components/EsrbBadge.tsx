import React, { useState, useEffect } from 'react';
import { GameRatingInfo } from '../types/game';

interface EsrbBadgeProps {
  rating?: GameRatingInfo | null;
  className?: string;
}

export const EsrbBadge: React.FC<EsrbBadgeProps> = ({ rating, className = '' }) => {
  const [srcIndex, setSrcIndex] = useState<number>(0);
  const [failed, setFailed] = useState<boolean>(false);

  useEffect(() => {
    setSrcIndex(0);
    setFailed(false);
  }, [rating?.badgeUrl, rating?.officialBadgeUrl]);

  if (!rating || rating.source !== 'esrb' || (!rating.badgeUrl && !rating.officialBadgeUrl) || failed) {
    return null;
  }

  const sources = [rating.badgeUrl, rating.officialBadgeUrl].filter(Boolean);
  const currentSrc = sources[srcIndex];
  if (!currentSrc) return null;

  const tooltip = [
    `ESRB: ${rating.label} (${rating.code})`,
    rating.esrbTitle ? `Matched: ${rating.esrbTitle}` : '',
    rating.descriptors ? `Content: ${rating.descriptors}` : '',
  ]
    .filter(Boolean)
    .join(' — ');

  return (
    <div
      className={`pointer-events-none select-none overflow-hidden rounded-[2px] shadow-[0_2px_8px_rgba(0,0,0,0.75)] ${className}`}
      title={tooltip}
    >
      <img
        src={currentSrc}
        alt={`ESRB ${rating.label}`}
        loading="lazy"
        decoding="async"
        onError={() => {
          if (srcIndex + 1 < sources.length) {
            setSrcIndex(srcIndex + 1);
          } else {
            setFailed(true);
          }
        }}
        className="block w-full h-auto aspect-[2/3] object-contain"
      />
    </div>
  );
};
