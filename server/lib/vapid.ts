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

  // Extract raw public key from DER format
  const publicKeyDer = Buffer.from(keyPair.publicKey);
  // For P-256 SPKI format, the header is 26 bytes, followed by 1 byte (0x04) and 64 bytes of coordinates
  // We need all 65 bytes (0x04 + 32 bytes x + 32 bytes y)
  const rawPublicKey = publicKeyDer.slice(26, 91); // Extract exactly 65 bytes
  
  // Extract raw private key from DER format
  const privateKeyDer = Buffer.from(keyPair.privateKey);
  // For P-256 PKCS8 format, find the 32-byte private key
  const rawPrivateKey = privateKeyDer.slice(-32);
  
  const publicKey = rawPublicKey.toString('base64url');
  const privateKey = rawPrivateKey.toString('base64url');

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