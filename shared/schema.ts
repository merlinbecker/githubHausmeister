import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  json,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { relations } from 'drizzle-orm';

// Users table for GitHub OAuth
export const users = pgTable('users', {
  id: varchar('id').primaryKey(), // GitHub user ID
  username: text('username').notNull(),
  email: text('email'),
  avatarUrl: text('avatar_url'),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at'),
  webhookForwardUrl: text('webhook_forward_url'), // URL for webhook forwarding
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// User repositories (user can select which repos to monitor)
export const userRepositories = pgTable(
  'user_repositories',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    owner: text('owner').notNull(),
    repo: text('repo').notNull(),
    webhookId: integer('webhook_id'), // GitHub webhook ID
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('user_repositories_user_id_idx').on(table.userId)]
);

export const tasks = pgTable(
  'tasks',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    repositoryId: varchar('repository_id')
      .notNull()
      .references(() => userRepositories.id, { onDelete: 'cascade' }),
    owner: text('owner').notNull(),
    repo: text('repo').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    labels: json('labels').$type<string[]>().default([]),
    milestone: text('milestone'), // GitHub milestone title
    issueNumber: integer('issue_number'),
    issueUrl: text('issue_url'),
    pullNumber: integer('pull_number'),
    headSha: text('head_sha'),
    status: text('status').notNull().default('queued'), // queued, in_progress, completed, failed
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('tasks_user_id_idx').on(table.userId),
    index('tasks_status_idx').on(table.status),
  ]
);

// User-customizable task templates (per repository)
export const taskTemplates = pgTable(
  'task_templates',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    repositoryId: varchar('repository_id')
      .notNull()
      .references(() => userRepositories.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // tests, lint, types, security, docs
    title: text('title').notNull(),
    body: text('body').notNull(),
    labels: json('labels').$type<string[]>().default([]),
    milestone: text('milestone'), // GitHub milestone title
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('task_templates_user_id_idx').on(table.userId),
    index('task_templates_repository_id_idx').on(table.repositoryId),
    index('task_templates_type_idx').on(table.type),
  ]
);

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: varchar('id').primaryKey(),
  event: text('event').notNull(),
  processed: boolean('processed').default(false),
  repositoryOwner: text('repository_owner'),
  repositoryName: text('repository_name'),
  action: text('action'),
  actorLogin: text('actor_login'),
  payloadSummary: json('payload_summary'),
  createdAt: timestamp('created_at').defaultNow(),
});

// User-specific system state
export const userSystemState = pgTable(
  'user_system_state',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    monthlyDone: integer('monthly_done').default(0),
    systemRunning: boolean('system_running').default(true),
    lastReset: timestamp('last_reset').defaultNow(),
  },
  (table) => [index('user_system_state_user_id_idx').on(table.userId)]
);

// Session storage table
export const sessions = pgTable(
  'sessions',
  {
    sid: varchar('sid').primaryKey(),
    sess: json('sess').notNull(),
    expire: timestamp('expire').notNull(),
  },
  (table) => [index('IDX_session_expire').on(table.expire)]
);

// Push subscription table
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    p256dhKey: text('p256dh_key').notNull(),
    authKey: text('auth_key').notNull(),
    userAgent: text('user_agent'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    lastUsed: timestamp('last_used').defaultNow(),
  },
  (table) => [
    index('push_subscriptions_user_id_idx').on(table.userId),
    index('push_subscriptions_endpoint_idx').on(table.endpoint),
  ]
);

// Notification settings table
export const notificationSettings = pgTable(
  'notification_settings',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    taskStarted: boolean('task_started').default(true),
    taskCompleted: boolean('task_completed').default(true),
    taskFailed: boolean('task_failed').default(true),
    prCreated: boolean('pr_created').default(true),
    prMerged: boolean('pr_merged').default(true),
    ciStatusChanged: boolean('ci_status_changed').default(false),
    copilotAssigned: boolean('copilot_assigned').default(true),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [index('notification_settings_user_id_idx').on(table.userId)]
);

