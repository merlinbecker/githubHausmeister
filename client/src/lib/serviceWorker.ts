export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('Service Worker registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

export async function resetServiceWorkerAndSubscriptions(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported');
    return false;
  }

  try {
    console.log('🔄 Starting complete Service Worker + Push Subscription reset...');
    
    // 1. Get current registration
    const registration = await navigator.serviceWorker.ready;
    
    // 2. Remove existing push subscription
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      console.log('🗑️ Removing existing push subscription...');
      await existingSubscription.unsubscribe();
      console.log('✅ Existing push subscription removed');
    }
    
    // 3. Unregister all service workers
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      console.log('🗑️ Unregistering Service Worker:', reg.scope);
      await reg.unregister();
    }
    
    // 4. Clear all caches
    const cacheNames = await caches.keys();
    for (const cacheName of cacheNames) {
      console.log('🗑️ Deleting cache:', cacheName);
      await caches.delete(cacheName);
    }
    
    // 5. Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 6. Re-register service worker
    console.log('🔄 Re-registering Service Worker...');
    const newRegistration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    
    // 7. Wait for new service worker to be ready
    await navigator.serviceWorker.ready;
    
    console.log('✅ Service Worker reset complete!');
    return true;
  } catch (error) {
    console.error('❌ Service Worker reset failed:', error);
    return false;
  }
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
