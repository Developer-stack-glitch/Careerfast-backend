const fs = require('fs');
const file = 'controllers/JobsController.js';
let content = fs.readFileSync(file, 'utf8');

const updateJobPostingStr = `
const updateJobPosting = async (request, response) => {
  if (!request.body || Object.keys(request.body).length === 0) {
    return response.status(400).send({
      message: "Error updating job",
      details: "Request body is empty or invalid JSON",
    });
  }

  let {
    job_post_id,
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

  try {
    const result = await JobsModel.updateJobPosting(
      job_post_id,
      user_id,
      company_name,
      company_logo,
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
      salary_duration
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
`;

if (!content.includes('const updateJobPosting = async')) {
  content = content.replace(/const getJobPostByUserId = async/, updateJobPostingStr + '\nconst getJobPostByUserId = async');
  content = content.replace(/jobPosting,/, 'jobPosting,\n  updateJobPosting,');
  fs.writeFileSync(file, content);
  console.log('patched JobsController');
} else {
  console.log('already patched');
}
