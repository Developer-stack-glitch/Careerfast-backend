const jwt = require("jsonwebtoken");
const pool = require("../config/dbConfig");

const convertUTCDateToLocalDate = (date) => {
  var newDate = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000);

  var offset = date.getTimezoneOffset() / 60;
  var hours = date.getHours();

  newDate.setHours(hours - offset);

  return newDate;
};

const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Extract Bearer token

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  // Verify the token
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Unauthorized! Invalid token" });
    }

    // If token is valid, store user info in the request and move to the next middleware
    req.user = decoded;
    if (decoded && decoded.id) {
      pool.query("UPDATE users SET last_active = NOW() WHERE id = ?", [decoded.id]).catch(() => {});
    }
    next();
  });
};

const verifySuperAdmin = async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(403).json({ success: false, message: "Access denied. Authentication required." });
  }

  // Fast-path: role_id present in token and equals 1
  if (req.user.role_id === 1 || req.user.role_name === 'SUPER-ADMIN' || req.user.role_name === 'SUPERADMIN') {
    return next();
  }

  // Fallback: verify role in database
  try {
    const [rows] = await pool.query("SELECT id, role_id FROM users WHERE id = ?", [req.user.id]);
    if (rows.length === 0) {
      return res.status(403).json({ success: false, message: "Access denied. User not found." });
    }
    const user = rows[0];
    req.user.role_id = user.role_id;
    if (user.role_id !== 1) {
      return res.status(403).json({ success: false, message: "Access denied. Super Admin clearance required." });
    }
    next();
  } catch (err) {
    console.error("Error in verifySuperAdmin:", err);
    return res.status(500).json({ success: false, message: "Authorization verification failed." });
  }
};

module.exports = {
  verifyToken,
  verifySuperAdmin,
  convertUTCDateToLocalDate,
};

