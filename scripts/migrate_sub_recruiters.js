const pool = require("../config/dbConfig");

async function runMigration() {
  try {
    console.log("🚀 Running Sub-Recruiter Database Migration...");

    // 1. Add sub_recruiter_limit to subscription_plans
    try {
      await pool.query("ALTER TABLE subscription_plans ADD COLUMN sub_recruiter_limit INT NOT NULL DEFAULT 1 AFTER urgent_job_limit;");
      console.log("✅ Added sub_recruiter_limit column to subscription_plans");
    } catch (e) {
      if (e.code === "ER_DUP_FIELDNAME" || e.message.includes("Duplicate column")) {
        console.log("ℹ️ Column sub_recruiter_limit already exists in subscription_plans");
      } else {
        console.error("⚠️ Error adding column:", e.message);
      }
    }

    // 2. Set default plan sub_recruiter_limits
    try {
      await pool.query("UPDATE subscription_plans SET sub_recruiter_limit = 1 WHERE slug = 'basic' OR name LIKE '%Basic%'");
      await pool.query("UPDATE subscription_plans SET sub_recruiter_limit = 3 WHERE slug = 'professional' OR name LIKE '%Professional%'");
      await pool.query("UPDATE subscription_plans SET sub_recruiter_limit = 10 WHERE slug = 'premium' OR name LIKE '%Premium%'");
      console.log("✅ Updated default plan sub_recruiter_limits");
    } catch (e) {
      console.warn("⚠️ Note on updating plan defaults:", e.message);
    }

    // 3. Create sub_recruiters table
    const createSubRecruitersQuery = `
      CREATE TABLE IF NOT EXISTS sub_recruiters (
        id INT AUTO_INCREMENT PRIMARY KEY,
        main_recruiter_id BIGINT NOT NULL,
        sub_recruiter_id BIGINT NOT NULL,
        company_id INT NULL,
        designation VARCHAR(100) DEFAULT 'Recruiter',
        role_preset ENUM('team_admin', 'recruiter', 'sourcer', 'custom') DEFAULT 'recruiter',
        permissions JSON NOT NULL,
        status ENUM('active', 'suspended') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_main (main_recruiter_id),
        INDEX idx_sub (sub_recruiter_id),
        INDEX idx_company (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    await pool.query(createSubRecruitersQuery);
    console.log("✅ Table sub_recruiters created or verified successfully.");

    process.exit(0);
  } catch (err) {
    console.error("❌ Migration error:", err);
    process.exit(1);
  }
}

runMigration();
