import webpush from 'web-push';

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  data?: any;
}

export function initializeWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys not configured');
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export async function sendPushNotification(
  subscription: PushSubscription,
  payload: NotificationPayload
): Promise<boolean> {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), {
      vapidDetails: {
        subject: process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
        publicKey: process.env.VAPID_PUBLIC_KEY!,
        privateKey: process.env.VAPID_PRIVATE_KEY!,
      },
    });
    return true;
  } catch (error) {
    console.error('Failed to send push notification:', error);
    return false;
  }
}

export async function sendPushToMultipleSubscriptions(
  subscriptions: PushSubscription[],
  payload: NotificationPayload
): Promise<{ successful: number; failed: number }> {
  const results = await Promise.allSettled(
    subscriptions.map((sub) => sendPushNotification(sub, payload))
  );

  const successful = results.filter(
    (r) => r.status === 'fulfilled' && r.value
  ).length;
  const failed = results.length - successful;

  return { successful, failed };
}