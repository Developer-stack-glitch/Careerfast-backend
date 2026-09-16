const express = require("express");
const router = express.Router();
const WorkshopController = require("../controllers/WorkshopController");

router.post("/", WorkshopController.createWorkshop);
router.get("/", WorkshopController.getAllWorkshops);
router.delete("/:id", WorkshopController.deleteWorkshop);

module.exports = router;
