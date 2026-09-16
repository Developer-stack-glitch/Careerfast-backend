const pool = require("../config/dbConfig");

async function createTables() {
    try {
        const professional = `
            CREATE TABLE IF NOT EXISTS user_professional (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT(20) NOT NULL,
                job_title VARCHAR(255),
                company_name VARCHAR(255),
                designation VARCHAR(255),
                start_date VARCHAR(50),
                end_date VARCHAR(50),
                currently_working TINYINT(1) DEFAULT 0,
                skills LONGTEXT,
                is_deleted TINYINT(1) DEFAULT 0
            );
        `;
        const projects = `
            CREATE TABLE IF NOT EXISTS user_projects (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT(20) NOT NULL,
                company_name VARCHAR(255),
                project_title VARCHAR(255),
                project_type VARCHAR(255),
                start_date VARCHAR(50),
                end_date VARCHAR(50),
                description TEXT,
                is_deleted TINYINT(1) DEFAULT 0
            );
        `;
        const links = `
            CREATE TABLE IF NOT EXISTS user_social_links (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT(20) NOT NULL,
                linkedin VARCHAR(255),
                facebook VARCHAR(255),
                instagram VARCHAR(255),
                twitter VARCHAR(255),
                dribble VARCHAR(255),
                behance VARCHAR(255)
            );
        `;
        
        await pool.query(professional);
        console.log("✅ user_professional created");
        
        await pool.query(projects);
        console.log("✅ user_projects created");
        
        await pool.query(links);
        console.log("✅ user_social_links created");
        
        process.exit(0);
    } catch (error) {
        console.error("❌ Error creating tables:", error);
        process.exit(1);
    }
}

createTables();
