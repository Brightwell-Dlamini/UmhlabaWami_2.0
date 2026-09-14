/* Umhlaba Wami PWA service worker
 *
 * Network-first for HTML navigations so deploys (and env-baked Vite bundles)
 * are never stuck behind a stale cache. Only offline-fallback caches the shell.
 * Hashed /assets/* files may be cached; everything else prefers the network.
 */
const CACHE = 'umhlaba-wami-shell-v3';
const SHELL = ['/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Same-origin navigations / HTML: always network-first so new deploys win.
  const isNavigation =
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => caches.match('/') || caches.match('/index.html'))
    );
    return;
  }

  // Cross-origin (fonts, APIs): pass through; do not cache.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Hashed static assets under /assets/: stale-while-revalidate is fine.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              cache.put(request, response.clone()).catch(() => {});
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Default: network-first, cache as fallback only.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok && url.pathname === '/manifest.webmanifest') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
