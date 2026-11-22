import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Hide and suppress Maximum update depth exceeded, media play interruption, and proxy transport errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const msg = String(event?.message || event?.error?.message || '');
    if (
      msg.includes('Maximum update depth exceeded') ||
      msg.includes('ResizeObserver') ||
      msg.includes('The play() request was interrupted') ||
      msg.includes('Hyper client') ||
      msg.includes('GoAway') ||
      msg.includes('Http2') ||
      msg.includes('epoxy-transport') ||
      msg.includes('wbindgen')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = String(event?.reason?.message || event?.reason || '');
    if (
      reason.includes('Maximum update depth exceeded') ||
      reason.includes('play()') ||
      reason.includes('Hyper client') ||
      reason.includes('GoAway') ||
      reason.includes('Http2') ||
      reason.includes('epoxy-transport') ||
      reason.includes('wbindgen')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation?.();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
