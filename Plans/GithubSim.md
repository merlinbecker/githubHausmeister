# GitHub Repository Simulation Plan für GitHub Hausmeister

## Übersicht

Dieses Dokument beschreibt die Implementierung einer vollständigen GitHub Repository Simulation für Testzwecke, die durch das Feature Flag `MOCK_LOGIN` aktiviert wird.

## Ziele

1. **Testumgebung ohne GitHub-Abhängigkeiten**: Ermöglicht vollständige Tests der Anwendung ohne echte GitHub OAuth oder API-Aufrufe
2. **Reproduzierbare Testszenarien**: Konsistente Mock-Daten für deterministische Tests
3. **Vollständiger Workflow-Test**: Simulation des kompletten Lebenszyklus von Issue-Erstellung bis Auto-Merge
4. **Entwicklungseffizienz**: Schnelle Iteration ohne externe API-Limitierungen

## Architektur-Übersicht

### Feature Flag System
```
Environment Variable: MOCK_LOGIN=true
├── Bypasses GitHub OAuth Flow
├── Activates Mock Repository System  
├── Simulates Webhook Events
└── Mocks Copilot Interactions
```

## Komponenten-Design

### 1. Mock Authentication Service

**Datei**: `server/lib/mock-auth-service.ts`

```typescript
interface MockUser {
  id: string;
  username: string;
  email: string;
  avatarUrl: string;
  accessToken: string; // Mock token for consistent API simulation
}

interface MockAuthConfig {
  users: MockUser[];
  defaultUserId?: string;
}

class MockAuthService {
  // Simuliert OAuth Flow ohne externe Abhängigkeiten
  // Erzeugt konsistente Mock-Tokens
  // Verwaltet Mock-User-Sessions
}
```

**Features**:
- Vordefinierte Test-Benutzer
- Konsistente Mock-Token-Generierung
- Session-Management kompatibel mit bestehender Auth-Middleware

### 2. Mock GitHub Repository System

**Datei**: `server/lib/mock-github-service.ts`

```typescript
interface MockRepository {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  permissions: { admin: boolean; push: boolean };
  // Simulation State
  issues: MockIssue[];
  pullRequests: MockPullRequest[];
  webhooks: MockWebhook[];
  collaborators: MockCollaborator[];
}

interface MockIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  assignees: string[];
  // Lifecycle tracking
  copilotAssigned: boolean;
  prCreated?: number; // PR number
  ciStatus: 'pending' | 'success' | 'failure';
  autoMerged: boolean;
}

class MockGitHubService {
  // Repository Management
  listUserRepositories(token: string): MockRepository[]
  getRepository(owner: string, repo: string): MockRepository
  
  // Issue Management  
  createIssue(owner: string, repo: string, issue: CreateIssueRequest): MockIssue
  assignIssue(owner: string, repo: string, issueNumber: number, assignee: string): void
  
  // Pull Request Lifecycle
  createPullRequest(owner: string, repo: string, pr: CreatePRRequest): MockPullRequest
  updatePRStatus(owner: string, repo: string, prNumber: number, status: string): void
  mergePullRequest(owner: string, repo: string, prNumber: number): void
  
  // Webhook Simulation
  simulateWebhookEvent(event: MockWebhookEvent): void
}
```

**Features**:
- In-Memory Repository State Management
- Konsistente Mock-Daten für verschiedene Szenarien
- Simulation von GitHub API Responses
- Webhook Event Generation

### 3. Mock Webhook Event System

**Datei**: `server/lib/mock-webhook-service.ts`

```typescript
interface MockWebhookEvent {
  type: 'issues' | 'pull_request' | 'pull_request_review';
  action: string;
  repository: { name: string; owner: { login: string } };
  payload: any;
  timestamp: Date;
}

class MockWebhookService {
  // Generiert realistische Webhook Events
  // Simuliert GitHub Event Timing
  // Triggert bestehende Webhook Handler
  
  generateIssueAssignedEvent(issue: MockIssue): MockWebhookEvent
  generatePRCreatedEvent(pr: MockPullRequest): MockWebhookEvent  
  generatePRReadyEvent(pr: MockPullRequest): MockWebhookEvent
  generateCIStatusEvent(pr: MockPullRequest, status: 'success' | 'failure'): MockWebhookEvent
}
```

