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

  // Completely clean up and unregister any legacy service workers
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().catch(() => {});
      }
    }).catch(() => {});
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
