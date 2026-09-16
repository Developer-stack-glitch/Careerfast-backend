const pool = require("../config/dbConfig");

const WorkshopRegistrationModel = {
    // ✅ Register user for a workshop
    registerForWorkshop: async (data) => {
        try {
            const { userId, workshopId, userDetails } = data;

            // Check if already registered
            const [existing] = await pool.query(
                `SELECT * FROM workshop_registrations WHERE userId = ? AND workshopId = ?`,
                [userId, workshopId]
            );

            if (existing.length > 0) {
                throw new Error("Already registered for this workshop");
            }

            // Insert new registration
            const sql = `
        INSERT INTO workshop_registrations (userId, workshopId, userDetails, registeredAt)
        VALUES (?, ?, ?, NOW())
      `;

            const [result] = await pool.query(sql, [
                userId,
                workshopId,
                JSON.stringify(userDetails),
            ]);

            return { id: result.insertId, userId, workshopId };
        } catch (error) {
            console.error("❌ Error registering for workshop:", error);
            throw new Error(error.message);
        }
    },

    // ✅ Get all registered workshops for a user
    getUserRegisteredWorkshops: async (userId) => {
        try {
            const [rows] = await pool.query(
                `
        SELECT wr.*, w.title, w.category, w.mode, w.logo
        FROM workshop_registrations wr
        JOIN workshops w ON wr.workshopId = w.id
        WHERE wr.userId = ?
        ORDER BY wr.registeredAt DESC
        `,
                [userId]
            );
            return rows.map((r) => ({
                ...r,
                userDetails: r.userDetails ? JSON.parse(r.userDetails) : null,
            }));
        } catch (error) {
            console.error("❌ Error fetching registered workshops:", error);
            throw new Error(error.message);
        }
    },

    // ✅ Check if user already registered
    checkIsRegisteredWorkshop: async (userId, workshopId) => {
        try {
            const [rows] = await pool.query(
                `SELECT id FROM workshop_registrations WHERE userId = ? AND workshopId = ?`,
                [userId, workshopId]
            );
            return rows.length > 0;
        } catch (error) {
            console.error("❌ Error checking workshop registration:", error);
            throw new Error(error.message);
        }
    },
};

module.exports = WorkshopRegistrationModel;
