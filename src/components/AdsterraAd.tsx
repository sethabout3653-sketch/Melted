import React, { useEffect, useRef } from 'react';

export const AdsterraAd: React.FC<{ className?: string }> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';

    const atOptionsScript = document.createElement('script');
    atOptionsScript.type = 'text/javascript';
    atOptionsScript.text = `
      if (typeof atOptions === 'undefined') {
        window.atOptions = {};
      }
      window.atOptions = {
        'key' : '6133108',
        'format' : 'iframe',
        'height' : 250,
        'width' : 300,
        'params' : {}
      };
    `;

    const invokeScript = document.createElement('script');
    invokeScript.type = 'text/javascript';
    invokeScript.src = '//www.highperformanceformat.com/6133108/invoke.js';
    invokeScript.async = true;

    container.appendChild(atOptionsScript);
    container.appendChild(invokeScript);

    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, []);

  return (
    <div className={`adsterra-ad-container flex flex-col items-center justify-center overflow-hidden my-3 rounded-2xl bg-[#0c0c10] border border-white/10 p-3 shadow-xl ${className}`}>
      <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-2">Sponsored Advertisement</div>
      <div ref={containerRef} className="flex items-center justify-center min-h-[250px] min-w-[300px] w-full" />
    </div>
  );
};
