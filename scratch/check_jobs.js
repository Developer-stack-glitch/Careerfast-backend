const pool = require('../config/dbConfig');

async function test() {
  try {
    const [rows] = await pool.query('SELECT id, user_id, job_title, is_closed, approval_status FROM job_post ORDER BY id DESC LIMIT 10');
    console.log("Recent Job Posts:");
    rows.forEach(r => {
      console.log(`ID: ${r.id}, is_closed: ${JSON.stringify(r.is_closed)} (Buffer: ${Buffer.isBuffer(r.is_closed) ? r.is_closed[0] : r.is_closed}), approval_status: ${r.approval_status}, title: ${r.job_title}`);
    });
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

test();
