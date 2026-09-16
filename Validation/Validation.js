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
    return res.status(403).json({ message: "No token provided" });
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

module.exports = {
  verifyToken,
  convertUTCDateToLocalDate,
};
