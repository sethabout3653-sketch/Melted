import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
export const FrostHubLoadingScreen: React.FC = () => {
  const [isFading, setIsFading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Lock scroll when mounting
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    videoRef.current?.play().catch(() => undefined);

    return () => {
      // Unlock scroll when unmounting
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

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
        >
            {/* The Video Intro */}
            <video
              ref={videoRef}
              src="/assets/aistudio/lv_0_20261105150314-60fps.mp4"
              className="w-full h-full object-cover pointer-events-none"
              autoPlay
              playsInline
              muted
              onEnded={handleVideoEnd}
            />
          </motion.div>
        )}
      </AnimatePresence>
  );
};
