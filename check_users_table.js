const pool = require("./config/dbConfig");

async function checkUsersTable() {
    try {
        const [rows] = await pool.query("DESCRIBE users");
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkUsersTable();
