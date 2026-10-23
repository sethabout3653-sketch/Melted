import React from 'react';

export const Adsterra160x600: React.FC<{ className?: string }> = ({ className = '' }) => {
  const adHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>body { margin: 0; padding: 0; background: transparent; display: flex; justify-content: center; align-items: center; }</style>
      </head>
      <body>
        <script type="text/javascript">
          atOptions = {
            'key' : 'c5ab8d7ce1ca21617db4a8d2675a4a7d',
            'format' : 'iframe',
            'height' : 600,
            'width' : 160,
            'params' : {}
          };
        </script>
        <script type="text/javascript" src="https://www.highrevenueformat.com/c5ab8d7ce1ca21617db4a8d2675a4a7d/invoke.js"></script>
      </body>
    </html>
  `;

  return (
    <div className={`adsterra-160x600-container flex flex-col items-center justify-center overflow-hidden my-3 rounded-2xl bg-[var(--bg-navy)] border border-white/10 p-3 shadow-xl ${className}`}>
      <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-2">Sponsored Advertisement</div>
      <iframe
        srcDoc={adHtml}
        width="160"
        height="600"
        style={{ border: 'none', overflow: 'hidden', width: '160px', height: '600px' }}
        scrolling="no"
        frameBorder="0"
        title="Sponsored Skyscraper Ad"
      />
    </div>
  );
};
