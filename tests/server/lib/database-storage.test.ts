import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseStorage } from '../../../server/lib/database-storage';
import type { InsertUser, InsertUserRepository, InsertTask } from '@shared/schema';

// Mock the database
vi.mock('../../../server/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock data
const mockUser = {
  id: 'test-user-id',
  username: 'testuser',
  email: 'test@example.com',
  avatarUrl: 'https://avatar.com/test',
  accessToken: 'test-token',
  refreshToken: 'refresh-token',
  tokenExpiresAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRepository = {
  id: 'repo-id',
  userId: 'test-user-id',
  owner: 'test-owner',
  repo: 'test-repo',
  fullName: 'test-owner/test-repo',
  webhookId: null,
  createdAt: new Date(),
};

const mockTask = {
  id: 'task-id',
  userId: 'test-user-id',
  repositoryId: 'repo-id',
  type: 'tests',
  status: 'queued',
  title: 'Test Task',
  body: 'Test body',
  issueNumber: null,
  pullRequestNumber: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  completedAt: null,
  errorMessage: null,
};

describe('DatabaseStorage', () => {
  let storage: DatabaseStorage;

  beforeEach(async () => {
    vi.clearAllMocks();
    storage = new DatabaseStorage();

    // Get the mocked db
    const { db } = await import('../../../server/db');
    const mockDb = vi.mocked(db);

    // Set up basic mocks for database operations
    mockDb.select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([mockUser])),
        orderBy: vi.fn(() => Promise.resolve([mockRepository])),
      })),
    } as any);

    mockDb.insert.mockReturnValue({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([mockUser])),
        })),
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([mockRepository])),
        })),
        returning: vi.fn(() => Promise.resolve([mockTask])),
      })),
    } as any);

    mockDb.update.mockReturnValue({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([mockUser])),
        })),
      })),
    } as any);
  });

  describe('User operations', () => {
    it('should get user by ID', async () => {
      const { db } = await import('../../../server/db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([mockUser])),
        })),
      } as any);

      const user = await storage.getUserById('test-user-id');
      expect(user).toEqual(mockUser);
    });

    it('should create or update user', async () => {
      const userData: InsertUser = {
        id: 'new-user',
        username: 'newuser',
        email: 'new@example.com',
        avatarUrl: 'https://avatar.com/new',
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
        tokenExpiresAt: new Date(),
      };

      const { db } = await import('../../../server/db');
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn(() => ({
          onConflictDoUpdate: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([mockUser])),
          })),
        })),
      } as any);

      const user = await storage.createOrUpdateUser(userData);
      expect(user).toEqual(mockUser);
    });

    it('should update user token', async () => {
      const { db } = await import('../../../server/db');
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve()),
        })),
      } as any);

      await storage.updateUserToken('test-user-id', 'new-token', 'new-refresh');
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('Task operations', () => {
    it('should create task', async () => {
      const taskData: InsertTask = {
        userId: 'test-user-id',
        repositoryId: 'repo-id',
        type: 'tests',
        status: 'queued',
        title: 'New Task',
        body: 'Task description',
      };

      const { db } = await import('../../../server/db');
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([mockTask])),
        })),
      } as any);

      const task = await storage.createTask(taskData);
      expect(task).toEqual(mockTask);
    });
  });

  describe('Webhook operations', () => {
    it('should record webhook delivery', async () => {
      const deliveryData = {
        id: 'delivery-123',
        event: 'push',
        processed: true,
        repositoryOwner: 'test-owner',
        repositoryName: 'test-repo',
        action: 'opened',
        actorLogin: 'testuser',
        payloadSummary: { test: 'data' },
      };

      const { db } = await import('../../../server/db');
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([deliveryData])),
          })),
        })),
      } as any);

      const result = await storage.recordWebhookDelivery(deliveryData);
      expect(result).toEqual(deliveryData);
    });

    it('should check if delivery is processed', async () => {
      const { db } = await import('../../../server/db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([{ processed: true }])),
        })),
      } as any);

      const result = await storage.isDeliveryProcessed('delivery-123');
      expect(result).toBe(true);
    });
  });

  describe('Push subscription operations', () => {
    it('should add push subscription', async () => {
      const subscription = {
        userId: 'test-user-id',
        endpoint: 'https://fcm.googleapis.com/test',
        keys: JSON.stringify({
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key',
        }),
        isActive: true,
      };

      // Mock finding existing subscription (none found)
      const { db } = await import('../../../server/db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([])),
        })),
      } as any);

      // Mock inserting new subscription
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([subscription])),
        })),
      } as any);

      const result = await storage.addPushSubscription(subscription);
      expect(result).toEqual(subscription);
    });

    it('should get user push subscriptions', async () => {
      const mockSubscriptions = [
        {
          id: 'sub-1',
          userId: 'test-user-id',
          endpoint: 'https://fcm.googleapis.com/test',
          keys: '{"p256dh":"test-key","auth":"test-auth"}',
          isActive: true,
          createdAt: new Date(),
        },
      ];

      const { db } = await import('../../../server/db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve(mockSubscriptions)),
        })),
      } as any);

      const subscriptions = await storage.getUserPushSubscriptions('test-user-id');
      expect(subscriptions).toEqual(mockSubscriptions);
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      const { db } = await import('../../../server/db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.reject(new Error('Database error'))),
        })),
      } as any);

      await expect(storage.getUserById('test-user-id')).rejects.toThrow('Database error');
    });
  });
});