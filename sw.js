// Nome del database interno al browser
const CACHE_NAME = 'presenze-v2';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// Installazione del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache delle risorse essenziali
      console.log('Service Worker: caching risorse essenziali');
      return cache.addAll(urlsToCache);
    }).then(() => {
      // Forza l'attivazione immediata
      console.log('Service Worker: installazione completata');
      return self.skipWaiting();
    })
  );
});

// Attivazione e pulizia vecchie cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Pulisci vecchie cache
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: rimozione vecchia cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Prendi il controllo di tutti i client
      self.clients.claim()
    ]).then(() => {
      console.log('Service Worker: attivazione completata');
    })
  );
});

// Strategia Cache-First per risorse statiche
self.addEventListener('fetch', (event) => {
  // Solo per richieste GET e solo per lo stesso dominio
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Se trovato in cache, restituiscilo
      if (cachedResponse) {
        console.log('Service Worker: risorsa servita dalla cache:', event.request.url);
        return cachedResponse;
      }

      // Altrimenti fai la richiesta di rete
      return fetch(event.request).then((networkResponse) => {
        // Se la richiesta ha successo, metti in cache
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            console.log('Service Worker: caching risorsa:', event.request.url);
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch((error) => {
        console.log('Service Worker: errore di rete:', error);
        
        // Fallback per la pagina principale
        if (event.request.mode === 'navigate') {
          console.log('Service Worker: fallback a index.html');
          return caches.match('./index.html');
        }
        
        // Fallback generico
        return new Response('Connessione assente', {
          status: 408,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      });
    })
  );
});
