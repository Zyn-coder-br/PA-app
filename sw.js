const CACHE_NAME = "assistente-zyn-v2.0.7";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./src/app.js?v=2.0.7",
  "./src/styles.css?v=2.0.7",
  "./icons/zyn-icon-192-v2.png",
  "./icons/zyn-icon-512-v2.png",
  "./icons/zyn-icon-maskable-v2.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if(event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;

  // Always prefer the network for the application shell so GitHub Pages
  // deployments are picked up on the normal browser tab as well as the PWA.
  const isAppShell = req.mode === "navigate" || /\.(?:js|css|html|webmanifest)$/.test(url.pathname);
  if(isAppShell){
    event.respondWith(
      fetch(req, {cache:"no-store"})
        .then(response => {
          if(response && response.ok){
            const copy=response.clone();
            caches.open(CACHE_NAME).then(cache=>cache.put(req,copy));
          }
          return response;
        })
        .catch(() => caches.match(req).then(cached => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(response => {
      if(response && response.ok){
        const copy=response.clone();
        caches.open(CACHE_NAME).then(cache=>cache.put(req,copy));
      }
      return response;
    }).catch(()=>cached))
  );
});
