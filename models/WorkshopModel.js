const pool = require("../config/dbConfig");

const WorkshopModel = {
    createWorkshop: async (data) => {
        try {
            const {
                logo = null,
                title = "",
                type = "", // 👈 add
                category = "",
                about = "",
                mode = "",
                participationType = "",
                memberLimit = null,
                eligibility = [],
                startDate = null,
                endDate = null,
                venue = "",
                organizer = "",
                contactEmail = "",
                contactNumber = "",
                registrationLink = "",
            } = data;

            const sql = `
INSERT INTO workshops 
(logo, title, type, category, about, mode, participationType, memberLimit, eligibility, startDate, endDate, venue, organizer, contactEmail, contactNumber, registrationLink)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

            const [result] = await pool.query(sql, [
                logo || null,
                typeof title === "string" ? title.trim() : JSON.stringify(title),
                typeof type === "string" ? type.trim() : JSON.stringify(type), // 👈 add
                Array.isArray(category) ? category.join(", ") : category,
                about || null,
                typeof mode === "string" ? mode.trim() : JSON.stringify(mode),
                typeof participationType === "string" ? participationType.trim() : JSON.stringify(participationType),
                memberLimit || null,
                JSON.stringify(eligibility || []),
                startDate && startDate !== "" ? startDate : null,
                endDate && endDate !== "" ? endDate : null,
                typeof venue === "string" ? venue.trim() : null,
                typeof organizer === "string" ? organizer.trim() : null,
                typeof contactEmail === "string" ? contactEmail.trim() : null,
                typeof contactNumber === "string" ? contactNumber.trim() : null,
                typeof registrationLink === "string" ? registrationLink.trim() : null,
            ]);


            return result.insertId;
        } catch (error) {
            console.error("❌ Error creating workshop:", error);
            throw new Error(error.message);
        }
    },

    getAllWorkshops: async () => {
        try {
            const [rows] = await pool.query(`SELECT * FROM workshops ORDER BY id DESC`);
            return rows.map((w) => ({
                ...w,
                eligibility: w.eligibility ? JSON.parse(w.eligibility) : [],
            }));
        } catch (error) {
            console.error("❌ Error fetching workshops:", error);
            throw new Error(error.message);
        }
    },

    deleteWorkshop: async (id) => {
        try {
            const [result] = await pool.query(`DELETE FROM workshops WHERE id = ?`, [id]);
            return result.affectedRows;
        } catch (error) {
            console.error("❌ Error deleting workshop:", error);
            throw new Error(error.message);
        }
    },
};

module.exports = WorkshopModel;
