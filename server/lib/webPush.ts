// Stub for removed webPush service  
export function initializeWebPush() {
  return false;
}

export function validatePushSubscription() {
  return { valid: false, error: 'Push notifications not available' };
}

export function sendPushToMultipleSubscriptions() {
  return Promise.resolve({ successful: 0, failed: 0 });
}