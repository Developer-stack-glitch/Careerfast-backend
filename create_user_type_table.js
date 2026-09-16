const pool = require("./config/dbConfig");

async function createUserTypeTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_type (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(255) NOT NULL,
                is_deleted TINYINT(1) DEFAULT 0
            )
        `);
        console.log("Created user_type table");

        // check if data exists
        const [rows] = await pool.query(`SELECT * FROM user_type`);
        if (rows.length === 0) {
            await pool.query(`
                INSERT INTO user_type (id, name, is_deleted) VALUES
                (1, 'College Student', 0),
                (2, 'Professional', 0),
                (3, 'School Student', 0),
                (4, 'Fresher', 0)
            `);
            console.log("Inserted user types");
        } else {
            console.log("User types already exist");
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit(0);
    }
}

createUserTypeTable();
