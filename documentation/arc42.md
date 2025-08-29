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
- **Mobile-First UI**: Dunkles GitHub-themed Dashboard für Überwachung und Kontrolle

## Qualitätsziele

| Priorität | Qualitätsziel | Szenario |
|-----------|---------------|----------|
| 1 | **Zuverlässigkeit** | System muss GitHub Webhooks ohne Verlust verarbeiten |
| 2 | **Skalierbarkeit** | Unterstützung mehrerer Benutzer und Repositories |
| 3 | **Benutzerfreundlichkeit** | Mobile-first responsive Design |
| 4 | **Sicherheit** | Sichere GitHub Token-Authentifizierung und Webhook-Verifikation |
| 5 | **Wartbarkeit** | Modulare Architektur mit klarer Trennung der Concerns |

## Stakeholder

| Rolle | Kontakt | Erwartungshaltung |
|-------|---------|-------------------|
| **Entwickler** | Repository Owner | Automatisierung von Repository-Wartungsaufgaben |
| **GitHub Copilot** | AI Agent | Empfang und Bearbeitung zugewiesener Issues |
| **CI/CD System** | GitHub Actions | Bereitstellung von Build-Status für automatische Merge-Entscheidungen |
| **System Administrator** | DevOps Team | Überwachung der Anwendungsleistung und -integrität |

# Randbedingungen

## Technische Randbedingungen

| Constraint | Beschreibung |
|------------|--------------|
| **Deployment Platform** | Replit mit integriertem Secrets Management |
| **Database** | PostgreSQL (Neon Serverless) |
| **GitHub API Limits** | Rate Limiting durch GitHub REST/GraphQL APIs |
| **Node.js Runtime** | ES Modules, TypeScript-first Entwicklung |

## Organisatorische Randbedingungen

| Constraint | Beschreibung |
|------------|--------------|
| **Repository Access** | Erfordert GitHub Personal Access Tokens mit spezifischen Berechtigungen |
| **Monthly Task Limits** | Konfigurierbare Limits zur Verhinderung von API Rate Limiting |
| **Single Task Concurrency** | Nur eine aktive Aufgabe gleichzeitig zur Konfliktverhinderung |

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

# Lösungsstrategie

## Architekturmuster

| Aspekt | Entscheidung | Begründung |
|--------|-------------|------------|
| **Frontend-Architektur** | React + TypeScript + Vite | Schnelle Entwicklungserfahrung, optimiertes Bundling |
| **Backend-Architektur** | Express.js RESTful API | Bewährtes Node.js Framework mit klarer API-Struktur |
| **Daten-Persistierung** | Hybrid: PostgreSQL + In-Memory + File-State | PostgreSQL für dauerhafte Daten, In-Memory für Queue, JSON-Files für kritischen State |
| **GitHub Integration** | REST + GraphQL APIs | REST für Standard-Operationen, GraphQL für Copilot-spezifische Features |
| **Task Management** | Single-Task Queue mit Persistierung | Verhindert Konflikte, einfache Implementierung |

## Technologie-Entscheidungen

| Bereich | Technologie | Begründung |
|---------|-------------|------------|
| **UI Framework** | shadcn/ui + Radix UI | Zugänglichkeit, konsistentes Design System |
| **State Management** | TanStack Query | Server State Management, Caching, Data Fetching |
| **Routing** | Wouter | Leichtgewichtige Alternative zu React Router |
| **Styling** | Tailwind CSS | Utility-first, mobile-first responsive Design |
| **ORM** | Drizzle ORM | Type-safe, schema-first Datenbankoperationen |

# Bausteinsicht

## Whitebox Gesamtsystem

