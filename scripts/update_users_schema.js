const pool = require("../config/dbConfig");

const updateSchema = async () => {
    try {
        const connection = await pool.getConnection();
        console.log("Checking schema...");

        const [columns] = await connection.query(`SHOW COLUMNS FROM users LIKE 'banner_color'`);
        if (columns.length === 0) {
            console.log("Adding banner_color column...");
            await connection.query(`ALTER TABLE users ADD COLUMN banner_color VARCHAR(50) DEFAULT NULL`);
        } else {
            console.log("banner_color column already exists.");
        }

        const [imgColumns] = await connection.query(`SHOW COLUMNS FROM users LIKE 'banner_image'`);
        if (imgColumns.length === 0) {
            console.log("Adding banner_image column...");
            await connection.query(`ALTER TABLE users ADD COLUMN banner_image LONGTEXT DEFAULT NULL`);
        } else {
            console.log("banner_image column already exists.");
        }

        connection.release();
        console.log("Schema check complete.");
        process.exit(0);
    } catch (error) {
        console.error("Schema update failed:", error);
        process.exit(1);
    }
};

updateSchema();
