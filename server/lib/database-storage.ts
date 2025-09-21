import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import {
  users,
  userRepositories,
  tasks,
  taskTemplates,
  webhookDeliveries,
  userSystemState,
  issuePriorities,
  type User,
  type InsertUser,
  type UserRepository,
  type InsertUserRepository,
  type Task,
  type InsertTask,
  type TaskTemplate,
  type InsertTaskTemplate,
  type WebhookDelivery,
  type InsertWebhookDelivery,
  type UserSystemState,
  type IssuePriority,
  type InsertIssuePriority,
  type AppState,
} from '@shared/schema';

export class DatabaseStorage {
  // User operations
  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async createOrUpdateUser(userData: InsertUser): Promise<User> {
    // Try to get existing user first
    const existingUser = await this.getUserById(userData.id);
    
    if (existingUser) {
      // Update existing user
      const [user] = await db
        .update(users)
        .set({
          ...userData,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userData.id))
        .returning();
      return user;
    } else {
      // Create new user
      return this.createUser(userData);
    }
  }

  async updateUserToken(
    userId: string,
    accessToken: string,
    refreshToken?: string,
    tokenExpiresAt?: Date
  ): Promise<void> {
    await db
      .update(users)
      .set({
        accessToken,
        refreshToken,
        tokenExpiresAt,
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

  async getUserRepository(
    userId: string,
    repositoryId: string
  ): Promise<UserRepository | undefined> {
    const [repository] = await db
      .select()
      .from(userRepositories)
      .where(
        and(
          eq(userRepositories.userId, userId),
          eq(userRepositories.id, repositoryId)
        )
      );
    return repository;
  }

  async addUserRepository(
    repositoryData: InsertUserRepository
  ): Promise<UserRepository> {
    const [repository] = await db
      .insert(userRepositories)
      .values(repositoryData)
      .returning();
    return repository;
  }

  async updateUserRepository(
    repositoryId: string,
    repositoryData: Partial<UserRepository>
  ): Promise<UserRepository> {
    const [repository] = await db
      .update(userRepositories)
      .set(repositoryData)
      .where(eq(userRepositories.id, repositoryId))
      .returning();
    return repository;
  }

  async removeUserRepository(repositoryId: string): Promise<boolean> {
    const result = await db
      .delete(userRepositories)
      .where(eq(userRepositories.id, repositoryId));
    return (result.rowCount ?? 0) > 0;
  }

  async findRepositoryByWebhookId(webhookId: number): Promise<UserRepository | undefined> {
    const [repository] = await db
      .select()
      .from(userRepositories)
      .where(eq(userRepositories.webhookId, webhookId));
    return repository;
  }

  // Task operations
  async getTasks(userId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, userId))
      .orderBy(desc(tasks.createdAt));
  }

  async getTask(taskId: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    return task;
  }

  async addTask(taskData: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(taskData).returning();
    return task;
  }

  async createTask(taskData: InsertTask): Promise<Task> {
    return this.addTask(taskData);
  }

  async updateTask(taskId: string, taskData: Partial<Task>): Promise<Task> {
    const [task] = await db
      .update(tasks)
      .set({
        ...taskData,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId))
      .returning();
    return task;
  }

  async deleteTask(taskId: string): Promise<boolean> {
    const result = await db.delete(tasks).where(eq(tasks.id, taskId));
    return (result.rowCount ?? 0) > 0;
  }

  async getTasksByStatus(userId: string, status: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.status, status)))
      .orderBy(desc(tasks.createdAt));
  }

  async getActiveTask(userId: string): Promise<Task | undefined> {
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.status, 'in_progress')))
      .orderBy(desc(tasks.startedAt));
    return task;
  }

  async getQueuedTasks(userId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.status, 'queued')))
      .orderBy(tasks.createdAt);
  }

  async getCompletedTasks(userId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.status, 'completed')))
      .orderBy(desc(tasks.completedAt));
  }

  async getFailedTasks(userId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.status, 'failed')))
      .orderBy(desc(tasks.updatedAt));
  }

  // Webhook delivery operations
  async addWebhookDelivery(
    delivery: InsertWebhookDelivery
  ): Promise<WebhookDelivery> {
    const [webhookDelivery] = await db
      .insert(webhookDeliveries)
      .values(delivery)
      .returning();
    return webhookDelivery;
  }

  async getWebhookDelivery(id: string): Promise<WebhookDelivery | undefined> {
    const [delivery] = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, id));
    return delivery;
  }

  async markWebhookProcessed(id: string): Promise<void> {
    await db
      .update(webhookDeliveries)
      .set({ processed: true })
      .where(eq(webhookDeliveries.id, id));
  }

  async getUnprocessedWebhooks(): Promise<WebhookDelivery[]> {
    return await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.processed, false))
      .orderBy(webhookDeliveries.createdAt);
  }

  async getRecentWebhooks(limit: number = 50): Promise<WebhookDelivery[]> {
    return await db
      .select()
      .from(webhookDeliveries)
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit);
  }

  // System state operations
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
          systemRunning: true,
          lastReset: new Date(),
        })
        .returning();
      return newState;
    }

    return state;
  }

  async updateUserSystemState(
    userId: string,
    stateData: Partial<UserSystemState>
  ): Promise<UserSystemState> {
    const [state] = await db
      .update(userSystemState)
      .set(stateData)
      .where(eq(userSystemState.userId, userId))
      .returning();
    return state;
  }

  async getAppState(userId: string): Promise<AppState> {
    const [user, repositories, systemState, activeTask, queuedTasks] =
      await Promise.all([
        this.getUserById(userId),
        this.getUserRepositories(userId),
        this.getUserSystemState(userId),
        this.getActiveTask(userId),
        this.getQueuedTasks(userId),
      ]);

    // Calculate total monthly assignments used across all repositories
    const totalMonthlyUsed = repositories.reduce((total, repo) => {
      return total + (repo.monthlyAssignmentsUsed || 0);
    }, 0);

    return {
      user,
      repositories,
      monthlyDone: totalMonthlyUsed,
      activeTask,
      queue: queuedTasks,
      systemRunning: systemState.systemRunning ?? true,
    };
  }

  // TaskTemplate operations (extended for per-repository templates)
  async getTaskTemplates(
    userId: string,
    repositoryId?: string
  ): Promise<TaskTemplate[]> {
    const whereConditions = [eq(taskTemplates.userId, userId)];
    
    if (repositoryId) {
      whereConditions.push(eq(taskTemplates.repositoryId, repositoryId));
    }

    return await db
      .select()
      .from(taskTemplates)
      .where(and(...whereConditions))
      .orderBy(taskTemplates.type, taskTemplates.createdAt);
  }

  async addTaskTemplate(
    templateData: InsertTaskTemplate
  ): Promise<TaskTemplate> {
    const [template] = await db
      .insert(taskTemplates)
      .values(templateData)
      .returning();
    return template;
  }

  async createTaskTemplate(
    templateData: InsertTaskTemplate
  ): Promise<TaskTemplate> {
    return this.addTaskTemplate(templateData);
  }

  async updateTaskTemplate(
    templateId: string,
    templateData: Partial<InsertTaskTemplate>
  ): Promise<TaskTemplate> {
    const [template] = await db
      .update(taskTemplates)
      .set({
        ...templateData,
        updatedAt: new Date(),
      })
      .where(eq(taskTemplates.id, templateId))
      .returning();
    return template;
  }

  async deleteTaskTemplate(templateId: string): Promise<boolean> {
    const result = await db
      .delete(taskTemplates)
      .where(eq(taskTemplates.id, templateId));
    return (result.rowCount ?? 0) > 0;
  }

  async getTaskTemplateById(
    templateId: string
  ): Promise<TaskTemplate | undefined> {
    const [template] = await db
      .select()
      .from(taskTemplates)
      .where(eq(taskTemplates.id, templateId));
    return template;
  }

  // Issue Priority Management (Phase 3 of Issue Workflow Plan)
  async getIssuePriorities(
    userId: string,
    repositoryId: string
  ): Promise<IssuePriority[]> {
    return await db
      .select()
      .from(issuePriorities)
      .where(
        and(
          eq(issuePriorities.userId, userId),
          eq(issuePriorities.repositoryId, repositoryId)
        )
      )
      .orderBy(issuePriorities.priority);
  }

  async setIssuePriority(
    data: InsertIssuePriority
  ): Promise<IssuePriority> {
    // First check if priority already exists for this issue
    const existing = await db
      .select()
      .from(issuePriorities)
      .where(
        and(
          eq(issuePriorities.userId, data.userId),
          eq(issuePriorities.repositoryId, data.repositoryId),
          eq(issuePriorities.issueNumber, data.issueNumber)
        )
      );

    if (existing.length > 0) {
      // Update existing priority
      const [updated] = await db
        .update(issuePriorities)
        .set({ 
          priority: data.priority,
          updatedAt: new Date()
        })
        .where(eq(issuePriorities.id, existing[0].id))
        .returning();
      return updated;
    } else {
      // Create new priority
      const [created] = await db
        .insert(issuePriorities)
        .values(data)
        .returning();
      return created;
    }
  }

  async setBulkIssuePriorities(
    userId: string,
    repositoryId: string,
    priorities: Array<{ issueNumber: number; priority: number }>
  ): Promise<void> {
    await db.transaction(async (tx) => {
      for (const item of priorities) {
        // Check if priority exists for this issue
        const existing = await tx
          .select()
          .from(issuePriorities)
          .where(
            and(
              eq(issuePriorities.userId, userId),
              eq(issuePriorities.repositoryId, repositoryId),
              eq(issuePriorities.issueNumber, item.issueNumber)
            )
          );

        if (existing.length > 0) {
          // Update existing
          await tx
            .update(issuePriorities)
            .set({
              priority: item.priority,
              updatedAt: new Date(),
            })
            .where(eq(issuePriorities.id, existing[0].id));
        } else {
          // Insert new
          await tx
            .insert(issuePriorities)
            .values({
              userId,
              repositoryId,
              issueNumber: item.issueNumber,
              priority: item.priority,
            });
        }
      }
    });
  }

  async deleteIssuePriority(
    userId: string,
    repositoryId: string,
    issueNumber: number
  ): Promise<boolean> {
    const result = await db
      .delete(issuePriorities)
      .where(
        and(
          eq(issuePriorities.userId, userId),
          eq(issuePriorities.repositoryId, repositoryId),
          eq(issuePriorities.issueNumber, issueNumber)
        )
      );
    return (result.rowCount ?? 0) > 0;
  }
}

export const databaseStorage = new DatabaseStorage();