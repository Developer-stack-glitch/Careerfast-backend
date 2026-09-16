const db = require("../config/dbConfig");

async function checkCourses() {
    try {
        const [rows] = await db.query("SELECT id, title, description, slug, content FROM courses");
        console.log("Courses:", JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
checkCourses();
