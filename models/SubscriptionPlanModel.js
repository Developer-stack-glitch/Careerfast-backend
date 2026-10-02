const pool = require("../config/dbConfig");

const SubscriptionPlanModel = {
  getAllPlans: async () => {
    try {
      const query = `
        SELECT 
          p.*,
          COUNT(DISTINCT CASE WHEN rs.status = 'Active' THEN rs.id END) AS active_subscribers,
          COUNT(DISTINCT rs.id) AS total_subscribers
        FROM subscription_plans p
        LEFT JOIN recruiter_subscriptions rs ON p.id = rs.plan_id
        GROUP BY p.id
        ORDER BY p.price ASC, p.id ASC
      `;
      const [rows] = await pool.query(query);
      return rows;
    } catch (error) {
      throw error;
    }
  },

  getPlanById: async (id) => {
    try {
      const query = `
        SELECT 
          p.*,
          COUNT(DISTINCT CASE WHEN rs.status = 'Active' THEN rs.id END) AS active_subscribers,
          COUNT(DISTINCT rs.id) AS total_subscribers
        FROM subscription_plans p
        LEFT JOIN recruiter_subscriptions rs ON p.id = rs.plan_id
        WHERE p.id = ?
        GROUP BY p.id
      `;
      const [rows] = await pool.query(query, [id]);
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  createPlan: async (planData) => {
    try {
      const {
        name,
        slug,
        description,
        plan_type = 'monthly',
        price = 0,
        currency = 'INR',
        validity_days = 30,
        job_post_limit = 5,
        active_job_limit = 3,
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
      } = planData;

      // Unique slug generator if needed
      let finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const [existingSlug] = await pool.query(`SELECT id FROM subscription_plans WHERE slug = ?`, [finalSlug]);
      if (existingSlug.length > 0) {
        finalSlug = `${finalSlug}-${Date.now().toString().slice(-4)}`;
      }

      const insertQuery = `
        INSERT INTO subscription_plans (
          name, slug, description, plan_type, price, currency, validity_days,
          job_post_limit, active_job_limit, featured_job_limit, urgent_job_limit, sub_recruiter_limit,
          resume_view_limit, resume_download_limit, email_limit, whatsapp_limit, excel_download_limit, candidate_search, candidate_contact, resume_database,
          interview_management, application_management, shortlisting, company_profile, recruiter_dashboard, email_notifications, company_branding,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        name, finalSlug, description, plan_type, price, currency, validity_days,
        job_post_limit, active_job_limit, featured_job_limit, urgent_job_limit, sub_recruiter_limit,
        resume_view_limit, resume_download_limit, email_limit, whatsapp_limit, excel_download_limit,
        candidate_search ? 1 : 0,
        candidate_contact ? 1 : 0,
        resume_database ? 1 : 0,
        interview_management ? 1 : 0,
        application_management ? 1 : 0,
        shortlisting ? 1 : 0,
        company_profile ? 1 : 0,
        recruiter_dashboard ? 1 : 0,
        email_notifications ? 1 : 0,
        company_branding ? 1 : 0,
        status
      ];

      const [result] = await pool.query(insertQuery, values);
      return result.insertId;
    } catch (error) {
      throw error;
    }
  },

  updatePlan: async (id, planData) => {
    try {
      const {
        name,
        description,
        plan_type,
        price,
        currency,
        validity_days,
        job_post_limit,
        active_job_limit,
        featured_job_limit,
        urgent_job_limit,
        sub_recruiter_limit,
        resume_view_limit,
        resume_download_limit,
        email_limit,
        whatsapp_limit,
        excel_download_limit,
        candidate_search,
        candidate_contact,
        resume_database,
        interview_management,
        application_management,
        shortlisting,
        company_profile,
        recruiter_dashboard,
        email_notifications,
        company_branding,
        status
      } = planData;

      const updateQuery = `
        UPDATE subscription_plans SET
          name = COALESCE(?, name),
          description = COALESCE(?, description),
          plan_type = COALESCE(?, plan_type),
          price = COALESCE(?, price),
          currency = COALESCE(?, currency),
          validity_days = COALESCE(?, validity_days),
          job_post_limit = COALESCE(?, job_post_limit),
          active_job_limit = COALESCE(?, active_job_limit),
          featured_job_limit = COALESCE(?, featured_job_limit),
          urgent_job_limit = COALESCE(?, urgent_job_limit),
          sub_recruiter_limit = COALESCE(?, sub_recruiter_limit),
          resume_view_limit = COALESCE(?, resume_view_limit),
          resume_download_limit = COALESCE(?, resume_download_limit),
          email_limit = COALESCE(?, email_limit),
          whatsapp_limit = COALESCE(?, whatsapp_limit),
          excel_download_limit = COALESCE(?, excel_download_limit),
          candidate_search = COALESCE(?, candidate_search),
          candidate_contact = COALESCE(?, candidate_contact),
          resume_database = COALESCE(?, resume_database),
          interview_management = COALESCE(?, interview_management),
          application_management = COALESCE(?, application_management),
          shortlisting = COALESCE(?, shortlisting),
          company_profile = COALESCE(?, company_profile),
          recruiter_dashboard = COALESCE(?, recruiter_dashboard),
          email_notifications = COALESCE(?, email_notifications),
          company_branding = COALESCE(?, company_branding),
          status = COALESCE(?, status)
        WHERE id = ?
      `;

      const values = [
        name, description, plan_type, price, currency, validity_days,
        job_post_limit, active_job_limit, featured_job_limit, urgent_job_limit, sub_recruiter_limit,
        resume_view_limit, resume_download_limit, email_limit, whatsapp_limit, excel_download_limit,
        candidate_search !== undefined ? (candidate_search ? 1 : 0) : null,
        candidate_contact !== undefined ? (candidate_contact ? 1 : 0) : null,
        resume_database !== undefined ? (resume_database ? 1 : 0) : null,
        interview_management !== undefined ? (interview_management ? 1 : 0) : null,
        application_management !== undefined ? (application_management ? 1 : 0) : null,
        shortlisting !== undefined ? (shortlisting ? 1 : 0) : null,
        company_profile !== undefined ? (company_profile ? 1 : 0) : null,
        recruiter_dashboard !== undefined ? (recruiter_dashboard ? 1 : 0) : null,
        email_notifications !== undefined ? (email_notifications ? 1 : 0) : null,
        company_branding !== undefined ? (company_branding ? 1 : 0) : null,
        status,
        id
      ];

      const [result] = await pool.query(updateQuery, values);
      return result.affectedRows;
    } catch (error) {
      throw error;
    }
  },

  duplicatePlan: async (id) => {
    try {
      const original = await SubscriptionPlanModel.getPlanById(id);
      if (!original) throw new Error("Original plan not found");

      const newName = `Copy of ${original.name}`;
      const newSlug = `${original.slug}-copy-${Date.now().toString().slice(-4)}`;

      const { id: _, active_subscribers, total_subscribers, created_at, updated_at, ...copyData } = original;
      copyData.name = newName;
      copyData.slug = newSlug;

      return await SubscriptionPlanModel.createPlan(copyData);
    } catch (error) {
      throw error;
    }
  },

  togglePlanStatus: async (id, status) => {
    try {
      const [result] = await pool.query(
        `UPDATE subscription_plans SET status = ? WHERE id = ?`,
        [status, id]
      );
      return result.affectedRows;
    } catch (error) {
      throw error;
    }
  },

  deletePlan: async (id) => {
    try {
      // Check active subscriptions using this plan
      const [activeSubs] = await pool.query(
        `SELECT COUNT(*) as count FROM recruiter_subscriptions WHERE plan_id = ? AND status = 'Active'`,
        [id]
      );

      if (activeSubs[0].count > 0) {
        const error = new Error(`Cannot delete plan: ${activeSubs[0].count} active subscription(s) are currently using this plan. Please deactivate the plan instead.`);
        error.code = 'ACTIVE_SUBSCRIPTIONS_EXIST';
        error.activeCount = activeSubs[0].count;
        throw error;
      }

      const [result] = await pool.query(`DELETE FROM subscription_plans WHERE id = ?`, [id]);
      return result.affectedRows;
    } catch (error) {
      throw error;
    }
  },

  getSubscribersByPlanId: async (planId) => {
    try {
      const query = `
        SELECT 
          rs.id AS subscription_id,
          rs.recruiter_id,
          rs.company_id,
          rs.plan_id,
          rs.billing_cycle,
          rs.price_paid,
          rs.start_date,
          rs.expiry_date,
          rs.status AS subscription_status,
          rs.payment_status,
          rs.created_at AS subscription_created_at,
          sp.name AS plan_name,
          sp.slug AS plan_slug,
          sp.price AS plan_price,
          sp.job_post_limit,
          sp.active_job_limit,
          sp.resume_view_limit,
          sp.resume_download_limit,
          sp.sub_recruiter_limit,
          u.first_name,
          u.last_name,
          u.email AS recruiter_email,
          u.phone AS recruiter_phone,
          u.is_active AS user_active,
          hp.company_name,
          hp.website_url,
          hp.industry_type,
          hp.contact_email,
          hp.contact_phone,
          COALESCE(
            NULLIF(hp.profile_image, ''),
            NULLIF(u.profile_image, ''),
            (SELECT jp.company_logo FROM job_post jp WHERE jp.user_id = rs.recruiter_id AND jp.company_logo IS NOT NULL AND jp.company_logo != '' AND jp.company_logo NOT LIKE '%dummy_img%' ORDER BY jp.id DESC LIMIT 1)
          ) AS company_logo,
          COALESCE(NULLIF(u.profile_image, ''), NULLIF(hp.profile_image, '')) AS profile_image,
          COALESCE(NULLIF(u.profile_image, ''), NULLIF(hp.profile_image, '')) AS user_avatar,
          GREATEST(
            COALESCE(su.job_posts_used, 0),
            (
              SELECT COUNT(*) 
              FROM job_post jp 
              WHERE (jp.user_id = rs.recruiter_id OR jp.user_id IN (SELECT sr.sub_recruiter_id FROM sub_recruiters sr WHERE sr.main_recruiter_id = rs.recruiter_id))
            )
          ) AS job_posts_used,
          COALESCE(su.resume_views_used, 0) AS resume_views_used,
          COALESCE(su.resume_downloads_used, 0) AS resume_downloads_used,
          COALESCE(su.featured_jobs_used, 0) AS featured_jobs_used,
          COALESCE(su.urgent_jobs_used, 0) AS urgent_jobs_used,
          (
            SELECT COUNT(*) 
            FROM job_post jp 
            WHERE (jp.user_id = rs.recruiter_id OR jp.user_id IN (SELECT sr.sub_recruiter_id FROM sub_recruiters sr WHERE sr.main_recruiter_id = rs.recruiter_id))
              AND (jp.is_closed = 0 OR jp.is_closed IS NULL)
          ) AS active_jobs_count
        FROM recruiter_subscriptions rs
        INNER JOIN users u ON rs.recruiter_id = u.id
        LEFT JOIN subscription_plans sp ON rs.plan_id = sp.id
        LEFT JOIN hr_profiles hp ON rs.company_id = hp.id OR rs.recruiter_id = hp.user_id
        LEFT JOIN subscription_usage su ON rs.id = su.subscription_id
        WHERE rs.plan_id = ?
        ORDER BY rs.created_at DESC
      `;
      const [rows] = await pool.query(query, [planId]);
      return rows;
    } catch (error) {
      throw error;
    }
  }
};

module.exports = SubscriptionPlanModel;
