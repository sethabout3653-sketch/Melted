import React, { useState, useRef, useEffect } from 'react';
import { Video, Monitor, PhoneOff, Mic, Play, Square, Wifi, ShieldCheck, AlertCircle } from 'lucide-react';

export const MediaRecorderStreamer: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'screen'>('camera');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  // MSE buffer queue
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const queueRef = useRef<ArrayBuffer[]>([]);

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, []);

  const startStream = async (mode: 'camera' | 'screen') => {
    setError(null);
    try {
      // 1. Connect to WebSocket server
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws-db`;
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log('[MediaRecorderStreamer] Connected to WebSocket');
      };

      socket.onmessage = async (event) => {
        try {
          if (typeof event.data === 'string') {
            const data = JSON.parse(event.data);
            if (data.type === 'MEDIA_CHUNK' && data.buffer) {
              const binaryString = atob(data.buffer);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const arrayBuffer = bytes.buffer;
              if (sourceBufferRef.current && !sourceBufferRef.current.updating) {
                try {
                  sourceBufferRef.current.appendBuffer(arrayBuffer);
                } catch (e) {
                  console.warn('[MSE] appendBuffer error:', e);
                }
              } else {
                queueRef.current.push(arrayBuffer);
              }
            }
          } else if (event.data instanceof Blob || event.data instanceof ArrayBuffer) {
            const arrayBuffer = event.data instanceof Blob ? await event.data.arrayBuffer() : event.data;
            if (sourceBufferRef.current && !sourceBufferRef.current.updating) {
              try {
                sourceBufferRef.current.appendBuffer(arrayBuffer);
              } catch (e) {
                console.warn('[MSE] appendBuffer error:', e);
              }
            } else {
              queueRef.current.push(arrayBuffer);
            }
          }
        } catch (err) {
          console.warn('[MediaRecorderStreamer] message parse error:', err);
        }
      };

      // 2. Get Media Stream (Camera vs Screen)
      let stream: MediaStream;
      if (mode === 'camera') {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } },
          audio: true,
        });
      } else {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        if (isIOS) {
          setError('Screen sharing is not supported by web browsers on iOS.');
          socket.close();
          return;
        }
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 15 } } as any,
          audio: true,
        });
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // 3. Setup MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && socketRef.current?.readyState === WebSocket.OPEN) {
          const buffer = await event.data.arrayBuffer();
          // Send chunk over WebSocket
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          socketRef.current.send(JSON.stringify({
            type: 'MEDIA_CHUNK',
            buffer: base64,
          }));
        }
      };

      // Handle user stopping screen share via browser UI button
      if (mode === 'screen') {
        stream.getVideoTracks()[0].onended = () => {
          stopStream();
        };
      }

      mediaRecorder.start(100);
      setIsStreaming(true);

      // 4. Setup MSE on Receiver Player
      if (remoteVideoRef.current) {
        if ('MediaSource' in window && MediaSource.isTypeSupported(mimeType)) {
          const mediaSource = new MediaSource();
          remoteVideoRef.current.src = URL.createObjectURL(mediaSource);

          mediaSource.addEventListener('sourceopen', () => {
            try {
              const sourceBuffer = mediaSource.addSourceBuffer(mimeType);
              sourceBufferRef.current = sourceBuffer;

              sourceBuffer.addEventListener('updateend', () => {
                if (queueRef.current.length > 0 && !sourceBuffer.updating) {
                  const nextBuffer = queueRef.current.shift();
                  if (nextBuffer) {
                    try {
                      sourceBuffer.appendBuffer(nextBuffer);
                    } catch {}
                  }
                }
              });
            } catch (e) {
              console.warn('[MSE] addSourceBuffer error:', e);
            }
          });
        }
      }
    } catch (err: any) {
      console.error('[MediaRecorderStreamer] Start failed:', err);
      setError(err?.message || 'Could not start media streaming.');
      setIsStreaming(false);
    }
  };

  const stopStream = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch {}
    }
    if (localVideoRef.current?.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.src = '';
    }
    sourceBufferRef.current = null;
    queueRef.current = [];
    setIsStreaming(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0c0c10] border border-white/10 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#121216]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">WebSocket Media Streamer (No WebRTC)</h2>
              <p className="text-xs text-zinc-400">Stream camera or screen chunks via WebSockets & MediaSource Extensions</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopStream();
              onClose?.();
            }}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-6 py-3 bg-[#08080a] border-b border-white/10 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (!isStreaming) {
                setActiveTab('camera');
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${
              activeTab === 'camera'
                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>Camera & Mic</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!isStreaming) {
                setActiveTab('screen');
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${
              activeTab === 'screen'
                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>Screen Share</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-500/15 border border-red-500/30 rounded-2xl flex items-center gap-2 text-xs text-red-200 shrink-0">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Video Stage */}
        <div className="flex-1 min-h-0 p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto">
          
          {/* Local Broadcaster View */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-400">
              <span>Local Broadcaster Stream</span>
              {isStreaming && <span className="flex items-center gap-1 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Broadcasting</span>}
            </div>
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 flex items-center justify-center shadow-inner">
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {!isStreaming && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-2 bg-[#0c0c10]/80 backdrop-blur-sm">
                  {activeTab === 'camera' ? <Video className="w-8 h-8 text-zinc-600" /> : <Monitor className="w-8 h-8 text-zinc-600" />}
                  <span className="text-xs font-medium">Stream is stopped</span>
                </div>
              )}
            </div>
          </div>

          {/* Receiver / MSE Playback View */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-400">
              <span>Receiver Playback (via MSE)</span>
              <span className="text-blue-400">WebSocket Buffer</span>
            </div>
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 flex items-center justify-center shadow-inner">
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              {!isStreaming && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-2 bg-[#0c0c10]/80 backdrop-blur-sm">
                  <Wifi className="w-8 h-8 text-zinc-600" />
                  <span className="text-xs font-medium">Waiting for incoming chunks...</span>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer Action Bar */}
        <div className="px-6 py-4 bg-[#121216] border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-zinc-400 font-semibold">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span>MediaRecorder API + WebSocket binary packet relay</span>
          </div>
          <div>
            {isStreaming ? (
              <button
                type="button"
                onClick={stopStream}
                className="px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-lg shadow-red-600/30 transition-all cursor-pointer flex items-center gap-2"
              >
                <Square className="w-4 h-4" />
                <span>Stop Stream</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => startStream(activeTab)}
                className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-xl shadow-blue-600/30 transition-all cursor-pointer flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                <span>Start {activeTab === 'camera' ? 'Camera' : 'Screen'} Stream</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
