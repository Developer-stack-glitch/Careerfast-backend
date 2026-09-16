require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'careerfast',
    });
    try {
        const queries = [
            "ALTER TABLE job_post ADD COLUMN role VARCHAR(255) DEFAULT NULL",
            "ALTER TABLE job_post ADD COLUMN industry VARCHAR(255) DEFAULT NULL",
            "ALTER TABLE job_post ADD COLUMN employment_type VARCHAR(255) DEFAULT NULL",
            "ALTER TABLE job_post ADD COLUMN willing_to_relocate BOOLEAN DEFAULT FALSE",
            "ALTER TABLE job_post ADD COLUMN hybrid_policy VARCHAR(255) DEFAULT NULL",
            "ALTER TABLE job_post ADD COLUMN educational_qualification JSON DEFAULT NULL",
            "ALTER TABLE job_post ADD COLUMN candidate_industry JSON DEFAULT NULL"
        ];
        
        for (const query of queries) {
            try {
                await pool.query(query);
                console.log(`Executed: ${query}`);
            } catch(e) {
                if (e.code === 'ER_DUP_FIELDNAME') {
                    console.log(`Skipped (already exists): ${query}`);
                } else {
                    console.error(`Error on query ${query}:`, e);
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
main();
