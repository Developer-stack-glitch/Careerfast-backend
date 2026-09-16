const pool = require("./config/dbConfig");

async function checkRoleTable() {
    try {
        const [rows] = await pool.query("SELECT * FROM role");
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkRoleTable();
