const pool = require("../config/dbConfig");

const createTable = async () => {
    try {
        const query = `
            CREATE TABLE IF NOT EXISTS hr_saved_candidates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                recruiter_id INT NOT NULL,
                candidate_id INT NOT NULL,
                applied_jobs_id INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_saved (recruiter_id, candidate_id, applied_jobs_id)
            )
        `;
        await pool.query(query);
        console.log("hr_saved_candidates table created successfully.");
        process.exit(0);
    } catch (error) {
        console.error("Error creating table:", error);
        process.exit(1);
    }
};

createTable();
