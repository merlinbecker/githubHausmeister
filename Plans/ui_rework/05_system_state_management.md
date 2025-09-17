# System State Management Plan

## Overview
This document outlines the changes needed for system state management, including repository-scoped states, simplified pause/resume functionality, and automated monthly resets.

## Current State Analysis

### Existing System State (`userSystemState` table)
```sql
-- Current structure
CREATE TABLE user_system_state (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  monthly_done INTEGER DEFAULT 0,           -- Global counter (TO BE REMOVED)
  system_running BOOLEAN DEFAULT true,      -- Global system state
  last_reset TIMESTAMP DEFAULT NOW()       -- Global reset tracking
);
```

### Problems with Current System
1. **Global monthly counter**: Doesn't account for per-repository limits
2. **Single system state**: No repository-specific pause/resume
3. **Global reset logic**: All repositories reset simultaneously
4. **No current repository tracking**: User has to select repository each session

## New System State Architecture

### Modified `userSystemState` Table
```sql
-- Updated structure
ALTER TABLE user_system_state 
  DROP COLUMN monthly_done,                    -- Remove global counter
  ADD COLUMN current_repository_id VARCHAR REFERENCES user_repositories(id),
  ADD COLUMN is_paused BOOLEAN DEFAULT false; -- Rename from system_running for clarity
```

### Repository-Scoped State in `userRepositories`
```sql
-- Already planned in repository settings
ALTER TABLE user_repositories 
  ADD COLUMN monthly_assignments_used INTEGER DEFAULT 0,
  ADD COLUMN last_monthly_reset TIMESTAMP DEFAULT NOW(),
  ADD COLUMN monthly_assignment_limit INTEGER DEFAULT 10,
  ADD COLUMN is_current_active BOOLEAN DEFAULT false;
```

## State Management Services

### System State Service
```typescript
interface UserSystemState {
  currentRepositoryId?: string;
  isPaused: boolean;
  lastActivity?: Date;
}

interface RepositoryState {
  monthlyAssignmentsUsed: number;
  monthlyAssignmentLimit: number;
  lastMonthlyReset: Date;
  isCurrentActive: boolean;
}

class SystemStateService {
  // Global system state
  async getUserSystemState(userId: string): Promise<UserSystemState>;
  async updateSystemState(userId: string, state: Partial<UserSystemState>): Promise<void>;
  
  // Repository-specific state
  async getRepositoryState(userId: string, repositoryId: string): Promise<RepositoryState>;
  async setCurrentRepository(userId: string, repositoryId: string): Promise<void>;
  async getCurrentRepository(userId: string): Promise<UserRepository | null>;
  
  // System control
  async pauseSystem(userId: string): Promise<void>;
  async resumeSystem(userId: string): Promise<void>;
  async isSystemRunning(userId: string): Promise<boolean>;
}
```

### Monthly Reset Service
```typescript
class MonthlyResetService {
  // Check and reset if needed for specific repository
  async checkRepositoryReset(userId: string, repositoryId: string): Promise<boolean> {
    const repository = await db.query.userRepositories.findFirst({
      where: and(
        eq(userRepositories.userId, userId),
        eq(userRepositories.id, repositoryId)
      )
    });
    
    if (!repository) return false;
    
    const now = new Date();
    const lastReset = new Date(repository.lastMonthlyReset);
    
    // Check if we're in a new month
    if (now.getMonth() !== lastReset.getMonth() || 
        now.getFullYear() !== lastReset.getFullYear()) {
      
      await this.resetRepositoryCounters(userId, repositoryId);
      return true;
    }
    
    return false;
  }
  
  // Reset counters for specific repository
  private async resetRepositoryCounters(userId: string, repositoryId: string): Promise<void> {
    await db.update(userRepositories)
      .set({
        monthlyAssignmentsUsed: 0,
        lastMonthlyReset: new Date()
      })
      .where(and(
        eq(userRepositories.userId, userId),
        eq(userRepositories.id, repositoryId)
      ));
  }
  
  // Scheduled job to reset all repositories (runs on 1st of each month)
  async resetAllRepositories(): Promise<void> {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    await db.update(userRepositories)
      .set({
        monthlyAssignmentsUsed: 0,
        lastMonthlyReset: firstOfMonth
      })
      .where(
        // Only reset repositories that haven't been reset this month
        lt(userRepositories.lastMonthlyReset, firstOfMonth)
      );
  }
}
```

