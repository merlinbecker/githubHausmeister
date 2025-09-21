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

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  
  try {
    console.log('🚀 Starting UI rework database migration...');
    
    // Read and parse the migration SQL
    const fs = await import('fs');
    const path = await import('path');
    
    const migrationPath = path.join(process.cwd(), 'migrations', '0001_ui_rework_schema_changes.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Parsing migration SQL into individual statements...');
    const statements = splitSQLStatements(migrationSQL);
    
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
    
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('📋 Summary of changes:');
    console.log('  • Added new columns to user_repositories table');
    console.log('  • Added new columns to user_system_state table');
    console.log('  • Migrated webhook URLs to repository-specific settings');
    console.log('  • Set current active repository for each user');
    console.log('  • Removed unused push notification tables');
    console.log('  • Removed unused Mentra OS tables');
    console.log('  • Cleaned up old columns');
    console.log('');
    console.log('🔄 To rollback this migration, run:');
    console.log('  tsx scripts/rollback-migration.ts');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('');
    console.log('🔄 If you need to rollback, run:');
    console.log('  tsx scripts/rollback-migration.ts');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration();
}

export { runMigration };