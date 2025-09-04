import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  verifySignature,
  parseWebhookPayload,
} from '../../../server/lib/webhook-verify';

describe('Webhook Verification', () => {
  describe('verifySignature', () => {
    it('should return true for valid signature', () => {
      const secret = 'test-secret';
      const payload = '{"test": "data"}';

      // Create expected signature
      const hmac = crypto.createHmac('sha256', secret);
      const expectedSignature = `sha256=${hmac.update(payload).digest('hex')}`;

      const result = verifySignature(secret, payload, expectedSignature);

      expect(result).toBe(true);
    });

    it('should return false for invalid signature', () => {
      const secret = 'test-secret';
      const payload = '{"test": "data"}';
      // Create a properly formatted but wrong signature
      const hmac = crypto.createHmac('sha256', 'wrong-secret');
      const invalidSignature = `sha256=${hmac.update(payload).digest('hex')}`;

      const result = verifySignature(secret, payload, invalidSignature);

      expect(result).toBe(false);
    });

    it('should return false when signature is undefined', () => {
      const secret = 'test-secret';
      const payload = '{"test": "data"}';

      const result = verifySignature(secret, payload, undefined);

      expect(result).toBe(false);
    });

    it('should handle empty payload correctly', () => {
      const secret = 'test-secret';
      const payload = '';

      // Create expected signature for empty payload
      const hmac = crypto.createHmac('sha256', secret);
      const expectedSignature = `sha256=${hmac.update(payload).digest('hex')}`;

      const result = verifySignature(secret, payload, expectedSignature);

      expect(result).toBe(true);
    });
  });

  describe('parseWebhookPayload', () => {
    it('should parse JSON payload correctly', () => {
      const payload = '{"action": "opened", "number": 123}';
      const contentType = 'application/json';

      const result = parseWebhookPayload(payload, contentType);

      expect(result).toEqual({
        action: 'opened',
        number: 123,
      });
    });

    it('should parse URL-encoded payload correctly', () => {
      const testData = { action: 'closed', number: 456 };
      const encodedPayload = JSON.stringify(testData);
      const payload = `payload=${encodeURIComponent(encodedPayload)}`;
      const contentType = 'application/x-www-form-urlencoded';

      const result = parseWebhookPayload(payload, contentType);

      expect(result).toEqual(testData);
    });

    it('should return null for URL-encoded payload without payload parameter', () => {
      const payload = 'other=data';
      const contentType = 'application/x-www-form-urlencoded';

      const result = parseWebhookPayload(payload, contentType);

      expect(result).toBeNull();
    });

    it('should throw error for unsupported content type', () => {
      const payload = 'some data';
      const contentType = 'text/plain';

      expect(() => parseWebhookPayload(payload, contentType)).toThrow(
        'Unsupported content type: text/plain'
      );
    });

    it('should handle content type with charset', () => {
      const payload = '{"test": "data"}';
      const contentType = 'application/json; charset=utf-8';

      const result = parseWebhookPayload(payload, contentType);

      expect(result).toEqual({ test: 'data' });
    });
  });
});
