const CACHE_NAME = 'partner-ringer-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './soft-alarm1.mp3'
];

// ==================== INSTALL ====================
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[Service Worker] Skip waiting');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[Service Worker] Install failed:', error);
      })
  );
});

// ==================== ACTIVATE ====================
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] Claiming clients');
        return self.clients.claim();
      })
      .catch(error => {
        console.error('[Service Worker] Activate failed:', error);
      })
  );
});

// ==================== FETCH ====================
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        
        return fetch(event.request)
          .then(response => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          });
      })
      .catch(() => {
        return new Response('You are offline', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/plain'
          })
        });
      })
  );
});

// ==================== NOTIFICATION CLICK ====================
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification clicked:', event.notification.tag);
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ 
      type: 'window',
      includeUncontrolled: true 
    })
    .then(clientList => {
      // Check if app is already open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If app is not open, open it
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
    .catch(error => {
      console.error('[Service Worker] Notification click failed:', error);
    })
  );
});

// ==================== NOTIFICATION CLOSE ====================
self.addEventListener('notificationclose', event => {
  console.log('[Service Worker] Notification closed:', event.notification.tag);
  
  // Send message to app that notification was closed
  event.waitUntil(
    self.clients.matchAll({ 
      type: 'window',
      includeUncontrolled: true 
    })
    .then(clientList => {
      clientList.forEach(client => {
        client.postMessage({
          type: 'NOTIFICATION_CLOSED',
          tag: event.notification.tag
        });
      });
    })
  );
});

// ==================== PUSH NOTIFICATION ====================
self.addEventListener('push', event => {
  console.log('[Service Worker] Push notification received');
  
  let notificationData = {
    title: 'Partner Ringer',
    body: 'You have a new notification',
    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23ff006e" width="100" height="100"/%3E%3Ctext y="70" x="50" text-anchor="middle" font-size="60"%3E📱%3C/text%3E%3C/svg%3E',
    badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23ff006e" width="100" height="100"/%3E%3Ctext y="70" x="50" text-anchor="middle" font-size="60"%3E📱%3C/text%3E%3C/svg%3E',
    vibrate: [300, 150, 300, 150, 300],
    requireInteraction: true,
    tag: 'partner-ringer-notification'
  };
  
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        vibrate: data.vibrate || notificationData.vibrate,
        requireInteraction: data.requireInteraction !== undefined ? data.requireInteraction : true,
        tag: data.tag || notificationData.tag
      };
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// ==================== MESSAGE ====================
self.addEventListener('message', event => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLAIM_CLIENTS') {
    self.clients.claim();
  }
  
  if (event.data && event.data.type === 'PING') {
    event.ports[0].postMessage({ type: 'PONG' });
  }
});

// ==================== BACKGROUND SYNC ====================
self.addEventListener('sync', event => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'sync-calls') {
    event.waitUntil(syncCalls());
  }
});

async function syncCalls() {
  console.log('[Service Worker] Syncing calls...');
  try {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'SYNC_CALLS' });
    });
  } catch (err) {
    console.error('[Service Worker] Sync failed:', err);
  }
}

// ==================== PERIODIC BACKGROUND SYNC ====================
self.addEventListener('periodicsync', event => {
  console.log('[Service Worker] Periodic sync:', event.tag);
  
  if (event.tag === 'check-calls') {
    event.waitUntil(checkForNewCalls());
  }
});

async function checkForNewCalls() {
  console.log('[Service Worker] Checking for new calls...');
  try {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'CHECK_CALLS' });
    });
  } catch (err) {
    console.error('[Service Worker] Check calls failed:', err);
  }
}

console.log('[Service Worker] Service Worker loaded successfully');
