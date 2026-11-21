import React, { useEffect } from 'react';
import { MessageSquare, X, ArrowRight, FileText, Image as ImageIcon, Music, Video as VideoIcon } from 'lucide-react';
import { InAppNotification } from '../hooks/useGlobalChat';
import { UserAvatar } from './UserAvatar';

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
  useEffect(() => {
    if (!notification) return;
    const timer = window.setTimeout(onDismiss, 6000);
    return () => window.clearTimeout(timer);
  }, [notification?.id, onDismiss]);

  if (!notification) return null;

  const renderAttachmentBadge = () => {
    if (!notification.attachment_type) return null;
    const type = notification.attachment_type.toLowerCase();
    if (type === 'image' || type === 'gif') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-cyan-500 dark:text-cyan-300 font-semibold">
          <ImageIcon className="w-3 h-3" /> Photo
        </span>
      );
    }
    if (type === 'audio') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-sky-600 dark:text-sky-400 font-semibold">
          <Music className="w-3 h-3" /> Audio Track
        </span>
      );
    }
    if (type === 'video') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
          <VideoIcon className="w-3 h-3" /> Video
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold">
        <FileText className="w-3 h-3" /> File Attachment
      </span>
    );
  };

  return (
    <div 
      role="alert"
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] lg:bottom-6 left-1/2 -translate-x-1/2 z-[300] w-[calc(100vw-1.5rem)] max-w-sm bg-white dark:bg-[#14141f] border border-slate-200 dark:border-[#2a2a3c] rounded-2xl shadow-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-4 duration-300 overflow-hidden"
    >
      <button
        type="button"
        onClick={() => {
          onOpenChat();
          onDismiss();
        }}
        className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
      >
        <div className="w-2.5 h-2.5 rounded-full bg-[var(--brand-blue)] shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
            {notification.sender_name}
          </div>
          {notification.content ? (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {notification.content}
            </div>
          ) : (
            renderAttachmentBadge()
          )}
        </div>
      </button>
      
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer shrink-0"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--brand-blue)]/80" />
    </div>
  );
};
