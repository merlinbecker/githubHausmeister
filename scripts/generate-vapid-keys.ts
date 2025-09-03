
import { generateVapidKeys } from '../server/lib/vapid.js';

async function main() {
  try {
    const keys = generateVapidKeys();
    
    console.log('🔑 VAPID Keys generiert:');
    console.log('');
    console.log('Füge diese Werte zu deinen Secrets hinzu:');
    console.log('');
    console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
    console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
    console.log('VAPID_SUBJECT=mailto:deine-email@example.com');
    console.log('');
    console.log('📝 Gehe zu den Secrets (linke Seitenleiste) und füge diese Werte hinzu.');
    
    // Verify key length
    const publicKeyBuffer = Buffer.from(keys.publicKey, 'base64url');
    console.log(`✅ Public Key Länge: ${publicKeyBuffer.length} bytes (erwartet: 65)`);
    
  } catch (error) {
    console.error('❌ Fehler beim Generieren der VAPID-Keys:', error);
  }
}

main();
