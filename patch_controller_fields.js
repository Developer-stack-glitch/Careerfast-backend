const fs = require('fs');
const file = 'controllers/JobsController.js';
let content = fs.readFileSync(file, 'utf8');

// JobPosting extraction
content = content.replace(
    /working_days,\n\s*salary_duration\n\s*} = request\.body;/,
    `working_days,
      salary_duration,
      role,
      industry,
      employment_type,
      willing_to_relocate,
      hybrid_policy,
      educational_qualification,
      candidate_industry
    } = request.body;`
);

// JobPosting function call arguments
content = content.replace(
    /working_days,\n\s*questions,\n\s*salary_duration\n\s*\);/,
    `working_days,
        questions,
        salary_duration,
        role,
        industry,
        employment_type,
        willing_to_relocate,
        hybrid_policy,
        educational_qualification,
        candidate_industry
      );`
);

// updateJobPosting extraction
content = content.replace(
    /working_days,\n\s*salary_duration\n\s*} = req\.body;/,
    `working_days,
      salary_duration,
      role,
      industry,
      employment_type,
      willing_to_relocate,
      hybrid_policy,
      educational_qualification,
      candidate_industry
    } = req.body;`
);

// updateJobPosting function call arguments
content = content.replace(
    /working_days,\n\s*questions,\n\s*salary_duration\n\s*\);/,
    `working_days,
        questions,
        salary_duration,
        role,
        industry,
        employment_type,
        willing_to_relocate,
        hybrid_policy,
        educational_qualification,
        candidate_industry
      );`
);

fs.writeFileSync(file, content);
console.log('patched JobsController with new fields');
