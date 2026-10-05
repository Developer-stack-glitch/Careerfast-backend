const pool = require("./config/dbConfig");

async function createSubscriptionTables() {
  try {
    console.log("🚀 Starting database setup for Subscription & Recruiter Management...");

    // 1. Ensure hr_profiles has gst_number
    try {
      await pool.query(`ALTER TABLE hr_profiles ADD COLUMN gst_number VARCHAR(50) NULL AFTER map_location;`);
      console.log("✅ Added gst_number column to hr_profiles");
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME' || err.message.includes('Duplicate column')) {
        console.log("ℹ️ Column gst_number already exists in hr_profiles");
      } else {
        console.warn("⚠️ Note on gst_number:", err.message);
      }
    }

    // 2. Create subscription_plans table
    const createPlansTable = `
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        plan_type ENUM('monthly', 'yearly', 'custom') DEFAULT 'monthly',
        price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        currency VARCHAR(10) DEFAULT 'INR',
        validity_days INT NOT NULL DEFAULT 30,
        
        /* Job Posting Limits */
        job_post_limit INT NOT NULL DEFAULT 5,
        active_job_limit INT NOT NULL DEFAULT 3,
        featured_job_limit INT NOT NULL DEFAULT 0,
        urgent_job_limit INT NOT NULL DEFAULT 0,

        /* Candidate / Resume Limits */
        resume_view_limit INT NOT NULL DEFAULT 50,
        resume_download_limit INT NOT NULL DEFAULT 10,
        candidate_search BOOLEAN DEFAULT 0,
        candidate_contact BOOLEAN DEFAULT 0,
        resume_database BOOLEAN DEFAULT 0,

        /* Recruiter Features */
        interview_management BOOLEAN DEFAULT 1,
        application_management BOOLEAN DEFAULT 1,
        shortlisting BOOLEAN DEFAULT 1,
        company_profile BOOLEAN DEFAULT 1,
        recruiter_dashboard BOOLEAN DEFAULT 1,
        email_notifications BOOLEAN DEFAULT 1,

        /* Additional Features */
        company_branding BOOLEAN DEFAULT 0,
        
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    await pool.query(createPlansTable);
    console.log("✅ Table subscription_plans created or verified.");

    // 3. Create recruiter_subscriptions table
    const createSubscriptionsTable = `
      CREATE TABLE IF NOT EXISTS recruiter_subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        recruiter_id BIGINT NOT NULL,
        company_id INT NULL,
        plan_id INT NOT NULL,
        billing_cycle ENUM('monthly', 'yearly', 'custom') DEFAULT 'monthly',
        price_paid DECIMAL(10, 2) DEFAULT 0.00,
        start_date DATETIME NOT NULL,
        expiry_date DATETIME NOT NULL,
        status ENUM('Trial', 'Active', 'Expiring Soon', 'Expired', 'Suspended', 'Cancelled') DEFAULT 'Active',
        payment_status ENUM('Paid', 'Pending', 'Failed', 'Refunded') DEFAULT 'Paid',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_recruiter_status (recruiter_id, status),
        INDEX idx_plan (plan_id),
        INDEX idx_expiry (expiry_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    await pool.query(createSubscriptionsTable);
    console.log("✅ Table recruiter_subscriptions created or verified.");

    // 4. Create subscription_usage table
    const createUsageTable = `
      CREATE TABLE IF NOT EXISTS subscription_usage (
        id INT AUTO_INCREMENT PRIMARY KEY,
        subscription_id INT NOT NULL,
        recruiter_id BIGINT NOT NULL,
        billing_period_start DATETIME NOT NULL,
        billing_period_end DATETIME NOT NULL,
        job_posts_used INT DEFAULT 0,
        resume_views_used INT DEFAULT 0,
        resume_downloads_used INT DEFAULT 0,
        featured_jobs_used INT DEFAULT 0,
        urgent_jobs_used INT DEFAULT 0,
        candidate_contacts_used INT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_subscription_recruiter (subscription_id, recruiter_id),
        INDEX idx_billing_period (billing_period_start, billing_period_end)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    await pool.query(createUsageTable);
    console.log("✅ Table subscription_usage created or verified.");

    // 5. Create subscription_history table
    const createHistoryTable = `
      CREATE TABLE IF NOT EXISTS subscription_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        subscription_id INT NOT NULL,
        recruiter_id BIGINT NOT NULL,
        old_plan_id INT NULL,
        new_plan_id INT NOT NULL,
        change_type VARCHAR(50) NOT NULL, /* initial_assignment, change_plan, extension, status_change */
        effective_type VARCHAR(50) DEFAULT 'immediately', /* immediately, next_renewal */
        previous_expiry DATETIME NULL,
        new_expiry DATETIME NULL,
        reason TEXT NULL,
        changed_by_admin_id BIGINT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_recruiter_history (recruiter_id),
        INDEX idx_sub_history (subscription_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    await pool.query(createHistoryTable);
    console.log("✅ Table subscription_history created or verified.");

    // 6. Create recruiter_payments table
    const createPaymentsTable = `
      CREATE TABLE IF NOT EXISTS recruiter_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_id VARCHAR(100) UNIQUE NOT NULL,
        recruiter_id BIGINT NOT NULL,
        company_id INT NULL,
        plan_id INT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        payment_method VARCHAR(50) DEFAULT 'Admin Manual / Bank Transfer',
        transaction_id VARCHAR(100) NULL,
        payment_status ENUM('Paid', 'Pending', 'Failed', 'Refunded') DEFAULT 'Paid',
        billing_period_start DATETIME NOT NULL,
        billing_period_end DATETIME NOT NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_recruiter_payments (recruiter_id),
        INDEX idx_invoice (invoice_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    await pool.query(createPaymentsTable);
    console.log("✅ Table recruiter_payments created or verified.");

    // 7. Create admin_audit_logs table
    const createAuditLogsTable = `
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        admin_id BIGINT NOT NULL,
        action VARCHAR(100) NOT NULL,
        target_type VARCHAR(50) NOT NULL,
        target_id VARCHAR(100) NOT NULL,
        old_value JSON NULL,
        new_value JSON NULL,
        ip_address VARCHAR(50) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_admin_actions (admin_id, created_at),
        INDEX idx_target (target_type, target_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    await pool.query(createAuditLogsTable);
    console.log("✅ Table admin_audit_logs created or verified.");

    // 8. Create recruiter_resume_access table
    const createResumeAccessTable = `
      CREATE TABLE IF NOT EXISTS recruiter_resume_access (
        id INT AUTO_INCREMENT PRIMARY KEY,
        recruiter_id BIGINT NOT NULL,
        subscription_id INT NOT NULL,
        candidate_id BIGINT NOT NULL,
        action_type ENUM('view', 'download') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_rec_sub_cand_action (recruiter_id, subscription_id, candidate_id, action_type),
        INDEX idx_recruiter_action (recruiter_id, action_type),
        INDEX idx_sub_action (subscription_id, action_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    await pool.query(createResumeAccessTable);
    console.log("✅ Table recruiter_resume_access created or verified.");

    // 9. Seed default plans: Basic, Professional, Premium
    const [existingPlans] = await pool.query(`SELECT COUNT(*) as count FROM subscription_plans`);
    if (existingPlans[0].count === 0) {
      const seedPlansQuery = `
        INSERT INTO subscription_plans (
          name, slug, description, plan_type, price, currency, validity_days,
          job_post_limit, active_job_limit, featured_job_limit, urgent_job_limit,
          resume_view_limit, resume_download_limit, candidate_search, candidate_contact, resume_database,
          interview_management, application_management, shortlisting, company_profile, recruiter_dashboard, email_notifications, company_branding,
          status
        ) VALUES 
        (
          'Free Plan', 'free', 'Free starter plan for new recruiters with 20 job postings per month up to 40 total job postings.', 'monthly', 0.00, 'INR', 60,
          40, 20, 0, 0,
          50, 10, 0, 0, 0,
          1, 1, 1, 1, 1, 1, 0,
          'active'
        ),
        (
          'Basic', 'basic', 'Essential recruitment plan for hiring entry-level candidates and startups.', 'monthly', 4999.00, 'INR', 30,
          5, 3, 0, 0,
          50, 10, 0, 0, 0,
          1, 1, 1, 1, 1, 1, 0,
          'active'
        ),
        (
          'Professional', 'professional', 'Designed for growing companies with regular recruitment requirements.', 'monthly', 9999.00, 'INR', 30,
          15, 10, 2, 2,
          250, 50, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 0,
          'active'
        ),
        (
          'Premium', 'premium', 'High-volume hiring suite with candidate database search, featured postings and priority visibility.', 'monthly', 19999.00, 'INR', 30,
          30, 20, 5, 5,
          1000, 250, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1,
          'active'
        );
      `;
      await pool.query(seedPlansQuery);
      console.log("✅ Seeded default subscription plans: Free Plan, Basic, Professional, Premium.");
    } else {
      console.log("ℹ️ Subscription plans already populated. Count:", existingPlans[0].count);
    }

    console.log("🎉 Database setup completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error setting up subscription tables:", error);
    process.exit(1);
  }
}

createSubscriptionTables();
