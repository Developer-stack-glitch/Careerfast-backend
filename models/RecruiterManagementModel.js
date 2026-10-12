const pool = require("../config/dbConfig");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { sendRecruiterWelcomeEmail } = require("./EmailModel");

const RecruiterManagementModel = {
  getAllRecruiters: async (filters = {}) => {
    try {
      const {
        search = "",
        planId = "",
        status = "",
        subscriptionStatus = "",
        company = "",
        startDate = "",
        endDate = ""
      } = filters;

      let query = `
        SELECT 
          u.id AS recruiter_id,
          CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS recruiter_name,
          u.first_name,
          u.last_name,
          u.email,
          u.phone,
          CAST(u.is_active AS UNSIGNED) AS user_active,
          u.created_date AS recruiter_created_date,
          COALESCE(u.last_active, u.updated_date, u.created_date) AS last_active,
          CAST(COALESCE(u.auto_approve, 0) AS UNSIGNED) AS auto_approve,

          hp.id AS company_id,
          COALESCE(hp.company_name, u.organization, 'Individual Recruiter') AS company_name,
          hp.website_url,
          hp.industry_type,
          hp.organization_type,
          COALESCE(
            NULLIF(hp.profile_image, ''),
            NULLIF(u.profile_image, ''),
            (SELECT jp.company_logo FROM job_post jp WHERE jp.user_id = u.id AND jp.company_logo IS NOT NULL AND jp.company_logo != '' AND jp.company_logo NOT LIKE '%dummy_img%' ORDER BY jp.id DESC LIMIT 1)
          ) AS company_logo,
          COALESCE(NULLIF(u.profile_image, ''), NULLIF(hp.profile_image, '')) AS user_avatar,
          hp.gst_number,

          rs.id AS subscription_id,
          rs.plan_id,
          sp.name AS plan_name,
          sp.slug AS plan_slug,
          sp.plan_type,
          rs.billing_cycle,
          rs.price_paid,
          rs.start_date AS subscription_start,
          rs.expiry_date AS subscription_expiry,
          COALESCE(rs.status, 'No Plan') AS subscription_status,
          COALESCE(rs.payment_status, 'Unpaid') AS payment_status,

          /* Limits */
          COALESCE(sp.job_post_limit, 0) AS job_post_limit,
          COALESCE(sp.active_job_limit, 0) AS active_job_limit,
          COALESCE(sp.resume_view_limit, 0) AS resume_view_limit,
          COALESCE(sp.resume_download_limit, 0) AS resume_download_limit,
          COALESCE(sp.featured_job_limit, 0) AS featured_job_limit,
          COALESCE(sp.urgent_job_limit, 0) AS urgent_job_limit,
          COALESCE(NULLIF(u.allocated_seats, 0), sp.sub_recruiter_limit, 1) AS sub_recruiter_limit,
          COALESCE(sp.email_limit, 0) AS email_limit,
          COALESCE(sp.whatsapp_limit, 0) AS whatsapp_limit,
          COALESCE(sp.excel_download_limit, 0) AS excel_download_limit,
          GREATEST(COALESCE(c.max_master_recruiters, 1), COALESCE(sp.master_login_limit, 1)) AS master_login_limit,
          c.max_master_recruiters,
          c.total_sub_recruiter_seats,
          (
            SELECT COUNT(*) 
            FROM users u2 
            WHERE (u2.company_id = u.company_id OR (u.company_id IS NULL AND u2.organization = u.organization))
              AND u2.role_id = 3
              AND (u2.master_recruiter_id IS NULL OR u2.master_recruiter_id = 0)
              AND u2.id NOT IN (SELECT sub_recruiter_id FROM sub_recruiters)
          ) AS master_recruiters_count,
          (
            SELECT COUNT(*) 
            FROM sub_recruiters sr 
            WHERE sr.company_id = u.company_id OR sr.main_recruiter_id = u.id
          ) AS company_sub_recruiters_count,

          /* Real-time Usage */
          GREATEST(
            COALESCE(su.job_posts_used, 0),
            (
              SELECT COUNT(*) 
              FROM job_post jp 
              WHERE (jp.user_id = u.id OR jp.user_id IN (SELECT sr.sub_recruiter_id FROM sub_recruiters sr WHERE sr.main_recruiter_id = u.id))
            )
          ) AS job_posts_used,
          COALESCE(su.resume_views_used, 0) AS resume_views_used,
          COALESCE(su.resume_downloads_used, 0) AS resume_downloads_used,
          COALESCE(su.emails_sent, 0) AS emails_used,
          COALESCE(su.emails_sent, 0) AS emails_sent,
          COALESCE(su.whatsapp_messages_sent, 0) AS whatsapp_used,
          COALESCE(su.whatsapp_messages_sent, 0) AS whatsapp_messages_sent,
          COALESCE(su.excel_downloads_used, 0) AS excel_downloads_used,
          COALESCE(su.featured_jobs_used, 0) AS featured_jobs_used,
          COALESCE(su.urgent_jobs_used, 0) AS urgent_jobs_used,
          (
            SELECT COUNT(*) 
            FROM sub_recruiters sr 
            WHERE sr.main_recruiter_id = u.id
          ) AS sub_recruiters_count,
          (
            SELECT COUNT(*) 
            FROM job_post jp 
            WHERE (jp.user_id = u.id OR jp.user_id IN (SELECT sr.sub_recruiter_id FROM sub_recruiters sr WHERE sr.main_recruiter_id = u.id))
              AND (jp.is_closed = 0 OR jp.is_closed IS NULL)
          ) AS active_jobs_count,
          (
            SELECT MAX(jp.created_at) 
            FROM job_post jp 
            WHERE (jp.user_id = u.id OR jp.user_id IN (SELECT sr.sub_recruiter_id FROM sub_recruiters sr WHERE sr.main_recruiter_id = u.id))
          ) AS last_job_posted

        FROM users u
        LEFT JOIN hr_profiles hp ON u.id = hp.user_id
        LEFT JOIN companies c ON (u.company_id = c.id OR (u.company_id IS NULL AND c.name = u.organization))
        LEFT JOIN recruiter_subscriptions rs ON u.id = rs.recruiter_id AND rs.id = (
          SELECT MAX(id) FROM recruiter_subscriptions WHERE recruiter_id = u.id
        )
        LEFT JOIN subscription_plans sp ON rs.plan_id = sp.id
        LEFT JOIN subscription_usage su ON rs.id = su.subscription_id
        WHERE u.role_id = 3
          AND (u.master_recruiter_id IS NULL OR u.master_recruiter_id = 0)
          AND u.id NOT IN (SELECT sub_recruiter_id FROM sub_recruiters)
          AND u.id = (
            SELECT MIN(u_prime.id)
            FROM users u_prime
            WHERE (
              (u.company_id IS NOT NULL AND u_prime.company_id = u.company_id)
              OR (u.company_id IS NULL AND u_prime.organization = u.organization)
            )
            AND u_prime.role_id = 3
            AND (u_prime.master_recruiter_id IS NULL OR u_prime.master_recruiter_id = 0)
            AND u_prime.id NOT IN (SELECT sub_recruiter_id FROM sub_recruiters)
          )
      `;

      const params = [];

      if (search) {
        query += ` AND (
          u.first_name LIKE ? OR 
          u.last_name LIKE ? OR 
          u.email LIKE ? OR 
          hp.company_name LIKE ? OR 
          u.organization LIKE ?
        )`;
        const s = `%${search}%`;
        params.push(s, s, s, s, s);
      }

      if (planId) {
        if (planId === 'custom') {
          query += ` AND sp.plan_type = 'Custom'`;
        } else {
          query += ` AND rs.plan_id = ?`;
          params.push(planId);
        }
      }

      if (status) {
        if (status === 'Active') {
          query += ` AND u.is_active = 1`;
        } else if (status === 'Suspended' || status === 'Disabled') {
          query += ` AND (u.is_active = 0 OR u.is_active IS NULL)`;
        } else if (status === 'AutoApprove') {
          query += ` AND u.auto_approve = 1`;
        }
      }

      if (subscriptionStatus) {
        query += ` AND rs.status = ?`;
        params.push(subscriptionStatus);
      }

      if (company) {
        query += ` AND (hp.company_name LIKE ? OR u.organization LIKE ?)`;
        params.push(`%${company}%`, `%${company}%`);
      }

      if (startDate && endDate) {
        query += ` AND DATE(u.created_date) BETWEEN ? AND ?`;
        params.push(startDate, endDate);
      } else if (startDate) {
        query += ` AND DATE(u.created_date) >= ?`;
        params.push(startDate);
      } else if (endDate) {
        query += ` AND DATE(u.created_date) <= ?`;
        params.push(endDate);
      }

      query += ` ORDER BY u.id DESC`;

      const [rows] = await pool.query(query, params);
      return rows;
    } catch (error) {
      throw error;
    }
  },

  getRecruiterById: async (recruiterId) => {
    try {
      const recruiterQuery = `
        SELECT 
          u.id AS recruiter_id,
          u.first_name,
          u.last_name,
          CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS recruiter_name,
          u.email,
          u.phone,
          CAST(u.is_active AS UNSIGNED) AS user_active,
          CAST(COALESCE(u.auto_approve, 0) AS UNSIGNED) AS auto_approve,
          u.created_date,
          COALESCE(u.last_active, u.updated_date, u.created_date) AS last_active,
          u.profile_image AS user_avatar,

          hp.id AS company_id,
          COALESCE(hp.company_name, u.organization, 'Individual Recruiter') AS company_name,
          hp.website_url,
          hp.about_us AS company_description,
          hp.industry_type,
          hp.organization_type,
          hp.team_size,
          hp.year_established,
          hp.contact_phone AS company_phone,
          hp.contact_email AS company_email,
          COALESCE(
            NULLIF(hp.profile_image, ''),
            NULLIF(u.profile_image, ''),
            (SELECT jp.company_logo FROM job_post jp WHERE jp.user_id = u.id AND jp.company_logo IS NOT NULL AND jp.company_logo != '' AND jp.company_logo NOT LIKE '%dummy_img%' ORDER BY jp.id DESC LIMIT 1)
          ) AS company_logo,
          hp.gst_number,

          ua.address1,
          ua.city,
          ua.state,
          ua.country,
          ua.pincode,

          rs.id AS subscription_id,
          rs.plan_id,
          sp.name AS plan_name,
          sp.slug AS plan_slug,
          sp.description AS plan_description,
          sp.price AS plan_price,
          sp.plan_type,
          rs.billing_cycle,
          rs.price_paid,
          rs.start_date AS subscription_start,
          rs.expiry_date AS subscription_expiry,
          rs.status AS subscription_status,
          rs.payment_status,

          /* Limits */
          COALESCE(sp.job_post_limit, 0) AS job_post_limit,
          COALESCE(sp.active_job_limit, 0) AS active_job_limit,
          COALESCE(sp.resume_view_limit, 0) AS resume_view_limit,
          COALESCE(sp.resume_download_limit, 0) AS resume_download_limit,
          COALESCE(sp.featured_job_limit, 0) AS featured_job_limit,
          COALESCE(sp.urgent_job_limit, 0) AS urgent_job_limit,
          COALESCE(NULLIF(u.allocated_seats, 0), sp.sub_recruiter_limit, 1) AS sub_recruiter_limit,
          COALESCE(sp.email_limit, 0) AS email_limit,
          COALESCE(sp.whatsapp_limit, 0) AS whatsapp_limit,
          COALESCE(sp.excel_download_limit, 0) AS excel_download_limit,
          GREATEST(COALESCE(c.max_master_recruiters, 1), COALESCE(sp.master_login_limit, 1)) AS master_login_limit,
          c.max_master_recruiters,
          c.total_sub_recruiter_seats,

          /* Feature Permissions */
          COALESCE(sp.candidate_search, 0) AS candidate_search,
          COALESCE(sp.candidate_contact, 0) AS candidate_contact,
          COALESCE(sp.resume_database, 0) AS resume_database,
          COALESCE(sp.interview_management, 1) AS interview_management,
          COALESCE(sp.application_management, 1) AS application_management,
          COALESCE(sp.shortlisting, 1) AS shortlisting,
          COALESCE(sp.company_profile, 1) AS company_profile,
          COALESCE(sp.recruiter_dashboard, 1) AS recruiter_dashboard,
          COALESCE(sp.email_notifications, 1) AS email_notifications,
          COALESCE(sp.company_branding, 0) AS company_branding,

          /* Usage counters */
          GREATEST(
            COALESCE(su.job_posts_used, 0),
            (
              SELECT COUNT(*) 
              FROM job_post jp 
              WHERE (jp.user_id = u.id OR jp.user_id IN (SELECT sr.sub_recruiter_id FROM sub_recruiters sr WHERE sr.main_recruiter_id = u.id))
            )
          ) AS job_posts_used,
          COALESCE(su.resume_views_used, 0) AS resume_views_used,
          COALESCE(su.resume_downloads_used, 0) AS resume_downloads_used,
          COALESCE(su.emails_sent, 0) AS emails_used,
          COALESCE(su.emails_sent, 0) AS emails_sent,
          COALESCE(su.whatsapp_messages_sent, 0) AS whatsapp_used,
          COALESCE(su.whatsapp_messages_sent, 0) AS whatsapp_messages_sent,
          COALESCE(su.excel_downloads_used, 0) AS excel_downloads_used,
          COALESCE(su.featured_jobs_used, 0) AS featured_jobs_used,
          COALESCE(su.urgent_jobs_used, 0) AS urgent_jobs_used,
          COALESCE(su.candidate_contacts_used, 0) AS candidate_contacts_used,
          (
            SELECT COUNT(*) 
            FROM sub_recruiters sr 
            WHERE sr.main_recruiter_id = u.id
          ) AS sub_recruiters_count,
          (
            SELECT COUNT(*) 
            FROM job_post jp 
            WHERE (jp.user_id = u.id OR jp.user_id IN (SELECT sr.sub_recruiter_id FROM sub_recruiters sr WHERE sr.main_recruiter_id = u.id))
              AND (jp.is_closed = 0 OR jp.is_closed IS NULL)
          ) AS active_jobs_count,
          (
            SELECT MAX(jp.created_at) 
            FROM job_post jp 
            WHERE (jp.user_id = u.id OR jp.user_id IN (SELECT sr.sub_recruiter_id FROM sub_recruiters sr WHERE sr.main_recruiter_id = u.id))
          ) AS last_job_posted

        FROM users u
        LEFT JOIN hr_profiles hp ON u.id = hp.user_id
        LEFT JOIN companies c ON (u.company_id = c.id OR (u.company_id IS NULL AND c.name = u.organization))
        LEFT JOIN user_address ua ON u.id = ua.user_id
        LEFT JOIN recruiter_subscriptions rs ON u.id = rs.recruiter_id AND rs.id = (
          SELECT MAX(id) FROM recruiter_subscriptions WHERE recruiter_id = u.id
        )
        LEFT JOIN subscription_plans sp ON rs.plan_id = sp.id
        LEFT JOIN subscription_usage su ON rs.id = su.subscription_id
        WHERE u.id = ? AND u.role_id = 3
      `;

      const [recruiterRows] = await pool.query(recruiterQuery, [recruiterId]);
      if (recruiterRows.length === 0) return null;
      const recruiter = recruiterRows[0];

      // Fetch subscription history
      const [historyRows] = await pool.query(`
        SELECT 
          sh.*,
          old_sp.name AS old_plan_name,
          new_sp.name AS new_plan_name,
          CONCAT(COALESCE(admin.first_name, ''), ' ', COALESCE(admin.last_name, '')) AS changed_by_name
        FROM subscription_history sh
        LEFT JOIN subscription_plans old_sp ON sh.old_plan_id = old_sp.id
        LEFT JOIN subscription_plans new_sp ON sh.new_plan_id = new_sp.id
        LEFT JOIN users admin ON sh.changed_by_admin_id = admin.id
        WHERE sh.recruiter_id = ?
        ORDER BY sh.created_at DESC
      `, [recruiterId]);

      // Fetch payment history
      const [paymentsRows] = await pool.query(`
        SELECT 
          rp.*,
          sp.name AS plan_name
        FROM recruiter_payments rp
        LEFT JOIN subscription_plans sp ON rp.plan_id = sp.id
        WHERE rp.recruiter_id = ?
        ORDER BY rp.payment_date DESC
      `, [recruiterId]);

      // Fetch admin audit logs for this recruiter
      const [auditRows] = await pool.query(`
        SELECT 
          al.*,
          CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS admin_name
        FROM admin_audit_logs al
        LEFT JOIN users u ON al.admin_id = u.id
        WHERE (al.target_type = 'recruiter' AND al.target_id = ?)
           OR (al.target_type = 'subscription' AND al.target_id = ?)
        ORDER BY al.created_at DESC
        LIMIT 20
      `, [String(recruiterId), String(recruiter.subscription_id || '')]);

      // Fetch master recruiters for this company
      const [masterRecruitersRows] = await pool.query(
        `SELECT u2.id, u2.first_name, u2.last_name,
                CONCAT(COALESCE(u2.first_name, ''), ' ', COALESCE(u2.last_name, '')) AS recruiter_name,
                u2.email, u2.phone, CAST(u2.is_active AS UNSIGNED) AS is_active,
                u2.created_date, COALESCE(u2.last_active, u2.updated_date, u2.created_date) AS last_active,
                COALESCE(u2.allocated_seats, 0) AS allocated_seats,
                (SELECT COUNT(*) FROM sub_recruiters sr WHERE sr.main_recruiter_id = u2.id) AS sub_recruiters_count
         FROM users u2
         LEFT JOIN recruiter_subscriptions rs2 ON u2.id = rs2.recruiter_id AND rs2.id = (
           SELECT MAX(id) FROM recruiter_subscriptions WHERE recruiter_id = u2.id
         )
         LEFT JOIN subscription_plans sp2 ON rs2.plan_id = sp2.id
         WHERE (u2.company_id = ? OR (u2.organization IS NOT NULL AND u2.organization != '' AND u2.organization = ?))
           AND u2.role_id = 3
           AND (u2.master_recruiter_id IS NULL OR u2.master_recruiter_id = 0)
           AND u2.id NOT IN (SELECT sub_recruiter_id FROM sub_recruiters)
         ORDER BY u2.id ASC`,
        [recruiter.company_id || 0, recruiter.company_name || '']
      );

      const totalCompanySeats = Number(recruiter.total_sub_recruiter_seats || recruiter.sub_recruiter_limit || 1);
      const allocatedSubSeatsSum = masterRecruitersRows.reduce((sum, m) => sum + Number(m.allocated_seats || 0), 0);
      const availableSubSeats = Math.max(0, totalCompanySeats - allocatedSubSeatsSum);

      return {
        ...recruiter,
        total_sub_recruiter_seats: totalCompanySeats,
        allocated_sub_seats_sum: allocatedSubSeatsSum,
        available_sub_seats: availableSubSeats,
        master_recruiters: masterRecruitersRows,
        master_recruiters_count: masterRecruitersRows.length,
        subscription_history: historyRows,
        payments: paymentsRows,
        audit_logs: auditRows
      };
    } catch (error) {
      throw error;
    }
  },

  createRecruiterWithSubscription: async (payload, adminId = 1) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const {
        // Company details
        company_name,
        company_email,
        company_phone,
        website,
        industry,
        company_type,
        company_logo,
        company_description,
        address,
        city,
        state,
        country = 'India',
        pincode,
        gst_number,

        // Recruiter details
        recruiter_name,
        designation,
        email,
        mobile_number,
        username,
        password,

      // Subscription details
        plan_id,
        custom_limits, // added
        billing_cycle = 'monthly',

        start_date,
        expiry_date,
        payment_status = 'Paid',
        subscription_status = 'Active'
      } = payload;

      // 1. Check existing email
      const [existingUser] = await connection.query(
        `SELECT id FROM users WHERE email = ?`,
        [email.trim().toLowerCase()]
      );
      if (existingUser.length > 0) {
        throw new Error(`A user with email ${email} already exists.`);
      }

      // 2. Fetch Plan to calculate defaults & limits
      let plan = null;
      if (plan_id === 'custom') {
          plan = { id: 'custom', validity_days: 30, price: 0 };
      } else {
          const [planRows] = await connection.query(
            `SELECT * FROM subscription_plans WHERE id = ?`,
            [plan_id]
          );
          if (planRows.length === 0) {
            throw new Error(`Selected subscription plan not found.`);
          }
          plan = planRows[0];
      }

      // 3. Calculate start and expiry dates
      const startDateObj = start_date ? new Date(start_date) : new Date();
      let expiryDateObj;
      if (expiry_date) {
        expiryDateObj = new Date(expiry_date);
      } else {
        expiryDateObj = new Date(startDateObj);
        if (billing_cycle === 'yearly') {
          expiryDateObj.setFullYear(expiryDateObj.getFullYear() + 1);
        } else {
          const validityDays = plan.validity_days || 30;
          expiryDateObj.setDate(expiryDateObj.getDate() + validityDays);
        }
      }

      // Format dates for MySQL
      const formattedStart = startDateObj.toISOString().slice(0, 19).replace('T', ' ');
      const formattedExpiry = expiryDateObj.toISOString().slice(0, 19).replace('T', ' ');

      // 4. Determine Master Login Count and Sub-Recruiter Seats per Master Login
      const masterLoginLimit = Math.max(1, Number(
        custom_limits?.master_login_limit !== undefined
          ? custom_limits.master_login_limit
          : (payload.master_login_limit !== undefined ? payload.master_login_limit : (plan.master_login_limit || 1))
      ) || 1);

      const subRecruiterLimit = Math.max(0, Number(
        custom_limits?.sub_recruiter_limit !== undefined
          ? custom_limits.sub_recruiter_limit
          : (payload.sub_recruiter_limit !== undefined ? payload.sub_recruiter_limit : (plan.sub_recruiter_limit || 1))
      ) || 1);

      // Check or insert into companies table
      let realCompanyId = null;
      const [existingComp] = await connection.query(
        `SELECT id, max_master_recruiters, total_sub_recruiter_seats FROM companies WHERE name = ? LIMIT 1`,
        [company_name.trim()]
      );

      if (existingComp.length > 0) {
        realCompanyId = existingComp[0].id;
        const [existingMasters] = await connection.query(
          `SELECT COUNT(*) as count FROM users 
           WHERE (company_id = ? OR organization = ?) 
             AND role_id = 3 
             AND (master_recruiter_id IS NULL OR master_recruiter_id = 0)
             AND id NOT IN (SELECT sub_recruiter_id FROM sub_recruiters)`,
          [realCompanyId, company_name.trim()]
        );
        const currentMasters = existingMasters[0]?.count || 0;
        if (currentMasters >= masterLoginLimit) {
          throw new Error(`Master Login limit reached: Company "${company_name.trim()}" already has ${currentMasters} of ${masterLoginLimit} Master Recruiter accounts.`);
        }

        await connection.query(
          `UPDATE companies SET 
             max_master_recruiters = ?,
             total_sub_recruiter_seats = ?,
             plan_id = ?,
             updated_at = NOW()
           WHERE id = ?`,
          [
            masterLoginLimit,
            subRecruiterLimit,
            plan.id === 'custom' ? null : plan.id,
            realCompanyId
          ]
        );
      } else {
        const [compResult] = await connection.query(
          `INSERT INTO companies (
             name, email, phone, website, industry, company_type, logo, description,
             address, city, state, country, pincode, gst_number, plan_id,
             max_master_recruiters, total_sub_recruiter_seats, status, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
          [
            company_name.trim(),
            company_email || email || '',
            company_phone || mobile_number || '',
            website || null,
            industry || 'Information Technology',
            company_type || 'Corporate',
            company_logo || null,
            company_description || null,
            address || null,
            city || null,
            state || null,
            country || 'India',
            pincode || null,
            gst_number || null,
            plan.id === 'custom' ? null : plan.id,
            masterLoginLimit,
            subRecruiterLimit
          ]
        );
        realCompanyId = compResult.insertId;
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Split name into first_name and last_name
      const nameParts = (recruiter_name || '').trim().split(/\s+/);
      const firstName = nameParts[0] || 'Recruiter';
      const lastName = nameParts.slice(1).join(' ') || '';

      // 5. Create user account in `users` (role_id = 3, master_recruiter_id = NULL)
      const insertUserQuery = `
        INSERT INTO users (
          first_name, last_name, email, password, phone, phone_code,
          role_id, is_active, organization, company_id, allocated_seats, master_recruiter_id, created_date, is_email_verified
        ) VALUES (?, ?, ?, ?, ?, '+91', 3, 1, ?, ?, ?, NULL, NOW(), 1)
      `;
      const [userResult] = await connection.query(insertUserQuery, [
        firstName,
        lastName,
        email.trim().toLowerCase(),
        hashedPassword,
        mobile_number || '',
        company_name || '',
        realCompanyId,
        subRecruiterLimit
      ]);
      const newUserId = userResult.insertId;

      // 6. Create company profile in `hr_profiles`
      const insertHrQuery = `
        INSERT INTO hr_profiles (
          user_id, company_name, about_us, organization_type, industry_type,
          website_url, contact_phone, contact_email, profile_image, gst_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const [hrResult] = await connection.query(insertHrQuery, [
        newUserId,
        company_name || 'Company',
        company_description || '',
        company_type || '',
        industry || '',
        website || '',
        company_phone || mobile_number || '',
        company_email || email || '',
        company_logo || null,
        gst_number || null
      ]);
      const newCompanyId = hrResult.insertId;

      // 7. Insert address in `user_address`
      if (address || city || state || pincode) {
        await connection.query(`
          INSERT INTO user_address (user_id, address1, city, state, country, pincode, created_date)
          VALUES (?, ?, ?, ?, ?, ?, NOW())
        `, [newUserId, address || '', city || '', state || '', country || 'India', pincode || '']);
      }

      // 8. Handle Custom Plan Creation
      if (plan.id === 'custom') {
          const customPlanName = `Custom Plan - User ${newUserId}`;
          const customSlug = `custom-user-${newUserId}-${Date.now()}`;
          const limits = custom_limits || {};
          const insertPlanQuery = `
            INSERT INTO subscription_plans (name, slug, description, plan_type, job_post_limit, active_job_limit, featured_job_limit, urgent_job_limit, resume_view_limit, resume_download_limit, sub_recruiter_limit, master_login_limit, email_limit, whatsapp_limit, excel_download_limit, validity_days, price, status)
            VALUES (?, ?, 'Custom plan configured by administrator', 'Custom', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 30, 0, 1)
          `;
          const [planResult] = await connection.query(insertPlanQuery, [
            customPlanName,
            customSlug,
            limits.job_post_limit || 0,
            limits.active_job_limit || 0,
            limits.featured_job_limit || 0,
            limits.urgent_job_limit || 0,
            limits.resume_view_limit || 0,
            limits.resume_download_limit || 0,
            subRecruiterLimit,
            masterLoginLimit,
            limits.email_sent_count !== undefined ? (Number(limits.email_sent_count) || 0) : (Number(limits.email_limit) || 0),
            limits.whatsapp_message_count !== undefined ? (Number(limits.whatsapp_message_count) || 0) : (limits.whatsapp_sent_count !== undefined ? (Number(limits.whatsapp_sent_count) || 0) : (Number(limits.whatsapp_limit) || 0)),
            limits.excel_download_count !== undefined ? (Number(limits.excel_download_count) || 0) : (limits.excel_downloads_limit !== undefined ? (Number(limits.excel_downloads_limit) || 0) : (Number(limits.excel_download_limit) || 0))
          ]);
          plan.id = planResult.insertId;

          // Sync plan_id in companies
          await connection.query(`UPDATE companies SET plan_id = ? WHERE id = ?`, [plan.id, realCompanyId]);
      }

      // 9. Create subscription in `recruiter_subscriptions`
      const pricePaid = billing_cycle === 'yearly' ? (plan.price * 12) : plan.price;
      const insertSubQuery = `
        INSERT INTO recruiter_subscriptions (
          recruiter_id, company_id, plan_id, billing_cycle, price_paid,
          start_date, expiry_date, status, payment_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const [subResult] = await connection.query(insertSubQuery, [
        newUserId,
        realCompanyId,
        plan.id,
        billing_cycle,
        pricePaid,
        formattedStart,
        formattedExpiry,
        subscription_status,
        payment_status
      ]);
      const newSubId = subResult.insertId;

      // 9. Initialize usage record in `subscription_usage`
      await connection.query(`
        INSERT INTO subscription_usage (
          subscription_id, recruiter_id, billing_period_start, billing_period_end,
          job_posts_used, resume_views_used, resume_downloads_used,
          featured_jobs_used, urgent_jobs_used, candidate_contacts_used
        ) VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 0)
      `, [newSubId, newUserId, formattedStart, formattedExpiry]);

      // 10. Record history in `subscription_history`
      await connection.query(`
        INSERT INTO subscription_history (
          subscription_id, recruiter_id, old_plan_id, new_plan_id,
          change_type, effective_type, previous_expiry, new_expiry, reason, changed_by_admin_id
        ) VALUES (?, ?, NULL, ?, 'initial_assignment', 'immediately', NULL, ?, 'Initial recruiter creation by Super Admin', ?)
      `, [newSubId, newUserId, plan.id, formattedExpiry, adminId]);

      // 11. Create payment invoice in `recruiter_payments`
      const invoiceId = `INV-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await connection.query(`
        INSERT INTO recruiter_payments (
          invoice_id, recruiter_id, company_id, plan_id, amount,
          payment_date, payment_method, payment_status,
          billing_period_start, billing_period_end, notes
        ) VALUES (?, ?, ?, ?, ?, NOW(), 'Super Admin Assigned', ?, ?, ?, ?)
      `, [
        invoiceId,
        newUserId,
        realCompanyId,
        plan.id,
        pricePaid,
        payment_status,
        formattedStart,
        formattedExpiry,
        `Initial subscription plan ${plan.name} assigned upon creation.`
      ]);

      // 12. Record in `admin_audit_logs`
      await connection.query(`
        INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, old_value, new_value)
        VALUES (?, 'Admin Created Recruiter', 'recruiter', ?, NULL, ?)
      `, [
        adminId,
        String(newUserId),
        JSON.stringify({
          recruiter_name,
          email,
          company_name,
          plan_name: plan.name,
          billing_cycle,
          expiry_date: formattedExpiry,
          master_login_limit: masterLoginLimit,
          sub_recruiter_limit: subRecruiterLimit
        })
      ]);

      await connection.commit();

      // Send branded welcome email with login credentials and logo
      sendRecruiterWelcomeEmail({
        email: email.trim().toLowerCase(),
        password,
        name: `${firstName} ${lastName}`.trim() || recruiter_name || 'Recruiter',
        companyName: company_name || 'Company',
        roleType: 'recruiter',
        designation: 'Primary Recruiter',
        seatQuota: subRecruiterLimit
      }).catch(err => console.error("[createRecruiter] Email dispatch error:", err));

      return {
        recruiter_id: newUserId,
        company_id: realCompanyId,
        subscription_id: newSubId,
        company_name,
        recruiter_name: `${firstName} ${lastName}`.trim(),
        email,
        plan_name: plan.name,
        subscription_status,
        expiry_date: formattedExpiry,
        master_login_limit: masterLoginLimit,
        sub_recruiter_limit: subRecruiterLimit
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  changePlan: async (recruiterId, payload, adminId = 1) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const {
        new_plan_id,
        effective_type = 'immediately', // 'immediately' | 'next_renewal'
        reason = 'Plan changed by Super Admin'
      } = payload;

      // 1. Fetch current subscription
      const [subRows] = await connection.query(`
        SELECT rs.*, sp.name AS current_plan_name, sp.validity_days 
        FROM recruiter_subscriptions rs
        INNER JOIN subscription_plans sp ON rs.plan_id = sp.id
        WHERE rs.recruiter_id = ?
        ORDER BY rs.id DESC LIMIT 1
      `, [recruiterId]);

      // 2. Fetch new plan
      const [newPlanRows] = await connection.query(`
        SELECT * FROM subscription_plans WHERE id = ?
      `, [new_plan_id]);
      if (newPlanRows.length === 0) {
        throw new Error("New plan not found.");
      }
      const newPlan = newPlanRows[0];

      // If recruiter has no existing subscription, create an initial active subscription
      if (subRows.length === 0) {
        const [hpRows] = await connection.query('SELECT id FROM hr_profiles WHERE user_id = ?', [recruiterId]);
        const companyId = hpRows[0]?.id || null;

        const now = new Date();
        const newExpiry = new Date(now);
        newExpiry.setDate(newExpiry.getDate() + (newPlan.validity_days || 30));
        const formattedStart = now.toISOString().slice(0, 19).replace('T', ' ');
        const formattedExpiry = newExpiry.toISOString().slice(0, 19).replace('T', ' ');

        const [subResult] = await connection.query(`
          INSERT INTO recruiter_subscriptions (
            recruiter_id, company_id, plan_id, billing_cycle, price_paid,
            start_date, expiry_date, status, payment_status
          ) VALUES (?, ?, ?, 'monthly', ?, ?, ?, 'Active', 'Paid')
        `, [recruiterId, companyId, newPlan.id, newPlan.price, formattedStart, formattedExpiry]);

        const newSubId = subResult.insertId;

        await connection.query(`
          INSERT INTO subscription_usage (
            subscription_id, recruiter_id, billing_period_start, billing_period_end,
            job_posts_used, resume_views_used, resume_downloads_used,
            featured_jobs_used, urgent_jobs_used, candidate_contacts_used
          ) VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 0)
        `, [newSubId, recruiterId, formattedStart, formattedExpiry]);

        await connection.query(`
          INSERT INTO subscription_history (
            subscription_id, recruiter_id, old_plan_id, new_plan_id,
            change_type, effective_type, previous_expiry, new_expiry, reason, changed_by_admin_id
          ) VALUES (?, ?, NULL, ?, 'initial_assignment', 'immediately', NULL, ?, ?, ?)
        `, [
          newSubId,
          recruiterId,
          newPlan.id,
          formattedExpiry,
          reason || `Assigned ${newPlan.name} plan by Super Admin`,
          adminId
        ]);

        await connection.commit();
        return {
          success: true,
          message: `Plan assigned successfully: ${newPlan.name}.`
        };
      }

      const currentSub = subRows[0];
      const now = new Date();
      let newExpiry = new Date(currentSub.expiry_date);

      if (effective_type === 'immediately') {
        // Reset expiry or retain depending on remaining time
        if (newExpiry < now) {
          newExpiry = new Date(now);
          newExpiry.setDate(newExpiry.getDate() + (newPlan.validity_days || 30));
        }

        const formattedExpiry = newExpiry.toISOString().slice(0, 19).replace('T', ' ');

        // Update current subscription
        await connection.query(`
          UPDATE recruiter_subscriptions 
          SET plan_id = ?, price_paid = ?, expiry_date = ?, status = 'Active', updated_at = NOW()
          WHERE id = ?
        `, [newPlan.id, newPlan.price, formattedExpiry, currentSub.id]);

        // Reset or adjust usage limits for new plan
        await connection.query(`
          UPDATE subscription_usage
          SET billing_period_start = NOW(), billing_period_end = ?, updated_at = NOW()
          WHERE subscription_id = ?
        `, [formattedExpiry, currentSub.id]);

        // Record history
        await connection.query(`
          INSERT INTO subscription_history (
            subscription_id, recruiter_id, old_plan_id, new_plan_id,
            change_type, effective_type, previous_expiry, new_expiry, reason, changed_by_admin_id
          ) VALUES (?, ?, ?, ?, 'change_plan', 'immediately', ?, ?, ?, ?)
        `, [
          currentSub.id,
          recruiterId,
          currentSub.plan_id,
          newPlan.id,
          currentSub.expiry_date,
          formattedExpiry,
          reason,
          adminId
        ]);

        // Audit log
        await connection.query(`
          INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, old_value, new_value)
          VALUES (?, 'Admin Changed Plan', 'recruiter', ?, ?, ?)
        `, [
          adminId,
          String(recruiterId),
          JSON.stringify({ plan: currentSub.current_plan_name, plan_id: currentSub.plan_id }),
          JSON.stringify({ plan: newPlan.name, plan_id: newPlan.id, effective_type })
        ]);
      } else {
        // Effective at next renewal - record in history and audit
        await connection.query(`
          INSERT INTO subscription_history (
            subscription_id, recruiter_id, old_plan_id, new_plan_id,
            change_type, effective_type, previous_expiry, new_expiry, reason, changed_by_admin_id
          ) VALUES (?, ?, ?, ?, 'change_plan_scheduled', 'next_renewal', ?, ?, ?, ?)
        `, [
          currentSub.id,
          recruiterId,
          currentSub.plan_id,
          newPlan.id,
          currentSub.expiry_date,
          currentSub.expiry_date,
          `Scheduled to switch to ${newPlan.name} at next renewal.`,
          adminId
        ]);
      }

      await connection.commit();
      return {
        success: true,
        message: `Plan changed successfully to ${newPlan.name} (${effective_type}).`
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  extendSubscription: async (recruiterId, daysToAdd, reason = "Subscription extended by Super Admin", adminId = 1) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [subRows] = await connection.query(`
        SELECT * FROM recruiter_subscriptions 
        WHERE recruiter_id = ? 
        ORDER BY id DESC LIMIT 1
      `, [recruiterId]);

      if (subRows.length === 0) {
        throw new Error("No subscription found for this recruiter. Please click Change Subscription Plan to assign an initial plan first.");
      }
      const sub = subRows[0];

      const currentExpiry = new Date(sub.expiry_date);
      const now = new Date();
      // If already expired, extend from now; otherwise extend from currentExpiry
      const baseDate = currentExpiry > now ? currentExpiry : now;
      const newExpiry = new Date(baseDate);
      newExpiry.setDate(newExpiry.getDate() + Number(daysToAdd));

      const formattedExpiry = newExpiry.toISOString().slice(0, 19).replace('T', ' ');

      // Update subscription
      await connection.query(`
        UPDATE recruiter_subscriptions 
        SET expiry_date = ?, status = 'Active', updated_at = NOW()
        WHERE id = ?
      `, [formattedExpiry, sub.id]);

      // Update usage period end
      await connection.query(`
        UPDATE subscription_usage 
        SET billing_period_end = ?, updated_at = NOW()
        WHERE subscription_id = ?
      `, [formattedExpiry, sub.id]);

      // Record in subscription_history
      await connection.query(`
        INSERT INTO subscription_history (
          subscription_id, recruiter_id, old_plan_id, new_plan_id,
          change_type, effective_type, previous_expiry, new_expiry, reason, changed_by_admin_id
        ) VALUES (?, ?, ?, ?, 'extension', 'immediately', ?, ?, ?, ?)
      `, [
        sub.id,
        recruiterId,
        sub.plan_id,
        sub.plan_id,
        sub.expiry_date,
        formattedExpiry,
        `Extended by ${daysToAdd} days: ${reason}`,
        adminId
      ]);

      // Audit log
      await connection.query(`
        INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, old_value, new_value)
        VALUES (?, 'Admin Extended Subscription', 'recruiter', ?, ?, ?)
      `, [
        adminId,
        String(recruiterId),
        JSON.stringify({ previous_expiry: sub.expiry_date }),
        JSON.stringify({ new_expiry: formattedExpiry, extended_days: daysToAdd })
      ]);

      await connection.commit();

      return {
        success: true,
        previous_expiry: sub.expiry_date,
        new_expiry: formattedExpiry,
        extended_days: daysToAdd
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  updateCustomPlan: async (recruiterId, limits, adminId) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Get current subscription
      const [subRows] = await connection.query(
        `SELECT rs.*, sp.plan_type, sp.name AS plan_name 
         FROM recruiter_subscriptions rs
         LEFT JOIN subscription_plans sp ON rs.plan_id = sp.id
         WHERE rs.recruiter_id = ? ORDER BY rs.id DESC LIMIT 1`,
        [recruiterId]
      );

      if (subRows.length === 0) {
        throw new Error("No active subscription found for this recruiter.");
      }
      const currentSub = subRows[0];
      const isOnlyJobPost = limits.plan_scope === 'only_job_post' || limits.is_only_job_post === true;
      const customPlanName = isOnlyJobPost 
        ? `Only Job Post - User ${recruiterId}` 
        : `Custom Plan - User ${recruiterId}`;
      const customSlug = `${isOnlyJobPost ? 'only-job-post' : 'custom'}-user-${recruiterId}-${Date.now()}`;

      let customPlanId;

      if ((currentSub.plan_type === 'Custom' || currentSub.plan_name?.toLowerCase().includes('custom') || currentSub.plan_name?.toLowerCase().includes('only job post')) && currentSub.plan_id) {
        // Update the existing custom plan limits and name
        await connection.query(
          `UPDATE subscription_plans SET 
            name = ?,
            plan_type = 'Custom',
            candidate_search = 1,
            candidate_contact = 1,
            resume_database = 1,
            job_post_limit = ?,
            active_job_limit = ?,
            featured_job_limit = ?,
            urgent_job_limit = ?,
            resume_view_limit = ?,
            resume_download_limit = ?,
            sub_recruiter_limit = ?,
            master_login_limit = ?,
            email_limit = ?,
            whatsapp_limit = ?,
            excel_download_limit = ?
           WHERE id = ?`,
          [
            customPlanName,
            limits.job_post_limit || 0,
            limits.active_job_limit || 0,
            limits.featured_job_limit || 0,
            limits.urgent_job_limit || 0,
            limits.resume_view_limit || 0,
            limits.resume_download_limit || 0,
            limits.sub_recruiter_limit || 1,
            limits.master_login_limit !== undefined ? (Number(limits.master_login_limit) || 1) : 1,
            limits.email_sent_count !== undefined ? (Number(limits.email_sent_count) || 0) : (Number(limits.email_limit) || 0),
            limits.whatsapp_message_count !== undefined ? (Number(limits.whatsapp_message_count) || 0) : (limits.whatsapp_sent_count !== undefined ? (Number(limits.whatsapp_sent_count) || 0) : (Number(limits.whatsapp_limit) || 0)),
            limits.excel_download_count !== undefined ? (Number(limits.excel_download_count) || 0) : (limits.excel_downloads_limit !== undefined ? (Number(limits.excel_downloads_limit) || 0) : (Number(limits.excel_download_limit) || 0)),
            currentSub.plan_id
          ]
        );
        customPlanId = currentSub.plan_id;
      } else {
        // 2. We will create a new 'Custom' plan in subscription_plans with unique slug
        const insertPlanQuery = `
          INSERT INTO subscription_plans (name, slug, description, plan_type, candidate_search, candidate_contact, resume_database, job_post_limit, active_job_limit, featured_job_limit, urgent_job_limit, resume_view_limit, resume_download_limit, sub_recruiter_limit, master_login_limit, email_limit, whatsapp_limit, excel_download_limit, validity_days, price, status)
          VALUES (?, ?, ?, 'Custom', 1, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 30, 0, 1)
        `;
        
        const [planResult] = await connection.query(insertPlanQuery, [
          customPlanName,
          customSlug,
          isOnlyJobPost ? 'Only job posting plan configured by administrator' : 'Custom plan configured by administrator',
          limits.job_post_limit || 0,
          limits.active_job_limit || 0,
          limits.featured_job_limit || 0,
          limits.urgent_job_limit || 0,
          limits.resume_view_limit || 0,
          limits.resume_download_limit || 0,
          limits.sub_recruiter_limit || 1,
          limits.master_login_limit !== undefined ? (Number(limits.master_login_limit) || 1) : 1,
          limits.email_sent_count !== undefined ? (Number(limits.email_sent_count) || 0) : (Number(limits.email_limit) || 0),
          limits.whatsapp_message_count !== undefined ? (Number(limits.whatsapp_message_count) || 0) : (limits.whatsapp_sent_count !== undefined ? (Number(limits.whatsapp_sent_count) || 0) : (Number(limits.whatsapp_limit) || 0)),
          limits.excel_download_count !== undefined ? (Number(limits.excel_download_count) || 0) : (limits.excel_downloads_limit !== undefined ? (Number(limits.excel_downloads_limit) || 0) : (Number(limits.excel_download_limit) || 0))
        ]);
        customPlanId = planResult.insertId;

        // 3. Point recruiter's subscription to this custom plan
        await connection.query(
          `UPDATE recruiter_subscriptions SET plan_id = ? WHERE id = ?`,
          [customPlanId, currentSub.id]
        );
      }

      // 4. Also sync company record and master recruiters' allocated seats
      const [userRow] = await connection.query(`SELECT company_id, organization FROM users WHERE id = ?`, [recruiterId]);
      const compId = userRow[0]?.company_id;
      const compOrg = userRow[0]?.organization;
      const mLoginLimit = limits.master_login_limit !== undefined ? (Number(limits.master_login_limit) || 1) : 1;
      const sRecLimit = limits.sub_recruiter_limit !== undefined ? (Number(limits.sub_recruiter_limit) || 1) : 1;

      if (compId || compOrg) {
        await connection.query(
          `UPDATE companies SET 
             max_master_recruiters = ?,
             total_sub_recruiter_seats = ?,
             plan_id = ?,
             updated_at = NOW()
           WHERE id = ? OR name = ?`,
          [
            mLoginLimit,
            sRecLimit,
            customPlanId,
            compId || 0,
            compOrg || ''
          ]
        );

        // If the primary master recruiter has 0 or unassigned allocated_seats, initialize it to sRecLimit
        await connection.query(
          `UPDATE users SET allocated_seats = ?
           WHERE (company_id = ? OR organization = ?)
             AND role_id = 3
             AND (master_recruiter_id IS NULL OR master_recruiter_id = 0)
             AND (allocated_seats IS NULL OR allocated_seats = 0)
             AND id = (
               SELECT min_id FROM (SELECT MIN(id) AS min_id FROM users WHERE (company_id = ? OR organization = ?) AND role_id = 3 AND (master_recruiter_id IS NULL OR master_recruiter_id = 0)) tmp
             )`,
          [
            sRecLimit,
            compId || 0,
            compOrg || '',
            compId || 0,
            compOrg || ''
          ]
        );
      }

      // 5. Log the action
      await connection.query(
        `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, old_value, new_value)
         VALUES (?, 'Admin Custom Plan Set', 'recruiter', ?, ?, ?)`,
        [
          adminId, 
          String(recruiterId),
          JSON.stringify({ old_plan_id: currentSub.plan_id }),
          JSON.stringify({ new_plan_id: customPlanId, limits })
        ]
      );

      await connection.commit();
      return { message: "Custom plan limits applied successfully." };
    } catch(err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  addMasterRecruiter: async (recruiterIdOrCompanyId, data, adminId = 1) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const {
        first_name,
        last_name = '',
        email,
        phone = '',
        password,
        designation = 'Master Recruiter',
        allocated_seats
      } = data;

      if (!first_name || !email || !password) {
        throw new Error("First name, email, and password are required.");
      }

      // Check if email already in use
      const [existingUser] = await connection.query(
        `SELECT id FROM users WHERE email = ?`,
        [email.trim().toLowerCase()]
      );
      if (existingUser.length > 0) {
        throw new Error("A user with this email address already exists.");
      }

      // 1. Identify Company and limits
      const [recruiterRows] = await connection.query(
        `SELECT u.id, u.organization, u.company_id, hp.company_name, hp.id as hr_profile_id,
                rs.plan_id, rs.billing_cycle, rs.price_paid, rs.start_date, rs.expiry_date, rs.status as subscription_status,
                sp.master_login_limit, sp.sub_recruiter_limit, sp.name as plan_name,
                c.id as comp_id, c.max_master_recruiters, c.name as comp_name
         FROM users u
         LEFT JOIN hr_profiles hp ON u.id = hp.user_id
         LEFT JOIN companies c ON u.company_id = c.id OR u.organization = c.name
         LEFT JOIN recruiter_subscriptions rs ON u.id = rs.recruiter_id AND rs.id = (
           SELECT MAX(id) FROM recruiter_subscriptions WHERE recruiter_id = u.id
         )
         LEFT JOIN subscription_plans sp ON rs.plan_id = sp.id
         WHERE u.id = ? OR c.id = ?
         LIMIT 1`,
        [recruiterIdOrCompanyId, recruiterIdOrCompanyId]
      );

      if (recruiterRows.length === 0) {
        throw new Error("Target company/recruiter account not found.");
      }

      const rec = recruiterRows[0];
      const companyId = rec.comp_id || rec.company_id || null;
      const companyName = rec.comp_name || rec.company_name || rec.organization || 'Company';
      const masterLimit = Number(rec.max_master_recruiters || rec.master_login_limit || 1);
      const subRecruiterLimit = Number(rec.sub_recruiter_limit || 1);
      const assignedSeats = allocated_seats !== undefined && allocated_seats !== '' ? Number(allocated_seats) : subRecruiterLimit;

      // 2. Count existing Master Recruiters for this company
      const [masterCountRows] = await connection.query(
        `SELECT COUNT(*) as count FROM users
         WHERE (company_id = ? OR organization = ?)
           AND role_id = 3
           AND (master_recruiter_id IS NULL OR master_recruiter_id = 0)
           AND id NOT IN (SELECT sub_recruiter_id FROM sub_recruiters)`,
        [companyId, companyName]
      );

      const currentMasterCount = masterCountRows[0]?.count || 0;
      if (currentMasterCount >= masterLimit) {
        throw new Error(`Master Login limit reached (${masterLimit} Master Recruiter accounts allowed for this company). Increase the Master Login Count in plan settings to add more.`);
      }

      // 3. Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // 4. Create Master Recruiter user (role_id = 3, master_recruiter_id = NULL)
      const [userResult] = await connection.query(
        `INSERT INTO users (
           first_name, last_name, email, password, phone, phone_code,
           role_id, is_active, organization, company_id, allocated_seats, master_recruiter_id,
           created_date, is_email_verified
         ) VALUES (?, ?, ?, ?, ?, '+91', 3, 1, ?, ?, ?, NULL, NOW(), 1)`,
        [
          first_name.trim(),
          last_name.trim(),
          email.trim().toLowerCase(),
          hashedPassword,
          phone || '',
          companyName,
          companyId,
          assignedSeats
        ]
      );
      const newUserId = userResult.insertId;

      // 5. Create company profile in hr_profiles
      const [existingHr] = await connection.query(
        `SELECT * FROM hr_profiles WHERE user_id = ? LIMIT 1`,
        [rec.id]
      );
      const hrData = existingHr[0] || {};
      await connection.query(
        `INSERT INTO hr_profiles (
           user_id, company_name, about_us, organization_type, industry_type,
           website_url, contact_phone, contact_email, profile_image, gst_number
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newUserId,
          companyName,
          hrData.about_us || '',
          hrData.organization_type || '',
          hrData.industry_type || '',
          hrData.website_url || '',
          phone || hrData.contact_phone || '',
          email || hrData.contact_email || '',
          hrData.profile_image || null,
          hrData.gst_number || null
        ]
      );

      // 6. Create active subscription linking to company's plan
      if (rec.plan_id) {
        const [subResult] = await connection.query(
          `INSERT INTO recruiter_subscriptions (
             recruiter_id, company_id, plan_id, billing_cycle, price_paid,
             start_date, expiry_date, status, payment_status
           ) VALUES (?, ?, ?, ?, 0.00, COALESCE(?, NOW()), COALESCE(?, DATE_ADD(NOW(), INTERVAL 30 DAY)), 'Active', 'Paid')`,
          [
            newUserId,
            companyId,
            rec.plan_id,
            rec.billing_cycle || 'monthly',
            rec.start_date,
            rec.expiry_date
          ]
        );
        const subId = subResult.insertId;

        await connection.query(
          `INSERT INTO subscription_usage (
             subscription_id, recruiter_id, billing_period_start, billing_period_end,
             job_posts_used, resume_views_used, resume_downloads_used,
             featured_jobs_used, urgent_jobs_used, candidate_contacts_used
           ) VALUES (?, ?, COALESCE(?, NOW()), COALESCE(?, DATE_ADD(NOW(), INTERVAL 30 DAY)), 0, 0, 0, 0, 0, 0)`,
          [subId, newUserId, rec.start_date, rec.expiry_date]
        );
      }

      // 7. Audit log
      await connection.query(
        `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, old_value, new_value)
         VALUES (?, 'Admin Added Master Recruiter', 'recruiter', ?, NULL, ?)`,
        [
          adminId,
          String(newUserId),
          JSON.stringify({
            first_name,
            last_name,
            email,
            company_name: companyName,
            company_id: companyId,
            allocated_seats: assignedSeats
          })
        ]
      );

      await connection.commit();

      // Send branded welcome email with login credentials and logo
      sendRecruiterWelcomeEmail({
        email: email.trim().toLowerCase(),
        password,
        name: `${first_name} ${last_name}`.trim(),
        companyName: companyName || 'Company',
        roleType: 'master_recruiter',
        designation: designation || 'Master Recruiter',
        seatQuota: assignedSeats
      }).catch(err => console.error("[addMasterRecruiter-1] Email dispatch error:", err));

      return {
        recruiter_id: newUserId,
        first_name,
        last_name,
        recruiter_name: `${first_name} ${last_name}`.trim(),
        email,
        phone,
        company_name: companyName,
        company_id: companyId,
        allocated_seats: assignedSeats,
        master_recruiters_count: currentMasterCount + 1,
        master_login_limit: masterLimit
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  getMasterRecruiters: async (recruiterIdOrCompanyId) => {
    try {
      const [recRows] = await pool.query(
        `SELECT u.id, u.organization, u.company_id, hp.company_name,
                COALESCE(c.max_master_recruiters, sp.master_login_limit, 1) as master_login_limit,
                COALESCE(sp.sub_recruiter_limit, 1) as sub_recruiter_limit,
                c.id as comp_id, c.name as comp_name
         FROM users u
         LEFT JOIN hr_profiles hp ON u.id = hp.user_id
         LEFT JOIN companies c ON u.company_id = c.id OR u.organization = c.name
         LEFT JOIN recruiter_subscriptions rs ON u.id = rs.recruiter_id AND rs.id = (
           SELECT MAX(id) FROM recruiter_subscriptions WHERE recruiter_id = u.id
         )
         LEFT JOIN subscription_plans sp ON rs.plan_id = sp.id
         WHERE u.id = ? OR c.id = ?
         LIMIT 1`,
        [recruiterIdOrCompanyId, recruiterIdOrCompanyId]
      );

      if (recRows.length === 0) {
        return { master_recruiters: [], master_login_limit: 1, master_recruiters_count: 0, sub_recruiter_limit: 1 };
      }

      const rec = recRows[0];
      const companyId = rec.comp_id || rec.company_id || null;
      const companyName = rec.comp_name || rec.company_name || rec.organization || '';

      const [masters] = await pool.query(
        `SELECT u.id, u.first_name, u.last_name,
                CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS recruiter_name,
                u.email, u.phone, CAST(u.is_active AS UNSIGNED) as is_active,
                u.created_date, COALESCE(u.last_active, u.updated_date, u.created_date) as last_active,
                COALESCE(NULLIF(u.allocated_seats, 0), sp.sub_recruiter_limit, 1) as allocated_seats,
                (SELECT COUNT(*) FROM sub_recruiters sr WHERE sr.main_recruiter_id = u.id) as sub_recruiters_count
         FROM users u
         LEFT JOIN recruiter_subscriptions rs ON u.id = rs.recruiter_id AND rs.id = (
           SELECT MAX(id) FROM recruiter_subscriptions WHERE recruiter_id = u.id
         )
         LEFT JOIN subscription_plans sp ON rs.plan_id = sp.id
         WHERE (u.company_id = ? OR (u.organization IS NOT NULL AND u.organization != '' AND u.organization = ?))
           AND u.role_id = 3
           AND (u.master_recruiter_id IS NULL OR u.master_recruiter_id = 0)
           AND u.id NOT IN (SELECT sub_recruiter_id FROM sub_recruiters)
         ORDER BY u.id ASC`,
        [companyId, companyName]
      );

      return {
        company_id: companyId,
        company_name: companyName,
        master_login_limit: Number(rec.master_login_limit || 1),
        sub_recruiter_limit: Number(rec.sub_recruiter_limit || 1),
        master_recruiters_count: masters.length,
        master_recruiters: masters
      };
    } catch (error) {
      throw error;
    }
  },

  updateRecruiterStatus: async (recruiterId, isActive, adminId = 1) => {
    try {
      const activeVal = isActive ? 1 : 0;
      const subStatus = isActive ? 'Active' : 'Suspended';

      await pool.query(`UPDATE users SET is_active = ? WHERE id = ?`, [activeVal, recruiterId]);
      await pool.query(`
        UPDATE recruiter_subscriptions 
        SET status = ? 
        WHERE recruiter_id = ? AND id = (
          SELECT sub_id FROM (SELECT MAX(id) AS sub_id FROM recruiter_subscriptions WHERE recruiter_id = ?) AS tmp
        )
      `, [subStatus, recruiterId, recruiterId]);

      const actionName = isActive ? 'Admin Activated Recruiter' : 'Admin Suspended Recruiter';
      await pool.query(`
        INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, old_value, new_value)
        VALUES (?, ?, 'recruiter', ?, NULL, ?)
      `, [adminId, actionName, String(recruiterId), JSON.stringify({ is_active: activeVal, status: subStatus })]);

      return true;
    } catch (error) {
      throw error;
    }
  },

  resetPassword: async (recruiterId, newPassword, adminId = 1) => {
    try {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      await pool.query(`UPDATE users SET password = ? WHERE id = ?`, [hashedPassword, recruiterId]);

      await pool.query(`
        INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, old_value, new_value)
        VALUES (?, 'Admin Reset Recruiter Password', 'recruiter', ?, NULL, ?)
      `, [adminId, String(recruiterId), JSON.stringify({ status: "Password reset successfully" })]);

      return true;
    } catch (error) {
      throw error;
    }
  },

  getAllSubscriptions: async (filters = {}) => {
    try {
      let query = `
        SELECT 
          rs.id AS subscription_id,
          rs.recruiter_id,
          rs.company_id,
          rs.billing_cycle,
          rs.price_paid,
          rs.start_date,
          rs.expiry_date,
          rs.status,
          rs.payment_status,
          rs.created_at,

          sp.name AS plan_name,
          sp.slug AS plan_slug,
          sp.price AS plan_price,
          sp.job_post_limit,
          sp.active_job_limit,
          sp.resume_view_limit,
          sp.resume_download_limit,
          sp.sub_recruiter_limit,
          COALESCE(sp.master_login_limit, 1) AS master_login_limit,

          CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS recruiter_name,
          u.email AS recruiter_email,
          u.phone AS recruiter_phone,
          COALESCE(hp.company_name, u.organization, 'Company') AS company_name,
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
          (
            SELECT COUNT(*) 
            FROM job_post jp 
            WHERE (jp.user_id = rs.recruiter_id OR jp.user_id IN (SELECT sr.sub_recruiter_id FROM sub_recruiters sr WHERE sr.main_recruiter_id = rs.recruiter_id))
              AND (jp.is_closed = 0 OR jp.is_closed IS NULL)
          ) AS active_jobs_count,
          DATEDIFF(rs.expiry_date, NOW()) AS days_remaining
        FROM recruiter_subscriptions rs
        INNER JOIN users u ON rs.recruiter_id = u.id
        LEFT JOIN hr_profiles hp ON rs.company_id = hp.id OR rs.recruiter_id = hp.user_id
        LEFT JOIN subscription_plans sp ON rs.plan_id = sp.id
        LEFT JOIN subscription_usage su ON rs.id = su.subscription_id
        WHERE 1 = 1
      `;
      const params = [];

      if (filters.status) {
        query += ` AND rs.status = ?`;
        params.push(filters.status);
      }
      if (filters.planId) {
        query += ` AND rs.plan_id = ?`;
        params.push(filters.planId);
      }
      if (filters.search) {
        query += ` AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR hp.company_name LIKE ?)`;
        const s = `%${filters.search}%`;
        params.push(s, s, s, s);
      }

      query += ` ORDER BY rs.id DESC`;
      const [rows] = await pool.query(query, params);
      return rows;
    } catch (error) {
      throw error;
    }
  },

  getAuditLogs: async (limit = 50) => {
    try {
      const query = `
        SELECT 
          al.*,
          CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS admin_name,
          u.email AS admin_email
        FROM admin_audit_logs al
        LEFT JOIN users u ON al.admin_id = u.id
        ORDER BY al.created_at DESC
        LIMIT ?
      `;
      const [rows] = await pool.query(query, [Number(limit)]);
      return rows;
    } catch (error) {
      throw error;
    }
  },

  toggleAutoApprove: async (recruiterId, autoApprove) => {
    try {
      const query = `UPDATE users SET auto_approve = ? WHERE id = ?`;
      await pool.query(query, [autoApprove ? 1 : 0, recruiterId]);
    } catch (error) {
      throw error;
    }
  },

  loginAsRecruiter: async (recruiterId) => {
    try {
      const [userRows] = await pool.query(
        `SELECT u.id, u.first_name, u.last_name, u.phone_code, u.phone, u.email, u.organization, 
                o.name AS organization_type, u.is_active, u.role_id, r.name AS role_name, 
                COALESCE(h.profile_image, u.profile_image) AS profile_image, 
                CASE WHEN u.is_email_verified = 1 THEN 1 ELSE 0 END AS is_email_verified, 
                COALESCE(h.company_name, u.organization, 'Individual Recruiter') AS company_name,
                h.id AS company_id,
                h.website_url,
                h.industry_type
         FROM users AS u 
         INNER JOIN role AS r ON u.role_id = r.id 
         LEFT JOIN organization_type o ON u.organization_type_id = o.id 
         LEFT JOIN hr_profiles h ON u.id = h.user_id
         WHERE u.id = ? AND u.role_id = 3`,
        [recruiterId]
      );

      if (!userRows || userRows.length === 0) {
        throw new Error("Recruiter not found or user is not a valid recruiter account.");
      }

      const recruiter = userRows[0];

      // Check sub-recruiter status
      const [subRows] = await pool.query(
        `SELECT sr.id, sr.main_recruiter_id, sr.designation, sr.role_preset, sr.permissions, sr.status,
                hp.company_name
         FROM sub_recruiters sr
         LEFT JOIN hr_profiles hp ON sr.main_recruiter_id = hp.user_id
         WHERE sr.sub_recruiter_id = ? AND sr.status = 'active'
         LIMIT 1`,
        [recruiter.id]
      );

      if (subRows && subRows.length > 0) {
        let perms = subRows[0].permissions;
        if (typeof perms === 'string') {
          try { perms = JSON.parse(perms); } catch (e) { perms = {}; }
        }
        recruiter.is_sub_recruiter = true;
        recruiter.sub_recruiter_info = {
          id: subRows[0].id,
          main_recruiter_id: subRows[0].main_recruiter_id,
          designation: subRows[0].designation,
          role_preset: subRows[0].role_preset,
          permissions: perms,
          company_name: subRows[0].company_name
        };
      }

      recruiter.impersonated_by_admin = true;

      // Update recruiter last active
      await pool.query(`UPDATE users SET last_active = NOW() WHERE id = ?`, [recruiter.id]).catch(() => {});

      // Sign JWT token
      const token = jwt.sign(
        { id: recruiter.id, email: recruiter.email, role_id: recruiter.role_id, impersonated: true },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "30d" }
      );

      return {
        token,
        recruiter
      };
    } catch (error) {
      throw error;
    }
  },

  deleteRecruiter: async (id, adminId) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query("DELETE FROM recruiter_audit_logs WHERE recruiter_id = ?", [id]).catch(() => {});
      await connection.query("DELETE FROM subscription_usage WHERE recruiter_id = ?", [id]).catch(() => {});
      await connection.query("DELETE FROM recruiter_subscriptions WHERE recruiter_id = ?", [id]).catch(() => {});
      await connection.query("DELETE FROM sub_recruiters WHERE main_recruiter_id = ? OR sub_recruiter_id = ?", [id, id]).catch(() => {});
      await connection.query("DELETE FROM hr_profile WHERE user_id = ?", [id]).catch(() => {});
      await connection.query("DELETE FROM hr_profiles WHERE user_id = ?", [id]).catch(() => {});
      await connection.query("UPDATE job_post SET is_closed = 1, approval_status = 'rejected' WHERE user_id = ?", [id]).catch(() => {});
      await connection.query("DELETE FROM users WHERE id = ?", [id]);

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  getMasterRecruiters: async (recruiterId) => {
    try {
      const recruiter = await RecruiterManagementModel.getRecruiterById(recruiterId);
      if (!recruiter) {
        throw new Error("Recruiter not found");
      }
      return {
        master_recruiters: recruiter.master_recruiters || [],
        master_recruiters_count: recruiter.master_recruiters_count || 0,
        master_login_limit: recruiter.master_login_limit || 1,
        sub_recruiter_limit: recruiter.sub_recruiter_limit || 1,
        company_name: recruiter.company_name,
        company_id: recruiter.company_id
      };
    } catch (error) {
      throw error;
    }
  },

  addMasterRecruiter: async (recruiterId, payload, adminId = 1) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Get primary recruiter / company info
      const [primaryRows] = await connection.query(
        `SELECT u.*, hp.company_name, hp.id AS hr_profile_id, c.id AS comp_id, c.max_master_recruiters, c.total_sub_recruiter_seats,
                rs.plan_id, rs.id AS subscription_id, sp.master_login_limit, sp.sub_recruiter_limit
         FROM users u
         LEFT JOIN hr_profiles hp ON u.id = hp.user_id
         LEFT JOIN companies c ON u.company_id = c.id
         LEFT JOIN recruiter_subscriptions rs ON u.id = rs.recruiter_id AND rs.id = (
           SELECT MAX(id) FROM recruiter_subscriptions WHERE recruiter_id = u.id
         )
         LEFT JOIN subscription_plans sp ON rs.plan_id = sp.id
         WHERE u.id = ? AND u.role_id = 3`,
        [recruiterId]
      );

      if (primaryRows.length === 0) {
        throw new Error("Target company/recruiter not found.");
      }

      const primary = primaryRows[0];
      const companyId = primary.company_id || primary.comp_id;
      const companyName = primary.company_name || primary.organization || 'Company';
      const masterLimit = primary.max_master_recruiters || primary.master_login_limit || 1;
      const companyTotalSubSeats = Number(primary.total_sub_recruiter_seats || primary.sub_recruiter_limit || 0);

      // 2. Count existing Master Recruiters
      const [countRows] = await connection.query(
        `SELECT COUNT(*) as count FROM users 
         WHERE (company_id = ? OR organization = ?) 
           AND role_id = 3 
           AND (master_recruiter_id IS NULL OR master_recruiter_id = 0)
           AND id NOT IN (SELECT sub_recruiter_id FROM sub_recruiters)`,
        [companyId || 0, companyName]
      );
      const currentMasters = countRows[0]?.count || 0;

      if (currentMasters >= masterLimit) {
        throw new Error(`Master Login limit reached (${currentMasters} of ${masterLimit}). Upgrade company plan to add more Master Recruiters.`);
      }

      // Calculate total sub-seats already allocated across existing Master Logins
      const [allocatedSumRows] = await connection.query(
        `SELECT COALESCE(SUM(allocated_seats), 0) as total_allocated
         FROM users
         WHERE (company_id = ? OR organization = ?) 
           AND role_id = 3 
           AND (master_recruiter_id IS NULL OR master_recruiter_id = 0)
           AND id NOT IN (SELECT sub_recruiter_id FROM sub_recruiters)`,
        [companyId || 0, companyName]
      );
      const currentTotalAllocated = Number(allocatedSumRows[0]?.total_allocated || 0);
      const availableSubSeats = Math.max(0, companyTotalSubSeats - currentTotalAllocated);

      const { email, password, first_name, last_name, phone, allocated_seats } = payload;
      if (!email || !password || !first_name) {
        throw new Error("First name, email, and password are required.");
      }

      // Individual seat allocation
      const requestedSeats = allocated_seats !== undefined && allocated_seats !== ''
        ? Math.max(0, Number(allocated_seats))
        : 0;

      if (requestedSeats > availableSubSeats) {
        throw new Error(
          `Cannot allocate ${requestedSeats} sub-recruiter seats. Only ${availableSubSeats} unallocated seats remain out of ${companyTotalSubSeats} total company seats (${currentTotalAllocated} seats already allocated across existing Master Logins).`
        );
      }

      // Check if email already exists
      const [emailCheck] = await connection.query(
        `SELECT id FROM users WHERE email = ?`,
        [email.trim().toLowerCase()]
      );
      if (emailCheck.length > 0) {
        throw new Error("An account with this email address already exists.");
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create Master Recruiter user (with requestedSeats)
      const [userResult] = await connection.query(
        `INSERT INTO users (
           first_name, last_name, email, password, phone, phone_code,
           role_id, is_active, organization, company_id, allocated_seats, master_recruiter_id, created_date, is_email_verified
         ) VALUES (?, ?, ?, ?, ?, '+91', 3, 1, ?, ?, ?, NULL, NOW(), 1)`,
        [
          first_name.trim(),
          (last_name || '').trim(),
          email.trim().toLowerCase(),
          hashedPassword,
          phone || '',
          companyName,
          companyId,
          requestedSeats
        ]
      );
      const newMasterId = userResult.insertId;

      // Create HR profile for this master recruiter
      await connection.query(
        `INSERT INTO hr_profiles (
           user_id, company_name, contact_phone, contact_email
         ) VALUES (?, ?, ?, ?)`,
        [newMasterId, companyName, phone || '', email.trim().toLowerCase()]
      );

      // Clone subscription for this master recruiter linked to company plan
      if (primary.plan_id) {
        const [subResult] = await connection.query(
          `INSERT INTO recruiter_subscriptions (
             recruiter_id, company_id, plan_id, billing_cycle, price_paid,
             start_date, expiry_date, status, payment_status, created_at, updated_at
           ) VALUES (?, ?, ?, 'custom', 0, NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR), 'active', 'completed', NOW(), NOW())`,
          [newMasterId, companyId, primary.plan_id]
        );

        // Initialize usage
        await connection.query(
          `INSERT INTO subscription_usage (
             subscription_id, recruiter_id, billing_period_start, billing_period_end,
             job_posts_used, resume_views_used, resume_downloads_used,
             featured_jobs_used, urgent_jobs_used, candidate_contacts_used
           ) VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR), 0, 0, 0, 0, 0, 0)`,
          [subResult.insertId, newMasterId]
        );
      }

      // Audit log
      await connection.query(
        `INSERT INTO admin_audit_logs (
           admin_id, action, target_type, target_id, old_value, new_value, created_at
         ) VALUES (?, 'Admin Added Master Recruiter', 'recruiter', ?, NULL, ?, NOW())`,
        [
          adminId,
          String(newMasterId),
          JSON.stringify({
            company_id: companyId,
            company_name: companyName,
            master_recruiter_id: newMasterId,
            email: email.trim().toLowerCase(),
            allocated_seats: requestedSeats,
            current_masters: currentMasters + 1,
            max_masters: masterLimit,
            remaining_unallocated_seats: availableSubSeats - requestedSeats
          })
        ]
      );

      await connection.commit();

      // Send branded welcome email with login credentials and logo
      sendRecruiterWelcomeEmail({
        email: email.trim().toLowerCase(),
        password,
        name: `${first_name} ${last_name || ''}`.trim(),
        companyName: companyName || 'Company',
        roleType: 'master_recruiter',
        designation: 'Master Recruiter',
        seatQuota: requestedSeats
      }).catch(err => console.error("[addMasterRecruiter] Email dispatch error:", err));

      return {
        id: newMasterId,
        email: email.trim().toLowerCase(),
        first_name,
        last_name,
        allocated_seats: requestedSeats,
        company_id: companyId,
        company_name: companyName,
        remaining_unallocated_seats: availableSubSeats - requestedSeats
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  updateMasterRecruiterSeats: async (masterId, newSeats, adminId = 1) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Get Master Recruiter info
      const [masterRows] = await connection.query(
        `SELECT u.id, u.first_name, u.last_name, u.email, u.company_id, u.organization, u.allocated_seats,
                c.id as comp_id, c.name as comp_name, c.total_sub_recruiter_seats,
                sp.sub_recruiter_limit
         FROM users u
         LEFT JOIN companies c ON (u.company_id = c.id OR (u.company_id IS NULL AND u.organization = c.name))
         LEFT JOIN recruiter_subscriptions rs ON u.id = rs.recruiter_id AND rs.id = (
           SELECT MAX(id) FROM recruiter_subscriptions WHERE recruiter_id = u.id
         )
         LEFT JOIN subscription_plans sp ON rs.plan_id = sp.id
         WHERE u.id = ? AND u.role_id = 3
           AND (u.master_recruiter_id IS NULL OR u.master_recruiter_id = 0)
         LIMIT 1`,
        [masterId]
      );

      if (masterRows.length === 0) {
        throw new Error("Master Recruiter not found.");
      }

      const master = masterRows[0];
      const companyId = master.company_id || master.comp_id;
      const companyName = master.comp_name || master.organization;

      // 2. Check current sub-recruiters count for this master
      const [subCountRows] = await connection.query(
        `SELECT COUNT(*) as count FROM sub_recruiters WHERE main_recruiter_id = ?`,
        [masterId]
      );
      const currentSubCount = subCountRows[0]?.count || 0;
      if (newSeats < currentSubCount) {
        throw new Error(`Cannot reduce seats to ${newSeats}. This Master Recruiter currently has ${currentSubCount} active sub-recruiters.`);
      }

      // 3. Check Company total sub-recruiter seats limit
      const totalCompanySeats = Number(master.total_sub_recruiter_seats || master.sub_recruiter_limit || 0);

      // Sum of allocated seats of other masters for this company
      const [otherMastersRows] = await connection.query(
        `SELECT COALESCE(SUM(allocated_seats), 0) as other_allocated
         FROM users
         WHERE (company_id = ? OR (company_id IS NULL AND organization = ?))
           AND role_id = 3
           AND (master_recruiter_id IS NULL OR master_recruiter_id = 0)
           AND id NOT IN (SELECT sub_recruiter_id FROM sub_recruiters)
           AND id != ?`,
        [companyId || 0, companyName || '', masterId]
      );
      const otherAllocated = Number(otherMastersRows[0]?.other_allocated || 0);
      const maxAvailableForThisMaster = Math.max(0, totalCompanySeats - otherAllocated);

      if (newSeats > maxAvailableForThisMaster) {
        throw new Error(
          `Cannot allocate ${newSeats} seats. Company total limit is ${totalCompanySeats} seats (${otherAllocated} seats assigned to other Master Logins). Maximum available for this Master is ${maxAvailableForThisMaster} seats.`
        );
      }

      // 4. Update master's allocated_seats
      await connection.query(
        `UPDATE users SET allocated_seats = ? WHERE id = ?`,
        [newSeats, masterId]
      );

      // 5. Audit log
      await connection.query(
        `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, old_value, new_value, created_at)
         VALUES (?, 'Admin Updated Master Recruiter Seats', 'recruiter', ?, ?, ?, NOW())`,
        [
          adminId,
          String(masterId),
          JSON.stringify({ previous_seats: master.allocated_seats }),
          JSON.stringify({ new_seats: newSeats, company_total: totalCompanySeats, other_allocated: otherAllocated })
        ]
      );

      await connection.commit();

      return {
        master_id: masterId,
        allocated_seats: newSeats,
        company_total_seats: totalCompanySeats,
        other_allocated: otherAllocated,
        remaining_pool: totalCompanySeats - (otherAllocated + newSeats)
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
};

module.exports = RecruiterManagementModel;

