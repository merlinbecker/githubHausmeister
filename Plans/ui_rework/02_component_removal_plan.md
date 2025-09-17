# Component Removal and Cleanup Plan

## Overview
This document outlines the React components, pages, and related code that need to be removed as part of the UI simplification.

## Pages to Remove Completely

### Developer Tools (`client/src/pages/developer-tools.tsx`)
- **Remove entire file and route**
- **Impact**: All developer debugging functionality will be removed
- **Components to remove with it**: 
  - `PushNotificationTester`
  - `DelayedNotificationTester` 
  - `MentraOSTester`

### Route Updates Required
- Remove `/dev-tools` route from `App.tsx`
- Remove Developer Tools dropdown menu from dashboard header

## Components to Remove Completely

### Web Push Notification Components
- `client/src/components/PushNotificationTester.tsx`
- `client/src/components/DelayedNotificationTester.tsx`
- `client/src/components/StartupNotificationPrompt.tsx`
- `client/src/components/NotificationSettings.tsx`
- `client/src/components/PWAInstallPrompt.tsx`

### Mentra OS Integration Components  
- `client/src/components/MentraOSTester.tsx`

### Task Management Components (Replace with Simplified Versions)
- `client/src/components/TaskQueue.tsx` - Replace with issue priority management
- `client/src/components/TaskCreationForm.tsx` - Replace with GitHub link
- `client/src/components/TemplateEditor.tsx` - Replace with GitHub link

### Webhook Components (Consolidate)
- `client/src/components/WebhookStatus.tsx` - Remove status display
- `client/src/components/WebhookMonitor.tsx` - Simplify to recent events only
- `client/src/components/WebhookSettings.tsx` - Move to repository settings

## Backend Services to Remove

### Notification Services
- `server/lib/notificationService.ts` - Web push notification service
- `server/lib/webPush.ts` - Web push implementation
- `server/lib/vapid.ts` - VAPID key management

### Mentra OS Services
- `server/lib/mentraService.ts` - Mentra OS integration

## Server Route Cleanup

### API Endpoints to Remove
- `/api/notifications/*` - All notification endpoints
- `/api/webpush/*` - Web push endpoints  
- `/api/mentra/*` - Mentra OS endpoints
- `/api/dev-tools/*` - Developer tools endpoints
- `/api/templates/*` - Template management endpoints
- `/api/queue/*` - Task queue management endpoints

### API Endpoints to Modify
- `/api/webhook/*` - Simplify to basic webhook management
- `/api/repositories/*` - Add repository settings management
- `/api/system/*` - Simplify to pause/resume only

## Frontend Dependencies to Remove

### NPM Packages
Review and remove if no longer needed:
- `web-push` - Web push notifications
- Related notification libraries
- PWA-specific dependencies

### Environment Variables to Remove
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY` 
- `VAPID_EMAIL`
- Mentra OS related environment variables

## Component Migration Strategy

### Replace with Simple Links
- **TaskCreationForm** → Link to GitHub issue creation with optional template selection
- **TemplateEditor** → Link to GitHub repository templates

### Replace with Simplified Components  
- **TaskQueue** → IssueList with drag-and-drop priority ordering
- **WebhookMonitor** → Simple recent events list (last 10 only)

### Move to Settings
- **WebhookSettings** → Repository settings page
- **RepositoryManager** → General settings page

## File Cleanup Checklist

### Remove Files
- [ ] `client/src/pages/developer-tools.tsx`
- [ ] `client/src/components/PushNotificationTester.tsx`
- [ ] `client/src/components/DelayedNotificationTester.tsx`
- [ ] `client/src/components/StartupNotificationPrompt.tsx`
- [ ] `client/src/components/NotificationSettings.tsx`
- [ ] `client/src/components/PWAInstallPrompt.tsx`
- [ ] `client/src/components/MentraOSTester.tsx`
- [ ] `client/src/components/TaskQueue.tsx`
- [ ] `client/src/components/TaskCreationForm.tsx`
- [ ] `client/src/components/TemplateEditor.tsx`
- [ ] `client/src/components/WebhookStatus.tsx`
- [ ] `client/src/components/WebhookMonitor.tsx`
- [ ] `server/lib/notificationService.ts`
- [ ] `server/lib/webPush.ts`
- [ ] `server/lib/vapid.ts`
- [ ] `server/lib/mentraService.ts`

### Update Files  
- [ ] `client/src/App.tsx` - Remove routes and imports
- [ ] `client/src/pages/dashboard.tsx` - Remove component references
- [ ] `server/routes.ts` - Remove API endpoints
- [ ] `package.json` - Remove unused dependencies

## Testing Updates

### Remove Test Files
- Tests for removed components
- Tests for removed services
- Tests for removed API endpoints

### Update Existing Tests
- Dashboard tests to reflect new component structure
- API route tests to reflect simplified endpoints
- Integration tests to use new workflow

## Documentation Updates

### Remove Documentation
- Web push notification setup guides
- Mentra OS integration documentation
- Developer tools documentation

### Update Documentation
- Installation guide (remove notification setup)
- API documentation (reflect new endpoint structure)
- User guide (reflect new UI structure)

## Rollback Considerations

### Safe Removal Order
1. Remove UI components first (user-facing changes)
2. Remove API endpoints (maintain data integrity)
3. Remove backend services (clean up dependencies)
4. Remove database schemas (final cleanup)

### Feature Flags
Consider adding feature flags for gradual rollout:
- `ENABLE_DEVELOPER_TOOLS=false`
- `ENABLE_WEB_PUSH=false`
- `ENABLE_MENTRA_OS=false`

This allows for quick rollback if issues are discovered during deployment.