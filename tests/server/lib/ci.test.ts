import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isPRGreen, getCIStatus } from '../../../server/lib/ci';

// Mock Octokit
const mockOctokit = {
  rest: {
    repos: {
      getCombinedStatusForRef: vi.fn(),
    },
    checks: {
      listForRef: vi.fn(),
    },
  },
};

vi.mock('octokit', () => ({
  Octokit: vi.fn(() => mockOctokit),
}));

describe('CI Module', () => {
  const mockToken = 'test-token';
  const mockOwner = 'test-owner';
  const mockRepo = 'test-repo';
  const mockSha = 'abc123def456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isPRGreen', () => {
    it('should return true when all statuses and checks pass', async () => {
      // Mock successful status and checks
      mockOctokit.rest.repos.getCombinedStatusForRef.mockResolvedValue({
        data: {
          state: 'success',
          statuses: [
            { state: 'success', context: 'ci/test' },
          ],
        },
      });

      mockOctokit.rest.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            { conclusion: 'success', name: 'lint' },
            { conclusion: 'neutral', name: 'optional-check' },
          ],
        },
      });

      const result = await isPRGreen(mockToken, mockOwner, mockRepo, mockSha);

      expect(result).toBe(true);
      expect(mockOctokit.rest.repos.getCombinedStatusForRef).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        ref: mockSha,
      });
      expect(mockOctokit.rest.checks.listForRef).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        ref: mockSha,
      });
    });

    it('should return true when no statuses exist but checks pass', async () => {
      mockOctokit.rest.repos.getCombinedStatusForRef.mockResolvedValue({
        data: {
          state: 'pending',
          statuses: [], // No statuses
        },
      });

      mockOctokit.rest.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            { conclusion: 'success', name: 'test' },
          ],
        },
      });

      const result = await isPRGreen(mockToken, mockOwner, mockRepo, mockSha);

      expect(result).toBe(true);
    });

    it('should return false when status check fails', async () => {
      mockOctokit.rest.repos.getCombinedStatusForRef.mockResolvedValue({
        data: {
          state: 'failure',
          statuses: [
            { state: 'failure', context: 'ci/test' },
          ],
        },
      });

      mockOctokit.rest.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            { conclusion: 'success', name: 'lint' },
          ],
        },
      });

      const result = await isPRGreen(mockToken, mockOwner, mockRepo, mockSha);

      expect(result).toBe(false);
    });

    it('should return false when check run fails', async () => {
      mockOctokit.rest.repos.getCombinedStatusForRef.mockResolvedValue({
        data: {
          state: 'success',
          statuses: [],
        },
      });

      mockOctokit.rest.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            { conclusion: 'failure', name: 'test' },
            { conclusion: 'success', name: 'lint' },
          ],
        },
      });

      const result = await isPRGreen(mockToken, mockOwner, mockRepo, mockSha);

      expect(result).toBe(false);
    });

    it('should return false on API error', async () => {
      mockOctokit.rest.repos.getCombinedStatusForRef.mockRejectedValue(
        new Error('API Error')
      );

      const result = await isPRGreen(mockToken, mockOwner, mockRepo, mockSha);

      expect(result).toBe(false);
    });

    it('should handle mixed check conclusions correctly', async () => {
      mockOctokit.rest.repos.getCombinedStatusForRef.mockResolvedValue({
        data: {
          state: 'success',
          statuses: [],
        },
      });

      mockOctokit.rest.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            { conclusion: 'success', name: 'test1' },
            { conclusion: 'neutral', name: 'optional' },
            { conclusion: 'skipped', name: 'test2' }, // skipped should fail
          ],
        },
      });

      const result = await isPRGreen(mockToken, mockOwner, mockRepo, mockSha);

      expect(result).toBe(false);
    });
  });

  describe('getCIStatus', () => {
    it('should return combined status and checks', async () => {
      const mockStatusData = {
        state: 'success',
        statuses: [
          { state: 'success', context: 'ci/test' },
        ],
      };

      const mockChecksData = {
        check_runs: [
          { conclusion: 'success', name: 'lint' },
        ],
      };

      mockOctokit.rest.repos.getCombinedStatusForRef.mockResolvedValue({
        data: mockStatusData,
      });

      mockOctokit.rest.checks.listForRef.mockResolvedValue({
        data: mockChecksData,
      });

      const result = await getCIStatus(mockToken, mockOwner, mockRepo, mockSha);

      expect(result).toEqual({
        combined: 'success',
        statuses: mockStatusData.statuses,
        checks: mockChecksData.check_runs,
      });
    });

    it('should return null on API error', async () => {
      mockOctokit.rest.repos.getCombinedStatusForRef.mockRejectedValue(
        new Error('Network error')
      );

      const result = await getCIStatus(mockToken, mockOwner, mockRepo, mockSha);

      expect(result).toBe(null);
    });

    it('should handle partial API failures', async () => {
      mockOctokit.rest.repos.getCombinedStatusForRef.mockResolvedValue({
        data: { state: 'pending', statuses: [] },
      });

      mockOctokit.rest.checks.listForRef.mockRejectedValue(
        new Error('Checks API error')
      );

      const result = await getCIStatus(mockToken, mockOwner, mockRepo, mockSha);

      expect(result).toBe(null);
    });
  });
});