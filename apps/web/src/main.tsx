import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import { startPwa } from './lib/pwa';
import { applyEnvBranding } from './lib/env';
import { armSplashDismiss } from './lib/splash';
import './styles.css';

// Apply this env's branding (theme-color + iOS home-screen title/icon) to the
// document before paint, so prod/test/dev are visually distinct everywhere.
applyEnvBranding();

// Register the service worker as early as possible so precaching (and thus
// offline readiness) starts on the very first visit.
startPwa();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

// Fade out the inline loading splash once the first route's content is on
// screen (see lib/splash.ts).
armSplashDismiss();
