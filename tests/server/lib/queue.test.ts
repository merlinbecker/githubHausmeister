import { describe, it, expect, vi, beforeEach } from 'vitest'
import { startNextIfIdle, markTaskCompleted, markTaskFailed } from '../../../server/lib/queue'

// Mock all dependencies
vi.mock('../../../server/lib/database-storage', () => ({
  databaseStorage: {
    getUserAppState: vi.fn(),
    updateTask: vi.fn(),
    getUserById: vi.fn(),
    getTaskById: vi.fn(),
    getUserSystemState: vi.fn(),
    updateUserSystemState: vi.fn()
  }
}))

vi.mock('../../../server/lib/github-rest', async () => {
  const actual = await vi.importActual('../../../server/lib/github-rest')
  return {
    ...actual,
    createIssue: vi.fn(),
    checkForDuplicateIssue: vi.fn(),
    assignCopilotToIssue: vi.fn(),
    verifyCopilotAssignment: vi.fn()
  }
})

vi.mock('../../../server/lib/github-graphql', () => ({
  getCopilotNodeId: vi.fn(),
  addAssignee: vi.fn(),
  getIssueNodeId: vi.fn()
}))

// Import mocked modules
import { databaseStorage } from '../../../server/lib/database-storage'

describe('Queue Management Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    // Mock environment variable
    process.env.MAX_MONTHLY_TASKS = '50'
  })

  describe('startNextIfIdle', () => {
    it('should return early if system is not running', async () => {
      vi.mocked(databaseStorage.getUserAppState).mockResolvedValue({
        systemRunning: false,
        activeTask: undefined,
        queue: [],
        monthlyDone: 0,
        repositories: []
      })

      await startNextIfIdle('user-123')

      expect(databaseStorage.getUserAppState).toHaveBeenCalledWith('user-123')
      expect(databaseStorage.updateTask).not.toHaveBeenCalled()
    })

    it('should return early if there is an active task', async () => {
      vi.mocked(databaseStorage.getUserAppState).mockResolvedValue({
        systemRunning: true,
        activeTask: { 
          id: 'active-task', 
          owner: 'owner', 
          repo: 'repo',
          title: 'Active Task',
          body: 'Active task body',
          status: 'in_progress',
          userId: 'user-123',
          repositoryId: 'repo-id',
          labels: [],
          issueNumber: null,
          issueUrl: null,
          pullNumber: null,
          headSha: null,
          startedAt: null,
          completedAt: null,
          failureReason: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        queue: [{
          id: 'queued-task',
          title: 'Queued Task',
          body: 'Queued task body',
          status: 'queued',
          userId: 'user-123',
          repositoryId: 'repo-id',
          owner: 'owner',
          repo: 'repo',
          labels: [],
          issueNumber: null,
          issueUrl: null,
          pullNumber: null,
          headSha: null,
          startedAt: null,
          completedAt: null,
          failureReason: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }],
        monthlyDone: 0,
        repositories: []
      })

      await startNextIfIdle('user-123')

      expect(databaseStorage.getUserAppState).toHaveBeenCalledWith('user-123')
      expect(databaseStorage.updateTask).not.toHaveBeenCalled()
    })

    it('should return early if queue is empty', async () => {
      vi.mocked(databaseStorage.getUserAppState).mockResolvedValue({
        systemRunning: true,
        activeTask: undefined,
        queue: [],
        monthlyDone: 0,
        repositories: []
      })

      await startNextIfIdle('user-123')

      expect(databaseStorage.getUserAppState).toHaveBeenCalledWith('user-123')
      expect(databaseStorage.updateTask).not.toHaveBeenCalled()
    })

    it('should return early if monthly limit reached', async () => {
      vi.mocked(databaseStorage.getUserAppState).mockResolvedValue({
        systemRunning: true,
        activeTask: undefined,
        queue: [{
          id: 'task-1',
          title: 'Test Task',
          body: 'Test body',
          status: 'queued',
          userId: 'user-123',
          repositoryId: 'repo-id',
          owner: 'owner',
          repo: 'repo',
          labels: [],
          issueNumber: null,
          issueUrl: null,
          pullNumber: null,
          headSha: null,
          startedAt: null,
          completedAt: null,
          failureReason: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }],
        monthlyDone: 50,
        repositories: []
      })

      await startNextIfIdle('user-123')

      expect(databaseStorage.getUserAppState).toHaveBeenCalledWith('user-123')
      expect(console.log).toHaveBeenCalledWith('Monthly limit reached for user user-123: 50/50')
      expect(databaseStorage.updateTask).not.toHaveBeenCalled()
    })

    it('should handle missing user access token', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'Test Task',
        body: 'Test body',
        labels: ['test'],
        owner: 'test-owner',
        repo: 'test-repo',
        status: 'queued',
        userId: 'user-123',
        repositoryId: 'repo-id',
        issueNumber: null,
        issueUrl: null,
        pullNumber: null,
        headSha: null,
        startedAt: null,
        completedAt: null,
        failureReason: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      vi.mocked(databaseStorage.getUserAppState).mockResolvedValue({
        systemRunning: true,
        activeTask: undefined,
        queue: [mockTask],
        monthlyDone: 0,
        repositories: []
      })

      vi.mocked(databaseStorage.getUserById).mockResolvedValue({
        id: 'user-123',
        username: 'testuser',
        email: null,
        avatarUrl: null,
        accessToken: '',
        refreshToken: null,
        tokenExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      await startNextIfIdle('user-123')

      expect(databaseStorage.updateTask).toHaveBeenCalledWith('task-1', {
        status: 'in_progress'
      })
      expect(console.error).toHaveBeenCalledWith('Error starting next task:', expect.any(Error))
    })

    it('should process task with duplicate issue found', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'Test Task',
        body: 'Test body',
        labels: ['test'],
        owner: 'test-owner',
        repo: 'test-repo',
        status: 'queued',
        userId: 'user-123',
        repositoryId: 'repo-id',
        issueNumber: null,
        issueUrl: null,
        pullNumber: null,
        headSha: null,
        startedAt: null,
        completedAt: null,
        failureReason: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      vi.mocked(databaseStorage.getUserAppState).mockResolvedValue({
        systemRunning: true,
        activeTask: undefined,
        queue: [mockTask],
        monthlyDone: 0,
        repositories: []
      })

      vi.mocked(databaseStorage.getUserById).mockResolvedValue({
        id: 'user-123',
        username: 'testuser',
        email: null,
        avatarUrl: null,
        accessToken: 'test-token',
        refreshToken: null,
        tokenExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      // Mock dynamic import for checkForDuplicateIssue
      const mockCheckForDuplicateIssue = vi.fn().mockResolvedValue({
        isDuplicate: true,
        existingIssue: { number: 456 }
      })

      const mockAssignCopilotToIssue = vi.fn().mockResolvedValue({
        success: true,
        assignedAgent: 'github-copilot[bot]'
      })

      vi.doMock('../../../server/lib/github-rest', () => ({
        checkForDuplicateIssue: mockCheckForDuplicateIssue,
        assignCopilotToIssue: mockAssignCopilotToIssue
      }))

      await startNextIfIdle('user-123')

      expect(databaseStorage.updateTask).toHaveBeenCalledWith('task-1', {
        status: 'in_progress'
      })

      expect(databaseStorage.updateTask).toHaveBeenCalledWith('task-1', {
        issueNumber: 456,
        status: 'in_progress'
      })
    })
  })

  describe('markTaskCompleted', () => {
    it('should mark task as completed and update monthly counter', async () => {
      const mockTask = {
        id: 'task-1',
        userId: 'user-123',
        status: 'in_progress',
        title: 'Test Task',
        body: 'Test body',
        owner: 'owner',
        repo: 'repo',
        repositoryId: 'repo-id',
        labels: [],
        issueNumber: null,
        issueUrl: null,
        pullNumber: null,
        headSha: null,
        startedAt: null,
        completedAt: null,
        failureReason: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      vi.mocked(databaseStorage.getTaskById).mockResolvedValue(mockTask)
      vi.mocked(databaseStorage.getUserSystemState).mockResolvedValue({
        id: 'state-id',
        userId: 'user-123',
        monthlyDone: 5,
        systemRunning: true,
        lastReset: new Date()
      })

      await markTaskCompleted('task-1')

      expect(databaseStorage.getTaskById).toHaveBeenCalledWith('task-1')
      expect(databaseStorage.updateTask).toHaveBeenCalledWith('task-1', {
        status: 'completed'
      })
      expect(databaseStorage.getUserSystemState).toHaveBeenCalledWith('user-123')
      expect(databaseStorage.updateUserSystemState).toHaveBeenCalledWith('user-123', {
        monthlyDone: 6
      })
      expect(console.log).toHaveBeenCalledWith('Task task-1 marked as completed')
    })

    it('should handle task not found', async () => {
      vi.mocked(databaseStorage.getTaskById).mockResolvedValue(undefined)

      await markTaskCompleted('non-existent-task')

      expect(databaseStorage.getTaskById).toHaveBeenCalledWith('non-existent-task')
      expect(console.error).toHaveBeenCalledWith('Task non-existent-task not found')
      expect(databaseStorage.updateTask).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(databaseStorage.getTaskById).mockRejectedValue(new Error('Database error'))

      await markTaskCompleted('task-1')

      expect(console.error).toHaveBeenCalledWith('Error marking task as completed:', expect.any(Error))
    })
  })

  describe('markTaskFailed', () => {
    it('should mark task as failed with reason', async () => {
      const mockTask = {
        id: 'task-1',
        userId: 'user-123',
        status: 'in_progress',
        title: 'Test Task',
        body: 'Test body',
        owner: 'owner',
        repo: 'repo',
        repositoryId: 'repo-id',
        labels: [],
        issueNumber: null,
        issueUrl: null,
        pullNumber: null,
        headSha: null,
        startedAt: null,
        completedAt: null,
        failureReason: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      vi.mocked(databaseStorage.getTaskById).mockResolvedValue(mockTask)

      await markTaskFailed('task-1', 'GitHub API error')

      expect(databaseStorage.getTaskById).toHaveBeenCalledWith('task-1')
      expect(databaseStorage.updateTask).toHaveBeenCalledWith('task-1', {
        status: 'failed'
      })
      expect(console.log).toHaveBeenCalledWith('Task task-1 marked as failed: GitHub API error')
    })

    it('should mark task as failed without reason', async () => {
      const mockTask = {
        id: 'task-1',
        userId: 'user-123',
        status: 'in_progress',
        title: 'Test Task',
        body: 'Test body',
        owner: 'owner',
        repo: 'repo',
        repositoryId: 'repo-id',
        labels: [],
        issueNumber: null,
        issueUrl: null,
        pullNumber: null,
        headSha: null,
        startedAt: null,
        completedAt: null,
        failureReason: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      vi.mocked(databaseStorage.getTaskById).mockResolvedValue(mockTask)

      await markTaskFailed('task-1')

      expect(databaseStorage.updateTask).toHaveBeenCalledWith('task-1', {
        status: 'failed'
      })
      expect(console.log).toHaveBeenCalledWith('Task task-1 marked as failed: Unknown error')
    })

    it('should handle task not found', async () => {
      vi.mocked(databaseStorage.getTaskById).mockResolvedValue(undefined)

      await markTaskFailed('non-existent-task')

      expect(console.error).toHaveBeenCalledWith('Task non-existent-task not found')
      expect(databaseStorage.updateTask).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(databaseStorage.getTaskById).mockRejectedValue(new Error('Database error'))

      await markTaskFailed('task-1')

      expect(console.error).toHaveBeenCalledWith('Error marking task as failed:', expect.any(Error))
    })
  })
})