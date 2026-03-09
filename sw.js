// =================== SERVICE WORKER REGISTRO PRESENZE ===================
// Versione: 5.1.0 (con notifiche intelligenti + backup automatico)
// Compatibile con Android e iOS

const CACHE_NAME = 'registro-presenze-v5';
const APP_VERSION = '5.1.0';
const BACKUP_URL = "https://script.google.com/macros/s/AKfycbw8bpfHmdw28CcXZf2prGXX9Pr6MnHMQ5Ij50un8Qjs8YXNgjjPz7MKUL_5u8EfHvqHRQ/exec";

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
      self.clients.claim(),
      // Registra il backup periodico all'attivazione
      registraBackupPeriodico()
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

// =================== PERIODIC SYNC (BACKUP AUTOMATICO) ===================
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] 🔄 Periodic sync ricevuto:', event.tag);
  
  if (event.tag === 'backup-giornaliero') {
    event.waitUntil(eseguiBackupAutomatico());
  }
});

async function eseguiBackupAutomatico() {
  const ora = new Date().getHours();
  const minuti = new Date().getMinutes();
  
  console.log(`[SW] ⏰ Esecuzione backup automatico alle ${ora}:${minuti}`);
  
  try {
    // Recupera i dati necessari per il backup
    const response = await fetch(BACKUP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tipo: 'backup_automatico',
        timestamp: new Date().toISOString()
      })
    });
    
    const result = await response.json();
    
    if (result.fileUrl) {
      // Salva l'URL nel localStorage (tramite client)
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'BACKUP_COMPLETATO',
          url: result.fileUrl,
          timestamp: new Date().toLocaleString()
        });
      });
      
      // Invia notifica di conferma
      await self.registration.showNotification('✅ Backup automatico completato', {
        body: `Backup giornaliero eseguito con successo alle ${ora}:${minuti.toString().padStart(2, '0')}`,
        icon: '/presenze-allenamenti/icon-192.png',
        badge: '/presenze-allenamenti/icon-72.png',
        tag: `backup-${new Date().toDateString()}`,
        requireInteraction: false,
        actions: [
          {
            action: 'apri-backup',
            title: '📂 APRI BACKUP'
          }
        ],
        data: {
          url: result.fileUrl,
          tipo: 'backup'
        }
      });
      
      console.log('[SW] ✅ Backup automatico completato:', result.fileUrl);
      return true;
    } else {
      throw new Error('Nessun URL ricevuto');
    }
    
  } catch (error) {
    console.error('[SW] ❌ Errore backup automatico:', error);
    
    // Notifica errore
    await self.registration.showNotification('❌ Backup automatico fallito', {
      body: 'Riprova manualmente domattina',
      icon: '/presenze-allenamenti/icon-192.png',
      badge: '/presenze-allenamenti/icon-72.png',
      tag: `backup-fallito-${new Date().toDateString()}`
    });
    
    return false;
  }
}

async function registraBackupPeriodico() {
  try {
    if ('periodicSync' in self.registration) {
      // Controlla se esiste già una registrazione
      const tags = await self.registration.periodicSync.getTags();
      
      if (!tags.includes('backup-giornaliero')) {
        await self.registration.periodicSync.register('backup-giornaliero', {
          minInterval: 24 * 60 * 60 * 1000 // 24 ore
        });
        console.log('[SW] ✅ Backup giornaliero programmato (alle 23:00)');
      } else {
        console.log('[SW] ℹ️ Backup giornaliero già programmato');
      }
    } else {
      console.log('[SW] ⚠️ Periodic Sync non supportato, uso fallback');
      // Fallback con setTimeout
      programmaBackupFallback();
    }
  } catch (error) {
    console.error('[SW] ❌ Errore registrazione periodic sync:', error);
  }
}

function programmaBackupFallback() {
  const ora = new Date().getHours();
  const minuti = new Date().getMinutes();
  
  // Calcola millisecondi fino alle 23:00
  let msFinoAlle23 = (23 - ora) * 60 * 60 * 1000 - (minuti * 60 * 1000);
  
  if (msFinoAlle23 < 0) {
    msFinoAlle23 += 24 * 60 * 60 * 1000; // Domani
  }
  
  console.log(`[SW] ⏰ Prossimo backup (fallback) tra ${Math.round(msFinoAlle23 / 1000 / 60)} minuti`);
  
  setTimeout(async () => {
    await eseguiBackupAutomatico();
    // Riprogramma per domani
    programmaBackupFallback();
  }, msFinoAlle23);
}

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
      
    case 'ESEGUI_BACKUP':
      // Per backup manuale
      event.waitUntil(eseguiBackupAutomatico());
      break;
      
    case 'GET_BACKUP_STATUS':
      sendMessageToClient(event.source, {
        type: 'BACKUP_STATUS',
        data: {
          supportato: 'periodicSync' in self.registration,
          programmato: true,
          orario: '23:00'
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
  
  // Gestione specifica per backup
  if (event.action === 'apri-backup' || 
      (event.notification.data && event.notification.data.tipo === 'backup')) {
    const url = event.notification.data?.url;
    if (url) {
      event.waitUntil(clients.openWindow(url));
      return;
    }
  }
  
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

