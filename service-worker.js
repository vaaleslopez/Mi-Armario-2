/**
 * service-worker.js
 * Cachea el "app shell" para que Mi Armario funcione 100% offline.
 * IMPORTANTE: cuando cambies archivos, subí el número de CACHE_VERSION
 * para que los celulares descarguen la nueva versión.
 */

const CACHE_VERSION = 'mi-armario-v5';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/database.js',
  './js/utils.js',
  './js/inventory.js',
  './js/sales.js',
  './js/customers.js',
  './js/filters.js',
  './js/catalog.js',
  './js/share.js',
  './js/backup.js',
  './js/ui.js',
  './js/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      // Cache-first para respuesta inmediata; actualiza en segundo plano.
      return cached || networkFetch;
    })
  );
});
