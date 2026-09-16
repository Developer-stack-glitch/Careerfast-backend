const mysql = require('mysql2/promise');
require('dotenv').config({path: './.env'});

(async () => {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    await pool.query(`CREATE TABLE IF NOT EXISTS work_location (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      is_active TINYINT DEFAULT 1
    )`);

    console.log("work_location created.");
    process.exit();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
