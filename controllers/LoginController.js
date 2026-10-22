const LoginModel = require("../models/LoginModel");
const { response, request } = require("express");
const jwt = require("jsonwebtoken");
const moment = require("moment-timezone");
const pool = require("../config/dbConfig.js"); // adjust path to your db.js file
const admin = require("../config/firebase");

const login = async (request, response) => {
  const { email, password, role_id, fcm_token } = request.body;

  try {
    if (!email || !password || !role_id) {
      return response.status(400).json({
        message: "Validation error",
        details: "Please provide email, password and role",
      });
    }

    const result = await LoginModel.login(email, password, role_id);

    if (result && result.length > 0) {
      const token = generateToken(result[0]);

      // ✅ Update last login and last active timestamp
      await pool.query(`UPDATE users SET last_login = NOW(), last_active = NOW() WHERE id = ?`, [
        result[0].id,
      ]).catch(err => console.error("⚠️ Failed to update last_login on login:", err.message));

      // ✅ Save FCM token in DB
      if (fcm_token) {
        await pool.query(`UPDATE users SET fcm_token = ? WHERE id = ?`, [
          fcm_token,
          result[0].id,
        ]);
        // ✅ Subscribe to "allUsers" topic
        try {
          await admin.messaging().subscribeToTopic(fcm_token, "allUsers");
          console.log(`✅ User ${result[0].id} subscribed to 'allUsers' topic on login`);
        } catch (subError) {
          console.error("⚠️ Failed to subscribe to topic on login:", subError.message);
        }
      }

      // ✅ Check if user is a sub-recruiter
      try {
        const [subRows] = await pool.query(
          `SELECT sr.id, sr.main_recruiter_id, sr.designation, sr.role_preset, sr.permissions, sr.status,
                  hp.company_name
           FROM sub_recruiters sr
           LEFT JOIN hr_profiles hp ON sr.main_recruiter_id = hp.user_id
           WHERE sr.sub_recruiter_id = ? AND sr.status = 'active'
           LIMIT 1`,
          [result[0].id]
        );
        if (subRows && subRows.length > 0) {
          let perms = subRows[0].permissions;
          if (typeof perms === 'string') {
            try { perms = JSON.parse(perms); } catch (e) { perms = {}; }
          }
          result[0].is_sub_recruiter = true;
          result[0].sub_recruiter_info = {
            id: subRows[0].id,
            main_recruiter_id: subRows[0].main_recruiter_id,
            company_name: subRows[0].company_name || result[0].organization || 'Company',
            designation: subRows[0].designation || 'Recruiter',
            role_preset: subRows[0].role_preset || 'recruiter',
            permissions: perms
          };
        } else {
          result[0].is_sub_recruiter = false;
        }
      } catch (subErr) {
        console.warn("⚠️ Failed to check sub-recruiter on login:", subErr.message);
      }

      return response.status(200).json({
        message: "Login successful",
        token: token,
        data: result,
      });
    } else {
      throw new Error("Invalid username or password");
    }
  } catch (error) {
    const isSuspended = error.message && error.message.toLowerCase().includes("suspended");
    response.status(isSuspended ? 403 : 500).json({
      message: error.message || "Error while login",
      details: error.message,
      account_suspended: isSuspended,
    });
  }
};

// controller
const dailyStreak = async (req, res) => {
  const { user_id } = req.body;
  try {
    await LoginModel.dailyStreak(user_id); // insert today's usage
    const streakData = await LoginModel.getDailyStreak(user_id);

    return res.status(200).json({
      message: "Streak data fetched successfully",
      history: streakData.daily_log,
      currentStreak: streakData.currentStreak,
      maxStreak: streakData.maxStreak,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error while fetching streak",
      details: error.message,
    });
  }
};


const getDailyStreak = async (request, response) => {
  const { user_id } = request.query;
  try {
    const streaks = await LoginModel.getDailyStreak(user_id);
    return response.status(200).json({
      message: "User streaks fetched successfully",
      data: streaks,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while fetching user streaks",
      details: error.message,
    });
  }
};

const changePassword = async (request, response) => {
  const { user_id, currentPassword, newPassword } = request.body;
  try {
    const result = await LoginModel.changePassword(
      user_id,
      currentPassword,
      newPassword
    );
    return response.status(200).json({
      message: "Password changed successfully",
      data: result,
    });
  } catch (error) {
    response.status(500).json({
      message: "Error while changing password",
      details: error.message,
    });
  }
};

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email }, //Payload
    process.env.JWT_SECRET, // Secret
    { expiresIn: process.env.JWT_EXPIRES_IN || "30d" } // Extended session expiration (30 days)
  );
};

