# GitHub Hausmeister - Architektur-Dokumentation

**Über arc42**

arc42, das Template zur Dokumentation von Software- und
Systemarchitekturen.

Template Version 8.2 DE. (basiert auf AsciiDoc Version), Januar 2023

Created, maintained and © by Dr. Peter Hruschka, Dr. Gernot Starke and
contributors. Siehe <https://arc42.org>.

# Einführung und Ziele

## Aufgabenstellung

GitHub Hausmeister ist eine automatisierte GitHub-Wartungsanwendung, die Repository-Wartung durch das Erstellen von Chore-Issues, deren Zuweisung an GitHub Copilot-Agenten und das automatische Mergen von Pull Requests nach CI-Validierung optimiert. Die Anwendung stellt ein zentralisiertes Dashboard zur Überwachung automatisierter Wartungsaufgaben über mehrere Repositories hinweg mit konfigurierbaren monatlichen Limits und Einzelaufgaben-Nebenläufigkeitskontrollen bereit.

### Kernfunktionen

- **Automatisierte Issue-Erstellung**: Erstellt Wartungsaufgaben (Tests, Linting, Types, Sicherheitsupdates) für ausgewählte Repositories
- **Copilot-Integration**: Weist automatisch GitHub Copilot-Agenten zu Issues über die GraphQL API zu
- **CI-Überwachung**: Überwacht Pull Requests und genehmigt/merged automatisch, wenn CI erfolgreich ist
- **Webhook-Integration**: Echtzeitbehandlung von GitHub-Events (Issues, PRs, CI-Abschluss)
- **Task Queue Management**: Einzelaufgaben-Nebenläufigkeit mit konfigurierbaren monatlichen Limits
- **PWA Push-Benachrichtigungen**: Real-time Push-Notifications für Task-Updates, PR-Status und CI-Ereignisse
- **Mobile-First UI**: Dunkles GitHub-themed Dashboard für Überwachung und Kontrolle mit PWA-Installation

## Qualitätsziele

| Priorität | Qualitätsziel              | Szenario                                                        |
| --------- | -------------------------- | --------------------------------------------------------------- |
| 1         | **Zuverlässigkeit**        | System muss GitHub Webhooks ohne Verlust verarbeiten            |
| 2         | **Skalierbarkeit**         | Unterstützung mehrerer Benutzer und Repositories                |
| 3         | **Benutzerfreundlichkeit** | Mobile-first responsive Design                                  |
| 4         | **Sicherheit**             | Sichere GitHub Token-Authentifizierung und Webhook-Verifikation |
| 5         | **Wartbarkeit**            | Modulare Architektur mit klarer Trennung der Concerns           |

## Stakeholder

| Rolle                    | Kontakt          | Erwartungshaltung                                                     |
| ------------------------ | ---------------- | --------------------------------------------------------------------- |
| **Entwickler**           | Repository Owner | Automatisierung von Repository-Wartungsaufgaben                       |
| **GitHub Copilot**       | AI Agent         | Empfang und Bearbeitung zugewiesener Issues                           |
| **CI/CD System**         | GitHub Actions   | Bereitstellung von Build-Status für automatische Merge-Entscheidungen |
| **System Administrator** | DevOps Team      | Überwachung der Anwendungsleistung und -integrität                    |

# Randbedingungen

## Technische Randbedingungen

| Constraint              | Beschreibung                                 |
| ----------------------- | -------------------------------------------- |
| **Frontend Framework**  | React 18 mit TypeScript und Vite            |
| **Backend Framework**   | Express.js mit TypeScript                    |
| **UI Framework**        | shadcn/ui Komponenten mit Tailwind CSS      |
| **Deployment Platform** | Replit mit integriertem Secrets Management   |
| **Database**            | PostgreSQL (Neon Serverless) mit Drizzle ORM |
| **State Management**    | TanStack Query für Server State              |
| **Build System**        | Vite (Frontend) + ESBuild (Backend)          |
| **GitHub API Limits**   | Rate Limiting durch GitHub REST/GraphQL APIs |
| **Node.js Runtime**     | ES Modules, TypeScript-first Entwicklung     |
| **PWA Requirements**    | Service Worker, Web Push, VAPID Authentication |

## Organisatorische Randbedingungen

| Constraint                  | Beschreibung                                                            |
| --------------------------- | ----------------------------------------------------------------------- |
| **GitHub OAuth**            | Erfordert GitHub OAuth App für Multi-User Authentication               |
| **Repository Access**       | User-spezifische GitHub Tokens via OAuth                               |
| **Monthly Task Limits**     | Konfigurierbare Limits zur Verhinderung von API Rate Limiting           |
| **Single Task Concurrency** | Nur eine aktive Aufgabe gleichzeitig pro User zur Konfliktverhinderung |
| **Multi-Tenancy**           | Unterstützung mehrerer Benutzer mit isolierten Repositories            |

## Konfiguration und Umgebungsvariablen

### Erforderliche Environment Variables (Replit Secrets)

| Variable                | Beschreibung                                                                              | Beispielwert                | Erforderlich      |
| ----------------------- | ----------------------------------------------------------------------------------------- | --------------------------- | ----------------- |
| `DATABASE_URL`          | PostgreSQL Verbindungsstring (Neon Serverless)                                            | `postgresql://user:pass@...` | ✅                |
| `GITHUB_CLIENT_ID`      | GitHub OAuth App Client ID                                                               | `Iv1.a1b2c3d4e5f6g7h8`      | ✅                |
| `GITHUB_CLIENT_SECRET`  | GitHub OAuth App Client Secret                                                           | `a1b2c3d4e5f6g7h8i9j0...`   | ✅                |
| `GITHUB_REDIRECT_URI`   | OAuth Redirect URI                                                                        | `https://app.replit.dev/auth/callback` | ✅ |
| `GITHUB_WEBHOOK_SECRET` | Secret für GitHub Webhook-Signatur-Verifikation                                           | `super_secret_webhook_key`  | ✅                |
| `SESSION_SECRET`        | Secret für Express Session Encryption                                                    | `random_session_secret_key` | ✅                |
| `COPILOT_ACTOR_ID`      | NodeID des GitHub Copilot Coding Agents (optional)                                        | `MDQ6VXNlcjxxxxxxxxx`       | ❌                |
| `MAX_MONTHLY_TASKS`     | Maximale Anzahl Tasks pro Monat                                                           | `50`                        | ❌ (Standard: 50) |
| `VAPID_PUBLIC_KEY`      | VAPID Public Key für Push-Benachrichtigungen                                              | `BCVxZ2z3TZr...`            | ❌ (für PWA)      |
| `VAPID_PRIVATE_KEY`     | VAPID Private Key für Push-Benachrichtigungen                                             | `WzG5kR8kF2h...`            | ❌ (für PWA)      |
| `VAPID_SUBJECT`         | VAPID Subject (E-Mail oder URL)                                                           | `mailto:admin@example.com`  | ❌ (für PWA)      |
| `PORT`                  | Server Port (Replit setzt dies automatisch)                                               | `3000`                      | ❌                |
| `REPLIT_DEV_DOMAIN`     | Development Domain (automatisch gesetzt)                                                  | `abc123-3000.preview...`    | ❌                |
| `COPILOT_CACHE_TTL`     | Cache TTL für Copilot Assignments in Sekunden                                             | `300`                       | ❌ (Standard: 300)|

