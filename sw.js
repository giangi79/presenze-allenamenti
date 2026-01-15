// Nome del database interno al browser
const CACHE_NAME = 'presenze-v1';

// Installazione del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Forza l'attivazione immediata
      return self.skipWaiting();
    })
  );
});

// Attivazione e pulizia vecchie cache
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Gestione delle richieste (necessario per far comparire il tasto Installa)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
