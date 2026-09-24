const CACHE = 'vpa-pwa-v44';
const APP_SHELL = [
  './', './index.html', './styles.css', './app.js', './supabase-client.js',
  './manifest.webmanifest', './version.json', './icons/icon-192.png', './icons/icon-512.png', './icons/notification-small.png', './icons/notification-logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (event) => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) { payload = { body: event.data ? event.data.text() : '' }; }
  const title = payload.title || 'Vencimento PA';
  event.waitUntil(self.registration.showNotification(title, {
    body: payload.body || 'Você tem uma nova atualização.', icon: payload.icon || './icons/notification-small.png', badge: payload.badge || './icons/notification-small.png', tag: payload.tag || 'vpa-push-notification', renotify: Boolean(payload.renotify), data: { ...(payload.data || {}), url: payload.url || './' }
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close(); const targetUrl = event.notification?.data?.url || './';
  event.waitUntil(self.clients.matchAll({ type:'window', includeUncontrolled:true }).then((clients) => clients[0]?.focus?.() || self.clients.openWindow?.(targetUrl)));
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }
  const isAppAsset = event.request.mode === 'navigate' || /\.(?:html|js|css|webmanifest)$/.test(url.pathname);
  if (isAppAsset) {
    event.respondWith(fetch(event.request, { cache:'no-store' }).then((response) => {
      if (response && response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response && response.ok && response.type === 'basic') caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
    return response;
  })));
});
