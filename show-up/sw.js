/* Show Up service worker: works offline and shows the morning nudge. */
const CACHE = 'showup-20261027j';
const SHELL = ['./', './index.html', './app.js?v=20261027j', './manifest.webmanifest', './logo-white.png', './stuart.jpg',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Our own files: try the network first so updates land, fall back to the saved copy when offline.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  // A number on the app icon (iPhone home screen apps, Windows and Mac), plus the usual ping and a gentle buzz.
  const badge = (self.navigator && self.navigator.setAppBadge) ? self.navigator.setAppBadge(1).catch(() => {}) : Promise.resolve();
  e.waitUntil(Promise.all([badge, self.registration.showNotification(d.title || 'Time to show up', {
    body: d.body || 'One tap when you’ve done it.',
    icon: 'icons/icon-192.png',
    tag: 'showup-nudge',
    renotify: true,
    silent: false,
    vibrate: [120, 80, 120],
    data: { url: d.url || './' }
  })]));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  if (self.navigator && self.navigator.clearAppBadge) self.navigator.clearAppBadge().catch(() => {});
  const target = new URL(e.notification.data && e.notification.data.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if (c.url.startsWith(self.registration.scope) && 'focus' in c) { c.navigate(target); return c.focus(); } }
    return self.clients.openWindow(target);
  }));
});
