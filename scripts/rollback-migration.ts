#!/usr/bin/env tsx

import { neon } from '@neondatabase/serverless';

/**
 * Splits SQL into individual statements, handling special cases like DO blocks
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

async function rollbackMigration() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  
  try {
    console.log('🔄 Starting UI rework database rollback...');
    console.log('⚠️  WARNING: This will restore old schema and may lose new data!');
    
    // Read and parse the rollback SQL
    const fs = await import('fs');
    const path = await import('path');
    
    const rollbackPath = path.join(process.cwd(), 'migrations', '0001_ui_rework_schema_changes_rollback.sql');
    const rollbackSQL = fs.readFileSync(rollbackPath, 'utf8');
    
    console.log('📝 Parsing rollback SQL into individual statements...');
    const statements = splitSQLStatements(rollbackSQL);
    
    console.log(`📋 Found ${statements.length} statements to execute`);
    
    // Execute each statement individually
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        await sql(statement);
      } catch (error) {
        console.error(`❌ Failed to execute statement ${i + 1}:`, error);
        console.error(`Statement was: ${statement.substring(0, 100)}...`);
        throw error;
      }
    }
    
    console.log('✅ Rollback completed successfully!');
    console.log('');
    console.log('📋 Summary of rollback:');
    console.log('  • Restored webhook URLs to users table');
    console.log('  • Restored monthly counter to user_system_state');
    console.log('  • Recreated push notification tables');
    console.log('  • Removed repository-specific columns');
    console.log('');
    console.log('⚠️  Note: Any data in the removed columns has been lost');
    
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  rollbackMigration();
}

export { rollbackMigration };