// mentraOS Smartglasses table
export const mentraGlasses = pgTable(
  'mentra_glasses',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    glassId: text('glass_id').notNull().unique(), // mentraOS glass identifier
    glassName: text('glass_name').notNull(), // User-friendly name
    deviceModel: text('device_model').default('evenrealities G1'),
    pairingToken: text('pairing_token'), // For secure pairing process
    isActive: boolean('is_active').default(true),
    lastSeen: timestamp('last_seen').defaultNow(),
    apiEndpoint: text('api_endpoint'), // mentraOS API endpoint for this glass
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('mentra_glasses_user_id_idx').on(table.userId),
    index('mentra_glasses_glass_id_idx').on(table.glassId),
  ]
);

// mentraOS Session Management
export const mentraSessions = pgTable(
  'mentra_sessions',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    glassId: varchar('glass_id')
      .notNull()
      .references(() => mentraGlasses.id, { onDelete: 'cascade' }),
    sessionToken: text('session_token').notNull(),
    isActive: boolean('is_active').default(true),
    startedAt: timestamp('started_at').defaultNow(),
    lastActivity: timestamp('last_activity').defaultNow(),
    expiresAt: timestamp('expires_at'), // Session expiration
  },
  (table) => [
    index('mentra_sessions_glass_id_idx').on(table.glassId),
    index('mentra_sessions_token_idx').on(table.sessionToken),
  ]
);

// Voice Commands Log
export const voiceCommands = pgTable(
  'voice_commands',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    glassId: varchar('glass_id')
      .notNull()
      .references(() => mentraGlasses.id, { onDelete: 'cascade' }),
    originalText: text('original_text').notNull(), // Raw voice-to-text
    normalizedCommand: text('normalized_command'), // Parsed/cleaned command
    commandType: text('command_type'), // e.g., 'task_create', 'status_check'
    commandParams: json('command_params').$type<Record<string, any>>(), // Command parameters
    executionStatus: text('execution_status').default('pending'), // pending, executed, failed
    result: json('result').$type<Record<string, any>>(), // Command execution result
    errorMessage: text('error_message'),
    processedAt: timestamp('processed_at'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('voice_commands_user_id_idx').on(table.userId),
    index('voice_commands_glass_id_idx').on(table.glassId),
    index('voice_commands_status_idx').on(table.executionStatus),
  ]
);

// Glass Notifications Log
export const glassNotifications = pgTable(
  'glass_notifications',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    glassId: varchar('glass_id')
      .notNull()
      .references(() => mentraGlasses.id, { onDelete: 'cascade' }),
    notificationType: text('notification_type').notNull(), // text, image, combined
    title: text('title'),
    message: text('message'),
    imageUrl: text('image_url'), // For image notifications
    imageData: text('image_data'), // Base64 encoded image data
    deliveryStatus: text('delivery_status').default('pending'), // pending, sent, delivered, failed
    mentraMessageId: text('mentra_message_id'), // mentraOS message ID
    sentAt: timestamp('sent_at'),
    acknowledgedAt: timestamp('acknowledged_at'), // When user acknowledged on glass
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('glass_notifications_user_id_idx').on(table.userId),
    index('glass_notifications_glass_id_idx').on(table.glassId),
    index('glass_notifications_status_idx').on(table.deliveryStatus),
  ]
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  repositories: many(userRepositories),
  tasks: many(tasks),
  taskTemplates: many(taskTemplates),
  systemState: many(userSystemState),
  pushSubscriptions: many(pushSubscriptions),
  notificationSettings: many(notificationSettings),
  mentraGlasses: many(mentraGlasses),
  voiceCommands: many(voiceCommands),
  glassNotifications: many(glassNotifications),
}));

