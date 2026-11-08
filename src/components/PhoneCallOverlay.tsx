import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, CameraOff, Mic, MicOff, Phone, PhoneOff } from 'lucide-react'

interface PhoneCallOverlayProps {
  incomingCall?: any
  outgoingCall?: any
  activeDirectCall?: any
  isConnected?: boolean
  localVideoStream?: MediaStream | null
  onAccept?: () => void
  onDecline?: () => void
  onEnd?: () => void
  onToggleVideo?: (enabled: boolean) => void
  onToggleMic?: (enabled: boolean) => void
}

export const PhoneCallOverlay: React.FC<PhoneCallOverlayProps> = ({
  incomingCall,
  outgoingCall,
  activeDirectCall,
  localVideoStream,
  onAccept,
  onDecline,
  onEnd,
  onToggleVideo,
  onToggleMic,
}) => {
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(false)
  const [startedAt] = useState(() => Date.now())
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const dialToneRef = useRef<HTMLAudioElement | null>(null)
  const call = incomingCall || outgoingCall || activeDirectCall
  const isIncoming = Boolean(incomingCall)
  const isActive = Boolean(activeDirectCall)
  const isVideoCall = call?.callType === 'video' || call?.media === 'video'
  const name = call?.fromUserName || call?.targetUserName || call?.peerName || 'Player'
  const avatar = call?.fromUserAvatar || call?.targetUserAvatar || call?.peerAvatar
  const initials = name.slice(0, 1).toUpperCase()

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

  useEffect(() => {
    if (localVideoRef.current && localVideoStream) {
      localVideoRef.current.srcObject = localVideoStream
      localVideoRef.current.play().catch(() => {})
    }
  }, [localVideoStream])

  const duration = useMemo(() => {
    if (!isActive) return ''
    const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  }, [isActive, startedAt])

  if (!call) return null

  const toggleMic = () => {
    const next = !isMuted
    setIsMuted(next)
    onToggleMic?.(!next)
  }

  const toggleVideo = () => {
    const next = !isVideoEnabled
    setIsVideoEnabled(next)
    onToggleVideo?.(next)
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#1b1b1f] text-[#f4f1f8]">
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-6 py-4 text-sm font-semibold tracking-wide text-white/90">
        <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <span className="text-xs text-white/75">FrostHub</span>
      </div>

      <div className={`flex h-full w-full max-w-md flex-col items-center px-8 pb-10 pt-28 text-center ${isVideoCall && isActive ? 'max-w-3xl' : ''}`}>
        {isIncoming ? (
          <>
            <p className="text-2xl font-normal text-[#e5e0eb]">Call from</p>
            <h2 className="mt-4 max-w-full truncate text-5xl font-normal tracking-tight text-[#f5f0f8]">{name}</h2>
            <div className="mt-auto flex w-full flex-col items-center gap-12">
              <div className="text-base italic text-white/55">Swipe up to answer</div>
              <div className="flex w-full items-center justify-between px-10">
                <button type="button" aria-label="Decline call" onClick={onDecline} className="flex h-20 w-20 items-center justify-center rounded-full bg-[#e5322b] shadow-lg shadow-black/25 transition hover:scale-105 hover:bg-[#f0443b]"><PhoneOff className="h-9 w-9" /></button>
                <button type="button" aria-label="Answer call" onClick={onAccept} className="flex h-20 w-20 items-center justify-center rounded-full bg-[#3f3f45] shadow-lg shadow-black/25 transition hover:scale-105 hover:bg-[#4c4c53]"><Phone className="h-9 w-9 text-[#5ad181]" /></button>
              </div>
              <div className="text-base italic text-white/20">Swipe down to decline</div>
            </div>
          </>
        ) : (
          <>
            {isVideoCall && isActive ? (
              <div className="relative mt-2 aspect-video w-full overflow-hidden rounded-3xl bg-black shadow-2xl">
                {localVideoStream && isVideoEnabled ? <video ref={localVideoRef} muted playsInline className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-7xl font-semibold text-white/80">{initials}</div>}
                <div className="absolute bottom-4 left-4 rounded-full bg-black/50 px-3 py-1 text-sm text-white">{name}</div>
              </div>
            ) : (
              <div className="mt-8 flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-400/40 to-indigo-500/30 text-5xl font-semibold text-white ring-4 ring-white/10">{avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initials}</div>
            )}
            <p className="mt-8 text-2xl font-normal text-[#c6c2ca]">{isActive ? duration : 'Calling...'}</p>
            <h2 className="mt-3 max-w-full truncate text-6xl font-normal tracking-tight">{name}</h2>
            <div className="mt-auto flex flex-col items-center gap-8">
              {isActive && <div className="flex items-center gap-6 text-white/70">
                <button type="button" aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'} onClick={toggleMic} className={`rounded-full p-4 ${isMuted ? 'bg-red-500/80' : 'bg-white/10'}`}>{isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}</button>
                {isVideoCall && <button type="button" aria-label={isVideoEnabled ? 'Turn camera off' : 'Turn camera on'} onClick={toggleVideo} className={`rounded-full p-4 ${!isVideoEnabled ? 'bg-red-500/80' : 'bg-white/10'}`}>{isVideoEnabled ? <Camera className="h-6 w-6" /> : <CameraOff className="h-6 w-6" />}</button>}
              </div>}
              <button type="button" aria-label="End call" onClick={onEnd} className="flex h-24 w-24 items-center justify-center rounded-full bg-[#e5322b] shadow-lg shadow-black/30 transition hover:scale-105 hover:bg-[#f0443b]"><PhoneOff className="h-10 w-10" /></button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
