# Database Schema Changes Plan

## Overview
This document outlines the database schema changes required for the UI rework, focusing on removing unused features and adding new functionality for repository-centric workflow.

## Tables to Remove

### Web Push Notifications
- `pushSubscriptions` - User push notification subscriptions
- `notificationSettings` - User notification preferences

### Mentra OS Integration  
- `mentraGlasses` - Connected smartglasses devices
- `mentraSessions` - Glass session management
- `voiceCommands` - Voice command history
- `glassNotifications` - Notifications sent to glasses

## Tables to Modify

### `userRepositories`
**Add new columns:**
- `monthlyAssignmentLimit` (integer, default 10) - Max assignments per month for this repository
- `isCurrentActive` (boolean, default false) - Whether this is the currently selected repository for the user

**Index changes:**
- Add index on `userId, isCurrentActive` for fast current repository lookup

### `userSystemState`  
**Add new columns:**
- `currentRepositoryId` (varchar, references userRepositories.id) - Currently selected repository
- `isPaused` (boolean, default false) - Whether the system is paused for this user

**Remove columns:**
- `monthlyDone` - Move this to per-repository tracking

### `userRepositories` (additional changes)
**Add new columns:**
- `monthlyAssignmentsUsed` (integer, default 0) - Assignments used this month
- `lastMonthlyReset` (timestamp, default now()) - When monthly counter was last reset
- `webhookForwardUrl` (text, nullable) - Repository-specific webhook forwarding URL

### `users`
**Remove columns:**
- `webhookForwardUrl` - Move to repository-specific setting

## New Tables

### `repositorySettings`
```sql
CREATE TABLE repository_settings (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repository_id varchar NOT NULL REFERENCES user_repositories(id) ON DELETE CASCADE,
  monthly_assignment_limit integer DEFAULT 10,
  webhook_forward_url text,
  auto_merge_enabled boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE(user_id, repository_id)
);
```

## Migration Strategy

### Phase 1: Add New Columns
1. Add new columns to existing tables with safe defaults
2. Migrate webhook URLs from user to repository level
3. Set initial `currentRepositoryId` to first active repository per user

### Phase 2: Remove Unused Tables
1. Drop all Mentra OS related tables
2. Drop all Web Push notification related tables
3. Update relations in schema.ts

### Phase 3: Clean Up
1. Remove unused columns from `users` table
2. Update all TypeScript types and schemas
3. Update API endpoints to use new schema

## Database Cleanup Scripts

### Webhook URL Migration
```sql
-- Migrate webhook URLs to first active repository per user
UPDATE user_repositories 
SET webhook_forward_url = users.webhook_forward_url
FROM users 
WHERE user_repositories.user_id = users.id 
  AND user_repositories.is_active = true
  AND users.webhook_forward_url IS NOT NULL;
```

### Set Current Repository
```sql
-- Set first active repository as current for each user
UPDATE user_repositories 
SET is_current_active = true
WHERE id IN (
  SELECT DISTINCT ON (user_id) id 
  FROM user_repositories 
  WHERE is_active = true 
  ORDER BY user_id, created_at ASC
);
```

## Validation Queries

### Check for Orphaned Data
```sql
-- Verify no duplicate current repositories
SELECT user_id, COUNT(*) 
FROM user_repositories 
WHERE is_current_active = true 
GROUP BY user_id 
HAVING COUNT(*) > 1;

-- Verify monthly limits are set
SELECT COUNT(*) FROM user_repositories WHERE monthly_assignment_limit IS NULL;
```

## Implementation Notes

1. **Backward Compatibility**: During migration, ensure API endpoints continue working
2. **Data Integrity**: Use transactions for all schema changes
3. **Testing**: Verify migration with test data before production
4. **Rollback Plan**: Keep migration scripts reversible where possible

## Affected Files

- `shared/schema.ts` - Update table definitions and types
- `server/lib/db.ts` - Update database operations
- `drizzle.config.ts` - Migration scripts
- All API endpoints using removed tables
- Frontend components using old data structures