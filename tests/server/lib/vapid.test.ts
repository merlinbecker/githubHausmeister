import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateVapidKeys, initializeVapidKeys } from '../../../server/lib/vapid';
import crypto from 'crypto';

describe('VAPID Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateVapidKeys', () => {
    it('should generate valid VAPID key pair', () => {
      const keys = generateVapidKeys();

      expect(keys).toHaveProperty('publicKey');
      expect(keys).toHaveProperty('privateKey');
      expect(typeof keys.publicKey).toBe('string');
      expect(typeof keys.privateKey).toBe('string');
      expect(keys.publicKey.length).toBeGreaterThan(0);
      expect(keys.privateKey.length).toBeGreaterThan(0);
    });

    it('should generate keys with correct lengths', () => {
      const keys = generateVapidKeys();

      // Decode base64url to check raw key lengths
      const publicKeyBuffer = Buffer.from(keys.publicKey, 'base64url');
      const privateKeyBuffer = Buffer.from(keys.privateKey, 'base64url');

      // P-256 public key should be 65 bytes (0x04 + 32 bytes x + 32 bytes y)
      expect(publicKeyBuffer.length).toBe(65);
      
      // P-256 private key should be 32 bytes
      expect(privateKeyBuffer.length).toBe(32);
    });

    it('should generate different keys on each call', () => {
      const keys1 = generateVapidKeys();
      const keys2 = generateVapidKeys();

      expect(keys1.publicKey).not.toBe(keys2.publicKey);
      expect(keys1.privateKey).not.toBe(keys2.privateKey);
    });

    it('should generate base64url encoded keys', () => {
      const keys = generateVapidKeys();

      // base64url should not contain + / = characters
      expect(keys.publicKey).not.toMatch(/[+/=]/);
      expect(keys.privateKey).not.toMatch(/[+/=]/);

      // Should be valid base64url
      expect(() => Buffer.from(keys.publicKey, 'base64url')).not.toThrow();
      expect(() => Buffer.from(keys.privateKey, 'base64url')).not.toThrow();
    });

    it('should use P-256 curve for key generation', () => {
      const spy = vi.spyOn(crypto, 'generateKeyPairSync');
      
      generateVapidKeys();

      expect(spy).toHaveBeenCalledWith('ec', {
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

      spy.mockRestore();
    });

    it('should extract correct raw key portions from DER format', () => {
      const keys = generateVapidKeys();
      
      const publicKeyBuffer = Buffer.from(keys.publicKey, 'base64url');
      const privateKeyBuffer = Buffer.from(keys.privateKey, 'base64url');

      // Public key should start with 0x04 (uncompressed point indicator)
      expect(publicKeyBuffer[0]).toBe(0x04);
      
      // Private key should be 32 random bytes (not all zeros)
      expect(privateKeyBuffer.every(byte => byte === 0)).toBe(false);
    });
  });

  describe('initializeVapidKeys', () => {
    let originalEnv: NodeJS.ProcessEnv;
    let consoleSpy: any;

    beforeEach(() => {
      originalEnv = { ...process.env };
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      process.env = originalEnv;
      consoleSpy.mockRestore();
    });

    it('should generate keys when environment variables are missing', () => {
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;

      initializeVapidKeys();

      expect(consoleSpy).toHaveBeenCalledWith('Generated VAPID Keys:');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^VAPID_PUBLIC_KEY=.+/)
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^VAPID_PRIVATE_KEY=.+/)
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        'Add these to your environment variables'
      );
    });

    it('should not generate keys when environment variables exist', () => {
      process.env.VAPID_PUBLIC_KEY = 'existing-public-key';
      process.env.VAPID_PRIVATE_KEY = 'existing-private-key';

      initializeVapidKeys();

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should generate keys when only public key is missing', () => {
      delete process.env.VAPID_PUBLIC_KEY;
      process.env.VAPID_PRIVATE_KEY = 'existing-private-key';

      initializeVapidKeys();

      expect(consoleSpy).toHaveBeenCalledWith('Generated VAPID Keys:');
    });

    it('should generate keys when only private key is missing', () => {
      process.env.VAPID_PUBLIC_KEY = 'existing-public-key';
      delete process.env.VAPID_PRIVATE_KEY;

      initializeVapidKeys();

      expect(consoleSpy).toHaveBeenCalledWith('Generated VAPID Keys:');
    });

    it('should generate valid keys in output', () => {
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;

      initializeVapidKeys();

      const calls = consoleSpy.mock.calls;
      const publicKeyCall = calls.find(call => 
        call[0]?.startsWith('VAPID_PUBLIC_KEY=')
      );
      const privateKeyCall = calls.find(call => 
        call[0]?.startsWith('VAPID_PRIVATE_KEY=')
      );

      expect(publicKeyCall).toBeDefined();
      expect(privateKeyCall).toBeDefined();

      if (publicKeyCall && privateKeyCall) {
        const publicKey = publicKeyCall[0].split('=')[1];
        const privateKey = privateKeyCall[0].split('=')[1];

        // Verify the generated keys are valid
        expect(() => Buffer.from(publicKey, 'base64url')).not.toThrow();
        expect(() => Buffer.from(privateKey, 'base64url')).not.toThrow();
        
        const publicKeyBuffer = Buffer.from(publicKey, 'base64url');
        const privateKeyBuffer = Buffer.from(privateKey, 'base64url');
        
        expect(publicKeyBuffer.length).toBe(65);
        expect(privateKeyBuffer.length).toBe(32);
      }
    });
  });
});