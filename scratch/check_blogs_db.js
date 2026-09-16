const pool = require("../config/dbConfig");

async function checkBlogs() {
    try {
        const [rows] = await pool.execute("SELECT id, blogTitle, userId FROM blogs");
        console.log("Blogs in DB:");
        console.table(rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkBlogs();
