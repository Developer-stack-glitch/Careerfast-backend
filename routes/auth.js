const express = require("express");
const { googleLogin } = require("../controllers/authController");

const router = express.Router();

router.post("/google", googleLogin);
// router.post("/is-profile-updated", isProfileUpdated);

module.exports = router;
