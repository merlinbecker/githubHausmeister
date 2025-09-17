# Repository Settings Implementation Plan

## Overview
This document outlines the implementation of repository-specific settings functionality, including monthly assignment limits, webhook forwarding, and other repository-scoped configurations.

## Backend Implementation

### Database Schema Updates

#### Extended `userRepositories` Table
```sql
ALTER TABLE user_repositories ADD COLUMN monthly_assignment_limit INTEGER DEFAULT 10;
ALTER TABLE user_repositories ADD COLUMN monthly_assignments_used INTEGER DEFAULT 0;
ALTER TABLE user_repositories ADD COLUMN last_monthly_reset TIMESTAMP DEFAULT NOW();
ALTER TABLE user_repositories ADD COLUMN webhook_forward_url TEXT;
ALTER TABLE user_repositories ADD COLUMN auto_merge_enabled BOOLEAN DEFAULT true;
ALTER TABLE user_repositories ADD COLUMN is_current_active BOOLEAN DEFAULT false;

-- Index for fast current repository lookup
CREATE INDEX idx_user_repositories_current ON user_repositories(user_id, is_current_active);
```

#### Repository Settings Service
```typescript
interface RepositorySettings {
  monthlyAssignmentLimit: number;
  monthlyAssignmentsUsed: number;
  lastMonthlyReset: Date;
  webhookForwardUrl?: string;
  autoMergeEnabled: boolean;
}

class RepositorySettingsService {
  async getSettings(userId: string, repositoryId: string): Promise<RepositorySettings>;
  async updateSettings(userId: string, repositoryId: string, settings: Partial<RepositorySettings>): Promise<void>;
  async resetMonthlyUsage(userId: string, repositoryId: string): Promise<void>;
  async incrementUsage(userId: string, repositoryId: string): Promise<boolean>; // Returns false if limit exceeded
  async checkMonthlyReset(userId: string, repositoryId: string): Promise<void>;
}
```

### API Endpoints

#### Repository Settings Routes
```typescript
// GET /api/repositories/:id/settings
app.get('/api/repositories/:id/settings', requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  try {
    const settings = await repositorySettingsService.getSettings(userId, id);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get repository settings' });
  }
});

// PUT /api/repositories/:id/settings
app.put('/api/repositories/:id/settings', requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const settings = req.body;
  
  try {
    await repositorySettingsService.updateSettings(userId, id, settings);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update repository settings' });
  }
});

// POST /api/repositories/:id/webhook/test
app.post('/api/repositories/:id/webhook/test', requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  try {
    const result = await webhookService.testForwarding(userId, id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Webhook test failed' });
  }
});
```

#### Current Repository Management
```typescript
// PUT /api/user/current-repository
app.put('/api/user/current-repository', requireAuth, async (req, res) => {
  const { repositoryId } = req.body;
  const userId = req.user.id;
  
  try {
    await repositoryService.setCurrentRepository(userId, repositoryId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to set current repository' });
  }
});

// GET /api/user/current-repository
app.get('/api/user/current-repository', requireAuth, async (req, res) => {
  const userId = req.user.id;
  
  try {
    const repository = await repositoryService.getCurrentRepository(userId);
    res.json(repository);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get current repository' });
  }
});
```

### Monthly Assignment Logic

#### Assignment Tracking Service
```typescript
class AssignmentTrackingService {
  async canAssignTask(userId: string, repositoryId: string): Promise<boolean> {
    const settings = await repositorySettingsService.getSettings(userId, repositoryId);
    
    // Check for monthly reset
    await this.checkAndResetMonthly(userId, repositoryId, settings);
    
    // Check if under limit
    return settings.monthlyAssignmentsUsed < settings.monthlyAssignmentLimit;
  }
  
  async recordAssignment(userId: string, repositoryId: string): Promise<void> {
    await repositorySettingsService.incrementUsage(userId, repositoryId);
  }
  
  private async checkAndResetMonthly(userId: string, repositoryId: string, settings: RepositorySettings): Promise<void> {
    const now = new Date();
    const resetDate = new Date(settings.lastMonthlyReset);
    
    // Check if it's a new month
    if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
      await repositorySettingsService.resetMonthlyUsage(userId, repositoryId);
    }
  }
}
```

