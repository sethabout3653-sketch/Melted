import { useEffect, useRef, useState, useCallback } from 'react';
import { DbUser } from '../server/wsDatabase';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

interface UseWebRTCProps {
  currentUserId: string;
  activeChannel: 'text-general' | 'voice-general' | 'video-general';
  localAudioStream: MediaStream | null;
  localVideoStream?: MediaStream | null;
  cameraStream?: MediaStream | null;
  screenStream?: MediaStream | null;
  isVertical?: boolean;
  peers: DbUser[];
  sendRtcSignal: (targetUserId: string, signal: any) => void;
  setRtcSignalHandler: (fn: (fromUserId: string, signal: any) => void) => void;
  setMediaHandlers: (
    onJoined: (userId: string, channel: string) => void,
    onLeft: (userId: string, channel: string) => void
  ) => void;
}

export function useWebRTC({
  currentUserId,
  activeChannel,
  localAudioStream,
  cameraStream,
  screenStream,
  peers,
  sendRtcSignal,
  setRtcSignalHandler,
  setMediaHandlers,
}: UseWebRTCProps) {
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [remoteCameraStreams, setRemoteCameraStreams] = useState<Record<string, MediaStream>>({});
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Record<string, MediaStream>>({});
  const [remoteSpeaking, setRemoteSpeaking] = useState<Record<string, boolean>>({});

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioSenderRef = useRef<Map<string, RTCRtpSender>>(new Map());
  const cameraSenderRef = useRef<Map<string, RTCRtpSender>>(new Map());
  const screenSenderRef = useRef<Map<string, RTCRtpSender>>(new Map());
  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  const isMediaActive = activeChannel === 'voice-general' || activeChannel === 'video-general';

  // Dummy media handlers for compatibility
  useEffect(() => {
    setMediaHandlers(
      () => {},
      () => {}
    );
  }, [setMediaHandlers]);

  // Clean up all connections when leaving media channel
  useEffect(() => {
    if (!isMediaActive) {
      peerConnections.current.forEach((pc) => {
        try { pc.close(); } catch {}
      });
      peerConnections.current.clear();
      audioSenderRef.current.clear();
      cameraSenderRef.current.clear();
      screenSenderRef.current.clear();
      pendingCandidates.current.clear();
      setRemoteStreams({});
      setRemoteCameraStreams({});
      setRemoteScreenStreams({});
    }
  }, [isMediaActive]);

  // Create or get RTCPeerConnection with pre-configured transceivers for audio, camera, and screen
  const getOrCreatePeerConnection = useCallback((peerId: string) => {
    let pc = peerConnections.current.get(peerId);
    if (pc) return pc;

    pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnections.current.set(peerId, pc);

    // Pre-create transceivers so SDP always negotiates audio and video channels
    const audioTransceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });
    const cameraTransceiver = pc.addTransceiver('video', { direction: 'sendrecv' });
    const screenTransceiver = pc.addTransceiver('video', { direction: 'sendrecv' });

    if (audioTransceiver.sender) audioSenderRef.current.set(peerId, audioTransceiver.sender);
    if (cameraTransceiver.sender) cameraSenderRef.current.set(peerId, cameraTransceiver.sender);
    if (screenTransceiver.sender) screenSenderRef.current.set(peerId, screenTransceiver.sender);

    // Bind current local tracks to senders if available
    const audioTrack = localAudioStream?.getAudioTracks()[0];
    if (audioTrack && audioTransceiver.sender) {
      audioTransceiver.sender.replaceTrack(audioTrack).catch(() => {});
    }

    const camTrack = cameraStream?.getVideoTracks()[0];
    if (camTrack && cameraTransceiver.sender) {
      cameraTransceiver.sender.replaceTrack(camTrack).catch(() => {});
    }

    const screenTrack = screenStream?.getVideoTracks()[0];
    if (screenTrack && screenTransceiver.sender) {
      screenTransceiver.sender.replaceTrack(screenTrack).catch(() => {});
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendRtcSignal(peerId, { type: 'candidate', candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      const receiver = event.receiver;
      const track = event.track;

      if (!remoteStream && !track) return;

      const streamToUse = remoteStream || new MediaStream([track]);

      setRemoteStreams((prev) => ({
        ...prev,
        [peerId]: streamToUse,
      }));

      if (track.kind === 'video') {
        // Distinguish camera vs screen share based on transceiver or track properties
        const transceivers = pc?.getTransceivers() || [];
        const videoTransceivers = transceivers.filter(t => t.receiver.track && t.receiver.track.kind === 'video');
        const index = videoTransceivers.findIndex(t => t.receiver === receiver);

        if (index === 1 || track.label.toLowerCase().includes('screen') || track.label.toLowerCase().includes('window')) {
          setRemoteScreenStreams((prev) => ({
            ...prev,
            [peerId]: streamToUse,
          }));
        } else {
          setRemoteCameraStreams((prev) => ({
            ...prev,
            [peerId]: streamToUse,
          }));
        }
      }
    };

    return pc;
  }, [localAudioStream, cameraStream, screenStream, sendRtcSignal]);

  // Sync local tracks when they change
  useEffect(() => {
    const audioTrack = localAudioStream?.getAudioTracks()[0] || null;
    audioSenderRef.current.forEach((sender) => {
      sender.replaceTrack(audioTrack).catch(() => {});
    });
  }, [localAudioStream]);

  useEffect(() => {
    const camTrack = cameraStream?.getVideoTracks()[0] || null;
    cameraSenderRef.current.forEach((sender) => {
      sender.replaceTrack(camTrack).catch(() => {});
    });
  }, [cameraStream]);

  useEffect(() => {
    const screenTrack = screenStream?.getVideoTracks()[0] || null;
    screenSenderRef.current.forEach((sender) => {
      sender.replaceTrack(screenTrack).catch(() => {});
    });
  }, [screenStream]);

  // Handle incoming WebRTC signals
  useEffect(() => {
    setRtcSignalHandler(async (fromUserId, signal) => {
      if (!isMediaActive) return;
      if (fromUserId === currentUserId) return;

      const pc = getOrCreatePeerConnection(fromUserId);

      try {
        if (signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendRtcSignal(fromUserId, { type: 'answer', answer });

          // Flush queued candidates
          const queued = pendingCandidates.current.get(fromUserId) || [];
          for (const c of queued) {
            try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
          }
          pendingCandidates.current.delete(fromUserId);
        } else if (signal.type === 'answer') {
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
            const queued = pendingCandidates.current.get(fromUserId) || [];
            for (const c of queued) {
              try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
            }
            pendingCandidates.current.delete(fromUserId);
          }
        } else if (signal.type === 'candidate') {
          const candidate = new RTCIceCandidate(signal.candidate);
          if (pc.remoteDescription && pc.remoteDescription.type) {
            try { await pc.addIceCandidate(candidate); } catch {}
          } else {
            let queued = pendingCandidates.current.get(fromUserId);
            if (!queued) {
              queued = [];
              pendingCandidates.current.set(fromUserId, queued);
            }
            queued.push(signal.candidate);
          }
        }
      } catch (err) {
        console.warn('[useWebRTC] Signal handling error:', err);
      }
    });
  }, [isMediaActive, currentUserId, getOrCreatePeerConnection, sendRtcSignal, setRtcSignalHandler]);

  // Initiate calls to other peers in the channel
  useEffect(() => {
    if (!isMediaActive) return;

    peers.forEach(async (peer) => {
      if (peer.id === currentUserId) return;

      if (!peerConnections.current.has(peer.id) && currentUserId < peer.id) {
        try {
          const pc = getOrCreatePeerConnection(peer.id);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendRtcSignal(peer.id, { type: 'offer', offer });
        } catch (err) {
          console.warn('[useWebRTC] Failed to create offer:', err);
        }
      }
    });

    // Clean up connections for peers who left the channel
    const activePeerIds = new Set(peers.map((p) => p.id));
    peerConnections.current.forEach((pc, peerId) => {
      if (!activePeerIds.has(peerId) || peerId === currentUserId) {
        try { pc.close(); } catch {}
        peerConnections.current.delete(peerId);
        audioSenderRef.current.delete(peerId);
        cameraSenderRef.current.delete(peerId);
        screenSenderRef.current.delete(peerId);
        setRemoteStreams((prev) => {
          const copy = { ...prev };
          delete copy[peerId];
          return copy;
        });
        setRemoteCameraStreams((prev) => {
          const copy = { ...prev };
          delete copy[peerId];
          return copy;
        });
        setRemoteScreenStreams((prev) => {
          const copy = { ...prev };
          delete copy[peerId];
          return copy;
        });
      }
    });
  }, [isMediaActive, peers, currentUserId, getOrCreatePeerConnection, sendRtcSignal]);

  return {
    remoteStreams,
    remoteCameraStreams,
    remoteScreenStreams,
    remoteSpeaking,
  };
}
