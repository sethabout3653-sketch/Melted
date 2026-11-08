import React, { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video, Mic, MicOff, Volume2 } from 'lucide-react';

interface PhoneCallOverlayProps {
  incomingCall?: any;
  outgoingCall?: any;
  activeDirectCall?: any;
  isConnected?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onEnd?: () => void;
  isLoading?: boolean;
}

export const PhoneCallOverlay: React.FC<PhoneCallOverlayProps> = ({
  incomingCall,
  outgoingCall,
  activeDirectCall,
  isConnected,
  onAccept,
  onDecline,
  onEnd,
}) => {
  const dialToneRef = useRef<HTMLAudioElement | null>(null);
  const call = incomingCall || outgoingCall || activeDirectCall;
  const isIncoming = Boolean(incomingCall);
  const isActive = Boolean(activeDirectCall);

  useEffect(() => {
    if (!outgoingCall || isActive) return;
    const audio = new Audio('/assets/aistudio/iphone_6_original_19117f02.mp3');
    audio.loop = true;
    audio.volume = 0.35;
    dialToneRef.current = audio;
    audio.play().catch(() => {});
    return () => {
      audio.pause();
      audio.currentTime = 0;
      dialToneRef.current = null;
    };
  }, [outgoingCall, isActive]);

  if (!call) return null;

  const name = call.fromUserName || call.targetUserName || call.peerName || 'Player';
  const callType = call.callType || 'audio';

  return (
    <div className="fixed inset-x-4 top-20 z-[90] mx-auto max-w-sm rounded-3xl border border-cyan-400/30 bg-slate-950/95 p-5 text-white shadow-2xl shadow-cyan-950/40 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-300">
          {callType === 'video' ? <Video className="h-6 w-6" /> : <Phone className="h-6 w-6" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
            {isIncoming ? 'Incoming call' : isActive ? (isConnected ? 'Connected' : 'Connecting') : 'Calling'}
          </p>
          <p className="truncate text-lg font-bold">{name}</p>
        </div>
        {isActive && <Volume2 className="h-5 w-5 text-emerald-300" />}
      </div>
      {!isActive && <p className="mt-4 text-sm text-slate-400">{isIncoming ? 'Someone is calling you.' : 'Waiting for them to answer...'}</p>}
      <div className="mt-5 flex gap-3">
        {isIncoming ? (
          <>
            <button type="button" onClick={onDecline} className="flex-1 rounded-2xl bg-rose-500/90 px-4 py-3 text-sm font-bold hover:bg-rose-400"><PhoneOff className="mr-2 inline h-4 w-4" />Decline</button>
            <button type="button" onClick={onAccept} className="flex-1 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-bold hover:bg-emerald-400"><Phone className="mr-2 inline h-4 w-4" />Answer</button>
          </>
        ) : (
          <button type="button" onClick={onEnd} className="w-full rounded-2xl bg-rose-500/90 px-4 py-3 text-sm font-bold hover:bg-rose-400"><PhoneOff className="mr-2 inline h-4 w-4" />End call</button>
        )}
      </div>
    </div>
  );
};
