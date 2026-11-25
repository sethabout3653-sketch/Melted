import { useEffect, useRef, useState, useCallback } from 'react';
import { DbUser } from '../server/wsDatabase';

const env = (import.meta as any).env || {};
const customTurnUrls: string[] = String(env.VITE_TURN_URLS || '')
  .split(',')
  .map((s: string) => s.trim())
  .filter(Boolean);

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  {
    urls: [
      'stun:stun.cloudflare.com:3478',
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
      'stun:stun.relay.metered.ca:80',
    ],
  },
  ...(customTurnUrls.length
    ? [
        {
          urls: customTurnUrls,
          username: env.VITE_TURN_USERNAME || '',
          credential: env.VITE_TURN_CREDENTIAL || '',
        },
      ]
    : []),
  {
    urls: [
      'turn:global.relay.metered.ca:80',
      'turn:global.relay.metered.ca:80?transport=tcp',
      'turn:global.relay.metered.ca:443',
      'turn:global.relay.metered.ca:443?transport=tcp',
      'turns:global.relay.metered.ca:443?transport=tcp',
      'turn:standard.relay.metered.ca:80',
      'turn:standard.relay.metered.ca:80?transport=tcp',
      'turn:standard.relay.metered.ca:443',
      'turn:standard.relay.metered.ca:443?transport=tcp',
      'turns:standard.relay.metered.ca:443?transport=tcp',
      'turn:a.relay.metered.ca:80?transport=tcp',
      'turn:a.relay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

const DEFAULT_RTC_CONFIG: RTCConfiguration = {
  iceServers: DEFAULT_ICE_SERVERS,
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceCandidatePoolSize: 8,
};

let cachedDynamicIceServers: RTCIceServer[] | null = null;
let lastIceFetchAt = 0;
let inflightIcePromise: Promise<RTCIceServer[]> | null = null;

async function fetchDynamicIceServers(force = false): Promise<RTCIceServer[]> {
  const now = Date.now();
  if (!force && cachedDynamicIceServers && now - lastIceFetchAt < 8 * 60 * 1000) {
    return cachedDynamicIceServers;
  }
  if (inflightIcePromise) return inflightIcePromise;

  inflightIcePromise = (async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch('/api/webrtc/ice-servers', {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.iceServers) && data.iceServers.length > 0) {
          cachedDynamicIceServers = data.iceServers;
          lastIceFetchAt = Date.now();
          return data.iceServers as RTCIceServer[];
        }
      }
    } catch {}
    return cachedDynamicIceServers || DEFAULT_ICE_SERVERS;
  })().finally(() => {
    inflightIcePromise = null;
  });

  return inflightIcePromise;
}

// Optimizes Opus SDP for ultra-low-latency VBR stereo music/screen audio + FEC without starving weak WiFi
function optimizeAudioSdp(sdp: string): string {
  if (!sdp) return sdp;
  const opusMatch = sdp.match(/a=rtpmap:(\d+)\s+opus\/48000/i);
  const opusPt = opusMatch ? opusMatch[1] : null;

  const lines = sdp.split('\r\n');
  let foundFmtp = false;

  const upsertFmtpParam = (line: string, key: string, value: string): string => {
    const regex = new RegExp(`([ ;])${key}=[^;\\s]+`, 'g');
    if (regex.test(line)) {
      return line.replace(regex, `$1${key}=${value}`);
    }
    return `${line};${key}=${value}`;
  };

  const modifiedLines = lines.map((line) => {
    if (opusPt && line.startsWith(`a=fmtp:${opusPt}`)) {
      foundFmtp = true;
      let params = line.replace(/([ ;])cbr=[^;\s]+/g, '');
      params = upsertFmtpParam(params, 'minptime', '10');
      params = upsertFmtpParam(params, 'useinbandfec', '1');
      params = upsertFmtpParam(params, 'usedtx', '0');
      params = upsertFmtpParam(params, 'stereo', '1');
      params = upsertFmtpParam(params, 'sprop-stereo', '1');
      params = upsertFmtpParam(params, 'maxaveragebitrate', '256000');
      return params;
    }
    return line;
  });

  if (opusPt && !foundFmtp) {
    const rtpmapIdx = modifiedLines.findIndex((l) => l.startsWith(`a=rtpmap:${opusPt}`));
    if (rtpmapIdx !== -1) {
      modifiedLines.splice(
        rtpmapIdx + 1,
        0,
        `a=fmtp:${opusPt} minptime=10;useinbandfec=1;usedtx=0;stereo=1;sprop-stereo=1;maxaveragebitrate=256000`
      );
    }
  }

  return modifiedLines.join('\r\n');
}

interface PeerTrackMeta {
  micAudioTrackId?: string | null;
  screenAudioTrackId?: string | null;
  camTrackId?: string | null;
  screenTrackId?: string | null;
  micMid?: string | null;
  screenAudioMid?: string | null;
  camMid?: string | null;
  screenMid?: string | null;
  hasCamera?: boolean;
  isScreenSharing?: boolean;
  hasScreenAudio?: boolean;
  isMuted?: boolean;
}

interface PeerConnectionBundle {
  pc: RTCPeerConnection;
  createdAt: number;
  iceTransportPolicy: RTCIceTransportPolicy;
  audioSender: RTCRtpSender | null;       // Microphone audio (kept apart)
  screenAudioSender: RTCRtpSender | null; // Screen share system audio (kept apart)
  camSender: RTCRtpSender | null;         // Camera video
  screenSender: RTCRtpSender | null;      // Screen share video
  camBitrate: number;
  screenBitrate: number;
}

interface RemoteTrackEntry {
  track: MediaStreamTrack;
  stream: MediaStream;
  mid: string | null;
}

interface UseWebRTCProps {
  currentUserId: string;
  activeChannel: 'text-general' | 'voice-general' | 'video-general';
  localAudioStream: MediaStream | null;
  localVideoStream?: MediaStream | null;
  cameraStream?: MediaStream | null;
  screenStream?: MediaStream | null;
  isMuted?: boolean;
  isVertical?: boolean;
  peers: DbUser[];
  sendRtcSignal: (targetUserId: string, signal: any) => void;
  setRtcSignalHandler: (fn: (fromUserId: string, signal: any) => void) => void;
  setMediaHandlers: (
    onJoined: (userId: string, channel: string) => void,
    onLeft: (userId: string, channel: string) => void
  ) => void;
}

function configureCameraSenderParams(sender: RTCRtpSender, maxBitrate = 3_500_000) {
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
    params.encodings.forEach((enc) => {
      enc.maxFramerate = 60;
      enc.maxBitrate = maxBitrate;
      enc.scaleResolutionDownBy = 1.0;
      (enc as any).priority = 'high';
      (enc as any).networkPriority = 'high';
    });
    if ('degradationPreference' in params) {
      (params as any).degradationPreference = 'maintain-framerate';
    }
    sender.setParameters(params).catch(() => {});
  } catch {}
}

function configureScreenSenderParams(sender: RTCRtpSender, maxBitrate = 5_000_000) {
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
    params.encodings.forEach((enc) => {
      enc.maxFramerate = 60;
      enc.maxBitrate = maxBitrate;
      enc.scaleResolutionDownBy = 1.0;
      (enc as any).priority = 'high';
      (enc as any).networkPriority = 'high';
    });
    if ('degradationPreference' in params) {
      (params as any).degradationPreference = 'maintain-framerate';
    }
    sender.setParameters(params).catch(() => {});
  } catch {}
}

function configureAudioSenderParams(sender: RTCRtpSender, isScreenAudio: boolean) {
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
    params.encodings.forEach((enc) => {
      enc.maxBitrate = isScreenAudio ? 256_000 : 96_000;
      (enc as any).priority = 'high';
      (enc as any).networkPriority = 'high';
    });
    sender.setParameters(params).catch(() => {});
  } catch {}
}

