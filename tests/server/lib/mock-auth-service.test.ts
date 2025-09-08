import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockAuthService, type MockUser } from '../../../server/lib/mock-auth-service';

describe('MockAuthService', () => {
  let mockAuthService: MockAuthService;

  beforeEach(() => {
    mockAuthService = new MockAuthService();
  });

  describe('getAuthorizationUrl', () => {
    it('should generate mock authorization URL', () => {
      const url = mockAuthService.getAuthorizationUrl('test-state');
      
      expect(url).toContain('/api/auth/mock/callback');
      expect(url).toContain('mock=true');
      expect(url).toContain('state=test-state');
      expect(url).toContain('available_users=testdev%2Cqauser%2Cdevlead');
    });
  });

  describe('exchangeCodeForToken', () => {
    it('should exchange user ID for mock token', async () => {
      const result = await mockAuthService.exchangeCodeForToken('mock-user-1');
      
      expect(result.accessToken).toBe('mock-token-testdev-12345');
      expect(result.refreshToken).toBe('refresh-mock-token-testdev-12345');
    });

    it('should throw error for invalid user ID', async () => {
      await expect(
        mockAuthService.exchangeCodeForToken('invalid-user')
      ).rejects.toThrow('Invalid mock user code');
    });
  });

  describe('getUserInfo', () => {
    it('should return user info for valid token', async () => {
      const userInfo = await mockAuthService.getUserInfo('mock-token-testdev-12345');
      
      expect(userInfo).toEqual({
        id: 'mock-user-1',
        login: 'testdev',
        email: 'testdev@example.com',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=testdev'
      });
    });

    it('should throw error for invalid token', async () => {
      await expect(
        mockAuthService.getUserInfo('invalid-token')
      ).rejects.toThrow('Invalid mock access token');
    });
  });

  describe('getUserRepositories', () => {
    it('should return repositories for valid user', async () => {
      const repos = await mockAuthService.getUserRepositories('mock-token-testdev-12345');
      
      expect(repos).toHaveLength(2);
      expect(repos[0]).toEqual({
        id: 1001,
        name: 'frontend-app',
        full_name: 'testdev/frontend-app',
        owner: { login: 'testdev' },
        permissions: { admin: true, push: true }
      });
    });

    it('should return empty array for user with no repos', async () => {
      // Create service with custom config
      const customService = new MockAuthService({
        users: [{
          id: 'empty-user',
          username: 'emptyuser',
          email: 'empty@example.com',
          avatarUrl: 'https://avatar.com/empty',
          accessToken: 'empty-token'
        }]
      });

      const repos = await customService.getUserRepositories('empty-token');
      expect(repos).toEqual([]);
    });
  });

  describe('webhook operations', () => {
    it('should register webhook (mock)', async () => {
      const webhook = await mockAuthService.registerWebhook(
        'mock-token-testdev-12345',
        'testdev',
        'frontend-app',
        'https://example.com/webhook'
      );
      
      expect(webhook.id).toBeGreaterThan(0);
      expect(webhook.url).toBe('https://example.com/webhook');
    });

    it('should remove webhook (mock)', async () => {
      // Should not throw
      await expect(
        mockAuthService.removeWebhook(
          'mock-token-testdev-12345',
          'testdev',
          'frontend-app',
          12345
        )
      ).resolves.toBeUndefined();
    });

    it('should delete webhook (mock)', async () => {
      // Should not throw
      await expect(
        mockAuthService.deleteWebhook(
          'mock-token-testdev-12345',
          'testdev', 
          'frontend-app',
          12345
        )
      ).resolves.toBeUndefined();
    });
  });

  describe('utility methods', () => {
    it('should get available users (hiding tokens)', () => {
      const users = mockAuthService.getAvailableUsers();
      
      expect(users).toHaveLength(3);
      expect(users[0].accessToken).toBe('[HIDDEN]');
      expect(users[0].username).toBe('testdev');
    });

    it('should get default user', () => {
      const defaultUser = mockAuthService.getDefaultUser();
      
      expect(defaultUser).toBeDefined();
      expect(defaultUser?.id).toBe('mock-user-1');
    });

    it('should create mock session token', () => {
      const token = mockAuthService.createMockSessionToken('test-user');
      
      expect(token).toContain('mock-session-test-user-');
      expect(token.length).toBeGreaterThan(20);
    });
  });

  describe('configuration', () => {
    it('should use custom configuration', () => {
      const customUsers: MockUser[] = [
        {
          id: 'custom-1',
          username: 'customuser',
          email: 'custom@example.com',
          avatarUrl: 'https://avatar.com/custom',
          accessToken: 'custom-token'
        }
      ];

      const customService = new MockAuthService({
        users: customUsers,
        defaultUserId: 'custom-1'
      });

      const users = customService.getAvailableUsers();
      expect(users).toHaveLength(1);
      expect(users[0].username).toBe('customuser');
      
      const defaultUser = customService.getDefaultUser();
      expect(defaultUser?.id).toBe('custom-1');
    });
  });
});