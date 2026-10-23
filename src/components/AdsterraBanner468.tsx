import React from 'react';

export const AdsterraBanner468: React.FC<{ className?: string }> = ({ className = '' }) => {
  const adHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>body { margin: 0; padding: 0; background: transparent; display: flex; justify-content: center; align-items: center; }</style>
      </head>
      <body>
        <script type="text/javascript">
          atOptions = {
            'key' : '8809051179810e0855632397591ca78b',
            'format' : 'iframe',
            'height' : 60,
            'width' : 468,
            'params' : {}
          };
        </script>
        <script type="text/javascript" src="https://www.highrevenueformat.com/8809051179810e0855632397591ca78b/invoke.js"></script>
      </body>
    </html>
  `;

  return (
    <div className={`adsterra-banner-468 flex flex-col items-center justify-center overflow-hidden my-3 rounded-2xl bg-[var(--bg-navy)] border border-white/10 p-3 shadow-xl ${className}`}>
      <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1.5">Sponsored Advertisement</div>
      <iframe
        srcDoc={adHtml}
        width="468"
        height="60"
        style={{ border: 'none', overflow: 'hidden', width: '468px', height: '60px' }}
        scrolling="no"
        frameBorder="0"
        title="Sponsored Banner"
      />
    </div>
  );
};
