const CACHE_VERSION = 'pwa-app-v4';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_URL = '/offline.html';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  OFFLINE_URL,
  '/manifest.json',
  '/app.html',
  '/css/styles.css',
  '/css/home-v4-hybrid.css',
  '/css/pwa-install.css?v=pwa-app-v4',
  '/css/pwa-app-shell.css?v=pwa-app-v4',
  '/js/path-utils.js',
  // Never precache bare /js/config.js — CF may hold immutable +233 poison for months
  '/js/config.js?v=apcontact-002',
  '/js/components.js?v=auth-nav-once-v2',
  '/js/home-v4-hybrid.js?v=vehicle-engine-001c',
  '/js/pwa-install.js?v=pwa-app-v4',
  '/js/pwa-app-shell.js?v=pwa-app-v4',
  '/assets/favicon.png',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/apple-touch-icon.png',
  '/assets/logo.png',
  '/assets/logo@2x.png',
];

function cacheStaticAssets() {
  return caches.open(STATIC_CACHE).then(cache => Promise.all(
    STATIC_ASSETS.map(url => (
      fetch(url, { cache: 'reload' })
        .then(response => {
          if (!response || !response.ok) return null;
          return cache.put(url, response);
        })
        .catch(() => null)
    ))
  ));
}

function cacheFirst(request) {
  return caches.match(request).then(cached => {
    if (cached) return cached;
    return fetch(request).then(response => {
      if (!response || response.status !== 200 || response.type !== 'basic') return response;
      const copy = response.clone();
      caches.open(STATIC_CACHE).then(cache => cache.put(request, copy));
      return response;
    }).catch(() => Response.error());
  });
}

function staleWhileRevalidate(request) {
  return caches.match(request).then(cached => {
    const networkFetch = fetch(request)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => cached || Response.error());
    return cached || networkFetch;
  });
}

function networkFirstNavigation(request) {
  return fetch(request)
    .then(response => {
      const copy = response.clone();
      caches.open(STATIC_CACHE).then(cache => cache.put(request, copy));
      return response;
    })
    .catch(() => caches.match(request).then(cached => cached || caches.match(OFFLINE_URL)));
}

self.addEventListener('install', event => {
  event.waitUntil(
    cacheStaticAssets()
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('apapp-001-') && key !== STATIC_CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (request.destination === 'style' || request.destination === 'script') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (request.destination === 'image' || url.pathname.startsWith('/assets/icons/')) {
    event.respondWith(cacheFirst(request));
  }
});