### Dateisystem-Struktur

Das System implementiert eine modulare Frontend/Backend-Architektur mit React + Vite und Express.js:

```
/client/src/                    # React Frontend (Vite)
  /components/                  # UI Komponenten
    StatusOverview.tsx          # Dashboard Status
    TaskQueue.tsx               # Task-Warteschlange
    ActiveTaskCard.tsx          # Aktive Task Anzeige
    SystemControls.tsx          # System-Steuerung
    WebhookSettings.tsx         # Webhook-Konfiguration
    Collaborators.tsx           # Repository-Mitarbeiter
  /pages/                       # Route-Komponenten
    dashboard.tsx               # Haupt-Dashboard
    login.tsx                   # GitHub OAuth Login
    developer-tools.tsx         # Entwickler-Tools
    mock-login.tsx              # Mock Login (Development)
  /hooks/                       # React Hooks
    useAuth.ts                  # Authentifizierung
    usePushNotifications.ts     # Push-Benachrichtigungen
    useNotificationPrompt.ts    # Notification Prompts
  /lib/                         # Frontend Utils
    queryClient.ts              # TanStack Query Client

/server/                        # Express.js Backend
  index.ts                      # Server Entry Point
  routes.ts                     # API Route Handlers
  /lib/                         # Business Logic Layer
    github-rest.ts              # GitHub REST API Integration
    github-graphql.ts           # GitHub GraphQL API
    copilot-assignment.ts       # Copilot Agent Assignment
    queue.ts                    # Task Queue Management
    database-storage.ts         # Database Operations
    auth-middleware.ts          # Authentication Middleware
    github-oauth.ts             # GitHub OAuth Handler
    notificationService.ts      # Push Notification Service
    webPush.ts                  # Web Push Implementation
    webhook-verify.ts           # Webhook Signature Verification
    ci.ts                       # CI Status Checks
    mentraService.ts            # Mentra Integration
    vapid.ts                    # VAPID Key Management
    feature-flags.ts            # Feature Flag System
    mock-auth-service.ts        # Mock Authentication (Dev)

/shared/                        # Gemeinsame TypeScript Types
  schema.ts                     # Database Schema & Zod Validations

/data/                          # Legacy: Wird nicht mehr verwendet
  # System nutzt jetzt vollständig PostgreSQL

/tests/                         # Test Suites
  /server/lib/                  # Server Logic Tests

/documentation/                 # Projekt-Dokumentation
  arc42.md                      # Diese Architekturdokumentation
  repository-status.md          # Repository Status Analysis
```

# Kontextabgrenzung

## Fachlicher Kontext

```mermaid
graph TB
    Developer[Entwickler] --> GH[GitHub Hausmeister]
    GH --> GitHub[GitHub Platform]
    GH --> Copilot[GitHub Copilot Agent]
    GitHub --> Webhooks[Webhook Events]
    Webhooks --> GH
    GH --> CI[GitHub Actions CI]
    CI --> GitHub

    Developer -.- |"Repository Management,<br/>Task Creation"| GH
    GH -.- |"Issue Creation,<br/>PR Management,<br/>Webhook Registration"| GitHub
    GH -.- |"Agent Assignment<br/>via GraphQL"| Copilot
    Webhooks -.- |"Real-time Events<br/>(Issues, PRs, CI)"| GH
    GH -.- |"Status Monitoring,<br/>Auto-Merge"| CI
```

**Externe fachliche Schnittstellen:**

- **GitHub Platform**: Repository-Operationen, Issue/PR-Management, Webhook-Events
- **GitHub Copilot**: Automatische Agent-Zuweisung für Wartungsaufgaben
- **GitHub Actions**: CI-Status-Überwachung und automatische Merge-Operationen

## Technischer Kontext

```mermaid
graph TB
    subgraph "Replit Platform"
        WebUI[Web UI<br/>React + Vite]
        API[Express.js API<br/>Backend]
        DB[(PostgreSQL<br/>Database)]
    end

    subgraph "GitHub Platform"
        REST[GitHub REST API v3]
        GraphQL[GitHub GraphQL API v4]
        Webhooks[GitHub Webhooks]
        Actions[GitHub Actions]
    end

    subgraph "External Services"
        Neon[(Neon PostgreSQL<br/>Serverless)]
    end

    WebUI <--> API
    API <--> DB
    API <--> REST
    API <--> GraphQL
    Webhooks --> API
    API --> Actions
    DB <--> Neon

    WebUI -.- |"HTTPS/JSON"| API
    API -.- |"HTTPS/JSON<br/>Authentication: Bearer Token"| REST
    API -.- |"HTTPS/GraphQL<br/>Authentication: Bearer Token"| GraphQL
    Webhooks -.- |"HTTPS/JSON<br/>HMAC-SHA256 Signature"| API
    API -.- |"SQL over TLS"| Neon
```

**Technische Schnittstellen:**

- **GitHub REST API v3**: Repository-Management, Issue/PR-Operationen, Webhook-Registrierung
- **GitHub GraphQL API v4**: Copilot-Agent-Zuweisung und erweiterte Abfragen
- **GitHub Webhooks**: Echtzeitverarbeitung von Events mit HMAC-SHA256-Verifikation
- **PostgreSQL via Drizzle ORM**: Typsichere Datenbankoperationen
- **Web Push API**: PWA Push-Benachrichtigungen über VAPID-Protokoll
- **Service Worker API**: Offline-Funktionalität und Background-Push-Verarbeitung

# Lösungsstrategie

## Architekturmuster

| Aspekt                   | Entscheidung                                | Begründung                                                                            |
| ------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Frontend-Architektur** | React + TypeScript + Vite                   | Schnelle Entwicklungserfahrung, optimiertes Bundling                                  |
| **Backend-Architektur**  | Express.js RESTful API                      | Bewährtes Node.js Framework mit klarer API-Struktur                                   |
| **Daten-Persistierung**  | PostgreSQL + Drizzle ORM                    | Type-safe Database Operations, Multi-User Support, ACID-Garantien                     |
| **GitHub Integration**   | REST + GraphQL APIs                         | REST für Standard-Operationen, GraphQL für Copilot-spezifische Features               |
| **Task Management**      | Single-Task Queue mit Persistierung         | Verhindert Konflikte, einfache Implementierung                                        |

## Technologie-Entscheidungen

| Bereich              | Technologie          | Begründung                                      |
| -------------------- | -------------------- | ----------------------------------------------- |
| **UI Framework**     | shadcn/ui + Radix UI | Zugänglichkeit, konsistentes Design System      |
| **State Management** | TanStack Query       | Server State Management, Caching, Data Fetching |
| **Routing**          | Wouter               | Leichtgewichtige Alternative zu React Router    |
| **Styling**          | Tailwind CSS         | Utility-first, mobile-first responsive Design   |
| **ORM**              | Drizzle ORM          | Type-safe, schema-first Datenbankoperationen    |

## Implementierungsdetails

### GitHub GraphQL Integration für Copilot-Zuweisung

Das System implementiert einen robusten Copilot-Assignment-Service mit mehreren Fallback-Strategien:

**Aktueller Implementierungsstand**: Ein vollständiger `CopilotAssignmentService` (589 Zeilen Code) mit:

