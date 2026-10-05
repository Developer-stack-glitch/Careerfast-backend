const pool = require('../config/dbConfig');

async function fix() {
  try {
    const [res] = await pool.query(
      "UPDATE subscription_plans SET candidate_search = 1, candidate_contact = 1, resume_database = 1 WHERE LOWER(plan_type) = 'custom' OR LOWER(name) LIKE '%custom%'"
    );
    console.log("Updated custom plans rows:", res.affectedRows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fix();
