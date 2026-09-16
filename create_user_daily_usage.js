const pool = require("./config/dbConfig");

async function createDailyUsageTable() {
    try {
        console.log("Creating user_daily_usage table...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_daily_usage (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                usage_date DATE NOT NULL,
                created_at DATETIME NOT NULL,
                UNIQUE KEY unique_user_date (user_id, usage_date)
            )
        `);
        console.log("✅ Created user_daily_usage table");
    } catch (err) {
        console.error("❌ Table creation failed:", err);
    } finally {
        process.exit(0);
    }
}

createDailyUsageTable();