## Frontend Implementation

### Repository Settings Page

#### Route Setup
```typescript
// In App.tsx
<Route path="/repository/settings" component={RepositorySettingsPage} />
```

#### Settings Page Component
```typescript
interface RepositorySettingsPageProps {}

const RepositorySettingsPage: React.FC<RepositorySettingsPageProps> = () => {
  const { data: currentRepo } = useQuery(['current-repository'], getCurrentRepository);
  const { data: settings } = useQuery(['repository-settings', currentRepo?.id], 
    () => getRepositorySettings(currentRepo.id));
  
  const updateSettingsMutation = useMutation(updateRepositorySettings);
  
  return (
    <div className="container mx-auto px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Repository Settings</h1>
        <p className="text-muted-foreground">
          Configure settings for {currentRepo?.owner}/{currentRepo?.repo}
        </p>
      </header>
      
      <div className="space-y-6">
        <AssignmentLimitSettings 
          settings={settings}
          onUpdate={updateSettingsMutation.mutate}
        />
        <WebhookForwardingSettings 
          settings={settings}
          onUpdate={updateSettingsMutation.mutate}
        />
        <AutoMergeSettings 
          settings={settings}
          onUpdate={updateSettingsMutation.mutate}
        />
      </div>
    </div>
  );
};
```

### Assignment Limit Settings Component
```typescript
interface AssignmentLimitSettingsProps {
  settings: RepositorySettings;
  onUpdate: (settings: Partial<RepositorySettings>) => void;
}

const AssignmentLimitSettings: React.FC<AssignmentLimitSettingsProps> = ({ settings, onUpdate }) => {
  const [limit, setLimit] = useState(settings.monthlyAssignmentLimit);
  
  const handleSave = () => {
    onUpdate({ monthlyAssignmentLimit: limit });
  };
  
  const progressPercentage = (settings.monthlyAssignmentsUsed / settings.monthlyAssignmentLimit) * 100;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Assignment Limit</CardTitle>
        <CardDescription>
          Control how many issues can be assigned to Copilot per month
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-4">
          <Label htmlFor="monthly-limit">Monthly Limit</Label>
          <Input
            id="monthly-limit"
            type="number"
            min={1}
            max={50}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="w-20"
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Used this month</span>
            <span>{settings.monthlyAssignmentsUsed} / {settings.monthlyAssignmentLimit}</span>
          </div>
          <Progress value={progressPercentage} />
        </div>
        
        <div className="text-sm text-muted-foreground">
          Resets on the 1st of next month
        </div>
        
        <Button onClick={handleSave} disabled={limit === settings.monthlyAssignmentLimit}>
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
};
```

