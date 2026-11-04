const pool = require("../config/dbConfig");

async function createJobNvitesTable() {
  try {
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS job_nvites (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        recruiter_id BIGINT NOT NULL,
        job_id BIGINT NOT NULL,
        candidate_id BIGINT NOT NULL,
        subject VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        template_type VARCHAR(50) DEFAULT 'standard',
        share_contact TINYINT(1) DEFAULT 1,
        expires_at DATETIME NULL,
        status ENUM('sent', 'viewed', 'accepted', 'declined', 'expired') DEFAULT 'sent',
        decline_reason VARCHAR(255) NULL,
        decline_note TEXT NULL,
        viewed_at DATETIME NULL,
        responded_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_nvites_recruiter (recruiter_id),
        INDEX idx_nvites_candidate (candidate_id),
        INDEX idx_nvites_job (job_id),
        INDEX idx_nvites_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await pool.query(createTableSql);
    console.log("✅ job_nvites table created successfully or already exists!");

    const [columns] = await pool.query("DESCRIBE job_nvites");
    console.log("Columns:", columns.map((c) => `${c.Field} (${c.Type})`));

    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating job_nvites table:", error);
    process.exit(1);
  }
}

createJobNvitesTable();

