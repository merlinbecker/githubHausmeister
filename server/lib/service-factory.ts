/**
 * Service Factory Pattern for Mock vs Production Services
 * Provides centralized service instantiation based on feature flags
 */

import { isMockModeEnabled } from './feature-flags';
import { GitHubOAuth, type GitHubOAuthConfig } from './github-oauth';
import { MockAuthService, type MockAuthConfig } from './mock-auth-service';

export class ServiceFactory {
  /**
   * Create authentication service based on feature flags
   */
  static createAuthService(
    oauthConfig?: GitHubOAuthConfig,
    mockConfig?: Partial<MockAuthConfig>
  ): GitHubOAuth | MockAuthService {
    if (isMockModeEnabled()) {
      console.log(
        '🎭 [SERVICE FACTORY] Creating MockAuthService (MOCK_LOGIN=true)'
      );
      return new MockAuthService(mockConfig);
    }

    if (!oauthConfig) {
      throw new Error(
        'GitHubOAuth configuration required when MOCK_LOGIN is not enabled'
      );
    }

    console.log('🔐 [SERVICE FACTORY] Creating GitHubOAuth (production mode)');
    return new GitHubOAuth(oauthConfig);
  }

  /**
   * Check if we're in mock mode
   */
  static isMockMode(): boolean {
    return isMockModeEnabled();
  }

  /**
   * Get service type for logging/debugging
   */
  static getServiceType(): 'mock' | 'production' {
    return isMockModeEnabled() ? 'mock' : 'production';
  }
}
