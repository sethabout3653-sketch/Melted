import React, { useEffect, useState } from 'react';
import { MessageSquare, X, ArrowRight, FileText, Image as ImageIcon, Music, Video as VideoIcon } from 'lucide-react';
import { InAppNotification } from '../hooks/useGlobalChat';

interface InAppNotificationToastProps {
  notification: InAppNotification | null;
  onDismiss: () => void;
  onOpenChat: () => void;
}

export const InAppNotificationToast: React.FC<InAppNotificationToastProps> = ({
  notification,
  onDismiss,
  onOpenChat,
}) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!notification) {
      setProgress(100);
      return;
    }

    setProgress(100);
    const startTime = Date.now();
    const duration = 6000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onDismiss();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [notification?.id, onDismiss]);

  if (!notification) return null;

  const renderAttachmentBadge = () => {
    if (!notification.attachment_type) return null;
    const type = notification.attachment_type.toLowerCase();
    if (type === 'image' || type === 'gif') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-blue-400 font-semibold">
          <ImageIcon className="w-3 h-3" /> Photo
        </span>
      );
    }
    if (type === 'audio') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-sky-400 font-semibold">
          <Music className="w-3 h-3" /> Audio Track
        </span>
      );
    }
    if (type === 'video') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-indigo-400 font-semibold">
          <VideoIcon className="w-3 h-3" /> Video
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 font-semibold">
        <FileText className="w-3 h-3" /> File Attachment
      </span>
    );
  };

  return (
    <div 
      role="alert"
      className="fixed top-5 right-4 sm:right-6 z-[250] max-w-sm w-full bg-[#0d0d12]/95 border border-[#232332] rounded-2xl shadow-2xl shadow-black/80 backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200 transition-all select-none"
    >
      {/* Header Bar */}
      <div className="px-3.5 pt-3 pb-2 flex items-center justify-between border-b border-[#1b1b26] bg-[#0a0a0f]">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-400">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>New message in #general</span>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Dismiss notification"
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Message Body */}
      <div className="p-3.5 flex items-start gap-3">
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-black text-black shrink-0 shadow-md ring-2 ring-white/10"
          style={{ backgroundColor: notification.avatar_color || '#0066ff' }}
        >
          {notification.sender_name.slice(0, 2).toUpperCase()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-black text-white truncate">
              {notification.sender_name}
            </span>
            <span className="text-[10px] text-zinc-500 shrink-0">
              {notification.timestamp || 'Just now'}
            </span>
          </div>

          {notification.content ? (
            <p className="text-xs text-zinc-300 line-clamp-2 mt-1 leading-snug break-words">
              {notification.content}
            </p>
          ) : (
            <div className="mt-1">{renderAttachmentBadge()}</div>
          )}

          {/* Quick action button */}
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              onClick={() => {
                onOpenChat();
                onDismiss();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-[11px] shadow-md shadow-blue-600/30 transition-all cursor-pointer"
            >
              <span>View in Chat</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Countdown progress bar */}
      <div className="h-1 w-full bg-[#181824]">
        <div
          className="h-full bg-blue-500 transition-all duration-75"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
