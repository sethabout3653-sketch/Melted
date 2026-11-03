import { useEffect, useRef, useState, useCallback } from 'react';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

interface UseDirectCallWebRTCProps {
  currentUserId: string;
  activeDirectCall: {
    peerId: string;
    peerName: string;
    peerAvatarColor?: string;
    callType: 'audio' | 'video';
    isInitiator?: boolean;
    startTime: number;
  } | null;
  isMuted?: boolean;
  sendSignal: (targetUserId: string, signal: any) => void;
  setDirectSignalHandler: (handler: ((fromUserId: string, signal: any) => void) | null) => void;
  onCallEnded?: () => void;
}

export function useDirectCallWebRTC({
  currentUserId,
  activeDirectCall,
  isMuted = false,
  sendSignal,
  setDirectSignalHandler,
  onCallEnded,
}: UseDirectCallWebRTCProps) {
  const [remoteVideoStream, setRemoteVideoStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  // Setup hidden audio element for remote audio playback
  useEffect(() => {
    if (typeof document !== 'undefined' && !audioElementRef.current) {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.setAttribute('playsinline', 'true');
      audioElementRef.current = audio;
    }
    return () => {
      if (audioElementRef.current) {
        audioElementRef.current.srcObject = null;
      }
    };
  }, []);

  // Sync mute state to local audio track
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted]);

  // Main direct call peer connection setup
  useEffect(() => {
    if (!activeDirectCall || !activeDirectCall.peerId) {
      // Cleanup when direct call is null
      if (pcRef.current) {
        try { pcRef.current.close(); } catch {}
        pcRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (audioElementRef.current) {
        audioElementRef.current.srcObject = null;
      }
      setLocalStream(null);
      setRemoteVideoStream(null);
      setIsConnected(false);
      pendingCandidatesRef.current = [];
      setDirectSignalHandler(null);
      return;
    }

    let isMounted = true;
    const targetPeerId = activeDirectCall.peerId;
    const isInitiator = activeDirectCall.isInitiator ?? (currentUserId > targetPeerId);
    const isVideo = activeDirectCall.callType === 'video';

    async function initDirectCall() {
      try {
        // 1. Acquire local microphone and camera with multi-tier fallback
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          });
        } catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: true,
            });
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: false,
            });
          }
        }

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        setLocalStream(stream);

        // Enable or disable tracks based on initial call settings
        stream.getAudioTracks().forEach((t) => {
          t.enabled = !isMuted;
        });
        stream.getVideoTracks().forEach((t) => {
          t.enabled = isVideo;
        });

        // 2. Initialize RTCPeerConnection
        const pc = new RTCPeerConnection(RTC_CONFIG);
        pcRef.current = pc;

        // Add local tracks to peer connection
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Handle remote tracks
        pc.ontrack = (event) => {
          if (!isMounted) return;
          const [incomingStream] = event.streams;
          const track = event.track;

          if (track.kind === 'audio' && audioElementRef.current) {
            audioElementRef.current.srcObject = incomingStream || new MediaStream([track]);
            audioElementRef.current.play().catch((err) => {
              console.warn('[Direct Call] Audio autoPlay prompt:', err?.message);
            });
          }

          if (track.kind === 'video') {
            const vStream = incomingStream || new MediaStream([track]);
            setRemoteVideoStream(vStream);
          }
        };

        // ICE candidate generation
        pc.onicecandidate = (event) => {
          if (event.candidate && isMounted) {
            sendSignal(targetPeerId, {
              type: 'candidate',
              candidate: event.candidate.toJSON(),
            });
          }
        };

        pc.onconnectionstatechange = () => {
          if (!isMounted) return;
          const state = pc.connectionState;
          if (state === 'connected') {
            setIsConnected(true);
          } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
            setIsConnected(false);
          }
        };

        // 3. Register direct signal handler for incoming peer signals
        setDirectSignalHandler(async (fromUserId, signal) => {
          if (fromUserId !== targetPeerId || !pcRef.current) return;
          const currentPc = pcRef.current;

          try {
            if (signal.type === 'offer') {
              await currentPc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
              
              // Flush any queued candidates
              while (pendingCandidatesRef.current.length > 0) {
                const cand = pendingCandidatesRef.current.shift();
                if (cand) await currentPc.addIceCandidate(new RTCIceCandidate(cand));
              }

              const answer = await currentPc.createAnswer();
              await currentPc.setLocalDescription(answer);
              sendSignal(targetPeerId, { type: 'answer', sdp: answer.sdp });

            } else if (signal.type === 'answer') {
              await currentPc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));

              // Flush queued candidates
              while (pendingCandidatesRef.current.length > 0) {
                const cand = pendingCandidatesRef.current.shift();
                if (cand) await currentPc.addIceCandidate(new RTCIceCandidate(cand));
              }

            } else if (signal.type === 'candidate' && signal.candidate) {
              if (currentPc.remoteDescription && currentPc.remoteDescription.type) {
                await currentPc.addIceCandidate(new RTCIceCandidate(signal.candidate));
              } else {
                pendingCandidatesRef.current.push(signal.candidate);
              }
            }
          } catch (sigErr) {
            console.warn('[Direct Call] Signal handling notice:', sigErr);
          }
        });

        // 4. Initiator creates the initial offer
        if (isInitiator) {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: isVideo,
          });
          await pc.setLocalDescription(offer);
          sendSignal(targetPeerId, { type: 'offer', sdp: offer.sdp });
        }

      } catch (err) {
        console.error('[Direct Call] WebRTC init error:', err);
      }
    }

    initDirectCall();

    return () => {
      isMounted = false;
      setDirectSignalHandler(null);
      if (pcRef.current) {
        try { pcRef.current.close(); } catch {}
        pcRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (audioElementRef.current) {
        audioElementRef.current.srcObject = null;
      }
      setLocalStream(null);
      setRemoteVideoStream(null);
      setIsConnected(false);
      pendingCandidatesRef.current = [];
    };
  }, [activeDirectCall, currentUserId, sendSignal, setDirectSignalHandler]);

  return {
    localStream,
    remoteVideoStream,
    isConnected,
  };
}
