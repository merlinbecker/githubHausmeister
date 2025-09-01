const CACHE_NAME = 'hausmeister-v1';
const urlsToCache = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png'];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

// Fetch event (basic caching strategy)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
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