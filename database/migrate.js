const fs = require('fs').promises;
const path = require('path');
const { pool } = require('../src/core/db/connection');

const runMigrations = async () => {
  try {
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter(file => file.endsWith('.sql')).sort();

    console.log('🚀 Running database migrations...');

    for (const file of sqlFiles) {
      console.log(`📄 Executing ${file}...`);
      
      const filePath = path.join(migrationsDir, file);
      const sql = await fs.readFile(filePath, 'utf8');
      
      // Split by semicolon and filter empty statements
      const statements = sql.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          await pool.execute(statement.trim());
        }
      }
      
      console.log(`✅ ${file} completed`);
    }

    console.log('🎉 All migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
};

runMigrations();