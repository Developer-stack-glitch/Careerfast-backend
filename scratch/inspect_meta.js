const pool = require('../config/dbConfig');

async function test() {
  try {
    const [indTypes] = await pool.query('SELECT DISTINCT industry_type FROM hr_profiles WHERE industry_type IS NOT NULL');
    console.log('hr_profiles industry_types:', indTypes);

    const [jobCat] = await pool.query('SELECT * FROM job_categories LIMIT 25');
    console.log('sample job_categories:', jobCat);

    const [orgType] = await pool.query('SELECT * FROM organization_type');
    console.log('sample organization_type:', orgType);

    const [jobCols] = await pool.query('DESCRIBE job_post');
    console.log('job_post cols:', jobCols.map(c => c.Field));

    const [jInd] = await pool.query("SELECT DISTINCT industry FROM job_post WHERE industry IS NOT NULL AND TRIM(industry) != ''");
    console.log('job_post industry:', jInd.map(x => x.industry));
    const [cInd] = await pool.query("SELECT DISTINCT candidate_industry FROM job_post WHERE candidate_industry IS NOT NULL AND TRIM(candidate_industry) != ''");
    console.log('candidate_industry:', cInd.map(x => x.candidate_industry));

    const [allCats] = await pool.query("SELECT category_name FROM job_categories WHERE category_name IS NOT NULL");
    console.log('Total job_categories:', allCats.length);

    const [compCount] = await pool.query(`
      SELECT COUNT(DISTINCT company_name) as count FROM (
        SELECT TRIM(company_name) as company_name FROM hr_profiles WHERE company_name IS NOT NULL AND TRIM(company_name) != ''
        UNION
        SELECT TRIM(company_name) as company_name FROM job_post WHERE company_name IS NOT NULL AND TRIM(company_name) != ''
        UNION
        SELECT TRIM(company_name) as company_name FROM user_professional WHERE is_deleted = 0 AND company_name IS NOT NULL AND TRIM(company_name) != ''
      ) as all_comp
    `);
    console.log('Total registered companies in DB:', compCount[0].count);

  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

test();
