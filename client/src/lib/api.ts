
import { apiRequest } from './queryClient';
import type { User } from '@/lib/auth';

import type { UserRepository } from "@shared/schema";

// Re-export UserRepository for components
export type { UserRepository };


export interface AppState {
  user?: User;
  monthlyDone: number;
  activeTask?: any;
  queue: any[];
  systemRunning: boolean;
  repositories: any[];
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

export async function getWebhookDeliveries(limit: number = 50): Promise<any[]> {
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