const crypto = require("crypto");
const nodemailer = require("nodemailer");

// In-memory OTP storage for login (keyed by type:identifier)
const loginOtpStorage = new Map();

const transporter = nodemailer.createTransport({
  service: process.env.SMTP_HOST || "gmail",
  auth: {
    user: process.env.SMTP_USER || process.env.SMTP_FROM || "careerfastcontact@gmail.com",
    pass: process.env.SMTP_PASS || "mjzp tqcj gxld yqme",
  },
});

const sendLoginOTP = async (req, res) => {
  try {
    const { identifier, type, role_id } = req.body;
    if (!identifier) {
      return res.status(400).json({ message: "Email or phone number is required" });
    }

    const cleanType = (type || (identifier.includes("@") ? "email" : "phone")).toLowerCase();
    let user = null;

    if (cleanType === "email") {
      const cleanEmail = identifier.trim().toLowerCase();
      const [rows] = await pool.query(
        `SELECT id, first_name, last_name, email, phone, role_id, is_active FROM users WHERE email = ?`,
        [cleanEmail]
      );
      if (!rows || rows.length === 0) {
        return res.status(404).json({ message: "No account found with this email address. Please register first." });
      }
      user = rows[0];
    } else {
      // Phone number: normalize to last 10 digits
      const digitsOnly = identifier.replace(/\D/g, "");
      const cleanPhone = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;
      if (cleanPhone.length < 10) {
        return res.status(400).json({ message: "Please enter a valid 10-digit mobile number." });
      }

      const [rows] = await pool.query(
        `SELECT id, first_name, last_name, email, phone, role_id, is_active FROM users WHERE phone = ? OR phone LIKE ?`,
        [cleanPhone, `%${cleanPhone}`]
      );
      if (!rows || rows.length === 0) {
        return res.status(404).json({ message: "No account found with this mobile number. Please register first." });
      }
      user = rows[0];
    }

    // Role check if specified
    if (role_id && user.role_id !== 1 && user.role_id != role_id) {
      return res.status(403).json({ message: "This account is not authorized to log in as a candidate." });
    }

    // Check if account active
    const isUserActive = (val) => {
      if (val === null || val === undefined) return false;
      if (Buffer.isBuffer(val)) return val[0] === 1;
      return Number(val) === 1 || val === true || val === '1';
    };
    if (!isUserActive(user.is_active)) {
      return res.status(403).json({ message: "Your account has been suspended. Please contact support." });
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const storageKey = `${cleanType}:${cleanType === "email" ? user.email.toLowerCase() : user.phone.slice(-10)}`;

    loginOtpStorage.set(storageKey, {
      otp,
      userId: user.id,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    });

    console.log(`🔑 [Login OTP] Generated OTP ${otp} for key ${storageKey} (User: ${user.email}, Phone: ${user.phone})`);

    // Always attempt email notification if user has email
    if (user.email) {
      try {
        const mailOptions = {
          from: `"CareerFast Security" <${process.env.SMTP_FROM || process.env.SMTP_USER || 'careerfastcontact@gmail.com'}>`,
          to: user.email,
          subject: "Your CareerFast Login OTP",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
              <h2 style="color: #4f46e5; margin-top: 0;">CareerFast Login Verification</h2>
              <p style="font-size: 15px; color: #334155;">Hello <strong>${user.first_name || 'Candidate'}</strong>,</p>
              <p style="font-size: 14px; color: #475569;">Use the following 6-digit One-Time Password (OTP) to securely sign in to your CareerFast account:</p>
              <div style="margin: 24px 0; text-align: center;">
                <span style="display: inline-block; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #4f46e5; background: #f5f3ff; border: 1px solid #c7d2fe; padding: 12px 28px; border-radius: 10px;">
                  ${otp}
                </span>
              </div>
              <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">This code is valid for 5 minutes. If you did not request this login, please ignore this email.</p>
            </div>
          `,
        };
        await transporter.sendMail(mailOptions);
        console.log(`✅ [Login OTP] Email sent successfully to ${user.email}`);
      } catch (mailErr) {
        console.warn(`⚠️ [Login OTP] Could not send email:`, mailErr.message);
      }
    }

    const recipientLabel = cleanType === "email" ? user.email : `+91 ${user.phone.slice(-10)}`;
    return res.status(200).json({
      success: true,
      message: `OTP sent successfully to ${recipientLabel}`,
      dev_otp: otp,
      target: recipientLabel,
    });
  } catch (err) {
    console.error("sendLoginOTP error:", err);
    return res.status(500).json({ message: err.message || "Failed to send OTP" });
  }
};

const verifyLoginOTP = async (req, res) => {
  try {
    const { identifier, type, otp, role_id, fcm_token } = req.body;
    if (!identifier || !otp) {
      return res.status(400).json({ message: "Identifier and OTP are required" });
    }

    const cleanType = (type || (identifier.includes("@") ? "email" : "phone")).toLowerCase();
    const cleanId = cleanType === "email" ? identifier.trim().toLowerCase() : identifier.replace(/\D/g, "").slice(-10);
    const storageKey = `${cleanType}:${cleanId}`;

    const storedData = loginOtpStorage.get(storageKey);
    if (!storedData) {
      return res.status(400).json({ message: "OTP expired or not found. Please request a new OTP." });
    }

    if (Date.now() > storedData.expiresAt) {
      loginOtpStorage.delete(storageKey);
      return res.status(400).json({ message: "OTP has expired. Please request a new code." });
    }

    if (storedData.otp !== otp.trim()) {
      return res.status(400).json({ message: "Invalid OTP. Please check the code and try again." });
    }

    // OTP is valid! Remove from memory so it can't be reused
    loginOtpStorage.delete(storageKey);

    // Fetch full user record
    const [result] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.phone_code, u.phone, u.email, u.password, u.organization, o.name AS organization_type, u.is_active, u.role_id, r.name AS role_name, COALESCE(h.profile_image, u.profile_image) AS profile_image, CASE WHEN u.is_email_verified = 1 THEN 1 ELSE 0 END AS is_email_verified,
       COALESCE(ap.is_super_admin, CASE WHEN u.id = 1 THEN 1 ELSE 0 END) AS is_super_admin,
       COALESCE(ap.role_title, 'Administrator') AS admin_role_title,
       COALESCE(ap.department, 'Management') AS admin_department,
       ap.permissions AS admin_permissions
       FROM users AS u 
       INNER JOIN role AS r ON u.role_id = r.id 
       LEFT JOIN organization_type o ON u.organization_type_id = o.id 
       LEFT JOIN hr_profiles h ON u.id = h.user_id
       LEFT JOIN admin_permissions ap ON u.id = ap.user_id
       WHERE u.id = ?`,
      [storedData.userId]
    );

    if (!result || result.length === 0) {
      return res.status(404).json({ message: "User account not found" });
    }

    const user = result[0];
    const token = generateToken(user);

    // Update last_login & last_active
    await pool.query(`UPDATE users SET last_login = NOW(), last_active = NOW() WHERE id = ?`, [user.id]).catch(() => {});

    // Save FCM token if provided
    if (fcm_token) {
      await pool.query(`UPDATE users SET fcm_token = ? WHERE id = ?`, [fcm_token, user.id]).catch(() => {});
      try {
        await admin.messaging().subscribeToTopic(fcm_token, "allUsers");
      } catch (e) {}
    }

    // Check sub-recruiter
    try {
      const [subRows] = await pool.query(
        `SELECT sr.id, sr.main_recruiter_id, sr.designation, sr.role_preset, sr.permissions, sr.status, hp.company_name
         FROM sub_recruiters sr
         LEFT JOIN hr_profiles hp ON sr.main_recruiter_id = hp.user_id
         WHERE sr.sub_recruiter_id = ? AND sr.status = 'active'
         LIMIT 1`,
        [user.id]
      );
      if (subRows && subRows.length > 0) {
        let perms = subRows[0].permissions;
        if (typeof perms === 'string') {
          try { perms = JSON.parse(perms); } catch (e) { perms = {}; }
        }
        user.is_sub_recruiter = true;
        user.sub_recruiter_info = {
          id: subRows[0].id,
          main_recruiter_id: subRows[0].main_recruiter_id,
          company_name: subRows[0].company_name || user.organization || 'Company',
          designation: subRows[0].designation || 'Recruiter',
          role_preset: subRows[0].role_preset || 'recruiter',
          permissions: perms
        };
      } else {
        user.is_sub_recruiter = false;
      }
    } catch (e) {}

    return res.status(200).json({
      message: "Login successful",
      token: token,
      data: [user],
    });
  } catch (err) {
    console.error("verifyLoginOTP error:", err);
    return res.status(500).json({ message: err.message || "Failed to verify OTP" });
  }
};

module.exports = {
  login,
  dailyStreak,
  getDailyStreak,
  changePassword,
  sendLoginOTP,
  verifyLoginOTP,
};
