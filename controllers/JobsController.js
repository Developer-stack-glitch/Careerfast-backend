// const { use } = require("react");
const JobsModel = require("../models/JobsModel");
const { response, request } = require("express");
const cities = require("cities");
const admin = require("../config/firebase");
const pool = require("../config/dbConfig");
const crypto = require("crypto");
const UserModel = require("../models/UserModel");
const EmailModel = require("../models/EmailModel");
const SubRecruiterModel = require("../models/SubRecruiterModel");

const insertJobNature = async (request, response) => {
  const { nature_name } = request.body;
  try {
    const result = await JobsModel.insertJobNature(nature_name);
    response.status(201).send({
      message: "Job nature inserted successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error inserting job nature",
      details: error.message,
    });
  }
};

const getJobNature = async (request, response) => {
  try {
    const natures = await JobsModel.getJobNature();
    response.status(200).send({
      message: "Job natures fetched successfully",
      data: natures,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error fetching job nature",
      details: error.message,
    });
  }
};

const insertWorkPlaceType = async (request, response) => {
  const { workplace } = request.body;
  try {
    const result = await JobsModel.insertWorkPlaceType(workplace);
    response.status(201).send({
      message: "Workplace inserted successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error inserting workplace",
      details: error.message,
    });
  }
};

const getWorkplaceType = async (request, response) => {
  try {
    const workplaces = await JobsModel.getWorkplaceType();
    response.status(200).send({
      message: "Workplaces fetched successfully",
      data: workplaces,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error fetching workplace",
      details: error.message,
    });
  }
};

const getWorklocation = async (request, response) => {
  try {
    const workLocation = await JobsModel.getWorklocation();
    response.status(200).send({
      message: "work location fetched successfully",
      data: workLocation,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error fetching work location",
      details: error.message,
    });
  }
};

const getInternshipDuration = async (request, response) => {
  try {
    const durationTypes = await JobsModel.getInternshipDuration();
    response.status(200).send({
      message: "Internship duration type fetched successfully",
      data: durationTypes,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error fetching internship duration type",
      details: error.message,
    });
  }
};

const getDurationPeriod = async (request, response) => {
  const { duration_type_id } = request.query;
  try {
    const durationPeriod = await JobsModel.getDurationPeriod(duration_type_id);
    response.status(200).send({
      message: "Duration fetched successfully",
      data: durationPeriod,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error fetching duration",
      details: error.message,
    });
  }
};

const getBenefits = async (request, response) => {
  try {
    const benefits = await JobsModel.getBenefits();
    response.status(200).send({
      message: "Benefits fetched successfully",
      data: benefits,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error fetching benefits",
      details: error.message,
    });
  }
};

const getGender = async (request, response) => {
  try {
    const genders = await JobsModel.getGender();
    response.status(200).send({
      message: "Gender fetched successfully",
      data: genders,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error fetching gender",
      details: error.message,
    });
  }
};

const getEligibility = async (request, response) => {
  try {
    const eligibility = await JobsModel.getEligibility();
    response.status(200).send({
      message: "Eligibility fetched successfully",
      data: eligibility,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error fetching eligibility",
      details: error.message,
    });
  }
};

const getSalaryType = async (request, response) => {
  try {
    const salaryType = await JobsModel.getSalaryType();
    response.status(200).send({
      message: "Salary type fetched successfully",
      data: salaryType,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error fetching salary type",
      details: error.message,
    });
  }
};

