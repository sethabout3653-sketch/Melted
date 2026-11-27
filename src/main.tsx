import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { installWasmWebSocketGuard } from './utils/wasmWsGuard.ts';
import './index.css';

// Install wasm-bindgen WebSocket guard before any proxy WASM transports load
installWasmWebSocketGuard();

// Hide and suppress Maximum update depth exceeded, media play interruption, and proxy transport errors
if (typeof window !== 'undefined') {
  const isIgnorableProxyError = (val: unknown): boolean => {
    const text = typeof val === 'string' ? val : (val as any)?.message || (val as any)?.stack || String(val || '');
    return (
      text.includes('Hyper client') ||
      text.includes('GoAway') ||
      text.includes('Http2') ||
      text.includes('epoxy-transport') ||
      text.includes('wbindgen') ||
      text.includes('closure invoked after being dropped') ||
      text.includes('sendrequest') ||
      text.includes('Assuming <form> element') ||
      text.includes('extraneous query parameter') ||
      text.includes('detected quirky document structure parsing') ||
      text.includes('Maximum update depth exceeded') ||
      text.includes('ResizeObserver') ||
      text.includes('The play() request was interrupted')
    );
  };

  const origConsoleError = console.error;
  console.error = (...args: any[]) => {
    if (args.some(isIgnorableProxyError)) return;
    origConsoleError.apply(console, args);
  };

  const origConsoleWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (args.some(isIgnorableProxyError)) return;
    origConsoleWarn.apply(console, args);
  };

  window.addEventListener('error', (event) => {
    if (isIgnorableProxyError(event?.message) || isIgnorableProxyError(event?.error)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    if (isIgnorableProxyError(event?.reason)) {
      event.preventDefault();
      event.stopImmediatePropagation?.();
    }
  }, true);
}

let isNestedFrostHubEmbed = false;
try {
  isNestedFrostHubEmbed =
    typeof window !== 'undefined' &&
    window !== window.top &&
    window.frameElement?.getAttribute?.('data-frosthub-embed') === 'true';
} catch {}

if (isNestedFrostHubEmbed) {
  createRoot(document.getElementById('root')!).render(
    <div className="w-screen h-screen bg-[#05070c] text-white flex flex-col items-center justify-center p-6 text-center select-none">
      <p className="text-sm font-bold text-slate-200">
        This page could not load inside the proxy frame.
      </p>
      <p className="text-xs text-slate-400 mt-1.5 max-w-sm">
        Use the reload button above or navigate to a valid URL.
      </p>
    </div>
  );
} else {
  createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
