self.addEventListener('install', (e) => {
  console.log('Service Worker Installato');
});

self.addEventListener('fetch', (e) => {
  // Lasciamo che le richieste passino normalmente
  e.respondWith(fetch(e.request));
});
