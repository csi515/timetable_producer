const CACHE_NAME = 'timetable-app-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/src/index.ts',
  '/src/app.ts',
  '/src/timetable.ts',
  '/src/storage.ts',
  '/src/styles.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});