function preferLowLatencyVideoCodecs(pc: RTCPeerConnection, sender: RTCRtpSender | null) {
  if (!sender) return;
  try {
    const transceiver = pc.getTransceivers().find((t) => t.sender === sender);
    if (!transceiver || typeof transceiver.setCodecPreferences !== 'function') return;
    const senderCaps =
      typeof RTCRtpSender !== 'undefined' && typeof RTCRtpSender.getCapabilities === 'function'
        ? RTCRtpSender.getCapabilities('video')
        : null;
    const receiverCaps =
      typeof RTCRtpReceiver !== 'undefined' && typeof RTCRtpReceiver.getCapabilities === 'function'
        ? RTCRtpReceiver.getCapabilities('video')
        : null;
    const caps = senderCaps || receiverCaps;
    if (!caps?.codecs?.length) return;

    const scoreCodec = (mime: string) => {
      const m = mime.toLowerCase();
      if (m === 'video/h264') return 0;
      if (m === 'video/vp8') return 1;
      if (m === 'video/vp9') return 2;
      if (m === 'video/av1') return 4;
      if (m === 'video/rtx' || m === 'video/red' || m === 'video/ulpfec') return 5;
      return 3;
    };

    const sorted = [...caps.codecs].sort((a, b) => scoreCodec(a.mimeType) - scoreCodec(b.mimeType));
    transceiver.setCodecPreferences(sorted);
  } catch {}
}

function applyLowLatencyReceiverParams(receiver: RTCRtpReceiver | undefined) {
  if (!receiver) return;
  try {
    if ('playoutDelayHint' in receiver) {
      (receiver as any).playoutDelayHint = 0;
    }
    if ('jitterBufferTarget' in receiver) {
      (receiver as any).jitterBufferTarget = 0;
    }
  } catch {}
}

function getTransceiverMidForSender(pc: RTCPeerConnection, sender: RTCRtpSender | null): string | null {
  if (!sender) return null;
  const transceiver = pc.getTransceivers().find((t) => t.sender === sender);
  return transceiver?.mid ?? null;
}

function hasUnnegotiatedLocalTracks(bundle: PeerConnectionBundle): boolean {
  const pc = bundle.pc;
  const transceivers = pc.getTransceivers();
  const senders = [bundle.audioSender, bundle.screenAudioSender, bundle.camSender, bundle.screenSender];
  for (const sender of senders) {
    if (sender && sender.track && sender.track.readyState === 'live') {
      const t = transceivers.find((tr) => tr.sender === sender);
      if (!t || t.mid === null) {
        return true;
      }
    }
  }
  return false;
}

