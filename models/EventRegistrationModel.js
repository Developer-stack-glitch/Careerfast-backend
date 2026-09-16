const pool = require("../config/dbConfig");

const EventRegistrationModel = {
    // ✅ Register user for event
    registerForEvent: async (data) => {
        try {
            const { userId, eventId, userDetails } = data;

            // Check if already registered
            const [existing] = await pool.query(
                `SELECT * FROM event_registrations WHERE userId = ? AND eventId = ?`,
                [userId, eventId]
            );

            if (existing.length > 0) {
                throw new Error("Already registered for this event");
            }

            const sql = `
        INSERT INTO event_registrations (userId, eventId, userDetails, registeredAt)
        VALUES (?, ?, ?, NOW())
      `;

            const [result] = await pool.query(sql, [
                userId,
                eventId,
                JSON.stringify(userDetails),
            ]);

            return { id: result.insertId, userId, eventId };
        } catch (error) {
            console.error("❌ Error registering for event:", error);
            throw new Error(error.message);
        }
    },

    // ✅ Get all user registrations
    getUserRegistrations: async (userId) => {
        try {
            const [rows] = await pool.query(
                `
        SELECT er.*, e.title, e.category, e.mode, e.logo
        FROM event_registrations er
        JOIN events e ON er.eventId = e.id
        WHERE er.userId = ?
        ORDER BY er.registeredAt DESC
        `,
                [userId]
            );
            return rows.map((r) => ({
                ...r,
                userDetails: r.userDetails ? JSON.parse(r.userDetails) : null,
            }));
        } catch (error) {
            console.error("❌ Error fetching registrations:", error);
            throw new Error(error.message);
        }
    },

    // ✅ Check if already registered
    checkIsRegistered: async (userId, eventId) => {
        try {
            const [rows] = await pool.query(
                `SELECT id FROM event_registrations WHERE userId = ? AND eventId = ?`,
                [userId, eventId]
            );
            return rows.length > 0;
        } catch (error) {
            console.error("❌ Error checking registration:", error);
            throw new Error(error.message);
        }
    },
};

module.exports = EventRegistrationModel;
