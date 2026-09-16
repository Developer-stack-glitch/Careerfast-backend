require('dotenv').config();
const pool = require('../config/dbConfig');

(async () => {
  try {
    const search = 'React Node.js Sales';
    const rawTerms = search.trim().split(/[\s,]+/);
    const terms = Array.from(new Set(rawTerms.map(t => t.trim()).filter(Boolean)));
    
    let queryParams = [];
    
    // Build match condition for each term
    const termClauses = terms.map(() => `(
      u.first_name LIKE ? OR 
      u.last_name LIKE ? OR 
      u.email LIKE ? OR 
      u.phone LIKE ? OR 
      u.location LIKE ? OR 
      u.skills LIKE ? OR
      u.course LIKE ? OR
      u.about LIKE ? OR
      up.job_title LIKE ? OR
      up.company_name LIKE ? OR
      up.designation LIKE ? OR
      ue.course LIKE ? OR
      ue.college LIKE ? OR
      ue.specialization LIKE ?
    )`);

    // Build relevance score expression
    const relevanceScoreParts = termClauses.map(clause => `(CASE WHEN ${clause} THEN 1 ELSE 0 END)`);
    const relevanceExpr = relevanceScoreParts.length > 0 ? relevanceScoreParts.join(' + ') : '0';
    
    let baseQuery = `
      SELECT DISTINCT u.id, u.first_name, u.last_name, u.skills,
             (${relevanceExpr}) as match_score
      FROM users u
      LEFT JOIN user_professional up ON u.id = up.user_id AND up.is_deleted = 0
      LEFT JOIN user_education ue ON u.id = ue.user_id AND ue.is_deleted = 0
      WHERE u.role_id = 2 AND (${termClauses.join(' OR ')})
      ORDER BY match_score DESC, u.created_date DESC
    `;
    
    // Push params for match_score
    terms.forEach(term => {
      const p = '%' + term + '%';
      for (let i = 0; i < 14; i++) queryParams.push(p);
    });
    // Push params for WHERE clause
    terms.forEach(term => {
      const p = '%' + term + '%';
      for (let i = 0; i < 14; i++) queryParams.push(p);
    });
    
    const [rows] = await pool.query(baseQuery, queryParams);
    console.log('Results ranked by match score:');
    rows.forEach(r => {
      console.log(`- ${r.first_name} ${r.last_name} (ID: ${r.id}) -> Score: ${r.match_score}`);
    });
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
