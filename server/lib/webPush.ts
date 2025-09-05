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
  // Ensure VAPID_SUBJECT starts with mailto: 
  let subject = process.env.VAPID_SUBJECT || 'mailto:merlinbecker@users.noreply.github.com';
  if (subject && !subject.startsWith('mailto:') && !subject.startsWith('http')) {
    subject = `mailto:${subject}`;
  }

  if (!publicKey || !privateKey) {
    console.warn('VAPID keys not configured. Push notifications disabled.');
    return false;
  }

  // Validate key formats and lengths
  try {
    const publicKeyBuffer = Buffer.from(publicKey, 'base64url');
    if (publicKeyBuffer.length !== 65) {
      console.error(
        `Invalid VAPID public key length: ${publicKeyBuffer.length} bytes (expected 65)`
      );
      console.log(
        'Please regenerate VAPID keys using: npm run generate-vapid-keys'
      );
      return false;
    }

    const privateKeyBuffer = Buffer.from(privateKey, 'base64url');
    if (privateKeyBuffer.length !== 32) {
      console.error(
        `Invalid VAPID private key length: ${privateKeyBuffer.length} bytes (expected 32)`
      );
      console.log(
        'Please regenerate VAPID keys using: npm run generate-vapid-keys'
      );
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
    // Log details for debugging
    console.log('🔔 Sending push notification to:', subscription.endpoint);
    
    // Parse endpoint URL to get correct aud claim
    const endpointUrl = new URL(subscription.endpoint);
    const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;
    
    console.log('🎯 JWT audience (aud):', audience);
    
    // Check if this is a Windows WNS endpoint
    const isWNS = subscription.endpoint.includes('notify.windows.com');
    const isFCM = subscription.endpoint.includes('fcm.googleapis.com');
    
    if (isWNS) {
      console.log('🟡 WNS endpoint detected - Microsoft auth challenges expected');
    } else if (isFCM) {
      console.log('🟢 FCM endpoint detected - Standard VAPID should work');
    }
    
    // Use global VAPID settings (set in initializeWebPush)
    const options = {
      TTL: 86400 // 24 hours
      // No local vapidDetails - use global setVapidDetails()
    };
    
    console.log('🔑 Using global VAPID settings from initializeWebPush()');
    
    await webpush.sendNotification(subscription, JSON.stringify(payload), options);
    console.log('✅ Push notification sent successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to send push notification:', error);
    
    // Detailed error analysis
    if (error instanceof Error) {
      if (error.message.includes('401') || error.message.includes('JWT')) {
        console.log('🔍 JWT Authentication failed:');
        console.log('   - Endpoint:', subscription.endpoint);
        console.log('   - Check if VAPID keys match between client and server');
        console.log('   - Check if aud claim matches endpoint origin');
      }
      if (error.message.includes('403')) {
        console.log('🔍 Permission denied - invalid JWT:');
        console.log('   - VAPID signature verification failed');
        console.log('   - Public/private key mismatch possible');
      }
    }
    
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
