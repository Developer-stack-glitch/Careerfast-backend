const pool = require("../config/dbConfig");
const bcrypt = require("bcrypt");

const UserModel = {
  getUsers: async (page = null, limit = null, search = "", status = "", role = null, startDate = null, endDate = null, timeFilter = null) => {
    try {
      // Calculate global stats (respecting search, ignoring status)
      let baseQuery = `SELECT u.is_active FROM users u WHERE 1=1`;
      let baseParams = [];
      
      if (role) {
        const rolesArray = String(role).split(',').map(r => r.trim());
        baseQuery += ` AND u.role_id IN (?)`;
        baseParams.push(rolesArray);
      }
      
      if (search) {
        baseQuery += ` AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)`;
        const searchPattern = `%${search}%`;
        baseParams.push(searchPattern, searchPattern, searchPattern);
      }

      let dateCondition = "";
      let dateParams = [];
      if (startDate && endDate) {
        dateCondition = " AND (DATE(COALESCE(u.last_active, u.created_date)) BETWEEN ? AND ? OR DATE(u.created_date) BETWEEN ? AND ?)";
        dateParams = [startDate, endDate, startDate, endDate];
      } else if (startDate) {
        dateCondition = " AND (DATE(COALESCE(u.last_active, u.created_date)) >= ? OR DATE(u.created_date) >= ?)";
        dateParams = [startDate, startDate];
      } else if (endDate) {
        dateCondition = " AND (DATE(COALESCE(u.last_active, u.created_date)) <= ? OR DATE(u.created_date) <= ?)";
        dateParams = [endDate, endDate];
      } else if (timeFilter) {
        if (timeFilter === "Today") {
          dateCondition = " AND (DATE(COALESCE(u.last_active, u.created_date)) = CURDATE() OR DATE(u.created_date) = CURDATE())";
        } else if (timeFilter === "Yesterday") {
          dateCondition = " AND (DATE(COALESCE(u.last_active, u.created_date)) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) OR DATE(u.created_date) = DATE_SUB(CURDATE(), INTERVAL 1 DAY))";
        } else if (timeFilter === "Last 7 Days") {
          dateCondition = " AND (COALESCE(u.last_active, u.created_date) >= DATE_SUB(NOW(), INTERVAL 7 DAY) OR u.created_date >= DATE_SUB(NOW(), INTERVAL 7 DAY))";
        } else if (timeFilter === "Last 30 Days") {
          dateCondition = " AND (COALESCE(u.last_active, u.created_date) >= DATE_SUB(NOW(), INTERVAL 30 DAY) OR u.created_date >= DATE_SUB(NOW(), INTERVAL 30 DAY))";
        } else if (timeFilter === "This Month") {
          dateCondition = " AND (COALESCE(u.last_active, u.created_date) >= DATE_FORMAT(NOW(), '%Y-%m-01') OR u.created_date >= DATE_FORMAT(NOW(), '%Y-%m-01'))";
        } else if (timeFilter === "Last Month") {
          dateCondition = " AND ((COALESCE(u.last_active, u.created_date) >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m-01') AND COALESCE(u.last_active, u.created_date) < DATE_FORMAT(NOW(), '%Y-%m-01')) OR (u.created_date >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m-01') AND u.created_date < DATE_FORMAT(NOW(), '%Y-%m-01')))";
        } else if (timeFilter === "This Quarter") {
          dateCondition = " AND (COALESCE(u.last_active, u.created_date) >= DATE_SUB(NOW(), INTERVAL 3 MONTH) OR u.created_date >= DATE_SUB(NOW(), INTERVAL 3 MONTH))";
        } else if (timeFilter === "This Year") {
          dateCondition = " AND (COALESCE(u.last_active, u.created_date) >= DATE_SUB(NOW(), INTERVAL 1 YEAR) OR u.created_date >= DATE_SUB(NOW(), INTERVAL 1 YEAR))";
        }
      }

      if (dateCondition) {
        baseQuery += dateCondition;
        baseParams.push(...dateParams);
      }

      const statsQuery = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN is_active = 0 OR is_active IS NULL THEN 1 ELSE 0 END) as pending
        FROM (${baseQuery}) as subquery
      `;
      const [statsResult] = await pool.query(statsQuery, baseParams);
      const stats = statsResult[0] || { total: 0, active: 0, pending: 0 };

      let query = `
        SELECT u.*, r.name AS role_name, ot.name AS organization_type 
        FROM users u 
        LEFT JOIN role r ON u.role_id = r.id
        LEFT JOIN organization_type ot ON u.organization_type_id = ot.id
        WHERE 1=1
      `;
      let queryParams = [];

      if (role) {
        const rolesArray = String(role).split(',').map(r => r.trim());
        query += ` AND u.role_id IN (?)`;
        queryParams.push(rolesArray);
      }

      if (search) {
        query += ` AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)`;
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern);
      }

      if (dateCondition) {
        query += dateCondition;
        queryParams.push(...dateParams);
      }

      // If status filter is passed (active/pending)
      // Note: is_active could be Buffer or TINYINT in DB. Usually '1' for active.
      if (status === 'Active') {
        query += ` AND u.is_active = 1`;
      } else if (status === 'Pending' || status === 'Disabled') {
        query += ` AND (u.is_active = 0 OR u.is_active IS NULL)`;
      }

      // We need total count for pagination before applying LIMIT
      let totalCount = 0;
      if (page && limit) {
        const countQuery = `SELECT COUNT(*) as total FROM (${query}) as subquery`;
        const [countResult] = await pool.query(countQuery, queryParams);
        totalCount = countResult[0].total;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ` LIMIT ? OFFSET ?`;
        queryParams.push(parseInt(limit), offset);
      }

      const [users] = await pool.query(query, queryParams);

      const formattedUsers = users.map(user => ({
        ...user,
        last_active: user.last_active || user.updated_date || user.created_date,
        skills: (() => {
          try {
            return user.skills ? JSON.parse(user.skills) : [];
          } catch (e) {
            return user.skills
              ? user.skills.split(",").map(s => s.replace(/['"]+/g, "").trim())
              : [];
          }
        })(),
      }));

      if (page && limit) {
        return {
          users: formattedUsers,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          currentPage: parseInt(page),
          stats: {
            total: stats.total || 0,
            active: stats.active || 0,
            pending: stats.pending || 0
          }
        };
      }

      return formattedUsers;
    } catch (error) {
      throw new Error("Error fetching users: " + error.message);
    }
  },

  createUser: async (
    first_name,
    last_name,
    phone_code,
    phone,
    email,
    password,
    organization,
    organization_type_id,
    role_id
  ) => {
    try {
      const [isPhoneExists] = await pool.query(
        `SELECT id FROM users WHERE phone_code = ? AND phone = ?`,
        [phone_code, phone]
      );
      if (isPhoneExists.length > 0)
        throw new Error("Phone number already exists!");

      const [isEmailExists] = await pool.query(
        `SELECT id FROM users WHERE email = ?`,
        [email]
      );
      if (isEmailExists.length > 0) throw new Error("Email already exists!");
      
      const hashedPassword = await hashPassword(password);
      
      // Separate recruiter and candidate data
      const userOrg = role_id == 3 ? null : organization;
      const userOrgType = role_id == 3 ? null : organization_type_id;

      const query = `INSERT INTO users (first_name, last_name, phone_code, phone, email, password, organization, organization_type_id, role_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const [user] = await pool.query(query, [
        first_name,
        last_name,
        phone_code,
        phone,
        email,
        hashedPassword,
        userOrg,
        userOrgType,
        role_id,
      ]);
      
      let result;
      if (user.affectedRows > 0) {
        const userId = user.insertId;

        if (role_id == 3) {
          let orgTypeName = "";
          if (organization_type_id) {
            const [orgRows] = await pool.query(
              `SELECT name FROM organization_type WHERE id = ?`,
              [organization_type_id]
            );
            if (orgRows.length > 0) orgTypeName = orgRows[0].name;
          }
          const [hrRes] = await pool.query(
            `INSERT INTO hr_profiles (user_id, company_name, organization_type, contact_email, contact_phone) VALUES (?, ?, ?, ?, ?)`,
            [userId, organization, orgTypeName, email, phone]
          );
          const companyId = hrRes.insertId;

          // 🎁 Automatically assign Free Plan (20 jobs/month, 40 total jobs) to newly registered recruiter
          try {
            let [freePlanRows] = await pool.query(
              `SELECT * FROM subscription_plans WHERE slug = 'free' OR name LIKE '%Free%' ORDER BY id ASC LIMIT 1`
            );

            let freePlan = freePlanRows[0];
            if (!freePlan) {
              const insertFreePlanQuery = `
                INSERT INTO subscription_plans (
                  name, slug, description, plan_type, price, currency, validity_days,
                  job_post_limit, active_job_limit, featured_job_limit, urgent_job_limit, sub_recruiter_limit,
                  resume_view_limit, resume_download_limit, email_limit, whatsapp_limit, excel_download_limit,
                  candidate_search, candidate_contact, resume_database,
                  interview_management, application_management, shortlisting, company_profile, recruiter_dashboard, email_notifications, company_branding,
                  status
                ) VALUES (
                  'Free Plan', 'free', 'Free plan for new recruiters with 20 job postings per month up to 40 total job postings.', 'monthly', 0.00, 'INR', 60,
                  40, 20, 0, 0, 1,
                  50, 10, 50, 50, 50,
                  0, 0, 0,
                  1, 1, 1, 1, 1, 1, 0,
                  'active'
                )
              `;
              const [newPlanRes] = await pool.query(insertFreePlanQuery);
              const [newPlanRows] = await pool.query(`SELECT * FROM subscription_plans WHERE id = ?`, [newPlanRes.insertId]);
              freePlan = newPlanRows[0];
            }

            if (freePlan) {
              const startDate = new Date();
              const expiryDate = new Date();
              expiryDate.setDate(expiryDate.getDate() + (freePlan.validity_days || 60));

              const [subRes] = await pool.query(
                `INSERT INTO recruiter_subscriptions (
                  recruiter_id, company_id, plan_id, billing_cycle, price_paid,
                  start_date, expiry_date, status, payment_status
                ) VALUES (?, ?, ?, 'monthly', 0.00, ?, ?, 'Active', 'Paid')`,
                [userId, companyId || null, freePlan.id, startDate, expiryDate]
              );
              const subId = subRes.insertId;

              await pool.query(
                `INSERT INTO subscription_usage (
                  subscription_id, recruiter_id, billing_period_start, billing_period_end,
                  job_posts_used, resume_views_used, resume_downloads_used,
                  featured_jobs_used, urgent_jobs_used, candidate_contacts_used
                ) VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 0)`,
                [subId, userId, startDate, expiryDate]
              );

              await pool.query(
                `INSERT INTO subscription_history (
                  subscription_id, recruiter_id, old_plan_id, new_plan_id,
                  change_type, effective_type, previous_expiry, new_expiry, reason, changed_by_admin_id
                ) VALUES (?, ?, NULL, ?, 'initial_assignment', 'immediately', NULL, ?, 'Free Plan automatically assigned upon recruiter registration', NULL)`,
                [subId, userId, freePlan.id, expiryDate]
              );
            }
          } catch (subErr) {
            console.error("⚠️ Error auto-assigning Free Plan to new recruiter:", subErr.message);
          }
        }

        result = await pool.query(
          `SELECT * FROM users WHERE email = ? AND phone_code = ? AND phone = ?`,
          [email, phone_code, phone]
        );
      }

      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateUser: async (id, name, email, gender, password) => {
    try {
      const query = `UPDATE users SET name = ?, email = ?, gender = ?, password = ? WHERE id = ?`;
      const [user] = await pool.query(query, [
        name,
        email,
        gender,
        password,
        id,
      ]);
      return user.affectedRows;
    } catch (error) {
      throw new Error("Error updating user: " + error.message);
    }
  },

  deleteUser: async (id) => {
    try {
      const query = `DELETE FROM users WHERE id = ?`;
      const [user] = await pool.query(query, [id]);
      return user.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  forgotPassword: async (email, password, role_id) => {
    try {
      if (role_id) {
        const [u] = await pool.query(
          `SELECT id, role_id FROM users WHERE email = ?`,
          [email]
        );
        if (!u || u.length === 0) {
          throw new Error("No account found with this email");
        }
        if (u[0].role_id !== 1 && u[0].role_id != role_id) {
          throw new Error("This email does not belong to a recruiter account");
        }
      }

      const hashedPassword = await hashPassword(password);
      console.log(hashedPassword);

      const [result] = await pool.query(
        `UPDATE users SET password = ? WHERE email = ?`,
        [hashedPassword, email]
      );
      console.log(result);

      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  insertProfile: async (
    profile_image,
    user_id,
    country,
    state,
    city,
    pincode,
    address,
    professional,
    is_email_verified,
    user_type,
    experince_type,
    total_years,
    total_months,
    classes,
    course,
    start_year,
    end_year,
    gender,
    resume,
    languages,
    visa_status,
    preferred_job_type,
    dob,
    company_headcount
  ) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // Update profile image
      const [personal] = await conn.query(
        `UPDATE users SET profile_image = ?, is_email_verified = ?, user_type = ?, experince_type = ?, total_years = ?, total_months = ?, class = ?, course = ?, start_year = ?, end_year = ?, gender = ?, resume = ?, languages = ?, visa_status = ?, preferred_job_type = ?, dob = ?, company_headcount = ? WHERE id = ?`,
        [
          profile_image,
          (is_email_verified === "verified" || is_email_verified === "Verified") ? 1 : 0,  // ✅ convert to 1/0
          user_type,
          experince_type,
          total_years,
          total_months,
          classes,
          course,
          start_year,
          end_year,
          gender,
          resume,
          languages ? JSON.stringify(languages) : null,
          visa_status || null,
          preferred_job_type ? JSON.stringify(preferred_job_type) : null,
          dob || null,
          company_headcount || null,
          user_id,
        ]
      );


      // insert user address
      const [address_result] = await conn.query(
        `INSERT INTO user_address (user_id, address1, city, state, country, pincode, created_date) VALUES(?, ?, ?, ?, ?, ?, ?)`,
        [user_id, address, city, state, country, pincode, new Date()]
      );

      if (professional.length > 0) {
        for (const p of professional) {
          await conn.query(
            `INSERT INTO user_professional (user_id, job_title, company_name, designation, start_date, end_date, currently_working) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              user_id,
              p.job_title,
              p.company_name,
              p.designation,
              p.start_date,
              p.end_date,
              p.currently_working,
            ]
          );
        }
      }

      // collect all skills from companies
      const allSkills = professional.flatMap((p) => p.skills || []);

      // update skills column in users table
      await conn.query(
        `UPDATE users SET skills = ? WHERE id = ?`,
        [JSON.stringify(allSkills), user_id]
      );


      const [social_links] = await conn.query(
        `INSERT IGNORE INTO user_social_links (user_id) VALUES(?)`,
        user_id
      );

      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw new Error(error.message);
    } finally {
      conn.release();
    }
  },

  updateSocialLinks: async (
    dataOrLinkedin,
    facebook,
    instagram,
    twitter,
    dribble,
    behance,
    user_id
  ) => {
    try {
      let data = {};
      if (typeof dataOrLinkedin === "object" && dataOrLinkedin !== null) {
        data = dataOrLinkedin;
      } else {
        data = {
          linkedin: dataOrLinkedin,
          facebook,
          instagram,
          twitter,
          dribble,
          behance,
          user_id,
        };
      }
      const uid = data.user_id || data.userId || data.id;
      if (!uid) {
        throw new Error("Invalid user ID");
      }
      const linkedin = data.linkedin !== undefined ? data.linkedin : (data.Linkedin || "");
      const github = data.github !== undefined ? data.github : (data.Github || "");
      const portfolio = data.portfolio !== undefined ? data.portfolio : (data.Portfolio || "");
      const fb = data.facebook !== undefined ? data.facebook : (data.Facebook || "");
      const insta = data.instagram !== undefined ? data.instagram : (data.Instagram || "");
      const tw = data.twitter !== undefined ? data.twitter : (data.Twitter || "");
      const dr = data.dribble !== undefined ? data.dribble : (data.dribbble !== undefined ? data.dribbble : (data.Dribbble || ""));
      const be = data.behance !== undefined ? data.behance : (data.Behance || "");

      const query = `
        INSERT INTO user_social_links (user_id, linkedin, github, portfolio, facebook, instagram, twitter, dribble, behance)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          linkedin = VALUES(linkedin),
          github = VALUES(github),
          portfolio = VALUES(portfolio),
          facebook = VALUES(facebook),
          instagram = VALUES(instagram),
          twitter = VALUES(twitter),
          dribble = VALUES(dribble),
          behance = VALUES(behance)
      `;
      const [result] = await pool.query(query, [uid, linkedin, github, portfolio, fb, insta, tw, dr, be]);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getUserAppliedJobs: async (userId) => {
    const query = `
  SELECT 
    applied_jobs.id AS applied_job_id,
    job_post.id AS post_id,
    job_post.*,
    CASE WHEN job_post.is_closed = 1 THEN 1 ELSE 0 END AS is_closed
  FROM applied_jobs
  JOIN job_post ON applied_jobs.postId = job_post.id
  WHERE applied_jobs.userId = ?`;

    const values = [userId];

    try {
      const [result] = await pool.query(query, values);

      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateUserAppliedJobStatus: async (post_id, user_id, status) => {
    const get_appliedjob_query = `SELECT * FROM applied_jobs WHERE postId = ? AND userId = ?`;
    const appliedjob_value = [post_id, user_id];

    try {
      const [appliedjob_data] = await pool.query(
        get_appliedjob_query,
        appliedjob_value
      );
      const appliedjob_id = appliedjob_data[0].id;

      const query = `INSERT INTO applied_job_status_history (applied_job_id, status, user_id) VALUES(?,?,?)`;
      const values = [appliedjob_id, status, appliedjob_data[0].userId];

      const [result] = await pool.query(query, values);
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getUserJobPostStatus: async (applied_job_id) => {
    const query = `SELECT * FROM applied_job_status_history WHERE applied_job_id = ?`;
    const values = [applied_job_id];

    try {
      const [result] = await pool.query(query, values);
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getUserType: async () => {
    try {
      const [result] = await pool.query(
        `SELECT id, name FROM user_type WHERE is_deleted = 0 ORDER BY name`
      );
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateBasicDetails: async (
    first_name_or_data,
    last_name,
    gender,
    user_type,
    classes,
    course,
    start_year,
    end_year,
    experince_type,
    total_years,
    total_months,
    location,
    user_id
  ) => {
    try {
      let data = {};
      if (typeof first_name_or_data === "object" && first_name_or_data !== null) {
        data = first_name_or_data;
      } else {
        data = {
          first_name: first_name_or_data,
          last_name,
          gender,
          user_type,
          class: classes,
          course,
          start_year,
          end_year,
          experince_type,
          total_years,
          total_months,
          location,
          user_id,
        };
      }

      const uid = data.user_id || data.id;
      if (!uid) {
        throw new Error("Invalid user ID");
      }

      // Handle name splitting if provided as single string
      let firstName = data.first_name || data.firstName;
      let lastName = data.last_name || data.lastName;
      if (data.name && (!firstName || !lastName)) {
        const parts = String(data.name).trim().split(" ");
        if (!firstName) firstName = parts[0] || "";
        if (!lastName) lastName = parts.slice(1).join(" ") || "";
      }

      // Handle location combining
      let loc = data.location;
      if (!loc && (data.city || data.state)) {
        loc = [data.city, data.state].filter(Boolean).join(", ");
      }

      // Handle experience type & years
      let expType = data.experince_type || data.experience_type;
      if (data.is_fresher !== undefined) {
        expType = data.is_fresher ? "Fresher" : "Experience";
      }
      let totYears = data.total_years !== undefined ? data.total_years : data.experience;
      let totMonths = data.total_months;

      // Handle user type / job title
      let userTypeVal = data.user_type || data.job_title || data.jobTitle;

      // Handle job preferences stored in preferred_job_type
      let preferredJobTypeVal = data.preferred_job_type;
      if (
        !preferredJobTypeVal &&
        (data.preferred_roles ||
          data.preferred_locations ||
          data.work_mode ||
          data.job_type ||
          data.expected_salary ||
          data.notice_period ||
          data.relocation)
      ) {
        preferredJobTypeVal = JSON.stringify({
          preferredRoles: data.preferred_roles || [],
          preferredLocations: data.preferred_locations || [],
          workMode: data.work_mode || [],
          jobType: data.job_type || [],
          expectedSalary: data.expected_salary || "",
          noticePeriod: data.notice_period || null,
          relocation: data.relocation || null,
        });
      }

      // Build dynamic SET fields so we only update fields that were actually provided
      const updates = [];
      const params = [];

      const fieldMappings = [
        { key: firstName, col: "first_name" },
        { key: lastName, col: "last_name" },
        { key: data.gender, col: "gender" },
        { key: data.dob, col: "dob" },
        { key: data.phone, col: "phone" },
        { key: loc, col: "location" },
        { key: data.is_email_verified, col: "is_email_verified" },
        { key: userTypeVal, col: "user_type" },
        { key: expType, col: "experince_type" },
        { key: totYears, col: "total_years" },
        { key: totMonths, col: "total_months" },
        { key: data.careerLevel || data.career_level, col: "career_level" },
        { key: data.headline, col: "headline" },
        { key: data.class || data.classes, col: "class" },
        { key: data.course, col: "course" },
        { key: data.start_year, col: "start_year" },
        { key: data.end_year, col: "end_year" },
        { key: data.about, col: "about" },
        { key: data.resume, col: "resume" },
        { key: preferredJobTypeVal, col: "preferred_job_type" },
        {
          key: data.languages !== undefined
            ? typeof data.languages === "string"
              ? data.languages
              : JSON.stringify(data.languages)
            : undefined,
          col: "languages",
        },
        { key: data.visa_status, col: "visa_status" },
        {
          key: data.certifications !== undefined
            ? typeof data.certifications === "string"
              ? data.certifications
              : JSON.stringify(data.certifications)
            : undefined,
          col: "certifications",
        },
        {
          key: data.accomplishments !== undefined
            ? typeof data.accomplishments === "string"
              ? data.accomplishments
              : JSON.stringify(data.accomplishments)
            : undefined,
          col: "accomplishments",
        },
        {
          key: data.additional_info !== undefined
            ? typeof data.additional_info === "string"
              ? data.additional_info
              : JSON.stringify(data.additional_info)
            : undefined,
          col: "additional_info",
        },
        { key: data.marital_status, col: "marital_status" },
        { key: data.notice_period, col: "notice_period" },
        { key: data.expected_salary, col: "expected_salary" },
        { key: data.current_salary, col: "current_salary" },
        { key: data.available_from, col: "available_from" },
        {
          key: data.preferred_roles !== undefined
            ? Array.isArray(data.preferred_roles)
              ? data.preferred_roles.join(", ")
              : data.preferred_roles
            : undefined,
          col: "preferred_roles",
        },
        {
          key: data.preferred_locations !== undefined
            ? Array.isArray(data.preferred_locations)
              ? data.preferred_locations.join(", ")
              : data.preferred_locations
            : undefined,
          col: "preferred_locations",
        },
        { key: data.willing_to_relocate, col: "willing_to_relocate" },
      ];

      for (const item of fieldMappings) {
        if (item.key !== undefined && item.key !== null) {
          updates.push(`${item.col} = ?`);
          params.push(item.key);
        }
      }

      if (updates.length === 0) {
        return 0;
      }

      params.push(uid);
      const query = `UPDATE users SET ${updates.join(", ")} WHERE id = ?`;
      const [result] = await pool.query(query, params);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateEducation: async (
    qualification,
    course,
    specialization,
    college,
    start_date,
    end_date,
    course_type,
    percentage,
    cgpa,
    roll_number,
    lateral_entry,
    user_id,
    id
  ) => {
    try {
      const [chechId] = await pool.query(
        `SELECT id FROM user_education WHERE id = ?`,
        [id]
      );
      if (chechId.length === 0) {
        throw new Error("Invalid Id");
      }

      const updateQuery = `UPDATE user_education SET qualification = ?, course = ?, specialization = ?, college = ?, start_date = ?, end_date = ?, course_type = ?, percentage = ?, cgpa = ?, roll_number = ?, lateral_entry = ? WHERE user_id = ? AND id = ?`;
      const params = [
        qualification,
        course,
        specialization,
        college,
        start_date,
        end_date,
        course_type,
        percentage,
        cgpa,
        roll_number,
        lateral_entry,
        user_id,
        id,
      ];
      const [result] = await pool.query(updateQuery, params);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  deleteEducation: async (id) => {
    try {
      const [result] = await pool.query(
        `DELETE FROM user_education WHERE id = ?`,
        id
      );
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  insertEducation: async (
    user_id,
    qualification,
    course,
    specialization,
    college,
    start_date,
    end_date,
    course_type,
    percentage,
    cgpa,
    roll_number,
    lateral_entry
  ) => {
    try {
      const insertQuery = `INSERT INTO user_education(
                              user_id,
                              qualification,
                              course,
                              specialization,
                              college,
                              start_date,
                              end_date,
                              course_type,
                              percentage,
                              cgpa,
                              roll_number,
                              lateral_entry
                          )
                          VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const values = [
        user_id,
        qualification,
        course,
        specialization,
        college,
        start_date,
        end_date,
        course_type,
        percentage,
        cgpa,
        roll_number,
        lateral_entry,
      ];
      const [result] = await pool.query(insertQuery, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getUserProfile: async (user_id) => {
    try {
      const [isIdExists] = await pool.query(
        `SELECT id FROM users WHERE id = ?`,
        [user_id]
      );
      if (isIdExists.length == 0) {
        throw new Error("Invalid user Id");
      }
      // Get user basic information
      const query = `SELECT
                        u.id,
                        u.role_id,
                        r.name AS role_name,
                        u.first_name,
                        u.last_name,
                        u.phone_code,
                        u.phone,
                        u.email,
                        CASE WHEN u.is_email_verified = 1 THEN 1 ELSE 0
                        END AS is_email_verified,
                        u.gender,
                        u.user_type,
                        u.class,
                        u.course,
                        u.start_year,
                        u.end_year,
                        u.profile_image,
                        u.banner_color,
                        u.banner_image,
                        u.resume,
                        u.about,
                        u.skills,
                        u.organization,
                        u.experince_type,
                        u.total_years,
                        u.total_months,
                        u.location,
                        u.languages,
                        u.visa_status,
                        u.preferred_job_type,
                        u.dob,
                        u.certifications,
                        u.accomplishments,
                        u.additional_info,
                        u.marital_status,
                        u.notice_period,
                        u.expected_salary,
                        u.current_salary,
                        u.available_from,
                        u.preferred_roles,
                        u.preferred_locations,
                        u.willing_to_relocate,
                        u.company_headcount,
                        u.visibility_mode,
                        u.hidden_companies,
                        u.allow_contact,
                        u.show_in_search,
                        u.career_level,
                        u.headline,
                        u.created_date,
                        COALESCE(u.last_active, (SELECT MAX(created_at) FROM user_daily_usage WHERE user_id = u.id), u.updated_date, u.created_date) AS last_active,
                        ot.name AS organization_type
                    FROM
                        users u
                    INNER JOIN role r ON
                        u.role_id = r.id
                    LEFT JOIN organization_type ot ON
                      u.organization_type_id = ot.id
                    WHERE
                        u.is_active = 1 AND u.id = ?`;
      // Define queries
      const educationQuery = `SELECT
                                  u.id,
                                  u.qualification,
                                  u.course,
                                  u.specialization,
                                  u.college,
                                  u.start_date,
                                  u.end_date,
                                  u.course_type,
                                  u.percentage,
                                  u.cgpa,
                                  u.roll_number,
                                  u.lateral_entry
                              FROM
                                  user_education u
                              WHERE
                                  u.is_deleted = 0
                                  AND u.user_id = ?`;

      const professionalQuery = `
                                SELECT
                                    u.id,
                                    u.job_title,
                                    u.company_name,
                                    u.designation,
                                    u.start_date,
                                    u.end_date,
                                    CASE WHEN u.currently_working = 1 THEN 1 ELSE 0 END AS currently_working,
                                    u.skills,
                                    u.location,
                                    u.description
                                FROM user_professional u
                                WHERE u.is_deleted = 0 AND u.user_id = ?`;

      const projectQuery = `SELECT
                              u.id,
                              u.company_name,
                              u.project_title,
                              u.project_type,
                              u.start_date,
                              u.end_date,
                              u.description
                          FROM
                              user_projects u
                          WHERE
                              u.is_deleted = 0
                              AND u.user_id = ?`;

      const linksQuery = `SELECT
                            linkedin,
                            github,
                            portfolio,
                            facebook,
                            instagram,
                            twitter,
                            dribble,
                            behance
                        FROM
                            user_social_links
                        WHERE
                            user_id = ?`;

      // Execute all independent queries concurrently
      const [
        [result],
        [getEducation],
        [rows],
        [getProjects],
        [getLinks]
      ] = await Promise.all([
        pool.query(query, [user_id]),
        pool.query(educationQuery, [user_id]),
        pool.query(professionalQuery, [user_id]),
        pool.query(projectQuery, [user_id]),
        pool.query(linksQuery, [user_id])
      ]);

      const getUsers = result.map((row) => {
        let hiddenCompanies = [];
        try {
          if (row.hidden_companies) {
            hiddenCompanies = typeof row.hidden_companies === 'string' ? JSON.parse(row.hidden_companies) : row.hidden_companies;
          }
        } catch (e) {
          hiddenCompanies = [];
        }

        let certifications = [];
        try {
          if (row.certifications) {
            certifications = typeof row.certifications === 'string' ? JSON.parse(row.certifications) : row.certifications;
          }
        } catch (e) {
          certifications = [];
        }

        let accomplishments = [];
        try {
          if (row.accomplishments) {
            accomplishments = typeof row.accomplishments === 'string' ? JSON.parse(row.accomplishments) : row.accomplishments;
          }
        } catch (e) {
          accomplishments = [];
        }

        let additionalInfo = {};
        try {
          if (row.additional_info) {
            additionalInfo = typeof row.additional_info === 'string' ? JSON.parse(row.additional_info) : row.additional_info;
          }
        } catch (e) {
          additionalInfo = {};
        }

        let languages = [];
        try {
          if (row.languages) {
            languages = typeof row.languages === 'string'
              ? (row.languages.startsWith('[') ? JSON.parse(row.languages) : row.languages.split(',').map(s => s.trim()))
              : row.languages;
          }
        } catch (e) {
          languages = row.languages ? [row.languages] : [];
        }

        let preferredJobType = row.preferred_job_type;
        try {
          if (preferredJobType && typeof preferredJobType === 'string' && preferredJobType.startsWith('{')) {
            preferredJobType = JSON.parse(preferredJobType);
          }
        } catch (e) {
          // keep as string
        }

        return {
          ...row,
          skills: row.skills ? (typeof row.skills === 'string' ? JSON.parse(row.skills) : row.skills) : [],
          certifications: Array.isArray(certifications) ? certifications : [],
          accomplishments: Array.isArray(accomplishments) ? accomplishments : [],
          additional_info: additionalInfo || {},
          languages: Array.isArray(languages) ? languages : (languages ? [languages] : []),
          preferred_job_type: preferredJobType,
          visibility_mode: row.visibility_mode || 'Limited',
          hidden_companies: Array.isArray(hiddenCompanies) ? hiddenCompanies : [],
          allow_contact: row.allow_contact === null || row.allow_contact === undefined ? true : Boolean(row.allow_contact),
          show_in_search: row.show_in_search === null || row.show_in_search === undefined ? true : Boolean(row.show_in_search),
        };
      });

      // Convert skills string to array for each row
      const getProfessional = rows.map((row) => {
        return {
          ...row,
          skills: row.skills ? (typeof row.skills === 'string' ? JSON.parse(row.skills) : row.skills) : [],
        };
      });

      //Get combined result set
      const formattedResult = {
        ...getUsers[0],
        education: getEducation,
        professional: getProfessional,
        projects: getProjects,
        social_links: getLinks[0] || null, // handle empty links gracefully
      };
      return formattedResult;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getHrProfile: async (user_id) => {
    try {
      const query = `
        SELECT
          h.profile_image,
          h.banner_image,
          h.company_name,
          h.about_us,
          h.organization_type,
          h.industry_type,
          h.team_size,
          h.year_established,
          h.website_url,
          h.vision,
          h.map_location,
          h.contact_phone,
          h.contact_email,
          CASE WHEN u.is_email_verified = 1 THEN 1 ELSE 0 END AS is_email_verified,
          s.facebook,
          s.twitter,
          s.instagram,
          s.linkedin as youtube
        FROM hr_profiles h
        LEFT JOIN users u ON h.user_id = u.id
        LEFT JOIN user_social_links s ON h.user_id = s.user_id
        WHERE h.user_id = ?
      `;
      const [rows] = await pool.query(query, [user_id]);
      return rows[0];
    } catch (error) {
      throw new Error(error.message);
    }
  },

  insertHrProfile: async (
    user_id,
    profile_image,
    banner_image,
    company_name,
    about_us,
    organization_type,
    industry_type,
    team_size,
    year_established,
    website_url,
    vision,
    social_links,
    map_location,
    contact_phone,
    contact_email
  ) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Insert or update HR Profile
      const [existingHr] = await conn.query(`SELECT id FROM hr_profiles WHERE user_id = ?`, [user_id]);
      if (existingHr.length > 0) {
        await conn.query(
          `UPDATE hr_profiles SET profile_image = ?, banner_image = ?, company_name = ?, about_us = ?, organization_type = ?, industry_type = ?, team_size = ?, year_established = ?, website_url = ?, vision = ?, map_location = ?, contact_phone = ?, contact_email = ? WHERE user_id = ?`,
          [profile_image, banner_image, company_name, about_us, organization_type, industry_type, team_size, year_established, website_url, vision, map_location, contact_phone, contact_email, user_id].map(v => v === undefined ? null : v)
        );
      } else {
        await conn.query(
          `INSERT INTO hr_profiles (user_id, profile_image, banner_image, company_name, about_us, organization_type, industry_type, team_size, year_established, website_url, vision, map_location, contact_phone, contact_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [user_id, profile_image, banner_image, company_name, about_us, organization_type, industry_type, team_size, year_established, website_url, vision, map_location, contact_phone, contact_email].map(v => v === undefined ? null : v)
        );
      }

      // Update social links
      if (social_links) {
        const { facebook, twitter, instagram, youtube } = social_links;
        const [existingSocials] = await conn.query(`SELECT id FROM user_social_links WHERE user_id = ?`, [user_id]);
        if (existingSocials.length > 0) {
          await conn.query(
            `UPDATE user_social_links SET facebook = ?, twitter = ?, instagram = ?, linkedin = ? WHERE user_id = ?`,
            [facebook, twitter, instagram, youtube, user_id].map(v => v === undefined ? null : v) // using linkedin column for youtube for now if youtube doesn't exist, wait, youtube doesn't exist in schema. I'll need to check the schema of user_social_links.
          );
        } else {
          await conn.query(
            `INSERT INTO user_social_links (user_id, facebook, twitter, instagram, linkedin) VALUES (?, ?, ?, ?, ?)`,
            [user_id, facebook, twitter, instagram, youtube].map(v => v === undefined ? null : v)
          );
        }
      }

      await conn.commit();
    } catch (error) {
      console.error("Original error in insertHrProfile:", error);
      try {
        await conn.rollback();
      } catch (rollbackError) {
        console.error("Rollback failed:", rollbackError);
      }
      throw new Error(error.message);
    } finally {
      conn.release();
    }
  },

  isProfileUpdated: async (email) => {
    try {
      const [isEmailExists] = await pool.query(
        `SELECT id FROM users WHERE email = ?`,
        [email]
      );
      if (isEmailExists.length === 0) {
        throw new Error("Invalid email");
      }
      const [isUpdated] = await pool.query(
        `SELECT CASE WHEN is_email_verified = 1 THEN 1 ELSE 0 END AS is_email_verified FROM users WHERE email = ?`,
        [email]
      );
      return isUpdated[0].is_email_verified ? true : false;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateProfileImage: async (user_id, base64Image) => {
    try {
      const [isUserExists] = await pool.query(
        `SELECT id FROM users WHERE id = ?`,
        [user_id]
      );
      if (isUserExists.length <= 0) {
        throw new Error("Invalid Id");
      }
      const [result] = await pool.query(
        `UPDATE users SET profile_image = ? WHERE id = ?`,
        [base64Image, user_id]
      );
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateBanner: async (user_id, banner_color, banner_image) => {
    try {
      const [result] = await pool.query(
        `UPDATE users SET banner_color = ?, banner_image = ? WHERE id = ?`,
        [banner_color, banner_image, user_id]
      );
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  // addNewUser: async (
  //   user_id,
  //   first_name,
  //   last_name,
  //   email,
  //   phone_code,
  //   phone
  // ) => {
  //   try {
  //     const [getRoleId] = await pool.query(
  //       `SELECT id FROM role WHERE name = 'SUB-RECRUITER'`
  //     );
  //     if (getRoleId.length <= 0) {
  //       throw new Error("Cannot find role");
  //     }
  //     const insertQuery = `INSERT INTO users (role_id, first_name, last_name, phone_code, phone, email) VALUES (?, ?, ?, ?, ?, ?)`;
  //     const values = [
  //       getRoleId[0].id,
  //       first_name,
  //       last_name,
  //       phone_code,
  //       phone,
  //       email,
  //     ];
  //     const [result] = await pool.query(insertQuery, values);
  //     return result.affectedRows;
  //   } catch (error) {
  //     throw new Error(error.message);
  //   }
  // },
  getFcmToken: async (userId) => {
    try {
      const [rows] = await pool.query(
        `SELECT fcm_token FROM users WHERE id = ?`,
        [userId]
      );
      return rows.length > 0 ? rows[0].fcm_token : null;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateUserStatus: async (user_id, is_active) => {
    try {
      const [result] = await pool.query(
        `UPDATE users SET is_active = ? WHERE id = ?`,
        [is_active, user_id]
      );
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

// 🔐 Encrypt (Hash) Password
const hashPassword = async (plainPassword) => {
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
  return hashedPassword;
};

module.exports = UserModel;