export const userRepositoriesRelations = relations(
  userRepositories,
  ({ one, many }) => ({
    user: one(users, {
      fields: [userRepositories.userId],
      references: [users.id],
    }),
    tasks: many(tasks),
    taskTemplates: many(taskTemplates),
  })
);

export const tasksRelations = relations(tasks, ({ one }) => ({
  user: one(users, {
    fields: [tasks.userId],
    references: [users.id],
  }),
  repository: one(userRepositories, {
    fields: [tasks.repositoryId],
    references: [userRepositories.id],
  }),
}));

export const taskTemplatesRelations = relations(taskTemplates, ({ one }) => ({
  user: one(users, {
    fields: [taskTemplates.userId],
    references: [users.id],
  }),
  repository: one(userRepositories, {
    fields: [taskTemplates.repositoryId],
    references: [userRepositories.id],
  }),
}));

export const userSystemStateRelations = relations(
  userSystemState,
  ({ one }) => ({
    user: one(users, {
      fields: [userSystemState.userId],
      references: [users.id],
    }),
  })
);

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [pushSubscriptions.userId],
      references: [users.id],
    }),
  })
);

export const notificationSettingsRelations = relations(
  notificationSettings,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationSettings.userId],
      references: [users.id],
    }),
  })
);

// mentraOS Relations
export const mentraGlassesRelations = relations(
  mentraGlasses,
  ({ one, many }) => ({
    user: one(users, {
      fields: [mentraGlasses.userId],
      references: [users.id],
    }),
    sessions: many(mentraSessions),
    voiceCommands: many(voiceCommands),
    notifications: many(glassNotifications),
  })
);

export const mentraSessionsRelations = relations(mentraSessions, ({ one }) => ({
  glass: one(mentraGlasses, {
    fields: [mentraSessions.glassId],
    references: [mentraGlasses.id],
  }),
}));

export const voiceCommandsRelations = relations(voiceCommands, ({ one }) => ({
  user: one(users, {
    fields: [voiceCommands.userId],
    references: [users.id],
  }),
  glass: one(mentraGlasses, {
    fields: [voiceCommands.glassId],
    references: [mentraGlasses.id],
  }),
}));

export const glassNotificationsRelations = relations(
  glassNotifications,
  ({ one }) => ({
    user: one(users, {
      fields: [glassNotifications.userId],
      references: [users.id],
    }),
    glass: one(mentraGlasses, {
      fields: [glassNotifications.glassId],
      references: [mentraGlasses.id],
    }),
  })
);

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  id: true,
  username: true,
  email: true,
  avatarUrl: true,
  accessToken: true,
  refreshToken: true,
  tokenExpiresAt: true,
  webhookForwardUrl: true,
});

export const insertUserRepositorySchema = createInsertSchema(
  userRepositories
).pick({
  userId: true,
  owner: true,
  repo: true,
  webhookId: true,
  isActive: true,
});

export const insertTaskSchema = createInsertSchema(tasks).pick({
  userId: true,
  repositoryId: true,
  owner: true,
  repo: true,
  title: true,
  body: true,
  labels: true,
  milestone: true,
});

export const insertWebhookDeliverySchema = createInsertSchema(
  webhookDeliveries
).pick({
  id: true,
  event: true,
  processed: true,
  repositoryOwner: true,
  repositoryName: true,
  action: true,
  actorLogin: true,
  payloadSummary: true,
});

export const insertPushSubscriptionSchema = createInsertSchema(
  pushSubscriptions
).pick({
  userId: true,
  endpoint: true,
  p256dhKey: true,
  authKey: true,
  userAgent: true,
});

export const insertNotificationSettingsSchema = createInsertSchema(
  notificationSettings
).pick({
  userId: true,
  taskStarted: true,
  taskCompleted: true,
  taskFailed: true,
  prCreated: true,
  prMerged: true,
  ciStatusChanged: true,
  copilotAssigned: true,
});

