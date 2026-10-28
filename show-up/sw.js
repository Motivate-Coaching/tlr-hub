/* The app moved to /letsgo/. This retires the old service worker on phones that still have it, and sends them to the new address. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.indexOf('showup-') === 0).map((k) => caches.delete(k)));
    await self.registration.unregister();
    const wins = await self.clients.matchAll({ type: 'window' });
    wins.forEach((c) => { try { c.navigate('/tlr-hub/letsgo/'); } catch (_) {} });
  })());
});
