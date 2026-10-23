import React, { useEffect, useRef } from 'react';

export const AdsterraCpmWidget: React.FC<{ className?: string }> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';

    const divId = 'container-165dc65323008468037b9a84191922fe';
    let wrapper = document.getElementById(divId);
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = divId;
      container.appendChild(wrapper);
    } else {
      container.appendChild(wrapper);
    }

    const invokeScript = document.createElement('script');
    invokeScript.async = true;
    invokeScript.setAttribute('data-cfasync', 'false');
    invokeScript.src = 'https://pl31903886.profitableratecpmnetwork.com/165dc65323008468037b9a84191922fe/invoke.js';
    container.appendChild(invokeScript);

    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, []);

  return (
    <div className={`adsterra-cpm-widget flex flex-col items-center justify-center overflow-hidden my-3 rounded-2xl bg-[var(--bg-navy)] border border-white/10 p-3 shadow-xl ${className}`}>
      <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1.5">Sponsored Banner</div>
      <div ref={containerRef} className="flex items-center justify-center w-full min-h-[90px]" />
    </div>
  );
};
