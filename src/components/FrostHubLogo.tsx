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
      text: 'text-2xl sm:text-3xl font-black',
      badge: 'text-xl sm:text-2xl font-black px-2.5 py-0.5 rounded-lg ml-1',
      community: 'text-[11px] sm:text-xs tracking-[0.42em] mt-1',
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
      className={`inline-flex flex-col items-center justify-center select-none leading-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif' }}
    >
      <div className={`flex items-center tracking-tight leading-none ${sizeClasses.text}`}>
        <span className="text-white tracking-tight">Frost</span>
        <span 
          className={`bg-[var(--brand-blue)] text-[#090d16] flex items-center justify-center transition-all duration-200 ${sizeClasses.badge}`}
          style={{ boxShadow: '0 0 14px var(--brand-blue-glow)', fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif' }}
        >
          hub
        </span>
      </div>
      {variant === 'community' && (
        <span 
          className={`text-slate-100 tracking-widest lowercase opacity-95 font-medium ${sizeClasses.community}`}
          style={{ fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif' }}
        >
          community
        </span>
      )}
    </div>
  );
};

export default FrostHubLogo;
