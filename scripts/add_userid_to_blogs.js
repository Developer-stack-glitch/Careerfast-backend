const pool = require("../config/dbConfig");

const updateSchema = async () => {
    try {
        const connection = await pool.getConnection();
        console.log("Checking for userId in blogs table...");

        const [columns] = await connection.query(`SHOW COLUMNS FROM blogs LIKE 'userId'`);
        if (columns.length === 0) {
            console.log("Adding userId column to blogs table...");
            await connection.query(`ALTER TABLE blogs ADD COLUMN userId INT DEFAULT NULL`);
            console.log("Column added successfully.");
        } else {
            console.log("userId column already exists.");
        }

        connection.release();
        process.exit(0);
    } catch (error) {
        console.error("Schema update failed:", error);
        process.exit(1);
    }
};

updateSchema();