### 4. Mock GitHub Copilot Simulation

**Datei**: `server/lib/mock-copilot-service.ts`

```typescript
interface MockCopilotBehavior {
  assignmentDelay: number; // ms
  prCreationDelay: number; // ms  
  ciSuccessRate: number; // 0-1
  autoRetryOnFailure: boolean;
}

class MockCopilotService {
  // Simuliert Copilot Workflow
  async simulateIssueAssignment(issue: MockIssue): Promise<void>
  async simulatePRCreation(issue: MockIssue): Promise<MockPullRequest>
  async simulateCIExecution(pr: MockPullRequest): Promise<'success' | 'failure'>
  
  // Konfigurierbare Timing und Erfolgsraten
  configureBehavior(behavior: Partial<MockCopilotBehavior>): void
}
```

## UI Komponenten

### 1. Mock Login Component

**Datei**: `client/src/components/MockLogin.tsx`

```typescript
interface MockLoginProps {
  availableUsers: MockUser[];
  onUserSelect: (user: MockUser) => void;
}

// Features:
// - User Selection Dropdown
// - Mock Repository Preview
// - Quick Login für Test-Szenarien
```

### 2. Mock Repository Dashboard

**Datei**: `client/src/components/MockRepositoryDashboard.tsx`

```typescript
// Features:
// - Repository State Visualization
// - Manual Event Trigger Controls
// - Issue/PR Lifecycle Monitoring
// - Webhook Event Log
// - Copilot Simulation Controls
```

### 3. Repository Simulation Controls

**Datei**: `client/src/components/RepositorySimulationControls.tsx`

```typescript
// Features:
// - CI Status Override
// - Webhook Event Injection
// - Timeline Acceleration
// - Scenario Reset Functions
```

## Datenschicht-Integration

### Mock Data Storage

**Datei**: `server/lib/mock-data-storage.ts`

```typescript
class MockDataStorage {
  // In-Memory Storage mit optionaler Persistierung
  // Kompatibilität mit bestehender DatabaseStorage API
  // State Reset für deterministische Tests
  
  // Repository State
  private repositories: Map<string, MockRepository> = new Map();
  private issues: Map<string, MockIssue[]> = new Map();
  private pullRequests: Map<string, MockPullRequest[]> = new Map();
  
  // User State  
  private users: Map<string, MockUser> = new Map();
  private sessions: Map<string, MockSession> = new Map();
  
  // State Management
  reset(): void // Zurück zu Initial State
  export(): MockDataExport // Für Test-Snapshots
  import(data: MockDataExport): void // State Restoration
}
```

## Integration mit bestehender Architektur

### 1. Feature Flag Detection

**Datei**: `server/lib/feature-flags.ts`

```typescript
export const isFeatureFlagEnabled = (flag: string): boolean => {
  return process.env[flag] === 'true';
};

export const isMockModeEnabled = (): boolean => {
  return isFeatureFlagEnabled('MOCK_LOGIN');
};
```

### 2. Service Factory Pattern

**Datei**: `server/lib/service-factory.ts`

```typescript
export class ServiceFactory {
  static createAuthService(): GitHubOAuth | MockAuthService {
    return isMockModeEnabled() 
      ? new MockAuthService(mockConfig)
      : new GitHubOAuth(oauthConfig);
  }
  
  static createGitHubService(): GitHubRestService | MockGitHubService {
    return isMockModeEnabled()
      ? new MockGitHubService()
      : new GitHubRestService();
  }
}
```

### 3. Route Handler Updates

**Bestehende Dateien erweitern**:
- `server/routes.ts`: Feature Flag Detection
- `client/src/pages/login.tsx`: Mock Login Integration
- `client/src/pages/dashboard.tsx`: Mock Repository Dashboard

## Test-Szenarien

### 1. Basis-Szenarien

