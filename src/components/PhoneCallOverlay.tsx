import React, { useEffect, useRef } from 'react'
import { Phone, PhoneOff, MessageSquare, Mic, MicOff, Volume2 } from 'lucide-react'

interface PhoneCallOverlayProps {
  incomingCall?: any
  outgoingCall?: any
  activeDirectCall?: any
  isConnected?: boolean
  onAccept?: () => void
  onDecline?: () => void
  onEnd?: () => void
  isLoading?: boolean
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
  const dialToneRef = useRef<HTMLAudioElement | null>(null)
  const call = incomingCall || outgoingCall || activeDirectCall
  const isIncoming = Boolean(incomingCall)
  const isActive = Boolean(activeDirectCall)

  useEffect(() => {
    if (!outgoingCall || isActive) return
    const audio = new Audio('/assets/aistudio/iphone_6_original_19117f02.mp3')
    audio.loop = true
    audio.volume = 0.35
    dialToneRef.current = audio
    audio.play().catch(() => {})
    return () => {
      audio.pause()
      audio.currentTime = 0
      dialToneRef.current = null
    }
  }, [outgoingCall, isActive])

  if (!call) return null

  const name = call.fromUserName || call.targetUserName || call.peerName || 'Player'
  const avatar = call.fromUserAvatar || call.targetUserAvatar || call.peerAvatar
  const initials = name.slice(0, 1).toUpperCase()

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#1b1b1f] text-[#f4f1f8]">
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-6 py-4 text-sm font-semibold tracking-wide text-white/90">
        <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <span className="flex items-center gap-2 text-xs text-white/75"><span className="h-2 w-2 rounded-full bg-emerald-400" /> FrostHub</span>
      </div>

      <div className="flex h-full w-full max-w-md flex-col items-center px-8 pb-10 pt-28 text-center">
        {isIncoming ? (
          <>
            <p className="text-2xl font-normal text-[#e5e0eb]">Call from</p>
            <h2 className="mt-4 max-w-full truncate text-5xl font-normal tracking-tight text-[#f5f0f8]">{name}</h2>
            <div className="mt-auto flex w-full flex-col items-center gap-12">
              <button type="button" onClick={() => {}} className="flex items-center gap-3 rounded-xl border border-white/30 px-5 py-3 text-lg font-medium text-[#e4dff0] transition hover:bg-white/10">
                <MessageSquare className="h-5 w-5 text-[#cfc1fa]" /> Message
              </button>
              <div className="text-base italic text-white/55">Swipe up to answer</div>
              <div className="flex w-full items-center justify-between px-10">
                <button type="button" aria-label="Decline call" onClick={onDecline} className="flex h-20 w-20 items-center justify-center rounded-full bg-[#e5322b] shadow-lg shadow-black/25 transition hover:scale-105 hover:bg-[#f0443b]">
                  <PhoneOff className="h-9 w-9" />
                </button>
                <button type="button" aria-label="Answer call" onClick={onAccept} className="flex h-20 w-20 items-center justify-center rounded-full bg-[#3f3f45] shadow-lg shadow-black/25 transition hover:scale-105 hover:bg-[#4c4c53]">
                  <Phone className="h-9 w-9 text-[#5ad181]" />
                </button>
              </div>
              <div className="text-base italic text-white/20">Swipe down to decline</div>
            </div>
          </>
        ) : (
          <>
            <div className="mt-8 flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-400/40 to-indigo-500/30 text-5xl font-semibold text-white ring-4 ring-white/10">
              {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initials}
            </div>
            <p className="mt-8 text-2xl font-normal text-[#c6c2ca]">{isActive ? (isConnected ? 'Connected' : 'Connecting...') : 'Calling...'}</p>
            <h2 className="mt-3 max-w-full truncate text-6xl font-normal tracking-tight">{name}</h2>
            <div className="mt-auto flex flex-col items-center gap-8">
              {isActive && <div className="flex items-center gap-6 text-white/70"><button type="button" aria-label="Toggle microphone" className="rounded-full bg-white/10 p-4"><Mic className="h-6 w-6" /></button><button type="button" aria-label="Toggle speaker" className="rounded-full bg-white/10 p-4"><Volume2 className="h-6 w-6" /></button></div>}
              <button type="button" aria-label="End call" onClick={onEnd} className="flex h-24 w-24 items-center justify-center rounded-full bg-[#e5322b] shadow-lg shadow-black/30 transition hover:scale-105 hover:bg-[#f0443b]"><PhoneOff className="h-10 w-10" /></button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
