const mysql = require('mysql2/promise');
require('dotenv').config();

async function test() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [rows] = await pool.query(`
      SELECT JSON_SEARCH(LOWER(JSON_ARRAY('Chennai')), 'one', 'chennai') as result
    `);
    console.log('Result:', rows[0].result);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

test();
