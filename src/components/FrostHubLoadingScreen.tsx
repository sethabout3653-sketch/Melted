import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export const FrostHubLoadingScreen: React.FC = () => {
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // Fast reveal so the app never appears stuck loading
    const timer = setTimeout(() => {
      setIsFading(true);
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }, 200);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  return (
    <AnimatePresence>
      {!isFading && (
        <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden select-none">
          {/* Top Cinematic Shutter */}
          <motion.div
            initial={{ y: 0 }}
            exit={{ y: '-100%' }}
            transition={{ 
              duration: 0.35, 
              ease: [0.65, 0, 0.35, 1] 
            }}
            className="absolute top-0 left-0 right-0 h-1/2 bg-[#070d1a] z-20 pointer-events-none"
          />
          
          {/* Bottom Cinematic Shutter */}
          <motion.div
            initial={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ 
              duration: 0.35, 
              ease: [0.65, 0, 0.35, 1] 
            }}
            className="absolute bottom-0 left-0 right-0 h-1/2 bg-[#070d1a] z-20 pointer-events-none"
          />

          {/* Flash Effect during split */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.4, 0] }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="absolute inset-0 bg-white z-10 pointer-events-none"
          />
        </div>
      )}
    </AnimatePresence>
  );
};
