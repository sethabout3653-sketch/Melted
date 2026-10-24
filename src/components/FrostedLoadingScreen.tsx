import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface FrostedLoadingScreenProps {
  isLoading: boolean;
}

export const FrostedLoadingScreen: React.FC<FrostedLoadingScreenProps> = ({ isLoading }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      // Trigger Samsung TV Cinemascope bars opening
      const openTimer = setTimeout(() => {
        setIsOpen(true);
      }, 100);

      const doneTimer = setTimeout(() => {
        setIsDone(true);
      }, 1100);

      return () => {
        clearTimeout(openTimer);
        clearTimeout(doneTimer);
      };
    }
  }, [isLoading]);

  if (isDone) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden select-none">
      {/* Top Samsung TV Cinemascope Black Bar */}
      <motion.div
        initial={{ y: 0 }}
        animate={{ y: isOpen ? '-100%' : 0 }}
        transition={{ duration: 0.9, ease: [0.77, 0, 0.175, 1] }}
        className="absolute top-0 inset-x-0 h-[50.5vh] bg-black z-10 border-b-2 border-blue-500 shadow-[0_10px_40px_rgba(59,130,246,0.6)]"
      />

      {/* Bottom Samsung TV Cinemascope Black Bar */}
      <motion.div
        initial={{ y: 0 }}
        animate={{ y: isOpen ? '100%' : 0 }}
        transition={{ duration: 0.9, ease: [0.77, 0, 0.175, 1] }}
        className="absolute bottom-0 inset-x-0 h-[50.5vh] bg-black z-10 border-t-2 border-blue-500 shadow-[0_-10px_40px_rgba(59,130,246,0.6)]"
      />

      {/* Center Laser Beam Line pulse during TV aperture split */}
      {isOpen && (
        <motion.div
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: 1, opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="absolute top-1/2 left-0 right-0 h-[3px] -translate-y-1/2 bg-blue-400 shadow-[0_0_30px_#60a5fa] z-15 pointer-events-none origin-center"
        />
      )}
    </div>
  );
};