- **Multi-Strategie-Agent-Discovery**: Environment Variable → Repository-basierte Suche → GraphQL Suche → Fallback
- **Caching**: Agent-Informationen werden gecacht für bessere Performance
- **Retry-Mechanismen**: Automatische Wiederholung bei fehlgeschlagenen Assignments  
- **Verification**: Überprüfung erfolgreicher Zuweisung mit konfigurierbarer Verzögerung
- **Updated GraphQL**: Verwendet `replaceActorsForAssignable` statt deprecated `addAssigneesToAssignable`

#### Zentrale Service-Klasse

```typescript
// server/lib/copilot-assignment.ts (Aktuelle Implementierung)
export class CopilotAssignmentService {
  constructor(private token: string, config?: Partial<CopilotConfig>)

  // Agent Discovery mit Multi-Level Fallback
  async findBestAgent(owner: string, repo: string): Promise<AgentInfo>
  
  // Issue-Assignment mit Retry und Verification  
  async assignToIssue(owner: string, repo: string, issueNumber: number): Promise<AssignmentResult>
  
  // Verification der erfolgreichen Zuweisung
  async verifyAssignment(owner: string, repo: string, issueNumber: number): Promise<VerificationResult>
}
```

**GitHub's Recommended GraphQL Approach**: Das System implementiert die von GitHub empfohlene GraphQL-Mutation:

```graphql
mutation {
  replaceActorsForAssignable(input: {
    assignableId: $issueNodeId,
    actorIds: [$copilotAgentId]
  }) {
    assignable { ... on Issue { assignees(first: 10) { nodes { login, id } } } }
  }
}
```

### CI-Status-Überprüfung

Umfassende CI-Validierung mit sowohl GitHub Status API als auch Checks API:

```typescript
// server/lib/ci.ts (Aktuelle Implementierung)
export async function isPRGreen(token: string, owner: string, repo: string, sha: string): Promise<boolean> {
  const octokit = new Octokit({ auth: token });

  const [statusRes, checksRes] = await Promise.all([
    octokit.rest.repos.getCombinedStatusForRef({ owner, repo, ref: sha }),
    octokit.rest.checks.listForRef({ owner, repo, ref: sha }),
  ]);

  // Berücksichtigt auch den Fall ohne CI-Checks (neutral state)
  const allStatusesOk = statusRes.data.state === 'success' || statusRes.data.statuses.length === 0;
  const allChecksOk = checksRes.data.check_runs.every(
    (cr) => cr.conclusion === 'success' || cr.conclusion === 'neutral'
  );

  return allStatusesOk && allChecksOk;
}

export async function getCIStatus(token: string, owner: string, repo: string, sha: string) {
  // Detaillierte CI-Status-Informationen für Dashboard-Anzeige
  const [statusRes, checksRes] = await Promise.all([
    octokit.rest.repos.getCombinedStatusForRef({ owner, repo, ref: sha }),
    octokit.rest.checks.listForRef({ owner, repo, ref: sha }),
  ]);

  return {
    combined: statusRes.data.state,
    statuses: statusRes.data.statuses,
    checks: checksRes.data.check_runs,
  };
}
```

### REST API Operationen

#### GitHub REST Client (Octokit-basiert)

```typescript
// lib/github-rest.ts (Referenzimplementierung)
import { Octokit } from 'octokit';

export const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export async function createIssue(
  owner: string,
  repo: string,
  title: string,
  body: string,
  labels: string[] = []
) {
  const { data } = await octokit.rest.issues.create({
    owner,
    repo,
    title,
    body,
    labels,
  });
  return data; // includes number, id, node_id
}

export async function getIssue(
  owner: string,
  repo: string,
  issue_number: number
) {
  return (await octokit.rest.issues.get({ owner, repo, issue_number })).data;
}

export async function createReviewApprove(
  owner: string,
  repo: string,
  pull_number: number,
  body = 'LGTM (auto)'
) {
  return octokit.rest.pulls.createReview({
    owner,
    repo,
    pull_number,
    event: 'APPROVE',
    body,
  });
}

export async function mergePullRequest(
  owner: string,
  repo: string,
  pull_number: number,
  method: 'merge' | 'squash' | 'rebase' = 'squash'
) {
  return octokit.rest.pulls.merge({
    owner,
    repo,
    pull_number,
    merge_method: method,
  });
}

export async function listPRsForIssue(
  owner: string,
  repo: string,
  issue_number: number
) {
  // PRs referenzieren das Issue per „Closes #<nr>"; alternativ: search
  const { data } = await octokit.rest.search.issuesAndPullRequests({
    q: `repo:${owner}/${repo} type:pr in:body is:open "${`#${issue_number}`}"`,
  });
  return data.items;
}
```

### State Management und Queue-System

**Aktuelle Implementierung**: Das System verwendet eine robuste PostgreSQL-basierte Datenpersistierung mit Drizzle ORM anstatt JSON-Files:

#### Database Schema (PostgreSQL mit Drizzle ORM)

```typescript
// shared/schema.ts (Aktuelle Datenbankstruktur)
export const users = pgTable('users', {
  id: varchar('id').primaryKey(), // GitHub user ID
  username: text('username').notNull(),
  accessToken: text('access_token').notNull(),
  // ... weitere User-Felder
});

export const tasks = pgTable('tasks', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar('user_id').references(() => users.id),
  owner: text('owner').notNull(),
  repo: text('repo').notNull(),
  title: text('title').notNull(),
  status: text('status').default('queued'), // queued, in_progress, completed, failed
  issueNumber: integer('issue_number'),
  pullNumber: integer('pull_number'),
  // ... weitere Task-Felder
});

export const userSystemState = pgTable('user_system_state', {
  userId: varchar('user_id').primaryKey(),
  systemRunning: boolean('system_running').default(false),
  monthlyTasksCreated: integer('monthly_tasks_created').default(0),
  lastTaskCreatedAt: timestamp('last_task_created_at'),
  activeTaskId: varchar('active_task_id'),
});
```

#### Multi-User Queue Management

```typescript
// server/lib/queue.ts (Aktuelle Implementierung)
export async function startNextIfIdle(userId: string): Promise<void> {
  const appState = await databaseStorage.getUserAppState(userId);
  
  // Check system running and no active task
  if (!appState.systemRunning || appState.activeTask) return;

  // Get next queued task for this user
  const queuedTasks = appState.queue; // From database
  if (queuedTasks.length === 0) return;

  const maxTasks = Number(process.env.MAX_MONTHLY_TASKS || 50);
  if (appState.monthlyDone >= maxTasks) return;

  const nextTask = queuedTasks[0];
  
  // Mark as in_progress and create GitHub issue
  await databaseStorage.updateTask(nextTask.id, { status: 'in_progress' });
  
  const user = await databaseStorage.getUserById(userId);
  const issue = await createIssue(user.accessToken, nextTask.owner, nextTask.repo, ...);
  
  // Assign to Copilot via comprehensive service
  const copilotService = new CopilotAssignmentService(user.accessToken);
  await copilotService.assignToIssue(nextTask.owner, nextTask.repo, issue.number);
}
```
```

### Webhook-Verarbeitung und Signatur-Verifikation

#### HMAC-SHA256 Signatur-Verifikation

```typescript
// lib/webhook-verify.ts (Referenzimplementierung)
import crypto from 'crypto';

