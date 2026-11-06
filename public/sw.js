/* My 3D Game Studio service worker.
 * Precaches every built file (app shell, bundled Three.js chunk, Draco decoder, demo model),
 * so the installed app works fully offline. User projects live in IndexedDB, never here.
 */
const VERSION = '__APP_VERSION__';
const CACHE = 'm3gs-' + VERSION;
const SHELL = __SHELL_FILES__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const c = await caches.open(CACHE);
      await c.addAll(SHELL);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k.startsWith('m3gs-') && k !== CACHE) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never intercept backend / other origins
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(async () => (await caches.match(req, { ignoreSearch: true })) || caches.match('./index.html', { ignoreSearch: true })));
    return;
  }
  event.respondWith((async () => (await caches.match(req, { ignoreSearch: true })) || fetch(req))());
});
