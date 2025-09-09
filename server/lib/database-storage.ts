import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import {
  users,
  userRepositories,
  tasks,
  webhookDeliveries,
  userSystemState,
  pushSubscriptions,
  notificationSettings,
  mentraGlasses,
  mentraSessions,
  voiceCommands,
  glassNotifications,
  type User,
  type InsertUser,
  type UserRepository,
  type InsertUserRepository,
  type Task,
  type InsertTask,
  type WebhookDelivery,
  type InsertWebhookDelivery,
  type UserSystemState,
  type PushSubscription,
  type InsertPushSubscription,
  type NotificationSettings,
  type MentraGlass,
  type InsertMentraGlass,
  type MentraSession,
  type InsertMentraSession,
  type VoiceCommand,
  type InsertVoiceCommand,
  type GlassNotification,
  type InsertGlassNotification,
  type AppState,
} from '@shared/schema';

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

  async updateUserToken(
    userId: string,
    accessToken: string,
    refreshToken?: string
  ): Promise<void> {
    await db
      .update(users)
      .set({
        accessToken,
        refreshToken,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async updateUser(
    userId: string,
    userData: Partial<Pick<User, 'webhookForwardUrl'>>
  ): Promise<void> {
    await db
      .update(users)
      .set({
        ...userData,
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

  async addUserRepository(
    repositoryData: InsertUserRepository
  ): Promise<UserRepository> {
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

  async updateRepositoryWebhook(
    repositoryId: string,
    webhookId: number
  ): Promise<void> {
    await db
      .update(userRepositories)
      .set({ webhookId })
      .where(eq(userRepositories.id, repositoryId));
  }

  async removeUserRepository(repositoryId: string): Promise<void> {
    await db
      .delete(userRepositories)
      .where(eq(userRepositories.id, repositoryId));
  }

  async getUserRepositoryByName(
    owner: string,
    repo: string
  ): Promise<UserRepository | undefined> {
    const [repository] = await db
      .select()
      .from(userRepositories)
      .where(
        and(eq(userRepositories.owner, owner), eq(userRepositories.repo, repo))
      );
    return repository;
  }

  async getUserRepositoriesByName(
    owner: string,
    repo: string
  ): Promise<UserRepository[]> {
    const repositories = await db
      .select()
      .from(userRepositories)
      .where(
        and(
          eq(userRepositories.owner, owner),
          eq(userRepositories.repo, repo),
          eq(userRepositories.isActive, true)
        )
      );
    return repositories;
  }

  // Task operations
  async createTask(taskData: InsertTask): Promise<Task> {
    const dataToInsert = {
      ...taskData,
      labels: taskData.labels as string[] | null,
    };
    const [task] = await db.insert(tasks).values(dataToInsert).returning();

    return task;
  }

  async getUserTasks(userId: string, limit?: number): Promise<Task[]> {
    const query = db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, userId))
      .orderBy(desc(tasks.createdAt));

    if (limit) {
      return query.limit(limit);
    }

    return query;
  }

  async getQueuedTasks(userId: string): Promise<Task[]> {
    return db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.status, 'queued')))
      .orderBy(tasks.createdAt);
  }

  async getActiveTask(userId: string): Promise<Task | undefined> {
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.status, 'in_progress')));
    return task;
  }

  async getTaskById(taskId: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    return task;
  }

  async updateTask(
    taskId: string,
    updates: Partial<Task>
  ): Promise<Task | undefined> {
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
  async recordWebhookDelivery(
    delivery: InsertWebhookDelivery
  ): Promise<WebhookDelivery> {
    const [recorded] = await db
      .insert(webhookDeliveries)
      .values(delivery)
      .onConflictDoNothing()
      .returning();
    return recorded || (delivery as WebhookDelivery);
  }

  async isDeliveryProcessed(deliveryId: string): Promise<boolean> {
    const [delivery] = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, deliveryId));
    return delivery?.processed ?? false;
  }

  async getUserWebhookDeliveries(
    userId: string,
    limit: number = 50
  ): Promise<WebhookDelivery[]> {
    // Get user's repositories
    const userRepos = await this.getUserRepositories(userId);
    const repoNames = userRepos.map((repo) => `${repo.owner}/${repo.repo}`);

    if (repoNames.length === 0) {
      return [];
    }

    try {
      // Get webhook deliveries for user's repositories
      const deliveries = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.processed, true))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(limit);

      // Filter to only include user's repositories
      return deliveries.filter((delivery) => {
        if (!delivery.repositoryOwner || !delivery.repositoryName) return false;
        return repoNames.includes(
          `${delivery.repositoryOwner}/${delivery.repositoryName}`
        );
      });
    } catch (error) {
      console.error('Error querying webhook deliveries:', error);
      // Return empty array if query fails
      return [];
    }
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

  async updateUserSystemState(
    userId: string,
    updates: Partial<UserSystemState>
  ): Promise<UserSystemState> {
    const [state] = await db
      .update(userSystemState)
      .set(updates)
      .where(eq(userSystemState.userId, userId))
      .returning();
    return state;
  }

  // Application state (user-specific)
  async getUserAppState(userId: string): Promise<AppState> {
    const [user, repositories, systemState, activeTask, queuedTasks] =
      await Promise.all([
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

  // Push subscription operations
  async addPushSubscription(
    subscription: InsertPushSubscription
  ): Promise<PushSubscription> {
    // Zuerst prüfen ob Subscription bereits existiert
    const [existing] = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, subscription.endpoint));

    if (existing) {
      // Update existing subscription
      const [updated] = await db
        .update(pushSubscriptions)
        .set({
          isActive: true,
          lastUsed: new Date(),
        })
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
        .returning();
      return updated;
    } else {
      // Insert new subscription
      const [inserted] = await db
        .insert(pushSubscriptions)
        .values(subscription)
        .returning();
      return inserted;
    }
  }

  async getUserPushSubscriptions(userId: string): Promise<PushSubscription[]> {
    return db
      .select()
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.isActive, true)
        )
      );
  }

  async removePushSubscription(endpoint: string): Promise<boolean> {
    const result = await db
      .update(pushSubscriptions)
      .set({ isActive: false })
      .where(eq(pushSubscriptions.endpoint, endpoint));
    return (result.rowCount ?? 0) > 0;
  }

  // Notification settings operations
  async getUserNotificationSettings(
    userId: string
  ): Promise<NotificationSettings> {
    const [settings] = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, userId));

    if (!settings) {
      const [newSettings] = await db
        .insert(notificationSettings)
        .values({ userId })
        .returning();
      return newSettings;
    }

    return settings;
  }

  async updateNotificationSettings(
    userId: string,
    updates: Partial<NotificationSettings>
  ): Promise<NotificationSettings> {
    const [updated] = await db
      .update(notificationSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(notificationSettings.userId, userId))
      .returning();
    return updated;
  }

  // mentraOS Smartglasses operations
  async addGlass(glassData: InsertMentraGlass): Promise<MentraGlass> {
    const [glass] = await db
      .insert(mentraGlasses)
      .values(glassData)
      .returning();
    return glass;
  }

  async getUserGlasses(userId: string): Promise<MentraGlass[]> {
    return db
      .select()
      .from(mentraGlasses)
      .where(
        and(eq(mentraGlasses.userId, userId), eq(mentraGlasses.isActive, true))
      );
  }

  async getGlassByGlassId(glassId: string): Promise<MentraGlass | undefined> {
    const [glass] = await db
      .select()
      .from(mentraGlasses)
      .where(eq(mentraGlasses.glassId, glassId));
    return glass;
  }

  async getGlassById(id: string): Promise<MentraGlass | undefined> {
    const [glass] = await db
      .select()
      .from(mentraGlasses)
      .where(eq(mentraGlasses.id, id));
    return glass;
  }

  async updateGlass(
    glassId: string,
    updates: Partial<MentraGlass>
  ): Promise<MentraGlass> {
    const [updated] = await db
      .update(mentraGlasses)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(mentraGlasses.id, glassId))
      .returning();
    return updated;
  }

  async deactivateGlass(glassId: string): Promise<boolean> {
    const result = await db
      .update(mentraGlasses)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(mentraGlasses.id, glassId));
    return (result.rowCount ?? 0) > 0;
  }

  // mentraOS Session operations
  async createSession(
    sessionData: InsertMentraSession
  ): Promise<MentraSession> {
    const [session] = await db
      .insert(mentraSessions)
      .values(sessionData)
      .returning();
    return session;
  }

  async getActiveSession(glassId: string): Promise<MentraSession | undefined> {
    const [session] = await db
      .select()
      .from(mentraSessions)
      .where(
        and(
          eq(mentraSessions.glassId, glassId),
          eq(mentraSessions.isActive, true)
        )
      );
    return session;
  }

  async updateSessionActivity(sessionId: string): Promise<boolean> {
    const result = await db
      .update(mentraSessions)
      .set({ lastActivity: new Date() })
      .where(eq(mentraSessions.id, sessionId));
    return (result.rowCount ?? 0) > 0;
  }

  async deactivateSession(sessionId: string): Promise<boolean> {
    const result = await db
      .update(mentraSessions)
      .set({ isActive: false })
      .where(eq(mentraSessions.id, sessionId));
    return (result.rowCount ?? 0) > 0;
  }

  // Voice Commands operations
  async addVoiceCommand(
    commandData: InsertVoiceCommand
  ): Promise<VoiceCommand> {
    const [command] = await db
      .insert(voiceCommands)
      .values(commandData)
      .returning();
    return command;
  }

  async getUserVoiceCommands(
    userId: string,
    limit: number = 50
  ): Promise<VoiceCommand[]> {
    return db
      .select()
      .from(voiceCommands)
      .where(eq(voiceCommands.userId, userId))
      .orderBy(desc(voiceCommands.createdAt))
      .limit(limit);
  }

  async getVoiceCommand(commandId: string): Promise<VoiceCommand | undefined> {
    const [command] = await db
      .select()
      .from(voiceCommands)
      .where(eq(voiceCommands.id, commandId));
    return command;
  }

  async updateVoiceCommandStatus(
    commandId: string,
    updates: {
      executionStatus?: string;
      result?: Record<string, unknown>;
      errorMessage?: string;
      processedAt?: Date;
    }
  ): Promise<VoiceCommand> {
    const [updated] = await db
      .update(voiceCommands)
      .set(updates)
      .where(eq(voiceCommands.id, commandId))
      .returning();
    return updated;
  }

  // Glass Notifications operations
  async addGlassNotification(
    notificationData: InsertGlassNotification
  ): Promise<GlassNotification> {
    const [notification] = await db
      .insert(glassNotifications)
      .values(notificationData)
      .returning();
    return notification;
  }

  async getUserGlassNotifications(
    userId: string,
    limit: number = 50
  ): Promise<GlassNotification[]> {
    return db
      .select()
      .from(glassNotifications)
      .where(eq(glassNotifications.userId, userId))
      .orderBy(desc(glassNotifications.createdAt))
      .limit(limit);
  }

  async updateGlassNotificationStatus(
    notificationId: string,
    updates: {
      deliveryStatus?: string;
      mentraMessageId?: string;
      sentAt?: Date;
      acknowledgedAt?: Date;
    }
  ): Promise<GlassNotification> {
    const [updated] = await db
      .update(glassNotifications)
      .set(updates)
      .where(eq(glassNotifications.id, notificationId))
      .returning();
    return updated;
  }

  async getGlassNotification(
    notificationId: string
  ): Promise<GlassNotification | undefined> {
    const [notification] = await db
      .select()
      .from(glassNotifications)
      .where(eq(glassNotifications.id, notificationId));
    return notification;
  }
}

export const databaseStorage = new DatabaseStorage();
