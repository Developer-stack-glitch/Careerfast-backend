const pool = require("./dbConfig"); // relative path to dbConfig.js

async function checkDB() {
    try {
        const [rows] = await pool.query("SELECT DATABASE() AS db");
        console.log("✅ Connected to DB:", rows[0].db);

        const [tables] = await pool.query("SHOW TABLES");
        console.log("📂 Tables in DB:", tables.map(t => Object.values(t)[0]));
    } catch (err) {
        console.error("❌ MySQL error:", err.message);
    }
}

checkDB();
