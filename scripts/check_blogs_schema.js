const pool = require("../config/dbConfig");

const checkSchema = async () => {
    try {
        const connection = await pool.getConnection();
        const [columns] = await connection.query(`SHOW COLUMNS FROM blogs`);
        console.log("Columns in blogs table:", columns.map(c => c.Field));
        connection.release();
        process.exit(0);
    } catch (error) {
        console.error("Failed to check schema:", error);
        process.exit(1);
    }
};

checkSchema();
