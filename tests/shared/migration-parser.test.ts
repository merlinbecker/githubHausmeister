import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Splits SQL into individual statements, handling special cases like DO blocks
 * This function is duplicated from the migration scripts for testing purposes
 */
function splitSQLStatements(sqlContent: string): string[] {
  const statements: string[] = [];
  const lines = sqlContent.split('\n');
  let currentStatement = '';
  let inDoBlock = false;
  let blockDepth = 0;

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip comments and empty lines when not in a statement
    if (!currentStatement && (trimmedLine.startsWith('--') || trimmedLine === '')) {
      continue;
    }

    // Handle DO blocks
    if (trimmedLine.startsWith('DO $$')) {
      inDoBlock = true;
      blockDepth = 1;
      currentStatement += line + '\n';
      continue;
    }

    if (inDoBlock) {
      currentStatement += line + '\n';
      
      // Count nested blocks
      if (trimmedLine.includes('BEGIN')) {
        blockDepth++;
      }
      if (trimmedLine.includes('END')) {
        blockDepth--;
      }
      
      // End of DO block
      if (blockDepth === 0 && trimmedLine.endsWith('$$;')) {
        inDoBlock = false;
        statements.push(currentStatement.trim());
        currentStatement = '';
      }
      continue;
    }

    // Regular statement processing
    currentStatement += line + '\n';

    // Statement ends with semicolon (but not inside quotes or comments)
    if (trimmedLine.endsWith(';') && !trimmedLine.startsWith('--')) {
      const statement = currentStatement.trim();
      if (statement && statement !== 'BEGIN;' && statement !== 'COMMIT;') {
        statements.push(statement);
      }
      currentStatement = '';
    }
  }

  // Add any remaining statement
  if (currentStatement.trim()) {
    const statement = currentStatement.trim();
    if (statement !== 'BEGIN;' && statement !== 'COMMIT;') {
      statements.push(statement);
    }
  }

  return statements;
}

describe('Database Migration SQL Parsing', () => {
  it('should parse migration SQL into individual statements', () => {
    const migrationPath = path.join(process.cwd(), 'migrations', '0001_ui_rework_schema_changes.sql');
    
    // Check if migration file exists
    expect(fs.existsSync(migrationPath)).toBe(true);
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    const statements = splitSQLStatements(migrationSQL);
    
    // Should have multiple statements
    expect(statements.length).toBeGreaterThan(0);
    
    // Should not contain transaction control statements
    const hasBegin = statements.some(stmt => stmt.trim() === 'BEGIN;');
    const hasCommit = statements.some(stmt => stmt.trim() === 'COMMIT;');
    expect(hasBegin).toBe(false);
    expect(hasCommit).toBe(false);
    
    // Should contain expected statement types
    const alterStatements = statements.filter(s => s.trim().startsWith('ALTER'));
    const createStatements = statements.filter(s => s.trim().startsWith('CREATE'));
    const updateStatements = statements.filter(s => s.trim().startsWith('UPDATE'));
    const dropStatements = statements.filter(s => s.trim().startsWith('DROP'));
    const doStatements = statements.filter(s => s.trim().startsWith('DO $$'));
    
    expect(alterStatements.length).toBeGreaterThan(0);
    expect(createStatements.length).toBeGreaterThan(0);
    expect(updateStatements.length).toBeGreaterThan(0);
    expect(dropStatements.length).toBeGreaterThan(0);
    expect(doStatements.length).toBeGreaterThan(0);
  });
  
  it('should handle DO blocks correctly', () => {
    const testSQL = `
BEGIN;

-- Test DO block
DO $$
DECLARE
    test_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO test_count FROM users;
    IF test_count > 0 THEN
        RAISE NOTICE 'Found users';
    END IF;
END $$;

SELECT 'done' as status;

COMMIT;
    `;
    
    const statements = splitSQLStatements(testSQL);
    
    expect(statements).toHaveLength(2);
    
    // First statement should be the DO block
    expect(statements[0].trim().startsWith('DO $$')).toBe(true);
    expect(statements[0].trim().endsWith('END $$;')).toBe(true);
    
    // Second statement should be the SELECT
    expect(statements[1].trim()).toBe("SELECT 'done' as status;");
  });
  
  it('should parse rollback migration correctly', () => {
    const rollbackPath = path.join(process.cwd(), 'migrations', '0001_ui_rework_schema_changes_rollback.sql');
    
    // Check if rollback file exists
    expect(fs.existsSync(rollbackPath)).toBe(true);
    
    const rollbackSQL = fs.readFileSync(rollbackPath, 'utf8');
    const statements = splitSQLStatements(rollbackSQL);
    
    // Should have statements
    expect(statements.length).toBeGreaterThan(0);
    
    // Should not contain transaction control statements
    const hasBegin = statements.some(stmt => stmt.trim() === 'BEGIN;');
    const hasCommit = statements.some(stmt => stmt.trim() === 'COMMIT;');
    expect(hasBegin).toBe(false);
    expect(hasCommit).toBe(false);
  });
  
  it('should ignore comments and empty lines', () => {
    const testSQL = `
-- This is a comment
BEGIN;

-- Another comment

ALTER TABLE test ADD COLUMN new_col TEXT;

-- Final comment

COMMIT;
    `;
    
    const statements = splitSQLStatements(testSQL);
    
    expect(statements).toHaveLength(1);
    expect(statements[0].trim()).toBe('ALTER TABLE test ADD COLUMN new_col TEXT;');
  });
});