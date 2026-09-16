const pool = require("./config/dbConfig");

async function checkUsers() {
    try {
        const [rows] = await pool.query("SELECT id, first_name, email FROM users");
        console.log("Users in DB:", rows);
    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit(0);
    }
}

checkUsers();
