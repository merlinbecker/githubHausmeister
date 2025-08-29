import { type Task, type InsertTask, type WebhookDelivery, type SystemState, type AppState } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Task management
  createTask(task: InsertTask): Promise<Task>;
  getTask(id: string): Promise<Task | undefined>;
  updateTask(id: string, updates: Partial<Task>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;
  getQueuedTasks(): Promise<Task[]>;
  getActiveTask(): Promise<Task | undefined>;
  
  // Webhook deliveries
  recordWebhookDelivery(delivery: WebhookDelivery): Promise<WebhookDelivery>;
  isDeliveryProcessed(deliveryId: string): Promise<boolean>;
  
  // System state
  getSystemState(): Promise<SystemState>;
  updateSystemState(updates: Partial<SystemState>): Promise<SystemState>;
  
  // Application state
  getAppState(): Promise<AppState>;
}

export class MemStorage implements IStorage {
  private tasks: Map<string, Task>;
  private webhookDeliveries: Map<string, WebhookDelivery>;
  private systemState: SystemState;

  constructor() {
    this.tasks = new Map();
    this.webhookDeliveries = new Map();
    this.systemState = {
      id: "singleton",
      userId: "system", // Default system user
      monthlyDone: 0,
      systemRunning: true,
      lastReset: new Date(),
    };
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const id = randomUUID();
    const task: Task = {
      ...insertTask,
      id,
      status: "queued",
      issueNumber: null,
      issueUrl: null,
      pullNumber: null,
      headSha: null,
      startedAt: null,
      completedAt: null,
      failureReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      // Ensure labels is a proper array
      labels: insertTask.labels ? (insertTask.labels as string[]) : null,
    };
    this.tasks.set(id, task);
    return task;
  }

  async getTask(id: string): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | undefined> {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    
    const updatedTask = { ...task, ...updates, updatedAt: new Date() };
    this.tasks.set(id, updatedTask);
    return updatedTask;
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.tasks.delete(id);
  }

  async getQueuedTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values())
      .filter(task => task.status === "queued")
      .sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0));
  }

  async getActiveTask(): Promise<Task | undefined> {
    return Array.from(this.tasks.values()).find(task => task.status === "active");
  }

  async recordWebhookDelivery(delivery: WebhookDelivery): Promise<WebhookDelivery> {
    this.webhookDeliveries.set(delivery.id, delivery);
    return delivery;
  }

  async isDeliveryProcessed(deliveryId: string): Promise<boolean> {
    const delivery = this.webhookDeliveries.get(deliveryId);
    return delivery?.processed || false;
  }

  async getSystemState(): Promise<SystemState> {
    return this.systemState;
  }

  async updateSystemState(updates: Partial<SystemState>): Promise<SystemState> {
    this.systemState = { ...this.systemState, ...updates };
    return this.systemState;
  }

  async getAppState(): Promise<AppState> {
    const activeTask = await this.getActiveTask();
    const queue = await this.getQueuedTasks();
    
    return {
      monthlyDone: this.systemState.monthlyDone || 0,
      activeTask,
      queue,
      systemRunning: this.systemState.systemRunning !== false,
      repositories: [], // TODO: Implement repository storage if needed
    };
  }
}

export const storage = new MemStorage();
