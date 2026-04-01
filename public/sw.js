const APP_CACHE = 'studentlink-app-v2';
const REMOTE_ASSET_HOSTS = new Set(['api.dicebear.com', 'cdn.simpleicons.org']);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(['/', '/index.html']))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== APP_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isRemoteAsset = REMOTE_ASSET_HOSTS.has(url.hostname);

  if (!isSameOrigin && !isRemoteAsset) return;

  if (isSameOrigin && request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(APP_CACHE).then((cache) => cache.put(request, cloned));
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;
          return caches.match('/index.html');
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(APP_CACHE).then((cache) => cache.put(request, cloned));
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
