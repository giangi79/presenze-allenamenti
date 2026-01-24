// Service Worker compatibile Android e iOS
const CACHE_NAME = 'presenze-pwa-v4';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// Installa Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installazione in corso...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Cache delle risorse essenziali');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[Service Worker] Installazione completata');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[Service Worker] Errore durante installazione:', error);
      })
  );
});

// Attiva Service Worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Attivazione in corso...');
  
  // Pulisci vecchie cache
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Rimozione vecchia cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Attivazione completata');
      return self.clients.claim();
    })
  );
});

// Strategia Network First con fallback Cache
self.addEventListener('fetch', (event) => {
  // Ignora richieste non GET e richieste esterne
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Per richieste di navigazione, usa Cache First per performance
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            console.log('[Service Worker] Navigazione servita dalla cache');
            return cachedResponse;
          }
          
          // Se non in cache, fai richiesta di rete
          return fetch(event.request)
            .then(networkResponse => {
              // Metti in cache per prossime volte
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
              return networkResponse;
            })
            .catch(() => {
              // Fallback alla pagina principale
              return caches.match('./index.html');
            });
        })
    );
  } else {
    // Per altre risorse, usa Network First
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          // Se la risposta è valida, aggiorna la cache
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback alla cache
          return caches.match(event.request)
            .then(cachedResponse => {
              return cachedResponse || new Response('Connessione assente', {
                status: 408,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
              });
            });
        })
    );
  }
});

// Gestione messaggi
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Gestione sincronizzazione in background (solo Android)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-presenze') {
    console.log('[Service Worker] Sincronizzazione in background');
  }
});

// Gestione notifiche push (solo Android)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body || 'Nuova notifica dal registro presenze',
    icon: 'icon-192.png',
    badge: 'icon-72.png',
    tag: 'presenze-notification',
    renotify: true,
    actions: [
      {
        action: 'open',
        title: 'Apri'
      },
      {
        action: 'close',
        title: 'Chiudi'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Registro Presenze', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(clientList => {
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});
