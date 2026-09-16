const express = require("express");
const router = express.Router();
const EventRegistrationController = require("../controllers/EventRegistrationController");

// ✅ Register user for an event
router.post("/register", EventRegistrationController.registerForEvent);

// ✅ Get all registered events for a user
router.get("/user/:userId", EventRegistrationController.getUserRegistrations);

// ✅ Check if a user is already registered
router.get("/check", EventRegistrationController.checkIsRegistered);

module.exports = router;
