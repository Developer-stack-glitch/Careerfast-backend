const pool = require("./config/dbConfig");

async function checkTable() {
    try {
        const [rows] = await pool.query("DESCRIBE skills");
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkTable();
