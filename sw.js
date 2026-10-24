const CACHE_NAME = 'mochineko-shell-v3';
const APP_SHELL = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest', './icons/icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('mochineko-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()).then(async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(clients.map(client => client.navigate(client.url)));
  }));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(request).then(cached => {
    if (cached) return cached;
    return fetch(request).then(response => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }).catch(() => request.mode === 'navigate' ? caches.match('./index.html') : Response.error());
  }));
});

