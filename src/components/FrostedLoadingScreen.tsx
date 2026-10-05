import React, { useEffect, useState } from 'react';

interface FrostedLoadingScreenProps {
  isLoading: boolean;
}

export const FrostedLoadingScreen: React.FC<FrostedLoadingScreenProps> = ({ isLoading }) => {
  const letters = ['F', 'r', 'o', 's', 't', 'e', 'd'];
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);

  // Monitor loading state and trigger smooth fade-out
  useEffect(() => {
    if (!isLoading) {
      setIsFadingOut(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 800); // Matches CSS transition duration
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (!shouldRender) return null;

  return (
    <div 
      className={`fixed inset-0 z-50 bg-[#020203] flex flex-col items-center justify-center overflow-hidden select-none transition-all duration-700 ease-in-out transform-gpu ${
        isFadingOut ? 'opacity-0 scale-[1.03] blur-[15px] pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      
      {/* 0.05s Letter Delay & 0.5s Word Resting Loop with Premium Metallic Shaders */}
      <style>{`
        @keyframes snappyFrostedBounce {
          0% {
            transform: translateY(0) scale(1, 1) rotate(0deg);
          }
          14% {
            /* Smooth jump peak with 3D lean */
            transform: translateY(-65px) scale(0.92, 1.08) rotate(7deg);
          }
          26% {
            /* Gravity apex transition */
            transform: translateY(-70px) scale(0.96, 1.04) rotate(-4deg);
          }
          38% {
            /* Squash on landing impact */
            transform: translateY(0) scale(1.18, 0.8) rotate(0deg);
          }
          43% {
            /* Quick rebound */
            transform: translateY(-8px) scale(0.98, 1.02) rotate(0deg);
          }
          46.7% {
            /* Settled flat */
            transform: translateY(0) scale(1, 1) rotate(0deg);
          }
          46.7%, 100% {
            transform: translateY(0) scale(1, 1) rotate(0deg);
          }
        }

        .frosted-letter-container {
          perspective: 1000px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .frosted-letter {
          display: inline-block;
          font-family: 'Outfit', sans-serif;
          font-weight: 900;
          font-size: 6rem; /* Slightly larger, perfectly centered */
          line-height: 1;
          background: linear-gradient(135deg, #ffffff 20%, #cbd5e1 45%, #3b82f6 75%, #1e3a8a 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          
          /* Layered premium 3D bevel shadows */
          filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.6))
                  drop-shadow(0 15px 15px rgba(0, 102, 255, 0.15));
          
          animation: snappyFrostedBounce 1.5s infinite cubic-bezier(0.25, 1, 0.5, 1);
          transform-origin: bottom center;
          margin: 0 2px;
        }

        /* Accent floor reflection with smooth silver-blue gradient mask */
        .glowing-floor {
          width: 550px;
          height: 40px;
          background: radial-gradient(ellipse at center, rgba(0, 102, 255, 0.3) 0%, rgba(0, 0, 0, 0) 75%);
          border-radius: 50%;
          filter: blur(12px);
          margin-top: 20px;
          transform: scaleY(0.3);
          pointer-events: none;
        }
      `}</style>

      {/* Main Letters Centered Container */}
      <div className="flex flex-col items-center justify-center relative translate-y-[-10px]">
        
        {/* Row of Letters */}
        <div className="frosted-letter-container">
          {letters.map((char, index) => (
            <span
              key={index}
              className="frosted-letter"
              style={{
                animationDelay: `${index * 0.05}s`,
              }}
            >
              {char}
            </span>
          ))}
        </div>

        {/* Ambient Floor Glow */}
        <div className="glowing-floor" />

        {/* Upside Down Reflection */}
        <div className="flex items-start justify-center opacity-15 mt-2 pointer-events-none scale-y-[-0.6] transform origin-top blur-[1px]">
          {letters.map((char, index) => (
            <span
              key={`ref-${index}`}
              className="frosted-letter"
              style={{
                animationDelay: `${index * 0.05}s`,
              }}
            >
              {char}
            </span>
          ))}
        </div>

      </div>

    </div>
  );
};
