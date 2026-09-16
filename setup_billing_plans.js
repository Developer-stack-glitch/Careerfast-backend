const pool = require("./config/dbConfig");

async function setupBillingPlansTable() {
    try {
        console.log("Setting up billing_plans table...");
        
        // 1. Create table
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS billing_plans (
                id INT AUTO_INCREMENT PRIMARY KEY,
                plan_id VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                monthly_price INT NOT NULL,
                annual_price INT NOT NULL,
                icon VARCHAR(50),
                color VARCHAR(50),
                is_active BOOLEAN DEFAULT 1
            );
        `;
        await pool.query(createTableQuery);
        console.log("✅ Table created or already exists.");

        // 2. Check if data exists
        const [rows] = await pool.query(`SELECT COUNT(*) as count FROM billing_plans`);
        if (rows[0].count === 0) {
            // Seed initial data
            const seedQuery = `
                INSERT INTO billing_plans (plan_id, name, description, monthly_price, annual_price, icon, color, is_active)
                VALUES 
                ('basic', 'Basic Posting', 'Perfect for hiring entry-level candidates quickly.', 999, 9990, 'Briefcase', 'blue', 1),
                ('premium', 'Premium (Hot Vacancy)', 'Maximize visibility to hire top talent faster.', 2499, 24990, 'Star', 'amber', 1),
                ('bulk', 'Bulk Posting', 'Best for growing companies with multiple openings.', 8999, 89990, 'Zap', 'purple', 1);
            `;
            await pool.query(seedQuery);
            console.log("✅ Seeded initial billing plans.");
        } else {
            console.log("ℹ️ Table already has data. Skipping seed.");
        }
        
        console.log("🎉 Setup complete!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error setting up table:", error);
        process.exit(1);
    }
}

setupBillingPlansTable();
