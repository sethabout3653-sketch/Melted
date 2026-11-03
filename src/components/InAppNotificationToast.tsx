import React, { useEffect, useState } from 'react';
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
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] w-[90%] max-w-sm bg-white rounded-xl shadow-lg p-4 flex items-center justify-between animate-in slide-in-from-bottom-4 duration-300"
    >
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-blue-500" />
        <span className="text-sm font-medium text-slate-900">
          New message from {notification.sender_name}
        </span>
      </div>
      
      <button
        onClick={onDismiss}
        className="p-1 rounded-full hover:bg-slate-100 text-slate-400 transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>

      {/* View trigger (invisible but functional for the whole toast) */}
      <div 
        className="absolute inset-0 right-10 cursor-pointer" 
        onClick={() => {
          onOpenChat();
          onDismiss();
        }}
      />
    </div>
  );
};
