const pool = require("../config/dbConfig");

async function test() {
    try {
        let company_logo = { src: "test_path_fixed" };
        
        // Simulating the fix in controller
        if (company_logo && typeof company_logo === "object") {
            company_logo = company_logo.src || (company_logo.default && company_logo.default.src) || JSON.stringify(company_logo);
        }

        const query = "INSERT INTO job_post (user_id, company_name, company_logo, job_title) VALUES (?, ?, ?, ?)";
        const values = [1, "Test Company Fixed", company_logo, "Test Job Fixed"];
        
        console.log("Running query with fixed company_logo (string)...");
        const [result] = await pool.query(query, values);
        console.log("Success!", result);
        process.exit(0);
    } catch (err) {
        console.error("❌ Error caught:", err);
        process.exit(1);
    }
}

test();
