const fs = require('fs');
const file = 'models/JobsModel.js';
let content = fs.readFileSync(file, 'utf8');

// Update jobPosting signature
content = content.replace(
    /salary_duration\n\s*\) => {/,
    `salary_duration,
    role,
    industry,
    employment_type,
    willing_to_relocate,
    hybrid_policy,
    educational_qualification,
    candidate_industry
  ) => {`
);

// Update jobPosting insert columns
content = content.replace(
    /working_days,\n\s*salary_duration\n\s*\) VALUES \(/,
    `working_days,
        salary_duration,
        role,
        industry,
        employment_type,
        willing_to_relocate,
        hybrid_policy,
        educational_qualification,
        candidate_industry
      ) VALUES (`
);

// Update jobPosting insert values placeholders
content = content.replace(
    /\?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?\)/,
    `?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

// Update jobPosting values array
content = content.replace(
    /working_days,\n\s*salary_duration\n\s*\/\/ ❌/,
    `working_days,
        salary_duration,
        role,
        industry,
        employment_type,
        willing_to_relocate,
        hybrid_policy,
        JSON.stringify(educational_qualification),
        JSON.stringify(candidate_industry)
        // ❌`
);

// Update updateJobPosting signature
content = content.replace(
    /salary_duration\n\s*\) => {\n\s*try {\n\s*const query = `\n\s*UPDATE job_post SET/,
    `salary_duration,
    role,
    industry,
    employment_type,
    willing_to_relocate,
    hybrid_policy,
    educational_qualification,
    candidate_industry
  ) => {
    try {
      const query = \`
      UPDATE job_post SET`
);

// Update updateJobPosting SET clauses
content = content.replace(
    /working_days = \?,\n\s*salary_duration = \?/,
    `working_days = ?,
        salary_duration = ?,
        role = ?,
        industry = ?,
        employment_type = ?,
        willing_to_relocate = ?,
        hybrid_policy = ?,
        educational_qualification = ?,
        candidate_industry = ?`
);

// Update updateJobPosting values array
content = content.replace(
    /salary_duration,\n\s*job_post_id,\n\s*user_id/,
    `salary_duration,
        role,
        industry,
        employment_type,
        willing_to_relocate,
        hybrid_policy,
        JSON.stringify(educational_qualification),
        JSON.stringify(candidate_industry),
        job_post_id,
        user_id`
);

fs.writeFileSync(file, content);
console.log('patched JobsModel with new fields');
