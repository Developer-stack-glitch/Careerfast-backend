const pool = require('../config/dbConfig');
async function run() {
  const [rows] = await pool.query("SELECT id, job_title, company_name, company_logo FROM job_post WHERE id = 3630");
  console.log(rows);
  process.exit(0);
}
run();
