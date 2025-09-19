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
  // webhookForwardUrl removed - moved to repository-specific setting
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
    // New columns for repository-centric workflow
    monthlyAssignmentLimit: integer('monthly_assignment_limit').default(10),
    isCurrentActive: boolean('is_current_active').default(false),
    monthlyAssignmentsUsed: integer('monthly_assignments_used').default(0),
    lastMonthlyReset: timestamp('last_monthly_reset').defaultNow(),
    webhookForwardUrl: text('webhook_forward_url'), // Repository-specific webhook forwarding URL
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('user_repositories_user_id_idx').on(table.userId),
    index('user_repositories_current_active_idx').on(table.userId, table.isCurrentActive),
  ]
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
    // Remove monthlyDone - moved to per-repository tracking
    systemRunning: boolean('system_running').default(true),
    lastReset: timestamp('last_reset').defaultNow(),
    // New columns for repository-centric workflow
    currentRepositoryId: varchar('current_repository_id')
      .references(() => userRepositories.id, { onDelete: 'set null' }),
    isPaused: boolean('is_paused').default(false),
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

// Issue priorities for drag-and-drop ordering (Phase 3 of Issue Workflow Plan)
export const issuePriorities = pgTable(
  'issue_priorities',
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
    issueNumber: integer('issue_number').notNull(),
    priority: integer('priority').notNull().default(0), // Lower number = higher priority
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('issue_priorities_user_id_idx').on(table.userId),
    index('issue_priorities_repository_id_idx').on(table.repositoryId),
    index('issue_priorities_priority_idx').on(table.priority),
    // Unique constraint to prevent duplicate priorities for same user+repo+issue
    index('issue_priorities_unique_idx').on(table.userId, table.repositoryId, table.issueNumber),
  ]
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  repositories: many(userRepositories),
  tasks: many(tasks),
  taskTemplates: many(taskTemplates),
  systemState: many(userSystemState),
  issuePriorities: many(issuePriorities),
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
    issuePriorities: many(issuePriorities),
  })
);

export const issuePrioritiesRelations = relations(issuePriorities, ({ one }) => ({
  user: one(users, {
    fields: [issuePriorities.userId],
    references: [users.id],
  }),
  repository: one(userRepositories, {
    fields: [issuePriorities.repositoryId],
    references: [userRepositories.id],
  }),
}));

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
    currentRepository: one(userRepositories, {
      fields: [userSystemState.currentRepositoryId],
      references: [userRepositories.id],
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
});

export const insertUserRepositorySchema = createInsertSchema(
  userRepositories
).pick({
  userId: true,
  owner: true,
  repo: true,
  webhookId: true,
  isActive: true,
  monthlyAssignmentLimit: true,
  isCurrentActive: true,
  monthlyAssignmentsUsed: true,
  lastMonthlyReset: true,
  webhookForwardUrl: true,
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

export const insertIssuePrioritySchema = createInsertSchema(issuePriorities).pick({
  userId: true,
  repositoryId: true,
  issueNumber: true,
  priority: true,
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
export type IssuePriority = typeof issuePriorities.$inferSelect;
export type InsertIssuePriority = z.infer<typeof insertIssuePrioritySchema>;

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
