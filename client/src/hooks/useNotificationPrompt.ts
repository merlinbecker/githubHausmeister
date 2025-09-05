import { useState, useEffect } from 'react';

const STORAGE_KEY = 'gh-hausmeister-notification-prompted';

interface NotificationPromptState {
  shouldShow: boolean;
  isSupported: boolean;
  permission: NotificationPermission;
}

export function useNotificationPrompt() {
  const [state, setState] = useState<NotificationPromptState>({
    shouldShow: false,
    isSupported: false,
    permission: 'default',
  });

  useEffect(() => {
    checkShouldPrompt();
  }, []);

  const checkShouldPrompt = () => {
    // Check if notifications are supported
    const isSupported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    if (!isSupported) {
      setState({
        shouldShow: false,
        isSupported: false,
        permission: 'default',
      });
      return;
    }

    const permission = Notification.permission;
    const hasBeenPrompted = localStorage.getItem(STORAGE_KEY) === 'true';

    // Only show prompt if:
    // 1. Notifications are supported
    // 2. Permission is still default (not asked before by browser)
    // 3. We haven't shown our custom prompt before
    const shouldShow = permission === 'default' && !hasBeenPrompted;

    setState({
      shouldShow,
      isSupported,
      permission,
    });
  };

  const requestPermission = async (): Promise<boolean> => {
    if (!state.isSupported) return false;

    try {
      const permission = await Notification.requestPermission();

      // Mark that we've prompted the user
      localStorage.setItem(STORAGE_KEY, 'true');

      setState((prev) => ({
        ...prev,
        shouldShow: false,
        permission,
      }));

      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);

      // Mark as prompted even if there was an error
      localStorage.setItem(STORAGE_KEY, 'true');
      setState((prev) => ({ ...prev, shouldShow: false }));

      return false;
    }
  };

  const dismissPrompt = () => {
    // Mark that we've prompted (even if user dismissed without action)
    localStorage.setItem(STORAGE_KEY, 'true');
    setState((prev) => ({ ...prev, shouldShow: false }));
  };

  const resetPrompt = () => {
    // For testing or manual reset
    localStorage.removeItem(STORAGE_KEY);
    checkShouldPrompt();
  };

  return {
    ...state,
    requestPermission,
    dismissPrompt,
    resetPrompt,
    refresh: checkShouldPrompt,
  };
}
