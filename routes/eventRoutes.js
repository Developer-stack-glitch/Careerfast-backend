const express = require("express");
const router = express.Router();
const EventController = require("../controllers/EventController");

// No multer upload now
router.post("/", EventController.createEvent);
router.get("/", EventController.getAllEvents);
router.delete("/:id", EventController.deleteEvent);

module.exports = router;
