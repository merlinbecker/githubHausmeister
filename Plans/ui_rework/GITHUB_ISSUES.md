# GitHub Issues to Create

Based on the UI rework planning documentation, the following GitHub issues should be created with the label `enhancement` and milestone `erster Rundlauf und PoC`:

## 1. Database Schema Rework for Repository-Centric Workflow

**Title**: Database Schema Rework for Repository-Centric Workflow
**Labels**: `enhancement`
**Milestone**: `erster Rundlauf und PoC`

**Description**:
Implement database schema changes to support the new repository-centric workflow as outlined in the UI rework plan.

**Key Changes**:
- Remove Web Push Notification tables (`pushSubscriptions`, `notificationSettings`)
- Remove Mentra OS Integration tables (`mentraGlasses`, `mentraSessions`, `voiceCommands`, `glassNotifications`)
- Add repository-specific fields to `userRepositories` (monthly limits, webhook URLs)
- Update `userSystemState` for current repository tracking
- Create migration scripts for safe data transition

**Acceptance Criteria**:
- [ ] All unused tables removed without data loss
- [ ] New repository-centric fields added with proper defaults
- [ ] Migration scripts tested on sample data
- [ ] TypeScript schemas updated
- [ ] Database indexes optimized for new queries

**Reference**: `Plans/ui_rework/01_database_schema_changes.md`

---

## 2. Remove Legacy UI Components and Clean Dependencies

**Title**: Remove Legacy UI Components and Clean Dependencies  
**Labels**: `enhancement`
**Milestone**: `erster Rundlauf und PoC`

**Description**:
Remove unused UI components, pages, and backend services to simplify the application architecture.

**Components to Remove**:
- Developer Tools page and all related components
- Web Push notification components
- Mentra OS integration components
- Legacy task management components (TaskQueue, TemplateEditor)
- Webhook status and monitoring components

**Acceptance Criteria**:
- [ ] All unused React components removed
- [ ] Developer Tools route removed from App.tsx
- [ ] Unused NPM dependencies removed
- [ ] Backend services cleaned up
- [ ] Import statements updated throughout codebase
- [ ] Build process validates without errors

**Reference**: `Plans/ui_rework/02_component_removal_plan.md`

---

## 3. Implement Repository Selector and Current Repository Management

**Title**: Implement Repository Selector and Current Repository Management
**Labels**: `enhancement`
**Milestone**: `erster Rundlauf und PoC`

**Description**:
Create a repository selector component that allows users to choose their current active repository, with state persistence across sessions.

**Key Features**:
- Dropdown repository selector in header
- Persist current repository selection in database
- Update entire UI when repository changes
- Repository context management with React Query

**Acceptance Criteria**:
- [ ] Repository selector component created
- [ ] Current repository state persisted in database
- [ ] UI updates when repository selection changes
- [ ] API endpoints for current repository management
- [ ] Loading and error states handled
- [ ] Responsive design for mobile devices

**Reference**: `Plans/ui_rework/03_new_ui_structure.md`

---

## 4. Build Repository Settings Page and Configuration

**Title**: Build Repository Settings Page and Configuration
**Labels**: `enhancement`
**Milestone**: `erster Rundlauf und PoC`

**Description**:
Implement a dedicated repository settings page for per-repository configuration including monthly assignment limits and webhook forwarding.

**Key Features**:
- Monthly assignment limit configuration (1-50 range)
- Repository-specific webhook forwarding
- Auto-merge settings
- Usage tracking and progress display

**Acceptance Criteria**:
- [ ] Repository settings page created (`/repository/settings`)
- [ ] Monthly assignment limit management
- [ ] Webhook forwarding configuration with testing
- [ ] Settings persistence and validation
- [ ] API endpoints for repository settings
- [ ] Progress indicators for monthly usage

**Reference**: `Plans/ui_rework/04_repository_settings.md`

---

## 5. Implement Issue Priority System with Drag-and-Drop

