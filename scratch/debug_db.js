const pool = require("../config/dbConfig");

async function debugQuery() {
  console.log("Starting debug query...");
  try {
    const start = Date.now();
    const [rows] = await pool.query("SELECT id, name FROM role WHERE is_active = 1");
    const end = Date.now();
    console.log(`Query successful! Took ${end - start}ms`);
    console.log("Rows:", rows);
  } catch (err) {
    console.error("Query failed:", err.message);
  } finally {
    process.exit();
  }
}

debugQuery();
