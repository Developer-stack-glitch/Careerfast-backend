const express = require("express");
const { googleLogin } = require("../controllers/authController");
const { authLimiter } = require("../middlewares/rateLimiter");

const router = express.Router();

router.post("/google", authLimiter, googleLogin);
// router.post("/is-profile-updated", isProfileUpdated);

module.exports = router;