const jobPosting = async (request, response) => {
  // 🔍 Validate request body exists
  if (!request.body || Object.keys(request.body).length === 0) {
    return response.status(400).send({
      message: "Error posting job",
      details: "Request body is empty or invalid JSON",
    });
  }

  let {
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
    last_date_to_apply, locality, internship_perks,
  } = request.body;

  // 🧹 Clean the openings field
  openings = openings && !isNaN(openings) ? parseInt(openings, 10) : null;

  // 🖼️ Handle Next.js image objects for company_logo
  if (company_logo && typeof company_logo === "object") {
    company_logo = company_logo.src || (company_logo.default && company_logo.default.src) || JSON.stringify(company_logo);
  }

  const formattedDuration = Array.isArray(duration_period)
    ? duration_period
    : [duration_period];
  const formattedJobCategory = Array.isArray(job_category)
    ? job_category
    : [job_category];
  const formattedSkills = Array.isArray(skills) ? skills : [skills];
  const formattedExpReq = Array.isArray(experience_required)
    ? experience_required
    : [experience_required];
  const formattedDiversity = Array.isArray(diversity_hiring)
    ? diversity_hiring
    : [diversity_hiring];
  const formattedBenefits = Array.isArray(benefits) ? benefits : [benefits];
  const formatQuestions = Array.isArray(questions) ? questions : [questions];
  const formattedWorkLocation = Array.isArray(work_location) ? work_location : [work_location];
  const formattedLanguages = Array.isArray(languages) ? languages : [languages].filter(Boolean);

  try {
    // 🛡️ Plan Limit Enforcement for Recruiters
    const recruiterUserId = user_id || request.user?.id;
    let activeUsageRecordId = null;
    let subRecruiterRecord = null;

    if (recruiterUserId) {
      let effectiveRecruiterId = recruiterUserId;

      // 🛡️ Check if this user is a Sub-Recruiter
      subRecruiterRecord = await SubRecruiterModel.getSubRecruiterByUserId(recruiterUserId);
      if (subRecruiterRecord) {
        effectiveRecruiterId = subRecruiterRecord.main_recruiter_id;
        const perms = subRecruiterRecord.permissions || {};

        if (perms.can_post_jobs === false) {
          return response.status(403).send({
            message: "Permission Denied",
            details: "Your sub-recruiter account does not have permission to post jobs. Please contact your company administrator."
          });
        }

        // Check if sub-recruiter has a dedicated split quota for jobs
        if (perms.quota_mode === 'split' && perms.allocated_job_posts !== null && perms.allocated_job_posts !== undefined) {
          const subAllocated = Number(perms.allocated_job_posts);
          const subUsed = Number(perms.used_job_posts || 0);
          if (subUsed >= subAllocated) {
            return response.status(403).send({
              message: "Sub-Recruiter Quota Limit Reached",
              details: `You have reached your allocated job posting limit (${subUsed} of ${subAllocated} jobs). Please contact your primary recruiter.`
            });
          }
        }
      }

      const [subRows] = await pool.query(`
        SELECT rs.*, sp.job_post_limit, sp.active_job_limit, sp.name AS plan_name,
               COALESCE(su.job_posts_used, 0) AS job_posts_used, su.id AS usage_id
        FROM recruiter_subscriptions rs
        INNER JOIN subscription_plans sp ON rs.plan_id = sp.id
        LEFT JOIN subscription_usage su ON rs.id = su.subscription_id
        WHERE rs.recruiter_id = ?
        ORDER BY rs.id DESC LIMIT 1
      `, [effectiveRecruiterId]);

      if (subRows.length > 0) {
        const sub = subRows[0];
        activeUsageRecordId = sub.usage_id;
        const now = new Date();

        if (new Date(sub.expiry_date) < now || sub.status === 'Expired') {
          return response.status(403).send({
            message: "Subscription Expired",
            details: "Your subscription plan has expired. Please upgrade or renew your plan to post jobs."
          });
        }

        if (sub.status === 'Suspended') {
          return response.status(403).send({
            message: "Account Suspended",
            details: "Your recruiter account is currently suspended. Please contact the administrator."
          });
        }

        // Get all recruiter IDs in this company workspace
        const [teamSubs] = await pool.query(
          `SELECT sub_recruiter_id FROM sub_recruiters WHERE main_recruiter_id = ?`,
          [effectiveRecruiterId]
        );
        const companyUids = [effectiveRecruiterId, ...teamSubs.map(t => t.sub_recruiter_id)];

        // Check real total jobs used across company vs plan limit
        const [totalJobRows] = await pool.query(
          `SELECT COUNT(*) as count FROM job_post WHERE user_id IN (?)`,
          [companyUids]
        );
        const companyTotalJobs = Math.max(Number(sub.job_posts_used || 0), Number(totalJobRows[0]?.count || 0));

        // 1. Monthly job posting limit check
        if (companyTotalJobs >= sub.job_post_limit) {
          return response.status(403).send({
            message: "Monthly Job Posting Limit Reached",
            details: `Monthly job posting limit reached. Your company has used ${companyTotalJobs} of ${sub.job_post_limit} available job posts. Upgrade your plan to post more jobs.`
          });
        }

        // 2. Maximum active jobs limit check (company-wide live active slots)
        const [activeCountRows] = await pool.query(
          `SELECT COUNT(*) AS count FROM job_post WHERE user_id IN (?) AND (is_closed = 0 OR is_closed IS NULL) AND approval_status = 'approved'`,
          [companyUids]
        );
        const companyActiveJobs = Number(activeCountRows[0]?.count || 0);
        if (companyActiveJobs >= sub.active_job_limit) {
          return response.status(403).send({
            message: "Maximum Active Job Limit Reached",
            details: `Your company has reached its maximum active job limit (${companyActiveJobs} of ${sub.active_job_limit} active slots). Close an existing active job or upgrade your plan before posting a new job.`
          });
        }
      }
    }

    const result = await JobsModel.jobPosting(
      user_id,
      company_name,
      company_logo,
      about_company,
      job_title,
      job_nature,
      formattedDuration,
      workplace_type,
      formattedWorkLocation,
      formattedJobCategory,
      formattedSkills,
      experience_type,
      formattedExpReq,
      salary_type,
      currency,
      min_salary,
      max_salary,
      formattedDiversity,
      formattedBenefits,
      job_description,
      seo_description,
      openings,
      working_days,
      formatQuestions,
      salary_duration,
      role,
      industry,
      employment_type,
      willing_to_relocate,
      hybrid_policy,
      educational_qualification,
      candidate_industry,
      hide_salary,
      formattedLanguages,
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
    );

    // Increment monthly job posts used upon successful posting
    if (activeUsageRecordId) {
      await pool.query(
        `UPDATE subscription_usage SET job_posts_used = job_posts_used + 1 WHERE id = ?`,
        [activeUsageRecordId]
      ).catch(err => console.error("⚠️ Failed to increment job_posts_used:", err.message));
    }

    // Increment sub-recruiter job posts used if applicable
    if (subRecruiterRecord) {
      await SubRecruiterModel.incrementSubRecruiterUsage(recruiterUserId, 'job_post');
    }

    return response.status(201).send({
      message: "Job posted successfully. Waiting for admin approval.",
      data: result,
    });
  } catch (error) {
    console.error("❌ Error posting job:", error);
    response.status(500).send({
      message: "Error posting job",
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};


const applyForJob = async (request, response) => {
  const { postId, userId, answers } = request.body;
  const formattedQuestions = Array.isArray(answers) ? answers : [answers];
  try {
    const result = await JobsModel.applyForJob(
      postId,
      userId,
      formattedQuestions
    );

    return response.status(200).send({
      message: "Job applied successfully",
      appliedJob: {
        postId,
        userId,
        created_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while applying",
      details: error.message,
    });
  }
};

const getJobAppliedCandidates = async (request, response) => {
  const { post_id } = request.query;

  try {
    const result = await JobsModel.getJobAppliedCandidates(post_id);
    return response.status(200).send({
      message: "job applied candidates fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error while getting applied candidates",
      details: error.message,
    });
  }
};

const getJobPostByUserId = async (request, response) => {
  const { user_id, limit, page, job_nature, search, statuses, categories, sort } = request.query;

  try {
    let parsedStatuses = [];
    if (statuses) {
      try { parsedStatuses = JSON.parse(statuses); } catch(e) { parsedStatuses = statuses; }
    }
    
    let parsedCategories = [];
    if (categories) {
      try { parsedCategories = JSON.parse(categories); } catch(e) { parsedCategories = categories; }
    }

    const result = await JobsModel.getJobPostByUserId(user_id, limit, page, job_nature, search, parsedStatuses, parsedCategories, sort);

    return response.status(200).send({
      message: "job post fetched successfully",
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
      stats: result.stats
    });
  } catch (error) {
    response.status(500).send({
      message: "Error fetching job posts",
      details: error.message,
    });
  }
};

const getYears = async (request, response) => {
  try {
    const years = await JobsModel.getYears();
    response.status(200).send({
      message: "Years fetched successfully",
      data: years,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error fetching years",
      details: error.message,
    });
  }
};

const getSkills = async (request, response) => {
  try {
    const skills = await JobsModel.getSkills();
    response.status(200).send({
      message: "Skills fetched successfully",
      data: skills,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error fetching skills",
      details: error.message,
    });
  }
};

const getJobCategories = async (request, response) => {
  try {
    const categories = await JobsModel.getJobCategories(request.query);
    response.status(200).send({
      message: "Job categories fetched successfully",
      data: categories,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error fetching job categories",
      details: error.message,
    });
  }
};

const getJobPosts = async (request, response) => {
  const body = request.body;
  const filters = {
    limit: body.limit ? parseInt(body.limit) : 20,
    page: body.page ? parseInt(body.page) : 1,
  };

  // Only include filters that have actual values
  if (body.id) filters.id = body.id;
  if (body.job_nature) filters.job_nature = body.job_nature;
  if (body.status) filters.status = body.status;
  if (body.working_days) filters.working_days = body.working_days;
  if (body.salary_sort) filters.salary_sort = body.salary_sort;
  if (body.start_date) filters.start_date = body.start_date;
  if (body.end_date) filters.end_date = body.end_date;
  if (Array.isArray(body.workplace_type) && body.workplace_type.length > 0) filters.workplace_type = body.workplace_type;
  if (Array.isArray(body.work_location) && body.work_location.length > 0) filters.work_location = body.work_location;
  if (Array.isArray(body.job_categories) && body.job_categories.length > 0) filters.job_categories = body.job_categories;
  if (body.experience_type) filters.experience_type = body.experience_type;
  if (body.searchTerm) filters.searchTerm = body.searchTerm;
  if (Array.isArray(body.companies) && body.companies.length > 0) filters.companies = body.companies;
  if (body.is_closed !== undefined) filters.is_closed = body.is_closed;

  // By default, public API should only return approved jobs
  // Skip approval_status filter when previewing a specific job by ID
  if (body.preview === true && body.id) {
    // Don't set approval_status filter - allow fetching any job by ID for preview
  } else {
    filters.approval_status = body.approval_status || "approved";
  }

  try {
    const posts = await JobsModel.getJobPosts(filters);
    response.status(200).send({
      message: "Job posts fetched successfully",
      data: posts,
    });
  } catch (error) {
    console.error("❌ Error in getJobPosts:", error);
    response.status(500).send({
      message: "Error fetching job posts",
      details: error.message,
    });
  }
};

const registrationClose = async (request, response) => {
  const { id } = request.body;
  try {
    const result = await JobsModel.registrationClose(id);
    response.status(200).send({
      message: "Registration closed successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error closing registration",
      details: error.message,
    });
  }
};

const getExperienceRange = async (request, response) => {
  try {
    const range = await JobsModel.getExperienceRange();
    response.status(200).send({
      message: "Experience range get successfully",
      data: range,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error fetching experience range",
      details: error.message,
    });
  }
};

const insertProjects = async (request, response) => {
  const {
    user_id,
    company_name,
    project_title,
    project_type,
    start_date,
    end_date,
    description,
  } = request.body;
  try {
    await JobsModel.insertProjects(
      user_id,
      company_name,
      project_title,
      project_type,
      start_date,
      end_date,
      description
    );
    response.status(201).json({
      message: "Projects inserted successfully!",
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while inserting projects",
      details: error.message,
    });
  }
};

const updateProject = async (request, response) => {
  const {
    company_name,
    project_title,
    project_type,
    start_date,
    end_date,
    description,
    id,
  } = request.body;
  try {
    const result = await JobsModel.updateProject(
      company_name,
      project_title,
      project_type,
      start_date,
      end_date,
      description,
      id
    );
    response.status(200).send({
      message: "Updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while updating",
      details: error.message,
    });
  }
};

const updateResume = async (request, response) => {
  let id = request.body?.id || request.body?.user_id || request.user?.id;
  let resume = request.body?.resume;

  if (request.file) {
    resume = `data:${request.file.mimetype};base64,${request.file.buffer.toString("base64")}`;
  }

  if (!id || !resume) {
    return response.status(400).json({
      message: "Bad Request: Missing user id or resume file",
    });
  }

  try {
    const result = await JobsModel.updateResume(resume, id);
    response.status(200).send({
      message: "Updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while updating",
      details: error.message,
    });
  }
};

const updateSkills = async (request, response) => {
  const { skills, user_id } = request.body;
  const formattedSkills = Array.isArray(skills) ? skills : [skills];
  try {
    const result = await JobsModel.updateSkills(formattedSkills, user_id);
    response.status(200).send({
      message: "Updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while updating",
      details: error.message,
    });
  }
};

const updateVisibility = async (request, response) => {
  const { visibility_mode, hidden_companies, allow_contact, show_in_search, user_id } = request.body;
  try {
    const result = await JobsModel.updateVisibility({
      visibility_mode,
      hidden_companies,
      allow_contact,
      show_in_search,
      user_id
    });
    response.status(200).send({
      message: "Visibility updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while updating visibility",
      details: error.message,
    });
  }
};

const updateAbout = async (request, response) => {
  const id = request.body?.id || request.body?.user_id || request.user?.id;
  const { about } = request.body;
  if (!id) {
    return response.status(400).json({
      message: "Bad Request: Missing user id",
    });
  }
  try {
    const result = await JobsModel.updateAbout(about, id);
    response.status(200).send({
      message: "Updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while updating",
      details: error.message,
    });
  }
};

const getClasses = async (request, response) => {
  try {
    const classes = await JobsModel.getClasses();
    response.status(200).send({
      message: "Classes fetched successfully",
      data: classes,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error fetching classes",
      details: error.message,
    });
  }
};

const updateExperience = async (request, response) => {
  const {
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
    user_id,
  } = request.body;
  const formattedSkills = Array.isArray(skills) ? skills : [skills];
  try {
    const result = await JobsModel.updateExperience(
      job_title,
      company_name,
      designation,
      start_date,
      end_date,
      currently_working,
      formattedSkills,
      location,
      description,
      id,
      user_id
    );
    response.status(200).send({
      message: "Experience updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while updating experience",
      details: error.message,
    });
  }
};

const insertExperience = async (request, response) => {
  const { user_id, experiences } = request.body;
  if (experiences.length == 0) {
    throw new Error("Experience should not be empty");
  }
  try {
    const ids = await JobsModel.insertExperience(user_id, experiences);
    response.status(200).send({
      message: "Experience inserted successfully",
      id: ids[0],
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while inserting experience",
      details: error.message,
    });
  }
};

const deleteExperience = async (request, response) => {
  const { id } = request.query;
  try {
    const result = await JobsModel.deleteExperience(id);
    response.status(200).send({
      message: "Experience has been deleted",
      data: result,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while deleting experience",
      details: error.message,
    });
  }
};

const getQualification = async (request, response) => {
  try {
    const qualifications = await JobsModel.getQualification();
    response.status(200).send({
      message: "Qualifications fetched successfully",
      data: qualifications,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while fetching qualifications",
      details: error.message,
    });
  }
};

const getCourses = async (request, response) => {
  try {
    const courses = await JobsModel.getCourses();
    response.status(200).send({
      message: "Courses fetched successfully",
      data: courses,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while fetching courses",
      details: error.message,
    });
  }
};

const getSpecialization = async (request, response) => {
  try {
    const specializations = await JobsModel.getSpecialization();
    response.status(200).send({
      message: "Specialization fetched successfully",
      data: specializations,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while fetching specialization",
      details: error.message,
    });
  }
};

const getColleges = async (request, response) => {
  try {
    const colleges = await JobsModel.getColleges();
    response.status(200).send({
      message: "Colleges fetched successfully",
      data: colleges,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while fetching colleges",
      details: error.message,
    });
  }
};

const getCourseType = async (request, response) => {
  const types = await JobsModel.getCourseType();
  response.status(200).send({
    message: "Course types fetched successfully",
    data: types,
  });
};

const deleteProject = async (request, response) => {
  const { id } = request.query;
  try {
    const result = await JobsModel.deleteProject(id);
    response.status(200).send({
      message: "Projects has been deleted",
      data: result,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while deleting project",
      details: error.message,
    });
  }
};

const saveJobPost = async (request, response) => {
  const { user_id, job_post_id } = request.body;
  try {
    const result = await JobsModel.saveJobPost(user_id, job_post_id);
    response.status(201).send({
      message: "This job has been added to your watchlist",
      data: result,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while add this job to your watchlist",
      details: error.message,
    });
  }
};

const getSavedJobs = async (request, response) => {
  const { user_id } = request.query;
  try {
    const savedJobs = await JobsModel.getSavedJobs(user_id);
    response.status(200).send({
      message: "Saved jobs fetched successfully",
      data: savedJobs,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while fetching saved jobs",
      details: error.message,
    });
  }
};

const removeSavedJobs = async (request, response) => {
  const { id } = request.query;
  try {
    const result = await JobsModel.removeSavedJobs(id);
    response.status(200).send({
      message: "This job has been removed from your watchlist",
      data: result,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while removing this job from your watchlist",
      details: error.message,
    });
  }
};

const checkIsJobApplied = async (request, response) => {
  const { user_id, job_post_id } = request.query;
  try {
    const result = await JobsModel.checkIsJobApplied(user_id, job_post_id);
    response.status(200).send({
      message: "Data fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while fetching data",
      details: error.message,
    });
  }
};

const checkIsJobSaved = async (request, response) => {
  const { user_id, job_post_id } = request.query;
  try {
    const isSaved = await JobsModel.checkIsJobSaved(user_id, job_post_id);
    response.status(200).send({
      message: "Data fetched successfully",
      data: isSaved,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while fetching data",
      details: error.message,
    });
  }
};

const updateJobDescription = async (request, response) => {
  const { job_post_id, description, benefits } = request.body;
  const formattedBenefits = Array.isArray(benefits) ? benefits : [benefits];
  try {
    const result = await JobsModel.updateJobDescription(
      job_post_id,
      description,
      formattedBenefits
    );
    response.status(200).send({
      message: "Job description updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while updating job description",
      details: error.message,
    });
  }
};

const updateEligibility = async (request, response) => {
  const {
    job_post_id,
    experience_type,
    experience_required,
    salary_type,
    min_salary,
    max_salary,
    diversity_hiring,
    currency_code,
    salary_duration,
    role,
    fixed_format,
    variable_amount,
    variable_format,
    bonus_amount,
    bonus_format,
  } = request.body;
  const formattedExpReq = Array.isArray(experience_required)
    ? experience_required
    : [experience_required];
  const formattedDiversity = Array.isArray(diversity_hiring)
    ? diversity_hiring
    : [diversity_hiring];
  try {
    const result = await JobsModel.updateEligibility(
      job_post_id,
      experience_type,
      formattedExpReq,
      salary_type,
      min_salary,
      max_salary,
      formattedDiversity,
      currency_code,
      salary_duration,
      fixed_format,
      variable_amount,
      variable_format,
      bonus_amount,
      bonus_format
    );
    response.status(200).send({
      message: "Job updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while updating job",
      details: error.message,
    });
  }
};

const updateJobNature = async (request, response) => {
  const {
    job_post_id,
    job_nature,
    duration_period,
    workplace_type,
    work_location,
  } = request.body;
  const formattedDuration = Array.isArray(duration_period)
    ? duration_period
    : [duration_period];
  const formattedWorkLocation = Array.isArray(work_location)
    ? work_location
    : [work_location];
  try {
    const result = await JobsModel.updateJobNature(
      job_post_id,
      job_nature,
      formattedDuration,
      workplace_type,
      formattedWorkLocation
    );
    response.status(200).send({
      message: "Job post updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while updating job post",
      details: error.message,
    });
  }
};

const updateJobBasicDetails = async (request, response) => {
  const {
    job_post_id,
    company_name,
    company_logo,
    about_company,
    job_title,
    job_categories,
    skills,
    openings,
    working_days,
  } = request.body;
  const formattedJobCategory = Array.isArray(job_categories)
    ? job_categories
    : [job_categories];
  const formattedSkills = Array.isArray(skills) ? skills : [skills];

  // 🖼️ Handle Next.js image objects for company_logo
  if (company_logo && typeof company_logo === "object") {
    company_logo = company_logo.src || (company_logo.default && company_logo.default.src) || JSON.stringify(company_logo);
  }

  try {
    const result = await JobsModel.updateJobBasicDetails(
      job_post_id,
      company_name,
      company_logo,
      about_company,
      job_title,
      formattedJobCategory,
      formattedSkills,
      openings,
      working_days
    );
    response.status(200).send({
      message: "Job post updated successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while updating job post",
      details: error.message,
    });
  }
};

const searchByKeyword = async (request, response) => {
  const { searchTerm, category } = request.query;
  try {
    const result = await JobsModel.searchByKeyword(searchTerm, category);
    response.status(200).send({
      message: "Search results fetched successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while fetching search results",
      details: error.message,
    });
  }
};

const getAppliedCandidatesCount = async (request, response) => {
  const { user_id } = request.query;
  try {
    const appliedCandidates = await JobsModel.getAppliedCandidatesCount(
      user_id
    );
    response.status(200).send({
      message: "Applied candidates count fetched successfully",
      data: appliedCandidates,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while fetching applied candidates count",
      details: error.message,
    });
  }
};

const getLocations = async (request, response) => {
  try {
    const searchTerm = request.query.q || "";
    const results = cities
      .filter((city) =>
        [city.name, city.state, city.country].some((field) =>
          field.toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
      .slice(0, 20); // Limit to 20 results
    response.status(200).send({
      message: "Location fetched successfully",
      data: results,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while fetching location",
      details: error.message,
    });
  }
};

const StatsOfPost = async (request, response) => {
  const { user_id, job_post_id } = request.query;
  try {
    const appliedCandidates = await JobsModel.StatsOfPost(user_id, job_post_id);
    response.status(200).send({
      message: "Applied candidates count of post fetched successfully",
      data: appliedCandidates,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while fetching applied candidates count",
      details: error.message,
    });
  }
};

const getAllCandidateByRecruiter = async (request, response) => {
  const { user_id, limit, page } = request.query;
  try {
    const result = await JobsModel.getAllCandidateByRecruiter(
      user_id,
      limit ? Number(limit) : undefined,
      page ? Number(page) : undefined
    );
    const hasPagination = limit !== undefined && page !== undefined;
    const data = hasPagination ? result.candidates : (result.candidates || result);
    const total = hasPagination ? result.total : (result.total !== undefined ? result.total : data.length);

    response.status(200).send({
      message: "Candidates fetched successfully",
      data: data,
      total: total,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while fetching candidates",
      details: error.message,
    });
  }
};

const getAllAppliedCandidates = async (request, response) => {
  const { limit, page } = request.query;
  try {
    const result = await JobsModel.getAllAppliedCandidates(
      limit ? Number(limit) : undefined,
      page ? Number(page) : undefined
    );
    const hasPagination = limit !== undefined && page !== undefined;
    const data = hasPagination ? result.candidates : (result.candidates || result);
    const total = hasPagination ? result.total : (result.total !== undefined ? result.total : data.length);

    response.status(200).send({
      message: "Data fetched successfully",
      data: data,
      total: total,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error fetching candidates",
      details: error.message,
    });
  }
};

const getHomePageStats = async (request, response) => {
  try {
    const stats = await JobsModel.getHomePageStats();
    response.status(200).send({
      message: "Home page stats fetched successfully",
      data: stats,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while fetching home page stats",
      details: error.message,
    });
  }
};

const getTrendingSearches = async (request, response) => {
  try {
    const trending = await JobsModel.getTrendingSearches();
    response.status(200).send({
      message: "Trending searches fetched successfully",
      data: trending,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while fetching trending searches",
      details: error.message,
    });
  }
};

const getUniqueCompanies = async (request, response) => {
  try {
    const companies = await JobsModel.getUniqueCompanies();
    response.status(200).send({
      message: "Companies fetched successfully",
      data: companies,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while fetching companies",
      details: error.message,
    });
  }
};

const getSuperAdminDashboardData = async (request, response) => {
  try {
    const { timeFilter } = request.query;
    const stats = await JobsModel.getSuperAdminDashboardData(timeFilter);
    response.status(200).send({
      message: "Superadmin dashboard stats fetched successfully",
      data: stats,
    });
  } catch (error) {
    console.error("❌ Error in getSuperAdminDashboardData:", error);
    response.status(500).send({
      message: "Error fetching superadmin dashboard stats",
      details: error.message,
    });
  }
};

const getCompanyLogo = async (request, response) => {
  try {
    const { id } = request.params;
    const [rows] = await pool.query(
      `SELECT 
          CASE 
              WHEN job_post.company_logo IS NULL OR job_post.company_logo = '' OR job_post.company_logo LIKE '%dummy_img%' THEN hr_profiles.profile_image
              ELSE job_post.company_logo
          END AS company_logo
       FROM job_post 
       LEFT JOIN hr_profiles ON job_post.user_id = hr_profiles.user_id 
       WHERE job_post.id = ?`,
      [id]
    );
    if (rows.length === 0 || !rows[0].company_logo) {
      return response.status(404).send("Not Found");
    }
    const img = rows[0].company_logo;
    if (img.startsWith("data:")) {
      const matches = img.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
      if (matches && matches.length === 3) {
        const contentType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        response.setHeader('Content-Type', contentType);
        response.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day cache
        return response.send(buffer);
      }
    }
    if (img.startsWith("http") || img.startsWith("/")) {
      if (img.includes("/api/job/logo/")) {
        return response.status(404).send("Not Found");
      }
      return response.redirect(img);
    }
    return response.status(400).send("Invalid logo format");
  } catch (error) {
    console.error("Error fetching company logo:", error);
    return response.status(500).send("Internal server error");
  }
};


const getVenues = async (req, res) => {
  try {
    const data = await JobsModel.getVenues(req.user.id);
    res.send({ success: true, data: data });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

const createVenue = async (req, res) => {
  try {
    await JobsModel.insertVenue(req.user.id, req.body.address, req.body.url);
    res.send({ success: true, message: 'Venue added' });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

const getTeamMembers = async (req, res) => {
  try {
    const data = await JobsModel.getTeamMembers(req.user.id);
    res.send({ success: true, data: data });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

const createTeamMember = async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).send({ success: false, message: "Name and email are required" });
    }

    const officialEmailRegex = /^[a-zA-Z0-9._%+-]+@(?!(gmail\.com|yahoo\.com|hotmail\.com|outlook\.com)$)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i;
    if (!officialEmailRegex.test(email)) {
      return res.status(400).send({ success: false, message: "Please enter a valid official email." });
    }

    const nameParts = name.trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || " ";

    // Get parent recruiter details
    const [parentRows] = await pool.query(
      "SELECT organization, organization_type_id, phone_code, phone, first_name, last_name FROM users WHERE id = ?",
      [req.user.id]
    );

    let org = null;
    let orgTypeId = null;
    let pCode = "+91";
    // Generate a unique 10-digit phone number to avoid "Phone number already exists!" error
    let pPhone = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    let recruiterName = "A Recruiter";

    if (parentRows.length > 0) {
      org = parentRows[0].organization;
      orgTypeId = parentRows[0].organization_type_id;
      pCode = parentRows[0].phone_code || pCode;
      // Do NOT copy parent's phone, as it must be unique for each user
      recruiterName = `${parentRows[0].first_name} ${parentRows[0].last_name}`.trim();
    }

    // Generate password
    const password = crypto.randomBytes(4).toString("hex");

    // Create user in users table (role_id 3 is Recruiter)
    await UserModel.createUser(
      firstName,
      lastName,
      pCode,
      pPhone,
      email,
      password,
      org,
      orgTypeId,
      3
    );

    // Insert into hr_team_members
    await JobsModel.insertTeamMember(req.user.id, email);

    // Send email with credentials
    await EmailModel.sendTeamMemberInviteEmail(email, password, recruiterName);

    res.send({ success: true, message: "Team member added and email sent" });
  } catch (e) {
    console.error("Error creating team member:", e);
    // If it's a known error from createUser (like email exists) send 400
    if (e.message && e.message.includes("exists")) {
      return res.status(400).send({ success: false, message: e.message });
    }
    res.status(500).send({ success: false, message: e.message });
  }
};

const deleteTeamMember = async (req, res) => {
  try {
    const memberId = req.params.id;
    const parentUserId = req.user.id;
    
    if (!memberId) {
      return res.status(400).send({ success: false, message: "Member ID is required" });
    }

    const email = await JobsModel.deleteTeamMember(memberId, parentUserId);
    
    if (email) {
      await JobsModel.deleteSubRecruiterUser(email);
      res.send({ success: true, message: "Team member deleted successfully" });
    } else {
      res.status(404).send({ success: false, message: "Team member not found or unauthorized" });
    }
  } catch (e) {
    console.error("Error deleting team member:", e);
    res.status(500).send({ success: false, message: e.message });
  }
};



const updateJobPosting = async (request, response) => {
  let {
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
    apply_link,
    stipend_type,
    stipend_amount,
    internship_start_type,
    internship_start_date,
    last_date_to_apply,
  } = request.body;

  openings = openings && !isNaN(openings) ? parseInt(openings, 10) : null;

  if (company_logo && typeof company_logo === "object") {
    company_logo = company_logo.src || (company_logo.default && company_logo.default.src) || JSON.stringify(company_logo);
  }

  const formattedDuration = Array.isArray(duration_period) ? duration_period : [duration_period];
  const formattedJobCategory = Array.isArray(job_category) ? job_category : [job_category];
  const formattedSkills = Array.isArray(skills) ? skills : [skills];
  const formattedExpReq = Array.isArray(experience_required) ? experience_required : [experience_required];
  const formattedDiversity = Array.isArray(diversity_hiring) ? diversity_hiring : [diversity_hiring];
  const formattedBenefits = Array.isArray(benefits) ? benefits : [benefits];
  const formatQuestions = Array.isArray(questions) ? questions : [questions];
  const formattedWorkLocation = Array.isArray(work_location) ? work_location : [work_location];
  const formattedLanguages = Array.isArray(languages) ? languages : [languages].filter(Boolean);

  try {
    const result = await JobsModel.updateJobPosting(
      job_post_id,
      user_id,
      company_name,
      company_logo,
      about_company,
      job_title,
      job_nature,
      formattedDuration,
      workplace_type,
      formattedWorkLocation,
      formattedJobCategory,
      formattedSkills,
      experience_type,
      formattedExpReq,
      salary_type,
      currency,
      min_salary,
      max_salary,
      formattedDiversity,
      formattedBenefits,
      job_description,
      seo_description,
      openings,
      working_days,
      formatQuestions,
      salary_duration,
      role,
      industry,
      employment_type,
      willing_to_relocate,
      hybrid_policy,
      educational_qualification,
      candidate_industry,
      hide_salary,
      formattedLanguages,
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
    );
    if (result > 0) {
      response.send({ message: "Job updated successfully", success: true });
    } else {
      response.status(404).send({ message: "Job post not found or you are not authorized to edit it.", success: false });
    }
  } catch (error) {
    console.error("Error in updateJobPosting:", error);
    response.status(500).send({
      message: "Internal Server Error",
      details: error.message,
    });
  }
};

const deleteJobPost = async (req, res) => {
  const { id } = req.query;
  try {
    const [jobRows] = await pool.query(`SELECT user_id FROM job_post WHERE id = ?`, [id]);
    const recruiterUserId = jobRows[0]?.user_id;

    const result = await JobsModel.deleteJobPost(id);

    if (recruiterUserId) {
      await pool.query(
        `UPDATE subscription_usage su
         JOIN recruiter_subscriptions rs ON su.subscription_id = rs.id
         SET su.job_posts_used = GREATEST(0, su.job_posts_used - 1)
         WHERE rs.recruiter_id = ?`,
        [recruiterUserId]
      ).catch(err => console.error("⚠️ Failed to decrement job_posts_used:", err.message));
    }

    res.status(200).send({
      success: true,
      message: "Job post deleted successfully",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error while deleting job post",
      details: error.message,
    });
  }
};
const makeJobActive = async (request, response) => {
  const { id } = request.body;
  try {
    // 🛡️ Enforce active jobs limit from subscription plan
    const [jobRows] = await pool.query(`SELECT user_id FROM job_post WHERE id = ?`, [id]);
    if (jobRows.length > 0) {
      const recruiterUserId = jobRows[0].user_id;
      const [subRows] = await pool.query(`
        SELECT sp.active_job_limit 
        FROM recruiter_subscriptions rs
        INNER JOIN subscription_plans sp ON rs.plan_id = sp.id
        WHERE rs.recruiter_id = ? AND rs.status = 'Active'
        ORDER BY rs.id DESC LIMIT 1
      `, [recruiterUserId]);

      if (subRows.length > 0) {
        const activeLimit = subRows[0].active_job_limit;
        const [activeCountRows] = await pool.query(
          `SELECT COUNT(*) AS count FROM job_post WHERE user_id = ? AND (is_closed = 0 OR is_closed IS NULL) AND approval_status = 'approved'`,
          [recruiterUserId]
        );
        if (activeCountRows[0].count >= activeLimit) {
          return response.status(403).json({
            message: "Maximum Active Job Limit Reached",
            details: `You have reached your maximum active job limit (${activeLimit}). Close an existing job or upgrade your plan.`
          });
        }
      }
    }

    const result = await JobsModel.makeJobActive(id);
    response.status(200).send({
      message: "Job registration has been made active successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while activating job registration",
      details: error.message,
    });
  }
};
const saveCandidateHR = async (req, res) => {
  try {
    const recruiter_id = req.user.id;
    const { candidate_id, applied_jobs_id } = req.body;
    await JobsModel.saveCandidateToDB(recruiter_id, candidate_id, applied_jobs_id);
    res.send({ success: true, message: "Candidate saved successfully" });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};

const getSavedCandidatesHR = async (req, res) => {
  try {
    const recruiter_id = req.user.id;
    const candidates = await JobsModel.getSavedCandidatesFromDB(recruiter_id);
    res.send({ success: true, data: candidates });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};

const removeSavedCandidateHR = async (req, res) => {
  try {
    const recruiter_id = req.user.id;
    const { candidate_id } = req.query;
    await JobsModel.removeSavedCandidateFromDB(recruiter_id, candidate_id);
    res.send({ success: true, message: "Candidate removed successfully" });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};
const updateJobStatus = async (req, res) => {
  try {
    let { applied_jobs_id, applied_job_id, id, post_id, candidate_id, user_id, status } = req.body;
    let targetId = applied_jobs_id || applied_job_id || id;
    const targetUserId = candidate_id || user_id;

    // Resolve by (postId, userId) when available for 100% accuracy
    if (post_id && targetUserId) {
      const [rows] = await pool.query(
        'SELECT id FROM applied_jobs WHERE postId = ? AND userId = ?',
        [post_id, targetUserId]
      );
      if (rows && rows.length > 0) {
        targetId = rows[0].id;
      }
    }

    // If still not resolved and targetId given, verify it exists in applied_jobs
    if (!targetId && id) {
      const [byAppId] = await pool.query('SELECT id FROM applied_jobs WHERE id = ?', [id]);
      if (byAppId && byAppId.length > 0) {
        targetId = byAppId[0].id;
      }
    }

    if (!targetId && (!post_id || !targetUserId)) {
      return res.status(400).send({ success: false, message: "applied_jobs_id or (post_id and user_id) are required" });
    }

    if (!status) {
      return res.status(400).send({ success: false, message: "status is required" });
    }

    // Update applied_jobs table
    if (targetId) {
      await pool.query('UPDATE applied_jobs SET status = ? WHERE id = ?', [status, targetId]);
    }
    if (post_id && targetUserId) {
      await pool.query('UPDATE applied_jobs SET status = ? WHERE postId = ? AND userId = ?', [status, post_id, targetUserId]);
    }

    // Record in applied_job_status_history for consistent status history tracking
    try {
      const [jobRow] = await pool.query(
        'SELECT id, userId FROM applied_jobs WHERE id = ? OR (postId = ? AND userId = ?) LIMIT 1',
        [targetId || 0, post_id || 0, targetUserId || 0]
      );
      if (jobRow && jobRow.length > 0) {
        await pool.query(
          'INSERT INTO applied_job_status_history (applied_job_id, status, user_id) VALUES (?, ?, ?)',
          [jobRow[0].id, status, jobRow[0].userId]
        );
      }
    } catch (historyErr) {
      console.warn("Could not insert into applied_job_status_history:", historyErr.message);
    }

    res.send({ success: true, message: "Status updated successfully" });
  } catch (error) {
    console.error("updateJobStatus error:", error);
    res.status(500).send({ success: false, message: error.message });
  }
};


const getPendingJobs = async (request, response) => {
  const { limit, page } = request.query;
  const filters = {
    limit: limit ? parseInt(limit) : 20,
    page: page ? parseInt(page) : 1,
    approval_status: 'pending'
  };

  try {
    const postsResult = await JobsModel.getJobPosts(filters);
    const rawList = postsResult?.data || (Array.isArray(postsResult) ? postsResult : []);

    const enrichedList = await Promise.all(
      rawList.map(async (job) => {
        try {
          if (!job.user_id) return job;

          const [userRows] = await pool.query("SELECT role_id, full_name, email FROM users WHERE id = ?", [job.user_id]);
          const isSuperAdmin = userRows[0]?.role_id === 1;

          if (isSuperAdmin) {
            return {
              ...job,
              recruiter_name: userRows[0]?.full_name || job.recruiter_name,
              recruiter_email: userRows[0]?.email,
              recruiter_plan_name: 'Admin',
              recruiter_active_limit: 0,
              recruiter_active_count: 0,
              recruiter_can_approve: true
            };
          }

          const [subRows] = await pool.query(
            `SELECT sp.name AS plan_name, sp.active_job_limit
             FROM recruiter_subscriptions rs
             JOIN subscription_plans sp ON rs.plan_id = sp.id
             WHERE rs.recruiter_id = ?
             ORDER BY rs.id DESC LIMIT 1`,
            [job.user_id]
          );

          const planName = subRows[0]?.plan_name || 'Basic';
          const activeLimit = subRows[0]?.active_job_limit !== undefined ? subRows[0].active_job_limit : 3;

          const [activeCountRows] = await pool.query(
            `SELECT COUNT(*) AS count FROM job_post WHERE user_id = ? AND (is_closed = 0 OR is_closed IS NULL) AND approval_status = 'approved'`,
            [job.user_id]
          );

          const activeCount = activeCountRows[0]?.count || 0;
          const canApprove = activeLimit === 0 || activeCount < activeLimit;

          return {
            ...job,
            recruiter_name: userRows[0]?.full_name || job.recruiter_name,
            recruiter_email: userRows[0]?.email,
            recruiter_plan_name: planName,
            recruiter_active_limit: activeLimit,
            recruiter_active_count: activeCount,
            recruiter_can_approve: canApprove
          };
        } catch (enrichErr) {
          console.error("Error enriching job:", enrichErr);
          return job;
        }
      })
    );

    if (postsResult && postsResult.data) {
      postsResult.data = enrichedList;
    }

    response.status(200).send({
      message: "Pending job posts fetched successfully",
      data: postsResult && postsResult.data ? postsResult : enrichedList,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error fetching pending job posts",
      details: error.message,
    });
  }
};

const approveJob = async (request, response) => {
  const { id } = request.params;
  try {
    // 1. Get job and recruiter info
    const [jobRows] = await pool.query(
      "SELECT id, user_id, job_title, company_name, approval_status FROM job_post WHERE id = ?",
      [id]
    );
    if (!jobRows || jobRows.length === 0) {
      return response.status(404).send({ message: "Job post not found" });
    }
    const job = jobRows[0];
    const recruiterUserId = job.user_id;

    // 2. Enforce active job limit for recruiter
    if (recruiterUserId) {
      const [userRows] = await pool.query("SELECT role_id FROM users WHERE id = ?", [recruiterUserId]);
      const isSuperAdmin = userRows[0]?.role_id === 1;

      if (!isSuperAdmin) {
        const [subRows] = await pool.query(
          `SELECT sp.name AS plan_name, sp.active_job_limit
           FROM recruiter_subscriptions rs
           JOIN subscription_plans sp ON rs.plan_id = sp.id
           WHERE rs.recruiter_id = ?
           ORDER BY rs.id DESC LIMIT 1`,
          [recruiterUserId]
        );

        const planName = subRows[0]?.plan_name || 'Basic';
        const activeLimit = subRows[0]?.active_job_limit !== undefined ? subRows[0].active_job_limit : 3;

        if (activeLimit > 0) {
          const [activeCountRows] = await pool.query(
            `SELECT COUNT(*) AS count FROM job_post WHERE user_id = ? AND (is_closed = 0 OR is_closed IS NULL) AND approval_status = 'approved'`,
            [recruiterUserId]
          );
          const activeJobsCount = activeCountRows[0]?.count || 0;

          if (activeJobsCount >= activeLimit) {
            return response.status(400).send({
              message: "Active Job Limit Reached",
              details: `Cannot approve job: Recruiter "${job.company_name || 'Recruiter'}" has reached their ${planName} Plan active limit (${activeJobsCount}/${activeLimit} active slots used). The recruiter must upgrade their plan or close an existing active job before this job can be approved.`
            });
          }
        }
      }
    }

    const result = await JobsModel.updateApprovalStatus(id, 'approved');
    
    // Fetch the job details to send notification
    const filters = { id: id };
    const posts = await JobsModel.getJobPosts(filters);
    
    if (posts && posts.length > 0) {
      const job = posts[0];
      const notificationIcon = (job.company_logo && typeof job.company_logo === 'string' && !job.company_logo.startsWith('data:'))
        ? job.company_logo
        : "/favicon.png";

      let notificationTitle = "";
      let notificationBody = "";

      if (job.job_nature === "Job") {
        notificationTitle = "New Job Alert! 💼";
        notificationBody = `${job.job_title} at ${job.company_name} - Apply now and kickstart your career!`;
      } else if (job.job_nature === "Internship") {
        notificationTitle = "New Internship Alert! 🚀";
        notificationBody = `${job.job_title} at ${job.company_name} - Gain hands-on experience and grow your skills!`;
      } else if (job.job_nature === "Scholarship") {
        notificationTitle = "New Scholarship Opportunity! 🎓";
        notificationBody = `${job.job_title} at ${job.company_name} - Apply now and fund your education!`;
      } else {
        notificationTitle = "New Opportunity! 🌟";
        notificationBody = `${job.job_title} at ${job.company_name} - Check it out now!`;
      }

      const message = {
        notification: {
          title: notificationTitle,
          body: notificationBody,
        },
        webpush: {
          notification: {
            icon: notificationIcon,
            requireInteraction: true,
          },
          fcm_options: {
            link: "https://careerfast.com/job-portal",
          },
        },
        topic: "allUsers",
      };

      try {
        await admin.messaging().send(message);
        console.log("✅ Notification sent successfully for approved job");
      } catch (err) {
        console.error("❌ Error sending broadcast:", err.message);
      }
    }

    response.status(200).send({
      message: "Job approved successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error approving job",
      details: error.message,
    });
  }
};

const rejectJob = async (request, response) => {
  const { id } = request.params;
  const { reason } = request.body;
  try {
    const result = await JobsModel.updateApprovalStatus(id, 'rejected', reason);
    response.status(200).send({
      message: "Job rejected successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).send({
      message: "Error rejecting job",
      details: error.message,
    });
  }
};

const approveAllJobs = async (request, response) => {
  try {
    const [pendingJobs] = await pool.query(
      `SELECT id, user_id, job_title, company_name FROM job_post WHERE approval_status = 'pending' AND (is_closed = 0 OR is_closed IS NULL)`
    );

    if (!pendingJobs || pendingJobs.length === 0) {
      return response.status(200).send({
        message: "No pending jobs to approve",
        approvedCount: 0,
        skippedCount: 0
      });
    }

    let approvedCount = 0;
    let skippedCount = 0;
    const skippedJobs = [];
    const recruiterActiveCounts = {};

    for (const job of pendingJobs) {
      const recruiterUserId = job.user_id;

      if (recruiterUserId) {
        const [userRows] = await pool.query("SELECT role_id FROM users WHERE id = ?", [recruiterUserId]);
        const isSuperAdmin = userRows[0]?.role_id === 1;

        if (!isSuperAdmin) {
          const [subRows] = await pool.query(
            `SELECT sp.name AS plan_name, sp.active_job_limit
             FROM recruiter_subscriptions rs
             JOIN subscription_plans sp ON rs.plan_id = sp.id
             WHERE rs.recruiter_id = ?
             ORDER BY rs.id DESC LIMIT 1`,
            [recruiterUserId]
          );

          const planName = subRows[0]?.plan_name || 'Basic';
          const activeLimit = subRows[0]?.active_job_limit !== undefined ? subRows[0].active_job_limit : 3;

          if (activeLimit > 0) {
            if (recruiterActiveCounts[recruiterUserId] === undefined) {
              const [activeCountRows] = await pool.query(
                `SELECT COUNT(*) AS count FROM job_post WHERE user_id = ? AND (is_closed = 0 OR is_closed IS NULL) AND approval_status = 'approved'`,
                [recruiterUserId]
              );
              recruiterActiveCounts[recruiterUserId] = activeCountRows[0]?.count || 0;
            }

            if (recruiterActiveCounts[recruiterUserId] >= activeLimit) {
              skippedCount++;
              skippedJobs.push({
                id: job.id,
                title: job.job_title,
                company: job.company_name,
                reason: `Limit reached (${recruiterActiveCounts[recruiterUserId]}/${activeLimit})`
              });
              continue;
            }

            recruiterActiveCounts[recruiterUserId]++;
          }
        }
      }

      await JobsModel.updateApprovalStatus(job.id, 'approved');
      approvedCount++;
    }

    response.status(200).send({
      message: `Approved ${approvedCount} job(s).${skippedCount > 0 ? ` Skipped ${skippedCount} job(s) because recruiter reached their plan active limit.` : ''}`,
      approvedCount,
      skippedCount,
      skippedJobs
    });
  } catch (error) {
    response.status(500).send({
      message: "Error approving all pending jobs",
      details: error.message,
    });
  }
};

module.exports = {
  deleteJobPost, makeJobActive, saveCandidateHR, getSavedCandidatesHR, removeSavedCandidateHR, updateJobStatus,
  getVenues, createVenue, getTeamMembers, createTeamMember,
  getCompanyLogo,
  insertJobNature,
  getJobNature,
  insertWorkPlaceType,
  getWorkplaceType,
  getWorklocation,
  getInternshipDuration,
  getDurationPeriod,
  getBenefits,
  getGender,
  getEligibility,
  getSalaryType,
  jobPosting,
  updateJobPosting,
  applyForJob,
  getJobAppliedCandidates,
  getYears,
  getSkills,
  getJobCategories,
  getJobPosts,
  registrationClose,
  getExperienceRange,
  insertProjects,
  updateProject,
  updateResume,
  updateSkills,
  updateVisibility,
  updateAbout,
  getJobPostByUserId,
  getClasses,
  updateExperience,
  insertExperience,
  deleteExperience,
  getQualification,
  getCourses,
  getSpecialization,
  getColleges,
  getCourseType,
  deleteProject,
  saveJobPost,
  getSavedJobs,
  removeSavedJobs,
  checkIsJobApplied,
  checkIsJobSaved,
  updateJobDescription,
  searchByKeyword,
  updateEligibility,
  updateJobNature,
  updateJobBasicDetails,
  getAppliedCandidatesCount,
  getLocations,
  StatsOfPost,
  getAllCandidateByRecruiter,
  getAllAppliedCandidates,
  getHomePageStats,
  getTrendingSearches,
  getUniqueCompanies,
  getSuperAdminDashboardData,
  deleteTeamMember,
  getPendingJobs,
  approveJob,
  rejectJob,
  approveAllJobs,
};
