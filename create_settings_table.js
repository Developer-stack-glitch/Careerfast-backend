const pool = require('./config/dbConfig');

async function createTable() {
    try {
        const query = `
            CREATE TABLE IF NOT EXISTS settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                setting_key VARCHAR(255) NOT NULL UNIQUE,
                setting_value TEXT NOT NULL,
                setting_group VARCHAR(100) DEFAULT 'General',
                setting_type VARCHAR(50) DEFAULT 'text',
                label VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `;
        await pool.query(query);
        console.log("✅ Settings table created successfully.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Error creating table:", err);
        process.exit(1);
    }
}

createTable();