```mermaid
graph TB
    subgraph "GitHub Hausmeister System"
        subgraph "Frontend Layer"
            UI[React Web UI]
            Components[UI Components]
        end
        
        subgraph "Backend Layer"
            API[Express.js API]
            Routes[Route Handlers]
            Auth[Authentication]
        end
        
        subgraph "Business Logic Layer"
            TaskQueue[Task Queue Manager]
            GitHub[GitHub Integration]
            Webhook[Webhook Processor]
            Storage[Data Storage]
        end
        
        subgraph "Data Layer"
            PostgreSQL[(PostgreSQL DB)]
            FileState[JSON State Files]
            Memory[In-Memory Cache]
        end
    end
    
    subgraph "External Systems"
        GitHubAPI[GitHub APIs]
        Copilot[GitHub Copilot]
    end
    
    UI --> API
    API --> Routes
    Routes --> Auth
    Routes --> TaskQueue
    Routes --> GitHub
    Routes --> Webhook
    Routes --> Storage
    
    TaskQueue --> Storage
    GitHub --> GitHubAPI
    GitHub --> Copilot
    Webhook --> TaskQueue
    
    Storage --> PostgreSQL
    Storage --> FileState
    Storage --> Memory
```

**Begründung**: Das System folgt einer klassischen 3-Schichten-Architektur mit klarer Trennung von Präsentation, Geschäftslogik und Datenhaltung. Die Hybrid-Speicherstrategie optimiert Performance und Persistierung.

**Enthaltene Bausteine**:

- **Frontend Layer**: React-basierte Benutzeroberfläche
- **Backend Layer**: Express.js API mit Authentifizierung
- **Business Logic Layer**: Kerngeschäftslogik für Task Management und GitHub Integration
- **Data Layer**: Hybride Speicherlösung für verschiedene Datentypen

**Wichtige Schnittstellen**:

- **REST API**: Frontend-Backend Kommunikation
- **GitHub APIs**: Externe Integration für Repository-Management
- **Webhook Interface**: Eingehende GitHub-Events

### Frontend Layer

**Zweck/Verantwortung**: Bereitstellung einer responsiven Web-Oberfläche für Repository-Management, Task-Überwachung und Systemkontrolle.

**Schnittstelle(n)**:
- REST API Client über `/api/*` Endpoints
- WebSocket-Verbindung für Real-time Updates (geplant)

**Qualitäts-/Leistungsmerkmale**:
- Mobile-first responsive Design
- Dark Theme entsprechend GitHub-Styling
- Client-side Routing mit Wouter
- Optimistische Updates über TanStack Query

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
- Drizzle ORM für PostgreSQL
- File System für JSON State
- In-Memory Storage für Queues

**Ablageort/Datei(en)**: `shared/schema.ts`, `server/lib/database-storage.ts`, `server/lib/state.ts`

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
        DB[(Database)]
        JSON[JSON Files]
        Memory[In-Memory Queue]
    end
    
    QueueAPI --> Processor
    Processor --> State
    Processor --> Limiter
    State --> DB
    State --> JSON
    QueueAPI --> Memory
    
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
    participant User as Benutzer
    participant UI as React UI
    participant API as Express API
    participant Queue as Task Queue
    participant GitHub as GitHub API
    participant Copilot as GitHub Copilot
    participant Webhook as Webhook Handler

    User->>UI: Repository auswählen + Tasks erstellen
    UI->>API: POST /api/tasks
    API->>Queue: createTasks(templates)
    
    loop Für jede Task
        Queue->>GitHub: createIssue()
        GitHub-->>Queue: Issue created
        Queue->>Copilot: assignAgent()
        Copilot-->>Queue: Agent assigned
        Queue->>Queue: updateStatus('in_progress')
    end
    
    Note over GitHub,Copilot: Copilot arbeitet an Issue
    
    GitHub->>Webhook: PR created (webhook)
    Webhook->>API: POST /api/webhook
    API->>Queue: handlePREvent()
    
    GitHub->>Webhook: CI completed (webhook)
    Webhook->>API: POST /api/webhook
    API->>GitHub: approvePR() + mergePR()
    API->>Queue: updateStatus('completed')
