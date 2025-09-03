import crypto from 'crypto';

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

export function generateVapidKeys(): VapidKeys {
  const keyPair = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: {
      type: 'spki',
      format: 'der',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'der',
    },
  });

  // Extract raw public key from DER format (remove 26-byte header)
  const publicKeyDer = Buffer.from(keyPair.publicKey);
  const rawPublicKey = publicKeyDer.slice(26); // Remove DER header to get 65-byte raw key
  
  const publicKey = rawPublicKey.toString('base64url');
  const privateKey = Buffer.from(keyPair.privateKey).toString('base64url');

  return { publicKey, privateKey };
}

// One-time key generation script
export function initializeVapidKeys() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    const keys = generateVapidKeys();
    console.log('Generated VAPID Keys:');
    console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
    console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
    console.log('Add these to your environment variables');
  }
}