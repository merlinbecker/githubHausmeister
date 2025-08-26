import { Octokit } from "octokit";
import type { GitHubUser, GitHubRepository } from "@shared/schema";

export interface GitHubOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class GitHubOAuth {
  private config: GitHubOAuthConfig;

  constructor(config: GitHubOAuthConfig) {
    this.config = config;
  }

  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: "repo user admin:repo_hook read:org",
      state: state || "",
    });
    
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, state?: string): Promise<{ accessToken: string; refreshToken?: string }> {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        redirect_uri: this.config.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`OAuth token exchange failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`OAuth error: ${data.error_description || data.error}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  }

  async getUserInfo(accessToken: string): Promise<GitHubUser> {
    const octokit = new Octokit({ auth: accessToken });
    const { data } = await octokit.rest.users.getAuthenticated();
    
    return {
      id: data.id.toString(),
      login: data.login,
      email: data.email || undefined,
      avatar_url: data.avatar_url,
    };
  }

  async getUserRepositories(accessToken: string): Promise<GitHubRepository[]> {
    const octokit = new Octokit({ auth: accessToken });
    
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      per_page: 100,
      sort: "updated",
      type: "all",
    });
    
    return data.filter(repo => 
      repo.permissions?.admin || repo.permissions?.push
    ).map(repo => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      owner: {
        login: repo.owner.login,
      },
      permissions: repo.permissions,
    }));
  }

  async registerWebhook(accessToken: string, owner: string, repo: string, webhookUrl: string, secret: string): Promise<{ id: number; url: string }> {
    const octokit = new Octokit({ auth: accessToken });
    
    const events = ["issues", "pull_request", "workflow_run", "check_suite"];
    
    try {
      const { data } = await octokit.rest.repos.createWebhook({
        owner,
        repo,
        config: {
          url: webhookUrl,
          content_type: "json",
          secret,
          insecure_ssl: "0",
        },
        events,
        active: true,
      });
      
      return { id: data.id, url: data.config?.url || webhookUrl };
    } catch (error: any) {
      if (error.status === 422) {
        // Webhook might already exist, try to find it
        const { data: hooks } = await octokit.rest.repos.listWebhooks({ owner, repo });
        const existingHook = hooks.find(hook => hook.config?.url === webhookUrl);
        
        if (existingHook) {
          return { id: existingHook.id, url: existingHook.config?.url || webhookUrl };
        }
      }
      throw error;
    }
  }

  async deleteWebhook(accessToken: string, owner: string, repo: string, webhookId: number): Promise<void> {
    const octokit = new Octokit({ auth: accessToken });
    await octokit.rest.repos.deleteWebhook({
      owner,
      repo,
      hook_id: webhookId,
    });
  }
}