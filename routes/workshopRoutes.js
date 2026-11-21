const express = require("express");
const router = express.Router();
const WorkshopController = require("../controllers/WorkshopController");
const { verifyToken, verifySuperAdmin } = require("../Validation/Validation");

router.post("/", verifyToken, verifySuperAdmin, WorkshopController.createWorkshop);
router.get("/", WorkshopController.getAllWorkshops);
router.delete("/:id", verifyToken, verifySuperAdmin, WorkshopController.deleteWorkshop);

module.exports = router;
