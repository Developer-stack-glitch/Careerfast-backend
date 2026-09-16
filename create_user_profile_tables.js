const pool = require("./config/dbConfig");

async function createTables() {
    try {
        console.log("Creating user_address table...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_address (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                address1 TEXT,
                city VARCHAR(255),
                state VARCHAR(255),
                country VARCHAR(255),
                pincode VARCHAR(50),
                created_date DATETIME
            )
        `);
        console.log("✅ Created user_address table");

        console.log("Creating user_professional table...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_professional (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                job_title VARCHAR(255),
                company_name VARCHAR(255),
                designation VARCHAR(255),
                start_date VARCHAR(50),
                end_date VARCHAR(50),
                currently_working BOOLEAN
            )
        `);
        console.log("✅ Created user_professional table");

        console.log("Creating user_social_links table...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_social_links (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                linkedin VARCHAR(255),
                facebook VARCHAR(255),
                instagram VARCHAR(255),
                twitter VARCHAR(255),
                dribble VARCHAR(255),
                behance VARCHAR(255)
            )
        `);
        console.log("✅ Created user_social_links table");

    } catch (err) {
        console.error("❌ Table creation failed:", err);
    } finally {
        process.exit(0);
    }
}

createTables();
