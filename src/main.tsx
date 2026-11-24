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

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
