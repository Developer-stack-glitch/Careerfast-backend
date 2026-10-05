const pool = require("../config/dbConfig");
const SubRecruiterModel = require("../models/SubRecruiterModel");

const getEffectiveRecruiterId = async (userId) => {
  let effectiveId = userId;
  try {
    const [subRecruiterCheck] = await pool.query(
      `SELECT main_recruiter_id FROM sub_recruiters WHERE sub_recruiter_id = ? AND status = 'active' LIMIT 1`,
      [userId]
    );
    if (subRecruiterCheck.length > 0 && subRecruiterCheck[0].main_recruiter_id) {
      effectiveId = subRecruiterCheck[0].main_recruiter_id;
    }
  } catch (err) {
    // If sub_recruiters check fails, fall back to userId
  }
  return effectiveId;
};

const RecruiterSubscriptionController = {
  getMySubscription: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "User not authenticated" });
      }

      const recruiterId = await getEffectiveRecruiterId(userId);

      const query = `
        SELECT 
          rs.id AS subscription_id,
          rs.recruiter_id,
          rs.plan_id,
          rs.billing_cycle,
          rs.price_paid,
          rs.start_date,
          rs.expiry_date,
          rs.status AS subscription_status,
          rs.payment_status,

          sp.name AS plan_name,
          sp.slug AS plan_slug,
          sp.description AS plan_description,
          sp.price AS plan_price,
          sp.plan_type,

          /* Limits */
          sp.job_post_limit,
          sp.active_job_limit,
          sp.resume_view_limit,
          sp.resume_download_limit,
          COALESCE(sp.email_limit, 0) AS email_limit,
          COALESCE(sp.whatsapp_limit, 0) AS whatsapp_limit,
          COALESCE(sp.excel_download_limit, 0) AS excel_download_limit,
          sp.featured_job_limit,
          sp.urgent_job_limit,

          /* Permissions */
          sp.candidate_search,
          sp.candidate_contact,
          sp.resume_database,
          sp.interview_management,
          sp.application_management,
          sp.shortlisting,
          sp.company_profile,
          sp.recruiter_dashboard,
          sp.email_notifications,
          sp.company_branding,

          /* Usage */
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
          COALESCE(su.emails_sent, 0) AS emails_sent,
          COALESCE(su.whatsapp_messages_sent, 0) AS whatsapp_messages_sent,
          COALESCE(su.excel_downloads_used, 0) AS excel_downloads_used,
          COALESCE(su.featured_jobs_used, 0) AS featured_jobs_used,
          COALESCE(su.urgent_jobs_used, 0) AS urgent_jobs_used,
          COALESCE(su.candidate_contacts_used, 0) AS candidate_contacts_used,

          (
            SELECT COUNT(*) 
            FROM job_post jp 
            WHERE (jp.user_id = rs.recruiter_id OR jp.user_id IN (SELECT sr.sub_recruiter_id FROM sub_recruiters sr WHERE sr.main_recruiter_id = rs.recruiter_id))
              AND (jp.is_closed = 0 OR jp.is_closed IS NULL)
              AND jp.approval_status = 'approved'
          ) AS active_jobs_count,

          (
            SELECT COUNT(*) 
            FROM job_post jp 
            WHERE (jp.user_id = rs.recruiter_id OR jp.user_id IN (SELECT sr.sub_recruiter_id FROM sub_recruiters sr WHERE sr.main_recruiter_id = rs.recruiter_id))
              AND (jp.is_closed = 0 OR jp.is_closed IS NULL)
              AND (jp.approval_status = 'pending' OR jp.approval_status IS NULL)
          ) AS pending_jobs_count,

          DATEDIFF(rs.expiry_date, NOW()) AS days_remaining

        FROM recruiter_subscriptions rs
        INNER JOIN subscription_plans sp ON rs.plan_id = sp.id
        LEFT JOIN subscription_usage su ON rs.id = su.subscription_id
        WHERE rs.recruiter_id = ?
        ORDER BY rs.id DESC
        LIMIT 1
      `;

      let [rows] = await pool.query(query, [recruiterId]);

      if (rows.length === 0) {
        // Auto-provision Free Plan if the user is a recruiter (role_id: 3)
        try {
          const [userCheck] = await pool.query(`SELECT id, role_id FROM users WHERE id = ?`, [recruiterId]);
          if (userCheck.length > 0 && userCheck[0].role_id === 3) {
            const [freePlanRows] = await pool.query(
              `SELECT * FROM subscription_plans WHERE slug = 'free' OR name LIKE '%Free%' ORDER BY id ASC LIMIT 1`
            );
            if (freePlanRows.length > 0) {
              const freePlan = freePlanRows[0];
              const startDate = new Date();
              const expiryDate = new Date();
              expiryDate.setDate(expiryDate.getDate() + (freePlan.validity_days || 60));

              const [subRes] = await pool.query(
                `INSERT INTO recruiter_subscriptions (
                  recruiter_id, plan_id, billing_cycle, price_paid,
                  start_date, expiry_date, status, payment_status
                ) VALUES (?, ?, 'monthly', 0.00, ?, ?, 'Active', 'Paid')`,
                [recruiterId, freePlan.id, startDate, expiryDate]
              );
              const subId = subRes.insertId;

              await pool.query(
                `INSERT INTO subscription_usage (
                  subscription_id, recruiter_id, billing_period_start, billing_period_end,
                  job_posts_used, resume_views_used, resume_downloads_used,
                  featured_jobs_used, urgent_jobs_used, candidate_contacts_used
                ) VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 0)`,
                [subId, recruiterId, startDate, expiryDate]
              );

              await pool.query(
                `INSERT INTO subscription_history (
                  subscription_id, recruiter_id, old_plan_id, new_plan_id,
                  change_type, effective_type, previous_expiry, new_expiry, reason, changed_by_admin_id
                ) VALUES (?, ?, NULL, ?, 'initial_assignment', 'immediately', NULL, ?, 'Free Plan auto-provisioned', NULL)`,
                [subId, recruiterId, freePlan.id, expiryDate]
              );

              [rows] = await pool.query(query, [recruiterId]);
            }
          }
        } catch (autoErr) {
          console.error("Auto-provision Free Plan error:", autoErr.message);
        }
      }

      if (rows.length === 0) {
        // Fallback if no subscription is assigned yet
        return res.status(200).json({
          success: true,
          has_subscription: false,
          data: {
            plan_id: null,
            plan_name: "No Active Plan",
            subscription_status: "None",
            plan: {
              id: null,
              name: "No Active Plan"
            },
            limits: {
              job_post_limit: 0,
              job_posts_limit: 0,
              active_job_limit: 0,
              resume_view_limit: 0,
              resume_views_limit: 0,
              resume_download_limit: 0,
              resume_downloads_limit: 0,
              featured_job_limit: 0,
              urgent_job_limit: 0
            },
            usage: {
              job_posts_used: 0,
              job_posts_limit: 0,
              job_posts_remaining: 0,
              active_jobs_count: 0,
              pending_jobs_count: 0,
              active_job_limit: 0,
              active_jobs_remaining: 0,
              resume_views_used: 0,
              resume_views_limit: 0,
              resume_views_remaining: 0,
              resume_downloads_used: 0,
              resume_downloads_limit: 0,
              resume_downloads_remaining: 0,
              featured_jobs_used: 0,
              featured_job_limit: 0,
              featured_jobs_remaining: 0
            },
            features: {
              candidate_search: false,
              candidate_contact: false,
              resume_database: false,
              company_branding: false
            },
            permissions: {
              candidate_search: false,
              candidate_contact: false,
              resume_database: false,
              company_branding: false
            },
            viewed_candidate_ids: [],
            downloaded_candidate_ids: [],
            days_remaining: 0
          }
        });
      }

      const sub = rows[0];
      const isExpired = new Date(sub.expiry_date) < new Date() || sub.subscription_status === 'Expired';
      const isSuspended = sub.subscription_status === 'Suspended';

      const isCustomPlan = Boolean(
        sub.plan_type?.toLowerCase() === 'custom' ||
        (sub.plan_slug && sub.plan_slug.toLowerCase().startsWith('custom')) ||
        (sub.plan_name && sub.plan_name.toLowerCase().includes('custom'))
      );

      const permissionsObj = {
        candidate_search: isCustomPlan && !isExpired && !isSuspended && sub.candidate_search !== 0,
        candidate_contact: isCustomPlan && !isExpired && !isSuspended && sub.candidate_contact !== 0,
        resume_database: isCustomPlan && !isExpired && !isSuspended && sub.resume_database !== 0,
        interview_management: Boolean(sub.interview_management),
        application_management: Boolean(sub.application_management),
        shortlisting: Boolean(sub.shortlisting),
        company_profile: Boolean(sub.company_profile),
        recruiter_dashboard: Boolean(sub.recruiter_dashboard),
        email_notifications: Boolean(sub.email_notifications),
        company_branding: Boolean(sub.company_branding) && !isExpired && !isSuspended
      };

      // Retrieve candidate IDs already unlocked or downloaded in this subscription
      let viewedCandidateIds = [];
      let downloadedCandidateIds = [];
      try {
        const [accessRows] = await pool.query(
          `SELECT candidate_id, action_type FROM recruiter_resume_access WHERE recruiter_id = ? AND subscription_id = ?`,
          [recruiterId, sub.subscription_id]
        );
        viewedCandidateIds = accessRows.filter(r => r.action_type === 'view').map(r => Number(r.candidate_id));
        downloadedCandidateIds = accessRows.filter(r => r.action_type === 'download').map(r => Number(r.candidate_id));
      } catch (accessErr) {
        console.warn("Could not query recruiter_resume_access:", accessErr.message);
      }

      // 🏢 Calculate company-wide job statistics across main recruiter and all sub-recruiters
      let companyRecruiterIds = [recruiterId];
      try {
        const [subRows] = await pool.query(
          `SELECT sub_recruiter_id FROM sub_recruiters WHERE main_recruiter_id = ? AND status != 'deleted'`,
          [recruiterId]
        );
        subRows.forEach(r => {
          if (r.sub_recruiter_id && !companyRecruiterIds.includes(r.sub_recruiter_id)) {
            companyRecruiterIds.push(r.sub_recruiter_id);
          }
        });
      } catch (err) {
        console.warn("Could not query company team recruiters:", err.message);
      }

      let companyActiveJobs = Number(sub.active_jobs_count || 0);
      let companyPendingJobs = Number(sub.pending_jobs_count || 0);
      let companyTotalJobs = 0;
      try {
        const [coJobs] = await pool.query(
          `SELECT 
             COUNT(CASE WHEN (is_closed = 0 OR is_closed IS NULL) AND approval_status = 'approved' THEN 1 END) as active_count,
             COUNT(CASE WHEN (is_closed = 0 OR is_closed IS NULL) AND (approval_status = 'pending' OR approval_status IS NULL) THEN 1 END) as pending_count,
             COUNT(*) as total_count
           FROM job_post 
           WHERE user_id IN (?)`,
          [companyRecruiterIds]
        );
        if (coJobs.length > 0) {
          companyActiveJobs = Number(coJobs[0].active_count || 0);
          companyPendingJobs = Number(coJobs[0].pending_count || 0);
          companyTotalJobs = Number(coJobs[0].total_count || 0);
        }
      } catch (coErr) {
        console.warn("Could not query company jobs:", coErr.message);
      }

      const effectiveCompanyPostsUsed = Math.max(Number(sub.job_posts_used || 0), companyTotalJobs);
      const companyRemainingJobs = Math.max(0, sub.job_post_limit - effectiveCompanyPostsUsed);
      const companyRemainingActive = Math.max(0, sub.active_job_limit - companyActiveJobs);
      const companyLimitReached = companyRemainingActive <= 0 || companyRemainingJobs <= 0;

      // 🛡️ Check if logged-in user is a sub-recruiter
      const subRecruiter = await SubRecruiterModel.getSubRecruiterByUserId(userId);
      const isSubRecruiter = Boolean(subRecruiter);
      let subRecruiterInfo = null;

      let effectiveLimits = {
        job_post_limit: sub.job_post_limit,
        job_posts_limit: sub.job_post_limit,
        active_job_limit: sub.active_job_limit,
        resume_view_limit: isCustomPlan ? sub.resume_view_limit : 0,
        resume_views_limit: isCustomPlan ? sub.resume_view_limit : 0,
        resume_download_limit: isCustomPlan ? sub.resume_download_limit : 0,
        resume_downloads_limit: isCustomPlan ? sub.resume_download_limit : 0,
        email_limit: isCustomPlan ? (sub.email_limit ?? 0) : 0,
        whatsapp_limit: isCustomPlan ? (sub.whatsapp_limit ?? 0) : 0,
        excel_download_limit: isCustomPlan ? (sub.excel_download_limit ?? 0) : 0,
        excel_downloads_limit: isCustomPlan ? (sub.excel_download_limit ?? 0) : 0,
        featured_job_limit: sub.featured_job_limit,
        urgent_job_limit: sub.urgent_job_limit
      };

      let effectiveUsage = {
        job_posts_used: effectiveCompanyPostsUsed,
        job_posts_limit: sub.job_post_limit,
        job_posts_remaining: companyRemainingJobs,
        active_jobs_count: companyActiveJobs,
        pending_jobs_count: companyPendingJobs,
        active_job_limit: sub.active_job_limit,
        active_jobs_remaining: companyRemainingActive,
        resume_views_used: sub.resume_views_used,
        resume_views_limit: effectiveLimits.resume_view_limit,
        resume_views_remaining: Math.max(0, effectiveLimits.resume_view_limit - sub.resume_views_used),
        resume_downloads_used: sub.resume_downloads_used,
        resume_downloads_limit: effectiveLimits.resume_download_limit,
        resume_downloads_remaining: Math.max(0, effectiveLimits.resume_download_limit - sub.resume_downloads_used),
        emails_sent: sub.emails_sent || 0,
        email_limit: effectiveLimits.email_limit,
        emails_remaining: Math.max(0, effectiveLimits.email_limit - (sub.emails_sent || 0)),
        whatsapp_messages_sent: sub.whatsapp_messages_sent || 0,
        whatsapp_limit: effectiveLimits.whatsapp_limit,
        whatsapp_remaining: Math.max(0, effectiveLimits.whatsapp_limit - (sub.whatsapp_messages_sent || 0)),
        excel_downloads_used: sub.excel_downloads_used || 0,
        excel_download_limit: effectiveLimits.excel_download_limit,
        excel_downloads_limit: effectiveLimits.excel_downloads_limit,
        excel_downloads_remaining: Math.max(0, effectiveLimits.excel_download_limit - (sub.excel_downloads_used || 0)),
        featured_jobs_used: sub.featured_jobs_used,
        featured_job_limit: sub.featured_job_limit,
        featured_jobs_remaining: Math.max(0, sub.featured_job_limit - sub.featured_jobs_used),
      };

      let effectivePermissions = { ...permissionsObj };

      if (subRecruiter) {
        const subPerms = subRecruiter.permissions || {};
        subRecruiterInfo = {
          id: subRecruiter.id,
          designation: subRecruiter.designation,
          role_preset: subRecruiter.role_preset,
          permissions: subPerms
        };

        effectivePermissions = {
          ...permissionsObj,
          can_post_jobs: subPerms.can_post_jobs !== false,
          can_view_resumes: isCustomPlan && subPerms.can_view_resumes !== false,
          can_download_resumes: isCustomPlan && subPerms.can_download_resumes !== false,
          can_contact_candidates: isCustomPlan && subPerms.can_contact_candidates !== false,
          can_manage_applications: subPerms.can_manage_applications !== false,
          can_edit_company_profile: subPerms.can_edit_company_profile === true,
          can_manage_team: false,
          can_manage_billing: false,
          candidate_search: isCustomPlan && subPerms.can_view_resumes !== false,
          candidate_contact: isCustomPlan && subPerms.can_contact_candidates !== false,
          resume_database: isCustomPlan && subPerms.can_view_resumes !== false
        };

        // If split quota mode, reflect sub-recruiter's specific quota
        if (subPerms.quota_mode === 'split') {
          const subJobsLimit = Number(subPerms.allocated_job_posts || 0);
          const subJobsUsed = Number(subPerms.used_job_posts || 0);
          const subViewsLimit = isCustomPlan ? Number(subPerms.allocated_resume_views || 0) : 0;
          const subViewsUsed = Number(subPerms.used_resume_views || 0);
          const subDownloadsLimit = isCustomPlan ? Number(subPerms.allocated_resume_downloads || 0) : 0;
          const subDownloadsUsed = Number(subPerms.used_resume_downloads || 0);

          effectiveLimits.job_post_limit = subJobsLimit;
          effectiveLimits.job_posts_limit = subJobsLimit;
          effectiveLimits.resume_view_limit = subViewsLimit;
          effectiveLimits.resume_views_limit = subViewsLimit;
          effectiveLimits.resume_download_limit = subDownloadsLimit;
          effectiveLimits.resume_downloads_limit = subDownloadsLimit;

          effectiveUsage.job_posts_limit = subJobsLimit;
          effectiveUsage.job_posts_used = subJobsUsed;

          // Bounded by parent company remaining active slots and monthly job limits
          effectiveUsage.job_posts_remaining = Math.min(
            Math.max(0, subJobsLimit - subJobsUsed),
            companyRemainingJobs,
            companyRemainingActive
          );
          effectiveUsage.active_jobs_remaining = Math.min(
            Math.max(0, subJobsLimit - subJobsUsed),
            companyRemainingActive
          );

          effectiveUsage.resume_views_limit = subViewsLimit;
          effectiveUsage.resume_views_used = subViewsUsed;
          effectiveUsage.resume_views_remaining = Math.max(0, subViewsLimit - subViewsUsed);

          effectiveUsage.resume_downloads_limit = subDownloadsLimit;
          effectiveUsage.resume_downloads_used = subDownloadsUsed;
          effectiveUsage.resume_downloads_remaining = Math.max(0, subDownloadsLimit - subDownloadsUsed);

          if (effectiveUsage.job_posts_remaining <= 0 || companyRemainingActive <= 0 || companyRemainingJobs <= 0) {
            effectivePermissions.can_post_jobs = false;
          }
        }
      } else {
        effectivePermissions.can_manage_team = true;
        effectivePermissions.can_manage_billing = true;
        effectivePermissions.can_post_jobs = true;
        effectivePermissions.can_view_resumes = isCustomPlan;
        effectivePermissions.can_download_resumes = isCustomPlan;
        effectivePermissions.can_contact_candidates = isCustomPlan;
        effectivePermissions.can_manage_applications = true;
        effectivePermissions.can_edit_company_profile = true;
      }

      // Fetch company profile & main recruiter details (so sub-recruiters use the same logo and see parent recruiter indication)
      let companyInfo = {
        company_name: '',
        company_logo: null,
        main_recruiter_name: '',
        main_recruiter_email: '',
        main_recruiter_id: recruiterId,
        is_sub_recruiter: isSubRecruiter
      };

      try {
        const [coRows] = await pool.query(
          `SELECT u.id, u.first_name, u.last_name, u.email, hp.company_name, hp.profile_image 
           FROM users u
           LEFT JOIN hr_profiles hp ON hp.user_id = u.id
           WHERE u.id = ? LIMIT 1`,
          [recruiterId]
        );
        if (coRows.length > 0) {
          const mr = coRows[0];
          let mrFullName = `${mr.first_name || ''} ${mr.last_name || ''}`.trim();
          if (mr.last_name && (mr.last_name.includes('developer') || mr.last_name.includes('test') || mr.last_name.includes('actewp'))) {
            mrFullName = mr.first_name || 'Primary Recruiter';
          }
          companyInfo.company_name = mr.company_name || '';
          companyInfo.company_logo = mr.profile_image || null;
          companyInfo.main_recruiter_name = mrFullName || mr.company_name || 'Primary Recruiter';
          companyInfo.main_recruiter_email = mr.email || '';
        }
      } catch (coErr) {
        console.warn("Could not query company info in RecruiterSubscriptionController:", coErr.message);
      }

      res.status(200).json({
        success: true,
        has_subscription: true,
        is_sub_recruiter: isSubRecruiter,
        sub_recruiter_info: subRecruiterInfo,
        data: {
          company: companyInfo,
          subscription_id: sub.subscription_id,
          plan_id: sub.plan_id,
          plan_name: sub.plan_name,
          plan_slug: sub.plan_slug,
          plan_price: sub.plan_price,
          billing_cycle: sub.billing_cycle,
          start_date: sub.start_date,
          expiry_date: sub.expiry_date,
          status: isExpired ? 'Expired' : sub.subscription_status,
          days_remaining: Math.max(0, sub.days_remaining || 0),
          is_expired: isExpired,
          is_suspended: isSuspended,
          is_sub_recruiter: isSubRecruiter,
          sub_recruiter_info: subRecruiterInfo,
          is_custom: isCustomPlan,

          plan: {
            id: sub.plan_id,
            name: sub.plan_name,
            slug: sub.plan_slug,
            price: sub.plan_price,
            plan_type: sub.plan_type,
            description: sub.plan_description
          },

          limits: effectiveLimits,
          usage: effectiveUsage,

          viewed_candidate_ids: viewedCandidateIds,
          downloaded_candidate_ids: downloadedCandidateIds,

          features: effectivePermissions,
          permissions: effectivePermissions,
          company_limit_reached: isSubRecruiter ? companyLimitReached : (companyRemainingActive <= 0 || companyRemainingJobs <= 0),
          can_post_jobs: effectivePermissions.can_post_jobs !== false,
          limit_reason: (companyRemainingActive <= 0 || companyRemainingJobs <= 0)
            ? (companyRemainingActive <= 0
              ? `Company active job limit (${sub.active_job_limit}) has been reached.`
              : `Company monthly job post quota (${sub.job_post_limit}) has been exhausted.`)
            : null
        }
      });
    } catch (error) {
      console.error("Error fetching recruiter's subscription:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch subscription access.",
        details: error.message
      });
    }
  },

  consumeResumeView: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "User not authenticated" });
      }

      const candidateId = Number(req.body?.candidateId);
      if (!candidateId) {
        return res.status(400).json({ success: false, message: "candidateId is required" });
      }

      const recruiterId = await getEffectiveRecruiterId(userId);

      const query = `
        SELECT 
          rs.id AS subscription_id,
          rs.recruiter_id,
          rs.expiry_date,
          rs.status AS subscription_status,
          sp.name AS plan_name,
          sp.slug AS plan_slug,
          sp.plan_type,
          sp.candidate_search,
          sp.resume_view_limit,
          su.id AS usage_id,
          COALESCE(su.resume_views_used, 0) AS resume_views_used
        FROM recruiter_subscriptions rs
        INNER JOIN subscription_plans sp ON rs.plan_id = sp.id
        LEFT JOIN subscription_usage su ON rs.id = su.subscription_id
        WHERE rs.recruiter_id = ?
        ORDER BY rs.id DESC
        LIMIT 1
      `;
      const [rows] = await pool.query(query, [recruiterId]);

      if (rows.length === 0) {
        return res.status(403).json({
          success: false,
          limit_reached: true,
          message: "No Active Subscription",
          details: "You do not have an active subscription. Please subscribe to a plan to view candidate profiles."
        });
      }

      const sub = rows[0];
      const isExpired = new Date(sub.expiry_date) < new Date() || sub.subscription_status === 'Expired';
      if (isExpired) {
        return res.status(403).json({
          success: false,
          limit_reached: true,
          message: "Subscription Expired",
          details: "Your subscription plan has expired. Please upgrade or renew your plan to view candidate profiles."
        });
      }

      if (sub.subscription_status === 'Suspended') {
        return res.status(403).json({
          success: false,
          limit_reached: true,
          message: "Account Suspended",
          details: "Your recruiter account is currently suspended. Please contact support."
        });
      }

      const isCustomPlan = Boolean(
        sub.plan_type?.toLowerCase() === 'custom' ||
        (sub.plan_slug && sub.plan_slug.toLowerCase().startsWith('custom')) ||
        (sub.plan_name && sub.plan_name.toLowerCase().includes('custom'))
      );

      if (!isCustomPlan) {
        return res.status(403).json({
          success: false,
          limit_reached: true,
          message: "Custom Plan Required",
          details: `Your current ${sub.plan_name} Plan is configured for Job Posting only. Candidate profile and resume views are exclusive to Custom Plans. Please upgrade to a Custom Plan to access candidate resumes.`
        });
      }

      // Check if candidate profile was already viewed/unlocked in this subscription
      const [existing] = await pool.query(
        `SELECT id FROM recruiter_resume_access WHERE recruiter_id = ? AND subscription_id = ? AND candidate_id = ? AND action_type = 'view' LIMIT 1`,
        [recruiterId, sub.subscription_id, candidateId]
      );

      if (existing.length > 0) {
        return res.status(200).json({
          success: true,
          already_unlocked: true,
          message: "Candidate profile already unlocked.",
          limit: sub.resume_view_limit,
          used: sub.resume_views_used,
          remaining: Math.max(0, sub.resume_view_limit - sub.resume_views_used)
        });
      }

      // Check sub-recruiter specific permissions & split quotas
      const subRecruiter = await SubRecruiterModel.getSubRecruiterByUserId(userId);
      if (subRecruiter) {
        if (subRecruiter.permissions?.can_view_resumes === false) {
          return res.status(403).json({
            success: false,
            limit_reached: true,
            message: "Permission Denied",
            details: "Your sub-recruiter account does not have permission to view candidate resumes."
          });
        }
        if (subRecruiter.permissions?.quota_mode === 'split' && subRecruiter.permissions?.allocated_resume_views !== null && subRecruiter.permissions?.allocated_resume_views !== undefined) {
          const subAllocated = Number(subRecruiter.permissions.allocated_resume_views);
          const subUsed = Number(subRecruiter.permissions.used_resume_views || 0);
          if (subUsed >= subAllocated) {
            return res.status(403).json({
              success: false,
              limit_reached: true,
              message: "Sub-Recruiter Quota Limit Reached",
              details: `You have reached your allocated resume view limit (${subUsed} of ${subAllocated} views). Please contact your company administrator.`
            });
          }
        }
      }

      // Check view limit
      if (sub.resume_views_used >= sub.resume_view_limit) {
        return res.status(403).json({
          success: false,
          limit_reached: true,
          message: "Resume View Limit Reached",
          details: `You have used all ${sub.resume_view_limit} candidate resume views included in your ${sub.plan_name} Plan. Please upgrade your subscription plan to view more candidates.`,
          limit: sub.resume_view_limit,
          used: sub.resume_views_used,
          remaining: 0
        });
      }

      // Record view in recruiter_resume_access
      await pool.query(
        `INSERT IGNORE INTO recruiter_resume_access (recruiter_id, subscription_id, candidate_id, action_type) VALUES (?, ?, ?, 'view')`,
        [recruiterId, sub.subscription_id, candidateId]
      );

      // Increment resume_views_used in subscription_usage
      if (sub.usage_id) {
        await pool.query(
          `UPDATE subscription_usage SET resume_views_used = resume_views_used + 1 WHERE id = ?`,
          [sub.usage_id]
        );
      }

      // Increment sub-recruiter specific usage if applicable
      if (subRecruiter) {
        await SubRecruiterModel.incrementSubRecruiterUsage(userId, 'resume_view');
      }

      const updatedUsed = sub.resume_views_used + 1;
      const updatedRemaining = Math.max(0, sub.resume_view_limit - updatedUsed);

      return res.status(200).json({
        success: true,
        already_unlocked: false,
        message: "Resume view recorded successfully.",
        limit: sub.resume_view_limit,
        used: updatedUsed,
        remaining: updatedRemaining
      });
    } catch (error) {
      console.error("Error consuming resume view:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to process resume view.",
        details: error.message
      });
    }
  },

  consumeResumeDownload: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "User not authenticated" });
      }

      const candidateId = Number(req.body?.candidateId);
      if (!candidateId) {
        return res.status(400).json({ success: false, message: "candidateId is required" });
      }

      const recruiterId = await getEffectiveRecruiterId(userId);

      const query = `
        SELECT 
          rs.id AS subscription_id,
          rs.recruiter_id,
          rs.expiry_date,
          rs.status AS subscription_status,
          sp.name AS plan_name,
          sp.slug AS plan_slug,
          sp.plan_type,
          sp.resume_database,
          sp.resume_download_limit,
          su.id AS usage_id,
          COALESCE(su.resume_downloads_used, 0) AS resume_downloads_used
        FROM recruiter_subscriptions rs
        INNER JOIN subscription_plans sp ON rs.plan_id = sp.id
        LEFT JOIN subscription_usage su ON rs.id = su.subscription_id
        WHERE rs.recruiter_id = ?
        ORDER BY rs.id DESC
        LIMIT 1
      `;
      const [rows] = await pool.query(query, [recruiterId]);

      if (rows.length === 0) {
        return res.status(403).json({
          success: false,
          limit_reached: true,
          message: "No Active Subscription",
          details: "You do not have an active subscription. Please subscribe to a plan to download resumes."
        });
      }

      const sub = rows[0];
      const isExpired = new Date(sub.expiry_date) < new Date() || sub.subscription_status === 'Expired';
      if (isExpired) {
        return res.status(403).json({
          success: false,
          limit_reached: true,
          message: "Subscription Expired",
          details: "Your subscription plan has expired. Please upgrade or renew your plan to download resumes."
        });
      }

      if (sub.subscription_status === 'Suspended') {
        return res.status(403).json({
          success: false,
          limit_reached: true,
          message: "Account Suspended",
          details: "Your recruiter account is currently suspended. Please contact support."
        });
      }

      const isCustomPlan = Boolean(
        sub.plan_type?.toLowerCase() === 'custom' ||
        (sub.plan_slug && sub.plan_slug.toLowerCase().startsWith('custom')) ||
        (sub.plan_name && sub.plan_name.toLowerCase().includes('custom'))
      );

      if (!isCustomPlan) {
        return res.status(403).json({
          success: false,
          limit_reached: true,
          message: "Custom Plan Required",
          details: `Your current ${sub.plan_name} Plan is configured for Job Posting only. Resume downloads are exclusive to Custom Plans. Please upgrade to a Custom Plan to download resumes.`
        });
      }

      // Check if already downloaded under this subscription
      const [existing] = await pool.query(
        `SELECT id FROM recruiter_resume_access WHERE recruiter_id = ? AND subscription_id = ? AND candidate_id = ? AND action_type = 'download' LIMIT 1`,
        [recruiterId, sub.subscription_id, candidateId]
      );

      if (existing.length > 0) {
        return res.status(200).json({
          success: true,
          already_unlocked: true,
          message: "Candidate resume already downloaded in this billing cycle.",
          limit: sub.resume_download_limit,
          used: sub.resume_downloads_used,
          remaining: Math.max(0, sub.resume_download_limit - sub.resume_downloads_used)
        });
      }

      // Check sub-recruiter specific permissions & split quotas
      const subRecruiter = await SubRecruiterModel.getSubRecruiterByUserId(userId);
      if (subRecruiter) {
        if (subRecruiter.permissions?.can_download_resumes === false) {
          return res.status(403).json({
            success: false,
            limit_reached: true,
            message: "Permission Denied",
            details: "Your sub-recruiter account does not have permission to download candidate resumes."
          });
        }
        if (subRecruiter.permissions?.quota_mode === 'split' && subRecruiter.permissions?.allocated_resume_downloads !== null && subRecruiter.permissions?.allocated_resume_downloads !== undefined) {
          const subAllocated = Number(subRecruiter.permissions.allocated_resume_downloads);
          const subUsed = Number(subRecruiter.permissions.used_resume_downloads || 0);
          if (subUsed >= subAllocated) {
            return res.status(403).json({
              success: false,
              limit_reached: true,
              message: "Sub-Recruiter Quota Limit Reached",
              details: `You have reached your allocated resume download limit (${subUsed} of ${subAllocated} downloads). Please contact your company administrator.`
            });
          }
        }
      }

      // Check download limit
      if (sub.resume_downloads_used >= sub.resume_download_limit) {
        return res.status(403).json({
          success: false,
          limit_reached: true,
          message: "Resume Download Limit Reached",
          details: `You have used all ${sub.resume_download_limit} resume downloads included in your ${sub.plan_name} Plan. Please upgrade your subscription plan to download more resumes.`,
          limit: sub.resume_download_limit,
          used: sub.resume_downloads_used,
          remaining: 0
        });
      }

      // Record download in recruiter_resume_access
      await pool.query(
        `INSERT IGNORE INTO recruiter_resume_access (recruiter_id, subscription_id, candidate_id, action_type) VALUES (?, ?, ?, 'download')`,
        [recruiterId, sub.subscription_id, candidateId]
      );

      // Increment resume_downloads_used in subscription_usage
      if (sub.usage_id) {
        await pool.query(
          `UPDATE subscription_usage SET resume_downloads_used = resume_downloads_used + 1 WHERE id = ?`,
          [sub.usage_id]
        );
      }

      // Increment sub-recruiter specific usage if applicable
      if (subRecruiter) {
        await SubRecruiterModel.incrementSubRecruiterUsage(userId, 'resume_download');
      }

      const updatedUsed = sub.resume_downloads_used + 1;
      const updatedRemaining = Math.max(0, sub.resume_download_limit - updatedUsed);

      return res.status(200).json({
        success: true,
        already_unlocked: false,
        message: "Resume download recorded successfully.",
        limit: sub.resume_download_limit,
        used: updatedUsed,
        remaining: updatedRemaining
      });
    } catch (error) {
      console.error("Error consuming resume download:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to process resume download.",
        details: error.message
      });
    }
  },

  sendCandidateEmail: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "User not authenticated" });
      }

      const { candidates, message, subject } = req.body;
      if (!Array.isArray(candidates) || candidates.length === 0) {
        return res.status(400).json({ success: false, message: "No candidates selected." });
      }
      if (!message || !message.trim()) {
        return res.status(400).json({ success: false, message: "Message content cannot be empty." });
      }

      const recruiterId = await getEffectiveRecruiterId(userId);

      // Check recruiter plan permission
      const [subRows] = await pool.query(
        `SELECT sp.name, sp.slug, sp.plan_type, sp.candidate_contact, rs.status, rs.expiry_date
         FROM recruiter_subscriptions rs
         JOIN subscription_plans sp ON rs.plan_id = sp.id
         WHERE rs.recruiter_id = ?
         ORDER BY rs.id DESC LIMIT 1`,
        [recruiterId]
      );

      if (subRows.length > 0) {
        const sub = subRows[0];
        const isExpired = new Date(sub.expiry_date) < new Date() || sub.status === 'Expired';
        const isCustom = sub.plan_type?.toLowerCase() === 'custom' || sub.slug?.toLowerCase().startsWith('custom') || sub.name?.toLowerCase().includes('custom');
        if (!isCustom || sub.candidate_contact === 0 || isExpired) {
          return res.status(403).json({
            success: false,
            message: "Direct candidate messaging is exclusive to Custom Plans. Your current plan is configured for Job Posting only."
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          message: "No active subscription found. Please subscribe to a Custom Plan to contact candidates."
        });
      }

      // Get recruiter profile info
      const [userRows] = await pool.query(
        `SELECT u.id, u.first_name, u.last_name, u.email, u.organization,
                COALESCE(hp.company_name, u.organization) AS company_name
         FROM users u
         LEFT JOIN hr_profiles hp ON u.id = hp.user_id
         WHERE u.id = ?`,
        [userId]
      );
      const recruiter = userRows[0] || {};
      const recruiterName = `${recruiter.first_name || ''} ${recruiter.last_name || ''}`.trim() || 'Recruiter';
      const recruiterEmail = recruiter.email;
      const companyName = recruiter.company_name || recruiter.organization || '';

      const { sendCandidateDirectEmail } = require("../models/EmailModel");

      let sentCount = 0;
      let failedCount = 0;
      const errors = [];

      for (const cand of candidates) {
        let candEmail = cand.email;
        let candName = `${cand.first_name || ''} ${cand.last_name || ''}`.trim() || 'Candidate';

        if (!candEmail && cand.id) {
          try {
            const [cRows] = await pool.query(`SELECT email, first_name, last_name FROM users WHERE id = ?`, [cand.id]);
            if (cRows.length > 0) {
              candEmail = cRows[0].email;
              candName = `${cRows[0].first_name || ''} ${cRows[0].last_name || ''}`.trim() || candName;
            }
          } catch (e) {
            console.warn("Could not lookup candidate email:", e.message);
          }
        }

        if (!candEmail) {
          failedCount++;
          errors.push(`Candidate #${cand.id || 'unknown'} has no valid email.`);
          continue;
        }

        try {
          await sendCandidateDirectEmail({
            candidateEmail: candEmail,
            candidateName: candName,
            recruiterName,
            recruiterEmail,
            companyName,
            subject: subject || `Career Opportunity from ${companyName || recruiterName}`,
            messageContent: message.trim()
          });
          sentCount++;
        } catch (sendErr) {
          console.error(`Error sending email to ${candEmail}:`, sendErr.message);
          failedCount++;
          errors.push(`Failed to send to ${candEmail}: ${sendErr.message}`);
        }
      }

      // Record candidate contact usage & email counts if subscription exists
      try {
        const [subRow] = await pool.query(
          `SELECT id FROM recruiter_subscriptions WHERE recruiter_id = ? ORDER BY id DESC LIMIT 1`,
          [recruiterId]
        );
        if (subRow.length > 0 && sentCount > 0) {
          await pool.query(
            `UPDATE subscription_usage 
             SET candidate_contacts_used = candidate_contacts_used + ?,
                 emails_sent = emails_sent + ? 
             WHERE subscription_id = ?`,
            [sentCount, sentCount, subRow[0].id]
          );
        }
        if (sentCount > 0) {
          await pool.query(
            `INSERT INTO hr_credits_breakdown (recruiter_id, email_count) 
             VALUES (?, ?) 
             ON DUPLICATE KEY UPDATE email_count = email_count + ?`,
            [recruiterId, sentCount, sentCount]
          );
        }
      } catch (usageErr) {
        console.warn("Could not update email usage:", usageErr.message);
      }

      if (sentCount === 0 && failedCount > 0) {
        return res.status(500).json({
          success: false,
          message: "Failed to send email to the candidate(s).",
          errors
        });
      }

      return res.status(200).json({
        success: true,
        sentCount,
        failedCount,
        message: `Email successfully sent to ${sentCount} candidate(s)!`
      });
    } catch (error) {
      console.error("sendCandidateEmail error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to send email to candidate.",
        details: error.message
      });
    }
  },

  consumeExcelDownload: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "User not authenticated" });
      }

      const count = Math.max(1, parseInt(req.body?.count || 1, 10));
      const candidateIds = Array.isArray(req.body?.candidate_ids) ? req.body.candidate_ids : (Array.isArray(req.body?.candidateIds) ? req.body.candidateIds : []);
      const recruiterId = await getEffectiveRecruiterId(userId);

      const query = `
        SELECT 
          rs.id AS subscription_id,
          rs.recruiter_id,
          rs.expiry_date,
          rs.status AS subscription_status,
          sp.name AS plan_name,
          sp.slug AS plan_slug,
          sp.plan_type,
          COALESCE(sp.excel_download_limit, 0) AS excel_download_limit,
          su.id AS usage_id,
          COALESCE(su.excel_downloads_used, 0) AS excel_downloads_used
        FROM recruiter_subscriptions rs
        INNER JOIN subscription_plans sp ON rs.plan_id = sp.id
        LEFT JOIN subscription_usage su ON rs.id = su.subscription_id
        WHERE rs.recruiter_id = ?
        ORDER BY rs.id DESC
        LIMIT 1
      `;
      const [rows] = await pool.query(query, [recruiterId]);

      if (rows.length === 0) {
        return res.status(403).json({
          success: false,
          limit_reached: true,
          message: "No Active Subscription",
          details: "You do not have an active subscription. Please subscribe to a plan to export candidates to Excel."
        });
      }

      const sub = rows[0];
      const isExpired = new Date(sub.expiry_date) < new Date() || sub.subscription_status === 'Expired';
      if (isExpired) {
        return res.status(403).json({
          success: false,
          limit_reached: true,
          message: "Subscription Expired",
          details: "Your subscription plan has expired. Please upgrade or renew your plan to export candidate data."
        });
      }

      if (sub.subscription_status === 'Suspended') {
        return res.status(403).json({
          success: false,
          limit_reached: true,
          message: "Account Suspended",
          details: "Your recruiter account is currently suspended. Please contact support."
        });
      }

      const isCustomPlan = Boolean(
        sub.plan_type?.toLowerCase() === 'custom' ||
        (sub.plan_slug && sub.plan_slug.toLowerCase().startsWith('custom')) ||
        (sub.plan_name && sub.plan_name.toLowerCase().includes('custom'))
      );

      if (!isCustomPlan) {
        return res.status(403).json({
          success: false,
          limit_reached: true,
          message: "Custom Plan Required",
          details: `Your current ${sub.plan_name} Plan is configured for Job Posting only. Exporting candidates to Excel is exclusive to Custom Plans. Please upgrade to a Custom Plan.`
        });
      }

      const currentUsed = Number(sub.excel_downloads_used || 0);
      const limit = Number(sub.excel_download_limit || 0);
      const remainingBefore = Math.max(0, limit - currentUsed);

      if (currentUsed + count > limit) {
        return res.status(403).json({
          success: false,
          limit_reached: true,
          message: "Excel Download Quota Exceeded",
          details: `You selected ${count} candidates, but have only ${remainingBefore} Excel downloads left in your ${sub.plan_name} Plan. Please upgrade your plan.`,
          limit: limit,
          used: currentUsed,
          remaining: remainingBefore
        });
      }

      // Record in subscription_usage
      if (sub.usage_id) {
        await pool.query(
          `UPDATE subscription_usage SET excel_downloads_used = excel_downloads_used + ? WHERE id = ?`,
          [count, sub.usage_id]
        );
      } else {
        await pool.query(
          `INSERT INTO subscription_usage (subscription_id, recruiter_id, excel_downloads_used) VALUES (?, ?, ?)`,
          [sub.subscription_id, recruiterId, count]
        );
      }

      // Sync hr_credits_breakdown
      try {
        await pool.query(
          `INSERT INTO hr_credits_breakdown (recruiter_id, excel_downloads)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE excel_downloads = excel_downloads + ?`,
          [recruiterId, count, count]
        );
      } catch (hbErr) {
        console.warn("Could not sync hr_credits_breakdown for excel_downloads:", hbErr.message);
      }

      const updatedUsed = currentUsed + count;
      const updatedRemaining = Math.max(0, limit - updatedUsed);

      return res.status(200).json({
        success: true,
        message: `Successfully processed ${count} candidate Excel export(s).`,
        consumed_count: count,
        limit: limit,
        used: updatedUsed,
        remaining: updatedRemaining
      });
    } catch (error) {
      console.error("Error consuming Excel download:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to process Excel download.",
        details: error.message
      });
    }
  },

  recordCandidateWhatsApp: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "User not authenticated" });
      }

      const count = Math.max(1, parseInt(req.body.count || 1, 10));
      const recruiterId = await getEffectiveRecruiterId(userId);

      const [subRows] = await pool.query(
        `SELECT sp.candidate_contact, sp.whatsapp_limit, rs.id as sub_id, rs.status, rs.expiry_date
         FROM recruiter_subscriptions rs
         JOIN subscription_plans sp ON rs.plan_id = sp.id
         WHERE rs.recruiter_id = ?
         ORDER BY rs.id DESC LIMIT 1`,
        [recruiterId]
      );

      if (subRows.length > 0) {
        const sub = subRows[0];
        const isExpired = new Date(sub.expiry_date) < new Date() || sub.status === 'Expired';
        if (sub.candidate_contact === 0 || isExpired) {
          return res.status(403).json({
            success: false,
            message: "Direct candidate contact is not included in your subscription plan. Please upgrade your plan."
          });
        }
        
        const whatsappLimit = sub.whatsapp_limit || 0;
        if (whatsappLimit > 0) {
          const [usageRows] = await pool.query(
            `SELECT whatsapp_count FROM hr_credits_breakdown WHERE recruiter_id = ? LIMIT 1`,
            [recruiterId]
          );
          const currentWaCount = usageRows[0]?.whatsapp_count || 0;
          if (currentWaCount + count > whatsappLimit) {
            return res.status(403).json({
              success: false,
              message: `WhatsApp quota exceeded. Your plan allows up to ${whatsappLimit} messages (${currentWaCount} already sent). Please upgrade your plan.`
            });
          }
        }
      }

      // Increment counts in subscription_usage & hr_credits_breakdown
      try {
        const subId = subRows[0]?.sub_id;
        if (subId) {
          await pool.query(
            `UPDATE subscription_usage 
             SET candidate_contacts_used = candidate_contacts_used + ?,
                 whatsapp_messages_sent = whatsapp_messages_sent + ?
             WHERE subscription_id = ?`,
            [count, count, subId]
          );
        }
        await pool.query(
          `INSERT INTO hr_credits_breakdown (recruiter_id, whatsapp_count) 
           VALUES (?, ?) 
           ON DUPLICATE KEY UPDATE whatsapp_count = whatsapp_count + ?`,
          [recruiterId, count, count]
        );
      } catch (uErr) {
        console.warn("Could not update WhatsApp count:", uErr.message);
      }

      return res.status(200).json({
        success: true,
        message: "WhatsApp interaction recorded successfully."
      });
    } catch (error) {
      console.error("recordCandidateWhatsApp error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
};

module.exports = RecruiterSubscriptionController;

