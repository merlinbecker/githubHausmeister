import { apiRequest } from './queryClient';
import type { User } from '@/lib/auth';

import type { UserRepository, Task, WebhookDelivery } from '@shared/schema';

// Re-export UserRepository for components
export type { UserRepository };

export interface AppState {
  user?: User;
  monthlyDone: number;
  activeTask?: Task;
  queue: Task[];
  systemRunning: boolean;
  repositories: UserRepository[];
}

export interface StatsData {
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  inProgressTasks: number;
  successRate: number;
  avgTimeHours: number;
  maxMonthlyTasks: number;
}

export interface CreateTasksRequest {
  repositoryId: string;
  templates: string[];
  count?: number;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  permissions?: {
    admin: boolean;
    push: boolean;
  };
}

export async function getStatus(): Promise<AppState> {
  const response = await fetch('/api/status', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Failed to get status: ${response.statusText}`);
  }
  return response.json();
}

export async function getGitHubRepositories(): Promise<GitHubRepository[]> {
  const response = await fetch('/api/repositories', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Failed to get repositories: ${response.statusText}`);
  }
  return response.json();
}

export async function addRepository(
  owner: string,
  repo: string
): Promise<UserRepository> {
  const response = await apiRequest('POST', '/api/repositories', {
    owner,
    repo,
  });

  return response.json();
}

export async function removeRepository(repositoryId: string): Promise<void> {
  await apiRequest('DELETE', `/api/repositories/${repositoryId}`);
}

export async function createTasks(data: CreateTasksRequest) {
  return apiRequest('POST', '/api/tasks', data);
}

export async function pauseSystem() {
  return apiRequest('POST', '/api/system/pause');
}

export async function resumeSystem() {
  return apiRequest('POST', '/api/system/resume');
}

export async function clearQueue() {
  return apiRequest('DELETE', '/api/tasks/queue');
}

export async function deleteTask(taskId: string) {
  return apiRequest('DELETE', `/api/tasks/${taskId}`);
}

export async function getWebhookDeliveries(
  limit: number = 50
): Promise<WebhookDelivery[]> {
  const response = await fetch(`/api/webhooks/deliveries?limit=${limit}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Failed to get webhook deliveries: ${response.statusText}`);
  }
  return response.json();
}

export async function testWebhook(repositoryId: string) {
  return apiRequest('POST', '/api/webhooks/test', { repositoryId });
}

// Issue Management API

export interface Issue {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed';
  assignee?: {
    id: number;
    login: string;
    avatar_url: string;
  };
  assignees: Array<{
    id: number;
    login: string;
    avatar_url: string;
  }>;
  labels: Array<{
    id: number;
    name: string;
    color: string;
  }>;
  created_at: string;
  updated_at: string;
  html_url: string;
  hasOpenPR?: boolean;
  openPRs?: PullRequest[];
}

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  html_url: string;
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
}

export interface Collaborator {
  id: number;
  login: string;
  avatar_url: string;
  permissions: {
    admin: boolean;
    maintain?: boolean;
    push: boolean;
    triage?: boolean;
    pull: boolean;
  };
  role_name: string;
}

export interface IssuesResponse {
  open: Issue[];
  closed: Issue[];
}

export async function getRepositoryIssues(
  owner: string,
  repo: string
): Promise<IssuesResponse> {
  const response = await fetch(`/api/repositories/${owner}/${repo}/issues`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Failed to get repository issues: ${response.statusText}`);
  }
  return response.json();
}

export async function getRepositoryCollaborators(
  owner: string,
  repo: string
): Promise<Collaborator[]> {
  const response = await fetch(
    `/api/repositories/${owner}/${repo}/collaborators`,
    {
      credentials: 'include',
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to get repository collaborators: ${response.statusText}`
    );
  }
  return response.json();
}

export async function assignIssueToCopilot(
  owner: string,
  repo: string,
  issueNumber: number
): Promise<{
  success: boolean;
  assignedAgent?: string;
  error?: string;
  message?: string;
}> {
  const response = await fetch(
    `/api/repositories/${owner}/${repo}/issues/${issueNumber}/assign`,
    {
      method: 'POST',
      credentials: 'include',
    }
  );

  const result = await response.json();
  if (!response.ok) {
    throw new Error(
      result.message ||
        result.error ||
        `Failed to assign issue: ${response.statusText}`
    );
  }
  return result;
}

export async function getIssuePRs(
  owner: string,
  repo: string,
  issueNumber: number
): Promise<PullRequest[]> {
  const response = await fetch(
    `/api/repositories/${owner}/${repo}/issues/${issueNumber}/prs`,
    {
      credentials: 'include',
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to get issue PRs: ${response.statusText}`);
  }
  return response.json();
}

export async function getWebhookForwardUrl(): Promise<{ forwardUrl: string | null }> {
  const response = await fetch('/api/user/webhook-forward-url', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Failed to get webhook forward URL: ${response.statusText}`);
  }
  return response.json();
}

export async function setWebhookForwardUrl(forwardUrl: string | null): Promise<{ success: boolean; forwardUrl: string | null }> {
  const response = await apiRequest('POST', '/api/user/webhook-forward-url', {
    forwardUrl,
  });
  return response.json();
}
