import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CopilotAssignmentService,
  assignCopilotToIssue,
  verifyCopilotAssignment,
  type CopilotConfig,
} from '../../../server/lib/copilot-assignment';
import * as githubGraphql from '../../../server/lib/github-graphql';

// Mock the github-graphql module
vi.mock('../../../server/lib/github-graphql', () => ({
  gql: vi.fn(),
  getIssueNodeId: vi.fn(),
}));

describe('CopilotAssignmentService', () => {
  const mockToken = 'test-token';
  const mockOwner = 'test-owner';
  const mockRepo = 'test-repo';
  const mockIssueNumber = 123;

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear environment variables
    delete process.env.COPILOT_ACTOR_ID;
    delete process.env.COPILOT_CACHE_TTL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const service = new CopilotAssignmentService(mockToken);
      expect(service).toBeDefined();
    });

    it('should use environment variable for actorId', () => {
      process.env.COPILOT_ACTOR_ID = 'env-actor-id';
      const service = new CopilotAssignmentService(mockToken);
      expect(service).toBeDefined();
    });

    it('should override defaults with provided config', () => {
      const config: Partial<CopilotConfig> = {
        enableSearch: false,
        retryAttempts: 5,
        preferredAgents: ['custom-agent'],
      };
      const service = new CopilotAssignmentService(mockToken, config);
      expect(service).toBeDefined();
    });
  });

  describe('assignToIssue', () => {
    it('should successfully assign Copilot agent using environment variable', async () => {
      process.env.COPILOT_ACTOR_ID = 'test-node-id';

      const mockGql = vi.mocked(githubGraphql.gql);
      const mockGetIssueNodeId = vi.mocked(githubGraphql.getIssueNodeId);

      // Mock getting login from node ID
      mockGql
        .mockResolvedValueOnce({ node: { login: 'copilot-agent' } }) // getLoginFromNodeId
        .mockResolvedValueOnce({ 
          addAssigneesToAssignable: {
            assignable: {
              id: 'issue-id',
              number: 123,
              title: 'Test Issue',
              assignees: {
                nodes: [
                  { id: 'test-node-id', login: 'copilot-agent' }
                ]
              }
            }
          }
        }); // assignViaGraphQL

      mockGetIssueNodeId.mockResolvedValue('issue-node-id');

      const service = new CopilotAssignmentService(mockToken);
      const result = await service.assignToIssue(
        mockOwner,
        mockRepo,
        mockIssueNumber
      );

      expect(result.success).toBe(true);
      expect(result.assignedAgent).toBe('copilot-agent');
      expect(result.agentInfo?.source).toBe('environment');
      expect(mockGetIssueNodeId).toHaveBeenCalledWith(
        mockToken,
        mockOwner,
        mockRepo,
        mockIssueNumber
      );
    });

    it('should fallback to repository assignable users when environment variable fails', async () => {
      process.env.COPILOT_ACTOR_ID = 'invalid-node-id';

      const mockGql = vi.mocked(githubGraphql.gql);
      const mockGetIssueNodeId = vi.mocked(githubGraphql.getIssueNodeId);

      mockGql
        .mockRejectedValueOnce(new Error('Invalid node ID')) // getLoginFromNodeId fails
        .mockResolvedValueOnce({
          // findAgentInRepository
          repository: {
            assignableUsers: {
              nodes: [
                { id: 'user1-id', login: 'regular-user' },
                { id: 'copilot-id', login: 'github-copilot[bot]' },
              ],
            },
          },
        })
        .mockResolvedValueOnce({ 
          addAssigneesToAssignable: {
            assignable: {
              id: 'issue-id',
              number: 123,
              title: 'Test Issue',
              assignees: {
                nodes: [
                  { id: 'copilot-id', login: 'github-copilot[bot]' }
                ]
              }
            }
          }
        }); // assignViaGraphQL

      mockGetIssueNodeId.mockResolvedValue('issue-node-id');

      const service = new CopilotAssignmentService(mockToken);
      const result = await service.assignToIssue(
        mockOwner,
        mockRepo,
        mockIssueNumber
      );

      expect(result.success).toBe(true);
      expect(result.assignedAgent).toBe('github-copilot[bot]');
      expect(result.agentInfo?.source).toBe('repository');
    });

    it('should fallback to global search when repository search fails', async () => {
      const mockGql = vi.mocked(githubGraphql.gql);
      const mockGetIssueNodeId = vi.mocked(githubGraphql.getIssueNodeId);

      mockGql
        .mockResolvedValueOnce({
          // findAgentInRepository (no agents found)
          repository: {
            assignableUsers: {
              nodes: [{ id: 'user1-id', login: 'regular-user' }],
            },
          },
        })
        .mockResolvedValueOnce({
          // findAgentByGlobalSearch
          user: { id: 'copilot-global-id', login: 'copilot' },
        })
        .mockResolvedValueOnce({ 
          addAssigneesToAssignable: {
            assignable: {
              id: 'issue-id',
              number: 123,
              title: 'Test Issue',
              assignees: {
                nodes: [
                  { id: 'copilot-global-id', login: 'copilot' }
                ]
              }
            }
          }
        }); // assignViaGraphQL

      mockGetIssueNodeId.mockResolvedValue('issue-node-id');

      const service = new CopilotAssignmentService(mockToken);
      const result = await service.assignToIssue(
        mockOwner,
        mockRepo,
        mockIssueNumber
      );

      expect(result.success).toBe(true);
      expect(result.assignedAgent).toBe('copilot');
      expect(result.agentInfo?.source).toBe('search');
    });

    it('should fallback to current user when enabled and all other strategies fail', async () => {
      const config: Partial<CopilotConfig> = {
        fallbackToUser: true,
      };

      const mockGql = vi.mocked(githubGraphql.gql);
      const mockGetIssueNodeId = vi.mocked(githubGraphql.getIssueNodeId);

      mockGql
        .mockResolvedValueOnce({
          // findAgentInRepository (no agents found)
          repository: {
            assignableUsers: {
              nodes: [],
            },
          },
        })
        // findAgentByGlobalSearch tries 3 preferred agents by default: 'copilot', 'github-copilot[bot]', 'copilot-swe-agent'
        .mockRejectedValueOnce(new Error('No user found')) // copilot search fails
        .mockRejectedValueOnce(new Error('No user found')) // github-copilot[bot] search fails
        .mockRejectedValueOnce(new Error('No user found')) // copilot-swe-agent search fails
        .mockResolvedValueOnce({
          // getCurrentUser
          viewer: { id: 'current-user-id', login: 'current-user' },
        })
        .mockResolvedValueOnce({ 
          addAssigneesToAssignable: {
            assignable: {
              id: 'issue-id',
              number: 123,
              title: 'Test Issue',
              assignees: {
                nodes: [
                  { id: 'current-user-id', login: 'current-user' }
                ]
              }
            }
          }
        }); // assignViaGraphQL

      mockGetIssueNodeId.mockResolvedValue('issue-node-id');

      const service = new CopilotAssignmentService(mockToken, config);
      const result = await service.assignToIssue(
        mockOwner,
        mockRepo,
        mockIssueNumber
      );

      expect(result.success).toBe(true);
      expect(result.assignedAgent).toBe('current-user');
      expect(result.agentInfo?.source).toBe('fallback');
    });

    it('should fail when no agent can be found', async () => {
      const mockGql = vi.mocked(githubGraphql.gql);

      mockGql
        .mockResolvedValueOnce({
          // findAgentInRepository (no agents found)
          repository: {
            assignableUsers: {
              nodes: [],
            },
          },
        })
        .mockRejectedValue(new Error('No user found')); // findAgentByGlobalSearch fails

      const service = new CopilotAssignmentService(mockToken);
      const result = await service.assignToIssue(
        mockOwner,
        mockRepo,
        mockIssueNumber
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No Copilot agent found');
    });

    it('should handle GraphQL assignment errors', async () => {
      process.env.COPILOT_ACTOR_ID = 'test-node-id';

      const mockGql = vi.mocked(githubGraphql.gql);
      const mockGetIssueNodeId = vi.mocked(githubGraphql.getIssueNodeId);

      mockGql
        .mockResolvedValueOnce({ node: { login: 'copilot-agent' } }) // getLoginFromNodeId
        .mockRejectedValueOnce(new Error('GraphQL assignment failed')); // assignViaGraphQL

      mockGetIssueNodeId.mockResolvedValue('issue-node-id');

      const service = new CopilotAssignmentService(mockToken);
      const result = await service.assignToIssue(
        mockOwner,
        mockRepo,
        mockIssueNumber
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('GraphQL assignment failed');
    });
  });

  describe('verifyAssignment', () => {
    it('should verify successful assignment', async () => {
      const mockGql = vi.mocked(githubGraphql.gql);

      mockGql.mockResolvedValue({
        repository: {
          issue: {
            assignees: {
              nodes: [
                { login: 'github-copilot[bot]' },
                { login: 'other-user' },
              ],
            },
          },
        },
      });

      const service = new CopilotAssignmentService(mockToken);
      const result = await service.verifyAssignment(
        mockOwner,
        mockRepo,
        mockIssueNumber
      );

      expect(result.isAssigned).toBe(true);
      expect(result.assignedCopilot).toBe('github-copilot[bot]');
      expect(result.allAssignees).toEqual([
        'github-copilot[bot]',
        'other-user',
      ]);
    });

    it('should detect no Copilot assignment', async () => {
      const mockGql = vi.mocked(githubGraphql.gql);

      mockGql.mockResolvedValue({
        repository: {
          issue: {
            assignees: {
              nodes: [{ login: 'regular-user' }, { login: 'another-user' }],
            },
          },
        },
      });

      const service = new CopilotAssignmentService(mockToken);
      const result = await service.verifyAssignment(
        mockOwner,
        mockRepo,
        mockIssueNumber
      );

      expect(result.isAssigned).toBe(false);
      expect(result.assignedCopilot).toBeUndefined();
      expect(result.allAssignees).toEqual(['regular-user', 'another-user']);
    });

    it('should handle verification errors gracefully', async () => {
      const mockGql = vi.mocked(githubGraphql.gql);
      mockGql.mockRejectedValue(new Error('GraphQL error'));

      const service = new CopilotAssignmentService(mockToken);
      const result = await service.verifyAssignment(
        mockOwner,
        mockRepo,
        mockIssueNumber
      );

      expect(result.isAssigned).toBe(false);
      expect(result.allAssignees).toEqual([]);
    });
  });

  describe('caching', () => {
    it('should cache agent information', async () => {
      process.env.COPILOT_ACTOR_ID = 'test-node-id';

      const mockGql = vi.mocked(githubGraphql.gql);
      const mockGetIssueNodeId = vi.mocked(githubGraphql.getIssueNodeId);

      mockGql
        .mockResolvedValueOnce({ node: { login: 'copilot-agent' } }) // First call
        .mockResolvedValue({ 
          addAssigneesToAssignable: {
            assignable: {
              id: 'issue-id',
              number: 123,
              title: 'Test Issue',
              assignees: {
                nodes: [
                  { id: 'test-node-id', login: 'copilot-agent' }
                ]
              }
            }
          }
        }); // Assignment calls

      mockGetIssueNodeId.mockResolvedValue('issue-node-id');

      const service = new CopilotAssignmentService(mockToken);

      // First assignment
      const result1 = await service.assignToIssue(
        mockOwner,
        mockRepo,
        mockIssueNumber
      );
      expect(result1.success).toBe(true);

      // Second assignment should use cache (no additional getLoginFromNodeId call)
      const result2 = await service.assignToIssue(
        mockOwner,
        mockRepo,
        mockIssueNumber + 1
      );
      expect(result2.success).toBe(true);

      // Should have called getLoginFromNodeId only once (cached on second call)
      expect(mockGql).toHaveBeenCalledTimes(3); // getLoginFromNodeId + 2 assignments
    });
  });

  describe('convenience functions', () => {
    it('should work with assignCopilotToIssue convenience function', async () => {
      process.env.COPILOT_ACTOR_ID = 'test-node-id';

      const mockGql = vi.mocked(githubGraphql.gql);
      const mockGetIssueNodeId = vi.mocked(githubGraphql.getIssueNodeId);

      mockGql
        .mockResolvedValueOnce({ node: { login: 'copilot-agent' } })
        .mockResolvedValueOnce({ 
          addAssigneesToAssignable: {
            assignable: {
              id: 'issue-id',
              number: 123,
              title: 'Test Issue',
              assignees: {
                nodes: [
                  { id: 'test-node-id', login: 'copilot-agent' }
                ]
              }
            }
          }
        });

      mockGetIssueNodeId.mockResolvedValue('issue-node-id');

      const result = await assignCopilotToIssue(
        mockToken,
        mockOwner,
        mockRepo,
        mockIssueNumber
      );

      expect(result.success).toBe(true);
      expect(result.assignedAgent).toBe('copilot-agent');
    });

    it('should work with verifyCopilotAssignment convenience function', async () => {
      const mockGql = vi.mocked(githubGraphql.gql);

      mockGql.mockResolvedValue({
        repository: {
          issue: {
            assignees: {
              nodes: [{ login: 'github-copilot[bot]' }],
            },
          },
        },
      });

      const result = await verifyCopilotAssignment(
        mockToken,
        mockOwner,
        mockRepo,
        mockIssueNumber
      );

      expect(result.isAssigned).toBe(true);
      expect(result.assignedCopilot).toBe('github-copilot[bot]');
    });
  });
});
