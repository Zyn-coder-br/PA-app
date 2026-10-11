const CACHE = 'vpa-pwa-v63';
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

function storePendingPushNotice(notice) {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('vpa-notification-center-push', 1);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('pending')) request.result.createObjectStore('pending', { keyPath: 'id', autoIncrement: true }); };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('pending', 'readwrite');
        tx.objectStore('pending').add(notice);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); resolve(); };
      };
      request.onerror = () => resolve();
    } catch (_) { resolve(); }
  });
}

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) { payload = { body: event.data ? event.data.text() : '' }; }
  const title = payload.title || 'Vencimento PA';
  const body = payload.body || 'Você tem uma nova atualização.';
  const tag = payload.tag || 'vpa-push-notification';
  event.waitUntil(Promise.all([
    self.registration.showNotification(title, {
      body, icon: payload.icon || './icons/notification-small.png', badge: payload.badge || './icons/notification-small.png', tag, renotify: Boolean(payload.renotify), data: { ...(payload.data || {}), url: payload.url || './' }
    }),
    storePendingPushNotice({ title, body, tag, category: payload.category || (String(title).toLowerCase().includes('promotor') ? 'Promotor PA' : String(title).toLowerCase().includes('fefo') ? 'FEFO' : 'Aviso'), createdAt: new Date().toISOString() })
  ]));
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
