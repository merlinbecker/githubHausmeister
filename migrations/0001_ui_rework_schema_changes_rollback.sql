-- ROLLBACK Migration: UI Rework Database Schema Changes
-- Description: Rollback changes from 0001_ui_rework_schema_changes.sql
-- Date: 2024-12-19
-- WARNING: This rollback will lose data for new features!

BEGIN;

-- =======================================
-- PHASE 1: RESTORE REMOVED TABLES
-- =======================================

-- Recreate users webhook_forward_url column
ALTER TABLE users ADD COLUMN webhook_forward_url TEXT;

-- Recreate user_system_state monthly_done column
ALTER TABLE user_system_state ADD COLUMN monthly_done INTEGER DEFAULT 0;

-- Recreate push_subscriptions table
CREATE TABLE push_subscriptions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used TIMESTAMP DEFAULT NOW()
);

CREATE INDEX push_subscriptions_user_id_idx ON push_subscriptions(user_id);
CREATE INDEX push_subscriptions_endpoint_idx ON push_subscriptions(endpoint);

-- Recreate notification_settings table
CREATE TABLE notification_settings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_started BOOLEAN DEFAULT true,
  task_completed BOOLEAN DEFAULT true,
  task_failed BOOLEAN DEFAULT true,
  pr_created BOOLEAN DEFAULT true,
  pr_merged BOOLEAN DEFAULT true,
  ci_status_changed BOOLEAN DEFAULT false,
  copilot_assigned BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX notification_settings_user_id_idx ON notification_settings(user_id);

-- =======================================
-- PHASE 2: DATA MIGRATION BACK
-- =======================================

-- Migrate webhook URLs back from repositories to users (use first repository's URL)
UPDATE users 
SET webhook_forward_url = ur.webhook_forward_url
FROM user_repositories ur
WHERE users.id = ur.user_id 
  AND ur.is_current_active = true
  AND ur.webhook_forward_url IS NOT NULL;

-- Calculate total monthly assignments and set in user_system_state
UPDATE user_system_state
SET monthly_done = (
  SELECT COALESCE(SUM(ur.monthly_assignments_used), 0)
  FROM user_repositories ur
  WHERE ur.user_id = user_system_state.user_id
);

-- =======================================
-- PHASE 3: REMOVE NEW COLUMNS
-- =======================================

-- Remove new columns from user_repositories
DROP INDEX IF EXISTS user_repositories_current_active_idx;

ALTER TABLE user_repositories 
DROP COLUMN IF EXISTS monthly_assignment_limit,
DROP COLUMN IF EXISTS is_current_active,
DROP COLUMN IF EXISTS monthly_assignments_used,
DROP COLUMN IF EXISTS last_monthly_reset,
DROP COLUMN IF EXISTS webhook_forward_url;

-- Remove new columns from user_system_state
ALTER TABLE user_system_state 
DROP COLUMN IF EXISTS current_repository_id,
DROP COLUMN IF EXISTS is_paused;

COMMIT;

-- Log rollback completion
SELECT 'UI Rework database schema rollback completed' as rollback_status;