export function useWebRTC({
  currentUserId,
  activeChannel,
  localAudioStream,
  cameraStream,
  screenStream,
  isMuted = false,
  peers,
  sendRtcSignal,
  setRtcSignalHandler,
  setMediaHandlers,
}: UseWebRTCProps) {
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [remoteScreenAudioStreams, setRemoteScreenAudioStreams] = useState<Record<string, MediaStream>>({});
  const [remoteCameraStreams, setRemoteCameraStreams] = useState<Record<string, MediaStream>>({});
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Record<string, MediaStream>>({});
  const [remoteSpeaking, setRemoteSpeaking] = useState<Record<string, boolean>>({});

  const peerBundles = useRef<Map<string, PeerConnectionBundle>>(new Map());
  const peerTrackMetas = useRef<Map<string, PeerTrackMeta>>(new Map());
  const prevPeerMediaFlags = useRef<Map<string, { has_video: boolean; is_screen_sharing: boolean }>>(new Map());

  const remoteAudioTracks = useRef<Map<string, Map<string, RemoteTrackEntry>>>(new Map());
  const remoteVideoTracks = useRef<Map<string, Map<string, RemoteTrackEntry>>>(new Map());

  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const isNegotiatingRef = useRef<Map<string, boolean>>(new Map());
  const pendingRenegotiatePeersRef = useRef<Set<string>>(new Set());
  const lastSentMetaRef = useRef<Map<string, string>>(new Map());
  const fallbackTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const earlySignalsRef = useRef<{ fromUserId: string; signal: any; receivedAt: number }[]>([]);
  const signalQueuesRef = useRef<Map<string, Promise<void>>>(new Map());
  const iceFailureCountRef = useRef<Map<string, number>>(new Map());
  const forcedRelayPeersRef = useRef<Set<string>>(new Set());
  const dynamicIceServersRef = useRef<RTCIceServer[]>(cachedDynamicIceServers || DEFAULT_ICE_SERVERS);
  const renegotiateRef = useRef<(peerId: string) => void>(() => {});
  const processSignalRef = useRef<(fromUserId: string, signal: any) => Promise<void>>(async () => {});

  const peersRef = useRef(peers);
  peersRef.current = peers;

  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;

  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const localAudioRef = useRef(localAudioStream);
  localAudioRef.current = localAudioStream;

  const cameraStreamRef = useRef(cameraStream);
  cameraStreamRef.current = cameraStream;

  const screenStreamRef = useRef(screenStream);
  screenStreamRef.current = screenStream;

  const isMediaActive = activeChannel === 'voice-general' || activeChannel === 'video-general';
  const isMediaActiveRef = useRef(isMediaActive);
  isMediaActiveRef.current = isMediaActive;

  const buildLocalMetaFields = useCallback((bundle?: PeerConnectionBundle | null) => {
    const micTrack = localAudioRef.current?.getAudioTracks()[0] || null;
    const screenAudioTrack = screenStreamRef.current?.getAudioTracks()[0] || null;
    const camTrack = cameraStreamRef.current?.getVideoTracks()[0] || null;
    const screenTrack = screenStreamRef.current?.getVideoTracks()[0] || null;

    const pc = bundle?.pc;
    return {
      micAudioTrackId: micTrack?.id || null,
      screenAudioTrackId: screenAudioTrack?.id || null,
      camTrackId: camTrack?.id || null,
      screenTrackId: screenTrack?.id || null,
      micMid: pc && bundle ? getTransceiverMidForSender(pc, bundle.audioSender) : null,
      screenAudioMid: pc && bundle ? getTransceiverMidForSender(pc, bundle.screenAudioSender) : null,
      camMid: pc && bundle ? getTransceiverMidForSender(pc, bundle.camSender) : null,
      screenMid: pc && bundle ? getTransceiverMidForSender(pc, bundle.screenSender) : null,
      hasCamera: Boolean(camTrack && camTrack.enabled && camTrack.readyState === 'live'),
      isScreenSharing: Boolean(screenTrack && screenTrack.enabled && screenTrack.readyState === 'live'),
      hasScreenAudio: Boolean(screenAudioTrack && screenAudioTrack.enabled && screenAudioTrack.readyState === 'live'),
      isMuted: isMutedRef.current,
    };
  }, []);

  const clearPeerState = useCallback((peerId: string) => {
    const timer = fallbackTimersRef.current.get(peerId);
    if (timer) {
      clearTimeout(timer);
      fallbackTimersRef.current.delete(peerId);
    }
    const bundle = peerBundles.current.get(peerId);
    if (bundle) {
      try { bundle.pc.close(); } catch {}
      peerBundles.current.delete(peerId);
    }
    lastSentMetaRef.current.delete(peerId);
    pendingRenegotiatePeersRef.current.delete(peerId);
    peerTrackMetas.current.delete(peerId);
    prevPeerMediaFlags.current.delete(peerId);
    remoteAudioTracks.current.delete(peerId);
    remoteVideoTracks.current.delete(peerId);
    pendingCandidates.current.delete(peerId);
    makingOfferRef.current.delete(peerId);
    isNegotiatingRef.current.delete(peerId);
    signalQueuesRef.current.delete(peerId);
    iceFailureCountRef.current.delete(peerId);
    forcedRelayPeersRef.current.delete(peerId);

    setRemoteStreams((prev) => {
      if (!prev[peerId]) return prev;
      const copy = { ...prev };
      delete copy[peerId];
      return copy;
    });
    setRemoteScreenAudioStreams((prev) => {
      if (!prev[peerId]) return prev;
      const copy = { ...prev };
      delete copy[peerId];
      return copy;
    });
    setRemoteCameraStreams((prev) => {
      if (!prev[peerId]) return prev;
      const copy = { ...prev };
      delete copy[peerId];
      return copy;
    });
    setRemoteScreenStreams((prev) => {
      if (!prev[peerId]) return prev;
      const copy = { ...prev };
      delete copy[peerId];
      return copy;
    });
    setRemoteSpeaking((prev) => {
      if (!prev[peerId]) return prev;
      const copy = { ...prev };
      delete copy[peerId];
      return copy;
    });
  }, []);

  // Route audio tracks for a given peer (distinguishing mic vs screen share audio)
  const routeAudioTracksForPeer = useCallback((peerId: string) => {
    const peerAudioMap = remoteAudioTracks.current.get(peerId);
    const meta = peerTrackMetas.current.get(peerId);
    const peerDb = peersRef.current.find((p) => p.id === peerId);

    const isPeerMuted = meta?.isMuted ?? peerDb?.is_muted ?? false;

    if (!peerAudioMap || peerAudioMap.size === 0) {
      setRemoteStreams((prev) => {
        if (!prev[peerId]) return prev;
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      });
      setRemoteScreenAudioStreams((prev) => {
        if (!prev[peerId]) return prev;
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      });
      return;
    }

    let foundMicStream: MediaStream | null = null;
    let foundScreenAudioStream: MediaStream | null = null;
    const unmatched: RemoteTrackEntry[] = [];

    peerAudioMap.forEach((entry) => {
      const { track, stream, mid } = entry;
      if (track.readyState === 'ended' || !track.enabled) return;

      const isExplicitScreenAudio =
        (meta?.screenAudioMid && mid === meta.screenAudioMid) ||
        (meta?.screenAudioTrackId && track.id === meta.screenAudioTrackId);
      const isExplicitMic =
        (meta?.micMid && mid === meta.micMid) ||
        (meta?.micAudioTrackId && track.id === meta.micAudioTrackId);

      if (isExplicitScreenAudio) {
        foundScreenAudioStream = stream;
        return;
      }
      if (isExplicitMic) {
        foundMicStream = stream;
        return;
      }

      const label = track.label.toLowerCase();
      const isScreenLabel = label.includes('screen') || label.includes('display') || label.includes('window') || label.includes('system');
      if (isScreenLabel) {
        foundScreenAudioStream = stream;
        return;
      }

      unmatched.push(entry);
    });

    // Prefer unmuted tracks first when resolving fallback unmatched tracks
    unmatched.sort((a, b) => Number(a.track.muted) - Number(b.track.muted));
    unmatched.forEach(({ stream }) => {
      if (!foundMicStream) {
        foundMicStream = stream;
      } else if (!foundScreenAudioStream) {
        foundScreenAudioStream = stream;
      }
    });

    setRemoteStreams((prev) => {
      if (foundMicStream && !isPeerMuted) {
        if (prev[peerId] === foundMicStream) return prev;
        return { ...prev, [peerId]: foundMicStream };
      }
      if (prev[peerId]) {
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      }
      return prev;
    });

    const isSharingScreen =
      meta && typeof meta.isScreenSharing === 'boolean'
        ? meta.isScreenSharing
        : Boolean(peerDb?.is_screen_sharing);

    setRemoteScreenAudioStreams((prev) => {
      if (foundScreenAudioStream && isSharingScreen) {
        if (prev[peerId] === foundScreenAudioStream) return prev;
        return { ...prev, [peerId]: foundScreenAudioStream };
      }
      if (prev[peerId]) {
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      }
      return prev;
    });
  }, []);

  // Route video tracks for a given peer based on authoritative metadata & DB transitions
  const routeVideoTracksForPeer = useCallback((peerId: string) => {
    const peerMap = remoteVideoTracks.current.get(peerId);
    const meta = peerTrackMetas.current.get(peerId);
    const peerDb = peersRef.current.find((p) => p.id === peerId);

    // Authoritative flag: prefer explicit boolean in real-time track-meta, fall back to DB presence
    const isCameraAllowed =
      meta && typeof meta.hasCamera === 'boolean'
        ? meta.hasCamera
        : Boolean(peerDb?.has_video);
    const isCameraDisallowed = !isCameraAllowed;

    const isScreenAllowed =
      meta && typeof meta.isScreenSharing === 'boolean'
        ? meta.isScreenSharing
        : Boolean(peerDb?.is_screen_sharing);
    const isScreenDisallowed = !isScreenAllowed;

    if (!peerMap || peerMap.size === 0 || (isCameraDisallowed && isScreenDisallowed)) {
      setRemoteCameraStreams((prev) => {
        if (!prev[peerId]) return prev;
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      });
      setRemoteScreenStreams((prev) => {
        if (!prev[peerId]) return prev;
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      });
      return;
    }

    let foundCamStream: MediaStream | null = null;
    let foundScreenStream: MediaStream | null = null;
    const unmatched: RemoteTrackEntry[] = [];

    peerMap.forEach((entry) => {
      const { track, stream, mid } = entry;
      if (track.readyState === 'ended' || !track.enabled) return;

      const isExplicitScreen =
        (meta?.screenMid && mid === meta.screenMid) ||
        (meta?.screenTrackId && track.id === meta.screenTrackId);
      const isExplicitCam =
        (meta?.camMid && mid === meta.camMid) ||
        (meta?.camTrackId && track.id === meta.camTrackId);

      if (isExplicitScreen) {
        foundScreenStream = stream;
        return;
      }
      if (isExplicitCam) {
        foundCamStream = stream;
        return;
      }

      const label = track.label.toLowerCase();
      const isScreenLabel = label.includes('screen') || label.includes('window') || label.includes('display');
      if (isScreenLabel) {
        foundScreenStream = stream;
        return;
      }

      unmatched.push(entry);
    });

    // Prefer live unmuted tracks over idle/muted transceiver tracks
    unmatched.sort((a, b) => Number(a.track.muted) - Number(b.track.muted));
    unmatched.forEach(({ stream }) => {
      if (isScreenAllowed && !isCameraAllowed && !foundScreenStream) {
        foundScreenStream = stream;
      } else if (isCameraAllowed && !isScreenAllowed && !foundCamStream) {
        foundCamStream = stream;
      } else if (!foundCamStream && isCameraAllowed) {
        foundCamStream = stream;
      } else if (!foundScreenStream && isScreenAllowed) {
        foundScreenStream = stream;
      }
    });

    setRemoteCameraStreams((prev) => {
      if (isCameraDisallowed) {
        if (!prev[peerId]) return prev;
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      }

      const hasLiveCamTrack = Boolean(
        foundCamStream && foundCamStream.getVideoTracks().some((t) => t.readyState !== 'ended' && t.enabled)
      );
      if (hasLiveCamTrack && foundCamStream) {
        if (prev[peerId] === foundCamStream) return prev;
        return { ...prev, [peerId]: foundCamStream };
      }
      if (prev[peerId]) {
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      }
      return prev;
    });

    setRemoteScreenStreams((prev) => {
      if (isScreenDisallowed) {
        if (!prev[peerId]) return prev;
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      }

      const hasLiveScreenTrack = Boolean(
        foundScreenStream && foundScreenStream.getVideoTracks().some((t) => t.readyState !== 'ended' && t.enabled)
      );
      if (hasLiveScreenTrack && foundScreenStream) {
        if (prev[peerId] === foundScreenStream) return prev;
        return { ...prev, [peerId]: foundScreenStream };
      }
      if (prev[peerId]) {
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      }
      return prev;
    });
  }, []);

  // Synchronize remote stream states and DB transitions whenever peers list updates
  useEffect(() => {
    if (!isMediaActive) return;
    const speakingMap: Record<string, boolean> = {};

    peers.forEach((p) => {
      if (p.is_speaking) speakingMap[p.id] = true;

      const prevFlags = prevPeerMediaFlags.current.get(p.id);
      const nextHasVideo = Boolean(p.has_video);
      const nextIsScreen = Boolean(p.is_screen_sharing);

      // If DB state transitioned from true -> false, immediately invalidate any stale cached meta true flag
      const existingMeta = peerTrackMetas.current.get(p.id);
      if (existingMeta) {
        if (prevFlags?.has_video && !nextHasVideo) {
          existingMeta.hasCamera = false;
          existingMeta.camTrackId = null;
        }
        if (prevFlags?.is_screen_sharing && !nextIsScreen) {
          existingMeta.isScreenSharing = false;
          existingMeta.screenTrackId = null;
          existingMeta.hasScreenAudio = false;
        }
      }
      prevPeerMediaFlags.current.set(p.id, {
        has_video: nextHasVideo,
        is_screen_sharing: nextIsScreen,
      });

      routeAudioTracksForPeer(p.id);
      routeVideoTracksForPeer(p.id);
    });

    setRemoteSpeaking(speakingMap);
  }, [peers, isMediaActive, routeAudioTracksForPeer, routeVideoTracksForPeer]);

  // Clean up all connections when leaving media channels
  useEffect(() => {
    if (!isMediaActive) {
      fallbackTimersRef.current.forEach((t) => clearTimeout(t));
      fallbackTimersRef.current.clear();
      peerBundles.current.forEach((bundle) => {
        try { bundle.pc.close(); } catch {}
      });
      peerBundles.current.clear();
      lastSentMetaRef.current.clear();
      pendingRenegotiatePeersRef.current.clear();
      peerTrackMetas.current.clear();
      prevPeerMediaFlags.current.clear();
      remoteAudioTracks.current.clear();
      remoteVideoTracks.current.clear();
      pendingCandidates.current.clear();
      makingOfferRef.current.clear();
      isNegotiatingRef.current.clear();
      signalQueuesRef.current.clear();
      iceFailureCountRef.current.clear();
      forcedRelayPeersRef.current.clear();
      setRemoteStreams({});
      setRemoteScreenAudioStreams({});
      setRemoteCameraStreams({});
      setRemoteScreenStreams({});
      setRemoteSpeaking({});
    }
  }, [isMediaActive]);

  // Pre-fetch dynamic ephemeral TURN/STUN credentials from backend and refresh active peers
  useEffect(() => {
    let cancelled = false;
    fetchDynamicIceServers().then((servers) => {
      if (cancelled || !servers?.length) return;
      dynamicIceServersRef.current = servers;
      peerBundles.current.forEach((bundle) => {
        if (
          bundle.pc.connectionState !== 'closed' &&
          bundle.pc.connectionState !== 'connected'
        ) {
          try {
            bundle.pc.setConfiguration({
              ...DEFAULT_RTC_CONFIG,
              iceServers: servers,
              iceTransportPolicy: bundle.iceTransportPolicy,
            });
          } catch {}
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, [isMediaActive]);

  // Helper to attach/sync current local tracks onto a PeerConnectionBundle
  const attachLocalTracksToBundle = useCallback((bundle: PeerConnectionBundle): boolean => {
    const pc = bundle.pc;
    let needsRenegotiation = false;

    const micTrack = localAudioRef.current?.getAudioTracks()[0] || null;
    const screenAudioTrack = screenStreamRef.current?.getAudioTracks()[0] || null;
    const camTrack = cameraStreamRef.current?.getVideoTracks()[0] || null;
    const screenTrack = screenStreamRef.current?.getVideoTracks()[0] || null;

    const ensureSenderSendable = (sender: RTCRtpSender | null) => {
      if (!sender) return;
      const transceiver = pc.getTransceivers().find((t) => t.sender === sender);
      if (transceiver && transceiver.direction !== 'sendrecv' && transceiver.direction !== 'sendonly') {
        try {
          transceiver.direction = 'sendrecv';
          needsRenegotiation = true;
        } catch {}
      }
    };

    // 1. Microphone audio track
    if (micTrack && localAudioRef.current) {
      if (bundle.audioSender) {
        if (bundle.audioSender.track !== micTrack) {
          bundle.audioSender.replaceTrack(micTrack).catch(() => {});
          ensureSenderSendable(bundle.audioSender);
          configureAudioSenderParams(bundle.audioSender, false);
        }
      } else {
        try {
          bundle.audioSender = pc.addTrack(micTrack, localAudioRef.current);
          configureAudioSenderParams(bundle.audioSender, false);
          needsRenegotiation = true;
        } catch {}
      }
    } else if (bundle.audioSender && bundle.audioSender.track !== null) {
      bundle.audioSender.replaceTrack(null).catch(() => {});
    }

    // 2. Screen share audio track
    if (screenAudioTrack && screenStreamRef.current) {
      if (bundle.screenAudioSender) {
        if (bundle.screenAudioSender.track !== screenAudioTrack) {
          bundle.screenAudioSender.replaceTrack(screenAudioTrack).catch(() => {});
          ensureSenderSendable(bundle.screenAudioSender);
          configureAudioSenderParams(bundle.screenAudioSender, true);
        }
      } else {
        try {
          bundle.screenAudioSender = pc.addTrack(screenAudioTrack, screenStreamRef.current);
          configureAudioSenderParams(bundle.screenAudioSender, true);
          needsRenegotiation = true;
        } catch {}
      }
    } else if (bundle.screenAudioSender && bundle.screenAudioSender.track !== null) {
      bundle.screenAudioSender.replaceTrack(null).catch(() => {});
    }

    // 3. Camera video track
    if (camTrack && cameraStreamRef.current) {
      try {
        if ('contentHint' in camTrack && !camTrack.contentHint) camTrack.contentHint = 'motion';
      } catch {}
      if (bundle.camSender) {
        if (bundle.camSender.track !== camTrack) {
          bundle.camSender.replaceTrack(camTrack).catch(() => {});
          ensureSenderSendable(bundle.camSender);
          configureCameraSenderParams(bundle.camSender, bundle.camBitrate);
          preferLowLatencyVideoCodecs(pc, bundle.camSender);
        }
      } else {
        try {
          const sender = pc.addTrack(camTrack, cameraStreamRef.current);
          bundle.camSender = sender;
          configureCameraSenderParams(sender, bundle.camBitrate);
          preferLowLatencyVideoCodecs(pc, sender);
          needsRenegotiation = true;
        } catch {}
      }
    } else if (bundle.camSender && bundle.camSender.track !== null) {
      bundle.camSender.replaceTrack(null).catch(() => {});
    }

    // 4. Screen share video track
    if (screenTrack && screenStreamRef.current) {
      try {
        if ('contentHint' in screenTrack && !screenTrack.contentHint) screenTrack.contentHint = 'motion';
      } catch {}
      if (bundle.screenSender) {
        if (bundle.screenSender.track !== screenTrack) {
          bundle.screenSender.replaceTrack(screenTrack).catch(() => {});
          ensureSenderSendable(bundle.screenSender);
          configureScreenSenderParams(bundle.screenSender, bundle.screenBitrate);
          preferLowLatencyVideoCodecs(pc, bundle.screenSender);
        }
      } else {
        try {
          const sender = pc.addTrack(screenTrack, screenStreamRef.current);
          bundle.screenSender = sender;
          configureScreenSenderParams(sender, bundle.screenBitrate);
          preferLowLatencyVideoCodecs(pc, sender);
          needsRenegotiation = true;
        } catch {}
      }
    } else if (bundle.screenSender && bundle.screenSender.track !== null) {
      bundle.screenSender.replaceTrack(null).catch(() => {});
    }

    if (hasUnnegotiatedLocalTracks(bundle)) {
      needsRenegotiation = true;
    }

    return needsRenegotiation;
  }, []);

  // Create or get RTCPeerConnection Bundle
  const getOrCreatePeerBundle = useCallback((peerId: string): PeerConnectionBundle => {
    const existing = peerBundles.current.get(peerId);
    if (existing && existing.pc.connectionState !== 'closed' && existing.pc.connectionState !== 'failed') {
      return existing;
    }

    if (existing) {
      try { existing.pc.close(); } catch {}
    }

    lastSentMetaRef.current.delete(peerId);

    const transportPolicy: RTCIceTransportPolicy = forcedRelayPeersRef.current.has(peerId) ? 'relay' : 'all';
    const pc = new RTCPeerConnection({
      ...DEFAULT_RTC_CONFIG,
      iceServers: dynamicIceServersRef.current,
      iceTransportPolicy: transportPolicy,
    });
    const newBundle: PeerConnectionBundle = {
      pc,
      createdAt: Date.now(),
      iceTransportPolicy: transportPolicy,
      audioSender: null,
      screenAudioSender: null,
      camSender: null,
      screenSender: null,
      camBitrate: 3_500_000,
      screenBitrate: 5_000_000,
    };
    peerBundles.current.set(peerId, newBundle);

    // 1. Attach local microphone track
    const micTrack = localAudioRef.current?.getAudioTracks()[0];
    if (micTrack && localAudioRef.current) {
      try {
        newBundle.audioSender = pc.addTrack(micTrack, localAudioRef.current);
        configureAudioSenderParams(newBundle.audioSender, false);
      } catch {}
    }

    // 2. Attach screen audio track if available
    const screenAudioTrack = screenStreamRef.current?.getAudioTracks()[0];
    if (screenAudioTrack && screenStreamRef.current) {
      try {
        newBundle.screenAudioSender = pc.addTrack(screenAudioTrack, screenStreamRef.current);
        configureAudioSenderParams(newBundle.screenAudioSender, true);
      } catch {}
    }

    // 3. Attach local camera video track
    const camTrack = cameraStreamRef.current?.getVideoTracks()[0];
    if (camTrack && cameraStreamRef.current) {
      try {
        if ('contentHint' in camTrack && !camTrack.contentHint) camTrack.contentHint = 'motion';
        const sender = pc.addTrack(camTrack, cameraStreamRef.current);
        newBundle.camSender = sender;
        configureCameraSenderParams(sender, newBundle.camBitrate);
        preferLowLatencyVideoCodecs(pc, sender);
      } catch {}
    }

    // 4. Attach local screen video track
    const screenTrack = screenStreamRef.current?.getVideoTracks()[0];
    if (screenTrack && screenStreamRef.current) {
      try {
        if ('contentHint' in screenTrack && !screenTrack.contentHint) screenTrack.contentHint = 'motion';
        const sender = pc.addTrack(screenTrack, screenStreamRef.current);
        newBundle.screenSender = sender;
        configureScreenSenderParams(sender, newBundle.screenBitrate);
        preferLowLatencyVideoCodecs(pc, sender);
      } catch {}
    }

    // Keep baseline receive transceivers available for future mic/cam activation
    let audioTransceiver = pc
      .getTransceivers()
      .find((t) => t.receiver.track.kind === 'audio' && t.sender !== newBundle.screenAudioSender);
    if (!audioTransceiver) {
      try { audioTransceiver = pc.addTransceiver('audio', { direction: 'sendrecv' }); } catch {}
    }
    if (!newBundle.audioSender && audioTransceiver && !audioTransceiver.sender.track) {
      newBundle.audioSender = audioTransceiver.sender;
    }

    let videoTransceiver = pc
      .getTransceivers()
      .find((t) => t.receiver.track.kind === 'video' && t.sender !== newBundle.screenSender);
    if (!videoTransceiver) {
      try { videoTransceiver = pc.addTransceiver('video', { direction: 'sendrecv' }); } catch {}
    }
    if (!newBundle.camSender && videoTransceiver && !videoTransceiver.sender.track) {
      newBundle.camSender = videoTransceiver.sender;
      preferLowLatencyVideoCodecs(pc, videoTransceiver.sender);
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendRtcSignal(peerId, { type: 'candidate', candidate: event.candidate });
      }
    };

    let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
    let checkingWatchdogTimer: ReturnType<typeof setTimeout> | null = null;

    const escalateOrRestartIce = () => {
      if (peerBundles.current.get(peerId) !== newBundle) return;
      const isAlreadyConnected =
        pc.connectionState === 'connected' ||
        pc.iceConnectionState === 'connected' ||
        pc.iceConnectionState === 'completed';
      if (isAlreadyConnected) return;

      const nextFailures = (iceFailureCountRef.current.get(peerId) || 0) + 1;
      iceFailureCountRef.current.set(peerId, nextFailures);

      // Strict WiFi firewall fallback: if P2P ICE stalls/fails twice, switch this peer to forced TURN relay over 443 TCP/TLS
      if (nextFailures >= 2 && newBundle.iceTransportPolicy !== 'relay') {
        forcedRelayPeersRef.current.add(peerId);
        try { pc.close(); } catch {}
        if (peerBundles.current.get(peerId) === newBundle) {
          peerBundles.current.delete(peerId);
        }
        pendingCandidates.current.delete(peerId);
        makingOfferRef.current.delete(peerId);
        isNegotiatingRef.current.delete(peerId);
        renegotiateRef.current(peerId);
        return;
      }

      try {
        pc.restartIce();
        renegotiateRef.current(peerId);
      } catch (error) {
        console.warn('[useWebRTC] ICE restart failed:', error);
      }
    };

    const scheduleIceRestart = (delay: number) => {
      if (recoveryTimer) return;
      recoveryTimer = setTimeout(() => {
        recoveryTimer = null;
        if (peerBundles.current.get(peerId) !== newBundle) return;
        const connectionNeedsRecovery =
          pc.connectionState === 'failed' ||
          pc.connectionState === 'disconnected' ||
          pc.iceConnectionState === 'failed' ||
          pc.iceConnectionState === 'disconnected';
        if (!connectionNeedsRecovery) return;
        escalateOrRestartIce();
      }, delay);
    };

    const startCheckingWatchdog = () => {
      if (checkingWatchdogTimer) return;
      checkingWatchdogTimer = setTimeout(() => {
        checkingWatchdogTimer = null;
        if (peerBundles.current.get(peerId) !== newBundle) return;
        if (pc.iceConnectionState === 'checking' || pc.iceConnectionState === 'new') {
          escalateOrRestartIce();
        }
      }, 4000);
    };

    const clearRecoveryTimers = () => {
      if (recoveryTimer) clearTimeout(recoveryTimer);
      recoveryTimer = null;
      if (checkingWatchdogTimer) clearTimeout(checkingWatchdogTimer);
      checkingWatchdogTimer = null;
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        clearRecoveryTimers();
        iceFailureCountRef.current.set(peerId, 0);
        // Send authoritative track-meta once connected so peer always has accurate mids/trackIds
        const metaPayload = { type: 'track-meta' as const, ...buildLocalMetaFields(newBundle) };
        lastSentMetaRef.current.set(peerId, JSON.stringify(metaPayload));
        sendRtcSignal(peerId, metaPayload);
      } else if (pc.connectionState === 'failed') {
        scheduleIceRestart(0);
      } else if (pc.connectionState === 'disconnected') {
        scheduleIceRestart(1500);
      } else if (pc.connectionState === 'closed') {
        clearRecoveryTimers();
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        clearRecoveryTimers();
        iceFailureCountRef.current.set(peerId, 0);
      } else if (pc.iceConnectionState === 'checking') {
        startCheckingWatchdog();
      } else if (pc.iceConnectionState === 'failed') {
        scheduleIceRestart(0);
      } else if (pc.iceConnectionState === 'disconnected') {
        scheduleIceRestart(1500);
      } else if (pc.iceConnectionState === 'closed') {
        clearRecoveryTimers();
      }
    };

    pc.ontrack = (event) => {
      const track = event.track;
      const [stream] = event.streams;
      const streamToUse = stream || new MediaStream([track]);
      const mid = event.transceiver?.mid ?? null;
      applyLowLatencyReceiverParams(event.receiver);

      if (track.kind === 'audio') {
        let peerMap = remoteAudioTracks.current.get(peerId);
        if (!peerMap) {
          peerMap = new Map();
          remoteAudioTracks.current.set(peerId, peerMap);
        }
        peerMap.set(track.id, { track, stream: streamToUse, mid });

        const onAudioChange = () => {
          const entry = remoteAudioTracks.current.get(peerId)?.get(track.id);
          if (entry && event.transceiver?.mid) {
            entry.mid = event.transceiver.mid;
          }
          applyLowLatencyReceiverParams(event.receiver);
          routeAudioTracksForPeer(peerId);
        };

        track.addEventListener('unmute', onAudioChange);
        track.addEventListener('mute', onAudioChange);
        track.addEventListener('ended', () => {
          const map = remoteAudioTracks.current.get(peerId);
          if (map) {
            map.delete(track.id);
          }
          routeAudioTracksForPeer(peerId);
        });

        routeAudioTracksForPeer(peerId);
      } else if (track.kind === 'video') {
        let peerMap = remoteVideoTracks.current.get(peerId);
        if (!peerMap) {
          peerMap = new Map();
          remoteVideoTracks.current.set(peerId, peerMap);
        }
        peerMap.set(track.id, { track, stream: streamToUse, mid });

        const onVideoStateChange = () => {
          const entry = remoteVideoTracks.current.get(peerId)?.get(track.id);
          if (entry && event.transceiver?.mid) {
            entry.mid = event.transceiver.mid;
          }
          applyLowLatencyReceiverParams(event.receiver);
          routeVideoTracksForPeer(peerId);
        };

        track.addEventListener('unmute', onVideoStateChange);
        track.addEventListener('mute', onVideoStateChange);
        track.addEventListener('ended', () => {
          const map = remoteVideoTracks.current.get(peerId);
          if (map) {
            map.delete(track.id);
          }
          routeVideoTracksForPeer(peerId);
        });

        routeVideoTracksForPeer(peerId);
      }
    };

    return newBundle;
  }, [sendRtcSignal, routeAudioTracksForPeer, routeVideoTracksForPeer, buildLocalMetaFields]);

  // Renegotiate with a specific peer cleanly
  const renegotiateWithPeer = useCallback(async (peerId: string) => {
    renegotiateRef.current = renegotiateWithPeer;
    if (!isMediaActiveRef.current) return;

    const bundle = getOrCreatePeerBundle(peerId);
    const pc = bundle.pc;

    if (isNegotiatingRef.current.get(peerId)) {
      pendingRenegotiatePeersRef.current.add(peerId);
      return;
    }
    isNegotiatingRef.current.set(peerId, true);

    try {
      // Ensure latest local tracks are attached before creating the offer
      attachLocalTracksToBundle(bundle);

      if (pc.signalingState !== 'stable') {
        await new Promise<void>((resolve) => {
          const handler = () => {
            if (pc.signalingState === 'stable') {
              pc.removeEventListener('signalingstatechange', handler);
              resolve();
            }
          };
          pc.addEventListener('signalingstatechange', handler);
          setTimeout(() => {
            pc.removeEventListener('signalingstatechange', handler);
            resolve();
          }, 1500);
        });
      }

      if (pc.signalingState !== 'stable' || pc.connectionState === 'closed') {
        pendingRenegotiatePeersRef.current.add(peerId);
        return;
      }

      makingOfferRef.current.set(peerId, true);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      if (pc.signalingState !== 'stable') return;

      const optimizedSdp = optimizeAudioSdp(offer.sdp || '');
      const finalOffer = { type: offer.type, sdp: optimizedSdp };
      await pc.setLocalDescription(finalOffer);

      const metaFields = buildLocalMetaFields(bundle);
      sendRtcSignal(peerId, {
        type: 'offer',
        offer: finalOffer,
        ...metaFields,
      });
      lastSentMetaRef.current.set(peerId, JSON.stringify({ type: 'track-meta', ...metaFields }));
    } catch (err) {
      console.warn('[useWebRTC] Offer creation error:', err);
    } finally {
      makingOfferRef.current.set(peerId, false);
      isNegotiatingRef.current.set(peerId, false);
      if (
        pendingRenegotiatePeersRef.current.has(peerId) &&
        isMediaActiveRef.current &&
        peerBundles.current.has(peerId) &&
        pc.connectionState !== 'closed'
      ) {
        pendingRenegotiatePeersRef.current.delete(peerId);
        queueMicrotask(() => {
          if (isMediaActiveRef.current && peerBundles.current.has(peerId)) {
            renegotiateRef.current(peerId);
          }
        });
      }
    }
  }, [getOrCreatePeerBundle, attachLocalTracksToBundle, buildLocalMetaFields, sendRtcSignal]);

  useEffect(() => {
    renegotiateRef.current = renegotiateWithPeer;
  }, [renegotiateWithPeer]);

  // Sync local tracks across all active peer connections without resetting unchanged encoders
  const syncLocalTracks = useCallback(() => {
    if (!isMediaActiveRef.current) return;

    peerBundles.current.forEach((bundle, peerId) => {
      const pc = bundle.pc;
      if (pc.connectionState === 'closed') return;

      let needsRenegotiation = pendingRenegotiatePeersRef.current.has(peerId);
      if (attachLocalTracksToBundle(bundle)) {
        needsRenegotiation = true;
      }

      // Send track metadata immediately when anything changed so receiver stays in sync without waiting for DB
      const metaPayload = {
        type: 'track-meta' as const,
        ...buildLocalMetaFields(bundle),
      };
      const serializedMeta = JSON.stringify(metaPayload);
      if (lastSentMetaRef.current.get(peerId) !== serializedMeta) {
        lastSentMetaRef.current.set(peerId, serializedMeta);
        sendRtcSignal(peerId, metaPayload);
      }

      if (needsRenegotiation) {
        if (pc.signalingState === 'stable') {
          pendingRenegotiatePeersRef.current.delete(peerId);
          renegotiateWithPeer(peerId);
        } else {
          pendingRenegotiatePeersRef.current.add(peerId);
        }
      }
    });
  }, [attachLocalTracksToBundle, buildLocalMetaFields, renegotiateWithPeer, sendRtcSignal]);

  // Re-sync local tracks whenever local streams, mute, or peers list changes
  useEffect(() => {
    if (!isMediaActive) return;
    syncLocalTracks();
  }, [isMediaActive, localAudioStream, cameraStream, screenStream, isMuted, peers, syncLocalTracks]);

  // Periodic health check + adaptive WiFi bitrate controller (keeps 60fps smooth on weak WiFi)
  useEffect(() => {
    if (!isMediaActive) return;
    const interval = setInterval(() => {
      syncLocalTracks();
      peerBundles.current.forEach((bundle, peerId) => {
        const pc = bundle.pc;
        if (
          pc.remoteDescription === null &&
          pc.signalingState === 'stable' &&
          Date.now() - bundle.createdAt > 1000 &&
          !isNegotiatingRef.current.get(peerId)
        ) {
          renegotiateWithPeer(peerId);
        }
      });
    }, 1000);

    const adaptiveStatsInterval = setInterval(async () => {
      for (const bundle of peerBundles.current.values()) {
        const pc = bundle.pc;
        if (pc.connectionState !== 'connected') continue;
        const hasCam = Boolean(bundle.camSender?.track && bundle.camSender.track.readyState === 'live');
        const hasScreen = Boolean(bundle.screenSender?.track && bundle.screenSender.track.readyState === 'live');
        if (!hasCam && !hasScreen) continue;

        try {
          const stats = await pc.getStats();
          let maxFractionLost = 0;
          let maxRttSec = 0;
          let availableOutgoingBps = 0;

          stats.forEach((report: any) => {
            if (report.type === 'remote-inbound-rtp') {
              if (typeof report.fractionLost === 'number') {
                maxFractionLost = Math.max(maxFractionLost, report.fractionLost);
              }
              if (typeof report.roundTripTime === 'number') {
                maxRttSec = Math.max(maxRttSec, report.roundTripTime);
              }
            } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              if (typeof report.currentRoundTripTime === 'number') {
                maxRttSec = Math.max(maxRttSec, report.currentRoundTripTime);
              }
              if (typeof report.availableOutgoingBitrate === 'number' && report.availableOutgoingBitrate > 0) {
                availableOutgoingBps = report.availableOutgoingBitrate;
              }
            }
          });

          const congested = maxFractionLost > 0.04 || maxRttSec > 0.35;
          const healthy = maxFractionLost < 0.01 && maxRttSec < 0.18;

          if (hasCam && bundle.camSender) {
            const prev = bundle.camBitrate;
            let next = prev;
            if (congested) {
              next = Math.max(350_000, Math.round(prev * 0.72));
            } else if (healthy) {
              next = Math.min(3_500_000, Math.round(prev * 1.25));
            }
            if (availableOutgoingBps > 0) {
              const budget = hasScreen ? availableOutgoingBps * 0.35 : availableOutgoingBps * 0.8;
              if (budget < next) next = Math.max(350_000, Math.round(budget));
            }
            if (Math.abs(next - prev) / prev > 0.08) {
              bundle.camBitrate = next;
              configureCameraSenderParams(bundle.camSender, next);
            }
          }

          if (hasScreen && bundle.screenSender) {
            const prev = bundle.screenBitrate;
            let next = prev;
            if (congested) {
              next = Math.max(650_000, Math.round(prev * 0.72));
            } else if (healthy) {
              next = Math.min(5_500_000, Math.round(prev * 1.25));
            }
            if (availableOutgoingBps > 0) {
              const budget = hasCam ? availableOutgoingBps * 0.6 : availableOutgoingBps * 0.85;
              if (budget < next) next = Math.max(650_000, Math.round(budget));
            }
            if (Math.abs(next - prev) / prev > 0.08) {
              bundle.screenBitrate = next;
              configureScreenSenderParams(bundle.screenSender, next);
            }
          }
        } catch {}
      }
    }, 1500);

    return () => {
      clearInterval(interval);
      clearInterval(adaptiveStatsInterval);
    };
  }, [isMediaActive, syncLocalTracks, renegotiateWithPeer]);

  // Handle USER_JOINED_MEDIA / USER_LEFT_MEDIA events (e.g., peer refreshed tab with same userId)
  useEffect(() => {
    setMediaHandlers(
      (joinedUserId, _channel) => {
        if (!isMediaActiveRef.current || !joinedUserId || joinedUserId === currentUserIdRef.current) return;
        const existing = peerBundles.current.get(joinedUserId);
        const shouldResetExisting =
          existing &&
          (existing.pc.connectionState === 'failed' ||
            existing.pc.connectionState === 'closed' ||
            (existing.pc.connectionState !== 'connected' && Date.now() - existing.createdAt > 1500) ||
            (existing.pc.connectionState === 'connected' && Date.now() - existing.createdAt > 2500));

        if (!existing || shouldResetExisting) {
          if (existing) {
            clearPeerState(joinedUserId);
          }
          const isInitiator = currentUserIdRef.current < joinedUserId;
          if (isInitiator) {
            renegotiateWithPeer(joinedUserId);
          } else {
            getOrCreatePeerBundle(joinedUserId);
            sendRtcSignal(joinedUserId, { type: 'peer-ready' });
          }
        }
      },
      (leftUserId, _channel) => {
        if (!leftUserId || leftUserId === currentUserIdRef.current) return;
        clearPeerState(leftUserId);
      }
    );
  }, [setMediaHandlers, clearPeerState, renegotiateWithPeer, getOrCreatePeerBundle, sendRtcSignal]);

  // Core signal processor (Perfect Negotiation + track-meta + peer-ready), serialized per peer
  const processSignal = useCallback((fromUserId: string, signal: any): Promise<void> => {
    if (!isMediaActiveRef.current) return Promise.resolve();
    if (!fromUserId || fromUserId === currentUserIdRef.current) return Promise.resolve();

    const prevQueue = signalQueuesRef.current.get(fromUserId) || Promise.resolve();
    const nextTask = prevQueue
      .catch(() => {})
      .then(async () => {
        if (!isMediaActiveRef.current) return;
        const bundle = getOrCreatePeerBundle(fromUserId);
        const pc = bundle.pc;
        const isPolite = currentUserIdRef.current > fromUserId;

        try {
      if (signal.type === 'peer-ready') {
        // Joining peer signals readiness: send current meta and offer if needed
        const metaPayload = {
          type: 'track-meta' as const,
          ...buildLocalMetaFields(bundle),
        };
        lastSentMetaRef.current.set(fromUserId, JSON.stringify(metaPayload));
        sendRtcSignal(fromUserId, metaPayload);

        if (!pc.remoteDescription) {
          if (pc.signalingState === 'have-local-offer') {
            // If an offer is freshly in flight (<1500ms), re-send the exact same offer instead of rolling back and breaking the peer's answer
            if (Date.now() - bundle.createdAt < 1500 && pc.localDescription) {
              const offerMeta = buildLocalMetaFields(bundle);
              sendRtcSignal(fromUserId, {
                type: 'offer',
                offer: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
                ...offerMeta,
              });
              return;
            }
            try {
              await pc.setLocalDescription({ type: 'rollback' });
            } catch {
              clearPeerState(fromUserId);
            }
          }
          renegotiateWithPeer(fromUserId);
        } else if (pc.connectionState !== 'connected' || hasUnnegotiatedLocalTracks(bundle)) {
          renegotiateWithPeer(fromUserId);
        }
        return;
      }

      if (signal.type === 'track-meta') {
        peerTrackMetas.current.set(fromUserId, {
          micAudioTrackId: signal.micAudioTrackId,
          screenAudioTrackId: signal.screenAudioTrackId,
          camTrackId: signal.camTrackId,
          screenTrackId: signal.screenTrackId,
          micMid: signal.micMid ?? null,
          screenAudioMid: signal.screenAudioMid ?? null,
          camMid: signal.camMid ?? null,
          screenMid: signal.screenMid ?? null,
          hasCamera: Boolean(signal.hasCamera),
          isScreenSharing: Boolean(signal.isScreenSharing),
          hasScreenAudio: Boolean(signal.hasScreenAudio),
          isMuted: signal.isMuted,
        });
        if (!signal.hasCamera) {
          setRemoteCameraStreams((prev) => {
            if (!prev[fromUserId]) return prev;
            const copy = { ...prev };
            delete copy[fromUserId];
            return copy;
          });
        }
        if (!signal.isScreenSharing) {
          setRemoteScreenStreams((prev) => {
            if (!prev[fromUserId]) return prev;
            const copy = { ...prev };
            delete copy[fromUserId];
            return copy;
          });
          setRemoteScreenAudioStreams((prev) => {
            if (!prev[fromUserId]) return prev;
            const copy = { ...prev };
            delete copy[fromUserId];
            return copy;
          });
        }
        routeAudioTracksForPeer(fromUserId);
        routeVideoTracksForPeer(fromUserId);
        return;
      }

      if (signal.type === 'offer') {
        if (
          signal.micAudioTrackId !== undefined ||
          signal.screenAudioTrackId !== undefined ||
          signal.screenTrackId !== undefined ||
          signal.camTrackId !== undefined ||
          signal.hasCamera !== undefined ||
          signal.isScreenSharing !== undefined
        ) {
          peerTrackMetas.current.set(fromUserId, {
            micAudioTrackId: signal.micAudioTrackId,
            screenAudioTrackId: signal.screenAudioTrackId,
            camTrackId: signal.camTrackId,
            screenTrackId: signal.screenTrackId,
            micMid: signal.micMid ?? null,
            screenAudioMid: signal.screenAudioMid ?? null,
            camMid: signal.camMid ?? null,
            screenMid: signal.screenMid ?? null,
            hasCamera: signal.hasCamera,
            isScreenSharing: signal.isScreenSharing,
            hasScreenAudio: signal.hasScreenAudio,
            isMuted: signal.isMuted,
          });
        }

        const isMakingOffer = Boolean(makingOfferRef.current.get(fromUserId));
        const offerCollision = isMakingOffer || pc.signalingState !== 'stable';

        if (offerCollision) {
          if (!isPolite) {
            return;
          }
          try {
            await pc.setRemoteDescription({ type: 'rollback' });
          } catch (rbErr) {
            console.warn('[useWebRTC] Rollback notice:', rbErr);
          }
        }

        // Attach our local tracks before answering so existing tracks map to offer transceivers
        attachLocalTracksToBundle(bundle);

        const optimizedOffer = {
          type: signal.offer.type,
          sdp: optimizeAudioSdp(signal.offer.sdp || ''),
        };
        await pc.setRemoteDescription(new RTCSessionDescription(optimizedOffer));
        const answer = await pc.createAnswer();
        const optimizedAnswerSdp = optimizeAudioSdp(answer.sdp || '');
        const finalAnswer = { type: answer.type, sdp: optimizedAnswerSdp };
        await pc.setLocalDescription(finalAnswer);

        const metaFields = buildLocalMetaFields(bundle);
        sendRtcSignal(fromUserId, {
          type: 'answer',
          answer: finalAnswer,
          ...metaFields,
        });
        lastSentMetaRef.current.set(fromUserId, JSON.stringify({ type: 'track-meta', ...metaFields }));

        // Flush queued ICE candidates
        const queued = pendingCandidates.current.get(fromUserId) || [];
        for (const c of queued) {
          try {
            if (c && (c as any).candidate) {
              await pc.addIceCandidate(c);
            }
          } catch {}
        }
        pendingCandidates.current.delete(fromUserId);

        routeAudioTracksForPeer(fromUserId);
        routeVideoTracksForPeer(fromUserId);

        // Critical: If the incoming offer had fewer m= sections than our active local tracks
        // (e.g., peer just joined with mic-only while we already have camera + screen share active),
        // we MUST send a follow-up offer so all our active tracks get negotiated!
        if (hasUnnegotiatedLocalTracks(bundle)) {
          pendingRenegotiatePeersRef.current.add(fromUserId);
          setTimeout(() => {
            if (isMediaActiveRef.current && peerBundles.current.has(fromUserId)) {
              renegotiateWithPeer(fromUserId);
            }
          }, 80);
        }
      } else if (signal.type === 'answer') {
        if (
          signal.micAudioTrackId !== undefined ||
          signal.screenAudioTrackId !== undefined ||
          signal.screenTrackId !== undefined ||
          signal.camTrackId !== undefined ||
          signal.hasCamera !== undefined ||
          signal.isScreenSharing !== undefined
        ) {
          peerTrackMetas.current.set(fromUserId, {
            micAudioTrackId: signal.micAudioTrackId,
            screenAudioTrackId: signal.screenAudioTrackId,
            camTrackId: signal.camTrackId,
            screenTrackId: signal.screenTrackId,
            micMid: signal.micMid ?? null,
            screenAudioMid: signal.screenAudioMid ?? null,
            camMid: signal.camMid ?? null,
            screenMid: signal.screenMid ?? null,
            hasCamera: signal.hasCamera,
            isScreenSharing: signal.isScreenSharing,
            hasScreenAudio: signal.hasScreenAudio,
            isMuted: signal.isMuted,
          });
        }

        if (pc.signalingState === 'have-local-offer') {
          const optimizedAnswer = {
            type: signal.answer.type,
            sdp: optimizeAudioSdp(signal.answer.sdp || ''),
          };
          await pc.setRemoteDescription(new RTCSessionDescription(optimizedAnswer));
          const queued = pendingCandidates.current.get(fromUserId) || [];
          for (const c of queued) {
            try {
              if (c && (c as any).candidate) {
                await pc.addIceCandidate(c);
              }
            } catch {}
          }
          pendingCandidates.current.delete(fromUserId);

          routeAudioTracksForPeer(fromUserId);
          routeVideoTracksForPeer(fromUserId);

          if (pendingRenegotiatePeersRef.current.has(fromUserId) || hasUnnegotiatedLocalTracks(bundle)) {
            pendingRenegotiatePeersRef.current.delete(fromUserId);
            setTimeout(() => {
              if (isMediaActiveRef.current && peerBundles.current.has(fromUserId)) {
                renegotiateWithPeer(fromUserId);
              }
            }, 80);
          }
        }
      } else if (signal.type === 'candidate') {
        const cand = signal.candidate;
        if (!cand || !cand.candidate) {
          try {
            if (pc.remoteDescription) {
              await pc.addIceCandidate(null as any);
            }
          } catch {}
          return;
        }
        if (pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(cand);
          } catch (cErr) {
            console.warn('[useWebRTC] addIceCandidate failed:', cErr);
          }
        } else {
          let queued = pendingCandidates.current.get(fromUserId);
          if (!queued) {
            queued = [];
            pendingCandidates.current.set(fromUserId, queued);
          }
          queued.push(cand);
        }
      }
    } catch (err) {
      console.warn('[useWebRTC] Signal handling error:', err);
    }
      });

    signalQueuesRef.current.set(fromUserId, nextTask);
    return nextTask;
  }, [
    getOrCreatePeerBundle,
    buildLocalMetaFields,
    sendRtcSignal,
    clearPeerState,
    renegotiateWithPeer,
    routeAudioTracksForPeer,
    routeVideoTracksForPeer,
    attachLocalTracksToBundle,
  ]);

  useEffect(() => {
    processSignalRef.current = processSignal;
  }, [processSignal]);

  // Register stable RTC signal handler that buffers signals arriving right before isMediaActive flips true
  useEffect(() => {
    setRtcSignalHandler((fromUserId, signal) => {
      if (fromUserId === currentUserIdRef.current) return;
      if (!isMediaActiveRef.current) {
        const now = Date.now();
        earlySignalsRef.current = [
          ...earlySignalsRef.current.filter((item) => now - item.receivedAt < 8000).slice(-29),
          { fromUserId, signal, receivedAt: now },
        ];
        return;
      }
      void processSignalRef.current(fromUserId, signal);
    });
  }, [setRtcSignalHandler]);

  // Flush any signals that arrived just milliseconds before isMediaActive became true
  useEffect(() => {
    if (!isMediaActive) return;
    const now = Date.now();
    const buffered = earlySignalsRef.current.filter((item) => now - item.receivedAt < 8000);
    earlySignalsRef.current = [];
    if (buffered.length > 0) {
      (async () => {
        for (const item of buffered) {
          await processSignalRef.current(item.fromUserId, item.signal);
        }
      })();
    }
  }, [isMediaActive]);

  // Maintain active connections to all peers in the channel
  useEffect(() => {
    if (!isMediaActive) return;

    peers.forEach((peer) => {
      if (peer.id === currentUserId) return;

      const existingBundle = peerBundles.current.get(peer.id);
      if (!existingBundle || existingBundle.pc.connectionState === 'closed' || existingBundle.pc.connectionState === 'failed') {
        const isInitiator = currentUserId < peer.id;
        if (isInitiator) {
          renegotiateWithPeer(peer.id);
        } else {
          getOrCreatePeerBundle(peer.id);
          // Notify existing peer we are ready so if they had an old connection or missed our join, they offer immediately
          sendRtcSignal(peer.id, { type: 'peer-ready' });

          // Fast fallback: if no offer arrives within 500ms, proactively initiate (Perfect Negotiation resolves any glare)
          const oldTimer = fallbackTimersRef.current.get(peer.id);
          if (oldTimer) clearTimeout(oldTimer);
          const timer = setTimeout(() => {
            fallbackTimersRef.current.delete(peer.id);
            if (!isMediaActiveRef.current) return;
            const b = peerBundles.current.get(peer.id);
            if (b && b.pc.remoteDescription === null && b.pc.signalingState === 'stable') {
              renegotiateWithPeer(peer.id);
            }
          }, 500);
          fallbackTimersRef.current.set(peer.id, timer);
        }
      }
    });

    // Cleanup disconnected peers
    const activePeerIds = new Set(peers.map((p) => p.id));
    Array.from(peerBundles.current.keys()).forEach((peerId) => {
      if (!activePeerIds.has(peerId) || peerId === currentUserId) {
        clearPeerState(peerId);
      }
    });
  }, [isMediaActive, peers, currentUserId, renegotiateWithPeer, getOrCreatePeerBundle, sendRtcSignal, clearPeerState]);

  return {
    remoteStreams,
    remoteScreenAudioStreams,
    remoteCameraStreams,
    remoteScreenStreams,
    remoteSpeaking,
  };
}
