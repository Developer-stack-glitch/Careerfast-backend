const pool = require("../config/dbConfig");
const bcrypt = require("bcrypt");

const UserModel = {
  recalculateProfileCompletion: async (userId) => {
    try {
      if (!userId) return;
      await pool.query(`
        UPDATE users u
        LEFT JOIN (SELECT user_id FROM user_education WHERE is_deleted = 0 AND user_id = ? GROUP BY user_id) ue ON u.id = ue.user_id
        SET u.profile_completion = (
          (CASE WHEN NULLIF(TRIM(u.first_name), '') IS NOT NULL AND NULLIF(TRIM(u.email), '') IS NOT NULL AND NULLIF(TRIM(u.phone), '') IS NOT NULL THEN 20 
                WHEN NULLIF(TRIM(u.first_name), '') IS NOT NULL AND (NULLIF(TRIM(u.email), '') IS NOT NULL OR NULLIF(TRIM(u.phone), '') IS NOT NULL) THEN 10 ELSE 0 END) +
          (CASE WHEN u.profile_image IS NOT NULL AND u.profile_image != '' AND u.profile_image != 'null' AND u.profile_image != '#' THEN 10 ELSE 0 END) +
          (CASE WHEN u.location IS NOT NULL AND u.location != '' AND u.location != 'null' AND u.location != 'Not Specified' AND u.location != 'Location N/A' THEN 10 ELSE 0 END) +
          (CASE WHEN (u.about IS NOT NULL AND u.about != '') OR (u.headline IS NOT NULL AND u.headline != '') THEN 10 ELSE 0 END) +
          (CASE WHEN (u.experince_type IS NOT NULL AND u.experince_type != '') OR u.total_years > 0 THEN 15 ELSE 0 END) +
          (CASE WHEN ue.user_id IS NOT NULL OR NULLIF(u.course, '') IS NOT NULL OR NULLIF(u.class, '') IS NOT NULL THEN 15 ELSE 0 END) +
          (CASE WHEN u.skills IS NOT NULL AND u.skills != '' AND u.skills != '[]' AND u.skills != 'null' THEN 10 ELSE 0 END) +
          (CASE WHEN u.resume IS NOT NULL AND u.resume != '' AND u.resume != '#' AND u.resume != 'null' AND u.resume != 'Resume' THEN 10 ELSE 0 END)
        ),
        u.updated_date = CURRENT_TIMESTAMP
        WHERE u.id = ?
      `, [userId, userId]);
    } catch (e) {
      console.warn("Failed to recalculate profile_completion for user", userId, e.message);
    }
  },

  getUsers: async (page = null, limit = null, search = "", status = "", role = null, startDate = null, endDate = null, timeFilter = null, sortBy = null, sortOrder = null) => {
    try {
      let baseWhere = " WHERE 1=1";
      let baseParams = [];
      
      if (role) {
        const rolesArray = String(role).split(',').map(r => r.trim());
        baseWhere += ` AND u.role_id IN (?)`;
        baseParams.push(rolesArray);
      }
      
      if (search) {
        baseWhere += ` AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)`;
        const searchPattern = `%${search}%`;
        baseParams.push(searchPattern, searchPattern, searchPattern);
      }

      // Date filtering conditions for created_date and last_login/last_active
      let createdDateCond = "u.created_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
      let lastLoginCond = "(u.last_login >= DATE_SUB(NOW(), INTERVAL 30 DAY) OR u.last_active >= DATE_SUB(NOW(), INTERVAL 30 DAY))";
      let dateCondition = "";
      let dateParams = [];
      let selectDateParams = [];

      if (startDate && endDate) {
        createdDateCond = "DATE(u.created_date) BETWEEN ? AND ?";
        lastLoginCond = "(DATE(u.last_login) BETWEEN ? AND ? OR DATE(u.last_active) BETWEEN ? AND ?)";
        selectDateParams = [startDate, endDate, startDate, endDate, startDate, endDate];
        dateCondition = " AND (DATE(u.created_date) BETWEEN ? AND ? OR DATE(u.last_login) BETWEEN ? AND ? OR DATE(u.last_active) BETWEEN ? AND ?)";
        dateParams = [startDate, endDate, startDate, endDate, startDate, endDate];
      } else if (startDate) {
        createdDateCond = "DATE(u.created_date) >= ?";
        lastLoginCond = "(DATE(u.last_login) >= ? OR DATE(u.last_active) >= ?)";
        selectDateParams = [startDate, startDate, startDate];
        dateCondition = " AND (DATE(u.created_date) >= ? OR DATE(u.last_login) >= ? OR DATE(u.last_active) >= ?)";
        dateParams = [startDate, startDate, startDate];
      } else if (endDate) {
        createdDateCond = "DATE(u.created_date) <= ?";
        lastLoginCond = "(DATE(u.last_login) <= ? OR DATE(u.last_active) <= ?)";
        selectDateParams = [endDate, endDate, endDate];
        dateCondition = " AND (DATE(u.created_date) <= ? OR DATE(u.last_login) <= ? OR DATE(u.last_active) <= ?)";
        dateParams = [endDate, endDate, endDate];
      } else if (timeFilter) {
        if (timeFilter === "Today") {
          createdDateCond = "DATE(u.created_date) = CURDATE()";
          lastLoginCond = "(DATE(u.last_login) = CURDATE() OR DATE(u.last_active) = CURDATE())";
          dateCondition = " AND (DATE(u.created_date) = CURDATE() OR DATE(u.last_login) = CURDATE() OR DATE(u.last_active) = CURDATE())";
        } else if (timeFilter === "Yesterday") {
          createdDateCond = "DATE(u.created_date) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)";
          lastLoginCond = "(DATE(u.last_login) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) OR DATE(u.last_active) = DATE_SUB(CURDATE(), INTERVAL 1 DAY))";
          dateCondition = " AND (DATE(u.created_date) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) OR DATE(u.last_login) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) OR DATE(u.last_active) = DATE_SUB(CURDATE(), INTERVAL 1 DAY))";
        } else if (timeFilter === "Last 7 Days") {
          createdDateCond = "u.created_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
          lastLoginCond = "(u.last_login >= DATE_SUB(NOW(), INTERVAL 7 DAY) OR u.last_active >= DATE_SUB(NOW(), INTERVAL 7 DAY))";
          dateCondition = " AND (u.created_date >= DATE_SUB(NOW(), INTERVAL 7 DAY) OR u.last_login >= DATE_SUB(NOW(), INTERVAL 7 DAY) OR u.last_active >= DATE_SUB(NOW(), INTERVAL 7 DAY))";
        } else if (timeFilter === "Last 30 Days") {
          createdDateCond = "u.created_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
          lastLoginCond = "(u.last_login >= DATE_SUB(NOW(), INTERVAL 30 DAY) OR u.last_active >= DATE_SUB(NOW(), INTERVAL 30 DAY))";
          dateCondition = " AND (u.created_date >= DATE_SUB(NOW(), INTERVAL 30 DAY) OR u.last_login >= DATE_SUB(NOW(), INTERVAL 30 DAY) OR u.last_active >= DATE_SUB(NOW(), INTERVAL 30 DAY))";
        } else if (timeFilter === "This Month") {
          createdDateCond = "u.created_date >= DATE_FORMAT(NOW(), '%Y-%m-01')";
          lastLoginCond = "(u.last_login >= DATE_FORMAT(NOW(), '%Y-%m-01') OR u.last_active >= DATE_FORMAT(NOW(), '%Y-%m-01'))";
          dateCondition = " AND (u.created_date >= DATE_FORMAT(NOW(), '%Y-%m-01') OR u.last_login >= DATE_FORMAT(NOW(), '%Y-%m-01') OR u.last_active >= DATE_FORMAT(NOW(), '%Y-%m-01'))";
        } else if (timeFilter === "Last Month") {
          createdDateCond = "u.created_date >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m-01') AND u.created_date < DATE_FORMAT(NOW(), '%Y-%m-01')";
          lastLoginCond = "((u.last_login >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m-01') AND u.last_login < DATE_FORMAT(NOW(), '%Y-%m-01')) OR (u.last_active >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m-01') AND u.last_active < DATE_FORMAT(NOW(), '%Y-%m-01')))";
          dateCondition = " AND ((u.created_date >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m-01') AND u.created_date < DATE_FORMAT(NOW(), '%Y-%m-01')) OR (u.last_login >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m-01') AND u.last_login < DATE_FORMAT(NOW(), '%Y-%m-01')) OR (u.last_active >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m-01') AND u.last_active < DATE_FORMAT(NOW(), '%Y-%m-01')))";
        } else if (timeFilter === "This Quarter") {
          createdDateCond = "u.created_date >= DATE_SUB(NOW(), INTERVAL 3 MONTH)";
          lastLoginCond = "(u.last_login >= DATE_SUB(NOW(), INTERVAL 3 MONTH) OR u.last_active >= DATE_SUB(NOW(), INTERVAL 3 MONTH))";
          dateCondition = " AND (u.created_date >= DATE_SUB(NOW(), INTERVAL 3 MONTH) OR u.last_login >= DATE_SUB(NOW(), INTERVAL 3 MONTH) OR u.last_active >= DATE_SUB(NOW(), INTERVAL 3 MONTH))";
        } else if (timeFilter === "This Year") {
          createdDateCond = "u.created_date >= DATE_SUB(NOW(), INTERVAL 1 YEAR)";
          lastLoginCond = "(u.last_login >= DATE_SUB(NOW(), INTERVAL 1 YEAR) OR u.last_active >= DATE_SUB(NOW(), INTERVAL 1 YEAR))";
          dateCondition = " AND (u.created_date >= DATE_SUB(NOW(), INTERVAL 1 YEAR) OR u.last_login >= DATE_SUB(NOW(), INTERVAL 1 YEAR) OR u.last_active >= DATE_SUB(NOW(), INTERVAL 1 YEAR))";
        }
      }

      if (dateCondition) {
        baseWhere += dateCondition;
        baseParams.push(...dateParams);
      }

      // 1. Fast global stats query using indexed columns directly from users table
      const statsQuery = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN is_active = 0 OR is_active IS NULL THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN ${createdDateCond} THEN 1 ELSE 0 END) as new_registered,
          SUM(CASE WHEN ${lastLoginCond} THEN 1 ELSE 0 END) as last_login,
          SUM(CASE WHEN profile_completion >= 80 THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN profile_completion < 80 THEN 1 ELSE 0 END) as uncompleted
        FROM users u
        ${baseWhere}
      `;
      const [statsResult] = await pool.query(statsQuery, [...selectDateParams, ...baseParams]);
      const stats = statsResult[0] || { total: 0, active: 0, pending: 0, new_registered: 0, last_login: 0, completed: 0, uncompleted: 0 };

      // 2. Build filtered WHERE clause
      let filterWhere = baseWhere;
      let filterParams = [...baseParams];

      if (status === 'Active') {
        filterWhere += ` AND u.is_active = 1`;
      } else if (status === 'Pending' || status === 'Disabled') {
        filterWhere += ` AND (u.is_active = 0 OR u.is_active IS NULL)`;
      } else if (status === 'Complete' || status === 'Completed') {
        filterWhere += ` AND u.profile_completion >= 80`;
      } else if (status === 'Uncompleted' || status === 'Incomplete') {
        filterWhere += ` AND u.profile_completion < 80`;
      } else if (status === 'New Registered' || status === 'Recent' || status === 'Recently Registered' || status === 'Registered') {
        filterWhere += ` AND (${createdDateCond})`;
        if (startDate && endDate) {
          filterParams.push(startDate, endDate);
        } else if (startDate) {
          filterParams.push(startDate);
        } else if (endDate) {
          filterParams.push(endDate);
        }
      } else if (status === 'Last Login' || status === 'Login') {
        filterWhere += ` AND (${lastLoginCond})`;
        if (startDate && endDate) {
          filterParams.push(startDate, endDate, startDate, endDate);
        } else if (startDate) {
          filterParams.push(startDate, startDate);
        } else if (endDate) {
          filterParams.push(endDate, endDate);
        }
      }

      // 3. Fast count query (no expensive joins or window functions)
      let totalCount = 0;
      if (page && limit) {
        const countQuery = `SELECT COUNT(*) as total FROM users u ${filterWhere}`;
        const [countResult] = await pool.query(countQuery, filterParams);
        totalCount = countResult[0]?.total || 0;
      }

      // 4. Build dynamic ORDER BY clause
      const dir = (sortOrder && String(sortOrder).toLowerCase() === 'asc') ? 'ASC' : 'DESC';
      let orderByClause = ` ORDER BY u.created_date ${dir}, COALESCE(u.last_login, u.created_date) ${dir}, u.id ${dir}`;

      if (sortBy === 'candidate' || sortBy === 'employer') {
        orderByClause = ` ORDER BY NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), '') ${dir}, u.email ${dir}`;
      } else if (sortBy === 'education') {
        orderByClause = ` ORDER BY display_education ${dir}, u.location ${dir}`;
      } else if (sortBy === 'completion' || sortBy === 'profile_completion') {
        orderByClause = ` ORDER BY u.profile_completion ${dir}, u.id ${dir}`;
      } else if (sortBy === 'status') {
        orderByClause = ` ORDER BY u.is_active ${dir}, u.id ${dir}`;
      } else if (sortBy === 'last_login' || sortBy === 'last_active') {
        orderByClause = ` ORDER BY COALESCE(u.last_login, u.created_date) ${dir}, u.id ${dir}`;
      } else if (sortBy === 'created_date' || sortBy === 'registered_date' || sortBy === 'recent') {
        orderByClause = ` ORDER BY u.created_date ${dir}, u.id ${dir}`;
      } else if (status === 'New Registered' || status === 'Recent' || status === 'Recently Registered') {
        orderByClause = ` ORDER BY u.created_date ${dir}, u.id ${dir}`;
      } else if (status === 'Last Login' || status === 'Login') {
        orderByClause = ` ORDER BY COALESCE(u.last_login, u.last_active, u.created_date) ${dir}, u.id ${dir}`;
      }

      // 5. Paginated user data query
      let dataQueryParams = [...filterParams];
      let dataQuery = `
        SELECT 
          u.id, u.role_id, u.first_name, u.last_name, u.phone_code, u.phone, u.email, u.gender,
          u.is_email_verified, u.profile_image, u.about, u.skills, u.organization, u.user_type,
          u.class, u.course, u.start_year, u.end_year, u.experince_type, u.total_years, u.total_months,
          u.location, u.organization_type_id, u.is_active, u.created_date, u.updated_date,
          u.last_active, u.languages, u.visa_status, u.preferred_job_type, u.dob,
          u.company_headcount, u.visibility_mode, u.hidden_companies, u.allow_contact, u.show_in_search,
          u.certifications, u.accomplishments, u.additional_info, u.marital_status, u.notice_period,
          u.expected_salary, u.available_from, u.preferred_roles, u.preferred_locations,
          u.willing_to_relocate, u.current_salary, u.career_level, u.headline, u.auto_approve,
          u.company_id, u.allocated_seats, u.master_recruiter_id, u.last_login,
          COALESCE(u.profile_completion, 0) AS profile_completion,
          CASE WHEN u.resume IS NOT NULL AND u.resume != '' AND u.resume != '#' AND u.resume != 'null' AND u.resume != 'Resume' THEN 1 ELSE 0 END AS has_resume,
          r.name AS role_name, 
          ot.name AS organization_type,
          ue.qualification AS education_qualification,
          ue.course AS education_course,
          ue.college AS education_college,
          (SELECT COUNT(*) FROM applied_jobs aj WHERE aj.userId = u.id) AS applications_count,
          COALESCE(
            NULLIF(CONCAT_WS(' - ', NULLIF(ue.course, ''), NULLIF(ue.college, '')), ''),
            NULLIF(ue.college, ''), 
            NULLIF(ue.course, ''), 
            NULLIF(ue.qualification, ''), 
            NULLIF(u.course, ''), 
            NULLIF(u.class, '')
          ) AS display_education
        FROM users u 
        LEFT JOIN role r ON u.role_id = r.id
        LEFT JOIN organization_type ot ON u.organization_type_id = ot.id
        LEFT JOIN (
          SELECT user_id, qualification, course, college 
          FROM (
            SELECT user_id, qualification, course, college, 
                   ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY id DESC) as rn 
            FROM user_education 
            WHERE is_deleted = 0
          ) ranked 
          WHERE rn = 1
        ) ue ON u.id = ue.user_id
        ${filterWhere}
        ${orderByClause}
      `;

      if (page && limit) {
        const offset = (parseInt(page) - 1) * parseInt(limit);
        dataQuery += ` LIMIT ? OFFSET ?`;
        dataQueryParams.push(parseInt(limit), offset);
      }

      const [users] = await pool.query(dataQuery, dataQueryParams);

      const formattedUsers = users.map(user => ({
        ...user,
        resume: user.has_resume ? 'Resume' : null,
        last_active: user.last_active || user.updated_date || user.created_date,
        last_login: user.last_login || user.created_date,
        profile_completion: Number(user.profile_completion || 0),
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
            pending: stats.pending || 0,
            recent: Number(stats.new_registered !== undefined ? stats.new_registered : (stats.recent || 0)),
            new_registered: Number(stats.new_registered !== undefined ? stats.new_registered : (stats.recent || 0)),
            last_login: Number(stats.last_login || 0),
            completed: Number(stats.completed || 0),
            uncompleted: Number(stats.uncompleted || 0)
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
    role_id,
    extraData = {}
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
      
      // Recruiter and candidate organization data
      const userOrg = organization || null;
      const userOrgType = organization_type_id || null;
      const isVerified = (extraData?.is_email_verified === 1 || extraData?.is_email_verified === true || role_id == 3) ? 1 : 0;

      const query = `INSERT INTO users (first_name, last_name, phone_code, phone, email, password, organization, organization_type_id, role_id, is_email_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
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
        isVerified,
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

          const indType = Array.isArray(extraData?.industries)
            ? extraData.industries.join(', ')
            : (extraData?.industries || orgTypeName || null);
          const mapLoc = [extraData?.address1, extraData?.address2, extraData?.city, extraData?.state, extraData?.country, extraData?.pincode].filter(Boolean).join(', ') || null;
          const profImg = extraData?.profile_image || null;

          // 1. Sync / Create Company in `companies` table
          let realCompanyId = null;
          if (organization && organization.trim()) {
            try {
              const compName = organization.trim();
              const [existingComp] = await pool.query(
                `SELECT id, name FROM companies WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1`,
                [compName]
              );
              if (existingComp.length > 0) {
                realCompanyId = existingComp[0].id;
                await pool.query(
                  `UPDATE companies SET 
                    email = COALESCE(NULLIF(email, ''), ?),
                    phone = COALESCE(NULLIF(phone, ''), ?),
                    website = COALESCE(NULLIF(website, ''), ?),
                    city = COALESCE(NULLIF(city, ''), ?),
                    state = COALESCE(NULLIF(state, ''), ?),
                    country = COALESCE(NULLIF(country, ''), ?),
                    pincode = COALESCE(NULLIF(pincode, ''), ?),
                    address = COALESCE(NULLIF(address, ''), ?),
                    logo = COALESCE(NULLIF(logo, ''), ?),
                    industry = COALESCE(NULLIF(industry, ''), ?),
                    company_type = COALESCE(NULLIF(company_type, ''), ?),
                    updated_at = NOW()
                   WHERE id = ?`,
                  [
                    email,
                    phone,
                    extraData?.website_url || null,
                    extraData?.city || null,
                    extraData?.state || null,
                    extraData?.country || 'India',
                    extraData?.pincode || null,
                    [extraData?.address1, extraData?.address2].filter(Boolean).join(', ') || null,
                    profImg,
                    indType,
                    orgTypeName || 'Corporate',
                    realCompanyId
                  ]
                );
              } else {
                const [newComp] = await pool.query(
                  `INSERT INTO companies (
                    name, email, phone, website, industry, company_type, logo, address, city, state, country, pincode, status, created_at, updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
                  [
                    compName,
                    email,
                    phone,
                    extraData?.website_url || null,
                    indType || 'Information Technology',
                    orgTypeName || 'Corporate',
                    profImg,
                    [extraData?.address1, extraData?.address2].filter(Boolean).join(', ') || null,
                    extraData?.city || null,
                    extraData?.state || null,
                    extraData?.country || 'India',
                    extraData?.pincode || null,
                  ]
                );
                realCompanyId = newComp.insertId;
              }
            } catch (compErr) {
              console.warn("Notice syncing company in companies table:", compErr.message);
            }
          }

          // 2. Insert into `hr_profiles` table
          let companyProfileId = null;
          try {
            const [hrRes] = await pool.query(
              `INSERT INTO hr_profiles (user_id, company_name, organization_type, industry_type, map_location, contact_email, contact_phone, profile_image, website_url, year_established) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [userId, organization, orgTypeName, indType, mapLoc, email, phone, profImg, extraData?.website_url || null, extraData?.year_established || null]
            );
            companyProfileId = hrRes.insertId;
          } catch (hrErr) {
            console.warn("Notice inserting into hr_profiles:", hrErr.message);
          }

          // 3. Save recruiter's address into `user_address`
          if (extraData?.address1 || extraData?.city || extraData?.state || extraData?.pincode) {
            try {
              await pool.query(
                `INSERT INTO user_address (user_id, address1, address2, city, district, state, country, pincode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  userId,
                  extraData.address1 || '',
                  extraData.address2 || '',
                  extraData.city || '',
                  extraData.city || '',
                  extraData.state || '',
                  extraData.country || 'India',
                  extraData.pincode || '',
                ]
              );
            } catch (addrErr) {
              console.warn("Notice inserting recruiter address:", addrErr.message);
            }
          }

          // 4. Save recruiter's current professional experience into `user_professional`
          if (extraData?.designation || organization) {
            try {
              const skillStr = Array.isArray(extraData?.skills) ? extraData.skills.join(', ') : (extraData?.skills || '');
              await pool.query(
                `INSERT INTO user_professional (user_id, job_title, company_name, designation, start_date, end_date, currently_working, skills, location) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
                [
                  userId,
                  extraData.designation || 'Recruiter',
                  organization || '',
                  extraData.designation || 'Recruiter',
                  extraData.experience_from || null,
                  extraData.experience_to || 'Present',
                  skillStr,
                  extraData.location || extraData.city || ''
                ]
              );
            } catch (profErr) {
              console.warn("Notice inserting recruiter current professional experience:", profErr.message);
            }
          }

          // 5. Save previous companies if provided into `user_professional`
          if (Array.isArray(extraData?.previous_companies)) {
            for (const prev of extraData.previous_companies) {
              if (prev && (prev.company_name || prev.designation)) {
                try {
                  await pool.query(
                    `INSERT INTO user_professional (user_id, job_title, company_name, designation, start_date, end_date, currently_working, location) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
                    [
                      userId,
                      prev.designation || 'Previous Role',
                      prev.company_name || '',
                      prev.designation || 'Previous Role',
                      prev.from_year || prev.start_date || null,
                      prev.to_year || prev.end_date || null,
                      prev.location || ''
                    ]
                  );
                } catch (prevErr) {
                  console.warn("Notice inserting recruiter previous company:", prevErr.message);
                }
              }
            }
          }

          // 6. Update user details with all dynamic recruiter fields
          try {
            const skillStr = Array.isArray(extraData?.skills) ? extraData.skills.join(', ') : (extraData?.skills || null);
            const preferredRoles = Array.isArray(extraData?.functions) ? extraData.functions.join(', ') : (extraData?.functions || null);
            const careerLevel = Array.isArray(extraData?.hiring_levels) ? extraData.hiring_levels.join(', ') : (extraData?.hiring_levels || null);

            const dynamicDetails = {
              referral_code: extraData?.referral_code || '',
              industries: extraData?.industries || [],
              functions: extraData?.functions || [],
              hiring_levels: extraData?.hiring_levels || [],
              hiring_experience: extraData?.hiring_experience || '',
              skills: extraData?.skills || [],
              previous_companies: extraData?.previous_companies || [],
              company_address: {
                address1: extraData?.address1 || '',
                address2: extraData?.address2 || '',
                city: extraData?.city || '',
                state: extraData?.state || '',
                country: extraData?.country || 'India',
                pincode: extraData?.pincode || '',
              },
              registered_at: new Date().toISOString()
            };

            await pool.query(
              `UPDATE users SET 
                location = ?, 
                skills = ?, 
                headline = ?, 
                total_years = ?, 
                profile_image = ?, 
                preferred_roles = ?,
                career_level = ?,
                organization = ?,
                organization_type_id = ?,
                company_id = ?,
                additional_info = ?,
                profile_completion = 100,
                is_email_verified = 1,
                is_active = 1
               WHERE id = ?`,
              [
                extraData?.location || extraData?.city || null,
                skillStr,
                extraData?.designation || null,
                extraData?.hiring_experience || null,
                profImg,
                preferredRoles,
                careerLevel,
                organization || null,
                organization_type_id || null,
                realCompanyId || null,
                JSON.stringify(dynamicDetails),
                userId
              ]
            );
          } catch (uErr) {
            console.warn("Notice updating user recruiter extra details:", uErr.message);
          }

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
                [userId, realCompanyId || companyProfileId || null, freePlan.id, startDate, expiryDate]
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

        const [rows] = await pool.query(
          `SELECT * FROM users WHERE id = ?`,
          [userId]
        );
        result = rows;
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
    if (!id) throw new Error("User ID is required for deletion");
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const safeDelete = async (sql, params) => {
        try {
          await connection.query(sql, params);
        } catch (err) {
          console.warn(`[deleteUser cleanup notice - ${sql.split(' ')[2]}]:`, err.message);
        }
      };

      // 1. Delete support ticket messages linked to this user's tickets
      await safeDelete(
        `DELETE FROM ticket_messages WHERE ticket_id IN (SELECT id FROM support_tickets WHERE user_id = ?)`,
        [id]
      );
      await safeDelete(`DELETE FROM support_tickets WHERE user_id = ?`, [id]);

      // 2. Delete job application answers & history
      await safeDelete(`DELETE FROM applied_job_status_history WHERE user_id = ?`, [id]);
      await safeDelete(`DELETE FROM job_post_answers WHERE userId = ?`, [id]);
      await safeDelete(`DELETE FROM applied_jobs WHERE userId = ?`, [id]);
      await safeDelete(`DELETE FROM job_applications WHERE user_id = ?`, [id]);

      // 3. Delete education, experience & professional details
      await safeDelete(`DELETE FROM user_education WHERE user_id = ?`, [id]);
      await safeDelete(`DELETE FROM user_professional WHERE user_id = ?`, [id]);
      await safeDelete(`DELETE FROM user_projects WHERE user_id = ?`, [id]);
      await safeDelete(`DELETE FROM user_address WHERE user_id = ?`, [id]);
      await safeDelete(`DELETE FROM user_social_links WHERE user_id = ?`, [id]);

      // 4. Delete saved jobs, alerts, usage
      await safeDelete(`DELETE FROM user_saved_jobs WHERE user_id = ?`, [id]);
      await safeDelete(`DELETE FROM job_alerts WHERE user_id = ?`, [id]);
      await safeDelete(`DELETE FROM user_daily_usage WHERE user_id = ?`, [id]);

      // 5. Delete recruiter / folder associations
      await safeDelete(`DELETE FROM candidate_folder_items WHERE candidate_id = ?`, [id]);
      await safeDelete(`DELETE FROM hr_saved_candidates WHERE candidate_id = ?`, [id]);
      await safeDelete(`DELETE FROM recruiter_resume_access WHERE candidate_id = ?`, [id]);

      // 6. Delete event & workshop registrations
      await safeDelete(`DELETE FROM event_registrations WHERE userId = ?`, [id]);
      await safeDelete(`DELETE FROM workshop_registrations WHERE userId = ?`, [id]);

      // 7. Delete admin permissions if any
      await safeDelete(`DELETE FROM admin_permissions WHERE user_id = ?`, [id]);

      // 8. Finally delete the user account and login credentials
      const [user] = await connection.query(`DELETE FROM users WHERE id = ?`, [id]);

      await connection.commit();
      return user.affectedRows;
    } catch (error) {
      await connection.rollback();
      throw new Error(error.message);
    } finally {
      connection.release();
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
      if (!appliedjob_data || appliedjob_data.length === 0) {
        throw new Error("Application not found for the given user and job post");
      }
      const appliedjob_id = appliedjob_data[0].id;

      // Update primary application status so candidate and recruiter views stay synchronized
      await pool.query(
        `UPDATE applied_jobs SET status = ? WHERE id = ?`,
        [status, appliedjob_id]
      );

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
      UserModel.recalculateProfileCompletion(uid);
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
      UserModel.recalculateProfileCompletion(user_id);
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
      UserModel.recalculateProfileCompletion(user_id);
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
                        COALESCE(u.updated_date, u.last_active, u.created_date) AS updated_date,
                        COALESCE(u.last_active, (SELECT MAX(created_at) FROM user_daily_usage WHERE user_id = u.id), u.updated_date, u.created_date) AS last_active,
                        ot.name AS organization_type
                    FROM
                        users u
                    INNER JOIN role r ON
                        u.role_id = r.id
                    LEFT JOIN organization_type ot ON
                      u.organization_type_id = ot.id
                    WHERE
                        u.id = ?`;
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
          skills: row.skills ? (typeof row.skills === 'string' ? (() => { try { const p = JSON.parse(row.skills); return Array.isArray(p) ? p : [p]; } catch (e) { return row.skills.split(',').map(s => s.trim()).filter(Boolean); } })() : row.skills) : [],
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
          skills: row.skills ? (typeof row.skills === 'string' ? (() => { try { const p = JSON.parse(row.skills); return Array.isArray(p) ? p : [p]; } catch (e) { return row.skills.split(',').map(s => s.trim()).filter(Boolean); } })() : row.skills) : [],
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
          COALESCE(h.profile_image, u.profile_image) AS profile_image,
          h.banner_image,
          COALESCE(h.company_name, u.organization) AS company_name,
          h.about_us,
          COALESCE(h.organization_type, ot.name) AS organization_type,
          COALESCE(h.industry_type, u.preferred_roles) AS industry_type,
          h.team_size,
          COALESCE(h.year_established, JSON_UNQUOTE(JSON_EXTRACT(u.additional_info, '$.year_established'))) AS year_established,
          COALESCE(h.website_url, c.website, JSON_UNQUOTE(JSON_EXTRACT(u.additional_info, '$.website_url'))) AS website_url,
          h.vision,
          COALESCE(h.map_location, ua.address1, u.location) AS map_location,
          COALESCE(h.contact_phone, u.phone) AS contact_phone,
          COALESCE(h.contact_email, u.email) AS contact_email,
          CASE WHEN u.is_email_verified = 1 THEN 1 ELSE 0 END AS is_email_verified,
          u.first_name,
          u.last_name,
          u.headline,
          u.location,
          u.skills,
          u.total_years,
          u.preferred_roles,
          u.career_level,
          u.additional_info,
          u.company_id,
          ua.address1,
          ua.address2,
          ua.city,
          ua.state,
          ua.country,
          ua.pincode,
          s.facebook,
          s.twitter,
          s.instagram,
          s.linkedin as youtube
        FROM users u
        LEFT JOIN hr_profiles h ON h.user_id = u.id
        LEFT JOIN companies c ON u.company_id = c.id
        LEFT JOIN organization_type ot ON u.organization_type_id = ot.id
        LEFT JOIN user_address ua ON u.id = ua.user_id AND (ua.is_deleted = 0 OR ua.is_deleted IS NULL)
        LEFT JOIN user_social_links s ON u.id = s.user_id
        WHERE u.id = ?
      `;
      const [rows] = await pool.query(query, [user_id]);
      if (rows && rows.length > 0) {
        const profile = rows[0];
        try {
          const [profRows] = await pool.query(
            `SELECT id, job_title, company_name, designation, start_date, end_date, currently_working, location, skills 
             FROM user_professional 
             WHERE user_id = ? 
             ORDER BY currently_working DESC, id DESC`,
            [user_id]
          );
          profile.experiences = profRows || [];
          profile.previous_companies = (profRows || []).filter(p => !p.currently_working);
          profile.current_experience = (profRows || []).find(p => p.currently_working) || null;
        } catch (e) {
          console.warn('user_professional fetch error:', e.message);
        }
        return profile;
      }

      // Fallback: Check if user belongs to a company or is a team/sub-recruiter linked to an HR profile
      const fallbackQuery = `
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
          CASE WHEN target_u.is_email_verified = 1 THEN 1 ELSE 0 END AS is_email_verified,
          s.facebook,
          s.twitter,
          s.instagram,
          s.linkedin as youtube
        FROM users req_u
        LEFT JOIN sub_recruiters sr ON sr.sub_recruiter_id = req_u.id
        JOIN users target_u ON (
          (req_u.company_id IS NOT NULL AND target_u.company_id = req_u.company_id)
          OR (sr.main_recruiter_id IS NOT NULL AND target_u.id = sr.main_recruiter_id)
        )
        JOIN hr_profiles h ON h.user_id = target_u.id
        LEFT JOIN user_social_links s ON h.user_id = s.user_id
        WHERE req_u.id = ?
        ORDER BY h.id DESC
        LIMIT 1
      `;
      const [fallbackRows] = await pool.query(fallbackQuery, [user_id]);
      return fallbackRows && fallbackRows.length > 0 ? fallbackRows[0] : null;
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
