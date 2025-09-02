import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { registerServiceWorker } from './lib/serviceWorker';

createRoot(document.getElementById('root')!).render(<App />);

// Register service worker after app initialization
if (import.meta.env.PROD) {
  registerServiceWorker();
}
