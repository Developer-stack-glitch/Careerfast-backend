const fs = require('fs');
const file = 'models/JobsModel.js';
let content = fs.readFileSync(file, 'utf8');

const updateJobPostingStr = `
  updateJobPosting: async (
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
    salary_duration
  ) => {
    try {
      const query = \`
      UPDATE job_post SET
        company_name = ?,
        company_logo = ?,
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
        salary_duration = ?
      WHERE id = ? AND user_id = ?
    \`;

      const values = [
        company_name,
        company_logo,
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
        for (const q of questions) {
          await pool.query(
            \`INSERT INTO job_post_questions (post_id, question, isrequired)
           VALUES (?, ?, ?)\`,
            [job_post_id, q.question, q.isrequired]
          );
        }
      }

      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },
`;

if (!content.includes('updateJobPosting: async')) {
  content = content.replace(/applyForJob: async/, updateJobPostingStr + '\n  applyForJob: async');
  fs.writeFileSync(file, content);
  console.log('patched JobsModel');
} else {
  console.log('already patched');
}
