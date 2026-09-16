const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const pool = require("../config/dbConfig");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.googleLogin = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ message: "No token received" });
        }

        // Verify Google token
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const { email, name, picture } = payload;

        // Check if user exists
        const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);

        let user;
        if (rows.length === 0) {
            // Insert new user
            const [result] = await pool.query(
                "INSERT INTO users (name, email, picture, provider) VALUES (?, ?, ?, ?)",
                [name, email, picture, "google"]
            );
            user = { id: result.insertId, name, email, picture, provider: "google" };
        } else {
            user = rows[0];
        }

        // Update last active
        await pool.query("UPDATE users SET last_active = NOW() WHERE id = ?", [user.id]).catch(() => {});

        // Create JWT
        const accessToken = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            success: true,
            token: accessToken,
            user,
        });
    } catch (error) {
        console.error("Google Login Error:", error);
        res.status(500).json({ message: "Google login failed" });
    }
};
