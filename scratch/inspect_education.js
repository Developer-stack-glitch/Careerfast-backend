const pool = require('../config/dbConfig');

async function run() {
  const [ueCols] = await pool.query('DESCRIBE user_education');
  console.log('user_education cols:', ueCols.map(c => c.Field));

  const [ueRows] = await pool.query('SELECT DISTINCT qualification, course FROM user_education WHERE is_deleted = 0');
  console.log('user_education distinct:', ueRows);

  const [uCourses] = await pool.query("SELECT DISTINCT course FROM users WHERE course IS NOT NULL AND course != ''");
  console.log('users course distinct:', uCourses);

  const [allCourses] = await pool.query(`
    SELECT DISTINCT course FROM (
      SELECT course FROM users WHERE course IS NOT NULL AND TRIM(course) != ''
      UNION
      SELECT course FROM user_education WHERE is_deleted = 0 AND course IS NOT NULL AND TRIM(course) != ''
      UNION
      SELECT educational_qualification as course FROM job_post WHERE educational_qualification IS NOT NULL AND TRIM(educational_qualification) != ''
    ) as all_c
    ORDER BY course ASC
  `);
  console.log('All DB degrees/courses count:', allCourses.length);
  console.log('All DB degrees:', allCourses.map(c => c.course));

  process.exit();
}

run();
