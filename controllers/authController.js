const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const pool = require("../config/dbConfig");

exports.googleLogin = async (req, res) => {
  try {
    const token = req.body?.token || req.body?.credential;
    const fcm_token = req.body?.fcm_token;
    const targetRoleId = req.body?.role_id ? parseInt(req.body.role_id, 10) : 2; // Default CANDIDATE (2)

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "No Google token received",
      });
    }

    const clientId = (
      process.env.GOOGLE_CLIENT_ID ||
      "288981358654-vrhl2uqu61r1ju40blnk4ibde6sbnu47.apps.googleusercontent.com"
    ).trim();

    const client = new OAuth2Client(clientId);

    // Verify Google ID token
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      console.error("⚠️ Google verifyIdToken error:", verifyErr.message);
      return res.status(401).json({
        success: false,
        message: "Invalid or expired Google token: " + verifyErr.message,
      });
    }

    if (!payload || !payload.email) {
      return res.status(400).json({
        success: false,
        message: "Google token did not contain an email address",
      });
    }

    const email = payload.email.toLowerCase().trim();
    const fullName = (payload.name || "").trim();
    const givenName = (payload.given_name || "").trim();
    const familyName = (payload.family_name || "").trim();
    const picture = payload.picture || null;

    // Resolve first & last names to fit varchar(50)
    let firstName = givenName;
    let lastName = familyName;
    if (!firstName) {
      const parts = fullName.split(/\s+/);
      firstName = parts[0] || (email.split("@")[0] || "Candidate");
      lastName = parts.slice(1).join(" ") || "";
    }
    if (!lastName && fullName.length > firstName.length) {
      lastName = fullName.slice(firstName.length).trim();
    }
    firstName = firstName.slice(0, 50);
    lastName = (lastName || "").slice(0, 50);

    // Check if user exists
    const [existingRows] = await pool.query(
      "SELECT * FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    let user;

    if (existingRows.length > 0) {
      user = existingRows[0];

      // Check if suspended
      const isSuspended =
        user.is_active === 0 ||
        (Buffer.isBuffer(user.is_active) && user.is_active[0] === 0);
      if (isSuspended) {
        return res.status(403).json({
          success: false,
          account_suspended: true,
          message:
            "Your account has been deactivated or suspended. Please contact support.",
        });
      }

      // Update profile image if user doesn't have one and Google provides one
      if (!user.profile_image && picture) {
        await pool
          .query("UPDATE users SET profile_image = ? WHERE id = ?", [
            picture,
            user.id,
          ])
          .catch(() => {});
        user.profile_image = picture;
      }

      // Update last active
      await pool
        .query("UPDATE users SET last_active = NOW() WHERE id = ?", [user.id])
        .catch(() => {});
    } else {
      // New user registration via Google (Candidate role)
      const insertQuery = `
        INSERT INTO users (
          role_id,
          first_name,
          last_name,
          phone_code,
          phone,
          email,
          password,
          profile_image,
          is_email_verified,
          is_active,
          allocated_seats,
          created_date,
          last_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 0, NOW(), NOW())
      `;

      const [insertResult] = await pool.query(insertQuery, [
        targetRoleId,
        firstName,
        lastName,
        "+91",
        "",
        email,
        "",
        picture,
      ]);

      const [newUserRows] = await pool.query(
        "SELECT * FROM users WHERE id = ?",
        [insertResult.insertId]
      );
      user = newUserRows[0];
    }

    // Save FCM token if provided
    if (fcm_token) {
      await pool
        .query("UPDATE users SET fcm_token = ? WHERE id = ?", [
          fcm_token,
          user.id,
        ])
        .catch(() => {});
      try {
        const admin = require("../config/firebase");
        await admin.messaging().subscribeToTopic(fcm_token, "allUsers");
      } catch (subErr) {
        console.warn("⚠️ FCM subscription failed:", subErr.message);
      }
    }

    // Check if user is a sub-recruiter
    try {
      const [subRows] = await pool.query(
        `SELECT sr.id, sr.main_recruiter_id, sr.designation, sr.role_preset, sr.permissions, sr.status,
                hp.company_name
         FROM sub_recruiters sr
         LEFT JOIN hr_profiles hp ON sr.main_recruiter_id = hp.user_id
         WHERE sr.sub_recruiter_id = ? AND sr.status = 'active'
         LIMIT 1`,
        [user.id]
      );
      if (subRows && subRows.length > 0) {
        let perms = subRows[0].permissions;
        if (typeof perms === "string") {
          try {
            perms = JSON.parse(perms);
          } catch (e) {
            perms = {};
          }
        }
        user.is_sub_recruiter = true;
        user.sub_recruiter_info = {
          id: subRows[0].id,
          main_recruiter_id: subRows[0].main_recruiter_id,
          company_name: subRows[0].company_name || user.organization || "Company",
          designation: subRows[0].designation || "Recruiter",
          role_preset: subRows[0].role_preset || "recruiter",
          permissions: perms,
        };
      } else {
        user.is_sub_recruiter = false;
      }
    } catch (subErr) {
      console.warn("⚠️ Sub-recruiter check skipped:", subErr.message);
    }

    // Generate JWT
    const jwtSecret =
      process.env.JWT_SECRET || "8f9c2d2f3a4b5c6d7e8f9g0h1i2j3k4l";
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role_id: user.role_id },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || "30d" }
    );

    return res.status(200).json({
      success: true,
      message: "Google login successful",
      token: accessToken,
      user,
      data: [user],
    });
  } catch (error) {
    console.error("❌ Google Login Fatal Error:", error);
    return res.status(500).json({
      success: false,
      message: "Google login failed: " + (error.message || "Unknown error"),
      details: error.message,
    });
  }
};

