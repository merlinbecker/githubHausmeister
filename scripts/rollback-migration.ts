#!/usr/bin/env tsx

import { neon } from '@neondatabase/serverless';

async function rollbackMigration() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  
  try {
    console.log('🔄 Starting UI rework database rollback...');
    console.log('⚠️  WARNING: This will restore old schema and may lose new data!');
    
    // Read and execute the rollback SQL
    const fs = await import('fs');
    const path = await import('path');
    
    const rollbackPath = path.join(process.cwd(), 'migrations', '0001_ui_rework_schema_changes_rollback.sql');
    const rollbackSQL = fs.readFileSync(rollbackPath, 'utf8');
    
    console.log('📝 Executing rollback SQL...');
    await sql(rollbackSQL);
    
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