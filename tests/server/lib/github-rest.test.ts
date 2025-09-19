import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Octokit } from 'octokit';
import {
  createIssue,
  getIssue,
  createReviewApprove,
  mergePullRequest,
  markPRReadyForReview,
  commentOnPR,
  getPullRequest,
  listPRsForIssue,
  registerWebhook,
  deleteWebhook,
} from '../../../server/lib/github-rest';

// Mock Octokit
vi.mock('octokit', () => ({
  Octokit: vi.fn(),
}));

describe('GitHub REST API Functions', () => {
  const mockOctokit = {
    rest: {
      issues: {
        create: vi.fn(),
        get: vi.fn(),
        createComment: vi.fn(),
        list: vi.fn(),
      },
      pulls: {
        createReview: vi.fn(),
        merge: vi.fn(),
        update: vi.fn(),
        get: vi.fn(),
        list: vi.fn(),
      },
      search: {
        issuesAndPullRequests: vi.fn(),
      },
      repos: {
        createWebhook: vi.fn(),
        deleteWebhook: vi.fn(),
        listWebhooks: vi.fn(),
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Octokit).mockReturnValue(mockOctokit as any);
  });

  describe('createIssue', () => {
    it('should create issue with correct parameters', async () => {
      const mockIssueData = {
        id: 123,
        number: 456,
        title: 'Test Issue',
        body: 'Test body',
        labels: [{ name: 'bug' }],
      };

      mockOctokit.rest.issues.create.mockResolvedValue({ data: mockIssueData });

      const result = await createIssue(
        'test-token',
        'test-owner',
        'test-repo',
        'Test Issue',
        'Test body',
        ['bug', 'priority']
      );

      expect(Octokit).toHaveBeenCalledWith({ auth: 'test-token' });
      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test Issue',
        body: 'Test body',
        labels: ['bug', 'priority'],
      });
      expect(result).toEqual(mockIssueData);
    });

    it('should create issue with default empty labels', async () => {
      const mockIssueData = { id: 123, number: 456 };
      mockOctokit.rest.issues.create.mockResolvedValue({ data: mockIssueData });

      await createIssue(
        'test-token',
        'test-owner',
        'test-repo',
        'Test',
        'Body'
      );

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test',
        body: 'Body',
        labels: [],
      });
    });
  });

  describe('getIssue', () => {
    it('should get issue with correct parameters', async () => {
      const mockIssueData = { id: 123, number: 456, title: 'Test Issue' };
      mockOctokit.rest.issues.get.mockResolvedValue({ data: mockIssueData });

      const result = await getIssue(
        'test-token',
        'test-owner',
        'test-repo',
        456
      );

      expect(Octokit).toHaveBeenCalledWith({ auth: 'test-token' });
      expect(mockOctokit.rest.issues.get).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 456,
      });
      expect(result).toEqual(mockIssueData);
    });
  });

  describe('createReviewApprove', () => {
    it('should create approval review with default message', async () => {
      const mockReviewData = { id: 789 };
      mockOctokit.rest.pulls.createReview.mockResolvedValue({
        data: mockReviewData,
      });

      const result = await createReviewApprove(
        'test-token',
        'test-owner',
        'test-repo',
        123
      );

      expect(Octokit).toHaveBeenCalledWith({ auth: 'test-token' });
      expect(mockOctokit.rest.pulls.createReview).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 123,
        event: 'APPROVE',
        body: 'LGTM (auto)',
      });
      expect(result).toEqual({ data: mockReviewData });
    });

    it('should create approval review with custom message', async () => {
      const customMessage = 'Custom approval message';
      mockOctokit.rest.pulls.createReview.mockResolvedValue({
        data: { id: 789 },
      });

      await createReviewApprove(
        'test-token',
        'test-owner',
        'test-repo',
        123,
        customMessage
      );

      expect(mockOctokit.rest.pulls.createReview).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 123,
        event: 'APPROVE',
        body: customMessage,
      });
    });
  });

  describe('mergePullRequest', () => {
    it('should merge pull request with default squash method', async () => {
      const mockMergeData = { sha: 'abc123', merged: true };
      mockOctokit.rest.pulls.merge.mockResolvedValue({ data: mockMergeData });

      const result = await mergePullRequest(
        'test-token',
        'test-owner',
        'test-repo',
        123
      );

      expect(Octokit).toHaveBeenCalledWith({ auth: 'test-token' });
      expect(mockOctokit.rest.pulls.merge).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 123,
        merge_method: 'squash',
      });
      expect(result).toEqual({ data: mockMergeData });
    });

    it('should merge pull request with custom method', async () => {
      mockOctokit.rest.pulls.merge.mockResolvedValue({
        data: { merged: true },
      });

      await mergePullRequest(
        'test-token',
        'test-owner',
        'test-repo',
        123,
        'rebase'
      );

      expect(mockOctokit.rest.pulls.merge).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 123,
        merge_method: 'rebase',
      });
    });
  });

  describe('markPRReadyForReview', () => {
    it('should mark PR as ready for review', async () => {
      const mockUpdateData = { id: 123, draft: false };
      mockOctokit.rest.pulls.update.mockResolvedValue({ data: mockUpdateData });

      const result = await markPRReadyForReview(
        'test-token',
        'test-owner',
        'test-repo',
        123
      );

      expect(Octokit).toHaveBeenCalledWith({ auth: 'test-token' });
      expect(mockOctokit.rest.pulls.update).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 123,
        draft: false,
      });
      expect(result).toEqual({ data: mockUpdateData });
    });
  });

  describe('commentOnPR', () => {
    it('should create comment on pull request', async () => {
      const mockCommentData = { id: 789, body: 'Test comment' };
      mockOctokit.rest.issues.createComment.mockResolvedValue({ data: mockCommentData });

      const result = await commentOnPR(
        'test-token',
        'test-owner',
        'test-repo',
        123,
        'Test comment'
      );

      expect(Octokit).toHaveBeenCalledWith({ auth: 'test-token' });
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        body: 'Test comment',
      });
      expect(result).toEqual({ data: mockCommentData });
    });
  });

  describe('getPullRequest', () => {
    it('should get pull request data', async () => {
      const mockPRData = { id: 123, number: 456, title: 'Test PR' };
      mockOctokit.rest.pulls.get.mockResolvedValue({ data: mockPRData });

      const result = await getPullRequest(
        'test-token',
        'test-owner',
        'test-repo',
        456
      );

      expect(Octokit).toHaveBeenCalledWith({ auth: 'test-token' });
      expect(mockOctokit.rest.pulls.get).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 456,
      });
      expect(result).toEqual(mockPRData);
    });
  });

  describe('listPRsForIssue', () => {
    it('should find PRs referencing an issue via search API', async () => {
      const mockSearchData = {
        items: [
          { id: 1, number: 10, title: 'Fix #123', body: 'Fixes issue #123' },
          { id: 2, number: 11, title: 'Update docs', body: 'Related to #123' },
        ],
      };
      mockOctokit.rest.search.issuesAndPullRequests.mockResolvedValue({ data: mockSearchData });

      const result = await listPRsForIssue(
        'test-token',
        'test-owner',
        'test-repo',
        123
      );

      expect(mockOctokit.rest.search.issuesAndPullRequests).toHaveBeenCalledWith({
        q: 'repo:test-owner/test-repo type:pr is:open "#123"',
        per_page: 100,
      });
      expect(result).toEqual(mockSearchData.items);
    });

    it('should fallback to pulls.list when search API fails', async () => {
      mockOctokit.rest.search.issuesAndPullRequests.mockRejectedValue(
        new Error('Search API error')
      );

      const mockPullsData = [
        { id: 1, number: 10, title: 'Fix #123', body: 'Fixes issue #123' },
        { id: 2, number: 11, title: 'Other PR', body: 'No reference' },
      ];
      mockOctokit.rest.pulls.list.mockResolvedValue({ data: mockPullsData });

      const result = await listPRsForIssue(
        'test-token',
        'test-owner',
        'test-repo',
        123
      );

      expect(mockOctokit.rest.pulls.list).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'open',
        per_page: 100,
      });
      // Should only return PRs that reference the issue
      expect(result).toEqual([mockPullsData[0]]);
    });

    it('should return empty array when both APIs fail', async () => {
      mockOctokit.rest.search.issuesAndPullRequests.mockRejectedValue(
        new Error('Search API error')
      );
      mockOctokit.rest.pulls.list.mockRejectedValue(
        new Error('Pulls API error')
      );

      const result = await listPRsForIssue(
        'test-token',
        'test-owner',
        'test-repo',
        123
      );

      expect(result).toEqual([]);
    });
  });

  describe('registerWebhook', () => {
    it('should create webhook successfully', async () => {
      const mockWebhookData = { id: 123, url: 'https://example.com/webhook' };
      mockOctokit.rest.repos.createWebhook.mockResolvedValue({ data: mockWebhookData });

      const result = await registerWebhook(
        'test-token',
        'test-owner',
        'test-repo',
        'https://example.com/webhook',
        'secret123'
      );

      expect(mockOctokit.rest.repos.createWebhook).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        config: {
          url: 'https://example.com/webhook',
          content_type: 'json',
          secret: 'secret123',
        },
        events: ['issues', 'pull_request', 'workflow_run', 'check_suite', 'check_run'],
      });
      expect(result).toEqual(mockWebhookData);
    });

    it('should return existing webhook when creation fails with 422', async () => {
      const error = new Error('Webhook already exists');
      (error as any).status = 422;
      mockOctokit.rest.repos.createWebhook.mockRejectedValue(error);

      const existingWebhook = { id: 456, config: { url: 'https://example.com/webhook' } };
      mockOctokit.rest.repos.listWebhooks.mockResolvedValue({
        data: [existingWebhook, { id: 789, config: { url: 'https://other.com' } }],
      });

      const result = await registerWebhook(
        'test-token',
        'test-owner',
        'test-repo',
        'https://example.com/webhook',
        'secret123'
      );

      expect(mockOctokit.rest.repos.listWebhooks).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
      });
      expect(result).toEqual(existingWebhook);
    });

    it('should rethrow non-422 errors', async () => {
      const error = new Error('Permission denied');
      (error as any).status = 403;
      mockOctokit.rest.repos.createWebhook.mockRejectedValue(error);

      await expect(
        registerWebhook(
          'test-token',
          'test-owner',
          'test-repo',
          'https://example.com/webhook',
          'secret123'
        )
      ).rejects.toThrow('Permission denied');
    });
  });

  describe('deleteWebhook', () => {
    it('should delete webhook successfully', async () => {
      const mockDeleteData = { success: true };
      mockOctokit.rest.repos.deleteWebhook.mockResolvedValue({ data: mockDeleteData });

      const result = await deleteWebhook('test-token', 'test-owner', 'test-repo', 123);

      expect(mockOctokit.rest.repos.deleteWebhook).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        hook_id: 123,
      });
      expect(result).toEqual({ data: mockDeleteData });
    });
  });
});
