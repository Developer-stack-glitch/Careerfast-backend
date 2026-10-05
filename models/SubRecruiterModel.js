const pool = require("../config/dbConfig");
const bcrypt = require("bcrypt");

const SubRecruiterModel = {
  // Get all sub-recruiters for a main recruiter along with seat quota metrics and pool breakdown
  getTeamByMainRecruiterId: async (mainRecruiterId) => {
    try {
      // 1. Get plan quota and pool metrics for this recruiter
      const [subRows] = await pool.query(
        `SELECT rs.id as subscription_id, rs.plan_id, rs.status,
                sp.name as plan_name, sp.plan_type, sp.slug as plan_slug,
                COALESCE(sp.sub_recruiter_limit, 0) as sub_recruiter_limit,
                COALESCE(sp.job_post_limit, 0) as job_post_limit,
                COALESCE(sp.resume_view_limit, 0) as resume_view_limit,
                COALESCE(sp.resume_download_limit, 0) as resume_download_limit,
                COALESCE(su.job_posts_used, 0) as job_posts_used,
                COALESCE(su.resume_views_used, 0) as resume_views_used,
                COALESCE(su.resume_downloads_used, 0) as resume_downloads_used,
                hp.id as company_id, hp.company_name
         FROM recruiter_subscriptions rs
         JOIN subscription_plans sp ON rs.plan_id = sp.id
         LEFT JOIN subscription_usage su ON rs.id = su.subscription_id
         LEFT JOIN hr_profiles hp ON rs.recruiter_id = hp.user_id
         WHERE rs.recruiter_id = ?
         ORDER BY rs.id DESC
         LIMIT 1`,
        [mainRecruiterId]
      );

      const isCustomPlan = Boolean(
        subRows[0]?.is_custom ||
        subRows[0]?.plan_type === 'custom' ||
        subRows[0]?.plan_type === 'Custom' ||
        subRows[0]?.plan_slug?.startsWith('custom') ||
        subRows[0]?.plan_name?.toLowerCase().includes('custom')
      );

      const planQuota = isCustomPlan ? (subRows[0]?.sub_recruiter_limit ?? 0) : 0;
      const companyName = subRows[0]?.company_name || 'Company';
      const companyId = subRows[0]?.company_id || null;
      const planName = subRows[0]?.plan_name || 'Basic';

      if (!isCustomPlan) {
        return {
          team: [],
          is_custom: false,
          has_team_access: false,
          stats: {
            sub_recruiter_limit: 0,
            total_members: 0,
            active_members: 0,
            remaining_seats: 0,
            company_id: companyId,
            company_name: companyName,
            plan_name: planName,
            is_custom: false,
            pool: {
              job_posts: { total: 0, used: 0, remaining_pool: 0, allocated_to_team: 0, unallocated: 0 },
              resume_views: { total: 0, used: 0, remaining_pool: 0, allocated_to_team: 0, unallocated: 0 },
              resume_downloads: { total: 0, used: 0, remaining_pool: 0, allocated_to_team: 0, unallocated: 0 }
            }
          }
        };
      }

      const poolLimits = {
        job_post_limit: Number(subRows[0]?.job_post_limit || 0),
        job_posts_used: Number(subRows[0]?.job_posts_used || 0),
        resume_view_limit: Number(subRows[0]?.resume_view_limit || 0),
        resume_views_used: Number(subRows[0]?.resume_views_used || 0),
        resume_download_limit: Number(subRows[0]?.resume_download_limit || 0),
        resume_downloads_used: Number(subRows[0]?.resume_downloads_used || 0),
      };

      // 2. Fetch all sub-recruiters
      const [members] = await pool.query(
        `SELECT sr.id, sr.main_recruiter_id, sr.sub_recruiter_id, sr.company_id,
                sr.designation, sr.role_preset, sr.permissions, sr.status,
                sr.created_at, sr.updated_at,
                u.first_name, u.last_name, u.email, u.phone, u.is_active as user_active,
                CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as full_name,
                (SELECT COUNT(*) FROM job_post jp WHERE jp.user_id = sr.sub_recruiter_id) as jobs_posted_count
         FROM sub_recruiters sr
         JOIN users u ON sr.sub_recruiter_id = u.id
         WHERE sr.main_recruiter_id = ?
         ORDER BY sr.id DESC`,
        [mainRecruiterId]
      );

      // Real counts from jobs table across entire company (main recruiter + any sub-recruiters)
      const allRecruiterIds = [mainRecruiterId, ...members.map(m => m.sub_recruiter_id)];
      const [companyJobCounts] = await pool.query(
        `SELECT 
           COUNT(*) as total_jobs,
           SUM(CASE WHEN (is_closed = 0 OR is_closed IS NULL) AND approval_status = 'approved' THEN 1 ELSE 0 END) as active_jobs
         FROM job_post 
         WHERE user_id IN (?)`,
        [allRecruiterIds]
      );
      const companyTotalJobs = Number(companyJobCounts[0]?.total_jobs || 0);
      const companyActiveJobs = Number(companyJobCounts[0]?.active_jobs || 0);
      const effectiveJobsUsed = Math.max(poolLimits.job_posts_used, companyTotalJobs);
      const activeJobLimit = Number(subRows[0]?.active_job_limit || 3);

      let allocatedJobPostsTotal = 0;
      let allocatedResumeViewsTotal = 0;
      let allocatedResumeDownloadsTotal = 0;

      // Parse JSON permissions if string & calculate split allocations
      const parsedMembers = members.map(m => {
        let perms = m.permissions;
        if (typeof perms === 'string') {
          try {
            perms = JSON.parse(perms);
          } catch (e) {
            perms = {};
          }
        }

        // Quota split data
        const quotaMode = perms.quota_mode || 'shared';
        const allocatedJobs = quotaMode === 'split' ? Number(perms.allocated_job_posts || 0) : null;
        const allocatedViews = quotaMode === 'split' ? Number(perms.allocated_resume_views || 0) : null;
        const allocatedDownloads = quotaMode === 'split' ? Number(perms.allocated_resume_downloads || 0) : null;

        const usedJobs = Number(perms.used_job_posts || m.jobs_posted_count || 0);
        const usedViews = Number(perms.used_resume_views || 0);
        const usedDownloads = Number(perms.used_resume_downloads || 0);

        if (quotaMode === 'split') {
          allocatedJobPostsTotal += (allocatedJobs || 0);
          allocatedResumeViewsTotal += (allocatedViews || 0);
          allocatedResumeDownloadsTotal += (allocatedDownloads || 0);
        }

        return {
          ...m,
          permissions: {
            ...perms,
            quota_mode: quotaMode,
            allocated_job_posts: allocatedJobs,
            allocated_resume_views: allocatedViews,
            allocated_resume_downloads: allocatedDownloads,
            used_job_posts: usedJobs,
            used_resume_views: usedViews,
            used_resume_downloads: usedDownloads,
            remaining_job_posts: allocatedJobs !== null ? Math.max(0, allocatedJobs - usedJobs) : null,
            remaining_resume_views: allocatedViews !== null ? Math.max(0, allocatedViews - usedViews) : null,
            remaining_resume_downloads: allocatedDownloads !== null ? Math.max(0, allocatedDownloads - usedDownloads) : null,
          }
        };
      });

      const totalMembers = parsedMembers.length;
      const activeMembers = parsedMembers.filter(m => m.status === 'active' && m.user_active).length;

      // Unallocated pool capacity that can truly be granted
      const remainingUnallocatedJobs = Math.max(0, poolLimits.job_post_limit - effectiveJobsUsed - allocatedJobPostsTotal);
      const remainingUnallocatedViews = Math.max(0, poolLimits.resume_view_limit - poolLimits.resume_views_used - allocatedResumeViewsTotal);
      const remainingUnallocatedDownloads = Math.max(0, poolLimits.resume_download_limit - poolLimits.resume_downloads_used - allocatedResumeDownloadsTotal);

      return {
        team: parsedMembers,
        stats: {
          sub_recruiter_limit: Number(planQuota),
          total_members: totalMembers,
          active_members: activeMembers,
          remaining_seats: Math.max(0, Number(planQuota) - totalMembers),
          company_id: companyId,
          company_name: companyName,
          plan_name: planName,
          pool: {
            job_posts: {
              total: poolLimits.job_post_limit,
              active_limit: activeJobLimit,
              active_jobs: companyActiveJobs,
              used: effectiveJobsUsed,
              remaining_pool: Math.max(0, poolLimits.job_post_limit - effectiveJobsUsed),
              allocated_to_team: allocatedJobPostsTotal,
              unallocated: remainingUnallocatedJobs,
              available_to_allocate: remainingUnallocatedJobs,
              is_limit_reached: effectiveJobsUsed >= poolLimits.job_post_limit || companyActiveJobs >= activeJobLimit,
              active_limit_reached: companyActiveJobs >= activeJobLimit
            },
            resume_views: {
              total: poolLimits.resume_view_limit,
              used: poolLimits.resume_views_used,
              remaining_pool: Math.max(0, poolLimits.resume_view_limit - poolLimits.resume_views_used),
              allocated_to_team: allocatedResumeViewsTotal,
              unallocated: remainingUnallocatedViews,
              available_to_allocate: remainingUnallocatedViews
            },
            resume_downloads: {
              total: poolLimits.resume_download_limit,
              used: poolLimits.resume_downloads_used,
              remaining_pool: Math.max(0, poolLimits.resume_download_limit - poolLimits.resume_downloads_used),
              allocated_to_team: allocatedResumeDownloadsTotal,
              unallocated: remainingUnallocatedDownloads,
              available_to_allocate: remainingUnallocatedDownloads
            }
          }
        }
      };
    } catch (error) {
      throw error;
    }
  },

  // Create a new sub-recruiter under a main recruiter
  createSubRecruiter: async (mainRecruiterId, data) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const {
        first_name,
        last_name = '',
        email,
        phone = '',
        password,
        designation = 'Recruiter',
        role_preset = 'recruiter',
        permissions = {}
      } = data;

      if (!email || !password || !first_name) {
        throw new Error("First name, email, and password are required.");
      }

      // 1. Verify Seat Quota and Custom Plan
      const [subRows] = await connection.query(
        `SELECT sp.sub_recruiter_limit, sp.plan_type, sp.slug as plan_slug, sp.name as plan_name
         FROM recruiter_subscriptions rs
         JOIN subscription_plans sp ON rs.plan_id = sp.id
         WHERE rs.recruiter_id = ?
         ORDER BY rs.id DESC
         LIMIT 1`,
        [mainRecruiterId]
      );

      const isCustomPlan = Boolean(
        subRows[0]?.plan_type === 'custom' ||
        subRows[0]?.plan_type === 'Custom' ||
        subRows[0]?.plan_slug?.startsWith('custom') ||
        subRows[0]?.plan_name?.toLowerCase().includes('custom')
      );

      if (!isCustomPlan) {
        throw new Error("Sub-recruiter team seats are exclusive to Custom Plans assigned by the Super Admin. Please upgrade your plan.");
      }

      const limit = subRows[0]?.sub_recruiter_limit ?? 0;

      const [existingCountRows] = await connection.query(
        `SELECT COUNT(*) as count FROM sub_recruiters WHERE main_recruiter_id = ?`,
        [mainRecruiterId]
      );

      const existingCount = existingCountRows[0]?.count || 0;
      if (existingCount >= limit) {
        throw new Error(`Team seat limit reached (${limit} seats allowed under your Custom plan). Contact Super Admin to add more seats.`);
      }

      // 2. Check if email already exists
      const [existingUser] = await connection.query(
        `SELECT id FROM users WHERE email = ?`,
        [email.trim().toLowerCase()]
      );
      if (existingUser.length > 0) {
        throw new Error("A user with this email address already exists.");
      }

      // 3. Get Main recruiter company info
      const [hrRows] = await connection.query(
        `SELECT id, company_name FROM hr_profiles WHERE user_id = ? LIMIT 1`,
        [mainRecruiterId]
      );
      const companyId = hrRows[0]?.id || null;
      const organization = hrRows[0]?.company_name || 'Company';

      // 4. Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // 5. Create user in `users` table
      const [userResult] = await connection.query(
        `INSERT INTO users (
          first_name, last_name, email, password, phone, phone_code,
          role_id, is_active, organization, created_date, is_email_verified
        ) VALUES (?, ?, ?, ?, ?, '+91', 3, 1, ?, NOW(), 1)`,
        [
          first_name.trim(),
          last_name.trim(),
          email.trim().toLowerCase(),
          hashedPassword,
          phone || '',
          organization
        ]
      );
      const newUserId = userResult.insertId;

      // 6. Build permissions & quota splitting configuration
      const quotaMode = permissions.quota_mode || 'shared';
      const allocatedJobPosts = quotaMode === 'split' ? Math.max(0, Number(permissions.allocated_job_posts) || 0) : null;
      const allocatedResumeViews = quotaMode === 'split' ? Math.max(0, Number(permissions.allocated_resume_views) || 0) : null;
      const allocatedResumeDownloads = quotaMode === 'split' ? Math.max(0, Number(permissions.allocated_resume_downloads) || 0) : null;

      // Validate capacity if allocating job posts in split mode
      if (quotaMode === 'split' && allocatedJobPosts > 0) {
        const [subPlanRows] = await connection.query(
          `SELECT sp.job_post_limit, sp.active_job_limit, COALESCE(su.job_posts_used, 0) as job_posts_used
           FROM recruiter_subscriptions rs
           JOIN subscription_plans sp ON rs.plan_id = sp.id
           LEFT JOIN subscription_usage su ON rs.id = su.subscription_id
           WHERE rs.recruiter_id = ?
           ORDER BY rs.id DESC LIMIT 1`,
          [mainRecruiterId]
        );
        const subPlan = subPlanRows[0] || {};
        const jobPostLimit = Number(subPlan.job_post_limit || 0);
        const jobPostsUsed = Number(subPlan.job_posts_used || 0);

        const [teamMembers] = await connection.query(
          `SELECT permissions FROM sub_recruiters WHERE main_recruiter_id = ? AND status = 'active'`,
          [mainRecruiterId]
        );
        let existingAllocated = 0;
        teamMembers.forEach(tm => {
          let p = tm.permissions;
          if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { p = {}; } }
          if (p.quota_mode === 'split') existingAllocated += Number(p.allocated_job_posts || 0);
        });

        const [realJobCount] = await connection.query(
          `SELECT COUNT(*) as count FROM job_post WHERE user_id = ?`,
          [mainRecruiterId]
        );
        const totalUsed = Math.max(jobPostsUsed, Number(realJobCount[0]?.count || 0));
        const availableToAllocate = Math.max(0, jobPostLimit - totalUsed - existingAllocated);

        if (totalUsed >= jobPostLimit) {
          throw new Error(`Cannot allocate job posts: Company plan limit is reached (${totalUsed}/${jobPostLimit} monthly jobs used). Upgrade plan to allocate job posts.`);
        }
        if (allocatedJobPosts > availableToAllocate) {
          throw new Error(`Cannot allocate ${allocatedJobPosts} job posts. Only ${availableToAllocate} unallocated job posts available in your plan pool.`);
        }
      }

      // Validate capacity if allocating resume views in split mode
      if (quotaMode === 'split' && allocatedResumeViews > 0) {
        const [subPlanRows] = await connection.query(
          `SELECT sp.resume_view_limit, COALESCE(su.resume_views_used, 0) as resume_views_used
           FROM recruiter_subscriptions rs
           JOIN subscription_plans sp ON rs.plan_id = sp.id
           LEFT JOIN subscription_usage su ON rs.id = su.subscription_id
           WHERE rs.recruiter_id = ?
           ORDER BY rs.id DESC LIMIT 1`,
          [mainRecruiterId]
        );
        const subPlan = subPlanRows[0] || {};
        const viewLimit = Number(subPlan.resume_view_limit || 0);
        const viewsUsed = Number(subPlan.resume_views_used || 0);

        const [teamMembers] = await connection.query(
          `SELECT permissions FROM sub_recruiters WHERE main_recruiter_id = ? AND status = 'active'`,
          [mainRecruiterId]
        );
        let existingAllocatedViews = 0;
        teamMembers.forEach(tm => {
          let p = tm.permissions;
          if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { p = {}; } }
          if (p.quota_mode === 'split') existingAllocatedViews += Number(p.allocated_resume_views || 0);
        });

        const availableViews = Math.max(0, viewLimit - viewsUsed - existingAllocatedViews);
        if (viewsUsed >= viewLimit) {
          throw new Error(`Cannot allocate resume views: Company plan limit is reached (${viewsUsed}/${viewLimit} views used). Upgrade plan to allocate views.`);
        }
        if (allocatedResumeViews > availableViews) {
          throw new Error(`Cannot allocate ${allocatedResumeViews} resume views. Only ${availableViews} unallocated resume views available in your plan pool.`);
        }
      }

      // Validate capacity if allocating resume downloads in split mode
      if (quotaMode === 'split' && allocatedResumeDownloads > 0) {
        const [subPlanRows] = await connection.query(
          `SELECT sp.resume_download_limit, COALESCE(su.resume_downloads_used, 0) as resume_downloads_used
           FROM recruiter_subscriptions rs
           JOIN subscription_plans sp ON rs.plan_id = sp.id
           LEFT JOIN subscription_usage su ON rs.id = su.subscription_id
           WHERE rs.recruiter_id = ?
           ORDER BY rs.id DESC LIMIT 1`,
          [mainRecruiterId]
        );
        const subPlan = subPlanRows[0] || {};
        const downloadLimit = Number(subPlan.resume_download_limit || 0);
        const downloadsUsed = Number(subPlan.resume_downloads_used || 0);

        const [teamMembers] = await connection.query(
          `SELECT permissions FROM sub_recruiters WHERE main_recruiter_id = ? AND status = 'active'`,
          [mainRecruiterId]
        );
        let existingAllocatedDownloads = 0;
        teamMembers.forEach(tm => {
          let p = tm.permissions;
          if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { p = {}; } }
          if (p.quota_mode === 'split') existingAllocatedDownloads += Number(p.allocated_resume_downloads || 0);
        });

        const availableDownloads = Math.max(0, downloadLimit - downloadsUsed - existingAllocatedDownloads);
        if (downloadsUsed >= downloadLimit) {
          throw new Error(`Cannot allocate CV downloads: Company plan limit is reached (${downloadsUsed}/${downloadLimit} downloads used). Upgrade plan to allocate downloads.`);
        }
        if (allocatedResumeDownloads > availableDownloads) {
          throw new Error(`Cannot allocate ${allocatedResumeDownloads} CV downloads. Only ${availableDownloads} unallocated CV downloads available in your plan pool.`);
        }
      }

      const finalPermissions = {
        can_post_jobs: Boolean(permissions.can_post_jobs ?? (role_preset === 'team_admin' || role_preset === 'recruiter')),
        can_view_resumes: Boolean(permissions.can_view_resumes ?? true),
        can_download_resumes: Boolean(permissions.can_download_resumes ?? (role_preset === 'team_admin' || role_preset === 'recruiter')),
        can_contact_candidates: Boolean(permissions.can_contact_candidates ?? (role_preset === 'team_admin' || role_preset === 'recruiter')),
        can_manage_applications: Boolean(permissions.can_manage_applications ?? true),
        can_edit_company_profile: Boolean(permissions.can_edit_company_profile ?? (role_preset === 'team_admin')),
        quota_mode: quotaMode,
        allocated_job_posts: allocatedJobPosts,
        allocated_resume_views: allocatedResumeViews,
        allocated_resume_downloads: allocatedResumeDownloads,
        used_job_posts: 0,
        used_resume_views: 0,
        used_resume_downloads: 0
      };

      // 7. Insert into `sub_recruiters`
      const [subResult] = await connection.query(
        `INSERT INTO sub_recruiters (
          main_recruiter_id, sub_recruiter_id, company_id,
          designation, role_preset, permissions, status
        ) VALUES (?, ?, ?, ?, ?, ?, 'active')`,
        [
          mainRecruiterId,
          newUserId,
          companyId,
          designation,
          role_preset,
          JSON.stringify(finalPermissions)
        ]
      );

      await connection.commit();

      return {
        id: subResult.insertId,
        sub_recruiter_id: newUserId,
        full_name: `${first_name} ${last_name}`.trim(),
        email: email.trim().toLowerCase(),
        designation,
        role_preset,
        permissions: finalPermissions
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  // Update permissions and role preset of a sub-recruiter
  updatePermissions: async (subRecruiterRecordId, mainRecruiterId, data) => {
    try {
      const { designation, role_preset, permissions } = data;

      // First fetch existing permissions so we don't wipe out usage counts
      const [existingRows] = await pool.query(
        `SELECT permissions FROM sub_recruiters WHERE id = ? ${mainRecruiterId ? 'AND main_recruiter_id = ?' : ''}`,
        mainRecruiterId ? [subRecruiterRecordId, mainRecruiterId] : [subRecruiterRecordId]
      );

      let existingPerms = {};
      if (existingRows.length > 0 && existingRows[0].permissions) {
        try {
          existingPerms = typeof existingRows[0].permissions === 'string'
            ? JSON.parse(existingRows[0].permissions)
            : existingRows[0].permissions;
        } catch (e) {
          existingPerms = {};
        }
      }

      let updateQuery = `UPDATE sub_recruiters SET `;
      const params = [];
      const updates = [];

      if (designation !== undefined) {
        updates.push(`designation = ?`);
        params.push(designation);
      }
      if (role_preset !== undefined) {
        updates.push(`role_preset = ?`);
        params.push(role_preset);
      }
      if (permissions !== undefined) {
        let permsObj = typeof permissions === 'string' ? JSON.parse(permissions) : { ...permissions };

        // Validate split quota capacity if updating job posts
        if (permsObj.quota_mode === 'split' && permsObj.allocated_job_posts !== undefined && mainRecruiterId) {
          const newAllocated = Math.max(0, Number(permsObj.allocated_job_posts) || 0);

          const [subPlanRows] = await pool.query(
            `SELECT sp.job_post_limit, sp.active_job_limit, COALESCE(su.job_posts_used, 0) as job_posts_used
             FROM recruiter_subscriptions rs
             JOIN subscription_plans sp ON rs.plan_id = sp.id
             LEFT JOIN subscription_usage su ON rs.id = su.subscription_id
             WHERE rs.recruiter_id = ?
             ORDER BY rs.id DESC LIMIT 1`,
            [mainRecruiterId]
          );
          const subPlan = subPlanRows[0] || {};
          const jobPostLimit = Number(subPlan.job_post_limit || 0);
          const jobPostsUsed = Number(subPlan.job_posts_used || 0);

          // Get other sub-recruiters' allocated jobs (excluding this record)
          const [otherSubs] = await pool.query(
            `SELECT permissions FROM sub_recruiters WHERE main_recruiter_id = ? AND id != ? AND status = 'active'`,
            [mainRecruiterId, subRecruiterRecordId]
          );
          let otherAllocated = 0;
          otherSubs.forEach(t => {
            let p = t.permissions;
            if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { p = {}; } }
            if (p.quota_mode === 'split') otherAllocated += Number(p.allocated_job_posts || 0);
          });

          const [realJobCount] = await pool.query(
            `SELECT COUNT(*) as count FROM job_post WHERE user_id = ?`,
            [mainRecruiterId]
          );
          const totalUsed = Math.max(jobPostsUsed, Number(realJobCount[0]?.count || 0));
          const availableForThisSub = Math.max(0, jobPostLimit - totalUsed - otherAllocated);

          if (newAllocated > availableForThisSub) {
            throw new Error(`Cannot allocate ${newAllocated} job posts. Only ${availableForThisSub} unallocated job posts available in your plan pool (Plan: ${jobPostLimit}, Used: ${totalUsed}).`);
          }
        }

        // Validate split quota capacity if updating resume views
        if (permsObj.quota_mode === 'split' && permsObj.allocated_resume_views !== undefined && mainRecruiterId) {
          const newAllocatedViews = Math.max(0, Number(permsObj.allocated_resume_views) || 0);

          const [subPlanRows] = await pool.query(
            `SELECT sp.resume_view_limit, COALESCE(su.resume_views_used, 0) as resume_views_used
             FROM recruiter_subscriptions rs
             JOIN subscription_plans sp ON rs.plan_id = sp.id
             LEFT JOIN subscription_usage su ON rs.id = su.subscription_id
             WHERE rs.recruiter_id = ?
             ORDER BY rs.id DESC LIMIT 1`,
            [mainRecruiterId]
          );
          const subPlan = subPlanRows[0] || {};
          const viewLimit = Number(subPlan.resume_view_limit || 0);
          const viewsUsed = Number(subPlan.resume_views_used || 0);

          const [otherSubs] = await pool.query(
            `SELECT permissions FROM sub_recruiters WHERE main_recruiter_id = ? AND id != ? AND status = 'active'`,
            [mainRecruiterId, subRecruiterRecordId]
          );
          let otherAllocatedViews = 0;
          otherSubs.forEach(t => {
            let p = t.permissions;
            if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { p = {}; } }
            if (p.quota_mode === 'split') otherAllocatedViews += Number(p.allocated_resume_views || 0);
          });

          const availableViewsForThisSub = Math.max(0, viewLimit - viewsUsed - otherAllocatedViews);
          if (newAllocatedViews > availableViewsForThisSub) {
            throw new Error(`Cannot allocate ${newAllocatedViews} resume views. Only ${availableViewsForThisSub} unallocated resume views available in your plan pool.`);
          }
        }

        // Validate split quota capacity if updating resume downloads
        if (permsObj.quota_mode === 'split' && permsObj.allocated_resume_downloads !== undefined && mainRecruiterId) {
          const newAllocatedDownloads = Math.max(0, Number(permsObj.allocated_resume_downloads) || 0);

          const [subPlanRows] = await pool.query(
            `SELECT sp.resume_download_limit, COALESCE(su.resume_downloads_used, 0) as resume_downloads_used
             FROM recruiter_subscriptions rs
             JOIN subscription_plans sp ON rs.plan_id = sp.id
             LEFT JOIN subscription_usage su ON rs.id = su.subscription_id
             WHERE rs.recruiter_id = ?
             ORDER BY rs.id DESC LIMIT 1`,
            [mainRecruiterId]
          );
          const subPlan = subPlanRows[0] || {};
          const downloadLimit = Number(subPlan.resume_download_limit || 0);
          const downloadsUsed = Number(subPlan.resume_downloads_used || 0);

          const [otherSubs] = await pool.query(
            `SELECT permissions FROM sub_recruiters WHERE main_recruiter_id = ? AND id != ? AND status = 'active'`,
            [mainRecruiterId, subRecruiterRecordId]
          );
          let otherAllocatedDownloads = 0;
          otherSubs.forEach(t => {
            let p = t.permissions;
            if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { p = {}; } }
            if (p.quota_mode === 'split') otherAllocatedDownloads += Number(p.allocated_resume_downloads || 0);
          });

          const availableDownloadsForThisSub = Math.max(0, downloadLimit - downloadsUsed - otherAllocatedDownloads);
          if (newAllocatedDownloads > availableDownloadsForThisSub) {
            throw new Error(`Cannot allocate ${newAllocatedDownloads} CV downloads. Only ${availableDownloadsForThisSub} unallocated CV downloads available in your plan pool.`);
          }
        }
        
        // Preserve used counters
        const mergedPerms = {
          ...existingPerms,
          ...permsObj,
          used_job_posts: existingPerms.used_job_posts || 0,
          used_resume_views: existingPerms.used_resume_views || 0,
          used_resume_downloads: existingPerms.used_resume_downloads || 0
        };

        updates.push(`permissions = ?`);
        params.push(JSON.stringify(mergedPerms));
      }

      if (updates.length === 0) return 0;

      updateQuery += updates.join(", ") + ` WHERE id = ?`;
      params.push(subRecruiterRecordId);

      // Verify ownership if mainRecruiterId is provided
      if (mainRecruiterId) {
        updateQuery += ` AND main_recruiter_id = ?`;
        params.push(mainRecruiterId);
      }

      const [result] = await pool.query(updateQuery, params);
      return result.affectedRows;
    } catch (error) {
      throw error;
    }
  },

  // Toggle status (active / suspended)
  toggleStatus: async (subRecruiterRecordId, mainRecruiterId, status) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      let query = `SELECT sub_recruiter_id FROM sub_recruiters WHERE id = ?`;
      const params = [subRecruiterRecordId];
      if (mainRecruiterId) {
        query += ` AND main_recruiter_id = ?`;
        params.push(mainRecruiterId);
      }

      const [rows] = await connection.query(query, params);
      if (rows.length === 0) {
        throw new Error("Sub-recruiter record not found or permission denied.");
      }

      const subUserId = rows[0].sub_recruiter_id;
      const nextActive = status === 'active' ? 1 : 0;

      // Update in sub_recruiters
      await connection.query(
        `UPDATE sub_recruiters SET status = ? WHERE id = ?`,
        [status, subRecruiterRecordId]
      );

      // Update in users table
      await connection.query(
        `UPDATE users SET is_active = ? WHERE id = ?`,
        [nextActive, subUserId]
      );

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  // Delete sub-recruiter
  deleteSubRecruiter: async (subRecruiterRecordId, mainRecruiterId) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      let query = `SELECT sub_recruiter_id FROM sub_recruiters WHERE id = ?`;
      const params = [subRecruiterRecordId];
      if (mainRecruiterId) {
        query += ` AND main_recruiter_id = ?`;
        params.push(mainRecruiterId);
      }

      const [rows] = await connection.query(query, params);
      if (rows.length === 0) {
        throw new Error("Sub-recruiter record not found or permission denied.");
      }

      const subUserId = rows[0].sub_recruiter_id;

      // Remove from sub_recruiters
      await connection.query(`DELETE FROM sub_recruiters WHERE id = ?`, [subRecruiterRecordId]);

      // Deactivate user account
      await connection.query(`UPDATE users SET is_active = 0 WHERE id = ?`, [subUserId]);

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  // Get active sub-recruiter info for an authenticated user
  getSubRecruiterByUserId: async (userId) => {
    try {
      const [rows] = await pool.query(
        `SELECT sr.id, sr.main_recruiter_id, sr.sub_recruiter_id, sr.company_id,
                sr.designation, sr.role_preset, sr.permissions, sr.status
         FROM sub_recruiters sr
         WHERE sr.sub_recruiter_id = ? AND sr.status = 'active'
         LIMIT 1`,
        [userId]
      );

      if (rows.length === 0) return null;

      const record = rows[0];
      let perms = record.permissions;
      if (typeof perms === 'string') {
        try {
          perms = JSON.parse(perms);
        } catch (e) {
          perms = {};
        }
      }
      record.permissions = perms;
      return record;
    } catch (err) {
      console.error("Error in getSubRecruiterByUserId:", err);
      return null;
    }
  },

  // Increment usage for sub-recruiter (job_post, resume_view, resume_download)
  incrementSubRecruiterUsage: async (subUserId, actionType) => {
    try {
      const [rows] = await pool.query(
        `SELECT id, permissions FROM sub_recruiters WHERE sub_recruiter_id = ? LIMIT 1`,
        [subUserId]
      );
      if (rows.length === 0) return false;

      let perms = rows[0].permissions;
      if (typeof perms === 'string') {
        try { perms = JSON.parse(perms); } catch (e) { perms = {}; }
      }

      if (actionType === 'job_post') {
        perms.used_job_posts = (Number(perms.used_job_posts) || 0) + 1;
      } else if (actionType === 'resume_view') {
        perms.used_resume_views = (Number(perms.used_resume_views) || 0) + 1;
      } else if (actionType === 'resume_download') {
        perms.used_resume_downloads = (Number(perms.used_resume_downloads) || 0) + 1;
      }

      await pool.query(
        `UPDATE sub_recruiters SET permissions = ? WHERE id = ?`,
        [JSON.stringify(perms), rows[0].id]
      );
      return true;
    } catch (err) {
      console.error("Error in incrementSubRecruiterUsage:", err);
      return false;
    }
  }
};

module.exports = SubRecruiterModel;
