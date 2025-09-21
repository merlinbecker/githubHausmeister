// Stub for removed VAPID service
export function generateVAPIDKeys() {
  return {
    publicKey: 'stub-public-key',
    privateKey: 'stub-private-key'
  };
}

export function generateVapidKeys() {
  return generateVAPIDKeys();
}

export function initializeVapidKeys() {
  console.log('VAPID service stubbed - not generating keys');
  return false;
}