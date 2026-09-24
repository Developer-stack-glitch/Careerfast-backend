const pool = require('../config/dbConfig');

async function test() {
  try {
    const q1 = `
      SELECT 
        u.id, u.role_id, u.first_name, u.last_name, u.phone_code, u.phone,
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
      LIMIT 10 OFFSET 0
    `;
    const [rows] = await pool.query(q1);
    console.log('Query with GROUP BY u.id and MAX(boost) succeeded! Rows:', rows.length);
  } catch(e) {
    console.error('Error in Q1:', e.message);
  }
  process.exit(0);
}

test();
