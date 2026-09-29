const db = require("../config/dbConfig");
let coursesCache = new Map();
const COURSES_CACHE_TTL = 5 * 60 * 1000;

const CourseModel = {
    create: async (title, description, link, imageBase64, content, slug, category) => {
        coursesCache.clear();
        const sql =
            "INSERT INTO courses (title, description, link, image, content, slug, category) VALUES (?, ?, ?, ?, ?, ?, ?)";
        try {
            const params = [title, description, link, imageBase64, content, slug, category]
                .map(p => p === undefined ? null : p);
            
            const [result] = await db.execute(sql, params);
            return { success: true, message: "Course added successfully", result };
        } catch (error) {
            console.error("DB Error:", error);
            return { success: false, message: "Database error: " + error.message };
        }
    },

    getAll: async (limit) => {
        try {
            const cacheKey = `limit_${limit || 'all'}`;
            const cached = coursesCache.get(cacheKey);
            const now = Date.now();
            if (cached && (now - cached.time < COURSES_CACHE_TTL)) {
                return { success: true, data: cached.data };
            }

            let sql = "SELECT id, title, description, link, image, content, slug, category, created_at FROM courses ORDER BY id DESC";
            const params = [];
            if (limit && !isNaN(limit)) {
                sql += " LIMIT ?";
                params.push(limit);
            }
            const [rows] = await db.query(sql, params);
            coursesCache.set(cacheKey, { data: rows, time: now });
            return { success: true, data: rows };
        } catch (error) {
            console.error("DB Error:", error);
            return { success: false, message: "Failed to fetch courses" };
        }
    },

    getBySlug: async (slug) => {
        try {
            const [rows] = await db.execute("SELECT * FROM courses WHERE slug = ?", [slug || null]);
            if (rows.length === 0) return { success: false, message: "Course not found" };
            return { success: true, data: rows[0] };
        } catch (error) {
            console.error("DB Error:", error);
            return { success: false, message: "Failed to fetch course" };
        }
    },

    update: async (id, title, description, link, imageBase64, content, slug, category) => {
        const sql =
            "UPDATE courses SET title=?, description=?, link=?, image=?, content=?, slug=?, category=? WHERE id=?";
        try {
            const params = [title, description, link, imageBase64, content, slug, category, id]
                .map(p => p === undefined ? null : p);

            const [result] = await db.execute(sql, params);
            return { success: true, message: "Course updated successfully", result };
        } catch (error) {
            console.error("DB Error:", error);
            return { success: false, message: "Database error: " + error.message };
        }
    },

    deleteById: async (id) => {
        try {
            const [result] = await db.execute("DELETE FROM courses WHERE id = ?", [id]);
            return { success: true, message: "Course deleted successfully", result };
        } catch (error) {
            console.error("DB Error:", error);
            return { success: false, message: "Failed to delete course" };
        }
    },
};

module.exports = CourseModel;
