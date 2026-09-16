const pool = require("./config/dbConfig");

async function describeTable() {
    try {
        const [rows] = await pool.query("DESCRIBE job_post");
        console.log(JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
describeTable();
