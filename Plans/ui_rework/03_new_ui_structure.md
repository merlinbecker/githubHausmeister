# New UI Structure and Layout Plan

## Overview
This document defines the new simplified UI structure focused on repository-centric workflow with clear hierarchy and improved user experience.

## New Page Structure

### Main Dashboard (`/`)
**Repository-centric single-page layout with these sections (top to bottom):**

#### 1. Header Section
- **Repository Selector**: Dropdown to select current active repository
  - Shows: `owner/repo-name` format
  - Persisted in database (`userRepositories.isCurrentActive`)
  - Updates entire page content when changed
- **User Menu**: Profile avatar + logout (keep existing)
- **Settings Link**: Access to general application settings

#### 2. Repository Overview Section
- **Repository Name & Description**: Current selected repository info
- **Pool Status**: 
  - "X assignments remaining this month" (visual progress bar)
  - Reset date: "Resets on [date]"
  - Color coding: Green (>5), Yellow (2-5), Red (0-1)

#### 3. Active Task Section (Conditional)
- **Show only if task is active**
- Current issue assigned to Copilot with:
  - Issue title and number
  - Assignment timestamp
  - Status indicator
  - Direct link to GitHub issue
  - Direct link to associated PR (if exists)

#### 4. Issues and Milestones Section
- **Issue List**: All open issues for current repository
  - Drag-and-drop for priority ordering
  - Visual indicators: assigned to Copilot, has PR, etc.
  - Direct links to GitHub
- **Milestone Filter**: Filter issues by milestone
- **Quick Actions**:
  - "Create New Issue" → Link to GitHub with template selection
  - "View All Issues" → Link to GitHub issues page

#### 5. Recent Activity Section
- **Recent Webhook Events**: Last 10 events only
  - Event type, timestamp, brief description
  - Auto-cleanup: Remove events older than the newest 10
  - Link to full event details if needed

#### 6. System Controls Section
- **Simple Pause/Resume Toggle**
  - Current status: "System Running" / "System Paused"
  - Single button: "Pause System" / "Resume System"
  - Status persisted in database
  - Auto-assignment only works when system is running

### Repository Settings Page (`/repository/settings`)
**Dedicated page for current repository configuration:**

#### Repository Configuration
- **Repository Info**: Display current repository details (read-only)
- **Monthly Assignment Limit**: 
  - Number input with validation (1-50)
  - Current usage display
  - Reset schedule information
- **Webhook Forwarding**:
  - Enable/disable toggle
  - URL input field
  - Test webhook button
  - Status indicator

#### Advanced Settings
- **Auto-merge Settings**: Enable/disable automatic PR merging
- **Issue Priority Settings**: Default priority behavior
- **Notification Preferences**: Basic in-app notifications only

### General Settings Page (`/settings`)
**Application-wide settings:**

#### Repository Management
- **Add Repository**: Search and add repositories
- **Repository List**: Manage all connected repositories
  - Enable/disable per repository
  - Remove repository
  - Set as default/current
- **Webhook Configuration**: Global webhook settings

#### Account Settings
- **Profile Information**: GitHub account details (read-only)
- **Security**: Token management, permissions
- **Preferences**: UI preferences, default settings

## UI/UX Design Principles

### Repository-Centric Design
- **Single Repository Focus**: All elements relate to currently selected repository
- **Context Switching**: Clear indication when switching repositories
- **Progressive Disclosure**: Show relevant information based on current state

### Simplified Navigation
- **Flat Structure**: Minimize nested navigation
- **Direct Actions**: Direct links to GitHub where appropriate
- **Clear Hierarchy**: Visual hierarchy guides user attention

### Visual Design Standards

#### Color Coding
- **Green**: Healthy status, available resources
- **Yellow**: Warning, limited resources
- **Red**: Error, critical status, no resources
- **Blue**: GitHub-related actions and links

#### Typography
- **Headers**: Clear section separation
- **Content**: Scannable information layout
- **Actions**: Distinct button styling

## Component Architecture

### New Components to Create

#### `RepositorySelector`
```typescript
interface RepositorySelectorProps {
  repositories: UserRepository[];
  currentRepository: UserRepository;
  onRepositoryChange: (repository: UserRepository) => void;
}
```

#### `PoolStatus`
```typescript
interface PoolStatusProps {
  used: number;
  limit: number;
  resetDate: Date;
}
```

#### `IssueListWithPriorities`
```typescript
interface IssueListWithPrioritiesProps {
  issues: GitHubIssue[];
  priorities: IssuePriority[];
  onPriorityChange: (issueNumber: number, priority: number) => void;
}
```

#### `RecentWebhookEvents`
```typescript
interface RecentWebhookEventsProps {
  events: WebhookDelivery[];
  maxEvents: 10;
}
```

#### `SimpleSystemControls`
```typescript
interface SimpleSystemControlsProps {
  isRunning: boolean;
  onToggle: (running: boolean) => void;
}
```

### Modified Components

#### `StatusOverview` → `RepositoryOverview`
- Focus on single repository
- Add pool status
- Remove global statistics

#### `ActiveTaskCard`
- Simplify to show current task only
- Direct GitHub links
- Remove queue management

#### `RepositoryIssueManager` → `IssueListWithPriorities`
- Add drag-and-drop priority ordering
- Remove multi-repository selection
- Focus on current repository issues

## Responsive Design

### Desktop Layout
- **Two-column**: Main content + sidebar for quick actions
- **Full-width sections**: For lists and tables
- **Fixed header**: Repository selector always visible

### Mobile Layout  
- **Single column**: Stack all sections vertically
- **Collapsible sections**: Accordion-style for long lists
- **Sticky repository selector**: Easy context switching

### Tablet Layout
- **Hybrid approach**: Adapt based on orientation
- **Touch-optimized**: Larger touch targets for drag-and-drop

## Accessibility Features

### Keyboard Navigation
- **Tab order**: Logical flow through interface
- **Shortcuts**: Quick access to common actions
- **Focus indicators**: Clear visual focus states

### Screen Reader Support
- **ARIA labels**: Descriptive labels for dynamic content
- **Live regions**: Status updates announced
- **Semantic HTML**: Proper heading hierarchy

### Visual Accessibility
- **High contrast**: Sufficient color contrast ratios
- **Scalable text**: Support for text scaling
- **Color independence**: Information not conveyed by color alone

## Performance Considerations

### Data Loading
- **Repository-scoped queries**: Only load data for current repository
- **Pagination**: For long issue lists
- **Caching**: Cache repository data for quick switching

### Real-time Updates
- **WebSocket updates**: For webhook events
- **Optimistic updates**: For priority changes
- **Background refresh**: Keep data current without user action

## Implementation Priority

### Phase 1: Core Structure
1. Repository selector component
2. New dashboard layout
3. Basic repository settings page

### Phase 2: Enhanced Features  
1. Issue priority management
2. Pool status tracking
3. Simplified system controls

### Phase 3: Polish & Performance
1. Responsive design
2. Accessibility improvements
3. Performance optimizations