```

**Besonderheiten**:
- Einzelaufgaben-Verarbeitung verhindert Konflikte
- Webhook-Events triggern automatische Weiterverarbeitung
- Persistente Zustandsverfolgung über alle Schritte

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
            Storage[File System<br/>JSON State Files]
        end
    end
    
    subgraph "External Services"
        NeonDB[(Neon PostgreSQL<br/>Serverless Database)]
        GitHub[GitHub Platform<br/>REST + GraphQL APIs]
    end
    
    subgraph "Client Devices"
        Browser[Web Browser<br/>Mobile + Desktop]
    end
    
    Browser <-->|HTTPS| Frontend
    Frontend <-->|HTTP/JSON| Backend
    Backend <-->|TLS| NeonDB
    Backend <-->|HTTPS/Bearer| GitHub
    Backend --> Secrets
    Backend --> Storage
    
    GitHub -->|Webhooks/HTTPS| Backend
```

**Begründung**: Single-Container Deployment auf Replit reduziert Komplexität und Deployment-Overhead. Externe Services für Skalierbarkeit und Zuverlässigkeit.

**Qualitäts- und/oder Leistungsmerkmale**:
- **Verfügbarkeit**: Replit-Platform mit automatischem Neustart
- **Skalierbarkeit**: Serverless PostgreSQL über Neon
- **Sicherheit**: Environment Variables über Replit Secrets
- **Performance**: Client-side Caching, optimierte Builds

**Zuordnung von Bausteinen zu Infrastruktur**:
- **Frontend**: Statische Assets served von Express.js
- **Backend**: Node.js Express.js Server
- **Database**: Neon PostgreSQL mit Drizzle ORM
- **State**: JSON Files im Container File System

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
        TaskDB[(PostgreSQL<br/>Tasks & Users)]
        StateFile[JSON Files<br/>Monthly Counters]
        Memory[In-Memory<br/>Active Queues]
    end
    
    TaskDB --> Persistent[Persistent Data]
    StateFile --> Critical[Critical State]
    Memory --> Transient[Transient Data]
