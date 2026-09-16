import os

with open('c:/Users/dell/Documents/Careerfast/careerfast-backend/models/JobsModel.js', 'r') as f:
    content = f.read()

target = """      job_post.min_salary,
      let statsValues = [];
      if (role_id === 1) {
        statsQuery = `
          SELECT 
            SUM(CASE WHEN is_closed = 0 THEN 1 ELSE 0 END) as openJobs,
            SUM(CASE WHEN is_closed != 0 THEN 1 ELSE 0 END) as closedJobs,
            SUM(candidates_count) as totalApplications
          FROM (
            SELECT 
              jp.is_closed, 
              COUNT(DISTINCT aj.id) as candidates_count
            FROM job_post jp
            LEFT JOIN applied_jobs aj ON aj.postId = jp.id
            GROUP BY jp.id
          ) AS sub
        `;
      } else {
        statsQuery = `
          SELECT 
            SUM(CASE WHEN is_closed = 0 THEN 1 ELSE 0 END) as openJobs,
            SUM(CASE WHEN is_closed != 0 THEN 1 ELSE 0 END) as closedJobs,
            SUM(candidates_count) as totalApplications
          FROM (
            SELECT 
              jp.is_closed, 
              COUNT(DISTINCT aj.id) as candidates_count
            FROM job_post jp
            LEFT JOIN applied_jobs aj ON aj.postId = jp.id
            WHERE jp.user_id = ?
            GROUP BY jp.id
          ) AS sub
        `;
        statsValues.push(user_id);
      }
      const [statsResult] = await pool.query(statsQuery, statsValues);
      const stats = {
          openJobs: statsResult[0]?.openJobs || 0,
          closedJobs: statsResult[0]?.closedJobs || 0,
          totalApplications: statsResult[0]?.totalApplications || 0,
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
  },"""

replacement = """      job_post.min_salary,
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

      const postData = rows.map((item) => {
        return {
          ...item,
          date_posted: dayjs(item.created_at).local().from(now),
          duration_period: JSON.parse(item.duration_period),
          work_location: JSON.parse(item.work_location),
          skills: JSON.parse(item.skills),
          experience_required: JSON.parse(item.experience_required),
          diversity_hiring: JSON.parse(item.diversity_hiring),
          job_category: JSON.parse(item.job_category),
          benefits: JSON.parse(item.benefits),
          team_members: item.team_members ? JSON.parse(item.team_members) : [],
          users: rows
            .filter((row) => row.user_id)
            .map((row) => ({
              id: row.user_id,
              first_name: row.first_name,
              last_name: row.last_name,
              email: row.email,
              phone: row.phone,
              image: row.profile_image,
              resume: row.resume,
              about: row.about,
              skills: row.user_skills ? JSON.parse(row.user_skills) : [],
              gender: row.gender,
              location: row.location,
              total_years: row.total_years,
              total_months: row.total_months,
              experince_type: row.experince_type,
              course: row.course,
              applied_jobs_id: row.applied_jobs_id,
              applied_date: row.applied_date,
              status: row.applied_status || 'applied',
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
            })),
        };
      });
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

  getJobPostByUserId: async (user_id, limit, page, job_nature, search, statuses, categories) => {
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
        const isClosedVals = [];
        if (statuses.includes('active')) isClosedVals.push(0);
        if (statuses.includes('closed')) isClosedVals.push(1);
        
        if (isClosedVals.length > 0) {
           whereClause += ` AND is_closed IN (${isClosedVals.map(() => '?').join(',')})`;
           countValues.push(...isClosedVals);
           queryValues.push(...isClosedVals);
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
  FROM job_post 
  LEFT JOIN applied_jobs aj ON aj.postId = job_post.id
  LEFT JOIN users u ON u.id = aj.userId
  ${whereClause}
  GROUP BY job_post.id
  ORDER BY job_post.created_at DESC`;

      // ✅ Add LIMIT and OFFSET for pagination
      if (limit && !isNaN(limit)) {
        const limitValue = parseInt(limit, 10);
        const pageValue = page && !isNaN(page) ? parseInt(page, 10) : 1;
        const offset = (pageValue - 1) * limitValue;

        query += ` LIMIT ? OFFSET ?`;
        queryValues.push(limitValue, offset);
      }

      const [result] = await pool.query(query, queryValues);
      const now = dayjs().tz("Asia/Kolkata");
      const safeParse = (value) => {
        try { return JSON.parse(value); }
        catch { return Array.isArray(value) ? value : [value]; }
      };

      const formatResult = result.map((item) => {
        return {
          ...item,
          company_logo: `/api/job/logo/${item.id}`,
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
            SUM(CASE WHEN is_closed = 0 THEN 1 ELSE 0 END) as openJobs,
            SUM(CASE WHEN is_closed != 0 THEN 1 ELSE 0 END) as closedJobs,
            SUM(candidates_count) as totalApplications
          FROM (
            SELECT 
              jp.is_closed, 
              COUNT(DISTINCT aj.id) as candidates_count
            FROM job_post jp
            LEFT JOIN applied_jobs aj ON aj.postId = jp.id
            GROUP BY jp.id
          ) AS sub
        `;
      } else {
        statsQuery = `
          SELECT 
            SUM(CASE WHEN is_closed = 0 THEN 1 ELSE 0 END) as openJobs,
            SUM(CASE WHEN is_closed != 0 THEN 1 ELSE 0 END) as closedJobs,
            SUM(candidates_count) as totalApplications
          FROM (
            SELECT 
              jp.is_closed, 
              COUNT(DISTINCT aj.id) as candidates_count
            FROM job_post jp
            LEFT JOIN applied_jobs aj ON aj.postId = jp.id
            WHERE jp.user_id = ?
            GROUP BY jp.id
          ) AS sub
        `;
        statsValues.push(user_id);
      }
      const [statsResult] = await pool.query(statsQuery, statsValues);
      const stats = {
          openJobs: statsResult[0]?.openJobs || 0,
          closedJobs: statsResult[0]?.closedJobs || 0,
          totalApplications: statsResult[0]?.totalApplications || 0,
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
  },"""

if target in content:
    content = content.replace(target, replacement)
    with open('c:/Users/dell/Documents/Careerfast/careerfast-backend/models/JobsModel.js', 'w') as f:
        f.write(content)
    print("Success")
else:
    print("Failed to find target")
