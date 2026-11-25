// One service worker for the whole site. The page shell and the rescue alerts
// must live in the same worker: two workers on scope '/' replace each other.
const VERSION = 'sos-pwa-v2';

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('sos-pwa-') && key !== VERSION).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Matching, mission state, payments and provider availability must remain live.
  event.respondWith(fetch(request));
});

// Rescue alerts (Web Push). A push that arrives must always show a notification,
// or the browser can revoke alert permission for the site.
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json?.() || {}; } catch { data = { body: event.data?.text?.() || 'You have a new S.O.S. update.' }; }
  const title = data.title || 'S.O.S.';
  const urgent = data.type === 'hero_offer' || data.type === 'mission_offer';
  const options = {
    body: data.body || 'Open S.O.S. for details.',
    icon: '/sos-app-icon-192.png',
    badge: '/favicon.png',
    tag: data.notification_ref ? `sos-${data.notification_ref}` : 'sos-update',
    renotify: true,
    requireInteraction: urgent,
    vibrate: urgent ? [300, 120, 300, 120, 300] : undefined,
    data: { url: data.url || '/app' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/app', self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const existing = list.find(client => client.url.startsWith(self.location.origin));
    if (existing) { existing.focus(); return existing.navigate(target); }
    return clients.openWindow(target);
  }));
});
