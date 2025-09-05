#!/usr/bin/env tsx

async function testVapidKeyCompatibility() {
  console.log('🧪 Testing VAPID Key Compatibility with web-push library...\n');

  try {
    // Import web-push 
    const webpush = (await import('web-push')).default;
    
    // Use test VAPID keys (these are safe to use in tests)
    const testPublicKey = 'BP93dutWwNlD6XeoEDxxpv3MOseNkftoQq-laT0dIcL44V2zYTu2uuqHoiZU2LrGaFJ2YYGuWx5pLtT4fukuzxY';
    const testPrivateKey = '4V2zYTu2uuqHoiZU2LrGaFJ2YYGuWx5pLtT4fukuzxY';
    const testSubject = 'mailto:test@example.com';

    console.log('🔍 Key Analysis:');
    console.log('   Public key length:', Buffer.from(testPublicKey, 'base64url').length, 'bytes');
    console.log('   Private key length:', Buffer.from(testPrivateKey, 'base64url').length, 'bytes');
    console.log('   Public key starts with 0x04:', Buffer.from(testPublicKey, 'base64url')[0] === 0x04);

    // Test with web-push library
    console.log('\n🔑 Testing VAPID details setup...');
    webpush.setVapidDetails(testSubject, testPublicKey, testPrivateKey);
    console.log('✅ setVapidDetails() succeeded');

    // Create a test subscription (FCM format)
    const testSubscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test123',
      keys: {
        p256dh: 'BP93dutWwNlD6XeoEDxxpv3MOseNkftoQq-laT0dIcL44V2zYTu2uuqHoiZU2LrGaFJ2YYGuWx5pLtT4fukuzxY',
        auth: 'test-auth-key-16-bytes'
      }
    };

    const testPayload = {
      title: 'Test Notification',
      body: 'This is a test notification'
    };

    console.log('\n🚀 Testing push notification send...');
    console.log('   Endpoint:', testSubscription.endpoint);
    console.log('   Expected audience: https://fcm.googleapis.com');

    try {
      // This will fail with network error, but we want to see if the JWT generation works
      await webpush.sendNotification(testSubscription, JSON.stringify(testPayload));
      console.log('✅ Push notification attempt succeeded (unexpected!)');
    } catch (error) {
      console.log('📝 Push notification failed as expected (network/auth error):');
      
      if (error instanceof Error) {
        console.log('   Error Type:', error.constructor.name);
        console.log('   Error Message:', error.message);
        
        // Check if it's a network error (good) or JWT error (bad)
        if (error.message.includes('jwt') || error.message.includes('JWT') || error.message.includes('401') || error.message.includes('403')) {
          console.log('❌ JWT-related error detected - this indicates a problem with VAPID');
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('connect') || error.message.includes('network')) {
          console.log('✅ Network error detected - JWT generation likely working');
        } else {
          console.log('❓ Unknown error type - need to investigate');
        }
      }
    }

    console.log('\n✅ VAPID compatibility test completed');

  } catch (error) {
    console.error('❌ VAPID compatibility test failed:', error);
    process.exit(1);
  }
}

testVapidKeyCompatibility();