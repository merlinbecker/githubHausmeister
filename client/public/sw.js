const CACHE_NAME = 'hausmeister-v1';
const urlsToCache = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png'];

// Caching strategy configuration
// To switch to cache-first for production, change default to 'cache-first'
const CACHING_STRATEGY = {
  // Current: 'network-first' - Always try network first, fallback to cache
  // Production option: 'cache-first' - Use cache first, fallback to network
  default: 'network-first',
  
  // Per-resource type strategies (optional overrides)
  strategies: {
    'network-first': networkFirstStrategy,
    'cache-first': cacheFirstStrategy,
    'network-only': networkOnlyStrategy,
    'cache-only': cacheOnlyStrategy
  }
};

// Network-first strategy: Try network first, fallback to cache
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Clone response for caching (response can only be consumed once)
    const responseClone = networkResponse.clone();
    
    // Cache successful responses (only cache GET requests and successful responses)
    if (request.method === 'GET' && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, responseClone);
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If no cache and network failed, return error
    throw error;
  }
}

// Cache-first strategy: Try cache first, fallback to network
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Cache miss, fetch from network
  const networkResponse = await fetch(request);
  
  // Cache the response for future use
  if (request.method === 'GET' && networkResponse.status === 200) {
    const cache = await caches.open(CACHE_NAME);
    const responseClone = networkResponse.clone();
    cache.put(request, responseClone);
  }
  
  return networkResponse;
}

// Network-only strategy: Always use network
async function networkOnlyStrategy(request) {
  return fetch(request);
}

// Cache-only strategy: Always use cache
async function cacheOnlyStrategy(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  throw new Error('No cached response available');
}

// Determine which strategy to use for a request
function getStrategyForRequest(request) {
  const url = new URL(request.url);
  
  // Use network-only for API calls to ensure fresh data
  if (url.pathname.startsWith('/api/')) {
    return CACHING_STRATEGY.strategies['network-only'];
  }
  
  // Use default strategy for everything else
  return CACHING_STRATEGY.strategies[CACHING_STRATEGY.default];
}

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

// Fetch event with configurable caching strategy
self.addEventListener('fetch', (event) => {
  // Only handle GET requests for caching
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    (async () => {
      try {
        const strategy = getStrategyForRequest(event.request);
        return await strategy(event.request);
      } catch (error) {
        console.error('Service Worker fetch error:', error);
        
        // Last resort: try to return a basic offline page or cached response
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // If it's a navigation request and we have no cache, return a basic offline page
        if (event.request.mode === 'navigate') {
          return new Response(
            `<!DOCTYPE html>
            <html>
              <head>
                <title>Offline - GitHub Hausmeister</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                  body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                  .offline { color: #666; }
                </style>
              </head>
              <body>
                <h1>GitHub Hausmeister</h1>
                <p class="offline">Sie sind offline. Bitte überprüfen Sie Ihre Internetverbindung.</p>
              </body>
            </html>`,
            {
              status: 200,
              statusText: 'OK',
              headers: { 'Content-Type': 'text/html' }
            }
          );
        }
        
        // For other requests, return a network error
        return new Response('Network error', { status: 408, statusText: 'Request Timeout' });
      }
    })()
  );
});

// Push event handler
self.addEventListener('push', (event) => {
  const options = {
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: 'open',
        title: 'Öffnen',
        icon: '/icon-192.png',
      },
      {
        action: 'close',
        title: 'Schließen',
      },
    ],
  };

  let notificationData = {};

  if (event.data) {
    try {
      notificationData = event.data.json();
    } catch (e) {
      notificationData = {
        title: 'GitHub Hausmeister',
        body: event.data.text() || 'Neue Benachrichtigung',
      };
    }
  }

  const title = notificationData.title || 'GitHub Hausmeister';
  const body =
    notificationData.body || 'Neue Aktivität in Ihrer Repository-Wartung';

  event.waitUntil(
    self.registration.showNotification(title, {
      ...options,
      body,
      tag: notificationData.tag || 'general',
      url: notificationData.url || '/',
      data: notificationData,
    })
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients
      .matchAll({ includeUncontrolled: true, type: 'window' })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if app not open
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});