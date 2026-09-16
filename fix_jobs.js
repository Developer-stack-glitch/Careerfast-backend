const fs = require('fs');

const path = 'c:\\Users\\dell\\Documents\\Careerfast\\careerfast-backend\\controllers\\JobsController.js';
let content = fs.readFileSync(path, 'utf8');

const brokenSection = `    willing_to_relocate,
    hybrid_policy,
  const formattedJobCategory = Array.isArray(job_category)`;

const fixedSection = `    willing_to_relocate,
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

  // 🧹 Clean the openings field
  openings = openings && !isNaN(openings) ? parseInt(openings, 10) : null;

  // 🖼️ Handle Next.js image objects for company_logo
  if (company_logo && typeof company_logo === "object") {
    company_logo = company_logo.src || (company_logo.default && company_logo.default.src) || JSON.stringify(company_logo);
  }

  const formattedDuration = Array.isArray(duration_period)
    ? duration_period
    : [duration_period];
  const formattedJobCategory = Array.isArray(job_category)`;

content = content.replace(brokenSection, fixedSection);
fs.writeFileSync(path, content, 'utf8');
console.log('Fixed JobsController.js');
