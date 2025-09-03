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
    console.warn('VAPID keys not configured. Push notifications disabled.');
    return false;
  }

  // Validate key formats and lengths
  try {
    const publicKeyBuffer = Buffer.from(publicKey, 'base64url');
    if (publicKeyBuffer.length !== 65) {
      console.error(`Invalid VAPID public key length: ${publicKeyBuffer.length} bytes (expected 65)`);
      console.log('Please regenerate VAPID keys using: npm run generate-vapid-keys');
      return false;
    }
    
    const privateKeyBuffer = Buffer.from(privateKey, 'base64url');
    if (privateKeyBuffer.length !== 32) {
      console.error(`Invalid VAPID private key length: ${privateKeyBuffer.length} bytes (expected 32)`);
      console.log('Please regenerate VAPID keys using: npm run generate-vapid-keys');
      return false;
    }
    
    console.log('✅ VAPID keys validation successful');
  } catch (error) {
    console.error('Invalid VAPID key format:', error);
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    console.log('✅ Web-push initialized with VAPID keys');
    return true;
  } catch (error) {
    console.error('Failed to set VAPID details:', error);
    return false;
  }
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