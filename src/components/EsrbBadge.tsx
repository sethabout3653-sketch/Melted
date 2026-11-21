import React from 'react';
import { GameRatingInfo } from '../types/game';

interface EsrbBadgeProps {
  rating: GameRatingInfo;
  className?: string;
}

const HEADER_TEXT: Record<GameRatingInfo['code'], { text: string; fontSize: number; textLength: number }> = {
  E: { text: 'EVERYONE', fontSize: 12.5, textLength: 71 },
  'E10+': { text: 'EVERYONE 10+', fontSize: 11, textLength: 73 },
  T: { text: 'TEEN', fontSize: 13.5, textLength: 62 },
  M: { text: 'MATURE 17+', fontSize: 11.5, textLength: 72 },
  AO: { text: 'ADULTS ONLY 18+', fontSize: 9.8, textLength: 74 },
};

export const EsrbBadge: React.FC<EsrbBadgeProps> = ({ rating, className = '' }) => {
  const header = HEADER_TEXT[rating.code];
  const fontFamily = '"Arial Narrow", "Roboto Condensed", "Impact", "Arial Black", sans-serif';

  return (
    <div
      aria-label={`Rated ${rating.code} (${rating.label})`}
      title={`ESRB ${rating.code} · ${rating.label}${rating.descriptors ? ` (${rating.descriptors})` : ''}`}
      className={`pointer-events-none select-none inline-block shadow-[0_4px_14px_rgba(0,0,0,0.85)] rounded-[2px] overflow-hidden ${className}`}
    >
      <svg
        viewBox="0 0 88 122"
        className="w-full h-auto block"
        role="img"
        aria-hidden="true"
      >
        {/* Outer white background & classic ESRB double black frame */}
        <rect x="0" y="0" width="88" height="122" fill="#ffffff" />
        <rect x="1.5" y="1.5" width="85" height="119" fill="none" stroke="#000000" strokeWidth="1.8" />
        <rect x="4.5" y="4.5" width="79" height="113" fill="none" stroke="#000000" strokeWidth="1.8" />

        {/* Top black rating category banner */}
        <rect x="4.5" y="4.5" width="79" height="18.5" fill="#000000" />
        <text
          x="44"
          y="17.5"
          textAnchor="middle"
          fill="#ffffff"
          fontFamily={fontFamily}
          fontWeight="900"
          fontSize={header.fontSize}
          textLength={header.textLength}
          lengthAdjust="spacingAndGlyphs"
        >
          {header.text}
        </text>

        {/* Registered trademark mark inside white field */}
        <text
          x="9"
          y="33"
          fill="#000000"
          fontFamily="Arial, sans-serif"
          fontWeight="700"
          fontSize="7"
        >
          {rating.code === 'E10+' ? 'TM' : '®'}
        </text>

        {/* Classic slanted ESRB center emblem */}
        <g transform="rotate(-11 44 59)">
          {rating.code === 'E' && (
            <text
              x="44"
              y="81"
              textAnchor="middle"
              fill="#000000"
              fontFamily='"Arial Black", Impact, sans-serif'
              fontWeight="900"
              fontSize="66"
            >
              E
            </text>
          )}

          {rating.code === 'E10+' && (
            <>
              <text
                x="47"
                y="78"
                textAnchor="middle"
                fill="#000000"
                fontFamily='"Arial Black", Impact, sans-serif'
                fontWeight="900"
                fontSize="62"
              >
                E
              </text>
              <text
                x="35"
                y="84"
                textAnchor="middle"
                fill="#000000"
                stroke="#ffffff"
                strokeWidth="4.5"
                paintOrder="stroke"
                strokeLinejoin="round"
                fontFamily='"Arial Black", sans-serif'
                fontWeight="900"
                fontSize="24"
                letterSpacing="-1"
              >
                10+
              </text>
            </>
          )}

          {rating.code === 'T' && (
            <text
              x="44"
              y="82"
              textAnchor="middle"
              fill="#000000"
              fontFamily='"Arial Black", Impact, sans-serif'
              fontWeight="900"
              fontSize="68"
            >
              T
            </text>
          )}

          {rating.code === 'M' && (
            <text
              x="44"
              y="81"
              textAnchor="middle"
              fill="#000000"
              fontFamily='"Arial Black", Impact, sans-serif'
              fontWeight="900"
              fontSize="62"
              textLength="60"
              lengthAdjust="spacingAndGlyphs"
            >
              M
            </text>
          )}

          {rating.code === 'AO' && (
            <>
              <text
                x="39"
                y="82"
                textAnchor="middle"
                fill="#000000"
                fontFamily='"Arial Black", Impact, sans-serif'
                fontWeight="900"
                fontSize="64"
              >
                A
              </text>
              <text
                x="56"
                y="56"
                textAnchor="middle"
                fill="#000000"
                stroke="#ffffff"
                strokeWidth="4"
                paintOrder="stroke"
                strokeLinejoin="round"
                fontFamily='"Arial Black", Impact, sans-serif'
                fontWeight="900"
                fontSize="27"
              >
                O
              </text>
            </>
          )}
        </g>

        {/* Bottom black ESRB footer */}
        <rect x="4.5" y="94.5" width="79" height="23" fill="#000000" />
        <text
          x="44"
          y="103"
          textAnchor="middle"
          fill="#ffffff"
          fontFamily={fontFamily}
          fontWeight="800"
          fontSize="7"
          textLength="70"
          lengthAdjust="spacingAndGlyphs"
        >
          CONTENT RATED BY
        </text>
        <text
          x="44"
          y="114.5"
          textAnchor="middle"
          fill="#ffffff"
          fontFamily='"Arial Black", Impact, sans-serif'
          fontWeight="900"
          fontSize="12.5"
          textLength="68"
          lengthAdjust="spacingAndGlyphs"
        >
          ESRB
        </text>
      </svg>
    </div>
  );
};
