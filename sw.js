// =================== SERVICE WORKER REGISTRO PRESENZE ===================
// Versione: 5.0.0 (con notifiche intelligenti)
// Compatibile con Android e iOS

const CACHE_NAME = 'registro-presenze-v5';
const APP_VERSION = '5.0.0';

// Risorse da memorizzare nella cache
const urlsToCache = [
  '/presenze-allenamenti/',
  '/presenze-allenamenti/index.html',
  '/presenze-allenamenti/manifest.json',
  '/presenze-allenamenti/favicon.ico',
  
  // Icone principali
  '/presenze-allenamenti/icon-72.png',
  '/presenze-allenamenti/icon-96.png', 
  '/presenze-allenamenti/icon-128.png',
  '/presenze-allenamenti/icon-144.png',
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
        return Promise.all(
          urlsToCache.map(url => {
            return cache.add(url).catch(error => {
              console.warn(`[SW] ⚠️ Impossibile caricare in cache: ${url}`, error);
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
      self.clients.claim()
    ])
    .then(() => {
      console.log('[SW] ✅ Service Worker attivo e pronto');
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
  
  if (event.request.method !== 'GET') return;
  
  // Ignora richieste a domini esterni
  if (!requestUrl.origin.startsWith(self.location.origin)) {
    // Ma permetti le richieste a Supabase
    if (requestUrl.href.includes('supabase.co') || 
        requestUrl.href.includes('supabase.com')) {
      return fetch(event.request);
    }
    return;
  }
  
  // Strategia: Cache First per risorse statiche
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
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
            .catch(() => {});
          
          return cachedResponse;
        }
        
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
          })
          .catch((error) => {
            if (event.request.mode === 'navigate') {
              return caches.match('/presenze-allenamenti/');
            }
            
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
      
    case 'TEST_NOTIFICATION':
      // Invia una notifica di test
      self.registration.showNotification('🔔 Test Notifica', {
        body: 'Le notifiche funzionano correttamente!',
        icon: '/presenze-allenamenti/icon-192.png',
        badge: '/presenze-allenamenti/icon-72.png',
        tag: 'test-notification',
        vibrate: [200, 100, 200],
        data: {
          url: '/presenze-allenamenti/'
        }
      });
      break;
  }
});

// =================== NOTIFICHE PUSH ===================
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('[SW] 📭 Notifica push senza dati');
    return;
  }
  
  try {
    const data = event.data.json();
    console.log('[SW] 📨 Notifica push ricevuta:', data);
    
    const options = {
      body: data.body || 'Promemoria registrazione presenze',
      icon: '/presenze-allenamenti/icon-192.png',
      badge: '/presenze-allenamenti/icon-72.png',
      vibrate: [200, 100, 200, 100, 200, 100, 400],
      tag: data.tag || `presenze-${new Date().toDateString()}`,
      renotify: true,
      requireInteraction: true,
      actions: data.actions || [
        {
          action: 'open-piccoli',
          title: '👦 APRI PICCOLI'
        },
        {
          action: 'open-grandi',
          title: '🏃 APRI GRANDI'
        },
        {
          action: 'close',
          title: '⏰ RICORDA DOMANI'
        }
      ],
      data: {
        url: data.url || '/presenze-allenamenti/',
        categoria: data.categoria || 'TUTTI',
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

// =================== CLICK SULLE NOTIFICHE ===================
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] 👆 Click su notifica:', event.notification.tag);
  event.notification.close();
  
  const categoriaDaAprire = event.action === 'open-piccoli' ? 'piccoli' : 
                           (event.action === 'open-grandi' ? 'grandi' : null);
  
  event.waitUntil(
    clients.matchAll({ 
      type: 'window',
      includeUncontrolled: true 
    }).then((clientList) => {
      // Cerca una finestra già aperta
      for (const client of clientList) {
        if (client.url.includes('/presenze-allenamenti/') && 'focus' in client) {
          // Invia messaggio per aprire la categoria specifica
          if (categoriaDaAprire) {
            client.postMessage({ 
              type: 'APRI_CATEGORIA',
              categoria: categoriaDaAprire
            });
          }
          return client.focus();
        }
      }
      
      // Altrimenti apri nuova finestra
      if (clients.openWindow) {
        const url = event.notification.data?.url || '/presenze-allenamenti/';
        return clients.openWindow(url + (categoriaDaAprire ? `?categoria=${categoriaDaAprire}` : ''));
      }
    })
  );
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

console.log('[SW] 🚀 Service Worker caricato e pronto (v' + APP_VERSION + ')');

