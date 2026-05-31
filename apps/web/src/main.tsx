import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import { startPwa } from './lib/pwa';
import './styles.css';

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
