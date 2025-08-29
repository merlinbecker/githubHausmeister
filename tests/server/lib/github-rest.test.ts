import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Octokit } from 'octokit'
import { createIssue, getIssue, createReviewApprove, mergePullRequest, markPRReadyForReview } from '../../../server/lib/github-rest'

// Mock Octokit
vi.mock('octokit', () => ({
  Octokit: vi.fn()
}))

describe('GitHub REST API Functions', () => {
  const mockOctokit = {
    rest: {
      issues: {
        create: vi.fn(),
        get: vi.fn()
      },
      pulls: {
        createReview: vi.fn(),
        merge: vi.fn(),
        update: vi.fn()
      }
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(Octokit).mockReturnValue(mockOctokit as any)
  })

  describe('createIssue', () => {
    it('should create issue with correct parameters', async () => {
      const mockIssueData = {
        id: 123,
        number: 456,
        title: 'Test Issue',
        body: 'Test body',
        labels: [{ name: 'bug' }]
      }

      mockOctokit.rest.issues.create.mockResolvedValue({ data: mockIssueData })

      const result = await createIssue(
        'test-token',
        'test-owner',
        'test-repo',
        'Test Issue',
        'Test body',
        ['bug', 'priority']
      )

      expect(Octokit).toHaveBeenCalledWith({ auth: 'test-token' })
      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test Issue',
        body: 'Test body',
        labels: ['bug', 'priority']
      })
      expect(result).toEqual(mockIssueData)
    })

    it('should create issue with default empty labels', async () => {
      const mockIssueData = { id: 123, number: 456 }
      mockOctokit.rest.issues.create.mockResolvedValue({ data: mockIssueData })

      await createIssue('test-token', 'test-owner', 'test-repo', 'Test', 'Body')

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test',
        body: 'Body',
        labels: []
      })
    })
  })

  describe('getIssue', () => {
    it('should get issue with correct parameters', async () => {
      const mockIssueData = { id: 123, number: 456, title: 'Test Issue' }
      mockOctokit.rest.issues.get.mockResolvedValue({ data: mockIssueData })

      const result = await getIssue('test-token', 'test-owner', 'test-repo', 456)

      expect(Octokit).toHaveBeenCalledWith({ auth: 'test-token' })
      expect(mockOctokit.rest.issues.get).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 456
      })
      expect(result).toEqual(mockIssueData)
    })
  })

  describe('createReviewApprove', () => {
    it('should create approval review with default message', async () => {
      const mockReviewData = { id: 789 }
      mockOctokit.rest.pulls.createReview.mockResolvedValue({ data: mockReviewData })

      const result = await createReviewApprove('test-token', 'test-owner', 'test-repo', 123)

      expect(Octokit).toHaveBeenCalledWith({ auth: 'test-token' })
      expect(mockOctokit.rest.pulls.createReview).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 123,
        event: 'APPROVE',
        body: 'LGTM (auto)'
      })
      expect(result).toEqual({ data: mockReviewData })
    })

    it('should create approval review with custom message', async () => {
      const customMessage = 'Custom approval message'
      mockOctokit.rest.pulls.createReview.mockResolvedValue({ data: { id: 789 } })

      await createReviewApprove('test-token', 'test-owner', 'test-repo', 123, customMessage)

      expect(mockOctokit.rest.pulls.createReview).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 123,
        event: 'APPROVE',
        body: customMessage
      })
    })
  })

  describe('mergePullRequest', () => {
    it('should merge pull request with default squash method', async () => {
      const mockMergeData = { sha: 'abc123', merged: true }
      mockOctokit.rest.pulls.merge.mockResolvedValue({ data: mockMergeData })

      const result = await mergePullRequest('test-token', 'test-owner', 'test-repo', 123)

      expect(Octokit).toHaveBeenCalledWith({ auth: 'test-token' })
      expect(mockOctokit.rest.pulls.merge).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 123,
        merge_method: 'squash'
      })
      expect(result).toEqual({ data: mockMergeData })
    })

    it('should merge pull request with custom method', async () => {
      mockOctokit.rest.pulls.merge.mockResolvedValue({ data: { merged: true } })

      await mergePullRequest('test-token', 'test-owner', 'test-repo', 123, 'rebase')

      expect(mockOctokit.rest.pulls.merge).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 123,
        merge_method: 'rebase'
      })
    })
  })

  describe('markPRReadyForReview', () => {
    it('should mark PR as ready for review', async () => {
      const mockUpdateData = { id: 123, draft: false }
      mockOctokit.rest.pulls.update.mockResolvedValue({ data: mockUpdateData })

      const result = await markPRReadyForReview('test-token', 'test-owner', 'test-repo', 123)

      expect(Octokit).toHaveBeenCalledWith({ auth: 'test-token' })
      expect(mockOctokit.rest.pulls.update).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 123,
        draft: false
      })
      expect(result).toEqual({ data: mockUpdateData })
    })
  })
})