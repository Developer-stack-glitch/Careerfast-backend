const pool = require('../config/dbConfig');

async function testStrict() {
  const conn = await pool.getConnection();
  try {
    // Set strict MySQL 8.0 sql_mode
    await conn.query("SET sql_mode = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");

    console.log('--- TEST 1: Old query with DISTINCT ---');
    try {
      const oldQuery = `
        SELECT DISTINCT u.id, u.first_name, u.skills, u.about
        FROM users u
        LEFT JOIN user_professional up ON u.id = up.user_id AND up.is_deleted = 0
        WHERE u.role_id = 2
        ORDER BY ((CASE WHEN u.skills LIKE '%react%' OR up.job_title LIKE '%react%' OR u.about LIKE '%react%' THEN 1 ELSE 0 END)) DESC,
                 COALESCE(u.last_active, u.updated_date, u.created_date) DESC,
                 u.id DESC
        LIMIT 10
      `;
      await conn.query(oldQuery);
      console.log('Old query succeeded unexpectedly.');
    } catch (e) {
      console.log('Old query failed as expected:', e.message);
    }

    console.log('\n--- TEST 2: New query with GROUP BY u.id and MAX(CASE) ---');
    try {
      const newQuery = `
        SELECT u.id, u.role_id, u.first_name, u.last_name, u.phone_code, u.phone,
               u.email, u.gender, u.is_email_verified, u.profile_image, u.resume,
               u.about, u.skills, u.organization, u.user_type, u.class, u.course,
               u.start_year, u.end_year, u.experince_type, u.total_years, u.total_months,
               u.location, u.organization_type_id, u.is_active, u.created_date,
               u.updated_date, u.banner_color, u.banner_image, u.last_active,
               u.preferred_job_type
        FROM users u
        LEFT JOIN user_professional up ON u.id = up.user_id AND up.is_deleted = 0
        WHERE u.role_id = 2
        GROUP BY u.id
        ORDER BY (MAX(CASE WHEN u.skills LIKE '%react%' OR up.job_title LIKE '%react%' OR u.about LIKE '%react%' THEN 1 ELSE 0 END)) DESC,
                 COALESCE(u.last_active, u.updated_date, u.created_date) DESC,
                 u.id DESC
        LIMIT 10
      `;
      const [res] = await conn.query(newQuery);
      console.log('✅ New query succeeded under strict MySQL 8.0 mode! Rows:', res.length);
    } catch (e) {
      console.error('❌ New query failed:', e.message);
    }

  } finally {
    conn.release();
    process.exit(0);
  }
}

testStrict();