export const insertTaskTemplateSchema = createInsertSchema(taskTemplates).pick({
  userId: true,
  repositoryId: true,
  type: true,
  title: true,
  body: true,
  labels: true,
  milestone: true,
  isActive: true,
});

// mentraOS Insert Schemas
export const insertMentraGlassSchema = createInsertSchema(mentraGlasses).pick({
  userId: true,
  glassId: true,
  glassName: true,
  deviceModel: true,
  pairingToken: true,
  isActive: true,
  apiEndpoint: true,
});

export const insertMentraSessionSchema = createInsertSchema(
  mentraSessions
).pick({
  glassId: true,
  sessionToken: true,
  isActive: true,
  expiresAt: true,
});

export const insertVoiceCommandSchema = createInsertSchema(voiceCommands).pick({
  userId: true,
  glassId: true,
  originalText: true,
  normalizedCommand: true,
  commandType: true,
  commandParams: true,
  executionStatus: true,
  result: true,
  errorMessage: true,
});

export const insertGlassNotificationSchema = createInsertSchema(
  glassNotifications
).pick({
  userId: true,
  glassId: true,
  notificationType: true,
  title: true,
  message: true,
  imageUrl: true,
  imageData: true,
  deliveryStatus: true,
  mentraMessageId: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserRepository = typeof userRepositories.$inferSelect;
export type InsertUserRepository = z.infer<typeof insertUserRepositorySchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;
export type TaskTemplate = typeof taskTemplates.$inferSelect;
export type InsertTaskTemplate = z.infer<typeof insertTaskTemplateSchema>;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type InsertWebhookDelivery = z.infer<typeof insertWebhookDeliverySchema>;
export type UserSystemState = typeof userSystemState.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = z.infer<
  typeof insertPushSubscriptionSchema
>;
export type NotificationSettings = typeof notificationSettings.$inferSelect;
export type InsertNotificationSettings = z.infer<
  typeof insertNotificationSettingsSchema
>;

// mentraOS Types
export type MentraGlass = typeof mentraGlasses.$inferSelect;
export type InsertMentraGlass = z.infer<typeof insertMentraGlassSchema>;
export type MentraSession = typeof mentraSessions.$inferSelect;
export type InsertMentraSession = z.infer<typeof insertMentraSessionSchema>;
export type VoiceCommand = typeof voiceCommands.$inferSelect;
export type InsertVoiceCommand = z.infer<typeof insertVoiceCommandSchema>;
export type GlassNotification = typeof glassNotifications.$inferSelect;
export type InsertGlassNotification = z.infer<
  typeof insertGlassNotificationSchema
>;

// API Response types
export interface AppState {
  user?: User;
  monthlyDone: number;
  activeTask?: Task;
  queue: Task[];
  systemRunning: boolean;
  repositories: UserRepository[];
}

export interface TaskStats {
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  inProgressTasks: number;
  successRate: number;
  avgTimeHours: number;
  maxMonthlyTasks: number;
}

export interface WebhookPayloadSummary {
  action?: string;
  actorLogin?: string;
  pullRequestNumber?: number;
  issueNumber?: number;
  workflowName?: string;
  checkSuiteName?: string;
  checkRunName?: string;
  conclusion?: string;
  message?: string;
  timestamp?: string;
}

// For backward compatibility and storage.ts
export type SystemState = UserSystemState;

export interface GitHubUser {
  id: string;
  login: string;
  email?: string;
  avatar_url: string;
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

export interface LegacyTaskTemplate {
  type: string;
  title: string;
  body: string;
  labels: string[];
  milestone?: string;
}

export interface WebhookEvent {
  delivery: string;
  event: string;
  payload: any;
}

export interface Stats {
  maxMonthlyTasks: number;
  successRate: number;
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  avgTimeHours: number;
}

export interface WebhookConfig {
  url: string;
  status: string;
  events: string[];
  token?: string;
  copilotAgent?: string;
  monitoredRepos?: number;
}
