#!/usr/bin/env tsx

import { neon } from '@neondatabase/serverless';

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  
  try {
    console.log('🚀 Starting UI rework database migration...');
    
    // Read and execute the migration SQL
    const fs = await import('fs');
    const path = await import('path');
    
    const migrationPath = path.join(process.cwd(), 'migrations', '0001_ui_rework_schema_changes.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Executing migration SQL...');
    await sql(migrationSQL);
    
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