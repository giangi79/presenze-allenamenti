// =================== SERVICE WORKER REGISTRO PRESENZE ===================
// Versione: 2.0.0
// Compatibile con Android e iOS

const CACHE_NAME = 'registro-presenze-v3';
const APP_VERSION = '3.0.0';

// Risorse da memorizzare nella cache
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './icon-192.png',
  './icon-512.png'
];

// =================== INSTALLAZIONE ===================
self.addEventListener('install', (event) => {
  console.log('[SW] 🔧 Installazione Service Worker v' + APP_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] 📦 Cache delle risorse essenziali');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] ✅ Installazione completata');
        return self.skipWaiting(); // Attiva immediatamente
      })
      .catch((error) => {
        console.error('[SW] ❌ Errore durante installazione:', error);
      })
  );
});

// =================== ATTIVAZIONE ===================
self.addEventListener('activate', (event) => {
  console.log('[SW] 🚀 Attivazione Service Worker');
  
  event.waitUntil(
    Promise.all([
      // Pulisci cache vecchie
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] 🗑️ Rimozione vecchia cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Prendi controllo di tutti i client
      self.clients.claim()
    ])
    .then(() => {
      console.log('[SW] ✅ Service Worker attivo e pronto');
      
      // Invia messaggio a tutti i client
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: APP_VERSION
          });
        });
      });
    })
  );
});

// =================== GESTIONE RICHIESTE ===================
self.addEventListener('fetch', (event) => {
  // Ignora richieste non-GET e di altri domini
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // Strategia: Cache First per risorse statiche, Network First per dati
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Se la risorsa è in cache e non è una richiesta a Supabase
        if (cachedResponse && !event.request.url.includes('supabase.co')) {
          console.log('[SW] 📂 Servo dalla cache:', event.request.url);
          return cachedResponse;
        }
        
        // Altrimenti fai richiesta di rete
        return fetch(event.request)
          .then((networkResponse) => {
            // Se la risposta è valida, metti in cache (escludendo Supabase)
            if (networkResponse && networkResponse.status === 200 &&
                networkResponse.type === 'basic' &&
                !event.request.url.includes('supabase.co')) {
              
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                  console.log('[SW] 💾 Aggiornamento cache:', event.request.url);
                });
            }
            return networkResponse;
          })
          .catch((error) => {
            console.log('[SW] 🌐 Errore di rete:', error);
            
            // Se è una richiesta di navigazione, fallback a index.html
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            
            // Per altre risorse, restituisci risorsa cached o errore
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // Fallback generico
            return new Response(
              '<h1>Connessione assente</h1><p>L\'app richiede una connessione internet.</p>',
              {
                status: 408,
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
              }
            );
          });
      })
  );
});

// =================== GESTIONE MESSAGGI ===================
self.addEventListener('message', (event) => {
  console.log('[SW] 📩 Messaggio ricevuto:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      console.log('[SW] 🗑️ Cache cancellata');
      event.ports[0].postMessage({ success: true });
    });
  }
  
  if (event.data && event.data.type === 'GET_CACHE_INFO') {
    caches.open(CACHE_NAME).then((cache) => {
      cache.keys().then((keys) => {
        event.ports[0].postMessage({
          cacheName: CACHE_NAME,
          size: keys.length,
          version: APP_VERSION
        });
      });
    });
  }
});

// =================== SINCRONIZZAZIONE IN BACKGROUND ===================
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-presenze') {
    console.log('[SW] 🔄 Sincronizzazione in background');
    event.waitUntil(syncPresenze());
  }
});

async function syncPresenze() {
  // Qui puoi implementare la sincronizzazione offline
  console.log('[SW] Sincronizzazione presenze...');
  return Promise.resolve();
}

// =================== NOTIFICHE PUSH ===================
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body || 'Nuova notifica dal Registro Presenze',
    icon: './icon-192.png',
    badge: './icon-72.png',
    tag: 'presenze-notification',
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      url: data.url || './'
    },
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
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('./') && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url || './');
        }
      })
    );
  }
});

// =================== CONTROLLO VERSIONE ===================
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-updates') {
    console.log('[SW] 🔍 Controllo aggiornamenti...');
    checkForUpdates();
  }
});

async function checkForUpdates() {
  try {
    const response = await fetch('./?v=' + Date.now());
    if (!response.ok) throw new Error('Network error');
    
    // Qui puoi implementare la logica per aggiornamenti
    console.log('[SW] ✅ App aggiornata');
    
  } catch (error) {
    console.log('[SW] 🌐 App in modalità offline');
  }
}

console.log('[SW] 🚀 Service Worker caricato e pronto');
