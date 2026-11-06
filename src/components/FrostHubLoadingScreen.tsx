import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play } from 'lucide-react';

interface FrostHubLoadingScreenProps {
  isLoading?: boolean;
}

export const FrostHubLoadingScreen: React.FC<FrostHubLoadingScreenProps> = () => {
  const [isVideoStarted, setIsVideoStarted] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [showPlayOverlay, setShowPlayOverlay] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Lock scroll when mounting
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Attempt to autoplay
    if (videoRef.current) {
      const playPromise = videoRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Autoplay started successfully
            setIsVideoStarted(true);
          })
          .catch(() => {
            // Autoplay failed (likely browser policy)
            setShowPlayOverlay(true);
          });
      }
    }

    return () => {
      // Unlock scroll when unmounting
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  const handleStartVideo = (e: React.MouseEvent) => {
    // If video already started, don't do anything with clicks
    if (isVideoStarted) {
      e.stopPropagation();
      return;
    }

    if (videoRef.current) {
      videoRef.current.play();
      setIsVideoStarted(true);
      setShowPlayOverlay(false);
    }
  };

  const handleVideoEnd = () => {
    // Start fade out process immediately
    setIsFading(true);
  };

  if (isDone) return null;

  return (
    <AnimatePresence onExitComplete={() => setIsDone(true)}>
      {!isFading && (
        <motion.div
          key="frosthub-loading-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "linear" }}
          className="fixed inset-0 z-[9999] bg-black overflow-hidden select-none font-sans flex items-center justify-center cursor-default touch-none"
          onClick={handleStartVideo}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
            {/* The Video Intro */}
            <video
              ref={videoRef}
              src="/assets/aistudio/lv_0_20261105150314_03d32ede.mp4"
              className="w-full h-full object-cover pointer-events-none"
              playsInline
              muted={false}
              onEnded={handleVideoEnd}
            />

            {showPlayOverlay && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all animate-in fade-in duration-500">
                <div className="flex flex-col items-center gap-6">
                  <div className="w-24 h-24 rounded-full bg-cyan-500/20 border border-cyan-500 flex items-center justify-center animate-pulse">
                    <Play className="w-10 h-10 text-cyan-400 fill-current" />
                  </div>
                  <span className="text-white font-black uppercase tracking-[0.2em] text-sm">Click to Enter FrostHub</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
  );
};
