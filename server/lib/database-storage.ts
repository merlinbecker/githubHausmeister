import { eq, and, desc } from "drizzle-orm";
import { db } from "../db";
import { 
  users, 
  userRepositories, 
  tasks, 
  webhookDeliveries, 
  userSystemState,
  type User,
  type InsertUser,
  type UserRepository,
  type InsertUserRepository,
  type Task,
  type InsertTask,
  type WebhookDelivery,
  type UserSystemState,
  type AppState
} from "@shared/schema";

export class DatabaseStorage {
  // User operations
  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async createOrUpdateUser(userData: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          username: userData.username,
          email: userData.email,
          avatarUrl: userData.avatarUrl,
          accessToken: userData.accessToken,
          refreshToken: userData.refreshToken,
          tokenExpiresAt: userData.tokenExpiresAt,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserToken(userId: string, accessToken: string, refreshToken?: string): Promise<void> {
    await db
      .update(users)
      .set({
        accessToken,
        refreshToken,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  // Repository operations
  async getUserRepositories(userId: string): Promise<UserRepository[]> {
    return db
      .select()
      .from(userRepositories)
      .where(eq(userRepositories.userId, userId))
      .orderBy(desc(userRepositories.createdAt));
  }

  async addUserRepository(repositoryData: InsertUserRepository): Promise<UserRepository> {
    const [repository] = await db
      .insert(userRepositories)
      .values(repositoryData)
      .onConflictDoNothing()
      .returning();
    
    if (!repository) {
      // Repository already exists, return it
      const [existing] = await db
        .select()
        .from(userRepositories)
        .where(
          and(
            eq(userRepositories.userId, repositoryData.userId),
            eq(userRepositories.owner, repositoryData.owner),
            eq(userRepositories.repo, repositoryData.repo)
          )
        );
      return existing;
    }
    
    return repository;
  }

  async updateRepositoryWebhook(repositoryId: string, webhookId: number): Promise<void> {
    await db
      .update(userRepositories)
      .set({ webhookId })
      .where(eq(userRepositories.id, repositoryId));
  }

  async removeUserRepository(repositoryId: string): Promise<void> {
    await db.delete(userRepositories).where(eq(userRepositories.id, repositoryId));
  }

  // Task operations
  async createTask(taskData: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(taskData).returning();
    return task;
  }

  async getUserTasks(userId: string): Promise<Task[]> {
    return db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, userId))
      .orderBy(desc(tasks.createdAt));
  }

  async getQueuedTasks(userId: string): Promise<Task[]> {
    return db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.status, "queued")))
      .orderBy(tasks.createdAt);
  }

  async getActiveTask(userId: string): Promise<Task | undefined> {
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.status, "active")));
    return task;
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task | undefined> {
    const [task] = await db
      .update(tasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tasks.id, taskId))
      .returning();
    return task;
  }

  async deleteTask(taskId: string): Promise<boolean> {
    const result = await db.delete(tasks).where(eq(tasks.id, taskId));
    return (result.rowCount || 0) > 0;
  }

  // Webhook delivery operations
  async recordWebhookDelivery(delivery: WebhookDelivery): Promise<WebhookDelivery> {
    const [recorded] = await db
      .insert(webhookDeliveries)
      .values(delivery)
      .onConflictDoNothing()
      .returning();
    return recorded || delivery;
  }

  async isDeliveryProcessed(deliveryId: string): Promise<boolean> {
    const [delivery] = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, deliveryId));
    return delivery?.processed ?? false;
  }

  // User system state operations
  async getUserSystemState(userId: string): Promise<UserSystemState> {
    const [state] = await db
      .select()
      .from(userSystemState)
      .where(eq(userSystemState.userId, userId));
    
    if (!state) {
      // Create default state for user
      const [newState] = await db
        .insert(userSystemState)
        .values({
          userId,
          monthlyDone: 0,
          systemRunning: true,
          lastReset: new Date(),
        })
        .returning();
      return newState;
    }
    
    return state;
  }

  async updateUserSystemState(userId: string, updates: Partial<UserSystemState>): Promise<UserSystemState> {
    const [state] = await db
      .update(userSystemState)
      .set(updates)
      .where(eq(userSystemState.userId, userId))
      .returning();
    return state;
  }

  // Application state (user-specific)
  async getUserAppState(userId: string): Promise<AppState> {
    const [user, repositories, systemState, activeTask, queuedTasks] = await Promise.all([
      this.getUserById(userId),
      this.getUserRepositories(userId),
      this.getUserSystemState(userId),
      this.getActiveTask(userId),
      this.getQueuedTasks(userId),
    ]);

    return {
      user,
      repositories,
      monthlyDone: systemState.monthlyDone || 0,
      activeTask,
      queue: queuedTasks,
      systemRunning: systemState.systemRunning ?? true,
    };
  }
}

export const databaseStorage = new DatabaseStorage();