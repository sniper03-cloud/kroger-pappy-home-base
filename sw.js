const scope = self.registration.scope;
const cachePrefix = `pappy-run:${scope}:`;
const cacheName = `${cachePrefix}v2`;
const shell = new URL('./index.html', scope).href;
const assets = [
  './index.html',
  './app.js',
  './stops.js',
  './styles.css',
  './manifest.webmanifest',
  './icons/pappy-180.png',
  './icons/pappy-192.png',
  './icons/pappy-512.png',
  './icons/pappy-maskable.png',
].map(path => new URL(path, scope).href);
const cacheable = new Set(assets);

self.addEventListener('install', event => {
  // Fetch a fresh copy of the entire shell before this version can take over.
  event.waitUntil(caches.open(cacheName).then(cache =>
    cache.addAll(assets.map(url => new Request(url, { cache: 'reload' })))
  ));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith(cachePrefix) && key !== cacheName)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isHome = event.request.mode === 'navigate' &&
    (url.pathname === new URL(scope).pathname || url.pathname === new URL(shell).pathname) &&
    url.origin === new URL(scope).origin;
  if (!isHome && !cacheable.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return await cache.match(isHome ? shell : url.href) ?? fetch(event.request);
  })());
});
