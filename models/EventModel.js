const pool = require("../config/dbConfig");

const EventModel = {
    // ✅ Create a new event
    createEvent: async (data) => {
        try {
            const {
                logo = null,
                title = "",
                type = "",
                category = "",
                about = "",
                mode = "",
                participationType = "",
                memberLimit = null,
                eligibility = [],
                winnerPrize = "",
                runnerPrize = "",
            } = data;

            const sql = `
        INSERT INTO events 
        (logo, title, type, category, about, mode, participationType, memberLimit, eligibility, winnerPrize, runnerPrize)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

            const [result] = await pool.query(sql, [
                logo,
                title,
                type,
                category,
                about,
                mode,
                participationType,
                memberLimit,
                JSON.stringify(eligibility),
                winnerPrize,
                runnerPrize,
            ]);

            return result.insertId;
        } catch (error) {
            console.error("❌ Error creating event:", error);
            throw new Error(error.message);
        }
    },

    // ✅ Get all events (parse eligibility JSON safely)
    getAllEvents: async () => {
        try {
            const [rows] = await pool.query(`SELECT * FROM events ORDER BY id DESC`);
            return rows.map((event) => ({
                ...event,
                eligibility: event.eligibility ? JSON.parse(event.eligibility) : [],
            }));
        } catch (error) {
            console.error("❌ Error fetching events:", error);
            throw new Error(error.message);
        }
    },

    // ✅ Delete an event by ID
    deleteEvent: async (id) => {
        try {
            const [result] = await pool.query(`DELETE FROM events WHERE id = ?`, [id]);
            return result.affectedRows;
        } catch (error) {
            console.error("❌ Error deleting event:", error);
            throw new Error(error.message);
        }
    },
};

module.exports = EventModel;
