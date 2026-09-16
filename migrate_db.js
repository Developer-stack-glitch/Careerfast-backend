const pool = require("./config/dbConfig");

async function migrate() {
    try {
        console.log("Starting migration...");
        
        // Add content column
        await pool.query("ALTER TABLE courses ADD COLUMN IF NOT EXISTS content LONGTEXT");
        console.log("✅ Added content column");

        // Add slug column
        await pool.query("ALTER TABLE courses ADD COLUMN IF NOT EXISTS slug VARCHAR(255) UNIQUE");
        console.log("✅ Added slug column");

        // Add category column
        await pool.query("ALTER TABLE courses ADD COLUMN IF NOT EXISTS category VARCHAR(100)");
        console.log("✅ Added category column");

        process.exit(0);
    } catch (err) {
        console.error("❌ Migration failed:", err);
        process.exit(1);
    }
}

migrate();
