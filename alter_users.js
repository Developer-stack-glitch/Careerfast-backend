const mysql = require('mysql2/promise');
require('dotenv').config();

async function alterTable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'careerfast',
  });

  try {
    console.log('Adding missing columns to users table...');
    const queries = [
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS languages TEXT;",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS visa_status VARCHAR(255);",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_job_type TEXT;",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS dob DATE;",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS company_headcount VARCHAR(255);"
    ];

    for (const q of queries) {
      // IF NOT EXISTS is standard in MariaDB and newer MySQL (8.0.17+).
      // If it fails, we will catch and ignore the duplicate column error (1060).
      try {
        await connection.query(q);
        console.log(`Executed: ${q}`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log(`Column already exists, skipping: ${q}`);
        } else if (err.code === 'ER_PARSE_ERROR') {
          // If IF NOT EXISTS is not supported, strip it
          const fallback = q.replace(' IF NOT EXISTS', '');
          try {
            await connection.query(fallback);
            console.log(`Executed (fallback): ${fallback}`);
          } catch(e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
              console.log(`Column already exists, skipping: ${fallback}`);
            } else {
              throw e;
            }
          }
        } else {
          throw err;
        }
      }
    }
    console.log('Alter table completed.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await connection.end();
  }
}

alterTable();