### Webhook Forwarding Settings Component
```typescript
interface WebhookForwardingSettingsProps {
  settings: RepositorySettings;
  onUpdate: (settings: Partial<RepositorySettings>) => void;
}

const WebhookForwardingSettings: React.FC<WebhookForwardingSettingsProps> = ({ settings, onUpdate }) => {
  const [forwardUrl, setForwardUrl] = useState(settings.webhookForwardUrl || '');
  const [isEnabled, setIsEnabled] = useState(!!settings.webhookForwardUrl);
  
  const testWebhookMutation = useMutation(testWebhookForwarding);
  
  const handleSave = () => {
    onUpdate({ 
      webhookForwardUrl: isEnabled ? forwardUrl : null 
    });
  };
  
  const handleTest = () => {
    if (forwardUrl) {
      testWebhookMutation.mutate({ url: forwardUrl });
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhook Forwarding</CardTitle>
        <CardDescription>
          Forward webhook events to an external URL for this repository
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="webhook-enabled"
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
          />
          <Label htmlFor="webhook-enabled">Enable webhook forwarding</Label>
        </div>
        
        {isEnabled && (
          <div className="space-y-2">
            <Label htmlFor="webhook-url">Forwarding URL</Label>
            <div className="flex space-x-2">
              <Input
                id="webhook-url"
                type="url"
                placeholder="https://your-service.com/webhook"
                value={forwardUrl}
                onChange={(e) => setForwardUrl(e.target.value)}
              />
              <Button 
                variant="outline" 
                onClick={handleTest}
                disabled={!forwardUrl || testWebhookMutation.isLoading}
              >
                {testWebhookMutation.isLoading ? 'Testing...' : 'Test'}
              </Button>
            </div>
            {testWebhookMutation.data && (
              <p className="text-sm text-green-600">
                ✓ Webhook test successful
              </p>
            )}
            {testWebhookMutation.error && (
              <p className="text-sm text-red-600">
                ✗ Webhook test failed
              </p>
            )}
          </div>
        )}
        
        <Button onClick={handleSave}>
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
};
```

### Repository Selector Component
```typescript
interface RepositorySelectorProps {
  repositories: UserRepository[];
  currentRepository?: UserRepository;
  onRepositoryChange: (repository: UserRepository) => void;
}

const RepositorySelector: React.FC<RepositorySelectorProps> = ({
  repositories,
  currentRepository,
  onRepositoryChange
}) => {
  return (
    <Select 
      value={currentRepository?.id} 
      onValueChange={(id) => {
        const repo = repositories.find(r => r.id === id);
        if (repo) onRepositoryChange(repo);
      }}
    >
      <SelectTrigger className="w-[300px]">
        <SelectValue placeholder="Select repository">
          {currentRepository && (
            <div className="flex items-center space-x-2">
              <Github className="h-4 w-4" />
              <span>{currentRepository.owner}/{currentRepository.repo}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {repositories.map((repo) => (
          <SelectItem key={repo.id} value={repo.id}>
            <div className="flex items-center space-x-2">
              <Github className="h-4 w-4" />
              <span>{repo.owner}/{repo.repo}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
```

## Integration with Assignment System

### Modified Assignment Logic
```typescript
class CopilotAssignmentService {
  async assignToIssue(owner: string, repo: string, issueNumber: number, userId: string): Promise<boolean> {
    // Get repository ID
    const repository = await repositoryService.getByOwnerRepo(userId, owner, repo);
    
    // Check assignment limit
    const canAssign = await assignmentTrackingService.canAssignTask(userId, repository.id);
    if (!canAssign) {
      throw new Error('Monthly assignment limit exceeded for this repository');
    }
    
    // Proceed with assignment
    const success = await this.performAssignment(owner, repo, issueNumber);
    
    if (success) {
      // Record the assignment
      await assignmentTrackingService.recordAssignment(userId, repository.id);
    }
    
    return success;
  }
}
```

## Testing Strategy

### Unit Tests
- Repository settings service functions
- Monthly reset logic
- Assignment limit validation

### Integration Tests
- Settings page functionality
- Repository switching behavior
- Assignment limit enforcement

### API Tests
- Repository settings endpoints
- Current repository management
- Webhook forwarding tests

## Migration Strategy

### Data Migration
1. Add new columns with safe defaults
2. Migrate existing webhook URLs from user to repository level
3. Set initial current repository for each user

### Feature Rollout
1. Deploy backend changes with feature flags
2. Test repository settings functionality
3. Enable frontend components
4. Remove old webhook settings

## Security Considerations

### Access Control
- Users can only access settings for their own repositories
- Validate repository ownership before allowing settings changes
- Sanitize webhook URLs to prevent SSRF attacks

### Data Validation
- Validate monthly limits (1-50 range)
- Validate webhook URLs (proper format, HTTPS preferred)
- Rate limiting for settings updates