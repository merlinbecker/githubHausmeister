import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { registerServiceWorker } from './lib/serviceWorker';

createRoot(document.getElementById('root')!).render(<App />);

// Register service worker after app initialization
// Enable in development for Replit since it provides HTTPS
if (import.meta.env.PROD || import.meta.env.DEV) {
  registerServiceWorker();
}
