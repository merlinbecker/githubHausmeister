import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isFeatureFlagEnabled, isMockModeEnabled, getMockConfig, FeatureFlags } from '../../../server/lib/feature-flags';

describe('Feature Flags', () => {
  beforeEach(() => {
    // Clean up environment variables
    delete process.env.MOCK_LOGIN;
    delete process.env.MOCK_COPILOT_DELAY;
    delete process.env.MOCK_CI_SUCCESS_RATE;
    delete process.env.MOCK_WEBHOOK_DELAY;
    delete process.env.TEST_FLAG;
  });

  describe('isFeatureFlagEnabled', () => {
    it('should return true when flag is set to "true"', () => {
      process.env.TEST_FLAG = 'true';
      expect(isFeatureFlagEnabled('TEST_FLAG')).toBe(true);
    });

    it('should return false when flag is not set', () => {
      expect(isFeatureFlagEnabled('TEST_FLAG')).toBe(false);
    });

    it('should return false when flag is set to other values', () => {
      process.env.TEST_FLAG = 'false';
      expect(isFeatureFlagEnabled('TEST_FLAG')).toBe(false);
      
      process.env.TEST_FLAG = '1';
      expect(isFeatureFlagEnabled('TEST_FLAG')).toBe(false);
      
      process.env.TEST_FLAG = 'yes';
      expect(isFeatureFlagEnabled('TEST_FLAG')).toBe(false);
    });
  });

  describe('isMockModeEnabled', () => {
    it('should return true when MOCK_LOGIN is true', () => {
      process.env.MOCK_LOGIN = 'true';
      expect(isMockModeEnabled()).toBe(true);
    });

    it('should return false when MOCK_LOGIN is not set', () => {
      expect(isMockModeEnabled()).toBe(false);
    });

    it('should return false when MOCK_LOGIN is false', () => {
      process.env.MOCK_LOGIN = 'false';
      expect(isMockModeEnabled()).toBe(false);
    });
  });

  describe('getMockConfig', () => {
    it('should return default configuration when no env vars set', () => {
      const config = getMockConfig();
      
      expect(config).toEqual({
        copilotDelay: 1000,
        ciSuccessRate: 0.8,
        webhookDelay: 500
      });
    });

    it('should use environment variables when set', () => {
      process.env.MOCK_COPILOT_DELAY = '2000';
      process.env.MOCK_CI_SUCCESS_RATE = '0.9';
      process.env.MOCK_WEBHOOK_DELAY = '1000';
      
      const config = getMockConfig();
      
      expect(config).toEqual({
        copilotDelay: 2000,
        ciSuccessRate: 0.9,
        webhookDelay: 1000
      });
    });

    it('should handle invalid values gracefully', () => {
      process.env.MOCK_COPILOT_DELAY = 'invalid';
      process.env.MOCK_CI_SUCCESS_RATE = 'not-a-number';
      process.env.MOCK_WEBHOOK_DELAY = 'also-invalid';
      
      const config = getMockConfig();
      
      // parseInt/parseFloat should handle invalid values
      expect(config.copilotDelay).toBeNaN();
      expect(config.ciSuccessRate).toBeNaN();
      expect(config.webhookDelay).toBeNaN();
    });

    it('should use fallback values for empty strings', () => {
      process.env.MOCK_COPILOT_DELAY = '';
      process.env.MOCK_CI_SUCCESS_RATE = '';
      process.env.MOCK_WEBHOOK_DELAY = '';
      
      const config = getMockConfig();
      
      // Empty strings should use defaults
      expect(config.copilotDelay).toBe(1000);
      expect(config.ciSuccessRate).toBe(0.8);
      expect(config.webhookDelay).toBe(500);
    });
  });

  describe('FeatureFlags constants', () => {
    it('should have correct flag names', () => {
      expect(FeatureFlags.MOCK_LOGIN).toBe('MOCK_LOGIN');
      expect(FeatureFlags.MOCK_COPILOT_DELAY).toBe('MOCK_COPILOT_DELAY');
      expect(FeatureFlags.MOCK_CI_SUCCESS_RATE).toBe('MOCK_CI_SUCCESS_RATE');
      expect(FeatureFlags.MOCK_WEBHOOK_DELAY).toBe('MOCK_WEBHOOK_DELAY');
    });
  });
});