import React, { useEffect, useRef } from 'react';

export const AdsterraBanner468: React.FC<{ className?: string }> = ({ className = '' }) => {
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
        'key' : '8809051179810e0855632397591ca78b',
        'format' : 'iframe',
        'height' : 60,
        'width' : 468,
        'params' : {}
      };
    `;

    const invokeScript = document.createElement('script');
    invokeScript.type = 'text/javascript';
    invokeScript.src = 'https://www.highrevenueformat.com/8809051179810e0855632397591ca78b/invoke.js';
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
    <div className={`adsterra-banner-468 flex flex-col items-center justify-center overflow-hidden my-3 rounded-2xl bg-[#0c0c10] border border-white/10 p-3 shadow-xl ${className}`}>
      <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1.5">Sponsored Advertisement</div>
      <div ref={containerRef} className="flex items-center justify-center min-h-[60px] min-w-[468px] w-full max-w-[468px] overflow-hidden" />
    </div>
  );
};
