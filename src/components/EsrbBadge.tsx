import React from 'react';
import { EsrbRatingCode, GameRatingInfo } from '../types/game';

interface EsrbBadgeProps {
  rating?: GameRatingInfo | null;
  className?: string;
}

interface BadgeTheme {
  accent: string;
  accentDark: string;
  text: string;
  ageText: string;
  tierText: string;
}

const BADGE_THEMES: Record<EsrbRatingCode, BadgeTheme> = {
  E: {
    accent: '#10b981',
    accentDark: '#047857',
    text: '#ecfdf5',
    ageText: 'ALL',
    tierText: 'SAFE',
  },
  'E10+': {
    accent: '#0ea5e9',
    accentDark: '#0369a1',
    text: '#f0f9ff',
    ageText: '10+',
    tierText: 'MILD',
  },
  T: {
    accent: '#f59e0b',
    accentDark: '#b45309',
    text: '#fffbeb',
    ageText: '13+',
    tierText: 'TEEN',
  },
  M: {
    accent: '#f43f5e',
    accentDark: '#be123c',
    text: '#fff1f2',
    ageText: '17+',
    tierText: 'MATURE',
  },
  AO: {
    accent: '#dc2626',
    accentDark: '#7f1d1d',
    text: '#fef2f2',
    ageText: '18+',
    tierText: 'ADULT',
  },
  RP: {
    accent: '#64748b',
    accentDark: '#334155',
    text: '#f8fafc',
    ageText: 'TBD',
    tierText: 'PENDING',
  },
};

export const EsrbBadge: React.FC<EsrbBadgeProps> = ({ rating, className = '' }) => {
  if (!rating || !rating.code) {
    return null;
  }

  const theme = BADGE_THEMES[rating.code] || BADGE_THEMES.E;
  const isCompactCode = rating.code === 'E10+';

  const tooltip = [
    `Rating: ${rating.label} (${rating.code})`,
    rating.esrbTitle ? `Matched: ${rating.esrbTitle}` : '',
    rating.descriptors ? `Content: ${rating.descriptors}` : '',
  ]
    .filter(Boolean)
    .join(' — ');

  return (
    <div
      className={`pointer-events-none select-none inline-block drop-shadow-[0_3px_8px_rgba(0,0,0,0.65)] ${className}`}
      title={tooltip}
      aria-label={`Content rating ${rating.label} (${rating.code})`}
      role="img"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 48 56"
        className="block w-full h-auto"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`fh-rate-${rating.code}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={theme.accent} />
            <stop offset="100%" stopColor={theme.accentDark} />
          </linearGradient>
        </defs>
        {/* Outer shield-pill frame */}
        <rect
          x="1.5"
          y="1.5"
          width="45"
          height="53"
          rx="10"
          fill="#0b1120"
          stroke={theme.accent}
          strokeWidth="2.5"
        />
        {/* Top age band */}
        <path
          d="M 4 11.5 C 4 6.8 6.8 4 11.5 4 L 36.5 4 C 41.2 4 44 6.8 44 11.5 L 44 16 L 4 16 Z"
          fill={`url(#fh-rate-${rating.code})`}
        />
        <text
          x="24"
          y="12.8"
          textAnchor="middle"
          fill="#ffffff"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="800"
          fontSize="8.5"
          letterSpacing="0.8"
        >
          {theme.ageText}
        </text>

        {/* Center rating code */}
        <text
          x="24"
          y={isCompactCode ? '35.5' : '37'}
          textAnchor="middle"
          fill={theme.text}
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize={isCompactCode ? '14.5' : '21'}
          letterSpacing={isCompactCode ? '-0.6' : '0'}
        >
          {rating.code}
        </text>

        {/* Bottom tier pill */}
        <rect
          x="6"
          y="42"
          width="36"
          height="9"
          rx="4.5"
          fill={theme.accent}
          fillOpacity="0.22"
        />
        <text
          x="24"
          y="48.5"
          textAnchor="middle"
          fill={theme.accent}
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="800"
          fontSize="6.4"
          letterSpacing="0.7"
        >
          {theme.tierText}
        </text>
      </svg>
    </div>
  );
};
