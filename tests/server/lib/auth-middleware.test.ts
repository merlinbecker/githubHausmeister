import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireAuth, AuthenticatedRequest } from '../../../server/lib/auth-middleware';
import { Request, Response, NextFunction } from 'express';

// Mock database storage
vi.mock('../../../server/lib/database-storage', () => ({
  databaseStorage: {
    getUserById: vi.fn(),
  },
}));

describe('Auth Middleware', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {
      session: {},
    };
    mockRes = {
      status: vi.fn(() => mockRes as Response),
      json: vi.fn(),
    };
    mockNext = vi.fn();
  });

  describe('requireAuth', () => {
    it('should return 401 when no userId in session', async () => {
      mockReq.session = {};

      await requireAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when user not found in database', async () => {
      mockReq.session = { userId: 'user-123' };

      const { databaseStorage } = await import('../../../server/lib/database-storage');
      vi.mocked(databaseStorage.getUserById).mockResolvedValue(undefined);

      await requireAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'User not found' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should set user and call next when authentication succeeds', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        avatarUrl: 'https://avatar.com/test',
        accessToken: 'token-123',
        refreshToken: null,
        tokenExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockReq.session = { userId: 'user-123' };

      const { databaseStorage } = await import('../../../server/lib/database-storage');
      vi.mocked(databaseStorage.getUserById).mockResolvedValue(mockUser);

      await requireAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toEqual({
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        avatarUrl: 'https://avatar.com/test',
        accessToken: 'token-123',
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should handle user without email/avatarUrl', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: null,
        avatarUrl: null,
        accessToken: 'token-123',
        refreshToken: null,
        tokenExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockReq.session = { userId: 'user-123' };

      const { databaseStorage } = await import('../../../server/lib/database-storage');
      vi.mocked(databaseStorage.getUserById).mockResolvedValue(mockUser);

      await requireAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toEqual({
        id: 'user-123',
        username: 'testuser',
        email: undefined,
        avatarUrl: undefined,
        accessToken: 'token-123',
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockReq.session = { userId: 'user-123' };

      const { databaseStorage } = await import('../../../server/lib/database-storage');
      vi.mocked(databaseStorage.getUserById).mockRejectedValue(new Error('Database error'));

      await requireAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication error' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});