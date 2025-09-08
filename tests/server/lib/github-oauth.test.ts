import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubOAuth } from '../../../server/lib/github-oauth';

// Mock Octokit
const mockOctokitRest = {
  users: {
    getAuthenticated: vi.fn(),
  },
  repos: {
    listForAuthenticatedUser: vi.fn(),
    createWebhook: vi.fn(),
    deleteWebhook: vi.fn(),
  },
};

vi.mock('octokit', () => ({
  Octokit: vi.fn(() => ({
    rest: mockOctokitRest,
  })),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GitHubOAuth', () => {
  let oauth: GitHubOAuth;
  const config = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'http://localhost:3000/auth/callback',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    oauth = new GitHubOAuth(config);
  });

  describe('getAuthorizationUrl', () => {
    it('should generate correct authorization URL without state', () => {
      const url = oauth.getAuthorizationUrl();
      expect(url).toBe(
        'https://github.com/login/oauth/authorize?client_id=test-client-id&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback&scope=repo+user+admin%3Arepo_hook+read%3Aorg&state='
      );
    });

    it('should generate correct authorization URL with state', () => {
      const state = 'random-state-string';
      const url = oauth.getAuthorizationUrl(state);
      expect(url).toBe(
        `https://github.com/login/oauth/authorize?client_id=test-client-id&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback&scope=repo+user+admin%3Arepo_hook+read%3Aorg&state=${state}`
      );
    });
  });

  describe('exchangeCodeForToken', () => {
    it('should successfully exchange code for token', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await oauth.exchangeCodeForToken('test-code');

      expect(result).toEqual({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://github.com/login/oauth/access_token',
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code: 'test-code',
            redirect_uri: config.redirectUri,
          }),
        }
      );
    });

    it('should handle HTTP errors', async () => {
      const mockResponse = {
        ok: false,
        statusText: 'Bad Request',
        json: vi.fn(),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(oauth.exchangeCodeForToken('test-code')).rejects.toThrow(
        'OAuth token exchange failed: Bad Request'
      );
    });

    it('should handle OAuth errors from response', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          error: 'invalid_grant',
          error_description: 'The provided authorization grant is invalid',
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(oauth.exchangeCodeForToken('test-code')).rejects.toThrow(
        'OAuth error: The provided authorization grant is invalid'
      );
    });

    it('should handle OAuth errors without description', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          error: 'invalid_grant',
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(oauth.exchangeCodeForToken('test-code')).rejects.toThrow(
        'OAuth error: invalid_grant'
      );
    });
  });

  describe('getUserInfo', () => {
    it('should get user info successfully', async () => {
      const mockUserData = {
        id: 12345,
        login: 'testuser',
        email: 'test@example.com',
        avatar_url: 'https://avatar.com/test',
      };

      mockOctokitRest.users.getAuthenticated.mockResolvedValue({
        data: mockUserData,
      });

      const result = await oauth.getUserInfo('test-token');

      expect(result).toEqual({
        id: '12345',
        login: 'testuser',
        email: 'test@example.com',
        avatar_url: 'https://avatar.com/test',
      });

      expect(mockOctokitRest.users.getAuthenticated).toHaveBeenCalled();
    });

    it('should handle user without email', async () => {
      const mockUserData = {
        id: 12345,
        login: 'testuser',
        email: null,
        avatar_url: 'https://avatar.com/test',
      };

      mockOctokitRest.users.getAuthenticated.mockResolvedValue({
        data: mockUserData,
      });

      const result = await oauth.getUserInfo('test-token');

      expect(result).toEqual({
        id: '12345',
        login: 'testuser',
        email: undefined,
        avatar_url: 'https://avatar.com/test',
      });
    });

    it('should handle API errors', async () => {
      mockOctokitRest.users.getAuthenticated.mockRejectedValue(
        new Error('API Error')
      );

      await expect(oauth.getUserInfo('test-token')).rejects.toThrow(
        'API Error'
      );
    });
  });

  describe('getUserRepositories', () => {
    it('should get user repositories with admin/push permissions', async () => {
      const mockRepoData = [
        {
          id: 1,
          name: 'repo1',
          full_name: 'user/repo1',
          owner: { login: 'user' },
          permissions: { admin: true, push: true },
        },
        {
          id: 2,
          name: 'repo2',
          full_name: 'user/repo2',
          owner: { login: 'user' },
          permissions: { admin: false, push: true },
        },
        {
          id: 3,
          name: 'repo3',
          full_name: 'user/repo3',
          owner: { login: 'user' },
          permissions: { admin: false, push: false },
        },
      ];

      mockOctokitRest.repos.listForAuthenticatedUser.mockResolvedValue({
        data: mockRepoData,
      });

      const result = await oauth.getUserRepositories('test-token');

      // Should only return repos with admin or push permissions
      expect(result).toHaveLength(2);
      expect(result).toEqual([
        {
          id: 1,
          name: 'repo1',
          full_name: 'user/repo1',
          owner: { login: 'user' },
          permissions: { admin: true, push: true },
        },
        {
          id: 2,
          name: 'repo2',
          full_name: 'user/repo2',
          owner: { login: 'user' },
          permissions: { admin: false, push: true },
        },
      ]);

      expect(
        mockOctokitRest.repos.listForAuthenticatedUser
      ).toHaveBeenCalledWith({
        per_page: 100,
        sort: 'updated',
        type: 'all',
      });
    });

    it('should handle API errors', async () => {
      mockOctokitRest.repos.listForAuthenticatedUser.mockRejectedValue(
        new Error('API Error')
      );

      await expect(oauth.getUserRepositories('test-token')).rejects.toThrow(
        'API Error'
      );
    });
  });

  describe('registerWebhook', () => {
    it('should register webhook successfully', async () => {
      const mockWebhookData = {
        id: 12345,
        config: { url: 'https://example.com/webhook' },
      };

      mockOctokitRest.repos.createWebhook.mockResolvedValue({
        data: mockWebhookData,
      });

      const result = await oauth.registerWebhook(
        'test-token',
        'owner',
        'repo',
        'https://example.com/webhook',
        'webhook-secret'
      );

      expect(result).toEqual({
        id: 12345,
        url: 'https://example.com/webhook',
      });

      expect(mockOctokitRest.repos.createWebhook).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        config: {
          url: 'https://example.com/webhook',
          content_type: 'json',
          secret: 'webhook-secret',
          insecure_ssl: '0',
        },
        events: ['issues', 'pull_request', 'workflow_run', 'check_suite'],
        active: true,
      });
    });

    it('should handle webhook creation errors', async () => {
      mockOctokitRest.repos.createWebhook.mockRejectedValue(
        new Error('Webhook creation failed')
      );

      await expect(
        oauth.registerWebhook(
          'test-token',
          'owner',
          'repo',
          'https://example.com/webhook',
          'webhook-secret'
        )
      ).rejects.toThrow('Webhook creation failed');
    });
  });

  describe('deleteWebhook', () => {
    it('should delete webhook successfully', async () => {
      mockOctokitRest.repos.deleteWebhook.mockResolvedValue({});

      await oauth.deleteWebhook('test-token', 'owner', 'repo', 12345);

      expect(mockOctokitRest.repos.deleteWebhook).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        hook_id: 12345,
      });
    });

    it('should handle webhook deletion errors', async () => {
      mockOctokitRest.repos.deleteWebhook.mockRejectedValue(
        new Error('Webhook deletion failed')
      );

      await expect(
        oauth.deleteWebhook('test-token', 'owner', 'repo', 12345)
      ).rejects.toThrow('Webhook deletion failed');
    });
  });
});
