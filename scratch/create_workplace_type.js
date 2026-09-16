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

    await pool.query(`CREATE TABLE IF NOT EXISTS workplace_type (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      is_active TINYINT DEFAULT 1
    )`);

    await pool.query(`INSERT IGNORE INTO workplace_type (id, name) VALUES
      (1, 'In Office'),
      (2, 'Remote'),
      (3, 'Hybrid')
    `);

    console.log("workplace_type created and seeded.");
    process.exit();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