export function verifySignature(
  secret: string,
  payload: string,
  sig256: string | undefined
) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = `sha256=${hmac.update(payload).digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(sig256 || ''));
}
```

#### Webhook-Handler-Struktur

Das System verarbeitet folgende GitHub-Events:

- **`issues`** (assigned): Wenn Issues zugewiesen werden
- **`pull_request`** (opened, ready_for_review, reopened): PR-Lifecycle-Events
- **`check_suite.completed`** / **`workflow_run.completed`**: CI-Abschluss-Events

**Grundlegendes Webhook-Processing-Pattern**:

1. Signatur-Verifikation mit `GITHUB_WEBHOOK_SECRET`
2. Duplikat-Erkennung via `X-GitHub-Delivery` Header
3. Event-spezifische Verarbeitung basierend auf `X-GitHub-Event`
4. State-Update und Queue-Management
5. Automatische Weiterverarbeitung (Issue → PR → CI → Merge)

### PWA Push-Benachrichtigungen

Das System implementiert eine vollständige Progressive Web App mit Push-Benachrichtigungen über das VAPID-Protokoll.

#### PWA-Architektur

```mermaid
graph TB
    subgraph "PWA Frontend"
        Manifest[Web App Manifest]
        SW[Service Worker]
        PushManager[Push Manager]
        UI[React UI Components]
    end

    subgraph "Push Infrastructure"
        VAPID[VAPID Keys]
        WebPush[Web Push Library]
        NotificationService[Notification Service]
        DB[(Push Subscriptions)]
    end

    subgraph "Event Sources"
        Webhooks[GitHub Webhooks]
        TaskQueue[Task Queue Events]
        CIEvents[CI Status Events]
    end

    SW --> PushManager
    PushManager --> VAPID
    UI --> NotificationService
    NotificationService --> WebPush
    WebPush --> DB

    Webhooks --> NotificationService
    TaskQueue --> NotificationService
    CIEvents --> NotificationService
```

#### Event-zu-Notification Mapping

| Webhook Event     | Notification Type        | User Setting      | Priorität |
| ----------------- | ------------------------ | ----------------- | --------- |
| Task Started      | 🚀 Task gestartet        | `taskStarted`     | Hoch      |
| Task Completed    | ✅ Task abgeschlossen    | `taskCompleted`   | Hoch      |
| Task Failed       | ❌ Task fehlgeschlagen   | `taskFailed`      | Kritisch  |
| PR Created        | 📝 Pull Request erstellt | `prCreated`       | Mittel    |
| PR Merged         | 🎉 Pull Request gemergt  | `prMerged`        | Hoch      |
| Copilot Assigned  | 🤖 Copilot zugewiesen    | `copilotAssigned` | Mittel    |
| CI Status Changed | 🔄 CI-Status geändert    | `ciStatusChanged` | Niedrig   |

#### Service Worker Implementation

```typescript
// client/public/sw.js (Kernfunktionalität)
self.addEventListener('push', (event) => {
  const options = {
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'Öffnen', icon: '/icon-192.png' },
      { action: 'close', title: 'Schließen' },
    ],
  };

  let notificationData = {};
  if (event.data) {
    notificationData = event.data.json();
  }

  const title = notificationData.title || 'GitHub Hausmeister';
  const body = notificationData.body || 'Neue Aktivität';

  event.waitUntil(
    self.registration.showNotification(title, {
      ...options,
      body,
      tag: notificationData.tag || 'general',
      url: notificationData.url || '/',
      data: notificationData,
    })
  );
});
```

#### VAPID-Konfiguration

```typescript
// server/lib/webPush.ts
import webpush from 'web-push';

export function initializeWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys not configured');
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}
```

#### Database Schema-Erweiterung

```typescript
// shared/schema.ts (PWA-spezifische Tabellen)
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id),
  endpoint: text('endpoint').notNull(),
  p256dhKey: text('p256dh_key').notNull(),
  authKey: text('auth_key').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const notificationSettings = pgTable('notification_settings', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id),
  taskStarted: boolean('task_started').default(true),
  taskCompleted: boolean('task_completed').default(true),
  taskFailed: boolean('task_failed').default(true),
  prCreated: boolean('pr_created').default(true),
  prMerged: boolean('pr_merged').default(true),
  ciStatusChanged: boolean('ci_status_changed').default(false),
  copilotAssigned: boolean('copilot_assigned').default(true),
});
```

#### iOS PWA Besonderheiten

- **Mindestanforderung**: iOS 16.4+ für Push-Notifications
- **Installation erforderlich**: Push funktioniert nur in installierter PWA
- **Installation-Guide**: Step-by-Step Anweisungen für Benutzer
- **Graceful Fallback**: App funktioniert vollständig ohne Push

#### Security & Performance

**Security-Maßnahmen**:

- VAPID-Keys in Environment Variables
- Subscription-Endpoint Validation
- Rate Limiting für Notifications
- Explizite User-Consent pro Event-Type

**Performance-Optimierungen**:

- Batch-Processing für Multiple Subscriptions
- Automatic Cleanup ungültiger Subscriptions
- Service Worker Caching-Optimierung
- Database-Indizes für Push-Subscription Queries

### Chore-Task-Templates

**Aktueller Implementierungsstand**: Das System unterstützt sowohl Standard-Templates als auch benutzerdefinierten Repository-spezifische Templates über die Datenbank:

#### Standard Default Templates

```typescript
// server/routes.ts (Aktuelle Standard-Templates)
const defaultTemplates = {
  tests: {
    type: 'tests',
    title: 'Tests nachziehen (kritische Pfade)',
    body: 'Bitte Unit Tests für Kernfunktionen ergänzen. Ziel: Abdeckung +10%. Closes after CI green.',
    labels: ['chore', 'tests'],
  },
  lint: {
    type: 'lint',
    title: 'Lint/Format Fehler beheben',
    body: 'Bitte eslint/prettier-Probleme lösen und CI grün machen.',
    labels: ['chore', 'lint'],
  },
  types: {
    type: 'types',
    title: 'TypeScript Typen härten',
    body: 'Bitte TypeScript-Fehler reduzieren; keine suppressions. CI muss grün sein.',
    labels: ['chore', 'types'],
  },
  security: {
    type: 'security',
    title: 'Dependencies aktualisieren (Sicherheit)',
    body: 'Bitte Sicherheitsupdates für Dependencies durchführen und CI grün machen.',
    labels: ['chore', 'security'],
  },
  docs: {
    type: 'docs',
    title: 'Dokumentation vervollständigen',
    body: 'Bitte fehlende Dokumentation ergänzen und README aktualisieren.',
    labels: ['chore', 'docs'],
  },
};
```

#### Database-Schema für Custom Templates

```typescript
// shared/schema.ts
export const taskTemplates = pgTable('task_templates', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar('user_id').references(() => users.id),
  repositoryId: varchar('repository_id').references(() => userRepositories.id),
  type: text('type').notNull(), // tests, lint, types, security, docs
  title: text('title').notNull(),
  body: text('body').notNull(),
  labels: json('labels').$type<string[]>(),
  milestone: text('milestone'),
  isActive: boolean('is_active').default(true),
});
```

**Template-Resolution-Strategie**: Custom Repository Template → Standard Default Template → Skip

### GitHub Actions CI-Workflow (Ziel-Repository)

