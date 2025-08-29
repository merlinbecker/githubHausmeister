import crypto from 'crypto';

export function verifySignature(
  secret: string,
  payload: string,
  sig256: string | undefined
): boolean {
  if (!sig256) return false;

  const hmac = crypto.createHmac('sha256', secret);
  const digest = `sha256=${hmac.update(payload).digest('hex')}`;

  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(sig256));
}

export function parseWebhookPayload(body: string, contentType: string) {
  if (contentType?.includes('application/json')) {
    return JSON.parse(body);
  }

  if (contentType?.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(body);
    const payload = params.get('payload');
    return payload ? JSON.parse(payload) : null;
  }

  throw new Error(`Unsupported content type: ${contentType}`);
}
