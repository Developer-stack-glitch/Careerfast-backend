const pool = require("../config/dbConfig");

async function migrateFreePlan() {
  try {
    console.log("🚀 Checking and adding Free Plan to subscription_plans...");

    const [existing] = await pool.query(
      `SELECT * FROM subscription_plans WHERE slug = 'free' OR name = 'Free Plan' OR name = 'Free'`
    );

    if (existing.length > 0) {
      console.log("ℹ️ Existing Free Plan found with ID:", existing[0].id);
      await pool.query(`
        UPDATE subscription_plans SET 
          name = 'Free Plan',
          slug = 'free',
          description = 'Free starter plan for new recruiters with 20 job postings per month up to 40 total job postings.',
          plan_type = 'monthly',
          price = 0.00,
          currency = 'INR',
          validity_days = 60,
          job_post_limit = 40,
          active_job_limit = 20,
          featured_job_limit = 0,
          urgent_job_limit = 0,
          sub_recruiter_limit = 1,
          resume_view_limit = 50,
          resume_download_limit = 10,
          email_limit = 50,
          whatsapp_limit = 50,
          excel_download_limit = 50,
          candidate_search = 0,
          candidate_contact = 0,
          resume_database = 0,
          interview_management = 1,
          application_management = 1,
          shortlisting = 1,
          company_profile = 1,
          recruiter_dashboard = 1,
          email_notifications = 1,
          company_branding = 0,
          status = 'active'
        WHERE id = ?
      `, [existing[0].id]);
      console.log("✅ Free Plan updated successfully.");
    } else {
      const [insertRes] = await pool.query(`
        INSERT INTO subscription_plans (
          name, slug, description, plan_type, price, currency, validity_days,
          job_post_limit, active_job_limit, featured_job_limit, urgent_job_limit, sub_recruiter_limit,
          resume_view_limit, resume_download_limit, email_limit, whatsapp_limit, excel_download_limit,
          candidate_search, candidate_contact, resume_database,
          interview_management, application_management, shortlisting, company_profile, recruiter_dashboard, email_notifications, company_branding,
          status
        ) VALUES (
          'Free Plan', 'free', 'Free starter plan for new recruiters with 20 job postings per month up to 40 total job postings.', 'monthly', 0.00, 'INR', 60,
          40, 20, 0, 0, 1,
          50, 10, 50, 50, 50,
          0, 0, 0,
          1, 1, 1, 1, 1, 1, 0,
          'active'
        )
      `);
      console.log("✅ Free Plan created successfully with ID:", insertRes.insertId);
    }

    const [plans] = await pool.query(`
      SELECT id, name, slug, price, validity_days, job_post_limit, active_job_limit, status 
      FROM subscription_plans 
      ORDER BY price ASC, id ASC
    `);
    console.log("📋 Current Subscription Plans in Database:");
    console.table(plans);

    process.exit(0);
  } catch (err) {
    console.error("❌ Migration error:", err);
    process.exit(1);
  }
}

migrateFreePlan();
