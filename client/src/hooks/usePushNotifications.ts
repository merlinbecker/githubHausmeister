import { useState, useEffect } from 'react';
import { urlBase64ToUint8Array } from '../lib/serviceWorker';

export interface PushSubscriptionState {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  permission: NotificationPermission;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushSubscriptionState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: true,
    permission: 'default',
  });

  useEffect(() => {
    checkPushSupport();
  }, []);

  const checkPushSupport = async () => {
    const isSupported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    if (!isSupported) {
      setState((prev) => ({
        ...prev,
        isSupported: false,
        isLoading: false,
      }));
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      console.log('Push subscription check:', {
        hasSubscription: !!subscription,
        endpoint: subscription?.endpoint,
        permission: Notification.permission,
      });

      // Zusätzlich prüfen ob die Subscription auch server-seitig bekannt ist
      let serverKnowsSubscription = false;
      if (subscription) {
        try {
          const response = await fetch('/api/push/subscription-status', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });

          if (response.ok) {
            const data = await response.json();
            serverKnowsSubscription = data.exists;
          }
        } catch (error) {
          console.warn('Could not check server subscription status:', error);
          // Fallback: Annahme dass Subscription existiert wenn Browser sie hat
          serverKnowsSubscription = true;
        }
      }

      setState((prev) => ({
        ...prev,
        isSupported: true,
        isSubscribed: !!subscription && serverKnowsSubscription,
        permission: Notification.permission,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error checking push support:', error);
      setState((prev) => ({
        ...prev,
        isSupported: false,
        isLoading: false,
      }));
    }
  };

  const requestPermission = async (): Promise<boolean> => {
    if (!state.isSupported) return false;

    const permission = await Notification.requestPermission();
    setState((prev) => ({ ...prev, permission }));

    return permission === 'granted';
  };

  const subscribe = async (): Promise<boolean> => {
    if (!state.isSupported || state.permission !== 'granted') {
      return false;
    }

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      // Get VAPID public key
      const vapidResponse = await fetch('/api/push/vapid-public-key');
      const { publicKey } = await vapidResponse.json();

      // Subscribe to push manager
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Send subscription to server
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!response.ok) {
        throw new Error('Failed to subscribe on server');
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: true,
        isLoading: false,
      }));

      return true;
    } catch (error) {
      console.error('Error subscribing to push:', error);
      setState((prev) => ({ ...prev, isLoading: false }));
      return false;
    }
  };

  const unsubscribe = async (): Promise<boolean> => {
    if (!state.isSupported) return false;

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();

        // Remove from server
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
      }));

      return true;
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      setState((prev) => ({ ...prev, isLoading: false }));
      return false;
    }
  };

  const sendTestNotification = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/push/test', {
        method: 'POST',
        credentials: 'include',
      });

      return response.ok;
    } catch (error) {
      console.error('Error sending test notification:', error);
      return false;
    }
  };

  return {
    ...state,
    requestPermission,
    subscribe,
    unsubscribe,
    sendTestNotification,
    refresh: checkPushSupport,
  };
}
