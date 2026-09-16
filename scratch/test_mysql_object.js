const pool = require("../config/dbConfig");

async function test() {
    try {
        const company_logo = { src: "test_path" };
        const query = "INSERT INTO job_post (user_id, company_name, company_logo, job_title) VALUES (?, ?, ?, ?)";
        const values = [1, "Test Company", company_logo, "Test Job"];
        
        console.log("Running query with object...");
        const [result] = await pool.query(query, values);
        console.log("Success!", result);
        process.exit(0);
    } catch (err) {
        console.error("❌ Error caught:", err);
        process.exit(1);
    }
}

test();
