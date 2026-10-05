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

      // ✅ Update last active timestamp
      await pool.query(`UPDATE users SET last_active = NOW() WHERE id = ?`, [
        result[0].id,
      ]).catch(err => console.error("⚠️ Failed to update last_active on login:", err.message));

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
    { expiresIn: "1d" } // Token expires in 1 hour
  );
};

module.exports = {
  login,
  dailyStreak,
  getDailyStreak,
  changePassword,
};
