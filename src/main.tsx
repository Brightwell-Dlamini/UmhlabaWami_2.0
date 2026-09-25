import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ui/ToastProvider';
import { ConfirmProvider } from './components/ui/ConfirmDialog';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>
);

// PWA — register service worker (disable with VITE_ENABLE_PWA=false)
if (import.meta.env.VITE_ENABLE_PWA !== 'false' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => {
        // Check for a newer SW after each load (helps after deploys)
        try {
          reg.update();
        } catch {
          /* ignore */
        }
      })
      .catch((err) => {
        console.warn('Service worker registration failed', err);
      });
  });
}