```

**Implementierung**:
- PostgreSQL für langfristige Datenpersistierung
- JSON Files für kritische System-State (monatliche Zähler)
- In-Memory Storage für temporäre Queue-Verwaltung

## API Rate Limiting

**Konzept**: Proaktive GitHub API Rate Limit-Verwaltung.

**Implementierung**:
- Monatliche Task-Limits (konfigurierbar, Standard: 50)
- Einzelaufgaben-Verarbeitung zur Konfliktvermeidung
- Exponential Backoff bei API-Fehlern
- Automatisches Reset der monatlichen Zähler

# Architekturentscheidungen

| Entscheidung | Status | Begründung | Konsequenzen |
|-------------|--------|------------|---------------|
| **React + TypeScript für Frontend** | ✅ Umgesetzt | Type Safety, Component-basierte Architektur, große Community | Komplexere Build-Pipeline, Lernkurve für neue Entwickler |
| **Express.js für Backend** | ✅ Umgesetzt | Bewährtes Framework, große Middleware-Auswahl, RESTful APIs | Weniger strukturiert als andere Frameworks |
| **Drizzle ORM statt Prisma** | ✅ Umgesetzt | Bessere TypeScript Integration, Schema-first Approach | Kleinere Community, weniger Resources |
| **Hybrid Storage Strategy** | ✅ Umgesetzt | Optimiert verschiedene Datentypen, Performance vs. Persistierung | Komplexere Datenverwaltung, Konsistenz-Herausforderungen |
| **Single Task Concurrency** | ✅ Umgesetzt | Verhindert GitHub API Konflikte, einfache Implementierung | Reduzierte Durchsatzleistung, Queue-Delays |
| **Replit als Deployment Platform** | ✅ Umgesetzt | Integrierte Entwicklungsumgebung, Secrets Management | Vendor Lock-in, begrenzte Skalierungsoptionen |
| **Wouter statt React Router** | ✅ Umgesetzt | Reduzierte Bundle-Größe, einfache API | Weniger Features, kleinere Community |

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

| Szenario | Qualitätsmerkmal | Stimulus | Umgebung | Antwort | Messbare Größe |
|----------|------------------|----------|-----------|---------|----------------|
| **Webhook-Verarbeitung** | Zuverlässigkeit | GitHub sendet Webhook | Produktionsumgebung | Event wird verarbeitet und Task aktualisiert | 99.9% Webhook Success Rate |
| **Mobile Nutzung** | Benutzerfreundlichkeit | Benutzer öffnet App auf Smartphone | Mobile Browser | UI ist vollständig nutzbar und responsive | Alle Features nutzbar <480px Bildschirmbreite |
| **Token-Kompromittierung** | Sicherheit | GitHub Token wird kompromittiert | Produktionsumgebung | System erkennt ungültige Tokens und blockiert Zugriff | <1 Sekunde Reaktionszeit auf ungültige Tokens |
| **Code-Änderungen** | Wartbarkeit | Entwickler fügt neues Feature hinzu | Entwicklungsumgebung | Änderung isoliert in spezifischem Modul | <5 Dateien pro Feature-Änderung |
| **API Rate Limit** | Performance | Monatliches Limit erreicht | Produktionsumgebung | Neue Tasks werden blockiert bis zum nächsten Monat | Automatischer Stop bei 50 Tasks/Monat |

# Risiken und technische Schulden

## Risiken

| Risiko | Wahrscheinlichkeit | Auswirkung | Mitigation |
|--------|-------------------|------------|------------|
| **GitHub API Rate Limiting** | Hoch | System-Ausfall | Monatliche Limits, Exponential Backoff |
| **Webhook-Ausfall** | Mittel | Verpasste Events | Retry-Mechanismus, Event-Polling als Fallback |
| **PostgreSQL Verbindungsabbruch** | Mittel | Datenverlust | Connection Pooling, Retry-Logic |
| **Replit Platform Ausfall** | Niedrig | Kompletter Service-Ausfall | Backup Deployment Strategy |

## Technische Schulden

| Bereich | Beschreibung | Priorität | Geplante Lösung |
|---------|--------------|-----------|-----------------|
| **Testing Coverage** | Keine automatisierten Tests vorhanden | Hoch | Vitest Framework implementieren |
| **CI/CD Pipeline** | Keine automatisierte Build/Deploy Pipeline | Hoch | GitHub Actions einrichten |
| **Error Monitoring** | Nur Console-Logging vorhanden | Mittel | Strukturiertes Logging + Monitoring |
| **WebSocket Integration** | Real-time Updates nur über Polling | Niedrig | WebSocket für Live-Updates |
| **Backup Strategy** | Keine automatisierte Backups | Mittel | Neon PostgreSQL Backup + State File Backup |

## Bekannte Limitationen

- **Single Task Concurrency**: Reduzierte Parallelität zugunsten von Stabilität
- **Replit Vendor Lock-in**: Deployment-spezifische Konfiguration
- **File-based State**: JSON State Files nicht für High-Concurrency geeignet
- **In-Memory Queue**: Queue geht bei Neustart verloren (wird aus DB rekonstruiert)

# Glossar

| Begriff | Definition |
|---------|------------|
| **GitHub Hausmeister** | Automatisierte Anwendung für GitHub Repository-Wartung |
| **Chore Issue** | Wartungsaufgabe (Tests, Linting, Dependencies) als GitHub Issue |
| **Copilot Agent** | GitHub AI-Agent, der Issues automatisch bearbeitet |
| **Task Queue** | Warteschlange für die sequenzielle Abarbeitung von Wartungsaufgaben |
| **Webhook** | HTTP-Callback von GitHub bei Repository-Events |
| **Single Task Concurrency** | Verarbeitung jeweils nur einer Aufgabe zur Konfliktvermeidung |
| **Monthly Limit** | Monatliches Kontingent für erstellte Tasks pro Benutzer |
| **Auto-Merge** | Automatisches Mergen von Pull Requests nach erfolgreichem CI |
| **Rate Limiting** | Begrenzung der API-Anfragen zur Einhaltung von GitHub-Limits |
| **HMAC Verification** | Kryptographische Verifikation von Webhook-Signaturen |
| **Express Session** | Server-seitige Session-Verwaltung für Benutzer-Authentifizierung |
| **Drizzle ORM** | Type-safe Object-Relational Mapping für PostgreSQL |
| **shadcn/ui** | React Component Library basierend auf Radix UI |
| **TanStack Query** | Library für Server State Management und Caching |
| **Replit Secrets** | Environment Variable Management in der Replit Platform |