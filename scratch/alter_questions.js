const pool = require('../config/dbConfig');

async function migrate() {
  try {
    try {
      await pool.query("ALTER TABLE job_post_questions ADD COLUMN question_type VARCHAR(50) DEFAULT 'Short answer' AFTER isrequired");
      console.log("Added column question_type");
    } catch (e) {
      console.log("question_type:", e.message);
    }

    try {
      await pool.query("ALTER TABLE job_post_questions ADD COLUMN options JSON NULL AFTER question_type");
      console.log("Added column options");
    } catch (e) {
      console.log("options:", e.message);
    }

    const [cols] = await pool.query("DESCRIBE job_post_questions");
    console.log("Columns:", cols.map(c => `${c.Field} (${c.Type})`));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

migrate();
