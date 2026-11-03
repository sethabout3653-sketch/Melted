import React, { useState, useEffect } from 'react';

interface UserAvatarProps {
  username?: string;
  avatarColor?: string;
  avatarUrl?: string;
  className?: string;
  sizeClass?: string;
  alt?: string;
  fallbackText?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  username = 'Player',
  avatarColor = '#0066ff',
  avatarUrl,
  className = '',
  sizeClass = 'w-9 h-9 text-xs',
  alt,
  fallbackText,
}) => {
  const [hasError, setHasError] = useState(false);

  // Reset error state whenever avatarUrl changes
  useEffect(() => {
    setHasError(false);
  }, [avatarUrl]);

  const cleanUrl = avatarUrl && typeof avatarUrl === 'string' ? avatarUrl.trim() : '';
  const initials = fallbackText || (username || 'P').slice(0, 2).toUpperCase();

  if (cleanUrl && !hasError) {
    return (
      <div 
        className={`${sizeClass} rounded-full overflow-hidden shrink-0 border border-black/10 dark:border-white/10 bg-slate-900 shadow-sm relative ${className}`}
      >
        <img 
          src={cleanUrl} 
          alt={alt || username} 
          className="w-full h-full object-cover select-none"
          onError={() => {
            console.warn(`[UserAvatar] Avatar failed to load for ${username}: ${cleanUrl.slice(0, 50)}...`);
            setHasError(true);
          }}
          loading="eager"
        />
      </div>
    );
  }

  // Graceful, stylish colored initials fallback
  return (
    <div 
      className={`${sizeClass} rounded-full font-extrabold flex items-center justify-center shrink-0 shadow-sm text-black select-none ${className}`}
      style={{ backgroundColor: avatarColor || '#0066ff' }}
      title={username}
    >
      {initials}
    </div>
  );
};

export default UserAvatar;
