const pool = require('../config/dbConfig');

async function testQueries() {
  try {
    const testId = 3184; // Or any ID
    console.log("Testing with testId =", testId);

    const [rows1] = await pool.query('SELECT id, is_closed FROM job_post WHERE id = ? AND is_closed = 1', [testId]);
    console.log("Query `is_closed = 1` result:", rows1);

    const [rows0] = await pool.query('SELECT id, is_closed FROM job_post WHERE id = ? AND (is_closed = 0 OR is_closed IS NULL)', [testId]);
    console.log("Query `is_closed = 0` result:", rows0);

    const [all] = await pool.query('SELECT id, is_closed FROM job_post WHERE id = ?', [testId]);
    console.log("Query raw row:", all[0]);

    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

testQueries();
