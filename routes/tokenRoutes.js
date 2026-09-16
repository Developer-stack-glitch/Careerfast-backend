// routes/tokenRoutes.js
const express = require("express");
const router = express.Router();
const pool = require("../config/dbConfig");
const admin = require("../config/firebase");

// 🔹 Save or update FCM token for a user
router.post("/save-token", async (req, res) => {
    const { userId, token } = req.body;

    if (!userId || !token) {
        return res.status(400).json({ error: "Missing userId or token" });
    }

    try {
        // Check if token is already the same
        const [rows] = await pool.query(
            "SELECT fcm_token FROM users WHERE id = ?",
            [userId]
        );

        if (rows.length && rows[0].fcm_token === token) {
            console.log("Token matches, skipping DB update.");
        } else {
            // Update token
            await pool.query("UPDATE users SET fcm_token = ? WHERE id = ?", [
                token,
                userId,
            ]);
        }


        // ✅ Subscribe to "allUsers" topic
        await admin.messaging().subscribeToTopic(token, "allUsers");
        console.log(`✅ User ${userId} subscribed to 'allUsers' topic`);

        res.json({ success: true, message: "Token saved and subscribed" });
    } catch (err) {
        console.error("❌ Error saving token:", err);
        res.status(500).json({ error: "Failed to save token" });
    }
});

module.exports = router;
