-- Migration: UI Rework Database Schema Changes
-- Description: Implements changes outlined in Plans/ui_rework/01_database_schema_changes.md
-- Date: 2024-12-19

BEGIN;

-- =======================================
-- PHASE 1: ADD NEW COLUMNS TO EXISTING TABLES
-- =======================================

-- Add new columns to user_repositories table
ALTER TABLE user_repositories 
ADD COLUMN monthly_assignment_limit INTEGER DEFAULT 10,
ADD COLUMN is_current_active BOOLEAN DEFAULT false,
ADD COLUMN monthly_assignments_used INTEGER DEFAULT 0,
ADD COLUMN last_monthly_reset TIMESTAMP DEFAULT NOW(),
ADD COLUMN webhook_forward_url TEXT;

-- Add new index for current active repository lookup
CREATE INDEX user_repositories_current_active_idx 
ON user_repositories(user_id, is_current_active);

-- Add new columns to user_system_state table
ALTER TABLE user_system_state 
ADD COLUMN current_repository_id VARCHAR REFERENCES user_repositories(id) ON DELETE SET NULL,
ADD COLUMN is_paused BOOLEAN DEFAULT false;

-- =======================================
-- PHASE 2: DATA MIGRATION
-- =======================================

-- Migrate webhook URLs from users to first active repository per user
UPDATE user_repositories 
SET webhook_forward_url = users.webhook_forward_url
FROM users 
WHERE user_repositories.user_id = users.id 
  AND user_repositories.is_active = true
  AND users.webhook_forward_url IS NOT NULL;

-- Set first active repository as current for each user
UPDATE user_repositories 
SET is_current_active = true
WHERE id IN (
  SELECT DISTINCT ON (user_id) id 
  FROM user_repositories 
  WHERE is_active = true 
  ORDER BY user_id, created_at ASC
);

-- Set current_repository_id in user_system_state
UPDATE user_system_state
SET current_repository_id = ur.id
FROM user_repositories ur
WHERE user_system_state.user_id = ur.user_id
  AND ur.is_current_active = true;

-- =======================================
-- PHASE 3: REMOVE UNUSED TABLES
-- =======================================

-- Drop Web Push notification tables
DROP TABLE IF EXISTS push_subscriptions CASCADE;
DROP TABLE IF EXISTS notification_settings CASCADE;

-- Drop Mentra OS tables
DROP TABLE IF EXISTS glass_notifications CASCADE;
DROP TABLE IF EXISTS voice_commands CASCADE; 
DROP TABLE IF EXISTS mentra_sessions CASCADE;
DROP TABLE IF EXISTS mentra_glasses CASCADE;

-- =======================================
-- PHASE 4: CLEAN UP EXISTING TABLES
-- =======================================

-- Remove unused columns from users table
ALTER TABLE users DROP COLUMN IF EXISTS webhook_forward_url;

-- Remove unused columns from user_system_state table
ALTER TABLE user_system_state DROP COLUMN IF EXISTS monthly_done;

-- =======================================
-- VALIDATION QUERIES
-- =======================================

-- Verify no duplicate current repositories
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT user_id, COUNT(*) as repo_count
        FROM user_repositories 
        WHERE is_current_active = true 
        GROUP BY user_id 
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        RAISE EXCEPTION 'Found users with multiple current repositories: %', duplicate_count;
    END IF;
    
    RAISE NOTICE 'Migration validation passed: No duplicate current repositories';
END $$;

-- Verify monthly limits are set
DO $$
DECLARE
    null_limit_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_limit_count 
    FROM user_repositories 
    WHERE monthly_assignment_limit IS NULL;
    
    IF null_limit_count > 0 THEN
        RAISE WARNING 'Found % repositories with NULL monthly_assignment_limit', null_limit_count;
    ELSE
        RAISE NOTICE 'Migration validation passed: All repositories have monthly limits set';
    END IF;
END $$;

COMMIT;

-- Log migration completion
SELECT 'UI Rework database schema migration completed successfully' as migration_status;