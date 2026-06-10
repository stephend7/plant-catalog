/* Carnivore Catalog — Service Worker
   Caches the app shell and CDN libraries so the app loads and runs offline.
   Supabase API/Storage calls are never cached here — the app handles those
   via its own IndexedDB photo cache and localStorage plant cache.
*/
const CACHE = 'carnivore-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c =>
      // Pre-cache the app shell; ignore errors so install always succeeds
      c.addAll(['/plant-catalog/', '/plant-catalog/index.html']).catch(() => {})
    )
  );
});

self.addEventListener('activate', e => {
  self.clients.claim();
  // Remove any old cache versions
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never intercept Supabase API or Storage — always go to network
  if (url.hostname.includes('supabase.co')) return;

  // Cache CDN libraries (Supabase JS, heic2any) — stale-while-revalidate
  if (url.hostname === 'esm.sh' || url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(swr(e.request));
    return;
  }

  // Cache the app shell — stale-while-revalidate
  if (url.pathname.startsWith('/plant-catalog')) {
    e.respondWith(swr(e.request));
  }
});

async function swr(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  // Kick off a fresh fetch in the background; update cache when it lands
  const fresh = fetch(request).then(r => {
    if (r && (r.ok || r.type === 'opaque')) cache.put(request, r.clone());
    return r;
  }).catch(() => null);
  // Return cached immediately if we have it; otherwise wait for network
  return cached || await fresh;
}