Jedes verwaltete Repository benötigt folgenden CI-Workflow:

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [main]
jobs:
  node:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci
      - run: npm run build
      - run: npm test --if-present
```

# Bausteinsicht

## Whitebox Gesamtsystem

```mermaid
graph TB
    subgraph "GitHub Hausmeister System"
        subgraph "Frontend Layer"
            WebApp[React PWA<br/>Vite + TypeScript]
            Components[shadcn/ui Components<br/>Dashboard, TaskQueue, etc.]
            ServiceWorker[Service Worker<br/>Push Notifications]
        end

        subgraph "Backend Layer"
            API[Express.js API<br/>REST Endpoints]
            Auth[GitHub OAuth<br/>Session Management] 
            Routes[Route Handlers<br/>API Logic]
        end

        subgraph "Business Logic Layer"
            Queue[Multi-User Queue Manager<br/>database-based]
            GitHub[GitHub Integration<br/>REST + GraphQL]
            Copilot[CopilotAssignmentService<br/>589 lines, comprehensive]
            Webhook[Webhook Processor<br/>HMAC verification]
            Notifications[NotificationService<br/>Web Push + Mentra]
            WebPush[WebPush Service<br/>VAPID implementation]
        end

        subgraph "Data Layer"
            Database[(PostgreSQL<br/>Neon Serverless)]
            ORM[Drizzle ORM<br/>Type-safe queries]
            Storage[DatabaseStorage<br/>Multi-tenant data]
        end
    end

    subgraph "External Services"
        GitHubAPI[GitHub REST API v3<br/>Issues, PRs, Repos]
        GraphQLAPI[GitHub GraphQL API v4<br/>Copilot Assignment]
        CopilotAgent[GitHub Copilot Agent<br/>SWE Tasks]
        WebPushService[Browser Push API<br/>VAPID Protocol]
    end

    WebApp --> API
    ServiceWorker --> WebPushService
    API --> Auth
    API --> Routes
    Routes --> Queue
    Routes --> GitHub
    Routes --> Webhook  
    Routes --> Notifications

    Queue --> Storage
    GitHub --> GitHubAPI
    GitHub --> GraphQLAPI
    Copilot --> GraphQLAPI
    Copilot --> CopilotAgent
    Notifications --> WebPush
    WebPush --> WebPushService
    Webhook --> Queue

    Storage --> Database
    ORM --> Database
