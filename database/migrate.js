// database/migrate.js (ENHANCED VERSION)
const fs = require('fs').promises;
const path = require('path');
const { pool } = require('../src/core/db/connection');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

class MigrationManager {
  constructor() {
    this.migrationsDir = path.join(__dirname, 'migrations');
  }

  /**
   * Create migrations tracking table if it doesn't exist
   */
  async setupMigrationsTable() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_migration_name (migration_name)
      )
    `;
    
    await pool.execute(createTableSQL);
    console.log(`${colors.cyan}✓${colors.reset} Migration tracking table ready`);
  }

  /**
   * Get list of already executed migrations
   */
  async getExecutedMigrations() {
    try {
      const [rows] = await pool.execute(
        'SELECT migration_name FROM schema_migrations ORDER BY executed_at'
      );
      return rows.map(row => row.migration_name);
    } catch (error) {
      // If table doesn't exist yet, return empty array
      return [];
    }
  }

  /**
   * Mark migration as executed
   */
  async markMigrationExecuted(migrationName) {
    await pool.execute(
      'INSERT INTO schema_migrations (migration_name) VALUES (?)',
      [migrationName]
    );
  }

  /**
   * Get all migration files
   */
  async getMigrationFiles() {
    const files = await fs.readdir(this.migrationsDir);
    return files
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort alphabetically
  }

  /**
   * Execute a single SQL statement
   */
    async executeStatement(statement) {
    const trimmed = statement.trim();
    if (!trimmed) return;

    try {
      await pool.execute(trimmed);
    } catch (error) {
      // Treat idempotent DDL as success
      const msg = (error.message || '').toLowerCase();
      if (
        error.code === 'ER_TABLE_EXISTS_ERROR' ||        // table exists
        error.errno === 1061 ||                          // duplicate key name
        msg.includes('already exists') ||
        msg.includes('duplicate key name')
      ) {
        console.log(`${colors.yellow}  ⚠ Skipping (already exists)${colors.reset}`);
        return;
      }
      throw error;
    }
  }


  /**
   * Execute a migration file
   */
  async executeMigration(filename) {
    console.log(`\n${colors.blue}📄 Executing: ${filename}${colors.reset}`);
    
    const filePath = path.join(this.migrationsDir, filename);
    const sql = await fs.readFile(filePath, 'utf8');
    
    // Split by semicolon and filter empty statements
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`   Found ${statements.length} statements`);
    
    for (let i = 0; i < statements.length; i++) {
      try {
        await this.executeStatement(statements[i]);
        process.stdout.write('.');
      } catch (error) {
        console.log(`\n${colors.red}✗ Failed at statement ${i + 1}${colors.reset}`);
        throw error;
      }
    }
    
    console.log(`\n${colors.green}✓ ${filename} completed${colors.reset}`);
  }

  /**
   * Run all pending migrations
   */
  async runMigrations() {
    console.log(`\n${colors.cyan}╔════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.cyan}║   Kozi Database Migration Tool     ║${colors.reset}`);
    console.log(`${colors.cyan}╚════════════════════════════════════╝${colors.reset}\n`);

    try {
      // Setup migrations tracking
      await this.setupMigrationsTable();
      
      // Get migration status
      const executedMigrations = await this.getExecutedMigrations();
      const allMigrationFiles = await this.getMigrationFiles();
      
      // Find pending migrations
      const pendingMigrations = allMigrationFiles.filter(
        file => !executedMigrations.includes(file)
      );

      console.log(`\n${colors.cyan}Status:${colors.reset}`);
      console.log(`  Total migrations: ${allMigrationFiles.length}`);
      console.log(`  Already executed: ${executedMigrations.length}`);
      console.log(`  Pending: ${pendingMigrations.length}`);

      if (pendingMigrations.length === 0) {
        console.log(`\n${colors.green}✓ Database is up to date!${colors.reset}`);
        return;
      }

      console.log(`\n${colors.yellow}⚡ Running ${pendingMigrations.length} pending migration(s)...${colors.reset}`);

      // Execute each pending migration
      for (const filename of pendingMigrations) {
        await this.executeMigration(filename);
        await this.markMigrationExecuted(filename);
      }

      console.log(`\n${colors.green}╔════════════════════════════════════╗${colors.reset}`);
      console.log(`${colors.green}║    ✓ All migrations completed!     ║${colors.reset}`);
      console.log(`${colors.green}╚════════════════════════════════════╝${colors.reset}\n`);

    } catch (error) {
      console.error(`\n${colors.red}╔════════════════════════════════════╗${colors.reset}`);
      console.error(`${colors.red}║     ✗ Migration failed!            ║${colors.reset}`);
      console.error(`${colors.red}╚════════════════════════════════════╝${colors.reset}\n`);
      console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
      
      if (error.sql) {
        console.error(`\n${colors.yellow}Failed SQL:${colors.reset}`);
        console.error(error.sql.substring(0, 200) + '...');
      }
      
      process.exit(1);
    }
  }

  /**
   * Show migration status
   */
  async showStatus() {
    console.log(`\n${colors.cyan}Migration Status:${colors.reset}\n`);
    
    await this.setupMigrationsTable();
    const executedMigrations = await this.getExecutedMigrations();
    const allMigrationFiles = await this.getMigrationFiles();
    
    console.log('Executed migrations:');
    if (executedMigrations.length === 0) {
      console.log('  (none)');
    } else {
      executedMigrations.forEach(name => {
        console.log(`  ${colors.green}✓${colors.reset} ${name}`);
      });
    }
    
    const pending = allMigrationFiles.filter(
      file => !executedMigrations.includes(file)
    );
    
    if (pending.length > 0) {
      console.log('\nPending migrations:');
      pending.forEach(name => {
        console.log(`  ${colors.yellow}○${colors.reset} ${name}`);
      });
    }
    
    console.log('');
  }

  /**
   * Rollback last migration (dangerous - use with caution)
   */
  async rollbackLast() {
    console.log(`\n${colors.yellow}⚠ Rolling back last migration...${colors.reset}\n`);
    
    const executedMigrations = await this.getExecutedMigrations();
    
    if (executedMigrations.length === 0) {
      console.log('No migrations to rollback');
      return;
    }
    
    const lastMigration = executedMigrations[executedMigrations.length - 1];
    console.log(`Removing: ${lastMigration}`);
    
    await pool.execute(
      'DELETE FROM schema_migrations WHERE migration_name = ?',
      [lastMigration]
    );
    
    console.log(`${colors.yellow}⚠ Migration record removed. Manual cleanup of database changes required!${colors.reset}`);
  }
}

// CLI interface
async function main() {
  const manager = new MigrationManager();
  const command = process.argv[2];

  try {
    switch (command) {
      case 'status':
        await manager.showStatus();
        break;
      
      case 'rollback':
        console.log(`${colors.red}Warning: This only removes the migration record!${colors.reset}`);
        console.log(`${colors.red}You must manually undo database changes.${colors.reset}\n`);
        await manager.rollbackLast();
        break;
      
      default:
        await manager.runMigrations();
    }
    
    process.exit(0);
  } catch (error) {
    console.error(`${colors.red}Fatal error:${colors.reset}`, error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = MigrationManager;