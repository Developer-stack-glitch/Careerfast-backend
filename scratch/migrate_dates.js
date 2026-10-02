const pool = require('../config/dbConfig');

async function migrate() {
  try {
    console.log('1. Modifying created_at column to remove ON UPDATE current_timestamp()...');
    await pool.query('ALTER TABLE job_post MODIFY COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
    console.log('   -> Modified created_at successfully.');

    console.log('2. Checking if approved_at column exists...');
    const [cols] = await pool.query("SHOW COLUMNS FROM job_post LIKE 'approved_at'");
    if (cols.length === 0) {
      console.log('   -> Adding approved_at column...');
      await pool.query('ALTER TABLE job_post ADD COLUMN approved_at TIMESTAMP NULL DEFAULT NULL AFTER approval_status');
      console.log('   -> Added approved_at successfully.');
    } else {
      console.log('   -> approved_at column already exists.');
    }

    console.log('3. Populating approved_at for existing approved jobs...');
    const [res] = await pool.query("UPDATE job_post SET approved_at = created_at WHERE approval_status = 'approved' AND approved_at IS NULL");
    console.log(`   -> Updated ${res.affectedRows} rows.`);

    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
