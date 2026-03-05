// =================== SERVICE WORKER REGISTRO PRESENZE ===================
// Versione: 4.0.0
// Compatibile con Android e iOS

const CACHE_NAME = 'registro-presenze-v4';
const APP_VERSION = '4.0.0';

// Risorse da memorizzare nella cache
const urlsToCache = [
  '/presenze-allenamenti/',
  '/presenze-allenamenti/index.html',
  '/presenze-allenamenti/manifest.json',
  '/presenze-allenamenti/favicon.ico',
  
  // Icone principali (assicurati che esistano)
  '/presenze-allenamenti/icon-72.png',
  '/presenze-allenamenti/icon-96.png', 
  '/presenze-allenamenti/icon-128.png',
  '/presenze-allenamenti/icon-144.png',
  '/presenze-allenamenti/icon-152.png',
  '/presenze-allenamenti/icon-192.png',
  '/presenze-allenamenti/icon-512.png',
  
  // Altre risorse statiche
  '/presenze-allenamenti/logo.png'
];

// =================== INSTALLAZIONE ===================
self.addEventListener('install', (event) => {
  console.log('[SW] 🔧 Installazione Service Worker v' + APP_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] 📦 Cache delle risorse essenziali');
        // Usa Promise.all con catch individuale per ogni risorsa
        return Promise.all(
          urlsToCache.map(url => {
            return cache.add(url).catch(error => {
              console.warn(`[SW] ⚠️ Impossibile caricare in cache: ${url}`, error);
              // Non blocchiamo l'installazione se una risorsa fallisce
              return Promise.resolve();
            });
          })
        );
      })
      .then(() => {
        console.log('[SW] ✅ Installazione completata');
        return self.skipWaiting();
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
      sendMessageToClients({
        type: 'SW_ACTIVATED',
        version: APP_VERSION
      });
    })
  );
});

// =================== GESTIONE RICHIESTE ===================
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // Ignora richieste non-GET
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Ignora richieste a domini esterni
  if (!requestUrl.origin.startsWith(self.location.origin)) {
    return;
  }
  
  // Ignora richieste API a Supabase
  if (requestUrl.href.includes('supabase.co') || 
      requestUrl.href.includes('supabase.com') ||
      requestUrl.pathname.includes('/rest/') ||
      requestUrl.pathname.includes('/auth/')) {
    return fetch(event.request);
  }
  
  // Strategia: Cache First per risorse statiche
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Se la risorsa è in cache, restituiscila
        if (cachedResponse) {
          console.log('[SW] 📂 Servo dalla cache:', requestUrl.pathname);
          
          // In background, aggiorna la cache dalla rete
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(event.request, responseToCache);
                  });
              }
            })
            .catch(() => {
              // Ignora errori di rete per l'aggiornamento in background
            });
          
          return cachedResponse;
        }
        
        // Altrimenti vai in rete
        return fetch(event.request)
          .then((networkResponse) => {
            // Se la risposta è valida, metti in cache
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                  console.log('[SW] 💾 Nuova risorsa in cache:', requestUrl.pathname);
                });
            }
            return networkResponse;
          })
          .catch((error) => {
            console.log('[SW] 🌐 Errore di rete per:', requestUrl.pathname);
            
            // Fallback per richieste di navigazione
            if (event.request.mode === 'navigate') {
              return caches.match('/presenze-allenamenti/');
            }
            
            // Fallback per icon-144.png se manca
            if (requestUrl.pathname.includes('icon-144')) {
              return caches.match('/presenze-allenamenti/icon-192.png');
            }
            
            // Fallback per altre icone
            if (requestUrl.pathname.includes('icon-')) {
              return caches.match('/presenze-allenamenti/icon-192.png');
            }
            
            // Fallback generico
            return new Response(
              '<h1>Connessione assente</h1><p>L\'app richiede una connessione internet per questa risorsa.</p>',
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
  
  const { type } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME).then(() => {
        console.log('[SW] 🗑️ Cache cancellata');
        sendMessageToClient(event.source, { type: 'CACHE_CLEARED' });
      });
      break;
      
    case 'GET_CACHE_INFO':
      caches.open(CACHE_NAME).then((cache) => {
        cache.keys().then((keys) => {
          sendMessageToClient(event.source, {
            type: 'CACHE_INFO',
            data: {
              cacheName: CACHE_NAME,
              size: keys.length,
              version: APP_VERSION
            }
          });
        });
      });
      break;
  }
});

// =================== FUNZIONI UTILITY ===================
function sendMessageToClients(message) {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage(message);
    });
  });
}

function sendMessageToClient(client, message) {
  client.postMessage(message);
}

// =================== PUSH NOTIFICATIONS (OPZIONALE) ===================
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'Nuova notifica dal Registro Presenze',
      icon: '/presenze-allenamenti/icon-192.png',
      badge: '/presenze-allenamenti/icon-72.png',
      tag: 'presenze-notification',
      vibrate: [200, 100, 200],
      data: {
        url: data.url || '/presenze-allenamenti/',
        timestamp: Date.now()
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(
        data.title || 'Registro Presenze 2050', 
        options
      )
    );
  } catch (error) {
    console.error('[SW] ❌ Errore notifica push:', error);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ 
      type: 'window',
      includeUncontrolled: true 
    }).then((clientList) => {
      // Cerca una finestra già aperta
      for (const client of clientList) {
        if (client.url.includes('/presenze-allenamenti/') && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Altrimenti apri nuova finestra
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url || '/presenze-allenamenti/');
      }
    })
  );
});

console.log('[SW] 🚀 Service Worker caricato e pronto (v' + APP_VERSION + ')');
