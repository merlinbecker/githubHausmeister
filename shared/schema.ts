import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, json, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Users table for GitHub OAuth
export const users = pgTable("users", {
  id: varchar("id").primaryKey(), // GitHub user ID
  username: text("username").notNull(),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User repositories (user can select which repos to monitor)
export const userRepositories = pgTable("user_repositories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  webhookId: integer("webhook_id"), // GitHub webhook ID
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("user_repositories_user_id_idx").on(table.userId),
]);

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  repositoryId: varchar("repository_id").notNull().references(() => userRepositories.id, { onDelete: "cascade" }),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  labels: json("labels").$type<string[]>().default([]),
  issueNumber: integer("issue_number"),
  issueUrl: text("issue_url"),
  pullNumber: integer("pull_number"),
  headSha: text("head_sha"),
  status: text("status").notNull().default("queued"), // queued, in_progress, completed, failed
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("tasks_user_id_idx").on(table.userId),
  index("tasks_status_idx").on(table.status),
]);

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: varchar("id").primaryKey(),
  event: text("event").notNull(),
  processed: boolean("processed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// User-specific system state
export const userSystemState = pgTable("user_system_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  monthlyDone: integer("monthly_done").default(0),
  systemRunning: boolean("system_running").default(true),
  lastReset: timestamp("last_reset").defaultNow(),
}, (table) => [
  index("user_system_state_user_id_idx").on(table.userId),
]);

// Session storage table
export const sessions = pgTable("sessions", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire").notNull(),
}, (table) => [
  index("IDX_session_expire").on(table.expire),
]);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  repositories: many(userRepositories),
  tasks: many(tasks),
  systemState: many(userSystemState),
}));

export const userRepositoriesRelations = relations(userRepositories, ({ one, many }) => ({
  user: one(users, {
    fields: [userRepositories.userId],
    references: [users.id],
  }),
  tasks: many(tasks),
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

export const userSystemStateRelations = relations(userSystemState, ({ one }) => ({
  user: one(users, {
    fields: [userSystemState.userId],
    references: [users.id],
  }),
}));

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

export const insertUserRepositorySchema = createInsertSchema(userRepositories).pick({
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
});

export const insertWebhookDeliverySchema = createInsertSchema(webhookDeliveries).pick({
  id: true,
  event: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserRepository = typeof userRepositories.$inferSelect;
export type InsertUserRepository = z.infer<typeof insertUserRepositorySchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type UserSystemState = typeof userSystemState.$inferSelect;

// API Response types
export interface AppState {
  user?: User;
  monthlyDone: number;
  activeTask?: Task;
  queue: Task[];
  systemRunning: boolean;
  repositories: UserRepository[];
}

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

export interface TaskTemplate {
  type: string;
  title: string;
  body: string;
  labels: string[];
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

// Type alias for compatibility with storage.ts
export type SystemState = UserSystemState;
