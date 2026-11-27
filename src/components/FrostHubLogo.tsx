import React from 'react';

interface FrostHubLogoProps {
  variant?: 'standard' | 'community';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: () => void;
}

export const FrostHubLogo: React.FC<FrostHubLogoProps> = ({
  variant = 'standard',
  size = 'md',
  className = '',
  onClick,
}) => {
  const sizeClasses = {
    sm: {
      text: 'text-xl font-black',
      badge: 'text-base font-black px-2 py-0.5 rounded-md ml-0.5',
      community: 'text-[10px] tracking-[0.4em] mt-0.5',
    },
    md: {
      text: 'text-xl sm:text-2xl lg:text-3xl font-black',
      badge: 'text-base sm:text-lg lg:text-2xl font-black px-2 sm:px-2.5 py-0.5 rounded-md sm:rounded-lg ml-0.5 sm:ml-1',
      community: 'text-[10px] sm:text-xs tracking-[0.42em] mt-0.5 sm:mt-1',
    },
    lg: {
      text: 'text-3xl sm:text-4xl font-black',
      badge: 'text-2xl sm:text-3xl font-black px-3 py-1 rounded-xl ml-1',
      community: 'text-xs sm:text-sm tracking-[0.45em] mt-1.5',
    },
    xl: {
      text: 'text-4xl sm:text-5xl font-black',
      badge: 'text-3xl sm:text-4xl font-black px-3.5 py-1 rounded-xl ml-1.5',
      community: 'text-sm sm:text-base tracking-[0.5em] mt-2',
    },
  }[size];

  return (
    <div 
      onClick={onClick}
      className={`frosthub-logo inline-flex flex-col items-center justify-center select-none leading-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ fontFamily: 'var(--app-font-family)' }}
    >
      <div className={`flex items-center tracking-tight leading-none ${sizeClasses.text}`} style={{ fontFamily: 'var(--app-font-heading)' }}>
        <span 
          className="frosthub-logo-text text-slate-900 dark:text-white tracking-tight transition-colors font-black"
          style={{ fontFamily: 'var(--app-font-heading)', fontWeight: 900 }}
        >
          Frost
        </span>
        <span 
          className={`frosthub-logo-badge bg-[var(--brand-blue)] text-white flex items-center justify-center transition-all duration-200 font-black ${sizeClasses.badge}`}
          style={{ 
            boxShadow: '0 0 14px var(--brand-blue-glow)', 
            fontFamily: 'var(--app-font-heading)',
            fontWeight: 900 
          }}
        >
          hub
        </span>
      </div>
      {variant === 'community' && (
        <span 
          className={`frosthub-logo-community text-slate-600 dark:text-slate-100 tracking-widest lowercase opacity-95 font-semibold ${sizeClasses.community}`}
          style={{ 
            fontFamily: 'var(--app-font-family)',
            fontWeight: 600 
          }}
        >
          community
        </span>
      )}
    </div>
  );
};

export default FrostHubLogo;
