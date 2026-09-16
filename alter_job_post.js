const pool = require("./config/dbConfig");

async function alterTable() {
    try {
        await pool.query(`
            ALTER TABLE job_post
            ADD COLUMN stipend_type VARCHAR(50) DEFAULT NULL,
            ADD COLUMN stipend_amount VARCHAR(100) DEFAULT NULL,
            ADD COLUMN internship_start_type VARCHAR(50) DEFAULT NULL,
            ADD COLUMN internship_start_date DATE DEFAULT NULL,
            ADD COLUMN last_date_to_apply DATE DEFAULT NULL
        `);
        console.log("✅ job_post table altered successfully!");
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log("⚠️ Fields already exist.");
        } else {
            console.error(e);
        }
    } finally {
        process.exit(0);
    }
}
alterTable();
