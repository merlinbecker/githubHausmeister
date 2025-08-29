import { describe, it, expect } from 'vitest';
import {
  insertUserSchema,
  insertUserRepositorySchema,
  insertTaskSchema,
} from '../../shared/schema';

describe('Schema Validation', () => {
  describe('insertUserSchema', () => {
    it('should validate a valid user object', () => {
      const validUser = {
        id: '12345',
        username: 'testuser',
        email: 'test@example.com',
        avatarUrl: 'https://example.com/avatar.jpg',
        accessToken: 'token123',
        refreshToken: 'refresh123',
        tokenExpiresAt: new Date('2024-12-31T23:59:59Z'),
      };

      const result = insertUserSchema.parse(validUser);
      expect(result).toEqual(validUser);
    });

    it('should require id and username', () => {
      const invalidUser = {
        email: 'test@example.com',
      };

      expect(() => insertUserSchema.parse(invalidUser)).toThrow();
    });
  });

  describe('insertUserRepositorySchema', () => {
    it('should validate a valid repository object', () => {
      const validRepo = {
        userId: 'user123',
        owner: 'testowner',
        repo: 'testrepo',
        webhookId: 12345,
        isActive: true,
      };

      const result = insertUserRepositorySchema.parse(validRepo);
      expect(result).toEqual(validRepo);
    });

    it('should require userId, owner, and repo', () => {
      const invalidRepo = {
        webhookId: 12345,
      };

      expect(() => insertUserRepositorySchema.parse(invalidRepo)).toThrow();
    });
  });

  describe('insertTaskSchema', () => {
    it('should validate a valid task object', () => {
      const validTask = {
        userId: 'user123',
        repositoryId: 'repo123',
        owner: 'testowner',
        repo: 'testrepo',
        title: 'Test task',
        body: 'Task description',
        labels: ['bug', 'feature'],
      };

      const result = insertTaskSchema.parse(validTask);
      expect(result).toEqual(validTask);
    });

    it('should work without optional labels', () => {
      const taskWithoutLabels = {
        userId: 'user123',
        repositoryId: 'repo123',
        owner: 'testowner',
        repo: 'testrepo',
        title: 'Test task',
        body: 'Task description',
      };

      const result = insertTaskSchema.parse(taskWithoutLabels);
      expect(result).toEqual(taskWithoutLabels);
    });

    it('should require all mandatory fields', () => {
      const invalidTask = {
        title: 'Test task',
      };

      expect(() => insertTaskSchema.parse(invalidTask)).toThrow();
    });
  });
});
