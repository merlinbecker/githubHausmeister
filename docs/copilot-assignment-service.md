# GitHub Copilot Assignment Service

This document describes the unified Copilot assignment service that consolidates all Copilot agent assignment logic into a single, robust service following GitHub's recommended GraphQL approach.

## Overview

The `CopilotAssignmentService` class provides a unified interface for assigning GitHub Copilot agents to issues with comprehensive fallback strategies and caching.

## Quick Start

### Basic Usage

```typescript
import { CopilotAssignmentService } from './server/lib/copilot-assignment';

const service = new CopilotAssignmentService(githubToken);
const result = await service.assignToIssue('owner', 'repo', issueNumber);

if (result.success) {
  console.log(`Assigned ${result.assignedAgent} to issue #${issueNumber}`);
} else {
  console.error(`Assignment failed: ${result.error}`);
}
```

### Convenience Functions

For backward compatibility and simple usage:

```typescript
import { assignCopilotToIssue, verifyCopilotAssignment } from './server/lib/copilot-assignment';

// Assign agent
const result = await assignCopilotToIssue(token, owner, repo, issueNumber);

// Verify assignment
const verification = await verifyCopilotAssignment(token, owner, repo, issueNumber);
```

## Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `COPILOT_ACTOR_ID` | GitHub NodeID of Copilot agent | No | Auto-detect |
| `COPILOT_CACHE_TTL` | Cache TTL in milliseconds | No | 3600000 (1 hour) |

### Service Configuration

```typescript
const config = {
  // Primary configuration
  actorId: 'MDQ6VXNlcjxxxxxxxxx',           // Direct NodeID
  
  // Fallback options
  preferredAgents: ['copilot', 'github-copilot[bot]'],
  enableSearch: true,                       // Enable global search
  fallbackToUser: false,                    // Fallback to current user
  
  // Behavior
  retryAttempts: 3,
  verificationDelay: 2000,
};

const service = new CopilotAssignmentService(token, config);
```

## Agent Discovery Strategies

The service uses multiple fallback strategies to find Copilot agents:

1. **Environment Variable** (`COPILOT_ACTOR_ID`) - Fastest, most reliable
2. **Repository Search** - Searches assignable users in the repository
3. **Global Search** - Searches for known Copilot agent names globally
4. **Current User Fallback** - Uses current user if enabled and all else fails

## API Reference

### CopilotAssignmentService

#### Constructor

```typescript
constructor(token: string, config?: Partial<CopilotConfig>)
```

#### Methods

##### assignToIssue()

```typescript
async assignToIssue(owner: string, repo: string, issueNumber: number): Promise<AssignmentResult>
```

Assigns a Copilot agent to the specified issue.

**Returns:**
- `success`: Whether assignment succeeded
- `assignedAgent`: Login of assigned agent
- `error`: Error message if failed
- `agentInfo`: Detailed agent information

##### verifyAssignment()

```typescript
async verifyAssignment(owner: string, repo: string, issueNumber: number): Promise<VerificationResult>
```

Verifies that a Copilot agent is assigned to the issue.

**Returns:**
- `isAssigned`: Whether a Copilot agent is assigned
- `assignedCopilot`: Login of assigned Copilot agent
- `allAssignees`: Array of all assignee logins

## Migration from Legacy Functions

### From github-rest.ts

```typescript
// Old (deprecated)
import { assignCopilotToIssue } from './github-rest';

// New
import { assignCopilotToIssue } from './copilot-assignment';
```

### From copilot.ts

```typescript
// Old (deprecated)
import { getCopilotNodeId, addAssignee } from './copilot';

// New
import { CopilotAssignmentService } from './copilot-assignment';
const service = new CopilotAssignmentService(token);
```

## Error Handling

The service provides comprehensive error handling with clear, actionable messages:

```typescript
const result = await service.assignToIssue(owner, repo, issueNumber);

if (!result.success) {
  switch (true) {
    case result.error?.includes('No Copilot agent found'):
      // Set COPILOT_ACTOR_ID environment variable
      break;
    case result.error?.includes('GraphQL'):
      // Check token permissions
      break;
    default:
      // Generic error handling
      break;
  }
}
```

## Performance Features

### Caching

Agent information is cached per repository to avoid repeated API calls:

```typescript
// First call: API lookup
await service.assignToIssue('owner', 'repo', 1); // API call

// Second call: Uses cache
await service.assignToIssue('owner', 'repo', 2); // Cached
```

### Logging

Comprehensive logging for debugging and monitoring:

```
🎯 [COPILOT ASSIGNMENT] Starting assignment for issue #123 in owner/repo
🎯 [COPILOT ASSIGNMENT] Step 1: Finding Copilot agent...
🎯 [COPILOT AGENT] Strategy 1: Using environment COPILOT_ACTOR_ID
✅ [COPILOT ASSIGNMENT] Step 1 SUCCESS: Found agent copilot (environment)
```

## Best Practices

1. **Set COPILOT_ACTOR_ID** for best performance and reliability
2. **Enable caching** in production environments
3. **Monitor logs** for assignment failures
4. **Use verification** for critical workflows
5. **Handle errors gracefully** with appropriate fallbacks

## Troubleshooting

### Common Issues

1. **"No Copilot agent found"**
   - Set `COPILOT_ACTOR_ID` environment variable
   - Ensure Copilot is enabled for the repository
   - Check agent permissions

2. **GraphQL errors**
   - Verify token has required permissions
   - Check rate limits
   - Ensure repository exists and is accessible

3. **Assignment not persistent**
   - Use `verifyAssignment()` to check
   - May indicate GitHub API issues
   - Consider retry logic

### Getting COPILOT_ACTOR_ID

1. Navigate to GitHub repository
2. Create an issue
3. Manually assign Copilot agent
4. Use GitHub API to get the agent's NodeID:

```bash
curl -H "Authorization: token YOUR_TOKEN" \
     https://api.github.com/repos/owner/repo/issues/ISSUE_NUMBER
```

Look for the Copilot agent in the `assignees` array and note the `node_id`.