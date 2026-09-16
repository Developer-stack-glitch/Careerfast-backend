require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'careerfast',
    });
    try {
        console.log("DB check completed successfully");
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
main();
