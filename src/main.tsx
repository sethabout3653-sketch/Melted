import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Hide and suppress Maximum update depth exceeded and media play interruption errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const msg = event?.message || '';
    if (
      msg.includes('Maximum update depth exceeded') ||
      msg.includes('ResizeObserver') ||
      msg.includes('The play() request was interrupted')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = String(event?.reason || '');
    if (
      reason.includes('Maximum update depth exceeded') ||
      reason.includes('play()')
    ) {
      event.preventDefault();
    }
  });
}

// Register Service Worker immediately to guarantee offline refresh works without failure
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[Melted SW] Offline service worker active:', registration.scope);
      })
      .catch((error) => {
        console.warn('[Melted SW] Registration warning:', error);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
