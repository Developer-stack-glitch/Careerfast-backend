const pool = require("./dbConfig");

/**
 * Automatically creates necessary database performance indexes if they do not already exist.
 * This guarantees fast query execution and prevents full table scans on large datasets.
 */

async function ensureDatabaseIndexes() {
  const ensureIndex = async (table, indexName, columns) => {
    try {
      const [rows] = await pool.query(
        `SHOW INDEX FROM ${table} WHERE Key_name = ?`,
        [indexName]
      );
      if (rows.length === 0) {
        await pool.query(`CREATE INDEX ${indexName} ON ${table} (${columns})`);
        console.log(`⚡ [DB Index] Created index ${indexName} on ${table}(${columns})`);
      }
    } catch (err) {
      // Don't crash server if table doesn't exist or column type prevents index
      console.warn(`⚠️ [DB Index] Could not check/create index ${indexName} on ${table}:`, err.message);
    }
  };

  try {
    // Indexes on `users`
    await ensureIndex("users", "idx_users_role_active", "role_id, is_active, created_date");
    await ensureIndex("users", "idx_users_created_date", "created_date");
    await ensureIndex("users", "idx_users_location", "location(50)");
    await ensureIndex("users", "idx_users_gender", "gender(10)");

    // Indexes on `user_professional`
    await ensureIndex("user_professional", "idx_user_prof_user_del", "user_id, is_deleted");
    await ensureIndex("user_professional", "idx_user_prof_curr", "user_id, currently_working, is_deleted");
    await ensureIndex("user_professional", "idx_user_prof_title", "job_title(100)");
    await ensureIndex("user_professional", "idx_user_prof_comp", "company_name(100)");
    await ensureIndex("user_professional", "idx_user_prof_desig", "designation(100)");

    // Indexes on `user_education`
    await ensureIndex("user_education", "idx_user_edu_user_del", "user_id, is_deleted");
    await ensureIndex("user_education", "idx_user_edu_course", "course(100)");
    await ensureIndex("user_education", "idx_user_edu_qual", "qualification(50)");

    // Ensure industry_types table exists
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS industry_types (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          is_active BIT(1) DEFAULT b'1',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);
    } catch (tblErr) {
      console.warn("⚠️ [DB] industry_types check:", tblErr.message);
    }

    // Ensure essential columns across tables
    const ensureColumn = async (table, col, def) => {
      try {
        const [cols] = await pool.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [col]);
        if (cols.length === 0) {
          await pool.query(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
          console.log(`⚡ [DB Schema] Added column ${col} to ${table}`);
        }
      } catch (err) {
        console.warn(`⚠️ [DB Schema] Column check ${col} on ${table}:`, err.message);
      }
    };

    // users columns
    await ensureColumn("users", "auto_approve", "TINYINT(1) DEFAULT 0");

    // job_post columns
    await ensureColumn("job_post", "approval_status", "VARCHAR(50) DEFAULT 'approved'");
    await ensureColumn("job_post", "approved_at", "DATETIME NULL");
    await ensureColumn("job_post", "rejection_reason", "TEXT NULL");
    await ensureColumn("job_post", "is_closed", "TINYINT(1) DEFAULT 0");
    await ensureColumn("job_post", "team_members", "JSON NULL");
    await ensureColumn("job_post", "apply_link", "VARCHAR(500) NULL");
    await ensureColumn("job_post", "is_walk_in", "TINYINT(1) DEFAULT 0");
    await ensureColumn("job_post", "walk_in_start_date", "DATE NULL");
    await ensureColumn("job_post", "walk_in_end_date", "DATE NULL");
    await ensureColumn("job_post", "walk_in_start_time", "VARCHAR(50) NULL");
    await ensureColumn("job_post", "walk_in_end_time", "VARCHAR(50) NULL");
    await ensureColumn("job_post", "recruiter_name", "VARCHAR(255) NULL");
    await ensureColumn("job_post", "mobile_number", "VARCHAR(50) NULL");
    await ensureColumn("job_post", "venue_address", "TEXT NULL");
    await ensureColumn("job_post", "google_maps_url", "VARCHAR(500) NULL");
    await ensureColumn("job_post", "variable_amount", "DECIMAL(10,2) NULL");
    await ensureColumn("job_post", "variable_format", "VARCHAR(50) NULL");
    await ensureColumn("job_post", "bonus_amount", "DECIMAL(10,2) NULL");
    await ensureColumn("job_post", "bonus_format", "VARCHAR(50) NULL");

    // subscription_plans columns
    await ensureColumn("subscription_plans", "email_limit", "INT NOT NULL DEFAULT 50");
    await ensureColumn("subscription_plans", "whatsapp_limit", "INT NOT NULL DEFAULT 50");
    await ensureColumn("subscription_plans", "excel_download_limit", "INT NOT NULL DEFAULT 50");
    await ensureColumn("subscription_plans", "sub_recruiter_limit", "INT NOT NULL DEFAULT 1");

    // subscription_usage columns
    await ensureColumn("subscription_usage", "emails_sent", "INT NOT NULL DEFAULT 0");
    await ensureColumn("subscription_usage", "emails_used", "INT NOT NULL DEFAULT 0");
    await ensureColumn("subscription_usage", "whatsapp_messages_sent", "INT NOT NULL DEFAULT 0");
    await ensureColumn("subscription_usage", "whatsapp_used", "INT NOT NULL DEFAULT 0");
    await ensureColumn("subscription_usage", "excel_downloads_used", "INT NOT NULL DEFAULT 0");

    // Initialize Support Tickets tables and demo data if needed
    try {
      const SupportTicketModel = require("../models/SupportTicketModel");
      await SupportTicketModel.initTable();
    } catch (ticketErr) {
      console.warn("⚠️ [Support Tickets] Init check:", ticketErr.message);
    }

    console.log("✅ [DB Index] Database search indexes and schemas verified successfully");
  } catch (error) {
    console.warn("⚠️ [DB Index] Index verification warning:", error.message);
  }
}

module.exports = ensureDatabaseIndexes;

