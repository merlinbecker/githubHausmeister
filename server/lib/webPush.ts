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

/**
 * Validate a push subscription to ensure it meets web-push library requirements
 */
export function validatePushSubscription(subscription: any): { valid: boolean; error?: string } {
  if (!subscription || typeof subscription !== 'object') {
    return { valid: false, error: 'Subscription must be an object' };
  }

  if (!subscription.endpoint || typeof subscription.endpoint !== 'string') {
    return { valid: false, error: 'Missing or invalid endpoint' };
  }

  if (!subscription.keys || typeof subscription.keys !== 'object') {
    return { valid: false, error: 'Missing or invalid keys object' };
  }

  if (!subscription.keys.p256dh || typeof subscription.keys.p256dh !== 'string') {
    return { valid: false, error: 'Missing or invalid p256dh key' };
  }

  if (!subscription.keys.auth || typeof subscription.keys.auth !== 'string') {
    return { valid: false, error: 'Missing or invalid auth key' };
  }

  // Validate auth key length (must be at least 16 bytes when base64url decoded)
  try {
    const authKeyBuffer = Buffer.from(subscription.keys.auth, 'base64url');
    if (authKeyBuffer.length < 16) {
      return { 
        valid: false, 
        error: `Auth key too short: ${authKeyBuffer.length} bytes (minimum 16 required)` 
      };
    }
  } catch (error) {
    return { valid: false, error: 'Invalid auth key format (not valid base64url)' };
  }

  // Validate p256dh key length (should be 65 bytes when base64url decoded)
  try {
    const p256dhBuffer = Buffer.from(subscription.keys.p256dh, 'base64url');
    if (p256dhBuffer.length !== 65) {
      return { 
        valid: false, 
        error: `Invalid p256dh key length: ${p256dhBuffer.length} bytes (expected 65)` 
      };
    }
  } catch (error) {
    return { valid: false, error: 'Invalid p256dh key format (not valid base64url)' };
  }

  // Validate endpoint URL
  try {
    new URL(subscription.endpoint);
  } catch (error) {
    return { valid: false, error: 'Invalid endpoint URL format' };
  }

  return { valid: true };
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
    
    // Additional validation: check if the first byte of public key is 0x04 (uncompressed point indicator)
    if (publicKeyBuffer[0] !== 0x04) {
      console.error('❌ Invalid VAPID public key format: missing 0x04 prefix for uncompressed point');
      console.log('Please regenerate VAPID keys using: npm run generate-vapid-keys');
      return false;
    }
    
    console.log('✅ VAPID public key format validation successful');
  } catch (error) {
    console.error('Invalid VAPID key format:', error);
    return false;
  }

  try {
    // Use web-push library's built-in JWT generation with explicit logging
    webpush.setVapidDetails(subject, publicKey, privateKey);
    console.log('✅ Web-push initialized with VAPID details:');
    console.log(`   Subject: ${subject}`);
    console.log(`   Public Key Length: ${Buffer.from(publicKey, 'base64url').length} bytes`);
    console.log(`   Private Key Length: ${Buffer.from(privateKey, 'base64url').length} bytes`);
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
    // Validate subscription using the dedicated validation function
    const validation = validatePushSubscription(subscription);
    if (!validation.valid) {
      console.error('❌ Invalid subscription:', validation.error);
      console.log('   This indicates a problem with the client-side push subscription');
      return false;
    }

    // Log details for debugging
    console.log('🔔 Sending push notification to:', subscription.endpoint);
    console.log('✅ Subscription validation passed');
    
    // Parse endpoint URL to get correct aud claim
    const endpointUrl = new URL(subscription.endpoint);
    const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;
    
    console.log('🎯 Expected JWT audience (aud):', audience);
    
    // Check if this is a Windows WNS endpoint
    const isWNS = subscription.endpoint.includes('notify.windows.com');
    const isFCM = subscription.endpoint.includes('fcm.googleapis.com');
    
    if (isWNS) {
      console.log('🟡 WNS endpoint detected - Windows Push Notification Service');
    } else if (isFCM) {
      console.log('🟢 FCM endpoint detected - Firebase Cloud Messaging');
    } else {
      console.log('🔵 Other push service detected:', endpointUrl.host);
    }
    
    // Use web-push library's built-in JWT generation (the default and most tested approach)
    const options = {
      TTL: 86400 // 24 hours
      // Let web-push handle VAPID JWT generation automatically
    };
    
    console.log('🔑 Using web-push library default VAPID JWT generation');
    
    await webpush.sendNotification(subscription, JSON.stringify(payload), options);
    console.log('✅ Push notification sent successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to send push notification:', error);
    
    // Enhanced error analysis
    if (error instanceof Error) {
      console.log('🔍 Detailed Error Analysis:');
      console.log('   Error Type:', error.constructor.name);
      console.log('   Error Message:', error.message);
      
      // Check for specific web-push error properties
      const webPushError = error as any;
      if (webPushError.statusCode) {
        console.log('   Status Code:', webPushError.statusCode);
      }
      if (webPushError.headers) {
        console.log('   Response Headers:', JSON.stringify(webPushError.headers, null, 2));
      }
      if (webPushError.body) {
        console.log('   Response Body:', webPushError.body);
      }
      
      if (error.message.includes('auth key') || error.message.includes('16 bytes')) {
        console.log('🔍 Subscription Auth Key Issue:');
        console.log('   - The client push subscription has an invalid auth key');
        console.log('   - Client needs to resubscribe to push notifications');
        console.log('   - This is a client-side issue, not a server configuration issue');
      } else if (error.message.includes('401') || error.message.includes('JWT')) {
        console.log('🔍 JWT Authentication failed:');
        console.log('   - This suggests VAPID keys or JWT generation issues');
        console.log('   - Check if keys were generated correctly');
        console.log('   - Ensure VAPID_SUBJECT is in correct format');
      } else if (error.message.includes('403')) {
        console.log('🔍 Permission denied:');
        console.log('   - Push service rejected the JWT token');
        console.log('   - Verify VAPID key pair matches');
      } else if (error.message.includes('410')) {
        console.log('🔍 Subscription expired or invalid:');
        console.log('   - The subscription is no longer valid');
        console.log('   - Client should resubscribe');
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
