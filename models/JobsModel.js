const pool = require("../config/dbConfig");
const dayjs = require("dayjs");
const relativeTime = require("dayjs/plugin/relativeTime");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);

// In-memory caches for high-traffic homepage and catalog endpoints
let homePageStatsCache = null;
let homePageStatsCacheTime = 0;
const STATS_CACHE_TTL = 60 * 1000; // 60s

let trendingSearchesCache = null;
let trendingSearchesCacheTime = 0;
const TRENDING_CACHE_TTL = 5 * 60 * 1000; // 5m

const categoriesCache = new Map();
const CATEGORIES_CACHE_TTL = 5 * 60 * 1000; // 5m

const jobPostsCache = new Map();
const JOB_POSTS_CACHE_TTL = 60 * 1000; // 60s

const adminStatsCache = new Map();
const ADMIN_STATS_CACHE_TTL = 30 * 1000; // 30s cache for admin stats to make tab switches and pagination instant

const clearAdminStatsCache = () => {
  adminStatsCache.clear();
};

const JobsModel = {
  insertJobNature: async (nature_name) => {
    try {
      const [isExists] = await pool.query(
        `SELECT id FROM job_nature WHERE name = ? AND is_active = 1`,
        nature_name
      );
      if (isExists.length > 0) throw new Error("Job nature is already exists");
      const [result] = await pool.query(
        `INSERT INTO job_nature(name) VALUES(?)`,
        nature_name
      );
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },
  getJobNature: async () => {
    try {
      const [natures] = await pool.query(
        `SELECT id, name FROM job_nature WHERE is_active = 1 ORDER BY id`
      );

      return natures;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  insertWorkPlaceType: async (workplace) => {
    try {
      const [isExists] = await pool.query(
        `SELECT id FROM workplace_type WHERE name = ? AND is_active = 1`,
        workplace
      );
      if (isExists.length > 0) throw new Error("Workplace is already exists");
      const [result] = await pool.query(
        `INSERT INTO workplace_type(name) VALUES(?)`,
        workplace
      );
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getWorkplaceType: async () => {
    try {
      const [natures] = await pool.query(
        `SELECT id, name FROM workplace_type WHERE is_active = 1 ORDER BY id`
      );

      return natures;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getWorklocation: async () => {
    try {
      const [locations] = await pool.query(
        `SELECT id, name FROM work_location WHERE is_active = 1 ORDER BY id`
      );

      return locations;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getInternshipDuration: async () => {
    try {
      const [durationTypes] = await pool.query(
        `SELECT id, name FROM internship_duration WHERE is_active = 1 ORDER BY id`
      );

      return durationTypes;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getDurationPeriod: async (duration_type_id) => {
    try {

      const [durationPeriod] = await pool.query(
        `SELECT id, duration_type_id, duration FROM duration_period WHERE duration_type_id = ? AND is_active = 1 ORDER BY id`,
        [duration_type_id]
      );

      return durationPeriod;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getBenefits: async () => {
    try {
      const [benefits] = await pool.query(
        `SELECT id, name, logo FROM benefits WHERE is_active = 1 ORDER BY id`
      );

      return benefits;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getGender: async () => {
    try {
      const [genders] = await pool.query(
        `SELECT id, name FROM gender WHERE is_active = 1 ORDER BY id`
      );

      return genders;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getEligibility: async () => {
    try {
      const [eligibility] = await pool.query(
        `SELECT id, name FROM eligibility_type WHERE is_active = 1 ORDER BY id`
      );

      return eligibility;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getSalaryType: async () => {
    try {
      const [salaryType] = await pool.query(
        `SELECT id, name FROM salary_type WHERE is_active = 1 ORDER BY id`
      );

      return salaryType;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  jobPosting: async (
    user_id,
    company_name,
    company_logo,
    about_company,
    job_title,
    job_nature,
    duration_period,
    workplace_type,
    work_location,
    job_category,
    skills,
    experience_type,
    experience_required,
    salary_type,
    currency,
    min_salary,
    max_salary,
    diversity_hiring,
    benefits,
    job_description,
    seo_description,
    openings,
    working_days,
    questions,
    salary_duration,
    role,
    industry,
    employment_type,
    willing_to_relocate,
    hybrid_policy,
    educational_qualification,
    candidate_industry,
    hide_salary,
    languages,
    is_walk_in,
    walk_in_start_date,
    walk_in_end_date,
    walk_in_start_time,
    walk_in_end_time,
    recruiter_name,
    mobile_number,
    venue_address,
    google_maps_url,
    team_members,
    apply_link,
    stipend_type,
    stipend_amount,
    internship_start_type,
    internship_start_date,
    last_date_to_apply
  ) => {
    try {
      const query = `
      INSERT INTO job_post (
        user_id,
        company_name,
        company_logo,
        about_company,
        job_title,
        job_nature,
        duration_period,
        workplace_type,
        work_location,
        job_category,
        skills,
        experience_type,
        experience_required,
        salary_type,
        currency,
        min_salary,
        max_salary,
        diversity_hiring,
        benefits,
        job_description,
        seo_description,
        openings,
        working_days,
        salary_duration,
        role,
        industry,
        employment_type,
        willing_to_relocate,
        hybrid_policy,
        educational_qualification,
        candidate_industry,
        hide_salary,
        languages,
        is_walk_in,
        walk_in_start_date,
        walk_in_end_date,
        walk_in_start_time,
        walk_in_end_time,
        recruiter_name,
        mobile_number,
        venue_address,
        google_maps_url,
        team_members,
        apply_link,
        stipend_type,
        stipend_amount,
        internship_start_type,
        internship_start_date,
        last_date_to_apply
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

      const values = [
        user_id,
        company_name,
        company_logo,
        about_company,
        job_title,
        job_nature,
        JSON.stringify(duration_period),
        workplace_type,
        JSON.stringify(work_location),
        JSON.stringify(job_category),
        JSON.stringify(skills),
        experience_type,
        JSON.stringify(experience_required),
        salary_type,
        currency,
        min_salary,
        max_salary,
        JSON.stringify(diversity_hiring),
        JSON.stringify(benefits),
        job_description,
        seo_description,
        openings,
        working_days,
        salary_duration,
        role,
        industry,
        employment_type,
        willing_to_relocate,
        hybrid_policy,
        JSON.stringify(educational_qualification),
        JSON.stringify(candidate_industry),
        hide_salary ? 1 : 0,
        JSON.stringify(languages),
        is_walk_in ? 1 : 0,
        walk_in_start_date,
        walk_in_end_date,
        walk_in_start_time,
        walk_in_end_time,
        recruiter_name,
        mobile_number,
        venue_address,
        google_maps_url,
        JSON.stringify(team_members),
        apply_link,
        stipend_type,
        stipend_amount,
        internship_start_type,
        internship_start_date,
        last_date_to_apply
      ];

      // Insert new categories into job_categories table if they don't exist
      if (job_category && job_category.length > 0) {
        for (const cat of job_category) {
          const [exists] = await pool.query(
            "SELECT id FROM job_categories WHERE category_name = ?",
            [cat]
          );
          if (exists.length === 0) {
            await pool.query(
              "INSERT INTO job_categories (category_name, is_active) VALUES (?, 1)",
              [cat]
            );
          }
        }
      }

      // Insert new skills into skills table if they don't exist
      if (skills && skills.length > 0) {
        for (const skill of skills) {
          const [exists] = await pool.query(
            "SELECT id FROM skills WHERE name = ?",
            [skill]
          );
          if (exists.length === 0) {
            await pool.query(
              "INSERT INTO skills (name) VALUES (?)",
              [skill]
            );
          }
        }
      }

      const [result] = await pool.query(query, values);

      const lastJobPostId = result.insertId;

      // Insert Questions
      if (questions && questions.length > 0) {
        for (const q of questions) {
          await pool.query(
            `INSERT INTO job_post_questions (post_id, question, isrequired)
           VALUES (?, ?, ?)`,
            [lastJobPostId, q.question, q.isrequired]
          );
        }
      }

      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },



  updateJobPosting: async (
    job_post_id,
    user_id,
    company_name,
    company_logo,
    about_company,
    job_title,
    job_nature,
    duration_period,
    workplace_type,
    work_location,
    job_category,
    skills,
    experience_type,
    experience_required,
    salary_type,
    currency,
    min_salary,
    max_salary,
    diversity_hiring,
    benefits,
    job_description,
    seo_description,
    openings,
    working_days,
    questions,
    salary_duration,
    role,
    industry,
    employment_type,
    willing_to_relocate,
    hybrid_policy,
    educational_qualification,
    candidate_industry,
    hide_salary,
    languages,
    is_walk_in,
    walk_in_start_date,
    walk_in_end_date,
    walk_in_start_time,
    walk_in_end_time,
    recruiter_name,
    mobile_number,
    venue_address,
    google_maps_url,
    team_members,
    apply_link
  ) => {
    try {
      const query = `
      UPDATE job_post SET
        company_name = ?,
        company_logo = ?,
        about_company = ?,
        job_title = ?,
        job_nature = ?,
        duration_period = ?,
        workplace_type = ?,
        work_location = ?,
        job_category = ?,
        skills = ?,
        experience_type = ?,
        experience_required = ?,
        salary_type = ?,
        currency = ?,
        min_salary = ?,
        max_salary = ?,
        diversity_hiring = ?,
        benefits = ?,
        job_description = ?,
        seo_description = ?,
        openings = ?,
        working_days = ?,
        salary_duration = ?,
        role = ?,
        industry = ?,
        employment_type = ?,
        willing_to_relocate = ?,
        hybrid_policy = ?,
        educational_qualification = ?,
        candidate_industry = ?,
        hide_salary = ?,
        languages = ?,
        is_walk_in = ?,
        walk_in_start_date = ?,
        walk_in_end_date = ?,
        walk_in_start_time = ?,
        walk_in_end_time = ?,
        recruiter_name = ?,
        mobile_number = ?,
        venue_address = ?,
        google_maps_url = ?,
        team_members = ?,
        apply_link = ?
      WHERE id = ? AND user_id = ?
    `;

      const values = [
        company_name,
        company_logo,
        about_company,
        job_title,
        job_nature,
        JSON.stringify(duration_period),
        workplace_type,
        JSON.stringify(work_location),
        JSON.stringify(job_category),
        JSON.stringify(skills),
        experience_type,
        JSON.stringify(experience_required),
        salary_type,
        currency,
        min_salary,
        max_salary,
        JSON.stringify(diversity_hiring),
        JSON.stringify(benefits),
        job_description,
        seo_description,
        openings,
        working_days,
        salary_duration,
        role,
        industry,
        employment_type,
        willing_to_relocate,
        hybrid_policy,
        JSON.stringify(educational_qualification),
        JSON.stringify(candidate_industry),
        hide_salary ? 1 : 0,
        JSON.stringify(languages),
        is_walk_in ? 1 : 0,
        walk_in_start_date,
        walk_in_end_date,
        walk_in_start_time,
        walk_in_end_time,
        recruiter_name,
        mobile_number,
        venue_address,
        google_maps_url,
        JSON.stringify(team_members),
        apply_link,
        job_post_id,
        user_id
      ];

      // Insert new categories into job_categories table if they don't exist
      if (job_category && job_category.length > 0) {
        for (const cat of job_category) {
          const [exists] = await pool.query(
            "SELECT id FROM job_categories WHERE category_name = ?",
            [cat]
          );
          if (exists.length === 0) {
            await pool.query(
              "INSERT INTO job_categories (category_name, is_active) VALUES (?, 1)",
              [cat]
            );
          }
        }
      }

      // Insert new skills into skills table if they don't exist
      if (skills && skills.length > 0) {
        for (const skill of skills) {
          const [exists] = await pool.query(
            "SELECT id FROM skills WHERE name = ?",
            [skill]
          );
          if (exists.length === 0) {
            await pool.query(
              "INSERT INTO skills (name) VALUES (?)",
              [skill]
            );
          }
        }
      }

      const [result] = await pool.query(query, values);

      // Update Questions (delete and insert)
      await pool.query("DELETE FROM job_post_questions WHERE post_id = ?", [job_post_id]);
      if (questions && questions.length > 0) {
        const query = `INSERT INTO job_post_questions (post_id, question, isrequired) VALUES ?`;
        const values = questions.map(q => [job_post_id, q.question, q.isrequired]);
        await pool.query(query, [values]);
      }

      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  applyForJob: async (postId, userId, answers) => {
    try {
      const query = `INSERT INTO applied_jobs(postId, userId, created_at) VALUES (?, ?, NOW())`;
      const values = [postId, userId];

      const [result] = await pool.query(query, values);

      if (answers && answers.length >= 1) {
        const query = `INSERT INTO job_post_answers (postId, userId, questionId, answer, created_at) VALUES ?`;
        const insertValues = answers.map((item) => [postId, userId, item.questionId, item.answer, new Date()]);
        await pool.query(query, [insertValues]);
      }
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getJobAppliedCandidates: async (post_id) => {
    const query = `
    SELECT 
      job_post.id AS postId,
      job_post.job_title,
      job_post.company_name,
      job_post.job_nature,
      job_post.duration_period,
      job_post.workplace_type,
      job_post.work_location,
      job_post.job_category,
      job_post.skills,
      job_post.experience_type,
      job_post.experience_required,
      job_post.salary_type,
      job_post.min_salary,
      job_post.max_salary,
      job_post.diversity_hiring,
      job_post.benefits,
      job_post.job_description,
      job_post.openings,
      job_post.working_days,
      job_post.is_walk_in,
      job_post.walk_in_start_date,
      job_post.walk_in_end_date,
      job_post.walk_in_start_time,
      job_post.walk_in_end_time,
      job_post.recruiter_name,
      job_post.mobile_number,
      job_post.venue_address,
      job_post.google_maps_url,
      job_post.team_members,
      job_post.apply_link,
      job_post.created_at AS post_created_at,
      users.id AS user_id,
      users.first_name,
      users.last_name,
      users.email,
      users.phone_code,
      users.phone,
      users.profile_image,
      users.resume,
      users.about,
      users.skills as user_skills,
      users.gender,
      users.location,
      users.total_years,
      users.total_months,
      users.experince_type,
      users.course,
      applied_jobs.id as applied_jobs_id,
      applied_jobs.created_at as applied_date,
      applied_jobs.status as applied_status,
      user_social_links.linkedin,
      user_social_links.twitter,
      user_social_links.instagram,
      user_social_links.facebook,
      user_social_links.dribble,
      user_social_links.behance
    FROM job_post
    LEFT JOIN applied_jobs ON applied_jobs.postId = job_post.id
    LEFT JOIN users ON users.id = applied_jobs.userId
    LEFT JOIN user_social_links ON user_social_links.user_id = users.id
    WHERE job_post.id = ?
    ORDER BY applied_jobs.id DESC
  `;

    const values = [post_id];

    try {
      const [rows] = await pool.query(query, values);

      if (rows.length === 0) return null;

      const post_questions_query = `SELECT * FROM job_post_questions WHERE post_id= ?`;
      const post_questions_values = [post_id];

      const [post_questions] = await pool.query(
        post_questions_query,
        post_questions_values
      );

      const post_answers_query = `SELECT * FROM job_post_answers WHERE postId= ?`;
      const post_answers_values = [post_id];

      const [post_answers] = await pool.query(
        post_answers_query,
        post_answers_values
      );

      const filterQuestionAnswerList = post_questions.flatMap((q) => {
        return post_answers
          .filter((a) => a.questionId === q.id)
          .map((a) => ({
            question: q.question,
            answer: a.answer,
            user_id: a.userId,
          }));
      });

      const now = dayjs().tz("Asia/Kolkata");

      // Query candidate folder membership for all candidates in this job
      const candidateUserIds = Array.from(new Set(rows.map(r => r.user_id).filter(Boolean)));
      const candidateFoldersMap = {};
      if (candidateUserIds.length > 0) {
        try {
          const [savedFolderRows] = await pool.query(`
            SELECT 
              cfi.candidate_id,
              cfi.folder_id,
              cf.name AS folder_name,
              cfi.stage,
              cfi.created_at AS saved_at,
              CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS saved_by_name
            FROM candidate_folder_items cfi
            JOIN candidate_folders cf ON cfi.folder_id = cf.id
            LEFT JOIN users u ON cf.recruiter_id = u.id
            WHERE cfi.candidate_id IN (?)
            ORDER BY cfi.created_at DESC
          `, [candidateUserIds]);

          savedFolderRows.forEach((r) => {
            if (!candidateFoldersMap[r.candidate_id]) {
              candidateFoldersMap[r.candidate_id] = [];
            }
            candidateFoldersMap[r.candidate_id].push({
              folder_id: r.folder_id,
              folder_name: r.folder_name,
              stage: r.stage || 'applicant',
              saved_at: r.saved_at,
              saved_by: (r.saved_by_name || '').trim() || 'Recruiter'
            });
          });
        } catch (fErr) {
          console.warn("Could not query candidate_folder_items in getJobAppliedCandidates:", fErr.message);
        }
      }

      const safeParse = (value) => {
        try {
          return typeof value === 'string' ? JSON.parse(value) : (value || []);
        } catch {
          return Array.isArray(value) ? value : (value ? [value] : []);
        }
      };

      const seenUsers = new Set();
      const uniqueUsers = [];

      for (const row of rows) {
        if (!row.user_id || seenUsers.has(row.user_id)) continue;
        seenUsers.add(row.user_id);

        uniqueUsers.push({
          id: row.user_id,
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
          phone: row.phone,
          image: row.profile_image,
          resume: row.resume,
          about: row.about,
          skills: row.user_skills ? safeParse(row.user_skills) : [],
          gender: row.gender,
          location: row.location,
          total_years: row.total_years,
          total_months: row.total_months,
          experince_type: row.experince_type,
          course: row.course,
          applied_jobs_id: row.applied_jobs_id,
          applied_date: row.applied_date,
          status: row.applied_status || 'applied',
          saved_in_folders: candidateFoldersMap[row.user_id] || [],
          social_links: {
            linkedin: row.linkedin,
            twitter: row.twitter,
            instagram: row.instagram,
            facebook: row.facebook,
            dribble: row.dribble,
            behance: row.behance,
          },
          candidateAnswersForRecruiterQuestions:
            filterQuestionAnswerList.filter(
              (f) => f.user_id === row.user_id
            ),
        });
      }

      const item = rows[0];
      const postData = [
        {
          ...item,
          date_posted: dayjs(item.created_at).local().from(now),
          duration_period: safeParse(item.duration_period),
          work_location: safeParse(item.work_location),
          skills: safeParse(item.skills),
          experience_required: safeParse(item.experience_required),
          diversity_hiring: safeParse(item.diversity_hiring),
          job_category: safeParse(item.job_category),
          benefits: safeParse(item.benefits),
          team_members: item.team_members ? safeParse(item.team_members) : [],
          users: uniqueUsers,
        },
      ];
      return postData;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateAppliedJobStatus: async (applied_jobs_id, status) => {
    const query = `UPDATE applied_jobs SET status = ? WHERE id = ?`;
    const values = [status, applied_jobs_id];
    try {
      const [result] = await pool.query(query, values);
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getJobPostByUserId: async (user_id, limit, page, job_nature, search, statuses, categories, sort) => {
    try {
      const [userRow] = await pool.query("SELECT role_id FROM users WHERE id = ?", [user_id]);
      const role_id = userRow.length > 0 ? userRow[0].role_id : null;

      // Build WHERE clause based on filters
      let whereClause = '';
      let countValues = [];
      let queryValues = [];

      if (role_id === 1) {
        whereClause = 'WHERE 1=1';
      } else {
        whereClause = 'WHERE job_post.user_id = ?';
        countValues.push(user_id);
        queryValues.push(user_id);
      }

      // Add job_nature filter if provided
      if (job_nature) {
        whereClause += ' AND job_nature = ?';
        countValues.push(job_nature);
        queryValues.push(job_nature);
      }

      // Add search filter if provided
      if (search) {
        whereClause += ' AND (job_title LIKE ? OR company_name LIKE ?)';
        const searchTerm = `%${search}%`;
        countValues.push(searchTerm, searchTerm);
        queryValues.push(searchTerm, searchTerm);
      }

      // Add statuses filter if provided
      if (statuses && statuses.length > 0) {
        const statusConditions = [];
        if (statuses.includes('active')) {
          statusConditions.push(`((job_post.is_closed = 0 OR job_post.is_closed IS NULL) AND job_post.approval_status = 'approved')`);
        }
        if (statuses.includes('pending')) {
          statusConditions.push(`((job_post.is_closed = 0 OR job_post.is_closed IS NULL) AND (job_post.approval_status = 'pending' OR job_post.approval_status IS NULL))`);
        }
        if (statuses.includes('closed') || statuses.includes('expired')) {
          statusConditions.push(`(job_post.is_closed = 1)`);
        }
        if (statuses.includes('rejected')) {
          statusConditions.push(`((job_post.is_closed = 0 OR job_post.is_closed IS NULL) AND job_post.approval_status = 'rejected')`);
        }

        if (statusConditions.length > 0) {
          whereClause += ` AND (${statusConditions.join(' OR ')})`;
        }
      }

      // Add categories filter if provided
      if (categories && categories.length > 0) {
        const categoryConditions = categories.map(() => `(job_category LIKE ? OR job_category LIKE ?)`);
        whereClause += ` AND (${categoryConditions.join(' OR ')})`;
        categories.forEach(c => {
          const trimmed = c.trim();
          countValues.push(`%"${trimmed}"%`, `%" ${trimmed}"%`);
          queryValues.push(`%"${trimmed}"%`, `%" ${trimmed}"%`);
        });
      }


      // Get total count with filters
      const countQuery = `SELECT COUNT(*) as total FROM job_post ${whereClause}`;
      const [countResult] = await pool.query(countQuery, countValues);
      const total = countResult[0]?.total || 0;

      // Build the main query
      let query = `
  SELECT 
    job_post.*, 
    CASE 
      WHEN job_post.is_closed = 1 THEN 1 
      ELSE 0 
    END AS is_closed,
    COUNT(DISTINCT aj.id) AS candidates_count,
    GROUP_CONCAT(DISTINCT u.profile_image SEPARATOR ',') AS candidate_images
  FROM (
    SELECT * FROM job_post
    ${whereClause}
    ORDER BY created_at ${sort === 'ASC' ? 'ASC' : 'DESC'}
`;

      // ✅ Add LIMIT and OFFSET for pagination
      if (limit && !isNaN(limit)) {
        const limitValue = parseInt(limit, 10);
        const pageValue = page && !isNaN(page) ? parseInt(page, 10) : 1;
        const offset = (pageValue - 1) * limitValue;

        query += ` LIMIT ? OFFSET ?`;
        queryValues.push(limitValue, offset);
      }

      query += `
  ) AS job_post 
  LEFT JOIN applied_jobs aj ON aj.postId = job_post.id
  LEFT JOIN users u ON u.id = aj.userId
  GROUP BY job_post.id
  ORDER BY job_post.created_at ${sort === 'ASC' ? 'ASC' : 'DESC'}`;

      const [result] = await pool.query(query, queryValues);
      const now = dayjs().tz("Asia/Kolkata");
      const safeParse = (value) => {
        try { return JSON.parse(value); }
        catch { return Array.isArray(value) ? value : [value]; }
      };

      const formatResult = result.map((item) => {
        return {
          ...item,
          date_posted: dayjs(item.created_at).local().from(now),
          duration_period: safeParse(item.duration_period),
          work_location: safeParse(item.work_location),
          skills: safeParse(item.skills),
          experience_required: safeParse(item.experience_required),
          diversity_hiring: safeParse(item.diversity_hiring),
          job_category: safeParse(item.job_category),
          benefits: safeParse(item.benefits),
          educational_qualification: safeParse(item.educational_qualification),
          candidate_industry: safeParse(item.candidate_industry),
          languages: safeParse(item.languages),
          team_members: safeParse(item.team_members),
        };
      });

      // Calculate overall stats
      let statsQuery = '';
      let statsValues = [];
      if (role_id === 1) {
        statsQuery = `
          SELECT 
            SUM(CASE WHEN (is_closed = 0 OR is_closed IS NULL) AND approval_status = 'approved' THEN 1 ELSE 0 END) as openJobs,
            SUM(CASE WHEN (is_closed = 0 OR is_closed IS NULL) AND (approval_status = 'pending' OR approval_status IS NULL) THEN 1 ELSE 0 END) as pendingJobs,
            SUM(CASE WHEN (is_closed = 0 OR is_closed IS NULL) AND approval_status = 'rejected' THEN 1 ELSE 0 END) as rejectedJobs,
            SUM(CASE WHEN is_closed = 1 THEN 1 ELSE 0 END) as closedJobs,
            SUM(CASE WHEN LOWER(job_nature) != 'internship' OR job_nature IS NULL THEN 1 ELSE 0 END) as jobsCount,
            SUM(CASE WHEN LOWER(job_nature) = 'internship' THEN 1 ELSE 0 END) as internshipsCount,
            (SELECT COUNT(*) FROM applied_jobs) as totalApplications
          FROM job_post
        `;
      } else {
        statsQuery = `
          SELECT 
            SUM(CASE WHEN (is_closed = 0 OR is_closed IS NULL) AND approval_status = 'approved' THEN 1 ELSE 0 END) as openJobs,
            SUM(CASE WHEN (is_closed = 0 OR is_closed IS NULL) AND (approval_status = 'pending' OR approval_status IS NULL) THEN 1 ELSE 0 END) as pendingJobs,
            SUM(CASE WHEN (is_closed = 0 OR is_closed IS NULL) AND approval_status = 'rejected' THEN 1 ELSE 0 END) as rejectedJobs,
            SUM(CASE WHEN is_closed = 1 THEN 1 ELSE 0 END) as closedJobs,
            SUM(CASE WHEN LOWER(job_nature) != 'internship' OR job_nature IS NULL THEN 1 ELSE 0 END) as jobsCount,
            SUM(CASE WHEN LOWER(job_nature) = 'internship' THEN 1 ELSE 0 END) as internshipsCount,
            (SELECT COUNT(*) FROM applied_jobs aj JOIN job_post jp2 ON aj.postId = jp2.id WHERE jp2.user_id = ?) as totalApplications
          FROM job_post
          WHERE user_id = ?
        `;
        statsValues.push(user_id, user_id);
      }
      const [statsResult] = await pool.query(statsQuery, statsValues);
      const stats = {
        openJobs: Number(statsResult[0]?.openJobs) || 0,
        pendingJobs: Number(statsResult[0]?.pendingJobs) || 0,
        rejectedJobs: Number(statsResult[0]?.rejectedJobs) || 0,
        closedJobs: Number(statsResult[0]?.closedJobs) || 0,
        jobsCount: Number(statsResult[0]?.jobsCount) || 0,
        internshipsCount: Number(statsResult[0]?.internshipsCount) || 0,
        totalApplications: Number(statsResult[0]?.totalApplications) || 0,
      };

      return {
        data: formatResult,
        total: total,
        page: page || 1,
        limit: limit || total,
        stats: stats
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getYears: async () => {
    try {
      const [years] = await pool.query(
        `SELECT id, year FROM year_master ORDER BY id`
      );

      return years;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getSkills: async () => {
    try {
      const [skills] = await pool.query(
        `SELECT
            id,
            name
        FROM
            skills
        ORDER BY CASE WHEN name
            = 'Others' THEN 1 ELSE 0
        END,
        name`
      );
      return skills;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getJobCategories: async (filters = {}) => {
    try {
      const cacheKey = JSON.stringify(filters);
      const cached = categoriesCache.get(cacheKey);
      const now = Date.now();
      if (cached && (now - cached.time < CATEGORIES_CACHE_TTL)) {
        return cached.data;
      }

      const jobWhereClauses = [];
      const jobValues = [];

      if (filters.job_nature) {
        jobWhereClauses.push("job_nature = ?");
        jobValues.push(filters.job_nature);
      }
      if (filters.experience_type) {
        jobWhereClauses.push("experience_type = ?");
        jobValues.push(filters.experience_type);
      }

      const hasFilters = jobWhereClauses.length > 0;
      const minJobs = filters.min_jobs ? parseInt(filters.min_jobs, 10) : (hasFilters ? 1 : 0);

      let categories = [];

      if (!minJobs && !hasFilters) {
        const [rows] = await pool.query(`
          SELECT MIN(id) as id, category_name 
          FROM job_categories 
          WHERE is_active = 1 
          GROUP BY category_name
          ORDER BY CASE WHEN category_name = 'Others' THEN 1 ELSE 0 END, category_name
        `);
        categories = rows;
      } else {
        const [activeCats] = await pool.query(`
          SELECT MIN(id) as id, category_name 
          FROM job_categories 
          WHERE is_active = 1 
          GROUP BY category_name
        `);

        const activeMap = new Map();
        for (const cat of activeCats) {
          if (cat.category_name) {
            activeMap.set(cat.category_name.trim().toLowerCase(), {
              id: cat.id,
              category_name: cat.category_name.trim()
            });
          }
        }

        const whereSql = jobWhereClauses.length > 0 ? `WHERE ${jobWhereClauses.join(" AND ")}` : "";
        const [jobs] = await pool.query(`SELECT job_category FROM job_post ${whereSql}`, jobValues);

        const counts = new Map();
        for (const row of jobs) {
          if (!row.job_category) continue;
          let list = [];
          try {
            list = typeof row.job_category === 'string' ? JSON.parse(row.job_category) : row.job_category;
          } catch (e) {
            continue;
          }
          if (!Array.isArray(list)) continue;

          const seenInJob = new Set();
          for (const c of list) {
            const name = String(c).trim();
            const lower = name.toLowerCase();
            if (name && !seenInJob.has(lower)) {
              seenInJob.add(lower);
              if (activeMap.has(lower)) {
                counts.set(lower, (counts.get(lower) || 0) + 1);
              }
            }
          }
        }

        for (const [lower, catObj] of activeMap.entries()) {
          const count = counts.get(lower) || 0;
          if (count >= minJobs) {
            categories.push(catObj);
          }
        }

        categories.sort((a, b) => {
          if (a.category_name === 'Others') return 1;
          if (b.category_name === 'Others') return -1;
          return a.category_name.localeCompare(b.category_name);
        });
      }

      categoriesCache.set(cacheKey, { data: categories, time: now });
      return categories;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getJobPosts: async (filters = {}) => {
    try {
      const isPublic = !filters.user_id && !filters.admin_user_id && !filters.include_stats;
      const cacheKey = isPublic ? JSON.stringify(filters) : null;
      if (cacheKey && jobPostsCache.has(cacheKey)) {
        const cached = jobPostsCache.get(cacheKey);
        if (Date.now() - cached.time < JOB_POSTS_CACHE_TTL) {
          return cached.data;
        }
        jobPostsCache.delete(cacheKey);
      }

      let query = `SELECT
                      job_post.id,
                      job_post.user_id,
                      COALESCE(NULLIF(job_post.company_name, ''), hr_profiles.company_name) AS company_name,
                      COALESCE(NULLIF(job_post.about_company, ''), hr_profiles.about_us) AS company_description,
                      CASE 
                          WHEN job_post.company_logo IS NULL OR job_post.company_logo = '' OR job_post.company_logo LIKE '%dummy_img%' THEN hr_profiles.profile_image
                          ELSE job_post.company_logo
                      END AS company_logo,
                      job_post.job_title,
                      job_post.job_nature,
                      job_post.duration_period,
                      job_post.workplace_type,
                      job_post.work_location,
                      job_post.job_category,
                      job_post.skills,
                      job_post.experience_type,
                      job_post.experience_required,
                      job_post.salary_type,
                      job_post.currency,
                      job_post.min_salary,
                      job_post.max_salary,
                      job_post.diversity_hiring,
                      job_post.benefits,
                      job_post.job_description,
                      job_post.seo_description,
                      job_post.openings,
                      job_post.working_days,
                      job_post.salary_duration,
                      job_post.role,
                      job_post.industry,
                      job_post.employment_type,
                      job_post.willing_to_relocate,
                      job_post.hybrid_policy,
                      job_post.educational_qualification,
                      job_post.candidate_industry,
                      job_post.hide_salary,
                      job_post.languages,
                      job_post.is_walk_in,
                      job_post.walk_in_start_date,
                      job_post.walk_in_end_date,
                      job_post.walk_in_start_time,
                      job_post.walk_in_end_time,
                      job_post.recruiter_name,
                      job_post.mobile_number,
                      job_post.venue_address,
                      job_post.google_maps_url,
                      job_post.team_members,
                      job_post.apply_link,
                      job_post.fixed_format,
                      job_post.variable_amount,
                      job_post.variable_format,
                      job_post.bonus_amount,
                      job_post.bonus_format,
                      job_post.created_at,
                      job_post.approval_status,
                      job_post.approved_at,
                      job_post.rejection_reason,
                      job_post.is_closed,
                      (SELECT COUNT(*) FROM applied_jobs WHERE applied_jobs.postId = job_post.id) AS applicants_count
                  FROM
                      job_post
                  LEFT JOIN
                      hr_profiles ON job_post.user_id = hr_profiles.user_id`;

      const whereClauses = [];
      const queryParams = [];

      // ID filter
      if (filters.id !== undefined && filters.id !== null && filters.id !== '') {
        whereClauses.push(`job_post.id = ?`);
        queryParams.push(filters.id);
      }

      // Workplace type filter - fixed
      if (filters.workplace_type && filters.workplace_type.length > 0) {
        const placeholders = filters.workplace_type.map(() => "?").join(",");
        whereClauses.push(`workplace_type IN (${placeholders})`);
        queryParams.push(...filters.workplace_type);
      }

      // Status filter
      if (filters.status) {
        const daysThreshold = filters.days || 15; // Default to 15 if `filters.days` is undefined

        if (filters.status === "Live") {
          whereClauses.push(
            `DATEDIFF(NOW(), job_post.created_at) BETWEEN -${daysThreshold} AND ${daysThreshold}`
          );
        } else if (filters.status === "Expired") {
          whereClauses.push(
            `DATEDIFF(NOW(), job_post.created_at) < -${daysThreshold} OR DATEDIFF(NOW(), job_post.created_at) > ${daysThreshold}`
          );
        }
      }

      // job nature filter
      if (filters.job_nature) {
        whereClauses.push(`LOWER(job_nature) = LOWER(?)`);
        queryParams.push(filters.job_nature);
      }

      // experience type filter
      if (filters.experience_type) {
        whereClauses.push(`LOWER(experience_type) = LOWER(?)`);
        queryParams.push(filters.experience_type);
      }

      // Company filter
      if (filters.companies && filters.companies.length > 0) {
        const placeholders = filters.companies.map(() => "LOWER(?)").join(",");
        whereClauses.push(`LOWER(COALESCE(NULLIF(job_post.company_name, ''), hr_profiles.company_name)) IN (${placeholders})`);
        queryParams.push(...filters.companies.map(c => c.toLowerCase()));
      }

      // Workplace location filter
      if (filters.work_location) {
        let workLocations = Array.isArray(filters.work_location)
          ? filters.work_location
          : [filters.work_location];

        // Filter out any empty/null values
        workLocations = workLocations.filter(loc => loc && String(loc).trim() !== "");

        if (workLocations.length > 0) {
          whereClauses.push(`(
            ${workLocations
              .map(() => `JSON_SEARCH(LOWER(IF(JSON_VALID(work_location), work_location, '[]')), 'one', ?) IS NOT NULL`)
              .join(" OR ")}
          )`);

          workLocations.forEach((loc) => {
            queryParams.push(loc.toLowerCase());
          });
        }
      }

      // Working days filter
      if (filters.working_days) {
        whereClauses.push(`working_days = ?`);
        queryParams.push(filters.working_days);
      }

      // Date range filter
      if (filters.start_date && filters.end_date) {
        whereClauses.push(`DATE(job_post.created_at) BETWEEN ? AND ?`);
        queryParams.push(filters.start_date, filters.end_date);
      } else if (filters.start_date) {
        whereClauses.push(`DATE(job_post.created_at) >= ?`);
        queryParams.push(filters.start_date);
      } else if (filters.end_date) {
        whereClauses.push(`DATE(job_post.created_at) <= ?`);
        queryParams.push(filters.end_date);
      }

      // Job category filter (array of categories)
      // In your model where you build the query:
      if (filters.job_categories && filters.job_categories.length > 0) {
        const validCategories = filters.job_categories.filter(cat => cat && String(cat).trim() !== "");

        if (validCategories.length > 0) {
          whereClauses.push(`(
            ${validCategories
              .map(() => `JSON_SEARCH(LOWER(IF(JSON_VALID(job_category), job_category, '[]')), 'one', ?) IS NOT NULL`)
              .join(" OR ")}
          )`);

          validCategories.forEach((category) => {
            queryParams.push(category.toLowerCase());
          });
        }
      }

      if (filters.searchTerm) {
        const searchTerm = `%${filters.searchTerm.toLowerCase()}%`;
        whereClauses.push(`(LOWER(job_post.job_title) LIKE ? OR LOWER(COALESCE(NULLIF(job_post.company_name, ''), hr_profiles.company_name)) LIKE ?)`);
        queryParams.push(searchTerm, searchTerm);
      }

      if (filters.is_closed !== undefined && filters.is_closed !== null && filters.is_closed !== '') {
        if (Number(filters.is_closed) === 0) {
          whereClauses.push(`(job_post.is_closed = 0 OR job_post.is_closed IS NULL)`);
        } else {
          whereClauses.push(`job_post.is_closed = 1`);
        }
      }

      // Approval status filter
      if (filters.approval_status && filters.approval_status !== 'all') {
        if (filters.approval_status === 'pending') {
          whereClauses.push(`(job_post.approval_status = 'pending' OR job_post.approval_status IS NULL)`);
        } else if (filters.approval_status === 'auto_approved') {
          whereClauses.push(`((users.auto_approve = 1 OR users.role_id = 1) AND (job_post.approval_status = 'approved' OR job_post.approval_status IS NULL))`);
        } else {
          whereClauses.push(`job_post.approval_status = ?`);
          queryParams.push(filters.approval_status);
        }
      }

      // Check if hr_profiles or users join is needed in count and id query
      const hasHrInWhere = Boolean(filters.searchTerm || (filters.companies && filters.companies.length > 0) || filters.sort_key === 'company_name');
      const hasUsersInWhere = Boolean(filters.approval_status === 'auto_approved');
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM job_post
        ${hasHrInWhere ? 'LEFT JOIN hr_profiles ON job_post.user_id = hr_profiles.user_id' : ''}
        ${hasUsersInWhere ? 'LEFT JOIN users ON job_post.user_id = users.id' : ''}
        ${whereClauses.length > 0 ? ` WHERE ${whereClauses.join(" AND ")}` : ''}
      `;

      // Sorting
      const ALLOWED_SORT_KEYS = {
        'job_title': 'job_post.job_title',
        'company_name': "COALESCE(NULLIF(job_post.company_name, ''), hr_profiles.company_name)",
        'job_nature': 'job_post.job_nature',
        'job_location': 'job_post.work_location',
        'created_at': 'job_post.created_at',
        'approved_at': 'job_post.approved_at',
        'applicants_count': '(SELECT COUNT(*) FROM applied_jobs WHERE applied_jobs.postId = job_post.id)',
        'is_closed': 'job_post.is_closed',
      };
      let orderClause = "";
      if (filters.sort_key && ALLOWED_SORT_KEYS[filters.sort_key]) {
        const dir = filters.sort_direction === 'desc' ? 'DESC' : 'ASC';
        orderClause = ` ORDER BY ${ALLOWED_SORT_KEYS[filters.sort_key]} ${dir}`;
      } else if (filters.salary_sort) {
        if (filters.salary_sort === "low_to_high") {
          orderClause = ` ORDER BY COALESCE(job_post.min_salary, 0) ASC`;
        } else if (filters.salary_sort === "high_to_low") {
          orderClause = ` ORDER BY COALESCE(job_post.max_salary, 0) DESC`;
        }
      } else {
        orderClause = ` ORDER BY job_post.created_at DESC`;
      }

      // Apply pagination with LIMIT and OFFSET
      const limit = Number(filters.limit) || 20;
      const page = Number(filters.page) || 1;
      const offset = (page - 1) * limit;

      const idQuery = `
        SELECT job_post.id
        FROM job_post
        ${hasHrInWhere ? 'LEFT JOIN hr_profiles ON job_post.user_id = hr_profiles.user_id' : ''}
        ${hasUsersInWhere ? 'LEFT JOIN users ON job_post.user_id = users.id' : ''}
        ${whereClauses.length > 0 ? ` WHERE ${whereClauses.join(" AND ")}` : ''}
        ${orderClause}
        LIMIT ? OFFSET ?
      `;

      // Run countQuery and idQuery in parallel for maximum performance
      const [countResultPromise, idResultPromise] = await Promise.all([
        pool.query(countQuery, queryParams),
        pool.query(idQuery, [...queryParams, limit, offset])
      ]);

      const totalCount = countResultPromise[0][0]?.total || 0;
      const idRows = idResultPromise[0] || [];

      let posts = [];
      if (idRows.length > 0) {
        const postIds = idRows.map(r => r.id);
        const placeholders = postIds.map(() => '?').join(',');
        const fullQuery = `${query} WHERE job_post.id IN (${placeholders}) ${orderClause}`;
        const [fullPosts] = await pool.query(fullQuery, postIds);
        posts = fullPosts;
      }

      // Get stats only if requested (e.g. admin dashboard) to avoid massive full-table scan on public pages
      let globalStats = {
        totalJobs: totalCount,
        activeJobs: 0,
        closedJobs: 0,
        approvedJobs: 0,
        autoApprovedJobs: 0,
        pendingJobs: 0,
        uniqueCompanies: 0
      };

      if (filters.include_stats) {
        const statsKey = `${filters.start_date || ''}_${filters.end_date || ''}_${filters.searchTerm || ''}`;
        const cached = adminStatsCache.get(statsKey);
        if (cached && (Date.now() - cached.timestamp < ADMIN_STATS_CACHE_TTL)) {
          globalStats = cached.data;
        } else {
          const statsWhereClauses = [];
          const statsQueryParams = [];
          if (filters.start_date && filters.end_date) {
            statsWhereClauses.push(`DATE(job_post.created_at) BETWEEN ? AND ?`);
            statsQueryParams.push(filters.start_date, filters.end_date);
          } else if (filters.start_date) {
            statsWhereClauses.push(`DATE(job_post.created_at) >= ?`);
            statsQueryParams.push(filters.start_date);
          } else if (filters.end_date) {
            statsWhereClauses.push(`DATE(job_post.created_at) <= ?`);
            statsQueryParams.push(filters.end_date);
          }
          if (filters.searchTerm) {
            statsWhereClauses.push(`(LOWER(job_post.job_title) LIKE ? OR LOWER(COALESCE(NULLIF(job_post.company_name, ''), hr_profiles.company_name)) LIKE ?)`);
            const searchPattern = `%${filters.searchTerm.toLowerCase()}%`;
            statsQueryParams.push(searchPattern, searchPattern);
          }

          const statsQuery = `
            SELECT 
              COUNT(*) as totalJobs,
              COALESCE(SUM(CASE WHEN (job_post.is_closed = 0 OR job_post.is_closed IS NULL) THEN 1 ELSE 0 END), 0) as activeJobs,
              COALESCE(SUM(CASE WHEN job_post.is_closed = 1 THEN 1 ELSE 0 END), 0) as closedJobs,
              COALESCE(SUM(CASE WHEN job_post.approval_status = 'approved' THEN 1 ELSE 0 END), 0) as approvedJobs,
              COALESCE(SUM(CASE WHEN (users.auto_approve = 1 OR users.role_id = 1) AND (job_post.approval_status = 'approved' OR job_post.approval_status IS NULL) THEN 1 ELSE 0 END), 0) as autoApprovedJobs,
              COALESCE(SUM(CASE WHEN (job_post.approval_status = 'pending' OR job_post.approval_status IS NULL) THEN 1 ELSE 0 END), 0) as pendingJobs,
              COUNT(DISTINCT COALESCE(NULLIF(job_post.company_name, ''), hr_profiles.company_name)) as uniqueCompanies
            FROM job_post
            LEFT JOIN hr_profiles ON job_post.user_id = hr_profiles.user_id
            LEFT JOIN users ON job_post.user_id = users.id
            ${statsWhereClauses.length > 0 ? ` WHERE ${statsWhereClauses.join(" AND ")}` : ''}
          `;
          const [statsResult] = await pool.query(statsQuery, statsQueryParams);
          globalStats = {
            totalJobs: Number(statsResult[0]?.totalJobs || 0),
            activeJobs: Number(statsResult[0]?.activeJobs || 0),
            closedJobs: Number(statsResult[0]?.closedJobs || 0),
            approvedJobs: Number(statsResult[0]?.approvedJobs || 0),
            autoApprovedJobs: Number(statsResult[0]?.autoApprovedJobs || 0),
            pendingJobs: Number(statsResult[0]?.pendingJobs || 0),
            uniqueCompanies: Number(statsResult[0]?.uniqueCompanies || 0)
          };
          adminStatsCache.set(statsKey, { data: globalStats, timestamp: Date.now() });
        }
      }

      // Helper function to safely parse JSON arrays
      const safeParseArray = (str) => {
        try {
          return str ? JSON.parse(str) : [];
        } catch (e) {
          return [];
        }
      };

      // Fetch all questions for the retrieved posts in a single query to avoid N+1 problem
      let allQuestions = [];
      if (posts.length > 0) {
        const postIds = posts.map(p => p.id);
        const questionQuery = `SELECT id, post_id, question, CASE WHEN isrequired = 1 THEN 1 ELSE 0 END AS isrequired FROM job_post_questions WHERE post_id IN (?) ORDER BY created_at ASC`;
        const [questionsResult] = await pool.query(questionQuery, [postIds]);
        allQuestions = questionsResult;
      }

      // Group questions by post_id
      const questionsByPostId = {};
      for (const q of allQuestions) {
        if (!questionsByPostId[q.post_id]) {
          questionsByPostId[q.post_id] = [];
        }
        questionsByPostId[q.post_id].push(q);
      }

      const now = dayjs().tz("Asia/Kolkata");

      const processedPosts = posts.map((post) => {
        const questions = questionsByPostId[post.id] || [];

        return {
          ...post,
          applicants_count: Number(post.applicants_count) || 0,
          is_closed: Buffer.isBuffer(post.is_closed) ? post.is_closed[0] : (post.is_closed == 1 ? 1 : 0),
          date_posted: dayjs(post.created_at).tz("Asia/Kolkata").from(now),
          duration_period: safeParseArray(post.duration_period),
          work_location: safeParseArray(post.work_location),
          job_category: safeParseArray(post.job_category),
          skills: safeParseArray(post.skills),
          experience_required: safeParseArray(post.experience_required),
          diversity_hiring: safeParseArray(post.diversity_hiring),
          benefits: safeParseArray(post.benefits),
          educational_qualification: safeParseArray(post.educational_qualification),
          candidate_industry: safeParseArray(post.candidate_industry),
          languages: safeParseArray(post.languages),
          working_days: post.working_days || null,
          questions,
        };
      });

      const totalPages = Math.ceil(totalCount / limit);

      const responsePayload = {
        success: true,
        message: "Job posts fetched successfully",
        data: processedPosts,
        meta: {
          total: totalCount,
          page: page,
          limit: limit,
          totalPages: totalPages,
          hasMore: page < totalPages,
          filters: filters,
          stats: globalStats
        },
      };

      if (cacheKey) {
        if (jobPostsCache.size > 200) jobPostsCache.clear();
        jobPostsCache.set(cacheKey, { time: Date.now(), data: responsePayload });
      }

      return responsePayload;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  registrationClose: async (id) => {
    try {
      const [is_exists] = await pool.query(
        `SELECT id FROM job_post WHERE id = ? AND is_closed = 0`,
        id
      );
      if (is_exists.length == 0) {
        throw new Error("Invalid id");
      }

      const [result] = await pool.query(
        `UPDATE job_post SET is_closed = 1 WHERE id = ?`,
        id
      );
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  makeJobActive: async (id) => {
    try {
      const [is_exists] = await pool.query(
        `SELECT id FROM job_post WHERE id = ? AND is_closed = 1`,
        id
      );
      if (is_exists.length == 0) {
        throw new Error("Invalid id or job is already active");
      }

      const [result] = await pool.query(
        `UPDATE job_post SET is_closed = 0 WHERE id = ?`,
        id
      );
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getExperienceRange: async () => {
    try {
      const [range] = await pool.query(
        `SELECT id, display_text, sort_order FROM experience_range WHERE is_active = 1 ORDER BY sort_order`
      );
      return range;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  insertProjects: async (
    user_id,
    company_name,
    project_title,
    project_type,
    start_date,
    end_date,
    description
  ) => {
    try {
      const projectQuery = `INSERT INTO user_projects(
                                    user_id,
                                    company_name,
                                    project_title,
                                    project_type,
                                    start_date,
                                    end_date,
                                    description
                                ) VALUES(?, ?, ?, ?, ?, ?, ?)`;
      const projectValue = [
        user_id,
        company_name,
        project_title,
        project_type,
        start_date,
        end_date,
        description,
      ];

      await pool.query(projectQuery, projectValue);
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateProject: async (
    company_name,
    project_title,
    project_type,
    start_date,
    end_date,
    description,
    id
  ) => {
    try {
      const [chechId] = await pool.query(
        `SELECT id FROM user_projects WHERE id = ?`,
        [id]
      );
      if (chechId.length === 0) {
        throw new Error("Invalid Id");
      }

      const updateQuery = `UPDATE user_projects SET
                              company_name = ?,
                              project_title = ?,
                              project_type = ?,
                              start_date = ?,
                              end_date = ?,
                              description = ?
                          WHERE id = ?`;
      const [result] = await pool.query(updateQuery, [
        company_name,
        project_title,
        project_type,
        start_date,
        end_date,
        description,
        id,
      ]);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateResume: async (resumeBase64, id) => {
    try {
      const [updateResume] = await pool.query(
        `UPDATE users SET resume = ? WHERE id = ?`,
        [resumeBase64, id]
      );
      return updateResume.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateSkills: async (skills, user_id) => {
    try {
      const [skill] = await pool.query(
        `UPDATE users SET skills = ? WHERE id = ?`,
        [JSON.stringify(skills), user_id]
      );
      return skill.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateVisibility: async ({ visibility_mode, hidden_companies, allow_contact, show_in_search, user_id }) => {
    try {
      const [result] = await pool.query(
        `UPDATE users SET visibility_mode = ?, hidden_companies = ?, allow_contact = ?, show_in_search = ? WHERE id = ?`,
        [
          visibility_mode || 'Limited',
          JSON.stringify(Array.isArray(hidden_companies) ? hidden_companies : []),
          allow_contact !== undefined ? (allow_contact ? 1 : 0) : 1,
          show_in_search !== undefined ? (show_in_search ? 1 : 0) : 1,
          user_id
        ]
      );
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateAbout: async (about, user_id) => {
    try {
      const [result] = await pool.query(
        `UPDATE users SET about = ? WHERE id = ?`,
        [about, user_id]
      );
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getClasses: async () => {
    try {
      const classes = [];
      for (let i = 1; i <= 12; i++) {
        classes.push(i);
      }
      return classes;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateExperience: async (
    job_title,
    company_name,
    designation,
    start_date,
    end_date,
    currently_working,
    skills,
    location,
    description,
    id,
    user_id
  ) => {
    try {
      const [chechId] = await pool.query(
        `SELECT id FROM user_professional WHERE id = ?`,
        [id]
      );
      if (chechId.length <= 0) {
        throw new Error("Invalid Id");
      }
      const updateQuery = `UPDATE user_professional SET
                              job_title = ?,
                              company_name = ?,
                              designation = ?,
                              start_date = ?,
                              end_date = ?,
                              currently_working = ?,
                              skills = ?,
                              location = ?,
                              description = ?
                          WHERE id = ? AND user_id = ?`;
      const values = [
        job_title,
        company_name,
        designation,
        start_date,
        end_date,
        currently_working,
        JSON.stringify(skills),
        location,
        description,
        id,
        user_id,
      ];
      const [result] = await pool.query(updateQuery, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  insertExperience: async (user_id, experiences) => {
    try {
      const insertedIds = [];
      if (experiences.length >= 1) {
        for (const e of experiences) {
          const insertQuery = `INSERT INTO user_professional(
                              user_id,
                              job_title,
                              company_name,
                              designation,
                              start_date,
                              end_date,
                              currently_working,
                              skills,
                              location,
                              description
                          )
                          VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
          const values = [
            user_id,
            e.job_title,
            e.company_name,
            e.designation,
            e.start_date,
            e.end_date,
            e.currently_working,
            JSON.stringify(e.skills || []),
            e.location || null,
            e.description || null,
          ];
          const [result] = await pool.query(insertQuery, values);
          insertedIds.push(result.insertId);
        }
      }
      return insertedIds;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  deleteExperience: async (id) => {
    try {
      const [result] = await pool.query(
        `DELETE FROM user_professional WHERE id = ?`,
        id
      );
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getQualification: async () => {
    try {
      const [qualifications] = await pool.query(
        `SELECT id, name FROM qualification WHERE is_deleted = 0`
      );
      return qualifications;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getCourses: async () => {
    try {
      const [courses] = await pool.query(
        `SELECT id, name FROM course_master WHERE is_deleted = 0`
      );
      return courses;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getSpecialization: async () => {
    try {
      const [specializations] = await pool.query(
        `SELECT id, name FROM specialization_master WHERE is_deleted = 0`
      );
      return specializations;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getColleges: async () => {
    try {
      const [colleges] = await pool.query(
        `SELECT id, name, city, state, university FROM college_master WHERE is_deleted = 0`
      );
      return colleges;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getCourseType: async () => {
    const types = ["Part-time", "Full-time", "Distance Learning"];
    return types;
  },

  deleteProject: async (id) => {
    try {
      const [result] = await pool.query(
        `DELETE FROM user_projects WHERE id = ?`,
        [id]
      );
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  saveJobPost: async (user_id, job_post_id) => {
    try {
      const insertQuery = `INSERT INTO user_saved_jobs (user_id, job_post_id, created_date) VALUES (?, ?, ?)`;
      const values = [user_id, job_post_id, new Date()];
      const [result] = await pool.query(insertQuery, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getSavedJobs: async (user_id) => {
    try {
      const query = `SELECT
                        sj.id,
                        sj.user_id,
                        sj.job_post_id,
                        jp.company_name,
                        jp.company_logo,
                        jp.job_title,
                        sj.created_date,
                        jp.work_location,
                        jp.salary_type,
                        jp.min_salary,
                        jp.max_salary
                    FROM
                        user_saved_jobs sj
                    INNER JOIN job_post jp ON
                        sj.job_post_id = jp.id
                    WHERE
                        sj.user_id = ?
                    ORDER BY
                        sj.created_date`;
      const [savedJobs] = await pool.query(query, [user_id]);
      const now = dayjs().tz("Asia/Kolkata");
      // Modify the date format
      const formattedJobs = savedJobs.map((job) => {
        return {
          ...job,
          date_posted: dayjs(job.created_date).tz("Asia/Kolkata").from(now),
        };
      });
      return formattedJobs;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  removeSavedJobs: async (id) => {
    try {
      const [result] = await pool.query(
        `DELETE FROM user_saved_jobs WHERE id = ?`,
        [id]
      );
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  checkIsJobApplied: async (user_id, job_post_id) => {
    try {
      const [isApplied] = await pool.query(
        `SELECT id FROM applied_jobs WHERE postId = ? AND userId = ?`,
        [job_post_id, user_id]
      );
      return isApplied.length > 0 ? true : false;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  checkIsJobSaved: async (user_id, job_post_id) => {
    try {
      const [isSaved] = await pool.query(
        `SELECT id FROM user_saved_jobs WHERE user_id = ? AND job_post_id = ?`,
        [user_id, job_post_id]
      );
      return isSaved.length > 0 ? true : false;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateJobDescription: async (job_post_id, description, benefits) => {
    try {
      const [isIdExists] = await pool.query(
        `SELECT id FROM job_post WHERE id = ?`,
        [job_post_id]
      );
      if (isIdExists.length <= 0) {
        throw new Error("Invalid Id");
      }
      const [result] = await pool.query(
        `UPDATE job_post SET job_description = ?, benefits = ? WHERE id = ?`,
        [description, JSON.stringify(benefits), job_post_id]
      );
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateEligibility: async (
    job_post_id,
    experience_type,
    experience_required,
    salary_type,
    min_salary,
    max_salary,
    diversity_hiring,
    currency,
    salary_duration,
    role,
    industry,
    employment_type,
    willing_to_relocate,
    hybrid_policy,
    educational_qualification,
    candidate_industry
  ) => {
    try {
      const [isIdExists] = await pool.query(
        `SELECT id FROM job_post WHERE id = ?`,
        [job_post_id]
      );
      if (isIdExists.length <= 0) {
        throw new Error("Invalid Id");
      }
      const [result] = await pool.query(
        `UPDATE job_post SET experience_type = ?, experience_required = ?, salary_type = ?, min_salary = ?, max_salary = ?, diversity_hiring = ?, currency = ?, salary_duration = ? WHERE id = ?`,
        [
          experience_type,
          JSON.stringify(experience_required),
          salary_type,
          min_salary,
          max_salary,
          JSON.stringify(diversity_hiring),
          currency,
          salary_duration,
          job_post_id,
        ]
      );
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateJobNature: async (
    job_post_id,
    job_nature,
    duration_period,
    workplace_type,
    work_location
  ) => {
    try {
      const [isIdExists] = await pool.query(
        `SELECT id FROM job_post WHERE id = ?`,
        [job_post_id]
      );
      if (isIdExists.length <= 0) {
        throw new Error("Invalid Id");
      }
      const [result] = await pool.query(
        `UPDATE job_post SET job_nature = ?, duration_period = ?, workplace_type = ?, work_location = ? WHERE id = ?`,
        [
          job_nature,
          JSON.stringify(duration_period),
          workplace_type,
          JSON.stringify(work_location),
          job_post_id,
        ]
      );
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateJobBasicDetails: async (
    job_post_id,
    company_name,
    company_logo,
    about_company,
    job_title,
    job_categories,
    skills,
    openings,
    working_days
  ) => {
    try {
      const [isIdExists] = await pool.query(
        `SELECT id, company_logo FROM job_post WHERE id = ?`,
        [job_post_id]
      );
      if (isIdExists.length <= 0) {
        throw new Error("Invalid Id");
      }

      let finalLogo = company_logo;
      if (company_logo && (company_logo.startsWith("/api/job/logo/") || company_logo.includes("/api/job/logo/"))) {
        finalLogo = isIdExists[0].company_logo;
      }

      const updateQuery = `UPDATE job_post SET company_name = ?, company_logo = ?, about_company = ?, job_title = ?, job_category = ?, skills = ?, openings = ?, working_days = ? WHERE id = ?`;
      const values = [
        company_name,
        finalLogo,
        about_company,
        job_title,
        JSON.stringify(job_categories),
        JSON.stringify(skills),
        openings,
        working_days,
        job_post_id,
      ];
      const [result] = await pool.query(updateQuery, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  searchByKeyword: async (searchTerm, category) => {
    try {
      if (category === "Courses") {
        let sql = "SELECT id, title as job_title, description as job_description, image as company_logo, 'Course' as job_nature, slug FROM courses";
        let params = [];

        if (searchTerm) {
          sql += " WHERE LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(category) LIKE ?";
          const term = `%${searchTerm.toLowerCase()}%`;
          params = [term, term, term];
        }

        const [rows] = await pool.query(sql, params);
        return rows.map(row => ({
          ...row,
          company_name: "CareerFast Academy", // Default for courses if not specified
          id: row.id,
          job_title: row.job_title,
          company_logo: row.company_logo,
          job_nature: "Course",
          slug: row.slug
        }));
      }

      const filters = [];
      // Category filter for Jobs/Internships
      if (category && category !== "All") {
        if (category === "Internships") {
          filters.push(`LOWER(job_nature) = 'internship'`);
        } else if (category === "Jobs") {
          filters.push(`LOWER(job_nature) = 'job'`);
        }
      }

      // Keyword filter
      if (searchTerm) {
        const words = searchTerm
          .toLowerCase()
          .split(" ")
          .filter((word) => word.length > 0);

        words.forEach((word) => {
          const likeFields = [
            `LOWER(company_name) LIKE '%${word}%'`,
            `LOWER(job_title) LIKE '%${word}%'`,
            `LOWER(job_nature) LIKE '%${word}%'`,
            `LOWER(workplace_type) LIKE '%${word}%'`,
            `LOWER(work_location) LIKE '%${word}%'`,
            `JSON_SEARCH(LOWER(job_category), 'one', '%${word}%') IS NOT NULL`,
            `JSON_SEARCH(LOWER(skills), 'one', '%${word}%') IS NOT NULL`,
            `LOWER(experience_type) LIKE '%${word}%'`,
            `LOWER(salary_type) LIKE '%${word}%'`,
            `JSON_SEARCH(LOWER(diversity_hiring), 'one', '%${word}%') IS NOT NULL`,
            `JSON_SEARCH(LOWER(benefits), 'one', '%${word}%') IS NOT NULL`,
            `LOWER(job_description) LIKE '%${word}%'`,
          ];

          filters.push(`(${likeFields.join(" OR ")})`);
        });
      }

      const whereClause =
        filters.length > 0 ? "WHERE " + filters.join(" AND ") : "";

      const query = `SELECT
                        id,
                        user_id,
                        company_name,
                        company_logo,
                        job_title,
                        job_nature,
                        duration_period,
                        workplace_type,
                        work_location,
                        job_category,
                        skills,
                        experience_type,
                        experience_required,
                        salary_type,
                        min_salary,
                        max_salary,
                        diversity_hiring,
                        benefits,
                        openings,
                        working_days,
                        salary_duration,
                        created_at,
                        CASE WHEN is_closed = 1 THEN 1 ELSE 0 END AS is_closed
                    FROM
                        job_post
                    ${whereClause}`;
      const [result] = await pool.query(query);

      const now = dayjs().tz("Asia/Kolkata");

      const safeParse = (value) => {
        try {
          return typeof value === 'string' ? JSON.parse(value) : (value || []);
        } catch {
          return Array.isArray(value) ? value : (value ? [value] : []);
        }
      };

      // Convert string to array
      const getPosts = result.map((row) => {
        return {
          ...row,
          date_posted: dayjs(row.created_at).tz("Asia/Kolkata").from(now),
          duration_period: safeParse(row.duration_period),
          job_category: safeParse(row.job_category),
          skills: safeParse(row.skills),
          experience_required: safeParse(row.experience_required),
          diversity_hiring: safeParse(row.diversity_hiring),
          benefits: safeParse(row.benefits),
        };
      });
      return getPosts;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getAppliedCandidatesCount: async (user_id) => {
    try {
      const [userRow] = await pool.query("SELECT role_id FROM users WHERE id = ?", [user_id]);
      const role_id = userRow.length > 0 ? userRow[0].role_id : null;

      let query, getGenderQuery, domainQuery;
      let params = [];

      if (role_id === 1) {
        query = `SELECT
                        COUNT(aj.id) AS total_candidates,
                        SUM(CASE WHEN latest_status.status = 'Shortlisted' THEN 1 ELSE 0 END) AS shortlisted_count,
                        SUM(CASE WHEN latest_status.status = 'Interview' THEN 1 ELSE 0 END) AS interview_count,
                        SUM(CASE WHEN latest_status.status = 'Hired' THEN 1 ELSE 0 END) AS hired_count
                    FROM
                        job_post AS j
                    INNER JOIN applied_jobs AS aj ON        
                      j.id = aj.postId
                    LEFT JOIN (
                        SELECT applied_job_id, status
                        FROM applied_job_status_history
                        WHERE id IN (
                            SELECT MAX(id)
                            FROM applied_job_status_history
                            GROUP BY applied_job_id
                        )
                    ) AS latest_status ON aj.id = latest_status.applied_job_id`;

        getGenderQuery = `SELECT
                                  COUNT(CASE WHEN u.gender = 'Male' THEN 1 END) AS male_count,
                                  COUNT(CASE WHEN u.gender = 'Female' THEN 1 END) AS female_count,
                                  COUNT(CASE WHEN u.gender NOT IN ('Male', 'Female') OR u.gender IS NULL THEN 1 END) AS others_count
                              FROM
                                  job_post AS j
                              INNER JOIN applied_jobs AS aj ON
                                  j.id = aj.postId
                              INNER JOIN users AS u ON
                                  u.id = aj.userId;`;

        domainQuery = `SELECT
                              JSON_UNQUOTE(
                                  JSON_EXTRACT(j.job_category, '$[0]')
                              ) AS job_categories,
                              IFNULL(COUNT(aj.userId), 0) AS candidates_count
                          FROM
                              job_post AS j
                          INNER JOIN applied_jobs AS aj ON j.id = aj.postId
                          GROUP BY job_categories`;
      } else {
        query = `SELECT
                        COUNT(aj.id) AS total_candidates,
                        SUM(CASE WHEN latest_status.status = 'Shortlisted' THEN 1 ELSE 0 END) AS shortlisted_count,
                        SUM(CASE WHEN latest_status.status = 'Interview' THEN 1 ELSE 0 END) AS interview_count,
                        SUM(CASE WHEN latest_status.status = 'Hired' THEN 1 ELSE 0 END) AS hired_count
                    FROM
                        job_post AS j
                    INNER JOIN applied_jobs AS aj ON        
                      j.id = aj.postId
                    LEFT JOIN (
                        SELECT applied_job_id, status
                        FROM applied_job_status_history
                        WHERE id IN (
                            SELECT MAX(id)
                            FROM applied_job_status_history
                            GROUP BY applied_job_id
                        )
                    ) AS latest_status ON aj.id = latest_status.applied_job_id
                    WHERE
                        j.user_id = ?`;

        getGenderQuery = `SELECT
                                  COUNT(CASE WHEN u.gender = 'Male' THEN 1 END) AS male_count,
                                  COUNT(CASE WHEN u.gender = 'Female' THEN 1 END) AS female_count,
                                  COUNT(CASE WHEN u.gender NOT IN ('Male', 'Female') OR u.gender IS NULL THEN 1 END) AS others_count
                              FROM
                                  job_post AS j
                              INNER JOIN applied_jobs AS aj ON
                                  j.id = aj.postId
                              INNER JOIN users AS u ON
                                  u.id = aj.userId
                              WHERE
                                  j.user_id = ?;`;

        domainQuery = `SELECT
                              JSON_UNQUOTE(
                                  JSON_EXTRACT(j.job_category, '$[0]')
                              ) AS job_categories,
                              IFNULL(COUNT(aj.userId), 0) AS candidates_count
                          FROM
                              job_post AS j
                          INNER JOIN applied_jobs AS aj ON j.id = aj.postId
                          WHERE
                              j.user_id = ? GROUP BY job_categories`;
        params.push(user_id);
      }

      const jobsCountQuery = role_id === 1
        ? "SELECT COUNT(*) as count FROM job_post"
        : "SELECT COUNT(*) as count FROM job_post WHERE user_id = ?";
      const jobsCountParams = role_id === 1 ? [] : [user_id];
      const [jobsCountResult] = await pool.query(jobsCountQuery, jobsCountParams);

      const jobStatusQuery = role_id === 1
        ? "SELECT is_closed, COUNT(*) as count FROM job_post GROUP BY is_closed"
        : "SELECT is_closed, COUNT(*) as count FROM job_post WHERE user_id = ? GROUP BY is_closed";
      const [jobStatusResult] = await pool.query(jobStatusQuery, jobsCountParams);

      const monthlyAppQuery = role_id === 1
        ? `SELECT DATE_FORMAT(created_at, '%b') AS month, COUNT(*) AS count FROM applied_jobs GROUP BY month ORDER BY MIN(created_at) ASC LIMIT 7`
        : `SELECT DATE_FORMAT(aj.created_at, '%b') AS month, COUNT(*) AS count FROM applied_jobs aj INNER JOIN job_post j ON aj.postId = j.id WHERE j.user_id = ? GROUP BY month ORDER BY MIN(aj.created_at) ASC LIMIT 7`;
      const [monthlyAppResult] = await pool.query(monthlyAppQuery, jobsCountParams);

      const [candidatesCount] = await pool.query(query, params);
      const [getGenderStats] = await pool.query(getGenderQuery, params);
      const [getDomainStats] = await pool.query(domainQuery, params);

      return {
        postedJobsCount: jobsCountResult[0]?.count || 0,
        job_status_stats: jobStatusResult,
        monthly_applications: monthlyAppResult,
        candidatesCount: candidatesCount[0].total_candidates,
        shortlisted: candidatesCount[0].shortlisted_count || 0,
        interviews: candidatesCount[0].interview_count || 0,
        hired: candidatesCount[0].hired_count || 0,
        males: getGenderStats[0].male_count,
        females: getGenderStats[0].female_count,
        others: getGenderStats[0].others_count,
        domain_stats: getDomainStats,
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  StatsOfPost: async (user_id, job_post_id) => {
    try {
      const [userRow] = await pool.query("SELECT role_id FROM users WHERE id = ?", [user_id]);
      const role_id = userRow.length > 0 ? userRow[0].role_id : null;

      let getquery, getGenderQuery;
      let values = [];

      if (role_id === 1) {
        getquery = `SELECT
                          COUNT(*) AS total_candidates
                      FROM
                          job_post AS j
                      INNER JOIN applied_jobs AS aj ON j.id = aj.postId
                      WHERE
                          j.id = ?`;

        getGenderQuery = `SELECT
                                    COUNT(CASE WHEN u.gender = 'Male' THEN 1 END) AS male_count,
                                    COUNT(CASE WHEN u.gender = 'Female' THEN 1 END) AS female_count,
                                    COUNT(CASE WHEN u.gender NOT IN ('Male', 'Female') OR u.gender IS NULL THEN 1 END) AS others_count
                                FROM
                                    job_post AS j
                                INNER JOIN applied_jobs AS aj ON j.id = aj.postId
                                INNER JOIN users AS u ON u.id = aj.userId
                                WHERE
                                    j.id = ?;`;
        values.push(job_post_id);
      } else {
        getquery = `SELECT
                          COUNT(*) AS total_candidates
                      FROM
                          job_post AS j
                      INNER JOIN applied_jobs AS aj ON j.id = aj.postId
                      WHERE
                          j.user_id = ? AND j.id = ?`;

        getGenderQuery = `SELECT
                                    COUNT(CASE WHEN u.gender = 'Male' THEN 1 END) AS male_count,
                                    COUNT(CASE WHEN u.gender = 'Female' THEN 1 END) AS female_count,
                                    COUNT(CASE WHEN u.gender NOT IN ('Male', 'Female') OR u.gender IS NULL THEN 1 END) AS others_count
                                FROM
                                    job_post AS j
                                INNER JOIN applied_jobs AS aj ON j.id = aj.postId
                                INNER JOIN users AS u ON u.id = aj.userId
                                WHERE
                                    j.user_id = ? AND j.id = ?;`;
        values.push(user_id, job_post_id);
      }

      const [candidatesCount] = await pool.query(getquery, values);
      const [getGenderStats] = await pool.query(getGenderQuery, values);

      return {
        candidatesCount: candidatesCount[0].total_candidates,
        males: getGenderStats[0].male_count,
        females: getGenderStats[0].female_count,
        others: getGenderStats[0].others_count,
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getAllCandidateByRecruiter: async (user_id, limit, page) => {
    try {
      const [userRow] = await pool.query("SELECT role_id FROM users WHERE id = ?", [user_id]);
      const role_id = userRow.length > 0 ? userRow[0].role_id : null;

      let getquery, countQuery;
      let params = [];
      let countParams = [];

      if (role_id === 1) {
        countQuery = `SELECT COUNT(*) AS total
                      FROM job_post AS j
                      INNER JOIN applied_jobs AS aj ON j.id = aj.postId
                      INNER JOIN users AS u ON aj.userId = u.id`;

        getquery = `SELECT
                            u.id AS user_id,
                            u.first_name,
                            u.last_name,
                            u.email,
                            u.phone_code,
                            u.profile_image,
                            u.phone,
                            j.id AS job_post_id,
                            j.job_title,
                            j.company_name,
                            aj.id AS applied_jobs_id,
                            aj.created_at,
                            latest_status.status
                        FROM
                            job_post AS j
                        INNER JOIN applied_jobs AS aj ON
                          j.id = aj.postId
                        INNER JOIN users AS u ON
                          aj.userId = u.id
                        LEFT JOIN (
                            SELECT applied_job_id, status
                            FROM applied_job_status_history
                            WHERE id IN (
                                SELECT MAX(id)
                                FROM applied_job_status_history
                                GROUP BY applied_job_id
                            )
                        ) AS latest_status ON aj.id = latest_status.applied_job_id
                        ORDER BY aj.created_at DESC`;
      } else {
        countQuery = `SELECT COUNT(*) AS total
                      FROM job_post AS j
                      INNER JOIN applied_jobs AS aj ON j.id = aj.postId
                      INNER JOIN users AS u ON aj.userId = u.id
                      WHERE j.user_id = ?`;
        countParams.push(user_id);

        getquery = `SELECT
                            u.id AS user_id,
                            u.first_name,
                            u.last_name,
                            u.email,
                            u.phone_code,
                            u.profile_image,
                            u.phone,
                            j.id AS job_post_id,
                            j.job_title,
                            j.company_name,
                            aj.id AS applied_jobs_id,
                            aj.created_at,
                            latest_status.status
                        FROM
                            job_post AS j
                        INNER JOIN applied_jobs AS aj ON
                          j.id = aj.postId
                        INNER JOIN users AS u ON
                          aj.userId = u.id
                        LEFT JOIN (
                            SELECT applied_job_id, status
                            FROM applied_job_status_history
                            WHERE id IN (
                                SELECT MAX(id)
                                FROM applied_job_status_history
                                GROUP BY applied_job_id
                            )
                        ) AS latest_status ON aj.id = latest_status.applied_job_id
                        WHERE
                            j.user_id = ? ORDER BY aj.created_at DESC`;
        params.push(user_id);
      }

      const [countResult] = await pool.query(countQuery, countParams);
      const total = countResult[0]?.total || 0;

      if (limit && page) {
        const offset = (page - 1) * limit;
        getquery += ` LIMIT ? OFFSET ?`;
        params.push(Number(limit), Number(offset));
      }

      const [candidates] = await pool.query(getquery, params);
      return {
        candidates,
        total
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getAllAppliedCandidates: async (limit, page) => {
    try {
      const countQuery = `SELECT COUNT(*) AS total
                          FROM applied_jobs AS aj
                          INNER JOIN job_post AS j ON j.id = aj.postId
                          INNER JOIN users AS u ON u.id = aj.userId`;
      const [countResult] = await pool.query(countQuery);
      const total = countResult[0]?.total || 0;

      let query = `
        SELECT
            u.id AS user_id,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            u.profile_image,
            j.id AS job_post_id,
            j.job_title,
            j.company_name,
            j.recruiter_name,
            ru.first_name AS recruiter_first_name,
            ru.last_name AS recruiter_last_name,
            ru.email AS recruiter_email,
            aj.id AS applied_jobs_id,
            aj.created_at,
            aj.status AS applied_status
        FROM applied_jobs AS aj
        INNER JOIN job_post AS j ON j.id = aj.postId
        INNER JOIN users AS u ON u.id = aj.userId
        LEFT JOIN users AS ru ON ru.id = j.user_id
        ORDER BY aj.created_at DESC
      `;
      let params = [];
      if (limit && page) {
        const offset = (page - 1) * limit;
        query += ` LIMIT ? OFFSET ?`;
        params.push(Number(limit), Number(offset));
      }
      const [candidates] = await pool.query(query, params);
      return {
        candidates,
        total
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getHomePageStats: async () => {
    try {
      const now = Date.now();
      if (homePageStatsCache && (now - homePageStatsCacheTime < STATS_CACHE_TTL)) {
        return homePageStatsCache;
      }

      const [[jobsCount], [recruitersCount], [applicationsCount]] = await Promise.all([
        pool.query("SELECT COUNT(*) as total FROM job_post"),
        pool.query("SELECT COUNT(DISTINCT company_name) as total FROM job_post"),
        pool.query("SELECT COUNT(*) as total FROM applied_jobs")
      ]);

      homePageStatsCache = {
        totalJobs: jobsCount[0]?.total || 0,
        totalRecruiters: recruitersCount[0]?.total || 0,
        totalApplications: applicationsCount[0]?.total || 0
      };
      homePageStatsCacheTime = now;

      return homePageStatsCache;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getTrendingSearches: async () => {
    try {
      const now = Date.now();
      if (trendingSearchesCache && (now - trendingSearchesCacheTime < TRENDING_CACHE_TTL)) {
        return trendingSearchesCache;
      }

      // Get all work locations for 'Job'
      const [jobPosts] = await pool.query(
        "SELECT work_location FROM job_post WHERE job_nature = 'Job' AND work_location IS NOT NULL"
      );

      const locationCounts = {};
      jobPosts.forEach(post => {
        try {
          const locations = typeof post.work_location === 'string' ? JSON.parse(post.work_location) : post.work_location;
          if (Array.isArray(locations)) {
            locations.forEach(loc => {
              if (loc) {
                locationCounts[loc] = (locationCounts[loc] || 0) + 1;
              }
            });
          }
        } catch (e) {
          // Ignore invalid JSON
        }
      });

      const trendingLocations = Object.entries(locationCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([location, count]) => ({ location, count }));

      // Get all categories for 'Internship'
      const [internshipPosts] = await pool.query(
        "SELECT job_category FROM job_post WHERE job_nature = 'Internship' AND job_category IS NOT NULL"
      );

      const categoryCounts = {};
      internshipPosts.forEach(post => {
        try {
          const categories = typeof post.job_category === 'string' ? JSON.parse(post.job_category) : post.job_category;
          if (Array.isArray(categories)) {
            categories.forEach(cat => {
              if (cat) {
                categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
              }
            });
          }
        } catch (e) {
          // Ignore invalid JSON
        }
      });

      const trendingCategories = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([category, count]) => ({ category, count }));

      const trending = [];

      trendingLocations.forEach(item => {
        trending.push({
          label: `jobs, ${item.location}`,
          count: item.count,
          isNew: true
        });
      });

      trendingCategories.forEach(item => {
        trending.push({
          label: `internship, ${item.category}`,
          count: item.count,
          isNew: true
        });
      });

      trendingSearchesCache = trending;
      trendingSearchesCacheTime = now;

      return trending;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getUniqueCompanies: async () => {
    try {
      const [companies] = await pool.query(
        "SELECT DISTINCT TRIM(COALESCE(NULLIF(job_post.company_name, ''), hr_profiles.company_name)) AS company_name FROM job_post LEFT JOIN hr_profiles ON job_post.user_id = hr_profiles.user_id WHERE COALESCE(NULLIF(job_post.company_name, ''), hr_profiles.company_name) IS NOT NULL AND TRIM(COALESCE(NULLIF(job_post.company_name, ''), hr_profiles.company_name)) != '' ORDER BY company_name ASC"
      );
      return companies.map(c => c.company_name);
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getTopCompanies: async (limit = 12) => {
    try {
      const numLimit = Math.max(1, Math.min(50, Number(limit) || 12));
      const [companies] = await pool.query(`
        SELECT 
          TRIM(COALESCE(NULLIF(job_post.company_name, ''), hr_profiles.company_name)) AS name,
          MAX(CASE 
            WHEN job_post.company_logo IS NOT NULL AND job_post.company_logo != '' AND job_post.company_logo NOT LIKE '%dummy%' 
            THEN job_post.company_logo 
            WHEN hr_profiles.profile_image IS NOT NULL AND hr_profiles.profile_image != '' AND hr_profiles.profile_image NOT LIKE '%dummy%'
            THEN hr_profiles.profile_image 
            ELSE NULL 
          END) AS logo,
          COALESCE(MAX(NULLIF(job_post.industry, '')), MAX(NULLIF(job_post.candidate_industry, '')), 'Information Technology') AS type,
          COUNT(*) AS active_jobs
        FROM job_post
        LEFT JOIN hr_profiles ON job_post.user_id = hr_profiles.user_id
        WHERE (job_post.is_closed = 0 OR job_post.is_closed IS NULL)
          AND (job_post.approval_status = 'Approved' OR job_post.approval_status IS NULL)
          AND COALESCE(NULLIF(job_post.company_name, ''), hr_profiles.company_name) IS NOT NULL
          AND TRIM(COALESCE(NULLIF(job_post.company_name, ''), hr_profiles.company_name)) != ''
        GROUP BY TRIM(COALESCE(NULLIF(job_post.company_name, ''), hr_profiles.company_name))
        ORDER BY active_jobs DESC
        LIMIT ?
      `, [numLimit]);

      return companies.map((c) => {
        const hash = (c.name || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const rating = (4.2 + (hash % 8) / 10).toFixed(1);
        const reviewsCount = ((hash % 25) + 5) * 1.2;
        const reviews = `${reviewsCount.toFixed(1)}k reviews`;

        return {
          name: c.name,
          logo: c.logo || null,
          type: c.type || 'Information Technology',
          active_jobs: Number(c.active_jobs) || 1,
          rating: rating,
          reviews: reviews
        };
      });
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getSearchSuggestions: async (query = "", type = "all") => {
    try {
      const cleanQ = (query || "").trim().toLowerCase();
      const suggestions = {
        roles: [],
        skills: [],
        companies: [],
        locations: []
      };

      // Rich curated standard industry data for instantaneous and complete Naukri-style suggestions
      const standardRoles = [
        "Software Engineer", "Frontend Developer", "Backend Developer", "Full Stack Developer",
        "Data Analyst", "Data Scientist", "Data Engineer", "Database Administrator", "Big Data Engineer",
        "Python Developer", "Java Developer", "React Developer", "Node.js Developer", "Angular Developer",
        "DevOps Engineer", "Cloud Architect", "Product Manager", "Project Manager", "Scrum Master",
        "UI/UX Designer", "Graphic Designer", "QA Engineer", "Automation Tester", "Manual Tester",
        "Business Analyst", "Digital Marketing Executive", "SEO Specialist", "Content Writer",
        "HR Executive", "HR Manager", "Talent Acquisition Specialist", "Sales Manager", "Business Development Executive",
        "Accountant", "Financial Analyst", "Operations Manager", "Customer Support Executive", "Technical Support"
      ];

      const standardSkills = [
        "JavaScript", "TypeScript", "React.js", "Node.js", "Python", "Java", "C++", "C#", ".NET",
        "SQL", "MySQL", "PostgreSQL", "MongoDB", "Data Analysis", "Data Science", "Machine Learning",
        "Artificial Intelligence", "Deep Learning", "Power BI", "Tableau", "Excel", "Advanced Excel",
        "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Linux", "CI/CD",
        "Git", "GitHub", "HTML5", "CSS3", "Tailwind CSS", "REST APIs", "GraphQL", "Microservices",
        "Figma", "UI Design", "UX Research", "Digital Marketing", "SEO", "SEM", "Google Analytics",
        "Content Writing", "Social Media Marketing", "Lead Generation", "B2B Sales", "Communication Skills",
        "Project Management", "Agile", "Scrum", "Financial Modeling", "Accounting", "Tally ERP"
      ];

      const standardLocations = [
        "Bangalore / Bengaluru", "Chennai", "Hyderabad / Secunderabad", "Mumbai (All Areas)",
        "Delhi / NCR", "Noida", "Gurgaon / Gurugram", "Pune", "Kolkata", "Ahmedabad",
        "Remote / Work From Home", "Coimbatore", "Kochi / Cochin", "Jaipur", "Chandigarh",
        "Indore", "Visakhapatnam", "Bhubaneswar", "Trivandrum", "Vadodara", "Nagpur", "Mysore"
      ];

      const standardCompanies = [
        "Tata Consultancy Services (TCS)", "Infosys", "Wipro", "Accenture", "Cognizant",
        "HCL Technologies", "Capgemini", "IBM", "Tech Mahindra", "Amazon", "Microsoft",
        "Google", "Flipkart", "Deloitte", "LTIMindtree", "Oracle", "Cisco", "Paytm", "Swiggy", "Zomato"
      ];

      if (!cleanQ) {
        return {
          roles: standardRoles.slice(0, 8).map(r => ({ label: r, type: "designation" })),
          skills: standardSkills.slice(0, 8).map(s => ({ label: s, type: "skill" })),
          companies: standardCompanies.slice(0, 6).map(c => ({ label: c, type: "company" })),
          locations: standardLocations.slice(0, 8).map(l => ({ label: l, type: "location" }))
        };
      }

      // 1. Roles / Designations
      if (type === "all" || type === "roles" || type === "designations") {
        try {
          const [dbTitles] = await pool.query(
            `SELECT job_title, COUNT(*) as count 
             FROM job_post 
             WHERE LOWER(job_title) LIKE ? AND (is_closed = 0 OR is_closed IS NULL)
             GROUP BY job_title 
             ORDER BY count DESC 
             LIMIT 10`,
            [`%${cleanQ}%`]
          );
          
          const roleMap = new Map();
          dbTitles.forEach(row => {
            if (row.job_title && row.job_title.trim()) {
              const title = row.job_title.trim();
              roleMap.set(title.toLowerCase(), { label: title, count: row.count, type: "designation" });
            }
          });

          standardRoles
            .filter(r => r.toLowerCase().includes(cleanQ))
            .forEach(r => {
              if (!roleMap.has(r.toLowerCase())) {
                roleMap.set(r.toLowerCase(), { label: r, type: "designation" });
              }
            });

          suggestions.roles = Array.from(roleMap.values()).slice(0, 8);
        } catch (e) {
          console.error("Error fetching db titles for suggestion:", e);
        }
      }

      // 2. Skills
      if (type === "all" || type === "skills") {
        try {
          const skillMap = new Map();

          standardSkills
            .filter(s => s.toLowerCase().includes(cleanQ))
            .forEach(s => {
              skillMap.set(s.toLowerCase(), { label: s, type: "skill" });
            });

          const [dbSkills] = await pool.query(
            `SELECT skills FROM job_post WHERE skills IS NOT NULL AND (is_closed = 0 OR is_closed IS NULL) LIMIT 100`
          );
          dbSkills.forEach(row => {
            try {
              const parsed = typeof row.skills === 'string' ? JSON.parse(row.skills) : row.skills;
              if (Array.isArray(parsed)) {
                parsed.forEach(skill => {
                  if (typeof skill === 'string' && skill.toLowerCase().includes(cleanQ)) {
                    const trimmed = skill.trim();
                    if (!skillMap.has(trimmed.toLowerCase())) {
                      skillMap.set(trimmed.toLowerCase(), { label: trimmed, type: "skill" });
                    }
                  }
                });
              }
            } catch (err) {}
          });

          suggestions.skills = Array.from(skillMap.values()).slice(0, 8);
        } catch (e) {
          console.error("Error fetching skills for suggestion:", e);
        }
      }

      // 3. Companies
      if (type === "all" || type === "companies") {
        try {
          const [dbCompanies] = await pool.query(
            `SELECT TRIM(COALESCE(NULLIF(job_post.company_name, ''), hr_profiles.company_name)) AS name, COUNT(*) as count 
             FROM job_post 
             LEFT JOIN hr_profiles ON job_post.user_id = hr_profiles.user_id 
             WHERE (LOWER(job_post.company_name) LIKE ? OR LOWER(hr_profiles.company_name) LIKE ?) 
               AND (job_post.is_closed = 0 OR job_post.is_closed IS NULL)
             GROUP BY TRIM(COALESCE(NULLIF(job_post.company_name, ''), hr_profiles.company_name))
             ORDER BY count DESC 
             LIMIT 6`,
            [`%${cleanQ}%`, `%${cleanQ}%`]
          );

          const compMap = new Map();
          dbCompanies.forEach(c => {
            if (c.name && c.name.trim()) {
              compMap.set(c.name.toLowerCase(), { label: c.name.trim(), count: c.count, type: "company" });
            }
          });

          standardCompanies
            .filter(c => c.toLowerCase().includes(cleanQ))
            .forEach(c => {
              if (!compMap.has(c.toLowerCase())) {
                compMap.set(c.toLowerCase(), { label: c, type: "company" });
              }
            });

          suggestions.companies = Array.from(compMap.values()).slice(0, 6);
        } catch (e) {
          console.error("Error fetching companies for suggestion:", e);
        }
      }

      // 4. Locations
      if (type === "all" || type === "locations") {
        try {
          const locMap = new Map();
          standardLocations
            .filter(l => l.toLowerCase().includes(cleanQ))
            .forEach(l => {
              locMap.set(l.toLowerCase(), { label: l, type: "location" });
            });

          const [dbLocs] = await pool.query(
            `SELECT work_location FROM job_post WHERE work_location IS NOT NULL AND (is_closed = 0 OR is_closed IS NULL) LIMIT 100`
          );
          dbLocs.forEach(row => {
            try {
              const parsed = typeof row.work_location === 'string' ? JSON.parse(row.work_location) : row.work_location;
              const locArray = Array.isArray(parsed) ? parsed : [row.work_location];
              locArray.forEach(loc => {
                if (typeof loc === 'string' && loc.toLowerCase().includes(cleanQ)) {
                  const trimmed = loc.trim();
                  if (!locMap.has(trimmed.toLowerCase())) {
                    locMap.set(trimmed.toLowerCase(), { label: trimmed, type: "location" });
                  }
                }
              });
            } catch (err) {}
          });

          suggestions.locations = Array.from(locMap.values()).slice(0, 8);
        } catch (e) {
          console.error("Error fetching locations for suggestion:", e);
        }
      }

      return suggestions;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getSuperAdminDashboardData: async (timeFilter, startDate = null, endDate = null) => {
    try {
      let uDateCond = "";
      let jDateCond = "";
      if (startDate && endDate) {
        uDateCond = ` AND DATE(created_date) BETWEEN '${startDate}' AND '${endDate}'`;
        jDateCond = ` AND DATE(created_at) BETWEEN '${startDate}' AND '${endDate}'`;
      } else if (startDate) {
        uDateCond = ` AND DATE(created_date) >= '${startDate}'`;
        jDateCond = ` AND DATE(created_at) >= '${startDate}'`;
      } else if (endDate) {
        uDateCond = ` AND DATE(created_date) <= '${endDate}'`;
        jDateCond = ` AND DATE(created_at) <= '${endDate}'`;
      } else if (timeFilter === "Today") {
        uDateCond = " AND DATE(created_date) = CURDATE()";
        jDateCond = " AND DATE(created_at) = CURDATE()";
      } else if (timeFilter === "Yesterday") {
        uDateCond = " AND DATE(created_date) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)";
        jDateCond = " AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)";
      } else if (timeFilter === "Last 7 Days") {
        uDateCond = " AND created_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
        jDateCond = " AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
      } else if (timeFilter === "Last 30 Days") {
        uDateCond = " AND created_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
        jDateCond = " AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
      } else if (timeFilter === "This Month") {
        uDateCond = " AND created_date >= DATE_FORMAT(NOW(), '%Y-%m-01')";
        jDateCond = " AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')";
      } else if (timeFilter === "Last Month") {
        uDateCond = " AND created_date >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m-01') AND created_date < DATE_FORMAT(NOW(), '%Y-%m-01')";
        jDateCond = " AND created_at >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m-01') AND created_at < DATE_FORMAT(NOW(), '%Y-%m-01')";
      } else if (timeFilter === "This Quarter") {
        uDateCond = " AND created_date >= DATE_SUB(NOW(), INTERVAL 3 MONTH)";
        jDateCond = " AND created_at >= DATE_SUB(NOW(), INTERVAL 3 MONTH)";
      } else if (timeFilter === "This Year") {
        uDateCond = " AND created_date >= DATE_SUB(NOW(), INTERVAL 1 YEAR)";
        jDateCond = " AND created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)";
      }

      const results = await Promise.all([
        pool.query(`SELECT COUNT(*) as total FROM users WHERE role_id = 2${uDateCond}`),
        pool.query(`SELECT COUNT(*) as total FROM users WHERE role_id = 3${uDateCond}`),
        pool.query(`SELECT COUNT(*) as total FROM job_post WHERE 1=1${jDateCond}`),
        pool.query(`SELECT COUNT(*) as total FROM applied_jobs WHERE 1=1${jDateCond}`),
        pool.query(`
          SELECT id, first_name, last_name, email, phone, location, created_date, is_active, profile_image 
          FROM users 
          WHERE role_id = 2 
          ORDER BY created_date DESC
          LIMIT 10
        `),
        pool.query(`
          SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.organization, u.location, u.created_date, u.is_active, u.profile_image,
                 (SELECT COUNT(*) FROM job_post jp WHERE jp.user_id = u.id) AS jobs_count
          FROM users u
          WHERE u.role_id = 3 
          ORDER BY u.created_date DESC
          LIMIT 10
        `),
        pool.query(`
          SELECT jp.id, jp.job_title, jp.company_name, jp.job_nature, jp.workplace_type, jp.openings, jp.created_at, jp.user_id, jp.company_logo,
                 jp.work_location, jp.is_closed, jp.approval_status, jp.min_salary, jp.max_salary, jp.salary_type, jp.currency, jp.experience_type,
                 CONCAT(u.first_name, ' ', u.last_name) AS recruiter_name, u.email AS recruiter_email, u.profile_image
          FROM job_post jp
          LEFT JOIN users u ON jp.user_id = u.id
          ORDER BY jp.created_at DESC
          LIMIT 10
        `),
        pool.query(`
          SELECT 
              aj.id AS applied_jobs_id,
              aj.created_at,
              u.first_name,
              u.last_name,
              u.email,
              j.job_title,
              j.company_name,
              COALESCE(
                  (SELECT ash.status 
                   FROM applied_job_status_history ash 
                   WHERE ash.applied_job_id = aj.id 
                   ORDER BY ash.changed_at DESC LIMIT 1), 
                  'Pending'
              ) AS status
          FROM applied_jobs aj
          INNER JOIN job_post j ON aj.postId = j.id
          INNER JOIN users u ON aj.userId = u.id
          ORDER BY aj.created_at DESC
          LIMIT 10
        `),
        pool.query(`
          SELECT DATE_FORMAT(created_date, '%Y-%m') AS month, COUNT(*) AS count 
          FROM users 
          WHERE role_id = 2 AND created_date IS NOT NULL
          GROUP BY month 
          ORDER BY month ASC
        `),
        pool.query(`
          SELECT DATE_FORMAT(created_date, '%Y-%m') AS month, COUNT(*) AS count 
          FROM users 
          WHERE role_id = 3 AND created_date IS NOT NULL
          GROUP BY month 
          ORDER BY month ASC
        `),
        pool.query(`
          SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count 
          FROM job_post 
          WHERE created_at IS NOT NULL
          GROUP BY month 
          ORDER BY month ASC
        `),
        pool.query(`
          SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count 
          FROM applied_jobs 
          WHERE created_at IS NOT NULL
          GROUP BY month 
          ORDER BY month ASC
        `),
        pool.query(`
          SELECT workplace_type, COUNT(*) as count 
          FROM job_post 
          WHERE workplace_type IS NOT NULL AND workplace_type != ''${jDateCond}
          GROUP BY workplace_type
        `),
        pool.query(`
          SELECT status, COUNT(*) AS count
          FROM (
              SELECT 
                  COALESCE(
                      (SELECT ash.status 
                       FROM applied_job_status_history ash 
                       WHERE ash.applied_job_id = aj.id 
                       ORDER BY ash.changed_at DESC LIMIT 1), 
                      'Pending'
                  ) AS status
              FROM applied_jobs aj
              WHERE 1=1${jDateCond}
          ) AS sub
          GROUP BY status
        `),
        pool.query(`SELECT job_category FROM job_post WHERE job_category IS NOT NULL${jDateCond}`),
        pool.query(`SELECT COUNT(id) as activeJobs FROM job_post WHERE is_closed = 0${jDateCond}`),
        (() => {
          if (timeFilter === "Today" || timeFilter === "Yesterday") {
            return pool.query(`
              SELECT DATE_FORMAT(created_date, '%H:00') as name, COUNT(id) as uv 
              FROM users 
              WHERE 1=1${uDateCond}
              GROUP BY name
              ORDER BY name
            `);
          } else if (timeFilter === "Last 7 Days" || timeFilter === "Last 30 Days" || timeFilter === "This Month" || timeFilter === "Last Month") {
            return pool.query(`
              SELECT DATE_FORMAT(created_date, '%b %d') as name, COUNT(id) as uv 
              FROM users 
              WHERE 1=1${uDateCond}
              GROUP BY name, DATE(created_date)
              ORDER BY DATE(created_date)
            `);
          } else if (startDate && endDate) {
            return pool.query(`
              SELECT DATE_FORMAT(created_date, '%b %d') as name, COUNT(id) as uv 
              FROM users 
              WHERE 1=1${uDateCond}
              GROUP BY name, DATE(created_date)
              ORDER BY DATE(created_date)
            `);
          } else {
            return pool.query(`
              SELECT DATE_FORMAT(created_date, '%b %Y') as name, COUNT(id) as uv 
              FROM users 
              WHERE 1=1${uDateCond}
              GROUP BY name, YEAR(created_date), MONTH(created_date)
              ORDER BY YEAR(created_date), MONTH(created_date)
            `);
          }
        })(),
        (() => {
          if (timeFilter === "Today" || timeFilter === "Yesterday") {
            return pool.query(`
              SELECT DATE_FORMAT(created_at, '%H:00') as name, COUNT(id) as pv 
              FROM applied_jobs 
              WHERE 1=1${jDateCond}
              GROUP BY name
              ORDER BY name
            `);
          } else if (timeFilter === "Last 7 Days" || timeFilter === "Last 30 Days" || timeFilter === "This Month" || timeFilter === "Last Month") {
            return pool.query(`
              SELECT DATE_FORMAT(created_at, '%b %d') as name, COUNT(id) as pv 
              FROM applied_jobs 
              WHERE 1=1${jDateCond}
              GROUP BY name, DATE(created_at)
              ORDER BY DATE(created_at)
            `);
          } else if (startDate && endDate) {
            return pool.query(`
              SELECT DATE_FORMAT(created_at, '%b %d') as name, COUNT(id) as pv 
              FROM applied_jobs 
              WHERE 1=1${jDateCond}
              GROUP BY name, DATE(created_at)
              ORDER BY DATE(created_at)
            `);
          } else {
            return pool.query(`
              SELECT DATE_FORMAT(created_at, '%b %Y') as name, COUNT(id) as pv 
              FROM applied_jobs 
              WHERE 1=1${jDateCond}
              GROUP BY name, YEAR(created_at), MONTH(created_at)
              ORDER BY YEAR(created_at), MONTH(created_at)
            `);
          }
        })(),
        pool.query(`
          SELECT job_nature as name, COUNT(id) as value 
          FROM job_post
          WHERE 1=1${jDateCond}
          GROUP BY job_nature
        `)
      ]);

      const candidatesCount = results[0][0];
      const recruitersCount = results[1][0];
      const jobsCount = results[2][0];
      const applicationsCount = results[3][0];
      const candidatesList = results[4][0];
      const recruitersList = results[5][0];
      const jobsList = results[6][0];
      const applicationsList = results[7][0];
      const monthlyCandidates = results[8][0];
      const monthlyRecruiters = results[9][0];
      const monthlyJobs = results[10][0];
      const monthlyApplications = results[11][0];
      const workplaceStats = results[12][0];
      const statusStats = results[13][0];
      const categoriesData = results[14][0];
      const activeJobsRes = results[15][0];
      const activeJobs = activeJobsRes.length > 0 ? activeJobsRes[0].activeJobs : 0;
      const userGrowth = results[16][0];
      const applicationTrends = results[17][0];
      const jobsByNatureRaw = results[18][0];

      const jobsByCategory = jobsByNatureRaw.map(j => ({ name: j.name || 'Other', value: j.value }));

      return {
        counts: {
          candidates: candidatesCount[0].total,
          recruiters: recruitersCount[0].total,
          jobs: jobsCount[0].total,
          applications: applicationsCount[0].total,
        },
        lists: {
          candidates: candidatesList,
          recruiters: recruitersList,
          jobs: jobsList,
          applications: applicationsList,
        },
        monthlyData: {
          candidates: monthlyCandidates,
          recruiters: monthlyRecruiters,
          jobs: monthlyJobs,
          applications: monthlyApplications,
        },
        distributions: {
          workplace: workplaceStats,
          status: statusStats,
          categories: categoriesData,
        },
        summary: {
          totalUsers: candidatesCount[0].total + recruitersCount[0].total,
          activeJobs,
          totalApplications: applicationsCount[0].total,
          totalEmployers: recruitersCount[0].total
        },
        userGrowth,
        applicationTrends,
        jobsByCategory
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  deleteJobPost: async (job_id) => {
    try {
      await pool.query("DELETE FROM job_post_answers WHERE postId = ?", [job_id]);
      await pool.query("DELETE FROM job_post_questions WHERE post_id = ?", [job_id]);

      // Delete history first since it references applied_jobs.id
      await pool.query("DELETE FROM applied_job_status_history WHERE applied_job_id IN (SELECT id FROM applied_jobs WHERE postId = ?)", [job_id]);

      await pool.query("DELETE FROM applied_jobs WHERE postId = ?", [job_id]);

      const [result] = await pool.query("DELETE FROM job_post WHERE id = ?", [job_id]);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  saveCandidateToDB: async (recruiter_id, candidate_id, applied_jobs_id) => {
    try {
      const query = `
        INSERT IGNORE INTO hr_saved_candidates (recruiter_id, candidate_id, applied_jobs_id)
        VALUES (?, ?, ?)
      `;
      const [result] = await pool.query(query, [recruiter_id, candidate_id, applied_jobs_id || null]);
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getSavedCandidatesFromDB: async (recruiter_id) => {
    try {
      const query = `
        SELECT 
          hsc.candidate_id AS id,
          hsc.applied_jobs_id,
          hsc.created_at,
          u.first_name,
          u.last_name,
          u.profile_image AS avatar,
          u.email,
          u.phone,
          u.location,
          u.total_years,
          u.total_months,
          u.experince_type,
          u.resume,
          u.about,
          u.skills,
          usl.linkedin,
          usl.twitter,
          usl.instagram,
          usl.facebook,
          usl.dribble,
          usl.behance,
          u.gender,
          u.course,
          jp.job_title AS role
        FROM hr_saved_candidates hsc
        JOIN users u ON hsc.candidate_id = u.id
        LEFT JOIN user_social_links usl ON usl.user_id = u.id
        LEFT JOIN applied_jobs aj ON hsc.applied_jobs_id = aj.id
        LEFT JOIN job_post jp ON aj.postId = jp.id
        WHERE hsc.recruiter_id = ?
        ORDER BY hsc.created_at DESC
      `;
      const [rows] = await pool.query(query, [recruiter_id]);
      const safeParse = (str) => {
        if (!str) return null;
        try { return typeof str === 'string' ? JSON.parse(str) : str; }
        catch (e) { return null; }
      };

      return rows.map(row => ({
        id: row.id,
        applied_jobs_id: row.applied_jobs_id,
        name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Candidate',
        role: row.role || 'Applicant',
        avatar: row.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.first_name || 'C')}&background=random`,
        email: row.email,
        phone: row.phone,
        location: row.location,
        resume: row.resume,
        experience: row.total_years ? `${row.total_years} Yrs ${row.total_months ? row.total_months + ' Mos' : ''}` : null,
        about: row.about,
        skills: safeParse(row.skills) || [],
        social_links: {
          linkedin: row.linkedin,
          twitter: row.twitter,
          instagram: row.instagram,
          facebook: row.facebook,
          dribble: row.dribble,
          behance: row.behance
        },
        gender: row.gender,
        education: row.course,
        saved_at: row.created_at
      }));
    } catch (error) {
      throw new Error(error.message);
    }
  },

  removeSavedCandidateFromDB: async (recruiter_id, candidate_id) => {
    try {
      const query = "DELETE FROM hr_saved_candidates WHERE recruiter_id = ? AND candidate_id = ?";
      const [result] = await pool.query(query, [recruiter_id, candidate_id]);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getVenues: async (user_id) => {
    try {
      const [rows] = await pool.query(`SELECT id, address, google_maps_url as url FROM venues WHERE user_id = ? ORDER BY created_at DESC`, [user_id]);
      return rows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  insertVenue: async (user_id, address, google_maps_url) => {
    try {
      const [result] = await pool.query(
        `INSERT INTO venues (user_id, address, google_maps_url) VALUES (?, ?, ?)`,
        [user_id, address, google_maps_url]
      );
      return result.insertId;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getTeamMembers: async (user_id) => {
    try {
      const [rows] = await pool.query(`SELECT id, email FROM hr_team_members WHERE user_id = ? ORDER BY created_at ASC`, [user_id]);
      return rows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  insertTeamMember: async (user_id, email) => {
    try {
      const [result] = await pool.query(
        `INSERT INTO hr_team_members (user_id, email) VALUES (?, ?)`,
        [user_id, email]
      );
      return result.insertId;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  deleteTeamMember: async (id, user_id) => {
    try {
      // First get the email to delete the user account too
      const [rows] = await pool.query(`SELECT email FROM hr_team_members WHERE id = ? AND user_id = ?`, [id, user_id]);
      if (rows.length === 0) return null;

      const email = rows[0].email;

      // Delete from hr_team_members
      await pool.query(`DELETE FROM hr_team_members WHERE id = ? AND user_id = ?`, [id, user_id]);

      return email;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  deleteSubRecruiterUser: async (email) => {
    try {
      // Delete the user from users table (role_id 3 is Recruiter)
      const [result] = await pool.query(`DELETE FROM users WHERE email = ? AND role_id = 3`, [email]);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  deleteJobPost: async (id) => {
    try {
      clearAdminStatsCache();
      const [result] = await pool.query(`DELETE FROM job_post WHERE id = ?`, [id]);
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  registrationClose: async (id) => {
    try {
      clearAdminStatsCache();
      const [result] = await pool.query(
        `UPDATE job_post SET is_closed = 1 WHERE id = ?`,
        [id]
      );
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  makeJobActive: async (id) => {
    try {
      clearAdminStatsCache();
      const [result] = await pool.query(
        `UPDATE job_post SET is_closed = 0 WHERE id = ?`,
        [id]
      );
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateApprovalStatus: async (id, status, reason = null) => {
    try {
      clearAdminStatsCache();
      const isApproved = status === 'approved';
      const [result] = await pool.query(
        isApproved
          ? `UPDATE job_post SET approval_status = ?, rejection_reason = NULL, approved_at = NOW() WHERE id = ?`
          : `UPDATE job_post SET approval_status = ?, rejection_reason = ? WHERE id = ?`,
        isApproved ? [status, id] : [status, reason, id]
      );
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  approveAllJobPosts: async () => {
    try {
      clearAdminStatsCache();
      const [result] = await pool.query(
        `UPDATE job_post SET approval_status = 'approved', rejection_reason = NULL, approved_at = NOW() WHERE approval_status = 'pending' OR approval_status IS NULL`
      );
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

};

module.exports = JobsModel;
