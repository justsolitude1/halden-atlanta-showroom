// Models and fonts are served from cache (they never change under the same name). Code and markup go to
// the network first, so an update is visible on the very next visit, falling back to cache when offline.
const VERSION = 'halden-v2';
const IMMUTABLE = /\.(glb|woff2)$/;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;

  if (IMMUTABLE.test(new URL(request.url).pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const hit = await cache.match(request);
      if (hit) return hit;
      const res = await fetch(request);
      if (res.ok) cache.put(request, res.clone());
      return res;
    })());
    return;
  }

  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const res = await fetch(request);
      if (res.ok) cache.put(request, res.clone());
      return res;
    } catch {
      return (await cache.match(request)) || Response.error();
    }
  })());
});
