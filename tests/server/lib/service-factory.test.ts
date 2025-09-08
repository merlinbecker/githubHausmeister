import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceFactory } from '../../../server/lib/service-factory';
import { GitHubOAuth } from '../../../server/lib/github-oauth';
import { MockAuthService } from '../../../server/lib/mock-auth-service';

// Mock the feature flags module
vi.mock('../../../server/lib/feature-flags', () => ({
  isMockModeEnabled: vi.fn(),
}));

// Mock the auth services
vi.mock('../../../server/lib/github-oauth');
vi.mock('../../../server/lib/mock-auth-service');

describe('ServiceFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createAuthService', () => {
    it('should create MockAuthService when mock mode is enabled', async () => {
      const { isMockModeEnabled } = await import('../../../server/lib/feature-flags');
      vi.mocked(isMockModeEnabled).mockReturnValue(true);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const _service = ServiceFactory.createAuthService();

      expect(MockAuthService).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '🎭 [SERVICE FACTORY] Creating MockAuthService (MOCK_LOGIN=true)'
      );

      consoleSpy.mockRestore();
    });

    it('should create GitHubOAuth when mock mode is disabled', async () => {
      const { isMockModeEnabled } = await import('../../../server/lib/feature-flags');
      vi.mocked(isMockModeEnabled).mockReturnValue(false);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const oauthConfig = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/callback'
      };

      const _service = ServiceFactory.createAuthService(oauthConfig);

      expect(GitHubOAuth).toHaveBeenCalledWith(oauthConfig);
      expect(consoleSpy).toHaveBeenCalledWith(
        '🔐 [SERVICE FACTORY] Creating GitHubOAuth (production mode)'
      );

      consoleSpy.mockRestore();
    });

    it('should throw error when no oauth config provided in production mode', async () => {
      const { isMockModeEnabled } = await import('../../../server/lib/feature-flags');
      vi.mocked(isMockModeEnabled).mockReturnValue(false);

      expect(() => ServiceFactory.createAuthService()).toThrow(
        'GitHubOAuth configuration required when MOCK_LOGIN is not enabled'
      );
    });

    it('should pass mock config to MockAuthService', async () => {
      const { isMockModeEnabled } = await import('../../../server/lib/feature-flags');
      vi.mocked(isMockModeEnabled).mockReturnValue(true);

      const mockConfig = {
        users: [
          {
            id: 'test-user',
            username: 'testuser',
            email: 'test@example.com',
            avatarUrl: 'https://avatar.com/test',
            accessToken: 'test-token'
          }
        ]
      };

      ServiceFactory.createAuthService(undefined, mockConfig);

      expect(MockAuthService).toHaveBeenCalledWith(mockConfig);
    });
  });

  describe('isMockMode', () => {
    it('should return mock mode status', async () => {
      const { isMockModeEnabled } = await import('../../../server/lib/feature-flags');
      vi.mocked(isMockModeEnabled).mockReturnValue(true);

      expect(ServiceFactory.isMockMode()).toBe(true);

      vi.mocked(isMockModeEnabled).mockReturnValue(false);
      expect(ServiceFactory.isMockMode()).toBe(false);
    });
  });

  describe('getServiceType', () => {
    it('should return "mock" when in mock mode', async () => {
      const { isMockModeEnabled } = await import('../../../server/lib/feature-flags');
      vi.mocked(isMockModeEnabled).mockReturnValue(true);

      expect(ServiceFactory.getServiceType()).toBe('mock');
    });

    it('should return "production" when not in mock mode', async () => {
      const { isMockModeEnabled } = await import('../../../server/lib/feature-flags');
      vi.mocked(isMockModeEnabled).mockReturnValue(false);

      expect(ServiceFactory.getServiceType()).toBe('production');
    });
  });
});