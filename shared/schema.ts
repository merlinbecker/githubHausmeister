import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, json, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  labels: json("labels").$type<string[]>().default([]),
  issueNumber: integer("issue_number"),
  pullNumber: integer("pull_number"),
  headSha: text("head_sha"),
  status: text("status").notNull().default("queued"), // queued, active, completed, failed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: varchar("id").primaryKey(),
  event: text("event").notNull(),
  processed: boolean("processed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const systemState = pgTable("system_state", {
  id: varchar("id").primaryKey().default("singleton"),
  monthlyDone: integer("monthly_done").default(0),
  systemRunning: boolean("system_running").default(true),
  lastReset: timestamp("last_reset").defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasks).pick({
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

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type SystemState = typeof systemState.$inferSelect;

// API Response types
export interface AppState {
  monthlyDone: number;
  activeTask?: Task;
  queue: Task[];
  systemRunning: boolean;
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
