import { apiRequest } from "./queryClient";

export interface User {
  id: string;
  username: string;
  email?: string;
  avatarUrl?: string;
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const response = await fetch("/api/auth/user", {
      credentials: "include",
    });
    
    if (!response.ok) {
      return null;
    }
    
    return response.json();
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await apiRequest("POST", "/api/auth/logout");
}

export function loginWithGitHub(): void {
  window.location.href = "/api/auth/github";
}