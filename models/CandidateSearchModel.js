const pool = require("../config/dbConfig");

// In-memory cache for overall candidate counts across the platform (TTL: 60 seconds)
let cachedCounts = null;
let countsExpiry = 0;
const COUNTS_TTL = 60 * 1000;

// In-memory cache for filter options (TTL: 10 minutes)
let cachedFilterOptions = null;
let filterOptionsExpiry = 0;
const FILTER_OPTIONS_TTL = 10 * 60 * 1000;

const CandidateSearchModel = {
  searchCandidates: async (params) => {
    try {
      const {
        search = "",
        keywordMatch = "any",
        skills = [],
        location = [],
        preferredLocations = [],
        includeRelocating = false,
        experienceMin,
        experienceMax,
        jobTitle = [],
        company = [],
        companyMatch = "",
        excludedCompanies = [],
        excludedKeywords = [],
        industry = [],
        designation = "",
        gender = [],
        education = [],
        activeUpdated = "",
        hasResume = false,
        verifiedEmail = false,
        status = "",
        language = [],
        visaStatus = [],
        jobType = [],
        companyHeadcount = [],
        ageMin,
        ageMax,
        page = 1,
        limit = 40,
        sortBy = "Relevance",
      } = params;

      // Parse and clean search keywords
      let searchTerms = [];
      if (search && search.trim()) {
        const rawTerms = search.trim().split(/[\s,]+/);
        searchTerms = Array.from(new Set(rawTerms.map(t => t.trim()).filter(Boolean)));
      }

      // Check which joined tables are actually required for this query
      const hasSearchTerms = searchTerms.length > 0;
      const hasSkills = Array.isArray(skills) && skills.length > 0;
      const hasJobTitle = Array.isArray(jobTitle) && jobTitle.length > 0;
      const hasCompany = Array.isArray(company) && company.length > 0;
      const hasExcludedCompanies = Array.isArray(excludedCompanies) && excludedCompanies.length > 0;
      const hasExcludedKeywords = Array.isArray(excludedKeywords) && excludedKeywords.length > 0;
      const hasIndustry = Array.isArray(industry) && industry.length > 0;
      const hasDesignation = Boolean(designation && designation.trim());
      const hasEducation = Array.isArray(education) && education.length > 0;

      // Only perform joins if the query actually filters or searches on those tables
      const needsProfJoin = hasSearchTerms || hasSkills || hasJobTitle || hasCompany || hasExcludedCompanies || hasExcludedKeywords || hasIndustry || hasDesignation;
      const needsEduJoin = hasSearchTerms || hasEducation;

      const whereClauses = ["u.role_id = 2"];
      const queryParams = [];

      // Candidate status filter
      const normalizedStatus = (status || '').toLowerCase().trim();
      if (normalizedStatus === 'active' || normalizedStatus === 'active only') {
        whereClauses.push("u.is_active = 1");
      } else if (normalizedStatus === 'inactive' || normalizedStatus === 'inactive only') {
        whereClauses.push("(u.is_active = 0 OR u.is_active IS NULL)");
      } else if (normalizedStatus === 'recently updated') {
        whereClauses.push("(u.updated_date IS NOT NULL OR u.last_active IS NOT NULL)");
      } else if (normalizedStatus === 'all candidates' || normalizedStatus === 'all') {
        // Show all candidates, no is_active restriction
      } else {
        // Default (Active / Updated)
        whereClauses.push("(u.is_active = 1 OR u.is_active IS NULL)");
      }

      // Global Keyword Search (matches ANY or ALL words)
      if (hasSearchTerms) {
        const operator = keywordMatch === 'all' ? ' AND ' : ' OR ';
        const termClauses = searchTerms.map(() => `(
          u.first_name LIKE ? OR 
          u.last_name LIKE ? OR 
          CONCAT(u.first_name, ' ', u.last_name) LIKE ? OR
          u.email LIKE ? OR 
          u.phone LIKE ? OR 
          u.location LIKE ? OR 
          u.skills LIKE ? OR 
          u.course LIKE ? OR 
          u.about LIKE ? OR 
          up.job_title LIKE ? OR 
          up.company_name LIKE ? OR 
          up.designation LIKE ? OR 
          ue.course LIKE ? OR 
          ue.college LIKE ? OR 
          ue.specialization LIKE ?
        )`);

        whereClauses.push(`(${termClauses.join(operator)})`);
        searchTerms.forEach(term => {
          const searchPattern = `%${term}%`;
          for (let i = 0; i < 15; i++) {
            queryParams.push(searchPattern);
          }
        });
      }

      // Excluded Keywords
      if (hasExcludedKeywords) {
        excludedKeywords.forEach(kw => {
          if (kw.trim()) {
            whereClauses.push(`NOT (
              u.first_name LIKE ? OR 
              u.last_name LIKE ? OR 
              u.skills LIKE ? OR 
              u.about LIKE ? OR 
              up.job_title LIKE ? OR 
              up.company_name LIKE ?
            )`);
            const exPattern = `%${kw.trim()}%`;
            for (let i = 0; i < 6; i++) {
              queryParams.push(exPattern);
            }
          }
        });
      }

      // Skills Filter
      if (hasSkills) {
        const skillConditions = skills.map(() => `(u.skills LIKE ? OR up.skills LIKE ?)`).join(' OR ');
        whereClauses.push(`(${skillConditions})`);
        skills.forEach(skill => {
          queryParams.push(`%${skill.trim()}%`, `%${skill.trim()}%`);
        });
      }

      // Location Filter (Primary location + Preferred locations)
      const allLocations = [
        ...(Array.isArray(location) ? location : (location ? [location] : [])),
        ...(Array.isArray(preferredLocations) ? preferredLocations : (preferredLocations ? [preferredLocations] : []))
      ].filter(Boolean);

      if (allLocations.length > 0) {
        const locationConditions = allLocations.map(() => `u.location LIKE ?`).join(' OR ');
        whereClauses.push(`(${locationConditions})`);
        allLocations.forEach(loc => queryParams.push(`%${loc.trim()}%`));
      }

      // Job Title Filter
      if (hasJobTitle) {
        const titleConditions = jobTitle.map(() => `up.job_title LIKE ?`).join(' OR ');
        whereClauses.push(`(${titleConditions})`);
        jobTitle.forEach(title => queryParams.push(`%${title.trim()}%`));
      }

      // Company Filter
      if (hasCompany) {
        const companyConditions = company.map(() => `up.company_name LIKE ?`).join(' OR ');
        whereClauses.push(`(${companyConditions})`);
        company.forEach(comp => queryParams.push(`%${comp.trim()}%`));

        if (companyMatch === 'Current employees') {
          whereClauses.push(`up.currently_working = 1`);
        } else if (companyMatch === 'Past employees') {
          whereClauses.push(`(up.currently_working = 0 OR up.currently_working IS NULL)`);
        }
      }

      // Excluded Companies
      if (hasExcludedCompanies) {
        excludedCompanies.forEach(comp => {
          if (comp.trim()) {
            whereClauses.push(`(up.company_name IS NULL OR up.company_name NOT LIKE ?)`);
            queryParams.push(`%${comp.trim()}%`);
          }
        });
      }

      // Industry Filter
      if (hasIndustry) {
        const indConditions = industry.map(() => `(up.job_title LIKE ? OR up.skills LIKE ? OR u.skills LIKE ? OR u.organization LIKE ?)`).join(' OR ');
        whereClauses.push(`(${indConditions})`);
        industry.forEach(ind => {
          queryParams.push(`%${ind.trim()}%`, `%${ind.trim()}%`, `%${ind.trim()}%`, `%${ind.trim()}%`);
        });
      }

      // Designation Filter
      if (hasDesignation) {
        whereClauses.push(`(up.designation LIKE ? OR up.job_title LIKE ?)`);
        queryParams.push(`%${designation.trim()}%`, `%${designation.trim()}%`);
      }

      // Gender Filter
      if (gender && gender.length > 0) {
        const genderConditions = gender.map(() => `LOWER(u.gender) = LOWER(?)`).join(' OR ');
        whereClauses.push(`(${genderConditions})`);
        gender.forEach(g => queryParams.push(g.trim()));
      }

      // Education / Course Filter
      if (hasEducation) {
        const eduConditions = education.map(edu => {
          if (edu === 'Any UG' || edu === 'Graduation') {
            return `(u.course IS NOT NULL OR ue.qualification = 'Graduation' OR ue.course IS NOT NULL)`;
          } else if (edu === 'Any PG' || edu === 'Post Graduation') {
            return `(ue.qualification = 'Post Graduation' OR u.course LIKE '%M%' OR u.course LIKE '%MBA%')`;
          } else {
            return `(u.course LIKE ? OR ue.course LIKE ? OR ue.qualification LIKE ?)`;
          }
        });
        
        whereClauses.push(`(${eduConditions.join(' OR ')})`);
        education.forEach(edu => {
          if (edu !== 'Any UG' && edu !== 'Graduation' && edu !== 'Any PG' && edu !== 'Post Graduation') {
            queryParams.push(`%${edu.trim()}%`, `%${edu.trim()}%`, `%${edu.trim()}%`);
          }
        });
      }

      // Experience Filter
      const minExp = parseInt(experienceMin, 10);
      const maxExp = parseInt(experienceMax, 10);

      if (!isNaN(minExp) && minExp > 0) {
        whereClauses.push(`CAST(u.total_years AS UNSIGNED) >= ?`);
        queryParams.push(minExp);
      } else if (minExp === 0 && maxExp === 0) {
        whereClauses.push(`(u.experince_type = 'Fresher' OR CAST(u.total_years AS UNSIGNED) = 0 OR u.total_years IS NULL OR u.total_years = '')`);
      }

      if (!isNaN(maxExp) && maxExp > 0 && !(minExp === 0 && maxExp === 0)) {
        whereClauses.push(`(CAST(u.total_years AS UNSIGNED) <= ? OR u.experince_type = 'Fresher')`);
        queryParams.push(maxExp);
      }

      // Active / Updated within days
      if (activeUpdated) {
        let days = parseInt(activeUpdated, 10);
        if (isNaN(days)) {
          const str = String(activeUpdated).toLowerCase();
          if (str.includes('7')) days = 7;
          else if (str.includes('15')) days = 15;
          else if (str.includes('1 month') || str.includes('30')) days = 30;
          else if (str.includes('3 month') || str.includes('90')) days = 90;
          else if (str.includes('6 month') || str.includes('180')) days = 180;
          else if (str.includes('12 month') || str.includes('1 year') || str.includes('365')) days = 365;
        }

        if (!isNaN(days) && days > 0) {
          whereClauses.push(`(COALESCE(u.last_active, u.updated_date, u.created_date) >= DATE_SUB(NOW(), INTERVAL ? DAY))`);
          queryParams.push(days);
        }
      }

      // Has Resume
      if (hasResume) {
        whereClauses.push(`u.resume IS NOT NULL AND u.resume != '' AND u.resume != 'null'`);
      }

      // Verified Email
      if (verifiedEmail) {
        whereClauses.push(`u.is_email_verified = 1`);
      }

      // Age
      if (ageMin || ageMax) {
        if (!isNaN(ageMin) && ageMin > 0) {
          whereClauses.push(`TIMESTAMPDIFF(YEAR, u.dob, CURDATE()) >= ?`);
          queryParams.push(parseInt(ageMin, 10));
        }
        if (!isNaN(ageMax) && ageMax > 0) {
          whereClauses.push(`TIMESTAMPDIFF(YEAR, u.dob, CURDATE()) <= ?`);
          queryParams.push(parseInt(ageMax, 10));
        }
      }

      // Languages
      if (Array.isArray(language) && language.length > 0) {
        const langClauses = language.map(() => `JSON_CONTAINS(u.languages, JSON_QUOTE(?))`);
        whereClauses.push(`(${langClauses.join(' OR ')})`);
        queryParams.push(...language);
      }

      // Visa Status
      if (Array.isArray(visaStatus) && visaStatus.length > 0) {
        const visaClauses = visaStatus.map(() => `u.visa_status = ?`);
        whereClauses.push(`(${visaClauses.join(' OR ')})`);
        queryParams.push(...visaStatus);
      }

      // Job Type
      if (Array.isArray(jobType) && jobType.length > 0) {
        const jobTypeClauses = jobType.map(() => `JSON_CONTAINS(u.preferred_job_type, JSON_QUOTE(?))`);
        whereClauses.push(`(${jobTypeClauses.join(' OR ')})`);
        queryParams.push(...jobType);
      }

      // Company Headcount
      if (Array.isArray(companyHeadcount) && companyHeadcount.length > 0) {
        const headcountClauses = companyHeadcount.map(() => `u.company_headcount = ?`);
        whereClauses.push(`(${headcountClauses.join(' OR ')})`);
        queryParams.push(...companyHeadcount);
      }

      // Build FROM clause (joins only if needed)
      let fromClause = "FROM users u";
      if (needsProfJoin) {
        fromClause += " LEFT JOIN user_professional up ON u.id = up.user_id AND up.is_deleted = 0";
      }
      if (needsEduJoin) {
        fromClause += " LEFT JOIN user_education ue ON u.id = ue.user_id AND ue.is_deleted = 0";
      }

      const whereSQL = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : "";

      // 1. FAST COUNT: Direct COUNT on indexed ID without creating massive derived tables
      const countSelect = (needsProfJoin || needsEduJoin) ? "COUNT(DISTINCT u.id) as total" : "COUNT(*) as total";
      const countQuery = `SELECT ${countSelect} ${fromClause}${whereSQL}`;
      const [countResult] = await pool.query(countQuery, queryParams);
      const totalCount = countResult[0]?.total || 0;

      // 2. Sorting
      const dataQueryParams = [...queryParams];
      let orderByClause = " ORDER BY COALESCE(u.last_active, u.updated_date, u.created_date) DESC, u.id DESC";
      if (sortBy === "Oldest" || sortBy === "Oldest First") {
        orderByClause = " ORDER BY u.created_date ASC, u.id ASC";
      } else if (sortBy === "Name A-Z") {
        orderByClause = " ORDER BY u.first_name ASC, u.last_name ASC, u.id ASC";
      } else if (sortBy === "Name Z-A") {
        orderByClause = " ORDER BY u.first_name DESC, u.last_name DESC, u.id DESC";
      } else if (sortBy === "Experience (High to Low)" || sortBy === "Experience") {
        orderByClause = " ORDER BY CAST(u.total_years AS UNSIGNED) DESC, u.id DESC";
      } else if (sortBy === "Experience (Low to High)") {
        orderByClause = " ORDER BY (CASE WHEN u.total_years IS NULL OR u.total_years = '' OR u.experince_type = 'Fresher' THEN 0 ELSE CAST(u.total_years AS UNSIGNED) END) ASC, u.id ASC";
      } else if (sortBy === "Newest" || sortBy === "Newest First") {
        orderByClause = " ORDER BY u.created_date DESC, u.id DESC";
      } else if (sortBy === "Relevance") {
        if (searchTerms.length > 0) {
          const boostClauses = searchTerms.map(() => `(CASE WHEN u.skills LIKE ? OR u.about LIKE ? OR CONCAT(u.first_name, ' ', u.last_name) LIKE ? THEN 1 ELSE 0 END)`);
          orderByClause = ` ORDER BY (${boostClauses.join(' + ')}) DESC, COALESCE(u.last_active, u.updated_date, u.created_date) DESC, u.id DESC`;
          searchTerms.forEach(term => {
            const p = `%${term}%`;
            dataQueryParams.push(p, p, p);
          });
        } else {
          orderByClause = " ORDER BY COALESCE(u.last_active, u.updated_date, u.created_date) DESC, u.id DESC";
        }
      }

      // Pagination
      const parsedLimit = parseInt(limit, 10) || 10;
      const parsedPage = parseInt(page, 10) || 1;
      const offset = (parsedPage - 1) * parsedLimit;

      const distinctKeyword = (needsProfJoin || needsEduJoin) ? "DISTINCT " : "";
      const candidateColumns = `
        u.id, u.role_id, u.first_name, u.last_name, u.phone_code, u.phone,
        u.email, u.gender, u.is_email_verified, u.profile_image, u.resume,
        u.about, u.skills, u.organization, u.user_type, u.class, u.course,
        u.start_year, u.end_year, u.experince_type, u.total_years, u.total_months,
        u.location, u.organization_type_id, u.is_active, u.created_date,
        u.updated_date, u.banner_color, u.banner_image, u.last_active,
        u.preferred_job_type
      `;

      const dataQuery = `
        SELECT ${distinctKeyword}${candidateColumns}
        ${fromClause}${whereSQL}
        ${orderByClause}
        LIMIT ? OFFSET ?
      `;
      dataQueryParams.push(parsedLimit, offset);

      // Fetch candidate records
      const [candidates] = await pool.query(dataQuery, dataQueryParams);

      // 3. Batched fetch of user_professional, user_education, and folder items
      const candidateIds = candidates.map(c => c.id);
      const profListMap = {};
      const eduMap = {};
      const folderMap = {};

      if (candidateIds.length > 0) {
        const [allProf] = await pool.query(
          `SELECT user_id, job_title, company_name, designation, currently_working 
           FROM user_professional 
           WHERE user_id IN (?) AND is_deleted = 0 
           ORDER BY currently_working DESC, id DESC`,
          [candidateIds]
        );
        allProf.forEach(row => {
          if (!profListMap[row.user_id]) {
            profListMap[row.user_id] = [];
          }
          profListMap[row.user_id].push(row);
        });

        const [allEdu] = await pool.query(
          `SELECT user_id, qualification, course, specialization, college, percentage, cgpa 
           FROM user_education 
           WHERE user_id IN (?) AND is_deleted = 0 
           ORDER BY id DESC`,
          [candidateIds]
        );
        allEdu.forEach(row => {
          if (!eduMap[row.user_id]) {
            eduMap[row.user_id] = row;
          }
        });

        try {
          const [allFolderItems] = await pool.query(
            `SELECT cfi.candidate_id, cfi.folder_id, cfi.stage, cfi.created_at as saved_at,
                    cf.name as folder_name, u.first_name as recruiter_first_name, u.last_name as recruiter_last_name
             FROM candidate_folder_items cfi
             JOIN candidate_folders cf ON cf.id = cfi.folder_id
             LEFT JOIN users u ON u.id = cf.recruiter_id
             WHERE cfi.candidate_id IN (?)
             ORDER BY cfi.id DESC`,
            [candidateIds]
          );
          allFolderItems.forEach(item => {
            if (!folderMap[item.candidate_id]) folderMap[item.candidate_id] = [];
            folderMap[item.candidate_id].push({
              folder_id: item.folder_id,
              folder_name: item.folder_name,
              stage: item.stage || 'prospect',
              saved_at: item.saved_at,
              saved_by: (item.recruiter_first_name ? `${item.recruiter_first_name} ${item.recruiter_last_name || ''}` : '').trim() || 'Recruiter'
            });
          });
        } catch (fErr) {
          console.error("Error fetching candidate folders:", fErr);
        }
      }

      // Format candidates in-memory without extra DB queries
      const formattedCandidates = candidates.map((user) => {
        let parsedSkills = [];
        try {
          const raw = user.skills ? JSON.parse(user.skills) : [];
          if (Array.isArray(raw)) {
            parsedSkills = raw.flatMap(s => typeof s === 'string' ? s.split(',') : s);
          } else if (typeof raw === 'string') {
            parsedSkills = raw.split(',');
          }
        } catch (e) {
          parsedSkills = user.skills ? user.skills.split(',') : [];
        }
        parsedSkills = Array.from(new Set(
          parsedSkills
            .map(s => String(s || '').replace(/[\[\]'"]+/g, '').trim())
            .filter(Boolean)
        ));

        const userProfs = profListMap[user.id] || [];
        const currentProf = userProfs.find(p => p.currently_working == 1) || userProfs[0] || null;
        const pastProfs = userProfs.filter(p => p !== currentProf);
        const pastProf = pastProfs.find(p => p.currently_working == 0) || pastProfs[0] || null;
        const edu = eduMap[user.id] || null;

        // Parse preferred job preferences (locations, notice period, expected salary, etc.)
        let prefData = {};
        if (user.preferred_job_type) {
          try {
            prefData = typeof user.preferred_job_type === 'string'
              ? JSON.parse(user.preferred_job_type)
              : (user.preferred_job_type || {});
          } catch (e) {
            prefData = {};
          }
        }

        const prefLocations = Array.isArray(prefData.preferredLocations)
          ? prefData.preferredLocations
          : (Array.isArray(prefData.preferred_locations)
              ? prefData.preferred_locations
              : (typeof prefData.preferredLocations === 'string' ? prefData.preferredLocations.split(',').map(s => s.trim()).filter(Boolean) : []));

        const noticePeriodVal = prefData.noticePeriod || prefData.notice_period || null;
        const expectedSalaryVal = prefData.expectedSalary || prefData.expected_salary || null;

        // Friendly education display
        let educationDisplay = null;
        if (edu) {
          const parts = [];
          const degreePart = edu.course || edu.qualification;
          if (degreePart) {
            parts.push(edu.specialization ? `${degreePart} (${edu.specialization})` : degreePart);
          }
          if (edu.college) parts.push(edu.college);
          educationDisplay = parts.join(' • ');
        } else if (user.course) {
          educationDisplay = user.course + (user.class ? ` (${user.class})` : '');
        }

        // Friendly past experience display
        // Priority:
        // 1. Separate past work experience (pastProf)
        // 2. If candidate only entered 1 company in their profile, fallback to that company (currentProf)
        // 3. Fallback to user.organization
        const effectivePast = pastProf || currentProf;
        let pastExperienceDisplay = null;
        let pastCompany = null;
        let pastJobTitle = null;

        if (effectivePast) {
          const comp = (effectivePast.company_name && String(effectivePast.company_name).trim().toLowerCase() !== 'null') ? String(effectivePast.company_name).trim() : null;
          const title = (effectivePast.job_title && String(effectivePast.job_title).trim().toLowerCase() !== 'null')
            ? String(effectivePast.job_title).trim()
            : ((effectivePast.designation && String(effectivePast.designation).trim().toLowerCase() !== 'null') ? String(effectivePast.designation).trim() : null);

          pastCompany = comp;
          pastJobTitle = title;

          if (title && comp) {
            pastExperienceDisplay = `${title} at ${comp}`;
          } else {
            pastExperienceDisplay = comp || title || null;
          }
        } else if (user.organization && String(user.organization).trim().toLowerCase() !== 'null') {
          pastCompany = String(user.organization).trim();
          pastExperienceDisplay = pastCompany;
        }

        // Calculate friendly experience string
        let experienceDisplay = "Fresher";
        if (user.total_years && user.total_years !== "0 Years" && user.total_years !== "0") {
          experienceDisplay = user.total_years;
          if (user.total_months && user.total_months !== "0 Months") {
            experienceDisplay += ` ${user.total_months}`;
          }
        } else if (user.experince_type && user.experince_type !== 'Fresher') {
          experienceDisplay = user.experince_type;
        }

        const candFolders = folderMap[user.id] || [];
        let primaryStage = 'prospect';
        if (candFolders.length > 0) {
          const stages = candFolders.map(f => (f.stage || '').toLowerCase());
          if (stages.includes('hired') || stages.includes('selected')) primaryStage = 'hired';
          else if (stages.includes('interviewed') || stages.includes('interview')) primaryStage = 'interviewed';
          else if (stages.includes('shortlisted')) primaryStage = 'shortlisted';
          else if (stages.includes('rejected')) primaryStage = 'rejected';
          else primaryStage = candFolders[0].stage || 'prospect';
        }

        return {
          ...user,
          skills: Array.isArray(parsedSkills) ? parsedSkills : [],
          current_job_title: currentProf ? (currentProf.job_title || currentProf.designation) : null,
          current_company: currentProf ? currentProf.company_name : null,
          designation: currentProf ? currentProf.designation : null,
          past_job_title: pastJobTitle,
          past_company: pastCompany,
          past_experience_display: pastExperienceDisplay,
          education: edu ? edu : (user.course ? { course: user.course } : null),
          education_display: educationDisplay,
          preferred_locations: prefLocations,
          notice_period: noticePeriodVal,
          expected_salary: expectedSalaryVal,
          experience_display: experienceDisplay,
          saved_in_folders: candFolders,
          primary_stage: primaryStage,
          is_saved: candFolders.length > 0,
          password: null,
          fcm_token: null
        };
      });

      // 4. Overall candidate counts with in-memory TTL caching (60s)
      let totalAllEmployees = totalCount;
      let totalActiveEmployees = totalCount;
      try {
        if (cachedCounts && Date.now() < countsExpiry) {
          totalAllEmployees = cachedCounts.totalEmployees;
          totalActiveEmployees = cachedCounts.activeEmployees;
        } else {
          const [overallCounts] = await pool.query(`
            SELECT 
              COUNT(*) as totalEmployees,
              SUM(CASE WHEN is_active = 1 OR is_active IS NULL THEN 1 ELSE 0 END) as activeEmployees
            FROM users 
            WHERE role_id = 2
          `);
          if (overallCounts && overallCounts[0]) {
            totalAllEmployees = Number(overallCounts[0].totalEmployees) || totalCount;
            totalActiveEmployees = Number(overallCounts[0].activeEmployees) || totalCount;
            cachedCounts = { totalEmployees: totalAllEmployees, activeEmployees: totalActiveEmployees };
            countsExpiry = Date.now() + COUNTS_TTL;
          }
        }
      } catch (err) {
        console.error("Error fetching overall counts:", err);
      }

      return {
        candidates: formattedCandidates,
        total: totalCount,
        totalPages: Math.ceil(totalCount / parsedLimit) || 1,
        currentPage: parsedPage,
        limit: parsedLimit,
        totalAllEmployees,
        totalActiveEmployees,
        pagination: {
          total: totalCount,
          totalPages: Math.ceil(totalCount / parsedLimit) || 1,
          currentPage: parsedPage,
          limit: parsedLimit
        }
      };

    } catch (error) {
      throw new Error("Error in CandidateSearchModel.searchCandidates: " + error.message);
    }
  },

  getFilterOptions: async () => {
    try {
      // Return cached filter options if available and fresh
      if (cachedFilterOptions && Date.now() < filterOptionsExpiry) {
        return cachedFilterOptions;
      }

      // Fetch available locations
      const [locations] = await pool.query(`
        SELECT DISTINCT location 
        FROM users 
        WHERE role_id = 2 AND location IS NOT NULL AND location != ''
      `);

      const standardLocations = [
        "Chennai", "Bengaluru", "Hyderabad", "Mumbai", "Delhi", "Pune", "Noida", "Gurugram", "Kolkata", "Ahmedabad", "Coimbatore", "Kochi", "Remote"
      ];
      const locationList = Array.from(new Set([
        ...locations.map(l => l.location.trim()).filter(Boolean),
        ...standardLocations
      ])).sort();

      // Fetch available job titles
      const [jobTitles] = await pool.query(`
        SELECT DISTINCT job_title 
        FROM user_professional 
        WHERE is_deleted = 0 AND job_title IS NOT NULL AND job_title != ''
      `);

      // Fetch ALL registered companies across the entire database (hr_profiles, job_post, user_professional)
      const [companiesResult] = await pool.query(`
        SELECT DISTINCT company_name FROM (
          SELECT TRIM(company_name) as company_name FROM hr_profiles WHERE company_name IS NOT NULL AND TRIM(company_name) != ''
          UNION
          SELECT TRIM(company_name) as company_name FROM job_post WHERE company_name IS NOT NULL AND TRIM(company_name) != ''
          UNION
          SELECT TRIM(company_name) as company_name FROM user_professional WHERE is_deleted = 0 AND company_name IS NOT NULL AND TRIM(company_name) != ''
        ) as all_companies
        WHERE company_name IS NOT NULL AND company_name != ''
        ORDER BY company_name ASC
      `);

      // Top corporate/tech employers to guarantee comprehensive availability
      const standardEmployers = [
        "ACTE Technologies", "Markerz Global Solutions", "Learnovita",
        "Tata Consultancy Services (TCS)", "Infosys", "Wipro", "HCLTech", "Tech Mahindra",
        "Accenture", "Cognizant", "Capgemini", "LTIMindtree", "IBM", "Oracle", "SAP",
        "Amazon", "Google", "Microsoft", "Meta", "Apple", "Netflix", "Cisco", "Salesforce",
        "Dell Technologies", "Intel", "NVIDIA", "Qualcomm", "Adobe", "ServiceNow",
        "Deloitte", "PwC", "EY (Ernst & Young)", "KPMG", "McKinsey & Company", "Boston Consulting Group",
        "HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank", "Kotak Mahindra Bank", "JPMorgan Chase", "Goldman Sachs", "Morgan Stanley", "Citigroup",
        "Reliance Industries", "Tata Motors", "Larsen & Toubro (L&T)", "Mahindra & Mahindra", "Bajaj Auto",
        "Flipkart", "Swiggy", "Zomato", "Paytm", "PhonePe", "Razorpay", "Ola", "Uber", "CRED"
      ];

      const companyList = Array.from(new Set([
        ...companiesResult.map(c => c.company_name?.trim()).filter(Boolean),
        ...standardEmployers
      ])).sort();

      // Fetch skills from users
      const [skillsResult] = await pool.query(`
        SELECT skills FROM users WHERE role_id = 2 AND skills IS NOT NULL AND skills != ''
      `);
      
      const allSkills = new Set();
      skillsResult.forEach(row => {
        try {
          const parsed = JSON.parse(row.skills);
          if (Array.isArray(parsed)) {
            parsed.forEach(s => { if(s && s.trim()) allSkills.add(s.trim()); });
          }
        } catch(e) {
          row.skills.split(",").forEach(s => {
            const clean = s.replace(/['"]+/g, "").trim();
            if (clean) allSkills.add(clean);
          });
        }
      });

      // Fetch all courses / degrees from course_master, user_education, and users
      let masterCourses = [];
      try {
        const [cmRows] = await pool.query('SELECT name FROM course_master WHERE is_deleted = 0 ORDER BY name ASC');
        masterCourses = cmRows.map(r => r.name.trim()).filter(Boolean);
      } catch (e) {}

      const [coursesResult] = await pool.query(`
        SELECT DISTINCT course FROM users WHERE role_id = 2 AND course IS NOT NULL AND course != ''
        UNION
        SELECT DISTINCT course FROM user_education WHERE is_deleted = 0 AND course IS NOT NULL AND course != ''
      `);

      const standardUG = [
        "B.Tech", "B.E.", "B.Sc", "B.Com", "BCA", "BBA", "BA", "LLB", "MBBS",
        "BDS", "BHMS", "BAMS", "B.Pharm", "Pharm.D", "B.Arch", "B.Design",
        "BFA (Fine Arts)", "B.Ed", "D.Ed (Diploma in Education)", "Diploma in Engineering", "Polytechnic", "ITI"
      ];

      const standardPG = [
        "M.Tech", "ME", "MBA", "MCA", "M.Sc", "M.Com", "MA", "LLM",
        "M.Pharm", "M.Arch", "MFA (Fine Arts)", "M.Design", "M.Ed",
        "PG Diploma", "CA (Chartered Accountant)", "CS (Company Secretary)", "ICWA (Cost Accountant)", "MS"
      ];

      const standardDoctorate = ["PhD", "Doctorate", "M.Phil", "Post-Doctorate"];

      // Categorize into UG, PG, Doctorate
      const ugDegrees = Array.from(new Set([
        ...standardUG,
        ...masterCourses.filter(c => c.startsWith('B.') || c.startsWith('B') || c.includes('Diploma') || c.includes('Polytechnic') || c.includes('ITI') || c.startsWith('D.')),
        ...coursesResult.map(c => c.course?.trim()).filter(c => c && (c.startsWith('B.') || c.startsWith('B') || c.includes('Bachelor')))
      ])).sort();

      const pgDegrees = Array.from(new Set([
        ...standardPG,
        ...masterCourses.filter(c => c !== 'MBBS' && !c.startsWith('B') && (c.startsWith('M.') || c.startsWith('M') || c.includes('PG') || c.startsWith('CA') || c.startsWith('CS') || c.startsWith('ICWA'))),
        ...coursesResult.map(c => c.course?.trim()).filter(c => c && c !== 'MBBS' && !c.startsWith('B') && (c.startsWith('M.') || c.startsWith('M') || c.includes('Master')))
      ])).sort();

      const doctorateDegrees = Array.from(new Set([
        ...standardDoctorate,
        ...masterCourses.filter(c => c.toLowerCase().includes('phd') || c.toLowerCase().includes('doctor') || c.toLowerCase().includes('phil')),
      ])).sort();

      const allDegreeList = Array.from(new Set([
        ...ugDegrees,
        ...pgDegrees,
        ...doctorateDegrees,
        ...masterCourses,
        ...coursesResult.map(c => c.course?.trim()).filter(Boolean)
      ])).sort();

      // Fetch job_categories from DB to incorporate into industry taxonomy
      let dbCategories = [];
      try {
        const [jobCat] = await pool.query('SELECT category_name FROM job_categories WHERE category_name IS NOT NULL');
        dbCategories = jobCat.map(c => c.category_name?.trim()).filter(Boolean);
      } catch (e) {
        dbCategories = [];
      }

      // Comprehensive Real-World Industry Taxonomy
      const baseIndustries = [
        {
          category: "BPM / ITES",
          subcategories: ["Analytics / KPO / Research", "BPM / BPO", "Customer Experience & Support", "Financial Process Outsourcing", "Technical Support & Helpdesk", "Data Annotation & AI Labeling", "Medical Transcription"]
        },
        {
          category: "IT Services & Consulting",
          subcategories: ["Software Services", "Cloud Consulting", "Systems Integration", "Managed IT Services", "Cybersecurity Consulting", "ERP & CRM Implementation", "Quality Assurance & Testing"]
        },
        {
          category: "Software Product & SaaS",
          subcategories: ["Enterprise SaaS", "B2B Applications", "B2C Mobile & Web Apps", "Cloud Platforms", "Developer Tools", "Productivity Software", "FinTech Platforms", "EdTech Platforms", "HRTech Platforms"]
        },
        {
          category: "Technology & Emerging Tech",
          subcategories: ["AI / Machine Learning", "Generative AI & LLMs", "Data Science & Big Data", "Cloud Architecture & DevOps", "Cybersecurity & InfoSec", "Blockchain & Web3", "AR / VR Development", "Robotics & Automation", "IoT & Connected Devices"]
        },
        {
          category: "Hardware & Semiconductors",
          subcategories: ["VLSI & Chip Design", "Embedded Systems", "Hardware Design", "Semiconductor Fabrication", "ASIC / FPGA Development", "PCB Design", "Microelectronics"]
        },
        {
          category: "Electronics & Electrical Manufacturing",
          subcategories: ["Consumer Electronics", "Industrial Electronics", "Power Electronics", "Smart Appliances", "Automation Systems", "Electrical Equipment", "Semiconductor Devices"]
        },
        {
          category: "Banking & Financial Services",
          subcategories: ["FinTech & Digital Payments", "Commercial & Retail Banking", "Investment Banking", "Wealth Management & Private Banking", "Insurance (Life, General, Health)", "NBFC & Microfinance", "Asset Management", "Risk Management & Compliance", "Credit & Lending", "Stock Broking & Trading"]
        },
        {
          category: "Healthcare & Hospitals",
          subcategories: ["Hospitals & Healthcare Centers", "Physicians & Surgeons", "Nursing & Patient Care", "Medical Diagnostics & Pathology", "Telemedicine & Digital Health", "Healthcare Administration", "Medical Devices & Equipment"]
        },
        {
          category: "Pharmaceuticals & Biotechnology",
          subcategories: ["Drug Discovery & Development", "Clinical Research (CRO)", "Formulation & Manufacturing", "Regulatory Affairs & QA", "Biotechnology & Genomics", "API & Bulk Drugs"]
        },
        {
          category: "E-Commerce & Retail",
          subcategories: ["Online Marketplaces & D2C", "Retail Store Operations", "Quick Commerce & Delivery", "Category Management & Merchandising", "Fashion & Apparel", "Consumer Electronics Retail", "Supermarkets & FMCG Retail"]
        },
        {
          category: "Consumer Goods & FMCG",
          subcategories: ["Packaged Foods & Beverages", "Personal Care & Cosmetics", "Household Cleaning Products", "Consumer Durables", "Brand Marketing & Distribution"]
        },
        {
          category: "Automotive & Transportation",
          subcategories: ["Automobile OEMs", "Electric Vehicles (EV) & Battery Tech", "Auto Components & Parts", "Autonomous Driving Systems", "Two-Wheelers & Commercial Vehicles", "Fleet Management"]
        },
        {
          category: "Engineering, Manufacturing & Industrial",
          subcategories: ["Heavy Machinery & Equipment", "Mechanical & Plant Engineering", "Precision Tooling & Fabrication", "Process Manufacturing", "Industrial Automation & PLC", "Metallurgy & Steel"]
        },
        {
          category: "Telecommunications & Networking",
          subcategories: ["5G / 4G Telecom Service Providers", "Optical Fiber & Network Infrastructure", "Network Engineering & RF", "Satellite Communications", "Unified Communications & VoIP"]
        },
        {
          category: "Education, EdTech & Academia",
          subcategories: ["EdTech & Online Learning Platforms", "Higher Education & Universities", "K-12 Schools & Institutes", "Vocational & Skill Training", "Corporate Training & Coaching", "Academic Research"]
        },
        {
          category: "Media, Entertainment & Gaming",
          subcategories: ["Digital Media & Publishing", "Film & TV Production", "OTT & Streaming Platforms", "Video Game Development", "Animation & VFX", "Advertising & Creative Agencies", "Public Relations (PR)"]
        },
        {
          category: "Construction, Real Estate & Architecture",
          subcategories: ["Architecture & Interior Design", "Residential Real Estate", "Commercial Real Estate", "Civil Engineering & Infrastructure", "Property & Facility Management", "Urban Planning"]
        },
        {
          category: "Logistics, Supply Chain & Warehousing",
          subcategories: ["3PL & 4PL Logistics", "Freight Forwarding & Cargo", "Warehousing & Cold Chain", "Port & Marine Shipping", "Express Courier & Last-Mile Delivery"]
        },
        {
          category: "Energy, Power, Oil & Gas",
          subcategories: ["Renewable Energy (Solar & Wind)", "Oil & Gas Exploration (Upstream)", "Petroleum Refining & Petrochemicals", "Power Generation & Grid Distribution", "CleanTech & Sustainability"]
        },
        {
          category: "Aerospace & Aviation",
          subcategories: ["Commercial Aviation & Airlines", "Aircraft Maintenance (MRO)", "Aerospace Engineering", "Space Technology & Satellites", "Airport Operations & Ground Handling"]
        },
        {
          category: "Hospitality, Travel & Tourism",
          subcategories: ["Hotels, Resorts & Hospitality", "Travel Agencies & Tour Operators", "Aviation Hospitality", "Food & Beverage (F&B) / Restaurants", "Events & Conferences (MICE)"]
        },
        {
          category: "Professional Consulting & Legal",
          subcategories: ["Strategy & Management Consulting", "Legal Practices & Law Firms", "Corporate Taxation & Auditing", "HR & Executive Recruitment", "Intellectual Property (IP) & Patents"]
        },
        {
          category: "Agriculture, Dairy & Food Processing",
          subcategories: ["AgriTech & Smart Farming", "Crop Protection & Fertilizers", "Dairy & Livestock Farming", "Food Processing & Cold Storage", "Organic Agriculture"]
        },
        {
          category: "Government, Defense & Non-Profit",
          subcategories: ["Public Sector Undertakings (PSU)", "Defense & Military Equipment", "Non-Governmental Organizations (NGO)", "Foundations & Social Impact", "Regulatory & Standards Bodies"]
        }
      ];

      const industries = baseIndustries.map(ind => ({
        category: ind.category,
        count: ind.subcategories.length,
        subcategories: ind.subcategories
      }));

      // Add database specific job categories as another sector
      if (dbCategories.length > 0) {
        const uniqueDBCats = Array.from(new Set(dbCategories)).sort();
        industries.push({
          category: "Other Specialized Domains",
          count: uniqueDBCats.length,
          subcategories: uniqueDBCats
        });
      }

      const result = {
        locations: locationList,
        jobTitles: jobTitles.map(j => j.job_title.trim()).filter(Boolean).sort(),
        companies: companyList,
        industries,
        ugDegrees,
        pgDegrees,
        doctorateDegrees,
        skills: Array.from(allSkills).sort(),
        courses: allDegreeList,
        genders: ["Male", "Female", "Other"]
      };

      // Store in memory cache
      cachedFilterOptions = result;
      filterOptionsExpiry = Date.now() + FILTER_OPTIONS_TTL;

      return result;
    } catch (error) {
      throw new Error("Error in CandidateSearchModel.getFilterOptions: " + error.message);
    }
  },

  lookupCompanies: async (query = "") => {
    try {
      const cleanQuery = (query || "").trim();
      let dbCompanies = [];

      if (cleanQuery) {
        const [rows] = await pool.query(`
          SELECT DISTINCT company_name FROM (
            SELECT TRIM(company_name) as company_name FROM hr_profiles WHERE company_name IS NOT NULL AND TRIM(company_name) != ''
            UNION
            SELECT TRIM(company_name) as company_name FROM job_post WHERE company_name IS NOT NULL AND TRIM(company_name) != ''
            UNION
            SELECT TRIM(company_name) as company_name FROM user_professional WHERE is_deleted = 0 AND company_name IS NOT NULL AND TRIM(company_name) != ''
          ) as all_companies
          WHERE company_name LIKE ?
          ORDER BY company_name ASC
          LIMIT 40
        `, [`%${cleanQuery}%`]);
        dbCompanies = rows.map(r => r.company_name.trim()).filter(Boolean);
      } else {
        const [rows] = await pool.query(`
          SELECT DISTINCT company_name FROM (
            SELECT TRIM(company_name) as company_name FROM hr_profiles WHERE company_name IS NOT NULL AND TRIM(company_name) != ''
            UNION
            SELECT TRIM(company_name) as company_name FROM job_post WHERE company_name IS NOT NULL AND TRIM(company_name) != ''
            UNION
            SELECT TRIM(company_name) as company_name FROM user_professional WHERE is_deleted = 0 AND company_name IS NOT NULL AND TRIM(company_name) != ''
          ) as all_companies
          ORDER BY company_name ASC
          LIMIT 50
        `);
        dbCompanies = rows.map(r => r.company_name.trim()).filter(Boolean);
      }

      // Query Internet Company API (Clearbit autocomplete) if cleanQuery has at least 2 chars
      let internetCompanies = [];
      if (cleanQuery.length >= 2) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(cleanQuery)}`, {
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              internetCompanies = data.map(item => ({
                name: item.name?.trim(),
                domain: item.domain || null,
                logo: item.logo || (item.domain ? `https://logo.clearbit.com/${item.domain}` : null),
                source: "Global / Internet"
              })).filter(c => c.name);
            }
          }
        } catch (fetchErr) {
          // Gracefully continue without internet results
        }
      }

      // Merge and deduplicate
      const seen = new Set();
      const combined = [];

      // Add DB registered companies first
      dbCompanies.forEach(name => {
        const lower = name.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          combined.push({
            name,
            domain: null,
            logo: null,
            isRegistered: true,
            source: "Careerfast Registered"
          });
        }
      });

      // Add internet companies
      internetCompanies.forEach(item => {
        const lower = item.name.toLowerCase();
        const existing = combined.find(c => c.name.toLowerCase() === lower);
        if (existing) {
          existing.domain = item.domain || existing.domain;
          existing.logo = item.logo || existing.logo;
        } else if (!seen.has(lower)) {
          seen.add(lower);
          combined.push({
            name: item.name,
            domain: item.domain,
            logo: item.logo,
            isRegistered: false,
            source: "Global / Internet"
          });
        }
      });

      return combined;
    } catch (error) {
      throw new Error("Error in CandidateSearchModel.lookupCompanies: " + error.message);
    }
  },


  // ─── Folders ───────────────────────────────────────────────────────────────
  ensureFoldersTables: async () => {
    const foldersSql = `
      CREATE TABLE IF NOT EXISTS candidate_folders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        recruiter_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        job_id INT DEFAULT NULL,
        folder_type VARCHAR(50) DEFAULT 'personal',
        is_archived TINYINT(1) DEFAULT 0,
        color VARCHAR(30) DEFAULT 'indigo',
        description VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_recruiter_folder (recruiter_id, name)
      )
    `;
    const folderItemsSql = `
      CREATE TABLE IF NOT EXISTS candidate_folder_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        folder_id INT NOT NULL,
        candidate_id INT NOT NULL,
        stage VARCHAR(50) DEFAULT 'prospect',
        notes TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_folder_candidate (folder_id, candidate_id)
      )
    `;
    await pool.query(foldersSql);
    await pool.query(folderItemsSql);
  },

  getFolders: async (recruiterId, options = {}) => {
    try {
      await CandidateSearchModel.ensureFoldersTables();

      const { tab = 'all', search = '' } = options;

      // Tab Counts
      const [tabCountRows] = await pool.query(`
        SELECT
          COUNT(CASE WHEN f.is_archived = 0 AND (f.folder_type = 'personal' OR f.folder_type IS NULL) THEN 1 END) AS personal_count,
          COUNT(CASE WHEN f.is_archived = 0 AND f.job_id IS NOT NULL THEN 1 END) AS with_job_count,
          COUNT(CASE WHEN f.is_archived = 0 AND f.folder_type = 'shared' THEN 1 END) AS shared_count,
          COUNT(CASE WHEN f.is_archived = 0 AND f.folder_type = 'default' THEN 1 END) AS default_count,
          COUNT(CASE WHEN f.is_archived = 1 THEN 1 END) AS archived_count,
          COUNT(CASE WHEN f.is_archived = 0 THEN 1 END) AS all_count
        FROM candidate_folders f
        WHERE f.recruiter_id = ?
      `, [recruiterId]);

      const tabCounts = {
        personal: tabCountRows[0]?.personal_count || 0,
        with_job: tabCountRows[0]?.with_job_count || 0,
        shared: tabCountRows[0]?.shared_count || 0,
        default: tabCountRows[0]?.default_count || 0,
        archived: tabCountRows[0]?.archived_count || 0,
        all: tabCountRows[0]?.all_count || 0
      };

      // Base query for folders
      let whereClauses = ['f.recruiter_id = ?'];
      let params = [recruiterId];

      if (tab === 'archived') {
        whereClauses.push('f.is_archived = 1');
      } else {
        whereClauses.push('f.is_archived = 0');
        if (tab === 'personal') {
          whereClauses.push("(f.folder_type = 'personal' OR f.folder_type IS NULL)");
        } else if (tab === 'with_job' || tab === 'job') {
          whereClauses.push('f.job_id IS NOT NULL');
        } else if (tab === 'shared') {
          whereClauses.push("f.folder_type = 'shared'");
        } else if (tab === 'default') {
          whereClauses.push("f.folder_type = 'default'");
        }
      }

      if (search && search.trim()) {
        whereClauses.push('f.name LIKE ?');
        params.push(`%${search.trim()}%`);
      }

      const sql = `
        SELECT
          f.id,
          f.name,
          f.description,
          f.color,
          f.folder_type,
          f.job_id,
          f.is_archived,
          f.created_at,
          f.updated_at,
          jp.job_title AS linked_job_title,
          jp.company_name AS linked_company_name,
          COUNT(fi.candidate_id) AS candidate_count,
          COUNT(CASE WHEN fi.stage = 'prospect' OR fi.stage IS NULL THEN 1 END) AS prospect_count,
          COUNT(CASE WHEN fi.stage = 'applicant' THEN 1 END) AS applicant_count,
          COUNT(CASE WHEN fi.stage = 'interviewed' THEN 1 END) AS interviewed_count,
          COUNT(CASE WHEN fi.stage = 'hired' THEN 1 END) AS hired_count,
          COUNT(CASE WHEN fi.stage = 'rejected' THEN 1 END) AS rejected_count,
          GROUP_CONCAT(DISTINCT fi.candidate_id) AS candidate_ids,
          COALESCE(MAX(fi.created_at), f.updated_at, f.created_at) AS last_active
        FROM candidate_folders f
        LEFT JOIN candidate_folder_items fi ON f.id = fi.folder_id
        LEFT JOIN job_post jp ON f.job_id = jp.id
        WHERE ${whereClauses.join(' AND ')}
        GROUP BY f.id, f.name, f.description, f.color, f.folder_type, f.job_id, f.is_archived, f.created_at, f.updated_at, jp.job_title, jp.company_name
        ORDER BY last_active DESC
      `;

      const [folders] = await pool.query(sql, params);

      const formattedFolders = folders.map(f => ({
        ...f,
        candidate_ids: f.candidate_ids
          ? String(f.candidate_ids).split(',').map(id => Number(id.trim())).filter(id => !isNaN(id) && id > 0)
          : []
      }));

      return {
        folders: formattedFolders,
        tabCounts
      };
    } catch (error) {
      throw new Error("Error fetching folders: " + error.message);
    }
  },

  createFolder: async (recruiterId, folderData) => {
    try {
      await CandidateSearchModel.ensureFoldersTables();

      let name = '';
      let jobId = null;
      let folderType = 'personal';
      let color = 'indigo';
      let description = null;

      if (typeof folderData === 'string') {
        name = folderData.trim();
      } else if (typeof folderData === 'object' && folderData !== null) {
        name = (folderData.name || '').trim();
        jobId = folderData.job_id ? Number(folderData.job_id) : null;
        folderType = folderData.folder_type || (jobId ? 'job' : 'personal');
        color = folderData.color || 'indigo';
        description = folderData.description ? String(folderData.description).trim() : null;
      }

      if (!name) throw new Error("Folder name is required");

      const insertSql = `
        INSERT INTO candidate_folders (recruiter_id, name, job_id, folder_type, color, description)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
      `;
      const [res] = await pool.query(insertSql, [recruiterId, name, jobId, folderType, color, description]);

      const selectSql = `
        SELECT f.*, jp.job_title AS linked_job_title
        FROM candidate_folders f
        LEFT JOIN job_post jp ON f.job_id = jp.id
        WHERE f.recruiter_id = ? AND f.name = ?
      `;
      const [rows] = await pool.query(selectSql, [recruiterId, name]);
      return rows[0] || { id: res.insertId, name, recruiter_id: recruiterId };
    } catch (error) {
      throw new Error("Error creating folder: " + error.message);
    }
  },

  updateFolder: async (recruiterId, folderId, updateData = {}) => {
    try {
      await CandidateSearchModel.ensureFoldersTables();

      let sets = [];
      let params = [];

      if (updateData.name !== undefined) {
        const trimmed = String(updateData.name).trim();
        if (!trimmed) throw new Error("Folder name cannot be empty");
        sets.push('name = ?');
        params.push(trimmed);
      }
      if (updateData.color !== undefined) {
        sets.push('color = ?');
        params.push(updateData.color);
      }
      if (updateData.description !== undefined) {
        sets.push('description = ?');
        params.push(updateData.description);
      }
      if (updateData.folder_type !== undefined) {
        sets.push('folder_type = ?');
        params.push(updateData.folder_type);
      }
      if (updateData.job_id !== undefined) {
        sets.push('job_id = ?');
        params.push(updateData.job_id ? Number(updateData.job_id) : null);
      }
      if (updateData.is_archived !== undefined) {
        sets.push('is_archived = ?');
        params.push(updateData.is_archived ? 1 : 0);
      }

      if (sets.length === 0) return { success: true };

      params.push(folderId, recruiterId);
      const sql = `UPDATE candidate_folders SET ${sets.join(', ')} WHERE id = ? AND recruiter_id = ?`;
      await pool.query(sql, params);

      const [rows] = await pool.query(`SELECT * FROM candidate_folders WHERE id = ? AND recruiter_id = ?`, [folderId, recruiterId]);
      return rows[0];
    } catch (error) {
      throw new Error("Error updating folder: " + error.message);
    }
  },

  deleteFolder: async (recruiterId, folderId) => {
    try {
      await CandidateSearchModel.ensureFoldersTables();
      // First verify ownership
      const [fRow] = await pool.query(`SELECT id FROM candidate_folders WHERE id = ? AND recruiter_id = ?`, [folderId, recruiterId]);
      if (fRow.length === 0) throw new Error("Folder not found or unauthorized");

      // Delete items and folder
      await pool.query(`DELETE FROM candidate_folder_items WHERE folder_id = ?`, [folderId]);
      await pool.query(`DELETE FROM candidate_folders WHERE id = ? AND recruiter_id = ?`, [folderId, recruiterId]);

      return { success: true, message: "Folder deleted successfully" };
    } catch (error) {
      throw new Error("Error deleting folder: " + error.message);
    }
  },

  getFolderCandidates: async (recruiterId, folderId, options = {}) => {
    try {
      await CandidateSearchModel.ensureFoldersTables();

      // Verify folder ownership and get owner name
      const [folderRows] = await pool.query(`
        SELECT f.*, jp.job_title AS linked_job_title, jp.company_name AS linked_company_name,
               CONCAT(rec.first_name, ' ', IFNULL(rec.last_name, '')) AS owner_name
        FROM candidate_folders f
        LEFT JOIN job_post jp ON f.job_id = jp.id
        LEFT JOIN users rec ON f.recruiter_id = rec.id
        WHERE f.id = ? AND f.recruiter_id = ?
      `, [folderId, recruiterId]);

      if (folderRows.length === 0) throw new Error("Folder not found or unauthorized");
      const folder = folderRows[0];

      const { search = '', stage = 'all' } = options;

      let whereClauses = ['fi.folder_id = ?'];
      let params = [folderId];

      if (stage && stage !== 'all') {
        whereClauses.push('fi.stage = ?');
        params.push(stage);
      }

      if (search && search.trim()) {
        whereClauses.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.location LIKE ? OR u.skills LIKE ?)');
        const term = `%${search.trim()}%`;
        params.push(term, term, term, term, term);
      }

      const sql = `
        SELECT
          u.id,
          u.first_name,
          u.last_name,
          u.email,
          u.phone_code,
          u.phone,
          u.profile_image,
          u.resume,
          u.about,
          u.skills,
          u.gender,
          u.location,
          u.total_years,
          u.total_months,
          u.experince_type,
          u.course,
          u.preferred_job_type,
          u.created_date,
          u.updated_date,
          fi.stage,
          fi.created_at AS added_to_folder_at,
          up.job_title,
          up.company_name,
          up.designation,
          up.start_date AS exp_start_date,
          up.end_date AS exp_end_date,
          up.currently_working,
          ue.college,
          ue.specialization,
          ue.course AS edu_course,
          ue.end_date AS edu_end_date,
          user_social_links.linkedin,
          user_social_links.twitter,
          user_social_links.instagram,
          user_social_links.facebook,
          user_social_links.dribble,
          user_social_links.behance
        FROM candidate_folder_items fi
        INNER JOIN users u ON fi.candidate_id = u.id
        LEFT JOIN (
          SELECT user_id, job_title, company_name, designation, start_date, end_date, currently_working
          FROM user_professional
          WHERE is_deleted = 0
          ORDER BY id DESC
        ) up ON u.id = up.user_id
        LEFT JOIN (
          SELECT user_id, college, specialization, course, end_date
          FROM user_education
          WHERE is_deleted = 0
          ORDER BY id DESC
        ) ue ON u.id = ue.user_id
        LEFT JOIN user_social_links ON user_social_links.user_id = u.id
        WHERE ${whereClauses.join(' AND ')}
        GROUP BY u.id
        ORDER BY fi.created_at DESC
      `;

      const [candidates] = await pool.query(sql, params);

      // Fetch all folders for these candidates for this recruiter (to populate "Saved" popover)
      const candidateIds = candidates.map(c => c.id);
      let candidateFoldersMap = {};
      if (candidateIds.length > 0) {
        try {
          const [savedRows] = await pool.query(`
            SELECT 
              cfi.candidate_id,
              cf.id AS folder_id,
              cf.name AS folder_name,
              cfi.stage,
              cfi.created_at AS saved_at,
              CONCAT(rec.first_name, ' ', IFNULL(rec.last_name, '')) AS saved_by_name
            FROM candidate_folder_items cfi
            INNER JOIN candidate_folders cf ON cfi.folder_id = cf.id
            LEFT JOIN users rec ON cf.recruiter_id = rec.id
            WHERE cf.recruiter_id = ? AND cfi.candidate_id IN (?)
            ORDER BY cfi.created_at DESC
          `, [recruiterId, candidateIds]);

          savedRows.forEach(r => {
            if (!candidateFoldersMap[r.candidate_id]) candidateFoldersMap[r.candidate_id] = [];
            candidateFoldersMap[r.candidate_id].push({
              folder_id: r.folder_id,
              folder_name: r.folder_name,
              stage: r.stage,
              saved_at: r.saved_at,
              saved_by: (r.saved_by_name || '').trim() || (folder.owner_name || 'Recruiter')
            });
          });
        } catch (e) {
          console.error("Error fetching candidateFoldersMap:", e);
        }
      }

      return {
        folder,
        candidates: candidates.map(c => {
          const rawStage = c.stage || 'prospect';
          let prefData = {};
          if (c.preferred_job_type) {
            try {
              prefData = typeof c.preferred_job_type === 'string' ? JSON.parse(c.preferred_job_type) : (c.preferred_job_type || {});
            } catch (_) {
              prefData = {};
            }
          }
          const prefLocations = Array.isArray(prefData.preferredLocations)
            ? prefData.preferredLocations
            : (Array.isArray(prefData.preferred_locations) ? prefData.preferred_locations : []);

          return {
            ...c,
            stage: rawStage,
            skills: typeof c.skills === 'string' ? (() => { try { return JSON.parse(c.skills); } catch (_) { return c.skills.split(',').map(s => s.trim()); } })() : (c.skills || []),
            name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Candidate',
            current_job_title: c.job_title || c.designation || null,
            current_company: c.company_name || null,
            preferred_locations: prefLocations,
            notice_period: prefData.noticePeriod || prefData.notice_period || null,
            expected_salary: prefData.expectedSalary || prefData.expected_salary || null,
            saved_in_folders: (candidateFoldersMap[c.id] || [{
              folder_id: folder.id,
              folder_name: folder.name,
              stage: rawStage,
              saved_at: c.added_to_folder_at,
              saved_by: folder.owner_name || 'Recruiter'
            }]).map(sf => ({
              ...sf,
              stage: sf.stage || rawStage
            }))
          };
        })
      };
    } catch (error) {
      throw new Error("Error fetching folder candidates: " + error.message);
    }
  },

  updateCandidateStageInFolder: async (recruiterId, folderId, candidateId, stage) => {
    try {
      await CandidateSearchModel.ensureFoldersTables();
      const validStages = ['applicant', 'interviewed', 'hired', 'rejected', 'prospect'];
      const targetStage = validStages.includes(stage) ? stage : 'applicant';

      const [f] = await pool.query(`SELECT id FROM candidate_folders WHERE id = ? AND recruiter_id = ?`, [folderId, recruiterId]);
      if (f.length === 0) throw new Error("Folder not found or unauthorized");

      await pool.query(
        `UPDATE candidate_folder_items SET stage = ? WHERE folder_id = ? AND candidate_id = ?`,
        [targetStage, folderId, candidateId]
      );
      return { success: true, stage: targetStage };
    } catch (error) {
      throw new Error("Error updating candidate stage: " + error.message);
    }
  },

  removeCandidateFromFolder: async (recruiterId, folderId, candidateId) => {
    try {
      await CandidateSearchModel.ensureFoldersTables();
      const [f] = await pool.query(`SELECT id FROM candidate_folders WHERE id = ? AND recruiter_id = ?`, [folderId, recruiterId]);
      if (f.length === 0) throw new Error("Folder not found or unauthorized");

      await pool.query(`DELETE FROM candidate_folder_items WHERE folder_id = ? AND candidate_id = ?`, [folderId, candidateId]);
      return { success: true, message: "Candidate removed from folder" };
    } catch (error) {
      throw new Error("Error removing candidate from folder: " + error.message);
    }
  },

  addCandidatesToFolder: async (recruiterId, folderIdentifier, candidateIds = [], stage = 'applicant') => {
    try {
      await CandidateSearchModel.ensureFoldersTables();
      if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
        throw new Error("No candidates provided to add to folder");
      }

      let folderId = null;
      let folderName = "";

      if (typeof folderIdentifier === 'number' || !isNaN(Number(folderIdentifier))) {
        folderId = Number(folderIdentifier);
        const [rows] = await pool.query(
          `SELECT id, name FROM candidate_folders WHERE id = ? AND recruiter_id = ?`,
          [folderId, recruiterId]
        );
        if (rows.length === 0) throw new Error("Folder not found");
        folderName = rows[0].name;
      } else {
        folderName = String(folderIdentifier).trim();
        const created = await CandidateSearchModel.createFolder(recruiterId, folderName);
        folderId = created.id;
      }

      // Convert candidate IDs to numbers
      const numericCandidateIds = candidateIds.map(id => Number(id)).filter(id => !isNaN(id) && id > 0);
      if (numericCandidateIds.length === 0) {
        throw new Error("Invalid candidate IDs provided");
      }

      // Query which candidates already exist in this folder
      const [existingRows] = await pool.query(
        `SELECT candidate_id FROM candidate_folder_items WHERE folder_id = ? AND candidate_id IN (?)`,
        [folderId, numericCandidateIds]
      );

      const existingCandidateIds = existingRows.map(r => Number(r.candidate_id));
      const newCandidateIds = numericCandidateIds.filter(id => !existingCandidateIds.includes(id));

      if (newCandidateIds.length === 0) {
        // ALL candidate(s) are already in this folder!
        const message = numericCandidateIds.length === 1
          ? `Candidate is already saved in folder "${folderName}"! Duplicate addition is restricted.`
          : `All selected candidates are already present in folder "${folderName}"!`;

        return {
          folderId,
          folderName,
          alreadyExists: true,
          allAlreadyExist: true,
          existingCandidateIds,
          addedCount: 0,
          message
        };
      }

      // Bulk insert ONLY new candidates into folder
      const values = newCandidateIds.map(cId => [folderId, cId, stage]);
      const insertSql = `INSERT IGNORE INTO candidate_folder_items (folder_id, candidate_id, stage) VALUES ?`;
      await pool.query(insertSql, [values]);

      // Get current total count in this folder
      const [countRows] = await pool.query(
        `SELECT COUNT(candidate_id) AS total_candidates FROM candidate_folder_items WHERE folder_id = ?`,
        [folderId]
      );

      const hasPartialExisting = existingCandidateIds.length > 0;
      const message = hasPartialExisting
        ? `Added ${newCandidateIds.length} candidate(s) to "${folderName}". (${existingCandidateIds.length} candidate(s) were already in this folder)`
        : `Successfully saved ${newCandidateIds.length} candidate(s) to folder "${folderName}"`;

      return {
        folderId,
        folderName,
        alreadyExists: false,
        partialExisting: hasPartialExisting,
        existingCandidateIds,
        addedCount: newCandidateIds.length,
        totalInFolder: countRows[0]?.total_candidates || 0,
        message
      };
    } catch (error) {
      throw new Error("Error adding candidates to folder: " + error.message);
    }
  }
};

module.exports = CandidateSearchModel;

