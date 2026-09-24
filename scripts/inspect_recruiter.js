const pool = require("../config/dbConfig");

async function checkRecruiter() {
  try {
    const [rows] = await pool.query(`
      SELECT 
        u.id, 
        u.email, 
        u.is_active, 
        u.is_active = 1 AS is_active_bool,
        CAST(u.is_active AS UNSIGNED) AS is_active_int,
        u.is_active = b'1' AS is_active_bit
      FROM users u 
      WHERE u.id = 584
    `);
    console.log("Raw row:", rows[0]);
    console.log("JSON serialized:", JSON.stringify(rows[0]));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkRecruiter();