**Title**: Implement Issue Priority System with Drag-and-Drop
**Labels**: `enhancement`
**Milestone**: `erster Rundlauf und PoC`

**Description**:
Replace the task queue system with an issue priority management system using drag-and-drop ordering.

**Key Features**:
- Drag-and-drop issue reordering
- Priority persistence in database
- Visual priority indicators
- Integration with assignment logic

**Acceptance Criteria**:
- [ ] Drag-and-drop issue list component
- [ ] Priority data stored in `issuePriorities` table
- [ ] Visual indicators for issue priority
- [ ] Assignment logic uses priority ordering
- [ ] Responsive design for touch devices
- [ ] Accessibility support for keyboard navigation

**Reference**: `Plans/ui_rework/03_new_ui_structure.md`

---

## 6. Simplify System Controls to Pause/Resume Only

**Title**: Simplify System Controls to Pause/Resume Only
**Labels**: `enhancement`
**Milestone**: `erster Rundlauf und PoC`

**Description**:
Simplify system controls to only include pause/resume functionality with state persistence and automatic assignment triggering.

**Key Features**:
- Simple pause/resume toggle
- State persistence in database
- Auto-assignment on resume if no active task
- Clear status indicators

**Acceptance Criteria**:
- [ ] Simplified system controls component
- [ ] Pause state persisted in database
- [ ] Resume triggers assignment check
- [ ] Clear visual status indicators
- [ ] API endpoints for system control
- [ ] Integration with assignment logic

**Reference**: `Plans/ui_rework/05_system_state_management.md`

---

## 7. Restructure Dashboard with Repository-Centric Layout

**Title**: Restructure Dashboard with Repository-Centric Layout
**Labels**: `enhancement`
**Milestone**: `erster Rundlauf und PoC`

**Description**:
Implement the new dashboard layout with repository-centric sections and simplified navigation.

**Key Features**:
- Repository selector in header
- Pool status display with progress indicators
- Active task display (when applicable)
- Issue list for current repository
- Recent webhook events (last 10 only)
- Simplified system controls

**Acceptance Criteria**:
- [ ] New dashboard layout implemented
- [ ] All sections update based on current repository
- [ ] Pool status with visual progress indicators
- [ ] Responsive design for all screen sizes
- [ ] Performance optimized for repository switching
- [ ] Accessibility compliant

**Reference**: `Plans/ui_rework/03_new_ui_structure.md`

---

## 8. Organize Settings Pages and General Application Settings

**Title**: Organize Settings Pages and General Application Settings
**Labels**: `enhancement`
**Milestone**: `erster Rundlauf und PoC`

**Description**:
Create a general settings page for application-wide settings and move repository management functionality.

**Key Features**:
- General settings page (`/settings`)
- Repository management interface
- Account settings display
- Navigation between different settings areas

**Acceptance Criteria**:
- [ ] General settings page created
- [ ] Repository management moved to settings
- [ ] Clear navigation between settings areas
- [ ] Settings organization matches new UI structure
- [ ] Account information display
- [ ] Proper routing and navigation

**Reference**: `Plans/ui_rework/03_new_ui_structure.md`

---

## Implementation Notes

**Order of Implementation**:
The issues should be implemented in the following order due to dependencies:
1. Database Schema Rework (Foundation)
2. Remove Legacy Components (Cleanup)
3. Repository Selector (Core functionality)
4. Repository Settings (Configuration)
5. Issue Priority System (Task management)
6. System Controls (Control logic)
7. Dashboard Restructure (Layout)
8. Settings Organization (Final organization)

**Testing Requirements**:
Each issue should include comprehensive testing:
- Unit tests for components and services
- Integration tests for API endpoints
- E2E tests for user workflows
- Accessibility testing
- Performance validation

**Documentation Updates**:
Each implementation should update relevant documentation and include migration guides where necessary.

---

**Note**: These issues should be created manually in the GitHub repository with the specified labels and milestone. Each issue references the detailed planning documentation in `Plans/ui_rework/` for complete implementation guidance.