```typescript
// Erfolgreicher End-to-End Workflow
const successScenario = {
  user: mockUsers.developer,
  repository: mockRepositories.testRepo,
  behavior: {
    assignmentDelay: 100,
    prCreationDelay: 500,
    ciSuccessRate: 1.0
  }
};

// CI Failure Scenario
const ciFailureScenario = {
  behavior: {
    ciSuccessRate: 0.0,
    autoRetryOnFailure: true
  }
};

// Rate Limiting Scenario  
const rateLimitScenario = {
  behavior: {
    apiDelay: 2000,
    rateLimitHit: true
  }
};
```

### 2. Erweiterte Szenarien

- **Multiple Repository Testing**: Gleichzeitige Simulation mehrerer Repositories
- **Webhook Failure Recovery**: Simulation von Webhook-Ausfällen und Recovery
- **Copilot Assignment Conflicts**: Mehrere Assignments gleichzeitig
- **Queue Management**: Task Queue Overflow und Prioritization

## Implementierung-Roadmap

### Phase 1: Grundlagen (Tag 1)
- [x] Feature Flag System
- [x] Mock Authentication Service
- [x] Basic Mock Repository Structure
- [x] Integration in bestehende Auth Routes

### Phase 2: Core Simulation (Tag 2-3)
- [ ] Mock GitHub API Service
- [ ] Webhook Event Simulation
- [ ] Basic UI Components für Mock Mode
- [ ] Integration mit bestehender Task Queue

### Phase 3: Advanced Features (Tag 4-5)
- [ ] Copilot Workflow Simulation
- [ ] CI/CD Pipeline Simulation
- [ ] Advanced UI Controls
- [ ] Repository State Management

### Phase 4: Testing & Polish (Tag 6)
- [ ] Comprehensive Test Scenarios
- [ ] Performance Optimization
- [ ] Documentation
- [ ] Error Handling

## Konfiguration

### Environment Variables

```bash
# Mock Mode Activation
MOCK_LOGIN=true

# Mock Configuration  
MOCK_USERS_FILE=./data/mock-users.json
MOCK_REPOSITORIES_FILE=./data/mock-repositories.json
MOCK_SCENARIOS_FILE=./data/mock-scenarios.json

# Simulation Behavior
MOCK_COPILOT_DELAY=1000
MOCK_CI_SUCCESS_RATE=0.8
MOCK_WEBHOOK_DELAY=500
```

### Mock Data Files

**`data/mock-users.json`**:
```json
{
  "users": [
    {
      "id": "mock-user-1",
      "username": "testdev",
      "email": "test@example.com",
      "avatarUrl": "https://avatar.example.com/testdev"
    }
  ]
}
```

**`data/mock-repositories.json`**:
```json
{
  "repositories": [
    {
      "id": 1,
      "name": "test-repo",
      "full_name": "testdev/test-repo",
      "owner": { "login": "testdev" },
      "permissions": { "admin": true, "push": true }
    }
  ]
}
```

## Sicherheitsüberlegungen

1. **Mock Mode Detection**: Klare Kennzeichnung von Mock-Modus in UI
2. **Data Isolation**: Mock-Daten niemals mit Produktion vermischen
3. **Secret Management**: Keine echten Tokens in Mock-Konfiguration
4. **Access Control**: Mock-Modus nur in Development/Test-Umgebungen

## Performance-Überlegungen

1. **Memory Management**: Efficient Mock Data Storage
2. **Event Throttling**: Simulation Rate Limiting
3. **State Cleanup**: Garbage Collection für abgeschlossene Simulationen
4. **Scalability**: Support für Multiple Concurrent Simulations

## Monitoring und Debugging

1. **Mock Event Logging**: Detaillierte Logs für Simulation Events
2. **State Inspection**: Tools zur Mock-State Visualisierung
3. **Performance Metrics**: Simulation Performance Tracking
4. **Error Reporting**: Enhanced Error Messages für Mock-Fehler

## Fazit

Diese Implementierung ermöglicht vollständige Tests der GitHub Hausmeister Anwendung ohne externe Abhängigkeiten, während die bestehende Architektur minimal verändert wird. Der Service Factory Pattern sorgt für saubere Trennung zwischen Mock und Production Code, und das Feature Flag System ermöglicht einfaches Umschalten zwischen den Modi.