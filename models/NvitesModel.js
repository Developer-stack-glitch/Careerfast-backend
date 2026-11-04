const pool = require("../config/dbConfig");
const EmailModel = require("./EmailModel");
const JobsModel = require("./JobsModel");
const admin = require("../config/firebase");

const NvitesModel = {
  /**
   * ⚡ Send Nvites to one or multiple candidates
   */
  sendNvites: async ({
    recruiterId,
    jobId,
    candidateIds = [],
    subject = "",
    message = "",
    templateType = "standard",
    shareContact = 1,
    validityDays = 14,
  }) => {
    if (!recruiterId) {
      throw new Error("Recruiter ID is required");
    }
    if (!jobId) {
      throw new Error("Job ID is required");
    }
    if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
      throw new Error("At least one candidate must be selected");
    }

    // 1. Fetch Job Details
    const [jobRows] = await pool.query(
      `SELECT id, user_id, job_title, job_nature, company_name, company_logo,
              workplace_type, work_location, skills, experience_required,
              min_salary, max_salary, currency, salary_type, is_closed
       FROM job_post WHERE id = ?`,
      [jobId]
    );

    if (jobRows.length === 0) {
      throw new Error("Selected job posting was not found");
    }
    const job = jobRows[0];

    // 2. Fetch Recruiter Profile
    const [recruiterRows] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.organization,
              u.profile_image, COALESCE(hp.company_name, u.organization) AS company_name
       FROM users u
       LEFT JOIN hr_profiles hp ON u.id = hp.user_id
       WHERE u.id = ?`,
      [recruiterId]
    );
    const recruiter = recruiterRows[0] || {};
    const recruiterName = `${recruiter.first_name || ""} ${recruiter.last_name || ""}`.trim() || "Hiring Lead";
    const companyName = job.company_name || recruiter.company_name || recruiter.organization || "Top Employer";

    const validity = Math.max(1, Math.min(60, parseInt(validityDays, 10) || 14));
    const results = [];
    const alreadyInvited = [];

    for (const candId of candidateIds) {
      // Check if candidate exists
      const [candRows] = await pool.query(
        `SELECT id, first_name, last_name, email, phone, fcm_token, skills FROM users WHERE id = ?`,
        [candId]
      );
      if (candRows.length === 0) continue;
      const candidate = candRows[0];
      const candidateName = `${candidate.first_name || ""} ${candidate.last_name || ""}`.trim() || "Candidate";

      // Check if candidate has an active invite for this job
      const [existing] = await pool.query(
        `SELECT id, status, expires_at FROM job_nvites
         WHERE job_id = ? AND candidate_id = ? AND recruiter_id = ?
         ORDER BY id DESC LIMIT 1`,
        [jobId, candId, recruiterId]
      );

      let nviteId = null;
      if (existing.length > 0 && (existing[0].status === "sent" || existing[0].status === "viewed")) {
        // If active invite exists within validity, mark as re-sent / refresh expiry
        nviteId = existing[0].id;
        await pool.query(
          `UPDATE job_nvites 
           SET subject = ?, message = ?, template_type = ?, share_contact = ?,
               expires_at = DATE_ADD(NOW(), INTERVAL ? DAY), status = 'sent', updated_at = NOW()
           WHERE id = ?`,
          [subject, message, templateType, shareContact ? 1 : 0, validity, nviteId]
        );
      } else {
        // Insert new Nvite record
        const [insertRes] = await pool.query(
          `INSERT INTO job_nvites 
           (recruiter_id, job_id, candidate_id, subject, message, template_type, share_contact, expires_at, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY), 'sent')`,
          [recruiterId, jobId, candId, subject, message, templateType, shareContact ? 1 : 0, validity]
        );
        nviteId = insertRes.insertId;
      }

      // Personalized email dispatch
      let personalizedMsg = message;
      if (personalizedMsg) {
        personalizedMsg = personalizedMsg
          .replace(/{candidate_name}/gi, candidateName)
          .replace(/{job_title}/gi, job.job_title || "")
          .replace(/{company_name}/gi, companyName)
          .replace(/{location}/gi, job.work_location || "our offices");
      }

      const formattedSubject = subject
        ? subject
            .replace(/{candidate_name}/gi, candidateName)
            .replace(/{job_title}/gi, job.job_title || "")
            .replace(/{company_name}/gi, companyName)
        : `⚡ Job Nvite: ${job.job_title} at ${companyName}`;

      if (candidate.email) {
        // Non-blocking email send
        EmailModel.sendJobNviteEmail({
          candidateEmail: candidate.email,
          candidateName,
          recruiterName,
          recruiterEmail: shareContact ? recruiter.email : "",
          recruiterPhone: shareContact ? recruiter.phone : "",
          companyName,
          companyLogo: job.company_logo || "",
          jobTitle: job.job_title,
          jobNature: job.job_nature || "Full Time",
          location: job.work_location || "Flexible",
          workplaceType: job.workplace_type || "Onsite",
          minSalary: job.min_salary,
          maxSalary: job.max_salary,
          currency: job.currency || "₹",
          salaryType: job.salary_type || "Per Annum",
          experienceRequired: job.experience_required,
          skills: job.skills,
          customMessage: personalizedMsg,
          validityDays: validity,
          nviteId,
          jobId: job.id,
        }).catch((err) => {
          console.error(`Error sending Nvite email to candidate #${candId}:`, err);
        });
      }

      // Send Push Notification if FCM token exists
      if (candidate.fcm_token) {
        try {
          admin.messaging().send({
            notification: {
              title: `⚡ Job Nvite from ${companyName}`,
              body: `${recruiterName} invited you to apply for ${job.job_title}!`,
            },
            webpush: {
              notification: { icon: "/favicon.png", requireInteraction: true },
              fcm_options: {
                link: `https://careerfast.in/candidate-profile/invites?nviteId=${nviteId}`,
              },
            },
            token: candidate.fcm_token,
          }).catch(() => {});
        } catch (e) {
          // Push notification non-fatal
        }
      }

      results.push({
        candidateId: candId,
        candidateName,
        email: candidate.email,
        nviteId,
      });
    }

    return {
      success: true,
      message: `Successfully sent Nvite to ${results.length} candidate(s)!`,
      sentCount: results.length,
      recipients: results,
    };
  },

  /**
   * 📊 Get Recruiter's Sent Nvites with metrics and filtering
   */
  getRecruiterNvites: async (recruiterId, options = {}) => {
    const { status = "all", jobId = null, search = "", page = 1, limit = 20 } = options;

    const offset = Math.max(0, (parseInt(page, 10) - 1) * parseInt(limit, 10));
    const pageLimit = Math.max(1, parseInt(limit, 10));

    // Auto-expire past Nvites
    await pool.query(
      `UPDATE job_nvites 
       SET status = 'expired' 
       WHERE expires_at < NOW() AND status IN ('sent', 'viewed') AND recruiter_id = ?`,
      [recruiterId]
    );

    // Compute status stats for recruiter
    const [statsRows] = await pool.query(
      `SELECT 
         COUNT(*) AS total,
         SUM(CASE WHEN status IN ('sent', 'viewed') THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status = 'viewed' THEN 1 ELSE 0 END) AS viewed,
         SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) AS accepted,
         SUM(CASE WHEN status = 'declined' THEN 1 ELSE 0 END) AS declined,
         SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) AS expired
       FROM job_nvites
       WHERE recruiter_id = ?`,
      [recruiterId]
    );

    const stats = {
      total: Number(statsRows[0]?.total || 0),
      pending: Number(statsRows[0]?.pending || 0),
      viewed: Number(statsRows[0]?.viewed || 0),
      accepted: Number(statsRows[0]?.accepted || 0),
      declined: Number(statsRows[0]?.declined || 0),
      expired: Number(statsRows[0]?.expired || 0),
    };

    // Build filter query
    let whereClauses = ["n.recruiter_id = ?"];
    let params = [recruiterId];

    if (status && status !== "all") {
      if (status === "pending") {
        whereClauses.push("n.status IN ('sent', 'viewed')");
      } else {
        whereClauses.push("n.status = ?");
        params.push(status);
      }
    }

    if (jobId && jobId !== "all") {
      whereClauses.push("n.job_id = ?");
      params.push(jobId);
    }

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      whereClauses.push(
        "(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR jp.job_title LIKE ?)"
      );
      params.push(s, s, s, s);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // Count total filtered
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM job_nvites n
       INNER JOIN users u ON n.candidate_id = u.id
       INNER JOIN job_post jp ON n.job_id = jp.id
       ${whereSql}`,
      params
    );
    const totalCount = countRows[0]?.total || 0;

    // Fetch paginated data
    const [rows] = await pool.query(
      `SELECT 
         n.id,
         n.recruiter_id,
         n.job_id,
         n.candidate_id,
         n.subject,
         n.message,
         n.template_type,
         n.share_contact,
         n.expires_at,
         n.status,
         n.decline_reason,
         n.decline_note,
         n.viewed_at,
         n.responded_at,
         n.created_at,
         n.updated_at,
         u.first_name AS candidate_first_name,
         u.last_name AS candidate_last_name,
         u.email AS candidate_email,
         u.phone AS candidate_phone,
         u.phone_code AS candidate_phone_code,
         u.profile_image AS candidate_profile_image,
         u.total_years,
         u.total_months,
         u.skills AS candidate_skills,
         u.resume AS candidate_resume,
         u.user_type AS candidate_user_type,
         jp.job_title,
         jp.company_name,
         jp.work_location,
         jp.workplace_type,
         jp.experience_required,
         jp.min_salary,
         jp.max_salary,
         jp.currency,
         jp.salary_type,
         jp.job_nature,
         jp.is_closed
       FROM job_nvites n
       INNER JOIN users u ON n.candidate_id = u.id
       INNER JOIN job_post jp ON n.job_id = jp.id
       ${whereSql}
       ORDER BY n.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageLimit, offset]
    );

    const formattedData = rows.map((r) => {
      let candidateSkills = [];
      try {
        if (Array.isArray(r.candidate_skills)) {
          candidateSkills = r.candidate_skills;
        } else if (typeof r.candidate_skills === "string") {
          candidateSkills = JSON.parse(r.candidate_skills);
        }
      } catch (e) {
        candidateSkills = r.candidate_skills ? String(r.candidate_skills).split(",") : [];
      }

      return {
        ...r,
        candidate_name: `${r.candidate_first_name || ""} ${r.candidate_last_name || ""}`.trim() || "Candidate",
        candidate_skills: Array.isArray(candidateSkills) ? candidateSkills : [],
      };
    });

    return {
      success: true,
      data: formattedData,
      total: totalCount,
      page: parseInt(page, 10),
      limit: pageLimit,
      stats,
    };
  },

  /**
   * 📬 Get Candidate's Received Nvites
   */
  getCandidateNvites: async (candidateId, options = {}) => {
    const { status = "all", page = 1, limit = 20 } = options;
    const offset = Math.max(0, (parseInt(page, 10) - 1) * parseInt(limit, 10));
    const pageLimit = Math.max(1, parseInt(limit, 10));

    // Auto-expire past Nvites
    await pool.query(
      `UPDATE job_nvites 
       SET status = 'expired' 
       WHERE expires_at < NOW() AND status IN ('sent', 'viewed') AND candidate_id = ?`,
      [candidateId]
    );

    let whereClauses = ["n.candidate_id = ?"];
    let params = [candidateId];

    if (status && status !== "all") {
      if (status === "pending") {
        whereClauses.push("n.status IN ('sent', 'viewed')");
      } else {
        whereClauses.push("n.status = ?");
        params.push(status);
      }
    }

    const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

    // Total count
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM job_nvites n ${whereSql}`,
      params
    );
    const totalCount = countRows[0]?.total || 0;

    // Count pending
    const [pendingCountRows] = await pool.query(
      `SELECT COUNT(*) AS pending FROM job_nvites WHERE candidate_id = ? AND status IN ('sent', 'viewed')`,
      [candidateId]
    );
    const pendingCount = pendingCountRows[0]?.pending || 0;

    // Fetch data
    const [rows] = await pool.query(
      `SELECT 
         n.id,
         n.recruiter_id,
         n.job_id,
         n.candidate_id,
         n.subject,
         n.message,
         n.template_type,
         n.share_contact,
         n.expires_at,
         n.status,
         n.decline_reason,
         n.decline_note,
         n.viewed_at,
         n.responded_at,
         n.created_at,
         jp.job_title,
         jp.company_name,
         jp.company_logo,
         jp.work_location,
         jp.workplace_type,
         jp.job_nature,
         jp.duration_period,
         jp.experience_required,
         jp.min_salary,
         jp.max_salary,
         jp.currency,
         jp.salary_type,
         jp.skills AS job_skills,
         jp.job_description,
         jp.openings,
         jp.is_closed,
         r.first_name AS recruiter_first_name,
         r.last_name AS recruiter_last_name,
         r.email AS recruiter_email,
         r.phone AS recruiter_phone,
         r.organization AS recruiter_company,
         r.profile_image AS recruiter_avatar,
         (SELECT COUNT(*) FROM applied_jobs aj WHERE aj.postId = jp.id AND aj.userId = n.candidate_id) AS has_applied
       FROM job_nvites n
       INNER JOIN job_post jp ON n.job_id = jp.id
       LEFT JOIN users r ON n.recruiter_id = r.id
       ${whereSql}
       ORDER BY n.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageLimit, offset]
    );

    const formattedData = rows.map((r) => {
      let jobSkills = [];
      try {
        if (Array.isArray(r.job_skills)) {
          jobSkills = r.job_skills;
        } else if (typeof r.job_skills === "string") {
          jobSkills = JSON.parse(r.job_skills);
        }
      } catch (e) {
        jobSkills = r.job_skills ? String(r.job_skills).split(",") : [];
      }

      return {
        ...r,
        recruiter_name: `${r.recruiter_first_name || ""} ${r.recruiter_last_name || ""}`.trim() || "Recruiter",
        job_skills: Array.isArray(jobSkills) ? jobSkills : [],
        has_applied: Number(r.has_applied || 0) > 0,
      };
    });

    return {
      success: true,
      data: formattedData,
      total: totalCount,
      pendingCount,
      page: parseInt(page, 10),
      limit: pageLimit,
    };
  },

  /**
   * 👁️ Mark Nvite as viewed by candidate
   */
  markNviteViewed: async (nviteId, candidateId) => {
    await pool.query(
      `UPDATE job_nvites 
       SET status = 'viewed', viewed_at = NOW() 
       WHERE id = ? AND candidate_id = ? AND status = 'sent'`,
      [nviteId, candidateId]
    );
    return { success: true };
  },

  /**
   * ✅ Candidate accepts Nvite: automatically applies candidate to job & notifies recruiter!
   */
  acceptNvite: async (nviteId, candidateId) => {
    const [rows] = await pool.query(
      `SELECT n.*, jp.job_title, jp.company_name, u.first_name, u.last_name, r.fcm_token AS recruiter_token, r.id AS recruiter_user_id
       FROM job_nvites n
       INNER JOIN job_post jp ON n.job_id = jp.id
       INNER JOIN users u ON n.candidate_id = u.id
       LEFT JOIN users r ON n.recruiter_id = r.id
       WHERE n.id = ? AND n.candidate_id = ?`,
      [nviteId, candidateId]
    );

    if (rows.length === 0) {
      throw new Error("Job invitation not found or access denied");
    }

    const nvite = rows[0];

    if (nvite.status === "expired") {
      throw new Error("This job invitation has expired.");
    }

    // Update Nvite status to 'accepted'
    await pool.query(
      `UPDATE job_nvites 
       SET status = 'accepted', responded_at = NOW() 
       WHERE id = ?`,
      [nviteId]
    );

    // Apply for the job in applied_jobs table
    let applyResult = null;
    try {
      applyResult = await JobsModel.applyForJob(nvite.job_id, candidateId, []);
    } catch (applyErr) {
      console.warn("Nvite applyForJob notice:", applyErr.message);
    }

    // Notify Recruiter via Firebase Push if token available
    const candidateName = `${nvite.first_name || ""} ${nvite.last_name || ""}`.trim() || "A candidate";
    if (nvite.recruiter_token) {
      try {
        admin.messaging().send({
          notification: {
            title: "⚡ Nvite Accepted! 🎉",
            body: `${candidateName} accepted your Nvite for ${nvite.job_title} and applied!`,
          },
          webpush: {
            notification: { icon: "/favicon.png", requireInteraction: true },
            fcm_options: {
              link: `https://careerfast.in/applicants/${nvite.job_id}`,
            },
          },
          token: nvite.recruiter_token,
        }).catch(() => {});
      } catch (err) {
        // Non-blocking
      }
    }

    return {
      success: true,
      message: `You've accepted the invitation and successfully applied for ${nvite.job_title}!`,
      jobTitle: nvite.job_title,
      companyName: nvite.company_name,
      alreadyApplied: applyResult?.alreadyApplied || false,
    };
  },

  /**
   * ❌ Candidate declines Nvite
   */
  declineNvite: async (nviteId, candidateId, { reason = "", note = "" } = {}) => {
    const [rows] = await pool.query(
      `SELECT id, status FROM job_nvites WHERE id = ? AND candidate_id = ?`,
      [nviteId, candidateId]
    );

    if (rows.length === 0) {
      throw new Error("Job invitation not found or access denied");
    }

    if (rows[0].status === "expired") {
      throw new Error("This job invitation has already expired");
    }

    await pool.query(
      `UPDATE job_nvites 
       SET status = 'declined', decline_reason = ?, decline_note = ?, responded_at = NOW() 
       WHERE id = ?`,
      [reason || "Not specified", note || "", nviteId]
    );

    return {
      success: true,
      message: "You have politely declined this job invitation. Thank you for your response.",
    };
  },

  /**
   * 🔄 Recruiter resends an expired or pending Nvite
   */
  resendNvite: async (nviteId, recruiterId) => {
    const [rows] = await pool.query(
      `SELECT n.*, jp.job_title, jp.job_nature, jp.company_name, jp.work_location, jp.workplace_type,
              jp.min_salary, jp.max_salary, jp.currency, jp.salary_type, jp.experience_required, jp.skills,
              u.email AS candidate_email, u.first_name AS candidate_first_name, u.last_name AS candidate_last_name,
              r.first_name AS recruiter_first_name, r.last_name AS recruiter_last_name, r.email AS recruiter_email, r.phone AS recruiter_phone
       FROM job_nvites n
       INNER JOIN job_post jp ON n.job_id = jp.id
       INNER JOIN users u ON n.candidate_id = u.id
       LEFT JOIN users r ON n.recruiter_id = r.id
       WHERE n.id = ? AND n.recruiter_id = ?`,
      [nviteId, recruiterId]
    );

    if (rows.length === 0) {
      throw new Error("Nvite not found or unauthorized");
    }

    const nvite = rows[0];

    // Reset status to 'sent' and extend expiry by 14 days
    await pool.query(
      `UPDATE job_nvites 
       SET status = 'sent', expires_at = DATE_ADD(NOW(), INTERVAL 14 DAY), updated_at = NOW() 
       WHERE id = ?`,
      [nviteId]
    );

    const candidateName = `${nvite.candidate_first_name || ""} ${nvite.candidate_last_name || ""}`.trim() || "Candidate";
    const recruiterName = `${nvite.recruiter_first_name || ""} ${nvite.recruiter_last_name || ""}`.trim() || "Hiring Lead";

    // Resend email
    if (nvite.candidate_email) {
      EmailModel.sendJobNviteEmail({
        candidateEmail: nvite.candidate_email,
        candidateName,
        recruiterName,
        recruiterEmail: nvite.share_contact ? nvite.recruiter_email : "",
        recruiterPhone: nvite.share_contact ? nvite.recruiter_phone : "",
        companyName: nvite.company_name || "Top Employer",
        companyLogo: "",
        jobTitle: nvite.job_title,
        jobNature: nvite.job_nature || "Full Time",
        location: nvite.work_location || "Flexible",
        workplaceType: nvite.workplace_type || "Onsite",
        minSalary: nvite.min_salary,
        maxSalary: nvite.max_salary,
        currency: nvite.currency || "₹",
        salaryType: nvite.salary_type || "Per Annum",
        experienceRequired: nvite.experience_required,
        skills: nvite.skills,
        customMessage: nvite.message,
        validityDays: 14,
        nviteId: nvite.id,
        jobId: nvite.job_id,
      }).catch((e) => console.error("Error resending Nvite email:", e));
    }

    return {
      success: true,
      message: "Nvite resent successfully!",
    };
  },
};

module.exports = NvitesModel;

