/* Let's Go! V2 preview service worker. Its own scope (/letsgo/v2/), so it installs as a separate app from V1.
   Network first so updates land straight away; the saved copy is only used offline. Only touches its own caches. */
const CACHE = 'letsgo-v2-20261102d';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('letsgo-v2-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.includes('/letsgo/v2/')) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || (e.request.mode === 'navigate' ? caches.match('./') : undefined)))
  );
});
