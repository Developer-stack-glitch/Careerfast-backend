const pool = require("../config/dbConfig");
const bcrypt = require("bcrypt");
const moment = require("moment-timezone");

const LoginModel = {
  login: async (email, password, role_id) => {
    try {
      const [checkRole] = await pool.query(
        `SELECT role_id FROM users WHERE email = ?`,
        [email]
      );
      if (!checkRole || checkRole.length === 0) {
        throw new Error("Invalid email and password");
      }

      // If logging in via superadmin portal (role_id: 1), strictly allow ONLY superadmin (role_id: 1)
      if (role_id == 1) {
        if (checkRole[0].role_id !== 1) {
          throw new Error("Access denied. Only Superadmins are authorized to login here.");
        }
      } else if (role_id == 3) {
        if (checkRole[0].role_id !== 3) {
          throw new Error("Invalid email and password");
        }
      } else if (checkRole[0].role_id !== 1 && role_id != checkRole[0].role_id) {
        throw new Error("You are not allowed to login");
      }

      const query = `SELECT id, password, is_active FROM users WHERE email = ?`;
      const [isExists] = await pool.query(query, [email]);
      if (isExists.length == 0) throw new Error("Invalid email and password");
      const isMatch = await verifyPassword(password, isExists[0].password);
      if (!isMatch) throw new Error("Invalid email and password");
      const isUserActive = (val) => {
        if (val === null || val === undefined) return false;
        if (Buffer.isBuffer(val)) return val[0] === 1;
        return Number(val) === 1 || val === true || val === '1';
      };

      if (!isUserActive(isExists[0].is_active)) {
        throw new Error("Your recruiter account has been suspended. Please contact the administrator.");
      }
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
        isExists[0].id
      );

      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  dailyStreak: async (user_id) => {
    try {
      const now = moment().tz("Asia/Kolkata");
      const today = now.format("YYYY-MM-DD");
      const created_at = now.format("YYYY-MM-DD HH:mm:ss");
      const [result] = await pool.query(
        `INSERT IGNORE INTO user_daily_usage (user_id, usage_date, created_at) VALUES (?, ?, ?)`,
        [user_id, today, created_at]
      );
      await pool.query(
        `UPDATE users SET last_active = NOW() WHERE id = ?`,
        [user_id]
      ).catch(() => {});
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getDailyStreak: async (user_id) => {
    try {
      const [rows] = await pool.query(
        `SELECT usage_date 
       FROM user_daily_usage 
       WHERE user_id = ? 
       ORDER BY usage_date ASC`,
        [user_id]
      );

      let dailyLog = [];
      let streakCount = 0;
      let maxStreak = 0;
      let currentStreak = 0;
      let lastDate = null;

      rows.forEach((row, index) => {
        const usageDate = moment(row.usage_date)
          .tz("Asia/Kolkata")
          .startOf("day");

        if (lastDate && usageDate.diff(lastDate, "days") === 1) {
          streakCount++;
        } else {
          streakCount = 1;
        }

        dailyLog.push({
          usage_date: usageDate.format("YYYY-MM-DD"),
          streak: streakCount,
        });

        maxStreak = Math.max(maxStreak, streakCount);
        lastDate = usageDate;
      });

      // Determine current streak → must include today or yesterday
      if (rows.length > 0) {
        const lastUsage = moment(rows[rows.length - 1].usage_date)
          .tz("Asia/Kolkata")
          .startOf("day");

        const today = moment().tz("Asia/Kolkata").startOf("day");
        const diff = today.diff(lastUsage, "days");

        if (diff === 0 || diff === 1) {
          currentStreak = streakCount;
        } else {
          currentStreak = 0; // streak broken
        }
      }

      return {
        daily_log: dailyLog,
        currentStreak,
        maxStreak,
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },


  changePassword: async (user_id, currentPassword, newPassword) => {
    try {
      const query = `SELECT id, password FROM users WHERE id = ? AND is_active = 1`;
      const [isExists] = await pool.query(query, [user_id]);
      if (isExists.length <= 0) throw new Error("Invalid user Id");
      const isMatch = await verifyPassword(
        currentPassword,
        isExists[0].password
      );
      if (!isMatch) throw new Error("Invalid password!");
      const hashedPassword = await hashPassword(newPassword);
      const [result] = await pool.query(
        `UPDATE users SET password = ? WHERE id = ?`,
        [hashedPassword, user_id]
      );
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

// 🔐 Verify Password
const verifyPassword = async (password, hashedPassword) => {
  const isMatch = await bcrypt.compare(password, hashedPassword);
  return isMatch;
};

// 🔐 Encrypt (Hash) Password
const hashPassword = async (plainPassword) => {
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
  return hashedPassword;
};

module.exports = LoginModel;