## Assignment Logic Integration

### Pre-Assignment Checks
```typescript
class AssignmentValidator {
  async canAssignToRepository(userId: string, repositoryId: string): Promise<{
    canAssign: boolean;
    reason?: string;
  }> {
    // Check if system is paused
    const systemState = await systemStateService.getUserSystemState(userId);
    if (systemState.isPaused) {
      return { canAssign: false, reason: 'System is paused' };
    }
    
    // Check monthly reset
    await monthlyResetService.checkRepositoryReset(userId, repositoryId);
    
    // Check assignment limit
    const repoState = await systemStateService.getRepositoryState(userId, repositoryId);
    if (repoState.monthlyAssignmentsUsed >= repoState.monthlyAssignmentLimit) {
      return { canAssign: false, reason: 'Monthly assignment limit reached' };
    }
    
    return { canAssign: true };
  }
  
  async recordAssignment(userId: string, repositoryId: string): Promise<void> {
    await db.update(userRepositories)
      .set({
        monthlyAssignmentsUsed: sql`${userRepositories.monthlyAssignmentsUsed} + 1`
      })
      .where(and(
        eq(userRepositories.userId, userId),
        eq(userRepositories.id, repositoryId)
      ));
  }
}
```

## API Endpoints

### System Control Endpoints
```typescript
// GET /api/system/status
app.get('/api/system/status', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const systemState = await systemStateService.getUserSystemState(userId);
    const currentRepo = await systemStateService.getCurrentRepository(userId);
    
    let repositoryState = null;
    if (currentRepo) {
      repositoryState = await systemStateService.getRepositoryState(userId, currentRepo.id);
    }
    
    res.json({
      isPaused: systemState.isPaused,
      currentRepository: currentRepo,
      repositoryState
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get system status' });
  }
});

// POST /api/system/pause
app.post('/api/system/pause', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    await systemStateService.pauseSystem(userId);
    res.json({ success: true, message: 'System paused' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to pause system' });
  }
});

// POST /api/system/resume
app.post('/api/system/resume', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    await systemStateService.resumeSystem(userId);
    
    // Check if we can assign a new task
    const currentRepo = await systemStateService.getCurrentRepository(userId);
    if (currentRepo) {
      const validation = await assignmentValidator.canAssignToRepository(userId, currentRepo.id);
      if (validation.canAssign) {
        // Trigger assignment logic
        await queueService.processNext(userId, currentRepo.id);
      }
    }
    
    res.json({ success: true, message: 'System resumed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resume system' });
  }
});
```

### Repository State Endpoints
```typescript
// PUT /api/repositories/current
app.put('/api/repositories/current', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { repositoryId } = req.body;
    
    await systemStateService.setCurrentRepository(userId, repositoryId);
    
    // Check for monthly reset
    await monthlyResetService.checkRepositoryReset(userId, repositoryId);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to set current repository' });
  }
});

// GET /api/repositories/current
app.get('/api/repositories/current', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const currentRepo = await systemStateService.getCurrentRepository(userId);
    
    if (!currentRepo) {
      return res.status(404).json({ error: 'No current repository set' });
    }
    
    const repositoryState = await systemStateService.getRepositoryState(userId, currentRepo.id);
    
    res.json({
      repository: currentRepo,
      state: repositoryState
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get current repository' });
  }
});
```

## Frontend State Management

### React Query Integration
```typescript
// Hooks for system state
export const useSystemState = () => {
  return useQuery({
    queryKey: ['system', 'status'],
    queryFn: getSystemStatus,
    refetchInterval: 30000, // Check every 30 seconds
  });
};

export const useCurrentRepository = () => {
  return useQuery({
    queryKey: ['repository', 'current'],
    queryFn: getCurrentRepository,
  });
};

// Mutations for system control
export const useSystemControl = () => {
  const queryClient = useQueryClient();
  
  const pauseSystem = useMutation({
    mutationFn: pauseSystemAPI,
    onSuccess: () => {
      queryClient.invalidateQueries(['system', 'status']);
    },
  });
  
  const resumeSystem = useMutation({
    mutationFn: resumeSystemAPI,
    onSuccess: () => {
      queryClient.invalidateQueries(['system', 'status']);
      queryClient.invalidateQueries(['tasks']); // Refresh tasks
    },
  });
  
  return { pauseSystem, resumeSystem };
};

export const useRepositorySwitch = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: setCurrentRepository,
    onSuccess: () => {
      // Invalidate all repository-dependent queries
      queryClient.invalidateQueries(['repository']);
      queryClient.invalidateQueries(['issues']);
      queryClient.invalidateQueries(['tasks']);
      queryClient.invalidateQueries(['webhooks']);
    },
  });
};
```

