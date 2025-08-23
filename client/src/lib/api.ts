import { apiRequest } from "./queryClient";

export interface AppState {
  monthlyDone: number;
  activeTask?: any;
  queue: any[];
  systemRunning: boolean;
}

export interface CreateTasksRequest {
  repo: string;
  templates: string[];
  count?: number;
}

export async function getStatus(): Promise<AppState> {
  const response = await fetch("/api/status");
  if (!response.ok) {
    throw new Error(`Failed to get status: ${response.statusText}`);
  }
  return response.json();
}

export async function createTasks(data: CreateTasksRequest) {
  return apiRequest("POST", "/api/tasks", data);
}

export async function pauseSystem() {
  return apiRequest("POST", "/api/system/pause");
}

export async function resumeSystem() {
  return apiRequest("POST", "/api/system/resume");
}

export async function clearQueue() {
  return apiRequest("DELETE", "/api/tasks/queue");
}

export async function deleteTask(taskId: string) {
  return apiRequest("DELETE", `/api/tasks/${taskId}`);
}