```

**Architektur-Entscheidungen**:

- **Multi-User Design**: PostgreSQL-basierte Multi-Tenancy mit OAuth-Authentication
- **Comprehensive Services**: Robuste Service-Klassen (CopilotAssignmentService: 589 LOC)
- **PWA-First**: Service Worker, Push Notifications, Mobile-optimiert
- **Type Safety**: End-to-End TypeScript mit Drizzle ORM für Database

**Enthaltene Bausteine**:

- **Frontend Layer**: React PWA mit shadcn/ui, TanStack Query für Server State
- **Backend Layer**: Express.js mit GitHub OAuth, Session-Management
- **Business Logic Layer**: Spezialisierte Services für Queue, GitHub APIs, Push Notifications
- **Data Layer**: PostgreSQL mit Drizzle ORM, typsichere Multi-User-Datenhaltung

**Wichtige Schnittstellen**:

- **REST API**: Frontend-Backend Kommunikation über typisierte Endpoints
- **GitHub OAuth**: Standard OAuth 2.0 Flow für Multi-User Authentication  
- **GitHub REST/GraphQL**: Duale API-Integration für Issue/PR Management und Copilot Assignment
- **Webhook Interface**: HMAC-SHA256 verifizierte GitHub-Events
- **Web Push API**: VAPID-protokoll-basierte Push-Benachrichtigungen
- **PostgreSQL**: Drizzle ORM-basierte typsichere Datenbankoperationen

### Frontend Layer

**Zweck/Verantwortung**: Progressive Web App mit React für Multi-User Repository-Management, Real-time Task-Überwachung und Mobile-First UI mit Push-Benachrichtigungen.

**Schnittstelle(n)**:

- **TanStack Query Client**: Server State Management mit automatischem Caching
- **GitHub OAuth Flow**: Login/Logout über `/auth/login` und `/auth/callback`  
- **REST API Endpoints**: Typisierte API-Kommunikation über `/api/*`
- **Push Subscription**: Push-Registrierung über `/api/push/subscribe`
- **Service Worker**: Background Push-Handling und PWA-Funktionalität
- **Wouter Router**: Client-side Routing zwischen Dashboard und Developer Tools

**Qualitäts-/Leistungsmerkmale**:

- Mobile-first responsive Design
- Dark Theme entsprechend GitHub-Styling
- Client-side Routing mit Wouter
- Optimistische Updates über TanStack Query
- PWA-Funktionalität mit Service Worker
- Push-Benachrichtigungen mit konfigurierbaren Einstellungen
- Offline-Cache für kritische App-Funktionen

**Ablageort/Datei(en)**: `client/src/`, `components.json`, `vite.config.ts`

### Backend Layer

**Zweck/Verantwortung**: Bereitstellung einer RESTful API für Frontend-Kommunikation, Authentifizierung und Request-Routing.

**Schnittstelle(n)**:

- HTTP REST API auf Port 3000
- Session-basierte Authentifizierung
- GitHub OAuth Integration

**Qualitäts-/Leistungsmerkmale**:

- Express.js mit TypeScript
- Session Management über PostgreSQL
- Request/Response Logging
- Error Handling Middleware

**Ablageort/Datei(en)**: `server/index.ts`, `server/routes.ts`

### Business Logic Layer

**Zweck/Verantwortung**: Implementierung der Kerngeschäftslogik für Task Management, GitHub Integration und Webhook-Verarbeitung.

**Schnittstelle(n)**:

- Task Queue Interface
- GitHub REST/GraphQL Client
- Webhook Event Handler
- Database Storage Interface

**Ablageort/Datei(en)**: `server/lib/`

### Data Layer

**Zweck/Verantwortung**: Persistierung und Verwaltung von Anwendungsdaten über verschiedene Speichermedien.

**Schnittstelle(n)**:

- Drizzle ORM für PostgreSQL with type-safe queries
- Express Sessions für OAuth-Authentication State  
- DatabaseStorage Service für alle CRUD-Operationen

**Ablageort/Datei(en)**: `shared/schema.ts`, `server/lib/database-storage.ts`, `server/db.ts`

## Ebene 2

### Whitebox Task Queue Manager

```mermaid
graph TB
    subgraph "Task Queue Manager"
        QueueAPI[Queue API]
        Processor[Task Processor]
        State[State Manager]
        Limiter[Monthly Limiter]
    end

    subgraph "Storage"
        DB[(PostgreSQL Database)]
        ORM[Drizzle ORM]
    end

    QueueAPI --> Processor
    Processor --> State
    Processor --> Limiter
    State --> DB
    ORM --> DB

    Processor --> GitHubOps[GitHub Operations]
    Processor --> WebhookHandler[Webhook Handler]
```

**Zweck**: Zentrale Verwaltung der Task-Warteschlange mit Einzelaufgaben-Nebenläufigkeit und monatlichen Limits.

**Schnittstellen**:

- `createTask()`: Neue Tasks zur Queue hinzufügen
- `processNext()`: Nächste Task aus der Queue verarbeiten
- `updateTaskStatus()`: Task-Status aktualisieren

**Ablageort**: `server/lib/queue.ts` (implizit in routes.ts implementiert)

### Whitebox GitHub Integration

```mermaid
graph TB
    subgraph "GitHub Integration"
        RestClient[REST API Client]
        GraphQLClient[GraphQL Client]
        Copilot[Copilot Manager]
        Webhook[Webhook Verifier]
    end

    RestClient --> Issues[Issue Management]
    RestClient --> PRs[PR Management]
    RestClient --> Repos[Repository Ops]

    GraphQLClient --> Copilot
    Copilot --> Assignment[Agent Assignment]

    Webhook --> Verification[Signature Verification]
    Webhook --> Processing[Event Processing]
```

**Zweck**: Abstraktion und Management aller GitHub API-Interaktionen.

**Schnittstellen**:

- REST API für CRUD-Operationen
- GraphQL API für Copilot-Features
- Webhook-Verarbeitung mit Signatur-Verifikation

**Ablageort**: `server/lib/github-rest.ts`, `server/lib/copilot.ts`

# Laufzeitsicht

## Task Creation und Processing Workflow

```mermaid
sequenceDiagram
    participant User as User (OAuth)
    participant UI as React PWA
    participant API as Express API
    participant Auth as OAuth Middleware
    participant DB as PostgreSQL
    participant Queue as Multi-User Queue
    participant GitHub as GitHub REST API
    participant Copilot as CopilotAssignmentService
    participant GraphQL as GitHub GraphQL
    participant Webhook as Webhook Handler
    participant Push as NotificationService

    User->>UI: Login via GitHub OAuth
    UI->>API: GET /auth/login
    API->>Auth: redirect to GitHub
    Auth-->>UI: OAuth callback with session
    
    User->>UI: Repository auswählen + Tasks erstellen
    UI->>API: POST /api/tasks (with user session)
    API->>Auth: verify session
    API->>DB: get user repositories
    API->>Queue: createTasks(userId, templates)
    
    Queue->>DB: insert tasks with status='queued'
    Queue->>Queue: startNextIfIdle(userId)
    
    loop Für jede User Task
        Queue->>DB: get user access token
        Queue->>GitHub: createIssue(userToken, ...)
        GitHub-->>Queue: Issue created
        Queue->>DB: update task with issueNumber
        Queue->>Copilot: assignToIssue(userToken, ...)
        Copilot->>GraphQL: findBestAgent() with fallback
        Copilot->>GraphQL: replaceActorsForAssignable()
        Copilot-->>Queue: Assignment result
        Queue->>DB: updateStatus('in_progress')
        Queue->>Push: sendNotification(TASK_STARTED)
    end

    Note over GitHub,Copilot: Copilot Agent arbeitet an Issue

    GitHub->>Webhook: PR created (HMAC-signed webhook)
    Webhook->>API: POST /api/webhook
    API->>Webhook: verifySignature()
    API->>DB: find task by issueNumber
    API->>DB: updateTask with pullNumber
    API->>Push: sendNotification(PR_CREATED)

    GitHub->>Webhook: CI completed (webhook)
    Webhook->>API: POST /api/webhook
    API->>GitHub: isPRGreen(userToken, ...)
    alt CI Green
        API->>GitHub: createReviewApprove() + mergePR()
        API->>DB: updateStatus('completed')
        API->>Push: sendNotification(TASK_COMPLETED)
        API->>Queue: startNextIfIdle(userId)
    else CI Failed
        API->>DB: updateStatus('failed')
        API->>Push: sendNotification(TASK_FAILED)
    end
```

**Multi-User-Besonderheiten**:

- **OAuth-basierte Authentifizierung**: Jeder User nutzt eigenen GitHub Token
- **Pro-User Task Queues**: Isolierte Verarbeitung pro Benutzer in Database
- **Comprehensive Copilot Service**: 589-LOC Service mit Multi-Level-Fallback
- **Real-time Push Notifications**: Web Push für Task-Updates per User
- **Database-State Management**: PostgreSQL statt JSON-Files für Multi-Tenancy

## Webhook Event Processing

```mermaid
sequenceDiagram
    participant GitHub as GitHub Platform
    participant Webhook as Webhook Endpoint
    participant Verifier as Signature Verifier
    participant Handler as Event Handler
    participant Queue as Task Queue
    participant DB as Database

    GitHub->>Webhook: Webhook Event (HMAC signed)
    Webhook->>Verifier: verifySignature()

    alt Signature Valid
        Verifier-->>Webhook: Valid
        Webhook->>DB: checkDuplicateDelivery()

        alt Not Duplicate
            DB-->>Webhook: New delivery
            Webhook->>DB: recordDelivery()
            Webhook->>Handler: processEvent()

            alt Pull Request Event
                Handler->>Queue: handlePREvent()
            else CI Event
                Handler->>Queue: handleCIEvent()
            else Issues Event
                Handler->>Queue: handleIssuesEvent()
            end

            Handler-->>Webhook: Success
        else Duplicate
            DB-->>Webhook: Already processed
            Webhook-->>GitHub: 200 OK (duplicate)
        end
    else Signature Invalid
        Verifier-->>Webhook: Invalid
        Webhook-->>GitHub: 401 Unauthorized
    end
```

**Besonderheiten**:

- HMAC-SHA256 Signatur-Verifikation für Sicherheit
- Duplikat-Erkennung verhindert Mehrfachverarbeitung
- Event-spezifische Handler für verschiedene GitHub-Events

## PWA Push-Notification Workflow

```mermaid
sequenceDiagram
    participant User as Benutzer
    participant PWA as PWA Frontend
    participant SW as Service Worker
    participant API as Express API
    participant NotificationService as Notification Service
    participant WebPush as Web Push
    participant TaskQueue as Task Queue

    User->>PWA: Push-Benachrichtigungen aktivieren
    PWA->>SW: requestNotificationPermission()
    SW-->>PWA: Permission granted
    PWA->>API: POST /api/push/subscribe
    API->>API: Store subscription in DB

    Note over TaskQueue: Task-Event tritt auf

    TaskQueue->>NotificationService: sendNotification()
    NotificationService->>API: Load user settings
    NotificationService->>API: Load user subscriptions
    NotificationService->>WebPush: Send push to subscriptions
    WebPush->>SW: Push message delivered
    SW->>SW: Show notification
    User->>SW: Click notification
    SW->>PWA: Open/focus app
```

**PWA Push-Besonderheiten**:

- iOS Push nur in installierter PWA (iOS 16.4+)
- VAPID-Authentifizierung für alle Push-Nachrichten
- Benutzerdefinierte Einstellungen pro Notification-Type
- Graceful Fallback bei nicht unterstützten Browsern
- Automatische Subscription-Cleanup bei ungültigen Endpoints

# Verteilungssicht

## Infrastruktur Ebene 1

```mermaid
graph TB
    subgraph "Replit Cloud Platform"
        subgraph "Application Container"
            Frontend[React Frontend<br/>Vite Build]
            Backend[Express.js Backend<br/>Node.js Runtime]
        end

        subgraph "Environment"
            Secrets[Replit Secrets<br/>Environment Variables]
            Sessions[Express Sessions<br/>OAuth State]
        end
    end

    subgraph "External Services"
        NeonDB[(Neon PostgreSQL<br/>Serverless Database)]
        GitHub[GitHub Platform<br/>REST + GraphQL APIs]
    end

    subgraph "Client Devices"
        Browser[Web Browser<br/>PWA-enabled]
    end

    Browser <-->|HTTPS| Frontend
    Frontend <-->|HTTP/JSON| Backend
    Backend <-->|TLS/SQL| NeonDB
    Backend <-->|HTTPS/Bearer| GitHub
    Backend --> Secrets
    Backend --> Sessions

    GitHub -->|Webhooks/HTTPS| Backend
```

**Begründung**: Single-Container Deployment auf Replit reduziert Komplexität und Deployment-Overhead. Externe Services für Skalierbarkeit und Zuverlässigkeit. Vollständige Database-basierte Persistierung.

**Qualitäts- und/oder Leistungsmerkmale**:

- **Verfügbarkeit**: Replit-Platform mit automatischem Neustart
- **Skalierbarität**: Serverless PostgreSQL über Neon
- **Sicherheit**: Environment Variables über Replit Secrets, OAuth-Sessions
- **Performance**: Client-side Caching, optimierte Builds, Database Indexing

**Zuordnung von Bausteinen zu Infrastruktur**:

- **Frontend**: React PWA served von Express.js mit Service Worker
- **Backend**: Node.js Express.js Server mit TypeScript
- **Database**: Neon PostgreSQL mit Drizzle ORM und automatischen Backups
- **Authentication**: GitHub OAuth mit Express Sessions

# Querschnittliche Konzepte

## Authentifizierung und Autorisierung

**Konzept**: OAuth-basierte Authentifizierung über GitHub mit Session Management.

```mermaid
graph LR
    User[Benutzer] --> OAuth[GitHub OAuth]
    OAuth --> Session[Express Session]
    Session --> DB[(PostgreSQL Sessions)]
    Session --> API[Protected API Routes]
    API --> GitHub[GitHub API<br/>Personal Access Token]
```

**Implementierung**:

- GitHub Personal Access Tokens für API-Zugriff
- Express Session Middleware mit PostgreSQL-Speicherung
- Route-spezifische Authentifizierung über Middleware

## Error Handling und Logging

**Konzept**: Zentrale Fehlerbehandlung mit strukturiertem Logging.

**Implementierung**:

- Try-catch Blocks in allen async Operationen
- Express Error Handling Middleware
- Console-basiertes Logging (Replit-optimiert)
- Webhook-spezifische Fehlerbehandlung mit HTTP Status Codes

## Task State Management

**Konzept**: Hybrid State Management für verschiedene Datentypen.

```mermaid
graph TB
    subgraph "State Management"
        TaskDB[(PostgreSQL<br/>Alle Daten)]
        Drizzle[Drizzle ORM<br/>Type-Safe Queries]
        Session[Session Store<br/>OAuth Sessions]
    end

    TaskDB --> Persistent[Persistent Multi-User Data]
    Drizzle --> TypeSafe[Type-Safe Database Operations]
    Session --> Authentication[User Authentication State]
```

**Implementierung**:

- PostgreSQL für alle Datenpersistierung (Tasks, Users, Templates, Push Subscriptions)
- Drizzle ORM für type-safe Database Operations mit Migrations
- Session-basierte Authentication State für OAuth-Flows
- Kein File-System Storage mehr erforderlich

## API Rate Limiting

**Konzept**: Proaktive GitHub API Rate Limit-Verwaltung.

**Implementierung**:

- Monatliche Task-Limits (konfigurierbar, Standard: 50)
- Einzelaufgaben-Verarbeitung zur Konfliktvermeidung
- Exponential Backoff bei API-Fehlern
- Automatisches Reset der monatlichen Zähler

## Repository-Setup und Workflow-Konfiguration

### Einmalige Vorbereitung für verwaltete Repositories

Jedes Repository, das von GitHub Hausmeister verwaltet werden soll, benötigt eine einmalige Konfiguration:

#### 1. Webhook-Konfiguration

- **URL**: `https://[replit-app-url]/api/webhook`
- **Events**: `issues`, `pull_request`, `workflow_run`, `check_suite`
- **Secret**: Identisch mit `GITHUB_WEBHOOK_SECRET` Environment Variable
- **Content Type**: `application/json`

#### 2. CI-Workflow einrichten

- Datei: `.github/workflows/ci.yml` (siehe Implementierungsdetails)
- Läuft auf allen Pull Requests gegen main Branch
- Führt `npm ci`, `npm run build`, `npm test` aus

#### 3. Branch-Schutz (optional)

- **Regel**: "Require status checks before merging"
- **Status Checks**: CI Workflow als erforderlich markieren
- Ermöglicht automatische Merge-Entscheidungen basierend auf CI-Ergebnissen

#### 4. GitHub Copilot aktivieren

- Copilot Coding Agent im Repository aktivieren (über GitHub UI)
- Sicherstellen, dass der Agent Pull Requests öffnen darf
- Optional: Spezifische Agent-Konfiguration für das Repository

### Vollständiger End-to-End Workflow

1. **Task-Erstellung**: Benutzer startet "Chore-Schleife" → App füllt Queue → `startNextIfIdle()`
2. **Issue-Erstellung**: App erstellt GitHub Issue → GraphQL weist Copilot zu
3. **Copilot-Bearbeitung**: Copilot analysiert Issue und beginnt Implementierung
4. **PR-Erstellung**: Copilot öffnet Pull Request (Draft) → Webhook speichert PR-Details
5. **CI-Ausführung**: GitHub Actions startet automatisch auf PR
6. **Status-Überwachung**: Copilot markiert "ready for review" → Webhook prüft CI-Status via `isPRGreen()`
7. **Auto-Merge**: Bei grünem CI → App approved und merged PR automatisch
8. **Task-Abschluss**: `markDoneAndContinue()` startet nächste Task in der Queue
9. **Fehlerbehandlung**: Bei rotem CI → App kommentiert PR, optionale manuelle Intervention

# Architekturentscheidungen

| Entscheidung                        | Status       | Begründung                                                       | Konsequenzen                                             |
| ----------------------------------- | ------------ | ---------------------------------------------------------------- | -------------------------------------------------------- |
| **React + TypeScript für Frontend** | ✅ Umgesetzt | Type Safety, Component-basierte Architektur, große Community     | Komplexere Build-Pipeline, Lernkurve für neue Entwickler |
| **Express.js für Backend**          | ✅ Umgesetzt | Bewährtes Framework, große Middleware-Auswahl, RESTful APIs      | Weniger strukturiert als andere Frameworks               |
| **Drizzle ORM statt Prisma**        | ✅ Umgesetzt | Bessere TypeScript Integration, Schema-first Approach            | Kleinere Community, weniger Resources                    |
| **PostgreSQL + Drizzle ORM Strategy** | ✅ Umgesetzt | Type-safe Database, Multi-User Support, Skalierbar             | Externe Database-Abhängigkeit, Komplexere Queries      |
| **Single Task Concurrency per User**    | ✅ Umgesetzt | Verhindert GitHub API Konflikte, User-isolierte Verarbeitung   | Reduzierte Durchsatzleistung pro User                  |
| **Replit als Deployment Platform**      | ✅ Umgesetzt | Integrierte Entwicklungsumgebung, Secrets Management           | Vendor Lock-in, begrenzte Skalierungsoptionen          |
| **Wouter statt React Router**           | ✅ Umgesetzt | Reduzierte Bundle-Größe, einfache API                          | Weniger Features, kleinere Community                   |
| **PWA mit Service Worker**              | ✅ Umgesetzt | Offline-Funktionalität, Push-Notifications, App-like Experience | Komplexität der Caching-Strategien, Browser-Support    |
| **VAPID für Push-Notifications**        | ✅ Umgesetzt | Standard-konform, sicher, plattformübergreifend                | Setup-Komplexität, iOS-Einschränkungen                 |

# Qualitätsanforderungen

## Qualitätsbaum

```mermaid
graph TB
    Quality[Qualitätsanforderungen] --> Reliability[Zuverlässigkeit]
    Quality --> Usability[Benutzerfreundlichkeit]
    Quality --> Security[Sicherheit]
    Quality --> Maintainability[Wartbarkeit]
    Quality --> Performance[Performance]

    Reliability --> WebhookProcessing[Webhook Verarbeitung]
    Reliability --> StateConsistency[Zustandskonsistenz]

    Usability --> MobileFirst[Mobile-First Design]
    Usability --> DarkTheme[GitHub Dark Theme]

    Security --> TokenSecurity[Token-Sicherheit]
    Security --> WebhookVerification[Webhook-Verifikation]

    Maintainability --> Modularity[Modulare Architektur]
    Maintainability --> TypeSafety[Type Safety]

    Performance --> APIRateLimiting[API Rate Limiting]
    Performance --> ClientCaching[Client-side Caching]
```

## Qualitätsszenarien

| Szenario                   | Qualitätsmerkmal       | Stimulus                            | Umgebung             | Antwort                                               | Messbare Größe                                |
| -------------------------- | ---------------------- | ----------------------------------- | -------------------- | ----------------------------------------------------- | --------------------------------------------- |
| **Webhook-Verarbeitung**   | Zuverlässigkeit        | GitHub sendet Webhook               | Produktionsumgebung  | Event wird verarbeitet und Task aktualisiert          | 99.9% Webhook Success Rate                    |
| **Mobile Nutzung**         | Benutzerfreundlichkeit | Benutzer öffnet App auf Smartphone  | Mobile Browser       | UI ist vollständig nutzbar und responsive             | Alle Features nutzbar <480px Bildschirmbreite |
| **Token-Kompromittierung** | Sicherheit             | GitHub Token wird kompromittiert    | Produktionsumgebung  | System erkennt ungültige Tokens und blockiert Zugriff | <1 Sekunde Reaktionszeit auf ungültige Tokens |
| **Code-Änderungen**        | Wartbarkeit            | Entwickler fügt neues Feature hinzu | Entwicklungsumgebung | Änderung isoliert in spezifischem Modul               | <5 Dateien pro Feature-Änderung               |
| **API Rate Limit**         | Performance            | Monatliches Limit erreicht          | Produktionsumgebung  | Neue Tasks werden blockiert bis zum nächsten Monat    | Automatischer Stop bei 50 Tasks/Monat         |

# Risiken und technische Schulden

## Risiken

| Risiko                            | Wahrscheinlichkeit | Auswirkung                 | Mitigation                                    |
| --------------------------------- | ------------------ | -------------------------- | --------------------------------------------- |
| **GitHub API Rate Limiting**      | Hoch               | System-Ausfall             | Monatliche Limits, Exponential Backoff        |
| **Webhook-Ausfall**               | Mittel             | Verpasste Events           | Retry-Mechanismus, Event-Polling als Fallback |
| **PostgreSQL Verbindungsabbruch** | Mittel             | Datenverlust               | Connection Pooling, Retry-Logic               |
| **Replit Platform Ausfall**       | Niedrig            | Kompletter Service-Ausfall | Backup Deployment Strategy                    |

## Technische Schulden

| Bereich                   | Beschreibung                               | Priorität | Geplante Lösung                            |
| ------------------------- | ------------------------------------------ | --------- | ------------------------------------------ |
| **Testing Coverage**      | Keine automatisierten Tests vorhanden      | Hoch      | Vitest Framework implementieren            |
| **CI/CD Pipeline**        | Keine automatisierte Build/Deploy Pipeline | Hoch      | GitHub Actions einrichten                  |
| **Error Monitoring**      | Nur Console-Logging vorhanden              | Mittel    | Strukturiertes Logging + Monitoring        |
| **WebSocket Integration** | Real-time Updates nur über Polling         | Niedrig   | WebSocket für Live-Updates                 |
| **Backup Strategy**       | Keine automatisierte Backups               | Mittel    | Neon PostgreSQL automatische Backups       |
| **PWA Testing Coverage**  | PWA-spezifische Features nicht getestet    | Mittel    | Service Worker und Push-Notification Tests |

## Bekannte Limitationen

- **Single Task Concurrency per User**: Reduzierte Parallelität zugunsten von Stabilität
- **Replit Vendor Lock-in**: Deployment-spezifische Konfiguration
- **PostgreSQL Dependency**: Vollständige Abhängigkeit von externer Neon Database
- **OAuth Token Expiry**: Benutzer müssen sich nach Token-Ablauf erneut anmelden

# Glossar

| Begriff                     | Definition                                                          |
| --------------------------- | ------------------------------------------------------------------- |
| **GitHub Hausmeister**      | Automatisierte Anwendung für GitHub Repository-Wartung              |
| **Chore Issue**             | Wartungsaufgabe (Tests, Linting, Dependencies) als GitHub Issue     |
| **Copilot Agent**           | GitHub AI-Agent, der Issues automatisch bearbeitet                  |
| **Task Queue**              | Warteschlange für die sequenzielle Abarbeitung von Wartungsaufgaben |
| **Webhook**                 | HTTP-Callback von GitHub bei Repository-Events                      |
| **Single Task Concurrency** | Verarbeitung jeweils nur einer Aufgabe zur Konfliktvermeidung       |
| **Monthly Limit**           | Monatliches Kontingent für erstellte Tasks pro Benutzer             |
| **Auto-Merge**              | Automatisches Mergen von Pull Requests nach erfolgreichem CI        |
| **Rate Limiting**           | Begrenzung der API-Anfragen zur Einhaltung von GitHub-Limits        |
| **HMAC Verification**       | Kryptographische Verifikation von Webhook-Signaturen                |
| **Express Session**         | Server-seitige Session-Verwaltung für Benutzer-Authentifizierung    |
| **Drizzle ORM**             | Type-safe Object-Relational Mapping für PostgreSQL                  |
| **shadcn/ui**               | React Component Library basierend auf Radix UI                      |
| **TanStack Query**          | Library für Server State Management und Caching                     |
| **Replit Secrets**          | Environment Variable Management in der Replit Platform              |
| **PWA**                     | Progressive Web App mit Service Worker und App-like Experience      |
| **VAPID**                   | Voluntary Application Server Identification für Web Push            |
| **Service Worker**          | Browser-Background-Script für Offline-Funktionalität und Push       |
| **Push Subscription**       | Browser-spezifische Subscription für Push-Benachrichtigungen        |
| **Web Push**                | Standard-Protokoll für Browser-Push-Benachrichtigungen              |
