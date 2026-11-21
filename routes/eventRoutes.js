const express = require("express");
const router = express.Router();
const EventController = require("../controllers/EventController");
const { verifyToken, verifySuperAdmin } = require("../Validation/Validation");

// No multer upload now
router.post("/", verifyToken, verifySuperAdmin, EventController.createEvent);
router.get("/", EventController.getAllEvents);
router.delete("/:id", verifyToken, verifySuperAdmin, EventController.deleteEvent);

module.exports = router;
