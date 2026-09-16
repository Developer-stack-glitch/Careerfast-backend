const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 25,
  connectTimeout: 60000, // Increase timeout to 60 seconds
  // acquireTimeout: 60000, // Increase acquire timeout
  queueLimit: 0,
  // timezone: "Asia/Kolkata",
  dateStrings: true, // prevents JS from converting DATETIME to UTC
});

module.exports = pool;

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("✅ Connected to MySQL successfully!");
    connection.release(); // Release the connection back to the pool
  } catch (err) {
    console.error("❌ MySQL connection error:", err.message);
  }
}
testConnection();
