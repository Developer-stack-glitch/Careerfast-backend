const express = require("express");
const router = express.Router();
const WorkshopRegistrationController = require("../controllers/WorkshopRegistrationController");

// ✅ Register user for a workshop
router.post("/register", WorkshopRegistrationController.registerForWorkshop);

// ✅ Get all workshops registered by a user
router.get("/user/:userId", WorkshopRegistrationController.getUserRegisteredWorkshops);

// ✅ Check if already registered
router.get("/check", WorkshopRegistrationController.checkIsRegisteredWorkshop);

module.exports = router;
