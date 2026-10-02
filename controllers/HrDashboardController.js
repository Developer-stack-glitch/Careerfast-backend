const pool = require("../config/dbConfig");

const HrDashboardController = {
  // Aggregate all dashboard dynamic data in a single optimized payload
  getDashboardSummary: async (req, res) => {
    try {
      const recruiterId = req.user?.id || parseInt(req.query.recruiter_id, 10);
      if (!recruiterId) {
        return res.status(200).json({
          success: true,
          data: {
            searches: { recent: [], saved: [] },
            jobs: { list: [], total: 0 },
            campaigns: [],
            credits: {
              profile_usage_used: 0,
              profile_usage_total: 0,
              profile_views: 0,
              excel_downloads: 0,
              job_posting_used: 0,
              job_posting_total: 0,
              jobs_posted: 0,
              outreach_used: 0,
              outreach_total: 0,
              email_count: 0,
              whatsapp_count: 0,
              sms_count: 0
            },
            downloads: { folders: [], candidates: [], totalFolders: 0, totalDownloads: 0, totalResumes: 0 }
          }
        });
      }

      // 1. Searches (Recent and Saved)
      const [searches] = await pool.query(
        `SELECT id, recruiter_id, search_type, query_title, query_params, created_at, updated_at 
         FROM recruiter_searches 
         WHERE recruiter_id = ? 
         ORDER BY updated_at DESC`,
        [recruiterId]
      );

      // 2. Campaigns
      const [campaigns] = await pool.query(
        `SELECT id, recruiter_id, title, channel, status, opened_count, responded_count, total_sent, created_at, updated_at 
         FROM hr_campaigns 
         WHERE recruiter_id = ? 
         ORDER BY updated_at DESC`,
        [recruiterId]
      );

      // 3. Real jobs posted by recruiter
      const [jobRows] = await pool.query(
        `SELECT jp.id, jp.job_title, jp.company_name, jp.work_location, jp.openings, jp.is_closed, jp.approval_status, jp.rejection_reason, jp.created_at, jp.min_salary, jp.max_salary, COALESCE(jp.views_count, 0) as views_count,
                (SELECT COUNT(*) FROM applied_jobs aj WHERE aj.postId = jp.id) as applications_count
         FROM job_post jp 
         WHERE jp.user_id = ? 
         ORDER BY jp.id DESC 
         LIMIT 12`,
        [recruiterId]
      );

      const jobIds = jobRows.map(j => j.id);
      let applicantsByJob = {};

      if (jobIds.length > 0) {
        try {
          const [appRows] = await pool.query(
            `SELECT 
               aj.id as applied_id,
               aj.postId as job_id,
               aj.created_at as applied_date,
               aj.status as applied_status,
               u.id as candidate_id,
               u.first_name,
               u.last_name,
               u.profile_image,
               u.location,
               u.total_years,
               u.total_months,
               u.course
             FROM applied_jobs aj
             JOIN users u ON aj.userId = u.id
             WHERE aj.postId IN (?)
             ORDER BY aj.created_at DESC`,
            [jobIds]
          );

          const candidateIds = Array.from(new Set(appRows.map(a => a.candidate_id)));
          let profMap = {};
          if (candidateIds.length > 0) {
            const [profRows] = await pool.query(
              `SELECT user_id, job_title, company_name, designation, currently_working
               FROM user_professional
               WHERE user_id IN (?) AND is_deleted = 0
               ORDER BY currently_working DESC, id DESC`,
              [candidateIds]
            );
            profRows.forEach(p => {
              if (!profMap[p.user_id]) profMap[p.user_id] = p;
            });
          }

          appRows.forEach(a => {
            if (!applicantsByJob[a.job_id]) applicantsByJob[a.job_id] = [];
            const prof = profMap[a.candidate_id];
            const candidateName = `${a.first_name || ''} ${a.last_name || ''}`.trim() || 'Candidate';
            
            let expStr = '';
            if (a.total_years) expStr += `${a.total_years} `;
            if (a.total_months) expStr += `${a.total_months}`;
            expStr = expStr.trim();
            if (!expStr) expStr = 'Fresher';

            const matchedJob = jobRows.find(j => j.id === a.job_id);
            let salaryStr = null;
            if (matchedJob?.min_salary && matchedJob?.max_salary) {
              salaryStr = `₹ ${matchedJob.min_salary} - ${matchedJob.max_salary}`;
            } else if (matchedJob?.min_salary) {
              salaryStr = `₹ ${matchedJob.min_salary}`;
            }

            applicantsByJob[a.job_id].push({
              id: a.candidate_id,
              applied_id: a.applied_id,
              name: candidateName,
              first_name: a.first_name,
              last_name: a.last_name,
              profile_image: a.profile_image,
              location: a.location || 'India',
              experience: expStr,
              designation: prof?.designation || prof?.job_title || a.course || 'Applicant',
              company: prof?.company_name || 'ORGANIC',
              salary: salaryStr,
              applied_date: a.applied_date,
              status: a.applied_status || 'Applied'
            });
          });
        } catch (appErr) {
          console.warn("Could not query applicants for dashboard summary:", appErr.message);
        }
      }

      const enrichedJobs = jobRows.map(job => {
        const apps = applicantsByJob[job.id] || [];
        const appCount = Number(job.applications_count || apps.length || 0);
        const viewsCount = Number(job.views_count || 0);
        return {
          ...job,
          applications_count: appCount,
          views_count: viewsCount,
          applicants: apps
        };
      });

      // Identify company recruiter IDs & sub-recruiter profile
      let companyRecruiterIds = [recruiterId];
      let effectiveRecruiterId = recruiterId;
      let subRecruiterRecord = null;

      try {
        const [subCheck] = await pool.query(
          `SELECT sr.* FROM sub_recruiters sr WHERE sr.sub_recruiter_id = ? AND sr.status = 'active' LIMIT 1`,
          [recruiterId]
        );
        if (subCheck && subCheck.length > 0) {
          subRecruiterRecord = subCheck[0];
          effectiveRecruiterId = subRecruiterRecord.main_recruiter_id;
          let perms = subRecruiterRecord.permissions;
          if (typeof perms === 'string') {
            try { perms = JSON.parse(perms); } catch (e) { perms = {}; }
          }
          subRecruiterRecord.permissions = perms;
        }

        // Fetch all team recruiter IDs in this company
        const [teamSubs] = await pool.query(
          `SELECT sub_recruiter_id FROM sub_recruiters WHERE main_recruiter_id = ?`,
          [effectiveRecruiterId]
        );
        companyRecruiterIds = [effectiveRecruiterId, ...teamSubs.map(t => t.sub_recruiter_id)];
      } catch (err) {
        console.warn("Sub-recruiter check in dashboard failed:", err.message);
      }

      // Fetch company profile & main recruiter details (so sub-recruiters use the same logo and see parent recruiter indication)
      let companyInfo = {
        company_name: '',
        company_logo: null,
        main_recruiter_name: '',
        main_recruiter_email: '',
        main_recruiter_id: effectiveRecruiterId,
        is_sub_recruiter: Boolean(subRecruiterRecord)
      };


      try {
        const [coRows] = await pool.query(
          `SELECT u.id, u.first_name, u.last_name, u.email, hp.company_name, hp.profile_image 
           FROM users u
           LEFT JOIN hr_profiles hp ON hp.user_id = u.id
           WHERE u.id = ? LIMIT 1`,
          [effectiveRecruiterId]
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
        console.warn("Could not query company info in HrDashboardController:", coErr.message);
      }


      // 1. Company-wide job counts across all recruiters in company
      const [companyJobCountsResult] = await pool.query(
        `SELECT 
           COUNT(*) AS total_jobs,
           SUM(CASE WHEN (is_closed = 0 OR is_closed IS NULL) AND approval_status = 'approved' THEN 1 ELSE 0 END) AS active_jobs,
           SUM(CASE WHEN (is_closed = 0 OR is_closed IS NULL) AND (approval_status = 'pending' OR approval_status IS NULL) THEN 1 ELSE 0 END) AS pending_jobs,
           SUM(CASE WHEN approval_status = 'rejected' THEN 1 ELSE 0 END) AS rejected_jobs,
           SUM(CASE WHEN is_closed = 1 THEN 1 ELSE 0 END) AS closed_jobs
         FROM job_post 
         WHERE user_id IN (?)`,
        [companyRecruiterIds]
      );
      const companyTotalJobs = Number(companyJobCountsResult[0]?.total_jobs || 0);
      const companyActiveJobs = Number(companyJobCountsResult[0]?.active_jobs || 0);
      const companyPendingJobs = Number(companyJobCountsResult[0]?.pending_jobs || 0);
      const companyRejectedJobs = Number(companyJobCountsResult[0]?.rejected_jobs || 0);
      const companyClosedJobs = Number(companyJobCountsResult[0]?.closed_jobs || 0);

      // 2. Personal job counts posted by this logged-in recruiter
      const [personalJobCountsResult] = await pool.query(
        `SELECT 
           COUNT(*) AS total_jobs,
           SUM(CASE WHEN (is_closed = 0 OR is_closed IS NULL) AND approval_status = 'approved' THEN 1 ELSE 0 END) AS active_jobs,
           SUM(CASE WHEN (is_closed = 0 OR is_closed IS NULL) AND (approval_status = 'pending' OR approval_status IS NULL) THEN 1 ELSE 0 END) AS pending_jobs,
           SUM(CASE WHEN approval_status = 'rejected' THEN 1 ELSE 0 END) AS rejected_jobs,
           SUM(CASE WHEN is_closed = 1 THEN 1 ELSE 0 END) AS closed_jobs
         FROM job_post 
         WHERE user_id = ?`,
        [recruiterId]
      );
      const personalTotalJobs = Number(personalJobCountsResult[0]?.total_jobs || 0);
      const personalActiveJobs = Number(personalJobCountsResult[0]?.active_jobs || 0);
      const personalPendingJobs = Number(personalJobCountsResult[0]?.pending_jobs || 0);

      const totalJobs = subRecruiterRecord ? personalTotalJobs : companyTotalJobs;
      const activeJobs = subRecruiterRecord ? personalActiveJobs : companyActiveJobs;
      const pendingJobs = subRecruiterRecord ? personalPendingJobs : companyPendingJobs;
      const rejectedJobs = Number(companyJobCountsResult[0]?.rejected_jobs || 0);
      const closedJobs = Number(companyJobCountsResult[0]?.closed_jobs || 0);

      // Recruiter subscription & plan limits
      let subData = null;

      try {
        const [subRows] = await pool.query(
          `SELECT rs.*, sp.name AS plan_name, sp.job_post_limit, sp.active_job_limit, sp.resume_view_limit, sp.resume_download_limit,
                  COALESCE(sp.email_limit, 50) AS email_limit,
                  COALESCE(sp.whatsapp_limit, 50) AS whatsapp_limit,
                  COALESCE(sp.excel_download_limit, 50) AS excel_download_limit,
                  COALESCE(su.job_posts_used, 0) AS job_posts_used,
                  COALESCE(su.resume_views_used, 0) AS resume_views_used,
                  COALESCE(su.resume_downloads_used, 0) AS resume_downloads_used,
                  COALESCE(su.emails_sent, 0) AS emails_sent,
                  COALESCE(su.whatsapp_messages_sent, 0) AS whatsapp_messages_sent,
                  COALESCE(su.excel_downloads_used, 0) AS excel_downloads_used
           FROM recruiter_subscriptions rs
           INNER JOIN subscription_plans sp ON rs.plan_id = sp.id
           LEFT JOIN subscription_usage su ON rs.id = su.subscription_id
           WHERE rs.recruiter_id = ?
           ORDER BY rs.id DESC LIMIT 1`,
          [effectiveRecruiterId]
        );

        if (subRows && subRows.length > 0) {
          const sub = subRows[0];
          const companyActiveLimit = sub.active_job_limit !== undefined ? Number(sub.active_job_limit) : 3;
          const companyPostLimit = sub.job_post_limit !== undefined ? Number(sub.job_post_limit) : 5;
          const companyPostsUsed = Math.max(Number(sub.job_posts_used || 0), companyTotalJobs);

          const companyActiveLimitReached = companyActiveLimit > 0 && companyActiveJobs >= companyActiveLimit;
          const companyPostLimitReached = companyPostLimit > 0 && companyPostsUsed >= companyPostLimit;
          const companyRemainingActive = Math.max(0, companyActiveLimit - companyActiveJobs);
          const companyRemainingPosts = Math.max(0, companyPostLimit - companyPostsUsed);

          if (subRecruiterRecord) {
            // Sub-recruiter: personal quotas are bounded by both split allocation AND parent company capacity
            const subPerms = subRecruiterRecord.permissions || {};
            const quotaMode = subPerms.quota_mode || 'shared';

            const subPostLimit = quotaMode === 'split' ? Number(subPerms.allocated_job_posts || 0) : companyPostLimit;
            const subPostsUsed = quotaMode === 'split' ? Number(subPerms.used_job_posts || personalTotalJobs || 0) : companyPostsUsed;
            const subRemainingQuota = Math.max(0, subPostLimit - subPostsUsed);

            // Cannot have more available active slots or posts than the company plan itself has remaining!
            const effectiveActiveLimit = Math.min(companyActiveLimit, subPostLimit);
            const effectiveActiveRemaining = Math.min(subRemainingQuota, companyRemainingActive);
            const effectivePostsRemaining = Math.min(subRemainingQuota, companyRemainingPosts);

            const isLimitReached = (subRemainingQuota <= 0) || companyActiveLimitReached || companyPostLimitReached;

            let limitReason = null;
            if (companyActiveLimitReached) {
              limitReason = `Company active job limit reached (${companyActiveJobs}/${companyActiveLimit} active slots used). You cannot post new jobs until an active job is closed or the primary recruiter upgrades the plan.`;
            } else if (companyPostLimitReached) {
              limitReason = `Company monthly job quota reached (${companyPostsUsed}/${companyPostLimit} jobs used). Job posting is locked until the next billing cycle or plan upgrade.`;
            } else if (subRemainingQuota <= 0) {
              limitReason = `Your assigned split job quota is exhausted (${subPostsUsed}/${subPostLimit} jobs used).`;
            }

            subData = {
              id: sub.id,
              plan_name: sub.plan_name || 'Basic',
              status: sub.status || 'Active',
              expiry_date: sub.expiry_date,
              billing_cycle: sub.billing_cycle || 'monthly',
              is_sub_recruiter: true,
              role_preset: subRecruiterRecord?.role_preset || null,
              designation: subRecruiterRecord?.designation || null,
              permissions: subRecruiterRecord?.permissions || null,

              // Company pool metrics
              company_active_limit: companyActiveLimit,
              company_active_jobs: companyActiveJobs,
              company_active_limit_reached: companyActiveLimitReached,
              company_post_limit: companyPostLimit,
              company_posts_used: companyPostsUsed,
              company_post_limit_reached: companyPostLimitReached,
              company_pending_jobs: companyPendingJobs,

              // Sub-recruiter split & restricted capacity
              active_job_limit: effectiveActiveLimit,
              active_jobs_count: personalActiveJobs,
              active_jobs_remaining: effectiveActiveRemaining,
              active_limit_reached: isLimitReached,
              job_post_limit: subPostLimit,
              job_posts_used: subPostsUsed,
              job_posts_remaining: effectivePostsRemaining,
              post_limit_reached: isLimitReached,
              can_post_jobs: subPerms.can_post_jobs !== false && !isLimitReached,
              limit_reason: limitReason,
              pending_jobs_count: personalPendingJobs,

              resume_view_limit: quotaMode === 'split' ? Number(subPerms.allocated_resume_views || 0) : (sub.resume_view_limit || 50),
              resume_views_used: quotaMode === 'split' ? Number(subPerms.used_resume_views || 0) : (sub.resume_views_used || 0),
              resume_download_limit: quotaMode === 'split' ? Number(subPerms.allocated_resume_downloads || 0) : (sub.resume_download_limit || 10),
              resume_downloads_used: quotaMode === 'split' ? Number(subPerms.used_resume_downloads || 0) : (sub.resume_downloads_used || 0)
            };
          } else {
            // Main recruiter
            const activeRemaining = companyActiveLimit > 0 ? Math.max(0, companyActiveLimit - companyActiveJobs) : 999;
            const postsRemaining = companyPostLimit > 0 ? Math.max(0, companyPostLimit - companyPostsUsed) : 999;

            subData = {
              id: sub.id,
              plan_name: sub.plan_name || 'Basic',
              status: sub.status || 'Active',
              expiry_date: sub.expiry_date,
              billing_cycle: sub.billing_cycle || 'monthly',
              is_sub_recruiter: false,
              role_preset: 'admin',
              designation: 'Primary Recruiter',
              permissions: null,
              active_job_limit: companyActiveLimit,
              active_jobs_count: companyActiveJobs,
              active_jobs_remaining: activeRemaining,
              active_limit_reached: companyActiveLimitReached,
              job_post_limit: companyPostLimit,
              job_posts_used: companyPostsUsed,
              job_posts_remaining: postsRemaining,
              post_limit_reached: companyPostLimitReached,
              pending_jobs_count: companyPendingJobs,
              resume_view_limit: sub.resume_view_limit || 50,
              resume_views_used: sub.resume_views_used || 0,
              resume_download_limit: sub.resume_download_limit || 10,
              resume_downloads_used: sub.resume_downloads_used || 0,
              email_limit: sub.email_limit || 50,
              whatsapp_limit: sub.whatsapp_limit || 50,
              excel_download_limit: sub.excel_download_limit || 50,
              excel_downloads_used: sub.excel_downloads_used || 0
            };
          }
        }
      } catch (subErr) {
        console.warn("Could not query recruiter subscription:", subErr.message);
      }

      if (!subData) {
        const activeLimit = 3;
        const postLimit = 5;
        const postsUsed = totalJobs;
        subData = {
          plan_name: 'Basic',
          status: 'Active',
          expiry_date: null,
          billing_cycle: 'monthly',
          active_job_limit: activeLimit,
          active_jobs_count: activeJobs,
          active_jobs_remaining: Math.max(0, activeLimit - activeJobs),
          active_limit_reached: activeJobs >= activeLimit,
          job_post_limit: postLimit,
          job_posts_used: postsUsed,
          job_posts_remaining: Math.max(0, postLimit - postsUsed),
          post_limit_reached: postsUsed >= postLimit,
          pending_jobs_count: pendingJobs,
          resume_view_limit: 50,
          resume_views_used: 0,
          resume_download_limit: 10,
          resume_downloads_used: 0
        };
      }

      // 4. Candidate folders & downloads
      const [folders] = await pool.query(
        `SELECT cf.id, cf.name, cf.folder_type, cf.color, cf.description, cf.created_at, cf.updated_at,
                jp.job_title as linked_job_title,
                (SELECT COUNT(*) FROM candidate_folder_items cfi WHERE cfi.folder_id = cf.id) as candidate_count,
                (SELECT COUNT(*) FROM candidate_folder_items cfi JOIN users u ON cfi.candidate_id = u.id WHERE cfi.folder_id = cf.id AND u.resume IS NOT NULL AND u.resume != '') as resume_count
         FROM candidate_folders cf 
         LEFT JOIN job_post jp ON cf.job_id = jp.id
         WHERE cf.recruiter_id = ? AND (cf.is_archived = 0 OR cf.is_archived IS NULL)
         ORDER BY cf.updated_at DESC`,
        [recruiterId]
      );

      const [candidateRows] = await pool.query(
        `SELECT 
           cfi.id as item_id,
           cfi.folder_id,
           cf.name as folder_name,
           cfi.stage,
           cfi.created_at as added_at,
           u.id as candidate_id,
           u.first_name,
           u.last_name,
           u.email,
           u.phone,
           u.profile_image,
           u.resume,
           u.location,
           u.total_years,
           u.total_months,
           u.course
         FROM candidate_folder_items cfi
         JOIN candidate_folders cf ON cfi.folder_id = cf.id
         JOIN users u ON cfi.candidate_id = u.id
         WHERE cf.recruiter_id = ?
         ORDER BY cfi.created_at DESC`,
        [recruiterId]
      );

      const fCandidateIds = Array.from(new Set(candidateRows.map(c => c.candidate_id)));
      let fProfMap = {};
      if (fCandidateIds.length > 0) {
        try {
          const [fProfRows] = await pool.query(
            `SELECT user_id, job_title, company_name, designation, currently_working
             FROM user_professional
             WHERE user_id IN (?) AND is_deleted = 0
             ORDER BY currently_working DESC, id DESC`,
            [fCandidateIds]
          );
          fProfRows.forEach(p => {
            if (!fProfMap[p.user_id]) fProfMap[p.user_id] = p;
          });
        } catch (e) {
          console.warn("Could not query user_professional for folder candidates:", e.message);
        }
      }

      const enrichedCandidates = candidateRows.map(c => {
        const prof = fProfMap[c.candidate_id];
        let expStr = '';
        if (c.total_years) expStr += `${c.total_years} `;
        if (c.total_months) expStr += `${c.total_months}`;
        expStr = expStr.trim();
        if (!expStr) expStr = 'Fresher';

        return {
          id: c.candidate_id,
          item_id: c.item_id,
          folder_id: c.folder_id,
          folder_name: c.folder_name,
          name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Candidate',
          first_name: c.first_name,
          last_name: c.last_name,
          email: c.email,
          phone: c.phone,
          profile_image: c.profile_image,
          resume: c.resume,
          has_resume: Boolean(c.resume && String(c.resume).trim() !== ''),
          stage: c.stage || 'prospect',
          location: c.location || 'India',
          experience: expStr,
          designation: prof?.designation || prof?.job_title || c.course || 'Candidate',
          company: prof?.company_name || 'Individual',
          added_at: c.added_at
        };
      });

      const totalFolders = folders.length;
      const totalDownloads = folders.reduce((sum, f) => sum + (f.candidate_count || 0), 0);
      const totalResumes = enrichedCandidates.filter(c => c.has_resume).length;

      // 5. Credits breakdown
      let [creditRows] = await pool.query(
        `SELECT * FROM hr_credits_breakdown WHERE recruiter_id = ? LIMIT 1`,
        [recruiterId]
      );

      let creditsData = creditRows[0];
      if (!creditsData) {
        creditsData = {
          profile_usage_used: 45300,
          profile_usage_total: 720000,
          profile_views: 1300,
          excel_downloads: subData?.excel_downloads_used !== undefined ? subData.excel_downloads_used : totalDownloads,
          job_posting_used: subData.job_posts_used,
          job_posting_total: subData.job_post_limit,
          jobs_posted: totalJobs,
          outreach_used: 1400000,
          outreach_total: 10800000,
          email_count: 0,
          whatsapp_count: 0,
          sms_count: 0,
          email_limit: subData.email_limit || 50,
          whatsapp_limit: subData.whatsapp_limit || 50,
          excel_download_limit: subData.excel_download_limit || 50
        };
      } else {
        // Sync real-time dynamic jobs posted, limits & downloads counts
        creditsData.jobs_posted = totalJobs;
        creditsData.excel_downloads = subData?.excel_downloads_used !== undefined ? subData.excel_downloads_used : totalDownloads;
        creditsData.job_posting_used = subData.job_posts_used;
        creditsData.job_posting_total = subData.job_post_limit;
        creditsData.email_limit = subData.email_limit || 50;
        creditsData.whatsapp_limit = subData.whatsapp_limit || 50;
        creditsData.excel_download_limit = subData.excel_download_limit || 50;
      }

      return res.status(200).json({
        success: true,
        data: {
          company: companyInfo,
          searches: {
            recent: searches.filter(s => s.search_type === 'recent'),
            saved: searches.filter(s => s.search_type === 'saved')
          },
          jobs: {
            list: enrichedJobs,
            total: totalJobs,
            active: activeJobs,
            pending: pendingJobs,
            rejected: rejectedJobs,
            closed: closedJobs
          },
          subscription: subData,
          campaigns: campaigns,
          credits: creditsData,
          downloads: {
            folders: folders,
            candidates: enrichedCandidates,
            totalFolders: totalFolders,
            totalDownloads: totalDownloads,
            totalResumes: totalResumes
          }
        }
      });
    } catch (error) {
      console.error("Error in getDashboardSummary:", error);
      return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
  },

  // Save new search to recent or saved
  saveSearch: async (req, res) => {
    try {
      const recruiterId = req.user?.id || req.body.recruiter_id;
      if (!recruiterId) {
        return res.status(400).json({ success: false, message: "Recruiter ID is required" });
      }
      const { query_title, query_params, search_type = 'recent' } = req.body;

      if (!query_title) {
        return res.status(400).json({ success: false, message: "Search title/query is required" });
      }

      // Check if duplicate exists for this recruiter
      const [existing] = await pool.query(
        `SELECT id FROM recruiter_searches WHERE recruiter_id = ? AND query_title = ? AND search_type = ?`,
        [recruiterId, query_title, search_type]
      );

      if (existing.length > 0) {
        await pool.query(
          `UPDATE recruiter_searches SET updated_at = CURRENT_TIMESTAMP, query_params = ? WHERE id = ?`,
          [query_params ? JSON.stringify(query_params) : null, existing[0].id]
        );
        return res.status(200).json({ success: true, message: "Search updated", id: existing[0].id });
      }

      const [result] = await pool.query(
        `INSERT INTO recruiter_searches (recruiter_id, search_type, query_title, query_params) VALUES (?, ?, ?, ?)`,
        [recruiterId, search_type, query_title, query_params ? JSON.stringify(query_params) : null]
      );

      return res.status(201).json({ success: true, message: "Search saved", id: result.insertId });
    } catch (error) {
      console.error("Error saving search:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // Delete a specific search by ID or title
  deleteSearch: async (req, res) => {
    try {
      const searchId = req.params.id;
      const recruiterId = req.user?.id || req.body.recruiter_id || parseInt(req.query.recruiter_id, 10);
      if (!recruiterId) {
        return res.status(400).json({ success: false, message: "Recruiter ID is required" });
      }
      await pool.query(
        `DELETE FROM recruiter_searches WHERE (id = ? OR query_title = ?) AND recruiter_id = ?`,
        [searchId, searchId, recruiterId]
      );
      return res.status(200).json({ success: true, message: "Search deleted successfully" });
    } catch (error) {
      console.error("Error deleting search:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // Clear all searches for a recruiter (e.g. search_type = 'recent' | 'saved')
  clearSearches: async (req, res) => {
    try {
      const recruiterId = req.user?.id || parseInt(req.query.recruiter_id, 10);
      if (!recruiterId) {
        return res.status(400).json({ success: false, message: "Recruiter ID is required" });
      }
      const searchType = req.query.search_type;
      if (searchType) {
        await pool.query(
          `DELETE FROM recruiter_searches WHERE recruiter_id = ? AND search_type = ?`,
          [recruiterId, searchType]
        );
      } else {
        await pool.query(
          `DELETE FROM recruiter_searches WHERE recruiter_id = ?`,
          [recruiterId]
        );
      }
      return res.status(200).json({ success: true, message: "Searches cleared successfully" });
    } catch (error) {
      console.error("Error clearing searches:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // Get campaigns list
  getCampaigns: async (req, res) => {
    try {
      const recruiterId = req.user?.id || parseInt(req.query.recruiter_id, 10) || 2;
      const [campaigns] = await pool.query(
        `SELECT * FROM hr_campaigns WHERE recruiter_id = ? ORDER BY updated_at DESC`,
        [recruiterId]
      );
      return res.status(200).json({ success: true, data: campaigns });
    } catch (error) {
      console.error("Error in getCampaigns:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // Get credits breakdown
  getCredits: async (req, res) => {
    try {
      const recruiterId = req.user?.id || parseInt(req.query.recruiter_id, 10) || 2;
      const [rows] = await pool.query(
        `SELECT * FROM hr_credits_breakdown WHERE recruiter_id = ? LIMIT 1`,
        [recruiterId]
      );
      return res.status(200).json({ success: true, data: rows[0] || null });
    } catch (error) {
      console.error("Error in getCredits:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
};

module.exports = HrDashboardController;
