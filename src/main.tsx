import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);

// Service worker: caches the app shell + pinned Three.js modules for offline use.
// Not available inside sandboxed preview frames — failures are ignored.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
      /* unsupported in this context */
    });
  });
}
