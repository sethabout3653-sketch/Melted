import React from 'react';

export const AdsterraAd: React.FC<{ className?: string }> = ({ className = '' }) => {
  const adHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>body { margin: 0; padding: 0; background: transparent; display: flex; justify-content: center; align-items: center; }</style>
      </head>
      <body>
        <script type="text/javascript">
          atOptions = {
            'key' : '81938193d8e3134e8a65e24bd88f05bd',
            'format' : 'iframe',
            'height' : 250,
            'width' : 300,
            'params' : {}
          };
        </script>
        <script type="text/javascript" src="https://www.highrevenueformat.com/81938193d8e3134e8a65e24bd88f05bd/invoke.js"></script>
      </body>
    </html>
  `;

  return (
    <div className={`adsterra-ad-container flex flex-col items-center justify-center overflow-hidden my-3 rounded-2xl bg-[var(--bg-navy)] border border-white/10 p-3 shadow-xl ${className}`}>
      <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-2">Sponsored Advertisement</div>
      <iframe
        srcDoc={adHtml}
        width="300"
        height="250"
        style={{ border: 'none', overflow: 'hidden', width: '300px', height: '250px' }}
        scrolling="no"
        frameBorder="0"
        title="Sponsored Ad"
      />
    </div>
  );
};
