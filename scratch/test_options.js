const pool = require('../config/dbConfig');

async function testOptions() {
  const conn = await pool.getConnection();
  try {
    console.log('Testing Option A: Add relevance_score to SELECT list with DISTINCT');
    try {
      const qA = `
        SELECT DISTINCT u.id, u.first_name, u.skills, u.about,
               (CASE WHEN u.skills LIKE '%react%' OR up.job_title LIKE '%react%' OR u.about LIKE '%react%' THEN 1 ELSE 0 END) AS relevance_score
        FROM users u
        LEFT JOIN user_professional up ON u.id = up.user_id AND up.is_deleted = 0
        WHERE u.role_id = 2
        ORDER BY relevance_score DESC, u.id DESC
        LIMIT 10
      `;
      const [res] = await conn.query(qA);
      console.log('Option A succeeded! Rows:', res.length);
    } catch (e) {
      console.log('Option A failed:', e.message);
    }

    console.log('\nTesting Option B: Two-step / Derived query (Get matching distinct user IDs first)');
    try {
      const qB = `
        SELECT u.id, u.role_id, u.first_name, u.last_name, u.phone_code, u.phone,
               u.email, u.gender, u.is_email_verified, u.profile_image, u.resume,
               u.about, u.skills, u.organization, u.user_type, u.class, u.course,
               u.start_year, u.end_year, u.experince_type, u.total_years, u.total_months,
               u.location, u.organization_type_id, u.is_active, u.created_date,
               u.updated_date, u.banner_color, u.banner_image, u.last_active,
               u.preferred_job_type
        FROM users u
        INNER JOIN (
          SELECT u_sub.id,
                 MAX(CASE WHEN u_sub.skills LIKE '%react%' OR up_sub.job_title LIKE '%react%' OR u_sub.about LIKE '%react%' THEN 1 ELSE 0 END) AS rel_score,
                 COALESCE(u_sub.last_active, u_sub.updated_date, u_sub.created_date) AS sort_date
          FROM users u_sub
          LEFT JOIN user_professional up_sub ON u_sub.id = up_sub.user_id AND up_sub.is_deleted = 0
          WHERE u_sub.role_id = 2
          GROUP BY u_sub.id, u_sub.last_active, u_sub.updated_date, u_sub.created_date
          ORDER BY rel_score DESC, sort_date DESC, u_sub.id DESC
          LIMIT 10 OFFSET 0
        ) matched ON u.id = matched.id
        ORDER BY matched.rel_score DESC, matched.sort_date DESC, u.id DESC
      `;
      const [res] = await conn.query(qB);
      console.log('Option B succeeded! Rows:', res.length);
    } catch (e) {
      console.log('Option B failed:', e.message);
    }

    console.log('\nTesting Option C: What if Relevance boost only checks u.skills and u.about in ORDER BY without up.job_title?');
    try {
      const qC = `
        SELECT DISTINCT u.id, u.first_name, u.skills, u.about
        FROM users u
        LEFT JOIN user_professional up ON u.id = up.user_id AND up.is_deleted = 0
        WHERE u.role_id = 2 AND (u.skills LIKE '%react%' OR up.job_title LIKE '%react%')
        ORDER BY (CASE WHEN u.skills LIKE '%react%' OR u.about LIKE '%react%' THEN 1 ELSE 0 END) DESC,
                 COALESCE(u.last_active, u.updated_date, u.created_date) DESC,
                 u.id DESC
        LIMIT 10
      `;
      const [res] = await conn.query(qC);
      console.log('Option C succeeded! Rows:', res.length);
    } catch (e) {
      console.log('Option C failed:', e.message);
    }

  } finally {
    conn.release();
    process.exit(0);
  }
}

testOptions();
