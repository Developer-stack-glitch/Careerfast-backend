const pool = require("../config/dbConfig");

async function createTable() {
    try {
        const query = `
            CREATE TABLE IF NOT EXISTS user_education (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT(20) NOT NULL,
                qualification VARCHAR(255),
                course VARCHAR(255),
                specialization VARCHAR(255),
                college VARCHAR(255),
                start_date VARCHAR(50),
                end_date VARCHAR(50),
                course_type VARCHAR(255),
                percentage VARCHAR(50),
                cgpa VARCHAR(50),
                roll_number VARCHAR(100),
                lateral_entry TINYINT(1) DEFAULT 0,
                is_deleted TINYINT(1) DEFAULT 0
            );
        `;
        await pool.query(query);
        console.log("✅ user_education created");
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}
createTable();
