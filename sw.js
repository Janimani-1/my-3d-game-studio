/* My 3D Game Studio service worker.
 * Precaches every built file (app shell, bundled Three.js chunk, Draco decoder, demo model),
 * so the installed app works fully offline. User projects live in IndexedDB, never here.
 */
const VERSION = '0.2.1+71f4d51a';
const CACHE = 'm3gs-' + VERSION;
const SHELL = ["./","./app.css","./app.js","./chunk-7O6LICKT.js","./chunk-7UTEMWCX.js","./chunk-C4JXJ3ZS.js","./chunk-MJ7WEKP6.js","./chunk-QK2NU65X.js","./chunk-SQE76S5B.js","./chunk-XP5ZWPEF.js","./chunk-XSEYFWQO.js","./chunk-YIC5ND5Y.js","./draco_decoder.js","./draco_decoder.wasm","./draco_wasm_wrapper.js","./icon-192.png","./icon-512.png","./icon.svg","./index.html","./manifest.webmanifest","./robot-expressive.glb"];

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
