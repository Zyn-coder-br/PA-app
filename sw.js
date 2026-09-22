const CACHE = 'vpa-pwa-v11-realtime-notifications';
const APP_SHELL = [
  './', './index.html', './styles.css', './app.js', './supabase-client.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/notification-small.png', './icons/notification-logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Base for Web Push notifications. The Vencimento PA logo is used by default.

// The server will send a JSON payload such as:
// { title, body, icon, badge, tag, url, data }
self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Vencimento PA';
  const options = {
    body: payload.body || 'Você tem uma nova atualização.',
    icon: payload.icon || './icons/notification-small.png',
    badge: payload.badge || './icons/notification-small.png',
    tag: payload.tag || 'vpa-push-notification',
    renotify: Boolean(payload.renotify),
    data: {
      ...(payload.data || {}),
      url: payload.url || './'
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || './';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ('focus' in client) {
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }

        return undefined;
      })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const request = event.request;

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response && response.status === 200 && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
      }

      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
