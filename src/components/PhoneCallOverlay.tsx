import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, X } from 'lucide-react';

interface PhoneCallOverlayProps {
  incomingCall: any;
  outgoingCall: any;
  onAccept: (type: 'audio' | 'video') => void;
  onDecline: () => void;
  onCancel: () => void;
  currentUser: any;
  isVoicemail?: boolean;
  isRecording?: boolean;
}

export const PhoneCallOverlay: React.FC<PhoneCallOverlayProps> = ({
  incomingCall,
  outgoingCall,
  onAccept,
  onDecline,
  onCancel,
  currentUser,
  isVoicemail = false,
  isRecording = false
}) => {
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const outgoingOscRef = useRef<any>(null);

  // Sound Logic
  useEffect(() => {
    if (incomingCall) {
      const ringtoneUrl = 'https://assets.mixkit.co/active_storage/sfx/1344/1344-preview.mp3';
      const audio = new Audio(ringtoneUrl);
      audio.loop = true;
      audio.volume = 0.4;
      ringtoneRef.current = audio;
      audio.play().catch(() => {});
    } else if (outgoingCall && !isVoicemail) {
      // "oooooooo" sound for outgoing call using AudioContext
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(330, ctx.currentTime);
        
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(332, ctx.currentTime); // Slight detune for "oooo" feel
        
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        
        osc1.start();
        osc2.start();
        outgoingOscRef.current = { osc: [osc1, osc2], ctx };
      } catch {}
    }

    return () => {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current = null;
      }
      if (outgoingOscRef.current) {
        try {
          if (Array.isArray(outgoingOscRef.current.osc)) {
            outgoingOscRef.current.osc.forEach((o: any) => o.stop());
          } else {
            outgoingOscRef.current.osc.stop();
          }
          outgoingOscRef.current.ctx.close();
        } catch {}
        outgoingOscRef.current = null;
      }
    };
  }, [incomingCall, outgoingCall, isVoicemail]);

  if (!incomingCall && !outgoingCall) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-2xl"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="w-full max-w-sm bg-white/5 border border-white/10 rounded-[40px] overflow-hidden shadow-2xl flex flex-col items-center py-12 px-8 relative"
        >
          {/* Status Indicator */}
          <div className="absolute top-6 right-8 flex items-center gap-2 opacity-40">
            {isRecording && (
              <div className="flex items-center gap-1.5 bg-red-500/20 px-2 py-0.5 rounded-full border border-red-500/30">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                <span className="text-[8px] text-red-400 font-bold uppercase">REC</span>
              </div>
            )}
            <span className="text-[10px] text-white font-bold uppercase tracking-widest">HD Voice</span>
          </div>

          {/* User Avatar Section */}
          <div className="relative mb-8">
            <motion.div
              animate={{ 
                scale: [1, 1.05, 1],
                boxShadow: isVoicemail ? ["0 0 0px rgba(239,68,68,0)", "0 0 40px rgba(239,68,68,0.2)", "0 0 0px rgba(239,68,68,0)"] : ["0 0 0px rgba(255,255,255,0)", "0 0 40px rgba(255,255,255,0.2)", "0 0 0px rgba(255,255,255,0)"]
              }}
              transition={{ repeat: Infinity, duration: 2 }}
              className={`w-32 h-32 rounded-full overflow-hidden border-4 ${isVoicemail ? 'border-red-500/30' : 'border-white/20'} p-1`}
            >
              <div 
                className="w-full h-full rounded-full flex items-center justify-center text-3xl font-black text-black"
                style={{ backgroundColor: (incomingCall?.fromAvatarColor || outgoingCall?.targetAvatarColor || '#0066ff') }}
              >
                {(incomingCall?.fromUserName || outgoingCall?.targetUserName || '?').slice(0, 1).toUpperCase()}
              </div>
            </motion.div>
          </div>

          {/* Caller Name & Status */}
          <div className="text-center space-y-2 mb-16">
            <h2 className="text-3xl font-bold text-white tracking-tight">
              {incomingCall?.fromUserName || outgoingCall?.targetUserName}
            </h2>
            <div className="flex flex-col items-center">
              <span className={`font-bold text-xs uppercase tracking-widest animate-pulse ${isVoicemail ? 'text-red-400' : 'text-blue-400'}`}>
                {isVoicemail ? 'LEAVING A MESSAGE' : incomingCall ? `${incomingCall.callType.toUpperCase()} CALL` : 'CALLING...'}
              </span>
              {isVoicemail && (
                <span className="text-white/40 text-[10px] font-medium mt-1">
                  Wait for the tone to record
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full flex items-center justify-around">
            {incomingCall ? (
              <>
                {/* Decline */}
                <div className="flex flex-col items-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={onDecline}
                    className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-600/30 cursor-pointer"
                  >
                    <PhoneOff className="w-8 h-8" />
                  </motion.button>
                  <span className="text-white/60 text-[10px] font-bold uppercase tracking-wider">Decline</span>
                </div>

                {/* Accept */}
                <div className="flex flex-col items-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onAccept(incomingCall.callType)}
                    className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 cursor-pointer"
                  >
                    <Phone className="w-8 h-8" />
                  </motion.button>
                  <span className="text-white/60 text-[10px] font-bold uppercase tracking-wider">Accept</span>
                </div>
              </>
            ) : (
              <>
                {/* Cancel Outgoing or Stop Voicemail */}
                <div className="flex flex-col items-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={onCancel}
                    className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-600/30 cursor-pointer"
                  >
                    {isVoicemail ? <X className="w-8 h-8" /> : <PhoneOff className="w-8 h-8" />}
                  </motion.button>
                  <span className="text-white/60 text-[10px] font-bold uppercase tracking-wider">
                    {isVoicemail ? 'End' : 'Cancel'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Extra Phone UI Elements */}
          <div className="mt-16 grid grid-cols-3 gap-8 opacity-20 pointer-events-none">
            <div className="flex flex-col items-center gap-2">
              <Mic className="w-5 h-5 text-white" />
              <span className="text-[8px] text-white font-bold uppercase">Mute</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Volume2 className="w-5 h-5 text-white" />
              <span className="text-[8px] text-white font-bold uppercase">Speaker</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Video className="w-5 h-5 text-white" />
              <span className="text-[8px] text-white font-bold uppercase">Video</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
