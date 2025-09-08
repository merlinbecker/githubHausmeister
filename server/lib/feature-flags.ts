/**
 * Feature Flag Detection and Management
 * Provides centralized feature flag detection for the application
 */

export const isFeatureFlagEnabled = (flag: string): boolean => {
  return process.env[flag] === 'true';
};

export const isMockModeEnabled = (): boolean => {
  return isFeatureFlagEnabled('MOCK_LOGIN');
};

export const getFeatureFlag = (flag: string, defaultValue?: string): string | undefined => {
  return process.env[flag] || defaultValue;
};

// Feature Flags
export const FeatureFlags = {
  MOCK_LOGIN: 'MOCK_LOGIN',
  MOCK_COPILOT_DELAY: 'MOCK_COPILOT_DELAY',
  MOCK_CI_SUCCESS_RATE: 'MOCK_CI_SUCCESS_RATE',
  MOCK_WEBHOOK_DELAY: 'MOCK_WEBHOOK_DELAY',
} as const;

// Mock Configuration Helpers
export const getMockConfig = () => ({
  copilotDelay: parseInt(getFeatureFlag(FeatureFlags.MOCK_COPILOT_DELAY, '1000') || '1000'),
  ciSuccessRate: parseFloat(getFeatureFlag(FeatureFlags.MOCK_CI_SUCCESS_RATE, '0.8') || '0.8'),
  webhookDelay: parseInt(getFeatureFlag(FeatureFlags.MOCK_WEBHOOK_DELAY, '500') || '500'),
});