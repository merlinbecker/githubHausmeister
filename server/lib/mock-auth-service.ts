/**
 * Mock Authentication Service
 * Simulates GitHub OAuth flow for testing purposes
 */

import type { GitHubUser, GitHubRepository } from '@shared/schema';
import { randomUUID } from 'crypto';

export interface MockUser {
  id: string;
  username: string;
  email: string;
  avatarUrl: string;
  accessToken: string;
}

export interface MockAuthConfig {
  users: MockUser[];
  defaultUserId?: string;
}

// Predefined test users
const DEFAULT_MOCK_USERS: MockUser[] = [
  {
    id: 'mock-user-1',
    username: 'testdev',
    email: 'testdev@example.com',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=testdev',
    accessToken: 'mock-token-testdev-12345',
  },
  {
    id: 'mock-user-2',
    username: 'qauser',
    email: 'qa@example.com',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=qauser',
    accessToken: 'mock-token-qauser-67890',
  },
  {
    id: 'mock-user-3',
    username: 'devlead',
    email: 'lead@example.com',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=devlead',
    accessToken: 'mock-token-devlead-abcde',
  },
];

// Mock repositories for each user
const MOCK_REPOSITORIES: Record<string, GitHubRepository[]> = {
  'mock-user-1': [
    {
      id: 1001,
      name: 'frontend-app',
      full_name: 'testdev/frontend-app',
      owner: { login: 'testdev' },
      permissions: { admin: true, push: true },
    },
    {
      id: 1002,
      name: 'api-service',
      full_name: 'testdev/api-service',
      owner: { login: 'testdev' },
      permissions: { admin: false, push: true },
    },
  ],
  'mock-user-2': [
    {
      id: 2001,
      name: 'test-automation',
      full_name: 'qauser/test-automation',
      owner: { login: 'qauser' },
      permissions: { admin: true, push: true },
    },
  ],
  'mock-user-3': [
    {
      id: 3001,
      name: 'infrastructure',
      full_name: 'devlead/infrastructure',
      owner: { login: 'devlead' },
      permissions: { admin: true, push: true },
    },
    {
      id: 3002,
      name: 'docs-site',
      full_name: 'devlead/docs-site',
      owner: { login: 'devlead' },
      permissions: { admin: true, push: true },
    },
  ],
};

export class MockAuthService {
  private config: MockAuthConfig;

  constructor(config?: Partial<MockAuthConfig>) {
    this.config = {
      users: DEFAULT_MOCK_USERS,
      defaultUserId: 'mock-user-1',
      ...config,
    };
  }

  /**
   * Simulate GitHub OAuth authorization URL generation
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      mock: 'true',
      state: state || '',
      available_users: this.config.users.map((u) => u.username).join(','),
    });

    return `/api/auth/mock/callback?${params.toString()}`;
  }

  /**
   * Simulate OAuth token exchange
   */
  async exchangeCodeForToken(
    code: string,
    _state?: string
  ): Promise<{ accessToken: string; refreshToken?: string }> {
    // In mock mode, 'code' represents the selected user ID
    const user = this.config.users.find((u) => u.id === code);

    if (!user) {
      throw new Error('Invalid mock user code');
    }

    return {
      accessToken: user.accessToken,
      refreshToken: `refresh-${user.accessToken}`,
    };
  }

  /**
   * Get mock user info from access token
   */
  async getUserInfo(accessToken: string): Promise<GitHubUser> {
    const user = this.config.users.find((u) => u.accessToken === accessToken);

    if (!user) {
      throw new Error('Invalid mock access token');
    }

    return {
      id: user.id,
      login: user.username,
      email: user.email,
      avatar_url: user.avatarUrl,
    };
  }

  /**
   * Get mock repositories for user
   */
  async getUserRepositories(accessToken: string): Promise<GitHubRepository[]> {
    const user = this.config.users.find((u) => u.accessToken === accessToken);

    if (!user) {
      throw new Error('Invalid mock access token');
    }

    return MOCK_REPOSITORIES[user.id] || [];
  }

  /**
   * Mock webhook registration (no-op in mock mode)
   */
  async registerWebhook(
    accessToken: string,
    owner: string,
    repo: string,
    webhookUrl: string
  ): Promise<{ id: number; url: string }> {
    console.log(
      `[MOCK] Webhook registered for ${owner}/${repo} -> ${webhookUrl}`
    );

    // Return mock webhook data
    return {
      id: Math.floor(Math.random() * 10000),
      url: webhookUrl,
    };
  }

  /**
   * Mock webhook removal (no-op in mock mode)
   */
  async removeWebhook(
    accessToken: string,
    owner: string,
    repo: string,
    webhookId: number
  ): Promise<void> {
    console.log(`[MOCK] Webhook ${webhookId} removed from ${owner}/${repo}`);
  }

  /**
   * Mock webhook deletion (no-op in mock mode) - alias for removeWebhook
   */
  async deleteWebhook(
    accessToken: string,
    owner: string,
    repo: string,
    webhookId: number
  ): Promise<void> {
    await this.removeWebhook(accessToken, owner, repo, webhookId);
  }

  /**
   * Get list of available mock users (for UI)
   */
  getAvailableUsers(): MockUser[] {
    return this.config.users.map((user) => ({
      ...user,
      accessToken: '[HIDDEN]', // Don't expose tokens in UI
    }));
  }

  /**
   * Get default user (for quick testing)
   */
  getDefaultUser(): MockUser | undefined {
    const defaultId = this.config.defaultUserId;
    return defaultId
      ? this.config.users.find((u) => u.id === defaultId)
      : this.config.users[0];
  }

  /**
   * Create a mock session token for user selection
   */
  createMockSessionToken(userId: string): string {
    return `mock-session-${userId}-${randomUUID()}`;
  }
}
