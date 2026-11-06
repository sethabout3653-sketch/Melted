import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
export const FrostHubLoadingScreen: React.FC = () => {
  const [isFading, setIsFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Lock scroll when mounting
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const startAudio = () => {
      const video = videoRef.current;
      if (!video) return;
      video.muted = false;
      video.play().catch(() => undefined);
    };

    const restartIntro = () => {
      setIsFading(false);
      window.setTimeout(() => {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = 0;
        video.muted = false;
        video.play().catch(() => undefined);
      }, 0);
    };

    videoRef.current?.play().catch(() => undefined);
    window.addEventListener('pointerdown', startAudio, { once: true });
    window.addEventListener('keydown', startAudio, { once: true });
    window.addEventListener('blur', restartIntro);
    document.addEventListener('visibilitychange', restartIntro);

    return () => {
      window.removeEventListener('pointerdown', startAudio);
      window.removeEventListener('keydown', startAudio);
      window.removeEventListener('blur', restartIntro);
      document.removeEventListener('visibilitychange', restartIntro);
      // Unlock scroll when unmounting
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  const handleVideoEnd = () => {
    // Start fade out process immediately
    setIsFading(true);
  };

  return (
    <AnimatePresence>
      {!isFading && (
        <motion.div
          key="frosthub-loading-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "linear" }}
          className="fixed inset-0 z-[9999] bg-black overflow-hidden select-none font-sans flex items-center justify-center cursor-default touch-none"
        >
            {/* The Video Intro */}
            <video
              ref={videoRef}
              src="/assets/aistudio/video-1.mp4"
              className="w-full h-full object-cover pointer-events-none"
              autoPlay
              playsInline
              muted={false}
              onEnded={handleVideoEnd}
            />
          </motion.div>
        )}
      </AnimatePresence>
  );
};