### System Controls Component
```typescript
interface SimpleSystemControlsProps {
  isRunning: boolean;
  onToggle: (running: boolean) => Promise<void>;
}

const SimpleSystemControls: React.FC<SimpleSystemControlsProps> = ({ isRunning, onToggle }) => {
  const [isToggling, setIsToggling] = useState(false);
  
  const handleToggle = async () => {
    setIsToggling(true);
    try {
      await onToggle(!isRunning);
    } finally {
      setIsToggling(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Power className="h-5 w-5" />
          <span>System Controls</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">
              System Status: {isRunning ? 'Running' : 'Paused'}
            </p>
            <p className="text-sm text-muted-foreground">
              {isRunning 
                ? 'Automatic task assignment is active'
                : 'Task assignment is paused'
              }
            </p>
          </div>
          <Button
            onClick={handleToggle}
            disabled={isToggling}
            variant={isRunning ? 'destructive' : 'default'}
          >
            {isToggling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isRunning ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pause System
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Resume System
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
```

## Background Jobs

### Scheduled Monthly Reset
```typescript
// Using cron job or scheduled function
class ScheduledJobs {
  // Run on 1st of each month at 00:00 UTC
  @Cron('0 0 1 * *')
  async monthlyReset() {
    console.log('Running monthly assignment counter reset...');
    
    try {
      await monthlyResetService.resetAllRepositories();
      console.log('Monthly reset completed successfully');
    } catch (error) {
      console.error('Monthly reset failed:', error);
    }
  }
  
  // Run every hour to check for missed resets
  @Cron('0 * * * *')
  async checkMissedResets() {
    // In case the monthly job fails, check for repositories that need reset
    const cutoffDate = new Date();
    cutoffDate.setDate(1); // 1st of current month
    cutoffDate.setHours(0, 0, 0, 0);
    
    const repositories = await db.query.userRepositories.findMany({
      where: lt(userRepositories.lastMonthlyReset, cutoffDate)
    });
    
    for (const repo of repositories) {
      await monthlyResetService.checkRepositoryReset(repo.userId, repo.id);
    }
  }
}
```

## Migration Strategy

### Phase 1: Database Changes
1. Add new columns to `userSystemState` and `userRepositories`
2. Migrate existing data
3. Set initial current repository for each user

### Phase 2: Backend Implementation
1. Implement new state management services
2. Update assignment logic to use repository-scoped limits
3. Add new API endpoints

### Phase 3: Frontend Updates
1. Update system controls component
2. Add repository selector with state persistence
3. Update dashboard to reflect repository-scoped data

### Phase 4: Cleanup
1. Remove old global monthly counter logic
2. Remove unused API endpoints
3. Update documentation

## Data Migration Script
```typescript
async function migrateSystemState() {
  // Set current repository for users who don't have one
  const usersWithoutCurrent = await db.query.users.findMany({
    with: {
      repositories: true,
      systemState: true
    }
  });
  
  for (const user of usersWithoutCurrent) {
    const activeRepo = user.repositories.find(r => r.isActive);
    if (activeRepo) {
      await systemStateService.setCurrentRepository(user.id, activeRepo.id);
    }
  }
  
  // Initialize monthly counters based on existing global counter
  // This is a best-effort migration - distribute global counter across repositories
  for (const user of usersWithoutCurrent) {
    const globalDone = user.systemState?.[0]?.monthlyDone || 0;
    const activeRepos = user.repositories.filter(r => r.isActive);
    
    if (activeRepos.length > 0 && globalDone > 0) {
      const perRepo = Math.floor(globalDone / activeRepos.length);
      const remainder = globalDone % activeRepos.length;
      
      for (let i = 0; i < activeRepos.length; i++) {
        const repoUsage = perRepo + (i < remainder ? 1 : 0);
        await db.update(userRepositories)
          .set({ monthlyAssignmentsUsed: repoUsage })
          .where(eq(userRepositories.id, activeRepos[i].id));
      }
    }
  }
}